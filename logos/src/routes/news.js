const express = require('express');
const { newsClient, SortBy, NewsCategory, SearchInOptions } = require('../news');
const { newsErrorHandler } = require('../news/errors/NewsErrors');

const router = express.Router();


  router.get('/search', async (req, res) => {
    try {
      const { q, page, limit, country, lang, sortBy, searchIn, provider, from, to } = req.query;
    
    if (!q || !q.trim()) {
      return res.status(400).json({ 
        success: false,
        error: 'Search query (q) is required' 
      });
    }
    const options = {};
    
    if (page) options.page = page;
    if (limit) options.limit = limit;
    if (country) options.country = country;
    if (lang) options.lang = lang;
    if (from) options.from = from;
    if (to) options.to = to;
    if (provider) options.provider = provider;
    if (sortBy) options.sortBy = sortBy;
    if (searchIn) options.searchIn = searchIn;

    const result = await newsClient.searchNews(q.trim(), options);
    
    res.json({
      success: true,
      query: q.trim(),
      options: options,
      ...result
    });

  } catch (error) {
    newsErrorHandler(error, req, res);
  }
});

router.get('/headlines', async (req, res) => {
  try {
    const { category, page, limit, country, lang, provider } = req.query;

    const options = {};
    if (page) options.page = page;
    if (limit) options.limit = limit;
    if (country) options.country = country;
    if (lang) options.lang = lang;
    if (provider) options.provider = provider;
    if (category) options.category = category;

    const result = await newsClient.getTopHeadlines(options);
    
    res.json({
      success: true,
      options: options,
      ...result
    });

  } catch (error) {
    newsErrorHandler(error, req, res);
  }
});


router.get('/providers', (req, res) => {
  try {
    const providers = newsClient.getAvailableProviders();
    
    res.json({
      success: true,
      defaultProvider: newsClient.defaultProvider,
      availableProviders: providers
    });
  } catch (error) {
    newsErrorHandler(error, req, res);
  }
});

/*
    GET /enums
    Get available enum values for frontend validation
 */
router.get('/enums', (req, res) => {
  res.json({
    success: true,
    enums: {
      sortBy: Object.values(SortBy),
      searchIn: Object.values(SearchInOptions),
      categories: Object.values(NewsCategory)
    }
  });
});

module.exports = router;
