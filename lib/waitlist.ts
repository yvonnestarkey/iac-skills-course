import { downloadRosterCsv } from "./roster";
import { getSupabase } from "./supabase";

export const WAITLIST_EXAMS = ["January 2027 IAC Exam"] as const;
export const WAITLIST_PAYMENTS = ["Once-off ($327)", "6 Installments ($60/mo)"] as const;
export const WAITLIST_INSTITUTIONS = ["SAICA", "ICAZ", "ICAN", "Other"] as const;
export const WAITLIST_PUBLIC_INSTITUTIONS = ["SAICA", "ICAZ", "ICAN"] as const;

export type WaitlistExam = (typeof WAITLIST_EXAMS)[number];
export type WaitlistPayment = (typeof WAITLIST_PAYMENTS)[number];
export type WaitlistInstitution = (typeof WAITLIST_INSTITUTIONS)[number];
export type WaitlistCohort = WaitlistExam;

export interface WaitlistLead {
  id: string;
  full_name: string;
  email: string;
  preferred_cohort: WaitlistExam | string;
  preferred_payment?: WaitlistPayment | string | null;
  institution?: WaitlistInstitution | string | null;
  query?: string | null;
  created_at: string;
}

export function isWaitlistExam(value: string): value is WaitlistExam {
  return (WAITLIST_EXAMS as readonly string[]).includes(value);
}

export function isWaitlistCohort(value: string): value is WaitlistExam {
  return isWaitlistExam(value);
}

export function isWaitlistPayment(value: string): value is WaitlistPayment {
  return (WAITLIST_PAYMENTS as readonly string[]).includes(value);
}

export function isWaitlistInstitution(value: string): value is WaitlistInstitution {
  return (WAITLIST_INSTITUTIONS as readonly string[]).includes(value);
}

export async function joinWaitlist(input: {
  full_name: string;
  email: string;
  preferred_cohort: WaitlistExam;
  preferred_payment?: WaitlistPayment | null;
  institution: WaitlistInstitution;
  query?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Supabase is not configured, so the waitlist is unavailable." };

  const full_name = input.full_name.trim();
  const email = input.email.trim().toLowerCase();
  const query = input.query?.trim() || null;
  if (!full_name || !email) return { ok: false, error: "Enter your full name and email address." };
  if (query && query.length > 2000) return { ok: false, error: "Keep your question under 2000 characters." };

  const preferred_payment = input.preferred_payment || null;
  const rpcArgs = {
    p_full_name: full_name,
    p_email: email,
    p_preferred_cohort: input.preferred_cohort,
    p_preferred_payment: preferred_payment,
    p_institution: input.institution,
  };

  if (query) {
    const withQuery = await supabase.rpc("join_waitlist", { ...rpcArgs, p_query: query });
    if (!withQuery.error) return { ok: true };
  }

  const withoutQuery = await supabase.rpc("join_waitlist", rpcArgs);
  if (!withoutQuery.error) return { ok: true };

  const row = {
    full_name,
    email,
    preferred_cohort: input.preferred_cohort,
    preferred_payment,
    institution: input.institution,
  };
  const insertWithQuery = query ? await supabase.from("waitlist").insert({ ...row, query }) : { error: withoutQuery.error };
  if (!insertWithQuery.error || insertWithQuery.error.code === "23505") return { ok: true };

  const insertBasic = await supabase.from("waitlist").insert(row);
  if (!insertBasic.error || insertBasic.error.code === "23505") return { ok: true };

  return { ok: false, error: insertBasic.error?.message || withoutQuery.error.message };
}

export async function fetchWaitlistLeads(): Promise<{ ok: true; leads: WaitlistLead[] } | { ok: false; error: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };

  const { data, error } = await supabase.from("waitlist").select("*").order("created_at", { ascending: false });

  if (error) {
    return { ok: false, error: error.message };
  }
  return {
    ok: true,
    leads: (data || []).map((row) => ({
      id: String(row.id),
      full_name: String(row.full_name || ""),
      email: String(row.email || ""),
      preferred_cohort: String(row.preferred_cohort || ""),
      preferred_payment: row.preferred_payment == null ? null : String(row.preferred_payment),
      institution: row.institution == null ? null : String(row.institution),
      query: row.query == null ? null : String(row.query),
      created_at: String(row.created_at || ""),
    })),
  };
}

export function exportWaitlistCsv(leads: WaitlistLead[]): void {
  downloadRosterCsv(
    "iac-waitlist.csv",
    ["Full name", "Email", "Target exam", "Institution", "Preferred payment", "Query", "Joined"],
    leads.map((lead) => [
      lead.full_name,
      lead.email,
      lead.preferred_cohort,
      lead.institution || "",
      lead.preferred_payment || "",
      lead.query || "",
      lead.created_at,
    ])
  );
}
