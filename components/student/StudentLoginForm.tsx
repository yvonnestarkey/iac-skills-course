"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { supabaseConfigured } from "@/lib/supabase";
import { safeStudentPath, signInStudent, signUpStudent } from "@/lib/student-lesson";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const goNext = () => {
    router.replace(safeStudentPath(searchParams.get("next")));
  };

  const run = async (mode: "in" | "up") => {
    setBusy(true);
    setStatus("");
    const result = mode === "in" ? await signInStudent(email, password) : await signUpStudent(email, password);
    if (!result.ok) {
      setStatus(result.error || "Could not sign in.");
      setBusy(false);
      return;
    }
    if ("needsConfirm" in result && result.needsConfirm) {
      setStatus("Account created. Confirm the email we sent, then sign in.");
      setBusy(false);
      return;
    }
    goNext();
  };

  return (
    <section className="card login student-login">
      <h1 className="brand">Student sign in</h1>
      <p className="muted">Use your course email to open the IAC Skills Course player.</p>
      {!supabaseConfigured ? (
        <p className="notice">Supabase is not configured on this machine, so sign-in is unavailable.</p>
      ) : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          run("in");
        }}
      >
        <label className="student-notes-label" htmlFor="student-email">
          Email
        </label>
        <input
          id="student-email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <label className="student-notes-label" htmlFor="student-password">
          Password
        </label>
        <input
          id="student-password"
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={6}
        />
        {status ? <p className="notice">{status}</p> : null}
        <div className="actions">
          <button className="primary" type="submit" disabled={busy || !supabaseConfigured}>
            Sign in
          </button>
          <button className="ghost" type="button" disabled={busy || !supabaseConfigured} onClick={() => run("up")}>
            Create account
          </button>
        </div>
      </form>
    </section>
  );
}

export default function StudentLoginForm() {
  return (
    <Suspense fallback={<p className="student-loading">Loading sign in…</p>}>
      <LoginForm />
    </Suspense>
  );
}
