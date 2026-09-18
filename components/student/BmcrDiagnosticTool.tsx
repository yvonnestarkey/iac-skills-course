"use client";

import { useState } from "react";
import BmcrCalculator from "@/components/lesson/BmcrCalculator";
import {
  EMPTY_BMCR_VALUE,
  computeBmcrPct,
  formatPct,
  saveBmcrEvaluation,
  type BmcrValue,
} from "@/lib/bmcr";
import { useStudentSession } from "@/lib/student-session";

function diagnosticAssignmentId(paper: string, question: string): string {
  const slug = `${paper}:${question}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `diagnostic:${slug || "standalone"}`;
}

export default function BmcrDiagnosticTool() {
  const { user } = useStudentSession();
  const [paperName, setPaperName] = useState("");
  const [questionCode, setQuestionCode] = useState("");
  const [notes, setNotes] = useState("");
  const [bmcr, setBmcr] = useState<BmcrValue>(EMPTY_BMCR_VALUE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const submit = async () => {
    if (!user?.id) return;
    setBusy(true);
    setError("");
    setSaved("");
    const result = await saveBmcrEvaluation({
      studentId: user.id,
      assignmentId: diagnosticAssignmentId(paperName, questionCode),
      marks: bmcr,
      key_takeaways: [paperName && `Paper: ${paperName}`, questionCode && `Question: ${questionCode}`, notes]
        .filter(Boolean)
        .join(" · "),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error || "Could not save the BMCR.");
      return;
    }
    setSaved(`Saved. BMCR conversion ${formatPct(computeBmcrPct(bmcr))}.`);
  };

  return (
    <article className="lesson-body wide eval-page">
      <p className="kicker">Pre-exam diagnostic</p>
      <h1>BMCR</h1>
      <p className="muted">Basic Mark Capture Record. Input and categorize your question-by-question marks.</p>
      <form
        className="eval-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label>
          Paper name
          <input type="text" value={paperName} onChange={(event) => setPaperName(event.target.value)} placeholder="e.g. IAC Paper 1" required />
        </label>
        <label>
          Question code
          <input type="text" value={questionCode} onChange={(event) => setQuestionCode(event.target.value)} placeholder="e.g. Q2.1" required />
        </label>
        <BmcrCalculator value={bmcr} onChange={setBmcr} idPrefix="diag-bmcr" />
        <label className="eval-notes">
          Notes
          <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What leaked on this question?" />
        </label>
        {error ? <p className="notice">{error}</p> : null}
        {saved ? <p className="waiting">{saved}</p> : null}
        <div className="actions">
          <button className="primary" type="submit" disabled={busy || !user?.id}>
            {busy ? "Saving…" : "Save BMCR"}
          </button>
        </div>
      </form>
    </article>
  );
}
