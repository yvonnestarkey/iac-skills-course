"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DiagnosticReportCard from "@/components/DiagnosticReportCard";
import BuriedTreasureReportCard from "@/components/BuriedTreasureReportCard";
import EvaluatorExamPicker from "@/components/student/EvaluatorExamPicker";
import { fetchOwnEvaluations, pct } from "@/lib/script-evaluation";
import type { DiagnosticReportResult } from "@/lib/diagnostic-report";
import type { BuriedTreasureAnalysis } from "@/types/evaluation";
import {
  fetchOwnDiagnosticProgress,
  uploadMarkReport,
  type DiagnosticProgress,
} from "@/lib/diagnostic-progress";
import {
  draftsFromPastPaper,
  knowledgeApplicationCaps,
  pastPaperDisplayName,
  type PastPaper,
  type PastPaperDraft,
  type PastPaperSitting,
} from "@/lib/past-papers";
import { useEvaluatorExam } from "@/lib/use-evaluator-exam";
import { useStudentSession } from "@/lib/student-session";

function paperOrDefault(sitting: PastPaperSitting, paperId: string): PastPaper {
  return sitting.papers.find((item) => item.id === paperId) || sitting.papers[0];
}

function clampToCap(value: string, cap: number): string {
  if (value === "") return "";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return String(Math.max(0, Math.min(numeric, cap)));
}

export default function ScriptEvaluator() {
  const { user } = useStudentSession();
  const { sitting, href } = useEvaluatorExam();
  const [paperId, setPaperId] = useState("");
  const [studentNotes, setStudentNotes] = useState("");
  const [questions, setQuestions] = useState<PastPaperDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<DiagnosticReportResult | null>(null);
  const [evaluation, setEvaluation] = useState<BuriedTreasureAnalysis | null>(null);
  const [history, setHistory] = useState<DiagnosticReportResult[]>([]);
  const [progress, setProgress] = useState<DiagnosticProgress>({
    hasBmcr: false,
    hasVolume: false,
    hasBuriedTreasure: false,
    hasMarkReport: false,
    markReport: null,
    ready: false,
  });

  const paper = sitting ? paperOrDefault(sitting, paperId) : null;
  const paperName = sitting && paper ? pastPaperDisplayName(sitting, paper) : "";

  useEffect(() => {
    if (!sitting) {
      setPaperId("");
      setQuestions([]);
      setEvaluation(null);
      setReport(null);
      return;
    }
    const nextPaper = paperOrDefault(sitting, paperId);
    setPaperId(nextPaper.id);
    setQuestions(draftsFromPastPaper(nextPaper));
    setEvaluation(null);
    setReport(null);
    setError("");
  }, [sitting?.id]);

  useEffect(() => {
    if (!user?.id) return;
    fetchOwnEvaluations(user.id).then(setHistory);
    fetchOwnDiagnosticProgress(user.id).then(setProgress);
  }, [user?.id]);

  const canSubmit = useMemo(() => {
    return Boolean(progress.ready && paperName && questions.length && !busy);
  }, [progress.ready, paperName, questions, busy]);

  const selectPaper = (nextPaperId: string) => {
    if (!sitting) return;
    const nextPaper = paperOrDefault(sitting, nextPaperId);
    setPaperId(nextPaper.id);
    setQuestions(draftsFromPastPaper(nextPaper));
    setEvaluation(null);
    setReport(null);
    setError("");
  };

  const setEarned = (code: string, key: "direct_earned" | "indirect_earned" | "thinking_earned", value: string) => {
    const mapped = paper?.questions.find((item) => item.code === code);
    const cap =
      key === "direct_earned"
        ? mapped?.direct_available
        : key === "indirect_earned"
          ? mapped?.indirect_available
          : mapped?.thinking_available;
    const nextValue = cap != null ? clampToCap(value, cap) : value;
    setQuestions((prev) => prev.map((row) => (row.question_code === code ? { ...row, [key]: nextValue } : row)));
  };

  const onUpload = async (file: File | undefined) => {
    if (!file || !user?.id) return;
    setUploading(true);
    setError("");
    const result = await uploadMarkReport(user.id, file, paperName);
    setUploading(false);
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    fetchOwnDiagnosticProgress(user.id).then(setProgress);
  };

  const run = async () => {
    if (!progress.ready || !paper) {
      setError(
        paper
          ? "Complete the BMCR Tool, Volume vs Accuracy, Buried Treasure, and upload your mark report before generating the AI evaluation."
          : "Select an exam to generate the diagnostic."
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payloadQuestions = questions.map((row) => {
        const mapped = paper.questions.find((item) => item.code === row.question_code);
        const split = mapped ? knowledgeApplicationCaps(mapped) : { knowledge: Number(row.tier1_available || 0), application: Number(row.tier2_available || 0) };
        const direct = Number(row.direct_earned || 0);
        const indirect = Number(row.indirect_earned || 0);
        const thinking = Number(row.thinking_earned || 0);
        const totalEarned = direct + indirect + thinking;
        const knowledgeEarned = Math.min(split.knowledge, Math.round(totalEarned * 0.35 * 10) / 10);
        const applicationEarned = Math.max(0, Math.round((totalEarned - knowledgeEarned) * 10) / 10);
        return {
          question_code: row.question_code,
          direct_earned: direct,
          indirect_earned: indirect,
          thinking_earned: thinking,
          tier1_earned: knowledgeEarned,
          tier1_available: split.knowledge,
          tier2_earned: applicationEarned,
          tier2_available: split.application,
        };
      });
      const response = await fetch("/api/evaluate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paper_id: paper.id,
          paper_name: paperName,
          student_notes: studentNotes.trim(),
          questions: payloadQuestions,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Could not run the diagnostic.");
      }
      if (!payload.success || !payload.evaluation) {
        throw new Error("The diagnostic did not return a Buried Treasure analysis.");
      }
      setEvaluation(payload.evaluation as BuriedTreasureAnalysis);
      setReport(null);
      if (user?.id) fetchOwnEvaluations(user.id).then(setHistory);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not run the diagnostic.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="lesson-body wide eval-page">
      <p>
        <Link href={href("/student/evaluator")}>← Script evaluator</Link>
      </p>
      <p className="kicker">AI mark report evaluation</p>
      <h1>Generate your diagnostic</h1>
      <p className="muted">
        The exam selected above fills this paper&apos;s question codes and Buried Treasure caps. Enter Direct, Indirect, and Thinking marks from your marked script. The AI report runs only after BMCR, Volume vs Accuracy, Buried Treasure, and this upload are complete.
      </p>
      <EvaluatorExamPicker />
      <ul className="eval-prereqs">
        <li>{progress.hasBmcr ? "BMCR saved." : "BMCR still needed."}</li>
        <li>{progress.hasVolume ? "Volume vs Accuracy saved." : "Volume vs Accuracy still needed."}</li>
        <li>{progress.hasBuriedTreasure ? "Buried Treasure saved." : "Buried Treasure still needed."}</li>
        <li>{progress.hasMarkReport ? `Mark report uploaded${progress.markReport?.file_name ? `: ${progress.markReport.file_name}` : "."}` : "Mark report upload still needed."}</li>
      </ul>

      {!sitting || !paper ? (
        <p className="notice">Select an exam to load the AI mark report tables for that sitting.</p>
      ) : (
      <form
        className="eval-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) void run();
        }}
      >
        <label>
          Paper
          <select className="select-line" value={paper.id} onChange={(event) => selectPaper(event.target.value)}>
            {sitting.papers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title} · {item.total_marks} marks
              </option>
            ))}
          </select>
        </label>
        <p className="muted small">
          Buried Treasure caps for this paper: Direct {paper.buried_treasure.direct_available} · Indirect{" "}
          {paper.buried_treasure.indirect_available} · Thinking {paper.buried_treasure.thinking_available}
        </p>

        <label>
          Upload mark report (PDF)
          <input
            type="file"
            accept="application/pdf,.pdf"
            disabled={uploading || !user?.id}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void onUpload(file);
            }}
          />
        </label>
        {uploading ? <p className="waiting">Uploading mark report…</p> : null}
        {!progress.ready ? (
          <p className="notice">
            Finish BMCR, Volume vs Accuracy, and Buried Treasure, and upload your mark report, before the AI evaluation will run.
          </p>
        ) : null}

        <div className="va-table-wrap">
          <table className="va-table bt-table" key={paper.id}>
            <caption>
              {paperName} — question codes and mark caps
            </caption>
            <thead>
              <tr>
                <th scope="col">Question</th>
                <th scope="col">Total Marks</th>
                <th scope="col">Direct cap</th>
                <th scope="col">Direct got</th>
                <th scope="col">Indirect cap</th>
                <th scope="col">Indirect got</th>
                <th scope="col">Thinking cap</th>
                <th scope="col">Thinking got</th>
              </tr>
            </thead>
            <tbody>
              {paper.questions.map((question) => {
                const row = questions.find((item) => item.question_code === question.code);
                return (
                  <tr key={`${paper.id}-${question.code}`} className={question.isCalculation ? "va-calc" : undefined}>
                    <th scope="row">
                      <strong>{question.code}</strong>
                      <span className="muted small">{question.title}</span>
                    </th>
                    <td>{question.marks}</td>
                    <td>{question.direct_available}</td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={question.direct_available}
                        step="0.5"
                        value={row?.direct_earned ?? ""}
                        onChange={(event) => setEarned(question.code, "direct_earned", event.target.value)}
                        aria-label={`${question.code} Direct Marks You Got`}
                        required
                      />
                    </td>
                    <td>{question.indirect_available}</td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={question.indirect_available}
                        step="0.5"
                        value={row?.indirect_earned ?? ""}
                        onChange={(event) => setEarned(question.code, "indirect_earned", event.target.value)}
                        aria-label={`${question.code} Indirect Marks You Got`}
                        required
                      />
                    </td>
                    <td>{question.thinking_available}</td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={question.thinking_available}
                        step="0.5"
                        value={row?.thinking_earned ?? ""}
                        onChange={(event) => setEarned(question.code, "thinking_earned", event.target.value)}
                        aria-label={`${question.code} Thinking Marks You Got`}
                        required
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <label className="eval-notes">
          Student notes
          <textarea
            rows={4}
            value={studentNotes}
            onChange={(event) => setStudentNotes(event.target.value)}
            placeholder="What did the required ask? Where did you feel the script ran out of structure?"
          />
        </label>
        {error ? <p className="notice">{error}</p> : null}
        {busy ? <p className="waiting">Comparing against IAC Examiner Frameworks...</p> : null}
        <div className="actions">
          <button className="primary" type="submit" disabled={!canSubmit}>
            {busy ? "Evaluating…" : progress.ready ? "Run diagnostic" : "Complete the steps above first"}
          </button>
        </div>
      </form>
      )}

      {evaluation ? <BuriedTreasureReportCard evaluation={evaluation} /> : null}
      {report ? <DiagnosticReportCard report={report} /> : null}

      {history.length ? (
        <section className="eval-history">
          <h2>Saved evaluations</h2>
          <ul>
            {history.map((row) => (
              <li key={row.id || row.question_code}>
                <button type="button" onClick={() => { setReport(row); setEvaluation(null); }}>
                  <strong>
                    {row.paper_name} · {row.question_code}
                  </strong>
                  <span className="muted small">
                    Total {row.total_score_pct}% · Knowledge {pct(row.tier1_earned, row.tier1_available)}% · Application{" "}
                    {pct(row.tier2_earned, row.tier2_available)}%
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
