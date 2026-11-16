import { NextResponse } from "next/server";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import { createGoogleOAuthState, googleAuthorizeUrl, googleOAuthConfigured } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.redirect(new URL("/coach", request.url));
  if (!googleOAuthConfigured()) {
    return NextResponse.redirect(new URL("/coach/google-calendar?error=config", request.url));
  }
  const origin = new URL(request.url).origin;
  const state = await createGoogleOAuthState();
  return NextResponse.redirect(googleAuthorizeUrl(state, origin));
}
