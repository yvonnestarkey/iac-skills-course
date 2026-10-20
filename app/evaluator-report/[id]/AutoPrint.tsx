"use client";

import { useEffect } from "react";

/** Opens the browser's print dialog (Save as PDF) once the report has loaded: the Download button links here with ?print=1. */
export default function AutoPrint() {
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 800);
    return () => clearTimeout(timer);
  }, []);
  return null;
}
