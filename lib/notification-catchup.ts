import { normalizeCohortId } from "./cohorts";

export interface CatchupRow {
  userId: string;
  cohort?: string | null;
  kind?: string | null;
  audience?: string | null;
  title: string;
  message: string;
  createdAt: string;
}

export function announcementContentKey(title: string, message: string): string {
  return `${title.trim()}|${message.trim()}`;
}

export function isPersonalNotification(kind?: string | null, audience?: string | null): boolean {
  const type = String(kind || "announcement");
  if (type !== "announcement") return true;
  return audience === "student";
}

export function missedCohortAnnouncements(input: {
  studentId: string;
  cohort: string;
  own: CatchupRow[];
  others: CatchupRow[];
}): Array<{ title: string; message: string; createdAt: string }> {
  const cohort = normalizeCohortId(input.cohort);
  const ownKeys = new Set(input.own.map((row) => announcementContentKey(row.title, row.message)));

  const groups = new Map<
    string,
    {
      title: string;
      message: string;
      createdAt: string;
      recipients: Set<string>;
      audiences: Set<string>;
      cohortHits: number;
    }
  >();

  for (const row of input.others) {
    if (row.userId === input.studentId) continue;
    if (isPersonalNotification(row.kind, row.audience)) continue;
    const title = row.title.trim();
    const message = row.message.trim();
    if (!title && !message) continue;
    const key = announcementContentKey(title, message);
    let group = groups.get(key);
    if (!group) {
      group = {
        title,
        message,
        createdAt: row.createdAt,
        recipients: new Set(),
        audiences: new Set(),
        cohortHits: 0,
      };
      groups.set(key, group);
    }
    group.recipients.add(row.userId);
    if (row.audience) group.audiences.add(row.audience);
    if (normalizeCohortId(row.cohort) === cohort) group.cohortHits += 1;
    if (row.createdAt && row.createdAt < group.createdAt) group.createdAt = row.createdAt;
  }

  return [...groups.values()]
    .filter((group) => {
      if (ownKeys.has(announcementContentKey(group.title, group.message))) return false;
      if (group.audiences.has("all")) return true;
      if (group.audiences.has("cohort") && group.cohortHits > 0) return true;
      return group.cohortHits >= 2;
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((group) => ({
      title: group.title,
      message: group.message,
      createdAt: group.createdAt,
    }));
}
