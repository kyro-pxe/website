# Kyro website

Source of <https://kyro-pxe.sh>: the documentation site for
[Kyro](https://github.com/kyro-pxe/kyro), an open-source PXE server for
booting Windows 11 ISOs, and a browser-based
`autounattend.xml` generator.

> **Status: early development.** The home page and the site's design exist.
> The generator creates Windows 11 answer files and current Kyro alpha
> profiles. Generated settings still need Windows installation testing.
> The documentation pages are not built yet.

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
pnpm test      # vitest; run pnpm build first, some tests read dist/
```

`pnpm build`, `pnpm lint` and `pnpm test` must pass before every commit.

The workflow [.github/workflows/ci.yml](.github/workflows/ci.yml) runs the
same commands on every push and pull request, and then checks the links of
the built pages and the Markdown files with
[lychee](https://lychee.cli.rs). Its settings are in `lychee.toml`. The
workflow does not publish anything.

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
| `src/lib/unattend/` | Pure TypeScript generation, validation, XML and Kyro bundle handling, with tests. |
| `src/components/generator/` | Preact form, mounted by a bundled module without inline code. |
| `src/styles/` | `tokens.css` (colours, fonts, spacing), `fonts.css` (typefaces), `site.css` (standalone pages), `state.css` (status shapes), `starlight.css` (maps the tokens onto Starlight). |
| `public/` | Files copied to the site root unchanged, among them `_headers` with the response headers. |
| `tests/` | Tests that are not about one source file, such as the checks of the headers and of the built pages. |
| `DESIGN.md` | The design direction and the reason for each visual decision. Read it before changing how the site looks. |
| `docs/` | Documents about this repository, such as decision records. Not published on the site. |
| `astro.config.mjs` | Site configuration and sidebar. |

Kyro has no logo yet. The mark in the header and the favicon are a draft.
`DESIGN.md` says which files a real logo replaces.

The status of each boot step on the home page is kept by hand in
`src/data/boot-chain.ts`. The roadmap in the Kyro repository is authoritative.

The site is built with [Astro](https://astro.build) and
[Starlight](https://starlight.astro.build) as static files. It contains no
tracking and loads nothing from other servers; the typefaces are served from
the site itself.

## Deployment

The site is static. `pnpm build` writes it to `dist/`.

**Cloudflare Pages.** The repository is connected through Cloudflare's Git
integration, which builds and publishes on every push. This repository has no
deploy workflow. Settings of the Pages project:

| Setting | Value |
| ------- | ----- |
| Production branch | `main` |
| Build command | `pnpm build` |
| Build output directory | `dist` |
| Variable `PNPM_VERSION` | The pnpm version from the `packageManager` field of `package.json`. Cloudflare does not read that field. |
| Variable `ASTRO_TELEMETRY_DISABLED` | `1` |

Cloudflare takes the Node.js version from `.node-version` and the response
headers from `public/_headers`. Those headers hold a Content Security Policy
for the whole site and a stricter one for `/generator/`. The domain `kyro-pxe.sh` is added under
*Custom domains* in the Pages project.

**Moving to another host.** Nothing in the build depends on Cloudflare, so
any static file server can serve `dist/`. Two things need attention:

- `public/_headers` is a Cloudflare format. Another server has to send the
  same headers from its own configuration. On a host that cannot set
  headers, such as GitHub Pages, they are lost. The generator page repeats
  its Content Security Policy in a `<meta>` element, so that part stays in
  force everywhere.
- If the address changes, set the environment variable `SITE_URL` for the
  build so that canonical links and the sitemap match.

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

The built site also contains two typefaces that are not part of this
repository: Archivo (Copyright 2020 The Archivo Project Authors) and IBM Plex
Mono (Copyright 2017 IBM Corp.). Both are licensed under the SIL Open Font
License 1.1 and come from the `@fontsource` packages pinned in
`package.json`, which include the license text.

Windows is a trademark of the Microsoft group of companies. Kyro is not
affiliated with or endorsed by Microsoft, and this repository contains no
Microsoft software, files or logos.
