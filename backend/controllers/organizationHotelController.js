import Hotel from '../models/Hotel.js'
import AppError from '../utils/appError.js'
import catchAsync from '../utils/catchAsync.js'
import { isPrismaApp } from '../utils/databaseMode.js'
import * as catalogWrite from '../repositories/prisma/catalogWriteRepository.js'
import {
  publishHotel,
  unpublishHotel,
  normalizeHotelRoomTypes,
} from '../services/hotelLifecycleService.js'
import {
  listHotelInventory,
  upsertHotelInventory,
  updateHotelInventory,
} from '../services/hotelInventoryService.js'

function assertOrgHotel(hotel, organizationId) {
  if (!hotel) throw new AppError('Hotel not found', 404)
  const hotelOrgId = hotel.organizationId?.toString?.() ?? hotel.organizationId
  if (String(hotelOrgId) !== String(organizationId)) {
    throw new AppError('Hotel does not belong to this organization', 403)
  }
}

/** Force org ownership from validated context; never trust client organizationId. */
function normalizeOrgHotelInput(body, organization, { forCreate = false } = {}) {
  const payload = { ...(body || {}) }
  delete payload.organizationId
  delete payload.createdBy
  delete payload.createdById
  delete payload._id
  delete payload.id
  // Status only via publish/unpublish endpoints
  delete payload.status
  payload.organizationId = organization._id || organization.id
  if (forCreate) {
    payload.status = 'draft'
  }
  if (payload.roomTypes !== undefined) {
    payload.roomTypes = normalizeHotelRoomTypes(payload.roomTypes)
  }
  return payload
}

async function loadOrgHotel(req) {
  const hotel = isPrismaApp()
    ? await catalogWrite.findHotelById(req.params.id || req.params.hotelId)
    : await Hotel.findById(req.params.id || req.params.hotelId)
  assertOrgHotel(hotel, req.params.organizationId)
  return hotel
}

export const listOrganizationHotels = catchAsync(async (req, res) => {
  const { organizationId } = req.params

  if (isPrismaApp()) {
    const hotels = await catalogWrite.listOrgHotels(organizationId, {
      status: req.query.status,
    })
    return res.status(200).json({
      status: 'success',
      results: hotels.length,
      data: { data: hotels },
    })
  }

  const filter = { organizationId }
  if (req.query.status) filter.status = req.query.status
  const hotels = await Hotel.find(filter).sort('-updatedAt')
  res.status(200).json({
    status: 'success',
    results: hotels.length,
    data: { data: hotels },
  })
})

export const getOrganizationHotel = catchAsync(async (req, res, next) => {
  try {
    const hotel = await loadOrgHotel(req)
    res.status(200).json({ status: 'success', data: { data: hotel } })
  } catch (e) {
    return next(e)
  }
})

export const createOrganizationHotel = catchAsync(async (req, res, next) => {
  const organization = req.organization
  if (!organization.providerTypes?.includes('hotel')) {
    return next(
      new AppError('Only hotel organizations can manage hotels', 403)
    )
  }

  const payload = normalizeOrgHotelInput(req.body, organization, {
    forCreate: true,
  })
  payload.createdBy = req.user.id

  if (isPrismaApp()) {
    const hotel = await catalogWrite.createHotel(payload)
    return res.status(201).json({ status: 'success', data: { data: hotel } })
  }

  const hotel = await Hotel.create(payload)
  res.status(201).json({ status: 'success', data: { data: hotel } })
})

export const updateOrganizationHotel = catchAsync(async (req, res, next) => {
  let hotel
  try {
    hotel = await loadOrgHotel(req)
  } catch (e) {
    return next(e)
  }

  const payload = normalizeOrgHotelInput(req.body, req.organization)

  if (isPrismaApp()) {
    const updated = await catalogWrite.updateHotel(
      req.params.id || req.params.hotelId,
      payload
    )
    return res.status(200).json({ status: 'success', data: { data: updated } })
  }

  Object.assign(hotel, payload)
  await hotel.save()
  res.status(200).json({ status: 'success', data: { data: hotel } })
})

export const deleteOrganizationHotel = catchAsync(async (req, res, next) => {
  try {
    await loadOrgHotel(req)
  } catch (e) {
    return next(e)
  }

  if (isPrismaApp()) {
    await catalogWrite.deleteHotel(req.params.id)
  } else {
    await Hotel.findByIdAndDelete(req.params.id)
  }

  res.status(204).json({ status: 'success', data: null })
})

export const publishOrganizationHotel = catchAsync(async (req, res, next) => {
  let hotel
  try {
    hotel = await loadOrgHotel(req)
  } catch (e) {
    return next(e)
  }
  try {
    const updated = await publishHotel(hotel)
    res.status(200).json({ status: 'success', data: { data: updated } })
  } catch (e) {
    return next(new AppError(e.message, e.statusCode || 409))
  }
})

export const unpublishOrganizationHotel = catchAsync(async (req, res, next) => {
  let hotel
  try {
    hotel = await loadOrgHotel(req)
  } catch (e) {
    return next(e)
  }
  try {
    const updated = await unpublishHotel(hotel)
    res.status(200).json({ status: 'success', data: { data: updated } })
  } catch (e) {
    return next(new AppError(e.message, e.statusCode || 409))
  }
})

export const listOrganizationHotelInventory = catchAsync(
  async (req, res, next) => {
    let hotel
    try {
      hotel = await loadOrgHotel(req)
    } catch (e) {
      return next(e)
    }
    try {
      const rows = await listHotelInventory(hotel, req.query)
      res.status(200).json({
        status: 'success',
        results: rows.length,
        data: { data: rows },
      })
    } catch (e) {
      return next(e)
    }
  }
)

export const upsertOrganizationHotelInventory = catchAsync(
  async (req, res, next) => {
    let hotel
    try {
      hotel = await loadOrgHotel(req)
    } catch (e) {
      return next(e)
    }
    try {
      const row = await upsertHotelInventory(hotel, req.body)
      res.status(201).json({ status: 'success', data: { data: row } })
    } catch (e) {
      return next(e)
    }
  }
)

export const updateOrganizationHotelInventory = catchAsync(
  async (req, res, next) => {
    let hotel
    try {
      hotel = await loadOrgHotel(req)
    } catch (e) {
      return next(e)
    }
    try {
      const row = await updateHotelInventory(
        hotel,
        req.params.inventoryId,
        req.body
      )
      res.status(200).json({ status: 'success', data: { data: row } })
    } catch (e) {
      return next(e)
    }
  }
)

export default {
  listOrganizationHotels,
  getOrganizationHotel,
  createOrganizationHotel,
  updateOrganizationHotel,
  deleteOrganizationHotel,
  publishOrganizationHotel,
  unpublishOrganizationHotel,
  listOrganizationHotelInventory,
  upsertOrganizationHotelInventory,
  updateOrganizationHotelInventory,
}
