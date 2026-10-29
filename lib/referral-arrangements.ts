import { discountCents, FALLBACK_PRODUCT, type CourseProduct } from "@/lib/commerce";
import { formatUsdCents } from "@/lib/format-money";
import { studentProfilePath } from "@/lib/student-profile-link";

const COURSE_NAME = "January 2027 IAC Skills Course";

export type ReferralExtraArrangement = {
  referrerEmail: string;
  extraBps: number;
  action: string;
};

export type ReferralArrangementStatus = "waiting" | "action_needed";

/** Special extra-discount deals on top of the standard 10% referrer credit. */
export const REFERRAL_EXTRA_ARRANGEMENTS: ReferralExtraArrangement[] = [
  {
    referrerEmail: "tchipara97@gmail.com",
    extraBps: 500,
    action: "Add another 5% to his discount as part of our arrangement.",
  },
];

export function normalizeArrangementEmail(email: string | null | undefined): string {
  return String(email || "").trim().toLowerCase();
}

export function arrangementForEmail(email: string | null | undefined): ReferralExtraArrangement | null {
  const needle = normalizeArrangementEmail(email);
  if (!needle) return null;
  return REFERRAL_EXTRA_ARRANGEMENTS.find((row) => normalizeArrangementEmail(row.referrerEmail) === needle) || null;
}

export function extraDiscountCents(extraBps: number, product: CourseProduct = FALLBACK_PRODUCT): number {
  return discountCents(product.once_off_amount_cents, extraBps);
}

export function referralExtraInboxContext(rewardId: string): string {
  return `referral-extra:${String(rewardId || "").trim()}`;
}

export function referralExtraNotifyIdempotencyKey(rewardId: string): string {
  return `iac-referral-extra-${String(rewardId || "").trim()}`;
}

export function referralExtraNotifySubject(studentName: string): string {
  const name = studentName.trim() || "Student";
  return `Add extra 5% — ${name} referral credit is now active`;
}

export type ReferralExtraNotifyContent = {
  studentName: string;
  studentEmail: string;
  studentId?: string | null;
  creditCents: number;
  extraCents: number;
  extraBps: number;
  action: string;
  profileUrl?: string | null;
};

export function buildReferralExtraNotifyEmail(content: ReferralExtraNotifyContent): {
  subject: string;
  text: string;
  html: string;
} {
  const percent = content.extraBps / 100;
  const lines = [
    `${content.studentName}'s 10% referral credit is now active.`,
    "",
    `Student name: ${content.studentName}`,
    `Student email: ${content.studentEmail}`,
    `Course: ${COURSE_NAME}`,
    `Standard 10% referral credit: ${formatUsdCents(content.creditCents)}`,
    `Extra ${percent}% to add: ${formatUsdCents(content.extraCents)}`,
    `Action: ${content.action}`,
    "He is on the 6-payment plan. Add the extra amount as course credit on his Stripe customer balance so it comes off the next instalment.",
  ];
  if (content.profileUrl) lines.push(`Student profile: ${content.profileUrl}`);

  const text = lines.join("\n");
  const html = `<p>${lines.map((line) => (line ? escapeHtml(line) : "<br />")).join("<br />")}</p>`;
  return {
    subject: referralExtraNotifySubject(content.studentName),
    text,
    html,
  };
}

export function buildReferralExtraInboxBody(content: ReferralExtraNotifyContent): string {
  const percent = content.extraBps / 100;
  const lines = [
    "SYSTEM REMINDER — this is not a student message.",
    "",
    `${content.studentName}'s 10% referral credit is now active. ${content.action}`,
    "",
    `Student: ${content.studentName}`,
    `Email: ${content.studentEmail}`,
    `Course: ${COURSE_NAME}`,
    `Standard 10% credit: ${formatUsdCents(content.creditCents)}`,
    `Extra ${percent}% to add: ${formatUsdCents(content.extraCents)}`,
    "Add the extra amount as course credit on his Stripe customer balance so it comes off the next instalment.",
  ];
  if (content.profileUrl) lines.push(`Profile: ${content.profileUrl}`);
  return lines.join("\n");
}

export function referralArrangementBanner(
  status: ReferralArrangementStatus,
  extraCents: number
): string {
  if (status === "action_needed") {
    return `His 10% referral credit is now active. Add another 5% (${formatUsdCents(extraCents)}) to his next payment as agreed.`;
  }
  return `Waiting for a friend to register with his referral code. When that 10% credit activates, you will get an inbox notification to add another 5% (${formatUsdCents(extraCents)}) as agreed.`;
}

export function publicStudentProfileUrl(studentId: string, origin = "https://iac.accountingstudyadvice.com"): string {
  const base = origin.replace(/\/$/, "");
  return `${base}${studentProfilePath(studentId)}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
