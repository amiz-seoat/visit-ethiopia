import React from 'react';
import { Hero } from '../components/sections/Hero';
import { FeaturedTours } from '../components/sections/FeaturedTours';
import { FeaturedDestinations } from '../components/sections/FeaturedDestinations';
import { FeaturedHotels } from '../components/sections/FeaturedHotels';
import { WhyBookWithUs } from '../components/sections/WhyBookWithUs';

export function HomePage() {
  return (
    <div className="w-full bg-white">
      <Hero />
      <FeaturedTours />
      <FeaturedDestinations />
      <FeaturedHotels />
      <WhyBookWithUs />
    </div>
  );
}
