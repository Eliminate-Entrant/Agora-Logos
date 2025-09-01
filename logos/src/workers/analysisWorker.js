const QueueManager = require('../queue/QueueManager');
const AgentSynopsis = require('../ai/AgentSynopsis');
const DatabaseManager = require('../DatabaseManager');

/**
 * Analysis Worker - Background processor for LLM article analysis
 * 
 * This worker:
 * 1. Connects to the Redis queue
 * 2. Processes article analysis jobs
 * 3. Handles errors and retries
 * 4. Updates job status in real-time
 */

class AnalysisWorker {
  constructor() {
    this.queueManager = new QueueManager();
    this.agent = new AgentSynopsis({
      cacheEnabled: true,
      maxContentLength: 8000
    });
    this.dbManager = new DatabaseManager();
    
    this.isShuttingDown = false;
    this.activeJobs = new Set();
    
    this.setupWorker();
    this.setupGracefulShutdown();
  }

  /**
   * Setup the queue worker to process jobs
   */
  setupWorker() {
    // Process jobs with concurrency of 3 (adjust based on your OpenAI rate limits)
    this.queueManager.analysisQueue.process('analyze-article', 3, async (job) => {
      return await this.processAnalysisJob(job);
    });

    console.log('Analysis worker started and listening for jobs...');
  }

  /**
   * Process a single article analysis job
   * @param {Object} job - Bull job object
   * @returns {Object} Analysis result
   */
  async processAnalysisJob(job) {
    const { jobId, articleData, requestedAt } = job.data;
    
    try {
      this.activeJobs.add(jobId);
      
      console.log(`Processing analysis job ${jobId} for article: ${articleData.title?.substring(0, 50)}...`);
      
      // Update job progress
      await job.progress(10); // Starting analysis
      
      // Check if article already exists in database (caching)
      const existingArticle = await this.dbManager.findByUrl(articleData.url);
      if (existingArticle) {
        console.log(`Found cached analysis for ${articleData.url}`);
        await job.progress(100); // Complete
        
        return {
          cached: true,
          analysis: this.formatAnalysisResult(existingArticle),
          processingTime: Date.now() - new Date(requestedAt).getTime()
        };
      }

      await job.progress(30); // Cache check complete
      
      // Perform LLM analysis
      console.log(`Calling LLM for analysis of ${articleData.url}`);
      const analysisStartTime = Date.now();
      
      const analysis = await this.agent.analyzeArticle(articleData);
      
      const analysisTime = Date.now() - analysisStartTime;
      console.log(`LLM analysis completed in ${analysisTime}ms for job ${jobId}`);
      
      await job.progress(90); // Analysis complete
      
      // Format result
      const result = {
        cached: false,
        analysis: this.formatAnalysisResult(analysis),
        processingTime: Date.now() - new Date(requestedAt).getTime(),
        llmResponseTime: analysisTime
      };

      await job.progress(100); // Job complete
      
      console.log(`Job ${jobId} completed successfully`);
      return result;

    } catch (error) {
      console.error(`Job ${jobId} failed:`, error);
      
      // Determine if error is retryable
      const isRetryable = this.isRetryableError(error);
      
      if (!isRetryable) {
        // Mark as failed permanently
        throw new Error(`Non-retryable error: ${error.message}`);
      }
      
      // Let Bull handle the retry
      throw error;
      
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Format analysis result for consistent API response
   * @param {Object} analysis - Raw analysis from AgentSynopsis
   * @returns {Object} Formatted result
   */
  formatAnalysisResult(analysis) {
    return {
      id: analysis.id || analysis._id,
      title: analysis.title,
      description: analysis.description,
      content: analysis.content,
      url: analysis.url,
      urlToImage: analysis.urlToImage,
      publishedAt: analysis.publishedAt,
      source: analysis.source,
      summary: analysis.summary,
      sentiment: {
        score: analysis.sentiment?.score,
        confidence: analysis.sentiment?.confidence,
        politicalBias: analysis.sentiment?.politicalBias
      },
      analyzedAt: analysis.analyzedAt,
      createdAt: analysis.createdAt,
      updatedAt: analysis.updatedAt
    };
  }

  /**
   * Determine if an error is retryable
   * @param {Error} error - Error object
   * @returns {boolean} Whether the error is retryable
   */
  isRetryableError(error) {
    const retryablePatterns = [
      /timeout/i,
      /rate limit/i,
      /service unavailable/i,
      /internal server error/i,
      /502/,
      /503/,
      /504/,
      /ECONNRESET/,
      /ETIMEDOUT/,
      /ENOTFOUND/
    ];

    const nonRetryablePatterns = [
      /invalid.*key/i,
      /unauthorized/i,
      /forbidden/i,
      /400/,
      /401/,
      /403/,
      /validation/i,
      /content.*too.*short/i
    ];

    // Check for non-retryable errors first
    for (const pattern of nonRetryablePatterns) {
      if (pattern.test(error.message)) {
        return false;
      }
    }

    // Check for retryable errors
    for (const pattern of retryablePatterns) {
      if (pattern.test(error.message)) {
        return true;
      }
    }

    // Default to retryable for unknown errors
    return true;
  }

  /**
   * Setup graceful shutdown handling
   */
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      console.log(`Received ${signal}. Starting graceful shutdown...`);
      this.isShuttingDown = true;
      
      try {
        // Stop accepting new jobs
        await this.queueManager.analysisQueue.pause();
        console.log('Queue paused - no new jobs will be processed');
        
        // Wait for active jobs to complete (with timeout)
        const maxWaitTime = 60000; // 1 minute
        const startTime = Date.now();
        
        while (this.activeJobs.size > 0 && (Date.now() - startTime) < maxWaitTime) {
          console.log(`Waiting for ${this.activeJobs.size} active jobs to complete...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        if (this.activeJobs.size > 0) {
          console.warn(`Shutting down with ${this.activeJobs.size} jobs still active`);
        }
        
        // Close connections
        await this.queueManager.close();
        await this.dbManager.disconnect();
        
        console.log('Graceful shutdown completed');
        process.exit(0);
        
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception in worker:', error);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection in worker at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });
  }

  /**
   * Start the worker
   */
  start() {
    console.log('Analysis Worker started successfully');
    console.log('Process ID:', process.pid);
    console.log('Ready to process article analysis jobs...');
  }
}

// Create and start worker if called directly
if (require.main === module) {
  const worker = new AnalysisWorker();
  worker.start();
}

module.exports = AnalysisWorker;
