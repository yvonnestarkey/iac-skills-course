import { NextResponse } from "next/server";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import { grantFullEntitlement } from "@/lib/commerce";
import { getServiceSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 401 });
  const client = getServiceSupabase();
  if (!client) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });

  const [{ data: entitlements }, { data: purchases }, { data: rewards }] = await Promise.all([
    client.from("course_entitlements").select("user_id, status, source, updated_at"),
    client
      .from("course_purchases")
      .select("id, user_id, option, status, stripe_subscription_id, referral_code_used, amount_cents, credit_applied_cents, updated_at")
      .order("updated_at", { ascending: false }),
    client
      .from("referral_rewards")
      .select("id, referrer_user_id, referee_user_id, amount_cents, status, purchase_id, updated_at")
      .order("updated_at", { ascending: false }),
  ]);

  const userIds = [
    ...new Set([
      ...(entitlements || []).map((row) => row.user_id),
      ...(purchases || []).map((row) => row.user_id),
      ...(rewards || []).map((row) => row.referrer_user_id),
    ]),
  ];
  const { data: profiles } = userIds.length
    ? await client.from("profiles").select("id, email, full_name, role").in("id", userIds)
    : { data: [] };

  return NextResponse.json({
    profiles: profiles || [],
    entitlements: entitlements || [],
    purchases: purchases || [],
    rewards: rewards || [],
    refund_due: (rewards || []).filter((row) => row.status === "refund_due"),
  });
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { user_id?: string } | null;
  if (!body?.user_id) return NextResponse.json({ error: "user_id required." }, { status: 400 });
  await grantFullEntitlement(body.user_id, "admin");
  return NextResponse.json({ ok: true });
}
