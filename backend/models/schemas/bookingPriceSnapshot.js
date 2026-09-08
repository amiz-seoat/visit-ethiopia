import mongoose from 'mongoose'

/**
 * Immutable price snapshot captured at v2 booking creation time.
 * All monetary values are integer minor units.
 */
export const bookingPriceSnapshotSchema = new mongoose.Schema(
  {
    currency: { type: String, required: true, uppercase: true, default: 'ETB' },
    quantity: { type: Number, required: true, min: 1 },
    unitPriceMinor: { type: Number, required: true, min: 0 },
    subtotalMinor: { type: Number, required: true, min: 0 },
    discountMinor: { type: Number, default: 0, min: 0 },
    feesMinor: { type: Number, default: 0, min: 0 },
    taxMinor: { type: Number, default: 0, min: 0 },
    totalMinor: { type: Number, required: true, min: 0 },

    tourId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tour', required: true },
    tourTitle: { type: String, required: true, trim: true },
    tourSlug: { type: String, trim: true, lowercase: true },

    departureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TourDeparture',
      required: true,
    },
    departureDate: { type: Date, required: true },
    returnDate: { type: Date, default: null },

    packageKey: { type: String, required: true, trim: true, lowercase: true },
    packageName: { type: String, required: true, trim: true },

    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    organizationName: { type: String, required: true, trim: true },
    organizationSlug: { type: String, trim: true, lowercase: true },

    pricedFrom: {
      type: String,
      enum: ['departure_package', 'tour_package'],
      required: true,
    },
    pricedAt: { type: Date, required: true },
    tourPriceMinorAtBooking: { type: Number, min: 0 },
  },
  { _id: false }
)

bookingPriceSnapshotSchema.pre('validate', function validateSnapshot(next) {
  const expectedSubtotal = this.unitPriceMinor * this.quantity
  if (this.subtotalMinor !== expectedSubtotal) {
    return next(
      new Error('priceSnapshot.subtotalMinor must equal unitPriceMinor * quantity')
    )
  }
  const expectedTotal =
    this.subtotalMinor -
    (this.discountMinor || 0) +
    (this.feesMinor || 0) +
    (this.taxMinor || 0)
  if (this.totalMinor !== expectedTotal) {
    return next(new Error('priceSnapshot.totalMinor is inconsistent with line items'))
  }
  next()
})

export default bookingPriceSnapshotSchema
