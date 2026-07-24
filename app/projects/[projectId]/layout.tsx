import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { HeaderBar } from "@/components/ui/header-bar";
import { NavTabs } from "@/components/ui/nav-tabs";

const TABS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/pm-checklist", label: "PM Checklist" },
  { href: "/devops-checklist", label: "DevOps Checklist" },
  { href: "/milestones", label: "Milestones & Payments" },
  { href: "/risks", label: "Risk Register" },
  { href: "/change-requests", label: "CR Log" },
  { href: "/budget", label: "Budget Tracker" },
  { href: "/pm-plan", label: "PM Plan" },
];

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { projectId: string };
}) {
  const project = await prisma.project.findUnique({ where: { id: params.projectId } });
  if (!project) notFound();

  return (
    <div className="min-h-screen flex flex-col">
      <HeaderBar title={project.name} subtitle={project.client ?? undefined} />
      <NavTabs projectId={project.id} tabs={TABS} />
      <main className="flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}
