import mongoose from 'mongoose'
import {
  ALL_BOOKING_STATUSES,
  BOOKING_FLOW_VERSIONS,
  FULFILLMENT_STATUSES,
} from '../config/booking.js'
import { bookingPriceSnapshotSchema } from './schemas/bookingPriceSnapshot.js'

const providerNoteSchema = new mongoose.Schema(
  {
    note: { type: String, required: true, trim: true, maxlength: 1000 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
)

const BookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  /** legacy = pre-Phase-4 flows; v2 = tour departure checkout */
  bookingFlowVersion: {
    type: String,
    enum: BOOKING_FLOW_VERSIONS,
    default: 'legacy',
    index: true,
  },

  bookingType: {
    type: String,
    enum: ['tour', 'hotel', 'transport', 'restaurant'],
    required: true,
  },
  bookingItem: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },

  /** v2 tour departure linkage (derived server-side, never client-controlled) */
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null,
    index: true,
  },
  departureId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TourDeparture',
    default: null,
    index: true,
  },
  packageKey: { type: String, trim: true, lowercase: true, default: null },

  /** Immutable pricing captured at booking creation (v2 only) */
  priceSnapshot: {
    type: bookingPriceSnapshotSchema,
    default: null,
  },

  /** Separate Payment collection reference (v2 only) */
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    default: null,
  },

  /** Inventory reservation tracking (v2 only) */
  inventoryReserved: { type: Boolean, default: false },
  inventoryReleasedAt: { type: Date, default: null },
  inventoryQuantity: { type: Number, min: 0, default: null },

  bookingDetails: {
    startDate: { type: Date },
    endDate: { type: Date },
    quantity: { type: Number, default: 1 },
    participants: [
      {
        name: { type: String },
        age: { type: Number },
        specialRequirements: { type: String },
      },
    ],
    roomType: { type: String },
    route: { type: String },
    departureTime: { type: String },
  },
  contactInfo: {
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String },
  },

  /** Legacy embedded payment — retained for backward compatibility */
  payment: {
    amount: { type: Number },
    currency: { type: String, default: 'ETB' },
    paymentMethod: {
      type: String,
      enum: ['credit_card', 'bank_transfer', 'mobile_money', 'cash'],
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
    },
    transactionId: { type: String },
    paymentDate: { type: Date },
  },

  status: {
    type: String,
    enum: ALL_BOOKING_STATUSES,
    default: 'pending',
    index: true,
  },

  /**
   * Operational fulfillment (Phase 4I) — independent of financial status/payment.
   * Only used for v2 tour bookings; legacy bookings ignore this field.
   */
  fulfillmentStatus: {
    type: String,
    enum: FULFILLMENT_STATUSES,
    default: 'pending',
    index: true,
  },
  fulfillmentConfirmedAt: { type: Date, default: null },
  checkedInAt: { type: Date, default: null },
  fulfillmentCompletedAt: { type: Date, default: null },
  noShowAt: { type: Date, default: null },
  providerNotes: { type: [providerNoteSchema], default: [] },

  /** v2 lifecycle timestamps */
  expiresAt: { type: Date, default: null, index: true },
  confirmedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },

  /** Idempotency for POST /bookings/tours (v2 only, scoped per user) */
  idempotencyKey: { type: String, trim: true, default: null },

  cancellationReason: { type: String },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

BookingSchema.index({ user: 1, createdAt: -1 })
BookingSchema.index({ departureId: 1, status: 1 })
BookingSchema.index({ organizationId: 1, status: 1, createdAt: -1 })
BookingSchema.index({ status: 1, expiresAt: 1 })
BookingSchema.index(
  { user: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $exists: true, $type: 'string' },
      bookingFlowVersion: 'v2',
    },
  }
)

BookingSchema.pre('validate', function validateBookingFlow(next) {
  const version = this.bookingFlowVersion || 'legacy'

  if (version === 'legacy') {
    if (this.payment?.amount == null) {
      return next(new Error('payment.amount is required for legacy bookings'))
    }
    if (!this.payment?.paymentMethod) {
      return next(new Error('payment.paymentMethod is required for legacy bookings'))
    }
    return next()
  }

  if (version === 'v2') {
    if (!this.departureId) {
      return next(new Error('departureId is required for v2 bookings'))
    }
    if (!this.packageKey) {
      return next(new Error('packageKey is required for v2 bookings'))
    }
    if (!this.organizationId) {
      return next(new Error('organizationId is required for v2 bookings'))
    }
    if (!this.priceSnapshot) {
      return next(new Error('priceSnapshot is required for v2 bookings'))
    }
    if (this.inventoryQuantity == null || !Number.isInteger(this.inventoryQuantity)) {
      return next(new Error('inventoryQuantity must be a positive integer for v2 bookings'))
    }
    if (this.inventoryQuantity < 1) {
      return next(new Error('inventoryQuantity must be at least 1 for v2 bookings'))
    }
    if (this.bookingType !== 'tour') {
      return next(new Error('v2 bookings must have bookingType tour'))
    }
  }

  next()
})

BookingSchema.pre('save', function updateTimestamps(next) {
  this.updatedAt = Date.now()
  next()
})

BookingSchema.pre(/^find/, function (next) {
  if (this.getOptions().skipUserPopulate) return next()
  this.populate({
    path: 'user',
    select: '-__v -passwordChangedAt',
  })
  next()
})

BookingSchema.pre(/^find/, function (next) {
  if (this.getOptions().skipBookingItemPopulate) return next()
  this.populate({
    path: 'bookingItem',
    select: '__v -createdAt -updatedAt',
  })
  next()
})

const Booking = mongoose.model('Booking', BookingSchema)
export default Booking
