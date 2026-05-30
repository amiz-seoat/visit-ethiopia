import React, { useState } from 'react';
export function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, you would send this to your API
    console.log('Email submitted:', email);
    setIsSubmitted(true);
    setEmail('');
  };
  return <section className="py-16 bg-amber-700 text-white">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            Stay Updated on Ethiopian Travel
          </h2>
          <p className="mb-8">
            Subscribe to our newsletter for travel tips, new destinations, and
            exclusive offers
          </p>
          {isSubmitted ? <div className="bg-white/10 rounded-lg p-6">
              <p className="text-xl font-medium">Thank you for subscribing!</p>
              <p className="mt-2">
                We'll keep you updated with the latest travel news and offers.
              </p>
            </div> : <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto">
              <input type="email" placeholder="Your email address" value={email} onChange={e => setEmail(e.target.value)} required className="flex-grow px-4 py-3 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500" />
              <button type="submit" className="bg-amber-900 hover:bg-amber-950 px-6 py-3 rounded-lg font-medium transition-colors whitespace-nowrap">
                Subscribe
              </button>
            </form>}
        </div>
      </div>
    </section>;
}