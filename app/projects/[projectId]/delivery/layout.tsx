import { SubNav } from "@/components/ui/sub-nav";

// Shared sub-nav for the whole Delivery workspace (Overview/Tasks/Sprints/
// Milestones/Dev Checklist/Releases/UAT) — each sub-route still
// independently re-checks its own module access via requireModuleAccess,
// this is just the shared chrome. Per-module tab visibility (hiding a tab a
// viewer has NONE access to) is intentionally not done here to keep this
// layout a cheap, DB-free Server Component — a viewer without access to a
// given sub-module simply 404s on click, same as any other module boundary
// in this app.
export default function DeliveryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { projectId: string };
}) {
  return (
    <div className="space-y-6">
      <SubNav
        projectId={params.projectId}
        options={[
          { href: "/delivery", label: "Overview" },
          { href: "/delivery/tasks", label: "Tasks" },
          { href: "/delivery/sprints", label: "Sprints" },
          { href: "/delivery/milestones", label: "Milestones" },
          { href: "/delivery/checklist", label: "Dev Checklist" },
          { href: "/delivery/releases", label: "Releases" },
          { href: "/delivery/uat", label: "UAT" },
        ]}
      />
      {children}
    </div>
  );
}
