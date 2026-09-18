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
      <h1>{exam ? exam.label : "Diagnostic tools"}</h1>
      <p className="muted">
        Choose the exam you sat. Every tool in this session uses that sitting. To evaluate a different exam, come back here and change it before you start the tools.
      </p>
      <EvaluatorExamPicker />
      {exam ? (
        <>
          <p className="muted small">
            {exam.papers.map((paper) => paper.title).join(" · ")}
          </p>
          <ScriptEvaluatorSteps />
        </>
      ) : (
        <p className="notice">Select an exam to open the diagnostic tools for that sitting.</p>
      )}
    </article>
  );
}
