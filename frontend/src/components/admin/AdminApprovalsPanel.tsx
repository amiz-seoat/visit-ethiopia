import React, { useCallback, useEffect, useState } from 'react';
import {
  approveRequest,
  getApprovalDetail,
  listApprovalRequests,
  reactivateOrganization,
  rejectRequest,
  suspendOrganization,
  type ApprovalDetail,
  type ApprovalRequestSummary,
} from '../../api/approvals';
import { getErrorMessage } from '../../services/api';
import { PageLoader } from '../ui/PageStatus';

export function AdminApprovalsPanel() {
  const [requests, setRequests] = useState<ApprovalRequestSummary[]>([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [providerFilter, setProviderFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApprovalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listApprovalRequests({
        status: statusFilter,
        providerType: providerFilter || undefined,
      });
      setRequests(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load approvals'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, providerFilter]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const data = await getApprovalDetail(id);
      setDetail(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load approval detail'));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  const handleApprove = async () => {
    if (!selectedId) return;
    try {
      await approveRequest(selectedId);
      setMessage('Provider version approved');
      setSelectedId(null);
      loadList();
    } catch (err) {
      setError(getErrorMessage(err, 'Approval failed'));
    }
  };

  const handleReject = async () => {
    if (!selectedId || !rejectReason.trim()) return;
    try {
      await rejectRequest(selectedId, rejectReason.trim());
      setMessage('Provider version rejected');
      setShowReject(false);
      setRejectReason('');
      setSelectedId(null);
      loadList();
    } catch (err) {
      setError(getErrorMessage(err, 'Rejection failed'));
    }
  };

  const handleSuspend = async () => {
    if (!detail?.organization?._id) return;
    const reason = window.prompt('Suspension reason (optional):') || '';
    try {
      await suspendOrganization(detail.organization._id, reason);
      setMessage('Organization suspended');
      loadDetail(selectedId!);
    } catch (err) {
      setError(getErrorMessage(err, 'Suspend failed'));
    }
  };

  const handleReactivate = async () => {
    if (!detail?.organization?._id) return;
    try {
      await reactivateOrganization(detail.organization._id);
      setMessage('Organization reactivated');
      loadDetail(selectedId!);
    } catch (err) {
      setError(getErrorMessage(err, 'Reactivate failed'));
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Provider approvals</h2>

      {message && (
        <div className="mb-4 text-sm text-green-700 bg-green-50 p-3 rounded">{message}</div>
      )}
      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded">{error}</div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          className="border rounded px-2 py-1 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          className="border rounded px-2 py-1 text-sm"
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value)}
        >
          <option value="">All provider types</option>
          <option value="travel_company">Travel company</option>
          <option value="hotel">Hotel</option>
          <option value="tour_bus_provider">Tour bus</option>
          <option value="bus_company">Bus company</option>
        </select>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          {loading ? (
            <PageLoader message="Loading queue..." />
          ) : requests.length === 0 ? (
            <p className="text-gray-500 text-sm">No requests found.</p>
          ) : (
            <ul className="divide-y border rounded-lg">
              {requests.map((r) => (
                <li key={r._id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(r._id)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${
                      selectedId === r._id ? 'bg-amber-50' : ''
                    }`}
                  >
                    <div className="font-medium text-sm">
                      {r.organizationId?.name || 'Organization'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {r.requestType} · {r.providerTypes?.join(', ')} ·{' '}
                      {new Date(r.submittedAt).toLocaleDateString()}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border rounded-lg p-4 min-h-[300px]">
          {!selectedId ? (
            <p className="text-gray-500 text-sm">Select a request to review.</p>
          ) : detailLoading || !detail ? (
            <PageLoader message="Loading detail..." />
          ) : (
            <div className="space-y-4 text-sm">
              <div>
                <h3 className="font-semibold">
                  {detail.organization?.slug} — v
                  {detail.submittedVersion?.versionNumber}
                </h3>
                <p className="text-gray-500">
                  Status: {detail.approvalRequest.status} · Org:{' '}
                  {detail.organization?.approvalStatus}
                </p>
              </div>

              {detail.currentApprovedVersion && (
                <div className="bg-emerald-50 p-3 rounded">
                  <div className="font-medium text-emerald-900 mb-1">
                    Current approved (v{detail.currentApprovedVersion.versionNumber})
                  </div>
                  <p>{detail.currentApprovedVersion.snapshot?.name as string}</p>
                  <p className="text-gray-600">
                    {detail.currentApprovedVersion.snapshot?.shortDescription as string}
                  </p>
                </div>
              )}

              <div className="bg-amber-50 p-3 rounded">
                <div className="font-medium text-amber-900 mb-1">
                  Submitted (v{detail.submittedVersion?.versionNumber})
                </div>
                <p>{detail.submittedVersion?.snapshot?.name as string}</p>
                <p className="text-gray-600">
                  {detail.submittedVersion?.snapshot?.shortDescription as string}
                </p>
              </div>

              {detail.diff?.changedFields?.length ? (
                <div>
                  <div className="font-medium mb-1">Changed fields</div>
                  <ul className="list-disc pl-5 text-gray-700">
                    {detail.diff.changedFields.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {detail.verificationChecklist && detail.verificationChecklist.length > 0 && (
                <div>
                  <div className="font-medium mb-2">Verification checklist</div>
                  <ul className="space-y-2">
                    {detail.verificationChecklist.map((item) => (
                      <li
                        key={item.key}
                        className={`flex items-start justify-between gap-2 p-2 rounded border ${
                          item.satisfied
                            ? 'bg-emerald-50 border-emerald-200'
                            : 'bg-red-50 border-red-200'
                        }`}
                      >
                        <div>
                          <div className="font-medium text-gray-900">{item.label}</div>
                          {item.required && !item.satisfied && (
                            <div className="text-xs text-red-700 mt-0.5">Required — missing</div>
                          )}
                          {item.note && (
                            <div className="text-xs text-gray-500 mt-0.5">{item.note}</div>
                          )}
                        </div>
                        <span
                          className={`text-xs font-medium shrink-0 px-2 py-0.5 rounded ${
                            item.satisfied
                              ? 'bg-emerald-200 text-emerald-900'
                              : 'bg-red-200 text-red-900'
                          }`}
                        >
                          {item.satisfied ? 'Pass' : 'Fail'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {detail.approvalRequest.status === 'pending' && (
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleApprove}
                    className="bg-emerald-700 text-white px-4 py-2 rounded text-sm"
                  >
                    Approve version
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReject(true)}
                    className="border border-red-300 text-red-700 px-4 py-2 rounded text-sm"
                  >
                    Reject
                  </button>
                </div>
              )}

              {showReject && (
                <div className="space-y-2 pt-2 border-t">
                  <textarea
                    className="w-full border rounded p-2 text-sm"
                    rows={3}
                    placeholder="Rejection reason (required)"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleReject}
                      disabled={!rejectReason.trim()}
                      className="bg-red-600 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50"
                    >
                      Confirm reject
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowReject(false)}
                      className="text-gray-600 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {detail.organization && (
                <div className="flex gap-2 pt-2 border-t">
                  {detail.organization.approvalStatus === 'suspended' ? (
                    <button
                      type="button"
                      onClick={handleReactivate}
                      className="text-sm text-emerald-700 underline"
                    >
                      Reactivate organization
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSuspend}
                      className="text-sm text-red-600 underline"
                    >
                      Suspend organization
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
