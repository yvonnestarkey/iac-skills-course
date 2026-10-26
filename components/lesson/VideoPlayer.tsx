"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { formatTime } from "@/lib/dates";
import type { Lesson } from "@/lib/types";
import {
  embedSrcForVideo,
  isYouTubeEmbed,
  youtubeWatchUrl,
  YOUTUBE_EMBED_ALLOW,
  YOUTUBE_EMBED_REFERRER_POLICY,
} from "@/lib/video-embed";

export { embedSrcForVideo };

/** Vimeo or YouTube embed when the lesson has a player URL; otherwise a timed stand-in. */
export default function VideoPlayer({
  lesson,
  src,
  title,
}: {
  lesson: Lesson;
  src?: string;
  title?: string;
}) {
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

  const [embedReady, setEmbedReady] = useState(false);
  const raw = src || lesson.video_url;
  const embedSrc = embedSrcForVideo(raw);
  const watchUrl = raw ? youtubeWatchUrl(raw) : null;
  const label = title || lesson.title;

  useEffect(() => {
    setEmbedReady(false);
    if (!embedSrc) return;
    const id = window.requestAnimationFrame(() => setEmbedReady(true));
    return () => window.cancelAnimationFrame(id);
  }, [embedSrc, lesson.id]);

  if (embedSrc) {
    const isYouTube = isYouTubeEmbed(embedSrc);
    return (
      <div className="player" id={src ? undefined : "player"}>
        {embedReady ? (
          <div className="player-frame">
            <iframe
              src={embedSrc}
              allow={isYouTube ? YOUTUBE_EMBED_ALLOW : "autoplay; fullscreen"}
              referrerPolicy={isYouTube ? YOUTUBE_EMBED_REFERRER_POLICY : undefined}
              allowFullScreen
              title={label}
            />
          </div>
        ) : (
          <div className="player-skeleton" aria-busy="true" aria-label="Loading video" />
        )}
        {watchUrl ? (
          <p className="player-fallback">
            Video not playing?{" "}
            <a href={watchUrl} target="_blank" rel="noopener noreferrer">
              Open it on YouTube
            </a>
          </p>
        ) : null}
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
