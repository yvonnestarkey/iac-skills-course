"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { STARTER_PROMPTS } from "@/lib/constants";
import { botReply } from "@/lib/assistant";
import { findLesson } from "@/lib/course";
import { nowLabel } from "@/lib/dates";
import { useStore } from "@/lib/store";

export default function ChatWidget() {
  const { ready, data, session, mutate, chatOpen, setChatOpen, setNotice } = useStore();
  const [text, setText] = useState("");
  const body = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  const key = session ? session.id : "guest";
  const log = (data.chats && data.chats[key]) || [];
  const isStudent = Boolean(session && session.role === "student");

  useEffect(() => {
    if (body.current) body.current.scrollTop = body.current.scrollHeight;
  }, [log.length, chatOpen]);

  if (pathname.startsWith("/student")) return null;
  if (!ready) return null;

  if (!chatOpen) {
    return (
      <button className="widget-fab" id="fab" aria-label="Open course assistant" onClick={() => setChatOpen(true)}>
        <span>💬</span> Ask a question
      </button>
    );
  }

  const ask = (raw: string) => {
    const question = String(raw || "").trim();
    if (!question) return;
    const reply = botReply(data, question);
    mutate((draft) => {
      draft.chats = draft.chats || {};
      draft.chats[key] = draft.chats[key] || [];
      draft.chats[key].push({ from: "you", text: question });
      draft.chats[key].push({ ...reply, about: question });
    });
    setText("");
  };

  const escalate = (question: string) => {
    if (!isStudent) return;
    const id = session.id;
    const asked = question || "A student asked the course assistant for help and wanted this passed on.";
    mutate((draft) => {
      draft.messages[id] = draft.messages[id] || [];
      draft.messages[id].push({
        from: "student",
        kind: "question",
        text: asked,
        at: nowLabel(),
        context: "Course assistant",
      });
      draft.chats = draft.chats || {};
      const entries = draft.chats[id] || [];
      for (let i = entries.length - 1; i >= 0; i -= 1) {
        if (entries[i].from === "bot" && entries[i].about === question) {
          entries[i].escalated = true;
          break;
        }
      }
      entries.push({
        from: "bot",
        paragraphs: [
          "Sent. Yvonne sees this under Questions waiting, and her reply will appear in your Ask the Coach thread.",
        ],
      });
      draft.chats[id] = entries;
    });
  };

  const openLesson = (lessonId: string) => {
    setNotice("");
    setChatOpen(false);
    router.push(`/learn/${lessonId}`);
  };

  return (
    <section className="widget-panel" role="dialog" aria-label="Course assistant">
      <header className="widget-head">
        <div>
          <strong>Course assistant</strong>
          <span className="widget-sub">Answers from your {data.className} material</span>
        </div>
        <button className="widget-close" id="close-widget" aria-label="Close" onClick={() => setChatOpen(false)}>
          ×
        </button>
      </header>
      <div className="widget-body" id="widget-body" ref={body}>
        {log.length ? (
          log.map((m, i) => {
            if (m.from === "you") {
              return (
                <div className="chat-bubble you" key={i}>
                  {m.text}
                </div>
              );
            }
            const lesson = m.lessonId ? findLesson(data, m.lessonId) : null;
            const actions = [];
            if (lesson && isStudent) {
              actions.push(
                <button className="chat-action" key="open" onClick={() => openLesson(lesson.id)}>
                  Open {lesson.title}
                </button>
              );
            }
            if (m.offerEscalate && isStudent && !m.escalated) {
              actions.push(
                <button className="chat-action escalate" key="escalate" onClick={() => escalate(m.about || "")}>
                  Send to Yvonne
                </button>
              );
            }
            if (m.escalated) {
              actions.push(
                <span className="chat-sent" key="sent">
                  Sent to Yvonne ✓
                </span>
              );
            }
            return (
              <div className="chat-bubble bot" key={i}>
                {(m.paragraphs || []).map((p, j) => (
                  <p key={j}>{p}</p>
                ))}
                {actions.length ? <div className="chat-actions">{actions}</div> : null}
              </div>
            );
          })
        ) : (
          <>
            <div className="chat-bubble bot">
              <p>
                Ask me anything about the {data.className} — lessons, deadlines, uploads, or study habits. If I
                cannot answer it, I will pass it to Yvonne.
              </p>
            </div>
            <div className="chat-starters">
              {STARTER_PROMPTS.map((prompt) => (
                <button className="chat-starter" key={prompt} onClick={() => ask(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="widget-foot">
        <input
          id="chat-input"
          type="text"
          placeholder="Type your question…"
          autoComplete="off"
          autoFocus
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") ask(text);
          }}
        />
        <button className="primary" id="chat-send" onClick={() => ask(text)}>
          Send
        </button>
      </div>
    </section>
  );
}
