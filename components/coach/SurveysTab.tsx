"use client";

import { surveyFor, surveyLessons, surveyScore } from "@/lib/course";
import { surveyBreakdown } from "@/lib/metrics";
import { useStore } from "@/lib/store";
import type { Student } from "@/lib/types";

interface Props {
  students: Student[];
  onOpenProfile: (id: string) => void;
}

export default function SurveysTab({ students, onOpenProfile }: Props) {
  const { data } = useStore();

  return (
    <div className="survey-grid">
      {surveyLessons(data).map((lesson) => {
        const responses = students
          .map((s) => ({ student: s, answer: surveyFor(s, lesson.id) }))
          .filter((r) => r.answer);
        const perQuestion = surveyBreakdown(responses.map((r) => r.answer));
        const average = responses.length
          ? (responses.reduce((sum, r) => sum + surveyScore(r.answer), 0) / responses.length).toFixed(1) + " / 5"
          : "no data";
        const comments = responses.filter((r) => r.answer.comment);

        return (
          <section className="card survey-card" key={lesson.id}>
            <div className="panel-head">
              <div>
                <h2>{lesson.title}</h2>
                <p className="muted small">
                  {responses.length} of {students.length} responded
                </p>
              </div>
              <span className="score-chip">{average}</span>
            </div>
            {responses.length ? (
              perQuestion.map((p) => (
                <div className="survey-bar" key={p.q.id}>
                  <span className="survey-bar-label">{p.q.label}</span>
                  <div className="survey-track">
                    <span style={{ width: `${p.avg ? (p.avg / 5) * 100 : 0}%` }} />
                  </div>
                  <span className="survey-val">{p.avg ? p.avg.toFixed(1) : "—"}</span>
                </div>
              ))
            ) : (
              <p className="empty">No responses yet for this module.</p>
            )}
            {comments.length ? (
              <>
                <h3 className="comments-head">Comments</h3>
                <ul className="comment-list">
                  {comments.map((r) => (
                    <li key={r.student.id}>
                      <button className="link-btn" onClick={() => onOpenProfile(r.student.id)}>
                        {r.student.name}
                      </button>
                      <span className="muted small">scored {surveyScore(r.answer).toFixed(1)} / 5</span>
                      <p>{r.answer.comment}</p>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
