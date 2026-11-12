"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import LinkedText from "@/components/ui/LinkedText";
import { embedSrcForVideo, YOUTUBE_EMBED_ALLOW, YOUTUBE_EMBED_REFERRER_POLICY } from "@/lib/video-embed";
import {
  fetchPublishedDashboardPost,
  slideDismissKey,
  type DashboardPost,
} from "@/lib/dashboard-posts";
import { DEFAULT_LMS_COURSE_ID } from "@/lib/lms-catalog";
import { useLmsCourse } from "@/lib/lms-course-context";
import { useStudentSession } from "@/lib/student-session";

export default function StudentDashboardSlide() {
  const { course } = useLmsCourse();
  const { user } = useStudentSession();
  const [post, setPost] = useState<DashboardPost | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (course.id !== DEFAULT_LMS_COURSE_ID) return;
    let cancelled = false;
    fetchPublishedDashboardPost("slide").then((next) => {
      if (cancelled || !next) return;
      if (typeof window !== "undefined" && window.localStorage.getItem(slideDismissKey(next.id, user?.id || ""))) {
        return;
      }
      setPost(next);
      window.setTimeout(() => {
        if (!cancelled) setOpen(true);
      }, 280);
    });
    return () => {
      cancelled = true;
    };
  }, [course.id, user?.id]);

  const dismiss = () => {
    if (post) {
      try {
        window.localStorage.setItem(slideDismissKey(post.id, user?.id || ""), "1");
      } catch {
        /* ignore quota */
      }
    }
    setOpen(false);
  };

  if (!post) return null;
  const embedSrc = embedSrcForVideo(post.videoUrl);
  const paragraphs = post.body
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return (
    <div className={`ask-drawer dash-slide${open ? " open" : ""}`} role="dialog" aria-modal="true" aria-labelledby="dash-slide-title">
      <button type="button" className="ask-drawer-backdrop" aria-label="Close" onClick={dismiss} />
      <aside className="ask-drawer-panel dash-slide-panel">
        <div className="ask-drawer-head">
          <div>
            <p className="kicker">For you</p>
            <h2 id="dash-slide-title">{post.title || "A note from Yvonne"}</h2>
          </div>
          <button type="button" className="ask-drawer-close" onClick={dismiss} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="dash-slide-body">
          {embedSrc ? (
            <div className="dash-slide-video">
              <iframe
                src={embedSrc}
                title={post.title || "Motivational video"}
                allow={YOUTUBE_EMBED_ALLOW}
                referrerPolicy={YOUTUBE_EMBED_REFERRER_POLICY}
                allowFullScreen
              />
            </div>
          ) : null}
          {paragraphs.map((paragraph) => (
            <p key={paragraph}>
              <LinkedText text={paragraph} />
            </p>
          ))}
        </div>
        <div className="dash-slide-foot">
          <button type="button" className="primary" onClick={dismiss}>
            Got it
          </button>
        </div>
      </aside>
    </div>
  );
}
