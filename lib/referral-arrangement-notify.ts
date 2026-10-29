import { getCourseProduct, referrerCreditCents, type CourseProduct } from "@/lib/commerce";
import { ENROLMENT_NOTIFY_TO } from "@/lib/enrolment-notify";
import {
  arrangementForEmail,
  buildReferralExtraInboxBody,
  buildReferralExtraNotifyEmail,
  extraDiscountCents,
  normalizeArrangementEmail,
  publicStudentProfileUrl,
  referralExtraInboxContext,
  referralExtraNotifyIdempotencyKey,
  REFERRAL_EXTRA_ARRANGEMENTS,
  type ReferralArrangementStatus,
} from "@/lib/referral-arrangements";
import { sendResendEmail } from "@/lib/resend";
import { getServiceSupabase } from "@/lib/supabase-admin";

export type ReferralArrangementView = {
  email: string;
  extraBps: number;
  extraCents: number;
  creditCents: number;
  action: string;
  status: ReferralArrangementStatus;
  userId: string | null;
  name: string | null;
};

export type ReferralExtraInboxWriter = (params: {
  rewardId: string;
  studentEmail: string;
  body: string;
}) => Promise<boolean>;

async function insertReferralExtraInboxReminder(params: {
  rewardId: string;
  studentEmail: string;
  body: string;
}): Promise<boolean> {
  const client = getServiceSupabase();
  if (!client) return false;
  const context = referralExtraInboxContext(params.rewardId);
  const existing = await client.from("inbox_messages").select("id").eq("context", context).maybeSingle();
  if (existing.data?.id) return false;
  const { error } = await client.from("inbox_messages").insert({
    student_id: null,
    student_email: params.studentEmail,
    from_role: "student",
    kind: "question",
    body: params.body,
    context,
    lesson_id: null,
    read: false,
  });
  if (error) {
    console.error("referral-extra-inbox", error);
    return false;
  }
  return true;
}

export async function notifyYvonneOfReferralExtraDiscount(
  params: {
    referrerUserId: string;
    rewardId: string;
    creditCents: number;
    product?: CourseProduct;
    studentName?: string;
    studentEmail?: string;
  },
  sendEmail: typeof sendResendEmail = sendResendEmail,
  recordInbox: ReferralExtraInboxWriter = insertReferralExtraInboxReminder
): Promise<{ sent: boolean; inbox: boolean; reason?: string }> {
  try {
    const rewardId = String(params.rewardId || "").trim();
    if (!rewardId) return { sent: false, inbox: false, reason: "missing_reward" };

    let studentName = params.studentName?.trim() || "";
    let studentEmail = params.studentEmail?.trim() || "";
    if (!studentName || !studentEmail) {
      const client = getServiceSupabase();
      if (client && params.referrerUserId) {
        const { data } = await client
          .from("profiles")
          .select("full_name, email")
          .eq("id", params.referrerUserId)
          .maybeSingle();
        studentName = studentName || String(data?.full_name || "").trim();
        studentEmail = studentEmail || String(data?.email || "").trim();
      }
    }
    const arrangement = arrangementForEmail(studentEmail);
    if (!arrangement) return { sent: false, inbox: false, reason: "no_arrangement" };
    if (!studentName) studentName = studentEmail || "Student";

    const product = params.product || (await getCourseProduct());
    const extraCents = extraDiscountCents(arrangement.extraBps, product);
    const content = {
      studentName,
      studentEmail,
      studentId: params.referrerUserId,
      creditCents: params.creditCents,
      extraCents,
      extraBps: arrangement.extraBps,
      action: arrangement.action,
      profileUrl: params.referrerUserId
        ? publicStudentProfileUrl(params.referrerUserId, process.env.NEXT_PUBLIC_SITE_URL || "https://iac.accountingstudyadvice.com")
        : null,
    };
    const email = buildReferralExtraNotifyEmail(content);
    await sendEmail({
      to: ENROLMENT_NOTIFY_TO,
      subject: email.subject,
      text: email.text,
      html: email.html,
      idempotencyKey: referralExtraNotifyIdempotencyKey(rewardId),
    });

    const inbox = await recordInbox({
      rewardId,
      studentEmail,
      body: buildReferralExtraInboxBody(content),
    });
    return { sent: true, inbox };
  } catch (error) {
    console.error("referral-extra-notify", error);
    return { sent: false, inbox: false, reason: error instanceof Error ? error.message : "notify_failed" };
  }
}

export async function loadReferralArrangementViews(): Promise<ReferralArrangementView[]> {
  const product = await getCourseProduct();
  const client = getServiceSupabase();
  const emails = REFERRAL_EXTRA_ARRANGEMENTS.map((row) => normalizeArrangementEmail(row.referrerEmail));
  const { data: profiles } = client
    ? await client.from("profiles").select("id, email, full_name").in("email", emails)
    : { data: [] as { id: string; email: string; full_name: string | null }[] };
  const profileByEmail = new Map(
    (profiles || []).map((row) => [
      normalizeArrangementEmail(row.email),
      { id: String(row.id), name: String(row.full_name || "").trim() || null },
    ])
  );
  const userIds = [...profileByEmail.values()].map((row) => row.id);
  const { data: rewards } = client && userIds.length
    ? await client
        .from("referral_rewards")
        .select("referrer_user_id, status")
        .in("referrer_user_id", userIds)
        .in("status", ["earned", "applied", "refund_due"])
    : { data: [] as { referrer_user_id: string; status: string }[] };
  const rewarded = new Set((rewards || []).map((row) => String(row.referrer_user_id)));

  return REFERRAL_EXTRA_ARRANGEMENTS.map((row) => {
    const email = normalizeArrangementEmail(row.referrerEmail);
    const profile = profileByEmail.get(email);
    const status: ReferralArrangementStatus = profile && rewarded.has(profile.id) ? "action_needed" : "waiting";
    return {
      email,
      extraBps: row.extraBps,
      extraCents: extraDiscountCents(row.extraBps, product),
      creditCents: referrerCreditCents("plan_6", product),
      action: row.action,
      status,
      userId: profile?.id || null,
      name: profile?.name || null,
    };
  });
}
