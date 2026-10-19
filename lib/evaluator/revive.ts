/**
 * The model sometimes returns a nested object or list as a JSON *string* inside the tool input
 * (e.g. communication: "{\"overall\": ...}"). Parse those back so the rest of the code sees real objects.
 *
 * It has also been seen to run on: the string holds the whole object and then, glued on after it, the fields that
 * should have been siblings (`,"quick_comment":{...},"uncertainties":[...]}`). The leading value is taken as the
 * field and the glued-on siblings are recovered into the parent, but only where the parent does not already
 * have a real value for them.
 */

/** Parse the first complete JSON object or array at the start of `text`; return it with whatever follows. */
export function parseLeadingJson(text: string): { value: unknown; rest: string } | null {
  const start = text.search(/\S/);
  if (start < 0 || (text[start] !== "{" && text[start] !== "[")) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") depth += 1;
    else if (ch === "}" || ch === "]") {
      depth -= 1;
      if (depth === 0) {
        try {
          return { value: JSON.parse(text.slice(start, i + 1)), rest: text.slice(i + 1) };
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** Recover `,"a":1,"b":2}` (the tail of a glued-on string) into { a: 1, b: 2 }. */
function recoverSiblings(rest: string): Record<string, unknown> {
  const body = rest.replace(/^\s*,/, "").trim();
  if (!body) return {};
  for (const candidate of [`{${body}`, `{${body}}`]) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      // try the next shape
    }
  }
  return {};
}

const isEmptyValue = (value: unknown) => value === undefined || value === null || (Array.isArray(value) && value.length === 0) || value === "";

export function reviveStringifiedFields(value: unknown, depth = 0): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value) || depth > 1) return value;
  const out: Record<string, unknown> = {};
  const recovered: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === "string" && /^\s*[[{]/.test(item)) {
      const leading = parseLeadingJson(item);
      if (leading) {
        out[key] = reviveStringifiedFields(leading.value, depth + 1);
        if (depth === 0) Object.assign(recovered, recoverSiblings(leading.rest));
        continue;
      }
    }
    out[key] = reviveStringifiedFields(item, depth + 1);
  }
  for (const [key, item] of Object.entries(recovered)) {
    if (isEmptyValue(out[key])) out[key] = item;
  }
  return out;
}
