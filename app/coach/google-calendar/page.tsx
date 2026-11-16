"use client";

import { useRouter } from "next/navigation";
import GoogleCalendarConnect from "@/components/coach/GoogleCalendarConnect";

export default function CoachGoogleCalendarPage() {
  const router = useRouter();
  return (
    <div className="coach-page">
      <button className="back-link" type="button" onClick={() => router.push("/coach")}>
        ← Coach home
      </button>
      <GoogleCalendarConnect />
    </div>
  );
}
