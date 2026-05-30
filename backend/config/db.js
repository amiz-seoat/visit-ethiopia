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
    await mongoose.connect(dbUri, {
      serverSelectionTimeoutMS: 10000,
    })
    console.log('MongoDB connected successfully!')
  } catch (error) {
    console.error('MongoDB connection failed:', error.message || error)

    const msg = String(error.message || '')
    if (msg.includes('ENOTFOUND') || msg.includes('querySrv')) {
      console.error(
        '\nHint: The cluster hostname in DATABASE could not be resolved.\n' +
          '  → In MongoDB Atlas, open your cluster → Connect → Drivers and copy a fresh connection string.\n' +
          '  → Prefer the mongodb+srv://... format and paste it as DATABASE in backend/config.env.'
      )
    } else if (msg.includes('whitelist') || msg.includes('Server selection timed out')) {
      console.error(
        '\nHint: Atlas may be blocking this machine.\n' +
          '  → Atlas → Network Access → Add IP Address → add your current IP (or 0.0.0.0/0 for local dev only).'
      )
    }

    process.exit(1)
  }
}

export default connectDB
