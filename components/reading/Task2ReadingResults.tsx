import Link from "next/link";
import type { DrillAttempt, ReadingCheckResult } from "@/lib/reading-drills";
import {
  findTask2ReadingLessons,
  task2MopaneResult,
  task2MopaneSummary,
  task2ReadingCheckResult,
  task2ReadingCheckSummary,
} from "@/lib/task2-gate";
import type { OutlineChapter } from "@/lib/student-lesson";

export default function Task2ReadingResults({
  outline,
  attempts,
  checks,
  compact = false,
  links = true,
}: {
  outline?: OutlineChapter[] | null;
  attempts: DrillAttempt[];
  checks: ReadingCheckResult[];
  compact?: boolean;
  links?: boolean;
}) {
  const lessons = findTask2ReadingLessons(outline);
  const check = task2ReadingCheckResult(checks);
  const mopane = task2MopaneResult(attempts);
  const checkTitle = lessons.check?.title || "Reading check (Skimming)";
  const mopaneTitle = lessons.mopane?.title || "Mopane";

  return (
    <ul className={`task2-reading-results${compact ? " compact" : ""}`}>
      <li>
        <span>
          <b>{checkTitle}</b>
          <span className="muted small">{task2ReadingCheckSummary(check)}</span>
        </span>
        {check && links ? (
          <Link href={lessons.check ? `/student/${lessons.check.id}` : "/student/reading/check"}>
            View result
          </Link>
        ) : check ? (
          <span className="pill">Complete</span>
        ) : (
          <span className="pill">To do in Task 2</span>
        )}
      </li>
      <li>
        <span>
          <b>{mopaneTitle}</b>
          <span className="muted small">{task2MopaneSummary(mopane)}</span>
        </span>
        {mopane && links ? (
          <Link href={lessons.mopane ? `/student/${lessons.mopane.id}` : "/student/reading/mopane"}>
            View result
          </Link>
        ) : mopane ? (
          <span className="pill">Complete</span>
        ) : (
          <span className="pill">To do in Task 2</span>
        )}
      </li>
    </ul>
  );
}
