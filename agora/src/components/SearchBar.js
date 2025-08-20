import React, { useState, useEffect } from 'react';
import { Search, Settings, X } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select, SelectContent, SelectItem } from './ui/Select';
import { Card, CardContent } from './ui/Card';
import { newsAPI } from '../services/api';
import toast from 'react-hot-toast';

const SearchBar = ({ onSearch, loading }) => {
  const [query, setQuery] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [providers, setProviders] = useState([]);
  const [searchOptions, setSearchOptions] = useState({});
  
  // Search configuration
  const [config, setConfig] = useState({
    provider: '',
    searchIn: '',
    sortBy: '',
    country: '',
    language: ''
  });

  // Load providers and search options on mount
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [providersData, enumsData] = await Promise.all([
          newsAPI.getProviders(),
          newsAPI.getEnums()
        ]);
        
        // Transform provider names into objects
        const providerNames = providersData?.availableProviders || [];
        const providersArray = providerNames.map(name => ({
          name: name,
          displayName: name.charAt(0).toUpperCase() + name.slice(1)
        }));
        
        setProviders(providersArray);
        setSearchOptions(enumsData?.enums || {});
      } catch (error) {
        console.error('Failed to load search options:', error);
        toast.error('Failed to load search options');
      }
    };

    loadOptions();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    
    if (!query.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    // Build search parameters
    const searchParams = {
      q: query.trim(),
      ...Object.fromEntries(
        Object.entries(config).filter(([_, value]) => value)
      )
    };

    onSearch(searchParams);
  };

  const handleConfigChange = (key, value) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearConfig = () => {
    setConfig({
      provider: '',
      searchIn: '',
      sortBy: '',
      country: '',
      language: ''
    });
  };

  const hasActiveFilters = Object.values(config).some(value => value);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Main Search Bar */}
      <form onSubmit={handleSearch} className="relative">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            type="text"
            placeholder="Search for news articles..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-12 pr-24 h-14 text-lg border-2 border-gray-200 focus:border-primary-500 rounded-2xl shadow-sm"
          />
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`rounded-xl ${showAdvanced ? 'bg-primary-100 text-primary-700' : ''}`}
            >
              <Settings className="w-4 h-4" />
            </Button>
            <Button
              type="submit"
              disabled={loading || !query.trim()}
              className="h-10 px-6 rounded-xl bg-gradient-to-r from-primary-600 to-grass-600 hover:from-primary-700 hover:to-grass-700"
            >
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </div>
        </div>
      </form>

      {/* Advanced Search Options */}
      {showAdvanced && (
        <Card className="animate-fade-in border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Search Options</h3>
              <div className="flex items-center space-x-2">
                {hasActiveFilters && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearConfig}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Clear
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowAdvanced(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Provider Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">News Provider</label>
                <Select
                  value={config.provider}
                  onValueChange={(value) => handleConfigChange('provider', value)}
                  placeholder="All providers"
                >
                  <SelectContent>
                    <SelectItem value="" onSelect={() => handleConfigChange('provider', '')} selectedValue={config.provider}>
                      All providers
                    </SelectItem>
                    {providers.map((provider) => (
                      <SelectItem
                        key={provider.name}
                        value={provider.name}
                        onSelect={() => handleConfigChange('provider', provider.name)}
                        selectedValue={config.provider}
                      >
                        {provider.displayName || provider.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Search In */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Search In</label>
                <Select
                  value={config.searchIn}
                  onValueChange={(value) => handleConfigChange('searchIn', value)}
                  placeholder="All content"
                >
                  <SelectContent>
                    <SelectItem value="" onSelect={() => handleConfigChange('searchIn', '')} selectedValue={config.searchIn}>
                      All content
                    </SelectItem>
                    {(searchOptions.searchIn || ['title', 'description', 'content']).map((option) => (
                      <SelectItem
                        key={option}
                        value={option}
                        onSelect={() => handleConfigChange('searchIn', option)}
                        selectedValue={config.searchIn}
                      >
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sort By */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Sort By</label>
                <Select
                  value={config.sortBy}
                  onValueChange={(value) => handleConfigChange('sortBy', value)}
                  placeholder="Relevance"
                >
                  <SelectContent>
                    <SelectItem value="" onSelect={() => handleConfigChange('sortBy', '')} selectedValue={config.sortBy}>
                      Relevance
                    </SelectItem>
                    {(searchOptions.sortBy || ['date', 'publishedAt']).map((option) => (
                      <SelectItem
                        key={option}
                        value={option}
                        onSelect={() => handleConfigChange('sortBy', option)}
                        selectedValue={config.sortBy}
                      >
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Country */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Country</label>
                <Select
                  value={config.country}
                  onValueChange={(value) => handleConfigChange('country', value)}
                  placeholder="Any country"
                >
                  <SelectContent>
                    <SelectItem value="" onSelect={() => handleConfigChange('country', '')} selectedValue={config.country}>
                      Any country
                    </SelectItem>
                    <SelectItem value="us" onSelect={() => handleConfigChange('country', 'us')} selectedValue={config.country}>
                      United States
                    </SelectItem>
                    <SelectItem value="uk" onSelect={() => handleConfigChange('country', 'uk')} selectedValue={config.country}>
                      United Kingdom
                    </SelectItem>
                    <SelectItem value="ca" onSelect={() => handleConfigChange('country', 'ca')} selectedValue={config.country}>
                      Canada
                    </SelectItem>
                    <SelectItem value="au" onSelect={() => handleConfigChange('country', 'au')} selectedValue={config.country}>
                      Australia
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Language */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Language</label>
                <Select
                  value={config.language}
                  onValueChange={(value) => handleConfigChange('language', value)}
                  placeholder="Any language"
                >
                  <SelectContent>
                    <SelectItem value="" onSelect={() => handleConfigChange('language', '')} selectedValue={config.language}>
                      Any language
                    </SelectItem>
                    <SelectItem value="en" onSelect={() => handleConfigChange('language', 'en')} selectedValue={config.language}>
                      English
                    </SelectItem>
                    <SelectItem value="es" onSelect={() => handleConfigChange('language', 'es')} selectedValue={config.language}>
                      Spanish
                    </SelectItem>
                    <SelectItem value="fr" onSelect={() => handleConfigChange('language', 'fr')} selectedValue={config.language}>
                      French
                    </SelectItem>
                    <SelectItem value="de" onSelect={() => handleConfigChange('language', 'de')} selectedValue={config.language}>
                      German
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SearchBar;

