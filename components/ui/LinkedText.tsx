import type { ReactNode } from "react";
import { safeHref } from "@/lib/custom-surveys";

const MARKDOWN_LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;
const BARE_URL = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;

function SurveyLink({ href, children }: { href: string; children: string }) {
  const safe = safeHref(href);
  if (!safe) return <>{children}</>;
  return (
    <a href={safe} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

function linkBareUrls(text: string, keyPrefix: string): ReactNode[] {
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
      <SurveyLink href={trimmed} key={`${keyPrefix}-u-${index++}`}>
        {trimmed}
      </SurveyLink>
    );
    if (trailing) parts.push(trailing);
    last = match.index + raw.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : [text];
}

export default function LinkedText({ text, className }: { text: string; className?: string }) {
  if (!text) return null;
  const nodes: ReactNode[] = [];
  const re = new RegExp(MARKDOWN_LINK.source, "g");
  let last = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = re.exec(text))) {
    if (match.index > last) nodes.push(...linkBareUrls(text.slice(last, match.index), `m${index}`));
    nodes.push(
      <SurveyLink href={match[2]} key={`md-${index++}`}>
        {match[1]}
      </SurveyLink>
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(...linkBareUrls(text.slice(last), "tail"));
  return <span className={className}>{nodes}</span>;
}
