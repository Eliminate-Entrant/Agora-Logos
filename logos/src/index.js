// Load environment variables from logos directory
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const DatabaseManager = require('./DatabaseManager');

// Import route modules
const newsRoutes = require('./routes/news');
const analysisRoutes = require('./routes/analysis');

/**
 * Logos API Server
 * 
 * Features:
 * - News aggregation and search
 * - AI-powered article analysis
 * - Sentiment analysis and political bias detection
 * - Database storage and retrieval
 * - RESTful API with proper error handling
 */

class LogosServer {
  constructor(options = {}) {
    this.app = express();
    this.port = options.port || process.env.PORT || 5001;
    this.env = options.env || process.env.NODE_ENV || 'development';
    
    // Database configuration
    this.dbManager = options.dbManager || new DatabaseManager({
      dbUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/logos',
      autoConnect: true
    });
    
    // Initialize middleware and routes
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup middleware stack
   */
  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      crossOriginEmbedderPolicy: false
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || ['http://localhost:3000', 'http://localhost:3001'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: this.env === 'production' ? 100 : 1000, // Limit each IP
      message: {
        error: 'Too many requests from this IP, please try again later.'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api/', limiter);

    // Compression for better performance
    this.app.use(compression());

    // Body parsing middleware
    this.app.use(express.json({ 
      limit: '10mb',
      verify: (req, res, buf) => {
        try {
          JSON.parse(buf);
        } catch (e) {
          res.status(400).json({ error: 'Invalid JSON format' });
          throw new Error('Invalid JSON');
        }
      }
    }));
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: '10mb' 
    }));

    // Request logging
    if (this.env === 'development') {
      this.app.use(morgan('dev'));
    } else {
      this.app.use(morgan('combined'));
    }

    // Request ID middleware for tracking
    this.app.use((req, res, next) => {
      req.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
      res.setHeader('X-Request-ID', req.id);
      next();
    });


  }

  /**
   * Setup API routes
   */
  setupRoutes() {
    // API base path
    const apiPath = '/api/v1';

    // Welcome/root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        message: 'Welcome to Logos API',
        version: '1.0.0',
        documentation: {
          news: `${req.protocol}://${req.get('host')}${apiPath}/news`,
          analysis: `${req.protocol}://${req.get('host')}${apiPath}/analysis`
        },
        endpoints: {
          news: [
            'GET /api/v1/news/search - Search news articles',
            'GET /api/v1/news/headlines - Get top headlines',
            'GET /api/v1/news/providers - Get available providers',
            'GET /api/v1/news/enums - Get available enums'
          ],
          analysis: [
            'POST /api/v1/analysis/article - Analyze single article',
            'POST /api/v1/analysis/batch - Batch analyze articles',
            'GET /api/v1/analysis/search - Search analyzed articles',
            'GET /api/v1/analysis/stats - Get analysis statistics',
            'GET /api/v1/analysis/trends/sentiment - Get sentiment trends',
            'GET /api/v1/analysis/sources/top - Get top sources'
          ]
        }
      });
    });

    // API routes
    this.app.use(`${apiPath}/news`, newsRoutes);
    this.app.use(`${apiPath}/analysis`, analysisRoutes);

    // API documentation endpoint
    this.app.get(`${apiPath}`, (req, res) => {
      res.json({
        message: 'Logos API v1',
        routes: {
          news: {
            path: '/news',
            description: 'News aggregation and search endpoints',
            endpoints: [
              'GET /search - Search for news articles',
              'GET /headlines - Get top headlines',
              'GET /providers - Get available news providers',
              'GET /enums - Get available search options'
            ]
          },
          analysis: {
            path: '/analysis',
            description: 'AI-powered article analysis endpoints',
            endpoints: [
              'POST /article - Analyze a single article',
              'POST /batch - Batch analyze multiple articles',
              'GET /search - Search analyzed articles',
              'GET /stats - Get analysis statistics',
              'GET /article/:id - Get specific analyzed article',
              'DELETE /article/:id - Delete analyzed article',
              'POST /reanalyze/:id - Re-analyze existing article',
              'GET /trends/sentiment - Get sentiment trends',
              'GET /sources/top - Get top news sources',
              'GET /sentiment/:sentiment - Filter by sentiment',
              'GET /political/:bias - Filter by political bias',
              'GET /url/:encodedUrl - Find article by URL'
            ]
          }
        }
      });
    });

    // 404 handler for API routes
    this.app.use(`${apiPath}/*`, (req, res) => {
      res.status(404).json({
        error: 'API endpoint not found',
        message: `The endpoint ${req.method} ${req.originalUrl} does not exist`,
        availableEndpoints: {
          news: '/api/v1/news',
          analysis: '/api/v1/analysis'
        }
      });
    });

    // Generic 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Resource not found',
        message: `The resource ${req.originalUrl} was not found on this server`,
        suggestion: 'Check the API documentation at /api/v1'
      });
    });
  }

  /**
   * Setup global error handling
   */
  setupErrorHandling() {
    // Global error handler
    this.app.use((error, req, res, next) => {
      console.error(`Error ${req.id}:`, error);

      // Handle specific error types
      if (error.type === 'entity.parse.failed') {
        return res.status(400).json({
          error: 'Invalid JSON format',
          message: 'Request body contains invalid JSON'
        });
      }

      if (error.type === 'entity.too.large') {
        return res.status(413).json({
          error: 'Request too large',
          message: 'Request body exceeds maximum size limit'
        });
      }

      // Default error response
      const statusCode = error.statusCode || error.status || 500;
      const isDevelopment = this.env === 'development';

      res.status(statusCode).json({
        error: error.message || 'Internal server error',
        ...(isDevelopment && { stack: error.stack }),
        requestId: req.id,
        timestamp: new Date().toISOString()
      });
    });

    // Graceful shutdown handling
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      this.gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.gracefulShutdown('unhandledRejection');
    });
  }

  /**
   * Start the server
   */
  async start() {
    try {
      // Ensure database connection
      await this.dbManager.connect();
      console.log('Database connected successfully');

      // Start HTTP server
              this.server = this.app.listen(this.port, () => {
          console.log(`Logos API server running on port ${this.port}`);
          console.log(`API Documentation: http://localhost:${this.port}/api/v1`);
          console.log(`Environment: ${this.env}`);
        });

      return this.server;

    } catch (error) {
      console.error('❌ Failed to start server:', error.message);
      process.exit(1);
    }
  }

  /**
   * Stop the server gracefully
   */
  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(async () => {
          console.log('🛑 HTTP server closed');
          
          try {
            await this.dbManager.disconnect();
            console.log('🛑 Database disconnected');
          } catch (error) {
            console.error('Error disconnecting database:', error.message);
          }
          
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Graceful shutdown handler
   */
  async gracefulShutdown(signal) {
    console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
    
    try {
      await this.stop();
      console.log('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error.message);
      process.exit(1);
    }
  }

  /**
   * Get Express app instance
   */
  getApp() {
    return this.app;
  }
}

// Create and export server instance
const server = new LogosServer();

// Start server if called directly
if (require.main === module) {
  server.start().catch(console.error);
}

module.exports = {
  LogosServer,
  server
};
