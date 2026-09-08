import mongoose from 'mongoose'
import { PAYMENT_PROVIDERS } from '../config/booking.js'

export const REFUND_STATUSES = ['pending', 'processing', 'completed', 'failed']

const refundSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
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
    currency: { type: String, required: true, uppercase: true, default: 'ETB' },
    provider: {
      type: String,
      enum: PAYMENT_PROVIDERS,
      default: 'mock',
      required: true,
    },
    status: {
      type: String,
      enum: REFUND_STATUSES,
      default: 'pending',
      required: true,
      index: true,
    },
    reason: { type: String, trim: true, default: 'customer_cancelled' },
    idempotencyKey: { type: String, trim: true, default: null },
    providerRefundId: { type: String, trim: true, default: null },
    failureCode: { type: String, trim: true, default: null },
    failureMessage: { type: String, trim: true, default: null },
    requestedAt: { type: Date, default: Date.now },
    processingAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
)

refundSchema.index(
  { userId: 1, bookingId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $exists: true, $type: 'string' },
    },
  }
)

refundSchema.index({ paymentId: 1, status: 1 })

refundSchema.pre('validate', function validateAmount(next) {
  if (!Number.isInteger(this.amountMinor) || this.amountMinor < 0) {
    return next(new Error('amountMinor must be a non-negative integer'))
  }
  next()
})

const Refund = mongoose.model('Refund', refundSchema)

export default Refund
