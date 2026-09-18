"use client";

import Link from "next/link";
import EvaluatorExamPicker from "@/components/student/EvaluatorExamPicker";
import ScriptEvaluatorSteps from "@/components/student/ScriptEvaluatorSteps";
import { useEvaluatorExam } from "@/lib/use-evaluator-exam";

export default function ScriptEvaluatorHub() {
  const { exam } = useEvaluatorExam();

  return (
    <article className="lesson-body wide eval-page">
      <p>
        <Link href="/student/dashboard">← Student dashboard</Link>
      </p>
      <p className="kicker">Script evaluator</p>
      <h1>Diagnostic tools</h1>
      <p className="muted">
        Choose the exam you sat. That selection fills the BMCR tables, Volume vs Accuracy tables, Buried Treasure caps, and the AI mark report.
      </p>
      <EvaluatorExamPicker />
      {exam ? (
        <>
          <p className="waiting">
            Loaded {exam.label}: {exam.papers.map((paper) => paper.title).join(" · ")}.
          </p>
          <ScriptEvaluatorSteps />
        </>
      ) : (
        <p className="notice">Select an exam to open the diagnostic tools for that sitting.</p>
      )}
    </article>
  );
}
