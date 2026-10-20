import Link from "next/link";
import { headers } from "next/headers";
import { after } from "next/server";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import { getEvaluatorMode, kickPendingJobs, type EvaluatorJob } from "@/lib/evaluator/jobs";
import { EVALUATOR_READY_SITTINGS } from "@/lib/evaluator/ready-sittings";
import { PAPER_NAMES } from "@/lib/evaluator/report-text";
import { findPastPaper } from "@/lib/past-papers";
import { profileDisplayName } from "@/lib/profiles";
import { getServiceSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MODE_TEXT = {
  off: "Off: every submission uses the old evaluator.",
  staff: "Staff only: your own test submissions use the new evaluator; students still get the old one.",
  all: "Everyone: every June 2026 whole-sitting submission uses the new evaluator.",
} as const;

type AttemptRow = { id: string; user_id: string; sitting_label: string; submitted_at: string | null; evaluator_report_released_at: string | null };

function paperStatus(job: EvaluatorJob | undefined): string {
  if (!job) return "not started";
  const total = findPastPaper(job.paper_id)?.paper.questions.length ?? 0;
  const done = Object.keys((job.progress as { evaluations?: object })?.evaluations ?? {}).length;
  if (job.status === "done") return "done";
  if (job.status === "failed") return `stopped (${job.failures} tries)`;
  if (job.step === "stage0") return job.status === "queued" ? "waiting" : "reading pages";
  return `${done} of ${total} questions`;
}

/**
 * Staff review list for the new Script Evaluator: progress per paper, open the report, release it to the student,
 * retry a stopped paper, and the on/off switch.
 */
export default async function CoachEvaluatorPage() {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return <div className="coach-page"><p>Staff only.</p></div>;
  const supabase = getServiceSupabase();
  if (!supabase) return <div className="coach-page"><p>The server is missing its Supabase service key.</p></div>;

  const mode = await getEvaluatorMode();
  const { data: jobRows, error } = await supabase.from("evaluator_jobs").select("*").order("created_at", { ascending: false }).limit(150);
  const jobs = (jobRows ?? []) as EvaluatorJob[];
  const attemptIds = [...new Set(jobs.map((j) => j.attempt_id))];
  const { data: attemptRows } = attemptIds.length
    ? await supabase.from("exam_attempts").select("id, user_id, sitting_label, submitted_at, evaluator_report_released_at").in("id", attemptIds)
    : { data: [] };
  const attempts = (attemptRows ?? []) as AttemptRow[];
  const userIds = [...new Set(attempts.map((a) => a.user_id))];
  const { data: profileRows } = userIds.length ? await supabase.from("profiles").select("id, email, full_name").in("id", userIds) : { data: [] };
  const names = new Map(((profileRows ?? []) as { id: string; email: string; full_name: string | null }[]).map((p) => [p.id, profileDisplayName(p.email, p.full_name)]));
  const paperIds = [...new Set(jobs.map((j) => j.paper_id))].sort();

  // Submitted whole-sitting attempts for evaluator-ready sittings that have not been through the new evaluator yet
  // (for example submitted before it existed, or by an account the switch did not cover). Staff can start them by hand.
  const { data: waitingRows } = await supabase
    .from("exam_attempts")
    .select("id, user_id, sitting_id, sitting_label, submitted_at, marked_script_p2_path, status")
    .in("sitting_id", [...EVALUATOR_READY_SITTINGS])
    .not("marked_script_p2_path", "is", null)
    .in("status", ["analysing", "evidence_ready", "report_ready", "analysis_failed"])
    .order("created_at", { ascending: false })
    .limit(30);
  const waiting = ((waitingRows ?? []) as (AttemptRow & { sitting_id: string })[]).filter((a) => !attemptIds.includes(a.id));
  const waitingUserIds = [...new Set(waiting.map((a) => a.user_id))].filter((id) => !userIds.includes(id));
  if (waitingUserIds.length) {
    const { data: more } = await supabase.from("profiles").select("id, email, full_name").in("id", waitingUserIds);
    for (const p of (more ?? []) as { id: string; email: string; full_name: string | null }[]) names.set(p.id, profileDisplayName(p.email, p.full_name));
  }

  // Opening this page also restarts any paper whose work has stalled.
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const stalled = [...new Set(jobs.filter((j) => j.status === "queued" || j.status === "running").map((j) => j.attempt_id))];
  if (stalled.length) after(() => Promise.all(stalled.map((id) => kickPendingJobs(id, origin).catch(() => undefined))));

  const cell = { border: "1px solid #ccc", padding: "6px 8px", verticalAlign: "top" as const, fontSize: 14 };
  return (
    <div className="coach-page">
      <p><Link href="/coach">← Coach home</Link></p>
      <h1>Script Evaluator reports</h1>
      <p className="muted">Each submission is evaluated paper by paper in the background. Students only see the report once you release it.</p>

      <section className="card" style={{ padding: 16, margin: "16px 0" }}>
        <h3 style={{ marginTop: 0 }}>Who uses the new evaluator</h3>
        <p><strong>Now:</strong> {MODE_TEXT[mode]}</p>
        <form method="post" action="/api/evaluator/review" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input type="hidden" name="action" value="mode" />
          {(["off", "staff", "all"] as const).map((m) => (
            <button key={m} type="submit" name="mode" value={m} className={m === mode ? "primary" : "ghost"} disabled={m === mode}>
              {m === "off" ? "Off" : m === "staff" ? "Staff only" : "Everyone"}
            </button>
          ))}
        </form>
      </section>

      {error ? <p className="notice">Could not read the evaluator jobs: {error.message}. Paste supabase/evaluator-jobs.sql in the Supabase SQL editor.</p> : null}
      {!error && !attempts.length ? <p className="muted">No submissions have gone through the new evaluator yet.</p> : null}

      {attempts.length ? (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {["Student", "Submitted", ...paperIds.map((p) => PAPER_NAMES[p] ?? p), "Report", ""].map((h) => (
                <th key={h} style={{ ...cell, textAlign: "left", background: "#f2f2f2" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {attempts
              .sort((a, b) => (b.submitted_at ?? "").localeCompare(a.submitted_at ?? ""))
              .map((a) => {
                const mine = jobs.filter((j) => j.attempt_id === a.id);
                const allDone = mine.length > 0 && mine.every((j) => j.status === "done");
                return (
                  <tr key={a.id}>
                    <td style={cell}>{names.get(a.user_id) ?? "Student"}<br /><span className="muted small">{a.sitting_label}</span></td>
                    <td style={cell}>{a.submitted_at ? new Date(a.submitted_at).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" }) : "-"}</td>
                    {paperIds.map((p) => {
                      const job = mine.find((j) => j.paper_id === p);
                      return (
                        <td key={p} style={cell}>
                          {paperStatus(job)}
                          {job?.status === "failed" ? (
                            <form method="post" action="/api/evaluator/review" style={{ marginTop: 4 }}>
                              <input type="hidden" name="action" value="retry" />
                              <input type="hidden" name="job_id" value={job.id} />
                              <button type="submit" className="ghost">Retry</button>
                              {job.last_error ? <div className="muted small" style={{ maxWidth: 220 }}>{job.last_error.slice(0, 200)}</div> : null}
                            </form>
                          ) : null}
                        </td>
                      );
                    })}
                    <td style={cell}>
                      {allDone ? <Link href={`/evaluator-report/${a.id}`}>Open report</Link> : <span className="muted">not ready</span>}
                      <br />
                      <span className="muted small">{a.evaluator_report_released_at ? "Released" : allDone ? "Waiting for you" : ""}</span>
                    </td>
                    <td style={cell}>
                      {allDone ? (
                        <form method="post" action="/api/evaluator/review">
                          <input type="hidden" name="attempt_id" value={a.id} />
                          <input type="hidden" name="action" value={a.evaluator_report_released_at ? "unrelease" : "release"} />
                          <button type="submit" className={a.evaluator_report_released_at ? "ghost" : "primary"}>
                            {a.evaluator_report_released_at ? "Hide from student" : "Release to student"}
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      ) : null}

      {waiting.length ? (
        <section style={{ marginTop: 28 }}>
          <h3>Submitted, not on the new evaluator yet</h3>
          <p className="muted">Starting one runs all three papers and uses Anthropic credit (about the same as three calibration runs).</p>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <tbody>
              {waiting.map((a) => (
                <tr key={a.id}>
                  <td style={cell}>{names.get(a.user_id) ?? "Student"}<br /><span className="muted small">{a.sitting_label}</span></td>
                  <td style={cell}>{a.submitted_at ? new Date(a.submitted_at).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" }) : "-"}</td>
                  <td style={cell}>
                    <form method="post" action="/api/evaluator/review">
                      <input type="hidden" name="action" value="start" />
                      <input type="hidden" name="attempt_id" value={a.id} />
                      <button type="submit" className="primary">Start the new evaluator</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
