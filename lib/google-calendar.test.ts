import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  calendarEventEmails,
  calendarEventStart,
  calendarGuestEmails,
  calendarMeetingUrl,
  emailsFromText,
  googleCalendarRedirectUri,
  googleCalendarWebhookUrl,
  googleWebhookChannelMatches,
  isIacOneOnOneCalendarEvent,
  isTimedCalendarEvent,
  matchCalendarStudent,
  studentDeclinedEvent,
} from "./google-calendar";

const students = [
  { id: "s1", email: "ada@example.com", fullName: "Ada Molefe" },
  { id: "s2", email: "lebo@example.com", fullName: "Lebo Nkosi" },
];

test("a Calendly 1-on-1 with one student attendee maps onto that profile", () => {
  const event = {
    id: "evt-1",
    status: "confirmed",
    summary: "Ada Molefe — IAC January 2027",
    description: "Email: ada@example.com",
    hangoutLink: "https://meet.google.com/abc-defg-hij",
    start: { dateTime: "2026-11-20T16:00:00.000Z" },
    attendees: [
      { email: "yvonne@accountingstudyadvice.com", organizer: true },
      { email: "ada@example.com", displayName: "Ada Molefe", responseStatus: "accepted" },
    ],
    organizer: { email: "yvonne@accountingstudyadvice.com" },
  };
  const emails = calendarEventEmails(event);
  assert.ok(emails.includes("ada@example.com"));
  assert.deepEqual(calendarGuestEmails(emails), ["ada@example.com"]);
  assert.equal(matchCalendarStudent(students, event).student?.id, "s1");
  assert.equal(calendarEventStart(event), "2026-11-20T16:00:00.000Z");
  assert.equal(calendarMeetingUrl(event), "https://meet.google.com/abc-defg-hij");
  assert.equal(isTimedCalendarEvent(event), true);
  assert.equal(studentDeclinedEvent(event, "ada@example.com"), false);
});

test("only IAC January 2027 1-on-1s are imported; buffer blocks are ignored", () => {
  assert.equal(isIacOneOnOneCalendarEvent({ summary: "Ada Molefe — IAC January 2027" }), true);
  assert.equal(isIacOneOnOneCalendarEvent({ summary: "Willemien van Dis and Yvonne Starkey" }), false);
  assert.equal(isIacOneOnOneCalendarEvent({ summary: "[10-minute buffer after IAC January 2027 event]" }), false);
  assert.equal(isIacOneOnOneCalendarEvent({ summary: "[10-minute buffer before IAC January 2027 event]" }), false);
});

test("group events and declined invites are not treated as that student's booking", () => {
  const group = {
    summary: "Live session",
    start: { dateTime: "2026-11-20T16:00:00.000Z" },
    attendees: [
      { email: "ada@example.com" },
      { email: "lebo@example.com" },
    ],
  };
  assert.equal(matchCalendarStudent(students, group).student, null);
  const declined = {
    summary: "Ada 1-on-1",
    start: { dateTime: "2026-11-20T16:00:00.000Z" },
    attendees: [{ email: "ada@example.com", responseStatus: "declined" }],
  };
  assert.equal(studentDeclinedEvent(declined, "ada@example.com"), true);
  assert.deepEqual(emailsFromText("Invitee: Ada <ADA@example.com>"), ["ada@example.com"]);
});

test("coach tools expose Google Calendar connect, webhook, and SQL", () => {
  const page = readFileSync(resolve("app/coach/google-calendar/page.tsx"), "utf8");
  const connect = readFileSync(resolve("components/coach/GoogleCalendarConnect.tsx"), "utf8");
  const student = readFileSync(resolve("components/student/StudentCoachingPage.tsx"), "utf8");
  const profile = readFileSync(resolve("components/coach/StudentCoachingSessionsPanel.tsx"), "utf8");
  const sql = readFileSync(resolve("supabase/google-calendar-coaching.sql"), "utf8");
  const dash = readFileSync(resolve("lib/coach-dashboard.ts"), "utf8");
  assert.match(page, /GoogleCalendarConnect/);
  assert.match(connect, /Connect Google Calendar/);
  assert.match(student, /studentCanBookOneOnOne/);
  assert.match(profile, /\/api\/student\/coaching\/sync/);
  assert.match(sql, /google_calendar_settings/);
  assert.match(sql, /google_event_id/);
  assert.match(dash, /\/coach\/google-calendar/);
  assert.equal(googleCalendarRedirectUri("https://iac.accountingstudyadvice.com/"), "https://iac.accountingstudyadvice.com/api/coach/google-calendar/callback");
  assert.equal(googleCalendarWebhookUrl("https://iac.accountingstudyadvice.com"), "https://iac.accountingstudyadvice.com/api/google-calendar/webhook");
  assert.equal(
    googleWebhookChannelMatches("ch1", "res1", { channel_id: "ch1", resource_id: "res1" }),
    true
  );
});
