"use client";

import { useState } from "react";
import { SCALE, SURVEY_QUESTIONS } from "@/lib/constants";
import { surveyFor } from "@/lib/course";
import { useStore } from "@/lib/store";
import type { FlatLesson, SurveyAnswer } from "@/lib/types";
import { LessonHeader, NextLessonButton } from "./LessonChrome";

export default function SurveyLesson({ lesson }: { lesson: FlatLesson }) {
  const { student, mutate } = useStore();
  const existing = student ? surveyFor(student, lesson.id) : null;
  const [answer, setAnswer] = useState<SurveyAnswer>(existing || {});
  const [comment, setComment] = useState(existing ? existing.comment || "" : "");

  if (!student) return null;

  const send = () => {
    mutate((data) => {
      const target = data.students.find((s) => s.id === student.id);
      target.surveys = target.surveys || {};
      target.surveys[lesson.id] = { ...answer, comment: comment.trim() };
    });
  };

  return (
    <article className="lesson-body wide">
      <LessonHeader lesson={lesson} kicker="Module survey" />
      <p className="lead">{lesson.blurb}</p>
      {existing ? (
        <div className="notice">Thank you — your feedback is in. Submitting again replaces it.</div>
      ) : null}
      {SURVEY_QUESTIONS.map((q) => (
        <div className="survey-q" key={q.id}>
          <strong>{q.label}</strong>
          <div className="scale">
            {SCALE.map((label, i) => {
              const value = i + 1;
              return (
                <label className={`scale-opt ${answer[q.id] === value ? "on" : ""}`} key={label}>
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    value={value}
                    checked={answer[q.id] === value}
                    onChange={() => setAnswer((current) => ({ ...current, [q.id]: value }))}
                  />
                  <span>{label}</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
      <div className="plan-field">
        <label htmlFor="survey-comment">
          <strong>Anything else?</strong>
        </label>
        <textarea
          id="survey-comment"
          rows={4}
          placeholder="What worked, what did not…"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
      </div>
      <div className="actions">
        <button className="primary" id="send-survey" onClick={send}>
          {existing ? "Update my feedback" : "Send feedback"}
        </button>
        <NextLessonButton lesson={lesson} />
      </div>
    </article>
  );
}
