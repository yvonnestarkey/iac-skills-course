"use client";

import { useMemo, useRef, useState } from "react";
import type { CaseSection, DrillNote } from "@/lib/reading-drills";

type Editor =
  | { mode: "new"; sentence: string; word: number; wordText: string; left: number; top: number }
  | { mode: "note"; noteId: number; left: number; top: number };

/**
 * A case the student annotates like a printed paper: click a word to write a short margin note;
 * click a note to cross it out. Notes are never deleted. Blue = first read, red = after reading the required.
 */
export default function AnnotatedCase({
  sections,
  notes,
  phase,
  onAdd,
  onCross,
  showPostLegend = true,
}: {
  sections: CaseSection[];
  notes: DrillNote[];
  phase: "read" | "post";
  onAdd: (note: Omit<DrillNote, "id" | "crossed" | "phase">) => void;
  onCross: (noteId: number) => void;
  showPostLegend?: boolean;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [draft, setDraft] = useState("");

  const order = useMemo(() => sections.flatMap((s) => s.sentences.map((x) => x.id)), [sections]);
  const numbered = useMemo(() => {
    const sorted = [...notes].sort(
      (a, b) => order.indexOf(a.sentence) - order.indexOf(b.sentence) || a.word - b.word || a.id - b.id
    );
    return new Map(sorted.map((n, i) => [n.id, i + 1]));
  }, [notes, order]);

  const place = (el: HTMLElement) => {
    const box = wrap.current?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (!box) return { left: 0, top: 0 };
    return { left: Math.max(0, Math.min(r.left - box.left, box.width - 340)), top: r.bottom - box.top + 6 };
  };

  const save = () => {
    if (editor?.mode === "new" && draft.trim()) {
      onAdd({ sentence: editor.sentence, word: editor.word, wordText: editor.wordText, text: draft.trim().slice(0, 40) });
    }
    setEditor(null);
  };

  const editing = editor?.mode === "note" ? notes.find((n) => n.id === editor.noteId) : null;

  return (
    <div className="rd-case-wrap" ref={wrap}>
      <div className="rd-case">
        {sections.map((section) => {
          const ids = new Set(section.sentences.map((s) => s.id));
          const margin = notes
            .filter((n) => ids.has(n.sentence))
            .sort((a, b) => (numbered.get(a.id) || 0) - (numbered.get(b.id) || 0));
          return (
            <section key={section.heading}>
              <h4>{section.heading}</h4>
              <div className="rd-para-row">
                <p>
                  {section.sentences.map((s) => {
                    let wi = 0;
                    return (
                      <span key={s.id}>
                        {s.text.split(/(\s+)/).map((tok, ti) => {
                          if (!tok) return null;
                          if (/^\s+$/.test(tok)) return tok;
                          const w = wi++;
                          const on = notes.filter((n) => n.sentence === s.id && n.word === w);
                          const first = on.find((n) => !n.crossed) || on[0];
                          return (
                            <span
                              key={ti}
                              className={`rd-w${on.length ? " has" : ""}${first?.phase === "post" ? " post" : ""}`}
                              onClick={(e) => {
                                setDraft("");
                                setEditor({ mode: "new", sentence: s.id, word: w, wordText: tok, ...place(e.currentTarget) });
                              }}
                            >
                              {tok}
                              {on.map((n, j) => (
                                <sup key={n.id} className={`rd-nm${n.phase === "post" ? " post" : ""}`}>
                                  {j ? "," : ""}
                                  {numbered.get(n.id)}
                                </sup>
                              ))}
                            </span>
                          );
                        })}{" "}
                      </span>
                    );
                  })}
                </p>
                <ol className="rd-margin" aria-label="Your notes">
                  {margin.map((n) => (
                    <li
                      key={n.id}
                      className={`${n.phase === "post" ? "post" : ""}${n.crossed ? " crossed" : ""}`}
                      title={n.crossed ? "Crossed out" : "Cross out"}
                      onClick={(e) => !n.crossed && setEditor({ mode: "note", noteId: n.id, ...place(e.currentTarget) })}
                    >
                      <b>{numbered.get(n.id)}</b>
                      <span>{n.text}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          );
        })}
      </div>
      <div className="rd-legend">
        <span>
          <i className="rd-blue">blue</i> first read
        </span>
        {showPostLegend ? (
          <span>
            <i className="rd-red">red</i> after reading the required
          </span>
        ) : null}
        <span>
          <i style={{ textDecoration: "line-through" }}>crossed out</i> stays on the page, as in the exam
        </span>
      </div>

      {editor ? (
        <div className="rd-ed" style={{ left: editor.left, top: editor.top }}>
          {editor.mode === "new" ? (
            <>
              <input
                autoFocus
                maxLength={40}
                placeholder="Short note"
                aria-label={`Note on “${editor.wordText}”`}
                className={phase === "post" ? "post" : ""}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    save();
                  }
                  if (e.key === "Escape") setEditor(null);
                }}
              />
              <button type="button" className="primary" onClick={save}>
                Save
              </button>
            </>
          ) : (
            <>
              <span className={`rd-shown${editing?.phase === "post" ? " post" : ""}`}>{editing?.text}</span>
              <button
                type="button"
                className="primary"
                autoFocus
                onClick={() => {
                  if (editor.mode === "note") onCross(editor.noteId);
                  setEditor(null);
                }}
              >
                Cross out
              </button>
              <button type="button" onClick={() => setEditor(null)}>
                Keep
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
