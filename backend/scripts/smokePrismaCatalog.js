import * as cat from '../repositories/prisma/catalogRepository.js'
import prisma from '../config/prisma.js'

const tours = await cat.findPublicTours({ status: 'active', limit: '10' })
const dests = await cat.findDestinations({ status: 'active' })
const hotels = await cat.findHotels({ status: 'active' })
const transports = await cat.findTransports({ status: 'active' })
const restaurants = await cat.findRestaurants({ status: 'active' })
const news = await cat.findNews({})
const tour = await cat.findPublicTourByIdOrSlug('historic-northern-circuit')
const byId = await cat.findPublicTourByIdOrSlug('a20000000000000000000002')
const bad = await cat.findPublicTourByIdOrSlug('ffffffffffffffffffffffff')
const reviews = await cat.findApprovedReviews('tour', 'a20000000000000000000002')

console.log(
  JSON.stringify(
    {
      tours: tours.length,
      tourHas_id: Boolean(tours[0]?._id),
      tourLeaksId: Object.prototype.hasOwnProperty.call(tours[0] || {}, 'id'),
      dests: dests.length,
      hotels: hotels.length,
      transports: transports.length,
      restaurants: restaurants.length,
      news: news.length,
      slugOk: tour?.slug,
      byIdOk: byId?._id,
      badNull: bad === null,
      reviews: reviews.length,
      destTours: dests[0]?.tours?.length,
    },
    null,
    2
  )
)

await prisma.$disconnect()
