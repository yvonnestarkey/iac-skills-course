"use client";

import { useState } from "react";
import CoachToolPanel from "@/components/coach/CoachToolPanel";
import ReadingPracticeManager from "@/components/coach/ReadingPracticeManager";
import StudyClinicManager from "@/components/coach/StudyClinicManager";
import { COURSE_TOOLS } from "@/lib/course-tools";

export default function CourseToolsPanel() {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState<string | null>("reading");

  return (
    <CoachToolPanel
      id="course-tools"
      title="Tools"
      description="Edit dashboard tools here. This is separate from adding a lesson."
      open={open}
      onToggle={() => setOpen((current) => !current)}
    >
      <div className="people hub-choices" style={{ marginBottom: editing ? 16 : 0 }}>
        {COURSE_TOOLS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            onClick={() => {
              if (tool.editable) setEditing(tool.id);
              else document.getElementById("builder-lesson-tool")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <strong>{tool.title}</strong>
            <span className="muted">{tool.description}</span>
          </button>
        ))}
      </div>
      {editing === "reading" ? <ReadingPracticeManager /> : null}
      {editing === "study-clinic" ? <StudyClinicManager /> : null}
    </CoachToolPanel>
  );
}
