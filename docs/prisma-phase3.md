# Phase 3 — Users/Auth + Organization identity (Prisma)

**Status:** local development only.  
**Default:** MongoDB remains the application identity database (`DATABASE_MODE=mongo`).  
**Production:** Mongo Atlas is still source of truth. Supabase / Render / Atlas were **not** modified.

## What was migrated (opt-in)

When `DATABASE_MODE=prisma` (local):

| Area | Behavior |
|------|----------|
| Signup / login / logout | Prisma `users` + existing JWT/bcrypt |
| Email verify / forgot / reset / update password | Prisma token fields + `passwordService` |
| Profile get/update / soft-delete | Prisma |
| Role on `req.user` / `restrict()` | Prisma-loaded user |
| Organization register (atomic) | Org + owner member + draft version |
| Membership / active org preference | Prisma |
| `X-Org-Context` middleware | Prisma org + member lookup |
| Provider versions + submit/approve/reject | Prisma path |
| Public org by slug / list | Approved + `visibility=public` only |

## Still Mongo (always, or until a later phase)

- Admin factory user list/get/delete (`getAllUsers` / `getUser` / `deleteUser`)
- Bookings, payments, refunds, inventory, departures
- Catalog writes; org-scoped tours/hotels content mutations that still use Mongoose models for inventory
- Approval reconciliation background jobs (`approvalReconciliationService`) — Mongo-only
- Stats counters that query `User.countDocuments`
- Default API when `DATABASE_MODE` unset/`mongo`

Phase 2 catalog reads remain controlled separately by `CATALOG_DB`.

## Architecture

```
Controller / middleware
  → getUserRepository() / getOrganizationRepository()
       ├─ mongo (default)
       └─ prisma (DATABASE_MODE=prisma)
  → passwordService (explicit bcrypt / reset tokens)
```

Env switches (independent):

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE` | Mongo URI | Mongoose app DB |
| `DATABASE_URL` / `DIRECT_URL` | Postgres | Prisma |
| `CATALOG_DB` | `mongoose` | Phase 2 public catalog reads |
| `DATABASE_MODE` | `mongo` | Phase 3 identity |

## Auth compatibility

- bcrypt cost **12**, same as Mongoose pre-save
- JWT payload `{ id }` unchanged
- Cookie + Bearer `protect()` unchanged
- Soft-delete: Prisma queries use `active !== false` (parity with Mongo `pre(/^find/)`)
- `passwordChangedAt` still **not** set on password update (matches current Mongo app code)
- Reset tokens: raw token emailed; **SHA-256** hash stored; 10-minute expiry
- Signup role forced to `user`; production email failure deletes user; non-production auto-verifies

## Organization / approval

- Public marketplace filter unchanged: `approvalStatus=approved` AND `visibility=public` AND `approvedVersionId` set
- Unapproved / pending / rejected orgs are **never** returned by public slug/list loaders
- Register uses a Prisma **transaction** for org + owner membership + draft version
- Approve uses a transaction to sync profile + finalize request + supersede previous approved version

## API compatibility

- Routes and envelopes unchanged
- Serializers expose `_id` (24-char hex ObjectId-compatible TEXT ids)
- No frontend changes required

## Local enable

```bash
docker compose -f docker-compose.prisma.yml up -d
cd backend
# config.env: DATABASE_URL + DIRECT_URL → local Docker :5434
npm run prisma:validate
npm run prisma:generate
npm run prisma:connectivity
npm run prisma:seed
npm run prisma:phase3

# API with Prisma identity (Mongo still required for non-identity features / requireDb):
# DATABASE_MODE=prisma npm run dev
```

## Seed (idempotent, local only)

| Entity | id |
|--------|-----|
| Catalog owner | `a10000000000000000000001` |
| Catalog visitor | `a10000000000000000000002` |
| Admin | `a10000000000000000000003` |
| Org member | `a10000000000000000000004` |
| Organization | `a30000000000000000000001` |
| Draft provider version | `a30000000000000000000005` |
| Cancelled approval (non-public) | `a30000000000000000000006` |

Password: `SEED_LOCAL_PASSWORD` or default `Phase3LocalSeedOnly!x` (new users only; skipped existing rows keep prior hash).

## Tests

```bash
npm run prisma:phase3          # 31 identity checks against local PG
node scripts/run-full-test-battery.js   # Mongo default Phase 1–3
node scripts/phase4g-regression-runner.js  # Phase 4A–4I
```

## Known limitations

- Admin user CRUD via `handlerFactory(User)` remains Mongo even when `DATABASE_MODE=prisma`
- Prisma approval path does **not** run Mongo reconciliation jobs
- Cross-DB identity (user in PG, bookings in Mongo) is unsupported — keep modes consistent for full E2E
- Do **not** set `DATABASE_MODE=prisma` on Render
- Do **not** `migrate deploy` / `db push` against Supabase production from this phase

## Rollback

1. Unset `DATABASE_MODE` or set `DATABASE_MODE=mongo`
2. Restart API — all identity traffic returns to Mongoose
3. Local Postgres data can be left in place; it is unused when mode is mongo

## Next recommended phase

Bookings / payments / inventory / departures adapter (still Mongo default), or Atlas→local PG data copy for catalog+identity dry-run — **not** production cutover.
