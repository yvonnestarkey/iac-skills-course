"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  attachSurveyToChapter,
  deleteCustomSurvey,
  emptySurveyDraft,
  fetchChapterLessons,
  fetchCourseChapters,
  fetchCustomSurveys,
  newSurveyQuestion,
  isBmcrBlock,
  isInfoBlock,
  isPdfUploadBlock,
  questionNeedsOptions,
  saveCustomSurvey,
  setCustomSurveyActive,
  slugifySurveyTitle,
  studentSurveyPath,
  uploadSurveyPdf,
  SURVEY_PLACE_END,
  SURVEY_PLACE_START,
  SURVEY_QUESTION_TYPES,
  task2SelfEvaluationDraft,
  type ChapterLessonOption,
  type CourseChapterOption,
  type CustomSurvey,
  type SurveyDraft,
  type SurveyQuestion,
  type SurveyQuestionType,
} from "@/lib/custom-surveys";

function SurveyPlacementFields({
  chapters,
  chapterId,
  afterLessonId,
  lessons,
  loading,
  onChapterChange,
  onAfterChange,
  allowSkip = false,
  surveyTitle,
  children,
}: {
  chapters: CourseChapterOption[];
  chapterId: string;
  afterLessonId: string;
  lessons: ChapterLessonOption[];
  loading: boolean;
  onChapterChange: (chapterId: string) => void;
  onAfterChange: (afterLessonId: string) => void;
  allowSkip?: boolean;
  surveyTitle: string;
  children?: ReactNode;
}) {
  if (!chapters.length) {
    return <p className="muted small">No live chapters yet, so this survey cannot be inserted into the course yet.</p>;
  }
  return (
    <div className="survey-attach-row">
      <label className="survey-attach-field">
        Chapter
        <select
          className="select-line"
          value={chapterId}
          onChange={(event) => onChapterChange(event.target.value)}
          aria-label={`Chapter for ${surveyTitle}`}
        >
          {allowSkip ? <option value="">Don&apos;t add to a chapter yet</option> : null}
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
          value={afterLessonId}
          onChange={(event) => onAfterChange(event.target.value)}
          aria-label={`Place ${surveyTitle} after which lesson`}
          disabled={!chapterId}
        >
          <option value={SURVEY_PLACE_START}>At the start of the chapter</option>
          {loading ? (
            <option value="" disabled>
              Loading lessons in this chapter…
            </option>
          ) : null}
          {lessons.map((lesson) => (
            <option key={lesson.id} value={lesson.id}>
              After: {lesson.title}
            </option>
          ))}
          <option value={SURVEY_PLACE_END}>At the end of the chapter</option>
        </select>
      </label>
      {children}
    </div>
  );
}

function draftFromSurvey(survey: CustomSurvey): SurveyDraft {
  return {
    title: survey.title,
    description: survey.description,
    slug: survey.slug,
    isActive: survey.isActive,
    pdfUrl: survey.pdfUrl || "",
    questions: survey.questions.length ? survey.questions : [newSurveyQuestion()],
  };
}

export default function SurveyManager() {
  const router = useRouter();
  const [surveys, setSurveys] = useState<CustomSurvey[]>([]);
  const [chapters, setChapters] = useState<CourseChapterOption[]>([]);
  const [chapterLessons, setChapterLessons] = useState<Record<string, ChapterLessonOption[]>>({});
  const [lessonsLoading, setLessonsLoading] = useState<Record<string, boolean>>({});
  const [attachChapter, setAttachChapter] = useState<Record<string, string>>({});
  const [attachAfter, setAttachAfter] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SurveyDraft | null>(null);
  const [draftChapterId, setDraftChapterId] = useState("");
  const [draftAfterId, setDraftAfterId] = useState(SURVEY_PLACE_END);

  const load = async () => {
    const result = await fetchCustomSurveys();
    if (!result.ok) {
      setError(result.error || "Could not load surveys.");
      return;
    }
    setError("");
    setSurveys(result.data);
  };

  const loadChapterLessons = async (chapterId: string) => {
    if (!chapterId) return;
    setLessonsLoading((current) => ({ ...current, [chapterId]: true }));
    const result = await fetchChapterLessons(chapterId);
    setChapterLessons((current) => ({ ...current, [chapterId]: result.ok ? result.data : [] }));
    setLessonsLoading((current) => ({ ...current, [chapterId]: false }));
  };

  useEffect(() => {
    void load();
    fetchCourseChapters().then((result) => {
      if (!result.ok) {
        setError(result.error || "Could not load course chapters.");
        return;
      }
      setChapters(result.data);
      const first = result.data[0]?.id;
      if (first) void loadChapterLessons(first);
    });
  }, []);

  useEffect(() => {
    if (!draft || editingId || draftChapterId || !chapters[0]?.id) return;
    setDraftChapterId(chapters[0].id);
    void loadChapterLessons(chapters[0].id);
  }, [draft, editingId, draftChapterId, chapters]);

  const startNew = () => {
    const chapterId = chapters[0]?.id || "";
    setEditingId(null);
    setDraft(emptySurveyDraft());
    setDraftChapterId(chapterId);
    setDraftAfterId(SURVEY_PLACE_END);
    setNotice("");
    if (chapterId) void loadChapterLessons(chapterId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startEdit = (survey: CustomSurvey) => {
    setEditingId(survey.id);
    setDraft(draftFromSurvey(survey));
    setDraftChapterId("");
    setDraftAfterId(SURVEY_PLACE_END);
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    if (!result.ok || !result.survey) {
      setBusy(false);
      setNotice(result.error || "Could not save.");
      return;
    }
    let placeNote = "Survey saved.";
    if (draftChapterId) {
      const attached = await attachSurveyToChapter(result.survey, draftChapterId, draftAfterId);
      if (!attached.ok) {
        setBusy(false);
        setNotice(attached.error || "Survey saved, but it could not be inserted into the chapter.");
        setDraft(null);
        setEditingId(null);
        await load();
        return;
      }
      const chapter = chapters.find((item) => item.id === draftChapterId);
      const afterLesson = (chapterLessons[draftChapterId] || []).find((lesson) => lesson.id === draftAfterId);
      const place =
        draftAfterId === SURVEY_PLACE_START
          ? "at the start"
          : afterLesson
            ? `after “${afterLesson.title}”`
            : "at the end";
      placeNote = `Survey saved and added to ${chapter?.title || "the chapter"} ${place}.`;
      await loadChapterLessons(draftChapterId);
    }
    setBusy(false);
    setNotice(placeNote);
    setDraft(null);
    setEditingId(null);
    setDraftChapterId("");
    setDraftAfterId(SURVEY_PLACE_END);
    await load();
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    const afterLesson = (chapterLessons[chapterId] || []).find((lesson) => lesson.id === afterLessonId);
    const place =
      afterLessonId === SURVEY_PLACE_START
        ? "at the start"
        : afterLesson
          ? `after “${afterLesson.title}”`
          : "at the end";
    setNotice(`Added “${survey.title}” to ${chapter?.title || "the chapter"} ${place}.`);
    await load();
    await loadChapterLessons(chapterId);
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
              const chapterId = chapters[0]?.id || "";
              setEditingId(null);
              setDraft(task2SelfEvaluationDraft());
              setDraftChapterId(chapterId);
              setDraftAfterId(SURVEY_PLACE_END);
              setNotice("");
              if (chapterId) void loadChapterLessons(chapterId);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            Task 2 self-evaluation template
          </button>
        </div>
      </div>
      {error ? <div className="notice">{error}</div> : null}
      {notice ? <div className="notice">{notice}</div> : null}

      {draft ? (
        <SurveyEditor
          draft={draft}
          editingId={editingId}
          busy={busy}
          chapters={chapters}
          chapterId={draftChapterId}
          afterLessonId={draftAfterId}
          lessons={chapterLessons[draftChapterId] || []}
          lessonsLoading={Boolean(lessonsLoading[draftChapterId])}
          onChapterChange={(chapterId) => {
            setDraftChapterId(chapterId);
            setDraftAfterId(SURVEY_PLACE_END);
            if (chapterId) void loadChapterLessons(chapterId);
          }}
          onAfterChange={setDraftAfterId}
          onChange={setDraft}
          onChangeQuestion={updateQuestion}
          onMoveQuestion={moveQuestion}
          onSave={save}
          onCancel={() => {
            setDraft(null);
            setEditingId(null);
            setDraftChapterId("");
            setDraftAfterId(SURVEY_PLACE_END);
          }}
        />
      ) : null}

      <section className="card">
        <h2>Surveys</h2>
        {surveys.length ? (
          <div className="work-list">
            {surveys.map((survey) => {
              const selectedChapterId = attachChapter[survey.id] || chapters[0]?.id || "";
              const lessons = chapterLessons[selectedChapterId] || [];
              const loadingLessons = Boolean(lessonsLoading[selectedChapterId]);
              return (
              <article className="work-item" key={survey.id}>
                <div className="work-head">
                  <strong>{survey.title}</strong>
                  <span className={`badge ${survey.isActive ? "ok" : ""}`}>{survey.isActive ? "Active" : "Draft"}</span>
                </div>
                <p className="muted small">
                  {survey.questions.length} question{survey.questions.length === 1 ? "" : "s"}
                  {survey.pdfUrl ? " · Includes PDF" : ""}
                  {survey.isActive ? " · Active for students" : " · Draft"}
                </p>
                {chapters.length ? (
                  <SurveyPlacementFields
                    chapters={chapters}
                    chapterId={selectedChapterId || chapters[0].id}
                    afterLessonId={attachAfter[survey.id] || SURVEY_PLACE_END}
                    lessons={lessons}
                    loading={loadingLessons}
                    surveyTitle={survey.title}
                    onChapterChange={(chapterId) => {
                      setAttachChapter((current) => ({ ...current, [survey.id]: chapterId }));
                      setAttachAfter((current) => ({ ...current, [survey.id]: SURVEY_PLACE_END }));
                      void loadChapterLessons(chapterId);
                    }}
                    onAfterChange={(afterLessonId) =>
                      setAttachAfter((current) => ({ ...current, [survey.id]: afterLessonId }))
                    }
                  >
                    <button className="ghost" type="button" disabled={busy} onClick={() => void attach(survey)}>
                      Add to chapter
                    </button>
                  </SurveyPlacementFields>
                ) : (
                  <p className="muted small">Load live chapters to insert this survey into the course.</p>
                )}
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
              );
            })}
          </div>
        ) : (
          <p className="empty">No custom surveys yet. Create one to start collecting answers.</p>
        )}
      </section>
    </div>
  );
}

function SurveyEditor({
  draft,
  editingId,
  busy,
  chapters,
  chapterId,
  afterLessonId,
  lessons,
  lessonsLoading,
  onChapterChange,
  onAfterChange,
  onChange,
  onChangeQuestion,
  onMoveQuestion,
  onSave,
  onCancel,
}: {
  draft: SurveyDraft;
  editingId: string | null;
  busy: boolean;
  chapters: CourseChapterOption[];
  chapterId: string;
  afterLessonId: string;
  lessons: ChapterLessonOption[];
  lessonsLoading: boolean;
  onChapterChange: (chapterId: string) => void;
  onAfterChange: (afterLessonId: string) => void;
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
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [pdfNotice, setPdfNotice] = useState("");

  const pickPdf = async (file: File | null) => {
    if (!file) return;
    setUploadingPdf(true);
    setPdfNotice("");
    const result = await uploadSurveyPdf(file);
    setUploadingPdf(false);
    if (!result.ok || !result.url) {
      setPdfNotice(result.error || "Could not upload that PDF. Paste a public URL instead.");
      return;
    }
    onChange({ ...draft, pdfUrl: result.url });
    setPdfNotice("PDF uploaded.");
  };

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
      <label className="student-notes-label" htmlFor="survey-pdf">
        Downloadable PDF
      </label>
      <input
        id="survey-pdf"
        className="select-line"
        type="url"
        value={draft.pdfUrl}
        onChange={(event) => onChange({ ...draft, pdfUrl: event.target.value })}
        placeholder="https://… (optional)"
      />
      <input
        className="select-line"
        type="file"
        accept="application/pdf,.pdf"
        disabled={busy || uploadingPdf}
        onChange={(event) => {
          void pickPdf(event.target.files && event.target.files[0]);
          event.target.value = "";
        }}
      />
      <p className="muted small">
        Optional. Shown under the description so students can download a question paper, complete the work, then submit
        results here. Paste a public URL or upload a PDF.
        {uploadingPdf ? " Uploading…" : ""}
      </p>
      {pdfNotice ? <p className="muted small">{pdfNotice}</p> : null}
      {draft.pdfUrl.trim() ? (
        <div className="actions">
          <a className="ghost" href={draft.pdfUrl.trim()} target="_blank" rel="noopener noreferrer">
            Preview current PDF
          </a>
          <button className="ghost" type="button" onClick={() => onChange({ ...draft, pdfUrl: "" })}>
            Remove PDF
          </button>
        </div>
      ) : null}
      <label className="roster-check">
        <input
          type="checkbox"
          checked={draft.isActive}
          onChange={(event) => onChange({ ...draft, isActive: event.target.checked })}
        />
        Active — students can open and submit this survey
      </label>

      <h3>Insert into course</h3>
      <p className="muted small">
        Choose the chapter and the lesson this survey should follow. Leave the chapter blank if you only want to save the form for now.
      </p>
      <SurveyPlacementFields
        chapters={chapters}
        chapterId={chapterId}
        afterLessonId={afterLessonId}
        lessons={lessons}
        loading={lessonsLoading}
        surveyTitle={draft.title || "this survey"}
        allowSkip
        onChapterChange={onChapterChange}
        onAfterChange={onAfterChange}
      />

      <h3>Questions and info blocks</h3>
      {draft.questions.map((question, index) => {
        const info = isInfoBlock(question.type);
        const bmcr = isBmcrBlock(question.type);
        const pdfUpload = isPdfUploadBlock(question.type);
        return (
        <article className={`survey-question-card${info ? " survey-info-block" : ""}${bmcr ? " survey-bmcr-block" : ""}${pdfUpload ? " survey-pdf-block" : ""}`} key={question.id}>
          <div className="survey-question-head">
            <strong>
              {info
                ? `Info block ${index + 1}`
                : bmcr
                  ? `BMCR block ${index + 1}`
                  : pdfUpload
                    ? `PDF upload ${index + 1}`
                    : `Question ${index + 1}`}
            </strong>
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
                label: !question.label.trim()
                  ? type === "bmcr_calculator"
                    ? "BMCR Calculator"
                    : type === "pdf_upload"
                      ? "Upload your PDF"
                      : question.label
                  : question.label,
                helperText: !question.helperText.trim()
                  ? type === "bmcr_calculator"
                    ? "Enter marks from your marked attempt. Basic Marks % and BMCR update as you type."
                    : type === "pdf_upload"
                      ? "PDF only. Scan or export your completed work as a single file."
                      : question.helperText
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
              info
                ? "Refer back to this lesson"
                : bmcr
                  ? "BMCR Calculator"
                  : pdfUpload
                    ? "Upload your completed attempt"
                    : "How are you finding the course?"
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
                : pdfUpload
                  ? "Optional note under the upload, e.g. Scan the whole attempt as a single PDF."
                  : "Optional hint under the question. URLs become clickable."
            }
          />
          {bmcr ? (
            <p className="muted small">
              Students get an interactive marks table (Basic, Average, Higher Grade, Question Total) with live Basic
              Marks % and BMCR, plus coaching feedback. Results save to assignment BMCR evaluations.
            </p>
          ) : null}
          {pdfUpload ? (
            <p className="muted small">
              Students get a PDF file picker on this question. Tick Required if they must upload a file before they can
              submit.
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
        <button
          className="ghost"
          type="button"
          onClick={() => onChange({ ...draft, questions: [...draft.questions, newSurveyQuestion("pdf_upload")] })}
        >
          + Add PDF upload
        </button>
        <button className="primary" type="button" disabled={busy || uploadingPdf} onClick={onSave}>
          {busy ? "Saving…" : uploadingPdf ? "Uploading…" : "Save survey"}
        </button>
        <button className="ghost" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}
