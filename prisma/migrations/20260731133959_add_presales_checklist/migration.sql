-- CreateTable
CREATE TABLE "PresalesChecklistTemplateItem" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "itemText" TEXT NOT NULL,

    CONSTRAINT "PresalesChecklistTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresalesChecklistItem" (
    "id" TEXT NOT NULL,
    "presalesProjectId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "itemText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "plannedDate" TIMESTAMP(3),
    "forecastDate" TIMESTAMP(3),
    "owner" TEXT,
    "ownerPersonId" TEXT,
    "notes" TEXT,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PresalesChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PresalesChecklistTemplateItem_order_key" ON "PresalesChecklistTemplateItem"("order");

-- CreateIndex
CREATE INDEX "PresalesChecklistItem_presalesProjectId_idx" ON "PresalesChecklistItem"("presalesProjectId");

-- AddForeignKey
ALTER TABLE "PresalesChecklistItem" ADD CONSTRAINT "PresalesChecklistItem_presalesProjectId_fkey" FOREIGN KEY ("presalesProjectId") REFERENCES "PresalesProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresalesChecklistItem" ADD CONSTRAINT "PresalesChecklistItem_ownerPersonId_fkey" FOREIGN KEY ("ownerPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
