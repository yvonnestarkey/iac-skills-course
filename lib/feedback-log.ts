export type FeedbackLogEntry = {
  at: string;
  text: string;
};

const MARK = /^---\s+(\S+)\s+---$/;

export function parseFeedbackLog(raw: string | null | undefined): FeedbackLogEntry[] {
  const text = String(raw || "").replace(/\r\n/g, "\n").trim();
  if (!text) return [];
  const lines = text.split("\n");
  const entries: FeedbackLogEntry[] = [];
  let currentAt = "";
  let buf: string[] = [];
  const flush = () => {
    const body = buf.join("\n").trim();
    if (body) entries.push({ at: currentAt, text: body });
    buf = [];
  };
  for (const line of lines) {
    const match = line.trim().match(MARK);
    if (match) {
      flush();
      currentAt = match[1];
      continue;
    }
    buf.push(line);
  }
  flush();
  return entries;
}

export function appendFeedbackEntry(existing: string | null | undefined, entry: { at: string; text: string }): string {
  const body = String(entry.text || "").trim();
  if (!body) return String(existing || "").trim();
  const stamp = String(entry.at || new Date().toISOString()).trim() || new Date().toISOString();
  const block = `--- ${stamp} ---\n${body}`;
  const previous = String(existing || "").trim();
  return previous ? `${previous}\n\n${block}` : block;
}

export function nextFeedbackLog(
  existing: string | null | undefined,
  input: { note: string; at?: string; statusChanged?: boolean; statusLabel?: string; gradeChanged?: boolean; gradeLabel?: string }
): string {
  const at = input.at || new Date().toISOString();
  const note = String(input.note || "").trim();
  if (note) return appendFeedbackEntry(existing, { at, text: note });
  const bits = [
    input.statusChanged && input.statusLabel ? `Status changed to ${input.statusLabel}.` : "",
    input.gradeChanged && input.gradeLabel ? `Grade updated to ${input.gradeLabel}.` : "",
  ].filter(Boolean);
  if (!bits.length) return String(existing || "").trim();
  return appendFeedbackEntry(existing, { at, text: bits.join(" ") });
}

export function latestFeedbackEntry(raw: string | null | undefined): FeedbackLogEntry | null {
  const entries = parseFeedbackLog(raw);
  return entries.length ? entries[entries.length - 1] : null;
}

export function hasWrittenFeedback(raw: string | null | undefined): boolean {
  return parseFeedbackLog(raw).length > 0;
}
