"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  fetchCustomSurvey,
  fetchCustomSurveyBySlug,
  fetchOwnSurveyResponse,
  formatSurveyAnswer,
  isInfoBlock,
  questionCollectsAnswer,
  safeHref,
  submitCustomSurveyResponse,
  type CustomSurvey,
  type CustomSurveyResponse,
  type SurveyQuestion,
} from "@/lib/custom-surveys";
import LinkedText from "@/components/ui/LinkedText";

export default function StudentSurveyForm({
  slug,
  surveyId,
  embedded = false,
  allowInactive = false,
  hideTitle = false,
  onSubmitted,
  nextHref,
  nextTitle,
}: {
  slug?: string;
  surveyId?: string | null;
  embedded?: boolean;
  allowInactive?: boolean;
  hideTitle?: boolean;
  onSubmitted?: () => void;
  nextHref?: string | null;
  nextTitle?: string | null;
}) {
  const [survey, setSurvey] = useState<CustomSurvey | null>(null);
  const [existing, setExisting] = useState<CustomSurveyResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const onSubmittedRef = useRef(onSubmitted);
  onSubmittedRef.current = onSubmitted;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const result = surveyId
        ? await fetchCustomSurvey(surveyId)
        : slug
          ? await fetchCustomSurveyBySlug(slug)
          : { ok: false, error: "No survey is attached to this lesson.", survey: null };
      if (cancelled) return;
      if (!result.ok) {
        setLoading(false);
        setError(result.error || "Could not load this survey.");
        return;
      }
      if (!result.survey || (!result.survey.isActive && !allowInactive)) {
        setLoading(false);
        setError("This survey is not available.");
        return;
      }
      setSurvey(result.survey);
      const own = await fetchOwnSurveyResponse(result.survey.id);
      if (cancelled) return;
      setExisting(own.response);
      setLoading(false);
      if (own.response) onSubmittedRef.current?.();
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug, surveyId, allowInactive]);

  const setAnswer = (id: string, value: string) => {
    setAnswers((current) => ({ ...current, [id]: value }));
  };

  const submit = async () => {
    if (!survey) return;
    const missing = survey.questions.find(
      (question) =>
        questionCollectsAnswer(question.type) &&
        question.required &&
        !formatSurveyAnswer(answers[question.id])
    );
    if (missing) {
      setError(`Please answer “${missing.label}”.`);
      return;
    }
    setBusy(true);
    setError("");
    const payload: Record<string, string> = {};
    survey.questions.forEach((question) => {
      if (questionCollectsAnswer(question.type)) payload[question.id] = formatSurveyAnswer(answers[question.id]);
    });
    const result = await submitCustomSurveyResponse(survey.id, payload);
    setBusy(false);
    if (!result.ok) {
      setError(result.error || "Could not submit.");
      return;
    }
    setDone(true);
    onSubmitted?.();
  };

  const nextAction =
    nextHref && nextTitle ? (
      <Link className="primary" href={nextHref}>
        Next: {nextTitle} →
      </Link>
    ) : null;

  if (loading) {
    return (
      <Frame embedded={embedded}>
        <p className="empty">Loading survey…</p>
      </Frame>
    );
  }

  if (!survey) {
    return (
      <Frame embedded={embedded}>
        {!hideTitle ? (
          <>
            <p className="kicker">Survey</p>
            <h1>Survey unavailable</h1>
          </>
        ) : null}
        <p className="empty">{error || "This survey could not be found."}</p>
        {embedded ? nextAction : (
          <Link className="ghost" href="/student/surveys">
            ← All surveys
          </Link>
        )}
      </Frame>
    );
  }

  if (existing || done) {
    return (
      <Frame embedded={embedded} className="survey-rich-text">
        {!hideTitle ? (
          <>
            <p className="kicker">Survey</p>
            <h1>{survey.title}</h1>
          </>
        ) : null}
        <p className="lead">Thank you. Your response has been saved.</p>
        {existing ? (
          <div className="work-list">
            {survey.questions.map((question) =>
              isInfoBlock(question.type) ? (
                <SurveyInfoCard key={question.id} question={question} />
              ) : (
                <article className="work-item" key={question.id}>
                  <strong>
                    <LinkedText text={question.label} />
                  </strong>
                  <p>{formatSurveyAnswer(existing.answers[question.id]) || "—"}</p>
                </article>
              )
            )}
          </div>
        ) : null}
        <div className="actions">
          {nextAction}
          {embedded ? null : (
            <Link className="ghost" href="/student/surveys">
              ← All surveys
            </Link>
          )}
        </div>
      </Frame>
    );
  }

  return (
    <Frame embedded={embedded} className="survey-rich-text">
      {!hideTitle ? (
        <>
          <p className="kicker">Survey</p>
          <h1>{survey.title}</h1>
        </>
      ) : null}
      {survey.description && !hideTitle ? (
        <p className="lead">
          <LinkedText text={survey.description} />
        </p>
      ) : null}
      {error ? <div className="notice">{error}</div> : null}
      <form
        className="survey-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {survey.questions.map((question) =>
          isInfoBlock(question.type) ? (
            <SurveyInfoCard key={question.id} question={question} />
          ) : (
            <SurveyField
              key={question.id}
              question={question}
              value={answers[question.id] || ""}
              onChange={(value) => setAnswer(question.id, value)}
            />
          )
        )}
        <div className="actions">
          <button className="primary" type="submit" disabled={busy}>
            {busy ? "Submitting…" : "Submit"}
          </button>
          {embedded ? nextAction : (
            <Link className="ghost" href="/student/surveys">
              Cancel
            </Link>
          )}
        </div>
      </form>
    </Frame>
  );
}

function Frame({
  embedded,
  className,
  children,
}: {
  embedded?: boolean;
  className?: string;
  children: ReactNode;
}) {
  if (embedded) return <div className={className}>{children}</div>;
  return <article className={`lesson-body wide ${className || ""}`.trim()}>{children}</article>;
}

function SurveyInfoCard({ question }: { question: SurveyQuestion }) {
  const href = safeHref(question.resourceUrl);
  return (
    <aside className="survey-info-card">
      <strong>
        <LinkedText text={question.label} />
      </strong>
      {question.helperText ? (
        <p>
          <LinkedText text={question.helperText} />
        </p>
      ) : null}
      {href ? (
        <a className="primary" href={href} target="_blank" rel="noopener noreferrer">
          Open Lesson in New Tab ↗
        </a>
      ) : null}
    </aside>
  );
}

function SurveyField({
  question,
  value,
  onChange,
}: {
  question: SurveyQuestion;
  value: string;
  onChange: (value: string) => void;
}) {
  const fieldId = `survey-${question.id}`;
  return (
    <div className="plan-field">
      <label htmlFor={question.type === "radio" || question.type === "rating" ? undefined : fieldId}>
        <strong>
          <LinkedText text={question.label} />
          {question.required ? " *" : ""}
        </strong>
      </label>
      {question.helperText ? (
        <p className="muted small">
          <LinkedText text={question.helperText} />
        </p>
      ) : null}
      {question.type === "dropdown" ? (
        <select id={fieldId} className="select-line" value={value} onChange={(event) => onChange(event.target.value)} required={question.required}>
          <option value="">Select…</option>
          {question.options.map((option, optionIndex) => (
            <option key={`${question.id}-${optionIndex}`} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : null}
      {question.type === "radio" ? (
        <div className="survey-choice-list" role="radiogroup" aria-label={question.label}>
          {question.options.map((option, optionIndex) => (
            <label className="roster-check" key={`${question.id}-${optionIndex}`}>
              <input
                type="radio"
                name={question.id}
                checked={value === option}
                onChange={() => onChange(option)}
                required={question.required}
              />
              {option}
            </label>
          ))}
        </div>
      ) : null}
      {question.type === "short_text" ? (
        <input
          id={fieldId}
          className="select-line"
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={question.required}
        />
      ) : null}
      {question.type === "long_text" ? (
        <textarea
          id={fieldId}
          rows={5}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={question.required}
        />
      ) : null}
      {question.type === "rating" ? (
        <div className="survey-choice-list survey-rating" role="radiogroup" aria-label={question.label}>
          {[1, 2, 3, 4, 5].map((score) => (
            <label className="roster-check" key={score}>
              <input
                type="radio"
                name={question.id}
                checked={value === String(score)}
                onChange={() => onChange(String(score))}
                required={question.required}
              />
              {score}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
