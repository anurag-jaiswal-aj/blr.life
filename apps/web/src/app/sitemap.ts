import { MetadataRoute } from "next";
import { fetchLocalities } from "@/lib/api";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const sitemapEntries: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];

  try {
    const localities = await fetchLocalities();
    for (const locality of localities) {
      sitemapEntries.push({
        url: `${baseUrl}/localities/${locality.slug}`,
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
