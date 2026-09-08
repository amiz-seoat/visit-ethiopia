import User from '../models/User.js'
import Tour from '../models/Tour.js'
import Hotel from '../models/Hotel.js'
import Transport from '../models/Transport.js'
import Restaurant from '../models/Restaurants.js'
import Booking from '../models/Booking.js'
import Review from '../models/Review.js'
import Destination from '../models/Destination.js'
import Contact from '../models/Contact.js'
import catchAsync from '../utils/catchAsync.js'

export const getStats = catchAsync(async (req, res) => {
  const [
    usersTotal,
    customerCount,
    tourOperatorCount,
    hotelManagerCount,
    transportManagerCount,
    adminCount,
    toursTotal,
    toursActive,
    toursDraft,
    hotelsTotal,
    hotelsActive,
    transportsTotal,
    transportsActive,
    restaurantsTotal,
    restaurantsActive,
    bookingsTotal,
    bookingsPending,
    bookingsConfirmed,
    bookingsCancelled,
    bookingsCompleted,
    reviewsTotal,
    reviewsPending,
    reviewsApproved,
    reviewsRejected,
    destinationsTotal,
    contactsTotal,
    contactsNew,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: { $in: ['user', 'customer'] } }),
    User.countDocuments({ role: { $in: ['guide', 'tour_operator'] } }),
    User.countDocuments({ role: 'hotel_manager' }),
    User.countDocuments({ role: 'transport_manager' }),
    User.countDocuments({ role: 'admin' }),
    Tour.countDocuments(),
    Tour.countDocuments({ status: 'active' }),
    Tour.countDocuments({ status: 'draft' }),
    Hotel.countDocuments(),
    Hotel.countDocuments({ status: 'active' }),
    Transport.countDocuments(),
    Transport.countDocuments({ status: 'active' }),
    Restaurant.countDocuments(),
    Restaurant.countDocuments({ status: 'active' }),
    Booking.countDocuments(),
    Booking.countDocuments({ status: 'pending' }),
    Booking.countDocuments({ status: 'confirmed' }),
    Booking.countDocuments({ status: 'cancelled' }),
    Booking.countDocuments({ status: 'completed' }),
    Review.countDocuments(),
    Review.countDocuments({ status: 'pending' }),
    Review.countDocuments({ status: 'approved' }),
    Review.countDocuments({ status: 'rejected' }),
    Destination.countDocuments(),
    Contact.countDocuments(),
    Contact.countDocuments({ status: 'new' }),
  ])

  res.status(200).json({
    users: {
      total: usersTotal,
      byRole: {
        customer: customerCount,
        tour_operator: tourOperatorCount,
        hotel_manager: hotelManagerCount,
        transport_manager: transportManagerCount,
        admin: adminCount,
      },
    },
    tours: { total: toursTotal, active: toursActive, draft: toursDraft },
    hotels: { total: hotelsTotal, active: hotelsActive },
    transports: { total: transportsTotal, active: transportsActive },
    restaurants: { total: restaurantsTotal, active: restaurantsActive },
    bookings: {
      total: bookingsTotal,
      pending: bookingsPending,
      confirmed: bookingsConfirmed,
      cancelled: bookingsCancelled,
      completed: bookingsCompleted,
    },
    reviews: {
      total: reviewsTotal,
      pending: reviewsPending,
      approved: reviewsApproved,
      rejected: reviewsRejected,
    },
    destinations: { total: destinationsTotal },
    contacts: { total: contactsTotal, new: contactsNew },
  })
})
