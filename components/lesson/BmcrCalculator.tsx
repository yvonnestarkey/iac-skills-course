"use client";

import {
  bmcrCoachingFeedback,
  computeBasicMarkPct,
  computeBmcrPct,
  formatPct,
  hasBmcrData,
  withDiagnostics,
  withQuestionTotal,
  type BmcrValue,
  EMPTY_BMCR_VALUE,
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

function YesNoToggle({
  id,
  label,
  value,
  onChange,
  readOnly,
}: {
  id: string;
  label: string;
  value: boolean | null;
  onChange?: (next: boolean) => void;
  readOnly?: boolean;
}) {
  return (
    <fieldset className="bmcr-yesno">
      <legend>{label}</legend>
      <div className="bmcr-yesno-options" role="radiogroup" aria-label={label}>
        {[
          { option: true, text: "Yes" },
          { option: false, text: "No" },
        ].map((item) => {
          const selected = value === item.option;
          return (
            <button
              key={item.text}
              type="button"
              id={`${id}-${item.text.toLowerCase()}`}
              className={`bmcr-yesno-btn${selected ? " selected" : ""}`}
              aria-pressed={selected}
              disabled={readOnly}
              onClick={() => onChange?.(item.option)}
            >
              {item.text}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function BmcrCalculator({
  value,
  onChange,
  readOnly = false,
  idPrefix = "bmcr",
  maxMarks,
  showTable = true,
  showInterpretation = true,
  showDiagnostics = true,
}: {
  value?: BmcrValue | null;
  onChange?: (next: BmcrValue) => void;
  readOnly?: boolean;
  idPrefix?: string;
  maxMarks?: number;
  showTable?: boolean;
  showInterpretation?: boolean;
  showDiagnostics?: boolean;
}) {
  const ready = withDiagnostics(value || EMPTY_BMCR_VALUE);
  const marks = withQuestionTotal(ready);
  const basicPct = computeBasicMarkPct(marks);
  const bmcrPct = computeBmcrPct(marks);
  const feedback = bmcrCoachingFeedback(marks);
  const showStats = hasBmcrData(marks);

  const emit = (next: BmcrValue) => {
    if (!onChange || readOnly) return;
    onChange(withDiagnostics(next));
  };

  const cap = maxMarks && maxMarks > 0 ? maxMarks : undefined;

  const setField = (field: keyof BmcrValue, raw: string) => {
    const parsed = raw.trim() === "" ? 0 : Number(raw);
    const nextValue = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    emit({
      ...ready,
      ...withQuestionTotal({
        ...marks,
        [field]: cap != null ? Math.min(nextValue, cap) : nextValue,
      }),
    });
  };

  return (
    <div className="bmcr-calculator">
      {showTable ? (
        <>
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
                            max={cap}
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
                            max={cap}
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
                        max={cap}
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
          <p className="muted small">
            Question Total My Marks is the sum of Basic, Average, and Higher Grade.
            {cap != null ? ` This section is capped at ${cap} marks.` : ""}
          </p>
        </>
      ) : null}
      {showInterpretation && showStats ? (
        <div className="bmcr-stats">
          <div className="bmcr-stat">
            <span>YOU KNOW...</span>
            <b>{formatPct(basicPct)}</b>
            <small>Basic Markplan ÷ Question Total Markplan</small>
            <p className="bmcr-stat-caption">This is what you could&apos;ve gotten with your existing knowledge</p>
          </div>
          <div className="bmcr-stat">
            <span>YOU CAN USE...</span>
            <b>{formatPct(bmcrPct)}</b>
            <small>Basic My Marks ÷ Basic Markplan</small>
            <p className="bmcr-stat-caption">This is how much of YOUR knowledge you&apos;re currently able to get marks for</p>
          </div>
        </div>
      ) : null}
      {showInterpretation && feedback ? (
        <aside className="bmcr-feedback" aria-live="polite">
          <strong>{feedback.title}</strong>
          <p>{feedback.body}</p>
        </aside>
      ) : null}
      {showDiagnostics ? (
        <div className="bmcr-diagnostics">
          <YesNoToggle
            id={`${idPrefix}-feels-needs-theory`}
            label="Do you still FEEL that you need theory?"
            value={ready.feels_needs_theory}
            readOnly={readOnly}
            onChange={(next) => emit({ ...ready, feels_needs_theory: next })}
          />
          <YesNoToggle
            id={`${idPrefix}-feelings-reliable`}
            label="Are your feelings reliable?"
            value={ready.feelings_reliable}
            readOnly={readOnly}
            onChange={(next) => emit({ ...ready, feelings_reliable: next })}
          />
        </div>
      ) : null}
    </div>
  );
}
