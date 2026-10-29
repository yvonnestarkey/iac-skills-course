import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import { LMS_COURSES, catalogHref, courseClassroomHref, coursePublicHref, type LmsCourse } from "@/lib/lms-catalog";
import type { LmsFront } from "@/lib/lms-hosts";

function statusLabel(course: LmsCourse) {
  return course.status === "live" ? "Live" : "Import ready";
}

export default function CourseCatalog({ front = "class" }: { front?: LmsFront }) {
  const home = catalogHref(front);
  return (
    <div className="sales-page catalog-page">
      <header className="topbar sales-topbar">
        <BrandMark href={home} title="Accounting Study Advice" subtitle="Courses" />
        <Link className="ghost" href="/login">
          Log in
        </Link>
      </header>

      <section className="catalog-hero">
        <p className="sales-badge">Accounting Study Advice</p>
        <h1>Courses</h1>
        <p className="lead">
          IAC Skills lives on iac.accountingstudyadvice.com. The other classrooms stay here — for example
          /auditrisk — and fill in when their Thinkific content is imported.
        </p>
      </section>

      <section className="catalog-grid" aria-label="Course list">
        {LMS_COURSES.map((course) => {
          const href = coursePublicHref(course, front);
          const enter = courseClassroomHref(course, front);
          return (
            <article key={course.id} className="card catalog-card">
              <p className="kicker">{statusLabel(course)}</p>
              <h2>{course.title}</h2>
              <p className="muted">{course.summary}</p>
              <div className="catalog-card-actions">
                <Link className="primary" href={href}>
                  {course.id === "iac-skills" ? "Open IAC Skills" : "View course"}
                </Link>
                <Link className="ghost" href={enter}>
                  {course.status === "live" ? "Enter classroom" : "Open classroom"}
                </Link>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
