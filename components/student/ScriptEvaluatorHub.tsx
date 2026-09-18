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
        Work through the steps in order. Complete the BMCR Tool and Volume vs Accuracy, then upload your mark report. The AI evaluation unlocks only after all three are done.
      </p>
      <ol className="eval-hub-steps" aria-label="Script evaluator steps">
        <li className="eval-hub-step">
          <span className="eval-hub-step-num">1</span>
          <Link href="/student/bmcr" className="primary">
            The BMCR Tool
          </Link>
          <div className="eval-hub-step-copy">
            {progress.hasBmcr ? <span className="pill">Done</span> : <span className="muted small">To do</span>}
            <p>
              Capture your question-by-question marks against the June 2026 IAC sections. This shows how much of the knowledge you already have you actually converted into marks.
            </p>
          </div>
        </li>
        <li className="eval-hub-step">
          <span className="eval-hub-step-num">2</span>
          <Link href="/student/volume-accuracy" className="primary">
            Volume vs Accuracy
          </Link>
          <div className="eval-hub-step-copy">
            {progress.hasVolume ? <span className="pill">Done</span> : <span className="muted small">To do</span>}
            <p>
              Log Total Marks, points attempted, and marks earned for a section. Volume, accuracy, and score conversion show whether you under-attempted or wrote inaccurately.
            </p>
          </div>
        </li>
        <li className="eval-hub-step">
          <span className="eval-hub-step-num">3</span>
          <Link href="/student/evaluator/report" className="primary">
            AI Mark Report Evaluation
          </Link>
          <div className="eval-hub-step-copy">
            {progress.ready ? <span className="pill">Ready</span> : <span className="muted small">Locked until steps 1 and 2 plus your upload are complete</span>}
            <p>
              Upload your marked script and generate the first-person Tier 1 vs Tier 2 diagnostic. The report will not run until BMCR, Volume vs Accuracy, and your mark report are all in.
            </p>
          </div>
        </li>
      </ol>
    </article>
  );
}
