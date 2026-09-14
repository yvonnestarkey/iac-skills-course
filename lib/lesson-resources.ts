/** A pasted public PDF link from lessons.pdf_url. */
export function asPdfUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const url = value.trim();
  return url || undefined;
}

const PDF_EMBED_HASH = "view=FitH&toolbar=1&navpanes=0";

/** Chrome PDF viewer: fit width, toolbar on, no thumbnail sidebar. */
export function pdfEmbedSrc(url: string): string {
  const trimmed = url.trim();
  const base = trimmed.split("#")[0];
  return `${base}#${PDF_EMBED_HASH}`;
}
