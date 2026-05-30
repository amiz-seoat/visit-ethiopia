import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
interface DestinationCardProps {
  id: string;
  name: string;
  image: string;
  region: string;
}
export function DestinationCard({
  id,
  name,
  image,
  region
}: DestinationCardProps) {
  return <Link to={`/destinations/${id}`}>
      <div className="relative h-64 rounded-lg overflow-hidden group cursor-pointer">
        <img src={image} alt={name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
        <div className="absolute bottom-0 left-0 p-4 text-white">
          <h3 className="font-bold text-xl mb-1">{name}</h3>
          <div className="flex items-center">
            <MapPin size={16} className="mr-1" />
            <span className="text-sm">{region}</span>
          </div>
        </div>
      </div>
    </Link>;
}