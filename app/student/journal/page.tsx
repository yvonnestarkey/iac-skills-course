import type { Metadata } from "next";
import Link from "next/link";
import StudentStudyJournal from "@/components/student/StudentStudyJournal";

export const metadata: Metadata = {
  title: "Study Journal · IAC Skills Course",
};

export default function StudentStudyJournalPage() {
  return (
    <article className="lesson-body wide">
      <p>
        <Link href="/student/dashboard">← Student dashboard</Link>
      </p>
      <StudentStudyJournal />
    </article>
  );
}
