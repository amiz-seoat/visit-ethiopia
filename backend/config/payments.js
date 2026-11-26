/**
 * Payment provider selection.
 *
 * PAYMENT_PROVIDER=chapa  — real Chapa hosted checkout (requires CHAPA_SECRET_KEY)
 * PAYMENT_PROVIDER=mock   — deterministic mock provider (dev/test/demo only)
 *
 * Default: chapa when CHAPA_SECRET_KEY is set, otherwise mock.
 *
 * In production the mock provider is refused unless ALLOW_MOCK_PAYMENTS=true is
 * set explicitly (portfolio demo mode). The UI labels mock payments as demo
 * payments so no one mistakes them for real transactions.
 */

export function getActivePaymentProviderName() {
  const raw = String(process.env.PAYMENT_PROVIDER || '').trim().toLowerCase()
  if (raw === 'chapa' || raw === 'mock') return raw
  return process.env.CHAPA_SECRET_KEY ? 'chapa' : 'mock'
}

export function isMockPaymentAllowed() {
  if (process.env.NODE_ENV !== 'production') return true
  return String(process.env.ALLOW_MOCK_PAYMENTS || '').toLowerCase() === 'true'
}

export function getChapaConfig() {
  return {
    secretKey: process.env.CHAPA_SECRET_KEY || '',
    webhookSecret: process.env.CHAPA_WEBHOOK_SECRET || '',
    apiBase: (process.env.CHAPA_API_BASE || 'https://api.chapa.co/v1').replace(/\/$/, ''),
    timeoutMs: Number(process.env.CHAPA_TIMEOUT_MS) || 15000,
  }
}

/** True when the configured key is a Chapa test-mode key (no real money moves). */
export function isChapaTestMode() {
  return /_TEST-/i.test(process.env.CHAPA_SECRET_KEY || '')
}

/** Public HTTPS origin of this API (for Chapa callback_url). */
export function getPublicBackendUrl() {
  const raw =
    process.env.PUBLIC_BACKEND_URL ||
    process.env.PROD_BACKEND_URL ||
    process.env.BACKEND_URL ||
    `http://localhost:${process.env.PORT || 3000}`
  return String(raw).trim().replace(/\/$/, '')
}

/** Public origin of the frontend (for Chapa return_url). */
export function getPublicFrontendUrl() {
  return String(process.env.FRONTEND_URL || 'http://localhost:5173')
    .trim()
    .replace(/\/$/, '')
}

/** Status the frontend can show without leaking configuration secrets. */
export function getPublicPaymentConfig() {
  const provider = getActivePaymentProviderName()
  return {
    provider,
    mockAllowed: isMockPaymentAllowed(),
    testMode: provider === 'chapa' ? isChapaTestMode() : true,
    configured:
      provider === 'chapa' ? Boolean(process.env.CHAPA_SECRET_KEY) : isMockPaymentAllowed(),
  }
}

export default {
  getActivePaymentProviderName,
  isMockPaymentAllowed,
  getChapaConfig,
  isChapaTestMode,
  getPublicBackendUrl,
  getPublicFrontendUrl,
  getPublicPaymentConfig,
}
