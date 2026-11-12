// Finds what the site's Content Security Policy would block in a built page:
// inline scripts, inline styles, event handler attributes, and anything
// loaded from another origin. It reads tags with a regular expression, which
// is enough for Astro's own output, and it errs on the side of reporting.

const TAG = /<([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
const ATTRIBUTE = /([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

// A path on this site: starts with one slash. "//host" would be another origin.
const OWN_PATH = /^\/(?!\/)/;

// Attributes that make the browser fetch something.
const FETCHING = new Set(['src', 'srcset', 'poster', 'data', 'action', 'formaction', 'manifest']);

// <link> relations that do not fetch anything.
const LINK_WITHOUT_FETCH = new Set(['canonical', 'alternate', 'sitemap']);

function attributes(source: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const match of source.matchAll(ATTRIBUTE)) {
    const name = match[1];
    if (name) result.set(name.toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '');
  }
  return result;
}

export function findPolicyViolations(html: string): string[] {
  const found: string[] = [];
  for (const match of html.matchAll(TAG)) {
    const tag = (match[1] ?? '').toLowerCase();
    const attrs = attributes(match[2] ?? '');
    const where = match[0].length > 80 ? `${match[0].slice(0, 80)}...` : match[0];

    if (tag === 'style') found.push(`inline style element: ${where}`);
    if (tag === 'script' && !attrs.has('src')) found.push(`inline script: ${where}`);
    if (tag === 'base') found.push(`base element: ${where}`);

    for (const [name, value] of attrs) {
      if (name === 'style') found.push(`style attribute: ${where}`);
      if (name.startsWith('on')) found.push(`event handler attribute "${name}": ${where}`);
      if (/^\s*javascript:/i.test(value)) found.push(`javascript: address: ${where}`);
      if (FETCHING.has(name) && !OWN_PATH.test(value)) {
        found.push(`"${name}" does not point to this site: ${where}`);
      }
    }

    const href = attrs.get('href');
    if (tag === 'link' && href !== undefined && !LINK_WITHOUT_FETCH.has(attrs.get('rel') ?? '')) {
      if (!OWN_PATH.test(href)) found.push(`link does not point to this site: ${where}`);
    }
  }
  return found;
}
