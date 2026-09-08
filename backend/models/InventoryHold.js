import mongoose from 'mongoose'

/** Tracks inventory linked to a v2 booking for idempotent reserve/release. */
export const INVENTORY_HOLD_STATUSES = ['pending', 'held', 'released', 'consumed', 'expired']

const inventoryHoldSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },
    departureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TourDeparture',
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    quantity: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: INVENTORY_HOLD_STATUSES,
      default: 'pending',
      index: true,
    },
    expiresAt: { type: Date, default: null, index: true },
    releasedAt: { type: Date, default: null },
    releaseReason: { type: String, trim: true, default: null },
  },
  { timestamps: true }
)

/** One active hold per booking (pending, held, or consumed). */
inventoryHoldSchema.index(
  { bookingId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['pending', 'held', 'consumed'] },
    },
  }
)

inventoryHoldSchema.index({ departureId: 1, status: 1 })
inventoryHoldSchema.index({ status: 1, expiresAt: 1 })

inventoryHoldSchema.pre('validate', function validateQuantity(next) {
  if (!Number.isInteger(this.quantity) || this.quantity < 1) {
    return next(new Error('quantity must be a positive integer'))
  }
  next()
})

const InventoryHold = mongoose.model('InventoryHold', inventoryHoldSchema)

export default InventoryHold
