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

    // Apply the filters
    this.query = this.query.find(finalQuery)
    return this
  }

  // 2. Sorting
  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').join(' ')
      this.query = this.query.sort(sortBy)
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
    const page = this.queryString.page * 1 || 1
    const limit = this.queryString.limit * 1 || 100
    const skip = (page - 1) * limit
    this.query = this.query.skip(skip).limit(limit)
    return this
  }
}

export default APIFeatures
