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

const CATALOG_HOSTS = new Set([APEX_HOST, `www.${APEX_HOST}`]);

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
  return CATALOG_HOSTS.has(hostnameOf(hostHeader));
}

export function isIacLmsHost(hostHeader: string | null | undefined): boolean {
  const host = hostnameOf(hostHeader);
  return host === IAC_LMS_HOST || host === `www.${IAC_LMS_HOST}` || host.startsWith("iac.");
}

export function lmsFrontFromHost(hostHeader: string | null | undefined): LmsFront {
  if (isCatalogHost(hostHeader)) return "catalog";
  if (isClassLmsHost(hostHeader)) return "class";
  return "iac";
}

export function iacLmsOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || IAC_LMS_ORIGIN).replace(/\/$/, "");
}

export function catalogOrigin(): string {
  return (process.env.NEXT_PUBLIC_CATALOG_URL || APEX_ORIGIN).replace(/\/$/, "");
}

export function classLmsOrigin(): string {
  return (process.env.NEXT_PUBLIC_CLASS_LMS_URL || CLASS_LMS_ORIGIN).replace(/\/$/, "");
}

/** Public catalog: accountingstudyadvice.com/courses */
export function catalogPath(_front?: LmsFront): string {
  return "/courses";
}

export function publicCatalogUrl(): string {
  return `${catalogOrigin()}/courses`;
}

export function iacSalesUrl(): string {
  return `${iacLmsOrigin()}/`;
}

export function iacClassroomUrl(): string {
  return `${iacLmsOrigin()}/student`;
}
