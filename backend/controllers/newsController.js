import News from '../models/News.js'
import catchAsync from '../utils/catchAsync.js'
import AppError from '../utils/appError.js'
import factory from './handlerFactory.js'
import { isPrismaCatalog } from '../utils/catalogDb.js'
import { isPrismaApp } from '../utils/databaseMode.js'
import * as newsRepo from '../repositories/prisma/newsRepository.js'
import * as catalogWrite from '../repositories/prisma/catalogWriteRepository.js'

export const test = catchAsync(async (req, res) => {
  res.status(201).json({
    status: 'success',
    message: 'test file',
  })
})

export const featuredNews = catchAsync(async (req, res, next) => {
  if (isPrismaCatalog()) {
    const news = await newsRepo.findFeatured(5)
    if (!news || news.length === 0) {
      return next(new AppError('No featured news found', 404))
    }
    return res.status(200).json({
      status: 'success',
      results: news.length,
      data: news,
    })
  }

  const news = await News.find({ isFeatured: true }).limit(5)
  if (!news || news.length === 0) {
    return next(new AppError('No featured news found', 404))
  }
  res.status(200).json({
    status: 'success',
    results: news.length,
    data: news,
  })
})

const mongooseGetAllNews = factory.getAll(News)
const mongooseDeleteNews = factory.deleteOne(News)

export const getAllNews = catchAsync(async (req, res, next) => {
  if (isPrismaCatalog()) {
    const docs = await newsRepo.findMany(req.query)
    return res.status(200).json({
      status: 'success',
      results: docs.length,
      data: { data: docs },
    })
  }
  return mongooseGetAllNews(req, res, next)
})

export const getNews = catchAsync(async (req, res, next) => {
  if (isPrismaCatalog()) {
    const news = await newsRepo.findByIdAndIncrementViews(req.params.id)
    if (!news) {
      return next(new AppError('No news found with that ID', 404))
    }
    return res.status(200).json({
      status: 'success',
      data: { data: news },
    })
  }

  const news = await News.findByIdAndUpdate(
    req.params.id,
    { $inc: { views: 1 } },
    { new: true }
  )

  if (!news) {
    return next(new AppError('No news found with that ID', 404))
  }

  res.status(200).json({
    status: 'success',
    data: { data: news },
  })
})

export const createNews = catchAsync(async (req, res, next) => {
  req.body.author = req.user.id

  if (isPrismaApp()) {
    const news = await catalogWrite.createNews(req.body)
    return res.status(201).json({
      status: 'success',
      data: news,
    })
  }

  const news = await News.create(req.body)

  res.status(201).json({
    status: 'success',
    data: news,
  })
})

// ✅ Update news (Admin only)
export const updateNews = catchAsync(async (req, res, next) => {
  if (req.body.author) {
    delete req.body.author
  }

  if (isPrismaApp()) {
    const doc = await catalogWrite.updateNews(req.params.id, req.body)
    if (!doc) {
      return next(new AppError('No news found with that ID', 404))
    }
    return res.status(200).json({
      status: 'success',
      data: { data: doc },
    })
  }

  const doc = await News.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  })

  if (!doc) {
    return next(new AppError('No news found with that ID', 404))
  }

  res.status(200).json({
    status: 'success',
    data: { data: doc },
  })
})

// ✅ Delete news (Admin only)
export const deleteNews = catchAsync(async (req, res, next) => {
  if (isPrismaApp()) {
    const ok = await catalogWrite.deleteNews(req.params.id)
    if (!ok) {
      return next(new AppError('No document found with that ID', 404))
    }
    return res.status(204).json({ status: 'success', data: null })
  }
  return mongooseDeleteNews(req, res, next)
})
