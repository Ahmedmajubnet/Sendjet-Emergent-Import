import React, { useState, useEffect, useRef } from 'react';
import { Input } from './ui/input';
import { MapPin, Loader2 } from 'lucide-react';

const LocationAutocomplete = ({ value, onChange, placeholder, id, name, required, iconColor = 'text-green-500' }) => {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchLocations = async (searchQuery) => {
    if (searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&addressdetails=1&limit=6&accept-language=en`,
        { headers: { 'User-Agent': 'SendJet/1.0' } }
      );
      const data = await response.json();

      const formatted = data.map((item) => {
        const addr = item.address || {};
        const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
        const state = addr.state || '';
        const country = addr.country || '';
        const parts = [city, state, country].filter(Boolean);
        const displayName = parts.length > 0 ? parts.join(', ') : item.display_name.split(',').slice(0, 3).join(',');

        return {
          display: displayName,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          full: item.display_name,
        };
      });

      // Deduplicate by display name
      const unique = formatted.filter((item, idx, arr) => arr.findIndex(a => a.display === item.display) === idx);
      setSuggestions(unique);
      setShowDropdown(unique.length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchLocations(val), 350);
  };

  const handleSelect = (suggestion) => {
    setQuery(suggestion.display);
    setShowDropdown(false);
    setSuggestions([]);
    onChange({
      address: suggestion.display,
      lat: suggestion.lat,
      lng: suggestion.lng,
    });
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Input
          id={id}
          name={name}
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
          required={required}
          className="input-focus pr-8"
          autoComplete="off"
          data-testid={`location-input-${name}`}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
        )}
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto" data-testid="location-suggestions">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-orange-50 transition-colors text-sm border-b border-gray-50 last:border-b-0"
              onClick={() => handleSelect(suggestion)}
              data-testid={`location-suggestion-${index}`}
            >
              <MapPin className={`h-4 w-4 flex-shrink-0 ${iconColor}`} />
              <span className="truncate text-gray-700">{suggestion.display}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LocationAutocomplete;
