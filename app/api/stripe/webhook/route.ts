import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getServiceSupabase } from "@/lib/supabase-admin";
import { fulfillSuccessfulPayment, getStripe, recordStripeEvent, reverseUnredeemedRewards } from "@/lib/stripe-commerce";
import type { PurchaseOption } from "@/lib/commerce";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
      await updatePurchase(purchase.id, {
        status: "active",
        stripe_customer_id: session.customer,
        stripe_subscription_id: session.subscription,
        stripe_payment_intent_id: session.payment_intent,
      });
      await fulfillSuccessfulPayment({
        userId: String(session.metadata?.user_id || purchase.user_id),
        purchaseId: purchase.id,
        option: (session.metadata?.option || purchase.option) as PurchaseOption,
        creditAppliedCents: Number(session.metadata?.credit_applied_cents || purchase.credit_applied_cents || 0),
      });
    }
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice & { subscription?: string | { id?: string } | null };
    const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
    const purchase = subscriptionId ? await purchaseBySubscription(subscriptionId) : null;
    if (purchase) await updatePurchase(purchase.id, { status: "active" });
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice & { subscription?: string | { id?: string } | null };
    const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
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
