import React from 'react';
import { Calendar, User, ExternalLink, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader } from './ui/Card';
import { Badge } from './ui/Badge';

const ArticleCard = ({ article, onClick, isSelected = false }) => {
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Unknown date';
    }
  };

  const truncateText = (text, maxLength = 150) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const handleClick = () => {
    onClick?.(article);
  };

  const handleExternalClick = (e) => {
    e.stopPropagation();
    window.open(article.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card 
      className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1 ${
        isSelected ? 'ring-2 ring-primary-500 shadow-lg' : ''
      }`}
      onClick={handleClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-lg leading-tight text-gray-900 hover:text-primary-700 transition-colors">
            {article.title}
          </h3>
          <button
            onClick={handleExternalClick}
            className="flex-shrink-0 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        
        {/* Article metadata */}
        <div className="flex items-center gap-4 text-sm text-gray-500">
          {article.publishedAt && (
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(article.publishedAt)}</span>
            </div>
          )}
          
          {article.source?.name && (
            <div className="flex items-center gap-1">
              <User className="w-4 h-4" />
              <span>{article.source.name}</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Article image */}
        {article.urlToImage && (
          <div className="mb-4 overflow-hidden rounded-lg">
            <img
              src={article.urlToImage}
              alt={article.title}
              className="w-full h-48 object-cover hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Article description */}
        {article.description && (
          <p className="text-gray-600 leading-relaxed mb-4">
            {truncateText(article.description)}
          </p>
        )}

        {/* AI Analysis indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary-500" />
            <span className="text-sm text-primary-600 font-medium">
              Click for AI Analysis
            </span>
          </div>
          
          {/* Source badge */}
          {article.source?.name && (
            <Badge variant="outline" className="text-xs">
              {article.source.name}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ArticleCard;

