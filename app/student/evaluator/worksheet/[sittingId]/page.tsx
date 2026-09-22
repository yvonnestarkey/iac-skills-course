import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BmcrWorksheetPrint from "@/components/student/BmcrWorksheetPrint";
import { bmcrWorksheetForSitting } from "@/lib/bmcr-worksheet";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ sittingId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sittingId } = await params;
  const worksheet = bmcrWorksheetForSitting(decodeURIComponent(sittingId));
  return {
    title: worksheet ? `BMCR worksheet · ${worksheet.title}` : "BMCR worksheet",
  };
}

export default async function BmcrWorksheetPage({ params }: Props) {
  const { sittingId } = await params;
  const worksheet = bmcrWorksheetForSitting(decodeURIComponent(sittingId));
  if (!worksheet) notFound();

  return (
    <article className="lesson-body wide eval-page bmcr-sheet-page">
      <p className="bmcr-sheet-back">
        <Link href="/student/evaluator">← Script evaluator</Link>
      </p>
      <BmcrWorksheetPrint worksheet={worksheet} />
    </article>
  );
}
