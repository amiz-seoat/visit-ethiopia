import mongoose from 'mongoose'

const RestaurantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  shortDescription: { type: String, required: true },
  cuisineType: [{ type: String, required: true }],
  location: {
    address: { type: String, required: true },
    city: { type: String, required: true },
    region: { type: String, required: true },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
  },
  openingHours: {
    monday: { type: String },
    tuesday: { type: String },
    wednesday: { type: String },
    thursday: { type: String },
    friday: { type: String },
    saturday: { type: String },
    sunday: { type: String },
  },
  priceRange: { type: String, enum: ['$', '$$', '$$$', '$$$$'] },
  menu: [
    {
      category: { type: String, required: true },
      items: [
        {
          name: { type: String, required: true },
          description: { type: String },
          price: { type: Number, required: true },
          isVegetarian: { type: Boolean, default: false },
          isVegan: { type: Boolean, default: false },
        },
      ],
    },
  ],
  images: [{ type: String }],
  coverImage: { type: String, required: true },
  contact: {
    phone: { type: String, required: true },
    email: { type: String },
    website: { type: String },
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
})

const Restaurant = mongoose.model('Restaurant', RestaurantSchema)
export default Restaurant
