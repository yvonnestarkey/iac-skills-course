import type { Metadata } from "next";
import StudentCoachThread from "@/components/student/StudentCoachThread";
import StudentInboxMarkRead from "@/components/student/StudentInboxMarkRead";

export const metadata: Metadata = {
  title: "Inbox · IAC Skills Course",
};

export default function StudentInboxPage() {
  return (
    <article className="lesson-body wide">
      <StudentInboxMarkRead />
      <p className="kicker">Inbox</p>
      <h1>Messages with your coach</h1>
      <p className="lead">Questions you send and replies from your coach stay in this thread.</p>
      <StudentCoachThread title="Your thread" />
    </article>
  );
}
