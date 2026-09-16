"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  attachSurveyToChapter,
  deleteCustomSurvey,
  emptySurveyDraft,
  fetchCourseChapters,
  fetchCustomSurveys,
  newSurveyQuestion,
  isBmcrBlock,
  isInfoBlock,
  questionNeedsOptions,
  saveCustomSurvey,
  setCustomSurveyActive,
  slugifySurveyTitle,
  studentSurveyPath,
  SURVEY_PLACE_END,
  SURVEY_PLACE_START,
  SURVEY_QUESTION_TYPES,
  task2SelfEvaluationDraft,
  type CourseChapterOption,
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
  const [chapters, setChapters] = useState<CourseChapterOption[]>([]);
  const [attachChapter, setAttachChapter] = useState<Record<string, string>>({});
  const [attachAfter, setAttachAfter] = useState<Record<string, string>>({});
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
    fetchCourseChapters().then((result) => {
      if (result.ok) setChapters(result.data);
    });
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

  const attach = async (survey: CustomSurvey) => {
    const chapterId = attachChapter[survey.id] || chapters[0]?.id || "";
    const afterLessonId = attachAfter[survey.id] || SURVEY_PLACE_END;
    setBusy(true);
    const result = await attachSurveyToChapter(survey, chapterId, afterLessonId);
    setBusy(false);
    if (!result.ok) {
      setNotice(result.error || "Could not add this survey to the chapter.");
      return;
    }
    const chapter = chapters.find((item) => item.id === chapterId);
    const afterLesson = chapter?.lessons.find((lesson) => lesson.id === afterLessonId);
    const place =
      afterLessonId === SURVEY_PLACE_START
        ? "at the start"
        : afterLesson
          ? `after “${afterLesson.title}”`
          : "at the end";
    setNotice(`Added “${survey.title}” to ${chapter?.title || "the chapter"} ${place}.`);
    await load();
    const refreshed = await fetchCourseChapters();
    if (refreshed.ok) setChapters(refreshed.data);
  };

  return (
    <div className="survey-manager">
      <div className="coach-head">
        <div>
          <h1>Custom surveys</h1>
          <p className="muted">Build forms without code, then place them after any lesson in a chapter so they appear in the student sidebar.</p>
        </div>
        <div className="actions">
          <button className="primary" type="button" onClick={startNew}>
            New survey
          </button>
          <button
            className="ghost"
            type="button"
            onClick={() => {
              setEditingId(null);
              setDraft(task2SelfEvaluationDraft());
              setNotice("");
            }}
          >
            Task 2 self-evaluation template
          </button>
        </div>
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
                  {survey.questions.length} question{survey.questions.length === 1 ? "" : "s"}
                  {survey.isActive ? " · Active for students" : " · Draft"}
                </p>
                {chapters.length ? (
                  <div className="survey-attach-row">
                    <label className="survey-attach-field">
                      Chapter
                      <select
                        className="select-line"
                        value={attachChapter[survey.id] || chapters[0].id}
                        onChange={(event) => {
                          const chapterId = event.target.value;
                          setAttachChapter((current) => ({ ...current, [survey.id]: chapterId }));
                          setAttachAfter((current) => ({ ...current, [survey.id]: SURVEY_PLACE_END }));
                        }}
                        aria-label={`Chapter for ${survey.title}`}
                      >
                        {chapters.map((chapter) => (
                          <option key={chapter.id} value={chapter.id}>
                            {chapter.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="survey-attach-field">
                      After which lesson
                      <select
                        className="select-line"
                        value={attachAfter[survey.id] || SURVEY_PLACE_END}
                        onChange={(event) =>
                          setAttachAfter((current) => ({ ...current, [survey.id]: event.target.value }))
                        }
                        aria-label={`Place ${survey.title} after which lesson`}
                      >
                        <option value={SURVEY_PLACE_START}>At the start of the chapter</option>
                        {(chapters.find((chapter) => chapter.id === (attachChapter[survey.id] || chapters[0].id))?.lessons || []).map(
                          (lesson) => (
                            <option key={lesson.id} value={lesson.id}>
                              After: {lesson.title}
                            </option>
                          )
                        )}
                        <option value={SURVEY_PLACE_END}>At the end of the chapter</option>
                      </select>
                    </label>
                    <button className="ghost" type="button" disabled={busy} onClick={() => void attach(survey)}>
                      Add to chapter
                    </button>
                  </div>
                ) : null}
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
        const bmcr = isBmcrBlock(question.type);
        return (
        <article className={`survey-question-card${info ? " survey-info-block" : ""}${bmcr ? " survey-bmcr-block" : ""}`} key={question.id}>
          <div className="survey-question-head">
            <strong>{info ? `Info block ${index + 1}` : bmcr ? `BMCR block ${index + 1}` : `Question ${index + 1}`}</strong>
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
                label: isBmcrBlock(type) && !question.label.trim() ? "BMCR Calculator" : question.label,
                helperText:
                  isBmcrBlock(type) && !question.helperText.trim()
                    ? "Enter marks from your marked attempt. Basic Marks % and BMCR update as you type."
                    : question.helperText,
                options: questionNeedsOptions(type)
                  ? question.options.length
                    ? question.options
                    : type === "multi_select"
                      ? ["Procrastination", "Self-doubt", "Mental Block"]
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
            placeholder={
              info ? "Refer back to this lesson" : bmcr ? "BMCR Calculator" : "How are you finding the course?"
            }
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
          {bmcr ? (
            <p className="muted small">
              Students get an interactive marks table (Basic, Average, Higher Grade, Question Total) with live Basic
              Marks % and BMCR, plus coaching feedback. Results save to assignment BMCR evaluations.
            </p>
          ) : null}
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
        <button
          className="ghost"
          type="button"
          onClick={() => onChange({ ...draft, questions: [...draft.questions, newSurveyQuestion("bmcr_calculator")] })}
        >
          + Add BMCR calculator
        </button>
        <button
          className="ghost"
          type="button"
          onClick={() => onChange({ ...draft, questions: [...draft.questions, newSurveyQuestion("multi_select")] })}
        >
          + Add multi-select
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
