import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing", "/login", "/register"],
        disallow: ["/dashboard/", "/admin/", "/api/"],
      },
    ],
    sitemap: "https://fortify-io.com/sitemap.xml",
  };
}
