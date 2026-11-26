# Provider Workspace Foundation

Prisma-first provider organization workspace: dashboard summary, organization-scoped resource CMS, and ownership enforcement.

## Organization context

Provider CMS routes require:

1. Authenticated user (`Authorization: Bearer …`)
2. Active membership in the organization
3. `X-Org-Context: <organizationId>` matching the URL `:organizationId`
4. The relevant organization permission (see matrix below)

If `X-Org-Context` points at an organization the user does not belong to → **403**.  
If the header and URL organization ids differ → **403** (`Organization context mismatch`).  
Platform admins may use `X-Admin-Org-Bypass: true` where existing middleware allows it.

Do **not** introduce a second org/role system. Roles and permissions come from `OrganizationMember` + `organizationPermissions.js`.

## Permission matrix (derived from code)

Source of truth:

- `memberHasPermission` — **owner** and **admin** bypass all permission checks
- Manager / staff / viewer — only explicit `member.permissions[]`
- Owner default packs from `permissionsForProviderTypes(providerTypes)`
- Resource create also gates on `organization.providerTypes`

| Action | Owner | Org Admin | Manager\* | Staff\* | Viewer\* |
|---|---|---|---|---|---|
| View organization / workspace (`org:read`) | yes | yes | if granted | if granted | if granted |
| Edit org draft (`org:write`) | yes | yes | if granted | if granted | if granted |
| Submit for approval (`org:submit`) | yes (default pack) | yes | if granted | if granted | if granted |
| View tours (`tours:read`) | yes (travel_company) | yes | if granted | if granted | if granted |
| Create/update/publish tours (`tours:write`) | yes (travel_company) | yes | if granted | if granted | no by default |
| View hotels (`hotels:read`) | yes (hotel) | yes | if granted | if granted | if granted |
| Create/update/delete hotels (`hotels:write`) | yes (hotel) | yes | if granted | if granted | no by default |
| View transports (`tour_buses:read` **or** `bus:read`) | yes (bus provider types) | yes | if granted | if granted | if granted |
| Create/update/delete transports (`tour_buses:write` **or** `bus:write`) | yes | yes | if granted | if granted | no by default |

\*Non-owner/admin members only succeed when the listed permission string is present on the membership. Defaults are **not** auto-granted for staff/viewer.

Provider-type gates (in addition to permissions):

- Tours CMS → `providerTypes` includes `travel_company`
- Hotels CMS → `providerTypes` includes `hotel`
- Transports CMS → `tour_bus_provider` or `bus_company`

## Dashboard endpoint

**Reuse (do not duplicate):**

`GET /api/v1/organizations/:organizationId/workspace`

Requires `org:read` + matching `X-Org-Context`.

Response (existing shape) plus optional `summary`:

```json
{
  "organization": { "...": "stripped private fields" },
  "latestVersion": { "...": "..." },
  "approvedVersion": { "...": "..." },
  "canEdit": true,
  "isPublic": false,
  "summary": {
    "memberCount": 0,
    "tourCount": 0,
    "hotelCount": 0,
    "transportCount": 0,
    "pendingApprovalCount": 0,
    "openDepartureCount": 0,
    "bookingCount": 0
  }
}
```

Counts are computed only for the validated organization id (Prisma in `DATABASE_MODE=prisma`).

## Resource scoping

| Resource | List / mutate |
|---|---|
| Tours | `GET|POST /organizations/:organizationId/tours`, `GET|PATCH …/tours/:id`, publish/unpublish/archive |
| Hotels | `GET|POST /organizations/:organizationId/hotels`, `GET|PATCH|DELETE …/hotels/:id` |
| Transports | `GET|POST /organizations/:organizationId/transports`, `GET|PATCH|DELETE …/transports/:id` |

Server-side rules:

- `organizationId` is taken from validated org context, **never** trusted from the client body
- Cross-org resource id → **403**
- Missing resource → **404**

Platform routes (`/hotels`, `/transports`, `/tours`) keep existing admin/manager + `createdBy` ownership behavior.

## Public visibility boundary

- Organization marketplace profiles remain approval/visibility gated (`approvalStatus=approved` + `visibility=public` + approved version)
- Org-created hotels/transports default to **`draft`**
- Public `GET /hotels` and `GET /transports` exclude `draft` unless `?status=` is explicitly requested
- Marketplace tours continue to use existing public/org visibility services (draft/unpublished stay private)

## Security rules (checklist)

1. Membership required for org context
2. Header/URL org must match
3. Permission strings enforced for non-owner/admin
4. Provider type must match resource kind
5. Client cannot reassign `organizationId` on create/update
6. Draft catalog items do not appear in default public hotel/transport lists

## Tests

```bash
cd backend
npm run prisma:workspace
```

Also keep green:

- `npm run prisma:validate`
- `npm run prisma:phase3` … `prisma:phase6`
- `npm run prisma:ownership`
- Mongo regression battery / Phase 4A–4I / frontend tests (as in project QA)

## Frontend

Minimal: `ProviderWorkspace` type accepts optional `summary`; workspace page shows summary counts when present. No large dashboard UI in this phase.
