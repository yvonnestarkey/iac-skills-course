export type CourseTool = {
  id: string;
  title: string;
  description: string;
  href: string;
  editable: boolean;
};

export const COURSE_TOOLS: CourseTool[] = [
  {
    id: "dashboard-posts",
    title: "Dashboard posts",
    description: "Banner announcements and the motivational slide-in students see when they open the dashboard.",
    href: "/coach/dashboard-posts",
    editable: true,
  },
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
    description: "Subject libraries on the student Study Clinic page. Add videos, PDFs, and links on each library page, or here.",
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
