import Link from "next/link";
import type { Metadata } from "next";
import CoachCoursePreview from "@/components/coach/CoachCoursePreview";
import { fetchCourseOutline } from "@/lib/student-lesson";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Course preview · IAC Skills Course",
};

export default async function CoachPreviewPage() {
  const outline = await fetchCourseOutline();

  return (
    <div className="coach-page">
      <Link className="back-link" href="/coach">
        ← Coach home
      </Link>
      <CoachCoursePreview outline={outline} />
    </div>
  );
}
