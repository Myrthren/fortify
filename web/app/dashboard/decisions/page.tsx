import { ContentWorkspacePage } from "@/components/content-workspace-page";
export const dynamic = "force-dynamic";
export default async function DecisionPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  return <ContentWorkspacePage kind="decision" id={(await searchParams).id} />;
}
