import { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchLocalities, fetchLocalityDetail } from "@/lib/api";
import { StaticLocalityView } from "@/components/localities/StaticLocalityView";

export const dynamicParams = true;

interface LocalityPageProps {
  params: {
    slug: string;
  };
}

export async function generateStaticParams() {
  try {
    const localities = await fetchLocalities();
    return localities.map((locality) => ({
      slug: locality.slug,
    }));
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("fetch failed") ||
        error.message.includes("Failed to fetch localities") ||
        error.message.includes("ECONNREFUSED"))
    ) {
      console.warn(
        "API unavailable during build. Falling back to on-demand generation for locality pages.",
      );
      return [];
    }
    throw error;
  }
}

export async function generateMetadata({
  params,
}: LocalityPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const locality = await fetchLocalityDetail(resolvedParams.slug);
  if (!locality) {
    return {};
  }

  const zoneText = locality.parent_zone ? locality.parent_zone : "";
  const description = `Explore ${locality.name} in ${zoneText}, Bengaluru. View metro access, cafes, parks, healthcare, and more.`.replace(" in ,", ",");

  return {
    title: `${locality.name} - Neighbourhood Guide | blr.life`,
    description,
    alternates: {
      canonical: `https://blr.life/localities/${resolvedParams.slug}`,
    },
    openGraph: {
      title: `${locality.name} - Neighbourhood Guide | blr.life`,
      description,
      url: `https://blr.life/localities/${resolvedParams.slug}`,
    },
  };
}

export default async function LocalityPage({ params }: LocalityPageProps) {
  const resolvedParams = await params;
  const locality = await fetchLocalityDetail(resolvedParams.slug);

  if (!locality) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gray-50/50">
      <StaticLocalityView locality={locality} />
    </main>
  );
}
