import { MetadataRoute } from "next";
import { fetchLocalities } from "@/lib/api";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sitemapEntries: MetadataRoute.Sitemap = [
    {
      url: "https://blr.life/",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];

  const localities = await fetchLocalities();

  for (const locality of localities) {
    sitemapEntries.push({
      url: `https://blr.life/localities/${locality.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  return sitemapEntries;
}
