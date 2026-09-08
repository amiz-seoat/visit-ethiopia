import mongoose from 'mongoose'

export const mediaItemSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    caption: { type: String },
    type: {
      type: String,
      enum: ['logo', 'cover', 'gallery', 'portfolio'],
      default: 'gallery',
    },
    sortOrder: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: Date.now },
    cloudinaryId: { type: String },
  },
  { _id: false }
)

export default mediaItemSchema
