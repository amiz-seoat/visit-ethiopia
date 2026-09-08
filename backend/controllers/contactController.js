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

export const updateContactStatus = catchAsync(async (req, res, next) => {
  const allowed = ['new', 'in_progress', 'resolved', 'spam']
  if (!req.body.status || !allowed.includes(req.body.status)) {
    return next(new AppError('Invalid contact status', 400))
  }

  const contact = await Contact.findByIdAndUpdate(
    req.params.id,
    { status: req.body.status },
    { new: true, runValidators: true }
  )

  if (!contact) {
    return next(new AppError('No document found with that ID', 404))
  }

  res.status(200).json({
    status: 'success',
    data: { data: contact },
  })
})
