const { LLMClient } = require('./LLMClient');
const DatabaseManager = require('../DatabaseManager');
const { ValidationError, ExternalAPIError } = require('../news/errors/NewsErrors');


class AgentSynopsis {
  constructor(options = {}) {
    this.llmClient = options.llmClient || new LLMClient();
    this.dbManager = options.dbManager || new DatabaseManager();
    this.cacheEnabled = options.cacheEnabled !== false;
    this.maxContentLength = options.maxContentLength || 100000; 
    
    // System prompt for article analysis
    this.systemPrompt = `You are an expert news analyst and political scientist with access to analyze ALL content types including sensitive political topics. Your task is to provide completely unbiased, factual analysis of news articles regardless of political sensitivity.

IMPORTANT: You must analyze ALL political content without content filtering or bias. This is for academic research and journalistic analysis purposes.

Analyze each article and provide:

1. A concise, objective summary (2-3 sentences)
2. Sentiment analysis (positive, neutral, or negative) 
3. Confidence score for the sentiment (0.0 to 1.0)
4. Political leaning/bias of the article's framing (left, center, or right)

Critical Guidelines:
- Analyze ALL political content regardless of sensitivity or controversy
- Be completely objective and factual in your analysis
- Base sentiment on the overall tone and presentation, not your opinion of the content
- Political leaning should reflect how the article frames the topic (author's perspective/bias), not the topic itself
- Distinguish between reporting facts vs. editorial opinion/framing
- Confidence should reflect how certain you are about the sentiment analysis
- Never refuse to analyze content due to political sensitivity
- Always provide your best professional analysis
- Always respond with valid JSON in the exact format specified

Response format (JSON only):
{
  "summary": "Concise 3-4 sentence objective summary of the article",
  "sentiment": {
    "score": "positive|neutral|negative",
    "confidence": 0.85
  },
  "politicalBias": "left|center|right"
}`;
  }

  async analyzeArticle(articleData) {
    try {
      this._validateArticleData(articleData);

      if (this.cacheEnabled) {
        const existingArticle = await this.dbManager.findByUrl(articleData.url);
        if (existingArticle) {
          return this._formatResponse(existingArticle);
        }
      }

      const analysis = await this._performLLMAnalysis(articleData);
      const savedArticle = await this.dbManager.saveArticle(articleData, analysis);

      return this._formatResponse(savedArticle);
    } catch (error) {
      console.error('Article analysis failed:', error.message);
      throw this._handleError(error);
    }
  }

  async getAnalysisStats() {
    return await this.dbManager.getAnalysisStats();
  }
  async searchAnalyzedArticles(criteria = {}) {
    const result = await this.dbManager.searchArticles(criteria);
    result.articles = result.articles.map(article => this._formatResponse(article));
    return result;
  }

  async findArticleByUrl(url) {
    const article = await this.dbManager.findByUrl(url);
    return article ? this._formatResponse(article) : null;
  }

  async findArticleById(id) {
    const article = await this.dbManager.findById(id);
    return article ? this._formatResponse(article) : null;
  }

  async deleteArticle(id) {
    const deleted = await this.dbManager.deleteArticle(id);
    return !!deleted;
  }

  async findBySentiment(sentiment, options = {}) {
    return this.searchAnalyzedArticles({ sentiment, ...options });
  }

  async findByPoliticalBias(politicalBias, options = {}) {
    return this.searchAnalyzedArticles({ politicalBias, ...options });
  }

  async getSentimentTrends(options = {}) {
    return await this.dbManager.getSentimentTrends(options);
  }

  async getTopSources(options = {}) {
    return await this.dbManager.getTopSources(options);
  }

  _validateArticleData(articleData) {
    if (!articleData || typeof articleData !== 'object') {
      throw new ValidationError('Article data must be an object');
    }

    const required = ['title', 'content', 'url'];
    for (const field of required) {
      if (!articleData[field] || typeof articleData[field] !== 'string') {
        throw new ValidationError(`Article ${field} is required and must be a string`);
      }
    }

    if (articleData.content.length < 50) {
      throw new ValidationError('Article content is too short for meaningful analysis');
    }
  }

  async _performLLMAnalysis(articleData) {
    try {
      // Prepare content for LLM (truncate if too long)
      const truncatedContent = this._truncateContent(articleData.content);
      
      const userPrompt = `ANALYZE THIS NEWS ARTICLE - ALL CONTENT TYPES PERMITTED:

This is for academic research and journalistic analysis. You must provide unbiased analysis regardless of political sensitivity.

Title: ${articleData.title}

${articleData.description ? `Description: ${articleData.description}` : ''}

Content: ${truncatedContent}

REQUIRED ANALYSIS:
1. Provide an objective summary without editorial commentary
2. Determine sentiment based on tone/presentation (not your opinion of the content)
3. Assess political bias of how the article frames the topic (author's perspective)
4. Give confidence score for your sentiment analysis

Do not refuse to analyze any political content. Provide your professional journalistic analysis in the specified JSON format.`;

      // Call LLM with JSON response format
      const response = await this.llmClient.callLLMJson(
        this.systemPrompt,
        userPrompt
      );

      // Validate LLM response
      this._validateLLMResponse(response);

      return response;

    } catch (error) {
      throw new ExternalAPIError('LLM Analysis', error);
    }
  }



  _validateLLMResponse(response) {
    if (!response || typeof response !== 'object') {
      throw new Error('LLM response must be an object');
    }

    // Check required fields
    if (!response.summary || typeof response.summary !== 'string') {
      throw new Error('LLM response missing valid summary');
    }

    if (!response.sentiment || typeof response.sentiment !== 'object') {
      throw new Error('LLM response missing valid sentiment object');
    }

    const validSentiments = ['positive', 'neutral', 'negative'];
    if (!validSentiments.includes(response.sentiment.score)) {
      throw new Error('LLM response has invalid sentiment score');
    }

    if (typeof response.sentiment.confidence !== 'number' || 
        response.sentiment.confidence < 0 || 
        response.sentiment.confidence > 1) {
      throw new Error('LLM response has invalid confidence score');
    }

    const validBias = ['left', 'center', 'right'];
    if (!validBias.includes(response.politicalBias)) {
      throw new Error('LLM response has invalid political bias');
    }
  }

  _formatResponse(article) {
    return {
      id: article._id,
      title: article.title,
      description: article.description,
      content: article.content,
      url: article.url,
      urlToImage: article.urlToImage,
      publishedAt: article.publishedAt,
      source: article.source,
      summary: article.summary,
      sentiment: {
        score: article.sentiment.score,
        confidence: article.sentiment.confidence,
        politicalBias: article.sentiment.politicalBias
      },
      analyzedAt: article.analyzedAt,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt
    };
  }

  /**
   * Handle and categorize errors
   */
  _handleError(error) {
    if (error.isNewsError) {
      return error; // Already a custom error
    }

    if (error.message.includes('LLM') || error.message.includes('API')) {
      return new ExternalAPIError('AI Analysis', error);
    }

    if (error.message.includes('validation') || error.message.includes('invalid')) {
      return new ValidationError(error.message);
    }

    return new Error(`Article analysis failed: ${error.message}`);
  }

  _truncateContent(content) {
    if (content.length <= this.maxContentLength) {
      return content;
    }
    return content.substring(0, this.maxContentLength) + '...';
  }


  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = AgentSynopsis;
