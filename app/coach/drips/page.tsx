"use client";

import { useRouter } from "next/navigation";
import DripMessagesManager from "@/components/coach/DripMessagesManager";

export default function CoachDripsPage() {
  const router = useRouter();
  return (
    <div className="coach-page">
      <button className="back-link" type="button" onClick={() => router.push("/coach")}>
        ← Coach home
      </button>
      <DripMessagesManager />
    </div>
  );
}
