/**
 * Students' data choices (opt-in): Eve training and academic research.
 * Stored on student_profiles (supabase/data-consent.sql). null = not answered yet.
 */
import { getSupabase } from "./supabase";

export type ConsentKey = "eve" | "research";
export type DataConsent = { eve: boolean | null; research: boolean | null; researchReview: boolean | null; updatedAt: string | null };
export type ConsentChoice = { eve: boolean; research: boolean; researchReview: boolean };

/** The optional condition under the research tickbox. */
export const RESEARCH_REVIEW_LABEL = "Yes, as long as I can see my data before you publish it";

export const CONSENT_TEXT: Record<ConsentKey, { label: string; more: string; paragraphs: string[] }> = {
  eve: {
    label: "Can I use your anonymised information to help train my AI coaching tool?",
    more: "Read here to see what this means",
    paragraphs: [
      "‘Eve’ is the AI coaching tool that I’m developing to make my coaching easier and cheaper to access for more students. By ticking ‘yes’, you allow me to use your data to teach Eve how to respond to student challenges and submissions. Your data is completely anonymised, and I do not sell your information or use it for advertising. Records are kept for as long as you have access to the course and for up to five years after, and then deleted.",
      "To run Eve, we use trusted AI service providers (currently Anthropic and OpenAI). They process this information on our behalf under agreements that do not allow them to use it to train their own models.",
      "You may ask us at any time to see the information we hold about you, to correct it, or to exclude your work from Eve’s training. Email yvonne@accountingstudyadvice.com. Excluding your work does not affect your access to the course or the feedback you receive. You also have the right to lodge a complaint with the Information Regulator of South Africa.",
    ],
  },
  research: {
    label: "Can I use your anonymised data in my academic research?",
    more: "Read here to see what this means",
    paragraphs: [
      "I study mindset and learning in accounting education to help improve how accounting qualifications are taught. This research may be published in academic journals, conference papers, books and teaching material.",
      "If you agree, your data may be included in this research. It will be anonymised before analysis. Results are reported as group findings or as anonymous examples, and nothing published will identify you. The research follows ethical approval and data-protection requirements.",
      "Taking part is voluntary. Saying no has no effect on your access to the course, your feedback or how you are treated. You may withdraw at any time by emailing yvonne@accountingstudyadvice.com.",
    ],
  },
};

export const MISSING_CONSENT_SQL = "Paste supabase/data-consent.sql in the Supabase SQL editor, then try again.";

export async function loadMyConsent(userId: string): Promise<{ ok: boolean; consent: DataConsent; error?: string }> {
  const empty: DataConsent = { eve: null, research: null, researchReview: null, updatedAt: null };
  const client = getSupabase();
  if (!client) return { ok: false, consent: empty, error: "Supabase is not configured." };
  const { data, error } = await client
    .from("student_profiles")
    .select("eve_training_consent, research_consent, research_review_before_publish, consent_updated_at")
    .eq("student_id", userId)
    .maybeSingle();
  if (error) return { ok: false, consent: empty, error: /consent/i.test(error.message) ? MISSING_CONSENT_SQL : error.message };
  const row = (data ?? {}) as { eve_training_consent?: boolean | null; research_consent?: boolean | null; research_review_before_publish?: boolean | null; consent_updated_at?: string | null };
  return { ok: true, consent: { eve: row.eve_training_consent ?? null, research: row.research_consent ?? null, researchReview: row.research_review_before_publish ?? null, updatedAt: row.consent_updated_at ?? null } };
}

/** Saves both answers (an unticked box is a "no"). */
export async function saveMyConsent(userId: string, choice: ConsentChoice): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const now = new Date().toISOString();
  const { error } = await client.from("student_profiles").upsert(
    {
      student_id: userId,
      eve_training_consent: choice.eve,
      research_consent: choice.research,
      research_review_before_publish: choice.research ? choice.researchReview : null,
      consent_updated_at: now,
      consent_updated_by: "student",
      updated_at: now,
    },
    { onConflict: "student_id" }
  );
  if (error) return { ok: false, error: /consent/i.test(error.message) ? MISSING_CONSENT_SQL : error.message };
  return { ok: true };
}

export function consentLabel(value: boolean | null, review?: boolean | null): string {
  if (value === true && review) return "Yes, if they see their data before publication";
  return value === true ? "Yes" : value === false ? "No" : "Not answered yet";
}
