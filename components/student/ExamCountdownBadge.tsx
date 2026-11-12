import { JOURNAL_EXAM_LABEL } from "@/lib/study-journal";

export default function ExamCountdownBadge({ days }: { days: number | null }) {
  const count = days == null ? "—" : String(Math.max(0, days));
  const caption =
    days == null ? "Exam date coming soon." : days < 0 ? "Exam date has passed." : days === 0 ? "Exam day." : `${days} day${days === 1 ? "" : "s"} left`;
  return (
    <div className="journal-exam-badge" title={`Countdown to exam · ${JOURNAL_EXAM_LABEL}`}>
      <span className="journal-exam-cal" aria-hidden="true">
        <span className="journal-exam-cal-rings" />
        <span className="journal-exam-cal-num">{count}</span>
      </span>
      <span className="journal-exam-tags" aria-hidden="true">
        <span>Days</span>
        <span>Left</span>
      </span>
      <span className="visually-hidden">
        {caption} Exam {JOURNAL_EXAM_LABEL}.
      </span>
    </div>
  );
}
