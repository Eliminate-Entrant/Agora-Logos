const express = require('express');
const AgentSynopsis = require('../ai/AgentSynopsis');
const DatabaseManager = require('../DatabaseManager');
const QueueManager = require('../queue/QueueManager');
const { newsErrorHandler } = require('../news/errors/NewsErrors');

const router = express.Router();

// Initialize services
const agent = new AgentSynopsis({
  cacheEnabled: true,
  maxContentLength: 8000
});

const queueManager = new QueueManager();

// ASYNC: Queue article for analysis
router.post('/article', async (req, res) => {
  try {
    const articleData = req.body;
    const { priority, sync } = req.query; // Allow forcing sync mode for testing
    
    // Option 1: Synchronous mode (original behavior) - for backward compatibility
    if (sync === 'true') {
      const analysis = await agent.analyzeArticle(articleData);
      
      return res.json({
        success: true,
        message: 'Article analyzed successfully (synchronous)',
        data: analysis,
        sync: true
      });
    }
    
    // Option 2: Asynchronous mode (new default)
    const job = await queueManager.queueArticleAnalysis(articleData, {
      priority: priority ? parseInt(priority) : 0,
      userId: req.user?.id, // If you have authentication
    });
    
    res.status(202).json({
      success: true,
      message: 'Article queued for analysis',
      data: {
        jobId: job.jobId,
        status: job.status,
        estimatedWaitTime: job.estimatedWaitTime,
        queuedAt: job.queuedAt,
        statusUrl: `/api/v1/analysis/job/${job.jobId}`,
        resultUrl: `/api/v1/analysis/job/${job.jobId}/result`
      },
      async: true
    });

  } catch (error) {
    newsErrorHandler(error, req, res);
  }
});

// NEW: Get job status
router.get('/job/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const status = await queueManager.getJobStatus(jobId);
    
    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
        message: 'The specified job ID does not exist or has expired'
      });
    }
    
    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    newsErrorHandler(error, req, res);
  }
});

// NEW: Get job result (for completed jobs)
router.get('/job/:jobId/result', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const status = await queueManager.getJobStatus(jobId);
    
    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }
    
    if (status.status !== 'completed') {
      return res.status(202).json({
        success: false,
        message: `Job is ${status.status}`,
        data: {
          status: status.status,
          progress: status.progress,
          queuePosition: status.queuePosition
        }
      });
    }
    
    res.json({
      success: true,
      message: 'Analysis completed',
      data: status.result || status.analysis
    });

  } catch (error) {
    newsErrorHandler(error, req, res);
  }
});

// NEW: Cancel job
router.delete('/job/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const cancelled = await queueManager.cancelJob(jobId);
    
    if (!cancelled) {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel job',
        message: 'Job may be already completed, failed, or does not exist'
      });
    }
    
    res.json({
      success: true,
      message: 'Job cancelled successfully',
      data: { jobId }
    });

  } catch (error) {
    newsErrorHandler(error, req, res);
  }
});

// NEW: Get queue statistics
router.get('/queue/stats', async (req, res) => {
  try {
    const stats = await queueManager.getQueueStats();
    
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    newsErrorHandler(error, req, res);
  }
});


/**
 * GET /analysis/search
 * Search analyzed articles by criteria
 * 
 * Query parameters:
 * - sentiment: Filter by sentiment (positive, neutral, negative)
 * - politicalBias: Filter by political bias (left, center, right)
 * - minConfidence: Minimum confidence score (0.0-1.0)
 * - maxConfidence: Maximum confidence score (0.0-1.0)
 * - dateFrom: Start date filter (ISO string)
 * - dateTo: End date filter (ISO string)
 * - limit: Maximum results (default: 50)
 * - sortBy: Sort field (default: analyzedAt)
 * - sortOrder: Sort order 1=asc, -1=desc (default: -1)
 */
router.get('/search', async (req, res) => {
  try {
    const {
      sentiment,
      politicalBias,
      minConfidence,
      maxConfidence,
      dateFrom,
      dateTo,
      limit,
      sortBy,
      sortOrder
    } = req.query;

    const criteria = {};
    if (sentiment) criteria.sentiment = sentiment;
    if (politicalBias) criteria.politicalBias = politicalBias;
    if (minConfidence) criteria.minConfidence = parseFloat(minConfidence);
    if (maxConfidence) criteria.maxConfidence = parseFloat(maxConfidence);
    if (dateFrom) criteria.dateFrom = dateFrom;
    if (dateTo) criteria.dateTo = dateTo;
    if (limit) criteria.limit = parseInt(limit);
    if (sortBy) criteria.sortBy = sortBy;
    if (sortOrder) criteria.sortOrder = parseInt(sortOrder);
    
    // Include content for frontend display
    criteria.includeContent = true;

    const articles = await agent.searchAnalyzedArticles(criteria);
    
    res.json({
      success: true,
      count: articles.length,
      data: articles
    });

  } catch (error) {
    newsErrorHandler(error, req, res);
  }
});

/**
 * GET /analysis/stats
 * Get analysis statistics and summaries
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await agent.getAnalysisStats();
    
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    newsErrorHandler(error, req, res);
  }
});

/**
 * GET /analysis/article/:id
 * Get a specific analyzed article by ID
 */
router.get('/article/:id', async (req, res) => {
  try {
    const article = await agent.findArticleById(req.params.id);
    
    if (!article) {
      return res.status(404).json({
        success: false,
        error: 'Article not found'
      });
    }

    res.json({
      success: true,
      data: article
    });

  } catch (error) {
    newsErrorHandler(error, req, res);
  }
});

/**
 * DELETE /analysis/article/:id
 * Delete an analyzed article by ID
 */
router.delete('/article/:id', async (req, res) => {
  try {
    const deleted = await agent.deleteArticle(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Article not found'
      });
    }

    res.json({
      success: true,
      message: 'Article deleted successfully',
      data: { id: req.params.id }
    });

  } catch (error) {
    newsErrorHandler(error, req, res);
  }
});

/**
 * POST /analysis/reanalyze/:id
 * Re-analyze an existing article with fresh AI analysis
 */
router.post('/reanalyze/:id', async (req, res) => {
  try {
    // Find existing article
    const existingArticle = await agent.findArticleById(req.params.id);
    
    if (!existingArticle) {
      return res.status(404).json({
        success: false,
        error: 'Article not found'
      });
    }

    // Delete existing article to force re-analysis
    await agent.deleteArticle(req.params.id);

    // Re-analyze with fresh AI call
    const articleData = {
      title: existingArticle.title,
      description: existingArticle.description,
      content: existingArticle.content,
      url: existingArticle.url,
      urlToImage: existingArticle.urlToImage,
      publishedAt: existingArticle.publishedAt,
      source: existingArticle.source
    };

    const freshAnalysis = await agent.analyzeArticle(articleData);
    
    res.json({
      success: true,
      message: 'Article re-analyzed successfully',
      data: freshAnalysis
    });

  } catch (error) {
    newsErrorHandler(error, req, res);
  }
});

/**
 * GET /analysis/trends/sentiment
 * Get sentiment trends over time
 * 
 * Query parameters:
 * - groupBy: Grouping period (day, week, month) default: day
 * - dateFrom: Start date filter (ISO string)
 * - dateTo: End date filter (ISO string)
 * - limit: Maximum results (default: 30)
 */
router.get('/trends/sentiment', async (req, res) => {
  try {
    const { groupBy, dateFrom, dateTo, limit } = req.query;
    
    const trends = await agent.getSentimentTrends({
      groupBy,
      dateFrom,
      dateTo,
      limit: limit ? parseInt(limit) : undefined
    });
    
    res.json({
      success: true,
      data: trends
    });

  } catch (error) {
    newsErrorHandler(error, req, res);
  }
});

/**
 * GET /analysis/sources/top
 * Get top sources by article count
 * 
 * Query parameters:
 * - limit: Maximum results (default: 10)
 * - minArticles: Minimum article count (default: 1)
 */
router.get('/sources/top', async (req, res) => {
  try {
    const { limit, minArticles } = req.query;
    
    const topSources = await agent.getTopSources({
      limit: limit ? parseInt(limit) : undefined,
      minArticles: minArticles ? parseInt(minArticles) : undefined
    });
    
    res.json({
      success: true,
      data: topSources
    });

  } catch (error) {
    newsErrorHandler(error, req, res);
  }
});

/**
 * GET /analysis/sentiment/:sentiment
 * Get articles by specific sentiment
 * 
 * Parameters:
 * - sentiment: Sentiment type (positive, neutral, negative)
 * 
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Results per page (default: 20)
 * - minConfidence: Minimum confidence score
 * - sortBy: Sort field (default: analyzedAt)
 * - sortOrder: Sort order 1=asc, -1=desc (default: -1)
 */
router.get('/sentiment/:sentiment', async (req, res) => {
  try {
    const { sentiment } = req.params;
    const { page, limit, minConfidence, sortBy, sortOrder } = req.query;
    
    // Validate sentiment
    const validSentiments = ['positive', 'neutral', 'negative'];
    if (!validSentiments.includes(sentiment)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid sentiment. Must be: positive, neutral, or negative'
      });
    }
    
    const results = await agent.findBySentiment(sentiment, {
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      minConfidence: minConfidence ? parseFloat(minConfidence) : undefined,
      sortBy,
      sortOrder: sortOrder ? parseInt(sortOrder) : undefined
    });
    
    res.json({
      success: true,
      data: results
    });

  } catch (error) {
    newsErrorHandler(error, req, res);
  }
});

/**
 * GET /analysis/political/:bias
 * Get articles by political bias
 * 
 * Parameters:
 * - bias: Political bias (left, center, right)
 * 
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Results per page (default: 20)
 * - minConfidence: Minimum confidence score
 * - sortBy: Sort field (default: analyzedAt)
 * - sortOrder: Sort order 1=asc, -1=desc (default: -1)
 */
router.get('/political/:bias', async (req, res) => {
  try {
    const { bias } = req.params;
    const { page, limit, minConfidence, sortBy, sortOrder } = req.query;
    
    // Validate political bias
    const validBias = ['left', 'center', 'right'];
    if (!validBias.includes(bias)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid political bias. Must be: left, center, or right'
      });
    }
    
    const results = await agent.findByPoliticalBias(bias, {
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      minConfidence: minConfidence ? parseFloat(minConfidence) : undefined,
      sortBy,
      sortOrder: sortOrder ? parseInt(sortOrder) : undefined
    });
    
    res.json({
      success: true,
      data: results
    });

  } catch (error) {
    newsErrorHandler(error, req, res);
  }
});


module.exports = router;
