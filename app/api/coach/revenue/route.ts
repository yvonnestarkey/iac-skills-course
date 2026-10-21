import { NextResponse } from "next/server";
import { PROFESSIONAL_AFFILIATES } from "@/lib/affiliate-partners";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import {
  buildReferrersByCode,
  buildRevenueMonthRows,
  buildRevenueStatements,
  excludeTestStudents,
  isTestStudentEmail,
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

  const [purchasesQuery, installmentsQuery, rewardsQuery, codesQuery] = await Promise.all([
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
    client.from("referral_codes").select("user_id, code"),
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
  const codes = (!codesQuery.error && codesQuery.data) || [];

  const userIds = [
    ...new Set(
      [
        ...purchases.map((row) => asText(row.user_id)),
        ...rewards.map((row) => asText(row.referrer_user_id)),
        ...rewards.map((row) => asText(row.referee_user_id)),
        ...codes.map((row) => asText(row.user_id)),
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

  const live = excludeTestStudents({
    purchases,
    installments,
    rewards,
    profiles: profiles || [],
  });
  const referrersByCode = buildReferrersByCode(codes, live.profiles, PROFESSIONAL_AFFILIATES);
  const months = buildRevenueMonthRows(live);
  const statements = buildRevenueStatements({ ...live, referrersByCode }).filter(
    (row) => !isTestStudentEmail(row.email)
  );

  return NextResponse.json({
    months,
    total: totalRevenueRow(months),
    statements,
  });
}
