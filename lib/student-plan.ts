import { getSupabase } from "./supabase";
import type { MakeupSession, StudyPlan } from "./types";

interface PlanRow {
  user_id: string;
  start_date: string;
  hours: number;
  slots: string[] | null;
  makeups: MakeupSession[] | null;
}

function fromRow(row: PlanRow): StudyPlan {
  return {
    startDate: row.start_date,
    hours: Number(row.hours) || 1,
    slots: Array.isArray(row.slots) ? row.slots : [],
    makeups: Array.isArray(row.makeups) ? row.makeups : [],
  };
}

export async function fetchStudyPlan(userId: string): Promise<{ ok: boolean; error?: string; plan: StudyPlan | null }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured.", plan: null };
  const { data, error } = await client.from("study_plans").select("*").eq("user_id", userId).maybeSingle();
  if (error) return { ok: false, error: error.message, plan: null };
  return { ok: true, plan: data ? fromRow(data as PlanRow) : null };
}

export async function saveStudyPlan(userId: string, plan: StudyPlan): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { error } = await client.from("study_plans").upsert({
    user_id: userId,
    start_date: plan.startDate,
    hours: plan.hours,
    slots: plan.slots,
    makeups: plan.makeups,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function clearStudyPlan(userId: string): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { error } = await client.from("study_plans").delete().eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
