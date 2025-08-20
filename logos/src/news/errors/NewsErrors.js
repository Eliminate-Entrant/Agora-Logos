/**
 * Custom News Error Classes with HTTP Status Codes
 */

/**
 * Base News Error - All news errors extend this
 */
class NewsError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isNewsError = true;
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON() {
    return {
      success: false,
      error: this.message,
      type: this.name,
      statusCode: this.statusCode
    };
  }
}

/**
 * Validation Error - 400 Bad Request
 * Used for invalid parameters, enum values, etc.
 */
class ValidationError extends NewsError {
  constructor(message) {
    super(message, 400);
  }
}

/**
 * Provider Not Found Error - 404 Not Found
 * Used when a specific provider is requested but not available
 */
class ProviderNotFoundError extends NewsError {
  constructor(providerName, availableProviders = []) {
    const message = availableProviders.length > 0 
      ? `Provider '${providerName}' not found. Available providers: ${availableProviders.join(', ')}`
      : `Provider '${providerName}' not found`;
    
    super(message, 404);
    this.providerName = providerName;
    this.availableProviders = availableProviders;
  }
}

/**
 * Provider Configuration Error - 503 Service Unavailable
 * Used when providers are not properly configured or API keys missing
 */
class ProviderConfigurationError extends NewsError {
  constructor(message) {
    super(message, 503);
  }
}

/**
 * No Providers Available Error - 503 Service Unavailable
 * Used when no providers are configured at all
 */
class NoProvidersAvailableError extends NewsError {
  constructor() {
    super('No news providers are configured. Please set API keys in environment variables.', 503);
  }
}

/**
 * API Rate Limit Error - 429 Too Many Requests
 * Used when provider API rate limits are exceeded
 */
class RateLimitError extends NewsError {
  constructor(providerName, resetTime = null) {
    const message = resetTime 
      ? `Rate limit exceeded for ${providerName}. Resets at ${resetTime}`
      : `Rate limit exceeded for ${providerName}`;
    
    super(message, 429);
    this.providerName = providerName;
    this.resetTime = resetTime;
  }
}

/**
 * External API Error - 502 Bad Gateway
 * Used when external news APIs return errors
 */
class ExternalAPIError extends NewsError {
  constructor(providerName, originalError) {
    super(`External API error from ${providerName}: ${originalError.message}`, 502);
    this.providerName = providerName;
    this.originalError = originalError;
  }
}

/**
 * Article Not Found Error - 404 Not Found
 * Used when a specific article is requested but not found
 */
class ArticleNotFoundError extends NewsError {
  constructor(articleId) {
    super(`Article with ID '${articleId}' not found`, 404);
    this.articleId = articleId;
  }
}

/**
 * Invalid Query Error - 400 Bad Request
 * Used for malformed search queries
 */
class InvalidQueryError extends ValidationError {
  constructor(query, reason = 'Invalid search query') {
    super(`${reason}: '${query}'`);
    this.query = query;
  }
}

/**
 * Helper function to create appropriate error from message
 */
function createNewsError(message, defaultStatusCode = 500) {
  // Check for validation-related errors
  if (message.includes('Invalid sortBy') || 
      message.includes('Invalid searchIn') || 
      message.includes('Invalid category')) {
    return new ValidationError(message);
  }

  // Check for provider configuration errors
  if (message.includes('not properly configured') ||
      message.includes('API key') ||
      message.includes('not configured')) {
    return new ProviderConfigurationError(message);
  }

  // Check for provider not found errors
  if (message.includes('not found')) {
    const providerMatch = message.match(/Provider '(.+?)' not found/);
    if (providerMatch) {
      return new ProviderNotFoundError(providerMatch[1]);
    }
  }

  // Check for rate limit errors
  if (message.includes('rate limit') || message.includes('quota exceeded')) {
    return new RateLimitError('unknown provider');
  }

  // Default to generic NewsError
  return new NewsError(message, defaultStatusCode);
}

/**
 * Express error handler middleware
 */
function newsErrorHandler(error, req, res, next) {
  // If it's already a NewsError, use it directly
  if (error.isNewsError) {
    return res.status(error.statusCode).json(error.toJSON());
  }

  // Convert regular errors to NewsError
  const newsError = createNewsError(error.message);
  res.status(newsError.statusCode).json(newsError.toJSON());
}

module.exports = {
  NewsError,
  ValidationError,
  ProviderNotFoundError,
  ProviderConfigurationError,
  NoProvidersAvailableError,
  RateLimitError,
  ExternalAPIError,
  ArticleNotFoundError,
  InvalidQueryError,
  createNewsError,
  newsErrorHandler
};
