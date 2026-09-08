import catchAsync from '../utils/catchAsync.js'
import AppError from '../utils/appError.js'
import {
  submitVersionForApproval,
  approveRequest,
  rejectRequest,
  suspendOrganization,
  reactivateOrganization,
  getApprovalRequestDetail,
  listApprovalRequests,
} from '../services/approvalService.js'

export const listPendingApprovals = catchAsync(async (req, res) => {
  const requests = await listApprovalRequests({
    status: req.query.status || 'pending',
    providerType: req.query.providerType,
  })

  res.status(200).json({
    status: 'success',
    results: requests.length,
    data: { data: requests },
  })
})

export const getApprovalDetail = catchAsync(async (req, res, next) => {
  const detail = await getApprovalRequestDetail(req.params.id)
  if (!detail) return next(new AppError('Approval request not found', 404))

  res.status(200).json({
    status: 'success',
    data: detail,
  })
})

export const approveApprovalRequest = catchAsync(async (req, res) => {
  const result = await approveRequest({
    approvalRequestId: req.params.id,
    adminUserId: req.user.id,
    adminNotes: req.body.adminNotes,
  })

  res.status(200).json({
    status: 'success',
    data: result,
  })
})

export const rejectApprovalRequest = catchAsync(async (req, res, next) => {
  if (!req.body.rejectionReason?.trim()) {
    return next(new AppError('rejectionReason is required', 400))
  }

  const result = await rejectRequest({
    approvalRequestId: req.params.id,
    adminUserId: req.user.id,
    rejectionReason: req.body.rejectionReason,
    adminNotes: req.body.adminNotes,
  })

  res.status(200).json({
    status: 'success',
    data: result,
  })
})

export const suspendOrg = catchAsync(async (req, res) => {
  const organization = await suspendOrganization({
    organizationId: req.params.organizationId,
    adminUserId: req.user.id,
    reason: req.body.reason,
  })

  res.status(200).json({
    status: 'success',
    data: { organization },
  })
})

export const reactivateOrg = catchAsync(async (req, res) => {
  const organization = await reactivateOrganization({
    organizationId: req.params.organizationId,
    adminUserId: req.user.id,
  })

  res.status(200).json({
    status: 'success',
    data: { organization },
  })
})

export default {
  listPendingApprovals,
  getApprovalDetail,
  approveApprovalRequest,
  rejectApprovalRequest,
  suspendOrg,
  reactivateOrg,
}
