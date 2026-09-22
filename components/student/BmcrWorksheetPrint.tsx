"use client";

import type { BmcrSittingWorksheet } from "@/lib/bmcr-worksheet";

export default function BmcrWorksheetPrint({ worksheet }: { worksheet: BmcrSittingWorksheet }) {
  return (
    <article className="bmcr-sheet">
      <header className="bmcr-sheet-head">
        <p className="kicker">Printable BMCR worksheet</p>
        <h1>{worksheet.title}</h1>
        <p className="muted">IAC · one sheet for the whole sitting · all papers</p>
        <ul className="bmcr-sheet-howto">
          <li>
            <strong>What I got</strong> = the mark actually awarded.
          </li>
          <li>
            <strong>Basic Marks</strong> = the individual Basic mark opportunities you believe you knew / could
            reasonably have obtained at the time.
          </li>
          <li>
            <strong>% I could&apos;ve earned</strong> = Basic Marks ÷ Total marks. Do the arithmetic yourself.
          </li>
          <li>
            This percentage can exceed 100% because a mark plan can contain more available mark opportunities than the
            maximum total awarded. Total marks is the denominator — do not cap the percentage at 100%.
          </li>
        </ul>
      </header>

      {worksheet.papers.map((paper) => (
        <section key={paper.paperId} className="bmcr-sheet-paper">
          <h2>
            {paper.paperTitle}{" "}
            <span className="muted">
              {paper.paperCode} · {paper.paperTotalMarks} marks
            </span>
          </h2>
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
                  <td>{row.title}</td>
                  <td className="bmcr-sheet-write" />
                  <td className="bmcr-sheet-write" />
                  <td>{row.totalMarks}</td>
                  <td className="bmcr-sheet-write" />
                </tr>
              ))}
              <tr className="bmcr-sheet-total">
                <td colSpan={2}>Paper total</td>
                <td className="bmcr-sheet-write" />
                <td className="bmcr-sheet-write" />
                <td>{paper.paperTotalMarks}</td>
                <td className="bmcr-sheet-write" />
              </tr>
            </tbody>
          </table>
        </section>
      ))}

      <p className="bmcr-sheet-source muted small">
        Total marks come from the official paper registry ({worksheet.marksSource}). These are the maximum marks that
        can be awarded for each required, not the longer list of available mark-plan opportunities. This sheet does not
        use Direct / Indirect / Thinking.
      </p>

      <div className="bmcr-sheet-actions">
        <button type="button" className="primary" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>
    </article>
  );
}
