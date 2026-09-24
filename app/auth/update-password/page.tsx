"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  afterPasswordSavedPath,
  canSubmitInvitePassword,
  consumeAuthParamsFromLocation,
  establishAuthSession,
  isInvitePasswordFlow,
  openingPasswordSessionCopy,
  savePasswordWithSession,
  sessionNotReadyMessage,
  studentFacingPasswordError,
} from "@/lib/invite-session";
import { getSupabase } from "@/lib/supabase";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [invite, setInvite] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
      setStatus(sessionNotReadyMessage(inviteFlow));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const submitEnabled = canSubmitInvitePassword({ sessionReady, invalid, submitting });

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
    </section>
  );
}
