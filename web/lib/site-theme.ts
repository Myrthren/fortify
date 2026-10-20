export const SITE_THEMES = ["original", "scifi"] as const;
export type SiteTheme = (typeof SITE_THEMES)[number];
export const DEFAULT_SITE_THEME: SiteTheme = "scifi";

export function isSiteTheme(value: unknown): value is SiteTheme {
  return value === "original" || value === "scifi";
}
