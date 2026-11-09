-- QMS Phase 2 (docs/QMS_PLAN.md): recurring checklist items log each occurrence
-- with its evidence, and change requests can link their document and record
-- their timeline effect. Additive only. Existing "Last done" dates aren't turned
-- into logs, because a log should carry real evidence.

CREATE TABLE "ChecklistOccurrence" (
    "id" TEXT NOT NULL,
    "checklistItemId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "link" TEXT NOT NULL,
    "notes" TEXT,
    "sprintId" TEXT,
    "recordedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistOccurrence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChecklistOccurrence_checklistItemId_idx" ON "ChecklistOccurrence"("checklistItemId");

ALTER TABLE "ChecklistOccurrence" ADD CONSTRAINT "ChecklistOccurrence_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "ChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChecklistOccurrence" ADD CONSTRAINT "ChecklistOccurrence_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Same lockdown as 20261027120000_enable_rls_lockdown, which only covers tables
-- that existed when it ran. No policies: the app connects as the table owner.
ALTER TABLE "ChecklistOccurrence" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "ChangeRequest" ADD COLUMN "documentLink" TEXT;
ALTER TABLE "ChangeRequest" ADD COLUMN "timelineImpact" TEXT;
