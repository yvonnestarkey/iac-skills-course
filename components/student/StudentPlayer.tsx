"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import VideoPlayer from "@/components/lesson/VideoPlayer";
import { supabaseConfigured } from "@/lib/supabase";
import {
  fetchLessonProgress,
  saveLessonProgress,
  signInStudent,
  signOutStudent,
  signUpStudent,
  type StudentLesson,
} from "@/lib/student-lesson";
import type { LessonType } from "@/lib/types";

const KICKERS: Record<LessonType, string> = {
  video: "Video lesson",
  reading: "Reading",
  assignment: "Written assignment",
  upload: "File upload",
  ask: "Ask your coach",
  survey: "Check-in",
};

export default function StudentPlayer({ lesson }: { lesson: StudentLesson }) {
  const [email, setEmail] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [notes, setNotes] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    completedRef.current = completed;
  }, [completed]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const result = await fetchLessonProgress(lesson.id);
      if (cancelled) return;
      setSignedIn(Boolean(result.userId));
      setEmail(result.email);
      setCompleted(result.progress.completed);
      setNotes(result.progress.notes);
    };

    load();
    return () => {
      cancelled = true;
      if (notesTimer.current) clearTimeout(notesTimer.current);
    };
  }, [lesson.id]);

  const persist = async (next: { completed: boolean; notes: string }, silent = false) => {
    if (!signedIn) {
      if (!silent) setStatus("Sign in to save your progress and notes.");
      return;
    }
    const result = await saveLessonProgress(lesson.id, next);
    if (result.ok) {
      if (!silent) setStatus("Saved.");
    } else {
      setStatus(result.error || "Could not save.");
    }
  };

  const markComplete = async () => {
    const next = !completed;
    setCompleted(next);
    await persist({ completed: next, notes }, false);
  };

  const onNotesChange = (value: string) => {
    setNotes(value);
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => {
      persist({ completed: completedRef.current, notes: value }, true);
    }, 700);
  };

  const runAuth = async (mode: "in" | "up") => {
    setBusy(true);
    setStatus("");
    const result = mode === "in" ? await signInStudent(authEmail, password) : await signUpStudent(authEmail, password);
    if (!result.ok) {
      setStatus(result.error || "Could not sign in.");
      setBusy(false);
      return;
    }
    const loaded = await fetchLessonProgress(lesson.id);
    setSignedIn(Boolean(loaded.userId));
    setEmail(loaded.email);
    setCompleted(loaded.progress.completed);
    setNotes(loaded.progress.notes);
    setPassword("");
    setStatus(mode === "up" ? "Account created. You can save notes on this lesson." : "Signed in.");
    setBusy(false);
  };

  const leave = async () => {
    await signOutStudent();
    setSignedIn(false);
    setEmail(null);
    setCompleted(false);
    setNotes("");
    setStatus("Signed out. The lesson is still here to watch.");
  };

  return (
    <>
      {lesson.type === "video" ? (
        <VideoPlayer lesson={lesson} />
      ) : lesson.type === "reading" ? (
        <div className="reading-hero">
          <span>{lesson.duration}</span>
          <p>{lesson.blurb}</p>
        </div>
      ) : null}

      <article className="lesson-body">
        <p className="kicker">
          {lesson.chapterTitle} · {KICKERS[lesson.type]}
        </p>
        <h1>{lesson.title}</h1>

        <section className="student-session" aria-label="Your lesson progress">
          {signedIn ? (
            <p className="student-session-row">
              <span>
                Signed in as <strong>{email}</strong>
              </span>
              <button className="ghost" type="button" onClick={leave}>
                Sign out
              </button>
            </p>
          ) : (
            <form
              className="student-auth"
              onSubmit={(event) => {
                event.preventDefault();
                runAuth("in");
              }}
            >
              <p className="muted small">
                Sign in to load your completion status and notes for this lesson.
                {!supabaseConfigured ? " Supabase is not configured on this machine, so progress cannot be saved." : ""}
              </p>
              <div className="student-auth-fields">
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="Email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  required
                />
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div className="actions">
                <button className="primary" type="submit" disabled={busy || !supabaseConfigured}>
                  Sign in
                </button>
                <button className="ghost" type="button" disabled={busy || !supabaseConfigured} onClick={() => runAuth("up")}>
                  Create account
                </button>
              </div>
            </form>
          )}
          {status ? <p className="notice">{status}</p> : null}
        </section>

        {lesson.blurb && lesson.type !== "reading" ? <p className="lead">{lesson.blurb}</p> : null}
        {lesson.due ? <p className="lead">Due {lesson.due}</p> : null}
        {lesson.brief ? <p>{lesson.brief}</p> : null}
        {(lesson.body || []).map((paragraph, index) => (
          <p key={`${lesson.id}-body-${index}`}>{paragraph}</p>
        ))}
        {(lesson.takeaways || []).length ? (
          <div className="takeaways">
            <h3>Takeaways</h3>
            <ul>
              {lesson.takeaways!.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <label className="student-notes-label" htmlFor="student-notes">
          Your notes
        </label>
        <textarea
          id="student-notes"
          rows={6}
          placeholder={signedIn ? "Write notes for this lesson…" : "Sign in to save notes for this lesson."}
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          onBlur={() => persist({ completed, notes }, true)}
        />

        <div className="actions">
          <button className={completed ? "ghost" : "primary"} type="button" onClick={markComplete}>
            {completed ? "Completed ✓" : "Mark as complete"}
          </button>
          {lesson.next ? (
            <Link className="ghost" href={`/student/${lesson.next.id}`}>
              Next: {lesson.next.title} →
            </Link>
          ) : null}
        </div>
      </article>
    </>
  );
}
