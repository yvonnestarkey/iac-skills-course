import Link from "next/link";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import { corpusSummary, type CorpusSource } from "@/lib/eve-training/corpus";
import { loadTrainingCorpus } from "@/lib/eve-training/load";
import { getServiceSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<CorpusSource, string> = {
  assignment: "Assignment feedback",
  survey: "Survey and form feedback",
  inbox: "Inbox replies",
};

/** Eve training corpus: everything Yvonne has written to students in the course, anonymised and paired with what the student sent. */
export default async function EveTrainingPage() {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return <div className="coach-page"><p>Coach access only.</p></div>;
  const client = getServiceSupabase();
  if (!client) return <div className="coach-page"><p>The database is not configured.</p></div>;

  const { examples, warnings, excludedStudents } = await loadTrainingCorpus(client);
  const s = corpusSummary(examples);
  const tags = Object.entries(s.byTag).sort((a, b) => b[1] - a[1]);
  const recent = examples.slice(0, 8);

  return (
    <div className="coach-page">
      <Link className="back-link" href="/coach">← Coach tools</Link>
      <p className="kicker">Eve training</p>
      <h1>Your feedback, as training data</h1>
      <p className="muted">
        Every comment you have written to students in the course, paired with what the student sent, with names, emails,
        phone numbers and links removed. It is built fresh each time you open this page, so it is always up to date.
        Staff and test accounts are left out{excludedStudents ? ` (${excludedStudents} accounts)` : ""}.
      </p>

      <div className="people hub-choices" style={{ marginTop: 16 }}>
        <a href="/api/coach/eve-training?format=jsonl">
          <strong>Download for Eve (JSONL)</strong>
          <span className="muted">One example per line, for seeding Supabase and testing Eve</span>
        </a>
        <a href="/api/coach/eve-training?format=md">
          <strong>Download to read (Markdown)</strong>
          <span className="muted">Grouped by source, for Obsidian or a Claude chat</span>
        </a>
      </div>

      <h3 style={{ marginTop: 24 }}>What is in it</h3>
      <p>
        <strong>{s.total}</strong> examples from <strong>{s.students}</strong> students:{" "}
        {(Object.keys(SOURCE_LABEL) as CorpusSource[]).map((k) => `${SOURCE_LABEL[k]} ${s.bySource[k] ?? 0}`).join(" · ")}
      </p>
      <p className="muted small">Suggested tags (from keywords in your wording, not rulings):</p>
      <p>{tags.map(([t, n]) => `${t} ${n}`).join(" · ") || "None yet"}</p>

      {warnings.length > 0 && (
        <p className="muted small">Some data could not be read: {warnings.join("; ")}</p>
      )}

      <h3 style={{ marginTop: 24 }}>Most recent</h3>
      {recent.length === 0 && <p className="muted">No written feedback found yet.</p>}
      {recent.map((e) => (
        <section key={e.id} className="card" style={{ marginBottom: 12 }}>
          <p className="muted small">
            {SOURCE_LABEL[e.source]} · {e.task || "(no task)"} · {e.student} · {e.at.slice(0, 10)}
            {e.tags.length ? ` · ${e.tags.join(", ")}` : ""}
          </p>
          <p className="small"><strong>Student:</strong> {e.input ? (e.input.length > 300 ? `${e.input.slice(0, 300)}…` : e.input) : "(nothing written)"}</p>
          <p className="small" style={{ whiteSpace: "pre-wrap" }}><strong>You:</strong> {e.response}</p>
        </section>
      ))}
    </div>
  );
}
