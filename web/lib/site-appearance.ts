import { db } from "@/lib/db";
import { unstable_cache, revalidateTag } from "next/cache";
import { DEFAULT_SITE_THEME, isSiteTheme, type SiteTheme } from "./site-theme";

export const SITE_THEME_TAG = "site-appearance";
export const readSiteTheme = unstable_cache(async (): Promise<SiteTheme> => {
  const setting = await db.siteAppearance.findUnique({ where: { id: "global" } });
  return isSiteTheme(setting?.theme) ? setting.theme : DEFAULT_SITE_THEME;
}, [SITE_THEME_TAG], { revalidate: 30, tags: [SITE_THEME_TAG] });

// A temporary settings outage must not prevent the public site from rendering.
export async function getSiteTheme(): Promise<SiteTheme> {
  try {
    return await readSiteTheme();
  } catch {
    console.error("Could not read site appearance; using the default theme.");
    return DEFAULT_SITE_THEME;
  }
}

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
