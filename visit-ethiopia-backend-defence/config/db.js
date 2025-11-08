import mongoose from 'mongoose'

const connectDB = async () => {
  // Prefer DATABASE, fallback to MONGO_URI
  const dbUri = process.env.DATABASE || process.env.MONGO_URI || process.env.MONGOURL

  // Log what we see (mask credentials for safety)
  const masked = dbUri
    ? dbUri.replace(/(mongodb(?:\+srv)?:\/\/)(.*@)/, '$1***@')
    : 'undefined'
  console.log('Attempting MongoDB connect. DATABASE env seen as:', masked)

  try {
    await mongoose.connect(dbUri)
    console.log('MongoDB connected successfully!')
  } catch (error) {
    console.error('MongoDB connection failed:', error.message || error)
    // keep original behavior to crash so errors are visible during dev
    process.exit(1)
  }
}

export default connectDB
