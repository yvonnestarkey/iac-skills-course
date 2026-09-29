export type AccountActivationStatus = "activated" | "needs_activation" | "unavailable";

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

export type CoachActivationPublicRow = {
  user_id: string;
  has_password: boolean | null;
  activation_status: AccountActivationStatus;
};

export function parseHasPassword(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function accountActivationStatus(user: AuthActivationSnapshot | Pick<AuthActivationSnapshot, "has_password">): AccountActivationStatus {
  if (user.has_password === true) return "activated";
  if (user.has_password === false) return "needs_activation";
  return "unavailable";
}

export function accountActivationLabel(
  status: AccountActivationStatus | null | undefined
): "Can sign in" | "Needs activation" | "Activation status unavailable" {
  if (status === "activated") return "Can sign in";
  if (status === "needs_activation") return "Needs activation";
  return "Activation status unavailable";
}

export function canSendPasswordSetupLink(status: AccountActivationStatus | null | undefined): boolean {
  return status === "needs_activation";
}

export function parseAccountActivationStatus(value: unknown): AccountActivationStatus | undefined {
  if (value === "activated" || value === "needs_activation" || value === "unavailable") return value;
  return undefined;
}

export function coachActivationPublicRow(snapshot: AuthActivationSnapshot): CoachActivationPublicRow {
  const has_password = parseHasPassword(snapshot.has_password);
  return {
    user_id: snapshot.user_id,
    has_password,
    activation_status: accountActivationStatus({ has_password }),
  };
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
    has_password: parseHasPassword(user.has_password),
  };
}
