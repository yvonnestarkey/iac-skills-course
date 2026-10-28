import LinkedText from "@/components/ui/LinkedText";
import { formatSastDateTime } from "@/lib/dates";
import { parseFeedbackLog, type FeedbackLogEntry } from "@/lib/feedback-log";

export default function FeedbackLog({
  raw,
  entries,
  empty = "No written feedback yet.",
}: {
  raw?: string | null;
  entries?: FeedbackLogEntry[];
  empty?: string;
}) {
  const log = entries || parseFeedbackLog(raw);
  if (!log.length) return <p className="muted small">{empty}</p>;
  const dated = log.length > 1;
  return (
    <div className="feedback-log">
      {log.map((entry, index) => (
        <article className="feedback-log-entry" key={`${entry.at}-${index}`}>
          {dated ? (
            <p className="muted small">{entry.at ? formatSastDateTime(entry.at) || "Follow-up" : "Original comments"}</p>
          ) : null}
          <div className="feedback-log-body">
            <LinkedText text={entry.text} />
          </div>
        </article>
      ))}
    </div>
  );
}
