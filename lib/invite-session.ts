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

type AuthUser = { id?: string } | null;

type AuthClient = {
  auth: {
    getSession: () => Promise<{ data: { session: { user?: AuthUser } | null } }>;
    getUser?: () => Promise<{ data: { user: AuthUser }; error: { message?: string } | null }>;
    exchangeCodeForSession: (code: string) => Promise<{ error: { message?: string } | null }>;
    verifyOtp: (args: {
      token_hash: string;
      type: "invite" | "recovery" | "signup" | "magiclink" | "email";
    }) => Promise<{ error: { message?: string } | null }>;
    setSession: (tokens: {
      access_token: string;
      refresh_token: string;
    }) => Promise<{ error: { message?: string } | null }>;
    updateUser: (values: { password: string }) => Promise<{ error: { message?: string; code?: string; status?: number } | null }>;
  };
};

const EXPIRED_INVITE_COPY =
  "This invitation link has expired or has already been used. Email me at yvonne@accountingstudyadvice.com for help.";
const MISSING_RESET_COPY = "Open the password-reset link from your email again to choose a new password.";
const GENERIC_PASSWORD_COPY =
  "We could not save your password. Wait a moment and try again, or email me at yvonne@accountingstudyadvice.com for help.";
const WEAK_PASSWORD_COPY = "Choose a password with at least 6 characters.";

export function parseInviteAuthParams(search: string, hash: string): InviteAuthParams {
  const query = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  return {
    type: query.get("type") || fragment.get("type") || "",
    code: query.get("code"),
    tokenHash: query.get("token_hash") || query.get("token"),
    accessToken: fragment.get("access_token"),
    refreshToken: fragment.get("refresh_token"),
  };
}

export function consumeAuthParamsFromLocation(location: { search: string; hash: string }): {
  params: InviteAuthParams;
  nextSearch: string;
} {
  const params = parseInviteAuthParams(location.search, location.hash);
  const query = new URLSearchParams(location.search.startsWith("?") ? location.search.slice(1) : location.search);
  query.delete("code");
  query.delete("token_hash");
  query.delete("token");
  const nextSearch = query.toString() ? `?${query.toString()}` : "";
  return { params, nextSearch };
}

export function isInvitePasswordFlow(params: InviteAuthParams): boolean {
  return params.type === "invite";
}

export function isRecoveryPasswordFlow(params: InviteAuthParams): boolean {
  return params.type === "recovery";
}

export function passwordResetRedirectUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/auth/update-password?type=recovery`;
}

export function isAuthPasswordPath(pathname: string): boolean {
  return pathname.startsWith("/auth/callback") || pathname.startsWith("/auth/update-password");
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

export function openingPasswordSessionCopy(invite: boolean): string {
  return invite ? "Opening your invitation…" : "Opening your password reset…";
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
  if (/reauth|reauthentication/i.test(raw)) {
    return invite ? EXPIRED_INVITE_COPY : MISSING_RESET_COPY;
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

export function otpTypeFromParams(params: InviteAuthParams): "invite" | "recovery" | "signup" | "magiclink" | "email" {
  if (
    params.type === "recovery" ||
    params.type === "signup" ||
    params.type === "magiclink" ||
    params.type === "email"
  ) {
    return params.type;
  }
  return "invite";
}

async function currentAuthUser(client: AuthClient): Promise<AuthUser> {
  if (client.auth.getUser) {
    const result = await client.auth.getUser();
    return result.data.user;
  }
  const session = await client.auth.getSession();
  return session.data.session?.user || null;
}

async function applyAuthMaterial(client: AuthClient, params: InviteAuthParams): Promise<string | null> {
  if (params.code) {
    const result = await client.auth.exchangeCodeForSession(params.code);
    return result.error?.message || null;
  }
  if (params.tokenHash) {
    const result = await client.auth.verifyOtp({ token_hash: params.tokenHash, type: otpTypeFromParams(params) });
    return result.error?.message || null;
  }
  if (params.accessToken && params.refreshToken) {
    const result = await client.auth.setSession({
      access_token: params.accessToken,
      refresh_token: params.refreshToken,
    });
    return result.error?.message || null;
  }
  return null;
}

export async function establishAuthSession(
  client: AuthClient,
  params: InviteAuthParams
): Promise<SessionEstablishment> {
  if (hasInviteRecoveryMaterial(params)) {
    await applyAuthMaterial(client, params);
    if (await currentAuthUser(client)) return { ok: true };
    return { ok: false, reason: "expired" };
  }
  if (await currentAuthUser(client)) return { ok: true };
  return { ok: false, reason: "missing" };
}

export async function savePasswordWithSession(
  client: AuthClient,
  password: string
): Promise<{ error: { message?: string; code?: string; status?: number } | null }> {
  if (!(await currentAuthUser(client))) {
    return { error: { message: "Auth session missing!", code: "session_missing" } };
  }
  return client.auth.updateUser({ password });
}
