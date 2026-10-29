import { SiteAtmosphere } from "@/components/particle-field";
import { AmbientMotionControl } from "@/components/ambient-motion-control";
import { getSiteAppearance } from "@/lib/site-appearance";
import { SiteThemeSync } from "@/components/site-theme-sync";
import type { Metadata, Viewport } from "next";
import { CookieBanner } from "@/components/cookie-banner";
import "./globals.css";
import "./command-theme.css";
import "./immersive-theme.css";
import "./classic-theme.css";
import "./public-navigation.css";
import "./fortify-finish.css";

const BASE_URL = "https://fortify-io.com";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Fortify — AI co-pilot for online business",
    template: "%s | Fortify",
  },
  description:
    "The AI co-pilot for online business: leads, outreach in your brand voice, competitor monitoring and workflows, on the web and in Discord.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Fortify",
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "64x64", type: "image/png" },
      { url: "/fortify-mark.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/fortify-logo.png",
    shortcut: "/favicon.png",
  },
  openGraph: {
    type: "website",
    url: BASE_URL,
    siteName: "Fortify",
    title: "Fortify — AI co-pilot for online business",
    description: "The AI co-pilot for online business: leads, outreach in your brand voice, competitor monitoring and workflows, on the web and in Discord.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Fortify" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fortify — AI co-pilot for online business",
    description: "The AI co-pilot for online business: leads, outreach in your brand voice, competitor monitoring and workflows, on the web and in Discord.",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#060606",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
};

// Public pages can reuse the global appearance read. Member routes remain
// dynamic through their authenticated layout and page-level access checks.
export const revalidate = 30;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const appearance = await getSiteAppearance();
  return (
    <html lang="en" data-theme={appearance.theme} data-workspace-layout={appearance.workspaceLayout}>
      <head>
        <link rel="preload" href="/fonts/archivo/Archivo-Variable.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function() {});
                });
              }
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-bg text-text font-sans">
        <SiteThemeSync />
        <SiteAtmosphere />
        <div className="site-content">{children}</div>
        <AmbientMotionControl />
        <CookieBanner />
      </body>
    </html>
  );
}
