"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { getSupabase } from "@/lib/supabase";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    setStatus(error ? error.message : "Password updated. You can continue into the course.");
  };

  return (
    <section className="card login student-login">
      <h1 className="brand">Set a new password</h1>
      <form onSubmit={submit}>
        <label className="student-notes-label" htmlFor="new-password">
          New password
        </label>
        <input id="new-password" type="password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required />
        {status ? <p role="alert">{status}</p> : null}
        <button className="primary" type="submit" disabled={busy}>
          Save password
        </button>
      </form>
    </section>
  );
}
