import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import crypto from 'crypto'

const userSchema = new mongoose.Schema({
  FirstName: {
    type: String,
    required: [true, 'A user must have a First Name'],
    trim: true,
  },
  LastName: {
    type: String,
    required: [true, 'A user must have a Last Name'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'A user must have an email'],
    unique: true,
    lowercase: true,
    validate: {
      validator: function (val) {
        return /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(val)
      },
      message: 'Please provide a valid email address',
    },
  },
  password: {
    type: String,
    required: [true, 'A user must have a password'],
    minlength: 8,
    select: false,
  },
  passwordConfirm: {
    type: String,
    required: [true, 'Please confirm your password'],
    validate: {
      // This only works on CREATE and SAVE
      validator: function (val) {
        return val === this.password
      },
      message: 'Passwords do not match',
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'guide'],
    default: 'user',
  },
  isVerified: { type: Boolean, default: false },
  active: {
    type: Boolean,
    default: true,
    select: false,
  },
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tour' }],
})

userSchema.pre('save', async function (next) {
  // Only run this function if password was modified
  if (!this.isModified('password')) return next()

  // Hash the password with cost of 12
  this.password = await bcrypt.hash(this.password, 12)

  // Delete confirmPassword field
  this.passwordConfirm = undefined
  next()
})
// Instance method to check if password is correct
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword)
}

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  // If the user has changed password after the token was issued
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    )
    return JWTTimestamp < changedTimestamp
  }
  return false
}

userSchema.methods.createPasswordResetToken = function () {
  // Create a reset token
  const resetToken = crypto.randomBytes(32).toString('hex')

  // Hash the token and set it to passwordResetToken field
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex')
  console.log({ resetToken }, this.passwordResetToken)

  // Set the expiration time for the token
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000 // 10 minutes

  return resetToken
}
userSchema.pre(/^find/, function (next) {
  this.find({ active: { $ne: false } })
  next()
})

const User = mongoose.model('User', userSchema)

export default User
