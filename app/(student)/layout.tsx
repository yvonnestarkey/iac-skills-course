"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { useStore } from "@/lib/store";
import { StudentNavProvider, useStudentNav } from "@/lib/student-nav";

function StudentShell({ children }: { children: ReactNode }) {
  const nav = useStudentNav();
  const pathname = usePathname();
  const closeNav = nav?.setOpen;

  useEffect(() => {
    closeNav?.(false);
  }, [pathname, closeNav]);

  return (
    <>
      <TopBar />
      <div className="shell">
        {nav?.open ? (
          <button className="nav-backdrop" aria-label="Close course menu" onClick={() => nav.setOpen(false)} />
        ) : null}
        <aside id="course-nav" className={`sidebar ${nav?.open ? "nav-open" : ""}`}>
          <Sidebar />
        </aside>
        <main className="main">{children}</main>
      </div>
    </>
  );
}

export default function StudentLayout({ children }: { children: ReactNode }) {
  const { ready, session } = useStore();
  const router = useRouter();
  const signedIn = Boolean(session && session.role === "student");

  useEffect(() => {
    if (ready && !signedIn) router.replace("/");
  }, [ready, signedIn, router]);

  if (!ready || !signedIn) return null;

  return (
    <StudentNavProvider>
      <StudentShell>{children}</StudentShell>
    </StudentNavProvider>
  );
}
