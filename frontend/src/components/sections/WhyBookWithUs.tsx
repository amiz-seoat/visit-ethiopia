import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, CreditCard, MessageCircle, Building2, Search, CalendarCheck } from 'lucide-react';

const STEPS = [
  { Icon: Search, title: 'Find', text: 'Browse tours, hotels, transport and restaurants listed by local providers.' },
  { Icon: CalendarCheck, title: 'Book', text: 'Pick your dates and guests. The provider confirms availability.' },
  { Icon: CreditCard, title: 'Pay securely', text: 'Pay in Birr through Chapa. A booking is only marked paid after the payment is verified.' },
];

const POINTS = [
  { Icon: ShieldCheck, title: 'Reviewed providers', text: 'Businesses are checked by our team before their listings go public.' },
  { Icon: MessageCircle, title: 'Free travel guide', text: 'Ask the assistant about places, the best time to visit and how to get there.' },
  { Icon: Building2, title: 'For local businesses', text: 'Tour operators, hotels and transport companies can list and manage bookings.' },
];

export function WhyBookWithUs() {
  return (
    <section className="py-16 bg-white" aria-labelledby="how-it-works">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 id="how-it-works" className="text-3xl font-bold text-gray-800">How it works</h2>
          <p className="text-gray-600 mt-2 max-w-2xl mx-auto">Plan and book your Ethiopian trip in three steps.</p>
        </div>
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-14">
          {STEPS.map(({ Icon, title, text }, i) => (
            <li key={title} className="relative rounded-xl border border-gray-200 p-6 bg-gray-50">
              <span className="absolute top-4 right-5 text-4xl font-bold text-amber-200 select-none" aria-hidden="true">
                {i + 1}
              </span>
              <Icon className="h-8 w-8 text-amber-600 mb-3" aria-hidden="true" />
              <h3 className="text-lg font-semibold text-gray-800 mb-1">{title}</h3>
              <p className="text-gray-600 text-sm">{text}</p>
            </li>
          ))}
        </ol>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {POINTS.map(({ Icon, title, text }) => (
            <div key={title} className="flex items-start gap-4">
              <div className="h-11 w-11 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Icon className="h-5 w-5 text-amber-700" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">{title}</h3>
                <p className="text-gray-600 text-sm mt-1">{text}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-14 rounded-2xl bg-amber-800 text-white px-6 py-10 md:px-12 flex flex-col md:flex-row items-center justify-between gap-6 dark:bg-amber-900/60">
          <div>
            <h3 className="text-2xl font-bold">Not sure where to start?</h3>
            <p className="text-amber-50/90 mt-1">Ask our travel guide about Lalibela, the Simien Mountains, Timket or anywhere else.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('open-assistant'))}
              className="bg-white text-amber-800 hover:bg-amber-50 font-medium py-2 px-6 rounded-full"
            >
              Ask the travel guide
            </button>
            <Link to="/provider/register" className="border border-white/80 hover:bg-white/10 font-medium py-2 px-6 rounded-full">
              List your business
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
