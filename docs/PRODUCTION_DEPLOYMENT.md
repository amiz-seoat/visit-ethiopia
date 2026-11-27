# Production deployment

```
Browser ──► Vercel (frontend SPA)  https://visit-ethiopia-rw9b.vercel.app
   │
   └──► Render web service (Express API)  https://visit-ethiopia-api.onrender.com/api/v1
           │                     ▲
           │                     └── Chapa webhooks / callback (when Chapa keys are set)
           └──► Neon PostgreSQL (project "visit-ethiopia", branch "production", AWS us-west-2)
```

All three services are on free tiers. Nothing in this setup incurs charges.

## Current state (2026-11-27)

| Component | Status |
|---|---|
| Neon database | ✅ Created. All 7 Prisma migrations applied. Demo marketplace seeded: 5 destinations, 3 approved providers, 4 tours with 32 departures, 3 hotels with 120 days of room inventory, 1 transport operator with 3 routes and 90 days of seat inventory. |
| Render API (`visit-ethiopia-api`) | ⚠️ Blueprint service exists, but deploys **cannot succeed until `DATABASE_URL` and `DIRECT_URL` are entered** (see step 2). Until then the API times out. |
| Vercel frontend | ✅ Deployed from `main`, SPA deep links return 200. It calls the Render API through the committed `frontend/.env.production`. |
| Chapa | ⏸ Not configured. The site runs in labelled demo-payment mode. |
| Email | ❓ Unknown whether `EMAIL_USER`/`EMAIL_PASS` exist on Render. Without them, signups are auto-verified. |

## 1. Database: Neon

These steps are already done. They're listed here so the setup can be reproduced.

1. Create a Neon project, Postgres 16 or newer, and a branch `production`.
2. In **Connect**, copy two connection strings:
   - **Pooled** (host contains `-pooler`). Append `&pgbouncer=true&connect_timeout=15` and remove `channel_binding=require`. This is `DATABASE_URL`.
   - **Direct** (no `-pooler`), also with `channel_binding` removed. This is `DIRECT_URL`.
3. Apply the migrations from a trusted machine, never from CI logs:
   ```powershell
   $env:DATABASE_URL = '<pooled>'; $env:DIRECT_URL = '<direct>'
   cd backend; npx prisma migrate deploy --schema ../prisma/schema.prisma
   ```
   `migrate deploy` only applies pending migrations. **Never** run `prisma migrate reset`, `migrate dev` or `db push --force-reset` against production.
4. Optional demo content, idempotent and safe to re-run (it skips rows that already exist):
   ```powershell
   node scripts/seedDemoMarketplace.js
   # optional admin account — easiest: prompts for the connection string and password
   # (nothing is echoed or saved):  powershell -ExecutionPolicy Bypass -File scripts\create-admin.ps1
   # or manually (password 12+ chars, typed by you, never committed):
   $env:ADMIN_EMAIL='you@example.com'; $env:ADMIN_PASSWORD='<strong password>'; node scripts/seedDemoMarketplace.js
   ```

## 2. API: Render Blueprint (`render.yaml`)

`render.yaml` defines `visit-ethiopia-api`:
- `rootDir: backend`, Oregon region, free plan.
- Build command: `npm ci --include=dev && npm run build && npm run migrate:deploy`. The build fails, and the old version keeps serving, if a migration fails.
- Start command: `npm start`. Health check path: `/health`.
- All non-secret configuration is in the file. Secrets are `sync: false`.

**Required one-time action (owner):**
1. Open Render Dashboard → `visit-ethiopia-api` → **Environment**.
2. Add `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) from step 1. Paste them into the dashboard only, never into a file in the repo.
3. Optional: add `CHAPA_SECRET_KEY`, `CHAPA_WEBHOOK_SECRET`, `EMAIL_USER`, `EMAIL_PASS`.
4. **Save, rebuild and deploy** (or Manual Deploy → *Deploy latest commit*).
5. Check the deploy:
   ```bash
   curl https://visit-ethiopia-api.onrender.com/health          # {"status":"ok",...}
   curl https://visit-ethiopia-api.onrender.com/health/ready    # checks DB connectivity
   curl https://visit-ethiopia-api.onrender.com/api/v1/payments/config
   curl "https://visit-ethiopia-api.onrender.com/api/v1/tours/marketplace?limit=3"
   ```
   On startup the log should show `[config] NODE_ENV=production DATABASE_MODE=prisma payments=...` and `PostgreSQL (Prisma) connectivity OK`. The server prints configuration problems by name, never by value, and exits.

A legacy service, `visit-ethiopia-backend`, is **suspended** and no longer used. It's left in place until the owner decides whether to delete it.

## 3. Frontend: Vercel

- Project `visit-ethiopia-rw9b`, root directory `frontend`, connected to GitHub. Every push to `main` deploys.
- `frontend/vercel.json`:
  - SPA rewrite, so deep links such as `/tours/:id` work;
  - long-term caching for hashed assets;
  - security headers.
- The API URL comes from `frontend/.env.production` (`VITE_API_URL`). It's public, not a secret.
- A stale **secret** variable `VITE_API_BASE_URL` in the Vercel project settings points to a defunct backend. The code ignores it because `VITE_API_URL` takes precedence, but it should be deleted: Vercel → Project → Settings → Environment Variables → `VITE_API_BASE_URL` → Delete.

## 4. Chapa payments (test mode first)

The flow is implemented in `backend/services/chapaCheckoutService.js` and `backend/services/payment/ChapaPaymentProvider.js`:

1. The traveler creates a booking. The server creates a `pending` payment and holds the inventory for 15 minutes.
2. The traveler clicks "Pay with Chapa": `POST /api/v1/payments/:id/checkout`. The server calls Chapa `transaction/initialize` with a server-generated `tx_ref` (format `ve-<paymentId>-<attempt>`) and returns Chapa's hosted `checkout_url`.
3. Chapa redirects the browser back to `/bookings/:id?payment=return`. **This redirect confirms nothing.** The page asks the server to verify (`POST /payments/:id/verify`). The server calls Chapa `transaction/verify/{tx_ref}` and confirms only when Chapa reports `success` **and** the amount, currency and reference match.
4. Chapa also calls `GET /api/v1/payments/chapa/callback` and sends signed webhooks to `POST /api/v1/payments/webhooks/chapa`. Both trigger the same server-side verification. Webhooks with a missing or invalid HMAC signature are rejected. Duplicate events are ignored.
5. The reconciliation job re-verifies pending checkouts every 5 minutes. If a payment succeeds after the hold expired, it is **flagged for refund review**, not confirmed, so seats are never oversold.

**Owner steps to enable Chapa test mode:**
1. Create a Chapa account and copy the **test** secret key (`CHASECK_TEST-…`).
2. In Chapa Dashboard → Settings → Webhooks:
   - set the URL `https://visit-ethiopia-api.onrender.com/api/v1/payments/webhooks/chapa`;
   - set a webhook secret.
3. In Render, set `CHAPA_SECRET_KEY` and `CHAPA_WEBHOOK_SECRET`, then redeploy. `GET /api/v1/payments/config` should report `{"provider":"chapa","testMode":true,"configured":true}`.
4. Make a test booking and pay with Chapa's test card or test mobile numbers from Chapa's developer docs. Confirm that the booking becomes *Confirmed* only after verification.
5. Decide whether to keep `ALLOW_MOCK_PAYMENTS=true`. Mock and Chapa can coexist: existing mock payments still confirm, and new payments use Chapa.

**Live keys:** don't switch to `CHASECK-…` live keys without the owner's explicit decision. Live mode moves real money and requires settled refund, no-show and cancellation policies (see Known Limitations).

## 5. Operations

- **Logs:** Render → service → Logs. Request lines include method, path, status and duration. Errors with status 500 or above are logged with stack traces server-side only. Production responses never include stacks.
- **Health:** `/health` (process up) and `/health/ready` (database reachable).
- **Migrations:** add one with `npx prisma migrate dev --name <change>` against a **local** database, commit it, and push. Render applies it with `migrate deploy` during the build.
- **Backups:** Neon free tier keeps a limited restore window. Enable longer point-in-time restore on a paid plan if the data matters.
- **Cold starts:** Render's free tier sleeps after about 15 minutes idle. The first request can take around 50 seconds. Upgrading the plan has a cost and needs the owner's approval.
- **Secret rotation:**
  - Neon: reset the role password, then update both URLs in Render.
  - JWT: change `JWT_SECRET` in Render. This logs out every user.
  - Chapa: regenerate the keys in the dashboard and update Render.

## 6. Outstanding owner actions

These need the account owner and were deliberately not done automatically:

1. **Enter `DATABASE_URL` and `DIRECT_URL` on Render, then redeploy.** This blocks the live API.
2. **Rotate the MongoDB Atlas password** for the database user exposed in old commit `1c6c87e` (`frontend/.env`) of this public repository, or delete the Atlas cluster if it's unused. The production app no longer uses MongoDB, but the credential is still in git history.
3. Delete the stale Vercel variable `VITE_API_BASE_URL` (see §3).
4. Optional: Chapa test keys and webhook (see §4).
5. Optional: email credentials (`EMAIL_USER`, `EMAIL_PASS`).
6. Optional: create an admin account with the seed script (see §1.4).
7. Decide whether to remove the defunct deployments:
   - Vercel projects `visit-ethiopia` and `visit-ethiopia-backend-ku5l` (old backends returning 500);
   - the suspended Render service `visit-ethiopia-backend`.
