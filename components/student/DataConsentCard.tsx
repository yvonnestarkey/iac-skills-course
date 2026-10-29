"use client";

import { useEffect, useState } from "react";
import DataConsentChoices from "@/components/student/DataConsentChoices";
import { loadMyConsent, saveMyConsent, type ConsentKey } from "@/lib/data-consent";
import { isCoachAccount } from "@/lib/roles";
import { useStudentSession } from "@/lib/student-session";

/**
 * The data choices card. mode "account": always shown, so students can change their answers.
 * mode "prompt": shown on the overview only until the student has answered once.
 */
export default function DataConsentCard({ mode }: { mode: "account" | "prompt" }) {
  const { user } = useStudentSession();
  const [loaded, setLoaded] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [value, setValue] = useState<Record<ConsentKey, boolean>>({ eve: false, research: false });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    loadMyConsent(user.id).then((r) => {
      if (cancelled) return;
      if (!r.ok) setUnavailable(true);
      setValue({ eve: r.consent.eve === true, research: r.consent.research === true });
      setAnswered(Boolean(r.consent.updatedAt));
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (!user || isCoachAccount(user) || !loaded) return null;
  if (mode === "prompt" && (answered || unavailable)) return null;

  const save = async () => {
    setBusy(true);
    setMessage("");
    const r = await saveMyConsent(user.id, value);
    setBusy(false);
    if (!r.ok) {
      setMessage(r.error || "Could not save your choices.");
      return;
    }
    setAnswered(true);
    setMessage("Saved. You can change these at any time under Account.");
  };

  return (
    <section className="card consent-card">
      <p className="kicker">Your data</p>
      <h2>{mode === "prompt" ? "Two quick questions about your data" : "Your data choices"}</h2>
      <p className="muted">Both are optional. Ticking or not ticking has no effect on your access to the course or the feedback you receive.</p>
      <DataConsentChoices value={value} onChange={setValue} disabled={busy || unavailable} />
      {unavailable ? <p className="muted small">These choices are not available yet.</p> : null}
      <div className="actions">
        <button className="primary" type="button" disabled={busy || unavailable} onClick={save}>
          {busy ? "Saving…" : "Save my choices"}
        </button>
      </div>
      {message ? <p className="muted small">{message}</p> : null}
    </section>
  );
}
