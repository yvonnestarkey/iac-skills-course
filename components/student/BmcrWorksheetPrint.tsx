"use client";

import Link from "next/link";
import {
  bmcrPrintPaperLine,
  bmcrPrintQuestionLabel,
  bmcrPrintSheetTitle,
  type BmcrSittingWorksheet,
} from "@/lib/bmcr-worksheet";

export default function BmcrWorksheetPrint({
  worksheet,
  continueHref,
}: {
  worksheet: BmcrSittingWorksheet;
  continueHref: string;
}) {
  const sheetTitle = bmcrPrintSheetTitle(worksheet.sittingLabel);

  return (
    <article className="bmcr-sheet">
      {worksheet.papers.map((paper, index) => (
        <section key={paper.paperId} className="bmcr-sheet-paper">
          <header className="bmcr-sheet-head">
            <p className="bmcr-sheet-brand-line">Accounting Study Advice</p>
            <h1>{sheetTitle}</h1>
            <p className="bmcr-sheet-paper-line">{bmcrPrintPaperLine(paper)}</p>
          </header>

          {index === 0 ? (
            <div className="bmcr-sheet-howto">
              <p className="bmcr-sheet-howto-title">How to complete this worksheet</p>
              <ul>
                <li>
                  <strong>What I got</strong> = marks actually awarded.
                </li>
                <li>
                  <strong>Basic Marks</strong> = individual Basic mark opportunities you knew / could reasonably have
                  obtained.
                </li>
                <li>
                  <strong>% I could&apos;ve earned</strong> = Basic Marks ÷ Total marks.
                </li>
                <li>
                  The percentage may exceed 100% where available mark-plan opportunities exceed the maximum marks
                  awarded.
                </li>
              </ul>
            </div>
          ) : null}

          <table className="bmcr-sheet-table">
            <thead>
              <tr>
                <th>Required</th>
                <th>Question</th>
                <th>What I got</th>
                <th>Basic Marks</th>
                <th>Total marks</th>
                <th>% I could&apos;ve earned</th>
              </tr>
            </thead>
            <tbody>
              {paper.rows.map((row) => (
                <tr key={row.code}>
                  <td>{row.code}</td>
                  <td title={row.title}>{bmcrPrintQuestionLabel(row.code, row.title, worksheet.sittingId)}</td>
                  <td className="bmcr-sheet-write" />
                  <td className="bmcr-sheet-write" />
                  <td className="bmcr-sheet-marks">{row.totalMarks}</td>
                  <td className="bmcr-sheet-write" />
                </tr>
              ))}
              <tr className="bmcr-sheet-total">
                <td colSpan={2}>Paper total</td>
                <td className="bmcr-sheet-write" />
                <td className="bmcr-sheet-write" />
                <td className="bmcr-sheet-marks">{paper.paperTotalMarks}</td>
                <td className="bmcr-sheet-write" />
              </tr>
            </tbody>
          </table>
        </section>
      ))}

      <div className="bmcr-sheet-actions">
        <button type="button" className="primary" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
        <Link className="primary" href={continueHref}>
          Close BMCR &amp; continue
        </Link>
      </div>
    </article>
  );
}
