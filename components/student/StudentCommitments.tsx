"use client";

import { useEffect, useState } from "react";
import { formatSastDateTime } from "@/lib/dates";

type CommitmentEntry = {
  popupId: string;
  popupTitle: string;
  itemId: string;
  kind: "commitment" | "answer";
  label: string;
  accepted: boolean;
  answer: string;
  deadline: string;
  followThroughLabel: string;
  updatedAt: string;
};

export default function StudentCommitments({
  studentId,
  title = "Your commitments",
}: {
  studentId: string;
  title?: string;
}) {
  const [entries, setEntries] = useState<CommitmentEntry[]>([]);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    const params = new URLSearchParams({ history: "1", student_id: studentId });
    fetch(`/api/student/popups?${params.toString()}`, { credentials: "same-origin" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as { entries?: CommitmentEntry[]; error?: string };
        if (cancelled) return;
        if (!response.ok) {
          setError(payload.error || "Could not load commitments.");
          return;
        }
        setEntries(payload.entries || []);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (!ready) return <p className="muted small">Loading commitments…</p>;
  if (error) return <p className="notice">{error}</p>;

  return (
    <section className="card" id="student-commitments">
      <h2>{title}</h2>
      <p className="muted small">Ticks and answers from login pop-ups, including whether the linked activity was done.</p>
      {entries.length ? (
        <ul className="note-list">
          {entries.map((entry) => (
            <li key={`${entry.popupId}-${entry.itemId}`}>
              <p>
                <strong>{entry.label}</strong>
                {entry.kind === "commitment" ? ` · ${entry.followThroughLabel}` : ""}
              </p>
              {entry.answer ? <p>{entry.answer}</p> : null}
              <div className="note-foot">
                <span className="muted small">
                  {entry.popupTitle}
                  {entry.deadline ? ` · deadline ${entry.deadline}` : ""}
                  {entry.updatedAt ? ` · ${formatSastDateTime(entry.updatedAt)}` : ""}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">No commitments or pop-up answers yet.</p>
      )}
    </section>
  );
}
