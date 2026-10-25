"use client";

import type { MouseEvent, ReactNode } from "react";
import { canLinkStudentProfile, studentProfilePath } from "@/lib/student-profile-link";

export default function StudentProfileLink({
  studentId,
  children,
  className,
}: {
  studentId?: string | null;
  children: ReactNode;
  className?: string;
}) {
  if (!canLinkStudentProfile(studentId)) return <>{children}</>;
  return (
    <a
      href={studentProfilePath(studentId!)}
      target="_blank"
      rel="noopener noreferrer"
      className={className ? `student-profile-link ${className}` : "student-profile-link"}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => event.stopPropagation()}
    >
      {children}
    </a>
  );
}
