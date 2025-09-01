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
  // Analyze a single article (async by default)
  analyzeArticle: async (articleData, options = {}) => {
    const { sync = false, priority = 0 } = options;
    
    const params = new URLSearchParams();
    if (sync) params.append('sync', 'true');
    if (priority) params.append('priority', priority.toString());
    
    const url = `/analysis/article${params.toString() ? '?' + params.toString() : ''}`;
    const response = await api.post(url, articleData);
    
    return response.data;
  },

  // Analyze article synchronously (for backward compatibility)
  analyzeArticleSync: async (articleData) => {
    return await analysisAPI.analyzeArticle(articleData, { sync: true });
  },

  // Get job status
  getJobStatus: async (jobId) => {
    const response = await api.get(`/analysis/job/${jobId}`);
    return response.data;
  },

  // Get job result (for completed jobs)
  getJobResult: async (jobId) => {
    const response = await api.get(`/analysis/job/${jobId}/result`);
    return response.data;
  },

  // Cancel a job
  cancelJob: async (jobId) => {
    const response = await api.delete(`/analysis/job/${jobId}`);
    return response.data;
  },

  // Get queue statistics
  getQueueStats: async () => {
    const response = await api.get('/analysis/queue/stats');
    return response.data;
  },

  // Poll for job completion
  pollJobCompletion: async (jobId, onProgress = null, maxAttempts = 60) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const statusResponse = await analysisAPI.getJobStatus(jobId);
      const status = statusResponse.data;
      
      if (onProgress) {
        onProgress(status);
      }
      
      if (status.status === 'completed') {
        return status.result || status.analysis;
      }
      
      if (status.status === 'failed') {
        throw new Error(status.error || 'Analysis failed');
      }
      
      if (status.status === 'cancelled') {
        throw new Error('Analysis was cancelled');
      }
      
      // Wait before next poll (exponential backoff)
      const delay = Math.min(1000 + (attempt * 500), 5000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    throw new Error('Analysis timed out - job took too long to complete');
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
