import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Compass, ShieldCheck, CreditCard, Building2, MessageCircle, Map } from 'lucide-react';

const TRAVELER_STEPS = [
  { Icon: Compass, title: 'Explore', text: 'Read about destinations across Ethiopia and compare tours, hotels, transport and restaurants in one place.' },
  { Icon: CreditCard, title: 'Book & pay', text: 'Request a booking and pay in Ethiopian Birr through Chapa. A booking is only marked paid once the payment is verified with Chapa.' },
  { Icon: MessageCircle, title: 'Get help', text: "Ask the free travel guide about places, seasons and getting around, or contact us if something about a booking isn't right." },
];

const PROVIDER_STEPS = [
  { Icon: Building2, title: 'Register your business', text: 'Tour operators, hotels, transport companies, restaurants and guides can apply to list on the platform.' },
  { Icon: ShieldCheck, title: 'Get reviewed', text: 'Our team reviews each business profile before its listings are shown to travelers.' },
  { Icon: Map, title: 'Manage bookings', text: 'Publish listings, set prices and handle incoming bookings from your provider workspace.' },
];

function StepGrid({ steps }: { steps: typeof TRAVELER_STEPS }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {steps.map(({ Icon, title, text }) => (
        <div key={title} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="h-11 w-11 rounded-full bg-amber-100 flex items-center justify-center mb-4">
            <Icon className="h-5 w-5 text-amber-700" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">{title}</h3>
          <p className="text-gray-600 text-sm leading-relaxed">{text}</p>
        </div>
      ))}
    </div>
  );
}

export function AboutPage() {
  return (
    <div className="w-full bg-gray-50">
      <section
        className="relative h-72 md:h-80 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1523805009345-7448845a9e53?ixlib=rb-4.0.3&auto=format&fit=crop&w=2072&q=80')",
        }}
      >
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative h-full flex flex-col items-center justify-center text-center text-white px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">About Visit Ethiopia</h1>
          <p className="text-lg md:text-xl max-w-3xl text-white/90">
            One place to discover Ethiopia and book trusted local travel businesses.
          </p>
        </div>
      </section>

      <div className="container mx-auto px-4 py-14 space-y-16">
        <section className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">What we do</h2>
          <p className="text-gray-700 leading-relaxed">
            Visit Ethiopia is an online travel marketplace. We don't run tours ourselves. We connect travelers with local tour
            operators, hotels, transport companies, restaurants and guides, so you can plan a trip, compare options and book
            directly with the businesses that deliver it.
          </p>
          <p className="text-gray-700 leading-relaxed mt-4">
            Alongside the listings, our destination guide covers places from the rock-hewn churches of Lalibela and the
            castles of Gondar to the Simien Mountains, the Danakil Depression and Ethiopia's newest parks and eco-resorts.
          </p>
        </section>

        <section aria-labelledby="for-travelers">
          <h2 id="for-travelers" className="text-2xl font-bold text-gray-800 mb-6">For travelers</h2>
          <StepGrid steps={TRAVELER_STEPS} />
        </section>

        <section aria-labelledby="for-providers">
          <h2 id="for-providers" className="text-2xl font-bold text-gray-800 mb-6">For travel businesses</h2>
          <StepGrid steps={PROVIDER_STEPS} />
        </section>

        <section className="max-w-3xl mx-auto bg-white rounded-xl border border-gray-200 p-6 md:p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Traveling responsibly</h2>
          <p className="text-gray-700 leading-relaxed">
            Conditions in some regions of Ethiopia change quickly. Before you travel, check your government's latest travel
            advice and confirm the current situation with your provider. Our guide flags places where official advisories apply,
            but it is not a substitute for official guidance.
          </p>
        </section>

        <section className="rounded-2xl bg-amber-800 text-white px-6 py-10 md:px-12 flex flex-col md:flex-row items-center justify-between gap-6 dark:bg-amber-900/60">
          <div>
            <h2 className="text-2xl font-bold">Ready to start planning?</h2>
            <p className="text-amber-50/90 mt-1">Browse tours, or list your business on Visit Ethiopia.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/tours" className="inline-flex items-center bg-white text-amber-800 hover:bg-amber-50 font-medium py-2 px-6 rounded-full">
              Browse tours <ArrowRight size={16} className="ml-2" />
            </Link>
            <Link to="/provider/register" className="border border-white/80 hover:bg-white/10 font-medium py-2 px-6 rounded-full">
              List your business
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
