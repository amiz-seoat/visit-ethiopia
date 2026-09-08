import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  deleteUser,
  getAdminContacts,
  getAdminUsers,
  getStats,
  updateUserRole,
  type PlatformStats,
} from '../api/admin';
import { getAllBookings, updateBookingStatus } from '../api/bookings';
import { getTours, deleteTour } from '../api/tours';
import { getHotels } from '../api/hotels';
import { deleteHotel } from '../api/hotelMutations';
import { getTransports } from '../api/transports';
import { deleteTransport } from '../api/transportMutations';
import { getRestaurants } from '../api/restaurants';
import { getDestinations } from '../api/destinations';
import { getNews } from '../api/news';
import {
  approveReview,
  rejectReview,
  getPendingReviews,
  deleteReview,
} from '../api/reviews';
import { updateContactStatus } from '../api/contact';
import { AdminCreateForm } from '../components/admin/AdminCreateForm';
import { AdminApprovalsPanel } from '../components/admin/AdminApprovalsPanel';
import { PageLoader } from '../components/ui/PageStatus';
import { getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { Booking, Tour, User, UserRole } from '../types';

type CreateKind =
  | 'tour'
  | 'hotel'
  | 'transport'
  | 'restaurant'
  | 'destination'
  | 'news';

function ownerIdOf(item: { createdBy?: unknown }): string | undefined {
  const cb = item.createdBy as { _id?: string } | string | undefined;
  if (!cb) return undefined;
  if (typeof cb === 'string') return cb;
  return cb._id;
}

type AdminTab =
  | 'stats'
  | 'users'
  | 'tours'
  | 'hotels'
  | 'transport'
  | 'restaurants'
  | 'destinations'
  | 'news'
  | 'bookings'
  | 'reviews'
  | 'contacts'
  | 'approvals';

const ROLE_OPTIONS: UserRole[] = [
  'user',
  'customer',
  'admin',
  'guide',
  'tour_operator',
  'hotel_manager',
  'transport_manager',
];

export function AdminDashboardPage() {
  const { user, hasRole } = useAuth();
  const [tab, setTab] = useState<AdminTab>('stats');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState<CreateKind | null>(null);

  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [hotels, setHotels] = useState<unknown[]>([]);
  const [transports, setTransports] = useState<unknown[]>([]);
  const [restaurants, setRestaurants] = useState<unknown[]>([]);
  const [destinations, setDestinations] = useState<unknown[]>([]);
  const [news, setNews] = useState<unknown[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pendingReviews, setPendingReviews] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);

  const canManageTours = hasRole('admin', 'tour_operator', 'guide');
  const canManageHotels = hasRole('admin', 'hotel_manager');
  const canManageTransport = hasRole('admin', 'transport_manager');
  const isAdmin = hasRole('admin');
  const myId = user?._id;

  const ownsOrAdmin = useCallback(
    (item: { createdBy?: unknown }) => {
      if (isAdmin) return true;
      const oid = ownerIdOf(item);
      return Boolean(myId && oid && oid === myId);
    },
    [isAdmin, myId]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (isAdmin) {
        const [
          s,
          u,
          t,
          h,
          tr,
          r,
          d,
          n,
          b,
          pr,
          c,
        ] = await Promise.all([
          getStats(),
          getAdminUsers(),
          getTours({ limit: 50, allStatuses: true }),
          getHotels({ limit: 50, allStatuses: true }),
          getTransports({ limit: 50, allStatuses: true }),
          getRestaurants({ limit: 50 }),
          getDestinations({ limit: 50 }),
          getNews({ limit: 50 }),
          getAllBookings(),
          getPendingReviews(),
          getAdminContacts(),
        ]);
        setStats(s);
        setUsers(u);
        setTours(t.tours);
        setHotels(h.hotels);
        setTransports(tr.transports);
        setRestaurants(r.restaurants);
        setDestinations(d.destinations);
        setNews(n.articles);
        setBookings(b);
        setPendingReviews(pr);
        setContacts(c);
      } else if (canManageTours) {
        const t = await getTours({ limit: 50, allStatuses: true });
        setTours(t.tours);
        setTab('tours');
      } else if (canManageHotels) {
        const h = await getHotels({ limit: 50, allStatuses: true });
        setHotels(h.hotels);
        setTab('hotels');
      } else if (canManageTransport) {
        const tr = await getTransports({ limit: 50, allStatuses: true });
        setTransports(tr.transports);
        setTab('transport');
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load admin data'));
    } finally {
      setLoading(false);
    }
  }, [isAdmin, canManageTours, canManageHotels, canManageTransport]);

  useEffect(() => {
    load();
  }, [load]);

  const tabs: { id: AdminTab; label: string; show: boolean }[] = [
    { id: 'stats', label: 'Statistics', show: isAdmin },
    { id: 'users', label: 'Users', show: isAdmin },
    { id: 'tours', label: 'Tours', show: isAdmin || canManageTours },
    { id: 'hotels', label: 'Hotels', show: isAdmin || canManageHotels },
    { id: 'transport', label: 'Transport', show: isAdmin || canManageTransport },
    { id: 'restaurants', label: 'Restaurants', show: isAdmin },
    { id: 'destinations', label: 'Destinations', show: isAdmin },
    { id: 'news', label: 'News', show: isAdmin },
    { id: 'bookings', label: 'Bookings', show: isAdmin },
    { id: 'reviews', label: 'Reviews', show: isAdmin },
    { id: 'contacts', label: 'Contacts', show: isAdmin },
    { id: 'approvals', label: 'Provider approvals', show: isAdmin },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-amber-900 text-white py-8">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold">Management Console</h1>
          <p className="text-amber-100 mt-1">
            Signed in as {user?.FirstName} {user?.LastName} ({user?.role})
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          <aside className="lg:w-56 shrink-0">
            <nav className="bg-white rounded-lg shadow-sm p-2 space-y-1">
              {tabs
                .filter((t) => t.show)
                .map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm ${
                      tab === t.id
                        ? 'bg-amber-100 text-amber-900 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              <Link
                to="/dashboard"
                className="block px-3 py-2 text-sm text-gray-500 hover:text-amber-700"
              >
                ← User dashboard
              </Link>
            </nav>
          </aside>

          <main className="flex-1 bg-white rounded-lg shadow-sm p-6 min-h-[400px]">
            {message && (
              <div className="mb-4 text-sm text-green-700 bg-green-50 p-3 rounded">
                {message}
              </div>
            )}
            {error && (
              <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded">
                {error}
              </div>
            )}
            {loading ? (
              <PageLoader message="Loading management data..." />
            ) : (
              <>
                {tab === 'stats' && stats && (
                  <div>
                    <h2 className="text-xl font-bold mb-4">Platform Statistics</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <StatCard label="Users" value={stats.users.total} />
                      <StatCard label="Tours" value={stats.tours.total} />
                      <StatCard label="Hotels" value={stats.hotels.total} />
                      <StatCard label="Bookings" value={stats.bookings.total} />
                      <StatCard label="Pending bookings" value={stats.bookings.pending} />
                      <StatCard label="Pending reviews" value={stats.reviews.pending} />
                      <StatCard label="New contacts" value={stats.contacts.new} />
                      <StatCard label="Destinations" value={stats.destinations.total} />
                    </div>
                  </div>
                )}

                {tab === 'users' && (
                  <div>
                    <h2 className="text-xl font-bold mb-4">Users</h2>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left border-b">
                            <th className="py-2">Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((u) => (
                            <tr key={u._id} className="border-b">
                              <td className="py-2">
                                {u.FirstName} {u.LastName}
                              </td>
                              <td>{u.email}</td>
                              <td>
                                <select
                                  className="border rounded px-2 py-1"
                                  value={u.role}
                                  onChange={async (e) => {
                                    try {
                                      await updateUserRole(u._id, e.target.value);
                                      setMessage(`Updated role for ${u.email}`);
                                      load();
                                    } catch (err) {
                                      setError(getErrorMessage(err));
                                    }
                                  }}
                                >
                                  {ROLE_OPTIONS.map((role) => (
                                    <option key={role} value={role}>
                                      {role}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="text-right">
                                <button
                                  className="text-red-600 text-xs"
                                  onClick={async () => {
                                    if (!confirm(`Delete ${u.email}?`)) return;
                                    try {
                                      await deleteUser(u._id);
                                      setMessage('User deleted');
                                      load();
                                    } catch (err) {
                                      setError(getErrorMessage(err));
                                    }
                                  }}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {tab === 'tours' && (
                  <div>
                    {!creating && canManageTours && (
                      <button
                        type="button"
                        className="mb-3 text-sm bg-amber-600 text-white px-3 py-1.5 rounded-md"
                        onClick={() => setCreating('tour')}
                      >
                        + Create tour
                      </button>
                    )}
                    {creating === 'tour' && (
                      <AdminCreateForm
                        kind="tour"
                        onCancel={() => setCreating(null)}
                        onCreated={() => {
                          setCreating(null);
                          setMessage('Tour created');
                          load();
                        }}
                      />
                    )}
                    <ResourceList
                      title="Tours"
                      items={tours
                        .filter((t) => isAdmin || ownsOrAdmin(t))
                        .map((t) => ({
                          id: t._id,
                          label: t.title,
                          meta: `${t.price} ETB · ${t.status}`,
                          href: `/tours/${t._id}`,
                        }))}
                      onDelete={
                        canManageTours
                          ? async (id) => {
                              try {
                                await deleteTour(id);
                                setMessage('Tour deleted');
                                load();
                              } catch (err) {
                                setError(getErrorMessage(err));
                              }
                            }
                          : undefined
                      }
                    />
                  </div>
                )}

                {tab === 'hotels' && (
                  <div>
                    {!creating && canManageHotels && (
                      <button
                        type="button"
                        className="mb-3 text-sm bg-amber-600 text-white px-3 py-1.5 rounded-md"
                        onClick={() => setCreating('hotel')}
                      >
                        + Create hotel
                      </button>
                    )}
                    {creating === 'hotel' && (
                      <AdminCreateForm
                        kind="hotel"
                        onCancel={() => setCreating(null)}
                        onCreated={() => {
                          setCreating(null);
                          setMessage('Hotel created');
                          load();
                        }}
                      />
                    )}
                    <ResourceList
                      title="Hotels"
                      items={(hotels as { _id: string; name: string; status?: string; createdBy?: unknown }[])
                        .filter((h) => isAdmin || ownsOrAdmin(h))
                        .map((h) => ({
                          id: h._id,
                          label: h.name,
                          meta: h.status,
                          href: `/hotels/${h._id}`,
                        }))}
                      onDelete={
                        canManageHotels
                          ? async (id) => {
                              try {
                                await deleteHotel(id);
                                setMessage('Hotel deleted');
                                load();
                              } catch (err) {
                                setError(getErrorMessage(err));
                              }
                            }
                          : undefined
                      }
                    />
                  </div>
                )}

                {tab === 'transport' && (
                  <div>
                    {!creating && canManageTransport && (
                      <button
                        type="button"
                        className="mb-3 text-sm bg-amber-600 text-white px-3 py-1.5 rounded-md"
                        onClick={() => setCreating('transport')}
                      >
                        + Create transport
                      </button>
                    )}
                    {creating === 'transport' && (
                      <AdminCreateForm
                        kind="transport"
                        onCancel={() => setCreating(null)}
                        onCreated={() => {
                          setCreating(null);
                          setMessage('Transport created');
                          load();
                        }}
                      />
                    )}
                    <ResourceList
                      title="Transport"
                      items={(transports as { _id: string; name: string; type?: string; createdBy?: unknown }[])
                        .filter((t) => isAdmin || ownsOrAdmin(t))
                        .map((t) => ({
                          id: t._id,
                          label: t.name,
                          meta: t.type,
                          href: `/transport/${t._id}`,
                        }))}
                      onDelete={
                        canManageTransport
                          ? async (id) => {
                              try {
                                await deleteTransport(id);
                                setMessage('Transport deleted');
                                load();
                              } catch (err) {
                                setError(getErrorMessage(err));
                              }
                            }
                          : undefined
                      }
                    />
                  </div>
                )}

                {tab === 'restaurants' && (
                  <div>
                    {!creating && isAdmin && (
                      <button
                        type="button"
                        className="mb-3 text-sm bg-amber-600 text-white px-3 py-1.5 rounded-md"
                        onClick={() => setCreating('restaurant')}
                      >
                        + Create restaurant
                      </button>
                    )}
                    {creating === 'restaurant' && (
                      <AdminCreateForm
                        kind="restaurant"
                        onCancel={() => setCreating(null)}
                        onCreated={() => {
                          setCreating(null);
                          setMessage('Restaurant created');
                          load();
                        }}
                      />
                    )}
                    <ResourceList
                      title="Restaurants"
                      items={(restaurants as { _id: string; name: string }[]).map((r) => ({
                        id: r._id,
                        label: r.name,
                        href: `/restaurants/${r._id}`,
                      }))}
                    />
                  </div>
                )}

                {tab === 'destinations' && (
                  <div>
                    {!creating && isAdmin && (
                      <button
                        type="button"
                        className="mb-3 text-sm bg-amber-600 text-white px-3 py-1.5 rounded-md"
                        onClick={() => setCreating('destination')}
                      >
                        + Create destination
                      </button>
                    )}
                    {creating === 'destination' && (
                      <AdminCreateForm
                        kind="destination"
                        onCancel={() => setCreating(null)}
                        onCreated={() => {
                          setCreating(null);
                          setMessage('Destination created');
                          load();
                        }}
                      />
                    )}
                    <ResourceList
                      title="Destinations"
                      items={(destinations as { _id: string; name: string; region?: string }[]).map(
                        (d) => ({
                          id: d._id,
                          label: d.name,
                          meta: d.region,
                          href: `/destinations/${d._id}`,
                        })
                      )}
                    />
                  </div>
                )}

                {tab === 'news' && (
                  <div>
                    {!creating && isAdmin && (
                      <button
                        type="button"
                        className="mb-3 text-sm bg-amber-600 text-white px-3 py-1.5 rounded-md"
                        onClick={() => setCreating('news')}
                      >
                        + Create news
                      </button>
                    )}
                    {creating === 'news' && (
                      <AdminCreateForm
                        kind="news"
                        onCancel={() => setCreating(null)}
                        onCreated={() => {
                          setCreating(null);
                          setMessage('News article created');
                          load();
                        }}
                      />
                    )}
                    <ResourceList
                      title="News"
                      items={(news as { _id: string; title: string }[]).map((n) => ({
                        id: n._id,
                        label: n.title,
                        href: `/news/${n._id}`,
                      }))}
                    />
                  </div>
                )}

                {tab === 'bookings' && (
                  <div>
                    <h2 className="text-xl font-bold mb-4">Bookings</h2>
                    <div className="space-y-3">
                      {bookings.map((b) => (
                        <div
                          key={b._id}
                          className="border rounded-lg p-3 flex flex-wrap items-center justify-between gap-2"
                        >
                          <div>
                            <p className="font-medium capitalize">
                              {b.bookingType} · {b.status}
                            </p>
                            <p className="text-sm text-gray-600">
                              {b.contactInfo?.fullName} ·{' '}
                              {b.payment?.amount?.toLocaleString()}{' '}
                              {b.payment?.currency || 'ETB'}
                            </p>
                          </div>
                          <select
                            className="border rounded px-2 py-1 text-sm"
                            value={b.status || 'pending'}
                            onChange={async (e) => {
                              try {
                                await updateBookingStatus(b._id, e.target.value);
                                setMessage('Booking status updated');
                                load();
                              } catch (err) {
                                setError(getErrorMessage(err));
                              }
                            }}
                          >
                            {['pending', 'confirmed', 'cancelled', 'completed'].map(
                              (s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              )
                            )}
                          </select>
                        </div>
                      ))}
                      {!bookings.length && (
                        <p className="text-gray-500">No bookings yet.</p>
                      )}
                    </div>
                  </div>
                )}

                {tab === 'reviews' && (
                  <div>
                    <h2 className="text-xl font-bold mb-4">Pending Reviews</h2>
                    <div className="space-y-3">
                      {pendingReviews.map((r) => (
                        <div key={r._id} className="border rounded-lg p-3">
                          <p className="font-medium">
                            {r.itemType} · {r.rating}/5 · {r.title || 'Untitled'}
                          </p>
                          <p className="text-sm text-gray-600 mb-2">{r.comment}</p>
                          <div className="flex gap-2">
                            <button
                              className="text-sm bg-green-600 text-white px-3 py-1 rounded"
                              onClick={async () => {
                                try {
                                  await approveReview(r._id);
                                  setMessage('Review approved');
                                  load();
                                } catch (err) {
                                  setError(getErrorMessage(err));
                                }
                              }}
                            >
                              Approve
                            </button>
                            <button
                              className="text-sm bg-amber-700 text-white px-3 py-1 rounded"
                              onClick={async () => {
                                try {
                                  await rejectReview(r._id);
                                  setMessage('Review rejected');
                                  load();
                                } catch (err) {
                                  setError(getErrorMessage(err));
                                }
                              }}
                            >
                              Reject
                            </button>
                            <button
                              className="text-sm text-red-600 px-3 py-1"
                              onClick={async () => {
                                try {
                                  await deleteReview(r._id);
                                  setMessage('Review deleted');
                                  load();
                                } catch (err) {
                                  setError(getErrorMessage(err));
                                }
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                      {!pendingReviews.length && (
                        <p className="text-gray-500">No pending reviews.</p>
                      )}
                    </div>
                  </div>
                )}

                {tab === 'contacts' && (
                  <div>
                    <h2 className="text-xl font-bold mb-4">Contact Inquiries</h2>
                    <div className="space-y-3">
                      {contacts.map((c) => (
                        <div key={c._id} className="border rounded-lg p-3">
                          <p className="font-medium">
                            {c.subject} · {c.status}
                          </p>
                          <p className="text-sm text-gray-600">
                            {c.name} &lt;{c.email}&gt;
                          </p>
                          <p className="text-sm mt-1 mb-2">{c.message}</p>
                          <select
                            className="border rounded px-2 py-1 text-sm"
                            value={c.status || 'new'}
                            onChange={async (e) => {
                              try {
                                await updateContactStatus(c._id, e.target.value);
                                setMessage('Contact status updated');
                                load();
                              } catch (err) {
                                setError(getErrorMessage(err));
                              }
                            }}
                          >
                            {['new', 'in_progress', 'resolved', 'spam'].map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                      {!contacts.length && (
                        <p className="text-gray-500">No inquiries yet.</p>
                      )}
                    </div>
                  </div>
                )}

                {tab === 'approvals' && isAdmin && <AdminApprovalsPanel />}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-amber-50 rounded-lg p-4">
      <div className="text-2xl font-bold text-amber-800">{value}</div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  );
}

function ResourceList({
  title,
  items,
  onDelete,
}: {
  title: string;
  items: { id: string; label: string; meta?: string; href?: string }[];
  onDelete?: (id: string) => Promise<void>;
}) {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between border rounded-lg px-3 py-2"
          >
            <div>
              {item.href ? (
                <Link to={item.href} className="font-medium text-amber-800 hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span className="font-medium">{item.label}</span>
              )}
              {item.meta && (
                <span className="text-sm text-gray-500 ml-2">{item.meta}</span>
              )}
            </div>
            {onDelete && (
              <button
                className="text-xs text-red-600"
                onClick={async () => {
                  if (!confirm('Delete this item?')) return;
                  await onDelete(item.id);
                }}
              >
                Delete
              </button>
            )}
          </div>
        ))}
        {!items.length && <p className="text-gray-500">No items found.</p>}
      </div>
    </div>
  );
}
