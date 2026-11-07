import { classroomOrigin } from "@/lib/student-classroom-email";
import { REGISTRATION_CONTACT_EMAIL } from "@/lib/sales-copy";

export const STUDENT_INBOX_NOTIFY_TO = REGISTRATION_CONTACT_EMAIL;

export function shouldNotifyCoachOfStudentMessage(email?: string | null): boolean {
  return !String(email || "").toLowerCase().includes("@test");
}

export function studentInboxNotifySubject(studentName: string): string {
  const name = studentName.trim() || "Student";
  return `New student message — ${name}`;
}

export function studentInboxNotifyKey(messageId: string): string {
  return `student-inbox-${String(messageId || "").trim()}`.slice(0, 256);
}

export function studentInboxNotifyHref(origin?: string | null): string {
  return `${classroomOrigin(origin)}/coach/inbox`;
}

export function buildStudentInboxNotifyEmail(input: {
  studentName: string;
  studentEmail: string;
  body: string;
  context?: string | null;
  origin?: string | null;
}): { subject: string; text: string; html: string } {
  const studentName = input.studentName.trim() || "Student";
  const studentEmail = input.studentEmail.trim();
  const context = String(input.context || "").trim();
  const body = input.body.trim();
  const href = studentInboxNotifyHref(input.origin);
  const subject = studentInboxNotifySubject(studentName);
  const lines = [
    `Student name: ${studentName}`,
    `Student email: ${studentEmail}`,
    ...(context ? [`Context: ${context}`] : []),
    "",
    body,
    "",
    `Open inbox: ${href}`,
  ];
  const text = lines.join("\n");
  const html = `<p>${lines
    .map((line) => line.replace(/&/g, "&amp;").replace(/</g, "&lt;"))
    .join("<br />")}</p>`;
  return { subject, text, html };
}
