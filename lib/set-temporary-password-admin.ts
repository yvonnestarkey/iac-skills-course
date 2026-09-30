import { setTemporaryPassword, type SetTemporaryPasswordResult } from "@/lib/set-temporary-password";
import { getServiceSupabase } from "@/lib/supabase-admin";

export async function setTemporaryPasswordForUser(
  userId: string,
  password: string
): Promise<SetTemporaryPasswordResult> {
  const client = getServiceSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };

  return setTemporaryPassword(
    { userId, password },
    {
      async updateUserPassword(id, nextPassword) {
        const existing = await client.auth.admin.getUserById(id);
        if (existing.error || !existing.data.user) {
          return { error: "That user was not found." };
        }
        const { error } = await client.auth.admin.updateUserById(id, {
          password: nextPassword,
          email_confirm: true,
        });
        if (error) return { error: error.message };
        return { email: existing.data.user.email || null };
      },
    }
  );
}
