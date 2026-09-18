"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useEvaluatorExam } from "@/lib/use-evaluator-exam";

export default function EvaluatorExamHeading({
  tool,
  description,
}: {
  tool: string;
  description?: string;
}) {
  const router = useRouter();
  const { exam, href, ready } = useEvaluatorExam();

  useEffect(() => {
    if (ready && !exam) router.replace("/student/evaluator");
  }, [exam, ready, router]);

  if (!ready || !exam) {
    return (
      <>
        <p>
          <Link href="/student/evaluator">← Script evaluator</Link>
        </p>
        <p className="muted">Loading exam…</p>
      </>
    );
  }

  return (
    <>
      <p>
        <Link href={href("/student/evaluator")}>← Script evaluator</Link>
      </p>
      <p className="kicker">Script evaluator</p>
      <p className="eval-exam-title">{exam.label}</p>
      <h1>{tool}</h1>
      {description ? <p className="muted">{description}</p> : null}
    </>
  );
}
