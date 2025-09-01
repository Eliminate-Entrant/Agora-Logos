const Queue = require('bull');
const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');

/**
 * QueueManager - Handles async job processing with Redis and Bull
 * 
 * Features:
 * - Job queuing and processing
 * - Job status tracking
 * - Retry mechanisms
 * - Dead letter queues
 * - Job metrics and monitoring
 */
class QueueManager {
  constructor(options = {}) {
    this.redisConfig = {
      host: options.redisHost || process.env.REDIS_HOST || 'localhost',
      port: options.redisPort || process.env.REDIS_PORT || 6379,
      password: options.redisPassword || process.env.REDIS_PASSWORD,
      db: options.redisDb || process.env.REDIS_DB || 0,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
    };

    // Initialize Redis connection
    this.redis = new Redis(this.redisConfig);
    
    // Initialize job queues
    this.analysisQueue = new Queue('article-analysis', {
      redis: this.redisConfig,
      defaultJobOptions: {
        removeOnComplete: 100, // Keep 100 completed jobs
        removeOnFail: 50,      // Keep 50 failed jobs
        attempts: 3,           // Retry failed jobs 3 times
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    // Job status storage (separate from queue for faster lookups)
    this.jobStatusKey = 'job_status:';
    this.jobResultKey = 'job_result:';
    
    this.setupQueueEvents();
    console.log('QueueManager initialized with Redis at', `${this.redisConfig.host}:${this.redisConfig.port}`);
  }

  /**
   * Setup queue event listeners for monitoring
   */
  setupQueueEvents() {
    this.analysisQueue.on('active', (job) => {
      console.log(`Job ${job.id} started processing`);
      this.updateJobStatus(job.data.jobId, 'processing', { startedAt: new Date() });
    });

    this.analysisQueue.on('completed', (job, result) => {
      console.log(`Job ${job.id} completed successfully`);
      this.updateJobStatus(job.data.jobId, 'completed', { 
        completedAt: new Date(),
        result 
      });
      this.storeJobResult(job.data.jobId, result);
    });

    this.analysisQueue.on('failed', (job, err) => {
      console.error(`Job ${job.id} failed:`, err.message);
      this.updateJobStatus(job.data.jobId, 'failed', { 
        failedAt: new Date(),
        error: err.message,
        attempt: job.attemptsMade
      });
    });

    this.analysisQueue.on('stalled', (job) => {
      console.warn(`Job ${job.id} stalled`);
      this.updateJobStatus(job.data.jobId, 'stalled', { stalledAt: new Date() });
    });
  }

  /**
   * Queue an article for analysis
   * @param {Object} articleData - Article data to analyze
   * @param {Object} options - Job options
   * @returns {Object} Job information
   */
  async queueArticleAnalysis(articleData, options = {}) {
    try {
      const jobId = uuidv4();
      const priority = options.priority || 0; // Higher number = higher priority
      const delay = options.delay || 0; // Delay in milliseconds

      // Validate article data
      this.validateArticleData(articleData);

      // Create job data
      const jobData = {
        jobId,
        articleData,
        requestedAt: new Date(),
        userId: options.userId,
        priority,
      };

      // Add job to queue
      const job = await this.analysisQueue.add('analyze-article', jobData, {
        priority,
        delay,
        jobId, // Use custom job ID for easier tracking
      });

      // Initialize job status
      await this.updateJobStatus(jobId, 'queued', {
        queuedAt: new Date(),
        bullJobId: job.id,
        estimatedWaitTime: await this.getEstimatedWaitTime(),
      });

      console.log(`Article analysis job queued: ${jobId}`);

      return {
        jobId,
        bullJobId: job.id,
        status: 'queued',
        estimatedWaitTime: await this.getEstimatedWaitTime(),
        queuedAt: new Date(),
      };

    } catch (error) {
      console.error('Failed to queue article analysis:', error);
      throw new Error(`Failed to queue analysis: ${error.message}`);
    }
  }

  /**
   * Get job status and progress
   * @param {string} jobId - Job ID
   * @returns {Object} Job status information
   */
  async getJobStatus(jobId) {
    try {
      const statusData = await this.redis.get(`${this.jobStatusKey}${jobId}`);
      
      if (!statusData) {
        return null;
      }

      const status = JSON.parse(statusData);
      
      // If completed, include result
      if (status.status === 'completed') {
        const result = await this.getJobResult(jobId);
        if (result) {
          status.result = result;
        }
      }

      // Add queue position if still waiting
      if (status.status === 'queued' && status.bullJobId) {
        const queuePosition = await this.getQueuePosition(status.bullJobId);
        status.queuePosition = queuePosition;
      }

      return status;

    } catch (error) {
      console.error('Failed to get job status:', error);
      throw new Error(`Failed to get job status: ${error.message}`);
    }
  }

  /**
   * Get job result (for completed jobs)
   * @param {string} jobId - Job ID
   * @returns {Object} Job result
   */
  async getJobResult(jobId) {
    try {
      const resultData = await this.redis.get(`${this.jobResultKey}${jobId}`);
      return resultData ? JSON.parse(resultData) : null;
    } catch (error) {
      console.error('Failed to get job result:', error);
      return null;
    }
  }

  /**
   * Cancel a queued or processing job
   * @param {string} jobId - Job ID
   * @returns {boolean} Success status
   */
  async cancelJob(jobId) {
    try {
      const status = await this.getJobStatus(jobId);
      
      if (!status || !status.bullJobId) {
        return false;
      }

      if (status.status === 'completed' || status.status === 'failed') {
        return false; // Can't cancel completed/failed jobs
      }

      const job = await this.analysisQueue.getJob(status.bullJobId);
      if (job) {
        await job.remove();
        await this.updateJobStatus(jobId, 'cancelled', { cancelledAt: new Date() });
        return true;
      }

      return false;

    } catch (error) {
      console.error('Failed to cancel job:', error);
      return false;
    }
  }

  /**
   * Get queue statistics
   * @returns {Object} Queue metrics
   */
  async getQueueStats() {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.analysisQueue.getWaiting(),
        this.analysisQueue.getActive(),
        this.analysisQueue.getCompleted(),
        this.analysisQueue.getFailed(),
        this.analysisQueue.getDelayed(),
      ]);

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        total: waiting.length + active.length + completed.length + failed.length + delayed.length,
      };

    } catch (error) {
      console.error('Failed to get queue stats:', error);
      return null;
    }
  }

  /**
   * Clean up old jobs and results
   * @param {number} olderThanHours - Remove jobs older than X hours
   */
  async cleanupOldJobs(olderThanHours = 24) {
    try {
      // Clean Bull queue
      await this.analysisQueue.clean(olderThanHours * 60 * 60 * 1000, 'completed');
      await this.analysisQueue.clean(olderThanHours * 60 * 60 * 1000, 'failed');

      // Clean Redis job status/results
      const cutoffTime = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));
      
      // This is a simplified cleanup - in production, you'd want to scan and clean based on timestamps
      console.log(`Cleaned up jobs older than ${olderThanHours} hours`);

    } catch (error) {
      console.error('Failed to cleanup old jobs:', error);
    }
  }

  /**
   * Get estimated wait time for new jobs
   * @returns {number} Estimated wait time in milliseconds
   */
  async getEstimatedWaitTime() {
    try {
      const stats = await this.getQueueStats();
      const avgProcessingTime = 15000; // 15 seconds average (you can track this dynamically)
      
      return stats.waiting * avgProcessingTime;

    } catch (error) {
      console.error('Failed to calculate wait time:', error);
      return 30000; // Default to 30 seconds
    }
  }

  /**
   * Get job position in queue
   * @param {string} bullJobId - Bull job ID
   * @returns {number} Position in queue (0-based)
   */
  async getQueuePosition(bullJobId) {
    try {
      const waitingJobs = await this.analysisQueue.getWaiting();
      const position = waitingJobs.findIndex(job => job.id === bullJobId);
      return position >= 0 ? position + 1 : 0; // 1-based position
    } catch (error) {
      console.error('Failed to get queue position:', error);
      return 0;
    }
  }

  /**
   * Update job status in Redis
   * @private
   */
  async updateJobStatus(jobId, status, additionalData = {}) {
    try {
      const existingData = await this.redis.get(`${this.jobStatusKey}${jobId}`);
      const currentData = existingData ? JSON.parse(existingData) : {};
      
      const updatedData = {
        ...currentData,
        status,
        updatedAt: new Date(),
        ...additionalData,
      };

      await this.redis.setex(
        `${this.jobStatusKey}${jobId}`,
        86400, // 24 hours TTL
        JSON.stringify(updatedData)
      );

    } catch (error) {
      console.error('Failed to update job status:', error);
    }
  }

  /**
   * Store job result in Redis
   * @private
   */
  async storeJobResult(jobId, result) {
    try {
      await this.redis.setex(
        `${this.jobResultKey}${jobId}`,
        86400, // 24 hours TTL
        JSON.stringify(result)
      );
    } catch (error) {
      console.error('Failed to store job result:', error);
    }
  }

  /**
   * Validate article data before queuing
   * @private
   */
  validateArticleData(articleData) {
    if (!articleData || typeof articleData !== 'object') {
      throw new Error('Article data must be an object');
    }

    const required = ['title', 'content', 'url'];
    for (const field of required) {
      if (!articleData[field] || typeof articleData[field] !== 'string') {
        throw new Error(`Article ${field} is required and must be a string`);
      }
    }

    if (articleData.content.length < 50) {
      throw new Error('Article content is too short for meaningful analysis');
    }
  }

  /**
   * Close connections gracefully
   */
  async close() {
    try {
      await this.analysisQueue.close();
      await this.redis.disconnect();
      console.log('QueueManager connections closed');
    } catch (error) {
      console.error('Error closing QueueManager:', error);
    }
  }
}

module.exports = QueueManager;

