import { studentFromPlan } from "./calendar-student";
import { buildIcs } from "./ics";
import { SEED } from "./seed";
import { getSupabase } from "./supabase";
import type { MakeupSession, StudyPlan } from "./types";

interface PlanRow {
  user_id: string;
  start_date: string;
  hours: number;
  slots: string[] | null;
  makeups: MakeupSession[] | null;
}

function planFromRow(row: PlanRow): StudyPlan {
  return {
    startDate: row.start_date,
    hours: Number(row.hours) || 1,
    slots: Array.isArray(row.slots) ? row.slots : [],
    makeups: Array.isArray(row.makeups) ? row.makeups : [],
  };
}

export async function buildCalendarIcs(token: string, origin: string): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;

  const rpc = await client.rpc("calendar_plan", { token });
  let row = Array.isArray(rpc.data) ? (rpc.data[0] as PlanRow | undefined) : (rpc.data as PlanRow | null);

  if (!row) {
    const fallback = await client.from("study_plans").select("*").eq("user_id", token).maybeSingle();
    row = fallback.data as PlanRow | null;
  }

  if (!row) return null;
  const plan = planFromRow(row);
  if (!plan.slots.length) return null;
  const student = studentFromPlan(row.user_id, plan, { name: "Student" });
  return buildIcs(SEED, { ...student, calendar: { token, subscribed: true } }, plan, origin);
}
