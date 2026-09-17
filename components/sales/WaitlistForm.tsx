"use client";

import { useState, type FormEvent } from "react";
import { WAITLIST_FIRM_NOTE, WAITLIST_SUBTITLE, waitlistButtonLabel, waitlistSuccessCopy } from "@/lib/sales-copy";
import {
  WAITLIST_EXAMS,
  WAITLIST_PUBLIC_INSTITUTIONS,
  isWaitlistInstitution,
  joinWaitlist,
  type WaitlistInstitution,
} from "@/lib/waitlist";

export default function WaitlistForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [institution, setInstitution] = useState<WaitlistInstitution | "">("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [joined, setJoined] = useState(false);
  const exam = WAITLIST_EXAMS[0];

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    if (!isWaitlistInstitution(institution) || institution === "Other") {
      setBusy(false);
      setError("Choose your institution.");
      return;
    }
    const result = await joinWaitlist({
      full_name: fullName,
      email,
      preferred_cohort: exam,
      institution,
      query,
    });
    setBusy(false);
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    setJoined(true);
  };

  if (joined) {
    return (
      <div className="waitlist-success" role="status">
        <p className="kicker">Waitlist</p>
        <h2>You&apos;re on the list!</h2>
        <p>{waitlistSuccessCopy()}</p>
        <button
          className="ghost"
          type="button"
          onClick={() => {
            setJoined(false);
            setFullName("");
            setEmail("");
            setInstitution("");
            setQuery("");
          }}
        >
          Add another email
        </button>
      </div>
    );
  }

  return (
    <form className="waitlist-form" onSubmit={(event) => void submit(event)}>
      <p className="kicker">January 2027 IAC Exam</p>
      <h2>Join the waitlist</h2>
      <p className="muted">{WAITLIST_SUBTITLE}</p>
      <label htmlFor="waitlist-name">Full Name</label>
      <input
        id="waitlist-name"
        name="name"
        type="text"
        autoComplete="name"
        placeholder="Your full name"
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
        required
      />
      <label htmlFor="waitlist-email">Email Address</label>
      <input
        id="waitlist-email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <label htmlFor="waitlist-institution">Institution</label>
      <select
        id="waitlist-institution"
        name="institution"
        value={institution}
        required
        onChange={(event) => {
          const next = event.target.value;
          if (isWaitlistInstitution(next)) setInstitution(next);
        }}
      >
        <option value="" disabled>
          Select one
        </option>
        {WAITLIST_PUBLIC_INSTITUTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <label htmlFor="waitlist-query">Have any questions about the course? (Optional)</label>
      <textarea
        id="waitlist-query"
        name="query"
        rows={4}
        placeholder="e.g., Ask about firm sponsorships, study material access, or module schedules..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        maxLength={2000}
      />
      {error ? (
        <p className="student-auth-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="primary" type="submit" disabled={busy}>
        {busy ? "Joining…" : waitlistButtonLabel(exam)}
      </button>
      <p className="muted small waitlist-firm-note">{WAITLIST_FIRM_NOTE}</p>
    </form>
  );
}
