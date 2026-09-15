const INTERNAL_HOSTS = new Set([
  "iac.accountingstudyadvice.com",
  "www.iac.accountingstudyadvice.com",
  "accountingstudyadvice.com",
  "www.accountingstudyadvice.com",
  "localhost",
  "127.0.0.1",
]);

export function safeHref(raw: string | null | undefined): string | null {
  const href = String(raw || "").trim();
  if (!href) return null;
  if (/^(javascript|data|vbscript):/i.test(href)) return null;
  if (/^https?:\/\//i.test(href)) return href;
  if (/^www\./i.test(href)) return `https://${href}`;
  if (href.startsWith("/")) return href;
  return null;
}

function partsFromHref(href: string): { host: string | null; path: string } {
  if (href.startsWith("/")) return { host: null, path: href };
  try {
    const url = new URL(href);
    return { host: url.hostname, path: `${url.pathname}${url.search}${url.hash}` || "/" };
  } catch {
    return { host: null, path: href };
  }
}

function rewriteCoursePath(path: string): string {
  if (path === "/lessons" || path.startsWith("/lessons/")) return `/student${path.slice("/lessons".length) || ""}`;
  if (path === "/learn" || path.startsWith("/learn/")) return `/student${path.slice("/learn".length) || ""}`;
  return path;
}

export function isInternalCourseHref(raw: string | null | undefined): boolean {
  const href = safeHref(raw);
  if (!href) return false;
  const { host, path } = partsFromHref(href);
  if (host && !INTERNAL_HOSTS.has(host)) return false;
  if (host && INTERNAL_HOSTS.has(host)) return true;
  return /^(?:\/lessons|\/learn|\/student|\/coach|\/surveys|\/events|\/planner|\/coaching)\b/.test(path);
}

export function resolveCourseHref(raw: string | null | undefined): string | null {
  const href = safeHref(raw);
  if (!href) return null;
  const { host, path } = partsFromHref(href);
  if (isInternalCourseHref(href)) return rewriteCoursePath(path || "/");
  if (host && INTERNAL_HOSTS.has(host)) return rewriteCoursePath(path || "/");
  return href;
}

export function linkDisplayLabel(raw: string, explicit?: string): string {
  const named = String(explicit || "").trim();
  if (named) return named;
  const href = safeHref(raw);
  if (!href) return String(raw || "").trim();
  if (!isInternalCourseHref(href)) return String(raw || href).trim();
  const original = String(raw || "").trim();
  const path = original.replace(/^https?:\/\/[^/]+/i, "") || partsFromHref(href).path;
  try {
    return decodeURIComponent(path || href);
  } catch {
    return path || href;
  }
}

export function markdownLink(text: string, url: string): string {
  const label = String(text || "").trim() || String(url || "").trim();
  const href = String(url || "").trim();
  if (!label || !href) return "";
  const safe = safeHref(href) || (/^[\w.-]+\.[a-z]{2,}/i.test(href) ? `https://${href}` : href);
  return `[${label}](${safe})`;
}
