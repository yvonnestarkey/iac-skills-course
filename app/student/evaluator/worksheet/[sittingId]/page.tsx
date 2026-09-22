import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BmcrWorksheetPrint from "@/components/student/BmcrWorksheetPrint";
import { bmcrWorksheetForSitting, evaluatorContinueHref } from "@/lib/bmcr-worksheet";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ sittingId: string }>;
  searchParams: Promise<{ from?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sittingId } = await params;
  const worksheet = bmcrWorksheetForSitting(decodeURIComponent(sittingId));
  return {
    title: worksheet ? `BMCR worksheet · ${worksheet.title}` : "BMCR worksheet",
  };
}

export default async function BmcrWorksheetPage({ params, searchParams }: Props) {
  const { sittingId } = await params;
  const query = await searchParams;
  const worksheet = bmcrWorksheetForSitting(decodeURIComponent(sittingId));
  if (!worksheet) notFound();

  return (
    <article className="lesson-body wide eval-page bmcr-sheet-page">
      <BmcrWorksheetPrint
        worksheet={worksheet}
        continueHref={evaluatorContinueHref(query.from, worksheet.sittingId)}
      />
    </article>
  );
}
