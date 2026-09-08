import mongoose from 'mongoose'

export const contactInfoSchema = new mongoose.Schema(
  {
    phone: { type: String },
    email: { type: String },
    website: { type: String },
    socialLinks: {
      facebook: String,
      instagram: String,
      telegram: String,
      linkedin: String,
      twitter: String,
    },
  },
  { _id: false }
)

export default contactInfoSchema
