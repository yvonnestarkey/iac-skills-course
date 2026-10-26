/** Turn a Vimeo or YouTube URL into an iframe src, or null if it is not embeddable. */

export function youtubeVideoId(raw: string): string | null {
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

export function youtubeWatchUrl(raw: string): string | null {
  const id = youtubeVideoId(raw);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}

function vimeoEmbedSrc(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.includes("player.vimeo.com")) return trimmed;
  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "");
    if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    const id = parts[0] === "video" ? parts[1] : parts[0];
    if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
  } catch {
    return null;
  }
  return null;
}

export function youtubeEmbedSrc(id: string): string {
  return `https://www.youtube.com/embed/${id}?feature=oembed`;
}

export function embedSrcForVideo(raw?: string): string | null {
  if (!raw) return null;
  const vimeo = vimeoEmbedSrc(raw);
  if (vimeo) return vimeo;
  const id = youtubeVideoId(raw);
  return id ? youtubeEmbedSrc(id) : null;
}

/** Enable the player APIs so we can tell when a student has watched 80%. */
export function withPlayerApi(src: string, origin?: string): string {
  try {
    const url = new URL(src);
    if (isYouTubeEmbed(src)) {
      url.searchParams.set("enablejsapi", "1");
      if (origin) url.searchParams.set("origin", origin);
    } else if (url.hostname.includes("vimeo.com")) {
      url.searchParams.set("api", "1");
    }
    return url.toString();
  } catch {
    return src;
  }
}

export function isYouTubeEmbed(src: string): boolean {
  return src.includes("youtube.com/embed/") || src.includes("youtube-nocookie.com/embed/");
}

/** YouTube's official embed allow-list, including referrerPolicy. Missing this is Error 153 on some browsers. */
export const YOUTUBE_EMBED_ALLOW =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
export const YOUTUBE_EMBED_REFERRER_POLICY = "strict-origin-when-cross-origin" as const;
