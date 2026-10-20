/**
 * Names on the student report and its saved PDF (Yvonne, 20 Oct 2026). The browser uses the page title as the PDF
 * file name, so the title is "<first name> <exam> Script Evaluation", e.g. "S4 Jun26 Script Evaluation".
 */
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "june-2026" -> "Jun26". Falls back to the sitting label for ids that are not month-year. */
export function sittingShortLabel(sittingId: string, sittingLabel = ""): string {
  const match = /^([a-z]+)-(\d{4})/i.exec(sittingId);
  const month = match ? MONTHS.find((m) => match[1].toLowerCase().startsWith(m)) : null;
  if (match && month) return `${month[0].toUpperCase()}${month.slice(1)}${match[2].slice(2)}`;
  return sittingLabel.trim() || sittingId;
}

export function firstName(name: string | null | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] || "Student";
}

/** The name the course shows: profile full name, else the sign-up full name, else from the email address. */
export function courseDisplayName(input: { profileFullName?: string | null; authFullName?: string | null; email?: string | null }): string {
  const named = input.profileFullName?.trim() || input.authFullName?.trim();
  if (named) return named;
  const local = (input.email ?? "").split("@")[0] || "Student";
  return local.replace(/[._-]+/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function reportFileTitle(name: string | null | undefined, sittingId: string, sittingLabel = ""): string {
  return `${firstName(name)} ${sittingShortLabel(sittingId, sittingLabel)} Script Evaluation`;
}
