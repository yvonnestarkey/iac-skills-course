import { REGISTRATION_CONTACT_EMAIL } from "@/lib/sales-copy";

export const INVITE_EMAIL_SUBJECT = "Your January 2027 IAC Course preview is ready";
export const INVITE_SENDER_NAME = "Yvonne | Accounting Study Advice";
export const INVITE_SENDER_EMAIL = REGISTRATION_CONTACT_EMAIL;
export const INVITE_REPLY_TO = REGISTRATION_CONTACT_EMAIL;
export const INVITE_LOGO_PATH = "/asa-logo.png";
export const INVITE_LOGO_URL = "https://iac.accountingstudyadvice.com/asa-logo.png";

export function inviteLogoUrl(base = "https://iac.accountingstudyadvice.com"): string {
  return `${base.replace(/\/$/, "")}${INVITE_LOGO_PATH}`;
}

export function firstNameFromFullName(name: string): string | null {
  const first = name.trim().split(/\s+/).filter(Boolean)[0] || "";
  if (!first || first.includes("@") || first.length > 40) return null;
  return first;
}

export function inviteGreeting(firstName: string | null | undefined): string {
  return firstName ? `Hi ${firstName},` : "Hi there,";
}

export function inviteUserMetadata(fullName: string): { full_name: string; first_name?: string } {
  const trimmed = fullName.trim();
  const first_name = firstNameFromFullName(trimmed);
  return first_name ? { full_name: trimmed, first_name } : { full_name: trimmed };
}
