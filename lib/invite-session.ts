export type InviteAuthParams = {
  type: string;
  code: string | null;
  tokenHash: string | null;
  accessToken: string | null;
  refreshToken: string | null;
};

export type SessionEstablishment =
  | { ok: true }
  | { ok: false; reason: "expired" | "missing" | "failed" };

type AuthClient = {
  auth: {
    getSession: () => Promise<{ data: { session: { user?: unknown } | null } }>;
    exchangeCodeForSession: (code: string) => Promise<{ error: { message?: string } | null }>;
    verifyOtp: (args: {
      token_hash: string;
      type: "invite" | "recovery" | "signup" | "magiclink" | "email";
    }) => Promise<{ error: { message?: string } | null }>;
    setSession: (tokens: {
      access_token: string;
      refresh_token: string;
    }) => Promise<{ error: { message?: string } | null }>;
  };
};

const EXPIRED_INVITE_COPY =
  "This invitation link has expired or has already been used. Reply to the invitation email and Yvonne can send a new one.";
const MISSING_RESET_COPY = "Open the password-reset link from your email again to choose a new password.";
const GENERIC_PASSWORD_COPY = "We could not save your password. Wait a moment and try again, or reply to the invitation email for help.";
const WEAK_PASSWORD_COPY = "Choose a password with at least 6 characters.";

export function parseInviteAuthParams(search: string, hash: string): InviteAuthParams {
  const query = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  return {
    type: query.get("type") || fragment.get("type") || "",
    code: query.get("code"),
    tokenHash: query.get("token_hash"),
    accessToken: fragment.get("access_token"),
    refreshToken: fragment.get("refresh_token"),
  };
}

export function isInvitePasswordFlow(params: InviteAuthParams): boolean {
  return params.type === "invite";
}

export function hasInviteRecoveryMaterial(params: InviteAuthParams): boolean {
  return Boolean(params.code || params.tokenHash || (params.accessToken && params.refreshToken));
}

export function canSubmitInvitePassword(state: {
  sessionReady: boolean;
  invalid: boolean;
  submitting: boolean;
}): boolean {
  return state.sessionReady && !state.invalid && !state.submitting;
}

export function afterPasswordSavedPath(invite: boolean): "/onboarding" | null {
  return invite ? "/onboarding" : null;
}

export function expiredInviteMessage(): string {
  return EXPIRED_INVITE_COPY;
}

export function sessionNotReadyMessage(invite: boolean): string {
  return invite ? EXPIRED_INVITE_COPY : MISSING_RESET_COPY;
}

export function studentFacingPasswordError(
  error: { message?: string; code?: string; status?: number } | null | undefined,
  invite: boolean
): string {
  const raw = `${error?.message || ""} ${error?.code || ""}`.toLowerCase();
  if (/session missing|not authenticated|no session|auth session/i.test(raw)) {
    return invite
      ? "Your invitation is still opening. Wait until the page is ready, then save your password once."
      : MISSING_RESET_COPY;
  }
  if (/expired|invalid|already been used|otp_expired|token.*used|403|422/.test(raw)) {
    return sessionNotReadyMessage(invite);
  }
  if (/password.*(?:6|least|weak|short)/i.test(raw)) return WEAK_PASSWORD_COPY;
  if (!raw.trim()) return GENERIC_PASSWORD_COPY;
  return GENERIC_PASSWORD_COPY;
}

export function shouldShowRawAuthError(): false {
  return false;
}

export async function establishAuthSession(
  client: AuthClient,
  params: InviteAuthParams
): Promise<SessionEstablishment> {
  const existing = await client.auth.getSession();
  if (existing.data.session?.user) return { ok: true };

  let recoveryError: string | null = null;
  if (params.code) {
    const result = await client.auth.exchangeCodeForSession(params.code);
    recoveryError = result.error?.message || null;
  } else if (params.tokenHash) {
    const otpType =
      params.type === "recovery" || params.type === "signup" || params.type === "magiclink" || params.type === "email"
        ? params.type
        : "invite";
    const result = await client.auth.verifyOtp({ token_hash: params.tokenHash, type: otpType });
    recoveryError = result.error?.message || null;
  } else if (params.accessToken && params.refreshToken) {
    const result = await client.auth.setSession({
      access_token: params.accessToken,
      refresh_token: params.refreshToken,
    });
    recoveryError = result.error?.message || null;
  }

  const next = await client.auth.getSession();
  if (next.data.session?.user) return { ok: true };
  if (hasInviteRecoveryMaterial(params) || recoveryError) return { ok: false, reason: "expired" };
  return { ok: false, reason: "missing" };
}
