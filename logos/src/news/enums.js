/**
 * News API Enums and Constants
 */

const SortBy = {
  RELEVANCE: 'relevance',
  DATE: 'date',
  PUBLISH_TIME: 'publishedAt'
};

const SearchInOptions = {
  TITLE: 'title',
  DESCRIPTION: 'description',
  CONTENT: 'content'
};

const NewsCategory = {
  GENERAL: 'general',
  BUSINESS: 'business',
  ENTERTAINMENT: 'entertainment',
  HEALTH: 'health',
  SCIENCE: 'science',
  SPORTS: 'sports',
  TECHNOLOGY: 'technology'
};

const ProviderNames = {
  GNEWS: 'gnews',
  NEWSAPI: 'newsapi',
  GUARDIAN: 'guardian'
};

module.exports = {
  SortBy,
  SearchInOptions,
  NewsCategory,
  ProviderNames
};
