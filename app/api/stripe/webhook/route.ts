import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getCourseProduct, type PurchaseOption } from "@/lib/commerce";
import { getServiceSupabase } from "@/lib/supabase-admin";
import {
  attachSixPaymentSchedule,
  cancelSubscriptionAfterPaidTerm,
  fulfillSuccessfulPayment,
  getStripe,
  incrementSuccessfulInstallments,
  recordStripeEvent,
  reverseUnredeemedRewards,
  shouldCountSubscriptionInstallment,
} from "@/lib/stripe-commerce";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type InvoiceWithSubscription = Stripe.Invoice & {
  subscription?: string | { id?: string } | null;
  billing_reason?: string | null;
};

async function purchaseBySession(sessionId: string) {
  const client = getServiceSupabase();
  if (!client) return null;
  const { data } = await client.from("course_purchases").select("*").eq("stripe_checkout_session_id", sessionId).maybeSingle();
  return data;
}

async function purchaseBySubscription(subscriptionId: string) {
  const client = getServiceSupabase();
  if (!client) return null;
  const { data } = await client.from("course_purchases").select("*").eq("stripe_subscription_id", subscriptionId).maybeSingle();
  return data;
}

async function updatePurchase(id: string, patch: Record<string, unknown>) {
  const client = getServiceSupabase();
  if (!client) return;
  await client.from("course_purchases").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
}

function subscriptionIdFrom(value: unknown): string | null {
  if (typeof value === "string" && value) return value;
  if (value && typeof value === "object" && "id" in value && typeof value.id === "string") return value.id;
  return null;
}

async function recordSuccessfulInstallment(params: {
  purchase: Record<string, unknown>;
  invoice: InvoiceWithSubscription;
  subscriptionId: string | null;
}) {
  if (!shouldCountSubscriptionInstallment(params.invoice) || !params.invoice.id) return;
  const next = incrementSuccessfulInstallments({
    current: Number(params.purchase.successful_installments || 0),
    lastInvoiceId: params.purchase.last_paid_invoice_id ? String(params.purchase.last_paid_invoice_id) : null,
    invoiceId: params.invoice.id,
  });
  if (!next.changed) return;
  const product = await getCourseProduct();
  await updatePurchase(String(params.purchase.id), {
    status: "active",
    successful_installments: next.count,
    last_paid_invoice_id: params.invoice.id,
  });
  if (params.subscriptionId && next.count >= product.plan_count) {
    await cancelSubscriptionAfterPaidTerm(getStripe(), params.subscriptionId);
  }
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook secret missing." }, { status: 503 });

  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature");
  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature || "", secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const recorded = await recordStripeEvent(event.id, event.type, null, { type: event.type });
  if (recorded.duplicate) return NextResponse.json({ ok: true, duplicate: true });

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const purchase = session.id ? await purchaseBySession(session.id) : null;
    if (purchase) {
      const option = (session.metadata?.option || purchase.option) as PurchaseOption;
      const subscriptionId = subscriptionIdFrom(session.subscription);
      let firstInvoiceId = subscriptionIdFrom(session.invoice);
      if (!firstInvoiceId && subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        firstInvoiceId = subscriptionIdFrom(subscription.latest_invoice);
      }
      await updatePurchase(purchase.id, {
        status: "active",
        stripe_customer_id: session.customer,
        stripe_subscription_id: subscriptionId,
        stripe_payment_intent_id: session.payment_intent,
        successful_installments: option === "plan_6" && !purchase.successful_installments ? 1 : purchase.successful_installments,
        last_paid_invoice_id:
          option === "plan_6" && !purchase.last_paid_invoice_id
            ? firstInvoiceId || purchase.last_paid_invoice_id
            : purchase.last_paid_invoice_id,
      });
      if (option === "plan_6" && subscriptionId) {
        try {
          const product = await getCourseProduct();
          await attachSixPaymentSchedule(stripe, subscriptionId, product.plan_count);
        } catch (error) {
          console.error("attachSixPaymentSchedule", error);
        }
      }
      await fulfillSuccessfulPayment({
        userId: String(session.metadata?.user_id || purchase.user_id),
        purchaseId: purchase.id,
        option,
        creditAppliedCents: Number(session.metadata?.credit_applied_cents || purchase.credit_applied_cents || 0),
      });
    }
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as InvoiceWithSubscription;
    const subscriptionId = subscriptionIdFrom(invoice.subscription);
    const purchase = subscriptionId ? await purchaseBySubscription(subscriptionId) : null;
    if (purchase) {
      await recordSuccessfulInstallment({ purchase, invoice, subscriptionId });
      if (!shouldCountSubscriptionInstallment(invoice)) {
        await updatePurchase(purchase.id, { status: "active" });
      }
    }
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as InvoiceWithSubscription;
    const subscriptionId = subscriptionIdFrom(invoice.subscription);
    const purchase = subscriptionId ? await purchaseBySubscription(subscriptionId) : null;
    if (purchase) await updatePurchase(purchase.id, { status: "past_due" });
  }

  if (event.type === "charge.refunded" || event.type === "charge.dispute.created") {
    const charge = event.data.object as Stripe.Charge;
    const client = getServiceSupabase();
    if (client && charge.payment_intent) {
      const { data } = await client
        .from("course_purchases")
        .select("id")
        .eq("stripe_payment_intent_id", String(charge.payment_intent))
        .maybeSingle();
      if (data) {
        await updatePurchase(data.id, { status: "refunded" });
        await reverseUnredeemedRewards(data.id);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
