"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import TopBar from "@/components/TopBar";
import { useStore } from "@/lib/store";

export default function CoachLayout({ children }: { children: ReactNode }) {
  const { ready, session } = useStore();
  const router = useRouter();
  const isCoach = Boolean(session && session.role === "coach");

  useEffect(() => {
    if (ready && !isCoach) router.replace("/");
  }, [ready, isCoach, router]);

  if (!ready || !isCoach) return null;

  return (
    <>
      <TopBar />
      <div className="shell coach-shell">{children}</div>
    </>
  );
}
