export type AccountProfile = {
  email: string;
  full_name: string;
  phone_number: string;
  accountability_email: string;
};

export type PersonName = {
  firstName: string;
  lastName: string;
};

export function asProfileText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nameKey(value: string): string {
  return value.trim().toLowerCase().replace(/[._-]+/g, " ").replace(/\s+/g, " ");
}

/** True when the stored name is blank or just the email username. */
export function isPlaceholderPersonName(fullName: string | null | undefined, email: string | null | undefined): boolean {
  const name = asProfileText(fullName);
  if (!name) return true;
  if (name.includes("@")) return true;
  const local = asProfileText(email).split("@")[0] || "";
  if (!local) return false;
  return nameKey(name) === nameKey(local);
}

export function splitPersonName(fullName: string | null | undefined): PersonName {
  const parts = asProfileText(fullName).split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function joinPersonName(firstName: string | null | undefined, lastName: string | null | undefined): string {
  return [asProfileText(firstName), asProfileText(lastName)].filter(Boolean).join(" ");
}

export function editablePersonName(fullName: string | null | undefined, email: string | null | undefined): PersonName {
  if (isPlaceholderPersonName(fullName, email)) return { firstName: "", lastName: "" };
  return splitPersonName(fullName);
}

export function validatePersonName(firstName: string | null | undefined, lastName: string | null | undefined): string | null {
  if (!asProfileText(firstName)) return "Enter the first name.";
  if (!asProfileText(lastName)) return "Enter the surname.";
  return null;
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
  const name = splitPersonName(profile.full_name);
  if (!name.firstName) return "Enter your first name.";
  if (!name.lastName) return "Enter your surname.";
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
  const email = asProfileText(existing?.email) || incoming.email;
  const savedName = asProfileText(existing?.full_name);
  const keepName = savedName && !isPlaceholderPersonName(savedName, email || existing?.email);
  return {
    email,
    full_name: keepName ? savedName : incoming.full_name,
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
