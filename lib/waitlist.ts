import { downloadRosterCsv } from "./roster";
import { getSupabase } from "./supabase";

export const WAITLIST_COHORTS = ["January 2027", "June 2027"] as const;

export type WaitlistCohort = (typeof WAITLIST_COHORTS)[number];

export interface WaitlistLead {
  id: string;
  full_name: string;
  email: string;
  preferred_cohort: WaitlistCohort | string;
  created_at: string;
}

export function isWaitlistCohort(value: string): value is WaitlistCohort {
  return (WAITLIST_COHORTS as readonly string[]).includes(value);
}

export async function joinWaitlist(input: {
  full_name: string;
  email: string;
  preferred_cohort: WaitlistCohort;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Supabase is not configured, so the waitlist is unavailable." };

  const full_name = input.full_name.trim();
  const email = input.email.trim().toLowerCase();
  if (!full_name || !email) return { ok: false, error: "Enter your full name and email address." };

  const { error } = await supabase.rpc("join_waitlist", {
    p_full_name: full_name,
    p_email: email,
    p_preferred_cohort: input.preferred_cohort,
  });
  if (!error) return { ok: true };

  const { error: insertError } = await supabase.from("waitlist").insert({
    full_name,
    email,
    preferred_cohort: input.preferred_cohort,
  });
  if (!insertError || insertError.code === "23505") return { ok: true };
  if (/join_waitlist|could not find the function|schema cache/i.test(error.message + (insertError.message || ""))) {
    return { ok: false, error: "Could not save your details. Paste supabase/waitlist.sql in the SQL editor first." };
  }
  return { ok: false, error: insertError.message || error.message };
}

export async function fetchWaitlistLeads(): Promise<{ ok: true; leads: WaitlistLead[] } | { ok: false; error: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };

  const { data, error } = await supabase
    .from("waitlist")
    .select("id, full_name, email, preferred_cohort, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    if (/schema cache|does not exist|waitlist/i.test(error.message)) {
      return { ok: false, error: "Could not load the waitlist. Paste supabase/waitlist.sql in the SQL editor first." };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, leads: (data || []) as WaitlistLead[] };
}

export function exportWaitlistCsv(leads: WaitlistLead[]): void {
  downloadRosterCsv(
    "iac-waitlist.csv",
    ["Full name", "Email", "Preferred cohort", "Joined"],
    leads.map((lead) => [lead.full_name, lead.email, lead.preferred_cohort, lead.created_at])
  );
}
