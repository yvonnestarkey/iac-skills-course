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

/**
 * Tables whose rows come in pairs (question numbers, then the figures): the label cells are merged over both rows so
 * the figures read as belonging to that type or pillar (Yvonne, 20 Oct 2026). Keyed by the first header; the value
 * lists the columns to merge. An empty cell in those columns joins the cell above it.
 */
const MERGE_DOWN: Record<string, number[]> = { "Type of question": [0], "SAICA exam pillar": [0, 1] };

function table(lines: string[]): string {
  const head = cells(lines[0]);
  const rows = lines.slice(2).map(cells);
  const hl = head.map((h) => HIGHLIGHT_HEADERS.has(h));
  const th = head.map((h, i) => `<th${hl[i] ? ' class="hl"' : ""}>${inline(h)}</th>`).join("");
  // rowspan[r][c] > 1 starts a merged cell; 0 means the cell is covered by the one above and is not drawn.
  const span = rows.map((r) => r.map(() => 1));
  // The total in the last column sits on the figures row with an empty cell above it: draw it once, over both rows.
  if (MERGE_DOWN[head[0]]) {
    const c = head.length - 1;
    rows.forEach((r, ri) => {
      const next = rows[ri + 1];
      if (span[ri][c] && (r[c] ?? "") === "" && next && (next[c] ?? "") !== "" && (next[0] ?? "") === "") {
        r[c] = next[c];
        span[ri][c] = 2;
        span[ri + 1][c] = 0;
      }
    });
  }
  for (const c of MERGE_DOWN[head[0]] ?? []) {
    let anchor = -1;
    rows.forEach((r, ri) => {
      if ((r[c] ?? "") === "" && anchor >= 0) {
        span[anchor][c] += 1;
        span[ri][c] = 0;
      } else anchor = ri;
    });
  }
  const body = rows
    .map((r, ri) => {
      const rowShaded = /^\**Questions attempted/.test(r[0] ?? "");
      const tds = r
        .map((c, i) => {
          if (span[ri][i] === 0) return "";
          const cls = hl[i] || rowShaded || MARKS_FIGURE.test(c) ? ' class="hl"' : "";
          const rs = span[ri][i] > 1 ? ` rowspan="${span[ri][i]}" style="vertical-align: middle"` : "";
          return `<td${cls}${rs}>${inline(c)}</td>`;
        })
        .join("");
      return `<tr>${tds}</tr>`;
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
    else if (line.startsWith("###### ")) { out.push(`<p class="doc-head">${inline(line.slice(7))}</p>`); i++; }
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
.eve-report .doc-head { font-size: 11pt; color: ${BRAND.teal}; margin: 0 0 2pt; padding-bottom: 4pt; border-bottom: 1px solid ${BRAND.teal} }
.eve-report h1 { font-size: 28pt; font-weight: bold; color: ${BRAND.red}; margin: 10pt 0 14pt; line-height: 1.15; break-after: avoid }
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
@media print { .no-print { display: none !important } .eve-report { padding: 0 16mm; max-width: none } }
/* Printing with no page margin stops the browser adding its own date, title and web address to every page. The page
   margins come from a spacer header and footer that the browser repeats on every printed page instead. */
@page { size: A4; margin: 0 }
.eve-report table.pg { width: 100%; border: 0; margin: 0; break-inside: auto; border-collapse: collapse }
.eve-report table.pg > thead > tr > td, .eve-report table.pg > tfoot > tr > td, .eve-report table.pg > tbody > tr > td { border: 0; padding: 0; font-size: inherit }
.eve-report table.pg > tbody > tr { break-inside: auto }
.eve-report .pg-space { height: 0 }
@media print { .eve-report .pg-space { height: 16mm } }
`;

/** One document: the sections in order, page break between them, one watermark behind everything. */
export function renderReportBody(sectionsMarkdown: string[], watermarkSrc = "/eve-watermark.png"): string {
  const space = `<tr><td><div class="pg-space"></div></td></tr>`;
  return (
    `<img class="wm" src="${esc(watermarkSrc)}" alt="" />` +
    sectionsMarkdown
      .map((md) => `<section class="sec"><table class="pg"><thead>${space}</thead><tfoot>${space}</tfoot><tbody><tr><td>${markdownToHtml(md)}</td></tr></tbody></table></section>`)
      .join("\n")
  );
}
