"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { attemptCardStatus, attemptDisplayTitle, fetchExamAttempt, type ExamAttempt } from "@/lib/exam-attempts";
import { useStudentSession } from "@/lib/student-session";

type PaperStatus = { paper_id: string; title: string; status: "waiting" | "working" | "done" | "checking"; done: number; total: number };
type EvaluatorStatus =
  | { evaluator: "old" }
  | {
      evaluator: "v2";
      papers: PaperStatus[];
      all_done: boolean;
      released: boolean;
      report_url: string | null;
      report_kind?: "pdf" | "system" | null;
    };

function paperLine(p: PaperStatus): string {
  if (p.status === "done") return "Evaluated";
  if (p.status === "checking") return "Being checked by Yvonne";
  if (p.status === "working") return p.done ? `Working: ${p.done} of ${p.total} questions` : "Reading your pages";
  return "Waiting to start";
}

export default function ExamAttemptSubmitted() {
  const params = useParams<{ id: string }>();
  const { user } = useStudentSession();
  const attemptId = String(params.id || "");
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [status, setStatus] = useState<EvaluatorStatus | null>(null);

  useEffect(() => {
    if (!user?.id || !attemptId) return;
    fetchExamAttempt(user.id, attemptId).then((result) => {
      if (result.ok && result.attempt) setAttempt(result.attempt);
    });
    void fetch(`/api/exam-attempts/${attemptId}/prepare-evidence`, { method: "POST" });
  }, [user?.id, attemptId]);

  // Check progress now and every 30 seconds until the report is released (checking also keeps the work moving).
  useEffect(() => {
    if (!user?.id || !attemptId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function poll() {
      try {
        const response = await fetch(`/api/exam-attempts/${attemptId}/evaluator-status`, { cache: "no-store" });
        if (response.ok) {
          const next = (await response.json()) as EvaluatorStatus;
          if (stopped) return;
          setStatus(next);
          if (next.evaluator === "old" || next.released) return;
        }
      } catch {
        // try again on the next tick
      }
      if (!stopped) timer = setTimeout(poll, 30000);
    }
    void poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [user?.id, attemptId]);

  const v2 = status && status.evaluator === "v2" ? status : null;

  return (
    <article className="lesson-body wide eval-page">
      <p>
        <Link href="/student/evaluator">← Script evaluator</Link>
      </p>
      <p className="kicker">Exam attempt submitted</p>
      <h1>{v2?.released ? "Your report is ready" : "Your script is in!"}</h1>
      {attempt ? (
        <p className="muted">
          {attemptDisplayTitle(attempt)} · {v2?.released ? "Report available" : attemptCardStatus(attempt)}
        </p>
      ) : null}

      {v2 ? (
        <>
          {v2.released && v2.report_url ? (
            <section className="eval-report-ready">
              <div className="eval-report-thumb" aria-hidden="true">
                <iframe
                  src={v2.report_kind === "pdf" ? v2.report_url : `${v2.report_url}?embed=1`}
                  title="Report preview"
                  tabIndex={-1}
                  loading="lazy"
                />
                <a href={v2.report_url} tabIndex={-1} aria-label="Open your report" />
              </div>
              <div className="eval-report-actions">
                <h2>Your Script Evaluator report</h2>
                <p className="muted">
                  {v2.report_kind === "pdf"
                    ? "Your report is ready to open or download."
                    : "The Overall Report and one report per paper, in one document."}
                </p>
                <a className="primary" href={v2.report_url} target={v2.report_kind === "pdf" ? "_blank" : undefined} rel={v2.report_kind === "pdf" ? "noopener noreferrer" : undefined}>
                  Open your report
                </a>
                {v2.report_kind === "pdf" ? (
                  <a className="eval-secondary" href={v2.report_url} target="_blank" rel="noopener noreferrer" download>
                    Download PDF
                  </a>
                ) : (
                  <>
                    <a className="eval-secondary" href={`${v2.report_url}?print=1`}>
                      Download as PDF
                    </a>
                    <p className="muted small">Download opens the report and your browser&apos;s print window: choose Save as PDF.</p>
                  </>
                )}
              </div>
            </section>
          ) : (
            <>
              <p>
                {v2.papers.length
                  ? `We're evaluating each paper against the exam question, the official solution and your marking report.${
                      v2.all_done
                        ? " All three papers are done. Yvonne is checking your report before it is released, and you will get an email when it is ready."
                        : " This takes a while: you don't need to stay on this page. You'll get an email when your report is ready."
                    }`
                  : "Yvonne is preparing your report. You will get an email when it is ready."}
              </p>
              {v2.papers.length ? (
                <ul className="eval-attempt-list" style={{ listStyle: "none", padding: 0 }}>
                  {v2.papers.map((p) => (
                    <li key={p.paper_id} className="eval-attempt-card" style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <strong>{p.title}</strong>
                      <span className="pill">{paperLine(p)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </>
      ) : (
        <>
          <p>
            We&apos;re analysing your BMCR, exam scripts and marking report alongside the exam question, official solution
            and examiner information.
          </p>
          <p>Your report will be available once the analysis is complete.</p>
        </>
      )}

      {v2?.released ? null : <p>You don&apos;t need to wait here. You can return to the course and keep working.</p>}
      <div className="eval-confirm-actions">
        <Link className="primary" href="/student/dashboard">
          Return to course
        </Link>
      </div>
    </article>
  );
}
