const { SortBy, SearchInOptions, NewsCategory, ProviderNames } = require('../enums');
const ArticleData = require('../ArticleData');
const { ValidationError, ProviderConfigurationError, ExternalAPIError } = require('../errors/NewsErrors');
const GNews = require('@gnews-io/gnews-io-js');

/**
 * GNews Provider Implementation
 */
class GNewsProvider {
  constructor(apiKey) {
    this.name = ProviderNames.GNEWS;
    this.apiKey = apiKey;
    if (!apiKey) {
      throw new ProviderConfigurationError('GNews API KEY not provided');
    }
    
    try {
      this.client = new GNews(apiKey);
    } catch (error) {
      console.warn('Invalid API KEY or GNews library not found. Install it to use GNews provider');
      this.isConfigured = false;
    }

  }

  async searchNews(query, options = {}) {
    if (!this.apiKey) {
      throw new ProviderConfigurationError('GNews provider is not properly configured');
    }

    const {
      max,
      offset,
      country,
      lang,
      from,
      to,
      sortBy,
      searchIn
    } = options;

    // Validate enum options
    this._validateOptions({ sortBy, searchIn });

    try {
      // Build search parameters, only including defined values
      const searchParams = {};
      
      if (max !== undefined) searchParams.max = max;
      if (lang !== undefined) searchParams.lang = lang;
      if (country !== undefined) searchParams.country = country;
      if (from !== undefined) searchParams.from = from;
      if (to !== undefined) searchParams.to = to;
      if (sortBy !== undefined) searchParams.sortby = sortBy;
      if (searchIn !== undefined) searchParams.in = searchIn;
      
      // Note: GNews doesn't support true pagination/offset, so we handle it at client level
      // For now, we'll ignore offset and just return what GNews gives us

      const response = await this.client.search(query, searchParams);
      return this.normalizeResponse(response, max || 10);
    } catch (error) {
      console.error('GNews search failed:', error);
      throw new ExternalAPIError('GNews', error);
    }
  }

  async getTopHeadlines(options = {}) {
    if (!this.apiKey) {
      throw new ProviderConfigurationError('GNews provider is not properly configured');
    }

    const {
      category,
      max,
      offset,
      lang,
      country
    } = options;

    // Validate enum options
    this._validateOptions({ category });

    try {
      // Build headlines parameters, only including defined values
      const headlineParams = {};
      
      if (category !== undefined) headlineParams.category = category;
      if (max !== undefined) headlineParams.max = max;
      if (lang !== undefined) headlineParams.lang = lang;
      if (country !== undefined) headlineParams.country = country;

      const response = await this.client.topHeadlines(headlineParams);
      return this.normalizeResponse(response, max || 10);
    } catch (error) {
      throw new ExternalAPIError('GNews', error);
    }
  }

  normalizeResponse(response, requestedMax = 10) {
    const rawArticles = response.articles || [];
    
    // Map GNews format to Article model
    const articles = rawArticles.map(article => {
      return new ArticleData({
        title: article.title,
        description: article.description,
        content: article.content,
        url: article.url,
        urlToImage: article.image,
        publishedAt: article.publishedAt,
        source: {
          name: article.source?.name || 'Unknown',
          url: article.source?.url || null
        },
        provider: this.name
      });
    });

    // GNews API response format - totalArticles may be available
    const actualResults = articles.length;
    const totalArticles = response.totalArticles || 0;
    
    return {
      status: 'ok',
      totalResults: totalArticles,
      actualResults: actualResults,
      provider: this.name,
      articles: articles.map(article => article.toJSON())
    };
  }

  /**
   * Validate option values against enums
   */
  _validateOptions({ sortBy, searchIn, category }) {
    if (sortBy && !Object.values(SortBy).includes(sortBy)) {
      throw new ValidationError(`Invalid sortBy option. Must be one of: ${Object.values(SortBy).join(', ')}`);
    }

    if (searchIn && !Object.values(SearchInOptions).includes(searchIn)) {
      throw new ValidationError(`Invalid searchIn option. Must be one of: ${Object.values(SearchInOptions).join(', ')}`);
    }

    if (category && !Object.values(NewsCategory).includes(category)) {
      throw new ValidationError(`Invalid category option. Must be one of: ${Object.values(NewsCategory).join(', ')}`);
    }
  }
}

module.exports = GNewsProvider;
