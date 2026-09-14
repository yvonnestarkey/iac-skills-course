"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { ensureStudentProfile } from "@/lib/profiles";
import { clearOnboardingSkip } from "@/lib/onboarding";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";

type Mode = "signin" | "signup";

export default function StudentLoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const goToOnboarding = () => {
    router.replace("/onboarding");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (mode === "signup" && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setError("Supabase is not configured, so sign-in is unavailable.");
      return;
    }

    setBusy(true);
    if (mode === "signin") {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (signInError) {
        setBusy(false);
        setError(signInError.message);
        return;
      }
      if (data.user) {
        await ensureStudentProfile({ id: data.user.id, email: data.user.email || trimmedEmail });
        await clearOnboardingSkip(data.user.id);
      }
      window.location.replace("/student");
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
    });
    if (signUpError) {
      setBusy(false);
      setError(signUpError.message);
      return;
    }
    if (data.user) await ensureStudentProfile({ id: data.user.id, email: data.user.email || trimmedEmail });
    setBusy(false);
    if (!data.session) {
      setError("Account created. Confirm the email we sent, then sign in.");
      setMode("signin");
      setPassword("");
      setConfirm("");
      return;
    }
    goToOnboarding();
  };
  return (
    <section className="card login student-login">
      <h1 className="brand">{mode === "signin" ? "Student sign in" : "Create your account"}</h1>
      <p className="muted">
        {mode === "signin"
          ? "Sign in with your email and password to open the IAC Skills Course."
          : "Register with your email and a password to start the IAC Skills Course."}
      </p>
      {!supabaseConfigured ? (
        <p className="student-auth-error" role="alert">
          Supabase is not configured on this machine, so sign-in is unavailable.
        </p>
      ) : null}
      <form onSubmit={submit}>
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
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={6}
        />
        {mode === "signup" ? (
          <>
            <label className="student-notes-label" htmlFor="student-password-confirm">
              Confirm password
            </label>
            <input
              id="student-password-confirm"
              type="password"
              autoComplete="new-password"
              placeholder="Confirm password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
              minLength={6}
            />
          </>
        ) : null}
        {error ? (
          <p className="student-auth-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="actions">
          <button className="primary" type="submit" disabled={busy || !supabaseConfigured}>
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
          <button
            className="ghost"
            type="button"
            disabled={busy}
            onClick={() => {
              setError("");
              setConfirm("");
              setMode(mode === "signin" ? "signup" : "signin");
            }}
          >
            {mode === "signin" ? "Need an account? Register" : "Already registered? Sign in"}
          </button>
        </div>
      </form>
    </section>
  );
}
