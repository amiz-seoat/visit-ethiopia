import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { MenuIcon, X, SearchIcon, UserIcon, LogOut, Shield, Moon, Sun } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const NAV = [
  { to: '/tours', label: 'Tours' },
  { to: '/hotels', label: 'Hotels' },
  { to: '/destinations', label: 'Destinations' },
  { to: '/transport', label: 'Transport' },
  { to: '/restaurants', label: 'Restaurants' },
  { to: '/news', label: 'News' },
];

function ThemeToggle({ className = '' }: { className?: string }) {
  const { resolved, toggle } = useTheme();
  const dark = resolved === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to night mode'}
      title={dark ? 'Light mode' : 'Night mode'}
      className={`p-2 rounded-full text-gray-600 hover:text-amber-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 ${className}`}
    >
      {dark ? <Sun size={19} /> : <Moon size={19} />}
    </button>
  );
}

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, isAuthenticated, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Close the mobile menu on navigation and on Escape; lock page scroll while it is open.
  useEffect(() => setIsMenuOpen(false), [location.pathname]);
  useEffect(() => {
    if (!isMenuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsMenuOpen(false);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isMenuOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
    setIsMenuOpen(false);
  };

  const displayName = user ? `${user.FirstName} ${user.LastName}`.trim() : '';
  const canManage = hasRole('admin', 'tour_operator', 'hotel_manager', 'transport_manager', 'guide');

  const desktopLink = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition-colors ${
      isActive ? 'text-amber-700 dark:text-amber-400' : 'text-gray-700 hover:text-amber-600 dark:text-gray-300'
    }`;
  const mobileLink = ({ isActive }: { isActive: boolean }) =>
    `text-xl font-medium ${isActive ? 'text-amber-700 dark:text-amber-400' : 'text-gray-700 dark:text-gray-200'}`;

  return (
    <header className="bg-white/95 backdrop-blur shadow-sm sticky top-0 z-50 dark:bg-gray-900/95 dark:border-b dark:border-gray-800">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-[60] focus:bg-amber-600 focus:text-white focus:px-3 focus:py-2 focus:rounded"
      >
        Skip to content
      </a>
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="text-2xl font-bold text-amber-800 dark:text-amber-400" aria-label="Visit Ethiopia home">
          Visit Ethiopia
        </Link>
        <nav className="hidden lg:flex items-center space-x-6" aria-label="Main">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={desktopLink}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden lg:flex items-center space-x-3">
          <Link
            to="/search"
            className="p-2 rounded-full text-gray-600 hover:text-amber-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            aria-label="Search"
            title="Search"
          >
            <SearchIcon size={19} />
          </Link>
          <ThemeToggle />
          {isAuthenticated ? (
            <>
              {canManage && (
                <Link
                  to="/admin"
                  className="flex items-center text-sm font-medium text-amber-800 hover:text-amber-600 dark:text-amber-400"
                  title="Management console"
                >
                  <Shield size={18} className="mr-1" />
                  <span>Admin</span>
                </Link>
              )}
              <Link
                to="/dashboard"
                className="flex items-center text-sm font-medium text-gray-700 hover:text-amber-600 dark:text-gray-200"
                title="My trips and account"
              >
                <UserIcon size={19} className="mr-1" />
                <span className="max-w-[10rem] truncate">{displayName || 'My account'}</span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Sign out"
                title="Sign out"
                className="p-2 rounded-full text-gray-500 hover:text-red-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm font-medium text-gray-700 hover:text-amber-600 dark:text-gray-200">
                Sign in
              </Link>
              <Link
                to="/register"
                className="text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-md"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
        <div className="flex items-center lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            className="p-2 text-gray-700 dark:text-gray-200"
            onClick={() => setIsMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
          >
            <MenuIcon size={24} />
          </button>
        </div>
      </div>
      {isMenuOpen && (
        <div
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="lg:hidden bg-white dark:bg-gray-950 fixed inset-0 z-50 overflow-y-auto"
        >
          <div className="p-4 flex justify-between items-center">
            <span className="text-xl font-bold text-amber-800 dark:text-amber-400">Visit Ethiopia</span>
            <button type="button" onClick={() => setIsMenuOpen(false)} aria-label="Close menu" className="p-2 text-gray-700 dark:text-gray-200">
              <X size={24} />
            </button>
          </div>
          <nav className="flex flex-col items-center py-8 space-y-6" aria-label="Mobile">
            <NavLink to="/" end className={mobileLink}>
              Home
            </NavLink>
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={mobileLink}>
                {n.label}
              </NavLink>
            ))}
            <NavLink to="/search" className={mobileLink}>
              Search
            </NavLink>
            {isAuthenticated ? (
              <>
                {canManage && (
                  <Link to="/admin" className="flex items-center text-xl text-amber-800 dark:text-amber-400">
                    <Shield size={20} className="mr-2" />
                    Admin
                  </Link>
                )}
                <Link to="/dashboard" className="flex items-center text-xl text-gray-700 dark:text-gray-200">
                  <UserIcon size={20} className="mr-2" />
                  <span>{displayName || 'My account'}</span>
                </Link>
                <button type="button" onClick={handleLogout} className="flex items-center text-xl text-red-600">
                  <LogOut size={20} className="mr-2" /> Sign out
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4 pt-2">
                <Link to="/login" className="text-xl font-medium text-gray-700 dark:text-gray-200">
                  Sign in
                </Link>
                <Link to="/register" className="text-lg font-medium bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded-md">
                  Create account
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
