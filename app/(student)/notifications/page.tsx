"use client";

import AuditThread from "@/components/comms/AuditThread";
import { commsForStudent } from "@/lib/comms";
import { useStore } from "@/lib/store";

export default function StudentNotificationsPage() {
  const { data, student } = useStore();
  if (!student) return null;

  const inbox = commsForStudent(data, student.id);

  return (
    <article className="lesson-body wide">
      <p className="kicker">Course announcements</p>
      <h1>Notifications</h1>
      <p className="lead">Messages from your coach. Replies stay on the same thread so both of you can come back to them.</p>
      <div className="work-list">
        {inbox.length ? (
          inbox.map((comm) => (
            <AuditThread key={comm.id} comm={comm} readerId={student.id} readerRole="student" />
          ))
        ) : (
          <p className="empty">No announcements yet.</p>
        )}
      </div>
    </article>
  );
}
