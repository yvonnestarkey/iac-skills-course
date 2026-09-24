"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

type RecoverableOtpType = "invite" | "recovery" | "signup" | "magiclink" | "email";

function queryAndHashParams() {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return { search, hash };
}

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { search, hash } = queryAndHashParams();
    const type = (search.get("type") || hash.get("type") || "") as RecoverableOtpType | "";
    setInvite(type === "invite");

    const tokenHash = search.get("token_hash");
    const code = search.get("code");
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");

    if (code) {
      void supabase.auth.exchangeCodeForSession(code);
      return;
    }
    if (tokenHash) {
      const otpType: RecoverableOtpType =
        type === "invite" || type === "recovery" || type === "signup" || type === "magiclink" || type === "email"
          ? type
          : "invite";
      void supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType });
      return;
    }
    if (accessToken && refreshToken) {
      void supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    }
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setStatus(error.message);
      return;
    }
    if (invite) {
      router.replace("/onboarding");
      return;
    }
    setStatus("Password updated. You can continue into the course.");
  };

  return (
    <section className="card login student-login">
      <h1 className="brand">{invite ? "Set your password" : "Set a new password"}</h1>
      {invite ? (
        <p className="muted">Choose your own password. Next you will complete the course questionnaire.</p>
      ) : null}
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
        />
        {status ? <p role="alert">{status}</p> : null}
        <button className="primary" type="submit" disabled={busy}>
          Save password
        </button>
      </form>
    </section>
  );
}
