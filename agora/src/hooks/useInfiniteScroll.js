import { useState, useCallback, useRef } from 'react';

export const useInfiniteScroll = (fetchMore) => {
  const [isFetching, setIsFetching] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);

  const observer = useRef();
  
  const handleFetchMore = useCallback(async () => {
    if (isFetching || !hasMore) return;
    
    setIsFetching(true);
    setError(null);
    
    try {
      const result = await fetchMore();
      setHasMore(result.hasMore === true);
    } catch (err) {
      setError(err.message);
      setHasMore(false);
      console.error('Error fetching more data:', err);
    } finally {
      setIsFetching(false);
    }
  }, [fetchMore, isFetching, hasMore]);

  const lastElementRef = useCallback(node => {
    if (isFetching) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !isFetching) {
        handleFetchMore();
      }
    }, {
      threshold: 0.1,
      rootMargin: '50px' // Reduced from 100px to be less aggressive
    });
    
    if (node) observer.current.observe(node);
  }, [isFetching, hasMore, handleFetchMore]);

  const reset = useCallback(() => {
    setIsFetching(false);
    setHasMore(true);
    setError(null);
  }, []);

  return { 
    lastElementRef, 
    isFetching, 
    hasMore, 
    error, 
    reset 
  };
};

