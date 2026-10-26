"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { formatTime } from "@/lib/dates";
import type { Lesson } from "@/lib/types";
import {
  embedSrcForVideo,
  isYouTubeEmbed,
  withPlayerApi,
  youtubeWatchUrl,
  YOUTUBE_EMBED_ALLOW,
  YOUTUBE_EMBED_REFERRER_POLICY,
} from "@/lib/video-embed";

export { embedSrcForVideo };

type YtPlayer = {
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy?: () => void;
};

type YtNamespace = {
  Player: new (
    el: HTMLIFrameElement | string,
    opts: {
      events?: {
        onReady?: (event: { target: YtPlayer }) => void;
        onStateChange?: (event: { data: number; target: YtPlayer }) => void;
      };
    }
  ) => YtPlayer;
};

function loadYouTubeApi(): Promise<YtNamespace | null> {
  const existing = (window as Window & { YT?: YtNamespace }).YT;
  if (existing?.Player) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const win = window as Window & { YT?: YtNamespace; onYouTubeIframeAPIReady?: () => void };
    const previous = win.onYouTubeIframeAPIReady;
    win.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(win.YT || null);
    };
    if (!document.querySelector("script[src='https://www.youtube.com/iframe_api']")) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }
    window.setTimeout(() => resolve(win.YT || null), 8000);
  });
}

function vimeoPost(iframe: HTMLIFrameElement, method: string, value?: string) {
  iframe.contentWindow?.postMessage(
    JSON.stringify(value ? { method, value } : { method }),
    "https://player.vimeo.com"
  );
}

/** Vimeo or YouTube embed when the lesson has a player URL; otherwise a timed stand-in. */
export default function VideoPlayer({
  lesson,
  src,
  title,
  onWatchProgress,
}: {
  lesson: Lesson;
  src?: string;
  title?: string;
  onWatchProgress?: (seconds: number, percent: number) => void;
}) {
  const total = lesson.seconds || 0;
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const lastReported = useRef(0);

  // A new lesson means a fresh player.
  useEffect(() => {
    setElapsed(0);
    setPlaying(false);
    lastReported.current = 0;
  }, [lesson.id, src]);

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
  useEffect(() => {
    if (!onWatchProgress || !total) return;
    if (pct < lastReported.current + 5 && pct < 80) return;
    lastReported.current = pct;
    onWatchProgress(elapsed, pct);
  }, [elapsed, onWatchProgress, pct, total]);

  const toggle = () => setPlaying((on) => !on);
  const scrub = (event: MouseEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    setElapsed(Math.round(ratio * total));
  };

  const [embedReady, setEmbedReady] = useState(false);
  const raw = src || lesson.video_url;
  const embedSrc = embedSrcForVideo(raw);
  const trackedSrc =
    embedSrc && onWatchProgress
      ? withPlayerApi(embedSrc, typeof window === "undefined" ? undefined : window.location.origin)
      : embedSrc;
  const watchUrl = raw ? youtubeWatchUrl(raw) : null;
  const label = title || lesson.title;

  useEffect(() => {
    setEmbedReady(false);
    if (!trackedSrc) return;
    const id = window.requestAnimationFrame(() => setEmbedReady(true));
    return () => window.cancelAnimationFrame(id);
  }, [trackedSrc, lesson.id]);

  useEffect(() => {
    if (!onWatchProgress || !trackedSrc || !embedReady) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | null = null;
    let player: YtPlayer | null = null;

    const report = (seconds: number, percent: number) => {
      const clipped = Math.min(100, Math.max(0, percent));
      if (clipped < lastReported.current + 1 && clipped < 80) return;
      lastReported.current = clipped;
      onWatchProgress(seconds, clipped);
    };

    const onMessage = (event: MessageEvent) => {
      const origin = String(event.origin || "");
      if (!origin.includes("vimeo.com")) return;
      let data: { event?: string; data?: { seconds?: number; percent?: number } } | null = null;
      try {
        data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (data?.event === "ready") {
        vimeoPost(iframe, "addEventListener", "timeupdate");
        return;
      }
      if (data?.event !== "timeupdate") return;
      const seconds = Number(data.data?.seconds || 0);
      const percent = Number(data.data?.percent || 0) * 100;
      if (seconds || percent) report(seconds, percent);
    };

    const startVimeo = () => {
      vimeoPost(iframe, "addEventListener", "timeupdate");
      vimeoPost(iframe, "addEventListener", "play");
    };

    if (isYouTubeEmbed(trackedSrc)) {
      void loadYouTubeApi().then((yt) => {
        if (cancelled || !yt || !iframeRef.current) return;
        player = new yt.Player(iframeRef.current, {
          events: {
            onReady: (event) => {
              poll = setInterval(() => {
                const seconds = Number(event.target.getCurrentTime?.() || 0);
                const duration = Number(event.target.getDuration?.() || 0);
                if (duration > 0) report(seconds, (seconds / duration) * 100);
              }, 2000);
            },
          },
        });
      });
    } else {
      window.addEventListener("message", onMessage);
      startVimeo();
      iframe.addEventListener("load", startVimeo);
    }

    return () => {
      cancelled = true;
      window.removeEventListener("message", onMessage);
      iframe.removeEventListener("load", startVimeo);
      if (poll) clearInterval(poll);
      try {
        player?.destroy?.();
      } catch {
        /* player may already be gone */
      }
    };
  }, [embedReady, onWatchProgress, trackedSrc]);

  if (trackedSrc) {
    const isYouTube = isYouTubeEmbed(trackedSrc);
    return (
      <div className="player" id={src ? undefined : "player"}>
        {embedReady ? (
          <div className="player-frame">
            <iframe
              ref={iframeRef}
              src={trackedSrc}
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
