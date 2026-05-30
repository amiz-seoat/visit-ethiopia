import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, FacebookIcon, InstagramIcon, TwitterIcon } from 'lucide-react';
export function Footer() {
  return <footer className="bg-amber-800 text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <h3 className="text-xl font-bold mb-4">Visit Ethiopia</h3>
            <p className="mb-4">
              Discover the beauty, history, and culture of Ethiopia with our
              guided tours and travel services.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="hover:text-amber-300">
                <FacebookIcon size={20} />
              </a>
              <a href="#" className="hover:text-amber-300">
                <InstagramIcon size={20} />
              </a>
              <a href="#" className="hover:text-amber-300">
                <TwitterIcon size={20} />
              </a>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/tours" className="hover:text-amber-300">
                  Tours
                </Link>
              </li>
              <li>
                <Link to="/hotels" className="hover:text-amber-300">
                  Hotels
                </Link>
              </li>
              <li>
                <Link to="/destinations" className="hover:text-amber-300">
                  Destinations
                </Link>
              </li>
              <li>
                <Link to="/transport" className="hover:text-amber-300">
                  Transport
                </Link>
              </li>
              <li>
                <Link to="/news" className="hover:text-amber-300">
                  News
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Support</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/contact" className="hover:text-amber-300">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link to="/faq" className="hover:text-amber-300">
                  FAQ
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-amber-300">
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-amber-300">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact</h3>
            <ul className="space-y-3">
              <li className="flex items-start">
                <MapPin size={18} className="mr-2 mt-1 flex-shrink-0" />
                <span>123 Main Street, Addis Ababa, Ethiopia</span>
              </li>
              <li className="flex items-center">
                <Phone size={18} className="mr-2 flex-shrink-0" />
                <span>+251 123 456 789</span>
              </li>
              <li className="flex items-center">
                <Mail size={18} className="mr-2 flex-shrink-0" />
                <span>info@visitethiopia.com</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-6 border-t border-amber-700 text-center">
          <p>
            &copy; {new Date().getFullYear()} Visit Ethiopia. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>;
}