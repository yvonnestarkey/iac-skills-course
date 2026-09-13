"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { useStore } from "@/lib/store";

export default function StudentLayout({ children }: { children: ReactNode }) {
  const { ready, session } = useStore();
  const router = useRouter();
  const signedIn = Boolean(session && session.role === "student");

  useEffect(() => {
    if (ready && !signedIn) router.replace("/");
  }, [ready, signedIn, router]);

  if (!ready || !signedIn) return null;

  return (
    <>
      <TopBar />
      <div className="shell">
        <aside className="sidebar">
          <Sidebar />
        </aside>
        <main className="main">{children}</main>
      </div>
    </>
  );
}
