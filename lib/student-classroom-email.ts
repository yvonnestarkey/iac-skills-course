import { firstNameFromFullName, inviteGreeting, inviteLogoUrl } from "@/lib/invite-email";
import { sendResendEmail } from "@/lib/resend";

export const CLASSROOM_COURSE_NAME = "January 2027 IAC Skills Course";

export type ClassroomEmailKind = "announcement" | "message" | "assignment_feedback" | "script_evaluation";

export type ClassroomEmailRecipient = {
  email: string;
  name?: string | null;
  userId?: string | null;
  recordId?: string | null;
  attemptId?: string | null;
};

export type ClassroomEmailBatch = {
  kind: ClassroomEmailKind;
  title: string;
  message: string;
  recipients: ClassroomEmailRecipient[];
  origin?: string;
};

const KIND_COPY: Record<
  ClassroomEmailKind,
  { subjectPrefix: string; intro: string; cta: string; fallbackTitle: string }
> = {
  announcement: {
    subjectPrefix: "",
    intro: `Yvonne sent you a notification in the ${CLASSROOM_COURSE_NAME} classroom.`,
    cta: "Open this notification",
    fallbackTitle: "Course notification",
  },
  message: {
    subjectPrefix: "New message: ",
    intro: `Yvonne sent you a message in the ${CLASSROOM_COURSE_NAME} classroom.`,
    cta: "Open this message",
    fallbackTitle: "Message from your coach",
  },
  assignment_feedback: {
    subjectPrefix: "",
    intro: `Yvonne sent you assignment feedback in the ${CLASSROOM_COURSE_NAME} classroom.`,
    cta: "Open your feedback",
    fallbackTitle: "Assignment feedback",
  },
  script_evaluation: {
    subjectPrefix: "",
    intro: `Your script evaluation in the ${CLASSROOM_COURSE_NAME} classroom is ready.`,
    cta: "Open your evaluation",
    fallbackTitle: "Your script evaluation is ready",
  },
};

export function classroomOrigin(origin?: string | null): string {
  return (origin || process.env.NEXT_PUBLIC_SITE_URL || "https://iac.accountingstudyadvice.com").replace(/\/$/, "");
}

export function classroomPath(
  kind: ClassroomEmailKind,
  opts?: { id?: string | null; attemptId?: string | null }
): string {
  if (kind === "message") return "/student/inbox";
  if (kind === "assignment_feedback") return "/student/feedback";
  if (kind === "script_evaluation") {
    return opts?.attemptId
      ? `/student/evaluator/attempt/${encodeURIComponent(opts.attemptId)}/submitted`
      : "/student/evaluator";
  }
  return opts?.id ? `/student/notifications/${encodeURIComponent(opts.id)}` : "/student/notifications";
}

export function classroomUrl(
  kind: ClassroomEmailKind,
  opts?: { id?: string | null; attemptId?: string | null; origin?: string | null }
): string {
  return `${classroomOrigin(opts?.origin)}${classroomPath(kind, opts)}`;
}

export function classroomEmailSubject(kind: ClassroomEmailKind, title?: string | null): string {
  const copy = KIND_COPY[kind];
  const heading = (title || "").trim() || copy.fallbackTitle;
  if (kind === "announcement" || kind === "assignment_feedback" || kind === "script_evaluation") return heading;
  return `${copy.subjectPrefix}${heading}`;
}

export function classroomEmailIdempotencyKey(
  kind: ClassroomEmailKind,
  recipient: Pick<ClassroomEmailRecipient, "email" | "recordId">
): string {
  const recordId = (recipient.recordId || "").trim();
  if (recordId) return `iac-classroom-${kind}-${recordId}`.slice(0, 256);
  return `iac-classroom-${kind}-${recipient.email.trim().toLowerCase()}`.slice(0, 256);
}

export function absoluteClassroomHref(href: string, origin?: string | null): string {
  const trimmed = href.trim();
  if (!trimmed) return classroomOrigin(origin);
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${classroomOrigin(origin)}${path}`;
}

export function classroomPreviewText(message: string, origin?: string | null): string {
  return message.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, href: string) => {
    return `${label} (${absoluteClassroomHref(href, origin)})`;
  });
}

export function scriptEvaluationPreview(input: {
  paperName: string;
  headline?: string | null;
  takeaways?: string[] | null;
  actionPlan?: string[] | null;
  fullReport?: string | null;
}): string {
  const paper = input.paperName.trim() || "your script";
  const lines = [`Your script evaluation for ${paper} is ready.`];
  const headline = (input.headline || "").trim();
  if (headline) lines.push(headline);
  const takeaways = (input.takeaways || []).map((item) => item.trim()).filter(Boolean);
  if (takeaways.length) {
    lines.push(["Key takeaways:", ...takeaways.map((item) => `• ${item}`)].join("\n"));
  }
  const actions = (input.actionPlan || []).map((item) => item.trim()).filter(Boolean);
  if (actions.length) {
    lines.push(["What to do next:", ...actions.map((item) => `• ${item}`)].join("\n"));
  }
  const report = (input.fullReport || "").trim();
  if (report) lines.push(report.length > 6000 ? `${report.slice(0, 6000)}\n\n…` : report);
  return lines.join("\n\n");
}

export function buildClassroomEmail(input: {
  kind: ClassroomEmailKind;
  title: string;
  message: string;
  href: string;
  studentName?: string | null;
  origin?: string | null;
}): { subject: string; text: string; html: string } {
  const copy = KIND_COPY[input.kind];
  const title = input.title.trim() || copy.fallbackTitle;
  const origin = classroomOrigin(input.origin);
  const href = absoluteClassroomHref(input.href, origin);
  const greeting = inviteGreeting(firstNameFromFullName(input.studentName || ""));
  const preview = classroomPreviewText(input.message.trim() || title, origin);
  const subject = classroomEmailSubject(input.kind, title);
  const text = [
    greeting,
    "",
    copy.intro,
    "",
    title,
    "",
    preview,
    "",
    `${copy.cta}: ${href}`,
    "",
    `You can also open this in the ${CLASSROOM_COURSE_NAME} classroom after you sign in.`,
    "",
    "Yvonne",
    "Accounting Study Advice",
  ].join("\n");

  const html = [
    `<!doctype html><html lang="en"><body style="margin:0;padding:0;background:#eef3f1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#000000;">`,
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef3f1;padding:24px 12px;"><tr><td align="center">`,
    `<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="width:560px;max-width:100%;background:#ffffff;border-radius:16px;">`,
    `<tr><td align="left" style="padding:28px 24px 20px 24px;"><img src="${inviteLogoUrl(origin)}" width="120" height="120" alt="Accounting Study Advice" style="display:block;border:0;width:120px;height:120px;" /></td></tr>`,
    `<tr><td style="padding:0 24px 16px 24px;font-size:24px;line-height:1.3;font-weight:700;">${escapeHtml(title)}</td></tr>`,
    `<tr><td style="padding:0 24px 14px 24px;font-size:16px;line-height:1.55;">${escapeHtml(greeting)}</td></tr>`,
    `<tr><td style="padding:0 24px 14px 24px;font-size:16px;line-height:1.55;">${escapeHtml(copy.intro)}</td></tr>`,
    `<tr><td style="padding:0 24px 22px 24px;font-size:16px;line-height:1.55;background:#ffffff;"><div style="background:#f6f8f7;border-radius:12px;padding:16px;">${previewHtml(preview)}</div></td></tr>`,
    `<tr><td style="padding:0 24px 22px 24px;"><a href="${escapeHtml(href)}" style="display:inline-block;background:#990f49;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:12px 20px;border-radius:10px;">${escapeHtml(copy.cta)}</a></td></tr>`,
    `<tr><td style="padding:0 24px 28px 24px;font-size:16px;line-height:1.55;">You can also open this in the ${escapeHtml(CLASSROOM_COURSE_NAME)} classroom after you sign in.<br /><br />Yvonne<br />Accounting Study Advice</td></tr>`,
    `</table></td></tr></table></body></html>`,
  ].join("");

  return { subject, text, html };
}

export async function sendClassroomEmails(
  input: ClassroomEmailBatch,
  sendEmail: typeof sendResendEmail = sendResendEmail,
  env: Record<string, string | undefined> = process.env
): Promise<{ sent: number; failed: number }> {
  const recipients = input.recipients.filter((recipient) => recipient.email.includes("@"));
  if (!recipients.length) return { sent: 0, failed: 0 };

  const origin = classroomOrigin(input.origin);
  const results = await Promise.allSettled(
    recipients.map((recipient) => {
      const href = classroomUrl(input.kind, {
        id: recipient.recordId,
        attemptId: recipient.attemptId,
        origin,
      });
      const email = buildClassroomEmail({
        kind: input.kind,
        title: input.title,
        message: input.message,
        href,
        studentName: recipient.name,
        origin,
      });
      return sendEmail(
        {
          to: recipient.email.trim(),
          subject: email.subject,
          text: email.text,
          html: email.html,
          idempotencyKey: classroomEmailIdempotencyKey(input.kind, recipient),
        },
        env
      );
    })
  );

  let sent = 0;
  let failed = 0;
  results.forEach((result) => {
    if (result.status === "fulfilled") sent += 1;
    else {
      failed += 1;
      console.error("classroom-email", result.reason);
    }
  });
  return { sent, failed };
}

export async function requestClassroomEmails(input: ClassroomEmailBatch): Promise<void> {
  try {
    if (typeof window === "undefined") {
      await sendClassroomEmails(input);
      return;
    }
    const response = await fetch("/api/classroom/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || `Classroom email failed (${response.status}).`);
    }
  } catch (error) {
    console.error("classroom-email", error);
  }
}

function previewHtml(preview: string): string {
  return preview
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((paragraph, index, all) => {
      const margin = index === all.length - 1 ? "0" : "0 0 12px 0";
      return `<p style="margin:${margin};">${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`;
    })
    .join("");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
