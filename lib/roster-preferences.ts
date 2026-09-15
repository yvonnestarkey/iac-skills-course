import { getSupabase } from "./supabase";
import { sanitizeRosterColumns, type RosterColumnId } from "./roster";

function tableMissing(message: string): boolean {
  return /does not exist|schema cache|could not find/i.test(message);
}

export async function fetchCoachRosterColumns(): Promise<RosterColumnId[] | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await client
    .from("coach_roster_preferences")
    .select("visible_columns")
    .eq("coach_id", auth.user.id)
    .maybeSingle();
  if (error) {
    if (!tableMissing(error.message)) console.error("coach_roster_preferences", error.message);
    return null;
  }
  if (!data) return null;
  return sanitizeRosterColumns((data as { visible_columns?: unknown }).visible_columns);
}

export async function saveCoachRosterColumns(columns: RosterColumnId[]): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return;
  const { error } = await client.from("coach_roster_preferences").upsert({
    coach_id: auth.user.id,
    visible_columns: sanitizeRosterColumns(columns),
    updated_at: new Date().toISOString(),
  });
  if (error && !tableMissing(error.message)) console.error("coach_roster_preferences", error.message);
}
