"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import AnnotatedCase from "@/components/reading/AnnotatedCase";
import { Choice, Pill, ResultRange, StepStrip, Tile, fmt } from "@/components/reading/parts";
import {
  buildAttempt,
  caseWords,
  examReadMinutes,
  EXAM,
  notedNotUsed,
  paceBand,
  paceWindow,
  readingNote,
  recommend,
  rtfqRead,
  sentencesOf,
  type Delivered,
  type DrillAttempt,
  type DrillExercise,
  type DrillNote,
  type Marking,
} from "@/lib/reading-drills";
import { fetchReadingHistory, saveDrillAttempt } from "@/lib/reading-drills-store";
import { useStudentSession } from "@/lib/student-session";

const STEPS = ["Read", "Recall", "RTFQ", "Index", "Answer", "Feedback"];
type Stage = "intro" | "read" | "recall" | "rtfq" | "index" | "answer" | "marking" | "self" | "feedback";
const STEP_OF: Record<Stage, number> = { intro: 0, read: 0, recall: 1, rtfq: 2, index: 3, answer: 4, marking: 5, self: 5, feedback: 5 };

/** One practice exercise. `embedded` = shown inside a course lesson, which completes when the feedback appears. */
export default function DrillFlow({ exercise: ex, embedded = false, onComplete }: { exercise: DrillExercise; embedded?: boolean; onComplete?: () => void }) {
  const { user } = useStudentSession();
  const seed = useMemo(() => Math.floor(Math.random() * 100000), []);
  const [stage, setStage] = useState<Stage>("intro");
  const [t0, setT0] = useState<number | null>(null);
  const [readSec, setReadSec] = useState(0);
  const [recall, setRecall] = useState<(number | null)[]>(ex.recall.map(() => null));
  const [pick, setPick] = useState<{ shape: number | null; lens: number | null; dir: number[] }>({ shape: null, lens: null, dir: [] });
  const [notes, setNotes] = useState<DrillNote[]>([]);
  const [answer, setAnswer] = useState("");
  const [answerStart, setAnswerStart] = useState<number | null>(null);
  const [answerSec, setAnswerSec] = useState(0);
  const [marking, setMarking] = useState<Marking | null>(null);
  const [selfReason, setSelfReason] = useState("");
  const [attempt, setAttempt] = useState<DrillAttempt | null>(null);
  const [saveMsg, setSaveMsg] = useState("");
  const [history, setHistory] = useState<DrillAttempt[]>([]);

  useEffect(() => {
    if (user?.id) fetchReadingHistory(user.id).then((h) => setHistory(h.attempts));
  }, [user?.id]);
  const top = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!embedded) window.scrollTo({ top: 0 });
    else if (stage !== "intro") top.current?.scrollIntoView({ block: "start" });
  }, [stage, embedded]);

  const words = caseWords(ex);
  const [lo, hi] = paceWindow(words);
  const phase = stage === "read" ? "read" : "post";
  const addNote = (n: Omit<DrillNote, "id" | "crossed" | "phase">) =>
    setNotes((cur) => [...cur, { ...n, id: (cur.at(-1)?.id || 0) + 1, crossed: false, phase }]);
  const crossNote = (id: number) => setNotes((cur) => cur.map((n) => (n.id === id ? { ...n, crossed: true } : n)));
  const live = notes.filter((n) => !n.crossed).length;
  const caseView = (
    <AnnotatedCase sections={ex.case} notes={notes} phase={phase} onAdd={addNote} onCross={crossNote} />
  );
  const required = (
    <div className="rd-required">
      <b>Required</b>
      <span>{ex.required}</span>
      <span className="rd-marks">({ex.marks} marks)</span>
    </div>
  );

  const finish = async (m: Marking, by: "model" | "self", callId?: string | null) => {
    const a = buildAttempt({
      ex,
      readSec,
      answerSec,
      totalSec: t0 ? (Date.now() - t0) / 1000 : 0,
      recallPicks: recall.map((r) => (r == null ? -1 : r)),
      read: rtfqRead(ex, { shape: pick.shape ?? -1, lens: pick.lens ?? -1, dir: pick.dir }),
      notes,
      answer,
      marking: m,
      markedBy: by,
      markCallId: callId,
    });
    setMarking(m);
    setAttempt(a);
    setStage("feedback");
    onComplete?.();
    if (!user?.id) return setSaveMsg("Sign in to keep your results.");
    const res = await saveDrillAttempt(user.id, a);
    setSaveMsg(res.ok ? "Saved to your record." : `Not saved: ${res.error}`);
    if (res.ok) setHistory((h) => [...h, a]);
  };

  const submit = async () => {
    setAnswerSec(answerStart ? (Date.now() - answerStart) / 1000 : 0);
    setStage("marking");
    try {
      const res = await fetch("/api/reading/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exerciseId: ex.id, answer }),
      });
      const data = await res.json();
      if (res.ok && data.marking) return finish(data.marking as Marking, "model", data.markCallId);
      setSelfReason(data.reason || data.error || "Automatic marking is not available.");
    } catch {
      setSelfReason("Automatic marking is not available.");
    }
    setStage("self");
  };

  return (
    <article ref={top} className={embedded ? "rd-page rd-embedded" : "lesson-body wide rd-page"}>
      {embedded ? null : (
        <p className="muted small">
          <Link href="/student/reading">Read the Required</Link> · {ex.title} · {ex.area}
        </p>
      )}
      <StepStrip names={STEPS} step={STEP_OF[stage]} t0={t0} countdownFrom={stage === "answer" ? ex.answer_minutes * 60 : undefined} countdownStart={answerStart} />

      {stage === "intro" ? (
        <div className="rd-stack">
          {embedded ? <h2>{ex.title} · {ex.area}</h2> : <h1>{ex.title}</h1>}
          <p>
            Read the case and the required once, at exam pace, and index it as you go: click any word to write a short note in the margin,
            the way you would on a printed case. When you finish, the case is hidden and you answer {ex.recall.length} questions on what
            the case is about. Then it opens again, with your notes, for the rest of the exercise.
          </p>
          <p className="rd-note">
            Exam pace for this case, reading and making notes: <b>{fmt(lo)} to {fmt(hi)}</b> (100 to 150 words a minute). The clock runs while you read.
          </p>
          <div>
            <button className="primary" onClick={() => { setT0(Date.now()); setStage("read"); }}>
              Start reading
            </button>
          </div>
        </div>
      ) : null}

      {stage === "read" ? (
        <div className="rd-stack">
          <p className="muted">Click a word to add a note. Keep notes short: an index, not a summary. Notes you make now are blue.</p>
          {required}
          <div className="rd-sheet">{caseView}</div>
          <div className="rd-row">
            <button className="primary" onClick={() => { setReadSec(t0 ? (Date.now() - t0) / 1000 : 0); setStage("recall"); }}>
              I&apos;ve finished reading
            </button>
            <span className="muted small">
              {live} notes · exam pace {fmt(lo)}–{fmt(hi)} · the case is hidden next
            </span>
          </div>
        </div>
      ) : null}

      {stage === "recall" ? (
        <div className="rd-stack">
          <h2>What is this case about?</h2>
          <p className="muted">No looking back. These are the things you should carry in your head after one read, not figures.</p>
          {ex.recall.map((q, qi) => (
            <fieldset key={qi} className="rd-sheet rd-q">
              <legend>{q.question}</legend>
              <Choice name={`rc${qi}`} options={q.options} seed={seed + qi} value={recall[qi]} onChange={(v) => setRecall((r) => r.map((x, i) => (i === qi ? (v as number) : x)))} />
            </fieldset>
          ))}
          <div>
            <button className="primary" disabled={recall.some((r) => r == null)} onClick={() => setStage("rtfq")}>
              Next: RTFQ
            </button>
          </div>
        </div>
      ) : null}

      {stage === "rtfq" ? (
        <div className="rd-stack">
          <h2>What is the required asking for?</h2>
          <p className="muted">Break it down before you answer it. Your case and notes are below.</p>
          {required}
          <fieldset className="rd-sheet rd-q">
            <legend>Shape: what kind of answer does it want?</legend>
            <Choice name="shape" options={ex.rtfq.shape.options} seed={seed + 11} value={pick.shape} onChange={(v) => setPick((p) => ({ ...p, shape: v as number }))} />
          </fieldset>
          <fieldset className="rd-sheet rd-q">
            <legend>Directions: tick every condition the required sets</legend>
            <p className="muted small">Look for exclusions, named items, the level, and decision rules. Tick all that apply.</p>
            <Choice name="dir" multi options={ex.rtfq.directions.options.map((o) => o.text)} seed={seed + 12} value={pick.dir} onChange={(v) => setPick((p) => ({ ...p, dir: v as number[] }))} />
          </fieldset>
          <fieldset className="rd-sheet rd-q">
            <legend>Lens: from whose point of view, or at what angle?</legend>
            <Choice name="lens" options={ex.rtfq.lens.options} seed={seed + 13} value={pick.lens} onChange={(v) => setPick((p) => ({ ...p, lens: v as number }))} />
          </fieldset>
          <div>
            <button className="primary" disabled={pick.shape == null || pick.lens == null} onClick={() => setStage("index")}>
              Next: index for marks
            </button>
          </div>
          <details className="rd-sheet" open>
            <summary className="rd-eyebrow">The case and your notes</summary>
            {caseView}
          </details>
        </div>
      ) : null}

      {stage === "index" ? (
        <div className="rd-stack">
          <h2>Index the case for this required</h2>
          <p className="muted">
            Now you know what is asked, go back over the case. Add a note wherever there is a mark to earn; these notes are red. Cross out
            notes that no longer fit: click a note to cross it out. Nothing is erased, just as on paper.
          </p>
          {required}
          <div className="rd-sheet">{caseView}</div>
          <div className="rd-row">
            <button className="primary" onClick={() => { setAnswerStart(Date.now()); setStage("answer"); }}>
              Next: answer
            </button>
            <span className="muted small">{live} notes in use</span>
          </div>
        </div>
      ) : null}

      {stage === "answer" ? (
        <div className="rd-stack">
          <h2>Answer the required · {ex.answer_minutes} minutes</h2>
          <p className="muted">Short points are fine, as long as each one ties a case fact to what the required asks. The clock counts down; you can run over, but it is recorded.</p>
          {required}
          <details className="rd-sheet" open>
            <summary className="rd-eyebrow">The case and your notes</summary>
            {caseView}
          </details>
          <label className="rd-eyebrow" htmlFor="rd-answer">Your answer</label>
          <textarea id="rd-answer" className="rd-answer" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Type your answer here." />
          <div className="rd-row">
            <button className="primary" disabled={answer.trim().split(/\s+/).length < 15} onClick={submit}>
              Submit for feedback
            </button>
            <span className="muted small">{answer.trim() ? answer.trim().split(/\s+/).length : 0} words</span>
          </div>
        </div>
      ) : null}

      {stage === "marking" ? <p className="rd-stack">Marking your answer against the marker&apos;s rows…</p> : null}

      {stage === "self" ? <SelfMark ex={ex} answer={answer} reason={selfReason} onDone={(m) => finish(m, "self")} /> : null}

      {stage === "feedback" && attempt && marking ? (
        <Feedback ex={ex} a={attempt} marking={marking} notes={notes} pick={pick} saveMsg={saveMsg} history={history} embedded={embedded} />
      ) : null}
    </article>
  );
}

function SelfMark({ ex, answer, reason, onDone }: { ex: DrillExercise; answer: string; reason: string; onDone: (m: Marking) => void }) {
  const [rows, setRows] = useState<Set<string>>(new Set());
  const [rt, setRt] = useState<Record<"shape" | "dir" | "lens", Delivered | null>>({ shape: null, dir: null, lens: null });
  const asks = {
    shape: ex.rtfq.shape.options[ex.rtfq.shape.correct],
    dir: ex.rtfq.directions.options.filter((o) => o.required).map((o) => o.text).join("; "),
    lens: ex.rtfq.lens.options[ex.rtfq.lens.correct],
  };
  return (
    <div className="rd-stack">
      <h2>Mark your own answer</h2>
      <p className="muted">{reason} Compare your answer with the marker&apos;s rows, and tick a row only if you made that point and tied it to the case.</p>
      <div className="rd-sheet rd-answer-view">{answer}</div>
      <fieldset className="rd-sheet rd-q">
        <legend>The marker&apos;s rows</legend>
        <div className="rd-opts">
          {ex.rows.map((r) => (
            <label key={r.id} className={`rd-opt${rows.has(r.id) ? " on" : ""}`}>
              <input type="checkbox" checked={rows.has(r.id)} onChange={() => setRows((cur) => { const n = new Set(cur); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} />
              <span>
                {r.point} <span className={`rd-prox ${r.proximity}`}>{r.proximity}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {(["shape", "dir", "lens"] as const).map((k) => (
        <fieldset key={k} className="rd-sheet rd-q">
          <legend>{k === "dir" ? "Directions" : k[0].toUpperCase() + k.slice(1)}: did your answer deliver this?</legend>
          <p className="muted small">{asks[k]}</p>
          <div className="rd-row">
            {(["yes", "partly", "no"] as Delivered[]).map((v) => (
              <label key={v} className={`rd-opt${rt[k] === v ? " on" : ""}`}>
                <input type="radio" name={`self-${k}`} checked={rt[k] === v} onChange={() => setRt((c) => ({ ...c, [k]: v }))} />
                <span>{v[0].toUpperCase() + v.slice(1)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <div>
        <button
          className="primary"
          disabled={!rt.shape || !rt.dir || !rt.lens}
          onClick={() =>
            onDone({
              rtfq: { shape: { delivered: rt.shape!, note: "" }, dir: { delivered: rt.dir!, note: "" }, lens: { delivered: rt.lens!, note: "" } },
              rows: Object.fromEntries(ex.rows.map((r) => [r.id, { earned: rows.has(r.id), evidence: "" }])),
              traps: [],
              fix: "",
            })
          }
        >
          See my feedback
        </button>
      </div>
    </div>
  );
}

function Feedback({ ex, a, marking, notes, pick, saveMsg, history, embedded }: {
  ex: DrillExercise;
  a: DrillAttempt;
  marking: Marking;
  notes: DrillNote[];
  pick: { shape: number | null; lens: number | null; dir: number[] };
  saveMsg: string;
  history: DrillAttempt[];
  embedded: boolean;
}) {
  const words = caseWords(ex);
  const [lo, hi] = paceWindow(words);
  const band = paceBand(a.wpm);
  const noted = new Set(notes.filter((n) => !n.crossed).map((n) => n.sentence));
  const notUsed = notedNotUsed(ex, marking, noted);
  const sents = Object.fromEntries(sentencesOf(ex.case).map((s) => [s.id, s.text]));
  const next = recommend(history);
  const ticked = new Set(pick.dir);
  const misread = ex.rtfq.directions.options.filter((o, i) => o.required !== ticked.has(i));
  const readPill = (k: "shape" | "dir" | "lens") => {
    const v = a.rtfq_read[k];
    return <Pill value={v === 1 ? "yes" : k === "dir" && v >= 0.6 ? "partly" : "no"} />;
  };
  const dims = [
    { k: "shape" as const, name: "Shape", asked: ex.rtfq.shape.options[ex.rtfq.shape.correct], why: ex.rtfq.shape.why },
    { k: "dir" as const, name: "Directions", asked: ex.rtfq.directions.options.filter((o) => o.required).map((o) => o.text).join("; "), why: ex.rtfq.directions.why },
    { k: "lens" as const, name: "Lens", asked: ex.rtfq.lens.options[ex.rtfq.lens.correct], why: ex.rtfq.lens.why },
  ];
  return (
    <div className="rd-stack">
      <div>
        <h1>{a.signals.length ? "Here is where the marks went" : "Clean on both skills"}</h1>
        <p className="muted small">
          Total time {fmt(a.total_sec)}. {a.marked_by === "model" ? "Marked automatically against the marker's rows." : "Self-marked against the marker's rows."} {saveMsg}
        </p>
      </div>
      <ResultRange pct={a.grade.pct} potPct={a.grade.potPct} />
      {a.signals.length ? <p className="rd-signal"><b>Signals:</b> {a.signals.join(" · ")}</p> : null}
      {a.fix ? <p className="rd-note"><b>Fix this first:</b> {a.fix}</p> : null}

      <div className="rd-tiles">
        <Tile label="Reading pace" big={<>{a.wpm} <small>words / min</small></>} sub={<><b>{band.label}</b> · {fmt(a.read_sec)} (exam pace {fmt(lo)}–{fmt(hi)}) · a full exam case would take you about {examReadMinutes(a.wpm)} min (budget {EXAM.readMin}–{EXAM.readMax})</>} />
        <Tile label="Absorption" big={`${a.recall} / ${a.recall_n}`} sub="core points absorbed, with the case hidden" />
        <Tile label="Direct treasure" big={`${a.buried_treasure.dEarn} / ${a.buried_treasure.dRows}`} sub={`rows earned · you noted ${a.buried_treasure.dSpot} of ${a.buried_treasure.dTot} clues`} />
        <Tile label="Indirect treasure" big={`${a.buried_treasure.iEarn} / ${a.buried_treasure.iRows}`} sub={`rows earned · you noted ${a.buried_treasure.iSpot} of ${a.buried_treasure.iTot} clues`} />
      </div>
      <p className="muted small">{readingNote(a.wpm, a.recall / a.recall_n)}</p>

      <section className="rd-sheet rd-stack">
        <h2>RTFQ: what you were supposed to see, and how it should have shaped your answer</h2>
        <div className="rd-table-wrap">
          <table className="rd-table">
            <thead>
              <tr><th>Dimension</th><th>Read it?</th><th>Delivered it?</th><th>What the required asked for</th></tr>
            </thead>
            <tbody>
              {dims.map((d) => (
                <tr key={d.k}>
                  <td><b>{d.name}</b></td>
                  <td className="c">{readPill(d.k)}</td>
                  <td className="c"><Pill value={a.rtfq_delivered[d.k]} /></td>
                  <td>
                    {d.asked}
                    {marking.rtfq[d.k].note ? <div className="muted small">On your page: {marking.rtfq[d.k].note}</div> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {misread.length ? (
          <p className="muted small">
            <b>Directions you misread:</b> {misread.map((o) => `${o.required ? "missed" : "wrongly ticked"} “${o.text}”`).join("; ")}.
          </p>
        ) : null}
        <p className="muted small">Read it but did not deliver it means you knew what was asked and still drifted. Not read means the reading itself is the problem.</p>
        {dims.map((d) => (
          <p key={d.k}><b>{d.name}.</b> {d.why}</p>
        ))}
      </section>

      <section className="rd-sheet rd-stack">
        <h2>Buried Treasure: the marker&apos;s rows</h2>
        {notUsed.length ? (
          <p className="rd-note">
            You made a note on the clue for {notUsed.length} row{notUsed.length === 1 ? "" : "s"} but did not turn it into a point. You saw the treasure and left it in the ground.
          </p>
        ) : null}
        {marking.traps.length ? (
          <p className="rd-signal">You used information the required rules out: {marking.traps.map((id) => `“${sents[id] || id}”`).join(" ")}</p>
        ) : null}
        <div className="rd-table-wrap">
          <table className="rd-table">
            <thead>
              <tr><th>Point the marker rewards</th><th>Type</th><th>Clue noted</th><th>Earned</th></tr>
            </thead>
            <tbody>
              {ex.rows.map((r) => {
                const m = marking.rows[r.id];
                const sp = r.clues.length ? r.clues.some((c) => noted.has(c)) : null;
                return (
                  <tr key={r.id}>
                    <td>
                      {r.point}
                      {m?.evidence ? <div className="muted small">You wrote: “{m.evidence}”</div> : null}
                    </td>
                    <td className="c"><span className={`rd-prox ${r.proximity}`}>{r.proximity}</span></td>
                    <td className="c">{sp == null ? "–" : sp ? <span className="rd-ok">Yes</span> : <span className="rd-miss">No</span>}</td>
                    <td className="c">{m?.earned ? <span className="rd-ok">Yes</span> : <span className="rd-miss">No</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted small">Direct: the case states it, you only need to spot it and use it. Indirect: the case gives a clue and you take one step (apply a rule, draw the conclusion).</p>
      </section>

      {embedded ? (
        <p className="muted small">This lesson is now marked complete. Your result is saved to your record.</p>
      ) : (
      <section className="rd-sheet rd-row">
        <div>
          <span className="rd-eyebrow">Next</span>
          <h2>{next.exercise.title}</h2>
          <p className="muted small">{next.reason}</p>
        </div>
        <div className="rd-row rd-push">
          <Link href="/student/reading">Back to Read the Required</Link>
          <a className="primary" href={`/student/reading/${next.exercise.id}`}>Start</a>
        </div>
      </section>
      )}
    </div>
  );
}
