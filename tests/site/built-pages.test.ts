// Checks the output of "pnpm build". Run the build first.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generatorPolicy } from '../../src/data/csp';
import { findPolicyViolations } from './inline-code';

const dist = fileURLToPath(new URL('../../dist', import.meta.url));

function htmlFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith('.html') ? [path] : [];
  });
}

if (!existsSync(dist)) {
  throw new Error('dist/ does not exist. Run "pnpm build" before "pnpm test".');
}

const pages = htmlFiles(dist).map((path) => relative(dist, path));

describe('built pages', () => {
  it('include the pages that exist so far', () => {
    expect(pages).toEqual(expect.arrayContaining(['index.html', 'generator/index.html', '404.html']));
  });

  it.each(pages)('%s has nothing the content security policy would block', (page) => {
    expect(findPolicyViolations(readFileSync(join(dist, page), 'utf8'))).toEqual([]);
  });

  it('ships the headers file', () => {
    const source = readFileSync(new URL('../../public/_headers', import.meta.url), 'utf8');
    expect(readFileSync(join(dist, '_headers'), 'utf8')).toBe(source);
  });
});

describe('the generator page', () => {
  const html = readFileSync(join(dist, 'generator/index.html'), 'utf8');
  const meta = `<meta http-equiv="Content-Security-Policy" content="${generatorPolicy}">`;

  it('carries its policy in a <meta> element', () => {
    expect(html).toContain(meta);
  });

  it('states the policy before anything is loaded', () => {
    const firstLoad = html.search(/<(script|link|img)\b/);
    expect(html.indexOf(meta)).toBeLessThan(firstLoad);
  });
});
