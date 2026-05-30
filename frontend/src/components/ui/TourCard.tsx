import React from 'react';
import { Link } from 'react-router-dom';
import { Star, Clock } from 'lucide-react';
interface TourCardProps {
  id: string;
  title: string;
  image: string; // This should use coverImage from backend
  price: number;
  duration: {
    days: number;
    nights: number;
  }; // Updated to match schema
  rating: number; // This would come from averageRating
  shortDescription: string;
}
export function TourCard({
  id,
  title,
  image,
  price,
  duration,
  rating,
  shortDescription
}: TourCardProps) {
  return <div className="bg-white rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300">
      <Link to={`/tours/${id}`}>
        <div className="relative h-48 overflow-hidden">
          <img src={image} alt={title} className="w-full h-full object-cover transition-transform duration-300 hover:scale-105" />
          <div className="absolute top-0 right-0 bg-amber-600 text-white px-3 py-1 m-2 rounded-full text-sm font-medium">
            ${price}
          </div>
        </div>
      </Link>
      <div className="p-4">
        <div className="flex items-center mb-2">
          <div className="flex text-amber-500">
            {Array.from({
            length: 5
          }).map((_, i) => <Star key={i} size={16} fill={i < rating ? 'currentColor' : 'none'} className={i < rating ? 'text-amber-500' : 'text-gray-300'} />)}
          </div>
          <span className="ml-1 text-sm text-gray-600">
            ({rating.toFixed(1)})
          </span>
        </div>
        <Link to={`/tours/${id}`}>
          <h3 className="font-bold text-lg mb-1 hover:text-amber-600 transition-colors">
            {title}
          </h3>
        </Link>
        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
          {shortDescription}
        </p>
        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center text-gray-500 text-sm">
            <Clock size={16} className="mr-1" />
            <span>
              {duration.days} Days / {duration.nights} Nights
            </span>
          </div>
          <Link to={`/tours/${id}`} className="text-sm font-medium text-amber-600 hover:text-amber-800 transition-colors">
            View Details
          </Link>
        </div>
      </div>
    </div>;
}