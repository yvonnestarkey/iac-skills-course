import { NextResponse } from "next/server";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import {
  buildRevenueMonthRows,
  buildRevenueStatements,
  totalRevenueRow,
} from "@/lib/revenue-report";
import { getServiceSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function asText(value: unknown): string {
  return String(value || "").trim();
}

export async function GET() {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 401 });
  const client = getServiceSupabase();
  if (!client) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });

  const [purchasesQuery, installmentsQuery, rewardsQuery] = await Promise.all([
    client
      .from("course_purchases")
      .select(
        "id, user_id, option, status, amount_cents, credit_applied_cents, referral_code_used, promo_code_used, successful_installments, created_at, student_name, student_email"
      )
      .order("created_at", { ascending: false }),
    client
      .from("course_purchase_installments")
      .select("purchase_id, installment_number, amount_cents, scheduled_at, paid_at, status")
      .order("scheduled_at", { ascending: true }),
    client
      .from("referral_rewards")
      .select("id, referrer_user_id, referee_user_id, purchase_id, amount_cents, status, created_at, updated_at")
      .order("created_at", { ascending: false }),
  ]);

  const purchases =
    (!purchasesQuery.error && purchasesQuery.data) ||
    (
      await client
        .from("course_purchases")
        .select("id, user_id, option, status, amount_cents, successful_installments, created_at")
        .order("created_at", { ascending: false })
    ).data ||
    [];
  const installments = (!installmentsQuery.error && installmentsQuery.data) || [];
  const rewards = (!rewardsQuery.error && rewardsQuery.data) || [];

  const userIds = [
    ...new Set(
      [
        ...purchases.map((row) => asText(row.user_id)),
        ...rewards.map((row) => asText(row.referrer_user_id)),
        ...rewards.map((row) => asText(row.referee_user_id)),
      ].filter(Boolean)
    ),
  ];
  const profilesQuery = userIds.length
    ? await client.from("profiles").select("id, email, full_name, cohort").in("id", userIds)
    : { data: [] as { id: string; email?: string | null; full_name?: string | null; cohort?: string | null }[], error: null };
  const profiles =
    (!profilesQuery.error && profilesQuery.data) ||
    (userIds.length
      ? (await client.from("profiles").select("id, email, full_name").in("id", userIds)).data
      : []) ||
    [];

  const months = buildRevenueMonthRows({
    purchases,
    installments,
    rewards,
  });
  const statements = buildRevenueStatements({
    purchases,
    installments,
    rewards,
    profiles: profiles || [],
  });
  const payingStudents = new Set(
    purchases.filter((row) => ["pending", "active", "past_due"].includes(String(row.status))).map((row) => asText(row.user_id))
  );

  return NextResponse.json({
    months,
    total: totalRevenueRow(months, payingStudents.size),
    statements,
  });
}
