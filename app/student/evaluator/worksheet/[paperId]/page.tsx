import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BmcrWorksheetPrint from "@/components/student/BmcrWorksheetPrint";
import { bmcrWorksheetForPaper } from "@/lib/bmcr-worksheet";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ paperId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { paperId } = await params;
  const worksheet = bmcrWorksheetForPaper(decodeURIComponent(paperId));
  return {
    title: worksheet
      ? `BMCR worksheet · ${worksheet.sittingLabel} ${worksheet.paperTitle}`
      : "BMCR worksheet",
  };
}

export default async function BmcrWorksheetPage({ params }: Props) {
  const { paperId } = await params;
  const worksheet = bmcrWorksheetForPaper(decodeURIComponent(paperId));
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
