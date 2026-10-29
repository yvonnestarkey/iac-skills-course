"use client";

import { useEffect, useState } from "react";
import { consentLabel } from "@/lib/data-consent";

type State = { eve: boolean | null; research: boolean | null; updatedAt: string | null; updatedBy: string | null };

/** Coach panel on the student profile: shows the student's data choices and lets the coach change them on request. */
export default function DataConsentPanel({ studentId }: { studentId: string }) {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetch(`/api/coach/data-consent?student_id=${encodeURIComponent(studentId)}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setState(d)))
      .catch(() => setError("Could not load the data choices."));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const change = async (key: "eve" | "research", value: boolean) => {
    setBusy(true);
    const r = await fetch("/api/coach/data-consent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ student_id: studentId, [key]: value }),
    }).then((x) => x.json());
    setBusy(false);
    if (r.error) setError(r.error);
    else load();
  };

  const row = (key: "eve" | "research", title: string) => {
    const v = state?.[key] ?? null;
    return (
      <div>
        <dt>{title}</dt>
        <dd>
          {consentLabel(v)}{" "}
          <button className="link-btn" type="button" disabled={busy} onClick={() => change(key, v !== true)}>
            {v === true ? "Change to No" : "Change to Yes"}
          </button>
        </dd>
      </div>
    );
  };

  return (
    <section className="card">
      <h2>Data choices</h2>
      <p className="muted small">What the student agreed to. Change these only when the student asks you to.</p>
      {error ? <p className="muted small">{/data-consent|consent/i.test(error) ? "Run supabase/data-consent.sql in Supabase to turn this on." : error}</p> : null}
      {state ? (
        <dl className="fact-list">
          {row("eve", "Eve training")}
          {row("research", "Academic research")}
          {state.updatedAt ? (
            <div>
              <dt>Last changed</dt>
              <dd>
                {state.updatedAt.slice(0, 10)} {state.updatedBy?.startsWith("coach:") ? "(by a coach)" : "(by the student)"}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </section>
  );
}
