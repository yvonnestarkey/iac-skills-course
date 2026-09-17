"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { waitlistButtonLabel, waitlistSuccessCopy } from "@/lib/sales-copy";
import { WAITLIST_COHORTS, isWaitlistCohort, joinWaitlist, type WaitlistCohort } from "@/lib/waitlist";

export default function WaitlistForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [cohort, setCohort] = useState<WaitlistCohort>("January 2027");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [joined, setJoined] = useState<WaitlistCohort | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    const result = await joinWaitlist({ full_name: fullName, email, preferred_cohort: cohort });
    setBusy(false);
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    setJoined(cohort);
  };

  if (joined) {
    return (
      <div className="waitlist-success" role="status">
        <p className="kicker">Waitlist</p>
        <h2>You&apos;re on the list!</h2>
        <p>{waitlistSuccessCopy(joined)}</p>
        <button
          className="ghost"
          type="button"
          onClick={() => {
            setJoined(null);
            setFullName("");
            setEmail("");
          }}
        >
          Add another email
        </button>
      </div>
    );
  }

  return (
    <form className="waitlist-form" onSubmit={(event) => void submit(event)}>
      <p className="kicker">January 2027 &amp; June 2027</p>
      <h2>Join the waitlist</h2>
      <p className="muted">Get the email when enrollment opens. No payment now — just your name, email, and cohort.</p>
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
      <label htmlFor="waitlist-cohort">Cohort</label>
      <select
        id="waitlist-cohort"
        name="cohort"
        value={cohort}
        onChange={(event) => {
          const next = event.target.value;
          if (isWaitlistCohort(next)) setCohort(next);
        }}
      >
        {WAITLIST_COHORTS.map((option) => (
          <option key={option} value={option}>
            {option} Cohort
          </option>
        ))}
      </select>
      {error ? (
        <p className="student-auth-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="primary" type="submit" disabled={busy}>
        {busy ? "Joining…" : waitlistButtonLabel(cohort)}
      </button>
      <Link className="waitlist-login-link" href="/login">
        Student / Coach Login ↗
      </Link>
    </form>
  );
}
