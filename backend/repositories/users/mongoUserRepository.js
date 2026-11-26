import User from '../../models/User.js'

/** Mongoose-backed user store (default). Soft-delete via User pre(/^find/). */
export async function findByEmailForLogin(email) {
  const user = await User.findOne({ email: String(email).toLowerCase() }).select(
    '+password'
  )
  return user
}

export async function findById(id) {
  return User.findById(id)
}

export async function findByIdWithPassword(id) {
  return User.findById(id).select('+password')
}

export async function findByIdIncludingInactive(id) {
  return User.findOne({ _id: id }).setOptions({ skipActiveFilter: true })
}

export async function createUser(data) {
  return User.create(data)
}

export async function saveUser(user, options = {}) {
  return user.save(options)
}

export async function deleteById(id) {
  return User.findByIdAndDelete(id)
}

export async function findByResetToken(hashedToken) {
  return User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  })
}

export async function updateById(id, data) {
  return User.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  })
}

export async function softDelete(id) {
  return User.findByIdAndUpdate(id, { active: false })
}

export async function updateRole(id, role) {
  return User.findByIdAndUpdate(id, { role }, { new: true, runValidators: true })
}

export async function findByIdWithFavorites(id) {
  return User.findById(id).populate(
    'favorites',
    'title coverImage price averageRating'
  )
}

export async function updateProfile(id, filteredBody) {
  return User.findByIdAndUpdate(id, filteredBody, {
    new: true,
    runValidators: true,
  }).populate('favorites', 'title coverImage price averageRating')
}

export default {
  findByEmailForLogin,
  findById,
  findByIdWithPassword,
  createUser,
  saveUser,
  deleteById,
  findByResetToken,
  updateById,
  softDelete,
  updateRole,
  findByIdWithFavorites,
  updateProfile,
}
