/**
 * Eve training corpus (Step 1): pairs of "what the student sent" and "what Yvonne replied", built from the data the
 * course already stores. Anonymised: student names, emails, phone numbers and links are removed, and each student gets
 * a stable code (S-xxxxxx) so examples from the same student can still be grouped.
 *
 * Sources (inside the course only):
 *  - inbox: student questions and the coach reply that answered them
 *  - assignment: lesson submissions and every dated feedback comment on them
 *  - survey: survey and assignment-form answers and every dated feedback comment on them
 *
 * Pure functions only, so the rules can be tested without a database.
 */
import { createHash } from "node:crypto";
import { parseFeedbackLog } from "../feedback-log";

export type CorpusSource = "inbox" | "assignment" | "survey";

export type CorpusExample = {
  id: string;
  source: CorpusSource;
  student: string;
  at: string;
  task: string;
  input: string;
  response: string;
  status: string | null;
  grade: string | null;
  feedback_file: boolean;
  tags: string[];
};

export type StudentIdentity = { id: string; email?: string | null; full_name?: string | null };

export type InboxRowLite = {
  id: string;
  student_id: string | null;
  student_email: string;
  from_role: string;
  kind: string;
  body: string;
  context?: string | null;
  lesson_id?: string | null;
  created_at: string;
};

export type SubmissionRowLite = {
  id: string;
  student_id: string;
  lesson_id: string;
  body: string;
  link_url: string;
  status?: string | null;
  grade?: string | number | null;
  feedback?: string | null;
  feedback_file_url?: string | null;
  submitted_at?: string | null;
};

export type SurveyQuestionLite = { id: string; type: string; label: string };
export type SurveyResponseLite = {
  id: string;
  survey_id: string;
  student_id: string;
  answers: Record<string, string>;
  status?: string | null;
  grade?: string | number | null;
  feedback?: string | null;
  feedback_file_url?: string | null;
  created_at?: string | null;
};

/** Stable, non-reversible student code. */
export function studentCode(idOrEmail: string): string {
  return "S-" + createHash("sha256").update(String(idOrEmail || "unknown").toLowerCase()).digest("hex").slice(0, 6);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Remove the student's own name and email, plus any email address, phone number or link. */
export function anonymise(text: string, who?: StudentIdentity | null): string {
  let out = String(text || "");
  out = out.replace(/https?:\/\/\S+/gi, "[link]");
  out = out.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[email]");
  // Phone numbers only in phone shapes (+27 or a leading 0, or + and 9+ digits), so amounts like R12 000 000 survive.
  out = out.replace(/(?<![\d,.])(?:\+27|0)\s?\d{2}[\s-]?\d{3}[\s-]?\d{4}(?!\d|[.,]\d)/g, "[phone]");
  out = out.replace(/\+\d[\d\s-]{8,}\d/g, "[phone]");
  const names = new Set<string>();
  const full = String(who?.full_name || "").trim();
  if (full) {
    names.add(full);
    for (const part of full.split(/\s+/)) if (part.length >= 3) names.add(part);
  }
  const local = String(who?.email || "").split("@")[0] || "";
  for (const part of local.split(/[._\-\d]+/)) if (part.length >= 3) names.add(part);
  // Longest first so a full name is replaced before its parts.
  for (const name of [...names].sort((a, b) => b.length - a.length)) {
    out = out.replace(new RegExp(`\\b${escapeRe(name)}\\b`, "gi"), "[student]");
  }
  return out.trim();
}

/** Suggested Eve tool tags from the wording of the reply (and the student's message). A starting point, not a ruling. */
const TAG_RULES: [string, RegExp][] = [
  ["RTFQ", /\brtfq\b|read (the|each) (question|required)|what the (question|required) (asks|asked)|instruction word|answer(ed|ing)? the question|the required asks/i],
  ["Buried Treasure", /buried treasure|case stud(y|ies) (info|information|facts|clues)|use the case|scenario (info|information|facts)|information in the case|from the case/i],
  ["Volume", /\bvolume\b|more points|enough points|point per mark|not enough (written|content)/i],
  ["Accuracy", /\baccuracy\b|valid points?|not valid|incorrect|inaccurate/i],
  ["BMCR", /\bbmcr\b|basic marks?|conversion rate|basic, medium|theory (gap|problem|knowledge)/i],
  ["Components", /\bcomponents?\b|break (it|the question|this) down|breakdown|framework|headings/i],
  ["Core Issue", /core issue|red flag|main issue|priorit/i],
  ["Communication", /communicat|underdeveloped|explain why|so what|unclear|not clear|incomplete (point|sentence)/i],
  ["Time management", /time management|ran out of time|timing|per mark (minutes|time)|\bminutes\b/i],
  ["Mindset", /mindset|confiden|anxi|stress|overwhelm|motivat|fear|belief|self[- ]talk/i],
  ["Study planning", /study plan|planner|schedule|routine|revision plan/i],
];

export function suggestTags(...texts: string[]): string[] {
  const all = texts.join("\n");
  return TAG_RULES.filter(([, re]) => re.test(all)).map(([tag]) => tag);
}

const gradeText = (g: string | number | null | undefined) => (g === null || g === undefined || g === "" ? null : String(g));
const isStatusOnly = (text: string) => /^(Status changed to [^.]+\.\s*)?(Grade updated to [^.]+\.)?$/.test(text.trim());

/** Inbox: each coach reply is paired with the student messages since the previous coach message. */
export function inboxExamples(rows: InboxRowLite[], people: Map<string, StudentIdentity>): CorpusExample[] {
  const byStudent = new Map<string, InboxRowLite[]>();
  for (const r of rows) {
    const key = r.student_id || String(r.student_email || "").toLowerCase();
    byStudent.set(key, [...(byStudent.get(key) ?? []), r]);
  }
  const out: CorpusExample[] = [];
  for (const [key, msgs] of byStudent) {
    msgs.sort((a, b) => a.created_at.localeCompare(b.created_at));
    const who = people.get(key) ?? { id: key, email: msgs[0]?.student_email };
    let pending: InboxRowLite[] = [];
    for (const m of msgs) {
      if (m.from_role === "student") {
        pending.push(m);
        continue;
      }
      const response = anonymise(m.body, who);
      if (!response) continue;
      const input = anonymise(pending.map((p) => p.body).join("\n\n"), who);
      const task = anonymise(m.context || pending.find((p) => p.context)?.context || "", who);
      out.push({
        id: `inbox:${m.id}`,
        source: "inbox",
        student: studentCode(key),
        at: m.created_at,
        task,
        input,
        response,
        status: null,
        grade: null,
        feedback_file: false,
        tags: suggestTags(response, input),
      });
      pending = [];
    }
  }
  return out;
}

/** Assignments: one example per dated feedback comment (status-only log lines are skipped). */
export function submissionExamples(rows: SubmissionRowLite[], people: Map<string, StudentIdentity>, lessonTitles: Map<string, string>): CorpusExample[] {
  const out: CorpusExample[] = [];
  for (const r of rows) {
    const who = people.get(r.student_id) ?? { id: r.student_id };
    const input = anonymise([r.body, r.link_url ? "[link to submitted work]" : ""].filter(Boolean).join("\n\n"), who);
    parseFeedbackLog(r.feedback).forEach((entry, i) => {
      if (isStatusOnly(entry.text)) return;
      const response = anonymise(entry.text, who);
      out.push({
        id: `assignment:${r.id}:${i}`,
        source: "assignment",
        student: studentCode(r.student_id),
        at: entry.at || r.submitted_at || "",
        task: lessonTitles.get(r.lesson_id) || r.lesson_id,
        input,
        response,
        status: r.status ?? null,
        grade: gradeText(r.grade),
        feedback_file: Boolean(r.feedback_file_url),
        tags: suggestTags(response, input),
      });
    });
  }
  return out;
}

/** Surveys: answers labelled by question; one example per dated feedback comment. */
export function surveyExamples(
  rows: SurveyResponseLite[],
  surveys: Map<string, { title: string; questions: SurveyQuestionLite[] }>,
  people: Map<string, StudentIdentity>
): CorpusExample[] {
  const out: CorpusExample[] = [];
  for (const r of rows) {
    const survey = surveys.get(r.survey_id);
    const who = people.get(r.student_id) ?? { id: r.student_id };
    const lines = (survey?.questions ?? [])
      .filter((q) => q.type !== "info_link")
      .map((q) => {
        const a = String(r.answers?.[q.id] ?? "").trim();
        if (!a) return "";
        return `${q.label}: ${q.type === "pdf_upload" ? "[PDF uploaded]" : a}`;
      })
      .filter(Boolean);
    const input = anonymise(lines.join("\n"), who);
    parseFeedbackLog(r.feedback).forEach((entry, i) => {
      if (isStatusOnly(entry.text)) return;
      const response = anonymise(entry.text, who);
      out.push({
        id: `survey:${r.id}:${i}`,
        source: "survey",
        student: studentCode(r.student_id),
        at: entry.at || r.created_at || "",
        task: survey?.title || "Survey",
        input,
        response,
        status: r.status ?? null,
        grade: gradeText(r.grade),
        feedback_file: Boolean(r.feedback_file_url),
        tags: suggestTags(response, input),
      });
    });
  }
  return out;
}

/** Drop exact repeats (same student, same reply), newest first. */
export function finaliseCorpus(examples: CorpusExample[]): CorpusExample[] {
  const seen = new Set<string>();
  return [...examples]
    .sort((a, b) => b.at.localeCompare(a.at))
    .filter((e) => {
      const k = `${e.student}|${e.response}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

export function corpusSummary(examples: CorpusExample[]) {
  const bySource: Record<string, number> = {};
  const byTag: Record<string, number> = {};
  for (const e of examples) {
    bySource[e.source] = (bySource[e.source] ?? 0) + 1;
    for (const t of e.tags.length ? e.tags : ["(no tag)"]) byTag[t] = (byTag[t] ?? 0) + 1;
  }
  return { total: examples.length, students: new Set(examples.map((e) => e.student)).size, bySource, byTag };
}

export const toJsonl = (examples: CorpusExample[]) => examples.map((e) => JSON.stringify(e)).join("\n") + (examples.length ? "\n" : "");

const SOURCE_LABEL: Record<CorpusSource, string> = { inbox: "Inbox questions and replies", assignment: "Assignment feedback", survey: "Survey and form feedback" };

export function toMarkdown(examples: CorpusExample[], generatedAt: string): string {
  const s = corpusSummary(examples);
  const out = [
    "# Eve training corpus: Yvonne's feedback",
    "",
    `Generated ${generatedAt.slice(0, 10)} from the course data. ${s.total} examples from ${s.students} students. Names, emails, phone numbers and links are removed; each student has a code. Tags are suggestions from keywords, not rulings.`,
    "",
  ];
  for (const source of ["assignment", "survey", "inbox"] as CorpusSource[]) {
    const list = examples.filter((e) => e.source === source);
    if (!list.length) continue;
    out.push(`## ${SOURCE_LABEL[source]} (${list.length})`, "");
    for (const e of list) {
      const meta = [e.student, e.at.slice(0, 10), e.status, e.grade ? `grade ${e.grade}` : null, e.tags.length ? e.tags.join(", ") : null].filter(Boolean).join(" · ");
      out.push(`### ${e.task || "(no task)"}`, "", `*${meta}*`, "");
      out.push("**Student:**", "", e.input ? e.input.split("\n").map((l) => `> ${l}`).join("\n") : "> (nothing written)", "");
      out.push("**Yvonne:**", "", e.response + (e.feedback_file ? "\n\n*(A feedback file was also attached.)*" : ""), "", "---", "");
    }
  }
  return out.join("\n");
}
