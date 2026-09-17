"use client";

import { useState } from "react";
import { FAQS } from "@/lib/sales-copy";

export default function FaqAccordion() {
  const [open, setOpen] = useState(0);

  return (
    <div className="sales-faq-list">
      {FAQS.map((faq, index) => {
        const isOpen = open === index;
        return (
          <div key={faq.question} className={`sales-faq ${isOpen ? "open" : ""}`}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? -1 : index)}
            >
              <span>{faq.question}</span>
              <em>{isOpen ? "−" : "+"}</em>
            </button>
            {isOpen ? <p>{faq.answer}</p> : null}
          </div>
        );
      })}
    </div>
  );
}
