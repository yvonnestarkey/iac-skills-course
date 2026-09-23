import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth-server";
import { ensureCommerceAccount, getCourseProduct, referrerCreditCents } from "@/lib/commerce";
import { getServiceSupabase } from "@/lib/supabase-admin";
import { applyReferralAttribution } from "@/lib/stripe-commerce";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  await ensureCommerceAccount(user);
  const client = getServiceSupabase();
  const product = await getCourseProduct();
  if (!client) {
    return NextResponse.json({
      code: `JAN27-${user.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`,
      blurb: product.referral_share_blurb,
      successful_referrals: 0,
      earned_cents: 0,
      applied_cents: 0,
      refund_due_cents: 0,
      toward_free_cents: 0,
      once_off_cents: product.once_off_amount_cents,
      rewards: [],
    });
  }
  const [{ data: codeRow }, { data: rewards }] = await Promise.all([
    client.from("referral_codes").select("code").eq("user_id", user.id).maybeSingle(),
    client.from("referral_rewards").select("id, amount_cents, status, referee_user_id, created_at").eq("referrer_user_id", user.id).order("created_at", { ascending: false }),
  ]);
  const rows = rewards || [];
  const earned = rows.filter((row) => ["earned", "applied", "refund_due", "refunded"].includes(String(row.status)));
  const earnedCents = earned.reduce((sum, row) => sum + Number(row.amount_cents || 0), 0);
  return NextResponse.json({
    code: codeRow?.code || `JAN27-${user.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`,
    blurb: product.referral_share_blurb,
    referee_percent: product.referral_referee_bps / 100,
    referrer_percent: product.referral_referrer_bps / 100,
    successful_referrals: earned.length,
    earned_cents: earnedCents,
    applied_cents: rows.filter((row) => row.status === "applied").reduce((sum, row) => sum + Number(row.amount_cents || 0), 0),
    refund_due_cents: rows.filter((row) => row.status === "refund_due").reduce((sum, row) => sum + Number(row.amount_cents || 0), 0),
    toward_free_cents: Math.min(earnedCents, product.once_off_amount_cents),
    once_off_cents: product.once_off_amount_cents,
    example_reward_cents: referrerCreditCents("once_off", product),
    rewards: rows,
  });
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { code?: string } | null;
  const result = await applyReferralAttribution(user.id, String(body?.code || ""));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
