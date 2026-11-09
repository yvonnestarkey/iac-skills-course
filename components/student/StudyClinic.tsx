"use client";

import Link from "next/link";
import { STUDY_CLINIC_SECTIONS, studyClinicSectionHref } from "@/lib/study-clinic";

export default function StudyClinic() {
  return (
    <article className="lesson-body wide">
      <p>
        <Link href="/student/dashboard">← Student dashboard</Link>
      </p>
      <p className="kicker">Study Clinic</p>
      <h1>Study Clinic</h1>
      <p className="lead">A library of short videos, grouped by subject. Open the area you need.</p>
      <nav className="study-clinic-cards" aria-label="Study Clinic libraries">
        {STUDY_CLINIC_SECTIONS.map((section) => (
          <Link key={section.id} className="study-clinic-card" href={studyClinicSectionHref(section.id)}>
            <img src={section.image} alt={section.title} />
            <span className="visually-hidden">{section.title}</span>
          </Link>
        ))}
      </nav>
    </article>
  );
}
