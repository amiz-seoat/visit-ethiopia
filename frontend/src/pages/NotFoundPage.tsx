import React from 'react';
import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-gray-50 px-4 py-16">
      <div className="text-center max-w-md">
        <Compass className="h-14 w-14 text-amber-600 mx-auto mb-4" aria-hidden="true" />
        <p className="text-sm font-semibold text-amber-700 tracking-wide uppercase">Error 404</p>
        <h1 className="text-3xl font-bold text-gray-800 mt-2">This page took a wrong turn</h1>
        <p className="text-gray-600 mt-3">
          The page you're looking for doesn't exist or has moved. Let's get you back on the road.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/" className="bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-6 rounded-full">
            Go home
          </Link>
          <Link to="/tours" className="border border-gray-300 text-gray-700 hover:bg-gray-100 font-medium py-2 px-6 rounded-full">
            Browse tours
          </Link>
          <Link to="/destinations" className="border border-gray-300 text-gray-700 hover:bg-gray-100 font-medium py-2 px-6 rounded-full">
            Destinations
          </Link>
        </div>
      </div>
    </div>
  );
}
