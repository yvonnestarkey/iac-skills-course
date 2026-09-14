/** A pasted public PDF link from lessons.pdf_url. */
export function asPdfUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const url = value.trim();
  return url || undefined;
}
