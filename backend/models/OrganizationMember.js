import mongoose from 'mongoose'
import {
  ORG_ROLES,
  MEMBERSHIP_ROLES,
} from '../utils/organizationPermissions.js'

const organizationMemberSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    orgRole: {
      type: String,
      enum: ORG_ROLES,
      default: 'staff',
    },
    permissions: [{ type: String }],
    membershipRoles: [
      {
        type: String,
        enum: MEMBERSHIP_ROLES,
      },
    ],
    status: {
      type: String,
      enum: ['active', 'invited', 'suspended', 'removed'],
      default: 'active',
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
)

organizationMemberSchema.index({ organizationId: 1, userId: 1 }, { unique: true })
organizationMemberSchema.index({ userId: 1, status: 1 })

const OrganizationMember = mongoose.model(
  'OrganizationMember',
  organizationMemberSchema
)

export default OrganizationMember
