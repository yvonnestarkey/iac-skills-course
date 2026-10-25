export function studentProfilePath(studentId: string): string {
  return `/coach/students/${encodeURIComponent(String(studentId || "").trim())}`;
}

export function canLinkStudentProfile(studentId?: string | null): boolean {
  return Boolean(String(studentId || "").trim());
}
