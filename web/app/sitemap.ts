import { MetadataRoute } from "next";

const BASE = "https://fortify-io.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE,                changeFrequency: "weekly",  priority: 1.0 },
    { url: `${BASE}/pricing`,   changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/login`,     changeFrequency: "yearly",  priority: 0.5 },
    { url: `${BASE}/register`,  changeFrequency: "yearly",  priority: 0.6 },
  ];
}
