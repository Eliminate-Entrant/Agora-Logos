import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Database, Trash2, RotateCcw, Calendar, TrendingUp } from 'lucide-react';
import ArticleCard from './ArticleCard';
import { Button } from './ui/Button';
import { analysisAPI } from '../services/api';
import toast from 'react-hot-toast';

const RecentArticles = ({ onArticleClick, selectedArticle }) => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  const fetchRecentArticles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch recent articles (no filters = all articles, sorted by analyzedAt desc)
      const response = await analysisAPI.searchAnalyzed({
        limit: 50,
        sortBy: 'analyzedAt',
        sortOrder: -1
      });

      if (response.data && Array.isArray(response.data.articles)) {
        setArticles(response.data.articles);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Failed to fetch recent articles:', err);
      setError(err.message || 'Failed to load recent articles');
      toast.error('Failed to load recent articles');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const response = await analysisAPI.getStats();
      if (response?.data) {
        setStats(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchRecentArticles();
    fetchStats();
  }, [fetchRecentArticles, fetchStats]);

  const handleDeleteArticle = async (articleId) => {
    if (!window.confirm('Are you sure you want to delete this article? This action cannot be undone.')) {
      return;
    }

    try {
      await analysisAPI.deleteArticle(articleId);
      setArticles(articles.filter(article => (article._id || article.id) !== articleId));
      toast.success('Article deleted successfully');
      
      // Refresh stats after deletion
      fetchStats();
    } catch (err) {
      console.error('Failed to delete article:', err);
      toast.error('Failed to delete article');
    }
  };

  const handleReanalyze = async (articleId) => {
    try {
      await analysisAPI.reanalyze(articleId);
      toast.success('Article re-analyzed successfully');
      
      // Refresh the list to show updated analysis
      fetchRecentArticles();
    } catch (err) {
      console.error('Failed to re-analyze article:', err);
      toast.error('Failed to re-analyze article');
    }
  };

  if (loading && articles.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        <span className="ml-3 text-lg text-gray-600">Loading analyzed articles...</span>
      </div>
    );
  }

  if (error && articles.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <Database className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900">Failed to Load</h3>
          <p className="text-gray-600">{error}</p>
          <Button onClick={fetchRecentArticles} className="mt-4">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Recent Articles</h2>
            <p className="text-gray-600">AI-analyzed articles from your database</p>
          </div>
          <Button
            onClick={fetchRecentArticles}
            variant="outline"
            disabled={loading}
          >
            <RotateCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Quick Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center">
                <Database className="w-8 h-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Total Articles</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalArticles || 0}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center">
                <TrendingUp className="w-8 h-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Positive</p>
                  <p className="text-2xl font-bold text-green-600">{stats.sentimentBreakdown?.positive || 0}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center">
                <Calendar className="w-8 h-8 text-orange-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Neutral</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.sentimentBreakdown?.neutral || 0}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-center">
                <TrendingUp className="w-8 h-8 text-red-600 rotate-180" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Negative</p>
                  <p className="text-2xl font-bold text-red-600">{stats.sentimentBreakdown?.negative || 0}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* No Articles State */}
      {!loading && articles.length === 0 && (
        <div className="text-center py-12">
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
              <Database className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">No Articles Yet</h3>
            <p className="text-gray-600">
              Articles you analyze will appear here. Go to Discover to search and analyze news articles.
            </p>
          </div>
        </div>
      )}

      {/* Articles Grid */}
      {articles.length > 0 && (
        <div className={`grid gap-6 transition-all duration-300 ${
          selectedArticle 
            ? 'md:grid-cols-1 lg:grid-cols-2' 
            : 'md:grid-cols-2 lg:grid-cols-3'
        }`}>
          {articles.map((article) => (
            <div key={article._id} className="relative group">
              <ArticleCard
                article={article}
                onClick={onArticleClick}
                isSelected={selectedArticle?._id === article._id || selectedArticle?.id === article.id}
                showAnalysis={true}
              />
              
              {/* Action Buttons */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="flex space-x-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReanalyze(article._id || article.id);
                    }}
                    className="bg-white/90 hover:bg-white text-gray-700 border-gray-300"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteArticle(article._id || article.id);
                    }}
                    className="bg-white/90 hover:bg-red-50 text-red-600 border-gray-300 hover:border-red-300"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecentArticles;
