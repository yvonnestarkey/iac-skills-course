"use client";

import { useEffect, useState } from "react";

type ImportRow = {
  id: string;
  meetingId: string;
  title: string;
  status: string;
  attendeeEmails: string[];
  error: string;
  createdAt: string;
};

type Settings = {
  apiKeySet: boolean;
  apiKeyHint: string;
  webhookSecret: string;
  webhookSecretSet: boolean;
  webhookUrl: string;
  envApiKey: boolean;
  envWebhookSecret: boolean;
  imports: ImportRow[];
};

export default function FirefliesConnect() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = async () => {
    const response = await fetch("/api/coach/fireflies");
    const payload = (await response.json().catch(() => null)) as (Settings & { error?: string }) | null;
    if (!response.ok) {
      setError(payload?.error || "Could not load Fireflies settings.");
      return;
    }
    setSettings(payload as Settings);
    setError("");
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async (action: "save" | "test" | "sync") => {
    setBusy(action);
    setNotice("");
    setError("");
    const response = await fetch("/api/coach/fireflies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, apiKey, webhookSecret: settings?.webhookSecret || "" }),
    });
    const raw = await response.text();
    const payload = (() => {
      try {
        return JSON.parse(raw) as Settings & {
          ok?: boolean;
          error?: string;
          scanned?: number;
          imported?: number;
          unmatched?: number;
          skipped?: number;
          errors?: number;
        };
      } catch {
        return null;
      }
    })();
    setBusy("");
    if (!response.ok || payload?.ok === false) {
      setError(payload?.error || raw.slice(0, 280) || `Could not import Fireflies calls (${response.status}).`);
      return;
    }
    if (action === "test") {
      setNotice("Fireflies accepted the API key.");
      return;
    }
    if (action === "sync") {
      setNotice(
        `Looked at ${payload?.scanned || 0} Fireflies calls: ${payload?.imported || 0} added to student profiles, ${payload?.unmatched || 0} unmatched, ${payload?.skipped || 0} already imported${payload?.errors ? `, ${payload.errors} failed` : ""}.`
      );
      await load();
      return;
    }
    setApiKey("");
    setNotice("Saved. Paste the webhook URL and signing secret into Fireflies, then send a test event.");
    await load();
  };

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`Copied ${label}.`);
    } catch {
      setError(`Could not copy ${label}.`);
    }
  };

  if (!settings && !error) return <p>Loading Fireflies…</p>;

  return (
    <section className="card">
      <p className="kicker">Integrations</p>
      <h1>Fireflies</h1>
      <p className="muted">
        After a 1-on-1 Zoom, Fireflies sends the transcript and summary here. We match the student’s calendar email to
        their profile and put the notes on that profile and on their coaching page.
      </p>
      <p className="muted small">
        Paste <code>supabase/fireflies-coaching.sql</code> in Supabase before the first import.
      </p>

      <ol className="fireflies-steps">
        <li>
          In Fireflies open <strong>Integrations → Fireflies API</strong> and copy your API key.
        </li>
        <li>
          Paste the key below and save. Then open{" "}
          <a href="https://app.fireflies.ai/integrations/custom/webhooks" target="_blank" rel="noopener noreferrer">
            Webhooks V2
          </a>
          , paste the webhook URL, paste the signing secret, and subscribe to <code>meeting.transcribed</code> and{" "}
          <code>meeting.summarized</code>.
        </li>
        <li>Send a test event, then keep Fireflies on your 1-on-1 Zoom so Fred joins the call.</li>
      </ol>

      <p>
        <strong>{settings?.apiKeySet ? "Connected" : "Not connected"}</strong>
        {settings?.apiKeyHint ? ` · ${settings.apiKeyHint}` : ""}
        {settings?.envApiKey ? " · API key is set in Vercel" : ""}
      </p>

      <label className="student-notes-label" htmlFor="fireflies-api-key">
        Fireflies API key
      </label>
      <input
        id="fireflies-api-key"
        className="select-line"
        type="password"
        autoComplete="off"
        value={apiKey}
        onChange={(event) => setApiKey(event.target.value)}
        placeholder={settings?.apiKeySet ? "Saved — paste a new key to replace it" : "Paste API key"}
        disabled={Boolean(busy) || settings?.envApiKey}
      />

      <div className="fireflies-copy-row">
        <div>
          <p className="student-notes-label">Webhook URL</p>
          <code className="fireflies-copy-value">{settings?.webhookUrl}</code>
        </div>
        {settings?.webhookUrl ? (
          <button type="button" className="ghost" onClick={() => void copy(settings.webhookUrl, "webhook URL")}>
            Copy URL
          </button>
        ) : null}
      </div>

      <div className="fireflies-copy-row">
        <div>
          <p className="student-notes-label">Signing secret</p>
          <code className="fireflies-copy-value">
            {settings?.envWebhookSecret ? "Set in Vercel" : settings?.webhookSecret || "Will be created on save"}
          </code>
        </div>
        {settings?.webhookSecret && !settings.envWebhookSecret ? (
          <button type="button" className="ghost" onClick={() => void copy(settings.webhookSecret, "signing secret")}>
            Copy secret
          </button>
        ) : null}
      </div>

      <p className="coaching-actions">
        <button type="button" className="primary" disabled={Boolean(busy)} onClick={() => void save("save")}>
          {busy === "save" ? "Saving…" : "Save"}
        </button>
        <button type="button" className="ghost" disabled={Boolean(busy)} onClick={() => void save("test")}>
          {busy === "test" ? "Testing…" : "Test API key"}
        </button>
        <button
          type="button"
          className="ghost"
          disabled={Boolean(busy) || !settings?.apiKeySet}
          onClick={() => void save("sync")}
        >
          {busy === "sync" ? "Importing past calls…" : "Import past calls"}
        </button>
      </p>
      {notice ? <p className="muted">{notice}</p> : null}
      {error ? <p className="waiting">{error}</p> : null}

      <h2>Recent imports</h2>
      {settings?.imports?.length ? (
        <ul className="note-list">
          {settings.imports.map((row) => (
            <li key={row.id}>
              <p>
                <strong>{row.title || row.meetingId}</strong> · {row.status}
              </p>
              <p className="muted small">
                {row.attendeeEmails.join(", ") || "No attendee emails"}
                {row.error ? ` · ${row.error}` : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">No Fireflies meetings have landed yet.</p>
      )}
    </section>
  );
}
