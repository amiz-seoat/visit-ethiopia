import React, { useState, Component } from 'react';
import { SearchIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
export function SearchBar() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query)}`);
    }
  };
  return <form onSubmit={handleSubmit} className="w-full max-w-3xl">
      <div className="relative">
        <input type="text" placeholder="Search for tours, destinations, hotels..." value={query} onChange={e => setQuery(e.target.value)} className="w-full py-3 px-4 pr-12 rounded-full border border-gray-300 shadow-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none" />
        <button type="submit" className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-amber-600">
          <SearchIcon size={20} />
        </button>
      </div>
    </form>;
}