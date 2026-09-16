"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  downloadSurveyCsv,
  fetchCustomSurvey,
  fetchSurveyResponses,
  formatSurveyAnswer,
  questionCollectsAnswer,
  type CustomSurvey,
  type CustomSurveyResponse,
} from "@/lib/custom-surveys";
import { formatSastDateTime } from "@/lib/dates";

export default function SurveyResultsView({ surveyId }: { surveyId: string }) {
  const router = useRouter();
  const [survey, setSurvey] = useState<CustomSurvey | null>(null);
  const [responses, setResponses] = useState<CustomSurveyResponse[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchCustomSurvey(surveyId), fetchSurveyResponses(surveyId)]).then(([surveyResult, responseResult]) => {
      if (cancelled) return;
      setLoading(false);
      if (!surveyResult.ok || !surveyResult.survey) {
        setError(surveyResult.error || "Survey not found.");
        return;
      }
      if (!responseResult.ok) {
        setError(responseResult.error || "Could not load responses.");
        return;
      }
      setSurvey(surveyResult.survey);
      setResponses(responseResult.data);
    });
    return () => {
      cancelled = true;
    };
  }, [surveyId]);

  if (loading) {
    return (
      <div className="coach-page">
        <p className="empty">Loading responses…</p>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="coach-page">
        <button className="back-link" type="button" onClick={() => router.push("/coach/surveys")}>
          ← Custom surveys
        </button>
        <p className="empty">{error || "Survey not found."}</p>
      </div>
    );
  }

  return (
    <div className="coach-page">
      <button className="back-link" type="button" onClick={() => router.push("/coach/surveys")}>
        ← Custom surveys
      </button>
      <div className="coach-head">
        <div>
          <h1>{survey.title}</h1>
          <p className="muted">
            {responses.length} response{responses.length === 1 ? "" : "s"} · /student/surveys/{survey.slug}
          </p>
        </div>
        <button
          className="primary"
          type="button"
          disabled={!responses.length}
          onClick={() => downloadSurveyCsv(survey, responses)}
        >
          Export CSV
        </button>
      </div>
      {error ? <div className="notice">{error}</div> : null}
      {responses.length ? (
        <div className="table-wrap survey-results">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Email</th>
                <th>Submitted</th>
                {survey.questions
                  .filter((question) => questionCollectsAnswer(question.type))
                  .map((question) => (
                    <th key={question.id}>{question.label || question.id}</th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {responses.map((response) => (
                <tr key={response.id}>
                  <td>{response.studentName}</td>
                  <td>{response.studentEmail}</td>
                  <td>{formatSastDateTime(response.createdAt) || response.createdAt}</td>
                  {survey.questions
                    .filter((question) => questionCollectsAnswer(question.type))
                    .map((question) => (
                      <td key={question.id}>{formatSurveyAnswer(response.answers[question.id], question.type) || "—"}</td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty">No student submissions yet.</p>
      )}
    </div>
  );
}
