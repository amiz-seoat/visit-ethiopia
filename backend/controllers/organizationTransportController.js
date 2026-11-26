import Transport from '../models/Transport.js'
import AppError from '../utils/appError.js'
import catchAsync from '../utils/catchAsync.js'
import { isPrismaApp } from '../utils/databaseMode.js'
import * as catalogWrite from '../repositories/prisma/catalogWriteRepository.js'
import {
  publishTransport,
  unpublishTransport,
  normalizeTransportRoutes,
} from '../services/transportLifecycleService.js'
import {
  listTransportInventory,
  upsertTransportInventory,
  updateTransportInventory,
} from '../services/transportInventoryService.js'

const TRANSPORT_PROVIDER_TYPES = ['tour_bus_provider', 'bus_company']

function assertOrgTransport(transport, organizationId) {
  if (!transport) throw new AppError('Transport not found', 404)
  const transportOrgId =
    transport.organizationId?.toString?.() ?? transport.organizationId
  if (String(transportOrgId) !== String(organizationId)) {
    throw new AppError('Transport does not belong to this organization', 403)
  }
}

/** Force org ownership from validated context; never trust client organizationId. */
function normalizeOrgTransportInput(body, organization, { forCreate = false } = {}) {
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
  if (payload.routes !== undefined) {
    payload.routes = normalizeTransportRoutes(payload.routes)
  }
  return payload
}

function orgCanManageTransport(organization) {
  const types = organization.providerTypes || []
  return TRANSPORT_PROVIDER_TYPES.some((t) => types.includes(t))
}

async function loadOrgTransport(req) {
  const transport = isPrismaApp()
    ? await catalogWrite.findTransportById(
        req.params.id || req.params.transportId
      )
    : await Transport.findById(req.params.id || req.params.transportId)
  assertOrgTransport(transport, req.params.organizationId)
  return transport
}

export const listOrganizationTransports = catchAsync(async (req, res) => {
  const { organizationId } = req.params

  if (isPrismaApp()) {
    const transports = await catalogWrite.listOrgTransports(organizationId, {
      status: req.query.status,
    })
    return res.status(200).json({
      status: 'success',
      results: transports.length,
      data: { data: transports },
    })
  }

  const filter = { organizationId }
  if (req.query.status) filter.status = req.query.status
  const transports = await Transport.find(filter).sort('-updatedAt')
  res.status(200).json({
    status: 'success',
    results: transports.length,
    data: { data: transports },
  })
})

export const getOrganizationTransport = catchAsync(async (req, res, next) => {
  try {
    const transport = await loadOrgTransport(req)
    res.status(200).json({ status: 'success', data: { data: transport } })
  } catch (e) {
    return next(e)
  }
})

export const createOrganizationTransport = catchAsync(async (req, res, next) => {
  const organization = req.organization
  if (!orgCanManageTransport(organization)) {
    return next(
      new AppError(
        'Only tour bus / bus company organizations can manage transports',
        403
      )
    )
  }

  const payload = normalizeOrgTransportInput(req.body, organization, {
    forCreate: true,
  })
  payload.createdBy = req.user.id

  if (isPrismaApp()) {
    const transport = await catalogWrite.createTransport(payload)
    return res.status(201).json({ status: 'success', data: { data: transport } })
  }

  const transport = await Transport.create(payload)
  res.status(201).json({ status: 'success', data: { data: transport } })
})

export const updateOrganizationTransport = catchAsync(async (req, res, next) => {
  try {
    await loadOrgTransport(req)
  } catch (e) {
    return next(e)
  }

  const payload = normalizeOrgTransportInput(req.body, req.organization)

  if (isPrismaApp()) {
    const updated = await catalogWrite.updateTransport(req.params.id, payload)
    return res.status(200).json({ status: 'success', data: { data: updated } })
  }

  const transport = await Transport.findById(req.params.id)
  Object.assign(transport, payload)
  await transport.save()
  res.status(200).json({ status: 'success', data: { data: transport } })
})

export const deleteOrganizationTransport = catchAsync(async (req, res, next) => {
  try {
    await loadOrgTransport(req)
  } catch (e) {
    return next(e)
  }

  if (isPrismaApp()) {
    await catalogWrite.deleteTransport(req.params.id)
  } else {
    await Transport.findByIdAndDelete(req.params.id)
  }

  res.status(204).json({ status: 'success', data: null })
})

export const publishOrganizationTransport = catchAsync(async (req, res, next) => {
  try {
    const transport = await loadOrgTransport(req)
    const updated = await publishTransport(transport)
    res.status(200).json({ status: 'success', data: { data: updated } })
  } catch (e) {
    return next(e)
  }
})

export const unpublishOrganizationTransport = catchAsync(
  async (req, res, next) => {
    try {
      const transport = await loadOrgTransport(req)
      const updated = await unpublishTransport(transport)
      res.status(200).json({ status: 'success', data: { data: updated } })
    } catch (e) {
      return next(e)
    }
  }
)

export const listOrganizationTransportInventory = catchAsync(
  async (req, res, next) => {
    try {
      const transport = await loadOrgTransport(req)
      const inventory = await listTransportInventory(transport, {
        from: req.query.from,
        to: req.query.to,
        routeKey: req.query.routeKey,
      })
      res.status(200).json({
        status: 'success',
        results: inventory.length,
        data: { data: inventory },
      })
    } catch (e) {
      return next(e)
    }
  }
)

export const upsertOrganizationTransportInventory = catchAsync(
  async (req, res, next) => {
    try {
      const transport = await loadOrgTransport(req)
      const row = await upsertTransportInventory(transport, req.body)
      res.status(201).json({ status: 'success', data: { data: row } })
    } catch (e) {
      return next(e)
    }
  }
)

export const updateOrganizationTransportInventory = catchAsync(
  async (req, res, next) => {
    try {
      const transport = await loadOrgTransport(req)
      const row = await updateTransportInventory(
        transport,
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
  listOrganizationTransports,
  getOrganizationTransport,
  createOrganizationTransport,
  updateOrganizationTransport,
  deleteOrganizationTransport,
  publishOrganizationTransport,
  unpublishOrganizationTransport,
  listOrganizationTransportInventory,
  upsertOrganizationTransportInventory,
  updateOrganizationTransportInventory,
}
