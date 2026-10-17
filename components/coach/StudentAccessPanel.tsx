"use client";

import { useState } from "react";
import CourseAccessBadge from "@/components/coach/CourseAccessBadge";
import { MONTHS, parseISO } from "@/lib/dates";
import { isCourseAccessClosed } from "@/lib/student-registration";
import type { Student } from "@/lib/types";

function expiryLabel(value?: string | null): string {
  const date = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const parsed = parseISO(date);
  return `${parsed.getDate()} ${MONTHS[parsed.getMonth()]} ${parsed.getFullYear()}`;
}

export default function StudentAccessPanel({
  student,
  compact = false,
  onUpdated,
}: {
  student: Student;
  compact?: boolean;
  onUpdated?: (next: Partial<Student>) => void;
}) {
  const [expiresOn, setExpiresOn] = useState(student.accessExpiresOn || "");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const closed = student.accessActive === false;

  const save = async (action: "deregister" | "set_expiry" | "restore", nextExpiry = expiresOn) => {
    setBusy(action);
    setNotice("");
    const response = await fetch("/api/coach/registration", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        user_id: student.id,
        action,
        expires_on: nextExpiry,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy("");
    if (!response.ok) {
      setNotice(payload.error || "Could not update course access.");
      return;
    }
    if (action === "deregister") {
      onUpdated?.({ accessActive: false, deregisteredAt: new Date().toISOString() });
      setNotice("Student deregistered. Their profile stays on the list.");
      return;
    }
    if (action === "restore") {
      setExpiresOn("");
      onUpdated?.({ accessActive: true, accessExpiresOn: null, deregisteredAt: null });
      setNotice("Course access restored.");
      return;
    }
    onUpdated?.({
      accessActive: !isCourseAccessClosed({ accessExpiresOn: nextExpiry, deregisteredAt: null }),
      accessExpiresOn: nextExpiry,
      deregisteredAt: null,
    });
    setNotice(`Access ends after ${expiryLabel(nextExpiry)}.`);
  };

  const body = (
    <>
      <div className="student-access-status">
        <CourseAccessBadge access={student.courseAccess} accessActive={student.accessActive} />
        {closed ? (
          <span className="muted small">No course access. Profile and work stay on file.</span>
        ) : student.accessExpiresOn ? (
          <span className="muted small">Expires {expiryLabel(student.accessExpiresOn)}</span>
        ) : (
          <span className="muted small">No expiry date</span>
        )}
      </div>
      <div className="student-access-actions">
        <label className="student-notes-label" htmlFor={`access-expiry-${student.id}`}>
          Expiry date
        </label>
        <div className="student-access-row">
          <input
            id={`access-expiry-${student.id}`}
            type="date"
            className="select-line"
            value={expiresOn}
            onChange={(event) => setExpiresOn(event.target.value)}
          />
          <button
            className="ghost"
            type="button"
            disabled={Boolean(busy) || !expiresOn}
            onClick={() => void save("set_expiry")}
          >
            {busy === "set_expiry" ? "Saving…" : "Set expiry"}
          </button>
        </div>
        <div className="student-access-row">
          {closed ? (
            <button className="primary" type="button" disabled={Boolean(busy)} onClick={() => void save("restore")}>
              {busy === "restore" ? "Restoring…" : "Restore access"}
            </button>
          ) : (
            <button className="ghost" type="button" disabled={Boolean(busy)} onClick={() => void save("deregister")}>
              {busy === "deregister" ? "Deregistering…" : "Deregister now"}
            </button>
          )}
        </div>
      </div>
      {notice ? <p className="muted small">{notice}</p> : null}
    </>
  );

  if (compact) {
    return (
      <div className="student-access-compact" onClick={(event) => event.stopPropagation()}>
        {body}
      </div>
    );
  }

  return (
    <section className="card">
      <div className="panel-head">
        <div>
          <h2>Course registration</h2>
          <p className="muted small">
            Deregister now, or set an expiry date. The student loses course access after that, but their profile stays
            here.
          </p>
        </div>
      </div>
      {body}
    </section>
  );
}
