"use client";

import { useEffect, useState } from "react";
import {
  fetchCustomSurveys,
  fetchSurveyResponses,
  type CustomSurvey,
  type CustomSurveyResponse,
} from "@/lib/custom-surveys";

interface Props {
  onOpenProfile: (id: string) => void;
}

export default function SurveysTab({ onOpenProfile }: Props) {
  const [surveys, setSurveys] = useState<CustomSurvey[]>([]);
  const [responses, setResponses] = useState<Record<string, CustomSurveyResponse[]>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchCustomSurveys().then(async (result) => {
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error || "Could not load surveys.");
        setLoading(false);
        return;
      }
      setSurveys(result.data);
      const entries = await Promise.all(
        result.data.map(async (survey) => {
          const loaded = await fetchSurveyResponses(survey.id);
          return [survey.id, loaded.ok ? loaded.data : []] as const;
        })
      );
      if (cancelled) return;
      setResponses(Object.fromEntries(entries));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <p className="empty">Loading surveys…</p>;
  if (error) return <p className="empty">{error}</p>;
  if (!surveys.length) return <p className="empty">No surveys yet.</p>;

  return (
    <div className="survey-grid">
      {surveys.map((survey) => {
        const rows = responses[survey.id] || [];
        return (
          <section className="card survey-card" key={survey.id}>
            <div className="panel-head">
              <div>
                <h2>{survey.title}</h2>
                <p className="muted small">
                  {rows.length} response{rows.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            {rows.length ? (
              <ul className="comment-list">
                {rows.map((row) => (
                  <li key={row.id}>
                    <button className="link-btn" type="button" onClick={() => onOpenProfile(row.studentId)}>
                      {row.studentName || row.studentEmail || "Student"}
                    </button>
                    <span className="muted small">{row.createdAt.slice(0, 10)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty">No survey responses submitted yet.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
