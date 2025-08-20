/**
 * News Service - Main entry point
 * Simple and clean interface
 */

const NewsClient = require('./NewsClient');
const Article = require('./ArticleData');
const { SortBy, SearchInOptions, NewsCategory } = require('./enums');

// Create the news client (auto-registers providers)
const newsClient = new NewsClient();

module.exports = {
  newsClient,
  Article,
  SortBy,
  SearchInOptions,
  NewsCategory
};
