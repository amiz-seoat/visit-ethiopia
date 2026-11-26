-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'customer', 'admin', 'guide', 'tour_operator', 'hotel_manager', 'transport_manager');

-- CreateEnum
CREATE TYPE "OrgVisibility" AS ENUM ('private', 'public');

-- CreateEnum
CREATE TYPE "OrgApprovalStatus" AS ENUM ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'suspended', 'inactive');

-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('travel_company', 'hotel', 'tour_bus_provider', 'bus_company');

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('owner', 'admin', 'manager', 'staff', 'viewer');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('tour_operator', 'hotel_manager', 'tour_bus_provider', 'bus_company_manager');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('active', 'invited', 'suspended', 'removed');

-- CreateEnum
CREATE TYPE "ProviderVersionStatus" AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'superseded');

-- CreateEnum
CREATE TYPE "ApprovalRequestType" AS ENUM ('initial_approval', 'reapproval', 'update');

-- CreateEnum
CREATE TYPE "ApprovalRequestStatus" AS ENUM ('pending', 'processing', 'approved', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "TourCategory" AS ENUM ('cultural', 'adventure', 'nature', 'historical', 'religious');

-- CreateEnum
CREATE TYPE "TourDifficulty" AS ENUM ('easy', 'moderate', 'challenging');

-- CreateEnum
CREATE TYPE "TourStatus" AS ENUM ('draft', 'published', 'unpublished', 'archived', 'active', 'inactive');

-- CreateEnum
CREATE TYPE "DepartureStatus" AS ENUM ('scheduled', 'open', 'full', 'cancelled', 'completed');

-- CreateEnum
CREATE TYPE "CatalogStatus" AS ENUM ('active', 'inactive', 'draft');

-- CreateEnum
CREATE TYPE "DestinationStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "TransportType" AS ENUM ('air', 'bus', 'train', 'private_vehicle', 'boat');

-- CreateEnum
CREATE TYPE "NewsCategory" AS ENUM ('tourism', 'culture', 'event', 'business', 'general');

-- CreateEnum
CREATE TYPE "NewsStatus" AS ENUM ('published', 'draft', 'archived');

-- CreateEnum
CREATE TYPE "ReviewItemType" AS ENUM ('tour', 'hotel', 'transport', 'restaurant');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('approved', 'pending', 'rejected');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('new', 'in_progress', 'resolved', 'spam');

-- CreateEnum
CREATE TYPE "BookingFlowVersion" AS ENUM ('legacy', 'v2');

-- CreateEnum
CREATE TYPE "BookingType" AS ENUM ('tour', 'hotel', 'transport', 'restaurant');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pending', 'confirmed', 'cancelled', 'completed', 'payment_pending', 'failed', 'expired', 'partially_refunded');

-- CreateEnum
CREATE TYPE "FulfillmentStatus" AS ENUM ('pending', 'confirmed', 'checked_in', 'completed', 'no_show', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded', 'partially_refunded');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('mock');

-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('pending', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "InventoryHoldStatus" AS ENUM ('pending', 'held', 'released', 'consumed', 'expired');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('pending', 'processed', 'failed');

-- CreateEnum
CREATE TYPE "BookingAuditAction" AS ENUM ('check_in', 'complete', 'no_show', 'add_note', 'fulfillment_confirmed');

-- CreateEnum
CREATE TYPE "MediaItemType" AS ENUM ('logo', 'cover', 'gallery', 'portfolio');

-- CreateEnum
CREATE TYPE "DocVerificationStatus" AS ENUM ('pending', 'verified', 'rejected');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "FirstName" TEXT NOT NULL,
    "LastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "passwordChangedAt" TIMESTAMP(3),
    "passwordResetToken" TEXT,
    "passwordResetExpires" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_favorites" (
    "userId" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,

    CONSTRAINT "user_favorites_pkey" PRIMARY KEY ("userId","tourId")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "providerTypes" "ProviderType"[],
    "logo" TEXT,
    "coverImage" TEXT,
    "gallery" JSONB NOT NULL DEFAULT '[]',
    "portfolioPhotos" JSONB NOT NULL DEFAULT '[]',
    "description" TEXT NOT NULL DEFAULT '',
    "shortDescription" TEXT NOT NULL DEFAULT '',
    "uniqueSellingPoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "services" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "yearsInBusiness" INTEGER,
    "location" JSONB,
    "contact" JSONB,
    "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "visibility" "OrgVisibility" NOT NULL DEFAULT 'private',
    "approvalStatus" "OrgApprovalStatus" NOT NULL DEFAULT 'draft',
    "approvedVersionId" TEXT,
    "latestVersionId" TEXT,
    "ownerUserId" TEXT NOT NULL,
    "verification" JSONB NOT NULL DEFAULT '{}',
    "legacyCreatedByUserId" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "suspendedBy" TEXT,
    "suspensionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_previous_slugs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_previous_slugs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgRole" "OrgRole" NOT NULL DEFAULT 'staff',
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "membershipRoles" "MembershipRole"[] DEFAULT ARRAY[]::"MembershipRole"[],
    "status" "MemberStatus" NOT NULL DEFAULT 'active',
    "invitedBy" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_organization_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activeOrganizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_organization_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_versions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "ProviderVersionStatus" NOT NULL DEFAULT 'draft',
    "snapshot" JSONB NOT NULL,
    "verificationSnapshot" JSONB NOT NULL DEFAULT '{}',
    "changedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiresReapproval" BOOLEAN NOT NULL DEFAULT false,
    "reapprovalFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "submittedBy" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "frozenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "providerVersionId" TEXT NOT NULL,
    "requestType" "ApprovalRequestType" NOT NULL DEFAULT 'initial_approval',
    "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'pending',
    "submittedBy" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "adminNotes" TEXT,
    "verificationChecklist" JSONB NOT NULL DEFAULT '[]',
    "providerTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "changedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiresReapproval" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tours" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "description" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "uniqueSellingPoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "duration_days" INTEGER NOT NULL,
    "duration_nights" INTEGER NOT NULL,
    "destinations" TEXT[],
    "startingLocation" JSONB,
    "destinationLocations" JSONB NOT NULL DEFAULT '[]',
    "categories" "TourCategory"[] DEFAULT ARRAY[]::"TourCategory"[],
    "difficulty" "TourDifficulty" NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "priceMinor" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "coverImage" TEXT NOT NULL,
    "gallery" JSONB NOT NULL DEFAULT '[]',
    "portfolioPhotos" JSONB NOT NULL DEFAULT '[]',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "availableDates" TIMESTAMP(3)[] DEFAULT ARRAY[]::TIMESTAMP(3)[],
    "maxGroupSize" INTEGER NOT NULL,
    "currentBookings" INTEGER NOT NULL DEFAULT 0,
    "inclusions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "exclusions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "policies" JSONB NOT NULL DEFAULT '{}',
    "packages" JSONB NOT NULL DEFAULT '[]',
    "itinerary" JSONB NOT NULL DEFAULT '[]',
    "createdBy" TEXT NOT NULL,
    "organizationId" TEXT,
    "secretTour" BOOLEAN NOT NULL DEFAULT false,
    "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "status" "TourStatus" NOT NULL DEFAULT 'active',
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_guides" (
    "tourId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "tour_guides_pkey" PRIMARY KEY ("tourId","userId")
);

-- CreateTable
CREATE TABLE "tour_departures" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "departureDate" TIMESTAMP(3) NOT NULL,
    "returnDate" TIMESTAMP(3),
    "capacity" INTEGER NOT NULL,
    "availableSpots" INTEGER NOT NULL,
    "status" "DepartureStatus" NOT NULL DEFAULT 'open',
    "packages" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tour_departures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "location" JSONB NOT NULL,
    "stars" INTEGER,
    "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "roomTypes" JSONB NOT NULL DEFAULT '[]',
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "coverImage" TEXT NOT NULL,
    "contact" JSONB NOT NULL,
    "policies" JSONB NOT NULL DEFAULT '{}',
    "createdBy" TEXT NOT NULL,
    "organizationId" TEXT,
    "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "status" "CatalogStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transports" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "TransportType" NOT NULL,
    "vehicleDetails" JSONB NOT NULL DEFAULT '{}',
    "routes" JSONB NOT NULL DEFAULT '[]',
    "contact" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "organizationId" TEXT,
    "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "CatalogStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "cuisineType" TEXT[],
    "location" JSONB NOT NULL,
    "openingHours" JSONB NOT NULL DEFAULT '{}',
    "priceRange" TEXT,
    "menu" JSONB NOT NULL DEFAULT '[]',
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "coverImage" TEXT NOT NULL,
    "contact" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "status" "CatalogStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "destinations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "location" JSONB NOT NULL,
    "attractions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bestTimeToVisit" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "coverImage" TEXT NOT NULL,
    "climate" TEXT,
    "localCuisine" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "status" "DestinationStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "destinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "destination_tours" (
    "destinationId" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,

    CONSTRAINT "destination_tours_pkey" PRIMARY KEY ("destinationId","tourId")
);

-- CreateTable
CREATE TABLE "destination_hotels" (
    "destinationId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,

    CONSTRAINT "destination_hotels_pkey" PRIMARY KEY ("destinationId","hotelId")
);

-- CreateTable
CREATE TABLE "news" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "category" "NewsCategory",
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "coverImage" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "author" TEXT NOT NULL,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "status" "NewsStatus" NOT NULL DEFAULT 'published',
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "itemType" "ReviewItemType" NOT NULL,
    "itemId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "comment" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dateOfExperience" TIMESTAMP(3),
    "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ContactStatus" NOT NULL DEFAULT 'new',
    "response" TEXT,
    "respondedBy" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "bookingFlowVersion" "BookingFlowVersion" NOT NULL DEFAULT 'legacy',
    "bookingType" "BookingType" NOT NULL,
    "bookingItem" TEXT NOT NULL,
    "organizationId" TEXT,
    "departureId" TEXT,
    "packageKey" TEXT,
    "priceSnapshot" JSONB,
    "paymentId" TEXT,
    "inventoryReserved" BOOLEAN NOT NULL DEFAULT false,
    "inventoryReleasedAt" TIMESTAMP(3),
    "inventoryQuantity" INTEGER,
    "bookingDetails" JSONB NOT NULL DEFAULT '{}',
    "contactInfo" JSONB NOT NULL,
    "payment" JSONB,
    "status" "BookingStatus" NOT NULL DEFAULT 'pending',
    "fulfillmentStatus" "FulfillmentStatus" NOT NULL DEFAULT 'pending',
    "fulfillmentConfirmedAt" TIMESTAMP(3),
    "checkedInAt" TIMESTAMP(3),
    "fulfillmentCompletedAt" TIMESTAMP(3),
    "noShowAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "idempotencyKey" TEXT,
    "cancellationReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_provider_notes" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_provider_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "amountRefundedMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "provider" "PaymentProvider" NOT NULL DEFAULT 'mock',
    "providerPaymentId" TEXT,
    "idempotencyKey" TEXT,
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_attempts" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'pending',
    "providerReference" TEXT,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "rawProviderResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "provider" "PaymentProvider" NOT NULL DEFAULT 'mock',
    "status" "RefundStatus" NOT NULL DEFAULT 'pending',
    "reason" TEXT NOT NULL DEFAULT 'customer_cancelled',
    "idempotencyKey" TEXT,
    "providerRefundId" TEXT,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_holds" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "departureId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "InventoryHoldStatus" NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "releaseReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'pending',
    "paymentId" TEXT,
    "payloadHash" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_operation_audits" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" "BookingAuditAction" NOT NULL,
    "previousFulfillmentStatus" TEXT,
    "newFulfillmentStatus" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_operation_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_approvedVersionId_key" ON "organizations"("approvedVersionId");

-- CreateIndex
CREATE INDEX "organizations_ownerUserId_idx" ON "organizations"("ownerUserId");

-- CreateIndex
CREATE INDEX "organizations_approvalStatus_visibility_idx" ON "organizations"("approvalStatus", "visibility");

-- CreateIndex
CREATE INDEX "organization_previous_slugs_organizationId_idx" ON "organization_previous_slugs"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_previous_slugs_slug_key" ON "organization_previous_slugs"("slug");

-- CreateIndex
CREATE INDEX "organization_members_userId_status_idx" ON "organization_members"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organizationId_userId_key" ON "organization_members"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_organization_preferences_userId_key" ON "user_organization_preferences"("userId");

-- CreateIndex
CREATE INDEX "provider_versions_organizationId_status_idx" ON "provider_versions"("organizationId", "status");

-- CreateIndex
CREATE INDEX "provider_versions_status_submittedAt_idx" ON "provider_versions"("status", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "provider_versions_organizationId_versionNumber_key" ON "provider_versions"("organizationId", "versionNumber");

-- CreateIndex
CREATE INDEX "approval_requests_organizationId_idx" ON "approval_requests"("organizationId");

-- CreateIndex
CREATE INDEX "approval_requests_providerVersionId_idx" ON "approval_requests"("providerVersionId");

-- CreateIndex
CREATE INDEX "approval_requests_status_submittedAt_idx" ON "approval_requests"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "tours_organizationId_status_idx" ON "tours"("organizationId", "status");

-- CreateIndex
CREATE INDEX "tours_status_isFeatured_idx" ON "tours"("status", "isFeatured");

-- CreateIndex
CREATE INDEX "tour_departures_tourId_departureDate_idx" ON "tour_departures"("tourId", "departureDate");

-- CreateIndex
CREATE INDEX "tour_departures_organizationId_status_departureDate_idx" ON "tour_departures"("organizationId", "status", "departureDate");

-- CreateIndex
CREATE INDEX "hotels_organizationId_status_idx" ON "hotels"("organizationId", "status");

-- CreateIndex
CREATE INDEX "transports_organizationId_status_idx" ON "transports"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "destinations_name_key" ON "destinations"("name");

-- CreateIndex
CREATE INDEX "reviews_itemType_itemId_idx" ON "reviews"("itemType", "itemId");

-- CreateIndex
CREATE INDEX "reviews_user_idx" ON "reviews"("user");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_paymentId_key" ON "bookings"("paymentId");

-- CreateIndex
CREATE INDEX "bookings_user_createdAt_idx" ON "bookings"("user", "createdAt");

-- CreateIndex
CREATE INDEX "bookings_departureId_status_idx" ON "bookings"("departureId", "status");

-- CreateIndex
CREATE INDEX "bookings_organizationId_status_createdAt_idx" ON "bookings"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "bookings_status_expiresAt_idx" ON "bookings"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "bookings_bookingFlowVersion_idx" ON "bookings"("bookingFlowVersion");

-- CreateIndex
CREATE INDEX "bookings_fulfillmentStatus_idx" ON "bookings"("fulfillmentStatus");

-- CreateIndex
CREATE INDEX "booking_provider_notes_bookingId_idx" ON "booking_provider_notes"("bookingId");

-- CreateIndex
CREATE INDEX "payments_bookingId_idx" ON "payments"("bookingId");

-- CreateIndex
CREATE INDEX "payments_organizationId_idx" ON "payments"("organizationId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_expiresAt_idx" ON "payments"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_paymentId_attemptNumber_key" ON "payment_attempts"("paymentId", "attemptNumber");

-- CreateIndex
CREATE INDEX "refunds_bookingId_idx" ON "refunds"("bookingId");

-- CreateIndex
CREATE INDEX "refunds_paymentId_status_idx" ON "refunds"("paymentId", "status");

-- CreateIndex
CREATE INDEX "refunds_userId_idx" ON "refunds"("userId");

-- CreateIndex
CREATE INDEX "refunds_organizationId_idx" ON "refunds"("organizationId");

-- CreateIndex
CREATE INDEX "inventory_holds_departureId_status_idx" ON "inventory_holds"("departureId", "status");

-- CreateIndex
CREATE INDEX "inventory_holds_status_expiresAt_idx" ON "inventory_holds"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "inventory_holds_organizationId_idx" ON "inventory_holds"("organizationId");

-- CreateIndex
CREATE INDEX "webhook_events_paymentId_idx" ON "webhook_events"("paymentId");

-- CreateIndex
CREATE INDEX "webhook_events_status_idx" ON "webhook_events"("status");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_eventId_key" ON "webhook_events"("provider", "eventId");

-- CreateIndex
CREATE INDEX "booking_operation_audits_bookingId_createdAt_idx" ON "booking_operation_audits"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "booking_operation_audits_organizationId_idx" ON "booking_operation_audits"("organizationId");

-- AddForeignKey
ALTER TABLE "user_favorites" ADD CONSTRAINT "user_favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_favorites" ADD CONSTRAINT "user_favorites_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_suspendedBy_fkey" FOREIGN KEY ("suspendedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_legacyCreatedByUserId_fkey" FOREIGN KEY ("legacyCreatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_approvedVersionId_fkey" FOREIGN KEY ("approvedVersionId") REFERENCES "provider_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_previous_slugs" ADD CONSTRAINT "organization_previous_slugs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_organization_preferences" ADD CONSTRAINT "user_organization_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_organization_preferences" ADD CONSTRAINT "user_organization_preferences_activeOrganizationId_fkey" FOREIGN KEY ("activeOrganizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_versions" ADD CONSTRAINT "provider_versions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_versions" ADD CONSTRAINT "provider_versions_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_versions" ADD CONSTRAINT "provider_versions_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_versions" ADD CONSTRAINT "provider_versions_rejectedBy_fkey" FOREIGN KEY ("rejectedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_providerVersionId_fkey" FOREIGN KEY ("providerVersionId") REFERENCES "provider_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tours" ADD CONSTRAINT "tours_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tours" ADD CONSTRAINT "tours_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_guides" ADD CONSTRAINT "tour_guides_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_guides" ADD CONSTRAINT "tour_guides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_departures" ADD CONSTRAINT "tour_departures_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_departures" ADD CONSTRAINT "tour_departures_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotels" ADD CONSTRAINT "hotels_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotels" ADD CONSTRAINT "hotels_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transports" ADD CONSTRAINT "transports_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transports" ADD CONSTRAINT "transports_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "destination_tours" ADD CONSTRAINT "destination_tours_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "destination_tours" ADD CONSTRAINT "destination_tours_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "destination_hotels" ADD CONSTRAINT "destination_hotels_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "destination_hotels" ADD CONSTRAINT "destination_hotels_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news" ADD CONSTRAINT "news_author_fkey" FOREIGN KEY ("author") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_fkey" FOREIGN KEY ("user") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_respondedBy_fkey" FOREIGN KEY ("respondedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_fkey" FOREIGN KEY ("user") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_departureId_fkey" FOREIGN KEY ("departureId") REFERENCES "tour_departures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_provider_notes" ADD CONSTRAINT "booking_provider_notes_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_provider_notes" ADD CONSTRAINT "booking_provider_notes_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_holds" ADD CONSTRAINT "inventory_holds_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_holds" ADD CONSTRAINT "inventory_holds_departureId_fkey" FOREIGN KEY ("departureId") REFERENCES "tour_departures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_holds" ADD CONSTRAINT "inventory_holds_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_operation_audits" ADD CONSTRAINT "booking_operation_audits_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_operation_audits" ADD CONSTRAINT "booking_operation_audits_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_operation_audits" ADD CONSTRAINT "booking_operation_audits_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
