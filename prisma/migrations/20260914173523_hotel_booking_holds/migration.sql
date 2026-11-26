-- DropForeignKey
ALTER TABLE "inventory_holds" DROP CONSTRAINT "inventory_holds_departureId_fkey";

-- DropForeignKey
ALTER TABLE "inventory_holds" DROP CONSTRAINT "inventory_holds_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_organizationId_fkey";

-- AlterTable
ALTER TABLE "inventory_holds" ADD COLUMN     "hotelId" TEXT,
ADD COLUMN     "nights" JSONB,
ADD COLUMN     "roomTypeKey" TEXT,
ALTER COLUMN "departureId" DROP NOT NULL,
ALTER COLUMN "organizationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "organizationId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "inventory_holds_hotelId_status_idx" ON "inventory_holds"("hotelId", "status");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_holds" ADD CONSTRAINT "inventory_holds_departureId_fkey" FOREIGN KEY ("departureId") REFERENCES "tour_departures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_holds" ADD CONSTRAINT "inventory_holds_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_holds" ADD CONSTRAINT "inventory_holds_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
