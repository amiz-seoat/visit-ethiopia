import React, { useState } from 'react';

/**
 * No newsletter backend endpoint exists in this project.
 * Keep the UI visible but do not pretend a subscription was stored.
 */
export function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(
      'Newsletter subscriptions are not available yet. Please use the Contact page to reach us.'
    );
    setEmail('');
  };

  return (
    <section className="py-16 bg-amber-700 text-white">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            Stay Updated on Ethiopian Travel
          </h2>
          <p className="mb-8">
            Subscribe to our newsletter for travel tips, new destinations, and
            exclusive offers
          </p>
          {message ? (
            <div className="bg-white/10 rounded-lg p-6">
              <p className="text-lg font-medium">{message}</p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto"
            >
              <input
                type="email"
                placeholder="Your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-grow px-4 py-3 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="submit"
                className="bg-amber-900 hover:bg-amber-950 px-6 py-3 rounded-lg font-medium transition-colors whitespace-nowrap"
              >
                Subscribe
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
