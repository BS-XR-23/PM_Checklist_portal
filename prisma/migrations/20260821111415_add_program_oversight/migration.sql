-- CreateTable
CREATE TABLE "ProgramOversight" (
    "id" TEXT NOT NULL,
    "programManagerId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramOversight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProgramOversight_projectId_idx" ON "ProgramOversight"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramOversight_programManagerId_projectId_key" ON "ProgramOversight"("programManagerId", "projectId");

-- AddForeignKey
ALTER TABLE "ProgramOversight" ADD CONSTRAINT "ProgramOversight_programManagerId_fkey" FOREIGN KEY ("programManagerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramOversight" ADD CONSTRAINT "ProgramOversight_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
