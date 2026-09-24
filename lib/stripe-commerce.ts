import Stripe from "stripe";
// Stripe Checkout + webhooks run on the Node runtime, not Edge.
import { getServiceSupabase } from "@/lib/supabase-admin";
import {
  DEFAULT_PRODUCT_ID,
  canStackDiscounts,
  commerceTableMissing,
  getCourseProduct,
  grantFullEntitlement,
  refereePerInstallmentCents,
  referrerCreditCents,
  type CourseProduct,
  type PurchaseOption,
} from "@/lib/commerce";
import { futurePlanInvoiceDrafts, voidActionForInvoiceStatus } from "@/lib/plan-installments";

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
  if (params.referralCode) return refereePerInstallmentCents(params.option, params.product);
  if (params.promoPercent) {
    const base = params.option === "plan_6" ? params.product.plan_amount_cents : params.product.once_off_amount_cents;
    return Math.round((base * params.promoPercent) / 100);
  }
  return 0;
}

export type CheckoutCouponSpec = {
  coupon: {
    amount_off?: number;
    percent_off?: number;
    currency?: string;
    duration: "once" | "repeating";
    duration_in_months?: number;
    name: string;
  } | null;
  applyCreditAsBalance: boolean;
};

/** Once-off keeps Stripe coupons. The instalment plan bakes referral/promo into each invoice amount. */
export function checkoutCouponSpec(params: {
  option: PurchaseOption;
  product: CourseProduct;
  referralCode?: string | null;
  promoPercent?: number | null;
  creditCents: number;
}): CheckoutCouponSpec {
  const discount = checkoutDiscount({
    option: params.option,
    product: params.product,
    referralCode: params.referralCode,
    promoPercent: params.promoPercent,
  });
  if (params.option === "once_off") {
    const amount = discount + params.creditCents;
    if (amount <= 0) return { coupon: null, applyCreditAsBalance: false };
    return {
      coupon: {
        amount_off: amount,
        currency: "usd",
        duration: "once",
        name: params.referralCode ? "Referral discount" : params.promoPercent ? "Promo" : "Course credit",
      },
      applyCreditAsBalance: false,
    };
  }
  if (params.creditCents > 0 && (params.referralCode || params.promoPercent)) {
    return { coupon: null, applyCreditAsBalance: true };
  }
  if (params.creditCents > 0) {
    return {
      coupon: { amount_off: params.creditCents, currency: "usd", duration: "once", name: "Course credit" },
      applyCreditAsBalance: false,
    };
  }
  return { coupon: null, applyCreditAsBalance: false };
}

export function shouldCountSubscriptionInstallment(invoice: {
  id?: string | null;
  status?: string | null;
  amount_paid?: number | null;
  billing_reason?: string | null;
}): boolean {
  if (!invoice.id) return false;
  if (invoice.status && invoice.status !== "paid") return false;
  if (!Number(invoice.amount_paid)) return false;
  return invoice.billing_reason === "subscription_create" || invoice.billing_reason === "subscription_cycle";
}

export function incrementSuccessfulInstallments(params: {
  current: number;
  lastInvoiceId: string | null | undefined;
  invoiceId: string;
}): { count: number; changed: boolean } {
  if (params.lastInvoiceId && params.lastInvoiceId === params.invoiceId) {
    return { count: params.current, changed: false };
  }
  return { count: params.current + 1, changed: true };
}

export function paymentMethodIdFromSession(session: Stripe.Checkout.Session): string | null {
  const intent = session.payment_intent;
  if (!intent || typeof intent === "string") return null;
  const method = intent.payment_method;
  if (typeof method === "string" && method) return method;
  if (method && typeof method === "object" && "id" in method && typeof method.id === "string") return method.id;
  return null;
}

export async function attachDefaultInvoicePaymentMethod(
  stripe: Stripe,
  customerId: string,
  paymentMethodId: string
) {
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });
}

export async function scheduleRemainingPlanInvoices(params: {
  stripe: Stripe;
  customerId: string;
  paymentMethodId: string;
  purchaseId: string;
  userId: string;
  productId: string;
  enrolledAt: Date;
  amountCents: number;
  planCount: number;
}): Promise<{ id: string; installment: number; scheduledAt: Date }[]> {
  const existing = await listRecordedPlanInvoices(params.purchaseId);
  if (existing.filter((row) => row.installment >= 2).length >= params.planCount - 1) {
    return existing.filter((row) => row.installment >= 2);
  }
  const drafts = futurePlanInvoiceDrafts({
    enrolledAt: params.enrolledAt,
    purchaseId: params.purchaseId,
    productId: params.productId,
    userId: params.userId,
    amountCents: params.amountCents,
    planCount: params.planCount,
  });
  const created: { id: string; installment: number; scheduledAt: Date }[] = [];
  for (const draft of drafts) {
    const invoice = await params.stripe.invoices.create({
      customer: params.customerId,
      collection_method: draft.collectionMethod,
      auto_advance: draft.autoAdvance,
      automatically_finalizes_at: draft.automaticallyFinalizesAt,
      default_payment_method: params.paymentMethodId,
      pending_invoice_items_behavior: "exclude",
      description: draft.description,
      metadata: draft.metadata,
    });
    await params.stripe.invoiceItems.create({
      customer: params.customerId,
      invoice: invoice.id,
      amount: draft.amountCents,
      currency: "usd",
      description: draft.description,
      metadata: draft.metadata,
    });
    created.push({ id: invoice.id, installment: draft.installment, scheduledAt: draft.scheduledAt });
  }
  return created;
}

export async function recordPlanInstallmentRows(params: {
  purchaseId: string;
  rows: {
    installment: number;
    amountCents: number;
    scheduledAt: Date;
    stripeInvoiceId?: string | null;
    stripePaymentIntentId?: string | null;
    status: "pending" | "draft" | "paid" | "failed" | "void" | "canceled";
    paidAt?: string | null;
  }[];
}) {
  const client = getServiceSupabase();
  if (!client) return;
  const payload = params.rows.map((row) => ({
    purchase_id: params.purchaseId,
    installment_number: row.installment,
    amount_cents: row.amountCents,
    currency: "usd",
    scheduled_at: row.scheduledAt.toISOString(),
    stripe_invoice_id: row.stripeInvoiceId || null,
    stripe_payment_intent_id: row.stripePaymentIntentId || null,
    status: row.status,
    paid_at: row.paidAt || null,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await client.from("course_purchase_installments").upsert(payload, {
    onConflict: "purchase_id,installment_number",
  });
  if (error && !commerceTableMissing(error.message)) {
    throw new Error(error.message);
  }
}

async function listRecordedPlanInvoices(purchaseId: string): Promise<{ id: string; installment: number; scheduledAt: Date }[]> {
  const client = getServiceSupabase();
  if (!client) return [];
  const { data, error } = await client
    .from("course_purchase_installments")
    .select("installment_number, stripe_invoice_id, scheduled_at")
    .eq("purchase_id", purchaseId)
    .gte("installment_number", 2);
  if (error || !data?.length) return [];
  return data
    .filter((row) => row.stripe_invoice_id)
    .map((row) => ({
      id: String(row.stripe_invoice_id),
      installment: Number(row.installment_number),
      scheduledAt: new Date(String(row.scheduled_at)),
    }));
}

export async function markPlanInstallmentPaid(params: {
  purchaseId: string;
  invoiceId: string;
  installment: number;
  paymentIntentId?: string | null;
}) {
  const client = getServiceSupabase();
  if (!client) return;
  const { error } = await client
    .from("course_purchase_installments")
    .update({
      status: "paid",
      stripe_invoice_id: params.invoiceId,
      stripe_payment_intent_id: params.paymentIntentId || null,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("purchase_id", params.purchaseId)
    .eq("installment_number", params.installment);
  if (error && !commerceTableMissing(error.message)) throw new Error(error.message);
}

export async function markPlanInstallmentFailed(params: { purchaseId: string; invoiceId: string; installment: number }) {
  const client = getServiceSupabase();
  if (!client) return;
  const { error } = await client
    .from("course_purchase_installments")
    .update({
      status: "failed",
      stripe_invoice_id: params.invoiceId,
      updated_at: new Date().toISOString(),
    })
    .eq("purchase_id", params.purchaseId)
    .eq("installment_number", params.installment);
  if (error && !commerceTableMissing(error.message)) throw new Error(error.message);
}

export async function findPurchaseIdForPlanInvoice(invoice: {
  id?: string | null;
  metadata?: Record<string, string> | null;
}): Promise<string | null> {
  if (invoice.metadata?.purchase_id) return invoice.metadata.purchase_id;
  if (!invoice.id) return null;
  const client = getServiceSupabase();
  if (!client) return null;
  const { data } = await client
    .from("course_purchase_installments")
    .select("purchase_id")
    .eq("stripe_invoice_id", invoice.id)
    .maybeSingle();
  return data?.purchase_id ? String(data.purchase_id) : null;
}

export async function voidUncollectedPlanInvoices(stripe: Stripe, purchaseId: string, customerId?: string | null) {
  const ids = new Set<string>();
  const recorded = await listRecordedPlanInvoices(purchaseId);
  recorded.forEach((row) => ids.add(row.id));
  if (customerId) {
    const listed = await stripe.invoices.list({ customer: customerId, limit: 100 });
    for (const invoice of listed.data) {
      if (invoice.metadata?.purchase_id === purchaseId && invoice.metadata?.option === "plan_6") {
        ids.add(invoice.id);
      }
    }
  }
  for (const invoiceId of ids) {
    const invoice = await stripe.invoices.retrieve(invoiceId);
    const action = voidActionForInvoiceStatus(invoice.status);
    if (action === "delete") await stripe.invoices.del(invoiceId);
    if (action === "void") await stripe.invoices.voidInvoice(invoiceId);
    const client = getServiceSupabase();
    if (client && action !== "skip") {
      await client
        .from("course_purchase_installments")
        .update({ status: "void", updated_at: new Date().toISOString() })
        .eq("purchase_id", purchaseId)
        .eq("stripe_invoice_id", invoiceId);
    }
  }
}

/** Legacy 6-cycle subscription helper. Used only for purchases created before the invoicing plan. */
export async function attachSixPaymentSchedule(stripe: Stripe, subscriptionId: string, planCount: number) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const existing = typeof subscription.schedule === "string" ? subscription.schedule : subscription.schedule?.id;
  const schedule = existing
    ? await stripe.subscriptionSchedules.retrieve(existing)
    : await stripe.subscriptionSchedules.create({ from_subscription: subscriptionId });
  const phase = schedule.phases[0];
  if (!phase) return schedule.id;
  const items = phase.items.map((item) => ({
    price: typeof item.price === "string" ? item.price : item.price.id,
    quantity: item.quantity || 1,
  }));
  const discounts = (phase.discounts || [])
    .map((discount) => {
      const coupon = typeof discount.coupon === "string" ? discount.coupon : discount.coupon?.id;
      return coupon ? { coupon } : null;
    })
    .filter((item): item is { coupon: string } => Boolean(item));
  await stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: "cancel",
    phases: [
      {
        items,
        start_date: phase.start_date,
        duration: { interval: "month", interval_count: planCount },
        ...(discounts.length ? { discounts } : {}),
      },
    ],
  });
  return schedule.id;
}

export async function cancelSubscriptionAfterPaidTerm(stripe: Stripe, subscriptionId: string) {
  try {
    await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/canceled|cancelled|no such/i.test(message)) throw error;
  }
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
