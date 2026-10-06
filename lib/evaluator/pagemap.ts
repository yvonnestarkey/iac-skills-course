import type { PageMap, RequirementPageMap } from "./types";

export type ExpectedRequirement = { code: string; title: string };

/** "P1Q1_d" → "Q1(d)" ; "P2Q2_g1" → "Q2(g1)". Falls back to the raw code. */
export function requirementLabel(code: string): string {
  const match = code.match(/^P\d+Q(\d+)_([a-z]\d*)$/i);
  return match ? `Q${match[1]}(${match[2].toLowerCase()})` : code;
}

function uniqueSortedPages(pages: unknown, pageCount: number): number[] {
  if (!Array.isArray(pages)) return [];
  const out = new Set<number>();
  for (const value of pages) {
    const page = Number(value);
    if (Number.isInteger(page) && page >= 1 && page <= pageCount) out.add(page);
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * Normalise a model-proposed page map against the paper's real requirements.
 * Rule: candidate response ORDER is non-authoritative; required identifiers are authoritative.
 * Every expected requirement is present exactly once; unknown requirements are dropped with a note.
 */
export function normalisePageMap(
  raw: unknown,
  expected: ExpectedRequirement[],
  limits: { scriptPages: number; reportPages: number }
): { map: PageMap; warnings: string[] } {
  const warnings: string[] = [];
  const rows = Array.isArray((raw as { requirements?: unknown })?.requirements)
    ? ((raw as { requirements: Record<string, unknown>[] }).requirements)
    : [];
  const byCode = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const code = String(row.code || "");
    if (!expected.some((item) => item.code === code)) {
      if (code) warnings.push(`Page map returned unknown requirement "${code}"; ignored.`);
      continue;
    }
    if (byCode.has(code)) warnings.push(`Page map returned ${code} more than once; first kept.`);
    else byCode.set(code, row);
  }

  const requirements: RequirementPageMap[] = expected.map((item) => {
    const row = byCode.get(item.code);
    const scriptPages = uniqueSortedPages(row?.script_pages, limits.scriptPages);
    const reportPages = uniqueSortedPages(row?.report_pages, limits.reportPages);
    const attempted = Boolean(row?.attempted) && scriptPages.length > 0;
    const mappedBy = !row ? "none" : row.mapped_by === "content" ? "content" : attempted ? "label" : "none";
    if (!row) warnings.push(`${item.code}: not present in page map; treated as not attempted.`);
    return {
      code: item.code,
      label: requirementLabel(item.code),
      script_pages: attempted ? scriptPages : [],
      report_pages: reportPages,
      attempted,
      mapped_by: mappedBy,
      uncertain: Boolean(row?.uncertain) || (attempted && mappedBy === "content"),
      note: typeof row?.note === "string" ? row.note : undefined,
    };
  });

  const order = Array.isArray((raw as { answer_order?: unknown })?.answer_order)
    ? ((raw as { answer_order: unknown[] }).answer_order.map((v) => String(v)).filter(Boolean))
    : [];
  return { map: { requirements, answer_order: order }, warnings };
}
