import mongoose from 'mongoose'
import { PAYMENT_PROVIDERS } from '../config/booking.js'

export const WEBHOOK_EVENT_STATUSES = ['pending', 'processed', 'failed']

const webhookEventSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: PAYMENT_PROVIDERS,
      required: true,
      index: true,
    },
    eventId: { type: String, required: true, trim: true },
    eventType: { type: String, required: true, trim: true },
    receivedAt: { type: Date, default: Date.now, required: true },
    processedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: WEBHOOK_EVENT_STATUSES,
      default: 'pending',
      required: true,
      index: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
      index: true,
    },
    payloadHash: { type: String, trim: true, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    failureCode: { type: String, trim: true, default: null },
    failureMessage: { type: String, trim: true, default: null },
  },
  { timestamps: true }
)

webhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true })

const WebhookEvent = mongoose.model('WebhookEvent', webhookEventSchema)

export default WebhookEvent
