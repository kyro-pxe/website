// Reads a Cloudflare Pages _headers file: a pattern at the start of a line,
// followed by indented "Name: value" lines. Lines starting with # are comments.

export interface HeaderRule {
  pattern: string;
  headers: Record<string, string>;
}

export function parseHeadersFile(text: string): HeaderRule[] {
  const rules: HeaderRule[] = [];
  let current: HeaderRule | undefined;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      current = { pattern: trimmed, headers: {} };
      rules.push(current);
      continue;
    }
    const colon = trimmed.indexOf(':');
    if (!current || colon < 1) throw new Error(`Cannot read this line of _headers: "${line}"`);
    const name = trimmed.slice(0, colon).trim();
    if (name in current.headers) throw new Error(`"${name}" is set twice for ${current.pattern}`);
    current.headers[name] = trimmed.slice(colon + 1).trim();
  }
  return rules;
}

/** Splits a Content Security Policy into its directives and their sources. */
export function parsePolicy(policy: string): Record<string, string[]> {
  const directives: Record<string, string[]> = {};
  for (const part of policy.split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (!name) continue;
    if (name in directives) throw new Error(`Directive "${name}" appears twice`);
    directives[name] = sources;
  }
  return directives;
}
