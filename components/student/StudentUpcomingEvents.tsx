"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  fetchLiveSessions,
  formatCountdown,
  formatLiveSessionAt,
  sanitizeLiveSessionsForAccess,
  upcomingLiveSessions,
  type LiveSession,
} from "@/lib/live-sessions";
import { useStudentSession } from "@/lib/student-session";

function eventAction(session: LiveSession | null | undefined): { href: string; label: string; external: boolean } {
  if (session?.zoomUrl) return { href: session.zoomUrl, label: "Join Zoom", external: true };
  return { href: "/student/events", label: "View event", external: false };
}

function EventButton({
  session,
  className = "primary",
}: {
  session: LiveSession;
  className?: string;
}) {
  const action = eventAction(session);
  if (action.external) {
    return (
      <a className={className} href={action.href} target="_blank" rel="noopener noreferrer">
        {action.label}
      </a>
    );
  }
  return (
    <Link className={className} href={action.href}>
      {action.label}
    </Link>
  );
}

function LaterEvent({ session }: { session: LiveSession }) {
  const when = formatLiveSessionAt(session.sessionAt);
  return (
    <li className="student-upcoming-event">
      <div>
        {when ? <p className="student-upcoming-event-when">{when}</p> : <p className="muted small">Date TBC</p>}
        <strong>{session.title}</strong>
      </div>
      <EventButton session={session} />
    </li>
  );
}

export default function StudentUpcomingEvents() {
  const { entitlement } = useStudentSession();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const visible = useMemo(() => sanitizeLiveSessionsForAccess(sessions, entitlement), [sessions, entitlement]);
  const upcoming = useMemo(() => upcomingLiveSessions(visible, now, 3), [visible, now]);
  const next = upcoming[0] || null;
  const later = upcoming.slice(1, 3);
  const countdown = next?.sessionAt ? formatCountdown(new Date(next.sessionAt).getTime() - now.getTime()) : "";
  const nextWhen = formatLiveSessionAt(next?.sessionAt);

  useEffect(() => {
    let cancelled = false;
    fetchLiveSessions().then((nextSessions) => {
      if (cancelled) return;
      setSessions(nextSessions);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="student-upcoming-events">
      <div className="student-upcoming-events-art">
        <div className="student-upcoming-events-top">
          <div>
            <p className="kicker">Live sessions</p>
            <h2>Upcoming Events</h2>
          </div>
          <Link href="/student/events">See all</Link>
        </div>

        <div className="student-upcoming-featured">
          {!ready ? <p>Loading sessions…</p> : null}
          {ready && next ? (
            <>
              {countdown ? <p className="student-event-countdown">{countdown}</p> : null}
              {nextWhen ? <p className="student-upcoming-featured-when">{nextWhen}</p> : null}
              <strong>{next.title}</strong>
              <EventButton session={next} />
            </>
          ) : null}
          {ready && !next ? (
            <>
              <p className="student-event-countdown">No upcoming live session yet</p>
              <Link className="primary" href="/student/events">
                View events
              </Link>
            </>
          ) : null}
        </div>

        {later.length ? (
          <ol className="student-upcoming-event-list">
            {later.map((session) => (
              <LaterEvent key={session.id} session={session} />
            ))}
          </ol>
        ) : null}
      </div>
    </section>
  );
}
