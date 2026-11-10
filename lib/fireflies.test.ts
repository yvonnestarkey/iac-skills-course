import assert from "node:assert/strict";
import { createHmac } from "crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  attendeeEmails,
  formatFirefliesSummary,
  formatFirefliesTranscript,
  firefliesMeetingAt,
  firefliesWebhookUrl,
  guestEmails,
  isPdfUrl,
  maskSecret,
  chunkEmails,
  nextFirefliesSkip,
  parseFirefliesWebhook,
  shouldImportFirefliesEvent,
  uniqueNameMatch,
  uniqueStudentMatch,
  verifyFirefliesSignature,
} from "./fireflies";

const students = [
  { id: "s1", email: "ada@example.com", fullName: "Ada Lovelace" },
  { id: "s2", email: "ben@example.com", fullName: "Ben Jones" },
];

test("Fireflies webhook parser accepts v1 and v2 payloads", () => {
  assert.deepEqual(parseFirefliesWebhook({ event: "meeting.summarized", meeting_id: "abc" }), {
    meetingId: "abc",
    event: "meeting.summarized",
  });
  assert.deepEqual(parseFirefliesWebhook({ eventType: "Transcription completed", meetingId: "abc" }), {
    meetingId: "abc",
    event: "transcription completed",
  });
  assert.equal(parseFirefliesWebhook({ event: "meeting.transcribed" }), null);
  assert.equal(shouldImportFirefliesEvent("meeting.bot_joined"), false);
  assert.equal(shouldImportFirefliesEvent("meeting.transcribed"), true);
  assert.equal(shouldImportFirefliesEvent("Transcription completed"), true);
});

test("Fireflies HMAC signature matches the documented sha256= header", () => {
  const body = '{"event":"meeting.transcribed","meeting_id":"abc"}';
  const secret = "test-secret";
  const signature = `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
  assert.equal(verifyFirefliesSignature(body, signature, secret), true);
  assert.equal(verifyFirefliesSignature(body, signature, "other"), false);
  assert.equal(verifyFirefliesSignature(body, "", secret), false);
});

test("one student attendee maps to that profile; group calls stay unmatched", () => {
  const transcript = {
    host_email: "yvonne@accountingstudyadvice.com",
    meeting_attendees: [
      { email: "Yvonne@accountingstudyadvice.com", name: "Yvonne" },
      { email: "ada@example.com", name: "Ada Lovelace" },
    ],
    participants: ["ada@example.com"],
  };
  assert.deepEqual(attendeeEmails(transcript), ["yvonne@accountingstudyadvice.com", "ada@example.com"]);
  assert.deepEqual(guestEmails(attendeeEmails(transcript)), ["ada@example.com"]);
  assert.equal(uniqueStudentMatch(students, attendeeEmails(transcript))?.id, "s1");
  assert.equal(
    uniqueStudentMatch(students, ["ada@example.com", "ben@example.com"]),
    null
  );
});

test("a unique attendee or title name can match when the calendar email is missing", () => {
  assert.equal(uniqueNameMatch(students, ["Ada Lovelace"])?.id, "s1");
  assert.equal(uniqueNameMatch(students, [], "Coaching with Ben Jones")?.id, "s2");
  assert.equal(uniqueNameMatch(students, ["Ada Lovelace", "Ben Jones"]), null);
});

test("summary and transcript formatting keep overview, actions, and speakers", () => {
  assert.match(
    formatFirefliesSummary({
      overview: "Pace the reading.",
      action_items: ["Retry Task 2", "Bring BMCR"],
    }),
    /Pace the reading[\s\S]*Retry Task 2/
  );
  assert.equal(
    formatFirefliesTranscript([
      { speaker_name: "Yvonne", text: "Start with the required." },
      { speaker_name: "Ada", text: "Okay." },
    ]),
    "Yvonne: Start with the required.\nAda: Okay."
  );
  assert.equal(firefliesMeetingAt(1710876543210), new Date(1710876543210).toISOString());
  assert.equal(isPdfUrl("https://app.fireflies.ai/view/abc"), false);
  assert.equal(isPdfUrl("https://files.example/summary.pdf?x=1"), true);
  assert.equal(maskSecret("ff_live_abcd1234"), "••••1234");
  assert.equal(firefliesWebhookUrl("https://iac.accountingstudyadvice.com/"), "https://iac.accountingstudyadvice.com/api/fireflies/webhook");
});

test("coach Fireflies page and webhook route are wired", () => {
  const page = readFileSync(resolve("app/coach/fireflies/page.tsx"), "utf8");
  const connect = readFileSync(resolve("components/coach/FirefliesConnect.tsx"), "utf8");
  const webhook = readFileSync(resolve("app/api/fireflies/webhook/route.ts"), "utf8");
  const coachApi = readFileSync(resolve("app/api/coach/fireflies/route.ts"), "utf8");
  const sql = readFileSync(resolve("supabase/fireflies-coaching.sql"), "utf8");
  assert.match(page, /FirefliesConnect/);
  assert.match(connect, /Import past calls/);
  assert.match(webhook, /importFirefliesMeeting/);
  assert.match(coachApi, /syncPastFirefliesMeetings/);
  assert.match(readFileSync(resolve("lib/fireflies.ts"), "utf8"), /participants: \$participants/);
  assert.match(sql, /fireflies_settings/);
  assert.match(sql, /transcript_text/);
});

test("Fireflies listing pages until a short page", () => {
  assert.equal(nextFirefliesSkip(50, 0), 50);
  assert.equal(nextFirefliesSkip(50, 50), 100);
  assert.equal(nextFirefliesSkip(12, 100), null);
});

test("student emails are sent to Fireflies in batches", () => {
  assert.deepEqual(chunkEmails(["Ada@example.com", "not-an-email", "ben@example.com"], 1), [
    ["ada@example.com"],
    ["ben@example.com"],
  ]);
});
