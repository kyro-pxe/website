import { describe, expect, it } from 'vitest';
import { findPolicyViolations } from './inline-code';

describe('findPolicyViolations', () => {
  it('accepts a page that loads everything from its own origin', () => {
    const html = `<!doctype html><html lang="en" data-theme="dark"><head>
      <link rel="canonical" href="https://kyro-pxe.sh/generator/">
      <link rel="stylesheet" href="/_astro/site.css">
      <link rel="icon" href="/favicon.svg" type="image/svg+xml">
      <script src="/theme-init.js"></script>
      <script type="module" src="/_astro/form.js"></script>
      </head><body><a href="https://github.com/kyro-pxe/kyro">Source</a>
      <p>Setup runs once the disk is ready.</p><img src="/shot.png" alt=""></body></html>`;
    expect(findPolicyViolations(html)).toEqual([]);
  });

  it.each([
    ['an inline script', '<script>alert(1)</script>'],
    ['an inline module script', '<script type="module">import "/x.js"</script>'],
    ['a style element', '<style>body{color:red}</style>'],
    ['a style attribute', '<p style="color:red">x</p>'],
    ['an event handler', '<button onclick="go()">x</button>'],
    ['an event handler after a value that contains >', '<a title="a > b" onmouseover="go()">x</a>'],
    ['an unquoted event handler', '<body onload=go()>'],
    ['a script from another origin', '<script src="https://example.com/x.js"></script>'],
    ['a protocol-relative script', '<script src="//example.com/x.js"></script>'],
    ['a stylesheet from another origin', '<link rel="stylesheet" href="https://example.com/x.css">'],
    ['a font preload from another origin', '<link rel="preload" as="font" href="https://example.com/f.woff2">'],
    ['an image from another origin', '<img src="https://example.com/x.png" alt="">'],
    ['an image as a data address', '<img src="data:image/png;base64,AAAA" alt="">'],
    ['a frame from another origin', '<iframe src="https://example.com/"></iframe>'],
    ['a form that posts somewhere', '<form action="https://example.com/collect"></form>'],
    ['a javascript: link', '<a href="javascript:go()">x</a>'],
    ['a base element', '<base href="/other/">'],
  ])('reports %s', (_name, html) => {
    expect(findPolicyViolations(html)).not.toEqual([]);
  });
});
