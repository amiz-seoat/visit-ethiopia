import mongoose from 'mongoose'

export const tourPackageSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    priceMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'ETB', uppercase: true },
    capacity: { type: Number, min: 1 },
    includedItems: [{ type: String }],
    excludedItems: [{ type: String }],
    benefits: [{ type: String }],
    active: { type: Boolean, default: true },
  },
  { _id: false }
)

export const DEFAULT_PACKAGE_KEYS = ['normal', 'vip']

export default tourPackageSchema
