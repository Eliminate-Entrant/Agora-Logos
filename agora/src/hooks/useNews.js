import { useState, useCallback } from 'react';
import { newsAPI } from '../services/api';

export const useNews = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    hasNext: false,
    total: 0
  });

  const searchNews = useCallback(async (searchParams, reset = true) => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        ...searchParams,
        page: reset ? 1 : pagination.page + 1,
        limit: 10
      };

      const response = await newsAPI.searchNews(params);
      
      if (reset) {
        setArticles(response.articles || []);
        setPagination({
          page: 1,
          hasNext: response.pagination?.hasNextPage || false,
          total: response.pagination?.totalResults || 0
        });
      } else {
        setArticles(prev => [...prev, ...(response.articles || [])]);
        setPagination(prev => ({
          page: prev.page + 1,
          hasNext: response.pagination?.hasNextPage || false,
          total: response.pagination?.totalResults || prev.total
        }));
      }

      return {
        hasMore: response.pagination?.hasNextPage || false,
        articles: response.articles || []
      };

    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!pagination.hasNext) return { hasMore: false };
    return { hasMore: false };
  }, [pagination.hasNext]);

  const reset = useCallback(() => {
    setArticles([]);
    setError(null);
    setPagination({ page: 1, hasNext: false, total: 0 });
  }, []);

  return {
    articles,
    loading,
    error,
    pagination,
    searchNews,
    loadMore,
    reset
  };
};

