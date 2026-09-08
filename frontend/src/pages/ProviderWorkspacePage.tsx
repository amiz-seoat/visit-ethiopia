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
import { getErrorMessage } from '../services/api';
import { PageLoader } from '../components/ui/PageStatus';
import { ProviderToursPanel } from '../components/provider/ProviderToursPanel';

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
            <Link to="/dashboard" className="text-sm text-emerald-700 hover:underline">
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
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg text-sm">
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
          <div className="bg-emerald-50 text-emerald-800 px-4 py-3 rounded text-sm">{message}</div>
        )}
        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded text-sm">{error}</div>
        )}

        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-gray-900">Company profile (draft)</h2>
            <Link
              to={`/provider/workspace/${organizationId}/bookings`}
              className="text-sm font-medium text-amber-700 underline"
            >
              View tour bookings
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
                className="flex items-center gap-2 bg-emerald-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
              >
                <Send size={16} />
                {submitting ? 'Submitting…' : 'Submit for approval'}
              </button>
            )}
          </div>
        </div>

        <ProviderToursPanel
          organizationId={organizationId!}
          canManage={canEdit}
          isApproved={Boolean(approvedVersion)}
        />
      </div>
    </div>
  );
}
