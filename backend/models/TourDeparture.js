import mongoose from 'mongoose'

const departurePackageSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, lowercase: true, trim: true },
    priceMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'ETB', uppercase: true },
    capacity: { type: Number, min: 0 },
    availableSpots: { type: Number, min: 0 },
    active: { type: Boolean, default: true },
  },
  { _id: false }
)

const tourDepartureSchema = new mongoose.Schema(
  {
    tourId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tour',
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    departureDate: { type: Date, required: true, index: true },
    returnDate: { type: Date },
    capacity: { type: Number, required: true, min: 1 },
    availableSpots: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['scheduled', 'open', 'full', 'cancelled', 'completed'],
      default: 'open',
      index: true,
    },
    packages: [departurePackageSchema],
    notes: { type: String, default: '' },
  },
  { timestamps: true }
)

tourDepartureSchema.index({ tourId: 1, departureDate: 1 })
tourDepartureSchema.index({ organizationId: 1, status: 1, departureDate: 1 })

tourDepartureSchema.pre('save', function validateInventory(next) {
  if (this.availableSpots < 0) {
    return next(new Error('availableSpots cannot be negative'))
  }
  if (this.availableSpots > this.capacity) {
    return next(new Error('availableSpots cannot exceed capacity'))
  }
  if (this.returnDate && this.departureDate && this.returnDate < this.departureDate) {
    return next(new Error('returnDate cannot be before departureDate'))
  }
  next()
})

const TourDeparture = mongoose.model('TourDeparture', tourDepartureSchema)

export default TourDeparture
