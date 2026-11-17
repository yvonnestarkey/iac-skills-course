"use client";

import { useEffect, useState } from "react";
import CoachingSessionBoard from "@/components/student/CoachingSessionBoard";
import {
  COACHING_BOOKING_NOTE,
  DEFAULT_COACHING_CONFIG,
  bookedCoachingSessions,
  bookedOneOnOneSession,
  fetchCoachingPageConfig,
  fetchStudentCoachingSessions,
  markCoachingDeliverablesSeen,
  sessionHasDeliverables,
  studentCanBookOneOnOne,
  type CoachingPageConfig,
  type StudentCoachingSession,
} from "@/lib/coaching";
import { formatSastDateTime } from "@/lib/dates";
import { useStudentSession } from "@/lib/student-session";

function DescriptionBlock({ text }: { text: string }) {
  const paragraphs = text
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!paragraphs.length) return null;
  return (
    <div className="coaching-description">
      {paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </div>
  );
}

export default function StudentCoachingPage() {
  const { user, readOnly } = useStudentSession();
  const [config, setConfig] = useState<CoachingPageConfig>(DEFAULT_COACHING_CONFIG);
  const [sessions, setSessions] = useState<StudentCoachingSession[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      await fetch("/api/student/coaching/sync", { method: "POST" }).catch(() => undefined);
      const [nextConfig, nextSessions] = await Promise.all([
        fetchCoachingPageConfig(),
        fetchStudentCoachingSessions(user.id),
      ]);
      if (cancelled) return;
      setConfig(nextConfig);
      setSessions(nextSessions);
      setReady(true);
      if (
        !readOnly &&
        nextSessions.some((session) => session.status === "completed" && sessionHasDeliverables(session))
      ) {
        void markCoachingDeliverablesSeen(user.id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, readOnly]);

  if (!ready) return <p className="student-loading">Loading coaching…</p>;

  const bookedSessions = bookedCoachingSessions(sessions);
  const booked = bookedOneOnOneSession(sessions);
  const canBook = studentCanBookOneOnOne(sessions);
  const bookedWhen = booked?.sessionAt ? formatSastDateTime(booked.sessionAt) : "";
  const bannerUrl = config.dashboard_banner_url || "/student-dashboard-banner.jpg";

  return (
    <article className="lesson-body wide coaching-page">
      <section className="coaching-booking">
        {config.banner_image_url ? (
          <div className="coaching-banner-wrap">
            <img className="coaching-banner" src={config.banner_image_url} alt="" />
          </div>
        ) : null}
        <p className="kicker">1-on-1 coaching</p>
        <h1>{config.title}</h1>
        <p className="coaching-booking-note">{COACHING_BOOKING_NOTE}</p>
        <DescriptionBlock text={config.description} />
        {canBook && config.calendly_url ? (
          <p className="coaching-cta">
            <a className="primary coaching-book-btn" href={config.calendly_url} target="_blank" rel="noopener noreferrer">
              Book Your 1-on-1 Session
            </a>
          </p>
        ) : null}
        {!canBook && booked ? (
          <div className="coaching-booked">
            <p className="coaching-booking-note">
              {booked.status === "scheduled"
                ? bookedWhen
                  ? `Your 1-on-1 is booked for ${bookedWhen}. The booking link is closed so you only have one session.`
                  : "Your 1-on-1 is booked. The booking link is closed so you only have one session."
                : "You've already had your 1-on-1. Additional sessions will be agreed with Yvonne if they're needed."}
            </p>
            {booked.meetingUrl && booked.status === "scheduled" ? (
              <p className="coaching-cta">
                <a className="primary coaching-book-btn" href={booked.meetingUrl} target="_blank" rel="noopener noreferrer">
                  Open your session
                </a>
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      {bookedSessions.length ? (
        <div className="coaching-boards">
          {bookedSessions.map((session) => (
            <CoachingSessionBoard key={session.id} session={session} bannerUrl={bannerUrl} />
          ))}
        </div>
      ) : null}
    </article>
  );
}
