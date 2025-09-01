import React, { useState, useEffect, useCallback } from 'react';
import { X, Calendar, User, ExternalLink, Brain, Loader2, AlertCircle } from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { analysisAPI } from '../services/api';
import toast from 'react-hot-toast';

const ArticleDetail = ({ article, onClose }) => {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null);
  const [jobId, setJobId] = useState(null);

  const loadAnalysis = useCallback(async () => {
    if (!article?.url) return;

    try {
      setLoading(true);
      setError(null);
      setProgress(null);

      // If the article already has analysis data (from RecentArticles), use it
      if (article.summary && article.sentiment) {
        setAnalysis({
          data: {
            summary: article.summary,
            sentiment: article.sentiment,
            title: article.title,
            description: article.description,
            content: article.content,
            url: article.url,
            urlToImage: article.urlToImage,
            publishedAt: article.publishedAt,
            source: article.source,
            analyzedAt: article.analyzedAt
          }
        });
        return;
      }

      const articleData = {
        title: article.title,
        content: article.content || article.description || '',
        url: article.url,
        description: article.description,
        urlToImage: article.urlToImage,
        publishedAt: article.publishedAt,
        source: article.source
      };

      // Start async analysis
      const jobResponse = await analysisAPI.analyzeArticle(articleData);
      
      // Check if this was a synchronous response (cached result)
      if (jobResponse.sync || jobResponse.data?.summary) {
        setAnalysis(jobResponse);
        toast.success('AI analysis completed!');
        return;
      }

      // Handle async job
      if (jobResponse.async && jobResponse.data?.jobId) {
        const currentJobId = jobResponse.data.jobId;
        setJobId(currentJobId);
        
        toast.success(`Analysis queued! Estimated wait: ${Math.round(jobResponse.data.estimatedWaitTime / 1000)}s`);
        
        // Poll for completion with progress updates
        const result = await analysisAPI.pollJobCompletion(
          currentJobId,
          (status) => {
            setProgress({
              status: status.status,
              queuePosition: status.queuePosition,
              estimatedWaitTime: status.estimatedWaitTime
            });
            
            // Update progress messages
            if (status.status === 'processing') {
              toast.loading('AI is analyzing the article...', { id: 'analysis-progress' });
            } else if (status.queuePosition > 0) {
              toast.loading(`Position in queue: ${status.queuePosition}`, { id: 'analysis-progress' });
            }
          }
        );
        
        toast.dismiss('analysis-progress');
        setAnalysis({ data: result });
        toast.success('AI analysis completed!');
      }

    } catch (err) {
      console.error('Analysis error:', err);
      setError(err.message);
      toast.dismiss('analysis-progress');
      toast.error('Failed to analyze article');
    } finally {
      setLoading(false);
      setProgress(null);
      setJobId(null);
    }
  }, [article?.url, article?.summary, article?.sentiment]);

  // Cancel job if component unmounts during processing
  useEffect(() => {
    return () => {
      if (jobId) {
        analysisAPI.cancelJob(jobId).catch(console.warn);
      }
    };
  }, [jobId]);

  useEffect(() => {
    if (article?.url) {
      // Reset state when article changes
      setAnalysis(null);
      setError(null);
      loadAnalysis();
    }
  }, [article?.url, loadAnalysis]);

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Unknown date';
    }
  };

  const getSentimentColor = (sentiment) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive': return 'positive';
      case 'negative': return 'negative';
      case 'neutral': return 'neutral';
      default: return 'outline';
    }
  };

  const getPoliticalBiasColor = (bias) => {
    switch (bias?.toLowerCase()) {
      case 'left': return 'destructive';
      case 'right': return 'secondary';
      case 'center': return 'default';
      default: return 'outline';
    }
  };

  const handleExternalClick = () => {
    window.open(article.url, '_blank', 'noopener,noreferrer');
  };

  if (!article) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-1/2 lg:w-2/5 bg-white shadow-2xl z-50 flex flex-col animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-900">Article Details</h2>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleExternalClick}
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Article Header */}
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">
            {article.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            {article.publishedAt && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(article.publishedAt)}</span>
              </div>
            )}
            
            {article.source?.name && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <span>{article.source.name}</span>
              </div>
            )}
          </div>

          {/* Article Image */}
          {article.urlToImage && (
            <div className="overflow-hidden rounded-lg">
              <img
                src={article.urlToImage}
                alt={article.title}
                className="w-full h-64 object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
          )}
        </div>

        {/* AI Analysis Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary-600" />
              AI Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                
                {progress?.status === 'queued' && progress?.queuePosition > 0 && (
                  <div className="text-center">
                    <span className="text-gray-600">Position in queue: {progress.queuePosition}</span>
                    {progress.estimatedWaitTime && (
                      <div className="text-sm text-gray-500 mt-1">
                        Estimated wait: {Math.round(progress.estimatedWaitTime / 1000)}s
                      </div>
                    )}
                  </div>
                )}
                
                {progress?.status === 'processing' && (
                  <div className="text-center">
                    <span className="text-gray-600">AI is analyzing the article...</span>
                    <div className="text-sm text-gray-500 mt-1">This may take 10-30 seconds</div>
                  </div>
                )}
                
                {!progress && (
                  <span className="text-gray-600">Starting analysis...</span>
                )}
                
                {jobId && (
                  <button
                    onClick={() => {
                      if (jobId) {
                        analysisAPI.cancelJob(jobId);
                        setLoading(false);
                        setJobId(null);
                        setProgress(null);
                        toast.success('Analysis cancelled');
                      }
                    }}
                    className="text-sm text-red-600 hover:text-red-700 underline"
                  >
                    Cancel Analysis
                  </button>
                )}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-4 bg-red-50 rounded-lg text-red-700">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadAnalysis}
                  className="ml-auto text-red-700 hover:text-red-800"
                >
                  Retry
                </Button>
              </div>
            )}

            {analysis && !loading && (() => {
              // Normalize analysis data structure
              const analysisData = analysis.data || analysis;
              const sentimentData = analysisData.sentiment || {};
              
              console.log('Analysis object:', analysis);
              console.log('Normalized analysis data:', analysisData);
              console.log('Sentiment data:', sentimentData);
              
              return (
                <div className="space-y-4">
                  {/* Summary */}
                  {analysisData.summary && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Summary</h4>
                      <p className="text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-lg">
                        {analysisData.summary}
                      </p>
                    </div>
                  )}

                  {/* Sentiment Analysis */}
                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">Sentiment</span>
                      <Badge variant={getSentimentColor(sentimentData.score)}>
                        {sentimentData.score || 'Unknown'}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">Confidence</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary-500 transition-all duration-300"
                            style={{ width: `${(sentimentData.confidence || 0) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600">
                          {Math.round((sentimentData.confidence || 0) * 100)}%
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">Political Bias</span>
                      <Badge variant={getPoliticalBiasColor(sentimentData.politicalBias)}>
                        {sentimentData.politicalBias || 'Unknown'}
                      </Badge>
                    </div>
                  </div>

                  {/* Analysis Date */}
                  {analysisData.analyzedAt && (
                    <div className="text-xs text-gray-500 pt-2 border-t">
                      Analyzed on {formatDate(analysisData.analyzedAt)}
                    </div>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Article Content */}
        <Card>
          <CardHeader>
            <CardTitle>Article Content</CardTitle>
          </CardHeader>
          <CardContent>
            {article.description && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Description</h4>
                  <p className="text-gray-700 leading-relaxed">
                    {article.description}
                  </p>
                </div>
              </div>
            )}

            {article.content && article.content !== article.description && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Full Content</h4>
                  <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {article.content}
                  </div>
                </div>
              </div>
            )}

            {/* Source Link */}
            <div className="pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleExternalClick}
                className="w-full"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Read Full Article on {article.source?.name || 'Source'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ArticleDetail;

