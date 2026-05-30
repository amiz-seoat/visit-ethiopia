import mongoose from 'mongoose'

const HotelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    shortDescription: { type: String, required: true },
    location: {
      address: { type: String, required: true },
      city: { type: String, required: true },
      region: { type: String, required: true },
      coordinates: {
        lat: { type: Number },
        lng: { type: Number },
      },
    },
    stars: { type: Number, min: 1, max: 5 },
    amenities: [{ type: String }],
    roomTypes: [
      {
        type: { type: String, required: true },
        description: { type: String },
        price: { type: Number, required: true },
        capacity: { type: Number, required: true },
        availableRooms: { type: Number, required: true },
        images: [{ type: String }],
      },
    ],
    images: [{ type: String }],
    coverImage: { type: String, required: true },
    contact: {
      phone: { type: String, required: true },
      email: { type: String, required: true },
      website: { type: String },
    },
    policies: {
      checkIn: { type: String },
      checkOut: { type: String },
      cancellation: { type: String },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reviews: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Review' }],
    averageRating: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['active', 'inactive', 'draft'],
      default: 'active',
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
)

HotelSchema.pre('save', function (next) {
  this.updatedAt = Date.now()
  next()
})

const Hotel = mongoose.model('Hotel', HotelSchema)
export default Hotel
