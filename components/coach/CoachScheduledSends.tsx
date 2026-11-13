"use client";

import { useEffect, useState } from "react";
import {
  cancelScheduledSend,
  deliverDueScheduledSends,
  listScheduledSends,
  SCHEDULED_SENDS_CHANGED,
  scheduledTriggerLabel,
  type ScheduledSend,
} from "@/lib/scheduled-sends";

export default function CoachScheduledSends() {
  const [items, setItems] = useState<ScheduledSend[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = async () => {
    await deliverDueScheduledSends();
    const result = await listScheduledSends();
    setItems(result.data);
    setError(result.error || "");
  };

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener(SCHEDULED_SENDS_CHANGED, refresh);
    return () => window.removeEventListener(SCHEDULED_SENDS_CHANGED, refresh);
  }, []);

  const cancel = async (id: string) => {
    setBusy(id);
    const result = await cancelScheduledSend(id);
    setBusy("");
    if (result.ok === false) setError(result.error || "");
    else await load();
  };

  if (!error && !items.length) return null;

  return (
    <section className="card coach-scheduled-sends">
      <div className="coach-dash-queue-head">
        <div>
          <p className="kicker">Scheduled</p>
          <h2>Waiting to send</h2>
        </div>
        <p className="muted small">{items.length ? `${items.length} waiting` : "None right now"}</p>
      </div>
      {error ? <p className="waiting">{error}</p> : null}
      <ul className="coach-dash-watch-list">
        {items.map((item) => (
          <li key={item.id}>
            <strong>{item.title || item.body.slice(0, 48) || "Message"}</strong>
            <span className="muted small">
              {item.audienceLabel || `${item.recipients.length} student${item.recipients.length === 1 ? "" : "s"}`} ·{" "}
              {scheduledTriggerLabel(item)} · {item.deliveredCount}/{item.recipients.length} sent
            </span>
            <button type="button" className="link-btn" disabled={busy === item.id} onClick={() => void cancel(item.id)}>
              Cancel
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
