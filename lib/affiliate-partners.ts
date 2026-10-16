import { discountCents, FALLBACK_PRODUCT, type CourseProduct } from "./commerce";
import { getServiceSupabase } from "./supabase-admin";

export type AffiliatePayout = "credit" | "external";
export type AffiliateKind = "student" | "professional";

export interface ProfessionalAffiliate {
  id: string;
  name: string;
  email?: string | null;
  code: string;
  kind: "professional";
  rate_bps: number;
  referee_bps: number;
  payout: "external";
}

export const ROELIEN_AFFILIATE: ProfessionalAffiliate = {
  id: "8e01e11e-21bd-4270-8c0d-e00000c0de01",
  name: "Roelien",
  code: "ROELIENJ21HD27",
  kind: "professional",
  rate_bps: 1500,
  referee_bps: 500,
  payout: "external",
};

export const PROFESSIONAL_AFFILIATES: ProfessionalAffiliate[] = [ROELIEN_AFFILIATE];

export function normalizeAffiliateCode(code: string): string {
  return code.trim().toUpperCase();
}

export function professionalPayoutCents(
  rateBps: number,
  product: CourseProduct = FALLBACK_PRODUCT
): number {
  return discountCents(product.once_off_amount_cents, rateBps);
}

export function findSeededProfessionalAffiliate(code: string): ProfessionalAffiliate | null {
  const normalized = normalizeAffiliateCode(code);
  return PROFESSIONAL_AFFILIATES.find((row) => row.code === normalized) || null;
}

export async function ensureProfessionalAffiliates(): Promise<ProfessionalAffiliate[]> {
  const client = getServiceSupabase();
  if (!client) return PROFESSIONAL_AFFILIATES;

  const { error } = await client.from("affiliate_partners").upsert(
    PROFESSIONAL_AFFILIATES.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email || null,
      code: row.code,
      kind: row.kind,
      rate_bps: row.rate_bps,
      payout: row.payout,
    })),
    { onConflict: "code" }
  );
  if (error) return PROFESSIONAL_AFFILIATES;

  const { data } = await client
    .from("affiliate_partners")
    .select("id, name, email, code, kind, rate_bps, payout")
    .eq("kind", "professional")
    .order("name", { ascending: true });
  const live = (data || [])
    .map((row) => ({
      id: String(row.id),
      name: String(row.name || "").trim() || "Colleague",
      email: row.email ? String(row.email) : null,
      code: normalizeAffiliateCode(String(row.code || "")),
      kind: "professional" as const,
      rate_bps: Number(row.rate_bps || 1500),
      referee_bps: 500,
      payout: "external" as const,
    }))
    .filter((row) => row.code);
  if (!live.some((row) => row.code === ROELIEN_AFFILIATE.code)) {
    return [ROELIEN_AFFILIATE, ...live];
  }
  return live.sort((a, b) => {
    if (a.code === ROELIEN_AFFILIATE.code) return -1;
    if (b.code === ROELIEN_AFFILIATE.code) return 1;
    return a.name.localeCompare(b.name);
  });
}
