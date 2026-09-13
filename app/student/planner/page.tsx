import type { Metadata } from "next";
import StudyPlanner from "@/components/student/StudyPlanner";

export const metadata: Metadata = {
  title: "Study planner · IAC Skills Course",
};

export default function StudentPlannerPage() {
  return (
    <article className="lesson-body wide">
      <StudyPlanner />
    </article>
  );
}
