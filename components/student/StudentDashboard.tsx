"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import StudentDashboardBanner from "@/components/student/StudentDashboardBanner";
import StudentPersonalNotes from "@/components/student/StudentPersonalNotes";
import { fetchCoachingDashboardHint } from "@/lib/coaching";
import { findResumeLesson, splitCoursePhases } from "@/lib/course-phases";
import { useCoursePreview } from "@/lib/course-preview";
import { hasCoachReview } from "@/lib/custom-surveys";
import { useStudentInbox } from "@/lib/use-student-inbox";
import { useStudentSession } from "@/lib/student-session";
import PurchaseCta from "@/components/commerce/PurchaseCta";
import { isCoachAccount } from "@/lib/roles";

export default function StudentDashboard() {
  const { user, outline, completed, surveyReviews } = useStudentSession();
  const { unlocked, basePath } = useCoursePreview();
  const { inboxWaiting, unreadCount } = useStudentInbox();
  const [coachingUnseen, setCoachingUnseen] = useState(false);
  const chapters = outline || [];
  const lessons = chapters.flatMap((chapter) => chapter.lessons || []);
  const done = lessons.filter((lesson) => completed?.[lesson.id]).length;
  const pct = lessons.length ? Math.round((done / lessons.length) * 100) : 0;
  const name = user?.email ? user.email.split("@")[0] : unlocked ? "Coach" : "there";
  const ordered = splitCoursePhases(chapters).flatMap((phase) => phase.chapters || []);
  const resume = findResumeLesson(ordered, completed || {});
  const allDone = lessons.length > 0 && done === lessons.length;
  const inboxHref = "/student/inbox";
  const notifyHref = "/student/notifications";
  const coach = isCoachAccount(user);
  const feedbackCount = Object.values(surveyReviews || {}).filter(hasCoachReview).length;

  useEffect(() => {
    if (!user?.id || unlocked) return;
    fetchCoachingDashboardHint(user.id).then((hint) => setCoachingUnseen(hint.unseenDeliverables));
  }, [user?.id, unlocked]);

  return (
    <article className="lesson-body wide student-dash">
      <StudentDashboardBanner />
      <p className="kicker">Student dashboard</p>
      <h1>Welcome back, {name}</h1>
      <div className="student-progress-row">
        <strong className="student-progress-pct">{pct}% Complete</strong>
        <div className="student-progress" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>

      {resume?.lesson && resume.chapter ? (
        <section className="resume-banner">
          <div>
            <p className="kicker">{allDone ? "Course complete" : "Resume course"}</p>
            <strong>{resume.lesson.title}</strong>
            <p className="muted small">{resume.chapter.title}</p>
          </div>
          <Link className="primary" href={`${basePath}/${resume.lesson.id}`}>
            {allDone ? "Review last lesson" : done ? "Resume Course" : "Start Course"}
          </Link>
        </section>
      ) : null}

      {unlocked ? null : <PurchaseCta />}

      {coach ? (
        <nav className="student-hub" aria-label="Coach tools">
          <p className="kicker" style={{ width: "100%" }}>
            Coach tools
          </p>
          <Link href="/coach" className="student-hub-card">
            <strong>Coach tools</strong>
            <p>Waitlist, Add Student, student lists, payments, and course admin.</p>
          </Link>
          <Link href="/coach/waitlist" className="student-hub-card">
            <strong>Waitlist</strong>
            <p>See who is waiting and send one invitation at a time.</p>
          </Link>
          <Link href="/coach/students/new" className="student-hub-card">
            <strong>Add Student</strong>
            <p>Invite someone to free preview or complimentary full access.</p>
          </Link>
          <Link href="/coach/lists" className="student-hub-card">
            <strong>Students</strong>
            <p>Roster, submissions, surveys, and BMCR analytics.</p>
          </Link>
        </nav>
      ) : null}

      <nav className="student-hub" aria-label="Student shortcuts">
        <Link href="/student/evaluator" className="student-hub-card">
          <strong>Script Evaluator</strong>
          <p>After Task 1, choose a sitting, print one BMCR for all three papers, then upload that worksheet with each exam script and marking report.</p>
        </Link>
        <button type="button" className="student-hub-card" onClick={() => window.dispatchEvent(new Event("open-ask-question"))}>
          <strong>Ask a Question</strong>
          <p>24/7 IAC Exam &amp; Skills Facilitator. Ask about a required, a mark leak, or how to use the study tools.</p>
        </button>
        <Link href="/student/coaching" className="student-hub-card">
          <strong>1-on-1 Coaching</strong>
          <p>Book a private session or access your meeting summaries and recordings.</p>
          {coachingUnseen ? <span className="pill">Meeting Summary & Recording Available</span> : null}
        </Link>
        <Link href="/student/events" className="student-hub-card">
          <strong>Live Sessions & Events</strong>
          <p>Join upcoming live calls, download calendar invites, and view past recordings.</p>
        </Link>
        <Link href={`${basePath}/overview`} className="student-hub-card">
          <strong>Course Overview</strong>
          <p>Browse every section and task, including locked upcoming titles.</p>
        </Link>
        <Link href="/student/feedback" className="student-hub-card">
          <strong>Survey & assignment feedback</strong>
          <p>See every submission, grade, and coach comment in one place.</p>
          {feedbackCount ? <span className="pill">{feedbackCount} with feedback</span> : null}
        </Link>
        <Link href={inboxHref} className="student-hub-card">
          <strong>Inbox</strong>
          <p>Questions and replies with your coach.</p>
          {inboxWaiting ? <span className="pill">New reply</span> : null}
        </Link>
        <Link href={notifyHref} className="student-hub-card">
          <strong>Notifications</strong>
          <p>Course announcements and coach notes.</p>
          {unreadCount ? <span className="pill">{unreadCount} unread</span> : null}
        </Link>
        <Link href="/student/planner" className="student-hub-card">
          <strong>Study planner</strong>
          <p>Set your hours, slots, and target finish date.</p>
        </Link>
      </nav>
      <StudentPersonalNotes />
    </article>
  );
}
