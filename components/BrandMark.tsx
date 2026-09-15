import Link from "next/link";

export default function BrandMark({ href = "/student" }: { href?: string }) {
  return (
    <Link href={href} className="student-player-brand mark">
      <img src="/asa-logo.png" alt="Accounting Study Advice" className="brand-logo" width={44} height={44} />
      <span>
        <strong>IAC Skills Course</strong>
        <em>Accounting Study Advice</em>
      </span>
    </Link>
  );
}
