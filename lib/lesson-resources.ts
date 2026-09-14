export interface LessonResourceDownload {
  title: string;
  url: string;
  file_size?: string;
}

function looksLikeUrl(value: string): boolean {
  return /^(https?:)?\/\//i.test(value.trim()) || value.trim().startsWith("/");
}

function filenameFromUrl(url: string): string {
  try {
    const pathName = new URL(url, "https://example.com").pathname;
    const name = decodeURIComponent(pathName.split("/").filter(Boolean).pop() || "");
    return name.replace(/[-_]+/g, " ").replace(/\.[a-z0-9]+$/i, "") || "Download";
  } catch {
    return "Download";
  }
}

export function formatResourceSize(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (!/^\d+(\.\d+)?$/.test(trimmed)) return trimmed;
    value = Number(trimmed);
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  if (value < 1024) return `${Math.round(value)} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function isDownloadUrl(url: string): boolean {
  try {
    const pathName = new URL(url, "https://example.com").pathname.toLowerCase();
    return (
      pathName.includes("/pdfs/") ||
      pathName.includes("/downloads/") ||
      /\.(pdf|zip|docx?|xlsx?|pptx?)$/i.test(pathName)
    );
  } catch {
    return false;
  }
}

function fromUnknown(raw: unknown): LessonResourceDownload | null {
  if (typeof raw === "string" && looksLikeUrl(raw)) {
    return { title: filenameFromUrl(raw), url: raw.trim() };
  }
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const url = String(row.url || row.href || row.file_url || row.download_url || "").trim();
  if (!url) return null;
  const title = String(row.title || row.name || row.filename || filenameFromUrl(url) || "Download").trim();
  const file_size = formatResourceSize(row.file_size ?? row.size ?? row.filesize);
  return { title: title || "Download", url, file_size };
}

/** Normalise `resource_downloads` from Supabase, seed JSON, or a Thinkific PDF lesson URL. */
export function parseResourceDownloads(
  value: unknown,
  fallback?: { title?: string; url?: string | null }
): LessonResourceDownload[] {
  const items: LessonResourceDownload[] = [];
  const list = Array.isArray(value) ? value : value ? [value] : [];
  list.forEach((entry) => {
    const parsed = fromUnknown(entry);
    if (parsed) items.push(parsed);
  });
  if (!items.length && fallback?.url && isDownloadUrl(fallback.url)) {
    items.push({
      title: (fallback.title || filenameFromUrl(fallback.url)).trim() || "Download",
      url: fallback.url,
    });
  }
  return items;
}
