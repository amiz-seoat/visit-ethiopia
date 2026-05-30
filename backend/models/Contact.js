import mongoose from 'mongoose'

const ContactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  status: {
    type: String,
    enum: ['new', 'in_progress', 'resolved', 'spam'],
    default: 'new',
  },
  response: { type: String },
  respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  respondedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

ContactSchema.pre('save', function (next) {
  this.updatedAt = Date.now()
  next()
})

ContactSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'respondedBy',
    select: 'FirstName LastName email',
  })
  next()
})
const Contact = mongoose.model('Contact', ContactSchema)
export default Contact
