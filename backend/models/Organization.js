import mongoose from 'mongoose'
import { geoPointSchema } from './schemas/geoPoint.js'
import { contactInfoSchema } from './schemas/contactInfo.js'
import { mediaItemSchema } from './schemas/mediaItem.js'
import { PROVIDER_TYPES } from '../utils/organizationPermissions.js'

const verificationDocumentSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    url: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },
  },
  { _id: false }
)

const providerVerificationSchema = new mongoose.Schema(
  {
    legalName: { type: String },
    registrationNumber: { type: String },
    taxId: { type: String },
    licenseType: { type: String },
    licenseNumber: { type: String },
    licenseExpiry: { type: Date },
    responsiblePerson: {
      name: String,
      title: String,
      phone: String,
      email: String,
      idDocumentUrl: String,
    },
    businessDocuments: [verificationDocumentSchema],
    contactVerification: {
      emailVerified: { type: Boolean, default: false },
      phoneVerified: { type: Boolean, default: false },
      verifiedAt: Date,
    },
    physicalOfficeVerified: { type: Boolean, default: false },
    providerSpecific: { type: mongoose.Schema.Types.Mixed, default: {} },
    adminReview: {
      notes: String,
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reviewedAt: Date,
    },
  },
  { _id: false }
)

const organizationSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    previousSlugs: [
      {
        slug: { type: String, required: true },
        changedAt: { type: Date, default: Date.now },
      },
    ],
    name: { type: String, required: true, trim: true },
    legalName: { type: String, trim: true },
    providerTypes: [
      {
        type: String,
        enum: PROVIDER_TYPES,
        required: true,
      },
    ],
    logo: { type: String },
    coverImage: { type: String },
    gallery: [mediaItemSchema],
    portfolioPhotos: [mediaItemSchema],
    description: { type: String, default: '' },
    shortDescription: { type: String, default: '' },
    uniqueSellingPoints: [{ type: String }],
    services: [{ type: String }],
    yearsInBusiness: { type: Number, min: 0 },
    location: geoPointSchema,
    contact: contactInfoSchema,
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    visibility: {
      type: String,
      enum: ['private', 'public'],
      default: 'private',
    },
    approvalStatus: {
      type: String,
      enum: [
        'draft',
        'submitted',
        'under_review',
        'approved',
        'rejected',
        'suspended',
        'inactive',
      ],
      default: 'draft',
    },
    approvedVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProviderVersion',
      default: null,
    },
    latestVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProviderVersion',
      default: null,
    },
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    verification: {
      type: providerVerificationSchema,
      default: () => ({}),
    },
    legacyCreatedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    suspendedAt: Date,
    suspendedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    suspensionReason: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
)

organizationSchema.index({ providerTypes: 1, approvalStatus: 1, visibility: 1 })
organizationSchema.index({ ownerUserId: 1 })
organizationSchema.index(
  { 'location.coordinates': '2dsphere' },
  {
    sparse: true,
    partialFilterExpression: {
      'location.coordinates': { $exists: true, $type: 'array' },
    },
  }
)

/** Public marketplace listings — approved + public only. */
organizationSchema.statics.publicMarketplaceFilter = function publicMarketplaceFilter() {
  return {
    approvalStatus: 'approved',
    visibility: 'public',
    approvedVersionId: { $ne: null },
  }
}

const Organization = mongoose.model('Organization', organizationSchema)

export default Organization
