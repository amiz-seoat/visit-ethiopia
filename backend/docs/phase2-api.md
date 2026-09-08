# Phase 2 API — Provider Verification & Version-Aware Approval

Base path: `/api/v1`

## Provider endpoints

Authentication: Bearer JWT required.

Organization context: `X-Org-Context: <organizationId>` required for org-scoped mutations (or active-org preference fallback).

### POST `/organizations/register`

- **Auth:** logged-in user
- **Body:** `{ name, providerTypes[], shortDescription?, description?, location?, contact?, slug?, verification? }`
- **Response:** `{ organization, membership, draftVersion }`
- **Errors:** `400` invalid provider type; `400` forbidden approval fields

### GET `/organizations/me`

- **Auth:** logged-in user
- **Response:** memberships with latest/approved version status

### GET `/organizations/:organizationId/workspace`

- **Auth:** org member with `org:read`
- **Response:** workspace with `latestVersion`, `approvedVersion`, `canEdit`, `isPublic`
- **Errors:** `403` context mismatch / not a member

### PATCH `/organizations/:organizationId/draft`

- **Auth:** org member with `org:write`
- **Body:** profile fields + optional `verification`
- **Response:** updated draft `version`
- **Errors:** `400` cannot edit submitted version; `400` approval fields forbidden

### PATCH `/organizations/:id` (legacy)

- Same as draft update (version-aware)

### GET `/organizations/:organizationId/versions`

- **Auth:** org member with `org:read`
- **Response:** version history (excludes verification snapshots)

### POST `/organizations/:organizationId/versions/:versionId/submit`

- **Auth:** org member with `org:submit`
- **Response:** `{ version, approvalRequest }`
- **Errors:** `400` missing verification; `400` not current draft; `400` duplicate pending request

## Admin endpoints

Authentication: Bearer JWT + `restrict('admin')`.

### GET `/organizations/admin/approvals`

- **Query:** `status` (default `pending`), `providerType`
- **Response:** approval request list

### GET `/organizations/admin/approvals/:id`

- **Response:** `{ approvalRequest, submittedVersion, currentApprovedVersion, organization, diff }`

### PATCH `/organizations/admin/approvals/:id/approve`

- **Body:** `{ adminNotes? }`
- **Response:** approved version + organization
- **Errors:** `409` stale / not pending / concurrent conflict

Statuses: `pending` → `processing` → `approved` (or rolled back to `pending` on failure). Reconciliation auto-repairs interrupted `processing` states.

### PATCH `/organizations/admin/approvals/:id/reject`

- **Body:** `{ rejectionReason, adminNotes? }` — reason required
- **Response:** rejected version; prior approved version remains public if present

### PATCH `/organizations/admin/organizations/:organizationId/suspend`

- **Body:** `{ reason? }`
- **Effect:** org hidden from public marketplace

### PATCH `/organizations/admin/organizations/:organizationId/reactivate`

- **Requires:** existing `approvedVersionId`
- **Effect:** restores public visibility

## Public endpoints

No authentication.

### GET `/organizations`

- **Response:** approved + active organizations only (data from approved snapshot)

### GET `/organizations/:slug`

- **Response:** `{ data, canonicalSlug, redirected }`
- **Errors:** `404` draft/submitted/suspended/unapproved
- **Slug redirects:** previous slugs resolve with `redirected: true`

## Security rules

- Public responses never include draft/submitted/rejected snapshots
- Verification documents and admin notes are never public
- Only admins can change approval state
- Approved version stays public while newer drafts are edited
