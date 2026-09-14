"use client";

import { useEffect, useState } from "react";
import { textFor, wordCount } from "@/lib/course";
import { useStore } from "@/lib/store";
import type { FlatLesson } from "@/lib/types";
import { LessonHeader, NextLessonButton } from "./LessonChrome";

export default function AssignmentLesson({ lesson }: { lesson: FlatLesson }) {
  const { student, mutate } = useStore();
  const saved = student ? textFor(student, lesson.id) : "";
  const [draft, setDraft] = useState(saved);

  useEffect(() => {
    setDraft(saved);
    // Only reset when the lesson or the stored submission changes.
  }, [lesson.id, saved]);

  if (!student) return null;

  const submit = () => {
    mutate((data) => {
      const target = data.students.find((s) => s.id === student.id);
      target.submissions = target.submissions || {};
      target.submissions[lesson.id] = draft.trim();
    });
  };

  return (
    <article className="lesson-body wide">
      <LessonHeader lesson={lesson} />
      <p className="lead">Due {lesson.due}</p>
      {saved ? <div className="notice">Submitted. You can still update it before the deadline.</div> : null}
      <p>{lesson.brief}</p>
      <textarea
        id="draft"
        rows={12}
        placeholder="Type your working here…"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <div className="wordcount">{wordCount(draft)} words</div>
      <div className="actions">
        <button className="primary" id="submit" onClick={submit}>
          {saved ? "Update submission" : "Submit assignment"}
        </button>
        <NextLessonButton lesson={lesson} />
      </div>
    </article>
  );
}
