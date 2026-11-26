-- AlterTable
ALTER TABLE "inventory_holds" ADD COLUMN     "routeKey" TEXT,
ADD COLUMN     "transportId" TEXT,
ADD COLUMN     "travelDate" DATE;

-- CreateTable
CREATE TABLE "transport_route_inventories" (
    "id" TEXT NOT NULL,
    "transportId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "routeKey" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalSeats" INTEGER NOT NULL,
    "reservedSeats" INTEGER NOT NULL DEFAULT 0,
    "availableSeats" INTEGER NOT NULL,
    "priceOverrideMinor" INTEGER,
    "currency" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transport_route_inventories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_holds_transportId_status_idx" ON "inventory_holds"("transportId", "status");

-- CreateIndex
CREATE INDEX "transport_route_inventories_transportId_date_idx" ON "transport_route_inventories"("transportId", "date");

-- CreateIndex
CREATE INDEX "transport_route_inventories_organizationId_date_idx" ON "transport_route_inventories"("organizationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "transport_route_inventories_transportId_routeKey_date_key" ON "transport_route_inventories"("transportId", "routeKey", "date");

-- AddForeignKey
ALTER TABLE "transport_route_inventories" ADD CONSTRAINT "transport_route_inventories_transportId_fkey" FOREIGN KEY ("transportId") REFERENCES "transports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_route_inventories" ADD CONSTRAINT "transport_route_inventories_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_holds" ADD CONSTRAINT "inventory_holds_transportId_fkey" FOREIGN KEY ("transportId") REFERENCES "transports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
