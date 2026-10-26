"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AnnotatedCase from "@/components/reading/AnnotatedCase";
import { Choice, StepStrip, Tile, fmt } from "@/components/reading/parts";
import {
  EXAM,
  READING_CHECK,
  caseWords,
  examReadMinutes,
  paceBand,
  paceWindow,
  readingProfile,
  wordsPerMinute,
  type DrillNote,
  type ReadingCheckResult,
} from "@/lib/reading-drills";
import { saveReadingCheck } from "@/lib/reading-drills-store";
import { useStudentSession } from "@/lib/student-session";

type Stage = "intro" | "read" | "recall" | "result";
const STEP_OF: Record<Stage, number> = { intro: 0, read: 0, recall: 1, result: 2 };

/** The reading check: a longer case, no required. Pace with notes against absorption of the big picture. */
export default function ReadingCheckFlow() {
  const { user } = useStudentSession();
  const rc = READING_CHECK;
  const seed = useMemo(() => Math.floor(Math.random() * 100000), []);
  const [stage, setStage] = useState<Stage>("intro");
  const [t0, setT0] = useState<number | null>(null);
  const [notes, setNotes] = useState<DrillNote[]>([]);
  const [picks, setPicks] = useState<(number | null)[]>(rc.recall.map(() => null));
  const [result, setResult] = useState<ReadingCheckResult | null>(null);
  const [saveMsg, setSaveMsg] = useState("");
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [stage]);

  const words = caseWords(rc);
  const [lo, hi] = paceWindow(words);

  const finish = async (readSec: number) => {
    const absorb = picks.filter((p, i) => p === rc.recall[i].correct).length;
    const wpm = wordsPerMinute(words, readSec);
    const r: ReadingCheckResult = {
      check_id: rc.id,
      wpm,
      read_sec: Math.round(readSec),
      absorb,
      absorb_n: rc.recall.length,
      missed: rc.recall.map((q, i) => (picks[i] === q.correct ? -1 : i)).filter((i) => i >= 0),
      notes: notes.filter((n) => !n.crossed).length,
      profile: readingProfile(wpm, absorb / rc.recall.length).title,
    };
    setResult(r);
    setStage("result");
    if (!user?.id) return setSaveMsg("Sign in to keep your results.");
    const res = await saveReadingCheck(user.id, r);
    setSaveMsg(res.ok ? "Saved to your record." : `Not saved: ${res.error}`);
  };

  const [readSec, setReadSec] = useState(0);

  return (
    <article className="lesson-body wide rd-page">
      <p className="muted small">
        <Link href="/student/reading">Read the Required</Link> · Reading check · {rc.title}
      </p>
      <StepStrip names={["Read", "Recall", "Result"]} step={STEP_OF[stage]} t0={stage === "result" ? null : t0} />

      {stage === "intro" ? (
        <div className="rd-stack">
          <h1>Reading check</h1>
          <p>
            Read this case the way you would read an exam case: once, carefully, making short notes as you go (click any word to add one).
            It is about {words.toLocaleString("en-ZA")} words, roughly {Math.round(words / 476)} exam pages. There is no required. When you
            finish, the case is hidden and you answer {rc.recall.length} questions on what it was about: the big picture, not figures.
          </p>
          <p className="rd-note">
            Exam pace, reading and making notes: <b>{fmt(lo)} to {fmt(hi)}</b> for this case. An exam case is about {EXAM.words.toLocaleString("en-ZA")} words,
            which at this pace is {EXAM.readMin} to {EXAM.readMax} minutes.
          </p>
          <div>
            <button className="primary" onClick={() => { setT0(Date.now()); setStage("read"); }}>Start reading</button>
          </div>
        </div>
      ) : null}

      {stage === "read" ? (
        <div className="rd-stack">
          <p className="muted">Click a word to add a note. Keep notes short: an index, not a summary.</p>
          <div className="rd-sheet">
            <AnnotatedCase
              sections={rc.case}
              notes={notes}
              phase="read"
              showPostLegend={false}
              onAdd={(n) => setNotes((cur) => [...cur, { ...n, id: (cur.at(-1)?.id || 0) + 1, crossed: false, phase: "read" }])}
              onCross={(id) => setNotes((cur) => cur.map((n) => (n.id === id ? { ...n, crossed: true } : n)))}
            />
          </div>
          <div className="rd-row">
            <button className="primary" onClick={() => { setReadSec(t0 ? (Date.now() - t0) / 1000 : 0); setStage("recall"); }}>
              I&apos;ve finished reading
            </button>
            <span className="muted small">{notes.filter((n) => !n.crossed).length} notes · exam pace {fmt(lo)}–{fmt(hi)} · the case is hidden next</span>
          </div>
        </div>
      ) : null}

      {stage === "recall" ? (
        <div className="rd-stack">
          <h2>What was this case about?</h2>
          <p className="muted">No looking back. Pick the best answer.</p>
          {rc.recall.map((q, qi) => (
            <fieldset key={qi} className="rd-sheet rd-q">
              <legend>{qi + 1}. {q.question}</legend>
              <Choice name={`rc${qi}`} options={q.options} seed={seed + qi} value={picks[qi]} onChange={(v) => setPicks((p) => p.map((x, i) => (i === qi ? (v as number) : x)))} />
            </fieldset>
          ))}
          <div>
            <button className="primary" disabled={picks.some((p) => p == null)} onClick={() => finish(readSec)}>See my result</button>
          </div>
        </div>
      ) : null}

      {stage === "result" && result ? <CheckResult r={result} saveMsg={saveMsg} lo={lo} hi={hi} /> : null}
    </article>
  );
}

function CheckResult({ r, saveMsg, lo, hi }: { r: ReadingCheckResult; saveMsg: string; lo: number; hi: number }) {
  const prof = readingProfile(r.wpm, r.absorb / r.absorb_n);
  const marker = Math.min(r.wpm, 300) / 3;
  return (
    <div className="rd-stack">
      <div>
        <span className="rd-eyebrow">Reading check result</span>
        <h1>{prof.title}</h1>
        <p className="muted small">{saveMsg}</p>
      </div>
      <p className="rd-note">{prof.text}</p>
      <div className="rd-tiles">
        <Tile label="Reading pace" big={<>{r.wpm} <small>words / min</small></>} sub={<><b>{paceBand(r.wpm).label}</b> · {fmt(r.read_sec)} (exam pace {fmt(lo)}–{fmt(hi)})</>} />
        <Tile label="Absorption" big={`${r.absorb} / ${r.absorb_n}`} sub={r.absorb / r.absorb_n >= 0.75 ? "The big picture is going in" : "The big picture is not sticking yet"} />
        <Tile label="A full exam case" big={<>{examReadMinutes(r.wpm)} <small>min</small></>} sub={`at your pace · budget ${EXAM.readMin}–${EXAM.readMax} min`} />
        <Tile label="Notes made" big={r.notes} sub={r.notes < 8 ? "Too few to index a case this long: aim for at least one per section" : "Enough to find your way back"} />
      </div>
      <section className="rd-sheet rd-stack">
        <h3>Where your pace sits</h3>
        <div className="rd-scale rd-pace" aria-hidden="true">
          <span className="band" style={{ left: `calc(${marker}% - 5px)`, width: 10 }} />
        </div>
        <div className="rd-scale-l rd-abs">
          <span style={{ left: 0 }}>0</span>
          <span style={{ left: "33.3%" }}>100</span>
          <span style={{ left: "50%" }}>150</span>
          <span style={{ left: "100%" }}>300+ words a minute</span>
        </div>
        <p className="muted small">The green band is exam pace: 100 to 150 words a minute while making notes. Faster is fine only if your absorption holds.</p>
      </section>
      {r.missed.length ? (
        <section className="rd-sheet rd-stack">
          <h3>What did not stick</h3>
          {r.missed.map((i) => (
            <p key={i}>
              <b>{READING_CHECK.recall[i].question}</b>
              <br />
              {READING_CHECK.recall[i].options[READING_CHECK.recall[i].correct]}
            </p>
          ))}
        </section>
      ) : null}
      <div className="rd-row">
        <Link href="/student/reading">Back to Read the Required</Link>
      </div>
    </div>
  );
}
