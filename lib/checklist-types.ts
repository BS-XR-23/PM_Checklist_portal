import type { ModuleName } from "@prisma/client";
import { PM_STAGES, DELIVERY_QA_STAGES, DEVOPS_CATEGORIES, CREATIVE_XR_STAGES, DEV_STAGES } from "@/lib/seed-data";

// Single source of truth for "which checklists exist on a project" — every
// page/action/report that used to hardcode a PM/DevOps 2-way branch reads
// from this list instead, so a 6th checklist type is a one-entry addition
// here rather than a hunt through a dozen ternaries.
// ENGINEERING and QA were two separate checklist types until they were
// merged into DELIVERY_QA ("Delivery & QA Checklist") — both old keys stay
// out of this union (ChecklistItem/ChecklistTemplateItem rows were migrated
// to "DELIVERY_QA", see the migration alongside the ENGINEERING_CHECKLIST/
// QA_CHECKLIST ModuleName enum comments in schema.prisma).
export type ChecklistType = "PM" | "DELIVERY_QA" | "DEVOPS" | "CREATIVE_XR" | "DEV";

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
  // false only for DEV: the Development Checklist is reached exclusively
  // from within the Delivery workspace (its own quality/governance gate,
  // distinct from the general Checklist tab's PM/Engineering/QA/DevOps/
  // Creative content) — excluded from the Checklist tab's rotation and
  // sub-nav even though it's stored/rendered via the same ChecklistItem
  // infrastructure.
  inGeneralChecklistNav: boolean;
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
    inGeneralChecklistNav: true,
  },
  {
    key: "DELIVERY_QA",
    label: "Delivery & QA Checklist",
    description: "Architecture, development, code review, performance, and QA testing through UAT.",
    routeSegment: "delivery-qa",
    moduleName: "DELIVERY_QA_CHECKLIST",
    stageOrder: DELIVERY_QA_STAGES,
    stageLabel: "Stage",
    inGeneralChecklistNav: true,
  },
  {
    key: "DEVOPS",
    label: "DevOps Checklist",
    description: "Infrastructure, CI/CD, security, and monitoring.",
    routeSegment: "devops",
    moduleName: "DEVOPS_CHECKLIST",
    stageOrder: DEVOPS_CATEGORIES,
    stageLabel: "Category",
    inGeneralChecklistNav: true,
  },
  {
    key: "CREATIVE_XR",
    label: "Creative & XR Checklist",
    description: "Storyboard, 3D, UX, assets, and XR validation.",
    routeSegment: "creative-xr",
    moduleName: "CREATIVE_XR_CHECKLIST",
    stageOrder: CREATIVE_XR_STAGES,
    stageLabel: "Stage",
    inGeneralChecklistNav: true,
  },
  {
    key: "DEV",
    label: "Development Checklist",
    description: "Quality/governance gate: readiness, execution, quality gate, and completion criteria — not a task tracker.",
    routeSegment: "dev",
    moduleName: "DEV_CHECKLIST",
    stageOrder: DEV_STAGES,
    stageLabel: "Category",
    inGeneralChecklistNav: false,
  },
];

export const CHECKLIST_TYPE_BY_KEY: Record<ChecklistType, ChecklistTypeConfig> = Object.fromEntries(
  CHECKLIST_TYPES.map((c) => [c.key, c])
) as Record<ChecklistType, ChecklistTypeConfig>;

export const CHECKLIST_TYPE_BY_ROUTE: Record<string, ChecklistTypeConfig> = Object.fromEntries(
  CHECKLIST_TYPES.map((c) => [c.routeSegment, c])
);

/**
 * Stage list for template-editing UIs (the admin Checklist Template page
 * and its .xlsx export) — same as `stageOrder` except PM's "Presales" stage
 * is excluded there: it's a real ChecklistItem stage (see PM_STAGES), but
 * deliberately not part of PM_CHECKLIST_SEED — only ever populated by
 * winPresalesProject — so it has nothing to template-edit here.
 */
export function templateStagesFor(config: ChecklistTypeConfig): readonly string[] {
  return config.key === "PM" ? config.stageOrder.filter((s) => s !== "Presales") : config.stageOrder;
}
