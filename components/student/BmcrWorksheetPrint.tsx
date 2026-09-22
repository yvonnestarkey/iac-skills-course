"use client";

import type { BmcrWorksheet } from "@/lib/bmcr-worksheet";

export default function BmcrWorksheetPrint({ worksheet }: { worksheet: BmcrWorksheet }) {
  return (
    <article className="bmcr-sheet">
      <header className="bmcr-sheet-head">
        <p className="kicker">Printable BMCR worksheet</p>
        <h1>
          {worksheet.sittingLabel} · {worksheet.paperTitle}
        </h1>
        <p className="muted">
          IAC · {worksheet.paperCode} · {worksheet.paperTotalMarks} marks
        </p>
        <p>
          Work through your marked script on paper. For each required, write the marks you knew / could reasonably have
          obtained, then calculate that number ÷ total marks available. Do the arithmetic yourself — the point is that
          you see whether you knew enough to pass the question.
        </p>
      </header>

      <table className="bmcr-sheet-table">
        <thead>
          <tr>
            <th>Required</th>
            <th>Question</th>
            <th>Total marks available</th>
            <th>Marks I knew</th>
            <th>BMCR % (marks I knew ÷ total)</th>
          </tr>
        </thead>
        <tbody>
          {worksheet.rows.map((row) => (
            <tr key={row.code}>
              <td>{row.code}</td>
              <td>{row.title}</td>
              <td>{row.totalMarks}</td>
              <td className="bmcr-sheet-write" />
              <td className="bmcr-sheet-write" />
            </tr>
          ))}
          <tr className="bmcr-sheet-total">
            <td colSpan={2}>Paper total</td>
            <td>{worksheet.paperTotalMarks}</td>
            <td className="bmcr-sheet-write" />
            <td className="bmcr-sheet-write" />
          </tr>
        </tbody>
      </table>

      <p className="bmcr-sheet-source muted small">
        Total marks come from the official paper registry ({worksheet.marksSource}). This sheet does not use Direct /
        Indirect / Thinking.
      </p>

      <div className="bmcr-sheet-actions">
        <button type="button" className="primary" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>
    </article>
  );
}
