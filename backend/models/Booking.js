import mongoose from 'mongoose'

const BookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bookingType: {
    type: String,
    enum: ['tour', 'hotel', 'transport', 'restaurant'],
    required: true,
  },
  bookingItem: { type: mongoose.Schema.Types.ObjectId, required: true }, // Can reference Tour, Hotel, Transport, or Restaurant
  bookingDetails: {
    // Common fields
    startDate: { type: Date },
    endDate: { type: Date },
    quantity: { type: Number, default: 1 },
    // Tour-specific
    participants: [
      {
        name: { type: String },
        age: { type: Number },
        specialRequirements: { type: String },
      },
    ],
    // Hotel-specific
    roomType: { type: String },
    // Transport-specific
    route: { type: String },
    departureTime: { type: String },
  },
  contactInfo: {
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String },
  },
  payment: {
    amount: { type: Number, required: true },
    currency: { type: String, default: 'ETB' },
    paymentMethod: {
      type: String,
      enum: ['credit_card', 'bank_transfer', 'mobile_money', 'cash'],
      required: true,
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
    enum: ['confirmed', 'pending', 'cancelled', 'completed'],
    default: 'pending',
  },
  cancellationReason: { type: String },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

BookingSchema.pre('save', function (next) {
  this.updatedAt = Date.now()
  next()
})
BookingSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'user',
    select: '-__v -passwordChangedAt',
  })
  next()
})

BookingSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'bookingItem',
    select: '__v -createdAt -updatedAt',
  })
  next()
})

const Booking = mongoose.model('Booking', BookingSchema)
export default Booking
