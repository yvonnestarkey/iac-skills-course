import { headers } from "next/headers";
import { lmsFrontFromHost, type LmsFront } from "./lms-hosts";

export async function currentLmsFront(): Promise<LmsFront> {
  const headerStore = await headers();
  return lmsFrontFromHost(headerStore.get("x-forwarded-host") || headerStore.get("host"));
}
