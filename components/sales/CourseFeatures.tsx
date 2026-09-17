"use client";

import { ClipboardCheck, Compass, Laptop, Mic, PenTool, Video, Wrench, type LucideIcon } from "lucide-react";
import { COURSE_FEATURES } from "@/lib/sales-copy";

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
    </section>
  );
}
