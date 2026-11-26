-- CreateTable
CREATE TABLE "hotel_daily_inventories" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "roomTypeKey" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalRooms" INTEGER NOT NULL,
    "reservedRooms" INTEGER NOT NULL DEFAULT 0,
    "availableRooms" INTEGER NOT NULL,
    "priceOverrideMinor" INTEGER,
    "currency" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotel_daily_inventories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hotel_daily_inventories_hotelId_date_idx" ON "hotel_daily_inventories"("hotelId", "date");

-- CreateIndex
CREATE INDEX "hotel_daily_inventories_organizationId_date_idx" ON "hotel_daily_inventories"("organizationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "hotel_daily_inventories_hotelId_roomTypeKey_date_key" ON "hotel_daily_inventories"("hotelId", "roomTypeKey", "date");

-- AddForeignKey
ALTER TABLE "hotel_daily_inventories" ADD CONSTRAINT "hotel_daily_inventories_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_daily_inventories" ADD CONSTRAINT "hotel_daily_inventories_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
