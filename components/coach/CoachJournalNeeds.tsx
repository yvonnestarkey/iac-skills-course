"use client";

import { useEffect, useState } from "react";
import StudentProfileLink from "@/components/coach/StudentProfileLink";
import {
  fetchCoachJournalNeeds,
  markJournalNeedContacted,
  type CoachJournalNeedGroup,
} from "@/lib/journal-needs";
import { journalWeekLabel } from "@/lib/study-journal";
import type { Student } from "@/lib/types";

export default function CoachJournalNeeds({
  students,
  onMessage,
}: {
  students: Student[];
  onMessage: (ids: string[], label: string) => void;
}) {
  const [groups, setGroups] = useState<CoachJournalNeedGroup[]>([]);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    const result = await fetchCoachJournalNeeds(students.map((student) => ({ id: student.id, name: student.name })));
    setGroups(result.groups);
    setError(result.error || "");
    setReady(true);
  };

  useEffect(() => {
    if (!students.length) {
      setReady(true);
      return;
    }
    let cancelled = false;
    fetchCoachJournalNeeds(students.map((student) => ({ id: student.id, name: student.name }))).then((result) => {
      if (cancelled) return;
      setGroups(result.groups);
      setError(result.error || "");
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [students]);

  const waiting = groups.reduce((sum, group) => sum + group.alerts.length, 0);

  const contact = async (group: CoachJournalNeedGroup, alert: CoachJournalNeedGroup["alerts"][number]) => {
    setBusy(alert.studentId + group.id);
    const result = await markJournalNeedContacted(alert.eventIds, alert.studentId, alert.weekStart, group.id, alert.needOther);
    setBusy("");
    if (result.ok === false) setError(result.error || "");
    else await load();
  };

  return (
    <section className="card coach-journal-needs">
      <div className="coach-dash-queue-head">
        <div>
          <p className="kicker">Study journal</p>
          <h2>What they need</h2>
        </div>
        <p className="muted small">{ready ? `${waiting} waiting` : "Checking journals…"}</p>
      </div>
      <p className="muted small">
        Each option from the weekly planner. Message someone, then mark them contacted to clear the alert. Their history stays on the
        student profile.
      </p>
      {error ? <p className="waiting">{error}</p> : null}
      <ul className="coach-journal-need-list">
        {groups.map((group) => (
          <li key={group.id} className={group.alerts.length ? "has-work" : undefined}>
            <button type="button" onClick={() => setOpenId((current) => (current === group.id ? null : group.id))}>
              <strong>{group.label}</strong>
              <span>{group.alerts.length ? `${group.alerts.length} waiting` : "No one right now"}</span>
            </button>
            {openId === group.id ? (
              group.alerts.length ? (
                <ul className="coach-dash-watch-list">
                  {group.alerts.map((alert) => (
                    <li key={`${alert.studentId}-${group.id}`}>
                      <StudentProfileLink studentId={alert.studentId}>{alert.studentName}</StudentProfileLink>
                      <span className="muted small">
                        {journalWeekLabel(alert.weekStart)}
                        {alert.needOther ? ` · ${alert.needOther}` : ""}
                      </span>
                      <span className="coach-journal-need-actions">
                        <button type="button" className="link-btn" onClick={() => onMessage([alert.studentId], alert.studentName)}>
                          Message
                        </button>
                        <button
                          type="button"
                          className="link-btn"
                          disabled={busy === alert.studentId + group.id}
                          onClick={() => void contact(group, alert)}
                        >
                          Contacted
                        </button>
                      </span>
                    </li>
                  ))}
                  {group.alerts.length > 1 ? (
                    <li>
                      <span />
                      <span />
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => onMessage(group.alerts.map((alert) => alert.studentId), group.label)}
                      >
                        Message all
                      </button>
                    </li>
                  ) : null}
                </ul>
              ) : (
                <p className="empty">Nobody has asked for {group.label.toLowerCase()}.</p>
              )
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
