import Contact from '../models/Contact.js'
import catchAsync from '../utils/catchAsync.js'
import AppError from '../utils/appError.js'
import factory from './handlerFactory.js'

export const test = catchAsync(async (req, res) => {
  res.status(201).json({
    status: 'success',
    message: 'test file',
  })
})

// 👉 Submit new contact form
export const createContact = catchAsync(async (req, res, next) => {
  const contact = await Contact.create(req.body)

  res.status(201).json({
    status: 'success',
    data: contact,
  })
})

// List all inquiries (admin only)
export const getAllContacts = factory.getAll(Contact)
// Get a single inquiry (admin only)
export const getContact = factory.getOne(Contact)
