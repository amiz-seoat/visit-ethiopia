import mongoose from 'mongoose'

const TourSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    shortDescription: { type: String, required: true },
    duration: {
      days: { type: Number, required: true },
      nights: { type: Number, required: true },
    },
    destinations: [{ type: String, required: true }],
    categories: [
      {
        type: String,
        enum: ['cultural', 'adventure', 'nature', 'historical', 'religious'],
      },
    ],
    difficulty: {
      type: String,
      enum: ['easy', 'moderate', 'challenging'],
      required: true,
    },
    price: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    images: [{ type: String }],
    coverImage: { type: String, required: true },
    startDate: { type: Date },
    endDate: { type: Date },
    availableDates: [{ type: Date }],
    maxGroupSize: { type: Number, required: true },
    currentBookings: { type: Number, default: 0 },
    inclusions: [{ type: String }],
    exclusions: [{ type: String }],
    itinerary: [
      {
        day: { type: Number, required: true },
        title: { type: String, required: true },
        description: { type: String, required: true },
        meals: { type: String },
        accommodation: { type: String },
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    guides: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    secretTour: { type: Boolean, default: false },
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

TourSchema.pre('save', function (next) {
  this.updatedAt = Date.now()
  next()
})

TourSchema.pre(/^find/, function (next) {
  this.find({ secretTour: { $ne: true } })
  this.start = Date.now()
  next()
})
TourSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'guides',
    select: '-__v -passwordChangedAt',
  })
  next()
})

TourSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'itemId',
  localField: '_id',
  match: { itemType: 'tour' },
})

const Tour = mongoose.model('Tour', TourSchema)

export default Tour
