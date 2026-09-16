"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import LinkedText from "@/components/ui/LinkedText";
import { useCoursePreview } from "@/lib/course-preview";
import {
  fetchActiveCustomSurveys,
  fetchStudentSurveyPacks,
  hasCoachReview,
  studentSurveyPath,
  surveyResponseStatusClass,
  surveyResponseStatusLabel,
  surveyReviewSummary,
  type CustomSurvey,
  type CustomSurveyResponse,
} from "@/lib/custom-surveys";
import { formatSastDateTime } from "@/lib/dates";
import { useStudentSession } from "@/lib/student-session";

type FilterId = "all" | "assignments" | "surveys" | "reviewed";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "assignments", label: "Assignments" },
  { id: "surveys", label: "Surveys" },
  { id: "reviewed", label: "With feedback" },
];

function hrefForSurvey(survey: CustomSurvey, lessonId?: string | null, basePath = "/student"): string {
  if (survey.slug) return studentSurveyPath(survey.slug);
  if (lessonId) return `${basePath}/${lessonId}`;
  return "/student/feedback";
}

export default function StudentFeedbackHub() {
  const { user, outline, submissions } = useStudentSession();
  const { basePath } = useCoursePreview();
  const [packs, setPacks] = useState<{ survey: CustomSurvey; response: CustomSurveyResponse }[]>([]);
  const [openSurveys, setOpenSurveys] = useState<CustomSurvey[]>([]);
  const [filter, setFilter] = useState<FilterId>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const lessonBySurveyId = useMemo(() => {
    const map = new Map<string, { id: string; title: string }>();
    (outline || []).forEach((chapter) => {
      (chapter.lessons || []).forEach((lesson) => {
        if (lesson.survey_id) map.set(lesson.survey_id, { id: lesson.id, title: lesson.title });
      });
    });
    return map;
  }, [outline]);

  const lessonById = useMemo(() => {
    const map = new Map<string, { id: string; title: string }>();
    (outline || []).forEach((chapter) => {
      (chapter.lessons || []).forEach((lesson) => {
        map.set(lesson.id, { id: lesson.id, title: lesson.title });
      });
    });
    return map;
  }, [outline]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    Promise.all([fetchStudentSurveyPacks(user.id), fetchActiveCustomSurveys()]).then(([own, active]) => {
      if (cancelled) return;
      setLoading(false);
      setPacks(own);
      if (!active.ok) {
        setError(active.error || "Could not load open surveys.");
        return;
      }
      setOpenSurveys(active.data);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const submittedIds = useMemo(() => new Set(packs.map((pack) => pack.survey.id)), [packs]);
  const waiting = openSurveys.filter((survey) => !submittedIds.has(survey.id));
  const filteredPacks = packs.filter((pack) => {
    if (filter === "assignments") return pack.survey.isAssignment;
    if (filter === "surveys") return !pack.survey.isAssignment;
    if (filter === "reviewed") return hasCoachReview(pack.response);
    return true;
  });

  const lessonRows = Object.values(submissions || {})
    .map((item) => {
      const lesson = lessonById.get(item.lesson_id);
      return {
        ...item,
        title: lesson?.title || "Lesson submission",
        href: `${basePath}/${item.lesson_id}`,
      };
    })
    .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));

  return (
    <article className="lesson-body wide">
      <p className="kicker">Your work</p>
      <h1>Survey & assignment feedback</h1>
      <p className="lead">
        Every form you have submitted, with your coach’s grade, comments, and files in one place.
      </p>
      {error ? <div className="notice">{error}</div> : null}

      <div className="filters">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={filter === item.id ? "active" : ""}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? <p className="empty">Loading your submissions…</p> : null}

      {!loading && !filteredPacks.length && (filter !== "all" || !lessonRows.length) ? (
        <p className="empty">
          {packs.length
            ? "Nothing matches this filter yet."
            : "No submissions yet. When you complete a survey or assignment, your coach’s feedback will appear here."}
        </p>
      ) : null}

      <div className="work-list student-feedback-list">
        {filteredPacks.map(({ survey, response }) => {
          const lesson = lessonBySurveyId.get(survey.id);
          const href = hrefForSurvey(survey, lesson?.id, basePath);
          const reviewed = hasCoachReview(response);
          return (
            <article className="work-item" key={response.id || survey.id}>
              <div className="work-head">
                <strong>{survey.title || lesson?.title || "Submitted work"}</strong>
                <span className={`badge ${surveyResponseStatusClass(response.status)}`}>
                  {surveyReviewSummary(response)}
                </span>
              </div>
              <p className="muted small">
                {survey.isAssignment ? "Assignment" : "Survey"}
                {response.createdAt ? ` · submitted ${formatSastDateTime(response.createdAt) || response.createdAt}` : ""}
                {response.gradedAt ? ` · reviewed ${formatSastDateTime(response.gradedAt) || response.gradedAt}` : ""}
              </p>
              {reviewed ? (
                <aside className={`survey-info-card survey-review-card ${surveyResponseStatusClass(response.status)}`}>
                  <strong>Coach review</strong>
                  <p>
                    <span className={`badge ${surveyResponseStatusClass(response.status)}`}>
                      {surveyResponseStatusLabel(response.status)}
                    </span>
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
              ) : (
                <p className="muted small">Your coach has not reviewed this yet.</p>
              )}
              <div className="actions">
                <Link className="primary" href={href}>
                  Open submission
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      {filter === "all" && lessonRows.length ? (
        <section className="student-feedback-lessons">
          <h2>Lesson uploads</h2>
          <div className="work-list">
            {lessonRows.map((item) => (
              <article className="work-item" key={item.lesson_id}>
                <div className="work-head">
                  <strong>{item.title}</strong>
                  <span className={`badge ${item.status === "approved" ? "ok" : item.status === "rejected" ? "warn" : ""}`}>
                    {item.status === "approved" ? "Approved" : item.status === "rejected" ? "Rejected" : "Submitted"}
                  </span>
                </div>
                {item.updated_at ? (
                  <p className="muted small">Updated {formatSastDateTime(item.updated_at) || item.updated_at}</p>
                ) : null}
                <div className="actions">
                  <Link className="ghost" href={item.href}>
                    Open lesson
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {waiting.length ? (
        <section className="student-feedback-open">
          <h2>Still to complete</h2>
          <nav className="student-hub" aria-label="Open surveys">
            {waiting.map((survey) => (
              <Link href={hrefForSurvey(survey, lessonBySurveyId.get(survey.id)?.id, basePath)} className="student-hub-card" key={survey.id}>
                <strong>{survey.title}</strong>
                <p>{survey.isAssignment ? "Assignment" : "Survey"} · not submitted yet</p>
              </Link>
            ))}
          </nav>
        </section>
      ) : null}
    </article>
  );
}
