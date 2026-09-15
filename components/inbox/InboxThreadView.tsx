import { formatInboxTime, messageLabel, type InboxMessage, type InboxRole } from "@/lib/inbox";
import LinkedText from "@/components/ui/LinkedText";

export default function InboxThreadView({
  messages,
  viewer,
  empty = "No messages yet.",
}: {
  messages: InboxMessage[];
  viewer: InboxRole;
  empty?: string;
}) {
  if (!messages.length) return <p className="empty">{empty}</p>;

  return (
    <div className="thread">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`bubble ${message.from} ${message.kind === "question" ? "question" : ""} ${
            message.kind === "feedback" ? "feedback" : ""
          }`}
        >
          <LinkedText text={message.body} />
          <div className="muted small">
            {formatInboxTime(message.createdAt)} · {messageLabel(message, viewer)}
            {message.context ? ` · ${message.context}` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}
