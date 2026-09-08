import mongoose from 'mongoose'
import { PAYMENT_PROVIDERS, PAYMENT_STATUSES } from '../config/booking.js'

const paymentSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    amountMinor: { type: Number, required: true, min: 0 },
    amountRefundedMinor: { type: Number, required: true, min: 0, default: 0 },
    currency: { type: String, required: true, uppercase: true, default: 'ETB' },
    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: 'pending',
      index: true,
    },
    provider: {
      type: String,
      enum: PAYMENT_PROVIDERS,
      default: 'mock',
      required: true,
    },
    providerPaymentId: { type: String, trim: true, default: null },
    idempotencyKey: { type: String, trim: true, default: null },
    expiresAt: { type: Date, default: null, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

paymentSchema.index(
  { bookingId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $exists: true, $type: 'string' },
    },
  }
)

paymentSchema.pre('validate', function validateAmount(next) {
  if (!Number.isInteger(this.amountMinor)) {
    return next(new Error('amountMinor must be an integer'))
  }
  if (!Number.isInteger(this.amountRefundedMinor)) {
    return next(new Error('amountRefundedMinor must be an integer'))
  }
  if (this.amountRefundedMinor > this.amountMinor) {
    return next(new Error('amountRefundedMinor cannot exceed amountMinor'))
  }
  next()
})

const Payment = mongoose.model('Payment', paymentSchema)

export default Payment
