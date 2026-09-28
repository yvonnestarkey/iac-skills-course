export type AccountActivationStatus = "activated" | "needs_activation";

export type AuthActivationSnapshot = {
  user_id: string;
  email?: string | null;
  invited_at?: string | null;
  email_confirmed_at?: string | null;
  last_sign_in_at?: string | null;
  recovery_sent_at?: string | null;
  confirmation_sent_at?: string | null;
  /** Authoritative when read from auth.users.encrypted_password. Null if that signal is unavailable. */
  has_password?: boolean | null;
};

export function accountActivationStatus(user: AuthActivationSnapshot): AccountActivationStatus {
  if (user.has_password === true) return "activated";
  if (user.has_password === false) return "needs_activation";
  if (user.invited_at && !user.email_confirmed_at) return "needs_activation";
  if (user.invited_at) return "needs_activation";
  if (user.last_sign_in_at) return "activated";
  return "needs_activation";
}

export function accountActivationLabel(status: AccountActivationStatus): "Can sign in" | "Needs activation" {
  return status === "activated" ? "Can sign in" : "Needs activation";
}

export function canSendPasswordSetupLink(status: AccountActivationStatus): boolean {
  return status === "needs_activation";
}

export function recentlySentRecovery(sentAt: string | null | undefined, now = new Date(), windowMs = 120_000): boolean {
  if (!sentAt) return false;
  const at = new Date(sentAt).getTime();
  if (Number.isNaN(at)) return false;
  return now.getTime() - at < windowMs;
}

export function authSnapshotFromAdminUser(user: {
  id: string;
  email?: string | null;
  invited_at?: string | null;
  email_confirmed_at?: string | null;
  last_sign_in_at?: string | null;
  recovery_sent_at?: string | null;
  confirmation_sent_at?: string | null;
  has_password?: boolean | null;
}): AuthActivationSnapshot {
  return {
    user_id: user.id,
    email: user.email || null,
    invited_at: user.invited_at || null,
    email_confirmed_at: user.email_confirmed_at || null,
    last_sign_in_at: user.last_sign_in_at || null,
    recovery_sent_at: user.recovery_sent_at || null,
    confirmation_sent_at: user.confirmation_sent_at || null,
    has_password: typeof user.has_password === "boolean" ? user.has_password : null,
  };
}
