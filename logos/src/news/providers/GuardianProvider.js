const { SortBy, NewsCategory, ProviderNames } = require('../enums');
const ArticleData = require('../ArticleData');

/**
 * Guardian API Provider Implementation
 */
class GuardianProvider {
  constructor(apiKey) {
    this.name = ProviderNames.GUARDIAN;
    this.apiKey = apiKey;
    this.isConfigured = !!apiKey;
    this.baseUrl = 'https://content.guardianapis.com';
  }

  isReady() {
    return this.isConfigured;
  }

  async searchNews(query, options = {}) {
    if (!this.isReady()) {
      throw new Error('Guardian provider is not properly configured');
    }

    const {
      max = 20,
      from,
      to,
      sortBy = SortBy.RELEVANCE
    } = options;

    // Validate enum options
    this._validateOptions({ sortBy });

    try {
      const params = new URLSearchParams({
        q: query,
        'page-size': max,
        'show-fields': 'headline,trailText,body,thumbnail',
        'api-key': this.apiKey,
        'order-by': this._mapSortBy(sortBy)
      });

      if (from) params.append('from-date', from);
      if (to) params.append('to-date', to);

      const response = await fetch(`${this.baseUrl}/search?${params}`);
      
      if (!response.ok) {
        throw new Error(`Guardian request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return this.normalizeResponse(data);
    } catch (error) {
      throw new Error(`Guardian search failed: ${error.message}`);
    }
  }

  async getTopHeadlines(options = {}) {
    if (!this.isReady()) {
      throw new Error('Guardian provider is not properly configured');
    }

    const {
      category,
      max = 20
    } = options;

    // Validate enum options
    this._validateOptions({ category });

    try {
      const params = new URLSearchParams({
        'page-size': max,
        'show-fields': 'headline,trailText,body,thumbnail',
        'api-key': this.apiKey,
        'order-by': 'newest'
      });

      if (category && category !== NewsCategory.GENERAL) {
        params.append('section', this._mapCategory(category));
      }

      const response = await fetch(`${this.baseUrl}/search?${params}`);
      
      if (!response.ok) {
        throw new Error(`Guardian request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return this.normalizeResponse(data);
    } catch (error) {
      throw new Error(`Guardian top headlines failed: ${error.message}`);
    }
  }

  normalizeResponse(response) {
    const rawArticles = response.response?.results || [];
    
    // Map Guardian format to Article model
    const articles = rawArticles.map(article => {
      return new ArticleData({
        title: article.fields?.headline || article.webTitle,
        description: article.fields?.trailText || '',
        content: article.fields?.body || '',
        url: article.webUrl,
        urlToImage: article.fields?.thumbnail,
        publishedAt: article.webPublicationDate,
        source: {
          name: 'The Guardian',
          url: 'https://www.theguardian.com'
        },
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
   * Map our standard sort options to Guardian format
   */
  _mapSortBy(sortBy) {
    const mapping = {
      [SortBy.RELEVANCE]: 'relevance',
      [SortBy.DATE]: 'newest',
      [SortBy.PUBLISH_TIME]: 'newest'
    };
    return mapping[sortBy] || 'relevance';
  }

  /**
   * Map our standard categories to Guardian sections
   */
  _mapCategory(category) {
    const mapping = {
      [NewsCategory.BUSINESS]: 'business',
      [NewsCategory.ENTERTAINMENT]: 'culture',
      [NewsCategory.HEALTH]: 'society',
      [NewsCategory.SCIENCE]: 'science',
      [NewsCategory.SPORTS]: 'sport',
      [NewsCategory.TECHNOLOGY]: 'technology'
    };
    return mapping[category] || category;
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

module.exports = GuardianProvider;
