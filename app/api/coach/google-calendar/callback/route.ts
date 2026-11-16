import { NextResponse } from "next/server";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import { finishGoogleOAuth } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getRequestUser();
  const url = new URL(request.url);
  const dest = new URL("/coach/google-calendar", url.origin);
  if (!isStaffUser(user)) {
    dest.searchParams.set("error", "staff");
    return NextResponse.redirect(dest);
  }
  const error = url.searchParams.get("error");
  if (error) {
    dest.searchParams.set("error", "denied");
    return NextResponse.redirect(dest);
  }
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  try {
    const saved = await finishGoogleOAuth(code, state, url.origin);
    if (!saved.ok) {
      dest.searchParams.set("error", saved.error || "connect");
      return NextResponse.redirect(dest);
    }
    dest.searchParams.set("connected", "1");
    return NextResponse.redirect(dest);
  } catch (caught) {
    dest.searchParams.set("error", caught instanceof Error ? caught.message : "connect");
    return NextResponse.redirect(dest);
  }
}
