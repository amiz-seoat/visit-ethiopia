import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const BASE = 'Visit Ethiopia';

// First match wins. Detail pages get a generic title (a page may override with usePageTitle).
const TITLES: Array<[RegExp, string]> = [
  [/^\/$/, `${BASE} | Tours, Hotels, Transport and Travel Guide`],
  [/^\/tours\/[^/]+/, 'Tour details'],
  [/^\/tours/, 'Tours'],
  [/^\/hotels\/[^/]+/, 'Hotel details'],
  [/^\/hotels/, 'Hotels'],
  [/^\/destinations\/[^/]+/, 'Destination'],
  [/^\/destinations/, 'Destinations'],
  [/^\/transport\/[^/]+/, 'Transport details'],
  [/^\/transport/, 'Transport'],
  [/^\/restaurants\/[^/]+/, 'Restaurant'],
  [/^\/restaurants/, 'Restaurants'],
  [/^\/companies\/[^/]+/, 'Travel company'],
  [/^\/companies/, 'Travel companies'],
  [/^\/news\/[^/]+/, 'News'],
  [/^\/news/, 'News'],
  [/^\/search/, 'Search'],
  [/^\/contact/, 'Contact us'],
  [/^\/faq/, 'FAQ'],
  [/^\/about/, 'About'],
  [/^\/privacy/, 'Privacy Policy'],
  [/^\/terms/, 'Terms of Service'],
  [/^\/login/, 'Sign in'],
  [/^\/register/, 'Create an account'],
  [/^\/forgot-password/, 'Forgot password'],
  [/^\/reset-password/, 'Reset password'],
  [/^\/bookings\/[^/]+/, 'Booking details'],
  [/^\/bookings/, 'My bookings'],
  [/^\/dashboard/, 'My account'],
  [/^\/provider\/register/, 'List your business'],
  [/^\/provider\/workspace\/[^/]+\/bookings/, 'Provider bookings'],
  [/^\/provider/, 'Provider workspace'],
  [/^\/admin/, 'Admin console'],
];

export function titleFor(pathname: string): string {
  const hit = TITLES.find(([re]) => re.test(pathname));
  if (!hit) return `Page not found | ${BASE}`;
  return hit[1].startsWith(BASE) ? hit[1] : `${hit[1]} | ${BASE}`;
}

/** Sets document.title on every navigation and scrolls new pages to the top. */
export function RouteTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = titleFor(pathname);
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/** Lets a page set a specific title (e.g. the tour name) once its data loads. */
export function usePageTitle(title: string | undefined | null) {
  useEffect(() => {
    if (title) document.title = `${title} | ${BASE}`;
  }, [title]);
}
