import type { Metadata } from "next";
import StudentStudyJournal from "@/components/student/StudentStudyJournal";

export const metadata: Metadata = {
  title: "Study Journal · IAC Skills Course",
};

export default function StudentStudyJournalPage() {
  return (
    <article className="lesson-body wide">
      <StudentStudyJournal />
    </article>
  );
}
