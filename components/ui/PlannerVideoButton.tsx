import { STUDY_PLANNER_VIDEO_LABEL, STUDY_PLANNER_VIDEO_URL } from "@/lib/help-content";

export default function PlannerVideoButton({
  href,
  className,
}: {
  href?: string | null;
  className?: string;
}) {
  const url = String(href || STUDY_PLANNER_VIDEO_URL).trim() || STUDY_PLANNER_VIDEO_URL;
  return (
    <a className={className || "planner-video-btn"} href={url} target="_blank" rel="noopener noreferrer">
      {STUDY_PLANNER_VIDEO_LABEL}
    </a>
  );
}
