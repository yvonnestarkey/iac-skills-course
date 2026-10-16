/**
 * Markdown (the subset the report builders produce) to branded HTML. No dependencies, so it is deterministic and
 * testable. Everything is escaped, so model-written notes can never inject markup.
 * Brand (Yvonne, 16 Oct 2026): teal Step headings, dark red Part headings, Arial, faint logo watermark on every page,
 * tables kept whole across pages, grey highlight on the columns that carry the reading.
 */
import { BRAND } from "./report-text";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");

/** Column headers whose cells are shaded (Yvonne, 15 Oct 2026). */
const HIGHLIGHT_HEADERS = new Set(["% Earned", "% Basic", "Delivered?", "Direct (earned of available)", "Volume", "Coverage", "Accuracy", "Recognised", "Core issue recognised", "Exam", "Exam Total", "All three papers", "All papers"]);
const MARKS_FIGURE = /^\**\d[\d.]* of \d[\d.]* \(\d+%\)/;

const cells = (line: string) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

function table(lines: string[]): string {
  const head = cells(lines[0]);
  const rows = lines.slice(2).map(cells);
  const hl = head.map((h) => HIGHLIGHT_HEADERS.has(h));
  const th = head.map((h, i) => `<th${hl[i] ? ' class="hl"' : ""}>${inline(h)}</th>`).join("");
  const body = rows
    .map((r) => {
      const rowShaded = /^\**Questions attempted/.test(r[0] ?? "");
      return `<tr>${r.map((c, i) => `<td${hl[i] || rowShaded || MARKS_FIGURE.test(c) ? ' class="hl"' : ""}>${inline(c)}</td>`).join("")}</tr>`;
    })
    .join("");
  return `<table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;
}

export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.startsWith("|")) {
      const block: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) block.push(lines[i++]);
      out.push(table(block));
    } else if (line.startsWith("### ")) { out.push(`<h3>${inline(line.slice(4))}</h3>`); i++; }
    else if (line.startsWith("## ")) { const t = line.slice(3); out.push(`<h2${/^How to read/.test(t) ? ' class="how"' : ""}>${inline(t)}</h2>`); i++; }
    else if (line.startsWith("# ")) { out.push(`<h1>${inline(line.slice(2))}</h1>`); i++; }
    else if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) items.push(`<li>${inline(lines[i++].slice(2))}</li>`);
      out.push(`<ul>${items.join("")}</ul>`);
    } else {
      const para: string[] = [];
      while (i < lines.length && lines[i].trim() && !/^(\||#{1,3} |- )/.test(lines[i])) para.push(lines[i++]);
      const text = para.join(" ");
      let j = i;
      while (j < lines.length && !lines[j].trim()) j++;
      const beforeTable = j < lines.length && lines[j].startsWith("|");
      out.push(/^\*\*Q[^*]*\*\*$/.test(text) ? `<div class="q">${inline(text)}</div>` : `<p${beforeTable ? ' class="cap"' : ""}>${inline(text)}</p>`);
    }
  }
  return out.join("\n");
}

export const REPORT_CSS = `
@page { size: A4; margin: 18mm 16mm }
.eve-report { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: ${BRAND.text}; line-height: 1.45; max-width: 900px; margin: 0 auto; padding: 16px; background: #fff; position: relative }
.eve-report .wm { position: fixed; left: 50%; top: 50%; width: min(150mm, 70vw); transform: translate(-50%, -50%); opacity: .13; z-index: 0; pointer-events: none }
.eve-report .sec { position: relative; z-index: 1; break-before: page }
.eve-report .sec:first-of-type { break-before: auto }
.eve-report h1 { font-size: 12pt; font-weight: normal; margin: 0 0 14pt }
.eve-report h2 { font-size: 19pt; color: ${BRAND.teal}; margin: 22pt 0 8pt; line-height: 1.2; break-after: avoid }
.eve-report h2.how { font-size: 13pt; color: ${BRAND.red}; font-style: italic; margin-top: 8pt }
.eve-report h3 { font-size: 13pt; color: ${BRAND.red}; font-style: italic; margin: 16pt 0 6pt; break-after: avoid }
.eve-report .cap { break-after: avoid }
.eve-report .q { font-size: 11.5pt; font-weight: bold; font-style: italic; color: ${BRAND.teal}; margin: 14pt 0 4pt; break-after: avoid }
.eve-report p { margin: 0 0 7pt } .eve-report ul { margin: 0 0 7pt 18pt; padding: 0 } .eve-report li { margin-bottom: 4pt }
.eve-report table { border-collapse: collapse; margin: 4pt 0 12pt; width: 100%; break-inside: avoid }
.eve-report th, .eve-report td { border: 1.2px solid #000; padding: 4pt 6pt; vertical-align: top; text-align: left; font-size: 9.5pt }
.eve-report th { font-weight: bold } .eve-report tr { break-inside: avoid } .eve-report thead { display: table-header-group }
.eve-report .hl { background: rgba(128,128,128,0.18) }
@media print { .no-print { display: none !important } .eve-report { padding: 0; max-width: none } }
`;

/** One document: the sections in order, page break between them, one watermark behind everything. */
export function renderReportBody(sectionsMarkdown: string[], watermarkSrc = "/eve-watermark.png"): string {
  return `<img class="wm" src="${esc(watermarkSrc)}" alt="" />` + sectionsMarkdown.map((md) => `<section class="sec">${markdownToHtml(md)}</section>`).join("\n");
}
