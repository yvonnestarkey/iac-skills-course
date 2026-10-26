import type { ReactNode } from "react";
import { isInternalCourseHref, linkDisplayLabel, parseTextMarks, resolveCourseHref } from "@/lib/rich-text";

const MARKDOWN_LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;
const BARE_URL = /(https?:\/\/[^\s<]+|www\.[^\s<]+|\/(?:lessons|learn|student|coach|surveys|events|planner|coaching)[^\s<]*)/gi;

function RichLink({
  href,
  children,
  interactive,
}: {
  href: string;
  children: string;
  interactive: boolean;
}) {
  const resolved = resolveCourseHref(href);
  if (!resolved) return <>{children}</>;
  const internal = isInternalCourseHref(href) || isInternalCourseHref(resolved);
  const label = linkDisplayLabel(href, children);
  const className = `rich-link${internal ? " internal" : ""}`;
  if (!interactive) return <span className={className}>{label}</span>;
  return (
    <a className={className} href={resolved} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  );
}

function linkBareUrls(text: string, keyPrefix: string, interactive: boolean): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = new RegExp(BARE_URL.source, "gi");
  let last = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = re.exec(text))) {
    if (match.index > last) parts.push(...markPlain(text.slice(last, match.index), `${keyPrefix}-p-${index}`));
    const raw = match[0];
    const trimmed = raw.replace(/[),.;!?]+$/, "");
    const trailing = raw.slice(trimmed.length);
    parts.push(
      <RichLink href={trimmed} interactive={interactive} key={`${keyPrefix}-u-${index++}`}>
        {trimmed}
      </RichLink>
    );
    if (trailing) parts.push(trailing);
    last = match.index + raw.length;
  }
  if (last < text.length) parts.push(...markPlain(text.slice(last), `${keyPrefix}-t`));
  return parts.length ? parts : markPlain(text, keyPrefix);
}

function markPlain(text: string, keyPrefix: string): ReactNode[] {
  return parseTextMarks(text).map((part, index) => {
    let node: ReactNode = part.text;
    if (part.italic) node = <em key={`${keyPrefix}-i-${index}`}>{node}</em>;
    if (part.underline) node = <u key={`${keyPrefix}-u-${index}`}>{node}</u>;
    if (part.bold) node = <strong key={`${keyPrefix}-b-${index}`}>{node}</strong>;
    return <span key={`${keyPrefix}-${index}`}>{node}</span>;
  });
}

export default function LinkedText({
  text,
  className,
  interactive = true,
}: {
  text: string;
  className?: string;
  interactive?: boolean;
}) {
  if (!text) return null;
  const nodes: ReactNode[] = [];
  const re = new RegExp(MARKDOWN_LINK.source, "g");
  let last = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = re.exec(text))) {
    if (match.index > last) nodes.push(...linkBareUrls(text.slice(last, match.index), `m${index}`, interactive));
    nodes.push(
      <RichLink href={match[2]} interactive={interactive} key={`md-${index++}`}>
        {match[1]}
      </RichLink>
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(...linkBareUrls(text.slice(last), "tail", interactive));
  return <span className={className}>{nodes}</span>;
}
