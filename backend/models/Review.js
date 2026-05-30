import mongoose from 'mongoose'

const ReviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  itemType: {
    type: String,
    enum: ['tour', 'hotel', 'transport', 'restaurant'],
    required: true,
  },
  itemId: { type: mongoose.Schema.Types.ObjectId, required: true }, // References the reviewed item
  rating: { type: Number, min: 1, max: 5, required: true },
  title: { type: String },
  comment: { type: String },
  images: [{ type: String }],
  dateOfExperience: { type: Date },
  status: {
    type: String,
    enum: ['approved', 'pending', 'rejected'],
    default: 'pending',
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

ReviewSchema.pre('save', function (next) {
  this.updatedAt = Date.now()
  next()
})

ReviewSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'user',
    select: 'FirstName LastName email',
  })
  next()
})

const Review = mongoose.model('Review', ReviewSchema)

export default Review
