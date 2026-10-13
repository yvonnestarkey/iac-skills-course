import { NextResponse } from "next/server";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import { ensureProfessionalAffiliates, ROELIEN_AFFILIATE } from "@/lib/affiliate-partners";
import { getServiceSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function asText(value: unknown): string {
  return String(value || "").trim();
}

export async function GET() {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 401 });

  const partners = await ensureProfessionalAffiliates();
  const client = getServiceSupabase();
  if (!client) {
    return NextResponse.json({
      partners: partners.map((row) => ({ ...row, owed_cents: 0, successful_count: 0 })),
      students: [],
      successes: [],
    });
  }

  const withPartner = await client
    .from("referral_rewards")
    .select("id, referrer_user_id, referee_user_id, partner_id, amount_cents, status, payout_kind, purchase_id, created_at, updated_at")
    .order("created_at", { ascending: false });
  const rewards = (withPartner.error
    ? (
        await client
          .from("referral_rewards")
          .select("id, referrer_user_id, referee_user_id, amount_cents, status, purchase_id, created_at, updated_at")
          .order("created_at", { ascending: false })
      ).data
    : withPartner.data) || [];
  const codes = await client.from("referral_codes").select("user_id, code");

  const userIds = [
    ...new Set(
      [
        ...rewards.map((row) => asText(row.referrer_user_id)),
        ...rewards.map((row) => asText(row.referee_user_id)),
        ...(codes.data || []).map((row) => asText(row.user_id)),
      ].filter(Boolean)
    ),
  ];
  const { data: profiles } = userIds.length
    ? await client.from("profiles").select("id, email, full_name").in("id", userIds)
    : { data: [] };
  const profileById = new Map(
    (profiles || []).map((row) => [
      String(row.id),
      { name: asText(row.full_name) || asText(row.email) || "Student", email: asText(row.email) },
    ])
  );

  const successful = rewards.filter((row) => ["earned", "applied", "refund_due"].includes(String(row.status)));
  const partnerById = new Map(partners.map((row) => [row.id, row]));
  const codeByUser = new Map((codes.data || []).map((row) => [asText(row.user_id), asText(row.code)]));

  const successes = successful.map((row) => {
    const partnerId = asText((row as { partner_id?: string }).partner_id);
    const partner = partnerById.get(partnerId) || (partnerId === ROELIEN_AFFILIATE.id ? ROELIEN_AFFILIATE : null);
    const professional = Boolean(partner) || String((row as { payout_kind?: string }).payout_kind || "") === "external";
    const referrerId = asText(row.referrer_user_id);
    const refereeId = asText(row.referee_user_id);
    const referrer = referrerId ? profileById.get(referrerId) : null;
    const referee = refereeId ? profileById.get(refereeId) : null;
    return {
      id: String(row.id),
      at: String(row.created_at || row.updated_at || ""),
      referrer_name: partner?.name || referrer?.name || "Student",
      referrer_kind: professional ? "professional" : "student",
      code: partner?.code || codeByUser.get(referrerId) || "",
      referee_name: referee?.name || "Student",
      referee_email: referee?.email || "",
      amount_cents: Number(row.amount_cents || 0),
      payout: professional ? "external" : "credit",
      status: String(row.status),
      rate_label: professional ? "Student 5% off · 15% of course price owed · pay separately" : "Student 5% off · 10% course credit",
    };
  });

  const partnerStats = partners.map((partner) => {
    const rows = successes.filter((row) => row.referrer_kind === "professional" && row.code === partner.code);
    const owed = rows
      .filter((row) => row.status === "earned")
      .reduce((sum, row) => sum + row.amount_cents, 0);
    return { ...partner, owed_cents: owed, successful_count: rows.length };
  });

  const studentMap = new Map<
    string,
    { user_id: string; name: string; email: string; code: string; earned_cents: number; successful_count: number }
  >();
  successful.forEach((row) => {
    const professional =
      Boolean(asText((row as { partner_id?: string }).partner_id)) ||
      String((row as { payout_kind?: string }).payout_kind || "") === "external";
    if (professional) return;
    const userId = asText(row.referrer_user_id);
    if (!userId) return;
    const profile = profileById.get(userId);
    const current = studentMap.get(userId) || {
      user_id: userId,
      name: profile?.name || "Student",
      email: profile?.email || "",
      code: codeByUser.get(userId) || "",
      earned_cents: 0,
      successful_count: 0,
    };
    current.successful_count += 1;
    current.earned_cents += Number(row.amount_cents || 0);
    studentMap.set(userId, current);
  });

  return NextResponse.json({
    partners: partnerStats,
    students: [...studentMap.values()].sort((a, b) => b.successful_count - a.successful_count || a.name.localeCompare(b.name)),
    successes,
  });
}
