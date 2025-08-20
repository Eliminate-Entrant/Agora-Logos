
class ArticleData {
  constructor(data) {
    this.title = this._sanitizeString(data.title) || 'No title available';
    this.description = this._sanitizeString(data.description) || '';
    this.content = this._sanitizeString(data.content) || '';
    this.url = this._validateUrl(data.url);
    this.urlToImage = this._validateUrl(data.urlToImage) || null;
    this.publishedAt = this._validateDate(data.publishedAt);
    this.source = this._normalizeSource(data.source);
    this.provider = data.provider || 'unknown';
    
    // Auto-generated fields
    this.id = this._generateId();
    this.createdAt = new Date().toISOString();
  }

  static fromProvider(rawData, provider) {
    return new Article({
      ...rawData,
      provider
    });
  }

  static fromProviderArray(articles, provider) {
    if (!Array.isArray(articles)) {
      return [];
    }
    
    return articles.map(article => Article.fromProvider(article, provider));
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      content: this.content,
      url: this.url,
      urlToImage: this.urlToImage,
      publishedAt: this.publishedAt,
      source: this.source,
      provider: this.provider,
      createdAt: this.createdAt
    };
  }

  getSummary() {
    const text = this.content || this.description;
    if (!text) return '';
    
    return text.length > 150 ? text.substring(0, 150) + '...' : text;
  }

  // Private helper methods

  _sanitizeString(str) {
    if (!str || typeof str !== 'string') {
      return '';
    }
    
    return str
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[\r\n\t]/g, ' ')
      .substring(0, 5000);
  }

  _validateUrl(url) {
    if (!url || typeof url !== 'string') {
      return null;
    }

    try {
      new URL(url);
      return url;
    } catch {
      return null;
    }
  }

  _normalizeSource(source) {
    if (!source || typeof source !== 'object') {
      return {
        name: 'Unknown',
        url: null
      };
    }

    return {
      name: this._sanitizeString(source.name) || 'Unknown',
      url: this._validateUrl(source.url) || null
    };
  }

  _generateId() {
    const hash = (this.url + this.provider + this.title)
      .split('')
      .reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);

    return `${this.provider}_${Math.abs(hash)}`;
  }

  _validateDate(date) {
    if (!date || typeof date !== 'string') {
      return null;
    }

    return new Date(date);
  }
}

module.exports = ArticleData;
