import Contact from '../models/Contact.js'
import catchAsync from '../utils/catchAsync.js'
import AppError from '../utils/appError.js'
import factory from './handlerFactory.js'
import { isPrismaApp } from '../utils/databaseMode.js'
import * as catalogWrite from '../repositories/prisma/catalogWriteRepository.js'

export const test = catchAsync(async (req, res) => {
  res.status(201).json({
    status: 'success',
    message: 'test file',
  })
})

// 👉 Submit new contact form
export const createContact = catchAsync(async (req, res, next) => {
  if (isPrismaApp()) {
    const contact = await catalogWrite.createContact(req.body)
    return res.status(201).json({
      status: 'success',
      data: contact,
    })
  }

  const contact = await Contact.create(req.body)

  res.status(201).json({
    status: 'success',
    data: contact,
  })
})

const mongooseGetAllContacts = factory.getAll(Contact)
const mongooseGetContact = factory.getOne(Contact)

// List all inquiries (admin only)
export const getAllContacts = catchAsync(async (req, res, next) => {
  if (isPrismaApp()) {
    const docs = await catalogWrite.findContacts(req.query)
    return res.status(200).json({
      status: 'success',
      results: docs.length,
      data: { data: docs },
    })
  }
  return mongooseGetAllContacts(req, res, next)
})

// Get a single inquiry (admin only)
export const getContact = catchAsync(async (req, res, next) => {
  if (isPrismaApp()) {
    const contact = await catalogWrite.findContactById(req.params.id)
    if (!contact) {
      return next(new AppError('No document found with that ID', 404))
    }
    return res.status(200).json({
      status: 'success',
      data: { data: contact },
    })
  }
  return mongooseGetContact(req, res, next)
})

export const updateContactStatus = catchAsync(async (req, res, next) => {
  const allowed = ['new', 'in_progress', 'resolved', 'spam']
  if (!req.body.status || !allowed.includes(req.body.status)) {
    return next(new AppError('Invalid contact status', 400))
  }

  if (isPrismaApp()) {
    const contact = await catalogWrite.updateContact(req.params.id, {
      status: req.body.status,
    })
    if (!contact) {
      return next(new AppError('No document found with that ID', 404))
    }
    return res.status(200).json({
      status: 'success',
      data: { data: contact },
    })
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
