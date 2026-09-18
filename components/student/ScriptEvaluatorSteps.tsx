"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchOwnDiagnosticProgress, type DiagnosticProgress } from "@/lib/diagnostic-progress";
import { useStudentSession } from "@/lib/student-session";

const EMPTY: DiagnosticProgress = {
  hasBmcr: false,
  hasVolume: false,
  hasBuriedTreasure: false,
  hasMarkReport: false,
  markReport: null,
  ready: false,
};

export default function ScriptEvaluatorSteps() {
  const { user } = useStudentSession();
  const [progress, setProgress] = useState<DiagnosticProgress>(EMPTY);

  useEffect(() => {
    if (!user?.id) return;
    fetchOwnDiagnosticProgress(user.id).then(setProgress);
  }, [user?.id]);

  return (
    <ol className="eval-hub-steps" aria-label="Script evaluator steps">
      <li className="eval-hub-step">
        <span className="eval-hub-step-num">1</span>
        <Link href="/student/bmcr" className="primary">
          The BMCR Tool
        </Link>
        <div className="eval-hub-step-copy">
          {progress.hasBmcr ? <span className="pill">Done</span> : <span className="muted small">To do</span>}
          <p>
            Capture your question-by-question marks for a paper, then interpret the paper as a whole and answer the theory questions.
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
            Fill Points Wrote and Marks You Got for every section of a paper. Calculation questions are N/A for volume so they do not skew the ratios.
          </p>
        </div>
      </li>
      <li className="eval-hub-step">
        <span className="eval-hub-step-num">3</span>
        <Link href="/student/buried-treasure" className="primary">
          Buried Treasure
        </Link>
        <div className="eval-hub-step-copy">
          {progress.hasBuriedTreasure ? <span className="pill">Done</span> : <span className="muted small">To do</span>}
          <p>
            Measure how effectively you extract value from the case study across Direct, Indirect, and Thinking marks.
          </p>
        </div>
      </li>
      <li className="eval-hub-step">
        <span className="eval-hub-step-num">4</span>
        <Link href="/student/evaluator/report" className="primary">
          AI Mark Report Evaluation
        </Link>
        <div className="eval-hub-step-copy">
          {progress.ready ? <span className="pill">Ready</span> : <span className="muted small">Locked until steps 1–3 plus your upload are complete</span>}
          <p>
            Upload your marked script and generate the first-person diagnostic. The report will not run until BMCR, Volume vs Accuracy, Buried Treasure, and your mark report are all in.
          </p>
        </div>
      </li>
    </ol>
  );
}
