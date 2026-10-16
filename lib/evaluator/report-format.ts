/** Small formatting helpers shared by the student report builders. */

/** Round half up (62.5 -> 63), unlike Math.round on negatives and unlike banker's rounding. */
export const roundHalfUp = (x: number) => Math.floor(x + 0.5);
export const pct = (num: number | null | undefined, den: number | null | undefined): string =>
  num === null || num === undefined || !den ? "-" : `${roundHalfUp((num / den) * 100)}%`;
/** 20.5 stays 20.5; 20 prints as 20. */
export const num = (x: number | null | undefined): string => (x === null || x === undefined ? "-" : String(Math.round(x * 10) / 10));
export const cell = (value: string | number | null | undefined): string => String(value ?? "-").replace(/\|/g, "/").replace(/\n/g, " ");
export const mdTable = (headers: string[], rows: (string | number | null | undefined)[][]): string[] => [
  `| ${headers.join(" | ")} |`,
  `|${headers.map(() => "---").join("|")}|`,
  ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`),
];
export const cap1 = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Columns the renderer shades light grey (Yvonne, 15 Oct 2026). Markdown has no shading; the renderer reads these. */
export const HIGHLIGHT_COLUMNS = {
  bmcr: ["% Earned", "% Basic"],
  type_pillar: "the marks row ('26 of 39') for each type and pillar, and the Exam Total column",
  rtfq: ["Delivered?"],
  buried_treasure: ["Direct (earned of available)"],
  volume_accuracy: ["Volume", "Coverage", "Accuracy"],
  components: ["Recognised", "Core issue recognised"],
} as const;
