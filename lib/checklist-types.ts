import type { ModuleName } from "@prisma/client";
import { PM_STAGES, ENGINEERING_STAGES, QA_STAGES, DEVOPS_CATEGORIES, CREATIVE_XR_STAGES } from "@/lib/seed-data";

// Single source of truth for "which checklists exist on a project" — every
// page/action/report that used to hardcode a PM/DevOps 2-way branch reads
// from this list instead, so a 6th checklist type is a one-entry addition
// here rather than a hunt through a dozen ternaries.
export type ChecklistType = "PM" | "ENGINEERING" | "QA" | "DEVOPS" | "CREATIVE_XR";

export type ChecklistTypeConfig = {
  key: ChecklistType;
  label: string;
  description: string;
  // URL slug — kept distinct from `key`'s casing/spelling on purpose, so
  // renaming a route later never means a ChecklistItem.type data migration.
  routeSegment: string;
  moduleName: ModuleName;
  stageOrder: readonly string[];
  stageLabel: string;
};

export const CHECKLIST_TYPES: ChecklistTypeConfig[] = [
  {
    key: "PM",
    label: "PM Checklist",
    description: "Governance, planning, approvals, and closure.",
    routeSegment: "pm",
    moduleName: "PM_CHECKLIST",
    stageOrder: PM_STAGES,
    stageLabel: "Stage",
  },
  {
    key: "ENGINEERING",
    label: "Engineering Checklist",
    description: "Architecture, development, code review, and performance.",
    routeSegment: "engineering",
    moduleName: "ENGINEERING_CHECKLIST",
    stageOrder: ENGINEERING_STAGES,
    stageLabel: "Stage",
  },
  {
    key: "QA",
    label: "QA Checklist",
    description: "Test planning, functional, device, regression, and UAT.",
    routeSegment: "qa",
    moduleName: "QA_CHECKLIST",
    stageOrder: QA_STAGES,
    stageLabel: "Stage",
  },
  {
    key: "DEVOPS",
    label: "DevOps Checklist",
    description: "Infrastructure, CI/CD, security, and monitoring.",
    routeSegment: "devops",
    moduleName: "DEVOPS_CHECKLIST",
    stageOrder: DEVOPS_CATEGORIES,
    stageLabel: "Category",
  },
  {
    key: "CREATIVE_XR",
    label: "Creative & XR Checklist",
    description: "Storyboard, 3D, UX, assets, and XR validation.",
    routeSegment: "creative-xr",
    moduleName: "CREATIVE_XR_CHECKLIST",
    stageOrder: CREATIVE_XR_STAGES,
    stageLabel: "Stage",
  },
];

export const CHECKLIST_TYPE_BY_KEY: Record<ChecklistType, ChecklistTypeConfig> = Object.fromEntries(
  CHECKLIST_TYPES.map((c) => [c.key, c])
) as Record<ChecklistType, ChecklistTypeConfig>;

export const CHECKLIST_TYPE_BY_ROUTE: Record<string, ChecklistTypeConfig> = Object.fromEntries(
  CHECKLIST_TYPES.map((c) => [c.routeSegment, c])
);
