import React, { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../../utils/cn';

const Select = ({ 
  value, 
  onValueChange, 
  children, 
  placeholder = "Select an option...",
  className 
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          !value && "text-gray-500"
        )}
      >
        <span>{value || placeholder}</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
      </button>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
            {children}
          </div>
        </>
      )}
    </div>
  );
};

const SelectContent = ({ children, className }) => (
  <div className={cn("p-1", className)}>
    {children}
  </div>
);

const SelectItem = ({ value, children, onSelect, selectedValue }) => (
  <button
    type="button"
    onClick={() => onSelect(value)}
    className={cn(
      "relative flex w-full cursor-pointer select-none items-center rounded-sm py-2 pl-8 pr-2 text-sm outline-none hover:bg-gray-100 focus:bg-gray-100",
      selectedValue === value && "bg-grass-50 text-grass-900"
    )}
  >
    {selectedValue === value && (
      <Check className="absolute left-2 h-4 w-4" />
    )}
    {children}
  </button>
);

export { Select, SelectContent, SelectItem };

