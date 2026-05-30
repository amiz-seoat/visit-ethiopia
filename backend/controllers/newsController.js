import News from '../models/News.js'
import catchAsync from '../utils/catchAsync.js'
import AppError from '../utils/appError.js'
import factory from './handlerFactory.js'

export const test = catchAsync(async (req, res) => {
  res.status(201).json({
    status: 'success',
    message: 'test file',
  })
})

export const featuredNews = catchAsync(async (req, res, next) => {
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

export const getAllNews = factory.getAll(News)

export const getNews = catchAsync(async (req, res, next) => {
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
  // attach current user as author
  req.body.author = req.user.id

  const news = await News.create(req.body)

  res.status(201).json({
    status: 'success',
    data: news,
  })
})

// ✅ Update news (Admin only)
export const updateNews = catchAsync(async (req, res, next) => {
  // Prevent updating author field
  if (req.body.author) {
    delete req.body.author
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
export const deleteNews = factory.deleteOne(News)
