import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";

export type BuriedTreasureTierId = "tier1" | "tier2" | "tier3";

export type BuriedTreasureTier = {
  id: BuriedTreasureTierId;
  name: string;
  definition: string;
  weight: string;
  available: number;
  benchmark: number;
};

export const BURIED_TREASURE_TIERS: BuriedTreasureTier[] = [
  {
    id: "tier1",
    name: "Tier 1: Direct Marks",
    definition: "Straight scenario extraction (given numbers, figures, share counts, dates).",
    weight: "~10%",
    available: 36,
    benchmark: 80,
  },
  {
    id: "tier2",
    name: "Tier 2: Indirect Marks",
    definition: "Scenario trigger + small leap (15/115 VAT fraction, control weaknesses, Hamada beta un-levering).",
    weight: "~35–40%",
    available: 130,
    benchmark: 60,
  },
  {
    id: "tier3",
    name: "Tier 3: Thinking Marks",
    definition: "Deeper reasoning & execution (journal entries, multi-stakeholder memos, scenario-locked audit steps).",
    weight: "~50–55%",
    available: 194,
    benchmark: 50,
  },
];

export type BuriedTreasureLog = {
  id?: string;
  user_id: string;
  paper_name: string;
  tier1_available: number;
  tier1_earned: number;
  tier1_conversion: number;
  tier2_available: number;
  tier2_earned: number;
  tier2_conversion: number;
  tier3_available: number;
  tier3_earned: number;
  tier3_conversion: number;
  notes: string;
  created_at?: string;
};

function asNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function pctOf(earned: number, available: number): number {
  if (!available || available <= 0) return 0;
  return Math.max(0, Math.round((earned / available) * 1000) / 10);
}

export function buriedTreasureTag(tierId: BuriedTreasureTierId, conversion: number | null): string {
  if (conversion == null) return "";
  if (tierId === "tier1") {
    if (conversion >= 80) return "🟢 Excellent Extraction";
    if (conversion >= 60) return "🟡 Incomplete Extraction";
    return "🔴 Missed Direct Facts";
  }
  if (tierId === "tier2") {
    if (conversion >= 60) return "🟢 Solid Indirect Capture";
    if (conversion >= 40) return "🟡 Weak Scenario Leap";
    return "🔴 Indirect Marks Leak";
  }
  if (conversion >= 50) return "🟢 Sound Thinking Execution";
  if (conversion >= 30) return "🟡 Execution Softness";
  return "🔴 Critical Execution & Mechanics Leak";
}

export function rowToBuriedTreasure(row: Record<string, unknown>): BuriedTreasureLog {
  return {
    id: row.id ? String(row.id) : undefined,
    user_id: String(row.user_id || ""),
    paper_name: String(row.paper_name || ""),
    tier1_available: asNumber(row.tier1_available) || 36,
    tier1_earned: asNumber(row.tier1_earned),
    tier1_conversion: asNumber(row.tier1_conversion),
    tier2_available: asNumber(row.tier2_available) || 130,
    tier2_earned: asNumber(row.tier2_earned),
    tier2_conversion: asNumber(row.tier2_conversion),
    tier3_available: asNumber(row.tier3_available) || 194,
    tier3_earned: asNumber(row.tier3_earned),
    tier3_conversion: asNumber(row.tier3_conversion),
    notes: String(row.notes || ""),
    created_at: row.created_at ? String(row.created_at) : undefined,
  };
}

export async function fetchLatestBuriedTreasure(
  supabase: SupabaseClient,
  userId: string
): Promise<BuriedTreasureLog | null> {
  const { data, error } = await supabase
    .from("case_study_conversion_logs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return rowToBuriedTreasure(data as Record<string, unknown>);
}

export async function fetchOwnBuriedTreasure(userId: string): Promise<BuriedTreasureLog | null> {
  const supabase = getSupabase();
  if (!supabase || !userId) return null;
  return fetchLatestBuriedTreasure(supabase, userId);
}

export async function saveBuriedTreasureSession(input: {
  userId: string;
  paper_name?: string;
  tier1_earned: number;
  tier2_earned: number;
  tier3_earned: number;
  notes?: string;
}): Promise<{ ok: true; log: BuriedTreasureLog } | { ok: false; error: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  const tier1 = BURIED_TREASURE_TIERS[0];
  const tier2 = BURIED_TREASURE_TIERS[1];
  const tier3 = BURIED_TREASURE_TIERS[2];
  const payload = {
    user_id: input.userId,
    paper_name: input.paper_name || "June 2026 IAC Exam",
    tier1_available: tier1.available,
    tier1_earned: input.tier1_earned,
    tier1_conversion: pctOf(input.tier1_earned, tier1.available),
    tier2_available: tier2.available,
    tier2_earned: input.tier2_earned,
    tier2_conversion: pctOf(input.tier2_earned, tier2.available),
    tier3_available: tier3.available,
    tier3_earned: input.tier3_earned,
    tier3_conversion: pctOf(input.tier3_earned, tier3.available),
    notes: input.notes || "",
  };
  const { data, error } = await supabase.from("case_study_conversion_logs").insert(payload).select("*").single();
  if (error) {
    if (/case_study_conversion_logs|schema cache|does not exist/i.test(error.message)) {
      return { ok: false, error: "Could not save. Paste supabase/case_study_conversion.sql in the SQL editor first." };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, log: rowToBuriedTreasure(data as Record<string, unknown>) };
}

export function formatBuriedTreasureContext(log: BuriedTreasureLog | null): string {
  if (!log) return "Latest Buried Treasure: none saved yet.";
  const t1Tag = buriedTreasureTag("tier1", log.tier1_conversion);
  const t2Tag = buriedTreasureTag("tier2", log.tier2_conversion);
  const t3Tag = buriedTreasureTag("tier3", log.tier3_conversion);
  const executionGap = log.tier1_conversion >= 80 && log.tier3_conversion < 50;
  const theoryGap = log.tier1_conversion < 80;
  return [
    `Latest Buried Treasure (${log.created_at || "undated"} · ${log.paper_name || "June 2026 IAC Exam"}):`,
    `- Tier 1 Direct Marks (~10% / ${log.tier1_available} marks, target >= 80%): earned ${log.tier1_earned} / ${log.tier1_available} (${log.tier1_conversion}%). ${t1Tag}`,
    `- Tier 2 Indirect Marks (~35-40% / ${log.tier2_available} marks, target >= 60%): earned ${log.tier2_earned} / ${log.tier2_available} (${log.tier2_conversion}%). ${t2Tag}`,
    `- Tier 3 Thinking Marks (~50-55% / ${log.tier3_available} marks, target >= 50%): earned ${log.tier3_earned} / ${log.tier3_available} (${log.tier3_conversion}%). ${t3Tag}`,
    executionGap
      ? "- Gap call: Tier 1 extraction is on target, but Tier 3 thinking/execution is below 50%. This is a Tier 3 execution gap, not a theory gap."
      : theoryGap
        ? "- Gap call: Tier 1 Direct conversion is below 80%. They are not extracting buried treasure from the scenario (theory/extraction gap)."
        : "- Gap call: Buried Treasure conversion does not show a clear theory vs Tier 3 execution split on its own.",
    log.notes ? `- Notes: ${log.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
