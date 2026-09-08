import mongoose from 'mongoose'

/**
 * GeoJSON Point for 2dsphere indexes.
 * coordinates: [longitude, latitude]
 */
export const geoPointSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      validate: {
        validator(v) {
          if (!v || v.length !== 2) return false
          const [lng, lat] = v
          return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90
        },
        message: 'coordinates must be [lng, lat] with valid ranges',
      },
    },
    address: { type: String },
    city: { type: String },
    region: { type: String },
    country: { type: String },
  },
  { _id: false }
)

export default geoPointSchema
