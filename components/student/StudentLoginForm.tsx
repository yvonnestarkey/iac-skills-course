"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ensureStudentProfile } from "@/lib/profiles";
import { fetchOnboardingGate } from "@/lib/onboarding";
import { isCoachAccount } from "@/lib/roles";
import { goToStudentLogin, safeStudentPath, studentUserFromAuth } from "@/lib/student-lesson";
import { useStore } from "@/lib/store";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import { useStudentSession } from "@/lib/student-session";

type Mode = "signin" | "signup";

export default function StudentLoginForm({ initialMode = "signin" }: { initialMode?: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready, user, onboarding, signOut } = useStudentSession();
  const { setSession } = useStore();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [resetSent, setResetSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const nextPath = safeStudentPath(searchParams.get("next"));

  useEffect(() => {
    if (!ready || !user || isCoachAccount(user) || onboarding === "unknown") return;
    if (onboarding === "done") router.replace(nextPath);
    else router.replace("/onboarding");
  }, [ready, user, onboarding, nextPath, router]);

  if (ready && isCoachAccount(user)) {
    return (
      <section className="card login student-login">
        <p className="kicker">Coach session</p>
        <h1 className="brand">Login as a student</h1>
        <p className="muted">
          You are signed in as {user?.email || "a coach"}. This is a coach account. Preview the course, or sign out to
          log in with a student email.
        </p>
        <div className="actions">
          <button className="primary" type="button" onClick={() => router.push("/coach/preview")}>
            Preview student course
          </button>
          <button
            className="ghost"
            type="button"
            onClick={() => {
              setSession({ role: "coach", id: "coach" });
              router.push("/coach");
            }}
          >
            Coach dashboard
          </button>
          <button
            className="ghost"
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await signOut();
              goToStudentLogin();
            }}
          >
            Sign out and log in as a student
          </button>
        </div>
      </section>
    );
  }

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
        const studentUser = studentUserFromAuth(data.user);
        await ensureStudentProfile({
          id: data.user.id,
          email: data.user.email || trimmedEmail,
          role: studentUser.role,
          full_name: studentUser.full_name,
          user_metadata: data.user.user_metadata,
        });
        if (isCoachAccount(studentUser)) {
          setSession({ role: "coach", id: "coach" });
          router.replace("/coach");
          return;
        }
        const gate = await fetchOnboardingGate(data.user.id);
        router.replace(gate === "done" ? nextPath : "/onboarding");
        return;
      }
      router.replace(nextPath);
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
    if (data.user) {
      await ensureStudentProfile({
        id: data.user.id,
        email: data.user.email || trimmedEmail,
        user_metadata: data.user.user_metadata,
      });
    }
    setBusy(false);
    if (!data.session) {
      setError("Account created. Confirm the email we sent, then sign in.");
      setMode("signin");
      setPassword("");
      setConfirm("");
      return;
    }
    router.replace("/welcome");
  };

  const sendReset = async () => {
    setError("");
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Enter your email to reset your password.");
      return;
    }
    const supabase = getSupabase();
    if (!supabase) return;
    setBusy(true);
    const origin = window.location.origin;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: `${origin}/auth/callback?next=/auth/update-password`,
    });
    setBusy(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setResetSent(true);
  };
  return (
    <section className="card login student-login">
      <h1 className="brand">{mode === "signin" ? "Student / coach sign in" : "Create your account"}</h1>
      <p className="muted">
        {mode === "signin"
          ? "Sign in with your email and password to open the IAC Skills Course or the coach dashboard."
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
        {resetSent ? <p className="notice">Check your email for the password reset link.</p> : null}
        <div className="actions">
          <button className="primary" type="submit" disabled={busy || !supabaseConfigured}>
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
          {mode === "signin" ? (
            <button className="ghost" type="button" disabled={busy} onClick={() => void sendReset()}>
              Forgot password
            </button>
          ) : null}
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
