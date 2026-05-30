import mongoose from 'mongoose'

const NewsSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  summary: { type: String, required: true },
  category: {
    type: String,
    enum: ['tourism', 'culture', 'event', 'business', 'general'],
  },
  images: [{ type: String }],
  coverImage: { type: String, required: true },
  tags: [{ type: String }],
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isFeatured: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['published', 'draft', 'archived'],
    default: 'published',
  },
  publishedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  views: { type: Number, default: 0 },
})

// update "updatedAt" before save
NewsSchema.pre('save', function (next) {
  this.updatedAt = Date.now()
  next()
})

// auto-populate author details when querying
NewsSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'author',
    select: 'FirstName LastName email',
  })
  next()
})

const News = mongoose.model('News', NewsSchema)
export default News
