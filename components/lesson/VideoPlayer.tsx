"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { formatTime } from "@/lib/dates";
import type { Lesson } from "@/lib/types";

/** Stand-in for a real video: it counts through the lesson's runtime. */
export default function VideoPlayer({ lesson }: { lesson: Lesson }) {
  const total = lesson.seconds || 0;
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // A new lesson means a fresh player.
  useEffect(() => {
    setElapsed(0);
    setPlaying(false);
  }, [lesson.id]);

  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => {
      setElapsed((current) => {
        if (current + 1 >= total) {
          setPlaying(false);
          return total;
        }
        return current + 1;
      });
    }, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [playing, total]);

  const pct = total ? Math.min(100, (elapsed / total) * 100) : 0;
  const toggle = () => setPlaying((on) => !on);
  const scrub = (event: MouseEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    setElapsed(Math.round(ratio * total));
  };

  return (
    <div className="player" id="player">
      <div className="player-art">
        <button className="play" id="play" aria-label="Play lesson" onClick={toggle}>
          {playing ? "❙❙" : "▶"}
        </button>
        <span className="player-badge">Lesson video · {lesson.duration}</span>
      </div>
      <div className="player-bar">
        <button className="play-small" id="play-small" onClick={toggle}>
          {playing ? "❙❙" : "▶"}
        </button>
        <div className="track" id="track" onClick={scrub}>
          <span id="fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="time" id="time">
          {formatTime(elapsed)} / {lesson.duration}
        </span>
      </div>
    </div>
  );
}
