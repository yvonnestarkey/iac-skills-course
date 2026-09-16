"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BmcrCalculator from "@/components/lesson/BmcrCalculator";
import ComposerBox from "@/components/ui/ComposerBox";
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
import { parseBmcrAnswer } from "@/lib/bmcr";
import { formatSastDateTime } from "@/lib/dates";

const REVIEW_STATUSES: SurveyResponseStatus[] = ["graded", "rejected", "resubmit"];

export default function SubmissionReview({ id }: { id: string }) {
  const router = useRouter();
  const [survey, setSurvey] = useState<CustomSurvey | null>(null);
  const [response, setResponse] = useState<CustomSurveyResponse | null>(null);
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

  useEffect(() => {
    let cancelled = false;
    fetchSurveySubmission(id).then((result) => {
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
      setStatus(result.response.status === "submitted" ? "graded" : result.response.status);
      setGrade(result.response.grade == null ? "" : String(result.response.grade));
      setFeedback(result.response.feedback || "");
      setFileUrl(result.response.feedbackFileUrl || "");
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const save = async () => {
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
    setNotice("Review saved.");
  };

  const pickFile = async (file: File | null) => {
    if (!file || !survey || !response) return;
    setUploading(true);
    setNotice("");
    const result = await uploadCoachFeedbackFile(file, survey.id, response.id);
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

  if (!survey || !response) {
    return (
      <div className="coach-page">
        <button className="back-link" type="button" onClick={() => router.push("/coach/lists")}>
          ← Submissions
        </button>
        <p className="empty">{error || "Submission not found."}</p>
      </div>
    );
  }

  const pdfs = surveyPdfUploads(survey, response.answers);

  return (
    <div className="coach-page submission-review">
      <button className="back-link" type="button" onClick={() => router.push("/coach/lists")}>
        ← Submissions
      </button>
      <div className="coach-head">
        <div>
          <p className="kicker">{survey.isAssignment ? "Assignment" : "Survey"}</p>
          <h1>{survey.title}</h1>
          <p className="muted">
            {response.studentName || "Student"}
            {response.studentEmail ? ` · ${response.studentEmail}` : ""}
            {response.createdAt ? ` · submitted ${formatSastDateTime(response.createdAt) || response.createdAt}` : ""}
          </p>
        </div>
        <span className={`badge ${surveyResponseStatusClass(response.status)}`}>
          {surveyResponseStatusLabel(response.status)}
        </span>
      </div>
      {error ? <div className="notice">{error}</div> : null}

      <div className="submission-review-grid">
        <section className="card survey-rich-text">
          <h2>Student submission</h2>
          {pdfs.length ? (
            <div className="actions">
              {pdfs.map((file) => (
                <a key={file.url} className="primary" href={file.url} target="_blank" rel="noopener noreferrer">
                  View Attached PDF ↗
                </a>
              ))}
            </div>
          ) : null}
          <div className="work-list">
            {survey.questions.map((question) =>
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
                      value={parseBmcrAnswer(response.answers[question.id])}
                      readOnly
                      idPrefix={`review-${question.id}`}
                    />
                  ) : (
                    <p>
                      <SurveyAnswerValue value={response.answers[question.id]} type={question.type} />
                    </p>
                  )}
                </article>
              )
            )}
          </div>
        </section>

        <section className="card">
          <h2>Feedback & grading</h2>
          <p className="muted small">
            {survey.requiresGrade
              ? "This form requires a numeric score as well as a status."
              : "Feedback-only. Mark as Graded when you have reviewed it, without a numeric score."}
          </p>
          <p className="student-notes-label">Status</p>
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
          {survey.requiresGrade ? (
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
          ) : null}
          <label className="student-notes-label" htmlFor="submission-feedback">
            Feedback
          </label>
          <ComposerBox
            id="submission-feedback"
            rows={8}
            value={feedback}
            onChange={setFeedback}
            placeholder="Write feedback. URLs and [text](https://…) links become clickable, and you can add emoji."
          />
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
              void pickFile(event.target.files && event.target.files[0]);
              event.target.value = "";
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
          {response.gradedAt ? (
            <p className="muted small">
              Last reviewed {formatSastDateTime(response.gradedAt) || response.gradedAt}
              {response.gradedByName ? ` by ${response.gradedByName}` : ""}.
            </p>
          ) : null}
          <div className="actions">
            <button className="primary" type="button" disabled={busy || uploading} onClick={() => void save()}>
              {busy ? "Saving…" : "Save review"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
