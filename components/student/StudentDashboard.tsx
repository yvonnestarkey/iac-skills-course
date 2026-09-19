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

export default function StudentDashboard() {
  const { user, outline, completed, surveyReviews } = useStudentSession();
  const { unlocked, basePath } = useCoursePreview();
  const { inboxWaiting, unreadCount } = useStudentInbox();
  const [coachingUnseen, setCoachingUnseen] = useState(false);
  const chapters = outline || [];
  const lessons = chapters.flatMap((chapter) => chapter.lessons || []);
  const done = lessons.filter((lesson) => completed?.[lesson.id]).length;
  const pct = lessons.length ? Math.round((done / lessons.length) * 100) : 0;
  const name = unlocked ? "Coach" : user?.email ? user.email.split("@")[0] : "there";
  const ordered = splitCoursePhases(chapters).flatMap((phase) => phase.chapters || []);
  const resume = findResumeLesson(ordered, completed || {});
  const allDone = lessons.length > 0 && done === lessons.length;
  const inboxHref = unlocked ? "/coach/inbox" : "/student/inbox";
  const notifyHref = unlocked ? "/coach/notifications" : "/student/notifications";
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

      <nav className="student-hub" aria-label="Student shortcuts">
        {unlocked ? null : (
          <>
            <Link href="/student/evaluator" className="student-hub-card">
              <strong>Script Evaluator</strong>
              <p>Choose a past paper, then work through BMCR, Volume vs Accuracy, Buried Treasure, and the AI mark report.</p>
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
          </>
        )}
        <Link href={`${basePath}/overview`} className="student-hub-card">
          <strong>Course Overview</strong>
          <p>
            {unlocked
              ? "Browse every section and task with no student access gates."
              : "Browse every section and task, including locked upcoming titles."}
          </p>
        </Link>
        {unlocked ? null : (
          <>
            <Link href="/student/feedback" className="student-hub-card">
              <strong>Survey & assignment feedback</strong>
              <p>See every submission, grade, and coach comment in one place.</p>
              {feedbackCount ? <span className="pill">{feedbackCount} with feedback</span> : null}
            </Link>
          </>
        )}
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
        {unlocked ? null : (
          <Link href="/student/planner" className="student-hub-card">
            <strong>Study planner</strong>
            <p>Set your hours, slots, and target finish date.</p>
          </Link>
        )}
      </nav>
      {unlocked ? null : <StudentPersonalNotes />}
    </article>
  );
}
