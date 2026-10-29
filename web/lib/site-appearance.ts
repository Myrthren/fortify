import { db } from "@/lib/db";
import { unstable_cache, revalidateTag } from "next/cache";
import { DEFAULT_SITE_THEME, isSiteTheme, type SiteTheme } from "./site-theme";
import { DEFAULT_WORKSPACE_LAYOUT, isWorkspaceLayout, type WorkspaceLayout } from "./workspace-layout";

export const SITE_THEME_TAG = "site-appearance";
export type SiteAppearance = { theme: SiteTheme; workspaceLayout: WorkspaceLayout };

export const readSiteAppearance = unstable_cache(async (): Promise<SiteAppearance> => {
  const setting = await db.siteAppearance.findUnique({ where: { id: "global" } });
  return {
    theme: isSiteTheme(setting?.theme) ? setting.theme : DEFAULT_SITE_THEME,
    workspaceLayout: isWorkspaceLayout(setting?.workspaceLayout) ? setting.workspaceLayout : DEFAULT_WORKSPACE_LAYOUT,
  };
}, [SITE_THEME_TAG], { revalidate: 30, tags: [SITE_THEME_TAG] });

export const readSiteTheme = async (): Promise<SiteTheme> => (await readSiteAppearance()).theme;

// A temporary settings outage must not prevent the public site from rendering.
export async function getSiteAppearance(): Promise<SiteAppearance> {
  try {
    return await readSiteAppearance();
  } catch {
    console.error("Could not read site appearance; using the default theme.");
    return { theme: DEFAULT_SITE_THEME, workspaceLayout: DEFAULT_WORKSPACE_LAYOUT };
  }
}

export async function getSiteTheme(): Promise<SiteTheme> { return (await getSiteAppearance()).theme; }
export async function getWorkspaceLayout(): Promise<WorkspaceLayout> { return (await getSiteAppearance()).workspaceLayout; }

export async function saveSiteTheme(theme: SiteTheme, updatedBy: string): Promise<SiteTheme> {
  // Validate at the storage boundary as well as in the HTTP handler.
  if (!isSiteTheme(theme)) throw new Error("Invalid site theme");
  const setting = await db.siteAppearance.upsert({
    where: { id: "global" },
    create: { id: "global", theme, updatedBy },
    update: { theme, updatedBy },
  });
  revalidateTag(SITE_THEME_TAG);
  return setting.theme as SiteTheme;
}

export async function saveWorkspaceLayout(workspaceLayout: WorkspaceLayout, updatedBy: string): Promise<WorkspaceLayout> {
  if (!isWorkspaceLayout(workspaceLayout)) throw new Error("Invalid workspace layout");
  const setting = await db.siteAppearance.upsert({
    where: { id: "global" },
    create: { id: "global", workspaceLayout, updatedBy },
    update: { workspaceLayout, updatedBy },
  });
  revalidateTag(SITE_THEME_TAG);
  return setting.workspaceLayout as WorkspaceLayout;
}
