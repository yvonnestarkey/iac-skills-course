export type AccountProfile = {
  email: string;
  full_name: string;
  phone_number: string;
  accountability_email: string;
};

export function asProfileText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeAccountProfile(input: Partial<AccountProfile> | null | undefined): AccountProfile {
  return {
    email: asProfileText(input?.email).toLowerCase(),
    full_name: asProfileText(input?.full_name),
    phone_number: asProfileText(input?.phone_number),
    accountability_email: asProfileText(input?.accountability_email).toLowerCase(),
  };
}

export function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validateAccountProfile(input: AccountProfile): string | null {
  const profile = normalizeAccountProfile(input);
  if (!profile.full_name) return "Enter your name.";
  if (!isLikelyEmail(profile.email)) return "Enter a valid email address.";
  if (profile.accountability_email && !isLikelyEmail(profile.accountability_email)) {
    return "Enter a valid accountability email, or leave it blank.";
  }
  return null;
}

/** Keep a name or email the user already saved. Only fill blanks from auth. */
export function keptProfileIdentity(
  existing: { email?: string | null; full_name?: string | null } | null | undefined,
  incoming: { email: string; full_name: string }
): { email: string; full_name: string } {
  return {
    email: asProfileText(existing?.email) || incoming.email,
    full_name: asProfileText(existing?.full_name) || incoming.full_name,
  };
}

export function accountProfileFromSources(input: {
  profile?: Partial<AccountProfile> | null;
  email?: string | null;
  full_name?: string | null;
}): AccountProfile {
  return normalizeAccountProfile({
    email: asProfileText(input.profile?.email) || asProfileText(input.email),
    full_name: asProfileText(input.profile?.full_name) || asProfileText(input.full_name),
    phone_number: input.profile?.phone_number,
    accountability_email: input.profile?.accountability_email,
  });
}
