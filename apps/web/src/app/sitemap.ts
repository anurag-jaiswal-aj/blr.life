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

  try {
    const localities = await fetchLocalities();
    for (const locality of localities) {
      sitemapEntries.push({
        url: `https://blr.life/localities/${locality.slug}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("fetch failed") ||
        error.message.includes("Failed to fetch localities") ||
        error.message.includes("ECONNREFUSED"))
    ) {
      console.warn(
        "API unavailable during build. Generating base sitemap without localities.",
      );
    } else {
      throw error;
    }
  }

  return sitemapEntries;
}
