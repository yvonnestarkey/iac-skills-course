"use client";

import { useMemo, useState } from "react";
import {
  coachingPdfFiles,
  transcriptMatchCount,
  transcriptSearchParts,
  type StudentCoachingSession,
} from "@/lib/coaching";
import { formatSastDateTime } from "@/lib/dates";
import { embedSrcForVideo, YOUTUBE_EMBED_ALLOW, YOUTUBE_EMBED_REFERRER_POLICY } from "@/lib/video-embed";

function DescriptionBlock({ text }: { text: string }) {
  const paragraphs = text
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!paragraphs.length) return null;
  return (
    <div className="coaching-exec-copy">
      {paragraphs.map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>
      ))}
    </div>
  );
}

function CoachingTranscript({
  text,
  firefliesUrl,
}: {
  text: string | null;
  firefliesUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const parts = useMemo(() => transcriptSearchParts(text || "", query), [text, query]);
  const hits = useMemo(() => transcriptMatchCount(text || "", query), [text, query]);

  return (
    <div className={`coaching-transcript-block${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="coaching-pill coaching-transcript-toggle"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span>Fireflies Transcript</span>
        <span className="coaching-transcript-arrow" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div className="coaching-transcript-panel">
          {text ? (
            <>
              <label className="coaching-transcript-search">
                <span className="visually-hidden">Search the transcript</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search for a word or phrase…"
                />
              </label>
              {query.trim() ? (
                <p className="coaching-transcript-hits muted small">
                  {hits === 1 ? "1 match" : `${hits} matches`}
                </p>
              ) : null}
              <pre className="coaching-transcript-text">
                {parts.map((part, index) =>
                  part.match ? <mark key={`${index}-${part.text}`}>{part.text}</mark> : <span key={`${index}-${part.text.slice(0, 12)}`}>{part.text}</span>
                )}
              </pre>
            </>
          ) : (
            <p className="muted">
              {firefliesUrl ? (
                <>
                  Your transcript will appear here after the session.{" "}
                  <a href={firefliesUrl} target="_blank" rel="noopener noreferrer">
                    Open in Fireflies
                  </a>
                </>
              ) : (
                "Your Fireflies transcript will appear here after the session."
              )}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function CoachingSessionBoard({
  session,
  bannerUrl,
}: {
  session: StudentCoachingSession;
  bannerUrl: string;
}) {
  const embed = embedSrcForVideo(session.recordingUrl || undefined);
  const pdfs = coachingPdfFiles(session);
  const when = formatSastDateTime(session.sessionAt);
  const youtube = Boolean(embed && embed.includes("youtube.com/embed/"));

  return (
    <section className="coaching-board" aria-label="Session recording and notes">
      <img className="coaching-board-bg" src={bannerUrl || "/student-dashboard-banner.jpg"} alt="" />
      <div className="coaching-board-overlay">
        <div className="coaching-board-left">
          <div className="coaching-video-plate">
            {embed ? (
              <iframe
                className="coaching-video-frame"
                src={embed}
                title={session.title || "Session recording"}
                allow={youtube ? YOUTUBE_EMBED_ALLOW : "autoplay; fullscreen; picture-in-picture"}
                referrerPolicy={youtube ? YOUTUBE_EMBED_REFERRER_POLICY : undefined}
                allowFullScreen
              />
            ) : session.recordingUrl ? (
              <a className="coaching-video-link" href={session.recordingUrl} target="_blank" rel="noopener noreferrer">
                <span>Video</span>
                <span className="muted small">Open recording</span>
              </a>
            ) : (
              <div className="coaching-video-empty">
                <span>Video</span>
                <span className="muted small">Your recording will appear here after the session.</span>
              </div>
            )}
          </div>
          <CoachingTranscript text={session.transcriptText} firefliesUrl={session.firefliesTranscriptUrl} />
          {pdfs.map((file) => (
            <a
              key={file.url}
              className="coaching-pill coaching-pdf-pill"
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              PDF{file.name ? ` · ${file.name}` : ""}
            </a>
          ))}
        </div>
        <div className="coaching-exec-plate">
          <h2>Executive Summary</h2>
          {when ? <p className="coaching-exec-when muted small">{when}</p> : null}
          {session.coachNotes ? (
            <DescriptionBlock text={session.coachNotes} />
          ) : (
            <p className="muted coaching-exec-empty">
              Take-aways from this session will appear here after Yvonne adds them.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
