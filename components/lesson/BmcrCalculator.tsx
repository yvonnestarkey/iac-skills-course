"use client";

import {
  bmcrCoachingFeedback,
  computeBasicMarkPct,
  computeBmcrPct,
  formatPct,
  hasBmcrData,
  withQuestionTotal,
  type BmcrMarks,
  EMPTY_BMCR_MARKS,
} from "@/lib/bmcr";

const ROWS: { key: "basic" | "average" | "higher"; label: string }[] = [
  { key: "basic", label: "Basic" },
  { key: "average", label: "Average" },
  { key: "higher", label: "Higher Grade" },
];

const MARK_FIELDS = {
  basic: { mine: "basic_my_marks", plan: "basic_markplan" },
  average: { mine: "average_my_marks", plan: "average_markplan" },
  higher: { mine: "higher_my_marks", plan: "higher_markplan" },
} as const;

function displayNumber(value: number): string {
  return value === 0 ? "" : String(value);
}

export default function BmcrCalculator({
  value,
  onChange,
  readOnly = false,
  idPrefix = "bmcr",
}: {
  value?: BmcrMarks | null;
  onChange?: (next: BmcrMarks) => void;
  readOnly?: boolean;
  idPrefix?: string;
}) {
  const marks = withQuestionTotal(value || EMPTY_BMCR_MARKS);
  const basicPct = computeBasicMarkPct(marks);
  const bmcrPct = computeBmcrPct(marks);
  const feedback = bmcrCoachingFeedback(marks);
  const showStats = hasBmcrData(marks);

  const setField = (field: keyof BmcrMarks, raw: string) => {
    if (!onChange || readOnly) return;
    const parsed = raw.trim() === "" ? 0 : Number(raw);
    const next = withQuestionTotal({
      ...marks,
      [field]: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
    });
    onChange(next);
  };

  return (
    <div className="bmcr-calculator">
      <div className="bmcr-table-wrap">
        <table className="bmcr-table">
          <thead>
            <tr>
              <th scope="col">Difficulty Level</th>
              <th scope="col">My Marks</th>
              <th scope="col">Markplan Marks</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => {
              const mine = MARK_FIELDS[row.key].mine;
              const plan = MARK_FIELDS[row.key].plan;
              return (
                <tr key={row.key}>
                  <th scope="row">{row.label}</th>
                  <td>
                    {readOnly ? (
                      marks[mine]
                    ) : (
                      <input
                        id={`${idPrefix}-${mine}`}
                        className="select-line"
                        type="number"
                        min={0}
                        step={0.5}
                        inputMode="decimal"
                        value={displayNumber(marks[mine])}
                        onChange={(event) => setField(mine, event.target.value)}
                        aria-label={`${row.label} my marks`}
                      />
                    )}
                  </td>
                  <td>
                    {readOnly ? (
                      marks[plan]
                    ) : (
                      <input
                        id={`${idPrefix}-${plan}`}
                        className="select-line"
                        type="number"
                        min={0}
                        step={0.5}
                        inputMode="decimal"
                        value={displayNumber(marks[plan])}
                        onChange={(event) => setField(plan, event.target.value)}
                        aria-label={`${row.label} markplan marks`}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
            <tr className="bmcr-total">
              <th scope="row">Question Total</th>
              <td>
                <span className="bmcr-sum">{marks.question_total_my_marks}</span>
              </td>
              <td>
                {readOnly ? (
                  marks.question_total_markplan
                ) : (
                  <input
                    id={`${idPrefix}-question_total_markplan`}
                    className="select-line"
                    type="number"
                    min={0}
                    step={0.5}
                    inputMode="decimal"
                    value={displayNumber(marks.question_total_markplan)}
                    onChange={(event) => setField("question_total_markplan", event.target.value)}
                    aria-label="Total question markplan marks"
                  />
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="muted small">Question Total My Marks is the sum of Basic, Average, and Higher Grade.</p>
      {showStats ? (
        <div className="bmcr-stats">
          <div className="bmcr-stat">
            <span>Basic Marks %</span>
            <b>{formatPct(basicPct)}</b>
            <small>Basic Markplan ÷ Question Total Markplan</small>
          </div>
          <div className="bmcr-stat">
            <span>BMCR</span>
            <b>{formatPct(bmcrPct)}</b>
            <small>Basic My Marks ÷ Basic Markplan</small>
          </div>
        </div>
      ) : null}
      {feedback ? (
        <aside className="bmcr-feedback" aria-live="polite">
          <strong>{feedback.title}</strong>
          <p>{feedback.body}</p>
        </aside>
      ) : null}
    </div>
  );
}
