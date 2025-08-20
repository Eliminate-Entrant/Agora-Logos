const GNewsProvider = require('./providers/GNewsProvider');
const NewsAPIProvider = require('./providers/NewsAPIProvider');
const { ProviderNames } = require('./enums');
const { 
  ProviderNotFoundError, 
  NoProvidersAvailableError, 
  InvalidQueryError 
} = require('./errors/NewsErrors');

/**
 * News Client - Simplified main interface for all news operations
 */
class NewsClient {
  constructor() {
    this.providers = new Map();
    this.defaultProvider = null;
    this.articleCache = new Map(); // Cache articles by search query to handle pagination
    this._autoRegisterProviders();
  }

  /**
   * Auto-register providers based on environment variables
   */
  _autoRegisterProviders() {
    const env = process.env;

    // Register GNews provider if API key is available
    if (env.GNEWS_API_KEY) {
      const provider = new GNewsProvider(env.GNEWS_API_KEY);
      this._registerProvider(provider);
    }

    // Register NewsAPI provider if API key is available
    if (env.NEWSAPI_KEY) {
      const provider = new NewsAPIProvider(env.NEWSAPI_KEY);
      this._registerProvider(provider);
    }

    // Log initialization status
    console.log(`News Client initialized with ${this.providers.size} providers`);
    if (this.defaultProvider) {
      console.log(`Default provider: ${this.defaultProvider}`);
    } else {
      console.warn('No news providers configured. Set API keys in environment variables.');
    }
  }

  /**
   * Register a provider
   */
  _registerProvider(provider) {
    if (!provider.apiKey) {
      console.warn(`Provider ${provider.name} is not ready, skipping registration`);
      return;
    }

    this.providers.set(provider.name, provider);
    
    // Set first provider as default
    if (!this.defaultProvider) {
      this.defaultProvider = provider.name;
    }

    console.log(`Registered provider: ${provider.name}`);
  }

  /**
   * Get a provider by name
   */
  _getProvider(name = null) {
    const providerName = name || this.defaultProvider;
    
    if (!providerName) {
      throw new NoProvidersAvailableError();
    }
    
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new ProviderNotFoundError(providerName, this.getAvailableProviders());
    }
    
    return provider;
  }

  /**
   * Search for news articles
   */
  async searchNews(query, options = {}) {
    if (!query?.trim()) {
      throw new InvalidQueryError(query || '', 'Search query is required and must be non-empty');
    }

    const { provider, page = 1, limit = 10, ...searchOptions } = options;
    
    // Validate pagination parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    if (isNaN(pageNum) || pageNum < 1) {
      throw new InvalidQueryError(page, 'Page must be a positive integer');
    }
    
    if (isNaN(limitNum) || limitNum < 1) {
      throw new InvalidQueryError(limit, 'Limit must be between 1 or more');
    }

    const newsProvider = this._getProvider(provider);
    
    // Create cache key for this search
    const cacheKey = JSON.stringify({ 
      query: query.trim(), 
      provider: newsProvider.name,
      ...searchOptions 
    });
    
    // Get or initialize cache for this search
    if (!this.articleCache.has(cacheKey)) {
      this.articleCache.set(cacheKey, {
        articles: [],
        totalArticles: 0,
        lastFetchSize: 0,
        hasMore: true
      });
    }
    
    const cache = this.articleCache.get(cacheKey);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    
    // Check if we need to fetch articles from the provider (only once for GNews free plan)
    if (cache.articles.length === 0 && cache.hasMore) {
      // For GNews free plan: fetch all available articles in one go (max 10)
      const fetchSize = newsProvider.name === 'gnews' ? 10 : Math.max(endIndex, limitNum * 2);
      
      const result = await newsProvider.searchNews(query.trim(), {
        ...searchOptions,
        max: fetchSize
      });
      
      // Update cache with all articles from this single fetch
      cache.articles = result.articles || [];
      cache.totalArticles = result.totalResults || 0;
      cache.lastFetchSize = fetchSize;
      
      // For GNews free plan: We never have more than what we got in this single fetch
      if (newsProvider.name === 'gnews') {
        cache.hasMore = false; // GNews free plan gives us everything in one shot
      } else {
        cache.hasMore = result.articles.length >= fetchSize;
      }
    }
    
    // Slice the requested page from cached articles
    const pageArticles = cache.articles.slice(startIndex, endIndex);
    
    // Determine total results and pagination
    let totalResults = cache.totalArticles;
    let hasNextPage = false;
    
    // Special handling for GNews API limitations
    if (newsProvider.name === 'gnews') {
      // GNews free tier limitation: only returns max 10 articles total
      // We can only show next page if we have more cached articles than requested
      hasNextPage = cache.articles.length > endIndex;
      // Show actual cached articles count as the real total for pagination
      totalResults = cache.articles.length;
    } else {
      // Other providers with proper pagination support
      if (totalResults > 0) {
        hasNextPage = endIndex < totalResults;
      } else {
        hasNextPage = cache.articles.length > endIndex || cache.hasMore;
        totalResults = hasNextPage ? Math.max(cache.articles.length * 2, endIndex + limitNum) : cache.articles.length;
      }
    }
    

    
    return this._createPaginatedResponse(
      pageArticles, 
      totalResults, 
      pageNum, 
      limitNum, 
      hasNextPage,
      newsProvider.name
    );
  }

  /**
   * Get top headlines
   */
  async getTopHeadlines(options = {}) {
    const { provider, page = 1, limit = 10, ...headlineOptions } = options;
    
    // Validate pagination parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    if (isNaN(pageNum) || pageNum < 1) {
      throw new InvalidQueryError(page, 'Page must be a positive integer');
    }
    
    if (isNaN(limitNum) || limitNum < 1)  {
      throw new InvalidQueryError(limit, 'Limit must be 1 or more');
    }

    const newsProvider = this._getProvider(provider);
    
    // Calculate offset for provider
    const offset = (pageNum - 1) * limitNum;
    const maxResults = limitNum;
    
    const result = await newsProvider.getTopHeadlines({
      ...headlineOptions,
      max: maxResults,
      offset: offset
    });
    
    // Add pagination metadata
    return this._addPaginationMetadata(result, pageNum, limitNum);
  }

  /**
   * Get available provider names
   */
  getAvailableProviders() {
    return Array.from(this.providers.keys());
  }

  /**
   * Set default provider
   */
  setDefaultProvider(name) {
    if (!this.providers.has(name)) {
      throw new ProviderNotFoundError(name, this.getAvailableProviders());
    }
    this.defaultProvider = name;
  }

  /**
   * Clear article cache (useful for testing or memory management)
   */
  clearCache() {
    this.articleCache.clear();
  }

  /**
   * Create a paginated response for client-side pagination
   */
  _createPaginatedResponse(articles, totalResults, page, limit, hasNextPage, provider) {
    const actualResults = articles.length;
    const totalPages = totalResults > 0 ? Math.ceil(totalResults / limit) : 1;
    const hasPreviousPage = page > 1;

    return {
      status: 'ok',
      provider: provider,
      articles: articles,
      totalResults: totalResults,
      actualResults: actualResults,
      pagination: {
        currentPage: page,
        limit: limit,
        totalResults: totalResults,
        actualResults: actualResults,
        totalPages: totalPages,
        hasNextPage: hasNextPage,
        hasPreviousPage: hasPreviousPage,
        nextPage: hasNextPage ? page + 1 : null,
        previousPage: hasPreviousPage ? page - 1 : null,
        clientSidePagination: true
      }
    };
  }

  /**
   * Add pagination metadata to result (for providers with native pagination)
   */
  _addPaginationMetadata(result, page, limit) {
    const totalResults = result.totalResults || result.articles?.length || 0;
    const actualResults = result.actualResults || result.articles?.length || 0;
    const totalPages = Math.ceil(totalResults / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return {
      ...result,
      pagination: {
        currentPage: page,
        limit: limit,
        totalResults: totalResults,
        actualResults: actualResults,
        totalPages: totalPages,
        hasNextPage: hasNextPage,
        hasPreviousPage: hasPreviousPage,
        nextPage: hasNextPage ? page + 1 : null,
        previousPage: hasPreviousPage ? page - 1 : null,
        clientSidePagination: false
      }
    };
  }
}

module.exports = NewsClient;
