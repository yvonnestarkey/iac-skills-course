/** Public LMS hosts. Do not invent another host. */

export const IAC_LMS_HOST = "iac.accountingstudyadvice.com";
export const APEX_HOST = "accountingstudyadvice.com";
export const CLASS_LMS_HOST = "class.accountingstudyadvice.com";
export const THINKIFIC_HOST = "courses.accountingstudyadvice.com";

export const IAC_LMS_ORIGIN = `https://${IAC_LMS_HOST}`;
export const APEX_ORIGIN = `https://${APEX_HOST}`;
export const CLASS_LMS_ORIGIN = `https://${CLASS_LMS_HOST}`;

export type LmsFront = "iac" | "catalog" | "class";

const CLASS_HOSTS = new Set([
  CLASS_LMS_HOST,
  "class.localhost",
  "class.local",
  "class.127.0.0.1.nip.io",
]);

/** Apex is WordPress on Kinsta. The LMS catalog is class., not the homepage. */

export function hostnameOf(hostHeader: string | null | undefined): string {
  return String(hostHeader || "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
}

export function isLocalDevHost(hostHeader: string | null | undefined): boolean {
  const host = hostnameOf(hostHeader);
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".local");
}

export function isClassLmsHost(hostHeader: string | null | undefined): boolean {
  const host = hostnameOf(hostHeader);
  if (CLASS_HOSTS.has(host)) return true;
  return host.startsWith("class.");
}

export function isCatalogHost(hostHeader: string | null | undefined): boolean {
  return isClassLmsHost(hostHeader);
}

export function isIacLmsHost(hostHeader: string | null | undefined): boolean {
  const host = hostnameOf(hostHeader);
  return host === IAC_LMS_HOST || host === `www.${IAC_LMS_HOST}` || host.startsWith("iac.");
}

export function lmsFrontFromHost(hostHeader: string | null | undefined): LmsFront {
  if (isClassLmsHost(hostHeader)) return "class";
  return "iac";
}

export function iacLmsOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || IAC_LMS_ORIGIN).replace(/\/$/, "");
}

/** WordPress owns the apex. Never treat it as the LMS catalog. */
export function resolvedCatalogOrigin(candidate: string | null | undefined): string {
  const raw = String(candidate || CLASS_LMS_ORIGIN).replace(/\/$/, "");
  try {
    const host = new URL(raw.includes("://") ? raw : `https://${raw}`).hostname.replace(/^www\./, "");
    if (host === APEX_HOST) return CLASS_LMS_ORIGIN;
  } catch {
    return CLASS_LMS_ORIGIN;
  }
  return raw;
}

export function catalogOrigin(): string {
  return resolvedCatalogOrigin(process.env.NEXT_PUBLIC_CATALOG_URL || process.env.NEXT_PUBLIC_CLASS_LMS_URL || CLASS_LMS_ORIGIN);
}

export function classLmsOrigin(): string {
  return (process.env.NEXT_PUBLIC_CLASS_LMS_URL || CLASS_LMS_ORIGIN).replace(/\/$/, "");
}

/** Public catalog: class.accountingstudyadvice.com/ */
export function catalogPath(front: LmsFront = "class"): string {
  return front === "class" ? "/" : "/courses";
}

export function publicCatalogUrl(): string {
  return `${catalogOrigin()}/`;
}

export function iacSalesUrl(): string {
  return `${iacLmsOrigin()}/`;
}

export function iacClassroomUrl(): string {
  return `${iacLmsOrigin()}/student`;
}
