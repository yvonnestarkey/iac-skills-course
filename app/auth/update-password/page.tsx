"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  afterPasswordSavedPath,
  alreadyActivatedPrompt,
  canSubmitInvitePassword,
  consumeAuthParamsFromLocation,
  establishAuthSession,
  expiredInviteBody,
  expiredInviteHeading,
  expiredInviteRecoveryCta,
  freshLinkSentBody,
  freshLinkSentHeading,
  freshLinkSentSpamNote,
  isInvitePasswordFlow,
  openingPasswordSessionCopy,
  savePasswordWithSession,
  sessionNotReadyMessage,
  studentFacingPasswordError,
} from "@/lib/invite-session";
import { getSupabase } from "@/lib/supabase";

function InviteHelpFallback() {
  return (
    <p className="invite-recovery-help">
      Still having trouble? Email Yvonne at{" "}
      <a href="mailto:yvonne@accountingstudyadvice.com">yvonne@accountingstudyadvice.com</a>
    </p>
  );
}

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [invite, setInvite] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryHint, setRecoveryHint] = useState("");
  const [recoverySent, setRecoverySent] = useState(false);

  useEffect(() => {
    const { params, nextSearch } = consumeAuthParamsFromLocation(window.location);
    window.history.replaceState({}, "", `${window.location.pathname}${nextSearch}`);

    const inviteFlow = isInvitePasswordFlow(params);
    setInvite(inviteFlow);

    const supabase = getSupabase();
    if (!supabase) {
      setInvalid(true);
      setStatus("This page is unavailable right now. Open the invitation link again in a few minutes.");
      return;
    }

    let cancelled = false;
    establishAuthSession(supabase, params).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setSessionReady(true);
        setInvalid(false);
        setStatus("");
        return;
      }
      setSessionReady(false);
      setInvalid(true);
      if (!inviteFlow) setStatus(sessionNotReadyMessage(false));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const submitEnabled = canSubmitInvitePassword({ sessionReady, invalid, submitting });
  const inviteNeedsSetup = invalid && invite;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmitInvitePassword({ sessionReady, invalid, submitting })) return;
    const supabase = getSupabase();
    if (!supabase) return;
    setSubmitting(true);
    setStatus("");
    const { error } = await savePasswordWithSession(supabase, password);
    if (error) {
      console.error("update-password", {
        message: error.message || null,
        code: error.code || null,
        status: error.status || null,
        invite,
      });
      setSubmitting(false);
      setStatus(studentFacingPasswordError(error, invite));
      return;
    }
    const next = afterPasswordSavedPath(invite);
    if (next) {
      router.replace(next);
      return;
    }
    setSubmitting(false);
    setStatus("Password saved. You can continue into the course.");
  };

  const requestNewLink = async (event: FormEvent) => {
    event.preventDefault();
    const email = recoveryEmail.trim();
    if (!email || !email.includes("@")) {
      setRecoveryHint("Enter the email this invitation was sent to.");
      return;
    }
    setRecoveryBusy(true);
    setRecoveryHint("");
    const response = await fetch("/api/auth/password-setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);
    setRecoveryBusy(false);
    if (!response) {
      setRecoveryHint("We could not send the email just now. Try again in a moment.");
      return;
    }
    setRecoverySent(true);
  };

  if (inviteNeedsSetup) {
    return (
      <section className="card login student-login invite-setup">
        {recoverySent ? (
          <>
            <h1 className="brand">{freshLinkSentHeading()}</h1>
            <p>{freshLinkSentBody()}</p>
            <p className="muted">{freshLinkSentSpamNote()}</p>
          </>
        ) : (
          <>
            <h1 className="brand">{expiredInviteHeading()}</h1>
            {expiredInviteBody().map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <form className="invite-recovery-form" onSubmit={(event) => void requestNewLink(event)}>
              <label className="student-notes-label" htmlFor="recovery-email">
                Email
              </label>
              <input
                id="recovery-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                value={recoveryEmail}
                onChange={(event) => setRecoveryEmail(event.target.value)}
                required
              />
              {recoveryHint ? <p className="muted">{recoveryHint}</p> : null}
              <button className="primary" type="submit" disabled={recoveryBusy}>
                {recoveryBusy ? "Sending…" : expiredInviteRecoveryCta()}
              </button>
            </form>
          </>
        )}
        <div className="invite-recovery-alt">
          <p className="muted">{alreadyActivatedPrompt()}</p>
          <Link className="ghost" href="/login">
            Student Login
          </Link>
        </div>
        <InviteHelpFallback />
      </section>
    );
  }

  return (
    <section className="card login student-login">
      <h1 className="brand">{invite ? "Set your password" : "Set a new password"}</h1>
      {invite ? (
        <p className="muted">Choose your own password. Next you will complete the course questionnaire.</p>
      ) : null}
      {!sessionReady && !invalid ? <p className="muted">{openingPasswordSessionCopy(invite)}</p> : null}
      <form onSubmit={submit}>
        <label className="student-notes-label" htmlFor="new-password">
          New password
        </label>
        <input
          id="new-password"
          type="password"
          minLength={6}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          disabled={!submitEnabled}
        />
        {status ? <p role="alert">{status}</p> : null}
        <button className="primary" type="submit" disabled={!submitEnabled}>
          {submitting ? "Saving…" : !sessionReady && !invalid ? openingPasswordSessionCopy(invite) : "Save password"}
        </button>
      </form>
      {invalid ? (
        <div className="invite-recovery">
          <form onSubmit={(event) => void requestNewLink(event)}>
            <label className="student-notes-label" htmlFor="recovery-email">
              Email
            </label>
            <input
              id="recovery-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              value={recoveryEmail}
              onChange={(event) => setRecoveryEmail(event.target.value)}
              required
            />
            <button className="primary" type="submit" disabled={recoveryBusy}>
              {recoveryBusy ? "Sending…" : "Send me a new link"}
            </button>
          </form>
          {recoverySent ? (
            <p role="status">{freshLinkSentBody()}</p>
          ) : recoveryHint ? (
            <p className="muted">{recoveryHint}</p>
          ) : null}
          <div className="invite-recovery-alt">
            <p className="muted">{alreadyActivatedPrompt()}</p>
            <Link className="ghost" href="/login">
              Student Login
            </Link>
          </div>
          <InviteHelpFallback />
        </div>
      ) : null}
    </section>
  );
}
