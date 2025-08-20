import React, { useState, useEffect, useRef } from 'react';
import { newsAPI } from '../services/api';

const LiveHeadlines = () => {
  const [headlines, setHeadlines] = useState([]);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef(null);
  const scrollRef = useRef(null);

  const fetchHeadlines = async () => {
    try {
      setIsLoading(true);
      const response = await newsAPI.getHeadlines({ 
        limit: 10, // Get top 10 headlines
        country: 'us' // Default to US headlines
      });

      console.log("DD HEADLINES", response);
      
      if (response?.articles && Array.isArray(response.articles)) {
        setHeadlines(response.articles);
        setIsError(false);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Failed to fetch headlines:', error);
      setIsError(true);
      setHeadlines([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchHeadlines();

    // Set up interval to fetch every 10 minutes (600,000 ms)
    intervalRef.current = setInterval(fetchHeadlines, 10 * 60 * 1000);

    // Cleanup interval on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Auto-scroll effect for the banner
  useEffect(() => {
    if (headlines.length > 0 && scrollRef.current) {
      const scrollElement = scrollRef.current;
      let scrollPosition = 0;
      const scrollSpeed = 1; // pixels per frame
      
      const scroll = () => {
        scrollPosition += scrollSpeed;
        if (scrollPosition >= scrollElement.scrollWidth / 2) {
          scrollPosition = 0;
        }
        scrollElement.scrollLeft = scrollPosition;
      };

      const scrollInterval = setInterval(scroll, 40); // 40ms for smooth scrolling
      
      return () => clearInterval(scrollInterval);
    }
  }, [headlines]);

  if (isLoading && headlines.length === 0) {
    return (
      <div className="bg-green-50 border-b border-green-200">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center">
            <div className="flex items-center mr-4">
              <div className="w-2 h-2 bg-gray-400 rounded-full mr-2 animate-pulse"></div>
              <span className="text-sm font-medium text-gray-600">Loading Headlines...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError || headlines.length === 0) {
    return (
      <div className="bg-red-50 border-b border-red-200">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center">
            <div className="flex items-center mr-4">
              <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
              <span className="text-sm font-medium text-red-600">Live Updates</span>
            </div>
            <span className="text-sm text-red-500">
              Unable to load live headlines
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-green-50 border-b border-green-200">
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center">
          {/* Live indicator */}
          <div className="flex items-center mr-4 flex-shrink-0">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
            <span className="text-sm font-medium text-green-700">Live Updates</span>
          </div>
          
          {/* Scrolling headlines */}
          <div className="flex-1 overflow-hidden">
            <div 
              ref={scrollRef}
              className="flex whitespace-nowrap overflow-hidden"
              style={{
                maskImage: 'linear-gradient(to right, transparent, black 20px, black calc(100% - 20px), transparent)',
                WebkitMaskImage: 'linear-gradient(to right, transparent, black 20px, black calc(100% - 20px), transparent)'
              }}
            >
              {/* Duplicate headlines for seamless scrolling */}
              {[...headlines, ...headlines].map((article, index) => (
                <span 
                  key={`${article.url}-${index}`}
                  className="inline-block text-sm text-gray-700 mr-8 flex-shrink-0"
                >
                  <span className="font-medium">BREAKING:</span> {article.title}
                </span>
              ))}
            </div>
          </div>
          
          {/* Last updated indicator */}
          <div className="flex-shrink-0 ml-4">
            <span className="text-xs text-gray-500">
              Updated {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveHeadlines;
