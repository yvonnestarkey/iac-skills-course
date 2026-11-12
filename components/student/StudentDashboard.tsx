"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import StudentDashboardBanner from "@/components/student/StudentDashboardBanner";
import StudentDashboardQuote from "@/components/student/StudentDashboardQuote";
import StudentDashboardSlide from "@/components/student/StudentDashboardSlide";
import StudentStudyJournal from "@/components/student/StudentStudyJournal";
import StudentAssignmentFeedback from "@/components/student/StudentAssignmentFeedback";
import StudentPersonalNotes from "@/components/student/StudentPersonalNotes";
import StudentReadingPractice from "@/components/student/StudentReadingPractice";
import StudentTaskDueDates from "@/components/student/StudentTaskDueDates";
import StudentUpcomingEvents from "@/components/student/StudentUpcomingEvents";
import { fetchCoachingDashboardHint } from "@/lib/coaching";
import { courseStudyMinutes, estimateCourseFinish, fetchStudentStartedOn } from "@/lib/course-pace";
import { findResumeLesson, splitCoursePhases } from "@/lib/course-phases";
import { portalToday } from "@/lib/student-task-due-dates";
import { useCoursePreview } from "@/lib/course-preview";
import { useStudentInbox } from "@/lib/use-student-inbox";
import { useStudentSession } from "@/lib/student-session";
import { useVisibleCourseOutline } from "@/lib/visible-course-outline";
import PurchaseCta from "@/components/commerce/PurchaseCta";
import { ASK_QUESTION_ENABLED } from "@/lib/ask-question";
import { isCoachAccount } from "@/lib/roles";

export default function StudentDashboard() {
  const { user, completed } = useStudentSession();
  const outline = useVisibleCourseOutline();
  const { unlocked, basePath } = useCoursePreview();
  const { inboxWaiting, unreadCount } = useStudentInbox();
  const [coachingUnseen, setCoachingUnseen] = useState(false);
  const [startedOn, setStartedOn] = useState<string | null>(null);
  const [paceReady, setPaceReady] = useState(false);
  const chapters = outline || [];
  const lessons = chapters.flatMap((chapter) => chapter.lessons || []);
  const done = lessons.filter((lesson) => completed?.[lesson.id]).length;
  const pct = lessons.length ? Math.round((done / lessons.length) * 100) : 0;
  const name = user?.full_name?.trim() || (user?.email ? user.email.split("@")[0] : unlocked ? "Coach" : "there");
  const ordered = splitCoursePhases(chapters).flatMap((phase) => phase.chapters || []);
  const resume = findResumeLesson(ordered, completed || {});
  const allDone = lessons.length > 0 && done === lessons.length;
  const study = courseStudyMinutes(lessons, completed);
  const pace = estimateCourseFinish({
    today: portalToday(),
    startedOn,
    totalMinutes: study.total,
    doneMinutes: study.done,
  });
  const resumeHref = resume?.lesson ? `${basePath}/${resume.lesson.id}` : `${basePath}/overview`;
  const resumeLabel = allDone ? "Review last lesson" : done ? "Resume Course" : "Start Course";
  const inboxHref = "/student/inbox";
  const notifyHref = "/student/notifications";
  const coach = isCoachAccount(user);

  useEffect(() => {
    if (!user?.id) return;
    void fetchStudentStartedOn(user.id).then((value) => {
      setStartedOn(value);
      setPaceReady(true);
    });
    if (unlocked) return;
    fetchCoachingDashboardHint(user.id).then((hint) => setCoachingUnseen(hint.unseenDeliverables));
  }, [user?.id, unlocked]);

  return (
    <article className="lesson-body wide student-dash">
      <StudentDashboardBanner
        name={name}
        resumeHref={resumeHref}
        resumeLabel={resumeLabel}
        pct={pct}
        paceMessage={paceReady ? pace.message : ""}
      />
      <StudentDashboardQuote />
      <StudentDashboardSlide />
      <div className="student-dash-tiles">
        <StudentStudyJournal compact />
        <StudentUpcomingEvents />
        <StudentTaskDueDates />
        <StudentReadingPractice />
        <StudentAssignmentFeedback />
      </div>

      {unlocked ? null : <PurchaseCta />}

      <nav className="student-hub-buttons" aria-label="Student shortcuts">
        <Link href="/student/evaluator" className="student-hub-btn is-dark">
          <strong>Script Evaluator</strong>
          <p>Print a BMCR and upload your papers after Task 1.</p>
        </Link>
        {ASK_QUESTION_ENABLED ? (
          <button type="button" className="student-hub-btn is-medium" onClick={() => window.dispatchEvent(new Event("open-ask-question"))}>
            <strong>Ask a Question</strong>
            <p>24/7 IAC exam and skills help.</p>
          </button>
        ) : null}
        <Link href="/student/coaching" className="student-hub-btn is-sand">
          <strong>1-on-1 Coaching</strong>
          <p>Book a session or open summaries.</p>
          {coachingUnseen ? <span className="pill">Summary ready</span> : null}
        </Link>
        <Link href={`${basePath}/overview`} className="student-hub-btn is-link">
          <strong>Course Overview</strong>
          <p>Every section and task.</p>
        </Link>
        <Link href={inboxHref} className="student-hub-btn is-dark">
          <strong>Inbox</strong>
          <p>Questions and replies.</p>
          {inboxWaiting ? <span className="pill">New reply</span> : null}
        </Link>
        <Link href={notifyHref} className="student-hub-btn is-medium">
          <strong>Notifications</strong>
          <p>Course announcements.</p>
          {unreadCount ? <span className="pill">{unreadCount} unread</span> : null}
        </Link>
        <Link href="/student/planner" className="student-hub-btn is-sand">
          <strong>Study planner</strong>
          <p>Hours, slots, and finish date.</p>
        </Link>
        <Link href="/student/account" className="student-hub-btn is-link">
          <strong>Your profile</strong>
          <p>Name, email, and contacts.</p>
        </Link>
      </nav>
      <StudentPersonalNotes />

      {coach ? (
        <nav className="student-hub-coach" aria-label="Coach">
          <p className="kicker">Coach</p>
          <div className="student-hub-buttons">
            <Link href="/coach" className="student-hub-btn is-dark">
              <strong>Coach tools</strong>
              <p>Referrals, students, and admin.</p>
            </Link>
            <Link href="/coach/referrals" className="student-hub-btn is-medium">
              <strong>Referrals</strong>
              <p>Successful student referrals.</p>
            </Link>
            <Link href="/coach/students/new" className="student-hub-btn is-sand">
              <strong>Add Student</strong>
              <p>Invite preview or full access.</p>
            </Link>
            <Link href="/coach/lists" className="student-hub-btn is-link">
              <strong>Students</strong>
              <p>Roster, submissions, and BMCR.</p>
            </Link>
          </div>
        </nav>
      ) : null}
    </article>
  );
}
