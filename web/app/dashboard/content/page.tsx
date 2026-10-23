import {
  ContentWorkspacePage,
  ContentAssetPage,
} from "@/components/content-workspace-page";
import type { ContentKind } from "@/lib/content-workspace";
export const dynamic = "force-dynamic";
export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; id?: string; assets?: string }>;
}) {
  const p = await searchParams;
  if (p.assets === "slideshow") return <ContentAssetPage />;
  const kind: ContentKind =
    p.view === "research" ? "research" : p.view === "test" ? "test" : "story";
  return <ContentWorkspacePage kind={kind} id={p.id} />;
}
