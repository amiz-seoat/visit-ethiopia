import mongoose from 'mongoose'

const providerVersionSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    versionNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'approved', 'rejected', 'superseded'],
      default: 'draft',
    },
    snapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    verificationSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    changedFields: [{ type: String }],
    requiresReapproval: { type: Boolean, default: false },
    reapprovalFields: [{ type: String }],
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    submittedAt: Date,
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: Date,
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    rejectedAt: Date,
    rejectionReason: String,
    frozenAt: Date,
  },
  { timestamps: true }
)

providerVersionSchema.index(
  { organizationId: 1, versionNumber: 1 },
  { unique: true }
)
providerVersionSchema.index({ organizationId: 1, status: 1 })
providerVersionSchema.index({ status: 1, submittedAt: -1 })

providerVersionSchema.pre('save', function preventFrozenSnapshotMutation(next) {
  if (this.isNew) return next()
  if (
    this.frozenAt &&
    (this.isModified('snapshot') || this.isModified('verificationSnapshot')) &&
    !this.isModified('frozenAt')
  ) {
    return next(new Error('Cannot modify frozen version snapshot'))
  }
  next()
})

const ProviderVersion = mongoose.model('ProviderVersion', providerVersionSchema)

export default ProviderVersion
