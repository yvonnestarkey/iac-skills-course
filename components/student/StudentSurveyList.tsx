"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchActiveCustomSurveys,
  fetchOwnSurveyResponses,
  studentSurveyPath,
  surveyResponseStatusClass,
  surveyReviewSummary,
  type CustomSurvey,
  type CustomSurveyResponse,
} from "@/lib/custom-surveys";

export default function StudentSurveyList() {
  const [surveys, setSurveys] = useState<CustomSurvey[]>([]);
  const [reviews, setReviews] = useState<Record<string, CustomSurveyResponse>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchActiveCustomSurveys(), fetchOwnSurveyResponses()]).then(([result, own]) => {
      setLoading(false);
      setReviews(own);
      if (!result.ok) {
        setError(result.error || "Could not load surveys.");
        return;
      }
      setSurveys(result.data);
    });
  }, []);

  return (
    <article className="lesson-body wide">
      <p className="kicker">Feedback</p>
      <h1>Surveys</h1>
      <p className="lead">Share how the course is going. Your coach uses this to improve support. Graded work appears here with your score and feedback.</p>
      {error ? <div className="notice">{error}</div> : null}
      {loading ? <p className="empty">Loading surveys…</p> : null}
      {!loading && !surveys.length ? <p className="empty">No surveys are open right now.</p> : null}
      <nav className="student-hub" aria-label="Open surveys">
        {surveys.map((survey) => {
          const review = reviews[survey.id];
          return (
            <Link href={studentSurveyPath(survey.slug)} className="student-hub-card" key={survey.id}>
              <strong>{survey.title}</strong>
              <p>{survey.description || `${survey.questions.length} question${survey.questions.length === 1 ? "" : "s"}`}</p>
              {review ? (
                <span className={`badge ${surveyResponseStatusClass(review.status)}`}>{surveyReviewSummary(review)}</span>
              ) : (
                <span className="muted small">Not submitted</span>
              )}
            </Link>
          );
        })}
      </nav>
    </article>
  );
}
