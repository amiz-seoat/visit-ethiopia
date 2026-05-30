import React, { useState } from 'react';
import { Mail, Phone, MapPin, Clock, Send, CheckCircle } from 'lucide-react';
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
            Get in touch with our travel experts to plan your Ethiopian
            adventure
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
                <h2 className="text-2xl font-bold mb-6">Get In Touch</h2>
                <div className="space-y-6">
                  <div className="flex items-start">
                    <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center mr-4 flex-shrink-0">
                      <Phone className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-medium mb-1">Phone</h3>
                      <p className="text-gray-600">+251 123 456 789</p>
                      <p className="text-gray-600">+251 987 654 321</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center mr-4 flex-shrink-0">
                      <Mail className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-medium mb-1">Email</h3>
                      <p className="text-gray-600">info@visitethiopia.com</p>
                      <p className="text-gray-600">
                        bookings@visitethiopia.com
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center mr-4 flex-shrink-0">
                      <MapPin className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-medium mb-1">Address</h3>
                      <p className="text-gray-600">123 Main Street</p>
                      <p className="text-gray-600">Addis Ababa, Ethiopia</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center mr-4 flex-shrink-0">
                      <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-medium mb-1">Office Hours</h3>
                      <p className="text-gray-600">
                        Monday - Friday: 9AM - 5PM
                      </p>
                      <p className="text-gray-600">Saturday: 10AM - 2PM</p>
                      <p className="text-gray-600">Sunday: Closed</p>
                    </div>
                  </div>
                </div>
                {/* Social Media Links */}
                <div className="mt-8">
                  <h3 className="font-medium mb-3">Follow Us</h3>
                  <div className="flex space-x-4">
                    <a href="#" className="h-10 w-10 rounded-full bg-gray-100 hover:bg-amber-100 flex items-center justify-center text-gray-600 hover:text-amber-600 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
                      </svg>
                    </a>
                    <a href="#" className="h-10 w-10 rounded-full bg-gray-100 hover:bg-amber-100 flex items-center justify-center text-gray-600 hover:text-amber-600 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                      </svg>
                    </a>
                    <a href="#" className="h-10 w-10 rounded-full bg-gray-100 hover:bg-amber-100 flex items-center justify-center text-gray-600 hover:text-amber-600 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path>
                      </svg>
                    </a>
                    <a href="#" className="h-10 w-10 rounded-full bg-gray-100 hover:bg-amber-100 flex items-center justify-center text-gray-600 hover:text-amber-600 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                        <rect x="2" y="9" width="4" height="12"></rect>
                        <circle cx="4" cy="4" r="2"></circle>
                      </svg>
                    </a>
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
                        as soon as possible, usually within 24 hours.
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
          {/* Map */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">Find Us</h2>
            <div className="h-96 bg-gray-200 rounded-lg overflow-hidden">
              <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d125773.44812393177!2d38.68991121640625!3d9.010787199999994!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x164b8f7e44a3539f%3A0xf3f8c2355f8d3f98!2sAddis%20Ababa%2C%20Ethiopia!5e0!3m2!1sen!2sus!4v1651234567890!5m2!1sen!2sus" width="100%" height="100%" style={{
              border: 0
            }} allowFullScreen={true} loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="Visit Ethiopia Office Location"></iframe>
            </div>
          </div>
          {/* FAQ Section */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">
              Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              <div className="bg-white rounded-lg shadow-sm p-5">
                <h3 className="font-bold text-lg mb-2">
                  What are your office hours?
                </h3>
                <p className="text-gray-700">
                  Our office in Addis Ababa is open Monday through Friday from
                  9AM to 5PM, Saturday from 10AM to 2PM, and closed on Sundays.
                  However, our emergency contact line is available 24/7 for
                  travelers already in Ethiopia.
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-5">
                <h3 className="font-bold text-lg mb-2">
                  How quickly do you respond to inquiries?
                </h3>
                <p className="text-gray-700">
                  We aim to respond to all inquiries within 24 hours during
                  business days. For urgent matters, please call our phone
                  number directly.
                </p>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-5">
                <h3 className="font-bold text-lg mb-2">
                  Can I visit your office to discuss my travel plans?
                </h3>
                <p className="text-gray-700">
                  Yes, we welcome in-person visits to our office in Addis Ababa.
                  For the best experience, we recommend scheduling an
                  appointment in advance so we can prepare for your visit and
                  ensure the appropriate travel specialist is available.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>;
}