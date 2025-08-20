import React, { useState, useCallback, useRef } from 'react';
import { Toaster } from 'react-hot-toast';
import { Loader2, Search, Sparkles } from 'lucide-react';
import Header from './components/Header';
import SearchBar from './components/SearchBar';
import ArticleCard from './components/ArticleCard';
import ArticleDetail from './components/ArticleDetail';
import RecentArticles from './components/RecentArticles';
import Analytics from './components/Analytics';
import { useNews } from './hooks/useNews';
import { useInfiniteScroll } from './hooks/useInfiniteScroll';
import { Button } from './components/ui/Button';
import toast from 'react-hot-toast';

function App() {
  const [activeTab, setActiveTab] = useState('discover');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [lastSearchParams, setLastSearchParams] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  const { articles, loading, error, pagination, searchNews, reset } = useNews();
  
  const lastSearchParamsRef = useRef(null);
  const paginationRef = useRef({ hasNext: false });
  
  lastSearchParamsRef.current = lastSearchParams;
  paginationRef.current = pagination;
  const fetchMore = useCallback(async () => {
    if (!lastSearchParamsRef.current || !paginationRef.current.hasNext) {
      return { hasMore: false };
    }

    try {
      const result = await searchNews(lastSearchParamsRef.current, false);
      return { hasMore: result.hasMore };
    } catch (err) {
      console.error('fetchMore error:', err);
      toast.error('Failed to load more articles');
      return { hasMore: false };
    }
  }, [searchNews]);

  const { lastElementRef, isFetching, reset: resetInfiniteScroll } = useInfiniteScroll(fetchMore);

  const handleSearch = useCallback(async (searchParams) => {
    try {
      reset();
      resetInfiniteScroll();
      setSelectedArticle(null);
      setLastSearchParams(searchParams);
      setHasSearched(true);
      
      await searchNews(searchParams, true);
      toast.success('Search completed!');
    } catch (err) {
      toast.error(err.message || 'Search failed');
    }
  }, [searchNews, reset, resetInfiniteScroll]);

  const handleArticleClick = useCallback((article) => {
    setSelectedArticle(article);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedArticle(null);
  }, []);

  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
    setSelectedArticle(null); // Close any open article detail
    if (tabId !== 'discover') {
      setHasSearched(false); // Reset search state when leaving discover tab
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-green-50">
      <Header activeTab={activeTab} onTabChange={handleTabChange} />
      
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Discover Tab - Hero Section with Search */}
        {activeTab === 'discover' && (
          <div className="text-center space-y-8 mb-12">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-gray-900 via-primary-700 to-grass-700 bg-clip-text text-transparent">
                Discover News
              </h1>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Search, analyze, and understand news with AI-powered insights
              </p>
            </div>
            
            <SearchBar onSearch={handleSearch} loading={loading} />
          </div>
        )}

        {/* Discover Tab - Search Results */}
        {activeTab === 'discover' && hasSearched && (
          <div className="space-y-6">
            {/* Results Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Search Results</h2>
                {pagination.total > 0 && (
                  <p className="text-gray-600">
                    Found {pagination.total.toLocaleString()} articles
                  </p>
                )}
              </div>
              
              {articles.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    reset();
                    setHasSearched(false);
                    setSelectedArticle(null);
                  }}
                >
                  New Search
                </Button>
              )}
            </div>

            {/* Loading State */}
            {loading && articles.length === 0 && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
                <span className="ml-3 text-lg text-gray-600">Searching for articles...</span>
              </div>
            )}

            {/* Error State */}
            {error && articles.length === 0 && (
              <div className="text-center py-12">
                <div className="max-w-md mx-auto space-y-4">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                    <Search className="w-8 h-8 text-red-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">Search Failed</h3>
                  <p className="text-gray-600">{error}</p>
                  <Button
                    onClick={() => lastSearchParams && handleSearch(lastSearchParams)}
                    className="mt-4"
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            )}

            {/* No Results */}
            {!loading && !error && articles.length === 0 && hasSearched && (
              <div className="text-center py-12">
                <div className="max-w-md mx-auto space-y-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                    <Search className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">No Articles Found</h3>
                  <p className="text-gray-600">
                    Try adjusting your search terms or filters
                  </p>
                </div>
              </div>
            )}

            {/* Articles Grid */}
            {articles.length > 0 && (
              <div 
                className={`grid gap-6 transition-all duration-300 ${
                  selectedArticle 
                    ? 'md:grid-cols-1 lg:grid-cols-2' 
                    : 'md:grid-cols-2 lg:grid-cols-3'
                }`}
              >
                {articles.map((article, index) => (
                  <div
                    key={`${article.url}-${index}`}
                    ref={index === articles.length - 1 ? lastElementRef : null}
                  >
                    <ArticleCard
                      article={article}
                      onClick={handleArticleClick}
                      isSelected={selectedArticle?.url === article.url}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Loading More */}
            {isFetching && articles.length > 0 && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                <span className="ml-2 text-gray-600">Loading more articles...</span>
              </div>
            )}

            {/* End of Results */}
            {!pagination.hasNext && articles.length > 0 && !isFetching && (
              <div className="text-center py-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full text-gray-600">
                  <Sparkles className="w-4 h-4" />
                  <span>You've reached the end of results</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Discover Tab - Welcome State */}
        {activeTab === 'discover' && !hasSearched && (
          <div className="text-center py-16 space-y-8">
            <div className="w-24 h-24 bg-gradient-to-br from-primary-100 to-grass-100 rounded-full flex items-center justify-center mx-auto">
              <Search className="w-12 h-12 text-primary-600" />
            </div>
            <div className="space-y-4 max-w-2xl mx-auto">
              <h3 className="text-2xl font-semibold text-gray-900">
                Ready to explore the world of news?
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Use the search bar above to find articles on any topic. Our AI will analyze each article 
                for sentiment, political bias, and provide intelligent summaries to help you understand 
                the news better.
              </p>
              <div className="flex flex-wrap justify-center gap-3 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => handleSearch({ q: 'artificial intelligence' })}
                >
                  AI News
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleSearch({ q: 'climate change' })}
                >
                  Climate
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleSearch({ q: 'technology' })}
                >
                  Technology
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleSearch({ q: 'politics' })}
                >
                  Politics
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Recent Articles Tab */}
        {activeTab === 'recent' && (
          <RecentArticles 
            onArticleClick={handleArticleClick} 
            selectedArticle={selectedArticle} 
          />
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <Analytics />
        )}
      </main>

      {/* Article Detail Side Panel */}
      {selectedArticle && (
        <ArticleDetail
          article={selectedArticle}
          onClose={handleCloseDetail}
        />
      )}

      {/* Toast Notifications */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#fff',
            color: '#333',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e5e7eb',
          },
          success: {
            iconTheme: {
              primary: '#22c55e',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </div>
  );
}

export default App;