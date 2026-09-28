import { SMOKE_TEST_METADATA_VALUE } from "@/lib/checkout-smoke-test";
import type { EntitlementSource } from "@/lib/account-access";
import type { EntitlementStatus, PurchaseOption } from "@/lib/commerce";
import { formatSastDateTime } from "@/lib/dates";
import { futurePlanInstallmentDates } from "@/lib/plan-installments";
import { sendResendEmail } from "@/lib/resend";
import { REGISTRATION_CONTACT_EMAIL } from "@/lib/sales-copy";
import { getServiceSupabase } from "@/lib/supabase-admin";

export const ENROLMENT_NOTIFY_TO = REGISTRATION_CONTACT_EMAIL;
export const ENROLMENT_COURSE_NAME = "January 2027 IAC Skills Course";

export type EnrolmentNotifyDecisionInput = {
  duplicateStripeEvent?: boolean;
  smokeTest?: boolean;
  entitlementStatus?: EntitlementStatus | null;
  entitlementSource?: EntitlementSource | null;
  option?: PurchaseOption | string | null;
  eventType?: string | null;
};

export type EnrolmentNotifyContent = {
  studentName: string;
  studentEmail: string;
  option: PurchaseOption;
  amountPaidNowCents: number;
  planCount?: number;
  remainingInstallmentDates?: Date[];
  referralCode?: string | null;
  promoCode?: string | null;
  creditAppliedCents?: number;
  enrolledAt: Date;
};

export function isSmokeTestMetadata(metadata: Record<string, unknown> | null | undefined): boolean {
  return String(metadata?.smoke_test || "") === SMOKE_TEST_METADATA_VALUE;
}

export function shouldNotifyYvonneOfEnrolment(input: EnrolmentNotifyDecisionInput): boolean {
  if (input.duplicateStripeEvent) return false;
  if (input.smokeTest) return false;
  if (input.eventType && input.eventType !== "checkout.session.completed") return false;
  if (input.entitlementStatus !== "full") return false;
  if (input.entitlementSource !== "stripe") return false;
  return input.option === "once_off" || input.option === "plan_6";
}

export function formatUsdCents(cents: number): string {
  return `US$${(Math.max(0, Number(cents) || 0) / 100).toFixed(2)}`;
}

export function purchaseOptionLabel(option: PurchaseOption): string {
  return option === "plan_6" ? "6-payment plan" : "Once-off";
}

export function enrolmentNotifySubject(studentName: string): string {
  return `New IAC enrolment — ${studentName.trim() || "Student"}`;
}

export function enrolmentNotifyIdempotencyKey(purchaseId: string): string {
  return `iac-enrolment-${purchaseId}`;
}

export function buildEnrolmentNotifyEmail(content: EnrolmentNotifyContent): {
  subject: string;
  text: string;
  html: string;
} {
  const optionLabel = purchaseOptionLabel(content.option);
  const lines = [
    `Student name: ${content.studentName}`,
    `Student email: ${content.studentEmail}`,
    `Course: ${ENROLMENT_COURSE_NAME}`,
    `Purchase option: ${optionLabel}`,
    `Amount paid now: ${formatUsdCents(content.amountPaidNowCents)}`,
  ];
  if (content.option === "plan_6") {
    const planCount = content.planCount || 6;
    const remaining = content.remainingInstallmentDates?.length ?? Math.max(0, planCount - 1);
    lines.push(`This is the first of ${planCount} payments. ${remaining} instalment${remaining === 1 ? "" : "s"} remain.`);
    if (content.remainingInstallmentDates?.length) {
      lines.push(
        `Remaining scheduled instalments: ${content.remainingInstallmentDates
          .map((date) => formatSastDateTime(date).replace(/ @ .+$/, ""))
          .join("; ")}`
      );
    }
  }
  const discountBits = [
    content.referralCode ? `Referral code ${content.referralCode}` : "",
    content.promoCode ? `Promo code ${content.promoCode}` : "",
    content.creditAppliedCents ? `Course credit ${formatUsdCents(content.creditAppliedCents)}` : "",
  ].filter(Boolean);
  lines.push(`Referral/discount: ${discountBits.join("; ") || "None"}`);
  lines.push(`Date/time of enrolment: ${formatSastDateTime(content.enrolledAt)}`);

  const text = lines.join("\n");
  const html = `<p>${lines.map((line) => escapeHtml(line)).join("<br />")}</p>`;
  return {
    subject: enrolmentNotifySubject(content.studentName),
    text,
    html,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function notifyYvonneOfSuccessfulEnrolment(
  params: {
    userId: string;
    purchaseId: string;
    option: PurchaseOption;
    amountPaidNowCents: number;
    referralCode?: string | null;
    promoCode?: string | null;
    creditAppliedCents?: number;
    enrolledAt?: Date;
    planCount?: number;
    remainingInstallmentDates?: Date[];
    duplicateStripeEvent?: boolean;
    smokeTest?: boolean;
    entitlementStatus?: EntitlementStatus | null;
    entitlementSource?: EntitlementSource | null;
    eventType?: string | null;
    studentName?: string;
    studentEmail?: string;
  },
  sendEmail: typeof sendResendEmail = sendResendEmail
): Promise<{ sent: boolean; reason?: string }> {
  try {
    if (
      !shouldNotifyYvonneOfEnrolment({
        duplicateStripeEvent: params.duplicateStripeEvent,
        smokeTest: params.smokeTest,
        entitlementStatus: params.entitlementStatus,
        entitlementSource: params.entitlementSource,
        option: params.option,
        eventType: params.eventType,
      })
    ) {
      return { sent: false, reason: "not_an_enrolment_notification" };
    }

    let studentName = params.studentName?.trim() || "";
    let studentEmail = params.studentEmail?.trim() || "";
    if (!studentName || !studentEmail) {
      const client = getServiceSupabase();
      if (client) {
        const { data } = await client.from("profiles").select("full_name, email").eq("id", params.userId).maybeSingle();
        studentName = studentName || String(data?.full_name || "").trim();
        studentEmail = studentEmail || String(data?.email || "").trim();
      }
    }
    if (!studentName) studentName = studentEmail || "Student";

    const enrolledAt = params.enrolledAt || new Date();
    const remainingInstallmentDates =
      params.option === "plan_6"
        ? params.remainingInstallmentDates || futurePlanInstallmentDates(enrolledAt, params.planCount || 6)
        : [];
    const email = buildEnrolmentNotifyEmail({
      studentName,
      studentEmail,
      option: params.option,
      amountPaidNowCents: params.amountPaidNowCents,
      planCount: params.planCount || 6,
      remainingInstallmentDates,
      referralCode: params.referralCode,
      promoCode: params.promoCode,
      creditAppliedCents: params.creditAppliedCents,
      enrolledAt,
    });
    await sendEmail({
      to: ENROLMENT_NOTIFY_TO,
      subject: email.subject,
      text: email.text,
      html: email.html,
      idempotencyKey: enrolmentNotifyIdempotencyKey(params.purchaseId),
    });
    return { sent: true };
  } catch (error) {
    console.error("enrolment-notify", error);
    return { sent: false, reason: error instanceof Error ? error.message : "email_failed" };
  }
}
