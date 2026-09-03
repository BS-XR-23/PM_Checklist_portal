-- AlterEnum
ALTER TYPE "ModuleName" ADD VALUE 'DEPENDENCIES';

-- CreateTable
CREATE TABLE "DependencyItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT,
    "description" TEXT NOT NULL,
    "preferredFormat" TEXT,
    "responsible" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "expectedDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Due',
    "notes" TEXT,

    CONSTRAINT "DependencyItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DependencyItem_projectId_idx" ON "DependencyItem"("projectId");

-- AddForeignKey
ALTER TABLE "DependencyItem" ADD CONSTRAINT "DependencyItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
