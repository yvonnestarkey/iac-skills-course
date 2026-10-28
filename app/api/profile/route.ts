import { NextResponse } from "next/server";
import {
  accountProfileFromSources,
  normalizeAccountProfile,
  validateAccountProfile,
  type AccountProfile,
} from "@/lib/account-profile";
import { getRequestSupabase } from "@/lib/auth-server";
import { studentUserFromAuth } from "@/lib/student-lesson";

export const dynamic = "force-dynamic";

type ProfileRow = {
  email?: string | null;
  full_name?: string | null;
  phone_number?: string | null;
  accountability_email?: string | null;
};

function profileFromRow(user: { email?: string | null; full_name?: string | null }, row: ProfileRow | null): AccountProfile {
  return accountProfileFromSources({
    profile: row,
    email: user.email,
    full_name: user.full_name,
  });
}

export async function GET() {
  const supabase = await getRequestSupabase();
  if (!supabase) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { data, error } = await supabase
    .from("profiles")
    .select("email, full_name, phone_number, accountability_email")
    .eq("id", user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    profile: profileFromRow(studentUserFromAuth(user), data as ProfileRow | null),
  });
}

export async function PATCH(request: Request) {
  const supabase = await getRequestSupabase();
  if (!supabase) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Partial<AccountProfile> | null;
  const profile = normalizeAccountProfile(body);
  const invalid = validateAccountProfile(profile);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const currentEmail = String(user.email || "").trim().toLowerCase();
  const emailChanged = profile.email !== currentEmail;
  const authUpdate = await supabase.auth.updateUser({
    ...(emailChanged ? { email: profile.email } : {}),
    data: { full_name: profile.full_name },
  });
  if (authUpdate.error) {
    return NextResponse.json({ error: authUpdate.error.message }, { status: 400 });
  }

  const now = new Date().toISOString();
  const row = {
    email: profile.email,
    full_name: profile.full_name,
    phone_number: profile.phone_number || null,
    accountability_email: profile.accountability_email || null,
    updated_at: now,
  };
  let write = await supabase.from("profiles").update(row).eq("id", user.id);
  if (write.error && /updated_at|could not find|schema cache/i.test(write.error.message)) {
    const { updated_at: _updated, ...withoutStamp } = row;
    write = await supabase.from("profiles").update(withoutStamp).eq("id", user.id);
  }
  if (write.error) return NextResponse.json({ error: write.error.message }, { status: 400 });

  return NextResponse.json({
    profile,
    email_confirmation_required: emailChanged,
    message: emailChanged
      ? "Saved. Check the new inbox if we sent a confirmation email, then sign in with that address."
      : "Profile saved.",
  });
}
