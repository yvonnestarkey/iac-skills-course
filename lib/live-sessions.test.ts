import assert from "node:assert/strict";
import { test } from "node:test";
import { formatSastDateTime, isoToSastDateAndTime, sastDateAndTimeToIso } from "./dates";
import {
  canAccessAllLiveSessionLinks,
  emptyLiveSessionWrite,
  firstLiveSessionId,
  liveSessionIsRecorded,
  liveSessionToWrite,
  liveSessionWriteRow,
  sanitizeLiveSessionsForAccess,
  sessionFromRow,
} from "./live-sessions";
import {
  buildLiveSessionsIcs,
  calendarSessions,
  ensureCalendarName,
  liveSessionCalendarUrls,
} from "./live-sessions-calendar";

test("22 September 18:00 SAST stores as UTC and displays the same for every browser", () => {
  const iso = sastDateAndTimeToIso("2026-09-22", "18:00");
  assert.equal(iso, "2026-09-22T16:00:00.000Z");
  assert.equal(formatSastDateTime(iso), "Sep 22, 2026 @ 18:00 SAST");
  assert.deepEqual(isoToSastDateAndTime(iso), { date: "2026-09-22", time: "18:00" });
});

test("live session write requires title and SAST date/time", () => {
  assert.equal(liveSessionWriteRow(emptyLiveSessionWrite()).ok, false);
  const missingTime = liveSessionWriteRow({ ...emptyLiveSessionWrite(), title: "Q&A", date: "2026-10-20", time: "" });
  assert.equal(missingTime.ok, false);
});

test("upcoming Zoom row keeps upcoming until a recording is added", () => {
  const saved = liveSessionWriteRow({
    ...emptyLiveSessionWrite(),
    title: "October live session",
    date: "2026-10-20",
    time: "18:00",
    zoomUrl: "https://zoom.us/j/123",
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.row.status, "upcoming");
  assert.equal(saved.row.zoom_url, "https://zoom.us/j/123");
  assert.equal(saved.row.recording_url, null);
  assert.equal(saved.row.session_at, "2026-10-20T16:00:00.000Z");
});

test("recording URL marks the session completed and keeps summary and scribbles", () => {
  const saved = liveSessionWriteRow({
    id: "s1",
    title: "22 September live session",
    description: "IAC candidates",
    date: "2026-09-22",
    time: "18:00",
    status: "upcoming",
    zoomUrl: "https://zoom.us/j/old",
    recordingUrl: "https://vimeo.com/example",
    summaryPdfUrl: "https://example.com/summary.pdf",
    notesPdfUrl: "https://example.com/scribbles.pdf",
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.row.status, "completed");
  assert.equal(saved.row.recording_url, "https://vimeo.com/example");
  assert.equal(saved.row.summary_pdf_url, "https://example.com/summary.pdf");
  assert.equal(saved.row.notes_pdf_url, "https://example.com/scribbles.pdf");
});

test("cancelled stays cancelled even if a recording URL is present", () => {
  const saved = liveSessionWriteRow({
    ...emptyLiveSessionWrite(),
    title: "Cancelled clinic",
    date: "2026-11-01",
    time: "09:00",
    status: "cancelled",
    recordingUrl: "https://vimeo.com/skip",
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.row.status, "cancelled");
});

test("row mapping and recorded flag match the student page", () => {
  const session = sessionFromRow({
    id: "abc",
    title: "22 September",
    description: "",
    session_at: "2026-09-22T16:00:00.000Z",
    status: "completed",
    zoom_url: null,
    recording_url: "https://vimeo.com/sept",
    summary_pdf_url: "https://example.com/summary.pdf",
    notes_pdf_url: "https://example.com/scribbles.pdf",
  });
  assert.equal(liveSessionIsRecorded(session), true);
  const write = liveSessionToWrite(session);
  assert.equal(write.date, "2026-09-22");
  assert.equal(write.time, "18:00");
  assert.equal(write.recordingUrl, "https://vimeo.com/sept");
});

test("preview students only keep the first session recording", () => {
  const first = sessionFromRow({
    id: "first",
    title: "22 September",
    session_at: "2026-09-22T16:00:00.000Z",
    status: "completed",
    zoom_url: "https://zoom.us/j/first",
    recording_url: "https://vimeo.com/first",
    summary_pdf_url: "https://example.com/summary.pdf",
    notes_pdf_url: "https://example.com/scribbles.pdf",
  });
  const later = sessionFromRow({
    id: "later",
    title: "October",
    session_at: "2026-10-20T16:00:00.000Z",
    status: "upcoming",
    zoom_url: "https://zoom.us/j/later",
    recording_url: "https://vimeo.com/later",
    summary_pdf_url: "https://example.com/oct.pdf",
    notes_pdf_url: null,
  });
  assert.equal(firstLiveSessionId([later, first]), "first");
  assert.equal(canAccessAllLiveSessionLinks("free_preview"), false);
  assert.equal(canAccessAllLiveSessionLinks("full"), true);
  assert.equal(canAccessAllLiveSessionLinks("staff"), true);

  const preview = sanitizeLiveSessionsForAccess([first, later], "free_preview");
  assert.equal(preview[0].recordingUrl, "https://vimeo.com/first");
  assert.equal(preview[0].zoomUrl, null);
  assert.equal(preview[0].summaryPdfUrl, null);
  assert.equal(preview[0].notesPdfUrl, null);
  assert.equal(preview[1].recordingUrl, null);
  assert.equal(preview[1].zoomUrl, null);

  const full = sanitizeLiveSessionsForAccess([first, later], "full");
  assert.equal(full[1].zoomUrl, "https://zoom.us/j/later");
  assert.equal(full[0].summaryPdfUrl, "https://example.com/summary.pdf");
});

test("live session subscribe feed is named IAC Skills Live Session", () => {
  const ics = buildLiveSessionsIcs(
    [
      sessionFromRow({
        id: "sept",
        title: "Intro Session: 22 September 2026",
        description: "We chatted about shifting study approaches.",
        session_at: "2026-09-22T16:00:00.000Z",
        status: "completed",
        zoom_url: "https://zoom.us/j/secret",
      }),
      sessionFromRow({
        id: "skip",
        title: "Cancelled",
        session_at: "2026-10-01T16:00:00.000Z",
        status: "cancelled",
      }),
    ],
    "https://iac.accountingstudyadvice.com"
  );
  assert.match(ics, /X-WR-CALNAME:IAC Skills Live Session/);
  assert.match(ics, /SUMMARY:Intro Session: 22 September 2026/);
  assert.match(ics, /DTSTART:20260922T160000Z/);
  assert.match(ics, /DTEND:20260922T173000Z/);
  assert.doesNotMatch(ics, /zoom\.us/);
  assert.doesNotMatch(ics, /Cancelled/);
  assert.equal(calendarSessions([{ ...sessionFromRow({ id: "x", title: "x", status: "cancelled", session_at: "2026-10-01T16:00:00.000Z" }) }]).length, 0);

  const urls = liveSessionCalendarUrls("https://iac.accountingstudyadvice.com");
  assert.equal(urls.http, "https://iac.accountingstudyadvice.com/api/calendar/live-sessions.ics");
  assert.equal(urls.webcal, "webcal://iac.accountingstudyadvice.com/api/calendar/live-sessions.ics");
  assert.match(ensureCalendarName("BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR"), /X-WR-CALNAME:IAC Skills Live Session/);
});
