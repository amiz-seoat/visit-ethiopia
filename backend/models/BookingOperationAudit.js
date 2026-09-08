import mongoose from 'mongoose'

/**
 * Append-only audit of provider operational mutations (Phase 4I).
 * Actor/org are always taken from auth context — never from request body.
 */
const bookingOperationAuditSchema = new mongoose.Schema(
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
    actorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        'check_in',
        'complete',
        'no_show',
        'add_note',
        'fulfillment_confirmed',
      ],
    },
    previousFulfillmentStatus: { type: String, default: null },
    newFulfillmentStatus: { type: String, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false }
)

bookingOperationAuditSchema.index({ bookingId: 1, createdAt: -1 })

const BookingOperationAudit = mongoose.model(
  'BookingOperationAudit',
  bookingOperationAuditSchema
)

export default BookingOperationAudit
