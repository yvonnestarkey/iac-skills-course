import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  COACHING_BOOKING_NOTE,
  bookedOneOnOneSession,
  coachingSessionWriteRow,
  emptyCoachingSessionWrite,
  missingCoachingColumn,
  sessionHasDeliverables,
  studentCanBookOneOnOne,
} from "./coaching";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const studentId = "11111111-1111-4111-8111-111111111111";

test("student coaching page shows the one-session booking note under the heading", () => {
  const source = readFileSync(join(root, "components/student/StudentCoachingPage.tsx"), "utf8");
  assert.match(source, /<h1>\{config\.title\}<\/h1>\s*<p className="coaching-booking-note">\{COACHING_BOOKING_NOTE\}<\/p>/);
  assert.match(
    COACHING_BOOKING_NOTE,
    /set up ONE session\. Additional sessions will be agreed upon if they're needed and if you're submitting tasks\./,
  );
  assert.match(source, /session\.recordingUrl/);
  assert.match(source, /session\.pdfSummaryUrl/);
  assert.match(source, /studentCanBookOneOnOne/);
  assert.match(source, /\/api\/student\/coaching\/sync/);
});

test("a scheduled or completed 1-on-1 closes the booking link", () => {
  const scheduled = {
    id: "1",
    studentId,
    status: "scheduled" as const,
    sessionAt: "2026-11-20T16:00:00.000Z",
    title: "Ada 1-on-1",
    firefliesMeetingId: null,
    firefliesPdfUrl: null,
    firefliesTranscriptUrl: null,
    googleEventId: "evt-1",
    meetingUrl: "https://meet.google.com/ada",
    vimeoRecordingUrl: null,
    recordingUrl: null,
    pdfSummaryUrl: null,
    summaryText: null,
    transcriptText: null,
    coachNotes: null,
    deliverablesSeenAt: null,
  };
  assert.equal(studentCanBookOneOnOne([]), true);
  assert.equal(studentCanBookOneOnOne([scheduled]), false);
  assert.equal(studentCanBookOneOnOne([{ ...scheduled, status: "cancelled" }]), true);
  assert.equal(studentCanBookOneOnOne([{ ...scheduled, status: "completed" }]), false);
  assert.equal(bookedOneOnOneSession([scheduled])?.id, "1");
});

test("coach profile can save a PDF summary and recording link onto the student page", () => {
  const panel = readFileSync(join(root, "components/coach/StudentCoachingSessionsPanel.tsx"), "utf8");
  assert.match(panel, /uploadCoachingSummaryPdf/);
  assert.match(panel, /saveManualCoachingSession/);
  assert.match(panel, /Recording link/);
  assert.match(panel, /PDF summary/);
});

test("manual coaching write stores recording and PDF on the columns the student page reads", () => {
  const empty = coachingSessionWriteRow(emptyCoachingSessionWrite(studentId));
  assert.equal(empty.ok, false);
  const saved = coachingSessionWriteRow({
    studentId,
    title: "Kyle 1-on-1",
    date: "2026-11-04",
    recordingUrl: "https://vimeo.com/123",
    pdfSummaryUrl: "https://files.example/summary.pdf",
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.row.status, "completed");
  assert.equal(saved.row.recording_url, "https://vimeo.com/123");
  assert.equal(saved.row.vimeo_recording_url, "https://vimeo.com/123");
  assert.equal(saved.row.pdf_summary_url, "https://files.example/summary.pdf");
  assert.equal(saved.row.fireflies_pdf_url, "https://files.example/summary.pdf");
  assert.equal(saved.row.session_at, "2026-11-04T10:00:00.000Z");
});

test("schema-cache errors name the missing coaching column", () => {
  assert.equal(
    missingCoachingColumn("Could not find the 'deliverables_seen_at' column of 'student_coaching_sessions' in the schema cache"),
    "deliverables_seen_at"
  );
});

test("a recording or PDF is enough for the student 1-on-1 area to show the session", () => {
  assert.equal(
    sessionHasDeliverables({
      id: "1",
      studentId,
      status: "completed",
      sessionAt: null,
      title: null,
      firefliesMeetingId: null,
      firefliesPdfUrl: null,
      firefliesTranscriptUrl: null,
      googleEventId: null,
      meetingUrl: null,
      vimeoRecordingUrl: null,
      recordingUrl: "https://vimeo.com/1",
      pdfSummaryUrl: null,
      summaryText: null,
      transcriptText: null,
      coachNotes: null,
      deliverablesSeenAt: null,
    }),
    true
  );
});
