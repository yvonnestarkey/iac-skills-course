"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import BmcrCalculator from "@/components/lesson/BmcrCalculator";
import {
  fetchCustomSurvey,
  fetchCustomSurveyBySlug,
  fetchOwnSurveyResponse,
  formatSurveyAnswer,
  hasCoachReview,
  isBmcrBlock,
  isInfoBlock,
  isPdfUploadBlock,
  parsePdfUploadAnswer,
  questionCollectsAnswer,
  safeHref,
  stringifyPdfUploadAnswer,
  submitCustomSurveyResponse,
  surveyResponseStatusClass,
  surveyResponseStatusLabel,
  uploadSurveyResponsePdf,
  type CustomSurvey,
  type CustomSurveyResponse,
  type SurveyQuestion,
} from "@/lib/custom-surveys";
import { parseBmcrAnswer, stringifyBmcrAnswer } from "@/lib/bmcr";
import LessonPdfViewer from "@/components/LessonPdfViewer";
import LinkedText from "@/components/ui/LinkedText";
import SurveyAnswerValue from "@/components/ui/SurveyAnswerValue";

export default function StudentSurveyForm({
  slug,
  surveyId,
  lessonId,
  embedded = false,
  allowInactive = false,
  hideTitle = false,
  onSubmitted,
  nextHref,
  nextTitle,
}: {
  slug?: string;
  surveyId?: string | null;
  lessonId?: string | null;
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
        !formatSurveyAnswer(answers[question.id], question.type)
    );
    if (missing) {
      setError(
        isPdfUploadBlock(missing.type)
          ? `Please upload a PDF for “${missing.label}”.`
          : `Please answer “${missing.label}”.`
      );
      return;
    }
    setBusy(true);
    setError("");
    const payload: Record<string, string> = {};
    survey.questions.forEach((question) => {
      if (questionCollectsAnswer(question.type)) payload[question.id] = (answers[question.id] || "").trim();
    });
    const result = await submitCustomSurveyResponse(survey.id, payload, lessonId);
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
    const review = existing && hasCoachReview(existing) ? existing : null;
    const lead = review
      ? review.status === "graded"
        ? "Your coach has graded this."
        : review.status === "rejected"
          ? "Your coach rejected this submission."
          : review.status === "resubmit"
            ? "Your coach asked you to resubmit."
            : "Your coach has left feedback."
      : "Thank you. Your response has been saved. Your coach has not reviewed it yet.";
    return (
      <Frame embedded={embedded} className="survey-rich-text">
        {!hideTitle ? (
          <>
            <p className="kicker">Survey</p>
            <h1>{survey.title}</h1>
          </>
        ) : null}
        <p className="lead">{lead}</p>
        {existing ? <CoachReviewCard response={existing} /> : null}
        <SurveyQuestionPdf survey={survey} submitted />
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
                  {isBmcrBlock(question.type) ? (
                    <BmcrCalculator value={parseBmcrAnswer(existing.answers[question.id])} readOnly idPrefix={`saved-${question.id}`} />
                  ) : (
                    <p>
                      <SurveyAnswerValue value={existing.answers[question.id]} type={question.type} />
                    </p>
                  )}
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
      <SurveyQuestionPdf survey={survey} />
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
              surveyId={survey.id}
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

function CoachReviewCard({ response }: { response: CustomSurveyResponse }) {
  return (
    <aside className={`survey-info-card survey-review-card ${surveyResponseStatusClass(response.status)}`}>
      <strong>Coach review</strong>
      <p>
        <span className={`badge ${surveyResponseStatusClass(response.status)}`}>{surveyResponseStatusLabel(response.status)}</span>
        {response.grade != null ? ` Grade: ${response.grade}` : ""}
      </p>
      {response.feedback.trim() ? (
        <p>
          <LinkedText text={response.feedback} />
        </p>
      ) : (
        <p className="muted small">No written comments yet.</p>
      )}
      {response.feedbackFileUrl ? (
        <a className="primary" href={response.feedbackFileUrl} target="_blank" rel="noopener noreferrer">
          Open coach file ↗
        </a>
      ) : null}
    </aside>
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

function SurveyQuestionPdf({ survey, submitted = false }: { survey: CustomSurvey; submitted?: boolean }) {
  if (!survey.pdfUrl) return null;
  return (
    <LessonPdfViewer
      pdfUrl={survey.pdfUrl}
      heading="Question paper"
      blurb={
        submitted
          ? "You can still download the PDF for this survey."
          : "Download this PDF, complete the work, then enter your results in the survey below."
      }
      downloadLabel="Download PDF"
    />
  );
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
  surveyId,
}: {
  question: SurveyQuestion;
  value: string;
  onChange: (value: string) => void;
  surveyId: string;
}) {
  const fieldId = `survey-${question.id}`;
  return (
    <div className="plan-field">
      <label htmlFor={question.type === "radio" || question.type === "rating" || question.type === "multi_select" || isBmcrBlock(question.type) || isPdfUploadBlock(question.type) ? undefined : fieldId}>
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
      {question.type === "multi_select" ? (
        <div className="survey-choice-list bmcr-challenges" role="group" aria-label={question.label}>
          {question.options.map((option, optionIndex) => {
            const selected = value
              .split(";")
              .map((item) => item.trim())
              .filter(Boolean);
            const on = selected.includes(option);
            return (
              <label className={`roster-check${on ? " bmcr-tag-on" : ""}`} key={`${question.id}-${optionIndex}`}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => {
                    const next = on ? selected.filter((item) => item !== option) : [...selected, option];
                    onChange(next.join("; "));
                  }}
                />
                {option}
              </label>
            );
          })}
        </div>
      ) : null}
      {isBmcrBlock(question.type) ? (
        <BmcrCalculator
          idPrefix={question.id}
          value={parseBmcrAnswer(value)}
          onChange={(marks) => onChange(stringifyBmcrAnswer(marks))}
        />
      ) : null}
      {isPdfUploadBlock(question.type) ? (
        <SurveyPdfUploadField question={question} value={value} onChange={onChange} surveyId={surveyId} />
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

function SurveyPdfUploadField({
  question,
  value,
  onChange,
  surveyId,
}: {
  question: SurveyQuestion;
  value: string;
  onChange: (value: string) => void;
  surveyId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const uploaded = parsePdfUploadAnswer(value);
  const fieldId = `survey-pdf-${question.id}`;

  const pick = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setError("");
    const result = await uploadSurveyResponsePdf(file, surveyId, question.id);
    setBusy(false);
    if (!result.ok || !result.url) {
      setError(result.error || "Could not upload that PDF.");
      return;
    }
    onChange(stringifyPdfUploadAnswer({ url: result.url, name: result.name || file.name }));
  };

  return (
    <>
      {uploaded ? (
        <div className="file-card">
          <span className="file-icon">PDF</span>
          <div className="file-meta">
            <strong>{uploaded.name}</strong>
            <span className="muted small">Ready to submit</span>
          </div>
          <a className="ghost" href={uploaded.url} target="_blank" rel="noopener noreferrer">
            Open PDF
          </a>
          <button className="ghost" type="button" onClick={() => onChange("")}>
            Remove
          </button>
        </div>
      ) : null}
      <label className="dropzone" htmlFor={fieldId}>
        <strong>{uploaded ? "Replace your PDF" : "Choose a PDF to upload"}</strong>
        <span className="muted small">{busy ? "Uploading…" : "PDF only · scans are fine"}</span>
        <input
          id={fieldId}
          type="file"
          accept="application/pdf,.pdf"
          disabled={busy}
          onChange={(event) => {
            void pick(event.target.files && event.target.files[0]);
            event.target.value = "";
          }}
        />
      </label>
      {error ? <p className="notice">{error}</p> : null}
    </>
  );
}
