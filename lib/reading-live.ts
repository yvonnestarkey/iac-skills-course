import { createHash } from "node:crypto";

/** Server-only helpers for the open live-session link (/live/<id>). */
export const liveHash = (value: string) =>
  createHash("sha256").update(`${process.env.READING_LIVE_SALT || "rtr-live"}:${value}`).digest("hex").slice(0, 32);

export function requestAddress(req: Request): string {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
}
