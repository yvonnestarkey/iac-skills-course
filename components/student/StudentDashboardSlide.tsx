"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { CircleHelp } from "lucide-react";
import LinkedText from "@/components/ui/LinkedText";
import { embedSrcForVideo, YOUTUBE_EMBED_ALLOW, YOUTUBE_EMBED_REFERRER_POLICY } from "@/lib/video-embed";
import type { DashboardPost } from "@/lib/dashboard-posts";
import { isCoachAccount } from "@/lib/roles";
import { useLmsCourse } from "@/lib/lms-course-context";
import { DEFAULT_LMS_COURSE_ID } from "@/lib/lms-catalog";
import { useStudentSession } from "@/lib/student-session";
import {
  POPUP_BG,
  popupActivityHref,
  type PopupItem,
  type PopupResponse,
} from "@/lib/student-popups";

function DismissHint({ text }: { text: string }) {
  return (
    <span className="popup-dismiss-hint" tabIndex={0}>
      <CircleHelp size={14} aria-hidden="true" />
      <span className="popup-dismiss-tip">{text}</span>
    </span>
  );
}

export default function StudentDashboardSlide() {
  const { course } = useLmsCourse();
  const { user, viewAsStudent, readOnly } = useStudentSession();
  const [post, setPost] = useState<DashboardPost | null>(null);
  const [items, setItems] = useState<PopupItem[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [mounted, setMounted] = useState(false);
  const skipped = useRef<string[]>([]);

  const load = async () => {
    if (course.id !== DEFAULT_LMS_COURSE_ID) return;
    if (isCoachAccount(user) && !viewAsStudent) return;
    const skip = skipped.current.filter(Boolean);
    const query = skip.length ? `?skip=${skip.map(encodeURIComponent).join(",")}` : "";
    const response = await fetch(`/api/student/popups${query}`, { credentials: "same-origin" });
    const payload = (await response.json().catch(() => ({}))) as {
      popup?: DashboardPost | null;
      items?: PopupItem[];
      responses?: PopupResponse[];
      error?: string;
    };
    if (!response.ok) {
      setError(payload.error || "");
      return;
    }
    const next = payload.popup || null;
    if (!next) {
      setPost(null);
      setOpen(false);
      return;
    }
    setPost(next);
    setItems(payload.items || []);
    const nextAnswers: Record<string, string> = {};
    const nextChecked: Record<string, boolean> = {};
    (payload.responses || []).forEach((row) => {
      if (row.kind === "answer") nextAnswers[row.itemId] = row.answer;
      if (row.kind === "commitment") nextChecked[row.itemId] = row.accepted;
    });
    setAnswers(nextAnswers);
    setChecked(nextChecked);
    window.setTimeout(() => setOpen(true), 40);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void load().then(() => {
      if (cancelled) setOpen(false);
    });
    return () => {
      cancelled = true;
    };
  }, [course.id, user?.id, viewAsStudent]);

  useEffect(() => {
    if (!post || !open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [post, open]);

  const act = async (body: Record<string, unknown>) => {
    if (readOnly || !post) return;
    setBusy(String(body.action || "save"));
    setError("");
    const response = await fetch("/api/student/popups", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ popup_id: post.id, ...body }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy("");
    if (!response.ok) {
      setError(payload.error || "Could not save that.");
      return false;
    }
    return true;
  };

  const dismiss = async (mode: "today" | "forever") => {
    if (!post) return;
    skipped.current = [...skipped.current, post.id];
    if (!readOnly) {
      const ok = await act({ action: "dismiss", mode });
      if (!ok) {
        skipped.current = skipped.current.filter((id) => id !== post.id);
        return;
      }
    }
    setOpen(false);
    window.setTimeout(() => void load(), 240);
  };

  if (!mounted || !post) return null;
  const embedSrc = embedSrcForVideo(post.videoUrl);
  const paragraphs = post.body
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return createPortal(
    <div className={`dash-slide${open ? " open" : ""}`} role="dialog" aria-modal="true" aria-labelledby="dash-slide-title">
      <div className="dash-slide-backdrop" />
      <aside className="dash-slide-panel">
        <img className="dash-slide-art" src={POPUP_BG} alt="" />
        <img className="dash-slide-figure" src={POPUP_BG} alt="" />
        <div className="dash-slide-frost">
          <div className="dash-slide-head">
            <p className="kicker">Your focus plan</p>
            <h2 id="dash-slide-title">{post.title || "A note from Yvonne"}</h2>
          </div>
          <div className="dash-slide-body">
            {embedSrc ? (
              <div className="dash-slide-video">
                <iframe
                  src={embedSrc}
                  title={post.title || "Video"}
                  allow={YOUTUBE_EMBED_ALLOW}
                  referrerPolicy={YOUTUBE_EMBED_REFERRER_POLICY}
                  allowFullScreen
                />
              </div>
            ) : null}
            {paragraphs.map((paragraph) => (
              <p key={paragraph}>
                <LinkedText text={paragraph} />
              </p>
            ))}
            {items.map((item) => {
              if (item.kind === "activity") {
                const href = popupActivityHref(item);
                return (
                  <Link key={item.id} href={href} className="popup-activity">
                    <strong>{item.label}</strong>
                    <span>Open ↗</span>
                  </Link>
                );
              }
              if (item.kind === "commitment") {
                return (
                  <label key={item.id} className="popup-commit">
                    <input
                      type="checkbox"
                      checked={Boolean(checked[item.id])}
                      disabled={readOnly || Boolean(busy) || checked[item.id]}
                      onChange={async (event) => {
                        if (!event.target.checked) return;
                        const ok = await act({ action: "commit", item_id: item.id, accepted: true });
                        if (ok) {
                          setChecked((current) => ({ ...current, [item.id]: true }));
                          setItems((current) => current.filter((row) => row.id !== item.id));
                        }
                      }}
                    />
                    <span>
                      {item.label}
                      {item.deadline ? <em> Deadline {item.deadline}</em> : null}
                    </span>
                  </label>
                );
              }
              return (
                <div key={item.id} className="popup-question">
                  <p className="student-notes-label">{item.label}</p>
                  <textarea
                    rows={3}
                    value={answers[item.id] || ""}
                    disabled={readOnly || Boolean(busy)}
                    onChange={(event) => setAnswers((current) => ({ ...current, [item.id]: event.target.value }))}
                  />
                  <button
                    type="button"
                    className="ghost"
                    disabled={readOnly || Boolean(busy) || !(answers[item.id] || "").trim()}
                    onClick={async () => {
                      const ok = await act({ action: "answer", item_id: item.id, answer: answers[item.id] });
                      if (ok) setItems((current) => current.filter((row) => row.id !== item.id));
                    }}
                  >
                    {busy === "answer" ? "Saving…" : "Save answer"}
                  </button>
                </div>
              );
            })}
            {error ? <p className="notice">{error}</p> : null}
          </div>
          <div className="dash-slide-foot popup-dismiss-foot">
            <button type="button" className="ghost" disabled={Boolean(busy)} onClick={() => void dismiss("forever")}>
              Dismiss completely
              <DismissHint text="You will not see this particular pop-up again." />
            </button>
            <button type="button" className="primary" disabled={Boolean(busy)} onClick={() => void dismiss("today")}>
              Dismiss for today
              <DismissHint text="It will pop back up tomorrow." />
            </button>
          </div>
        </div>
      </aside>
    </div>,
    document.body
  );
}
