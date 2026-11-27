# Known limitations

This is an honest list of what the project does **not** do yet, or does only partly. Business-policy gaps are listed as open decisions rather than invented.

## Deployment and infrastructure

- **The live API is blocked by one owner action.**
  - The Render service needs `DATABASE_URL` and `DIRECT_URL` entered in its dashboard.
  - Until then the deployed frontend loads but can't fetch data.
- **Cold starts.**
  - Render's free tier sleeps after about 15 minutes idle.
  - The first request then takes around 50 seconds.
  - The background reconciliation job only runs while the instance is awake. Expired holds are also handled when bookings are next read or created.
- **Backups.** The Neon free tier has a short restore window, and there is no separate backup job.
- **No file uploads in production.**
  - Images are URLs; the Cloudinary configuration is unused.
  - Providers can't upload photos from their device.
- **Single region**, Oregon, us-west-2. Latency from Ethiopia is roughly 250–350 ms per request.

## Payments

- **Payments are not live.**
  - No Chapa keys are configured, so the site uses clearly labelled demo payments (`ALLOW_MOCK_PAYMENTS=true`) and no money moves.
  - The Chapa integration is complete and tested against a fake Chapa API, but it has **not** been run against Chapa's real sandbox (no test keys yet). **MANUAL VERIFICATION REQUIRED.**
- **Refunds have only been tested against the fake Chapa API.**
  - Cancelling a Chapa-paid booking computes the refund from the existing policy variables and calls Chapa's refund API (`POST /refund/{tx_ref}`) with that amount.
  - The booking is cancelled only if Chapa accepts. If Chapa rejects, the booking stays confirmed and the refund is recorded as failed so it can be retried.
  - Chapa may settle refunds asynchronously. There's no refund-status webhook handling yet, so watch the Chapa dashboard. **MANUAL VERIFICATION REQUIRED** in Chapa's sandbox.
- **Late payments need manual handling.** A payment that succeeds after the 15-minute hold expired is flagged `needsRefundReview`, and there is no admin screen for that queue yet.
- **Open policy decisions** (deliberately not invented):
  - refund on **no-show**;
  - **provider-initiated cancellation** and who bears the cost;
  - partial refunds inside the cutoff window (currently 0% by default);
  - commission and payouts to providers (there's no settlement or payout system).
- Only **ETB and USD** are accepted for Chapa checkout.

## Product scope

- **Transport** covers scheduled coach routes with per-date seats. There's no seat map, no vehicle hire or charter, and no multi-leg journeys.
- **Hotels** use calendar-date inventory in UTC. Hotel-local time zones and check-in times aren't modelled.
- **Not built:** multi-language UI (Amharic), wishlist, messaging between traveler and provider.
- **Maps** use OpenStreetMap tiles through Leaflet, which needs no key, plus "Open in Google Maps" and "Directions" links (official keyless Google Maps URLs). There's no embedded Google map, which would need a billed API key.
  - Restaurants and tours in the seed have no coordinates. Restaurants show Google Maps buttons by name; tours plot their destinations by matching names to the destinations catalogue.
  - Heavy production traffic should move to a commercial tile provider, as the OSM tile policy asks.
- **Travel assistant (AI chatbot)**
  - Answers only from the curated knowledge base (37 places: 18 classic sites, 19 new tourism projects) plus live public listings.
  - Retrieval is keyword-based (BM25 with typo and transliteration tolerance), not semantic embeddings. Paraphrases that share no words with the guide may miss.
  - The knowledge base is static JSON, sourced and dated November 2026. Several entries carry caveats in `confidenceNotes`:
    - travel advisories for Tigray, Amhara and Afar;
    - a hotel whose operating status is unclear;
    - missing coordinates for most new projects;
    - conflicting operator names.
  - Update the JSON files to refresh it.
  - "Beynuna village" is **Beynouna Village** (Lake Beseka, Metehara, inaugurated November 2024). The Chaka project and "Wawa" were left out: one is unopened, the other unverified.
  - The free Groq tier limits volume (about 1,000 requests a day). The daily cap then falls back to search-only answers.
  - Questions are stored (truncated to 500 characters, no user ID or IP) for the admin "Travel assistant" insights. They are not deleted automatically.
- **Restaurants and news** are read-only content managed by admins. You can't book restaurants.
- **Search** is a simple case-insensitive text match on titles and descriptions. It has no full-text ranking and no geo search.

## Accounts and email

- **Email is optional.**
  - With no email provider configured in production, new accounts are **auto-verified**.
  - Password-reset emails can't be sent then; the API returns an error.
  - Booking-confirmation emails are skipped.
  - Setting `EMAIL_USER`/`EMAIL_PASS` turns all of this on.
- The seed creates **no usable admin by default**. The owner creates one with the seed script and their own password.
- **No 2FA, no social login.** Social-login buttons were removed or never wired up.

## Code quality

- **63 TypeScript errors** in the frontend predate this work: unused imports and loose types. The Vite build passes because it doesn't type-check. Cleaning them up is low-risk follow-up work.
- **Legacy MongoDB code is still present.**
  - It sits behind `DATABASE_MODE=mongo` and still passes its regression battery, but production doesn't use it.
  - Removing it would shrink the codebase substantially. That's a separate, deliberate refactor.
- **Admin UI routing is looser than the API.** The admin dashboard route in the frontend is reachable by some non-admin manager roles. The **API enforces roles on every admin endpoint**, so nothing is exposed, but the UI shows empty or forbidden states instead of redirecting.
- **Old secret in git history.** A MongoDB Atlas credential is in the public repository's history (commit `1c6c87e`, `frontend/.env`). It must be rotated by the owner, because rewriting public history isn't enough on its own.
