import mongoose from 'mongoose'

/**
 * Server-side active organization preference (not stored in JWT).
 */
const userOrganizationPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    activeOrganizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
    },
  },
  { timestamps: true }
)

const UserOrganizationPreference = mongoose.model(
  'UserOrganizationPreference',
  userOrganizationPreferenceSchema
)

export default UserOrganizationPreference
