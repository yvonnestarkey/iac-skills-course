"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import {
  activateInboxBody,
  activateInboxHeading,
  activatePageBody,
  activatePageCta,
  activatePageHeading,
} from "@/lib/account-recovery";

export default function ActivateAccountForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setHint("Enter the email this invitation was sent to.");
      return;
    }
    setBusy(true);
    setHint("");
    const response = await fetch("/api/auth/password-setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: trimmed }),
    }).catch(() => null);
    setBusy(false);
    if (!response) {
      setHint("We could not send the email just now. Try again in a moment.");
      return;
    }
    setSent(true);
  };

  return (
    <section className="card login student-login invite-setup">
      {sent ? (
        <>
          <h1 className="brand">{activateInboxHeading()}</h1>
          <p>{activateInboxBody()}</p>
        </>
      ) : (
        <>
          <h1 className="brand">{activatePageHeading()}</h1>
          <p>{activatePageBody()}</p>
          <form className="invite-recovery-form" onSubmit={(event) => void submit(event)}>
            <label className="student-notes-label" htmlFor="activate-email">
              Email
            </label>
            <input
              id="activate-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            {hint ? <p className="muted">{hint}</p> : null}
            <button className="primary" type="submit" disabled={busy}>
              {busy ? "Sending…" : activatePageCta()}
            </button>
          </form>
        </>
      )}
      <div className="invite-recovery-alt">
        <p className="muted">Already set your password?</p>
        <Link className="ghost" href="/login">
          Student Login
        </Link>
      </div>
    </section>
  );
}
