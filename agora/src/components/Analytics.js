import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, BarChart3, TrendingUp, TrendingDown, Activity, Calendar, Globe, Zap } from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardContent } from './ui/Card';
import { analysisAPI } from '../services/api';
import toast from 'react-hot-toast';

const Analytics = () => {
  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState(null);
  const [topSources, setTopSources] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [statsResponse, trendsResponse, sourcesResponse] = await Promise.all([
        analysisAPI.getStats(),
        analysisAPI.getTrends({ groupBy: 'day' }),
        analysisAPI.getTopSources()
      ]);



      if (statsResponse?.data) {
        setStats(statsResponse.data);
      }
      
      if (trendsResponse?.data) {
        setTrends(trendsResponse.data);
      }
      
      if (sourcesResponse?.data) {
        setTopSources(sourcesResponse.data);
      }
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setError(err.message || 'Failed to load analytics');
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const getSentimentColor = (sentiment) => {
    switch (sentiment) {
      case 'positive': return 'text-green-600 bg-green-100';
      case 'negative': return 'text-red-600 bg-red-100';
      case 'neutral': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getBiasColor = (bias) => {
    switch (bias) {
      case 'left': return 'text-blue-600 bg-blue-100';
      case 'right': return 'text-red-600 bg-red-100';
      case 'center': return 'text-purple-600 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        <span className="ml-3 text-lg text-gray-600">Loading analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <BarChart3 className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900">Failed to Load Analytics</h3>
          <p className="text-gray-600">{error}</p>
          <Button onClick={fetchAnalytics} className="mt-4">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
            <BarChart3 className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900">No Analytics Data</h3>
          <p className="text-gray-600">
            Analyze some articles first to see analytics data here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h2>
          <p className="text-gray-600">Insights from your analyzed articles</p>
        </div>
        <Button onClick={fetchAnalytics} variant="outline" disabled={loading}>
          <Activity className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        <Card className="border-l-4 border-l-blue-500 pt-4">
          <CardContent className="p-6">
            <div className="flex items-center">
              <BarChart3 className="w-8 h-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Analyzed</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalArticles || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 pt-4">
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Avg Confidence</p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats.avgConfidence ? `${(stats.avgConfidence * 100).toFixed(1)}%` : 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sentiment & Political Bias Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sentiment Distribution */}
        <Card className="pt-4">
          <CardContent className="p-6">
            <div className="flex items-center mb-6">
              <Activity className="w-6 h-6 text-gray-700" />
              <h3 className="text-xl font-semibold text-gray-900 ml-2">Sentiment Distribution</h3>
            </div>
            
            {stats.sentimentBreakdown ? (
              <div className="space-y-4">
                {Object.entries(stats.sentimentBreakdown).map(([sentiment, count]) => {
                  const percentage = stats.totalArticles > 0 ? (count / stats.totalArticles * 100).toFixed(1) : 0;
                  return (
                    <div key={sentiment} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getSentimentColor(sentiment)}`}>
                          {sentiment}
                        </span>
                        <span className="ml-3 text-sm text-gray-600">{count} articles</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-24 bg-gray-200 rounded-full h-2 mr-3">
                          <div 
                            className={`h-2 rounded-full ${sentiment === 'positive' ? 'bg-green-500' : sentiment === 'negative' ? 'bg-red-500' : 'bg-orange-500'}`}
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{percentage}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500">No sentiment data available</p>
            )}
          </CardContent>
        </Card>

        {/* Political Bias Distribution */}
        <Card className="pt-4">
          <CardContent className="p-6">
            <div className="flex items-center mb-6">
              <Zap className="w-6 h-6 text-gray-700" />
              <h3 className="text-xl font-semibold text-gray-900 ml-2">Political Bias Distribution</h3>
            </div>
            
            {stats.politicalBreakdown ? (
              <div className="space-y-4">
                {Object.entries(stats.politicalBreakdown).map(([bias, count]) => {
                  const percentage = stats.totalArticles > 0 ? (count / stats.totalArticles * 100).toFixed(1) : 0;
                  return (
                    <div key={bias} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getBiasColor(bias)}`}>
                          {bias}
                        </span>
                        <span className="ml-3 text-sm text-gray-600">{count} articles</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-24 bg-gray-200 rounded-full h-2 mr-3">
                          <div 
                            className={`h-2 rounded-full ${bias === 'left' ? 'bg-blue-500' : bias === 'right' ? 'bg-red-500' : 'bg-purple-500'}`}
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{percentage}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500">No political bias data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Sources Table */}
      <div className="mt-8">
        <Card className="pt-4">
          <CardContent className="p-6">
            <div className="flex items-center mb-6">
              <Globe className="w-6 h-6 text-gray-700" />
              <h3 className="text-xl font-semibold text-gray-900 ml-2">Top 5 News Sources</h3>
            </div>
            
            {topSources && topSources.length > 0 ? (
              <div className="overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Source
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Articles
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Avg Confidence
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Latest Article
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {topSources.slice(0, 5).map((source, index) => (
                      <tr key={source.sourceName} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{source.sourceName}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{source.articleCount}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {source.avgConfidence ? `${(source.avgConfidence * 100).toFixed(1)}%` : 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {source.latestArticle ? new Date(source.latestArticle).toLocaleDateString() : 'N/A'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">No source data available</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Analytics;
