/**
 * Start Visit Ethiopia API against an in-memory MongoDB with seed data.
 * Usage: node scripts/startWithMemoryDb.js
 */
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config({ path: './config.env' })

process.env.NODE_ENV = 'development'
// Prefer a dedicated port so we don't fight unrelated apps (e.g. kiln on 5000).
process.env.PORT = process.env.VISIT_ETHIOPIA_PORT || '4002'
process.env.JWT_SECRET = process.env.JWT_SECRET || 'visit-ethiopia-dev-secret'
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '90d'
process.env.JWT_COOKIE_EXPIRES_IN = process.env.JWT_COOKIE_EXPIRES_IN || '90'
process.env.BACKEND_URL = `http://localhost:${process.env.PORT}`
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5200'
process.env.ALLOW_START_WITHOUT_DB = 'false'

const mongod = await MongoMemoryServer.create()
const uri = mongod.getUri('visit-ethiopia')
process.env.DATABASE = uri
const __dirname = path.dirname(fileURLToPath(import.meta.url))
fs.writeFileSync(path.join(__dirname, '..', '.memory-db-uri'), uri, 'utf8')
console.log('Memory MongoDB started')

await mongoose.connect(uri)
console.log('Connected to memory MongoDB')

const User = (await import('../models/User.js')).default
const Tour = (await import('../models/Tour.js')).default
const Hotel = (await import('../models/Hotel.js')).default
const Destination = (await import('../models/Destination.js')).default
const Transport = (await import('../models/Transport.js')).default
const Restaurant = (await import('../models/Restaurants.js')).default
const News = (await import('../models/News.js')).default
const Review = (await import('../models/Review.js')).default
const Contact = (await import('../models/Contact.js')).default

const admin = await User.create({
  FirstName: 'Admin',
  LastName: 'User',
  email: 'admin@visitethiopia.test',
  password: 'AdminPass123!',
  passwordConfirm: 'AdminPass123!',
  role: 'admin',
  isVerified: true,
})

const customer = await User.create({
  FirstName: 'Customer',
  LastName: 'One',
  email: 'customer@visitethiopia.test',
  password: 'CustomerPass123!',
  passwordConfirm: 'CustomerPass123!',
  role: 'user',
  isVerified: true,
})

const guide = await User.create({
  FirstName: 'Guide',
  LastName: 'One',
  email: 'guide@visitethiopia.test',
  password: 'GuidePass123!',
  passwordConfirm: 'GuidePass123!',
  role: 'guide',
  isVerified: true,
})

const tourOperator = await User.create({
  FirstName: 'Tour',
  LastName: 'Operator',
  email: 'operator@visitethiopia.test',
  password: 'OperatorPass123!',
  passwordConfirm: 'OperatorPass123!',
  role: 'tour_operator',
  isVerified: true,
})

const hotelManager = await User.create({
  FirstName: 'Hotel',
  LastName: 'Manager',
  email: 'hotelmgr@visitethiopia.test',
  password: 'HotelMgrPass123!',
  passwordConfirm: 'HotelMgrPass123!',
  role: 'hotel_manager',
  isVerified: true,
})

const transportManager = await User.create({
  FirstName: 'Transport',
  LastName: 'Manager',
  email: 'transportmgr@visitethiopia.test',
  password: 'TransportMgrPass123!',
  passwordConfirm: 'TransportMgrPass123!',
  role: 'transport_manager',
  isVerified: true,
})

const tourOperatorB = await User.create({
  FirstName: 'Tour',
  LastName: 'OperatorB',
  email: 'operatorb@visitethiopia.test',
  password: 'OperatorBPass123!',
  passwordConfirm: 'OperatorBPass123!',
  role: 'tour_operator',
  isVerified: true,
})

const hotelManagerB = await User.create({
  FirstName: 'Hotel',
  LastName: 'ManagerB',
  email: 'hotelmgrb@visitethiopia.test',
  password: 'HotelMgrBPass123!',
  passwordConfirm: 'HotelMgrBPass123!',
  role: 'hotel_manager',
  isVerified: true,
})

const transportManagerB = await User.create({
  FirstName: 'Transport',
  LastName: 'ManagerB',
  email: 'transportmgrb@visitethiopia.test',
  password: 'TransportMgrBPass123!',
  passwordConfirm: 'TransportMgrBPass123!',
  role: 'transport_manager',
  isVerified: true,
})

void tourOperatorB
void hotelManagerB
void transportManagerB

const destination = await Destination.create({
  name: 'Lalibela',
  description: 'Rock-hewn churches of Lalibela, a UNESCO World Heritage site.',
  shortDescription: 'Ancient rock churches',
  region: 'Amhara',
  location: { coordinates: { lat: 12.0317, lng: 39.0476 }, address: 'Lalibela, Ethiopia' },
  attractions: ['Bet Giyorgis', 'Bet Medhane Alem'],
  coverImage: 'https://images.unsplash.com/photo-1563514227147-6d2e624f82b8?w=800',
  images: ['https://images.unsplash.com/photo-1563514227147-6d2e624f82b8?w=800'],
  isFeatured: true,
  status: 'active',
})

const tour = await Tour.create({
  title: 'Historic Northern Circuit',
  description: 'Explore Lalibela, Axum, and Gondar on a guided cultural tour.',
  shortDescription: 'Culture and history across northern Ethiopia',
  duration: { days: 8, nights: 7 },
  destinations: ['Lalibela', 'Axum', 'Gondar'],
  categories: ['cultural', 'historical'],
  difficulty: 'moderate',
  price: 25000,
  discount: 0,
  coverImage: 'https://images.unsplash.com/photo-1563514227147-6d2e624f82b8?w=800',
  images: ['https://images.unsplash.com/photo-1563514227147-6d2e624f82b8?w=800'],
  availableDates: [new Date(Date.now() + 14 * 86400000), new Date(Date.now() + 30 * 86400000)],
  maxGroupSize: 12,
  inclusions: ['Guide', 'Breakfast'],
  exclusions: ['Flights'],
  itinerary: [
    { day: 1, title: 'Arrive Addis', description: 'Airport transfer and briefing' },
    { day: 2, title: 'Fly to Lalibela', description: 'Visit rock churches' },
  ],
  createdBy: tourOperator._id,
  guides: [guide._id],
  averageRating: 4.5,
  isFeatured: true,
  status: 'active',
})

const tourB = await Tour.create({
  title: 'Operator B Private Trek',
  description: 'Owned by operator B for ownership tests.',
  shortDescription: 'Private trek',
  duration: { days: 3, nights: 2 },
  destinations: ['Simien'],
  categories: ['adventure'],
  difficulty: 'challenging',
  price: 12000,
  coverImage: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800',
  availableDates: [new Date(Date.now() + 21 * 86400000)],
  maxGroupSize: 6,
  itinerary: [{ day: 1, title: 'Start', description: 'Trailhead' }],
  createdBy: tourOperatorB._id,
  status: 'active',
})

destination.tours = [tour._id, tourB._id]
await destination.save()

const hotel = await Hotel.create({
  name: 'Mountain View Lodge',
  description: 'Comfortable lodge near the churches.',
  shortDescription: 'Scenic lodge in Lalibela',
  location: {
    address: 'Near Main Street',
    city: 'Lalibela',
    region: 'Amhara',
    coordinates: { lat: 12.03, lng: 39.04 },
  },
  stars: 4,
  amenities: ['WiFi', 'Restaurant'],
  roomTypes: [
    {
      type: 'Standard',
      description: 'Double room',
      price: 3500,
      capacity: 2,
      availableRooms: 8,
    },
  ],
  coverImage: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
  contact: { phone: '+251911000000', email: 'lodge@example.com' },
  createdBy: hotelManager._id,
  averageRating: 4.2,
  isFeatured: true,
  status: 'active',
})

const hotelB = await Hotel.create({
  name: 'Operator B Hotel',
  description: 'Owned by hotel manager B.',
  shortDescription: 'B hotel',
  location: { address: 'Axum Rd', city: 'Axum', region: 'Tigray' },
  stars: 3,
  roomTypes: [
    { type: 'Standard', price: 2000, capacity: 2, availableRooms: 4 },
  ],
  coverImage: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
  contact: { phone: '+251911000001', email: 'b@example.com' },
  createdBy: hotelManagerB._id,
  status: 'active',
})

const transport = await Transport.create({
  name: 'Addis Express Shuttle',
  description: 'Comfortable coach service between major cities.',
  type: 'bus',
  routes: [
    {
      from: 'Addis Ababa',
      to: 'Bahir Dar',
      departureTime: '07:00',
      arrivalTime: '15:00',
      duration: '8h',
      price: 800,
      availableSeats: 40,
    },
  ],
  vehicleDetails: { model: 'Coach X1', capacity: 40, images: [] },
  contact: { phone: '+251911111111', email: 'transport@example.com' },
  createdBy: transportManager._id,
  averageRating: 4.0,
  status: 'active',
})

const transportB = await Transport.create({
  name: 'Manager B Coaches',
  description: 'Owned by transport manager B.',
  type: 'bus',
  routes: [
    {
      from: 'Gondar',
      to: 'Lalibela',
      departureTime: '06:00',
      arrivalTime: '14:00',
      price: 600,
      availableSeats: 30,
    },
  ],
  contact: { phone: '+251911111112' },
  createdBy: transportManagerB._id,
  status: 'active',
})

const restaurant = await Restaurant.create({
  name: 'Injera House',
  description: 'Traditional Ethiopian cuisine.',
  shortDescription: 'Authentic local food',
  cuisineType: ['Ethiopian'],
  location: {
    address: 'Bole Road',
    city: 'Addis Ababa',
    region: 'Addis Ababa',
  },
  priceRange: '$$',
  coverImage: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800',
  contact: { phone: '+251922222222', email: 'injera@example.com' },
  menu: [
    {
      category: 'Mains',
      items: [{ name: 'Doro Wat', description: 'Chicken stew', price: 450 }],
    },
  ],
  createdBy: admin._id,
  averageRating: 4.3,
  isFeatured: true,
  status: 'active',
})

const news = await News.create({
  title: 'New Northern Circuit Dates Announced',
  summary: 'Book early for the dry season.',
  content: 'Full article content about upcoming tour dates and tips for travelers.',
  coverImage: 'https://images.unsplash.com/photo-1504512485720-7d83a16ee930?w=800',
  author: admin._id,
  category: 'tourism',
  tags: ['tours', 'north'],
  isFeatured: true,
  status: 'published',
})

await Review.create({
  user: customer._id,
  itemType: 'tour',
  itemId: tour._id,
  rating: 5,
  title: 'Amazing experience',
  comment: 'Loved every day of the tour.',
  status: 'approved',
})

await Contact.create({
  name: 'Seed Contact',
  email: 'seed@example.com',
  subject: 'Question',
  message: 'Do you offer private tours?',
  status: 'new',
})

customer.favorites = [tour._id]
await customer.save({ validateBeforeSave: false })

console.log('Seed complete:')
console.log('  admin@visitethiopia.test / AdminPass123!')
console.log('  customer@visitethiopia.test / CustomerPass123!')
console.log('  guide@visitethiopia.test / GuidePass123!')
console.log('  operator@visitethiopia.test / OperatorPass123!')
console.log('  operatorb@visitethiopia.test / OperatorBPass123!')
console.log('  hotelmgr@visitethiopia.test / HotelMgrPass123!')
console.log('  hotelmgrb@visitethiopia.test / HotelMgrBPass123!')
console.log('  transportmgr@visitethiopia.test / TransportMgrPass123!')
console.log('  transportmgrb@visitethiopia.test / TransportMgrBPass123!')
console.log('  ids:', {
  tour: tour._id.toString(),
  tourB: tourB._id.toString(),
  hotel: hotel._id.toString(),
  hotelB: hotelB._id.toString(),
  destination: destination._id.toString(),
  transport: transport._id.toString(),
  transportB: transportB._id.toString(),
  restaurant: restaurant._id.toString(),
  news: news._id.toString(),
})

const app = (await import('../app.js')).default
const PORT = Number(process.env.PORT) || 4000

app.listen(PORT, () => {
  console.log(`Visit Ethiopia API (memory DB) on http://localhost:${PORT}`)
})

process.on('SIGINT', async () => {
  await mongoose.disconnect()
  await mongod.stop()
  process.exit(0)
})
