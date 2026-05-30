import React from 'react';
import { SearchBar } from '../ui/SearchBar';
export function Hero() {
  return <div className="relative h-[600px] w-full bg-cover bg-center" style={{
    backgroundImage: "url('https://images.unsplash.com/photo-1523805009345-7448845a9e53?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2072&q=80')"
  }}>
      <div className="absolute inset-0 bg-black/40"></div>
      <div className="relative h-full flex flex-col items-center justify-center text-center text-white px-4">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
          Experience the Beauty of Ethiopia
        </h1>
        <p className="text-xl md:text-2xl max-w-3xl mb-8">
          Discover ancient history, breathtaking landscapes, and rich cultural
          heritage
        </p>
        <div className="w-full max-w-3xl">
          <SearchBar />
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <button className="bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-6 rounded-full transition-colors">
            Explore Tours
          </button>
          <button className="bg-transparent hover:bg-white/20 border border-white text-white font-medium py-2 px-6 rounded-full transition-colors">
            View Destinations
          </button>
        </div>
      </div>
    </div>;
}