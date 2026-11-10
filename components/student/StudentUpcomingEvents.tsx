"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  fetchLiveSessions,
  formatCountdown,
  formatLiveSessionAt,
  liveSessionIsSoon,
  sanitizeLiveSessionsForAccess,
  upcomingLiveSessions,
  type LiveSession,
} from "@/lib/live-sessions";
import { useStudentSession } from "@/lib/student-session";

function EventRow({ session, now }: { session: LiveSession; now: Date }) {
  const soon = liveSessionIsSoon(session, now);
  const when = formatLiveSessionAt(session.sessionAt);
  const href = session.zoomUrl || "/student/events";
  const external = Boolean(session.zoomUrl);

  return (
    <li className={`student-upcoming-event${soon ? " is-soon" : ""}`}>
      {when ? <p className="student-upcoming-event-when">{when}</p> : <p className="muted small">Date TBC</p>}
      {external ? (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {session.title}
        </a>
      ) : (
        <Link href={href}>{session.title}</Link>
      )}
      {session.zoomUrl ? (
        <a className="student-upcoming-event-join" href={session.zoomUrl} target="_blank" rel="noopener noreferrer">
          Join Zoom
        </a>
      ) : (
        <Link className="student-upcoming-event-join" href="/student/events">
          Open events
        </Link>
      )}
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
  const next = upcoming[0];
  const countdown = next?.sessionAt ? formatCountdown(new Date(next.sessionAt).getTime() - now.getTime()) : "";

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
      <div className="student-dash-block-head">
        <div>
          <h2>Upcoming Events</h2>
          <p className="muted small">The next live sessions from Events.</p>
        </div>
        <Link href="/student/events">See all</Link>
      </div>
      {!ready ? <p className="muted small">Loading sessions…</p> : null}
      {ready && next && countdown ? (
        <p className={`student-event-countdown${liveSessionIsSoon(next, now) ? " is-soon" : ""}`}>{countdown}</p>
      ) : null}
      {ready && upcoming.length ? (
        <ol className="student-upcoming-event-list">
          {upcoming.map((session) => (
            <EventRow key={session.id} session={session} now={now} />
          ))}
        </ol>
      ) : null}
      {ready && !upcoming.length ? (
        <p className="muted small">
          No upcoming live sessions yet. <Link href="/student/events">See all events</Link>
        </p>
      ) : null}
    </section>
  );
}
