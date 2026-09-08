import dotenv from 'dotenv'
import fs from 'fs'
import app from './app.js'
import connectDB from './config/db.js'

if (process.env.NODE_ENV !== 'production') {
  // First try the normal dotenv.config
  const result = dotenv.config({ path: './config.env' })
  console.log('dotenv.config result:', result && result.parsed ? Object.keys(result.parsed).length + ' vars' : result)

  // If dotenv didn't parse variables (some environments may behave differently),
  // fall back to manual parsing and assign to process.env so the app can use them.
  try {
    if ((!result || !result.parsed) && fs.existsSync('./config.env')) {
      const raw = fs.readFileSync('./config.env', 'utf8')
      const parsed = dotenv.parse(raw)
      console.log('Manual dotenv.parse found', Object.keys(parsed).length, 'vars')
      Object.keys(parsed).forEach((k) => {
        if (!process.env[k]) process.env[k] = parsed[k]
      })
    }
  } catch (err) {
    console.log('Manual dotenv parse failed:', err && err.message)
  }
}

// Debug: show important env vars before connecting
console.log('DEBUG env: NODE_ENV=', process.env.NODE_ENV, 'PORT=', process.env.PORT)
console.log('DEBUG env: DATABASE=', process.env.DATABASE ? '[present]' : '[missing]', 'MONGO_URI=', process.env.MONGO_URI ? '[present]' : '[missing]')

// ✅ Use environment variable for port with a fallback (Render sets PORT)
const PORT = process.env.PORT || 3000

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`)
})

// ✅ Connect to MongoDB once when the function is initialized
connectDB()

// ✅ Export app instead of listening to a port
export default app
