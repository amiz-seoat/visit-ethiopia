/**
 * Provider workspace summary counts (organization-scoped).
 * Used by GET /organizations/:organizationId/workspace
 */
import { isPrismaIdentity, isPrismaApp } from '../utils/databaseMode.js'
import prisma from '../config/prisma.js'
import OrganizationMember from '../models/OrganizationMember.js'
import Tour from '../models/Tour.js'
import Hotel from '../models/Hotel.js'
import Transport from '../models/Transport.js'
import ApprovalRequest from '../models/ApprovalRequest.js'
import TourDeparture from '../models/TourDeparture.js'
import Booking from '../models/Booking.js'
import * as hotelInv from '../repositories/prisma/hotelInventoryRepository.js'
import { getActiveRoomTypeKeys } from './hotelLifecycleService.js'

export async function getProviderWorkspaceSummary(organizationId) {
  const orgId = String(organizationId)

  if (isPrismaIdentity() || isPrismaApp()) {
    const [
      memberCount,
      tourCount,
      hotelCount,
      transportCount,
      pendingApprovalCount,
      openDepartureCount,
      bookingCount,
      hotels,
      invStats,
    ] = await Promise.all([
      prisma.organizationMember.count({
        where: { organizationId: orgId, status: 'active' },
      }),
      prisma.tour.count({ where: { organizationId: orgId } }),
      prisma.hotel.count({ where: { organizationId: orgId } }),
      prisma.transport.count({ where: { organizationId: orgId } }),
      prisma.approvalRequest.count({
        where: { organizationId: orgId, status: 'pending' },
      }),
      prisma.tourDeparture.count({
        where: { organizationId: orgId, status: 'open' },
      }),
      prisma.booking.count({ where: { organizationId: orgId } }),
      prisma.hotel.findMany({
        where: { organizationId: orgId },
        select: { roomTypes: true },
      }),
      hotelInv.countInventoryStats(orgId),
    ])

    const activeRoomTypeCount = hotels.reduce((sum, h) => {
      return sum + getActiveRoomTypeKeys({ roomTypes: h.roomTypes }).length
    }, 0)

    return {
      memberCount,
      tourCount,
      hotelCount,
      transportCount,
      pendingApprovalCount,
      openDepartureCount,
      bookingCount,
      activeRoomTypeCount,
      inventoryDayCount: invStats.inventoryDayCount,
      lowAvailabilityDayCount: invStats.lowAvailabilityDayCount,
    }
  }

  const [
    memberCount,
    tourCount,
    hotelCount,
    transportCount,
    pendingApprovalCount,
    openDepartureCount,
    bookingCount,
  ] = await Promise.all([
    OrganizationMember.countDocuments({
      organizationId: orgId,
      status: 'active',
    }),
    Tour.countDocuments({ organizationId: orgId }),
    Hotel.countDocuments({ organizationId: orgId }),
    Transport.countDocuments({ organizationId: orgId }),
    ApprovalRequest.countDocuments({
      organizationId: orgId,
      status: 'pending',
    }),
    TourDeparture.countDocuments({
      organizationId: orgId,
      status: 'open',
    }),
    Booking.countDocuments({ organizationId: orgId }),
  ])

  return {
    memberCount,
    tourCount,
    hotelCount,
    transportCount,
    pendingApprovalCount,
    openDepartureCount,
    bookingCount,
    activeRoomTypeCount: 0,
    inventoryDayCount: 0,
    lowAvailabilityDayCount: 0,
  }
}

export default { getProviderWorkspaceSummary }
