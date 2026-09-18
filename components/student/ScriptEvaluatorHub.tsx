"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchOwnDiagnosticProgress, type DiagnosticProgress } from "@/lib/diagnostic-progress";
import { useStudentSession } from "@/lib/student-session";

const EMPTY: DiagnosticProgress = {
  hasBmcr: false,
  hasVolume: false,
  hasMarkReport: false,
  markReport: null,
  ready: false,
};

export default function ScriptEvaluatorHub() {
  const { user } = useStudentSession();
  const [progress, setProgress] = useState<DiagnosticProgress>(EMPTY);

  useEffect(() => {
    if (!user?.id) return;
    fetchOwnDiagnosticProgress(user.id).then(setProgress);
  }, [user?.id]);

  return (
    <article className="lesson-body wide eval-page">
      <p className="kicker">Script evaluator</p>
      <h1>Diagnostic tools</h1>
      <p className="muted">
        Complete the BMCR Tool and Volume vs Accuracy, then upload your mark report. The AI evaluation unlocks only after all three are done.
      </p>
      <nav className="eval-hub-grid" aria-label="Script evaluator steps">
        <Link href="/student/bmcr" className="student-hub-card">
          <strong>The BMCR Tool</strong>
          {progress.hasBmcr ? <span className="pill">Done</span> : <span className="muted small">To do</span>}
          <p>
            Capture your question-by-question marks against the June 2026 IAC sections. This shows how much of the knowledge you already have you actually converted into marks.
          </p>
        </Link>
        <Link href="/student/volume-accuracy" className="student-hub-card">
          <strong>Volume vs Accuracy</strong>
          {progress.hasVolume ? <span className="pill">Done</span> : <span className="muted small">To do</span>}
          <p>
            Log a timed attempt: how much of the paper you finished, how accurate those answers were, and whether time pressure cost you marks.
          </p>
        </Link>
        <Link href="/student/evaluator/report" className="student-hub-card">
          <strong>AI Mark Report Evaluation</strong>
          {progress.ready ? <span className="pill">Ready</span> : <span className="muted small">Locked until the steps above plus your upload are complete</span>}
          <p>
            Upload your marked script and generate the first-person Tier 1 vs Tier 2 diagnostic. The report will not run until BMCR, Volume vs Accuracy, and your mark report are all in.
          </p>
        </Link>
      </nav>
    </article>
  );
}
