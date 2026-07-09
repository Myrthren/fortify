import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fortify",
    short_name: "Fortify",
    description:
      "AI co-pilot for online business — content, networking, and growth for the Fortune Fortress community.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#060606",
    theme_color: "#060606",
    orientation: "portrait-primary",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/fortify-logo.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/fortify-logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/fortify-logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "AI Generator",
        url: "/dashboard",
        description: "Open the AI content generator",
      },
      {
        name: "Competitor Tracking",
        url: "/dashboard/competitor-tracking",
        description: "View competitor watches",
      },
      {
        name: "Workflows",
        url: "/dashboard/workflows",
        description: "Manage your automation workflows",
      },
    ],
  };
}
