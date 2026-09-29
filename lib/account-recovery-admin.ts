import {
  authSnapshotFromAdminUser,
  parseHasPassword,
  type AuthActivationSnapshot,
} from "@/lib/account-activation";
import { findAuthUserByEmail } from "@/lib/coach-invites-admin";
import { sendExistingUserPasswordSetup, type PasswordSetupDeps } from "@/lib/account-recovery";
import { getServiceSupabase } from "@/lib/supabase-admin";
import { siteUrl } from "@/lib/stripe-commerce";

function snapshotFromGoTrueUser(user: {
  id: string;
  email?: string | null;
  invited_at?: string | null;
  email_confirmed_at?: string | null;
  last_sign_in_at?: string | null;
  recovery_sent_at?: string | null;
  confirmation_sent_at?: string | null;
}): AuthActivationSnapshot {
  return authSnapshotFromAdminUser({
    id: user.id,
    email: user.email || null,
    invited_at: user.invited_at || null,
    email_confirmed_at: user.email_confirmed_at || null,
    last_sign_in_at: user.last_sign_in_at || null,
    recovery_sent_at: user.recovery_sent_at || null,
    confirmation_sent_at: user.confirmation_sent_at || null,
  });
}

export function createPasswordSetupDeps(): PasswordSetupDeps | null {
  const client = getServiceSupabase();
  if (!client) return null;
  return {
    siteUrl: siteUrl(),
    async findUser(email) {
      const found = await findAuthUserByEmail(email);
      if (!found) return null;
      const { data } = await client.auth.admin.getUserById(found.id);
      return data.user ? snapshotFromGoTrueUser(data.user) : snapshotFromGoTrueUser(found);
    },
    async confirmEmail(userId) {
      const { error } = await client.auth.admin.updateUserById(userId, { email_confirm: true });
      if (error) throw new Error(error.message);
    },
    async sendRecoveryEmail(email, redirectTo) {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
      return { error: error?.message || null };
    },
  };
}

export async function sendPasswordSetupForEmail(email: string) {
  const deps = createPasswordSetupDeps();
  if (!deps) {
    return {
      ok: true as const,
      emailed: false,
      created_user: false as const,
      entitlement_changed: false as const,
      reason: "send_failed" as const,
      message: "Supabase is not configured.",
    };
  }
  return sendExistingUserPasswordSetup(email, deps);
}

export async function listAccountActivationSnapshots(): Promise<AuthActivationSnapshot[]> {
  const client = getServiceSupabase();
  if (!client) return [];
  const { data, error } = await client.rpc("list_student_account_activation");
  if (!error && Array.isArray(data)) {
    return data.map((row) =>
      authSnapshotFromAdminUser({
        id: String(row.user_id),
        email: row.email ? String(row.email) : null,
        invited_at: row.invited_at ? String(row.invited_at) : null,
        email_confirmed_at: row.email_confirmed_at ? String(row.email_confirmed_at) : null,
        last_sign_in_at: row.last_sign_in_at ? String(row.last_sign_in_at) : null,
        recovery_sent_at: row.recovery_sent_at ? String(row.recovery_sent_at) : null,
        confirmation_sent_at: row.confirmation_sent_at ? String(row.confirmation_sent_at) : null,
        has_password: parseHasPassword(row.has_password),
      })
    );
  }

  const snapshots: AuthActivationSnapshot[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const listed = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (listed.error) break;
    (listed.data.users || []).forEach((user) => snapshots.push(snapshotFromGoTrueUser(user)));
    if ((listed.data.users || []).length < 200) break;
  }
  return snapshots;
}
