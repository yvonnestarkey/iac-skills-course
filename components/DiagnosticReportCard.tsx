import { blockerLabel, type DiagnosticReportResult, type PrimaryBlocker } from "@/lib/diagnostic-report";

function ScoreBar({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="eval-score">
      <div className="eval-score-head">
        <strong>{label}</strong>
        <span>{value}%</span>
      </div>
      {hint ? <p className="muted small">{hint}</p> : null}
      <div className="student-progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <span style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function blockerCopy(blocker: PrimaryBlocker): string {
  if (blocker === "theory") {
    return "Knowledge marks are leaking. Close the technical gaps before you spend more time on articulation drills.";
  }
  if (blocker === "execution") {
    return "The knowledge is largely there. Application and structured articulation are where the marks are dropping.";
  }
  return "Both the technical base and the conversion into application marks are leaking. Work the knowledge gap and the writing structure together.";
}

export default function DiagnosticReportCard({ report }: { report: DiagnosticReportResult }) {
  return (
    <section className="eval-report diag-card" aria-live="polite">
      <p className="kicker">Diagnostic report</p>
      <h2>
        {report.paper_name}
        {report.question_code ? ` · ${report.question_code}` : ""}
      </h2>

      <div className="diag-overview">
        <ScoreBar label="Total score" value={report.total_score_pct} hint={`${report.tier1_earned + report.tier2_earned} / ${report.tier1_available + report.tier2_available} marks`} />
        <ScoreBar
          label="Tier 1 Knowledge"
          value={report.knowledge_pct}
          hint={`~35% of the paper · ${report.tier1_earned} / ${report.tier1_available}`}
        />
        <ScoreBar
          label="Tier 2 Application"
          value={report.application_pct}
          hint={`~65% of the paper · ${report.tier2_earned} / ${report.tier2_available}`}
        />
      </div>

      <div className="diag-table-wrap">
        <h3>Summary diagnostic</h3>
        <table className="diag-table">
          <thead>
            <tr>
              <th scope="col">Question block</th>
              <th scope="col">Total Marks</th>
              <th scope="col">Tier 1 earned vs max</th>
              <th scope="col">Tier 2 earned vs max</th>
              <th scope="col">Primary mark leak</th>
            </tr>
          </thead>
          <tbody>
            {report.questions.map((question) => (
              <tr key={question.question_code}>
                <th scope="row">{question.question_code}</th>
                <td>{question.available_marks}</td>
                <td>
                  {question.tier1_earned} / {question.tier1_available} ({question.knowledge_earned_pct}%)
                </td>
                <td>
                  {question.tier2_earned} / {question.tier2_available} ({question.application_earned_pct}%)
                </td>
                <td>{question.primary_leakage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="diag-breakdown">
        <h3>Detailed question breakdown</h3>
        {report.questions.map((question) => (
          <details key={question.question_code} className="diag-q" open>
            <summary>
              <strong>{question.question_code}</strong>
              <span className="muted small">{question.primary_leakage}</span>
            </summary>
            <p>{question.first_person_summary}</p>
            <div className="diag-q-grid">
              <article>
                <h4>What I found you got right</h4>
                {question.got_right.length ? (
                  <ul>
                    {question.got_right.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p>{report.knowledge_summary}</p>
                )}
              </article>
              <article>
                <h4>Where I identified lost marks</h4>
                {question.lost_marks.length ? (
                  <ul>
                    {question.lost_marks.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p>{report.application_summary}</p>
                )}
              </article>
            </div>
          </details>
        ))}
      </div>

      <aside className="diag-verdict">
        <p className="kicker">Core verdict</p>
        <h3>{blockerLabel(report.primary_blocker)}</h3>
        <p>{report.core_verdict || blockerCopy(report.primary_blocker)}</p>
        <h4>Action steps</h4>
        <ol>
          {report.skill_drills.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </aside>
    </section>
  );
}
