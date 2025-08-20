import React from 'react';
import { cn } from '../../utils/cn';

const Badge = ({ className, variant = "default", ...props }) => {
  const variants = {
    default: "bg-primary-100 text-primary-800 hover:bg-primary-200",
    secondary: "bg-grass-100 text-grass-800 hover:bg-grass-200",
    destructive: "bg-red-100 text-red-800 hover:bg-red-200",
    outline: "border border-gray-300 text-gray-700",
    positive: "bg-green-100 text-green-800",
    neutral: "bg-gray-100 text-gray-800",
    negative: "bg-red-100 text-red-800",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variants[variant],
        className
      )}
      {...props}
    />
  );
};

export { Badge };

