"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useOptionalStudentSession } from "@/lib/student-session";

type ChatMessage = { role: "user" | "assistant"; content: string };

export default function AskQuestionDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const session = useOptionalStudentSession();
  const user = session?.user;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      window.clearTimeout(focusTimer);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    const box = listRef.current;
    if (!box) return;
    box.scrollTop = box.scrollHeight;
  }, [messages, busy, isOpen]);

  const send = async () => {
    const question = draft.trim();
    if (!question || busy) return;
    setDraft("");
    setError("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setBusy(true);
    try {
      const response = await fetch("/api/student/ask-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          user_id: user?.id || undefined,
          messages: [...messages, { role: "user", content: question }],
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { reply?: string; error?: string };
      if (!response.ok || !payload.reply) {
        throw new Error(payload.error || "Could not get a reply.");
      }
      setMessages((prev) => [...prev, { role: "assistant", content: payload.reply || "" }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not get a reply.";
      setError(message);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "I could not reach the facilitator just then. Try that question again." },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`ask-drawer ${isOpen ? "open" : ""}`} aria-hidden={!isOpen} inert={!isOpen}>
      <button className="ask-drawer-backdrop" type="button" aria-label="Close ask a question" onClick={onClose} />
      <aside
        className="ask-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-question-title"
      >
        <header className="ask-drawer-head">
          <div>
            <h2 id="ask-question-title">Ask a Question</h2>
            <p className="muted small">24/7 IAC Exam &amp; Skills Facilitator</p>
          </div>
          <button className="ask-drawer-close" type="button" aria-label="Close" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="ask-drawer-log" ref={listRef}>
          {messages.length === 0 && !busy ? (
            <p className="muted small ask-drawer-empty">
              Ask about a required, a mark leak, or how to use BMCR, Volume vs Accuracy, or Buried Treasure. The facilitator
              will start from the macro framework, then give you next actions.
            </p>
          ) : null}
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`ask-drawer-bubble ${message.role}`}>
              <span className="ask-drawer-role">{message.role === "user" ? "You" : "Facilitator"}</span>
              <p>{message.content}</p>
            </div>
          ))}
          {busy ? <p className="ask-drawer-loading">Consulting study tools &amp; Supabase database...</p> : null}
        </div>

        <form
          className="ask-drawer-form"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          {error ? <p className="notice">{error}</p> : null}
          <textarea
            ref={inputRef}
            rows={3}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            placeholder="Type your IAC question…"
            disabled={busy}
            aria-label="Your question"
          />
          <button className="primary" type="submit" disabled={busy || !draft.trim()}>
            {busy ? "Sending…" : "Send"}
          </button>
        </form>
      </aside>
    </div>
  );
}
