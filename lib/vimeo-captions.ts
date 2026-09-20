export interface CaptionCue {
  start: string;
  end: string;
  text: string;
}

export interface VimeoTextTrack {
  id?: string | number;
  name?: string;
  language?: string;
  type?: string;
  link?: string;
  active?: boolean;
  modified_on?: string;
  download_links?: { vtt?: string; srt?: string };
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function vimeoVideoIdFromUrl(url: string): string | null {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  return match?.[1] || null;
}

export function parseVttCues(vtt: string): CaptionCue[] {
  const blocks = vtt.replace(/^\uFEFF/, "").split(/\n\s*\n/);
  const cues: CaptionCue[] = [];
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const timeLine = lines.find((line) => line.includes("-->"));
    if (!timeLine) continue;
    const [start, end] = timeLine.split("-->").map((part) => part.trim().split(" ")[0]);
    const text = lines
      .filter((line) => line !== timeLine && !/^\d+$/.test(line) && line !== "WEBVTT")
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (start && end && text) cues.push({ start, end, text });
  }
  return cues;
}

export function transcriptFromCues(cues: CaptionCue[]): string {
  return cues.map((cue) => cue.text).join(" ").replace(/\s+/g, " ").trim();
}

export function vimeoConfigured(): boolean {
  return Boolean(process.env.VIMEO_ACCESS_TOKEN?.trim());
}

async function vimeoGet(path: string): Promise<{ ok: boolean; status: number; data: unknown; error?: string }> {
  const token = process.env.VIMEO_ACCESS_TOKEN?.trim();
  if (!token) return { ok: false, status: 401, data: null, error: "VIMEO_ACCESS_TOKEN is not configured." };
  const url = path.startsWith("http") ? path : `https://api.vimeo.com${path}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.vimeo.*+json;version=3.4",
    },
    cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      data,
      error: asText((data as { error?: string } | null)?.error) || `Vimeo HTTP ${response.status}`,
    };
  }
  return { ok: true, status: response.status, data };
}

export async function listVimeoTextTracks(videoId: string): Promise<{
  ok: boolean;
  status: number;
  tracks: VimeoTextTrack[];
  error?: string;
}> {
  const result = await vimeoGet(`/videos/${videoId}/texttracks`);
  if (!result.ok) return { ok: false, status: result.status, tracks: [], error: result.error };
  const payload = result.data as { data?: VimeoTextTrack[] } | VimeoTextTrack[];
  const tracks = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
  return { ok: true, status: result.status, tracks };
}

export function trackDownloadUrl(track: VimeoTextTrack | null | undefined): string | null {
  if (!track) return null;
  return asText(track.download_links?.vtt) || asText(track.link) || null;
}

export function pickEnglishTrack(tracks: VimeoTextTrack[]): VimeoTextTrack | null {
  const ranked = [...tracks].sort((left, right) => {
    const score = (track: VimeoTextTrack) => {
      const language = asText(track.language);
      const english = /^en/i.test(language) ? 2 : 0;
      const captions = track.type === "captions" ? 1 : 0;
      const active = track.active ? 1 : 0;
      return english + captions + active;
    };
    return score(right) - score(left);
  });
  return ranked[0] || null;
}

export async function downloadVimeoVtt(link: string): Promise<{ ok: boolean; vtt?: string; error?: string }> {
  const token = process.env.VIMEO_ACCESS_TOKEN?.trim();
  if (!token) return { ok: false, error: "VIMEO_ACCESS_TOKEN is not configured." };
  const response = await fetch(link, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) return { ok: false, error: `Could not download caption track (${response.status}).` };
  const vtt = await response.text();
  if (!vtt.trim()) return { ok: false, error: "Caption track was empty." };
  return { ok: true, vtt };
}
