const { SortBy, NewsCategory, ProviderNames } = require('../enums');
const ArticleData = require('../ArticleData');

/**
 * NewsAPI.org Provider Example Implementation to show how easy it is to add a new provider
 */
class NewsAPIProvider {
  constructor(apiKey) {
    this.name = ProviderNames.NEWSAPI;
    this.apiKey = apiKey;
    this.isConfigured = !!apiKey;
    this.baseUrl = 'https://newsapi.org/v2';
  }

  isReady() {
    return this.isConfigured;
  }

  async searchNews(query, options = {}) {
    if (!this.isReady()) {
      throw new Error('NewsAPI provider is not properly configured');
    }

    const {
      max = 20,
      country,
      lang = 'en',
      from,
      to,
      sortBy = SortBy.RELEVANCE
    } = options;

    // Validate enum options
    this._validateOptions({ sortBy });

    try {
      const params = new URLSearchParams({
        q: query,
        pageSize: max,
        language: lang,
        sortBy: this._mapSortBy(sortBy),
        apiKey: this.apiKey
      });

      if (from) params.append('from', from);
      if (to) params.append('to', to);

      const response = await fetch(`${this.baseUrl}/everything?${params}`);
      
      if (!response.ok) {
        throw new Error(`NewsAPI request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return this.normalizeResponse(data);
    } catch (error) {
      throw new Error(`NewsAPI search failed: ${error.message}`);
    }
  }

  async getTopHeadlines(options = {}) {
    if (!this.isReady()) {
      throw new Error('NewsAPI provider is not properly configured');
    }

    const {
      category,
      max = 20,
      country = 'us'
    } = options;

    // Validate enum options
    this._validateOptions({ category });

    try {
      const params = new URLSearchParams({
        pageSize: max,
        country: country,
        apiKey: this.apiKey
      });

      if (category) params.append('category', category);

      const response = await fetch(`${this.baseUrl}/top-headlines?${params}`);
      
      if (!response.ok) {
        throw new Error(`NewsAPI request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return this.normalizeResponse(data);
    } catch (error) {
      throw new Error(`NewsAPI top headlines failed: ${error.message}`);
    }
  }

  normalizeResponse(response) {
    const rawArticles = response.articles || [];
    
    // Map NewsAPI format to Article model
    const articles = rawArticles.map(article => {
      return new ArticleData({
        title: article.title,
        description: article.description,
        content: article.content,
        url: article.url,
        urlToImage: article.urlToImage,
        publishedAt: article.publishedAt,
        source: article.source,
        provider: this.name
      });
    }).filter(article => article.isValid());

    return {
      status: 'ok',
      totalResults: articles.length,
      provider: this.name,
      articles: articles.map(article => article.toJSON())
    };
  }

  /**
   * Map our standard sort options to NewsAPI format
   */
  _mapSortBy(sortBy) {
    const mapping = {
      [SortBy.RELEVANCE]: 'relevancy',
      [SortBy.DATE]: 'publishedAt',
      [SortBy.PUBLISH_TIME]: 'publishedAt'
    };
    return mapping[sortBy] || 'relevancy';
  }

  /**
   * Validate option values against enums
   */
  _validateOptions({ sortBy, category }) {
    if (sortBy && !Object.values(SortBy).includes(sortBy)) {
      throw new Error(`Invalid sortBy option. Must be one of: ${Object.values(SortBy).join(', ')}`);
    }

    if (category && !Object.values(NewsCategory).includes(category)) {
      throw new Error(`Invalid category option. Must be one of: ${Object.values(NewsCategory).join(', ')}`);
    }
  }
}

module.exports = NewsAPIProvider;
