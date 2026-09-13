import type { Metadata } from "next";
import StudyPlanner from "@/components/student/StudyPlanner";

export const metadata: Metadata = {
  title: "Study planner · IAC Skills Course",
};

export default function StudentPlannerPage() {
  return (
    <article className="lesson-body wide">
      <p className="kicker">Study planner</p>
      <h1>Your study schedule</h1>
      <p className="lead">Set your start date, weekly hours, and study slots. We date the rest of the course from there.</p>
      <StudyPlanner />
    </article>
  );
}
