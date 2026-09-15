import type { ReactNode } from "react";
import { isInternalCourseHref, linkDisplayLabel, resolveCourseHref } from "@/lib/rich-text";

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
    if (match.index > last) parts.push(text.slice(last, match.index));
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
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : [text];
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
