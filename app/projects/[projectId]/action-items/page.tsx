import { redirect } from "next/navigation";

// Action items now live beside the Decision Log on one page — this route
// is kept so old links and bookmarks still land in the right place.
export default function ActionItemsPage({ params }: { params: { projectId: string } }) {
  redirect(`/projects/${params.projectId}/decisions#action-items`);
}
