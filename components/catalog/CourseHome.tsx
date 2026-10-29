import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import { catalogHref, courseClassroomHref, type LmsCourse } from "@/lib/lms-catalog";
import type { LmsFront } from "@/lib/lms-hosts";

export default function CourseHome({ course, front = "class" }: { course: LmsCourse; front?: LmsFront }) {
  const homeHref = catalogHref(front);
  const classroom = courseClassroomHref(course, front);
  return (
    <div className="sales-page catalog-page">
      <header className="topbar sales-topbar">
        <BrandMark href={homeHref} title="Accounting Study Advice" subtitle="Courses" />
        <Link className="ghost" href="/login">
          Log in
        </Link>
      </header>

      <section className="catalog-hero">
        <p className="sales-badge">{course.status === "live" ? "Live course" : "Import ready"}</p>
        <h1>{course.title}</h1>
        <p className="lead">{course.summary}</p>
        <div className="catalog-card-actions">
          <Link className="primary" href={classroom}>
            {course.status === "live" ? "Enter classroom" : "Open classroom"}
          </Link>
          <Link className="ghost" href={homeHref}>
            All courses
          </Link>
        </div>
      </section>
    </div>
  );
}
