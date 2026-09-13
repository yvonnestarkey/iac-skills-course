"use client";

import { useEffect, useRef, useState } from "react";
import { fetchStudentNotes, saveStudentNotes } from "@/lib/student-notes";
import { useStudentSession } from "@/lib/student-session";

export default function StudentPersonalNotes() {
  const { user } = useStudentSession();
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bodyRef = useRef("");

  useEffect(() => {
    bodyRef.current = body;
  }, [body]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchStudentNotes(user.id).then((result) => {
      if (cancelled) return;
      setBody(result.body);
      if (!result.ok) setStatus(result.error || "Could not load your notes.");
    });
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [user]);

  const persist = async (value: string, silent = false) => {
    if (!user) return;
    setBusy(true);
    const result = await saveStudentNotes(user.id, value);
    setBusy(false);
    if (!result.ok) {
      setStatus(result.error || "Could not save notes. Run the student_notes SQL in Supabase if this table is new.");
      return;
    }
    if (!silent) setStatus("Saved. These notes stay private to you.");
  };

  const onChange = (value: string) => {
    setBody(value);
    setStatus("Saving…");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      persist(value, true).then(() => setStatus("Saved."));
    }, 800);
  };

  if (!user) return null;

  return (
    <section className="student-personal-notes">
      <h2>My Personal Notes</h2>
      <p className="muted small">Private reminders and questions. Your coach cannot see this.</p>
      <textarea
        id="student-personal-notes"
        rows={7}
        placeholder="Jot down reminders, questions, or study notes…"
        value={body}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => persist(bodyRef.current, true)}
      />
      <div className="actions">
        <button className="primary" type="button" disabled={busy} onClick={() => persist(body)}>
          Save Notes
        </button>
        {status ? <span className="muted small">{status}</span> : null}
      </div>
    </section>
  );
}
