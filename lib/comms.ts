import { cohortName } from "./course";
import { nowLabel } from "./dates";
import type { Communication, CommunicationAudience, CommunicationReply, CourseData, Student } from "./types";

export function commsOf(data: CourseData): Communication[] {
  return data.communications || [];
}

export function newCommId(prefix = "n"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function commsForStudent(data: CourseData, studentId: string): Communication[] {
  return commsOf(data).filter((c) => c.recipientIds.includes(studentId));
}

export function unreadForStudent(data: CourseData, studentId: string): number {
  return commsForStudent(data, studentId).filter((c) => !c.readBy.includes(studentId)).length;
}

/** Coach unread: a student has replied and the coach has not opened it since. */
export function unreadForCoach(data: CourseData): number {
  return commsOf(data).filter((c) => {
    const last = c.replies[c.replies.length - 1];
    return last && last.from === "student" && !c.readBy.includes("coach");
  }).length;
}

export function authorName(data: CourseData, reply: CommunicationReply): string {
  if (reply.from === "coach") return "Yvonne";
  const student = data.students.find((s) => s.id === reply.authorId);
  return student ? student.name : "Student";
}

export function recipientSummary(data: CourseData, comm: Communication): string {
  if (comm.audience === "student" && comm.recipientIds.length === 1) {
    const student = data.students.find((s) => s.id === comm.recipientIds[0]);
    return student ? student.name : comm.audienceLabel;
  }
  return comm.audienceLabel;
}

export function audienceCopy(audience: CommunicationAudience, count: number): string {
  if (audience === "student") return "one student";
  if (audience === "cohort") return `${count} student${count === 1 ? "" : "s"} in this cohort`;
  if (audience === "selected") return `${count} selected student${count === 1 ? "" : "s"}`;
  if (audience === "filtered") return `${count} student${count === 1 ? "" : "s"} in this filter`;
  return `${count} student${count === 1 ? "" : "s"}`;
}

export function labelForGroup(data: CourseData, students: Student[], kind: CommunicationAudience, extra = ""): string {
  const count = `${students.length} student${students.length === 1 ? "" : "s"}`;
  if (kind === "cohort") {
    const ids = [...new Set(students.map((s) => s.cohort))];
    const name = ids.length === 1 ? cohortName(data, ids[0]) : "All cohorts";
    return `${name} · ${count}`;
  }
  if (kind === "filtered") return extra ? `${extra} · ${count}` : `Filtered group · ${count}`;
  if (kind === "selected") return `Selected · ${count}`;
  if (kind === "student" && students[0]) return students[0].name;
  return `All students · ${count}`;
}

export function postAnnouncement(
  draft: CourseData,
  input: {
    subject: string;
    body: string;
    audience: CommunicationAudience;
    audienceLabel: string;
    recipientIds: string[];
  }
): Communication {
  const comm: Communication = {
    id: newCommId(),
    subject: input.subject.trim(),
    body: input.body.trim(),
    at: nowLabel(),
    audience: input.audience,
    audienceLabel: input.audienceLabel,
    recipientIds: [...input.recipientIds],
    readBy: ["coach"],
    replies: [],
  };
  draft.communications = draft.communications || [];
  draft.communications.unshift(comm);
  return comm;
}

export function postReply(
  draft: CourseData,
  commId: string,
  from: "coach" | "student",
  authorId: string,
  text: string
): CommunicationReply | null {
  const comm = (draft.communications || []).find((c) => c.id === commId);
  if (!comm) return null;
  const reply: CommunicationReply = {
    id: newCommId("r"),
    from,
    authorId,
    text: text.trim(),
    at: nowLabel(),
  };
  comm.replies.push(reply);
  if (from === "student") comm.readBy = comm.readBy.filter((id) => id !== "coach");
  else if (!comm.readBy.includes("coach")) comm.readBy.push("coach");
  return reply;
}

export function markRead(draft: CourseData, commId: string, readerId: string) {
  const comm = (draft.communications || []).find((c) => c.id === commId);
  if (!comm) return;
  if (!comm.readBy.includes(readerId)) comm.readBy.push(readerId);
}
