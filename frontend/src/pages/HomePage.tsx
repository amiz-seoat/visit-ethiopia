import React from 'react';
import { Hero } from '../components/sections/Hero';
import { FeaturedTours } from '../components/sections/FeaturedTours';
import { FeaturedDestinations } from '../components/sections/FeaturedDestinations';
import { FeaturedHotels } from '../components/sections/FeaturedHotels';
import { Testimonials } from '../components/sections/Testimonials';
import { NewsletterSignup } from '../components/sections/NewsletterSignup';
export function HomePage() {
  return <div className="w-full bg-white">
      <Hero />
      <FeaturedTours />
      <FeaturedDestinations />
      <FeaturedHotels />
      <Testimonials />
      <NewsletterSignup />
    </div>;
}