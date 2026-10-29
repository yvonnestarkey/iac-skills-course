/** Server-side loader for the Eve training corpus: reads the course tables with the service key and builds the examples. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { allowedCoachEmails } from "../roles";
import { unpackSubmissionContent } from "../student-submissions";
import {
  finaliseCorpus,
  inboxExamples,
  submissionExamples,
  surveyExamples,
  type CorpusExample,
  type InboxRowLite,
  type StudentIdentity,
  type SubmissionRowLite,
  type SurveyQuestionLite,
  type SurveyResponseLite,
} from "./corpus";

type Row = Record<string, unknown>;
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/** Staff and test accounts are left out so only real student work trains Eve. */
export function isTrainingExcluded(email: string): boolean {
  const e = email.toLowerCase();
  return !e || allowedCoachEmails().includes(e) || /@test\.|^test|\btest\b|@example\./.test(e);
}

async function rows(client: SupabaseClient, table: string, select = "*"): Promise<{ data: Row[]; warning?: string }> {
  const { data, error } = await client.from(table).select(select);
  if (error) return { data: [], warning: `${table}: ${error.message}` };
  return { data: (data ?? []) as unknown as Row[] };
}

export type ConsentCounts = { yes: number; no: number; unanswered: number; checked: boolean };

/** Only students who ticked "yes" to Eve training are included (opt-in). */
export async function loadTrainingCorpus(
  client: SupabaseClient
): Promise<{ examples: CorpusExample[]; warnings: string[]; excludedStudents: number; consent: ConsentCounts }> {
  const warnings: string[] = [];
  const [profiles, lessons, inbox, submissions, surveys, responses] = await Promise.all([
    rows(client, "profiles", "id, email, full_name"),
    rows(client, "lessons", "id, title"),
    rows(client, "inbox_messages"),
    rows(client, "student_submissions"),
    rows(client, "custom_surveys", "id, title, questions"),
    rows(client, "custom_survey_responses"),
  ]);
  const consentRows = await rows(client, "student_profiles", "student_id, eve_training_consent");
  const consentChecked = !consentRows.warning;
  if (consentRows.warning) warnings.push(`${consentRows.warning} (run supabase/data-consent.sql; until then nobody is included)`);
  const consentBy = new Map(consentRows.data.map((r) => [str(r.student_id), r.eve_training_consent as boolean | null]));
  for (const r of [profiles, lessons, inbox, submissions, surveys, responses]) if (r.warning) warnings.push(r.warning);

  const people = new Map<string, StudentIdentity>();
  const excluded = new Set<string>();
  for (const p of profiles.data) {
    const who = { id: str(p.id), email: str(p.email), full_name: str(p.full_name) };
    people.set(who.id, who);
    if (who.email) people.set(who.email.toLowerCase(), who);
    if (isTrainingExcluded(who.email)) {
      excluded.add(who.id);
      if (who.email) excluded.add(who.email.toLowerCase());
    }
  }
  const isStaffOrTest = (id: string, email = "") => excluded.has(id) || Boolean(email && isTrainingExcluded(email)) || excluded.has(email.toLowerCase());
  const idFor = (id: string, email = "") => id || str(people.get(email.toLowerCase())?.id);
  const seenStudents = new Set<string>();
  const keep = (id: string, email = "") => {
    if (isStaffOrTest(id, email)) return false;
    const sid = idFor(id, email);
    if (sid) seenStudents.add(sid);
    return Boolean(sid) && consentBy.get(sid) === true;
  };

  const lessonTitles = new Map(lessons.data.map((l) => [str(l.id), str(l.title)]));

  const inboxRows: InboxRowLite[] = inbox.data
    .map((r) => ({
      id: str(r.id),
      student_id: r.student_id ? str(r.student_id) : null,
      student_email: str(r.student_email),
      from_role: str(r.from_role),
      kind: str(r.kind),
      body: str(r.body),
      context: r.context ? str(r.context) : null,
      lesson_id: r.lesson_id ? str(r.lesson_id) : null,
      created_at: str(r.created_at),
    }))
    .filter((r) => keep(r.student_id || "", r.student_email));
  for (const r of inboxRows) if (!r.context && r.lesson_id) r.context = lessonTitles.get(r.lesson_id) || null;

  const submissionRows: SubmissionRowLite[] = submissions.data
    .map((r) => {
      const content = unpackSubmissionContent(r as never);
      return {
        id: str(r.id),
        student_id: str(r.student_id),
        lesson_id: str(r.lesson_id),
        body: content.body,
        link_url: content.link_url,
        status: r.status ? str(r.status) : null,
        grade: (r.grade as string | number | null) ?? null,
        feedback: str(r.feedback),
        feedback_file_url: r.feedback_file_url ? str(r.feedback_file_url) : null,
        submitted_at: str(r.submitted_at || r.created_at),
      };
    })
    .filter((r) => r.feedback && keep(r.student_id));

  const surveyMap = new Map<string, { title: string; questions: SurveyQuestionLite[] }>();
  for (const s of surveys.data) {
    const qs = Array.isArray(s.questions) ? (s.questions as Row[]) : [];
    surveyMap.set(str(s.id), { title: str(s.title), questions: qs.map((q) => ({ id: str(q.id), type: str(q.type), label: str(q.label) })) });
  }
  const responseRows: SurveyResponseLite[] = responses.data
    .map((r) => ({
      id: str(r.id),
      survey_id: str(r.survey_id),
      student_id: str(r.student_id),
      answers: (r.answers && typeof r.answers === "object" ? r.answers : {}) as Record<string, string>,
      status: r.status ? str(r.status) : null,
      grade: (r.grade as string | number | null) ?? null,
      feedback: str(r.feedback),
      feedback_file_url: r.feedback_file_url ? str(r.feedback_file_url) : null,
      created_at: str(r.created_at),
    }))
    .filter((r) => r.feedback && keep(r.student_id));

  const examples = finaliseCorpus([
    ...inboxExamples(inboxRows, people),
    ...submissionExamples(submissionRows, people, lessonTitles),
    ...surveyExamples(responseRows, surveyMap, people),
  ]);
  const excludedStudents = new Set([...excluded].filter((k) => !k.includes("@"))).size;
  const consent: ConsentCounts = { yes: 0, no: 0, unanswered: 0, checked: consentChecked };
  for (const sid of seenStudents) {
    const v = consentBy.get(sid);
    if (v === true) consent.yes += 1;
    else if (v === false) consent.no += 1;
    else consent.unanswered += 1;
  }
  return { examples, warnings, excludedStudents, consent };
}
