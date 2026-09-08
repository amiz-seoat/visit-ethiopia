import api from '../services/api';

export type ProviderType =
  | 'travel_company'
  | 'hotel'
  | 'tour_bus_provider'
  | 'bus_company';

export interface ProviderVerification {
  legalName?: string;
  registrationNumber?: string;
  taxId?: string;
  licenseType?: string;
  licenseNumber?: string;
  licenseExpiry?: string;
  responsiblePerson?: {
    name?: string;
    title?: string;
    phone?: string;
    email?: string;
    idDocumentUrl?: string;
  };
  businessDocuments?: Array<{
    type: string;
    url: string;
    status?: string;
  }>;
}

export interface Organization {
  _id: string;
  slug: string;
  name: string;
  providerTypes: ProviderType[];
  approvalStatus: string;
  visibility: string;
  shortDescription?: string;
  description?: string;
}

export interface ProviderVersionSummary {
  _id: string;
  versionNumber: number;
  status: string;
  snapshot?: Record<string, unknown>;
  changedFields?: string[];
  requiresReapproval?: boolean;
  submittedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

export interface ProviderWorkspace {
  organization: Organization;
  latestVersion: ProviderVersionSummary | null;
  approvedVersion: ProviderVersionSummary | null;
  canEdit: boolean;
  isPublic: boolean;
}

function orgHeaders(organizationId: string) {
  return { headers: { 'X-Org-Context': organizationId } };
}

export async function registerOrganization(payload: {
  name: string;
  providerTypes: ProviderType[];
  shortDescription?: string;
  description?: string;
  verification?: ProviderVerification;
}) {
  const { data } = await api.post('/organizations/register', payload);
  return data.data as {
    organization: Organization;
    membership: unknown;
    draftVersion: { _id: string; versionNumber: number; status: string };
  };
}

export async function getMyOrganizations() {
  const { data } = await api.get('/organizations/me');
  return data.data.memberships as Array<{
    organizationId: Organization;
    orgRole: string;
    latestVersionStatus?: string;
    approvedVersionNumber?: number;
  }>;
}

export async function getProviderWorkspace(organizationId: string) {
  const { data } = await api.get(
    `/organizations/${organizationId}/workspace`,
    orgHeaders(organizationId)
  );
  return data.data as ProviderWorkspace;
}

export async function updateOrganizationDraft(
  organizationId: string,
  payload: Record<string, unknown>
) {
  const { data } = await api.patch(
    `/organizations/${organizationId}/draft`,
    payload,
    orgHeaders(organizationId)
  );
  return data.data.version as ProviderVersionSummary;
}

export async function submitVersionForApproval(
  organizationId: string,
  versionId: string
) {
  const { data } = await api.post(
    `/organizations/${organizationId}/versions/${versionId}/submit`,
    {},
    orgHeaders(organizationId)
  );
  return data.data as {
    version: ProviderVersionSummary;
    approvalRequest: { _id: string; status: string };
  };
}

export async function listOrganizationVersions(organizationId: string) {
  const { data } = await api.get(
    `/organizations/${organizationId}/versions`,
    orgHeaders(organizationId)
  );
  return data.data.versions as ProviderVersionSummary[];
}

export async function setActiveOrganization(organizationId: string) {
  const { data } = await api.post('/users/me/active-organization', {
    organizationId,
  });
  return data.data;
}

export async function listPublicOrganizations() {
  const { data } = await api.get('/organizations');
  return data.data.data as Organization[];
}
