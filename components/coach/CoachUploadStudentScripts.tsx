"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EXAM_ATTEMPT_FILE_KINDS,
  EXAM_ATTEMPT_FILE_LABELS,
  EXAM_ATTEMPT_SCRIPT_KINDS,
  EXAM_SCRIPT_ONCE_WARNING,
  EXAM_SCRIPT_SCAN_NOTE,
  attemptHasAllRequiredFiles,
  attemptHasFile,
  attemptScriptSlotLocked,
  isAttemptSubmitted,
  type ExamAttempt,
  type ExamAttemptFileKind,
} from "@/lib/exam-attempts";
import { isEvaluatorReadySitting } from "@/lib/evaluator/ready-sittings";
import { PAST_PAPER_SITTINGS } from "@/lib/past-papers";
import { renderPdfPageImages } from "@/lib/pdf-page-images";
import { fetchRosterStudents } from "@/lib/profiles";
import type { Student } from "@/lib/types";

const SITTINGS = PAST_PAPER_SITTINGS.filter((item) => isEvaluatorReadySitting(item.id));

function fileName(attempt: ExamAttempt, kind: ExamAttemptFileKind): string {
  return String(attempt[`${kind}_name`] || "").trim();
}

export default function CoachUploadStudentScripts() {
  const [students, setStudents] = useState<Student[]>([]);
  const [query, setQuery] = useState("");
  const [studentId, setStudentId] = useState("");
  const [sittingId, setSittingId] = useState(SITTINGS[0]?.id || "");
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyKind, setBusyKind] = useState<ExamAttemptFileKind | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchRosterStudents().then((result) => {
      if (cancelled) return;
      setStudents(result.students || []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = students.filter((student) => student.accessActive !== false);
    if (!needle) return list.slice(0, 40);
    return list
      .filter((student) => `${student.name} ${student.email}`.toLowerCase().includes(needle))
      .slice(0, 40);
  }, [students, query]);

  const selected = students.find((student) => student.id === studentId) || null;

  async function startAttempt() {
    if (!studentId || !sittingId) return;
    setBusy(true);
    setError("");
    setNotice("");
    const response = await fetch("/api/coach/evaluator/student-scripts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "create", studentId, sittingId }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string; attempt?: ExamAttempt };
    setBusy(false);
    if (!response.ok || !payload.attempt) {
      setError(payload.error || "Could not start that attempt.");
      return;
    }
    setAttempt(payload.attempt);
    if (isAttemptSubmitted(payload.attempt.status)) {
      setNotice("This student already submitted that sitting. You can still open their files on the list below.");
    }
  }

  async function onUpload(kind: ExamAttemptFileKind, file: File | undefined) {
    if (!file || !attempt) return;
    if (attemptScriptSlotLocked(attempt, kind)) {
      setError("This paper is already uploaded. You can only submit each exam script once.");
      return;
    }
    setBusyKind(kind);
    setError("");
    const form = new FormData();
    form.set("studentId", attempt.user_id);
    form.set("attemptId", attempt.id);
    form.set("kind", kind);
    form.set("file", file);
    try {
      const pages = await renderPdfPageImages(file);
      for (const page of pages) form.set(`page_${page.page}`, page.blob, `p${page.page}.jpg`);
    } catch {
      /* Evidence prep can still read the stored PDF. */
    }
    const response = await fetch("/api/coach/evaluator/student-scripts", { method: "POST", body: form });
    const payload = (await response.json().catch(() => ({}))) as { error?: string; attempt?: ExamAttempt };
    setBusyKind(null);
    if (!response.ok || !payload.attempt) {
      setError(payload.error || "Could not upload that PDF.");
      return;
    }
    setAttempt(payload.attempt);
  }

  async function onSubmit() {
    if (!attempt) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/coach/evaluator/student-scripts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "submit", studentId: attempt.user_id, attemptId: attempt.id }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error || "Could not submit that attempt.");
      return;
    }
    setNotice("Submitted. It is stored on the student’s Script Evaluator, same as if they uploaded it.");
    setAttempt(null);
  }

  const ready = attempt ? attemptHasAllRequiredFiles(attempt) : false;
  const submitted = attempt ? isAttemptSubmitted(attempt.status) : false;
  const scriptsReady = attempt ? EXAM_ATTEMPT_SCRIPT_KINDS.every((kind) => attemptHasFile(attempt, kind)) : false;

  return (
    <section className="card" style={{ padding: 16, margin: "16px 0" }}>
      <h3 style={{ marginTop: 0 }}>Upload a student’s scripts</h3>
      <p className="muted">
        When a student emails you their PDFs, upload them here. They are stored on that student’s exam attempt — same
        folders, same Script Evaluator path, same one-upload-per-paper rule.
      </p>

      <div className="coaching-manual-form">
        <label className="student-notes-label" htmlFor="eval-student-search">
          Student
        </label>
        <input
          id="eval-student-search"
          className="select-line"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name or email"
          disabled={busy}
        />
        <select
          className="select-line"
          value={studentId}
          onChange={(event) => {
            setStudentId(event.target.value);
            setAttempt(null);
            setNotice("");
          }}
          disabled={busy}
        >
          <option value="">Choose a student</option>
          {filtered.map((student) => (
            <option key={student.id} value={student.id}>
              {student.name} · {student.email}
            </option>
          ))}
        </select>
        <label className="student-notes-label" htmlFor="eval-sitting">
          Sitting
        </label>
        <select
          id="eval-sitting"
          className="select-line"
          value={sittingId}
          onChange={(event) => {
            setSittingId(event.target.value);
            setAttempt(null);
            setNotice("");
          }}
          disabled={busy}
        >
          {SITTINGS.map((sitting) => (
            <option key={sitting.id} value={sitting.id}>
              {sitting.label.replace(/ IAC Exam$/i, "")}
            </option>
          ))}
        </select>
        <p className="coaching-actions">
          <button type="button" className="primary" disabled={busy || !studentId || !sittingId} onClick={() => void startAttempt()}>
            {busy ? "Opening…" : "Open their attempt"}
          </button>
        </p>
      </div>

      {selected && attempt ? (
        <div className="eval-upload-block" style={{ marginTop: 16 }}>
          <p>
            <strong>{selected.name}</strong>
            <span className="muted"> · {attempt.sitting_label}</span>
          </p>
          <p>
            <strong>{EXAM_SCRIPT_ONCE_WARNING}</strong>
          </p>
          {submitted ? (
            <p className="muted">This sitting is already submitted.</p>
          ) : (
            <>
              <p className="muted small">{EXAM_SCRIPT_SCAN_NOTE}</p>
              <div className="eval-upload-grid">
                {EXAM_ATTEMPT_FILE_KINDS.map((kind) => {
                  const locked = attemptScriptSlotLocked(attempt, kind);
                  const group = EXAM_ATTEMPT_SCRIPT_KINDS.includes(kind);
                  return (
                    <label
                      key={kind}
                      className={`eval-upload-card${attemptHasFile(attempt, kind) || (group && scriptsReady) ? " is-ready" : ""}`}
                    >
                      <strong>{EXAM_ATTEMPT_FILE_LABELS[kind]}</strong>
                      {locked ? (
                        <p className="muted small">Uploaded — this paper cannot be replaced.</p>
                      ) : (
                        <input
                          className="select-line"
                          type="file"
                          accept="application/pdf,.pdf"
                          disabled={Boolean(busyKind) || busy}
                          onChange={(event) => {
                            const next = event.target.files?.[0];
                            event.target.value = "";
                            void onUpload(kind, next);
                          }}
                        />
                      )}
                      <p className="muted small eval-upload-filename">
                        {busyKind === kind ? "Uploading…" : fileName(attempt, kind) || "PDF required"}
                      </p>
                    </label>
                  );
                })}
              </div>
              <p className="coaching-actions">
                <button type="button" className="primary" disabled={!ready || busy} onClick={() => void onSubmit()}>
                  {busy ? "Submitting…" : "Submit as this student"}
                </button>
              </p>
              {!ready ? (
                <p className="muted small">
                  Submit unlocks when the BMCR, all three papers, and the marking report are attached.
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {error ? <p className="notice">{error}</p> : null}
      {notice ? <p className="muted">{notice}</p> : null}
    </section>
  );
}
