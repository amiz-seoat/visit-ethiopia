import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, CheckCircle, Clock, Send } from 'lucide-react';
import {
  getProviderWorkspace,
  updateOrganizationDraft,
  submitVersionForApproval,
  setActiveOrganization,
  type ProviderWorkspace,
} from '../api/organizations';
import {
  listProviderBookings,
  type ProviderBookingRow,
} from '../api/providerBookings';
import { getErrorMessage } from '../services/api';
import { PageLoader } from '../components/ui/PageStatus';
import { ProviderToursPanel } from '../components/provider/ProviderToursPanel';
import {
  bookingStatusClass,
  bookingStatusLabel,
} from '../utils/bookingHelpers';

export function ProviderWorkspacePage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const [workspace, setWorkspace] = useState<ProviderWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [transportBookings, setTransportBookings] = useState<ProviderBookingRow[]>(
    []
  );
  const [hotelBookings, setHotelBookings] = useState<ProviderBookingRow[]>([]);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError('');
    try {
      localStorage.setItem('activeOrganizationId', organizationId);
      await setActiveOrganization(organizationId);
      const data = await getProviderWorkspace(organizationId);
      setWorkspace(data);
      setShortDescription(
        (data.latestVersion?.snapshot?.shortDescription as string) || ''
      );
      setDescription((data.latestVersion?.snapshot?.description as string) || '');
      try {
        const bookings = await listProviderBookings(organizationId, {
          bookingType: 'transport',
          limit: 8,
          page: 1,
        });
        setTransportBookings(bookings.bookings);
      } catch {
        setTransportBookings([]);
      }
      try {
        const bookings = await listProviderBookings(organizationId, {
          bookingType: 'hotel',
          limit: 8,
          page: 1,
        });
        setHotelBookings(bookings.bookings);
      } catch {
        setHotelBookings([]);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load workspace'));
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!organizationId) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await updateOrganizationDraft(organizationId, {
        shortDescription,
        description,
      });
      setMessage('Draft saved');
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save draft'));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!organizationId || !workspace?.latestVersion?._id) return;
    setSubmitting(true);
    setMessage('');
    setError('');
    try {
      await submitVersionForApproval(organizationId, workspace.latestVersion._id);
      setMessage('Submitted for admin approval');
      await load();
    } catch (err) {
      setError(getErrorMessage(err, 'Submission failed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!workspace) {
    return (
      <div className="p-8 text-center text-gray-600">
        {error || 'Workspace not found'}
      </div>
    );
  }

  const { organization, latestVersion, approvedVersion, canEdit, isPublic } = workspace;
  const status = latestVersion?.status || 'draft';

  const statusBadge = () => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full text-sm">
            <CheckCircle size={14} /> Approved
          </span>
        );
      case 'submitted':
        return (
          <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-3 py-1 rounded-full text-sm">
            <Clock size={14} /> Pending review
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-3 py-1 rounded-full text-sm">
            <AlertCircle size={14} /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-gray-600 bg-gray-100 px-3 py-1 rounded-full text-sm">
            Draft
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link to="/dashboard" className="text-sm text-amber-700 hover:underline">
              ← Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">{organization.name}</h1>
            <p className="text-gray-500 text-sm">
              Version {latestVersion?.versionNumber} · {organization.providerTypes.join(', ')}
            </p>
          </div>
          {statusBadge()}
        </div>

        {isPublic && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm">
            Your approved profile is publicly visible.
            {approvedVersion && ` (v${approvedVersion.versionNumber})`}
          </div>
        )}

        {latestVersion?.rejectionReason && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
            <strong>Rejection reason:</strong> {latestVersion.rejectionReason}
          </div>
        )}

        {message && (
          <div className="bg-amber-50 text-amber-800 px-4 py-3 rounded text-sm">{message}</div>
        )}
        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded text-sm">{error}</div>
        )}

        {workspace.summary && (
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="font-semibold text-gray-900 mb-3">Workspace summary</h2>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <dt className="text-gray-500">Members</dt>
                <dd className="font-medium text-gray-900">{workspace.summary.memberCount}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Tours</dt>
                <dd className="font-medium text-gray-900">{workspace.summary.tourCount}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Hotels</dt>
                <dd className="font-medium text-gray-900">{workspace.summary.hotelCount}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Transports</dt>
                <dd className="font-medium text-gray-900">{workspace.summary.transportCount}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Pending approvals</dt>
                <dd className="font-medium text-gray-900">{workspace.summary.pendingApprovalCount}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Open departures</dt>
                <dd className="font-medium text-gray-900">{workspace.summary.openDepartureCount}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Bookings</dt>
                <dd className="font-medium text-gray-900">{workspace.summary.bookingCount}</dd>
              </div>
              {(workspace.summary.activeRoomTypeCount != null ||
                workspace.summary.inventoryDayCount != null) && (
                <>
                  <div>
                    <dt className="text-gray-500">Active room types</dt>
                    <dd className="font-medium text-gray-900">
                      {workspace.summary.activeRoomTypeCount ?? 0}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Inventory days</dt>
                    <dd className="font-medium text-gray-900">
                      {workspace.summary.inventoryDayCount ?? 0}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Low availability days</dt>
                    <dd className="font-medium text-gray-900">
                      {workspace.summary.lowAvailabilityDayCount ?? 0}
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </div>
        )}

        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-gray-900">Company profile (draft)</h2>
            <Link
              to={`/provider/workspace/${organizationId}/bookings`}
              className="text-sm font-medium text-amber-700 underline"
            >
              View bookings
            </Link>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Short description</label>
            <input
              className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-50"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-50"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canEdit}
            />
          </div>

          {latestVersion?.requiresReapproval && (
            <p className="text-amber-700 text-sm">
              Changes include fields that require admin re-approval:{' '}
              {latestVersion.changedFields?.join(', ')}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            {canEdit && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save draft'}
              </button>
            )}
            {canEdit && latestVersion?._id && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
              >
                <Send size={16} />
                {submitting ? 'Submitting…' : 'Submit for approval'}
              </button>
            )}
          </div>
        </div>

        {(workspace.summary?.hotelCount ?? 0) > 0 || hotelBookings.length > 0 ? (
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h2 className="font-semibold text-gray-900">Hotel bookings</h2>
              <Link
                to={`/provider/workspace/${organizationId}/bookings?bookingType=hotel`}
                className="text-sm font-medium text-amber-700 underline"
              >
                Open hotel bookings
              </Link>
            </div>
            {hotelBookings.length === 0 ? (
              <p className="text-sm text-gray-500">No recent hotel bookings.</p>
            ) : (
              <ul className="divide-y">
                {hotelBookings.map((b) => (
                  <li
                    key={b._id}
                    className="py-3 flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <div>
                      <div className="font-medium text-gray-900">
                        {b.reference} · {b.hotel?.name || 'Hotel'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {b.stay?.checkIn || '—'} → {b.stay?.checkOut || '—'}
                        {b.stay?.roomTypeName || b.stay?.roomTypeKey
                          ? ` · ${b.stay?.roomTypeName || b.stay?.roomTypeKey}`
                          : ''}
                        {b.quantity != null ? ` · ${b.quantity} rooms` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded capitalize ${bookingStatusClass(
                          b.status
                        )}`}
                      >
                        {bookingStatusLabel(b.status)}
                      </span>
                      <span className="text-xs text-gray-500 capitalize">
                        {(b.fulfillmentStatus || 'pending').replace(/_/g, ' ')}
                      </span>
                      <Link
                        to={`/provider/workspace/${organizationId}/bookings/${b._id}`}
                        className="text-amber-700 font-medium hover:underline"
                      >
                        Manage
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {(workspace.summary?.transportCount ?? 0) > 0 ||
        transportBookings.length > 0 ? (
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h2 className="font-semibold text-gray-900">Transport bookings</h2>
              <Link
                to={`/provider/workspace/${organizationId}/bookings?bookingType=transport`}
                className="text-sm font-medium text-amber-700 underline"
              >
                Open transport bookings
              </Link>
            </div>
            {transportBookings.length === 0 ? (
              <p className="text-sm text-gray-500">No recent transport bookings.</p>
            ) : (
              <ul className="divide-y">
                {transportBookings.map((b) => (
                  <li
                    key={b._id}
                    className="py-3 flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <div>
                      <div className="font-medium text-gray-900">
                        {b.reference} · {b.transport?.name || 'Transport'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {b.route?.travelDate || '—'}
                        {b.route?.from && b.route?.to
                          ? ` · ${b.route.from} → ${b.route.to}`
                          : ''}
                        {b.quantity != null ? ` · ${b.quantity} seats` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded capitalize ${bookingStatusClass(
                          b.status
                        )}`}
                      >
                        {bookingStatusLabel(b.status)}
                      </span>
                      <span className="text-xs text-gray-500 capitalize">
                        {(b.fulfillmentStatus || 'pending').replace(/_/g, ' ')}
                      </span>
                      <Link
                        to={`/provider/workspace/${organizationId}/bookings/${b._id}`}
                        className="text-amber-700 font-medium hover:underline"
                      >
                        Manage
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        <ProviderToursPanel
          organizationId={organizationId!}
          canManage={canEdit}
          isApproved={Boolean(approvedVersion)}
        />
      </div>
    </div>
  );
}
