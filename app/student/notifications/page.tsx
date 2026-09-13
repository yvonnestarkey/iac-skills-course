"use client";

import InboxThreadView from "@/components/inbox/InboxThreadView";
import { useStudentInbox } from "@/lib/use-student-inbox";

export default function StudentNotificationsPage() {
  const { notifications } = useStudentInbox();

  return (
    <article className="lesson-body wide">
      <p className="kicker">Course notifications</p>
      <h1>Notifications</h1>
      <p className="lead">Assignment feedback and notes from your coach appear here.</p>
      <InboxThreadView
        messages={notifications}
        viewer="student"
        empty="No notifications yet. When your coach leaves feedback, it will show here."
      />
    </article>
  );
}
