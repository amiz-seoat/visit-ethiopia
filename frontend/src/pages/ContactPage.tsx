import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Clock, Send, CheckCircle, HelpCircle } from 'lucide-react';
import { SITE } from '../config/site';
import { submitContact } from '../api/contact';
import { getErrorMessage } from '../services/api';

export function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const {
      name,
      value
    } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await submitContact(formData);
      setIsSubmitted(true);
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
      setTimeout(() => setIsSubmitted(false), 5000);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to send message'));
    } finally {
      setLoading(false);
    }
  };
  return <div className="w-full bg-gray-50">
      {/* Hero Section */}
      <div className="relative h-80 bg-cover bg-center" style={{
      backgroundImage: "url('https://images.unsplash.com/photo-1523805009345-7448845a9e53?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2072&q=80')"
    }}>
        <div className="absolute inset-0 bg-black/50"></div>
        <div className="relative h-full flex flex-col items-center justify-center text-center text-white px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Contact Us</h1>
          <p className="text-xl max-w-3xl">
            Questions about a booking, a listing or planning your trip? Send us a message.
          </p>
        </div>
      </div>
      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Contact Information */}
            <div className="lg:w-1/3">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Get In Touch</h2>
                <div className="space-y-6">
                  {SITE.contactPhone && <div className="flex items-start">
                    <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center mr-4 flex-shrink-0">
                      <Phone className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-medium mb-1">Phone</h3>
                      <a href={`tel:${SITE.contactPhone.replace(/\s+/g, "")}`} className="text-gray-600 hover:text-amber-700">{SITE.contactPhone}</a>
                    </div>
                  </div>}
                  {SITE.contactEmail && <div className="flex items-start">
                    <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center mr-4 flex-shrink-0">
                      <Mail className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-medium mb-1">Email</h3>
                      <a href={`mailto:${SITE.contactEmail}`} className="text-gray-600 hover:text-amber-700 break-all">{SITE.contactEmail}</a>
                    </div>
                  </div>}
                  {SITE.contactAddress && <div className="flex items-start">
                    <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center mr-4 flex-shrink-0">
                      <MapPin className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-medium mb-1">Address</h3>
                      <p className="text-gray-600">{SITE.contactAddress}</p>
                    </div>
                  </div>}
                  <div className="flex items-start">
                    <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center mr-4 flex-shrink-0">
                      <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-medium mb-1">Response time</h3>
                      <p className="text-gray-600">We reply to messages by email, usually within one to two business days.</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center mr-4 flex-shrink-0">
                      <HelpCircle className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-medium mb-1">About an existing booking?</h3>
                      <p className="text-gray-600">Include your booking reference from <Link to="/bookings" className="text-amber-700 hover:underline">My bookings</Link> so we can help faster.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Contact Form */}
            <div className="lg:w-2/3">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold mb-6">Send Us a Message</h2>
                {error && (
                  <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded">{error}</div>
                )}
                {isSubmitted ? <div className="bg-green-50 border border-green-200 rounded-lg p-6 flex items-start">
                    <CheckCircle className="h-6 w-6 text-green-500 mr-3 mt-0.5" />
                    <div>
                      <h3 className="text-lg font-medium text-green-800 mb-1">
                        Thank you for your message!
                      </h3>
                      <p className="text-green-700">
                        We have received your inquiry and will get back to you
                        as soon as possible, usually within one to two business days.
                      </p>
                    </div>
                  </div> : <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                          Full Name *
                        </label>
                        <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none" required />
                      </div>
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                          Email Address *
                        </label>
                        <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none" required />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                          Phone Number
                        </label>
                        <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none" />
                      </div>
                      <div>
                        <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                          Subject *
                        </label>
                        <select id="subject" name="subject" value={formData.subject} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none" required>
                          <option value="">Select a subject</option>
                          <option value="General Inquiry">
                            General Inquiry
                          </option>
                          <option value="Tour Booking">Tour Booking</option>
                          <option value="Hotel Reservation">
                            Hotel Reservation
                          </option>
                          <option value="Transportation">Transportation</option>
                          <option value="Feedback">Feedback</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                        Message *
                      </label>
                      <textarea id="message" name="message" rows={5} value={formData.message} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none" required></textarea>
                    </div>
                    <div>
                      <button type="submit" disabled={loading} className="flex items-center justify-center bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-6 rounded-md transition-colors disabled:opacity-60">
                        <Send className="h-5 w-5 mr-2" />
                        {loading ? 'Sending...' : 'Send Message'}
                      </button>
                    </div>
                  </form>}
              </div>
            </div>
          </div>
          <div className="mt-12 bg-white rounded-lg shadow-sm p-6 text-center">
            <h2 className="text-xl font-bold text-gray-800 mb-2">Looking for quick answers?</h2>
            <p className="text-gray-600 mb-4">Booking, payment and cancellation questions are covered in our FAQ.</p>
            <Link to="/faq" className="inline-block bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-6 rounded-md">Read the FAQ</Link>
          </div>
        </div>
      </div>
    </div>;
}