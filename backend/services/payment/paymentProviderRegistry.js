import AppError from '../../utils/appError.js'
import { PAYMENT_PROVIDERS } from '../../config/booking.js'
import MockPaymentProvider from './MockPaymentProvider.js'

const providers = {
  mock: new MockPaymentProvider(),
}

export function getPaymentProvider(name) {
  if (!PAYMENT_PROVIDERS.includes(name)) {
    throw new AppError('Unsupported payment provider', 400)
  }
  const provider = providers[name]
  if (!provider) {
    throw new AppError('Payment provider not configured', 503)
  }
  return provider
}

export default { getPaymentProvider }
