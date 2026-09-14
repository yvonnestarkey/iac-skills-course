"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { formatTime } from "@/lib/dates";
import type { Lesson } from "@/lib/types";

function youtubeVideoId(raw: string): string | null {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
    if (host === "youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0] || null;
    }
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (url.pathname.startsWith("/embed/") || url.pathname.startsWith("/shorts/")) {
        return url.pathname.split("/")[2] || null;
      }
      return url.searchParams.get("v");
    }
  } catch {
    return null;
  }
  return null;
}

/** Turn a Vimeo or YouTube URL into an iframe src, or null if it is not embeddable. */
export function embedSrcForVideo(raw?: string): string | null {
  if (!raw) return null;
  if (raw.includes("player.vimeo.com")) return raw;
  const id = youtubeVideoId(raw);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

/** Vimeo or YouTube embed when the lesson has a player URL; otherwise a timed stand-in. */
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

  const embedSrc = embedSrcForVideo(lesson.video_url);
  if (embedSrc) {
    const isYouTube = embedSrc.includes("youtube.com/embed/");
    return (
      <div className="player" id="player">
        <iframe
          src={embedSrc}
          width="100%"
          height="450"
          allow={
            isYouTube
              ? "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              : "autoplay; fullscreen"
          }
          allowFullScreen
          title={lesson.title}
        />
      </div>
    );
  }

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
