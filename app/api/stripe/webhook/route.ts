import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getCourseProduct, type PurchaseOption } from "@/lib/commerce";
import {
  futurePlanInvoiceDrafts,
  installmentNumberFromInvoice,
  shouldCountPlanInstallmentInvoice,
} from "@/lib/plan-installments";
import { getServiceSupabase } from "@/lib/supabase-admin";
import {
  attachDefaultInvoicePaymentMethod,
  attachSixPaymentSchedule,
  cancelSubscriptionAfterPaidTerm,
  findPurchaseIdForPlanInvoice,
  fulfillSuccessfulPayment,
  getStripe,
  incrementSuccessfulInstallments,
  markPlanInstallmentFailed,
  markPlanInstallmentPaid,
  paymentMethodIdFromSession,
  recordPlanInstallmentRows,
  recordStripeEvent,
  reverseUnredeemedRewards,
  scheduleRemainingPlanInvoices,
  shouldCountSubscriptionInstallment,
  voidUncollectedPlanInvoices,
} from "@/lib/stripe-commerce";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type InvoiceWithSubscription = Stripe.Invoice & {
  subscription?: string | { id?: string } | null;
  billing_reason?: string | null;
  parent?: { subscription_details?: { subscription?: string | { id?: string } | null } | null } | null;
};

async function purchaseById(id: string) {
  const client = getServiceSupabase();
  if (!client) return null;
  const { data } = await client.from("course_purchases").select("*").eq("id", id).maybeSingle();
  return data;
}

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

function invoiceSubscriptionId(invoice: InvoiceWithSubscription): string | null {
  return (
    subscriptionIdFrom(invoice.subscription) ||
    subscriptionIdFrom(invoice.parent?.subscription_details?.subscription) ||
    null
  );
}

function invoicePaymentIntentId(invoice: Stripe.Invoice): string | null {
  const intent = "payment_intent" in invoice ? invoice.payment_intent : null;
  return subscriptionIdFrom(intent);
}

async function recordSuccessfulInstallment(params: {
  purchase: Record<string, unknown>;
  invoice: InvoiceWithSubscription;
  subscriptionId: string | null;
}) {
  const counts =
    shouldCountPlanInstallmentInvoice(params.invoice) || shouldCountSubscriptionInstallment(params.invoice);
  if (!counts || !params.invoice.id) return;
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
  const installment = installmentNumberFromInvoice(params.invoice);
  if (installment) {
    await markPlanInstallmentPaid({
      purchaseId: String(params.purchase.id),
      invoiceId: params.invoice.id,
      installment,
      paymentIntentId: invoicePaymentIntentId(params.invoice),
    });
  }
  if (params.subscriptionId && next.count >= product.plan_count) {
    await cancelSubscriptionAfterPaidTerm(getStripe(), params.subscriptionId);
  }
}

async function attachInvoicingPlan(params: {
  stripe: Stripe;
  session: Stripe.Checkout.Session;
  purchase: Record<string, unknown>;
  product: Awaited<ReturnType<typeof getCourseProduct>>;
}) {
  const customerId =
    typeof params.session.customer === "string"
      ? params.session.customer
      : params.session.customer && "id" in params.session.customer
        ? params.session.customer.id
        : String(params.purchase.stripe_customer_id || "");
  const paymentMethodId = paymentMethodIdFromSession(params.session);
  if (!customerId || !paymentMethodId) {
    throw new Error("Instalment plan is missing a saved payment method for automatic collection.");
  }
  await attachDefaultInvoicePaymentMethod(params.stripe, customerId, paymentMethodId);
  const amountCents = Number(params.session.metadata?.installment_amount_cents || params.product.plan_amount_cents);
  const enrolledAt = new Date();
  const created = await scheduleRemainingPlanInvoices({
    stripe: params.stripe,
    customerId,
    paymentMethodId,
    purchaseId: String(params.purchase.id),
    userId: String(params.purchase.user_id),
    productId: params.product.id,
    enrolledAt,
    amountCents,
    planCount: params.product.plan_count,
  });
  const firstInvoiceId = subscriptionIdFrom(params.session.invoice);
  await recordPlanInstallmentRows({
    purchaseId: String(params.purchase.id),
    rows: [
      {
        installment: 1,
        amountCents,
        scheduledAt: enrolledAt,
        stripeInvoiceId: firstInvoiceId,
        stripePaymentIntentId: subscriptionIdFrom(params.session.payment_intent),
        status: "paid",
        paidAt: new Date().toISOString(),
      },
      ...futurePlanInvoiceDrafts({
        enrolledAt,
        purchaseId: String(params.purchase.id),
        productId: params.product.id,
        userId: String(params.purchase.user_id),
        amountCents,
        planCount: params.product.plan_count,
      }).map((draft) => {
        const match = created.find((item) => item.installment === draft.installment);
        return {
          installment: draft.installment,
          amountCents: draft.amountCents,
          scheduledAt: draft.scheduledAt,
          stripeInvoiceId: match?.id || null,
          status: "draft" as const,
        };
      }),
    ],
  });
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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const expanded = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ["payment_intent.payment_method", "invoice"],
    });
    const purchase = session.id ? await purchaseBySession(session.id) : null;
    if (purchase) {
      const option = (session.metadata?.option || purchase.option) as PurchaseOption;
      const subscriptionId = subscriptionIdFrom(session.subscription);
      let firstInvoiceId = subscriptionIdFrom(session.invoice);
      if (!firstInvoiceId && subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        firstInvoiceId = subscriptionIdFrom(subscription.latest_invoice);
      }
      if (!recorded.duplicate) {
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
        await fulfillSuccessfulPayment({
          userId: String(session.metadata?.user_id || purchase.user_id),
          purchaseId: purchase.id,
          option,
          creditAppliedCents: Number(session.metadata?.credit_applied_cents || purchase.credit_applied_cents || 0),
        });
      }
      if (option === "plan_6" && !subscriptionId) {
        try {
          const product = await getCourseProduct();
          await attachInvoicingPlan({ stripe, session: expanded, purchase, product });
        } catch (error) {
          console.error("attachInvoicingPlan", error);
        }
      }
      if (option === "plan_6" && subscriptionId) {
        try {
          const product = await getCourseProduct();
          await attachSixPaymentSchedule(stripe, subscriptionId, product.plan_count);
        } catch (error) {
          console.error("attachSixPaymentSchedule", error);
        }
      }
    }
  }
  if (recorded.duplicate) return NextResponse.json({ ok: true, duplicate: true });

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as InvoiceWithSubscription;
    const purchaseId = await findPurchaseIdForPlanInvoice(invoice);
    const subscriptionId = invoiceSubscriptionId(invoice);
    const purchase = purchaseId
      ? await purchaseById(purchaseId)
      : subscriptionId
        ? await purchaseBySubscription(subscriptionId)
        : null;
    if (purchase) {
      await recordSuccessfulInstallment({ purchase, invoice, subscriptionId });
      if (!shouldCountPlanInstallmentInvoice(invoice) && !shouldCountSubscriptionInstallment(invoice)) {
        await updatePurchase(purchase.id, { status: "active" });
      }
    }
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as InvoiceWithSubscription;
    const purchaseId = await findPurchaseIdForPlanInvoice(invoice);
    const subscriptionId = invoiceSubscriptionId(invoice);
    const purchase = purchaseId
      ? await purchaseById(purchaseId)
      : subscriptionId
        ? await purchaseBySubscription(subscriptionId)
        : null;
    if (purchase) {
      await updatePurchase(purchase.id, { status: "past_due" });
      const installment = installmentNumberFromInvoice(invoice);
      if (installment && invoice.id) {
        await markPlanInstallmentFailed({
          purchaseId: String(purchase.id),
          invoiceId: invoice.id,
          installment,
        });
      }
    }
  }

  if (event.type === "charge.refunded" || event.type === "charge.dispute.created") {
    const charge = event.data.object as Stripe.Charge;
    const client = getServiceSupabase();
    if (client && charge.payment_intent) {
      const paymentIntentId = String(charge.payment_intent);
      const { data: byPurchase } = await client
        .from("course_purchases")
        .select("id, option, stripe_customer_id")
        .eq("stripe_payment_intent_id", paymentIntentId)
        .maybeSingle();
      const { data: byInstallment } = byPurchase
        ? { data: null }
        : await client
            .from("course_purchase_installments")
            .select("purchase_id")
            .eq("stripe_payment_intent_id", paymentIntentId)
            .maybeSingle();
      const purchase =
        byPurchase ||
        (byInstallment?.purchase_id ? await purchaseById(String(byInstallment.purchase_id)) : null);
      if (purchase) {
        await updatePurchase(String(purchase.id), { status: "refunded" });
        await reverseUnredeemedRewards(String(purchase.id));
        if (purchase.option === "plan_6") {
          await voidUncollectedPlanInvoices(getStripe(), String(purchase.id), purchase.stripe_customer_id ? String(purchase.stripe_customer_id) : null);
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
