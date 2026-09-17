"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { COURSE_SKILLS } from "@/lib/sales-copy";

export default function SkillsAccordion() {
  const [open, setOpen] = useState(-1);

  return (
    <div className="sales-skills-list">
      {COURSE_SKILLS.map((skill, index) => {
        const isOpen = open === index;
        const panelId = `skill-detail-${index}`;
        return (
          <div key={skill.title} className={`sales-skill ${isOpen ? "open" : ""}`}>
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpen(isOpen ? -1 : index)}
            >
              <span>{skill.title}</span>
              <ChevronDown size={18} aria-hidden="true" />
            </button>
            <p id={panelId} hidden={!isOpen}>
              {skill.detail}
            </p>
          </div>
        );
      })}
    </div>
  );
}
