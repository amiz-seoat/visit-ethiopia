import React from 'react';
import { Link } from 'react-router-dom';
import { SearchBar } from '../ui/SearchBar';

export function Hero() {
  return (
    <section
      className="relative min-h-[560px] md:h-[600px] w-full bg-cover bg-center"
      style={{
        backgroundImage:
          "url('https://images.unsplash.com/photo-1523805009345-7448845a9e53?ixlib=rb-4.0.3&auto=format&fit=crop&w=2072&q=80')",
      }}
      aria-label="Welcome"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60" />
      <div className="relative min-h-[560px] md:h-full flex flex-col items-center justify-center text-center text-white px-4 py-16">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">Experience the Beauty of Ethiopia</h1>
        <p className="text-lg md:text-2xl max-w-3xl mb-8 text-white/90">
          Discover ancient history, breathtaking landscapes and rich cultural heritage, and book it all in one place.
        </p>
        <div className="w-full max-w-3xl">
          <SearchBar />
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            to="/tours"
            className="bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-6 rounded-full transition-colors"
          >
            Explore Tours
          </Link>
          <Link
            to="/destinations"
            className="bg-transparent hover:bg-white/20 border border-white text-white font-medium py-2 px-6 rounded-full transition-colors"
          >
            View Destinations
          </Link>
        </div>
      </div>
    </section>
  );
}
