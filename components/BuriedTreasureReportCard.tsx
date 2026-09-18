import type { BuriedTreasureAnalysis, TierScore } from "@/types/evaluation";

const CAUSE_LABEL: Record<BuriedTreasureAnalysis["primaryFailureCause"], string> = {
  THEORY_GAP: "Theory / knowledge gap",
  EXECUTION_GAP: "Execution / application gap",
  BREADTH_OMISSION: "Breadth omission",
  MECHANICS_FAILURE: "Mechanics failure",
};

function ScoreBar({ label, score, hint }: { label: string; score: TierScore; hint?: string }) {
  return (
    <div className="eval-score">
      <div className="eval-score-head">
        <strong>{label}</strong>
        <span>{score.percentage}%</span>
      </div>
      <p className="muted small">{hint || `${score.earned} / ${score.available} marks`}</p>
      <div
        className="student-progress"
        role="progressbar"
        aria-valuenow={score.percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <span style={{ width: `${Math.max(0, Math.min(100, score.percentage))}%` }} />
      </div>
    </div>
  );
}

export default function BuriedTreasureReportCard({ evaluation }: { evaluation: BuriedTreasureAnalysis }) {
  return (
    <section className="eval-report diag-card" aria-live="polite">
      <p className="kicker">Buried Treasure diagnostic</p>
      <h2>{evaluation.diagnosticHeadline}</h2>
      <p className="muted">
        {evaluation.hasTheoryGap ? "Theory gap identified." : "No theory gap on Direct/Indirect extraction."} Primary
        cause: {CAUSE_LABEL[evaluation.primaryFailureCause]}.
      </p>

      <div className="diag-overview">
        <ScoreBar label="Tier 1 Direct" score={evaluation.directMarks} hint="Target >= 80%" />
        <ScoreBar label="Tier 2 Indirect" score={evaluation.indirectMarks} hint="Target >= 60%" />
        <ScoreBar label="Tier 3 Thinking" score={evaluation.thinkingMarks} hint="Target >= 50%" />
      </div>
      <div className="diag-overview">
        <ScoreBar label="Knowledge & trigger" score={evaluation.knowledgeScore} hint="Tier 1 + Tier 2" />
        <ScoreBar label="Application & execution" score={evaluation.applicationScore} hint="Tier 3" />
        <ScoreBar label="Macro-communication" score={evaluation.macroCommScore} hint="X1 / layout marks" />
      </div>

      {evaluation.keyTakeaways.length ? (
        <div className="eval-drops">
          <h3>Key takeaways</h3>
          <ul>
            {evaluation.keyTakeaways.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {evaluation.actionPlan.length ? (
        <aside className="diag-verdict">
          <p className="kicker">Action plan</p>
          <ol>
            {evaluation.actionPlan.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </aside>
      ) : null}

      <article className="eval-steps">
        <h3>Full report</h3>
        <div className="bt-report-md">{evaluation.fullReportMarkdown}</div>
      </article>
    </section>
  );
}
