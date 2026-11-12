"use client";

import { useRouter } from "next/navigation";
import DashboardPostsManager from "@/components/coach/DashboardPostsManager";

export default function CoachDashboardPostsPage() {
  const router = useRouter();
  return (
    <div className="coach-page">
      <button className="back-link" type="button" onClick={() => router.push("/coach")}>
        ← Coach home
      </button>
      <DashboardPostsManager />
    </div>
  );
}
