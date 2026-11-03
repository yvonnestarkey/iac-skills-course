"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { READING_CHECK, type DrillAttempt, type DrillExercise, type ReadingCheckResult } from "@/lib/reading-drills";
import {
  accuracyLabel,
  checkNotes,
  phaseLabel,
  reviewAttempt,
  reviewCheck,
  type CoachNoteReview,
} from "@/lib/reading-review";

function NoteList({ notes }: { notes: CoachNoteReview[] }) {
  if (!notes.length) return <p className="empty">No notes on this attempt.</p>;
  return (
    <ul className="reading-note-list">
      {notes.map((note, index) => (
        <li key={`${note.sentence}-${index}`} className={note.crossed ? "reading-note-crossed" : ""}>
          <p className="reading-note-text">{note.text || "(blank note)"}</p>
          <p className="muted small">
            {note.accuracyLabel}
            {note.wordText ? ` · on “${note.wordText}”` : ""}
            {note.sentenceText ? ` · “${note.sentenceText}”` : ""}
            {` · ${phaseLabel(note.phase)}`}
            {note.crossed ? " · crossed out" : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function DrillReview({ attempt, exercise }: { attempt: DrillAttempt; exercise: DrillExercise | null }) {
  const [open, setOpen] = useState(false);
  const review = reviewAttempt(exercise, attempt);
  const noteCount = review.liveNotes.length;
  return (
    <div className="reading-review">
      <button
        className="ghost assignment-feedback-toggle"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Hide notes" : "Notes & review"}
        {open ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
      </button>
      {open ? (
        <div className="reading-review-body">
          <section>
            <h3>Notes they made</h3>
            <p className="muted small">
              {noteCount} note{noteCount === 1 ? "" : "s"} in use
              {review.crossedNotes.length ? ` · ${review.crossedNotes.length} crossed out` : ""}
            </p>
            <NoteList notes={review.notes} />
          </section>

          {exercise ? (
            <section>
              <h3>Against the required</h3>
              {review.notedNotUsed.length ? (
                <p className="rd-note">
                  They noted the clue for {review.notedNotUsed.length} point
                  {review.notedNotUsed.length === 1 ? "" : "s"} but did not turn it into an answer.
                </p>
              ) : null}
              {review.missedClues.length ? (
                <p>
                  <b>Clues they missed:</b>{" "}
                  {review.missedClues
                    .map((clue) => `${accuracyLabel(clue.kind)} — “${clue.text}”`)
                    .join(" · ")}
                </p>
              ) : (
                <p className="muted small">They noted every direct and indirect clue.</p>
              )}
              <div className="rd-table-wrap">
                <table className="rd-table">
                  <thead>
                    <tr>
                      <th>Point the marker rewards</th>
                      <th>Type</th>
                      <th>Noted</th>
                      <th>Earned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {review.rows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          {row.point}
                          {row.clueTexts.length ? (
                            <div className="muted small">Case: “{row.clueTexts.join(" ")}”</div>
                          ) : null}
                        </td>
                        <td className="c">
                          <span className={`rd-prox ${row.proximity}`}>{row.proximity}</span>
                        </td>
                        <td className="c">
                          <span className={row.noted ? "rd-ok" : "rd-miss"}>{row.noted ? "Yes" : "No"}</span>
                        </td>
                        <td className="c">
                          <span className={row.earned ? "rd-ok" : "rd-miss"}>{row.earned ? "Yes" : "No"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <p className="muted small">This exercise is no longer in the bank, so the notes cannot be compared to the required.</p>
          )}

          <section>
            <h3>Their answer</h3>
            {review.answer ? <div className="reading-answer">{review.answer}</div> : <p className="empty">No written answer saved.</p>}
          </section>
        </div>
      ) : null}
    </div>
  );
}

export function CheckReview({ check }: { check: ReadingCheckResult }) {
  const [open, setOpen] = useState(false);
  const review = reviewCheck(check, READING_CHECK);
  const notes = checkNotes(check);
  return (
    <div className="reading-review">
      <button
        className="ghost assignment-feedback-toggle"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Hide notes" : "Notes & review"}
        {open ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
      </button>
      {open ? (
        <div className="reading-review-body">
          <section>
            <h3>Notes they made</h3>
            {notes.length ? (
              <NoteList
                notes={notes.map((note) => ({
                  ...note,
                  sentenceText: "",
                  accuracy: "unknown" as const,
                  accuracyLabel: accuracyLabel("unknown"),
                }))}
              />
            ) : (
              <p className="empty">
                {check.notes
                  ? `${check.notes} notes were counted, but the wording was not stored on this older attempt.`
                  : "No notes were saved."}
              </p>
            )}
          </section>
          <section>
            <h3>What did not stick</h3>
            {review.missed.length ? (
              review.missed.map((item) => (
                <p key={item.question}>
                  <b>{item.question}</b>
                  <br />
                  Needed: {item.options[item.correct]}
                </p>
              ))
            ) : (
              <p className="muted small">They absorbed every recall point.</p>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
