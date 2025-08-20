import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: process.env.REACT_APP_LOGOS_API_URL || 'http://localhost:5001/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    console.log(`Making ${config.method?.toUpperCase()} request to ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Error:', error);
    
    // Handle different error types
    if (error.response) {
      // Server responded with error status
      const message = error.response.data?.error || error.response.data?.message || 'Server error';
      throw new Error(`${error.response.status}: ${message}`);
    } else if (error.request) {
      // Request was made but no response received
      throw new Error('Network error - please check your connection');
    } else {
      // Something else happened
      throw new Error(error.message || 'An unexpected error occurred');
    }
  }
);

// News API functions
export const newsAPI = {
  // Search for news articles
  searchNews: async (params) => {
    const response = await api.get('/news/search', { params });
    return response.data;
  },

  // Get top headlines
  getHeadlines: async (params) => {
    const response = await api.get('/news/headlines', { params });
    return response.data;
  },

  // Get available providers
  getProviders: async () => {
    const response = await api.get('/news/providers');
    return response.data;
  },

  // Get available search options
  getEnums: async () => {
    const response = await api.get('/news/enums');
    return response.data;
  },
};

// Analysis API functions
export const analysisAPI = {
  // Analyze a single article
  analyzeArticle: async (articleData) => {
    const response = await api.post('/analysis/article', articleData);
    console.log("DD response", response.data);
    console.log("DD", response);
    return response.data;
  },

  // Search analyzed articles
  searchAnalyzed: async (params) => {
    const response = await api.get('/analysis/search', { params });
    return response.data;
  },

  // Get analysis statistics
  getStats: async () => {
    const response = await api.get('/analysis/stats');
    return response.data;
  },

  // Get sentiment trends
  getTrends: async (params) => {
    const response = await api.get('/analysis/trends/sentiment', { params });
    return response.data;
  },

  // Get top sources
  getTopSources: async () => {
    const response = await api.get('/analysis/sources/top');
    return response.data;
  },

  // Delete an article
  deleteArticle: async (articleId) => {
    const response = await api.delete(`/analysis/article/${articleId}`);
    return response.data;
  },

  // Re-analyze an article
  reanalyze: async (articleId) => {
    const response = await api.post(`/analysis/reanalyze/${articleId}`);
    return response.data.data;
  },
};

export default api;
