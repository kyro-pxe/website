import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generatorPolicy } from '../../src/data/csp';
import { parseHeadersFile, parsePolicy } from './headers-file';

const text = readFileSync(new URL('../../public/_headers', import.meta.url), 'utf8');
const rules = parseHeadersFile(text);

function rule(pattern: string) {
  const found = rules.find((candidate) => candidate.pattern === pattern);
  if (!found) throw new Error(`public/_headers has no rule for ${pattern}`);
  return found;
}

function policy(pattern: string) {
  const value = rule(pattern).headers['Content-Security-Policy'];
  if (value === undefined) throw new Error(`${pattern} sets no Content-Security-Policy`);
  return value;
}

describe('public/_headers', () => {
  it('stays within the limits of Cloudflare Pages', () => {
    expect(rules.length).toBeLessThanOrEqual(100);
    for (const line of text.split('\n')) expect(line.length).toBeLessThanOrEqual(2000);
  });

  it('sends the general security headers on every path', () => {
    expect(rule('/*').headers).toMatchObject({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Cross-Origin-Opener-Policy': 'same-origin',
    });
  });

  it('limits every page to the origin of the site', () => {
    const directives = parsePolicy(policy('/*'));
    expect(directives['default-src']).toEqual(["'self'"]);
    expect(directives['frame-ancestors']).toEqual(["'none'"]);
    for (const sources of Object.values(directives)) {
      for (const source of sources) expect(["'self'", "'none'"]).toContain(source);
    }
  });

  it('gives the generator a policy without network connections or inline code', () => {
    const directives = parsePolicy(policy('/generator/*'));
    expect(directives).toEqual({
      'default-src': ["'none'"],
      'script-src': ["'self'"],
      'style-src': ["'self'"],
      'img-src': ["'self'"],
      'font-src': ["'self'"],
      'connect-src': ["'none'"],
      'base-uri': ["'none'"],
      'form-action': ["'none'"],
      'frame-ancestors': ["'none'"],
    });
  });

  it('matches the policy in the <meta> element of the generator page', () => {
    // frame-ancestors has no effect in a <meta> element, so only the header has it.
    const fromHeader = parsePolicy(policy('/generator/*'));
    delete fromHeader['frame-ancestors'];
    expect(parsePolicy(generatorPolicy)).toEqual(fromHeader);
  });
});
