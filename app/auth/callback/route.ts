import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/auth/update-password";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const safeNext = next.startsWith("/") ? next : "/auth/update-password";
  const destination = new URL(safeNext, url.origin);
  if (destination.pathname === "/auth/update-password" && !destination.searchParams.get("type")) {
    destination.searchParams.set("type", "recovery");
  }
  if (!code || !supabaseUrl || !anonKey) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  const redirect = NextResponse.redirect(destination);
  const store = await cookies();
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          store.set(name, value, options);
          redirect.cookies.set(name, value, options);
        });
      },
    },
  });
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/auth/update-password?type=recovery", url.origin));
  }
  return redirect;
}
