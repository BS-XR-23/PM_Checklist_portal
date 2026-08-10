-- CreateTable
CREATE TABLE "ChecklistTemplateItem" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "stage" TEXT NOT NULL,
    "itemText" TEXT NOT NULL,
    "milestoneName" TEXT,

    CONSTRAINT "ChecklistTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistTemplateItem_type_order_key" ON "ChecklistTemplateItem"("type", "order");
