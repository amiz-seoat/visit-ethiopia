import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, FacebookIcon, InstagramIcon, TwitterIcon, MessageSquare } from 'lucide-react';
import { SITE } from '../../config/site';

const EXPLORE = [
  { to: '/tours', label: 'Tours' },
  { to: '/hotels', label: 'Hotels' },
  { to: '/destinations', label: 'Destinations' },
  { to: '/transport', label: 'Transport' },
  { to: '/restaurants', label: 'Restaurants' },
  { to: '/companies', label: 'Travel companies' },
  { to: '/news', label: 'News' },
];
const COMPANY = [
  { to: '/about', label: 'About Visit Ethiopia' },
  { to: '/provider/register', label: 'List your business' },
  { to: '/contact', label: 'Contact us' },
  { to: '/faq', label: 'FAQ' },
  { to: '/terms', label: 'Terms of Service' },
  { to: '/privacy', label: 'Privacy Policy' },
];

export function Footer() {
  const socials = [
    { href: SITE.social.facebook, label: 'Facebook', Icon: FacebookIcon },
    { href: SITE.social.instagram, label: 'Instagram', Icon: InstagramIcon },
    { href: SITE.social.x, label: 'X (Twitter)', Icon: TwitterIcon },
  ].filter((s) => s.href);

  return (
    <footer className="bg-amber-800 text-white dark:bg-gray-900 dark:border-t dark:border-gray-800">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <h2 className="text-xl font-bold mb-4">{SITE.name}</h2>
            <p className="mb-4 text-amber-50/90 dark:text-gray-300">{SITE.tagline}</p>
            {socials.length > 0 && (
              <div className="flex space-x-4">
                {socials.map(({ href, label, Icon }) => (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="hover:text-amber-300">
                    <Icon size={20} />
                  </a>
                ))}
              </div>
            )}
          </div>
          <nav aria-label="Explore">
            <h2 className="text-lg font-semibold mb-4">Explore</h2>
            <ul className="space-y-2">
              {EXPLORE.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-amber-50/90 hover:text-amber-300 dark:text-gray-300">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Company and support">
            <h2 className="text-lg font-semibold mb-4">Company &amp; support</h2>
            <ul className="space-y-2">
              {COMPANY.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-amber-50/90 hover:text-amber-300 dark:text-gray-300">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <h2 className="text-lg font-semibold mb-4">Get in touch</h2>
            <ul className="space-y-3 text-amber-50/90 dark:text-gray-300">
              {SITE.contactAddress && (
                <li className="flex items-start">
                  <MapPin size={18} className="mr-2 mt-1 flex-shrink-0" />
                  <span>{SITE.contactAddress}</span>
                </li>
              )}
              {SITE.contactPhone && (
                <li className="flex items-center">
                  <Phone size={18} className="mr-2 flex-shrink-0" />
                  <a href={`tel:${SITE.contactPhone.replace(/\s+/g, '')}`} className="hover:text-amber-300">
                    {SITE.contactPhone}
                  </a>
                </li>
              )}
              {SITE.contactEmail && (
                <li className="flex items-center">
                  <Mail size={18} className="mr-2 flex-shrink-0" />
                  <a href={`mailto:${SITE.contactEmail}`} className="hover:text-amber-300 break-all">
                    {SITE.contactEmail}
                  </a>
                </li>
              )}
              <li className="flex items-center">
                <MessageSquare size={18} className="mr-2 flex-shrink-0" />
                <Link to="/contact" className="hover:text-amber-300">
                  Send us a message
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-6 border-t border-amber-700 dark:border-gray-800 flex flex-col sm:flex-row gap-2 justify-between text-sm text-amber-50/80 dark:text-gray-400">
          <p>&copy; {new Date().getFullYear()} {SITE.name}. All rights reserved.</p>
          <p>Prices are shown in Ethiopian Birr (ETB). Payments are processed securely by Chapa.</p>
        </div>
      </div>
    </footer>
  );
}
