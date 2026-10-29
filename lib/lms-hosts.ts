/** Public LMS hosts. Do not invent another host. */

export const IAC_LMS_HOST = "iac.accountingstudyadvice.com";
export const CLASS_LMS_HOST = "class.accountingstudyadvice.com";
export const THINKIFIC_HOST = "courses.accountingstudyadvice.com";

export const IAC_LMS_ORIGIN = `https://${IAC_LMS_HOST}`;
export const CLASS_LMS_ORIGIN = `https://${CLASS_LMS_HOST}`;

export type LmsFront = "iac" | "class";

const CLASS_HOSTS = new Set([
  CLASS_LMS_HOST,
  "class.localhost",
  "class.local",
  "class.127.0.0.1.nip.io",
]);

export function hostnameOf(hostHeader: string | null | undefined): string {
  return String(hostHeader || "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
}

export function isClassLmsHost(hostHeader: string | null | undefined): boolean {
  const host = hostnameOf(hostHeader);
  if (CLASS_HOSTS.has(host)) return true;
  return host.startsWith("class.");
}

export function isIacLmsHost(hostHeader: string | null | undefined): boolean {
  const host = hostnameOf(hostHeader);
  return host === IAC_LMS_HOST || host === `www.${IAC_LMS_HOST}` || host.startsWith("iac.");
}

export function lmsFrontFromHost(hostHeader: string | null | undefined): LmsFront {
  return isClassLmsHost(hostHeader) ? "class" : "iac";
}

export function classLmsOrigin(): string {
  return (process.env.NEXT_PUBLIC_CLASS_LMS_URL || CLASS_LMS_ORIGIN).replace(/\/$/, "");
}

export function iacLmsOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || IAC_LMS_ORIGIN).replace(/\/$/, "");
}

/** Catalog lives at `/` on class.; internally it is `/courses` on every host (including localhost). */
export function catalogPath(front: LmsFront): string {
  return front === "class" ? "/" : "/courses";
}

export function publicClassCourseUrl(slug: string): string {
  return `${classLmsOrigin()}/${slug.replace(/^\/+/, "")}`;
}
