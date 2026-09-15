"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchCustomSurveyBySlug,
  fetchOwnSurveyResponse,
  formatSurveyAnswer,
  submitCustomSurveyResponse,
  type CustomSurvey,
  type CustomSurveyResponse,
  type SurveyQuestion,
} from "@/lib/custom-surveys";

export default function StudentSurveyForm({ slug }: { slug: string }) {
  const [survey, setSurvey] = useState<CustomSurvey | null>(null);
  const [existing, setExisting] = useState<CustomSurveyResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchCustomSurveyBySlug(slug).then(async (result) => {
      if (cancelled) return;
      if (!result.ok) {
        setLoading(false);
        setError(result.error || "Could not load this survey.");
        return;
      }
      if (!result.survey || !result.survey.isActive) {
        setLoading(false);
        setError("This survey is not available.");
        return;
      }
      setSurvey(result.survey);
      const own = await fetchOwnSurveyResponse(result.survey.id);
      if (cancelled) return;
      setExisting(own.response);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const setAnswer = (id: string, value: string) => {
    setAnswers((current) => ({ ...current, [id]: value }));
  };

  const submit = async () => {
    if (!survey) return;
    const missing = survey.questions.find((question) => question.required && !formatSurveyAnswer(answers[question.id]));
    if (missing) {
      setError(`Please answer “${missing.label}”.`);
      return;
    }
    setBusy(true);
    setError("");
    const result = await submitCustomSurveyResponse(survey.id, answers);
    setBusy(false);
    if (!result.ok) {
      setError(result.error || "Could not submit.");
      return;
    }
    setDone(true);
  };

  if (loading) {
    return (
      <article className="lesson-body wide">
        <p className="empty">Loading survey…</p>
      </article>
    );
  }

  if (!survey) {
    return (
      <article className="lesson-body wide">
        <p className="kicker">Survey</p>
        <h1>Survey unavailable</h1>
        <p className="empty">{error || "This survey could not be found."}</p>
        <Link className="ghost" href="/student/surveys">
          ← All surveys
        </Link>
      </article>
    );
  }

  if (existing || done) {
    return (
      <article className="lesson-body wide">
        <p className="kicker">Survey</p>
        <h1>{survey.title}</h1>
        <p className="lead">Thank you. Your response has been saved.</p>
        {existing ? (
          <div className="work-list">
            {survey.questions.map((question) => (
              <article className="work-item" key={question.id}>
                <strong>{question.label}</strong>
                <p>{formatSurveyAnswer(existing.answers[question.id]) || "—"}</p>
              </article>
            ))}
          </div>
        ) : null}
        <div className="actions">
          <Link className="ghost" href="/student/surveys">
            ← All surveys
          </Link>
        </div>
      </article>
    );
  }

  return (
    <article className="lesson-body wide">
      <p className="kicker">Survey</p>
      <h1>{survey.title}</h1>
      {survey.description ? <p className="lead">{survey.description}</p> : null}
      {error ? <div className="notice">{error}</div> : null}
      <form
        className="survey-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {survey.questions.map((question) => (
          <SurveyField
            key={question.id}
            question={question}
            value={answers[question.id] || ""}
            onChange={(value) => setAnswer(question.id, value)}
          />
        ))}
        <div className="actions">
          <button className="primary" type="submit" disabled={busy}>
            {busy ? "Submitting…" : "Submit"}
          </button>
          <Link className="ghost" href="/student/surveys">
            Cancel
          </Link>
        </div>
      </form>
    </article>
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
          {question.label}
          {question.required ? " *" : ""}
        </strong>
      </label>
      {question.helperText ? <p className="muted small">{question.helperText}</p> : null}
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
