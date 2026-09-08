import { escapeRegex } from './escapeRegex.js'

const MAX_PAGE_LIMIT = 100
const SORT_FIELD_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/

class APIFeatures {
  constructor(query, queryString) {
    this.query = query
    this.queryString = queryString
  }

  // 1. Filtering (Basic + Advanced + Price Range)
  filter() {
    // Copy the query params
    const queryObj = { ...this.queryString }

    // Exclude fields that are not filters
    const excludeFields = [
      'page',
      'sort',
      'limit',
      'fields',
      'minPrice',
      'maxPrice',
      'search',
    ]
    excludeFields.forEach((el) => delete queryObj[el])

    // Convert operators like gte, lte into MongoDB format
    let queryStr = JSON.stringify(queryObj)
    queryStr = queryStr.replace(
      /\b(gt|gte|lt|lte|ne)\b/g,
      (match) => `$${match}`
    )

    // Parse back to JSON
    const finalQuery = JSON.parse(queryStr)

    // Handle price range filtering if minPrice or maxPrice are provided
    if (this.queryString.minPrice || this.queryString.maxPrice) {
      finalQuery.price = {}
      if (this.queryString.minPrice)
        finalQuery.price.$gte = Number(this.queryString.minPrice)
      if (this.queryString.maxPrice)
        finalQuery.price.$lte = Number(this.queryString.maxPrice)
    }

    // Text search across common display fields
    if (this.queryString.search) {
      const term = escapeRegex(String(this.queryString.search).trim())
      if (term) {
        const regex = { $regex: term, $options: 'i' }
        finalQuery.$or = [
          { title: regex },
          { name: regex },
          { shortDescription: regex },
          { description: regex },
        ]
      }
    }

    // Apply the filters
    this.query = this.query.find(finalQuery)
    return this
  }

  // 2. Sorting
  sort() {
    if (this.queryString.sort) {
      const safe = this.queryString.sort
        .split(',')
        .map((part) => part.trim())
        .filter((part) => {
          const field = part.replace(/^-/, '')
          return SORT_FIELD_PATTERN.test(field)
        })
      if (safe.length) {
        this.query = this.query.sort(safe.join(' '))
      } else {
        this.query = this.query.sort('-createdAt')
      }
    } else {
      this.query = this.query.sort('-createdAt')
    }
    return this
  }

  // 3. Field Limiting
  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ')
      this.query = this.query.select(fields)
    } else {
      this.query = this.query.select('-__v')
    }
    return this
  }

  // 4. Pagination
  paginate() {
    const page = Math.max(1, Number(this.queryString.page) || 1)
    const requested = Number(this.queryString.limit) || 100
    const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, requested))
    const skip = (page - 1) * limit
    this.query = this.query.skip(skip).limit(limit)
    return this
  }
}

export default APIFeatures
