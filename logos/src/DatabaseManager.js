const mongoose = require('mongoose');
const Article = require('./models/Article');
const { ValidationError } = require('./news/errors/NewsErrors');

/**
 * DatabaseManager - Handles all database operations for article analysis
 * 
 * Features:
 * - Self-contained database connection management
 * - Article CRUD operations using Mongoose
 * - Advanced search and filtering with MongoDB queries
 * - Statistics and analytics with aggregation pipelines
 * - Performance optimized queries with proper indexing
 * - Error handling and validation
 * - Connection management and health checks
 */
class DatabaseManager {
  constructor(options = {}) {
    this.defaultLimit = options.defaultLimit || 50;
    this.maxLimit = options.maxLimit || 1000;
    this.connectionTimeout = options.connectionTimeout || 10000;
    
    // Database connection configuration
    this.dbUrl = options.dbUrl || options.mongoUri || process.env.MONGODB_URI || 'mongodb://localhost:27017/logos';
    
    // Detect if connecting to MongoDB Atlas or cloud provider
    const isCloudDb = this.dbUrl.includes('mongodb.net') || this.dbUrl.includes('mongodb+srv');
    
    this.connectionOptions = {
      // Conditional SSL configuration for cloud deployments
      ...(isCloudDb && {
        ssl: true,
        sslValidate: true,
        retryWrites: true,
        w: 'majority'
      }),
      // Common configuration
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
      bufferMaxEntries: 0,
      ...options.connectionOptions
    };
    
    // Connection state
    this.isConnected = false;
    this.connection = null;
    this._connectionPromise = null;
    
    // Auto-connect if specified
    if (options.autoConnect !== false) {
      this.connect().catch(err => {
        console.warn('DatabaseManager: Auto-connect failed:', err.message);
      });
    }
  }

  /**
   * Connect to MongoDB database
   * @returns {Promise<mongoose.Connection>} Database connection
   */
  async connect() {
    if (this._connectionPromise) {
      return this._connectionPromise;
    }

    this._connectionPromise = this._performConnection();
    return this._connectionPromise;
  }

  /**
   * Perform the actual database connection
   * @private
   */
  async _performConnection() {
    try {
      console.log(`DatabaseManager: Connecting to MongoDB at ${this.dbUrl}...`);
      
      // Set mongoose configuration
      mongoose.set('strictQuery', false);
      
      // Connect to database
      this.connection = await mongoose.connect(this.dbUrl, this.connectionOptions);
      
      // Setup event handlers for this connection
      this._setupConnectionEventHandlers();
      
      this.isConnected = true;
      console.log(`DatabaseManager: Connected to ${this.connection.connection.host}:${this.connection.connection.port}/${this.connection.connection.name}`);
      
      return this.connection;
      
    } catch (error) {
      this.isConnected = false;
      this._connectionPromise = null;
      console.error('DatabaseManager: Connection failed:', error.message);
      throw new Error(`Failed to connect to database: ${error.message}`);
    }
  }

  /**
   * Setup mongoose connection event handlers
   * @private
   */
  _setupConnectionEventHandlers() {
    if (!this.connection) return;

    this.connection.connection.on('connected', () => {
      this.isConnected = true;
      console.log('DatabaseManager: MongoDB connection established');
    });

    this.connection.connection.on('error', (err) => {
      this.isConnected = false;
      console.error('DatabaseManager: MongoDB connection error:', err);
    });

    this.connection.connection.on('disconnected', () => {
      this.isConnected = false;
      console.log('DatabaseManager: MongoDB disconnected');
    });

    this.connection.connection.on('reconnected', () => {
      this.isConnected = true;
      console.log('DatabaseManager: MongoDB reconnected');
    });
  }

  /**
   * Disconnect from MongoDB database
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      if (this.connection) {
        await this.connection.disconnect();
        console.log('DatabaseManager: Disconnected from MongoDB');
      }
      this.isConnected = false;
      this.connection = null;
      this._connectionPromise = null;
    } catch (error) {
      console.error('DatabaseManager: Error during disconnect:', error.message);
      throw error;
    }
  }

  /**
   * Check database connection status
   * @returns {boolean} Connection status
   */
  isConnectionHealthy() {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  /**
   * Get database connection info
   * @returns {Object} Connection information
   */
  getConnectionInfo() {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name,
      collections: Object.keys(mongoose.connection.collections)
    };
  }

  /**
   * Ensure database connection before operations
   * @returns {Promise<void>}
   */
  async _ensureConnection() {
    if (!this.isConnectionHealthy()) {
      // Try to connect if not connected
      if (!this._connectionPromise) {
        await this.connect();
      } else {
        await this._connectionPromise;
      }
      
      // Check again after connection attempt
      if (!this.isConnectionHealthy()) {
        throw new Error('Database connection is not available. Please ensure MongoDB is accessible.');
      }
    }
  }

  /**
   * Save analyzed article to database
   * @param {Object} articleData - Raw article data
   * @param {Object} analysis - AI analysis results
   * @returns {Promise<Object>} Saved article document
   */
  async saveArticle(articleData, analysis) {
    await this._ensureConnection();
    
    try {
      const articleDoc = new Article({
        title: articleData.title,
        description: articleData.description || '',
        content: articleData.content,
        url: articleData.url,
        urlToImage: articleData.urlToImage || null,
        publishedAt: articleData.publishedAt ? new Date(articleData.publishedAt) : new Date(),
        source: {
          name: articleData.source?.name || 'Unknown',
          url: articleData.source?.url || null
        },
        summary: analysis.summary,
        sentiment: {
          score: analysis.sentiment.score,
          confidence: analysis.sentiment.confidence,
          politicalBias: analysis.politicalBias
        },
        analyzedAt: new Date()
      });

      return await articleDoc.save();

    } catch (error) {
      if (error.code === 11000) { // Duplicate key error
        throw new ValidationError('Article with this URL already exists');
      }
      throw new Error(`Failed to save article to database: ${error.message}`);
    }
  }

  /**
   * Find article by URL
   * @param {string} url - Article URL
   * @returns {Promise<Object|null>} Article document or null if not found
   */
  async findByUrl(url) {
    await this._ensureConnection();
    
    try {
      return await Article.findOne({ url }).lean();
    } catch (error) {
      console.warn(`Database lookup failed for ${url}:`, error.message);
      return null; // Return null instead of throwing to allow graceful handling
    }
  }

  /**
   * Find article by ID
   * @param {string} id - Article ID
   * @returns {Promise<Object|null>} Article document or null if not found
   */
  async findById(id) {
    await this._ensureConnection();
    
    try {
      if (!this._isValidObjectId(id)) {
        return null;
      }
      return await Article.findById(id).lean();
    } catch (error) {
      console.warn(`Database lookup failed for ID ${id}:`, error.message);
      return null;
    }
  }

  /**
   * Update existing article
   * @param {string} id - Article ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object|null>} Updated article or null if not found
   */
  async updateArticle(id, updateData) {
    await this._ensureConnection();
    
    try {
      if (!this._isValidObjectId(id)) {
        return null;
      }
      
      return await Article.findByIdAndUpdate(
        id, 
        { ...updateData, updatedAt: new Date() },
        { new: true, lean: true }
      );
    } catch (error) {
      throw new Error(`Failed to update article: ${error.message}`);
    }
  }

  /**
   * Delete article by ID
   * @param {string} id - Article ID
   * @returns {Promise<Object|null>} Deleted article or null if not found
   */
  async deleteArticle(id) {
    await this._ensureConnection();
    
    try {
      if (!this._isValidObjectId(id)) {
        return null;
      }
      return await Article.findByIdAndDelete(id).lean();
    } catch (error) {
      throw new Error(`Failed to delete article: ${error.message}`);
    }
  }

  /**
   * Delete article by URL
   * @param {string} url - Article URL
   * @returns {Promise<Object|null>} Deleted article or null if not found
   */
  async deleteByUrl(url) {
    await this._ensureConnection();
    
    try {
      return await Article.findOneAndDelete({ url }).lean();
    } catch (error) {
      throw new Error(`Failed to delete article by URL: ${error.message}`);
    }
  }

  /**
   * Get total article count
   * @returns {Promise<number>} Total number of articles
   */
  async getArticleCount() {
    await this._ensureConnection();
    
    try {
      return await Article.countDocuments();
    } catch (error) {
      throw new Error(`Failed to get article count: ${error.message}`);
    }
  }

  /**
   * Search articles with advanced criteria
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Object>} Search results with pagination
   */
  async searchArticles(criteria = {}) {
    await this._ensureConnection();
    
    try {
      const {
        // Content filters
        title,
        description,
        content,
        
        // Sentiment filters
        sentiment,
        politicalBias,
        minConfidence,
        maxConfidence,
        
        // Date filters
        dateFrom,
        dateTo,
        publishedFrom,
        publishedTo,
        
        // Source filters
        sourceName,
        sourceUrl,
        
        // Pagination
        page = 1,
        limit = this.defaultLimit,
        
        // Sorting
        sortBy = 'analyzedAt',
        sortOrder = -1,
        
        // Field selection
        fields,
        includeContent = true

      } = criteria;

      // Validate pagination
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(this.maxLimit, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      // Build query
      const query = this._buildSearchQuery({
        title,
        description,
        content,
        sentiment,
        politicalBias,
        minConfidence,
        maxConfidence,
        dateFrom,
        dateTo,
        publishedFrom,
        publishedTo,
        sourceName,
        sourceUrl
      });

      // Build sort options
      const sortOptions = { [sortBy]: sortOrder };

      // Build field selection
      let selectFields = fields;
      if (!includeContent && !fields) {
        selectFields = '-content'; // Exclude full content for performance by default
      }

      // Execute query with count using aggregation for better performance
      const pipeline = [
        { $match: query },
        {
          $facet: {
            data: [
              { $sort: sortOptions },
              { $skip: skip },
              { $limit: limitNum },
              ...(selectFields ? [{ $project: this._buildProjection(selectFields) }] : [])
            ],
            count: [{ $count: "total" }]
          }
        }
      ];

      const [result] = await Article.aggregate(pipeline);
      const articles = result.data;
      const totalCount = result.count[0]?.total || 0;

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalCount / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPreviousPage = pageNum > 1;

      return {
        articles,
        pagination: {
          currentPage: pageNum,
          limit: limitNum,
          totalResults: totalCount,
          totalPages,
          hasNextPage,
          hasPreviousPage,
          nextPage: hasNextPage ? pageNum + 1 : null,
          previousPage: hasPreviousPage ? pageNum - 1 : null
        }
      };

    } catch (error) {
      throw new Error(`Failed to search articles: ${error.message}`);
    }
  }

  /**
   * Search articles by sentiment
   * @param {string} sentiment - Sentiment score (positive, neutral, negative)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Search results
   */
  async findBySentiment(sentiment, options = {}) {
    return this.searchArticles({
      sentiment,
      ...options
    });
  }

  /**
   * Search articles by political bias
   * @param {string} politicalBias - Political bias (left, center, right)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Search results
   */
  async findByPoliticalBias(politicalBias, options = {}) {
    return this.searchArticles({
      politicalBias,
      ...options
    });
  }

  /**
   * Search articles by confidence range
   * @param {number} minConfidence - Minimum confidence score
   * @param {number} maxConfidence - Maximum confidence score
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Search results
   */
  async findByConfidenceRange(minConfidence, maxConfidence, options = {}) {
    return this.searchArticles({
      minConfidence,
      maxConfidence,
      ...options
    });
  }

  /**
   * Search articles by date range
   * @param {string|Date} dateFrom - Start date
   * @param {string|Date} dateTo - End date
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Search results
   */
  async findByDateRange(dateFrom, dateTo, options = {}) {
    return this.searchArticles({
      dateFrom,
      dateTo,
      ...options
    });
  }

  /**
   * Search articles by source
   * @param {string} sourceName - Source name
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Search results
   */
  async findBySource(sourceName, options = {}) {
    return this.searchArticles({
      sourceName,
      ...options
    });
  }

  /**
   * Get comprehensive analysis statistics
   * @returns {Promise<Object>} Statistics summary
   */
  async getAnalysisStats() {
    await this._ensureConnection();
    
    try {
      const stats = await Article.aggregate([
        {
          $group: {
            _id: null,
            totalArticles: { $sum: 1 },
            avgConfidence: { $avg: '$sentiment.confidence' },
            sentimentBreakdown: { $push: '$sentiment.score' },
            politicalBreakdown: { $push: '$sentiment.politicalBias' },
            recentArticles: {
              $sum: {
                $cond: [
                  { $gte: ['$analyzedAt', new Date(Date.now() - 24 * 60 * 60 * 1000)] },
                  1,
                  0
                ]
              }
            },
            oldestArticle: { $min: '$analyzedAt' },
            newestArticle: { $max: '$analyzedAt' }
          }
        }
      ]);

      if (stats.length === 0) {
        return {
          totalArticles: 0,
          avgConfidence: 0,
          sentimentBreakdown: {},
          politicalBreakdown: {},
          recentArticles: 0,
          oldestArticle: null,
          newestArticle: null
        };
      }

      const result = stats[0];
      
      return {
        totalArticles: result.totalArticles,
        avgConfidence: Math.round(result.avgConfidence * 100) / 100,
        sentimentBreakdown: this._countArray(result.sentimentBreakdown),
        politicalBreakdown: this._countArray(result.politicalBreakdown),
        recentArticles: result.recentArticles,
        oldestArticle: result.oldestArticle,
        newestArticle: result.newestArticle
      };

    } catch (error) {
      throw new Error(`Failed to get analysis stats: ${error.message}`);
    }
  }

  /**
   * Get sentiment trends over time
   * @param {Object} options - Options for trend analysis
   * @returns {Promise<Array>} Sentiment trends
   */
  async getSentimentTrends(options = {}) {
    await this._ensureConnection();
    
    try {
      const { 
        groupBy = 'day', // day, week, month
        dateFrom,
        dateTo,
        limit = 30
      } = options;

      const matchStage = {};
      if (dateFrom || dateTo) {
        matchStage.analyzedAt = {};
        if (dateFrom) matchStage.analyzedAt.$gte = new Date(dateFrom);
        if (dateTo) matchStage.analyzedAt.$lte = new Date(dateTo);
      }

      // Define grouping format based on period
      const groupFormats = {
        day: { $dateToString: { format: '%Y-%m-%d', date: '$analyzedAt' } },
        week: { $dateToString: { format: '%Y-W%U', date: '$analyzedAt' } },
        month: { $dateToString: { format: '%Y-%m', date: '$analyzedAt' } }
      };

      const pipeline = [
        ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
        {
          $group: {
            _id: {
              date: groupFormats[groupBy],
              sentiment: '$sentiment.score'
            },
            count: { $sum: 1 },
            avgConfidence: { $avg: '$sentiment.confidence' }
          }
        },
        {
          $group: {
            _id: '$_id.date',
            sentiments: {
              $push: {
                sentiment: '$_id.sentiment',
                count: '$count',
                avgConfidence: '$avgConfidence'
              }
            },
            totalCount: { $sum: '$count' }
          }
        },
        { $sort: { _id: -1 } },
        { $limit: limit }
      ];

      return await Article.aggregate(pipeline);

    } catch (error) {
      throw new Error(`Failed to get sentiment trends: ${error.message}`);
    }
  }

  /**
   * Get top sources by article count
   * @param {Object} options - Options for source analysis
   * @returns {Promise<Array>} Top sources
   */
  async getTopSources(options = {}) {
    await this._ensureConnection();
    
    try {
      const { limit = 10, minArticles = 1 } = options;

      return await Article.aggregate([
        { $group: {
          _id: '$source.name',
          articleCount: { $sum: 1 },
          avgConfidence: { $avg: '$sentiment.confidence' },
          sentimentBreakdown: { $push: '$sentiment.score' },
          politicalBreakdown: { $push: '$sentiment.politicalBias' },
          latestArticle: { $max: '$analyzedAt' }
        }},
        { $match: { articleCount: { $gte: minArticles } } },
        { $sort: { articleCount: -1 } },
        { $limit: limit },
        { $project: {
          sourceName: '$_id',
          articleCount: 1,
          avgConfidence: { $round: ['$avgConfidence', 3] },
          sentimentBreakdown: 1,
          politicalBreakdown: 1,
          latestArticle: 1,
          _id: 0
        }}
      ]);

    } catch (error) {
      throw new Error(`Failed to get top sources: ${error.message}`);
    }
  }

  /**
   * Build MongoDB query from search criteria
   */
  _buildSearchQuery(criteria) {
    const query = {};

    // Text search
    if (criteria.title) {
      query.title = { $regex: criteria.title, $options: 'i' };
    }
    if (criteria.description) {
      query.description = { $regex: criteria.description, $options: 'i' };
    }
    if (criteria.content) {
      query.content = { $regex: criteria.content, $options: 'i' };
    }

    // Sentiment filters
    if (criteria.sentiment) {
      query['sentiment.score'] = criteria.sentiment;
    }
    if (criteria.politicalBias) {
      query['sentiment.politicalBias'] = criteria.politicalBias;
    }

    // Confidence range
    if (criteria.minConfidence !== undefined || criteria.maxConfidence !== undefined) {
      query['sentiment.confidence'] = {};
      if (criteria.minConfidence !== undefined) {
        query['sentiment.confidence'].$gte = criteria.minConfidence;
      }
      if (criteria.maxConfidence !== undefined) {
        query['sentiment.confidence'].$lte = criteria.maxConfidence;
      }
    }

    // Date ranges
    if (criteria.dateFrom || criteria.dateTo) {
      query.analyzedAt = {};
      if (criteria.dateFrom) query.analyzedAt.$gte = new Date(criteria.dateFrom);
      if (criteria.dateTo) query.analyzedAt.$lte = new Date(criteria.dateTo);
    }

    if (criteria.publishedFrom || criteria.publishedTo) {
      query.publishedAt = {};
      if (criteria.publishedFrom) query.publishedAt.$gte = new Date(criteria.publishedFrom);
      if (criteria.publishedTo) query.publishedAt.$lte = new Date(criteria.publishedTo);
    }

    // Source filters
    if (criteria.sourceName) {
      query['source.name'] = { $regex: criteria.sourceName, $options: 'i' };
    }
    if (criteria.sourceUrl) {
      query['source.url'] = { $regex: criteria.sourceUrl, $options: 'i' };
    }

    return query;
  }

  /**
   * Build MongoDB projection from field selection
   */
  _buildProjection(fields) {
    if (typeof fields === 'string') {
      // Handle string field selection like '-content'
      const projection = {};
      fields.split(' ').forEach(field => {
        if (field.startsWith('-')) {
          projection[field.substring(1)] = 0;
        } else {
          projection[field] = 1;
        }
      });
      return projection;
    }
    return fields; // Assume it's already a proper projection object
  }

  /**
   * Count array elements
   */
  _countArray(array) {
    return array.reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {});
  }

  /**
   * Validate MongoDB ObjectId format
   */
  _isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
  }
}

module.exports = DatabaseManager;
