import api from '../services/api';

export interface ApprovalRequestSummary {
  _id: string;
  status: string;
  requestType: string;
  submittedAt: string;
  providerTypes: string[];
  changedFields?: string[];
  requiresReapproval?: boolean;
  organizationId: { _id: string; name: string; slug: string; providerTypes: string[] };
  submittedBy?: { FirstName: string; LastName: string; email: string };
}

export interface VerificationChecklistItem {
  key: string;
  label: string;
  required: boolean;
  satisfied: boolean;
  note?: string;
}

export interface ApprovalDetail {
  approvalRequest: ApprovalRequestSummary;
  submittedVersion: {
    _id: string;
    versionNumber: number;
    status: string;
    snapshot: Record<string, unknown>;
    verificationSnapshot?: Record<string, unknown>;
  };
  currentApprovedVersion?: {
    _id: string;
    versionNumber: number;
    status: string;
    snapshot: Record<string, unknown>;
  } | null;
  organization: {
    _id: string;
    slug: string;
    approvalStatus: string;
    visibility: string;
    providerTypes: string[];
  };
  diff?: {
    changedFields: string[];
    requiresReapproval: boolean;
    reapprovalFields: string[];
  };
  verificationChecklist?: VerificationChecklistItem[];
}

export async function listApprovalRequests(params?: {
  status?: string;
  providerType?: string;
}) {
  const { data } = await api.get('/organizations/admin/approvals', { params });
  return data.data.data as ApprovalRequestSummary[];
}

export async function getApprovalDetail(id: string) {
  const { data } = await api.get(`/organizations/admin/approvals/${id}`);
  return data.data as ApprovalDetail;
}

export async function approveRequest(id: string, adminNotes?: string) {
  const { data } = await api.patch(`/organizations/admin/approvals/${id}/approve`, {
    adminNotes,
  });
  return data.data;
}

export async function rejectRequest(id: string, rejectionReason: string, adminNotes?: string) {
  const { data } = await api.patch(`/organizations/admin/approvals/${id}/reject`, {
    rejectionReason,
    adminNotes,
  });
  return data.data;
}

export async function suspendOrganization(organizationId: string, reason?: string) {
  const { data } = await api.patch(
    `/organizations/admin/organizations/${organizationId}/suspend`,
    { reason }
  );
  return data.data.organization;
}

export async function reactivateOrganization(organizationId: string) {
  const { data } = await api.patch(
    `/organizations/admin/organizations/${organizationId}/reactivate`
  );
  return data.data.organization;
}
