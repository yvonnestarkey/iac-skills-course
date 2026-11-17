import { inviteUserMetadata } from "./invite-email";
import { getServiceSupabase } from "./supabase-admin";

export async function updateStudentDisplayName(
  studentId: string,
  fullName: string
): Promise<{ ok: true; full_name: string } | { ok: false; error: string }> {
  const client = getServiceSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };

  const now = new Date().toISOString();
  const row = { full_name: fullName, updated_at: now };
  let write = await client.from("profiles").update(row).eq("id", studentId);
  if (write.error && /updated_at|could not find|schema cache/i.test(write.error.message)) {
    write = await client.from("profiles").update({ full_name: fullName }).eq("id", studentId);
  }
  if (write.error) return { ok: false, error: write.error.message };

  const existing = await client.auth.admin.getUserById(studentId);
  if (existing.error || !existing.data.user) return { ok: false, error: "That student was not found." };

  const { error } = await client.auth.admin.updateUserById(studentId, {
    user_metadata: {
      ...(existing.data.user.user_metadata || {}),
      ...inviteUserMetadata(fullName),
    },
  });
  if (error) return { ok: false, error: error.message };

  return { ok: true, full_name: fullName };
}
