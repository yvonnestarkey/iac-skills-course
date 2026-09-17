"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { waitlistButtonLabel, waitlistSuccessCopy } from "@/lib/sales-copy";
import {
  WAITLIST_EXAMS,
  WAITLIST_INSTITUTIONS,
  WAITLIST_PAYMENTS,
  isWaitlistExam,
  isWaitlistInstitution,
  isWaitlistPayment,
  joinWaitlist,
  type WaitlistExam,
  type WaitlistInstitution,
  type WaitlistPayment,
} from "@/lib/waitlist";

export default function WaitlistForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [exam, setExam] = useState<WaitlistExam>("January 2027 IAC Exam");
  const [institution, setInstitution] = useState<WaitlistInstitution | "">("");
  const [payment, setPayment] = useState<WaitlistPayment>("Once-off ($327)");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [joined, setJoined] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    if (!isWaitlistInstitution(institution)) {
      setBusy(false);
      setError("Choose your institution / professional body.");
      return;
    }
    const result = await joinWaitlist({
      full_name: fullName,
      email,
      preferred_cohort: exam,
      preferred_payment: payment,
      institution,
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
      <p className="muted">Get the email when registration opens. No payment now — tell us your exam, institution, and how you would like to pay.</p>
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
      <label htmlFor="waitlist-exam">Target Exam</label>
      <select
        id="waitlist-exam"
        name="exam"
        value={exam}
        onChange={(event) => {
          const next = event.target.value;
          if (isWaitlistExam(next)) setExam(next);
        }}
      >
        {WAITLIST_EXAMS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <label htmlFor="waitlist-institution">Institution / Professional Body</label>
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
        {WAITLIST_INSTITUTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <label htmlFor="waitlist-payment">Preferred Payment Option</label>
      <select
        id="waitlist-payment"
        name="payment"
        value={payment}
        onChange={(event) => {
          const next = event.target.value;
          if (isWaitlistPayment(next)) setPayment(next);
        }}
      >
        {WAITLIST_PAYMENTS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {error ? (
        <p className="student-auth-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="primary" type="submit" disabled={busy}>
        {busy ? "Joining…" : waitlistButtonLabel(exam)}
      </button>
      <Link className="waitlist-login-link" href="/login">
        Student / Coach Login ↗
      </Link>
    </form>
  );
}
