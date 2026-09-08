/**
 * Provider-agnostic payment abstraction (Phase 4D).
 * Real providers (Chapa, Stripe, etc.) implement this in later phases.
 */
export class PaymentProvider {
  /** @returns {Promise<{ providerReference: string, raw?: object }>} */
  async initiatePayment(_ctx) {
    throw new Error('initiatePayment not implemented')
  }

  /** @returns {Promise<{ success: boolean, providerReference?: string, failureCode?: string, failureMessage?: string, raw?: object }>} */
  async confirmPayment(_ctx) {
    throw new Error('confirmPayment not implemented')
  }

  async cancelPayment(_ctx) {
    throw new Error('cancelPayment not implemented')
  }

  /** Reserved for Phase 4F+ */
  async refundPayment(_ctx) {
    throw new Error('refundPayment not implemented')
  }

  async verifyWebhookSignature(_ctx) {
    throw new Error('verifyWebhookSignature not implemented')
  }

  async parseWebhookEvent(_ctx) {
    throw new Error('parseWebhookEvent not implemented')
  }
}

export default PaymentProvider
