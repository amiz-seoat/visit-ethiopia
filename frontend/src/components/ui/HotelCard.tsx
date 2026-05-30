import React from 'react';
import { Link } from 'react-router-dom';
import { Star, MapPin } from 'lucide-react';
interface HotelCardProps {
  id: string;
  name: string;
  image: string;
  stars: number;
  rating: number;
  location: string;
  priceRange: string;
}
export function HotelCard({
  id,
  name,
  image,
  stars,
  rating,
  location,
  priceRange
}: HotelCardProps) {
  return <div className="bg-white rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300">
      <Link to={`/hotels/${id}`}>
        <div className="relative h-48 overflow-hidden">
          <img src={image} alt={name} className="w-full h-full object-cover transition-transform duration-300 hover:scale-105" />
        </div>
      </Link>
      <div className="p-4">
        <Link to={`/hotels/${id}`}>
          <h3 className="font-bold text-lg mb-1 hover:text-amber-600 transition-colors">
            {name}
          </h3>
        </Link>
        <div className="flex items-center mb-2">
          <div className="flex text-amber-500">
            {Array.from({
            length: 5
          }).map((_, i) => <Star key={i} size={16} fill={i < stars ? 'currentColor' : 'none'} className={i < stars ? 'text-amber-500' : 'text-gray-300'} />)}
          </div>
          <span className="ml-2 text-sm text-gray-600">
            ({rating.toFixed(1)})
          </span>
        </div>
        <div className="flex items-center text-gray-500 text-sm mb-3">
          <MapPin size={16} className="mr-1" />
          <span>{location}</span>
        </div>
        <div className="flex items-center justify-between mt-auto">
          <div className="text-sm font-medium">
            From <span className="text-amber-600">{priceRange}</span>
          </div>
          <Link to={`/hotels/${id}`} className="text-sm font-medium text-amber-600 hover:text-amber-800 transition-colors">
            View Details
          </Link>
        </div>
      </div>
    </div>;
}