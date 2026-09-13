import { formatInboxTime, messageLabel, type InboxMessage, type InboxRole } from "@/lib/inbox";

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
          {message.body}
          <div className="muted small">
            {formatInboxTime(message.createdAt)} · {messageLabel(message, viewer)}
            {message.context ? ` · ${message.context}` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}
