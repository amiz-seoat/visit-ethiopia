import mongoose from 'mongoose'

const checklistItemSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    required: { type: Boolean, default: true },
    satisfied: { type: Boolean, default: false },
    note: String,
  },
  { _id: false }
)

const approvalRequestSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    providerVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProviderVersion',
      required: true,
      index: true,
    },
    requestType: {
      type: String,
      enum: ['initial_approval', 'reapproval', 'update'],
      default: 'initial_approval',
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: Date,
    rejectionReason: String,
    adminNotes: String,
    verificationChecklist: [checklistItemSchema],
    providerTypes: [{ type: String }],
    changedFields: [{ type: String }],
    requiresReapproval: { type: Boolean, default: false },
  },
  { timestamps: true }
)

approvalRequestSchema.index({ status: 1, submittedAt: -1 })
approvalRequestSchema.index(
  { providerVersionId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['pending', 'processing'] } },
  }
)

const ApprovalRequest = mongoose.model('ApprovalRequest', approvalRequestSchema)

export default ApprovalRequest
