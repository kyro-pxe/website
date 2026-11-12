// Content Security Policy of the generator page, for its <meta> element.
// public/_headers sends the same policy as a response header on Cloudflare
// Pages. The <meta> element keeps it in force on a host that cannot set
// headers. tests/site/headers.test.ts fails when the two differ.
//
// frame-ancestors is missing here on purpose: browsers ignore it in a
// <meta> element. Only the response header can forbid framing.
export const generatorPolicy = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');
