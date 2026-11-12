# Kyro website

Source of <https://kyro-pxe.sh>: the documentation site for
[Kyro](https://github.com/kyro-pxe/kyro), an open-source PXE server for
booting Windows 11 ISOs, and the future home of a browser-based
`autounattend.xml` generator.

> **Status: early development.** The home page and the site's design exist.
> The documentation pages and the generator are not built yet. Kyro itself
> cannot boot anything yet.

## Development

Requirements: Node.js (the version in [.node-version](.node-version)) and
[pnpm](https://pnpm.io) (the version in the `packageManager` field of
[package.json](package.json)).

```sh
pnpm install   # install the pinned dependencies
pnpm dev       # start the dev server on http://localhost:4321
pnpm build     # build the static site into dist/
pnpm preview   # serve dist/ locally
pnpm lint      # astro check (types) and markdownlint
```

`pnpm build` and `pnpm lint` must pass before every commit.

The Astro command line tool collects anonymous usage data by default. This
only concerns the developer's machine, not visitors of the site. Turn it off
with `pnpm astro telemetry disable` or by setting `ASTRO_TELEMETRY_DISABLED=1`.

## Where things live

| Path | Content |
| ---- | ------- |
| `src/content/docs/` | Documentation pages (Markdown and MDX), rendered by Starlight. English is at the root of this folder. Empty so far. |
| `src/content/i18n/` | Overrides and translations of interface strings. |
| `src/pages/` | Standalone pages: home, `/generator` and the 404 page. |
| `src/layouts/` | The layout of the standalone pages. |
| `src/components/` | Shared parts (header, footer, status marker, boot chain). `starlight/` holds the overrides that make documentation pages use them. |
| `src/data/` | Content that is data, such as the boot chain steps and their status. |
| `src/styles/` | `tokens.css` (colours, fonts, spacing), `site.css` (standalone pages), `starlight.css` (maps the tokens onto Starlight). |
| `public/` | Files copied to the site root unchanged. |
| `DESIGN.md` | The design direction and the reason for each visual decision. Read it before changing how the site looks. |
| `docs/` | Documents about this repository, such as decision records. Not published on the site. |
| `astro.config.mjs` | Site configuration and sidebar. |

Kyro has no logo yet. The header shows the name as text and the favicon shows
the initial. `DESIGN.md` says where a logo goes once one exists.

The status of each boot step on the home page is kept by hand in
`src/data/boot-chain.ts`. The roadmap in the Kyro repository is authoritative.

The site is built with [Astro](https://astro.build) and
[Starlight](https://starlight.astro.build) as static files. It loads no
third-party scripts, fonts or other resources and contains no tracking.

## Deployment

The site is static. `pnpm build` writes it to `dist/`.

**GitHub Pages (primary).** The workflow
[.github/workflows/deploy.yml](.github/workflows/deploy.yml) builds and
deploys on every push to `main`. One-time setup in the repository settings:

1. Under *Pages*, set the source to *GitHub Actions*.
2. Under *Pages*, set the custom domain to `kyro-pxe.sh` and, once the
   certificate is issued, enable *Enforce HTTPS*.
3. Point the DNS records of `kyro-pxe.sh` to GitHub Pages as described in
   GitHub's documentation on custom domains.

`public/CNAME` records the domain in the repository. With deployments from
GitHub Actions, the domain setting in step 2 is what takes effect.

**Cloudflare Pages (alternative).** Nothing in the build depends on GitHub.
Use the build command `pnpm build` and the output directory `dist`. The
Node.js version comes from `.node-version`. `public/_headers` sets response
headers there. For preview deployments, set the environment variable
`SITE_URL` to the preview address so that canonical links and the sitemap
match.

## Contributing

Commits follow [Conventional Commits](https://www.conventionalcommits.org/)
and must be signed off (`git commit -s`), as in the
[Kyro repository](https://github.com/kyro-pxe/kyro/blob/main/CONTRIBUTING.md).

## License

Copyright (C) 2026 Lukas Koch and Kyro contributors.

This repository uses two licenses:

- **Site code** is free software under the GNU General Public License,
  version 3 or (at your option) any later version. See [LICENSE](LICENSE).
  This covers everything that is not documentation content: configuration,
  components, styles, scripts and the generator.
- **Documentation content** is licensed under the Creative Commons
  Attribution 4.0 International License (CC BY 4.0). See
  [LICENSE-docs](LICENSE-docs). This covers the pages in `src/content/docs/`
  and the documents in `docs/`.

Windows is a trademark of the Microsoft group of companies. Kyro is not
affiliated with or endorsed by Microsoft, and this repository contains no
Microsoft software, files or logos.
