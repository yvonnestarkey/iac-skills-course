"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { InviteAccess } from "@/lib/coach-invites";

export default function AddStudentForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [access, setAccess] = useState<InviteAccess>("free_preview");
  const [confirmSend, setConfirmSend] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!confirmSend) {
      setError("Confirm Send invitation before anyone is emailed.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    const response = await fetch("/api/coach/invites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "add_student",
        confirm: true,
        name,
        email,
        access,
      }),
    });
    const payload = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(payload.error || "Could not add the student.");
      return;
    }
    const outcome = payload.outcomes?.[0];
    setNotice(outcome?.message || "Done.");
    setConfirmSend(false);
  };

  return (
    <div className="coach-page">
      <button className="back-link" type="button" onClick={() => router.push("/coach")}>
        ← Coach home
      </button>
      <div className="coach-head">
        <div>
          <h1>Add Student</h1>
          <p className="muted">
            Invite a person to set their own password, then complete the existing onboarding questionnaire. Existing
            accounts are detected and are not duplicated.
          </p>
        </div>
      </div>

      <section className="card">
        <form onSubmit={submit}>
          <label className="student-notes-label" htmlFor="add-student-name">
            Name
          </label>
          <input id="add-student-name" value={name} onChange={(event) => setName(event.target.value)} required />
          <label className="student-notes-label" htmlFor="add-student-email">
            Email
          </label>
          <input
            id="add-student-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <fieldset className="add-student-access">
            <legend>Course access</legend>
            <label className="student-notes-label">
              <input
                type="radio"
                name="access"
                checked={access === "free_preview"}
                onChange={() => setAccess("free_preview")}
              />
              Free preview
            </label>
            <label className="student-notes-label">
              <input
                type="radio"
                name="access"
                checked={access === "full_complimentary"}
                onChange={() => setAccess("full_complimentary")}
              />
              Full course — complimentary
            </label>
          </fieldset>

          {name.trim() && email.trim() ? (
            <div className="waitlist-invite-confirm">
              <h2>About to send</h2>
              <p>
                <strong>{name.trim()}</strong> — {email.trim()}
              </p>
              <p>
                Access: {access === "full_complimentary" ? "Full course — complimentary" : "Free preview"}
              </p>
            </div>
          ) : null}

          <label className="student-notes-label">
            <input type="checkbox" checked={confirmSend} onChange={(event) => setConfirmSend(event.target.checked)} /> I
            confirm I want to send this invitation or grant this access.
          </label>
          {error ? (
            <p className="student-auth-error" role="alert">
              {error}
            </p>
          ) : null}
          {notice ? <div className="notice">{notice}</div> : null}
          <div className="actions">
            <button className="primary" type="submit" disabled={!confirmSend || busy}>
              {busy ? "Working…" : "Send invitation"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
