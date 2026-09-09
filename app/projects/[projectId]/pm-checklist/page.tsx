import { redirect } from "next/navigation";

// Old fixed route, kept as a redirect for any existing bookmark/notification
// link — the real page moved to the dynamic /checklist/[type] route so a new
// checklist type is a registry entry (lib/checklist-types.ts), not a new folder.
export default function Page({ params }: { params: { projectId: string } }) {
  redirect(`/projects/${params.projectId}/checklist/pm`);
}
