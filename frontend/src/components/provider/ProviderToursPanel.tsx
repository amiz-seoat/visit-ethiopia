import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Archive, Eye, EyeOff, Calendar } from 'lucide-react';
import {
  listOrganizationTours,
  createOrganizationTour,
  publishOrganizationTour,
  unpublishOrganizationTour,
  archiveOrganizationTour,
  listTourDepartures,
  createTourDeparture,
  type MarketplaceTour,
  type TourDeparture,
} from '../../api/organizationTours';
import { getErrorMessage } from '../../services/api';

interface Props {
  organizationId: string;
  canManage: boolean;
  isApproved: boolean;
}

const emptyTourForm = {
  title: '',
  shortDescription: '',
  description: '',
  price: 500,
  coverImage: 'https://images.unsplash.com/photo-1518341223789-51e3a61f5dc6',
  durationDays: 3,
  durationNights: 2,
  destinations: 'Lalibela',
  difficulty: 'moderate',
  maxGroupSize: 12,
};

export function ProviderToursPanel({ organizationId, canManage, isApproved }: Props) {
  const [tours, setTours] = useState<MarketplaceTour[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyTourForm);
  const [saving, setSaving] = useState(false);
  const [selectedTour, setSelectedTour] = useState<string | null>(null);
  const [departures, setDepartures] = useState<TourDeparture[]>([]);
  const [depDate, setDepDate] = useState('');
  const [depCapacity, setDepCapacity] = useState(10);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listOrganizationTours(organizationId);
      setTours(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load tours'));
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadDepartures = async (tourId: string) => {
    setSelectedTour(tourId);
    try {
      const deps = await listTourDepartures(organizationId, tourId);
      setDepartures(deps);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load departures'));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await createOrganizationTour(organizationId, {
        title: form.title,
        shortDescription: form.shortDescription,
        description: form.description || form.shortDescription,
        price: Number(form.price),
        coverImage: form.coverImage,
        duration: {
          days: Number(form.durationDays),
          nights: Number(form.durationNights),
        },
        destinations: form.destinations.split(',').map((d) => d.trim()).filter(Boolean),
        difficulty: form.difficulty,
        maxGroupSize: Number(form.maxGroupSize),
        highlights: [],
        inclusions: [],
        exclusions: [],
      });
      setMessage('Tour draft created');
      setShowForm(false);
      setForm(emptyTourForm);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create tour'));
    } finally {
      setSaving(false);
    }
  };

  const handleLifecycle = async (
    tourId: string,
    action: 'publish' | 'unpublish' | 'archive'
  ) => {
    setError('');
    setMessage('');
    try {
      if (action === 'publish') await publishOrganizationTour(organizationId, tourId);
      if (action === 'unpublish') await unpublishOrganizationTour(organizationId, tourId);
      if (action === 'archive') await archiveOrganizationTour(organizationId, tourId);
      setMessage(`Tour ${action}ed`);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, `Failed to ${action} tour`));
    }
  };

  const handleAddDeparture = async () => {
    if (!selectedTour || !depDate) return;
    try {
      await createTourDeparture(organizationId, selectedTour, {
        departureDate: new Date(depDate).toISOString(),
        capacity: depCapacity,
        availableSpots: depCapacity,
      });
      setMessage('Departure created');
      await loadDepartures(selectedTour);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create departure'));
    }
  };

  if (!isApproved) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm">
        Tour management is available after your company is approved by admin.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Tours</h2>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 text-sm bg-emerald-700 text-white px-3 py-1.5 rounded-lg"
          >
            <Plus size={16} /> New tour
          </button>
        )}
      </div>

      {message && <div className="text-emerald-700 text-sm bg-emerald-50 px-3 py-2 rounded">{message}</div>}
      {error && <div className="text-red-700 text-sm bg-red-50 px-3 py-2 rounded">{error}</div>}

      {showForm && canManage && (
        <form onSubmit={handleCreate} className="border rounded-lg p-4 space-y-3 bg-gray-50">
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="Tour title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="Short description"
            value={form.shortDescription}
            onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
            required
          />
          <textarea
            className="w-full border rounded px-3 py-2"
            placeholder="Full description"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              className="border rounded px-3 py-2"
              placeholder="Price (ETB)"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
            />
            <input
              type="number"
              className="border rounded px-3 py-2"
              placeholder="Max group size"
              value={form.maxGroupSize}
              onChange={(e) => setForm({ ...form, maxGroupSize: Number(e.target.value) })}
            />
          </div>
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="Destinations (comma-separated)"
            value={form.destinations}
            onChange={(e) => setForm({ ...form, destinations: e.target.value })}
          />
          <button
            type="submit"
            disabled={saving}
            className="bg-emerald-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create draft'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading tours…</p>
      ) : tours.length === 0 ? (
        <p className="text-gray-500 text-sm">No tours yet. Create your first tour draft.</p>
      ) : (
        <ul className="divide-y">
          {tours.map((tour) => (
            <li key={tour._id} className="py-4 space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-gray-900">{tour.title}</p>
                  <p className="text-sm text-gray-500">
                    Status: <span className="font-medium">{tour.status || 'draft'}</span>
                    {tour.slug && (
                      <>
                        {' '}
                        ·{' '}
                        <Link to={`/tours/${tour.slug}`} className="text-emerald-700 hover:underline">
                          View public
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                {canManage && tour.status !== 'archived' && (
                  <div className="flex gap-2 flex-shrink-0">
                    {(tour.status === 'draft' || tour.status === 'unpublished') && (
                      <button
                        type="button"
                        onClick={() => handleLifecycle(tour._id, 'publish')}
                        className="text-xs flex items-center gap-1 border px-2 py-1 rounded"
                        title="Publish"
                      >
                        <Eye size={12} /> Publish
                      </button>
                    )}
                    {tour.status === 'published' && (
                      <button
                        type="button"
                        onClick={() => handleLifecycle(tour._id, 'unpublish')}
                        className="text-xs flex items-center gap-1 border px-2 py-1 rounded"
                      >
                        <EyeOff size={12} /> Unpublish
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleLifecycle(tour._id, 'archive')}
                      className="text-xs flex items-center gap-1 border px-2 py-1 rounded text-red-600"
                    >
                      <Archive size={12} /> Archive
                    </button>
                  </div>
                )}
              </div>
              {canManage && tour.status !== 'archived' && (
                <div>
                  <button
                    type="button"
                    onClick={() => loadDepartures(tour._id)}
                    className="text-xs text-emerald-700 flex items-center gap-1"
                  >
                    <Calendar size={12} /> Manage departures
                  </button>
                  {selectedTour === tour._id && (
                    <div className="mt-2 pl-4 border-l-2 border-emerald-200 space-y-2">
                      {departures.map((d) => (
                        <p key={d._id} className="text-xs text-gray-600">
                          {new Date(d.departureDate).toLocaleDateString()} — {d.availableSpots}/
                          {d.capacity} spots ({d.status})
                        </p>
                      ))}
                      <div className="flex gap-2 items-end">
                        <input
                          type="date"
                          className="border rounded px-2 py-1 text-xs"
                          value={depDate}
                          onChange={(e) => setDepDate(e.target.value)}
                        />
                        <input
                          type="number"
                          className="border rounded px-2 py-1 text-xs w-20"
                          value={depCapacity}
                          onChange={(e) => setDepCapacity(Number(e.target.value))}
                        />
                        <button
                          type="button"
                          onClick={handleAddDeparture}
                          className="text-xs bg-gray-800 text-white px-2 py-1 rounded"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
