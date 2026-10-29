"use client";

import { ClipboardCheck, Compass, Laptop, Mic, MousePointerClick, PenTool, Video, Wrench, type LucideIcon } from "lucide-react";
import { COURSE_FEATURES, INTERACTIVE_PRACTICE_FEATURE } from "@/lib/sales-copy";

const ICONS: Record<(typeof COURSE_FEATURES)[number]["icon"], LucideIcon> = {
  pen: PenTool,
  wrench: Wrench,
  mic: Mic,
  clipboard: ClipboardCheck,
  video: Video,
  laptop: Laptop,
  compass: Compass,
};

export default function CourseFeatures() {
  return (
    <section className="sales-section" id="features">
      <h2>Course Features</h2>
      <div className="sales-feature-grid">
        {COURSE_FEATURES.map((feature) => {
          const Icon = ICONS[feature.icon];
          return (
            <article key={feature.title} className="sales-feature">
              <span className="sales-feature-icon" aria-hidden="true">
                <Icon size={22} />
              </span>
              <div>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </div>
            </article>
          );
        })}
      </div>
      <article className="sales-feature sales-feature-spotlight">
        <span className="sales-feature-icon" aria-hidden="true">
          <MousePointerClick size={22} />
        </span>
        <div>
          <h3>{INTERACTIVE_PRACTICE_FEATURE.title}</h3>
          <p>{INTERACTIVE_PRACTICE_FEATURE.body}</p>
        </div>
        <div className="sales-feature-clip">
          <iframe
            src={INTERACTIVE_PRACTICE_FEATURE.video.src}
            title={INTERACTIVE_PRACTICE_FEATURE.video.title}
            allow="autoplay; fullscreen; picture-in-picture; clipboard-write"
            allowFullScreen
          />
        </div>
      </article>
    </section>
  );
}
