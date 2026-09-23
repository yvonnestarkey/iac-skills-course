import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth-server";
import { getCourseProduct, selectedOptionTotalCents, type PurchaseOption } from "@/lib/commerce";
import { getServiceSupabase } from "@/lib/supabase-admin";
import {
  applyReferralAttribution,
  availableCreditCents,
  checkoutCouponSpec,
  findPromoCode,
  getStripe,
  siteUrl,
} from "@/lib/stripe-commerce";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    option?: PurchaseOption;
    referral_code?: string;
    promo_code?: string;
  } | null;
  const option: PurchaseOption = body?.option === "plan_6" ? "plan_6" : "once_off";
  const product = await getCourseProduct();
  const referralCode = body?.referral_code?.trim().toUpperCase() || "";
  const promoCode = body?.promo_code?.trim().toUpperCase() || "";

  if (referralCode && promoCode) {
    return NextResponse.json({ error: "Referral and promotional discounts cannot be combined." }, { status: 400 });
  }
  if (referralCode) {
    const attributed = await applyReferralAttribution(user.id, referralCode);
    if (!attributed.ok) return NextResponse.json({ error: attributed.error }, { status: 400 });
  }

  let promoPercent: number | null = null;
  if (promoCode) {
    const promo = await findPromoCode(promoCode);
    if (!promo) return NextResponse.json({ error: "That promotional code was not found." }, { status: 400 });
    promoPercent = Number(promo.percent_off);
  }

  const credit = Math.min(await availableCreditCents(user.id), option === "plan_6" ? product.plan_amount_cents : product.once_off_amount_cents);
  const spec = checkoutCouponSpec({
    option,
    product,
    referralCode: referralCode || null,
    promoPercent,
    creditCents: credit,
  });
  const priceId = option === "plan_6" ? product.stripe_plan_price_id : product.stripe_once_off_price_id;
  if (!priceId) {
    return NextResponse.json({ error: "Stripe prices are not configured yet." }, { status: 503 });
  }

  const stripe = getStripe();
  let customerId: string | undefined;
  if (spec.applyCreditAsBalance && credit > 0) {
    const customer = await stripe.customers.create({
      email: user.email || undefined,
      metadata: { user_id: user.id, product_id: product.id },
    });
    customerId = customer.id;
    await stripe.customers.createBalanceTransaction(customer.id, {
      amount: -credit,
      currency: "usd",
      description: "Course credit",
    });
  }

  const discounts: { coupon: string }[] = [];
  if (spec.coupon) {
    const coupon = await stripe.coupons.create(spec.coupon);
    discounts.push({ coupon: coupon.id });
  }

  const session = await stripe.checkout.sessions.create({
    mode: option === "plan_6" ? "subscription" : "payment",
    customer: customerId,
    customer_email: customerId ? undefined : user.email || undefined,
    client_reference_id: user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    discounts: discounts.length ? discounts : undefined,
    success_url: `${siteUrl()}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl()}/checkout/cancel`,
    metadata: {
      user_id: user.id,
      product_id: product.id,
      option,
      referral_code: referralCode,
      promo_code: promoCode,
      credit_applied_cents: String(credit),
      plan_count: String(product.plan_count),
    },
    subscription_data:
      option === "plan_6"
        ? {
            metadata: {
              user_id: user.id,
              product_id: product.id,
              option,
              plan_count: String(product.plan_count),
            },
          }
        : undefined,
  });

  const client = getServiceSupabase();
  if (client && session.id) {
    await client.from("course_purchases").insert({
      user_id: user.id,
      product_id: product.id,
      option,
      status: "pending",
      stripe_checkout_session_id: session.id,
      stripe_customer_id: customerId || null,
      amount_cents: selectedOptionTotalCents(option, product),
      currency: "usd",
      referral_code_used: referralCode || null,
      promo_code_used: promoCode || null,
      credit_applied_cents: credit,
    });
  }

  return NextResponse.json({ url: session.url });
}
