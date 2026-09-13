"use client";

import { useRouter } from "next/navigation";
import ContentManager from "@/components/coach/ContentManager";

export default function CourseCreatorPage() {
  const router = useRouter();

  return (
    <div className="coach-page">
      <button className="back-link" onClick={() => router.push("/coach")}>
        ← Coach home
      </button>
      <ContentManager />
    </div>
  );
}
