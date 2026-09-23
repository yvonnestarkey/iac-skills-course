import Stripe from "stripe";
// Stripe Checkout + webhooks run on the Node runtime, not Edge.
import { getServiceSupabase } from "@/lib/supabase-admin";
import {
  DEFAULT_PRODUCT_ID,
  canStackDiscounts,
  getCourseProduct,
  grantFullEntitlement,
  refereeDiscountCents,
  referrerCreditCents,
  type CourseProduct,
  type PurchaseOption,
} from "@/lib/commerce";

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured.");
  return new Stripe(key);
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://iac.accountingstudyadvice.com").replace(/\/$/, "");
}

export async function findReferralCode(code: string) {
  const client = getServiceSupabase();
  if (!client) return null;
  const { data } = await client.from("referral_codes").select("user_id, code").eq("code", code.trim().toUpperCase()).maybeSingle();
  return data;
}

export async function findPromoCode(code: string) {
  const client = getServiceSupabase();
  if (!client) return null;
  const { data } = await client
    .from("promo_codes")
    .select("code, percent_off, active, product_id")
    .eq("code", code.trim().toUpperCase())
    .eq("active", true)
    .maybeSingle();
  return data;
}

export async function availableCreditCents(userId: string): Promise<number> {
  const client = getServiceSupabase();
  if (!client) return 0;
  const { data } = await client.from("referral_rewards").select("amount_cents, status").eq("referrer_user_id", userId);
  return (data || [])
    .filter((row) => row.status === "earned")
    .reduce((sum, row) => sum + Number(row.amount_cents || 0), 0);
}

export async function recordStripeEvent(eventId: string, eventType: string, purchaseId: string | null, payload: Record<string, unknown>) {
  const client = getServiceSupabase();
  if (!client) throw new Error("Supabase is not configured.");
  const { error } = await client.from("course_payment_events").insert({
    stripe_event_id: eventId,
    event_type: eventType,
    purchase_id: purchaseId,
    payload,
  });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return { duplicate: true };
    throw new Error(error.message);
  }
  return { duplicate: false };
}

export async function markRewardsApplied(userId: string, amountCents: number) {
  if (amountCents <= 0) return;
  const client = getServiceSupabase();
  if (!client) return;
  const { data } = await client
    .from("referral_rewards")
    .select("id, amount_cents")
    .eq("referrer_user_id", userId)
    .eq("status", "earned")
    .order("created_at", { ascending: true });
  let remaining = amountCents;
  for (const row of data || []) {
    if (remaining <= 0) break;
    remaining -= Number(row.amount_cents || 0);
    await client.from("referral_rewards").update({ status: "applied", updated_at: new Date().toISOString() }).eq("id", row.id);
    await client.from("referral_ledger").insert({
      user_id: userId,
      reward_id: row.id,
      entry_type: "applied",
      amount_cents: row.amount_cents,
      note: "Applied to course purchase",
    });
  }
}

export async function earnReferralReward(params: {
  refereeUserId: string;
  purchaseId: string;
  option: PurchaseOption;
  product: CourseProduct;
}) {
  const client = getServiceSupabase();
  if (!client) return;
  const { data: attribution } = await client
    .from("referral_attributions")
    .select("referrer_user_id, referee_user_id")
    .eq("referee_user_id", params.refereeUserId)
    .maybeSingle();
  if (!attribution) return;
  const amount = referrerCreditCents(params.option, params.product);
  const { data: existing } = await client
    .from("referral_rewards")
    .select("id")
    .eq("purchase_id", params.purchaseId)
    .maybeSingle();
  if (existing) return;
  const { data: reward, error } = await client
    .from("referral_rewards")
    .insert({
      referrer_user_id: attribution.referrer_user_id,
      referee_user_id: params.refereeUserId,
      purchase_id: params.purchaseId,
      amount_cents: amount,
      currency: "usd",
      status: "earned",
    })
    .select("id")
    .maybeSingle();
  if (error || !reward) return;
  await client.from("referral_ledger").insert({
    user_id: attribution.referrer_user_id,
    reward_id: reward.id,
    entry_type: "earned",
    amount_cents: amount,
    note: "Qualifying referred purchase",
  });
}

export async function reverseUnredeemedRewards(purchaseId: string) {
  const client = getServiceSupabase();
  if (!client) return;
  const { data } = await client.from("referral_rewards").select("id, referrer_user_id, amount_cents, status").eq("purchase_id", purchaseId);
  for (const row of data || []) {
    if (row.status === "applied" || row.status === "refunded") {
      await client.from("referral_rewards").update({ status: "refund_due", updated_at: new Date().toISOString() }).eq("id", row.id);
      await client.from("referral_ledger").insert({
        user_id: row.referrer_user_id,
        reward_id: row.id,
        entry_type: "refund_due",
        amount_cents: row.amount_cents,
        note: "Purchase refunded; previously applied credit needs manual review",
      });
      continue;
    }
    if (row.status === "earned" || row.status === "pending") {
      await client.from("referral_rewards").update({ status: "reversed", updated_at: new Date().toISOString() }).eq("id", row.id);
      await client.from("referral_ledger").insert({
        user_id: row.referrer_user_id,
        reward_id: row.id,
        entry_type: "reversed",
        amount_cents: row.amount_cents,
        note: "Purchase refunded or canceled",
      });
    }
  }
}

export async function applyReferralAttribution(refereeUserId: string, rawCode: string) {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: "Enter a referral code." };
  const found = await findReferralCode(code);
  if (!found) return { ok: false, error: "That referral code was not found." };
  if (found.user_id === refereeUserId) return { ok: false, error: "You cannot use your own referral code." };
  const client = getServiceSupabase();
  if (!client) return { ok: false, error: "Referrals are not configured yet." };
  const { error } = await client.from("referral_attributions").upsert(
    { referee_user_id: refereeUserId, referrer_user_id: found.user_id, code },
    { onConflict: "referee_user_id" }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export function checkoutDiscount(params: {
  option: PurchaseOption;
  product: CourseProduct;
  referralCode?: string | null;
  promoPercent?: number | null;
}) {
  if (params.referralCode && params.promoPercent && !canStackDiscounts()) {
    throw new Error("Referral and promotional discounts cannot be combined.");
  }
  if (params.referralCode) return refereeDiscountCents(params.option, params.product);
  if (params.promoPercent) {
    const base = params.option === "plan_6" ? params.product.plan_amount_cents : params.product.once_off_amount_cents;
    return Math.round((base * params.promoPercent) / 100);
  }
  return 0;
}

export async function fulfillSuccessfulPayment(params: {
  userId: string;
  purchaseId: string;
  option: PurchaseOption;
  creditAppliedCents: number;
}) {
  const product = await getCourseProduct();
  await grantFullEntitlement(params.userId, "stripe");
  if (params.creditAppliedCents) await markRewardsApplied(params.userId, params.creditAppliedCents);
  await earnReferralReward({
    refereeUserId: params.userId,
    purchaseId: params.purchaseId,
    option: params.option,
    product,
  });
}

export { DEFAULT_PRODUCT_ID };
