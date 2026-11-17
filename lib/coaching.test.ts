import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  COACHING_BOOKING_NOTE,
  COACHING_BOOKING_URL,
  bookedOneOnOneSession,
  coachingBookingUrl,
  coachingPdfFiles,
  coachingSessionWriteRow,
  emptyCoachingSessionWrite,
  missingCoachingColumn,
  parseCoachingPdfFiles,
  sessionHasDeliverables,
  studentCanBookOneOnOne,
  transcriptMatchCount,
  transcriptSearchParts,
  type StudentCoachingSession,
} from "./coaching";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const studentId = "11111111-1111-4111-8111-111111111111";

function sampleSession(over: Partial<StudentCoachingSession> = {}): StudentCoachingSession {
  return {
    id: "1",
    studentId,
    status: "scheduled",
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
    pdfFiles: [],
    summaryText: null,
    transcriptText: null,
    coachNotes: null,
    deliverablesSeenAt: null,
    ...over,
  };
}

test("1-on-1 booking uses the Google Appointment Schedule link instead of Calendly", () => {
  assert.equal(COACHING_BOOKING_URL, "https://calendar.app.google/2bPLVu1Vdnh7LpMh7");
  assert.equal(coachingBookingUrl(""), COACHING_BOOKING_URL);
  assert.equal(coachingBookingUrl("https://calendly.com/yvonne/iac"), COACHING_BOOKING_URL);
  assert.equal(coachingBookingUrl(COACHING_BOOKING_URL), COACHING_BOOKING_URL);
  const sql = readFileSync(join(root, "supabase/coaching-google-booking.sql"), "utf8");
  assert.match(sql, /calendar\.app\.google\/2bPLVu1Vdnh7LpMh7/);
});

test("student coaching page shows the one-session booking note under the heading", () => {
  const source = readFileSync(join(root, "components/student/StudentCoachingPage.tsx"), "utf8");
  const board = readFileSync(join(root, "components/student/CoachingSessionBoard.tsx"), "utf8");
  assert.match(source, /<h1>\{config\.title\}<\/h1>\s*<p className="coaching-booking-note">\{COACHING_BOOKING_NOTE\}<\/p>/);
  assert.match(
    COACHING_BOOKING_NOTE,
    /set up ONE session\. Additional sessions will be agreed upon if they're needed and if you're submitting tasks\./,
  );
  assert.match(source, /CoachingSessionBoard/);
  assert.match(source, /bookedCoachingSessions/);
  assert.match(source, /studentCanBookOneOnOne/);
  assert.match(source, /\/api\/student\/coaching\/sync/);
  assert.match(board, /Executive Summary/);
  assert.match(board, /Fireflies Transcript/);
  assert.match(board, /Search for a word or phrase/);
  assert.match(board, /session\.recordingUrl/);
  assert.match(board, /coachingPdfFiles/);
});

test("a scheduled or completed 1-on-1 closes the booking link", () => {
  const scheduled = sampleSession();
  assert.equal(studentCanBookOneOnOne([]), true);
  assert.equal(studentCanBookOneOnOne([scheduled]), false);
  assert.equal(studentCanBookOneOnOne([{ ...scheduled, status: "cancelled" }]), true);
  assert.equal(studentCanBookOneOnOne([{ ...scheduled, status: "completed" }]), false);
  assert.equal(bookedOneOnOneSession([scheduled])?.id, "1");
});

test("coach profile can paste take-aways and upload more than one PDF", () => {
  const panel = readFileSync(join(root, "components/coach/StudentCoachingSessionsPanel.tsx"), "utf8");
  assert.match(panel, /uploadCoachingSummaryPdf/);
  assert.match(panel, /saveManualCoachingSession/);
  assert.match(panel, /Recording link/);
  assert.match(panel, /Executive summary \(take-aways\)/);
  assert.match(panel, /PDFs \(if relevant\)/);
  assert.match(panel, /multiple/);
});

test("manual coaching write stores recording, PDFs, and executive summary", () => {
  const empty = coachingSessionWriteRow(emptyCoachingSessionWrite(studentId));
  assert.equal(empty.ok, false);
  const saved = coachingSessionWriteRow({
    studentId,
    title: "Kyle 1-on-1",
    date: "2026-11-04",
    recordingUrl: "https://vimeo.com/123",
    pdfSummaryUrl: "",
    executiveSummary: "Focus on inventory cut-off.",
    pdfFiles: [
      { url: "https://files.example/summary.pdf", name: "summary.pdf" },
      { url: "https://files.example/extra.pdf", name: "extra.pdf" },
    ],
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.row.status, "completed");
  assert.equal(saved.row.recording_url, "https://vimeo.com/123");
  assert.equal(saved.row.vimeo_recording_url, "https://vimeo.com/123");
  assert.equal(saved.row.pdf_summary_url, "https://files.example/summary.pdf");
  assert.deepEqual(saved.row.pdf_files, [
    { url: "https://files.example/summary.pdf", name: "summary.pdf" },
    { url: "https://files.example/extra.pdf", name: "extra.pdf" },
  ]);
  assert.equal(saved.row.coach_notes, "Focus on inventory cut-off.");
  assert.equal(saved.row.session_at, "2026-11-04T10:00:00.000Z");
});

test("executive summary alone is enough to save onto the student board", () => {
  const saved = coachingSessionWriteRow({
    ...emptyCoachingSessionWrite(studentId),
    executiveSummary: "Practise the revenue workpapers again.",
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.row.coach_notes, "Practise the revenue workpapers again.");
  assert.equal(saved.row.recording_url, null);
  assert.equal(saved.row.pdf_summary_url, null);
});

test("schema-cache errors name the missing coaching column", () => {
  assert.equal(
    missingCoachingColumn("Could not find the 'deliverables_seen_at' column of 'student_coaching_sessions' in the schema cache"),
    "deliverables_seen_at"
  );
});

test("a recording or PDF is enough for the student 1-on-1 area to show the session", () => {
  assert.equal(sessionHasDeliverables(sampleSession({ recordingUrl: "https://vimeo.com/1", status: "completed" })), true);
  assert.equal(
    sessionHasDeliverables(sampleSession({ pdfFiles: [{ url: "https://files.example/a.pdf", name: "a.pdf" }] })),
    true
  );
  assert.equal(sessionHasDeliverables(sampleSession({ coachNotes: "Take-aways" })), true);
});

test("coaching PDF list merges uploaded files with a legacy summary URL", () => {
  assert.deepEqual(parseCoachingPdfFiles([{ url: "https://files.example/a.pdf", name: "Notes.pdf" }]), [
    { url: "https://files.example/a.pdf", name: "Notes.pdf" },
  ]);
  assert.deepEqual(
    coachingPdfFiles(
      sampleSession({
        pdfSummaryUrl: "https://files.example/legacy.pdf",
        pdfFiles: [{ url: "https://files.example/extra.pdf", name: "extra.pdf" }],
      })
    ),
    [
      { url: "https://files.example/extra.pdf", name: "extra.pdf" },
      { url: "https://files.example/legacy.pdf", name: "legacy.pdf" },
    ]
  );
});

test("transcript search splits matches so students can find a phrase", () => {
  const text = "Inventory cut-off was the main risk. Inventory counts need a second look.";
  const parts = transcriptSearchParts(text, "inventory");
  assert.equal(transcriptMatchCount(text, "inventory"), 2);
  assert.deepEqual(
    parts.filter((part) => part.match).map((part) => part.text),
    ["Inventory", "Inventory"]
  );
  assert.equal(transcriptSearchParts(text, "").length, 1);
});

test("session board SQL adds pdf_files for multiple uploads", () => {
  const sql = readFileSync(join(root, "supabase/coaching-session-board.sql"), "utf8");
  assert.match(sql, /pdf_files jsonb/);
  const fireflies = readFileSync(join(root, "lib/fireflies.ts"), "utf8");
  assert.doesNotMatch(fireflies, /patch\.coach_notes/);
});
