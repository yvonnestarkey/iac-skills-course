"use client";

import { useEffect, useState } from "react";
import { formatSastDateTime } from "@/lib/dates";
import {
  attemptCardStatus,
  attemptDisplayTitle,
  attemptUploadedFiles,
  fetchOwnExamAttempts,
  type ExamAttempt,
} from "@/lib/exam-attempts";

export default function ScriptEvaluationsPanel({ studentId }: { studentId: string }) {
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchOwnExamAttempts(studentId).then((result) => {
      if (cancelled) return;
      if (result.ok === false) {
        setAttempts([]);
        setError(result.error);
        setLoading(false);
        return;
      }
      setAttempts(result.attempts.filter((attempt) => attemptUploadedFiles(attempt).length > 0));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  return (
    <section className="card">
      <h2>Script Evaluations</h2>
      {loading ? <p className="empty">Loading script evaluations…</p> : null}
      {!loading && error ? <p className="notice">{error}</p> : null}
      {!loading && !error && !attempts.length ? (
        <p className="empty">No script evaluation PDFs uploaded yet.</p>
      ) : null}
      {!loading && attempts.length ? (
        <div className="work-list">
          {attempts.map((attempt) => {
            const files = attemptUploadedFiles(attempt);
            const when = attempt.submitted_at || attempt.updated_at || attempt.created_at;
            return (
              <div className="work-item" key={attempt.id}>
                <div className="work-head">
                  <strong>{attemptDisplayTitle(attempt)}</strong>
                  <span className="muted small">
                    {attemptCardStatus(attempt)}
                    {when ? ` · ${formatSastDateTime(when)}` : ""}
                  </span>
                </div>
                <ul className="script-eval-files">
                  {files.map((file) => (
                    <li key={file.kind}>
                      <a href={file.url} target="_blank" rel="noopener noreferrer" download={file.name}>
                        Download {file.label}
                      </a>
                      <span className="muted small"> ({file.name})</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
