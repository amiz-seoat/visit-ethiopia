import React from 'react';
import { Star } from 'lucide-react';
const testimonials = [{
  id: 1,
  name: 'Sarah Johnson',
  image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=774&q=80',
  rating: 5,
  text: 'Our tour of the historic northern circuit was absolutely incredible. The rock-hewn churches of Lalibela took my breath away. Our guide was knowledgeable and friendly, making the experience unforgettable.'
}, {
  id: 2,
  name: 'Michael Chen',
  image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=774&q=80',
  rating: 5,
  text: "The Danakil Depression tour was unlike anything I've ever experienced. The alien landscapes, salt flats, and active volcanoes were truly otherworldly. A must-visit for adventure seekers!"
}, {
  id: 3,
  name: 'Emma Rodriguez',
  image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1061&q=80',
  rating: 4,
  text: 'Our stay at Kuriftu Resort in Bahir Dar was perfect. The views of Lake Tana, the amazing food, and the spa treatments made for a relaxing break during our Ethiopian adventure.'
}];
export function Testimonials() {
  return <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-800">
            What Our Travelers Say
          </h2>
          <p className="text-gray-600 mt-2 max-w-2xl mx-auto">
            Hear from guests who have experienced the beauty and culture of
            Ethiopia with us
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map(testimonial => <div key={testimonial.id} className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex text-amber-500 mb-3">
                {Array.from({
              length: 5
            }).map((_, i) => <Star key={i} size={18} fill={i < testimonial.rating ? 'currentColor' : 'none'} className={i < testimonial.rating ? 'text-amber-500' : 'text-gray-300'} />)}
              </div>
              <p className="text-gray-600 mb-6 italic">"{testimonial.text}"</p>
              <div className="flex items-center">
                <img src={testimonial.image} alt={testimonial.name} className="w-12 h-12 rounded-full object-cover mr-4" />
                <div>
                  <h4 className="font-medium text-gray-800">
                    {testimonial.name}
                  </h4>
                  <p className="text-gray-500 text-sm">Verified Traveler</p>
                </div>
              </div>
            </div>)}
        </div>
      </div>
    </section>;
}