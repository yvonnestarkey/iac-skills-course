"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteCustomSurvey,
  emptySurveyDraft,
  fetchCustomSurveys,
  newSurveyQuestion,
  isInfoBlock,
  questionNeedsOptions,
  saveCustomSurvey,
  setCustomSurveyActive,
  slugifySurveyTitle,
  studentSurveyPath,
  SURVEY_QUESTION_TYPES,
  type CustomSurvey,
  type SurveyDraft,
  type SurveyQuestion,
  type SurveyQuestionType,
} from "@/lib/custom-surveys";

function draftFromSurvey(survey: CustomSurvey): SurveyDraft {
  return {
    title: survey.title,
    description: survey.description,
    slug: survey.slug,
    isActive: survey.isActive,
    questions: survey.questions.length ? survey.questions : [newSurveyQuestion()],
  };
}

export default function SurveyManager() {
  const router = useRouter();
  const [surveys, setSurveys] = useState<CustomSurvey[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SurveyDraft | null>(null);

  const load = async () => {
    const result = await fetchCustomSurveys();
    if (!result.ok) {
      setError(result.error || "Could not load surveys.");
      return;
    }
    setError("");
    setSurveys(result.data);
  };

  useEffect(() => {
    void load();
  }, []);

  const startNew = () => {
    setEditingId(null);
    setDraft(emptySurveyDraft());
    setNotice("");
  };

  const startEdit = (survey: CustomSurvey) => {
    setEditingId(survey.id);
    setDraft(draftFromSurvey(survey));
    setNotice("");
  };

  const updateQuestion = (id: string, patch: Partial<SurveyQuestion>) => {
    if (!draft) return;
    setDraft({
      ...draft,
      questions: draft.questions.map((question) => (question.id === id ? { ...question, ...patch } : question)),
    });
  };

  const moveQuestion = (index: number, direction: -1 | 1) => {
    if (!draft) return;
    const next = [...draft.questions];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setDraft({ ...draft, questions: next });
  };

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setNotice("");
    const result = await saveCustomSurvey(draft, editingId || undefined);
    setBusy(false);
    if (!result.ok) {
      setNotice(result.error || "Could not save.");
      return;
    }
    setNotice("Survey saved.");
    setDraft(null);
    setEditingId(null);
    await load();
  };

  const toggleActive = async (survey: CustomSurvey) => {
    const result = await setCustomSurveyActive(survey.id, !survey.isActive);
    if (!result.ok) {
      setNotice(result.error || "Could not update status.");
      return;
    }
    await load();
  };

  const remove = async (survey: CustomSurvey) => {
    if (!window.confirm(`Delete “${survey.title}”? Student responses for this survey will be removed too.`)) return;
    const result = await deleteCustomSurvey(survey.id);
    if (!result.ok) {
      setNotice(result.error || "Could not delete.");
      return;
    }
    if (editingId === survey.id) {
      setDraft(null);
      setEditingId(null);
    }
    await load();
  };

  const copyLink = async (slug: string) => {
    const url = `${window.location.origin}${studentSurveyPath(slug)}`;
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Student link copied.");
    } catch {
      setNotice(url);
    }
  };

  return (
    <div className="survey-manager">
      <div className="coach-head">
        <div>
          <h1>Custom surveys</h1>
          <p className="muted">Build forms without code. Active surveys appear for students at their slug URL.</p>
        </div>
        <button className="primary" type="button" onClick={startNew}>
          New survey
        </button>
      </div>
      {error ? <div className="notice">{error}</div> : null}
      {notice ? <div className="notice">{notice}</div> : null}

      <section className="card">
        <h2>Surveys</h2>
        {surveys.length ? (
          <div className="work-list">
            {surveys.map((survey) => (
              <article className="work-item" key={survey.id}>
                <div className="work-head">
                  <strong>{survey.title}</strong>
                  <span className={`badge ${survey.isActive ? "ok" : ""}`}>{survey.isActive ? "Active" : "Draft"}</span>
                </div>
                <p className="muted small">
                  /student/surveys/{survey.slug} · {survey.questions.length} question
                  {survey.questions.length === 1 ? "" : "s"}
                </p>
                <div className="actions">
                  <button className="ghost" type="button" onClick={() => startEdit(survey)}>
                    Edit
                  </button>
                  <button className="ghost" type="button" onClick={() => toggleActive(survey)}>
                    {survey.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button className="ghost" type="button" onClick={() => router.push(`/coach/surveys/${survey.id}`)}>
                    Results
                  </button>
                  <button className="ghost" type="button" onClick={() => copyLink(survey.slug)}>
                    Copy student link
                  </button>
                  <button className="ghost" type="button" onClick={() => remove(survey)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty">No custom surveys yet. Create one to start collecting answers.</p>
        )}
      </section>

      {draft ? (
        <SurveyEditor
          draft={draft}
          editingId={editingId}
          busy={busy}
          onChange={setDraft}
          onChangeQuestion={updateQuestion}
          onMoveQuestion={moveQuestion}
          onSave={save}
          onCancel={() => {
            setDraft(null);
            setEditingId(null);
          }}
        />
      ) : null}
    </div>
  );
}

function SurveyEditor({
  draft,
  editingId,
  busy,
  onChange,
  onChangeQuestion,
  onMoveQuestion,
  onSave,
  onCancel,
}: {
  draft: SurveyDraft;
  editingId: string | null;
  busy: boolean;
  onChange: (draft: SurveyDraft) => void;
  onChangeQuestion: (id: string, patch: Partial<SurveyQuestion>) => void;
  onMoveQuestion: (index: number, direction: -1 | 1) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const previewPath = useMemo(
    () => studentSurveyPath(draft.slug.trim() || slugifySurveyTitle(draft.title)),
    [draft.slug, draft.title]
  );

  return (
    <section className="card survey-builder">
      <div className="panel-head">
        <div>
          <h2>{editingId ? "Edit survey" : "New survey"}</h2>
          <p className="muted small">Student URL: {previewPath}</p>
        </div>
      </div>
      <label className="student-notes-label" htmlFor="survey-title">
        Title
      </label>
      <input
        id="survey-title"
        className="select-line"
        value={draft.title}
        onChange={(event) =>
          onChange({
            ...draft,
            title: event.target.value,
            slug: draft.slug && draft.slug !== slugifySurveyTitle(draft.title) ? draft.slug : slugifySurveyTitle(event.target.value),
          })
        }
        placeholder="Mid-course check-in"
      />
      <label className="student-notes-label" htmlFor="survey-slug">
        Slug
      </label>
      <input
        id="survey-slug"
        className="select-line"
        value={draft.slug}
        onChange={(event) => onChange({ ...draft, slug: slugifySurveyTitle(event.target.value) })}
        placeholder="mid-course-check-in"
      />
      <label className="student-notes-label" htmlFor="survey-description">
        Description
      </label>
      <textarea
        id="survey-description"
        rows={3}
        value={draft.description}
        onChange={(event) => onChange({ ...draft, description: event.target.value })}
        placeholder="Optional intro shown to students. URLs and [text](https://…) links become clickable."
      />
      <label className="roster-check">
        <input
          type="checkbox"
          checked={draft.isActive}
          onChange={(event) => onChange({ ...draft, isActive: event.target.checked })}
        />
        Active — students can open and submit this survey
      </label>

      <h3>Questions and info blocks</h3>
      {draft.questions.map((question, index) => {
        const info = isInfoBlock(question.type);
        return (
        <article className={`survey-question-card${info ? " survey-info-block" : ""}`} key={question.id}>
          <div className="survey-question-head">
            <strong>{info ? `Info block ${index + 1}` : `Question ${index + 1}`}</strong>
            <div className="actions">
              <button className="ghost" type="button" onClick={() => onMoveQuestion(index, -1)} disabled={index === 0}>
                Up
              </button>
              <button
                className="ghost"
                type="button"
                onClick={() => onMoveQuestion(index, 1)}
                disabled={index === draft.questions.length - 1}
              >
                Down
              </button>
              <button
                className="ghost"
                type="button"
                onClick={() =>
                  onChange({ ...draft, questions: draft.questions.filter((item) => item.id !== question.id) })
                }
                disabled={draft.questions.length === 1}
              >
                Remove
              </button>
            </div>
          </div>
          <label className="student-notes-label">Question type</label>
          <select
            className="select-line"
            value={question.type}
            onChange={(event) => {
              const type = event.target.value as SurveyQuestionType;
              onChangeQuestion(question.id, {
                type,
                required: isInfoBlock(type) ? false : question.required,
                options: questionNeedsOptions(type)
                  ? question.options.length
                    ? question.options
                    : ["Option 1", "Option 2"]
                  : [],
              });
            }}
          >
            {SURVEY_QUESTION_TYPES.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
          <label className="student-notes-label">{info ? "Header text" : "Question label"}</label>
          <input
            className="select-line"
            value={question.label}
            onChange={(event) => onChangeQuestion(question.id, { label: event.target.value })}
            placeholder={info ? "Refer back to this lesson" : "How are you finding the course?"}
          />
          <label className="student-notes-label">{info ? "Body text" : "Helper text"}</label>
          <textarea
            className="select-line"
            rows={info ? 3 : 2}
            value={question.helperText}
            onChange={(event) => onChangeQuestion(question.id, { helperText: event.target.value })}
            placeholder={
              info
                ? "Optional note. URLs and [text](https://…) links become clickable."
                : "Optional hint under the question. URLs become clickable."
            }
          />
          {info ? (
            <>
              <label className="student-notes-label">Resource URL</label>
              <input
                className="select-line"
                type="text"
                value={question.resourceUrl || ""}
                onChange={(event) => onChangeQuestion(question.id, { resourceUrl: event.target.value })}
                placeholder="https://… or /student/lessons/…"
              />
              <p className="muted small">Opens in a new tab on the student survey as “Open Lesson in New Tab ↗”.</p>
            </>
          ) : (
            <label className="roster-check">
              <input
                type="checkbox"
                checked={question.required}
                onChange={(event) => onChangeQuestion(question.id, { required: event.target.checked })}
              />
              Required
            </label>
          )}
          {questionNeedsOptions(question.type) ? (
            <div className="survey-options">
              <p className="muted small">Options</p>
              {question.options.map((option, optionIndex) => (
                <div className="survey-option-row" key={`${question.id}-opt-${optionIndex}`}>
                  <input
                    className="select-line"
                    value={option}
                    onChange={(event) => {
                      const options = [...question.options];
                      options[optionIndex] = event.target.value;
                      onChangeQuestion(question.id, { options });
                    }}
                  />
                  <button
                    className="ghost"
                    type="button"
                    onClick={() =>
                      onChangeQuestion(question.id, {
                        options: question.options.filter((_, current) => current !== optionIndex),
                      })
                    }
                    disabled={question.options.length <= 2}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                className="ghost"
                type="button"
                onClick={() => onChangeQuestion(question.id, { options: [...question.options, `Option ${question.options.length + 1}`] })}
              >
                + Add option
              </button>
            </div>
          ) : null}
        </article>
        );
      })}
      <div className="actions">
        <button className="ghost" type="button" onClick={() => onChange({ ...draft, questions: [...draft.questions, newSurveyQuestion()] })}>
          + Add question
        </button>
        <button
          className="ghost"
          type="button"
          onClick={() => onChange({ ...draft, questions: [...draft.questions, newSurveyQuestion("info_link")] })}
        >
          + Add info / course link
        </button>
        <button className="primary" type="button" disabled={busy} onClick={onSave}>
          {busy ? "Saving…" : "Save survey"}
        </button>
        <button className="ghost" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}
