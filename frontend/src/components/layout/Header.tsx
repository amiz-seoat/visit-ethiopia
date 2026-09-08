import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MenuIcon, X, SearchIcon, UserIcon, LogOut, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, isAuthenticated, logout, hasRole } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
    setIsMenuOpen(false);
  };

  const displayName = user ? `${user.FirstName} ${user.LastName}` : '';
  const canManage = hasRole(
    'admin',
    'tour_operator',
    'hotel_manager',
    'transport_manager',
    'guide'
  );

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center">
          <Link to="/" className="text-2xl font-bold text-amber-800">
            Visit Ethiopia
          </Link>
        </div>
        <nav className="hidden md:flex items-center space-x-6">
          <Link to="/tours" className="text-gray-700 hover:text-amber-600">
            Tours
          </Link>
          <Link to="/hotels" className="text-gray-700 hover:text-amber-600">
            Hotels
          </Link>
          <Link to="/destinations" className="text-gray-700 hover:text-amber-600">
            Destinations
          </Link>
          <Link to="/transport" className="text-gray-700 hover:text-amber-600">
            Transport
          </Link>
          <Link to="/restaurants" className="text-gray-700 hover:text-amber-600">
            Restaurants
          </Link>
          <Link to="/news" className="text-gray-700 hover:text-amber-600">
            News
          </Link>
        </nav>
        <div className="hidden md:flex items-center space-x-4">
          <Link to="/search" className="text-gray-700 hover:text-amber-600" title="Search">
            <SearchIcon size={20} />
          </Link>
          {isAuthenticated ? (
            <>
              {canManage && (
                <Link
                  to="/admin"
                  className="flex items-center text-amber-800 hover:text-amber-600"
                  title="Management"
                >
                  <Shield size={18} className="mr-1" />
                  <span>Admin</span>
                </Link>
              )}
              <Link
                to="/dashboard"
                className="flex items-center text-gray-700 hover:text-amber-600"
              >
                <UserIcon size={20} className="mr-1" />
                <span>{displayName || 'Dashboard'}</span>
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center text-gray-500 hover:text-red-600"
              >
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="flex items-center text-gray-700 hover:text-amber-600"
            >
              <UserIcon size={20} className="mr-1" />
              <span>Sign In</span>
            </Link>
          )}
        </div>
        <button
          className="md:hidden text-gray-700"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <MenuIcon size={24} />
        </button>
      </div>
      {isMenuOpen && (
        <div className="md:hidden bg-white fixed inset-0 z-50">
          <div className="p-4 flex justify-end">
            <button onClick={() => setIsMenuOpen(false)}>
              <X size={24} />
            </button>
          </div>
          <div className="flex flex-col items-center py-8 space-y-6">
            <Link to="/" className="text-xl font-medium text-gray-700" onClick={() => setIsMenuOpen(false)}>
              Home
            </Link>
            <Link to="/tours" className="text-xl font-medium text-gray-700" onClick={() => setIsMenuOpen(false)}>
              Tours
            </Link>
            <Link to="/hotels" className="text-xl font-medium text-gray-700" onClick={() => setIsMenuOpen(false)}>
              Hotels
            </Link>
            <Link to="/destinations" className="text-xl font-medium text-gray-700" onClick={() => setIsMenuOpen(false)}>
              Destinations
            </Link>
            <Link to="/transport" className="text-xl font-medium text-gray-700" onClick={() => setIsMenuOpen(false)}>
              Transport
            </Link>
            <Link to="/restaurants" className="text-xl font-medium text-gray-700" onClick={() => setIsMenuOpen(false)}>
              Restaurants
            </Link>
            <Link to="/news" className="text-xl font-medium text-gray-700" onClick={() => setIsMenuOpen(false)}>
              News
            </Link>
            <Link to="/search" className="text-xl font-medium text-gray-700" onClick={() => setIsMenuOpen(false)}>
              Search
            </Link>
            {isAuthenticated ? (
              <>
                {canManage && (
                  <Link to="/admin" className="flex items-center text-amber-800" onClick={() => setIsMenuOpen(false)}>
                    <Shield size={20} className="mr-2" />
                    Admin
                  </Link>
                )}
                <Link to="/dashboard" className="flex items-center text-gray-700" onClick={() => setIsMenuOpen(false)}>
                  <UserIcon size={20} className="mr-2" />
                  <span>{displayName || 'Dashboard'}</span>
                </Link>
                <button onClick={handleLogout} className="flex items-center text-red-600">
                  <LogOut size={20} className="mr-2" /> Logout
                </button>
              </>
            ) : (
              <Link to="/login" className="flex items-center text-gray-700" onClick={() => setIsMenuOpen(false)}>
                <UserIcon size={20} className="mr-2" />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
