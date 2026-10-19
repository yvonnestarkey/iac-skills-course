import { DEFAULT_PRODUCT_ID } from "@/lib/commerce";
import { asAccessDate, type RegistrationAction } from "@/lib/student-registration";
import { getServiceSupabase } from "@/lib/supabase-admin";

export async function updateStudentRegistration(input: {
  userId: string;
  action: RegistrationAction;
  expiresOn?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const client = getServiceSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const userId = input.userId.trim();
  if (!userId) return { ok: false, error: "Student required." };

  const existing = await client
    .from("course_entitlements")
    .select("user_id, status, source")
    .eq("user_id", userId)
    .eq("product_id", DEFAULT_PRODUCT_ID)
    .maybeSingle();
  if (existing.error) return { ok: false, error: existing.error.message };

  const payload: Record<string, unknown> = {
    user_id: userId,
    product_id: DEFAULT_PRODUCT_ID,
    status: existing.data?.status === "full" ? "full" : "free_preview",
    source: existing.data?.source === "admin" || existing.data?.source === "stripe" ? existing.data.source : "signup",
    updated_at: new Date().toISOString(),
  };

  if (input.action === "deregister") {
    payload.deregistered_at = new Date().toISOString();
  } else if (input.action === "restore") {
    payload.deregistered_at = null;
    payload.access_expires_on = null;
  } else {
    const expiresOn = asAccessDate(input.expiresOn);
    if (!expiresOn) return { ok: false, error: "Choose an expiry date." };
    payload.access_expires_on = expiresOn;
    payload.deregistered_at = null;
  }

  let { error } = await client.from("course_entitlements").upsert(payload, { onConflict: "user_id,product_id" });
  if (error && /access_expires_on|deregistered_at|schema cache|column/i.test(error.message)) {
    return {
      ok: false,
      error: "Paste supabase/student-access-expiry.sql in the Supabase SQL editor, then try again.",
    };
  }
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateStudentRegistrations(input: {
  userIds: string[];
  action: RegistrationAction;
  expiresOn?: string | null;
}): Promise<{ ok: boolean; error?: string; updated: number }> {
  const userIds = [...new Set(input.userIds.map((id) => id.trim()).filter(Boolean))];
  if (!userIds.length) return { ok: false, error: "Student required.", updated: 0 };
  let updated = 0;
  for (const userId of userIds) {
    const result = await updateStudentRegistration({
      userId,
      action: input.action,
      expiresOn: input.expiresOn,
    });
    if (!result.ok) return { ok: false, error: result.error, updated };
    updated += 1;
  }
  return { ok: true, updated };
}
