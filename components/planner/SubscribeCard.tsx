"use client";

import { useRef, useState } from "react";
import { feedUrls } from "@/lib/ics";
import type { Student } from "@/lib/types";

export default function SubscribeCard({ student, onStop }: { student: Student; onStop: () => void }) {
  const cal = student.calendar;
  const field = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  if (!cal || !cal.subscribed) {
    return (
      <section className="card subscribe-card">
        <h3>Subscribe to calendar</h3>
        <p className="muted small">
          A subscription is a live link rather than a one-off import. Save a change here and your calendar picks
          it up on its next refresh, so you never re-import a file.
        </p>
        {cal && cal.failed ? (
          <div className="waiting">
            The feed service is not reachable. Use <strong>Download Planner</strong> for a one-off file instead.
          </div>
        ) : null}
      </section>
    );
  }

  const urls = feedUrls(cal.token);

  const copy = () => {
    if (field.current) field.current.select();
    if (navigator.clipboard) navigator.clipboard.writeText(urls.http).catch(() => {});
    setCopied(true);
  };

  return (
    <section className="card subscribe-card live">
      <div className="panel-head">
        <div>
          <h3>Calendar subscription</h3>
          <p className="muted small">
            {cal.events != null ? `${cal.events} events · ` : ""}
            updated {cal.updatedAt || "just now"}
          </p>
        </div>
        <span className="score-chip small">Live</span>
      </div>
      <label className="feed-label" htmlFor="feed-url">
        Your private feed address
      </label>
      <div className="feed-row">
        <input id="feed-url" ref={field} type="text" readOnly value={urls.http} />
        <button className="ghost" id="copy-feed" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="actions">
        <a className="primary" href={urls.webcal}>
          Add to Apple Calendar / Outlook
        </a>
        <a className="ghost" href={urls.google} target="_blank" rel="noopener">
          Add to Google Calendar
        </a>
        <button className="ghost" id="unsubscribe" onClick={onStop}>
          Stop the feed
        </button>
      </div>
      <p className="muted small feed-note">
        Saving your plan republishes this feed automatically. Calendar apps re-check roughly hourly, so a change
        may take a little while to appear. On https://iac.accountingstudyadvice.com the Google Calendar link
        works; on localhost use Apple Calendar or Outlook instead.
      </p>
    </section>
  );
}
