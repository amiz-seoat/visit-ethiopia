import mongoose from 'mongoose'
import { PAYMENT_ATTEMPT_STATUSES } from '../config/booking.js'

const paymentAttemptSchema = new mongoose.Schema(
  {
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      required: true,
      index: true,
    },
    attemptNumber: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: PAYMENT_ATTEMPT_STATUSES,
      default: 'pending',
      required: true,
    },
    providerReference: { type: String, trim: true, default: null },
    failureCode: { type: String, trim: true, default: null },
    failureMessage: { type: String, trim: true, default: null },
    rawProviderResponse: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

paymentAttemptSchema.index({ paymentId: 1, attemptNumber: 1 }, { unique: true })

const PaymentAttempt = mongoose.model('PaymentAttempt', paymentAttemptSchema)

export default PaymentAttempt
