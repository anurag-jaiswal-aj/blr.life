import { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchLocalities, fetchLocalityDetail } from "@/lib/api";
import { StaticLocalityView } from "@/components/localities/StaticLocalityView";

export const dynamicParams = false;

interface LocalityPageProps {
  params: {
    slug: string;
  };
}

export async function generateStaticParams() {
  const localities = await fetchLocalities();
  return localities.map((locality) => ({
    slug: locality.slug,
  }));
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
