/**
 * Serialize booking-domain Prisma rows to Mongo-compatible API shapes (`_id`).
 */
export function toApiDeparture(row) {
  if (!row) return null
  return {
    _id: row.id,
    id: row.id,
    tourId: row.tourId,
    organizationId: row.organizationId,
    departureDate: row.departureDate,
    returnDate: row.returnDate ?? undefined,
    capacity: row.capacity,
    availableSpots: row.availableSpots,
    status: row.status,
    packages: row.packages || [],
    notes: row.notes ?? '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function toApiHold(row) {
  if (!row) return null
  const travelDate =
    row.travelDate instanceof Date
      ? row.travelDate.toISOString().slice(0, 10)
      : row.travelDate
        ? String(row.travelDate).slice(0, 10)
        : undefined
  return {
    _id: row.id,
    id: row.id,
    bookingId: row.bookingId,
    departureId: row.departureId ?? undefined,
    hotelId: row.hotelId ?? undefined,
    roomTypeKey: row.roomTypeKey ?? undefined,
    nights: Array.isArray(row.nights) ? row.nights : row.nights ?? undefined,
    transportId: row.transportId ?? undefined,
    routeKey: row.routeKey ?? undefined,
    travelDate,
    organizationId: row.organizationId ?? undefined,
    quantity: row.quantity,
    status: row.status,
    expiresAt: row.expiresAt ?? undefined,
    releasedAt: row.releasedAt ?? undefined,
    releaseReason: row.releaseReason ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function toApiBooking(row) {
  if (!row) return null
  const notes = (row.providerNotes || []).map((n) => ({
    _id: n.id,
    note: n.note,
    createdBy: n.createdById,
    createdAt: n.createdAt,
  }))
  return {
    _id: row.id,
    id: row.id,
    user: row.userId,
    bookingFlowVersion: row.bookingFlowVersion,
    bookingType: row.bookingType,
    bookingItem: row.bookingItemId,
    organizationId: row.organizationId ?? undefined,
    departureId: row.departureId ?? undefined,
    packageKey: row.packageKey ?? undefined,
    priceSnapshot: row.priceSnapshot ?? undefined,
    paymentId: row.paymentId ?? undefined,
    inventoryReserved: row.inventoryReserved,
    inventoryReleasedAt: row.inventoryReleasedAt ?? undefined,
    inventoryQuantity: row.inventoryQuantity ?? undefined,
    bookingDetails: row.bookingDetails || {},
    contactInfo: row.contactInfo,
    payment: row.legacyPayment ?? undefined,
    status: row.status,
    fulfillmentStatus: row.fulfillmentStatus,
    fulfillmentConfirmedAt: row.fulfillmentConfirmedAt ?? undefined,
    checkedInAt: row.checkedInAt ?? undefined,
    fulfillmentCompletedAt: row.fulfillmentCompletedAt ?? undefined,
    noShowAt: row.noShowAt ?? undefined,
    expiresAt: row.expiresAt ?? undefined,
    confirmedAt: row.confirmedAt ?? undefined,
    cancelledAt: row.cancelledAt ?? undefined,
    idempotencyKey: row.idempotencyKey ?? undefined,
    cancellationReason: row.cancellationReason ?? undefined,
    notes: row.notes ?? undefined,
    providerNotes: notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function toApiPayment(row) {
  if (!row) return null
  return {
    _id: row.id,
    id: row.id,
    bookingId: row.bookingId,
    organizationId: row.organizationId,
    amountMinor: row.amountMinor,
    amountRefundedMinor: row.amountRefundedMinor,
    currency: row.currency,
    status: row.status,
    provider: row.provider,
    providerPaymentId: row.providerPaymentId ?? undefined,
    idempotencyKey: row.idempotencyKey ?? undefined,
    expiresAt: row.expiresAt ?? undefined,
    metadata: row.metadata || {},
    completedAt: row.completedAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function toApiPaymentAttempt(row) {
  if (!row) return null
  return {
    _id: row.id,
    id: row.id,
    paymentId: row.paymentId,
    attemptNumber: row.attemptNumber,
    status: row.status,
    providerReference: row.providerReference ?? undefined,
    failureCode: row.failureCode ?? undefined,
    failureMessage: row.failureMessage ?? undefined,
    rawProviderResponse: row.rawProviderResponse ?? undefined,
    createdAt: row.createdAt,
  }
}

export function toApiRefund(row) {
  if (!row) return null
  return {
    _id: row.id,
    id: row.id,
    bookingId: row.bookingId,
    paymentId: row.paymentId,
    userId: row.userId,
    organizationId: row.organizationId,
    amountMinor: row.amountMinor,
    currency: row.currency,
    provider: row.provider,
    status: row.status,
    reason: row.reason,
    idempotencyKey: row.idempotencyKey ?? undefined,
    providerRefundId: row.providerRefundId ?? undefined,
    failureCode: row.failureCode ?? undefined,
    failureMessage: row.failureMessage ?? undefined,
    requestedAt: row.requestedAt,
    processingAt: row.processingAt ?? undefined,
    completedAt: row.completedAt ?? undefined,
    failedAt: row.failedAt ?? undefined,
    metadata: row.metadata || {},
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function toApiWebhookEvent(row) {
  if (!row) return null
  return {
    _id: row.id,
    id: row.id,
    provider: row.provider,
    eventId: row.eventId,
    eventType: row.eventType,
    receivedAt: row.receivedAt,
    processedAt: row.processedAt ?? undefined,
    status: row.status,
    paymentId: row.paymentId ?? undefined,
    payloadHash: row.payloadHash ?? undefined,
    metadata: row.metadata || {},
    failureCode: row.failureCode ?? undefined,
    failureMessage: row.failureMessage ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function toApiAudit(row) {
  if (!row) return null
  return {
    _id: row.id,
    id: row.id,
    bookingId: row.bookingId,
    organizationId: row.organizationId,
    actorUserId: row.actorUserId,
    action: row.action,
    previousFulfillmentStatus: row.previousFulfillmentStatus ?? undefined,
    newFulfillmentStatus: row.newFulfillmentStatus ?? undefined,
    metadata: row.metadata ?? undefined,
    createdAt: row.createdAt,
  }
}

export default {
  toApiDeparture,
  toApiHold,
  toApiBooking,
  toApiPayment,
  toApiPaymentAttempt,
  toApiRefund,
  toApiWebhookEvent,
  toApiAudit,
}
