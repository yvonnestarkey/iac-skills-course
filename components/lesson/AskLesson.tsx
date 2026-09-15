"use client";

import { useState } from "react";
import { chapterCode, thread, unansweredQuestion } from "@/lib/course";
import { nowLabel } from "@/lib/dates";
import { useStore } from "@/lib/store";
import type { FlatLesson } from "@/lib/types";
import { LessonHeader } from "./LessonChrome";
import ComposerBox from "@/components/ui/ComposerBox";

export default function AskLesson({ lesson }: { lesson: FlatLesson }) {
  const { data, student, mutate, notice, setNotice } = useStore();
  const [text, setText] = useState("");
  if (!student) return null;

  const pending = unansweredQuestion(data, student.id);
  const messages = thread(data, student.id);

  const send = () => {
    const question = text.trim();
    if (!question) return;
    mutate((draft) => {
      draft.messages[student.id] = draft.messages[student.id] || [];
      draft.messages[student.id].push({
        from: "student",
        kind: "question",
        text: question,
        at: nowLabel(),
        context: `${chapterCode(lesson.chapter)} · Ask the Coach`,
      });
    });
    setText("");
    setNotice("Sent. Your coach sees this under Questions waiting.");
  };

  return (
    <article className="lesson-body wide">
      <LessonHeader lesson={lesson} kicker="Ask the Coach" />
      <p className="lead">{lesson.blurb}</p>
      {pending ? <div className="waiting">Your question is waiting for the coach.</div> : null}
      {notice ? <div className="notice">{notice}</div> : null}
      <ComposerBox
        id="ask-text"
        value={text}
        onChange={setText}
        placeholder="What do you need help with?"
        rows={4}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) send();
        }}
      />
      <div className="actions">
        <button className="primary" id="ask-coach" onClick={send}>
          Ask the Coach
        </button>
      </div>
      <h3 style={{ marginTop: 24 }}>Your thread</h3>
      <div className="thread">
        {messages.length ? (
          messages.map((m, i) => (
            <div key={i} className={`bubble ${m.from} ${m.kind === "question" ? "question" : ""}`}>
              {m.text}
              <div className="muted small">
                {m.at} · {m.kind === "question" ? "You asked" : "Coach"}
                {m.context ? ` · ${m.context}` : ""}
              </div>
            </div>
          ))
        ) : (
          <p className="empty">No questions yet.</p>
        )}
      </div>
    </article>
  );
}
