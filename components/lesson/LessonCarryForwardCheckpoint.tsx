"use client";

import { useEffect, useMemo, useState } from "react";
import VideoPlayer from "@/components/lesson/VideoPlayer";
import SurveyAnswerValue from "@/components/ui/SurveyAnswerValue";
import LinkedText from "@/components/ui/LinkedText";
import {
  fetchCustomSurvey,
  fetchOwnSurveyResponse,
  formatSurveyAnswer,
  questionCollectsAnswer,
  submitCustomSurveyResponse,
  type CustomSurvey,
  type SurveyQuestion,
} from "@/lib/custom-surveys";
import {
  parseCheckpointNotes,
  serializeCheckpointNotes,
  type LessonCheckpointState,
} from "@/lib/lesson-checkpoint";
import { saveLessonProgress, type StudentLesson } from "@/lib/student-lesson";
import type { LessonVideo } from "@/lib/lesson-videos";

function splitBrief(brief?: string): string[] {
  return (brief || "")
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function LessonCarryForwardCheckpoint({
  lesson,
  video,
  notes,
  onProgress,
}: {
  lesson: StudentLesson;
  video?: LessonVideo;
  notes: string;
  onProgress: (next: { completed: boolean; notes: string }) => void;
}) {
  const [survey, setSurvey] = useState<CustomSurvey | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reflectionSaved, setReflectionSaved] = useState(false);

  useEffect(() => {
    const fromNotes = parseCheckpointNotes(notes);
    if (!fromNotes) return;
    setAnswers((current) => ({ ...fromNotes.answers, ...current }));
    if (fromNotes.submitted) setSubmitted(true);
    const lastId = survey?.questions.filter((question) => questionCollectsAnswer(question.type)).at(-1)?.id;
    if (lastId && fromNotes.answers[lastId]) setReflectionSaved(true);
  }, [notes, survey]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!lesson.survey_id) {
        setLoading(false);
        setError("This check-in is not attached yet.");
        return;
      }
      const result = await fetchCustomSurvey(lesson.survey_id);
      if (cancelled) return;
      if (!result.ok || !result.survey) {
        setLoading(false);
        setError(result.error || "Could not load this check-in.");
        return;
      }
      setSurvey(result.survey);
      const own = await fetchOwnSurveyResponse(result.survey.id);
      if (cancelled) return;
      if (own.response?.answers) {
        setAnswers((current) => ({ ...current, ...own.response!.answers }));
        setSubmitted(true);
        const lastId = result.survey.questions.filter((question) => questionCollectsAnswer(question.type)).at(-1)?.id;
        if (lastId && own.response.answers[lastId]) setReflectionSaved(true);
      }
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [lesson.survey_id]);

  const questions = survey?.questions.filter((question) => questionCollectsAnswer(question.type)) || [];
  const checkIn = questions.slice(0, -1);
  const reflection = questions[questions.length - 1] || null;
  const rememberCopy = useMemo(() => splitBrief(lesson.brief), [lesson.brief]);

  const persist = async (next: LessonCheckpointState, complete: boolean) => {
    const serialized = serializeCheckpointNotes(next);
    onProgress({ completed: complete, notes: serialized });
    await saveLessonProgress(lesson.id, { completed: complete, notes: serialized });
    if (survey) {
      const result = await submitCustomSurveyResponse(survey.id, next.answers, lesson.id);
      if (!result.ok) {
        setError(result.error || "Your answers are saved on this lesson, but the check-in record could not be updated.");
      }
    }
  };

  const setAnswer = (id: string, value: string) => {
    setAnswers((current) => ({ ...current, [id]: value }));
  };

  const submitCheckIn = async () => {
    if (!survey) return;
    const missing = checkIn.find((question) => question.required && !formatSurveyAnswer(answers[question.id], question.type));
    if (missing) {
      setError(`Please answer “${missing.label}”.`);
      return;
    }
    setBusy(true);
    setError("");
    const state = { submitted: true, answers };
    await persist(state, true);
    setSubmitted(true);
    setBusy(false);
  };

  const submitReflection = async () => {
    if (!survey || !reflection) return;
    if (reflection.required && !formatSurveyAnswer(answers[reflection.id], reflection.type)) {
      setError(`Please answer “${reflection.label}”.`);
      return;
    }
    setBusy(true);
    setError("");
    await persist({ submitted: true, answers }, true);
    setReflectionSaved(true);
    setBusy(false);
  };

  if (loading) return <p className="empty">Loading check-in…</p>;
  if (!survey) return <p className="empty">{error || "This check-in could not be found."}</p>;

  return (
    <div className="lesson-checkpoint">
      {(lesson.body || []).map((paragraph, index) => (
        <p key={`${lesson.id}-intro-${index}`}>{paragraph}</p>
      ))}
      {error ? <div className="notice">{error}</div> : null}

      {checkIn.map((question) =>
        submitted ? (
          <SavedAnswer key={question.id} question={question} value={answers[question.id] || ""} />
        ) : (
          <CheckpointField key={question.id} question={question} value={answers[question.id] || ""} onChange={(value) => setAnswer(question.id, value)} />
        )
      )}

      {submitted ? null : (
        <div className="actions">
          <button className="primary" type="button" disabled={busy} onClick={() => void submitCheckIn()}>
            {busy ? "Saving…" : "Submit check-in"}
          </button>
        </div>
      )}

      {submitted ? (
        <>
          {rememberCopy.map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}
          {video ? (
            <div className="lesson-checkpoint-player">
              <VideoPlayer lesson={lesson} src={video.url} title={video.heading || lesson.title} />
            </div>
          ) : null}
          {reflection ? (
            reflectionSaved && answers[reflection.id] ? (
              <SavedAnswer question={reflection} value={answers[reflection.id]} />
            ) : (
              <CheckpointField question={reflection} value={answers[reflection.id] || ""} onChange={(value) => setAnswer(reflection.id, value)} />
            )
          ) : null}
          {reflection && !reflectionSaved ? (
            <div className="actions">
              <button className="primary" type="button" disabled={busy} onClick={() => void submitReflection()}>
                {busy ? "Saving…" : "Save reflection"}
              </button>
            </div>
          ) : null}
          {(lesson.takeaways || []).length ? (
            <div className="takeaways">
              {(lesson.takeaways || []).map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function SavedAnswer({ question, value }: { question: SurveyQuestion; value: string }) {
  return (
    <article className="lesson-checkpoint-saved">
      <strong>
        <LinkedText text={question.label} />
      </strong>
      <p>
        <SurveyAnswerValue value={value} type={question.type} />
      </p>
    </article>
  );
}

function CheckpointField({
  question,
  value,
  onChange,
}: {
  question: SurveyQuestion;
  value: string;
  onChange: (value: string) => void;
}) {
  const fieldId = `checkpoint-${question.id}`;
  return (
    <div className="plan-field">
      <label {...(question.type === "multi_select" ? {} : { htmlFor: fieldId })}>
        <strong>
          <LinkedText text={question.label} />
          {question.required ? " *" : ""}
        </strong>
      </label>
      {question.helperText ? <p className="muted small">{question.helperText}</p> : null}
      {question.type === "multi_select" ? (
        <div className="survey-choice-list bmcr-challenges" role="group" aria-label={question.label}>
          {question.options.map((option) => {
            const selected = value
              .split(";")
              .map((item) => item.trim())
              .filter(Boolean);
            const on = selected.includes(option);
            return (
              <label className={`roster-check${on ? " bmcr-tag-on" : ""}`} key={option}>
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
      ) : (
        <textarea
          id={fieldId}
          rows={question.type === "short_text" ? 3 : 4}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}
