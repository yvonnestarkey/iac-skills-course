import Link from "next/link";

export default function BrandMark({
  href = "/student",
  title = "IAC Skills Course",
  subtitle = "Accounting Study Advice",
}: {
  href?: string;
  title?: string;
  subtitle?: string;
}) {
  return (
    <Link href={href} className="student-player-brand mark">
      <img src="/asa-logo.png" alt="Accounting Study Advice" className="brand-logo" width={44} height={44} />
      <span>
        <strong>{title}</strong>
        <em>{subtitle}</em>
      </span>
    </Link>
  );
}
