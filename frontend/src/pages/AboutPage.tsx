import React, { memo } from 'react';
import { MapPin, Users, Award, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
export function AboutPage() {
  return <div className="w-full bg-white">
      {/* Hero Section */}
      <div className="relative h-80 bg-cover bg-center" style={{
      backgroundImage: "url('https://images.unsplash.com/photo-1523805009345-7448845a9e53?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2072&q=80')"
    }}>
        <div className="absolute inset-0 bg-black/50"></div>
        <div className="relative h-full flex flex-col items-center justify-center text-center text-white px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            About Visit Ethiopia
          </h1>
          <p className="text-xl max-w-3xl">
            Your trusted partner for authentic Ethiopian travel experiences
          </p>
        </div>
      </div>
      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        {/* Our Story */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="flex flex-col md:flex-row gap-8 items-center">
            <div className="md:w-1/2">
              <h2 className="text-3xl font-bold mb-4">Our Story</h2>
              <p className="text-gray-700 mb-4">
                Founded in 2010, Visit Ethiopia was born from a passion for
                sharing the incredible beauty, rich history, and vibrant
                cultures of Ethiopia with the world. Our founders, Dawit
                Alemayehu and Sarah Johnson, met while working as tour guides in
                the historic northern circuit and shared a vision of creating
                authentic travel experiences that benefit both visitors and
                local communities.
              </p>
              <p className="text-gray-700">
                Over the past decade, we've grown from a small team of
                enthusiastic guides to become Ethiopia's leading travel company,
                while maintaining our core values of authenticity,
                sustainability, and excellence. We're proud to have helped
                thousands of travelers discover the wonders of Ethiopia, from
                the rock-hewn churches of Lalibela to the otherworldly
                landscapes of the Danakil Depression.
              </p>
            </div>
            <div className="md:w-1/2">
              <img src="https://images.unsplash.com/photo-1518341223789-51e3a61f5dc6?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80" alt="Ethiopian landscape" className="rounded-lg shadow-md w-full h-auto" />
            </div>
          </div>
        </div>
        {/* Our Mission */}
        <div className="bg-amber-50 py-16 px-4 md:px-12 rounded-xl mb-16">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-6">Our Mission</h2>
            <p className="text-xl text-gray-700 mb-8">
              We believe travel should be transformative, educational, and
              sustainable. Our mission is to showcase Ethiopia's extraordinary
              heritage and natural beauty while preserving its cultural
              integrity and supporting local communities.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="bg-amber-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="text-amber-600 h-6 w-6" />
                </div>
                <h3 className="font-bold text-lg mb-2">
                  Authentic Experiences
                </h3>
                <p className="text-gray-600">
                  We create meaningful connections between travelers and local
                  communities, offering genuine cultural exchanges beyond
                  typical tourist experiences.
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="bg-amber-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPin className="text-amber-600 h-6 w-6" />
                </div>
                <h3 className="font-bold text-lg mb-2">Responsible Tourism</h3>
                <p className="text-gray-600">
                  We practice and promote sustainable travel that respects
                  Ethiopia's environment, traditions, and communities while
                  maximizing positive local impact.
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="bg-amber-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Award className="text-amber-600 h-6 w-6" />
                </div>
                <h3 className="font-bold text-lg mb-2">
                  Excellence in Service
                </h3>
                <p className="text-gray-600">
                  We deliver exceptional, personalized service with meticulous
                  attention to detail, ensuring safe, comfortable, and memorable
                  journeys.
                </p>
              </div>
            </div>
          </div>
        </div>
        {/* Why Choose Us */}
        <div className="max-w-4xl mx-auto mb-16">
          <h2 className="text-3xl font-bold mb-8 text-center">
            Why Choose Visit Ethiopia
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex">
              <div className="mr-4 flex-shrink-0">
                <div className="bg-amber-100 w-10 h-10 rounded-full flex items-center justify-center">
                  <Users className="text-amber-600 h-5 w-5" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-lg mb-2">Local Expertise</h3>
                <p className="text-gray-700">
                  Our team of guides are all native Ethiopians with deep
                  knowledge of the country's history, cultures, and hidden gems.
                  They're passionate storytellers who bring each destination to
                  life.
                </p>
              </div>
            </div>
            <div className="flex">
              <div className="mr-4 flex-shrink-0">
                <div className="bg-amber-100 w-10 h-10 rounded-full flex items-center justify-center">
                  <Award className="text-amber-600 h-5 w-5" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-lg mb-2">
                  Award-Winning Service
                </h3>
                <p className="text-gray-700">
                  We've been recognized by National Geographic Traveler, Lonely
                  Planet, and the Ethiopian Tourism Board for our exceptional
                  tours and commitment to sustainable travel.
                </p>
              </div>
            </div>
            <div className="flex">
              <div className="mr-4 flex-shrink-0">
                <div className="bg-amber-100 w-10 h-10 rounded-full flex items-center justify-center">
                  <MapPin className="text-amber-600 h-5 w-5" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-lg mb-2">
                  Customized Itineraries
                </h3>
                <p className="text-gray-700">
                  We understand that every traveler is unique. Our team works
                  closely with you to design personalized journeys that match
                  your interests, pace, and budget.
                </p>
              </div>
            </div>
            <div className="flex">
              <div className="mr-4 flex-shrink-0">
                <div className="bg-amber-100 w-10 h-10 rounded-full flex items-center justify-center">
                  <Clock className="text-amber-600 h-5 w-5" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-lg mb-2">24/7 Support</h3>
                <p className="text-gray-700">
                  From the moment you book until you return home, our team is
                  available around the clock to ensure your journey is smooth
                  and worry-free.
                </p>
              </div>
            </div>
          </div>
        </div>
        {/* Meet Our Team */}
        <div className="max-w-5xl mx-auto mb-16">
          <h2 className="text-3xl font-bold mb-8 text-center">Meet Our Team</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="mb-4 rounded-full overflow-hidden h-48 w-48 mx-auto">
                <img src="https://images.unsplash.com/photo-1560250097-0b93528c311a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1974&q=80" alt="Dawit Alemayehu" className="w-full h-full object-cover" />
              </div>
              <h3 className="font-bold text-lg">Dawit Alemayehu</h3>
              <p className="text-amber-600 mb-2">Co-Founder & CEO</p>
              <p className="text-gray-600 text-sm">
                With over 15 years of experience in Ethiopian tourism, Dawit
                leads our company vision and strategy.
              </p>
            </div>
            <div className="text-center">
              <div className="mb-4 rounded-full overflow-hidden h-48 w-48 mx-auto">
                <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1976&q=80" alt="Sarah Johnson" className="w-full h-full object-cover" />
              </div>
              <h3 className="font-bold text-lg">Sarah Johnson</h3>
              <p className="text-amber-600 mb-2">
                Co-Founder & Operations Director
              </p>
              <p className="text-gray-600 text-sm">
                Sarah ensures that every tour runs smoothly and exceeds our
                clients' expectations.
              </p>
            </div>
            <div className="text-center">
              <div className="mb-4 rounded-full overflow-hidden h-48 w-48 mx-auto">
                <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1974&q=80" alt="Abebe Kebede" className="w-full h-full object-cover" />
              </div>
              <h3 className="font-bold text-lg">Abebe Kebede</h3>
              <p className="text-amber-600 mb-2">Head Guide</p>
              <p className="text-gray-600 text-sm">
                An expert in Ethiopian history and culture, Abebe leads our team
                of professional guides.
              </p>
            </div>
            <div className="text-center">
              <div className="mb-4 rounded-full overflow-hidden h-48 w-48 mx-auto">
                <img src="https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1961&q=80" alt="Makeda Haile" className="w-full h-full object-cover" />
              </div>
              <h3 className="font-bold text-lg">Makeda Haile</h3>
              <p className="text-amber-600 mb-2">Customer Experience Manager</p>
              <p className="text-gray-600 text-sm">
                Makeda ensures every client receives personalized attention from
                first inquiry to post-trip follow-up.
              </p>
            </div>
          </div>
        </div>
        {/* Testimonials */}
        <div className="bg-gray-50 py-16 px-4 md:px-12 rounded-xl mb-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 text-center">
              What Our Clients Say
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex items-center mb-4">
                  <div className="h-12 w-12 rounded-full overflow-hidden mr-4">
                    <img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1974&q=80" alt="Michael Thompson" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h3 className="font-bold">Michael Thompson</h3>
                    <p className="text-gray-500 text-sm">New York, USA</p>
                  </div>
                </div>
                <p className="text-gray-700 italic">
                  "Our tour of Ethiopia's historic northern circuit exceeded all
                  expectations. The guides were incredibly knowledgeable,
                  accommodations were comfortable, and the entire experience was
                  seamless. Seeing the rock-hewn churches of Lalibela was a
                  life-changing experience."
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex items-center mb-4">
                  <div className="h-12 w-12 rounded-full overflow-hidden mr-4">
                    <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1974&q=80" alt="Emma Wilson" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h3 className="font-bold">Emma Wilson</h3>
                    <p className="text-gray-500 text-sm">London, UK</p>
                  </div>
                </div>
                <p className="text-gray-700 italic">
                  "The Omo Valley cultural tour was truly authentic and
                  respectful of the local tribes. Visit Ethiopia's commitment to
                  responsible tourism was evident in every interaction. I
                  appreciated the way they facilitated meaningful exchanges
                  without making it feel like a human zoo."
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex items-center mb-4">
                  <div className="h-12 w-12 rounded-full overflow-hidden mr-4">
                    <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1974&q=80" alt="David Chen" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h3 className="font-bold">David Chen</h3>
                    <p className="text-gray-500 text-sm">Singapore</p>
                  </div>
                </div>
                <p className="text-gray-700 italic">
                  "The attention to detail was impressive. From airport pickup
                  to farewell dinner, Visit Ethiopia thought of everything. When
                  our flight was delayed, they quickly adjusted our itinerary
                  without missing any highlights. Truly professional service."
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex items-center mb-4">
                  <div className="h-12 w-12 rounded-full overflow-hidden mr-4">
                    <img src="https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1961&q=80" alt="Maria Rodriguez" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h3 className="font-bold">Maria Rodriguez</h3>
                    <p className="text-gray-500 text-sm">Barcelona, Spain</p>
                  </div>
                </div>
                <p className="text-gray-700 italic">
                  "As a solo female traveler, safety was my primary concern.
                  Visit Ethiopia made me feel secure throughout my journey while
                  still providing authentic adventures. My guide Abebe was
                  knowledgeable, professional, and went above and beyond to make
                  my trip special."
                </p>
              </div>
            </div>
          </div>
        </div>
        {/* Our Partners */}
        <div className="max-w-4xl mx-auto mb-16">
          <h2 className="text-3xl font-bold mb-8 text-center">Our Partners</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="bg-white p-4 rounded-lg shadow-sm flex items-center justify-center h-24">
              <p className="font-medium text-gray-600">Ethiopian Airlines</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm flex items-center justify-center h-24">
              <p className="font-medium text-gray-600">
                Ethiopian Tourism Board
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm flex items-center justify-center h-24">
              <p className="font-medium text-gray-600">
                Sustainable Travel International
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm flex items-center justify-center h-24">
              <p className="font-medium text-gray-600">National Geographic</p>
            </div>
          </div>
        </div>
        {/* Call to Action */}
        <div className="bg-amber-600 text-white py-16 px-4 md:px-12 rounded-xl text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-4">
              Ready to Explore Ethiopia?
            </h2>
            <p className="text-lg mb-8">
              Let us help you create an unforgettable journey through one of
              Africa's most fascinating countries.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/tours" className="bg-white text-amber-600 hover:bg-gray-100 font-medium py-3 px-6 rounded-md transition-colors">
                Browse Our Tours
              </Link>
              <Link to="/contact" className="bg-transparent hover:bg-amber-700 border border-white text-white font-medium py-3 px-6 rounded-md transition-colors">
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>;
}