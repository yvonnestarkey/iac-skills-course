"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { STARTER_PROMPTS } from "@/lib/constants";
import { botReply } from "@/lib/assistant";
import { findLesson } from "@/lib/course";
import { nowLabel } from "@/lib/dates";
import { postInboxMessage } from "@/lib/inbox";
import { useStore } from "@/lib/store";
import type { CourseData } from "@/lib/types";
import AskQuestionDrawer from "@/components/student/AskQuestionDrawer";
import EmojiPickerButton, { insertTextAtCursor } from "@/components/ui/EmojiPicker";
import LinkInsertButton from "@/components/ui/LinkInsertButton";
import LinkedText from "@/components/ui/LinkedText";

function markEscalated(draft: CourseData, key: string, question: string, paragraphs: string[], escalated: boolean) {
  draft.chats = draft.chats || {};
  const entries = draft.chats[key] || [];
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    if (entries[i].from === "bot" && entries[i].about === question) {
      entries[i].escalated = escalated;
      break;
    }
  }
  entries.push({ from: "bot", paragraphs });
  draft.chats[key] = entries;
}

export default function ChatWidget() {
  const { ready, data, session, mutate, chatOpen, setChatOpen, setNotice } = useStore();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [text, setText] = useState("");
  const body = useRef<HTMLDivElement>(null);
  const chatInput = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  const onStudentPortal = pathname.startsWith("/student") && pathname !== "/student/login";
  const isPrototypeStudent = Boolean(session && session.role === "student");
  const isStudent = isPrototypeStudent || onStudentPortal;
  const key = session ? session.id : "guest";
  const log = (data.chats && data.chats[key]) || [];

  useEffect(() => {
    if (body.current) body.current.scrollTop = body.current.scrollHeight;
  }, [log.length, chatOpen]);

  if (pathname === "/" || pathname === "/login" || pathname === "/student/login" || pathname.startsWith("/onboarding")) return null;
  if (!ready) return null;

  if (!chatOpen) {
    return (
      <>
        <button className="widget-fab" id="fab" aria-label="Open course assistant" onClick={() => setIsDrawerOpen(true)}>
          <span>💬</span> Ask a question
        </button>
        <AskQuestionDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
      </>
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

  const escalate = async (question: string) => {
    if (!isStudent) return;
    const asked = question || "A student asked the course assistant for help and wanted this passed on.";

    if (onStudentPortal) {
      const result = await postInboxMessage({
        studentEmail: "",
        from: "student",
        kind: "question",
        body: asked,
        context: "Course assistant",
      });
      mutate((draft) => {
        markEscalated(
          draft,
          key,
          question,
          result.ok
            ? ["Sent. Yvonne sees this in Inbox, and her reply will appear in your Ask the Coach thread."]
            : [result.error || "Could not send this to Yvonne. Try again from Inbox."],
          Boolean(result.ok)
        );
      });
      return;
    }

    if (!session) return;
    const id = session.id;
    mutate((draft) => {
      draft.messages[id] = draft.messages[id] || [];
      draft.messages[id].push({
        from: "student",
        kind: "question",
        text: asked,
        at: nowLabel(),
        context: "Course assistant",
      });
      markEscalated(draft, key, question, [
        "Sent. Yvonne sees this under Questions waiting, and her reply will appear in your Ask the Coach thread.",
      ], true);
    });
  };

  const openLesson = (lessonId: string) => {
    setNotice("");
    setChatOpen(false);
    if (onStudentPortal) {
      router.push(`/student/${lessonId}`);
      return;
    }
    if (pathname.startsWith("/coach/preview")) {
      router.push(`/coach/preview/${lessonId}`);
      return;
    }
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
                  <LinkedText text={m.text} />
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
                  <p key={j}>
                    <LinkedText text={p} />
                  </p>
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
        <div className="widget-compose">
          <input
            id="chat-input"
            ref={chatInput}
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
          <div className="composer-tools">
            <LinkInsertButton
              onInsert={(markdown) => {
                const { next, caret } = insertTextAtCursor(text, markdown, chatInput.current);
                setText(next);
                requestAnimationFrame(() => {
                  const field = chatInput.current;
                  if (!field) return;
                  field.focus();
                  field.setSelectionRange(caret, caret);
                });
              }}
            />
            <EmojiPickerButton
              onPick={(emoji) => {
                const { next, caret } = insertTextAtCursor(text, emoji, chatInput.current);
                setText(next);
                requestAnimationFrame(() => {
                  const field = chatInput.current;
                  if (!field) return;
                  field.focus();
                  field.setSelectionRange(caret, caret);
                });
              }}
            />
          </div>
        </div>
        <button className="primary" id="chat-send" onClick={() => ask(text)}>
          Send
        </button>
      </div>
    </section>
  );
}
