"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import HelpTooltip from "@/components/ui/HelpTooltip";
import { normalizeAccountProfile, type AccountProfile } from "@/lib/account-profile";

const EMPTY: AccountProfile = {
  email: "",
  full_name: "",
  phone_number: "",
  accountability_email: "",
};

export default function ProfileEditor({
  showAccountability = true,
}: {
  showAccountability?: boolean;
}) {
  const [profile, setProfile] = useState<AccountProfile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/profile", { credentials: "same-origin" });
        const body = (await response.json().catch(() => null)) as { profile?: AccountProfile; error?: string } | null;
        if (cancelled) return;
        if (!response.ok) {
          setError(body?.error || "Could not load your profile.");
          return;
        }
        setProfile(normalizeAccountProfile(body?.profile));
      } catch {
        if (!cancelled) setError("Could not load your profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const setField = (key: keyof AccountProfile, value: string) => {
    setProfile((current) => ({ ...current, [key]: value }));
    setError("");
    setNotice("");
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const body = (await response.json().catch(() => null)) as {
        profile?: AccountProfile;
        error?: string;
        message?: string;
        email_confirmation_required?: boolean;
      } | null;
      if (!response.ok) {
        setError(body?.error || "Could not save your profile.");
        return;
      }
      if (body?.profile) setProfile(normalizeAccountProfile(body.profile));
      setNotice(body?.message || "Profile saved.");
      if (body?.email_confirmation_required) {
        window.setTimeout(() => window.location.reload(), 400);
      }
    } catch {
      setError("Could not save your profile.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="muted">Loading your details…</p>;

  return (
    <form className="profile-editor" onSubmit={onSubmit}>
      <div className="onboarding-field">
        <label className="student-notes-label" htmlFor="profile-name">
          Name
        </label>
        <input
          id="profile-name"
          type="text"
          autoComplete="name"
          value={profile.full_name}
          onChange={(event) => setField("full_name", event.target.value)}
        />
      </div>
      <div className="onboarding-field">
        <label className="student-notes-label" htmlFor="profile-email">
          Email
        </label>
        <input
          id="profile-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={profile.email}
          onChange={(event) => setField("email", event.target.value)}
        />
      </div>
      <div className="onboarding-field">
        <div className="onboarding-field-label">
          <label className="student-notes-label" htmlFor="profile-phone">
            Phone number <span className="muted">(optional)</span>
          </label>
          <HelpTooltip contentKey="phone_number_info" />
        </div>
        <input
          id="profile-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+27 82 123 4567"
          value={profile.phone_number}
          onChange={(event) => setField("phone_number", event.target.value)}
        />
      </div>
      {showAccountability ? (
        <div className="onboarding-field">
          <div className="onboarding-field-label">
            <label className="student-notes-label" htmlFor="profile-accountability">
              Accountability email <span className="muted">(optional)</span>
            </label>
            <HelpTooltip contentKey="accountability_email_info" />
          </div>
          <input
            id="profile-accountability"
            type="email"
            autoComplete="email"
            placeholder="someone-who-will-nudge-you@example.com"
            value={profile.accountability_email}
            onChange={(event) => setField("accountability_email", event.target.value)}
          />
        </div>
      ) : null}
      {error ? (
        <p className="student-auth-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? <p className="notice">{notice}</p> : null}
      <div className="actions">
        <button className="primary" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}
