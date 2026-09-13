import Link from "next/link";
import type { ReactNode } from "react";

export default function StudentPlayerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="student-player">
      <header className="student-player-bar">
        <Link href="/" className="student-player-brand">
          <span className="dot" aria-hidden="true" />
          <span>
            <strong>Accounting Study Advice</strong>
            <em>IAC Skills Course</em>
          </span>
        </Link>
      </header>
      <div className="student-player-main">{children}</div>
    </div>
  );
}
