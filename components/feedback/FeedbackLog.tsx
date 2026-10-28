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
  return (
    <ol className="feedback-log">
      {log.map((entry, index) => (
        <li key={`${entry.at}-${index}`}>
          {entry.at ? (
            <p className="muted small">{formatSastDateTime(entry.at) || entry.at}</p>
          ) : (
            <p className="muted small">Earlier feedback</p>
          )}
          <p>
            <LinkedText text={entry.text} />
          </p>
        </li>
      ))}
    </ol>
  );
}
