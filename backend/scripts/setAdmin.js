import dotenv from 'dotenv'
import mongoose from 'mongoose'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../config.env') })
dotenv.config({ path: path.join(__dirname, '../../frontend/.env') })

const email = process.argv[2]
if (!email) {
  console.error('Usage: node scripts/setAdmin.js <email>')
  process.exit(1)
}

const uri = process.env.DATABASE || process.env.MONGO_URI
if (!uri) {
  console.error('No DATABASE or MONGO_URI in environment')
  process.exit(1)
}

await mongoose.connect(uri)

const result = await mongoose.connection.collection('users').findOneAndUpdate(
  { email: email.toLowerCase() },
  { $set: { role: 'admin' } },
  { returnDocument: 'after' }
)

if (!result) {
  console.error('User not found:', email)
  process.exit(1)
}

console.log(
  `Promoted ${result.FirstName} ${result.LastName} (${result.email}) to admin`
)

await mongoose.disconnect()
