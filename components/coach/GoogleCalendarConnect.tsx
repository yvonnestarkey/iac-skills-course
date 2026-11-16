"use client";

import { useEffect, useState } from "react";
import { formatSastDateTime } from "@/lib/dates";

type ImportRow = {
  id: string;
  eventId: string;
  title: string;
  status: string;
  attendeeEmails: string[];
  error: string;
  createdAt: string;
};

type Settings = {
  connected: boolean;
  googleEmail: string;
  lastSyncAt: string | null;
  configured: boolean;
  redirectUri: string;
  webhookUrl: string;
  watchActive: boolean;
  imports: ImportRow[];
};

export default function GoogleCalendarConnect() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = async () => {
    const response = await fetch("/api/coach/google-calendar");
    const payload = (await response.json().catch(() => null)) as (Settings & { error?: string }) | null;
    if (!response.ok) {
      setError(payload?.error || "Could not load Google Calendar.");
      return;
    }
    setSettings(payload as Settings);
    setError("");
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) setNotice("Google Calendar is connected. Upcoming 1-on-1s will land on student profiles.");
    if (params.get("error") === "config") {
      setError("Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel, then connect again.");
    } else if (params.get("error") === "denied") {
      setError("Google access was not granted.");
    } else if (params.get("error") && params.get("error") !== "config") {
      setError(params.get("error") || "Could not connect Google Calendar.");
    }
    void load();
  }, []);

  const run = async (action: "sync" | "disconnect") => {
    setBusy(action);
    setNotice("");
    setError("");
    const response = await fetch("/api/coach/google-calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const payload = (await response.json().catch(() => null)) as (Settings & {
      ok?: boolean;
      error?: string;
      scanned?: number;
      imported?: number;
      unmatched?: number;
      cancelled?: number;
    }) | null;
    setBusy("");
    if (!response.ok || payload?.ok === false) {
      setError(payload?.error || "Could not update Google Calendar.");
      return;
    }
    setSettings(payload as Settings);
    if (action === "disconnect") setNotice("Disconnected. Students can book again until you reconnect and a meeting is on the calendar.");
    else {
      setNotice(
        `Looked at ${payload?.scanned || 0} calendar events. Saved ${payload?.imported || 0} 1-on-1s on student profiles.`
      );
    }
  };

  return (
    <section className="card">
      <p className="kicker">Coach tools</p>
      <h1>Google Calendar</h1>
      <p className="muted">
        Connect the calendar that receives Calendly 1-on-1s. Only events whose name includes “IAC January 2027” are
        imported. Buffer blocks are ignored. When a student books, the appointment is saved on their profile and their
        booking link is closed so they cannot set up a second session.
      </p>
      {error ? <p className="waiting">{error}</p> : null}
      {notice ? <p className="muted">{notice}</p> : null}

      <ol className="fireflies-steps">
        <li>
          In Google Cloud, enable the Calendar API and create an OAuth web client. Add this redirect URI:
          <code className="fireflies-copy-value">{settings?.redirectUri}</code>
        </li>
        <li>
          Put <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> in Vercel, then connect below with the
          Google account that holds the 1-on-1s.
        </li>
        <li>
          Paste <code>supabase/google-calendar-coaching.sql</code> in Supabase if the tables are new.
        </li>
      </ol>

      <p className="muted small">
        {settings?.connected
          ? `Connected as ${settings.googleEmail || "Google Calendar"}${
              settings.lastSyncAt ? ` · last checked ${formatSastDateTime(settings.lastSyncAt)}` : ""
            }${settings.watchActive ? " · live updates on" : ""}`
          : settings?.configured
            ? "Not connected yet."
            : "Google OAuth is not configured in Vercel yet."}
      </p>

      <p className="coaching-actions">
        {settings?.connected ? (
          <>
            <button type="button" className="primary" disabled={Boolean(busy)} onClick={() => void run("sync")}>
              {busy === "sync" ? "Checking calendar…" : "Check calendar now"}
            </button>
            <button type="button" className="ghost" disabled={Boolean(busy)} onClick={() => void run("disconnect")}>
              Disconnect
            </button>
          </>
        ) : (
          <a className="primary coaching-book-btn" href="/api/coach/google-calendar/connect">
            Connect Google Calendar
          </a>
        )}
      </p>

      {settings?.imports?.length ? (
        <div className="work-list">
          {settings.imports.map((row) => (
            <article key={row.id} className="coaching-session-card">
              <p>
                <strong>{row.title || "Calendar event"}</strong>
                <span className="muted"> · {row.status}</span>
              </p>
              <p className="muted small">{row.attendeeEmails.join(", ") || "No attendee emails"}</p>
              {row.error ? <p className="waiting">{row.error}</p> : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="empty">Imported 1-on-1s will list here after a calendar check.</p>
      )}
    </section>
  );
}
