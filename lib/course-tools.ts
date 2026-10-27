export type CourseTool = {
  id: string;
  title: string;
  description: string;
  href: string;
  editable: boolean;
};

export const COURSE_TOOLS: CourseTool[] = [
  {
    id: "reading",
    title: "Reading & RTFQ Tool",
    description: "Dashboard practice hub after Task 2. Edit the built-in drills and extra questions here.",
    href: "/coach/tools/reading",
    editable: true,
  },
  {
    id: "study-clinic",
    title: "Study Clinic",
    description: "Common Fixes videos on the student Study Clinic page. Edit the bank here, not in Course content.",
    href: "/coach/tools/study-clinic",
    editable: true,
  },
  {
    id: "variance-bakery",
    title: "Variance Bakery",
    description: "Lesson tool for material variances. Attach it from Add a lesson — it is not a dashboard hub.",
    href: "/coach/builder#builder-lesson-tool",
    editable: false,
  },
];
