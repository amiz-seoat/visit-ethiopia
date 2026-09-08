import { describe, expect, it } from 'vitest'
import { createIdempotencyKey, formatMinorAmount } from '../bookingHelpers'
import {
  availabilityLabel,
  previewPackageTotalMinor,
  validateTourBookingForm,
} from '../bookingValidation'
import { getErrorMessage } from '../../services/api'
import axios from 'axios'

describe('createIdempotencyKey', () => {
  it('generates unique keys', () => {
    const a = createIdempotencyKey('tour-book')
    const b = createIdempotencyKey('tour-book')
    expect(a).not.toEqual(b)
    expect(a.startsWith('tour-book-')).toBe(true)
    expect(a.length).toBeGreaterThanOrEqual(8)
    expect(a.length).toBeLessThanOrEqual(128)
  })
})

describe('formatMinorAmount', () => {
  it('formats minor units', () => {
    expect(formatMinorAmount(10000, 'ETB')).toContain('100')
    expect(formatMinorAmount(10000, 'ETB')).toContain('ETB')
  })
})

describe('availabilityLabel', () => {
  it('handles sold out, low, and normal', () => {
    expect(availabilityLabel(0)).toBe('Sold out')
    expect(availabilityLabel(2)).toMatch(/Only 2/)
    expect(availabilityLabel(12)).toBe('12 spots available')
  })
})

describe('validateTourBookingForm', () => {
  const base = {
    departureId: 'dep1',
    packageKey: 'standard',
    quantity: 2,
    contactInfo: {
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '+251900000000',
    },
  }

  it('requires authentication', () => {
    expect(
      validateTourBookingForm(base, { availableSpots: 5, isAuthenticated: false })
    ).toMatch(/sign in/i)
  })

  it('validates quantity against availability', () => {
    expect(
      validateTourBookingForm(
        { ...base, quantity: 6 },
        { availableSpots: 5, isAuthenticated: true }
      )
    ).toMatch(/Only 5/)
  })

  it('requires contact fields', () => {
    expect(
      validateTourBookingForm(
        { ...base, contactInfo: { ...base.contactInfo, phone: '' } },
        { availableSpots: 5, isAuthenticated: true }
      )
    ).toMatch(/Phone/)
  })

  it('passes when valid', () => {
    expect(
      validateTourBookingForm(base, { availableSpots: 5, isAuthenticated: true })
    ).toBeNull()
  })
})

describe('previewPackageTotalMinor', () => {
  it('is preview only math', () => {
    expect(previewPackageTotalMinor(15000, 3)).toBe(45000)
  })
})

describe('getErrorMessage booking statuses', () => {
  it('maps 401', () => {
    const err = new axios.AxiosError('Unauthorized')
    err.response = {
      status: 401,
      data: {},
      statusText: 'Unauthorized',
      headers: {},
      config: {} as never,
    }
    expect(getErrorMessage(err)).toMatch(/sign in/i)
  })

  it('maps 409 inventory', () => {
    const err = new axios.AxiosError('Conflict')
    err.response = {
      status: 409,
      data: { message: 'Not enough available spots' },
      statusText: 'Conflict',
      headers: {},
      config: {} as never,
    }
    expect(getErrorMessage(err)).toMatch(/spots|seats|inventory/i)
  })

  it('maps network errors', () => {
    const err = new axios.AxiosError('Network Error')
    expect(getErrorMessage(err)).toMatch(/couldn't reach|connection/i)
  })
})
