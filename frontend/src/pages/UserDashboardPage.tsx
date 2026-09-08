import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User, Calendar, Home, CreditCard, Settings, LogOut,
  MapPin, ChevronRight, Edit,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getMyBookings, cancelBooking } from '../api/bookings';
import { updateMyProfile, updatePassword } from '../api/auth';
import { getFeaturedTours } from '../api/tours';
import { PageLoader } from '../components/ui/PageStatus';
import { getErrorMessage } from '../services/api';
import type { Booking, Tour, V2Booking } from '../types';
import {
  bookingStatusClass,
  bookingStatusLabel,
  createIdempotencyKey,
  formatMinorAmount,
  isV2Booking,
} from '../utils/bookingHelpers';

export function UserDashboardPage() {
  const { user, logout, refreshProfile, hasRole } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'bookings' | 'wishlist' | 'profile' | 'settings'>('dashboard');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [featuredTours, setFeaturedTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({ FirstName: '', LastName: '', email: '' });
  const [profileMessage, setProfileMessage] = useState('');
  const [passwordData, setPasswordData] = useState({
    passwordCurrent: '',
    password: '',
    passwordConfirm: '',
  });
  const [passwordMessage, setPasswordMessage] = useState('');

  useEffect(() => {
    if (user) {
      setProfileData({
        FirstName: user.FirstName,
        LastName: user.LastName,
        email: user.email,
      });
    }
  }, [user]);

  useEffect(() => {
    Promise.all([
      getMyBookings().catch(() => [] as Booking[]),
      getFeaturedTours().catch(() => [] as Tour[]),
    ]).then(([bookingData, tours]) => {
      setBookings(bookingData);
      setFeaturedTours(tours.slice(0, 3));
    }).finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const displayAmount = (booking: Booking) => {
    if (isV2Booking(booking)) {
      const snap = (booking as V2Booking).priceSnapshot;
      if (snap) return formatMinorAmount(snap.totalMinor, snap.currency);
    }
    if (booking.payment?.amountMinor != null) {
      return formatMinorAmount(
        booking.payment.amountMinor,
        booking.payment.currency || 'ETB'
      );
    }
    if (booking.payment?.amount != null) {
      return `${Number(booking.payment.amount).toLocaleString()} ${
        booking.payment.currency ?? 'ETB'
      }`;
    }
    return '—';
  };

  const displayDate = (booking: Booking) => {
    if (isV2Booking(booking)) {
      return formatDate((booking as V2Booking).priceSnapshot?.departureDate);
    }
    return formatDate(booking.bookingDetails?.startDate);
  };

  const handleCancelBooking = async (booking: Booking) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;
    try {
      const needsKey =
        isV2Booking(booking) &&
        (booking.status === 'confirmed' || booking.status === 'partially_refunded');
      const result = await cancelBooking(booking._id, {
        reason: 'customer_request',
        idempotencyKey: needsKey ? createIdempotencyKey('book-cancel') : undefined,
      });
      if (result.failed) {
        alert(
          'Cancellation or refund could not be completed. The booking was not marked as successfully refunded.'
        );
        return;
      }
      setBookings((prev) =>
        prev.map((b) => (b._id === booking._id ? { ...b, ...result.booking } : b))
      );
    } catch (err) {
      alert(getErrorMessage(err, 'Failed to cancel booking'));
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage('');
    try {
      await updateMyProfile(profileData);
      await refreshProfile();
      setEditingProfile(false);
      setProfileMessage('Profile updated successfully');
    } catch (err) {
      setProfileMessage(getErrorMessage(err, 'Failed to update profile'));
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage('');
    try {
      await updatePassword(passwordData);
      setPasswordMessage('Password updated successfully');
      setPasswordData({ passwordCurrent: '', password: '', passwordConfirm: '' });
    } catch (err) {
      setPasswordMessage(getErrorMessage(err, 'Failed to update password'));
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  const upcomingBookings = bookings.filter(
    (b) =>
      b.status !== 'cancelled' &&
      b.status !== 'completed' &&
      b.status !== 'failed' &&
      b.status !== 'expired'
  );
  const completedBookings = bookings.filter((b) => b.status === 'completed');

  if (!user) return <PageLoader />;

  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
    : 'Recently';

  return (
    <div className="w-full bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-1/4">
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex items-center mb-6">
                <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mr-4">
                  <User size={32} className="text-amber-700" />
                </div>
                <div>
                  <h2 className="font-bold text-xl">{user.FirstName} {user.LastName}</h2>
                  <p className="text-gray-600 text-sm capitalize">{user.role} · Member since {memberSince}</p>
                </div>
              </div>
              <nav className="space-y-1">
                {(['dashboard', 'bookings', 'profile', 'settings'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`w-full flex items-center p-3 rounded-md capitalize ${activeTab === tab ? 'bg-amber-50 text-amber-700' : 'hover:bg-gray-50'}`}
                  >
                    {tab === 'dashboard' && <Home size={20} className="mr-3" />}
                    {tab === 'bookings' && <Calendar size={20} className="mr-3" />}
                    {tab === 'profile' && <User size={20} className="mr-3" />}
                    {tab === 'settings' && <Settings size={20} className="mr-3" />}
                    {tab === 'dashboard' ? 'Dashboard' : tab === 'bookings' ? 'My Bookings' : tab === 'profile' ? 'My Profile' : 'Account Settings'}
                  </button>
                ))}
                <button onClick={handleLogout} className="w-full flex items-center p-3 rounded-md text-red-600 hover:bg-red-50">
                  <LogOut size={20} className="mr-3" />
                  <span>Logout</span>
                </button>
              </nav>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
              <h3 className="font-medium mb-1">Become a provider</h3>
              <p className="text-sm text-gray-600 mb-2">
                Register your company and submit for admin approval.
              </p>
              <Link to="/provider/register" className="text-emerald-800 font-medium text-sm underline">
                Provider registration
              </Link>
            </div>
            {hasRole('admin', 'tour_operator', 'hotel_manager', 'transport_manager', 'guide') && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <h3 className="font-medium mb-1">Management Access</h3>
                <p className="text-sm text-gray-600 mb-2">
                  You can manage platform content for your role.
                </p>
                <Link to="/admin" className="text-amber-800 font-medium text-sm underline">
                  Open management console
                </Link>
              </div>
            )}
          </div>

          <div className="lg:w-3/4">
            {loading && activeTab === 'dashboard' ? <PageLoader /> : null}

            {activeTab === 'dashboard' && (
              <div>
                <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                  <h2 className="text-xl font-bold mb-2">Welcome back, {user.FirstName}!</h2>
                  <p className="text-gray-700 mb-4">Track your trips and discover new destinations in Ethiopia.</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-amber-50 rounded-lg p-4">
                      <div className="font-bold text-2xl text-amber-700">{upcomingBookings.length}</div>
                      <div className="text-sm text-gray-600">Upcoming Trips</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="font-bold text-2xl text-green-700">{completedBookings.length}</div>
                      <div className="text-sm text-gray-600">Completed Trips</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="font-bold text-2xl text-blue-700">{user.favorites?.length ?? 0}</div>
                      <div className="text-sm text-gray-600">Saved Tours</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Upcoming Bookings</h2>
                    <button onClick={() => setActiveTab('bookings')} className="text-sm text-amber-600 font-medium flex items-center">
                      View All <ChevronRight size={16} />
                    </button>
                  </div>
                  {upcomingBookings.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Calendar size={48} className="mx-auto mb-3 text-gray-300" />
                      <p>No upcoming bookings.</p>
                      <Link to="/tours" className="text-amber-600 font-medium mt-2 inline-block">Browse tours</Link>
                    </div>
                  ) : (
                    upcomingBookings.slice(0, 2).map((booking) => (
                      <div key={booking._id} className="border rounded-lg p-4 mb-4">
                        <div className="flex justify-between gap-2">
                          <h3 className="font-bold capitalize">
                            {isV2Booking(booking)
                              ? (booking as V2Booking).priceSnapshot?.tourTitle || 'Tour booking'
                              : `${booking.bookingType} booking`}
                          </h3>
                          <span className={`text-xs px-2 py-0.5 rounded capitalize ${bookingStatusClass(booking.status)}`}>
                            {bookingStatusLabel(booking.status)}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 mt-2 space-y-1">
                          <div className="flex items-center"><Calendar size={14} className="mr-2" />{displayDate(booking)}</div>
                          <div className="flex items-center"><CreditCard size={14} className="mr-2" />{displayAmount(booking)}</div>
                          <div className="flex items-center"><MapPin size={14} className="mr-2" />{booking.bookingType}</div>
                        </div>
                        <Link to={`/bookings/${booking._id}`} className="text-sm text-amber-700 font-medium mt-2 inline-block">
                          View details
                        </Link>
                      </div>
                    ))
                  )}
                </div>

                {featuredTours.length > 0 && (
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-bold mb-4">Recommended For You</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {featuredTours.map((tour) => (
                        <div key={tour._id} className="border rounded-lg overflow-hidden">
                          <img src={tour.coverImage} alt={tour.title} className="w-full h-40 object-cover" />
                          <div className="p-3">
                            <h3 className="font-medium">{tour.title}</h3>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-amber-600 font-bold">{tour.price.toLocaleString()} ETB</span>
                              <Link to={`/tours/${tour._id}`} className="text-sm text-amber-600 font-medium">View Tour</Link>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'bookings' && (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                  <h1 className="text-2xl font-bold">My Bookings</h1>
                  <Link to="/bookings" className="text-sm text-amber-700 font-medium underline">
                    Open full bookings page
                  </Link>
                </div>
                {bookings.length === 0 ? (
                  <div className="bg-white rounded-lg shadow-md p-8 text-center">
                    <Calendar size={48} className="mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-500 mb-4">You haven&apos;t made any bookings yet.</p>
                    <Link to="/tours" className="inline-block bg-amber-600 text-white py-2 px-4 rounded">Browse Tours</Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {bookings.map((booking) => (
                      <div key={booking._id} className="bg-white rounded-lg shadow-md p-6">
                        <div className="flex justify-between mb-2 gap-2">
                          <h3 className="font-bold capitalize">
                            {isV2Booking(booking)
                              ? (booking as V2Booking).priceSnapshot?.tourTitle || 'Tour booking'
                              : `${booking.bookingType} booking`}
                          </h3>
                          <span className={`text-xs px-2 py-0.5 rounded capitalize ${bookingStatusClass(booking.status)}`}>
                            {bookingStatusLabel(booking.status)}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1 mt-3">
                          <p>Departure: {displayDate(booking)}</p>
                          <p>Amount: {displayAmount(booking)}</p>
                          <p>
                            Payment:{' '}
                            {booking.payment?.status ||
                              booking.payment?.paymentStatus ||
                              (booking.status === 'payment_pending' ? 'pending' : '—')}
                          </p>
                          <p>Ref: {booking._id.slice(-8).toUpperCase()}</p>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <Link
                            to={`/bookings/${booking._id}`}
                            className="bg-amber-600 text-white py-2 px-4 rounded text-sm"
                          >
                            View details
                          </Link>
                          {booking.status !== 'cancelled' &&
                            booking.status !== 'completed' &&
                            booking.status !== 'failed' &&
                            booking.status !== 'expired' && (
                            <button
                              onClick={() => handleCancelBooking(booking)}
                              className="border border-red-500 text-red-500 hover:bg-red-50 py-2 px-4 rounded text-sm"
                            >
                              Cancel Booking
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'profile' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h1 className="text-2xl font-bold">My Profile</h1>
                  {!editingProfile && (
                    <button onClick={() => setEditingProfile(true)} className="flex items-center text-amber-600">
                      <Edit size={18} className="mr-1" /> Edit Profile
                    </button>
                  )}
                </div>
                {profileMessage && (
                  <div className={`mb-4 p-3 rounded text-sm ${profileMessage.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {profileMessage}
                  </div>
                )}
                <div className="bg-white rounded-lg shadow-md p-6">
                  {editingProfile ? (
                    <form onSubmit={handleProfileSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">First Name</label>
                          <input type="text" value={profileData.FirstName} onChange={(e) => setProfileData({ ...profileData, FirstName: e.target.value })} className="w-full px-4 py-2 border rounded-md" required />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Last Name</label>
                          <input type="text" value={profileData.LastName} onChange={(e) => setProfileData({ ...profileData, LastName: e.target.value })} className="w-full px-4 py-2 border rounded-md" required />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium mb-1">Email</label>
                          <input type="email" value={profileData.email} onChange={(e) => setProfileData({ ...profileData, email: e.target.value })} className="w-full px-4 py-2 border rounded-md" required />
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button type="submit" className="bg-amber-600 text-white py-2 px-4 rounded">Save Changes</button>
                        <button type="button" onClick={() => setEditingProfile(false)} className="border py-2 px-4 rounded">Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4">
                      <div><h3 className="text-sm text-gray-500">First Name</h3><p>{user.FirstName}</p></div>
                      <div><h3 className="text-sm text-gray-500">Last Name</h3><p>{user.LastName}</p></div>
                      <div><h3 className="text-sm text-gray-500">Email</h3><p>{user.email}</p></div>
                      <div><h3 className="text-sm text-gray-500">Role</h3><p className="capitalize">{user.role}</p></div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div>
                <h1 className="text-2xl font-bold mb-6">Account Settings</h1>
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-bold mb-4">Change Password</h2>
                  {passwordMessage && (
                    <div className={`mb-4 p-3 rounded text-sm ${passwordMessage.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {passwordMessage}
                    </div>
                  )}
                  <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
                    <div>
                      <label className="block text-sm font-medium mb-1">Current Password</label>
                      <input type="password" value={passwordData.passwordCurrent} onChange={(e) => setPasswordData({ ...passwordData, passwordCurrent: e.target.value })} className="w-full px-4 py-2 border rounded-md" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">New Password</label>
                      <input type="password" value={passwordData.password} onChange={(e) => setPasswordData({ ...passwordData, password: e.target.value })} className="w-full px-4 py-2 border rounded-md" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Confirm New Password</label>
                      <input type="password" value={passwordData.passwordConfirm} onChange={(e) => setPasswordData({ ...passwordData, passwordConfirm: e.target.value })} className="w-full px-4 py-2 border rounded-md" required />
                    </div>
                    <button type="submit" className="bg-amber-600 text-white py-2 px-4 rounded">Update Password</button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
