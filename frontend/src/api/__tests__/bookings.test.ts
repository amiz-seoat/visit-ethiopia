import { describe, expect, it, vi, beforeEach } from 'vitest'

const { post, get, patch } = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
}))

vi.mock('../../services/api', () => ({
  __esModule: true,
  default: { post, get, patch },
  getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : 'error'),
}))

import { createTourBooking, cancelBooking, getBookingById } from '../../api/bookings'
import { confirmPayment } from '../../api/payments'

describe('booking API client', () => {
  beforeEach(() => {
    post.mockReset()
    get.mockReset()
    patch.mockReset()
  })

  it('createTourBooking sends Idempotency-Key and server-owned fields only', async () => {
    post.mockResolvedValue({
      status: 201,
      data: {
        status: 'success',
        idempotent: false,
        data: { _id: 'b1', bookingFlowVersion: 'v2', status: 'payment_pending' },
      },
    })

    const payload = {
      departureId: 'd1',
      packageKey: 'standard',
      quantity: 2,
      contactInfo: { fullName: 'A', email: 'a@b.com', phone: '1' },
    }
    const result = await createTourBooking(payload, 'tour-book-abc12345')

    expect(post).toHaveBeenCalledWith('/bookings/tours', payload, {
      headers: { 'Idempotency-Key': 'tour-book-abc12345' },
    })
    expect(result.statusCode).toBe(201)
    expect(result.booking._id).toBe('b1')
  })

  it('createTourBooking treats 200 as idempotent replay', async () => {
    post.mockResolvedValue({
      status: 200,
      data: {
        status: 'success',
        idempotent: true,
        data: { _id: 'b1', bookingFlowVersion: 'v2' },
      },
    })
    const result = await createTourBooking(
      {
        departureId: 'd1',
        packageKey: 'standard',
        quantity: 1,
        contactInfo: { fullName: 'A', email: 'a@b.com', phone: '1' },
      },
      'key-1'
    )
    expect(result.idempotent).toBe(true)
    expect(result.statusCode).toBe(200)
  })

  it('confirmPayment posts to payments confirm', async () => {
    post.mockResolvedValue({
      status: 200,
      data: {
        status: 'success',
        failed: false,
        data: {
          payment: { _id: 'p1', status: 'completed', amountMinor: 1000, currency: 'ETB' },
          booking: { _id: 'b1', status: 'confirmed', bookingFlowVersion: 'v2' },
        },
      },
    })
    const result = await confirmPayment('p1', { idempotencyKey: 'pay-1' })
    expect(post).toHaveBeenCalledWith(
      '/payments/p1/confirm',
      {},
      { headers: { 'Idempotency-Key': 'pay-1' } }
    )
    expect(result.payment.status).toBe('completed')
    expect(result.booking.status).toBe('confirmed')
  })

  it('confirmPayment surfaces failed mock outcome', async () => {
    post.mockResolvedValue({
      status: 200,
      data: {
        failed: true,
        data: {
          payment: { _id: 'p1', status: 'failed' },
          booking: { _id: 'b1', status: 'failed' },
        },
      },
    })
    const result = await confirmPayment('p1', { mockOutcome: 'fail' })
    expect(result.failed).toBe(true)
    expect(post.mock.calls[0][2].headers['X-Mock-Payment-Outcome']).toBe('fail')
  })

  it('getBookingById returns booking payload', async () => {
    get.mockResolvedValue({
      data: { status: 'success', data: { _id: 'b1', status: 'confirmed' } },
    })
    const booking = await getBookingById('b1')
    expect(get).toHaveBeenCalledWith('/bookings/b1')
    expect(booking._id).toBe('b1')
  })

  it('cancelBooking sends Idempotency-Key for paid cancel', async () => {
    patch.mockResolvedValue({
      data: {
        status: 'success',
        failed: false,
        data: { _id: 'b1', status: 'cancelled' },
        refund: { status: 'completed', amountMinor: 5000, currency: 'ETB' },
      },
    })
    const result = await cancelBooking('b1', {
      reason: 'customer_request',
      idempotencyKey: 'cancel-key',
    })
    expect(patch).toHaveBeenCalledWith(
      '/bookings/b1/cancel',
      { reason: 'customer_request' },
      { headers: { 'Idempotency-Key': 'cancel-key' } }
    )
    expect(result.refund?.status).toBe('completed')
  })
})
