"use client";

import { useState } from "react";
import { generateTemporaryPassword } from "@/lib/set-temporary-password";

export default function SetTemporaryPasswordPanel({
  userId,
  studentName,
}: {
  userId: string;
  studentName: string;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const copyPassword = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setError("Could not copy. Select the password and copy it manually.");
    }
  };

  const submit = async () => {
    setError("");
    setSuccess("");
    setCopied(false);
    if (!confirm) {
      setError("Confirm Set temporary password before changing it.");
      return;
    }
    setBusy(true);
    const response = await fetch("/api/coach/set-temporary-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: userId, password, confirm: true }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error || "Could not set the temporary password.");
      return;
    }
    setSuccess(payload.message || "Temporary password set.");
    setConfirm(false);
  };

  return (
    <section className="card temp-password-card">
      <div className="panel-head">
        <div>
          <h2>Set temporary password</h2>
          <p className="muted small">
            Admin only. Sets a sign-in password for {studentName} now. This does not send email and does not replace
            the password-setup link.
          </p>
        </div>
      </div>
      <label className="student-notes-label" htmlFor={`temp-password-${userId}`}>
        Temporary password
      </label>
      <div className="temp-password-row">
        <input
          id={`temp-password-${userId}`}
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setCopied(false);
            setSuccess("");
          }}
        />
        <button
          className="ghost"
          type="button"
          onClick={() => {
            setPassword(generateTemporaryPassword());
            setCopied(false);
            setSuccess("");
          }}
        >
          Generate
        </button>
        <button className="ghost" type="button" disabled={!password} onClick={() => void copyPassword()}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <label className="temp-password-confirm">
        <input type="checkbox" checked={confirm} onChange={(event) => setConfirm(event.target.checked)} />
        I will send this password to the student myself. They should change it after signing in.
      </label>
      <div className="actions">
        <button className="primary" type="button" disabled={busy} onClick={() => void submit()}>
          {busy ? "Setting…" : "Set temporary password"}
        </button>
      </div>
      {success ? <p className="notice">{success}</p> : null}
      {error ? (
        <p className="student-auth-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
