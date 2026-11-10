"use client";

import { useRouter } from "next/navigation";
import FirefliesConnect from "@/components/coach/FirefliesConnect";

export default function CoachFirefliesPage() {
  const router = useRouter();
  return (
    <div className="coach-page">
      <button className="back-link" type="button" onClick={() => router.push("/coach")}>
        ← Coach home
      </button>
      <FirefliesConnect />
    </div>
  );
}
