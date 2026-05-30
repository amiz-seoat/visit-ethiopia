import mongoose from 'mongoose'

const TransportSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  type: {
    type: String,
    enum: ['air', 'bus', 'train', 'private_vehicle', 'boat'],
    required: true,
  },
  vehicleDetails: {
    model: { type: String },
    capacity: { type: Number },
    features: [{ type: String }],
    images: [{ type: String }],
  },
  routes: [
    {
      from: { type: String, required: true },
      to: { type: String, required: true },
      departureTime: { type: String, required: true },
      arrivalTime: { type: String, required: true },
      duration: { type: String },
      price: { type: Number, required: true },
      availableSeats: { type: Number, required: true },
    },
  ],
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
  status: {
    type: String,
    enum: ['active', 'inactive', 'draft'],
    default: 'active',
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

const Transport = mongoose.model('Transport', TransportSchema)
export default Transport
