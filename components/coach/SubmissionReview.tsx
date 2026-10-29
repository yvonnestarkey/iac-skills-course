"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CannedResponsePicker from "@/components/coach/CannedResponsePicker";
import FeedbackDocument from "@/components/coach/FeedbackDocument";
import BmcrCalculator from "@/components/lesson/BmcrCalculator";
import LinkedText from "@/components/ui/LinkedText";
import SurveyAnswerValue from "@/components/ui/SurveyAnswerValue";
import {
  fetchSurveySubmission,
  isBmcrBlock,
  isInfoBlock,
  saveSurveyReview,
  surveyPdfUploads,
  surveyResponseStatusClass,
  surveyResponseStatusLabel,
  uploadCoachFeedbackFile,
  type CustomSurvey,
  type CustomSurveyResponse,
  type SurveyResponseStatus,
} from "@/lib/custom-surveys";
import FeedbackLog from "@/components/feedback/FeedbackLog";
import StudentProfileLink from "@/components/coach/StudentProfileLink";
import { hasWrittenFeedback, parseFeedbackLog } from "@/lib/feedback-log";
import { fetchLessonBmcrEvaluation, parseBmcrAnswer, withDiagnostics, type BmcrValue } from "@/lib/bmcr";
import { formatSastDateTime } from "@/lib/dates";
import {
  fetchLessonSubmissionReview,
  fileNameFromUrl,
  isLessonQueueId,
  saveLessonSubmissionReview,
  type LessonSubmissionReview,
} from "@/lib/student-submissions";

const REVIEW_STATUSES: SurveyResponseStatus[] = ["graded", "rejected", "resubmit"];

function lessonStatusLabel(status: string): string {
  if (status === "approved") return "Graded";
  if (status === "rejected") return "Rejected";
  return "Submitted";
}

export default function SubmissionReview({ id, kind }: { id: string; kind?: "lesson" | "survey" }) {
  const router = useRouter();
  const [survey, setSurvey] = useState<CustomSurvey | null>(null);
  const [response, setResponse] = useState<CustomSurveyResponse | null>(null);
  const [lesson, setLesson] = useState<LessonSubmissionReview | null>(null);
  const [bmcr, setBmcr] = useState<BmcrValue | null>(null);
  const [status, setStatus] = useState<SurveyResponseStatus>("graded");
  const [grade, setGrade] = useState("");
  const [feedback, setFeedback] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [outcomeOpen, setOutcomeOpen] = useState(true);
  const [gradeOpen, setGradeOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = kind === "lesson" || isLessonQueueId(id)
      ? fetchLessonSubmissionReview(id).then(async (result) => {
          if (cancelled) return;
          setLoading(false);
          if (!result.ok || !result.review) {
            setError(result.error || "This submission could not be found.");
            return;
          }
          setLesson(result.review);
          const reviewed = result.review.status === "approved" || result.review.status === "rejected" || hasWrittenFeedback(result.review.feedback);
          setStatus(result.review.status === "submitted" ? "graded" : result.review.status === "approved" ? "graded" : "rejected");
          setFeedback("");
          setFileUrl(result.review.feedbackFileUrl || "");
          setOutcomeOpen(!reviewed);
          setGradeOpen(!reviewed);
          const marks = await fetchLessonBmcrEvaluation(result.review.student_id, result.review.lesson_id);
          if (!cancelled && marks) setBmcr(withDiagnostics(marks));
        })
      : fetchSurveySubmission(id).then((result) => {
          if (cancelled) return;
          setLoading(false);
          if (!result.ok) {
            setError(result.error || "Could not load this submission.");
            return;
          }
          if (!result.survey || !result.response) {
            setError("This submission could not be found.");
            return;
          }
          setSurvey(result.survey);
          setResponse(result.response);
          const reviewed = result.response.status !== "submitted" || hasWrittenFeedback(result.response.feedback);
          setStatus(result.response.status === "submitted" ? "graded" : result.response.status);
          setGrade(result.response.grade == null ? "" : String(result.response.grade));
          setFeedback("");
          setFileUrl(result.response.feedbackFileUrl || "");
          setOutcomeOpen(!reviewed);
          setGradeOpen(!reviewed);
        });
    void load;
    return () => {
      cancelled = true;
    };
  }, [id, kind]);

  const save = async () => {
    if (lesson) {
      setBusy(true);
      setNotice("");
      const result = await saveLessonSubmissionReview({
        id: lesson.id || id,
        status,
        feedback,
        feedbackFileUrl: fileUrl,
      });
      setBusy(false);
      if (!result.ok) {
        setNotice(result.error || "Could not save this review.");
        return;
      }
      if (result.review) setLesson(result.review);
      setFeedback("");
      setOutcomeOpen(false);
      setGradeOpen(false);
      setNotice(result.error || "Review saved. The student has been notified.");
      return;
    }
    if (!response || !survey) return;
    if (survey.requiresGrade && status === "graded" && grade.trim() === "") {
      setNotice("Add a numeric grade, or change the status.");
      return;
    }
    const parsed = grade.trim() === "" ? null : Number(grade);
    if (grade.trim() && !Number.isFinite(parsed)) {
      setNotice("Grade must be a number.");
      return;
    }
    setBusy(true);
    setNotice("");
    const result = await saveSurveyReview({
      id: response.id,
      status,
      grade: parsed,
      feedback,
      feedbackFileUrl: fileUrl,
    });
    setBusy(false);
    if (!result.ok) {
      setNotice(result.error || "Could not save this review.");
      return;
    }
    if (result.response) {
      setResponse({
        ...response,
        ...result.response,
        studentName: response.studentName,
        studentEmail: response.studentEmail,
        gradedByName: result.response.gradedByName || "You",
      });
    }
    setFeedback("");
    setOutcomeOpen(false);
    setGradeOpen(false);
    setNotice(result.error || "Review saved. The student has been notified.");
  };

  const pickFile = async (file: File | null) => {
    if (!file || (!survey && !lesson)) return;
    setUploading(true);
    setNotice("");
    const result = await uploadCoachFeedbackFile(
      file,
      survey?.id || "lesson-assignments",
      response?.id || lesson?.id || id
    );
    setUploading(false);
    if (!result.ok || !result.url) {
      setNotice(result.error || "Could not upload that file.");
      return;
    }
    setFileUrl(result.url);
    setFileName(result.name || file.name);
    setNotice("Feedback file uploaded. Save the review to keep it on this submission.");
  };

  if (loading) {
    return (
      <div className="coach-page">
        <p className="empty">Loading submission…</p>
      </div>
    );
  }

  if (!lesson && (!survey || !response)) {
    return (
      <div className="coach-page">
        <button className="back-link" type="button" onClick={() => router.push("/coach/lists")}>
          ← Submissions
        </button>
        <p className="empty">{error || "Submission not found."}</p>
      </div>
    );
  }

  const pdfs = survey && response ? surveyPdfUploads(survey, response.answers) : [];
  if (lesson?.link_url) pdfs.unshift({ url: lesson.link_url, name: fileNameFromUrl(lesson.link_url) });
  const title = lesson?.lessonTitle || survey?.title || "Submission";
  const studentName = lesson?.studentName || response?.studentName || "Student";
  const studentId = lesson?.student_id || response?.studentId || "";
  const studentEmail = lesson?.studentEmail || response?.studentEmail || "";
  const submittedAt = lesson?.submittedAt || response?.createdAt || "";
  return (
    <div className="coach-page submission-review">
      <button className="back-link" type="button" onClick={() => router.push("/coach/lists")}>
        ← Submissions
      </button>
      <div className="coach-head">
        <div>
          <p className="kicker">{lesson || survey?.isAssignment ? "Assignment" : "Survey"}</p>
          <h1>{title}</h1>
          <p className="muted">
            <StudentProfileLink studentId={studentId}>{studentName}</StudentProfileLink>
            {studentEmail ? ` · ${studentEmail}` : ""}
            {submittedAt ? ` · submitted ${formatSastDateTime(submittedAt) || submittedAt}` : ""}
          </p>
        </div>
        <span className={`badge ${surveyResponseStatusClass(lesson ? (lesson.status === "approved" ? "graded" : lesson.status === "rejected" ? "rejected" : "submitted") : response!.status)}`}>
          {lesson ? lessonStatusLabel(lesson.status) : surveyResponseStatusLabel(response!.status)}
        </span>
      </div>
      {pdfs.length ? (
        <div className="actions submission-review-pdfs">
          {pdfs.map((file) => (
            <a key={file.url} className="primary" href={file.url} target="_blank" rel="noopener noreferrer">
              Open student PDF{file.name ? `: ${file.name}` : ""} ↗
            </a>
          ))}
        </div>
      ) : null}
      {error ? <div className="notice">{error}</div> : null}

      <div className="submission-review-stack">
        <section className="card survey-rich-text">
          <h2>Student submission</h2>
          <div className="work-list">
            {lesson ? (
              <>
                {lesson.body.trim() ? (
                  <article className="work-item">
                    <strong>Notes</strong>
                    <p>
                      <LinkedText text={lesson.body} />
                    </p>
                  </article>
                ) : null}
                {bmcr ? (
                  <article className="work-item">
                    <strong>BMCR calculator</strong>
                    <BmcrCalculator value={bmcr} readOnly idPrefix="review-lesson-bmcr" />
                  </article>
                ) : null}
                {!lesson.body.trim() && !bmcr ? (
                  <p className="muted small">No written notes on this upload. Open the PDF above to review the script.</p>
                ) : null}
              </>
            ) : (
              survey!.questions.map((question) =>
                isInfoBlock(question.type) ? (
                  <article className="work-item" key={question.id}>
                    <strong>
                      <LinkedText text={question.label} />
                    </strong>
                    {question.helperText ? (
                      <p className="muted small">
                        <LinkedText text={question.helperText} />
                      </p>
                    ) : null}
                  </article>
                ) : (
                  <article className="work-item" key={question.id}>
                    <strong>
                      <LinkedText text={question.label} />
                    </strong>
                    {isBmcrBlock(question.type) ? (
                      <BmcrCalculator
                        value={parseBmcrAnswer(response!.answers[question.id])}
                        readOnly
                        idPrefix={`review-${question.id}`}
                      />
                    ) : (
                      <p>
                        <SurveyAnswerValue value={response!.answers[question.id]} type={question.type} />
                      </p>
                    )}
                  </article>
                )
              )
            )}
          </div>
        </section>

        <section className="card feedback-review-card">
          <h2>Feedback & grading</h2>
          <p className="muted small">
            {survey?.requiresGrade
              ? "This form requires a numeric score as well as a status."
              : "Previous comments stay in the log. Start from a canned response, edit it on the page, and send. Follow-up notes are added without rewriting what you already sent."}
          </p>
          {parseFeedbackLog(lesson?.feedback || response?.feedback).length ? (
            <div className="logged-feedback">
              <p className="student-notes-label">Comments</p>
              <FeedbackLog raw={lesson?.feedback || response?.feedback} />
            </div>
          ) : null}
          <CannedResponsePicker
            lessonTitle={title}
            value={feedback}
            onChange={setFeedback}
          />
          <label className="student-notes-label" htmlFor="submission-feedback">
            {parseFeedbackLog(lesson?.feedback || response?.feedback).length ? "Add notes" : "Feedback"}
          </label>
          <FeedbackDocument
            id="submission-feedback"
            value={feedback}
            onChange={setFeedback}
            placeholder={
              parseFeedbackLog(lesson?.feedback || response?.feedback).length
                ? "Add a follow-up note, or pick a canned response above. This is saved as a new log entry; earlier comments stay as they are."
                : "Pick a canned response above, or write here. Bold, lists, links and emoji work the same way the student will see them."
            }
          />
          <p className="student-notes-label">Status</p>
          {outcomeOpen ? (
            <div className="filters">
              {REVIEW_STATUSES.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={status === item ? "active" : ""}
                  onClick={() => setStatus(item)}
                >
                  {surveyResponseStatusLabel(item)}
                </button>
              ))}
            </div>
          ) : (
            <div className="actions">
              <span className={`badge ${surveyResponseStatusClass(status)}`}>{surveyResponseStatusLabel(status)}</span>
              <button className="ghost" type="button" onClick={() => setOutcomeOpen(true)}>
                Change status
              </button>
            </div>
          )}
          {survey?.requiresGrade ? (
            gradeOpen ? (
              <>
                <label className="student-notes-label" htmlFor="submission-grade">
                  Grade
                </label>
                <input
                  id="submission-grade"
                  className="select-line"
                  type="number"
                  step="0.5"
                  value={grade}
                  onChange={(event) => setGrade(event.target.value)}
                  placeholder="e.g. 72"
                />
              </>
            ) : (
              <div className="actions">
                <p className="student-notes-label">Grade</p>
                <strong>{grade.trim() || "—"}</strong>
                <button className="ghost" type="button" onClick={() => setGradeOpen(true)}>
                  Change grade
                </button>
              </div>
            )
          ) : null}
          <label className="student-notes-label" htmlFor="submission-feedback-file">
            File attachment
          </label>
          <input
            id="submission-feedback-file"
            className="select-line"
            type="file"
            accept="application/pdf,.pdf,.doc,.docx,.png,.jpg,.jpeg"
            disabled={busy || uploading}
            onChange={(event) => {
              const chosen = event.target.files?.[0];
              event.target.value = "";
              if (!chosen) return;
              const copy = new File([chosen], chosen.name, {
                type: chosen.type || "application/pdf",
                lastModified: chosen.lastModified,
              });
              void pickFile(copy);
            }}
          />
          <p className="muted small">{uploading ? "Uploading…" : "Optional. Upload a marked PDF or notes to return to the student."}</p>
          {fileUrl ? (
            <div className="actions">
              <a className="ghost" href={fileUrl} target="_blank" rel="noopener noreferrer">
                {fileName || "Open attached file ↗"}
              </a>
              <button className="ghost" type="button" onClick={() => setFileUrl("")}>
                Remove file
              </button>
            </div>
          ) : null}
          {notice ? <p className="notice">{notice}</p> : null}
          {lesson?.gradedAt || response?.gradedAt ? (
            <p className="muted small">
              Last reviewed {formatSastDateTime(lesson?.gradedAt || response?.gradedAt || "") || lesson?.gradedAt || response?.gradedAt}
              {response?.gradedByName ? ` by ${response.gradedByName}` : ""}.
            </p>
          ) : null}
          <div className="actions feedback-review-save">
            <button className="primary" type="button" disabled={busy || uploading} onClick={() => void save()}>
              {busy ? "Saving…" : "Save review"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
