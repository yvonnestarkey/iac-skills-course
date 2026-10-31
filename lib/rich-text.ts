import { IAC_LMS_HOST, isIacLmsHost, isLocalDevHost } from "./lms-hosts";

/** IAC classroom only. The WordPress homepage (apex) and class. are different sites. */
const INTERNAL_HOSTS = new Set([
  IAC_LMS_HOST,
  `www.${IAC_LMS_HOST}`,
  "localhost",
  "127.0.0.1",
]);

const COURSE_PATH = /^(?:\/lessons|\/learn|\/student|\/coach|\/surveys|\/events|\/planner|\/coaching)\b/;

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
  if (host && !INTERNAL_HOSTS.has(host) && !isIacLmsHost(host) && !isLocalDevHost(host)) return false;
  return COURSE_PATH.test(path);
}

export function resolveCourseHref(raw: string | null | undefined): string | null {
  const href = safeHref(raw);
  if (!href) return null;
  const { host, path } = partsFromHref(href);
  // Keep the host the author pasted. WordPress, Thinkific, class., and other
  // sites must not be rewritten onto iac.
  if (host) return href;
  return rewriteCoursePath(path || "/");
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

export type TextMark = { text: string; bold?: boolean; underline?: boolean; italic?: boolean };

function splitMark(parts: TextMark[], pattern: RegExp, flag: keyof Omit<TextMark, "text">): TextMark[] {
  const next: TextMark[] = [];
  parts.forEach((part) => {
    if (part.bold && flag === "bold") {
      next.push(part);
      return;
    }
    const re = new RegExp(pattern.source, "g");
    let last = 0;
    let match: RegExpExecArray | null;
    const source = part.text;
    while ((match = re.exec(source))) {
      if (match.index > last) next.push({ ...part, text: source.slice(last, match.index) });
      next.push({ ...part, text: match[1], [flag]: true });
      last = match.index + match[0].length;
    }
    if (last < source.length) next.push({ ...part, text: source.slice(last) });
  });
  return next.filter((part) => part.text);
}

/** **bold**, __underline__, *italic* inside a plain string. Links are handled separately. */
export function parseTextMarks(text: string): TextMark[] {
  if (!text) return [];
  let parts: TextMark[] = [{ text }];
  parts = splitMark(parts, /\*\*(.+?)\*\*/, "bold");
  parts = splitMark(parts, /__(.+?)__/, "underline");
  parts = splitMark(parts, /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/, "italic");
  return parts.length ? parts : [{ text }];
}

export function wrapSelectedText(
  current: string,
  before: string,
  after: string,
  start: number,
  end: number
): { next: string; caretStart: number; caretEnd: number } {
  const from = Math.max(0, Math.min(start, current.length));
  const to = Math.max(from, Math.min(end, current.length));
  const selected = current.slice(from, to) || "text";
  const next = `${current.slice(0, from)}${before}${selected}${after}${current.slice(to)}`;
  const caretStart = from + before.length;
  return { next, caretStart, caretEnd: caretStart + selected.length };
}

export function markdownLink(text: string, url: string): string {
  const label = String(text || "").trim() || String(url || "").trim();
  const href = String(url || "").trim();
  if (!label || !href) return "";
  const safe = safeHref(href) || (/^[\w.-]+\.[a-z]{2,}/i.test(href) ? `https://${href}` : href);
  return `[${label}](${safe})`;
}
