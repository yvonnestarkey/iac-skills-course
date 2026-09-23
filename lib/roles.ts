const DEFAULT_COACH_EMAILS = [
  "coach@accountingstudyadvice.com",
  "admin@accountingstudyadvice.com",
  "yvonne@accountingstudyadvice.com",
];

type AuthLike = {
  id?: string;
  email?: string | null;
  role?: string | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
};

export function allowedCoachEmails(): string[] {
  const fromEnv = (process.env.NEXT_PUBLIC_COACH_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...DEFAULT_COACH_EMAILS, ...fromEnv])];
}

/** Staff role from server-controlled app_metadata only. Never user_metadata. */
export function staffRoleFromAppMetadata(appMetadata: Record<string, unknown> | null | undefined): "coach" | "admin" | null {
  const role = typeof appMetadata?.role === "string" ? appMetadata.role.toLowerCase() : "";
  return role === "coach" || role === "admin" ? role : null;
}

export function studentUserRoleFromAuth(user: {
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
}): string | null {
  return staffRoleFromAppMetadata(user.app_metadata);
}

/** True only for coach/admin accounts — regular students such as s1@test.com stay hidden. */
export function isCoachAccount(user: AuthLike | null | undefined): boolean {
  if (!user) return false;
  if (staffRoleFromAppMetadata(user.app_metadata)) return true;
  if (!("app_metadata" in user) && !("user_metadata" in user)) {
    const role = (user.role || "").toLowerCase();
    if (role === "coach" || role === "admin") return true;
  }
  const email = (user.email || "").toLowerCase();
  return Boolean(email) && allowedCoachEmails().includes(email);
}
