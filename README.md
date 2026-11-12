# Kyro website

Source of <https://kyro-pxe.sh>: the documentation site for
[Kyro](https://github.com/kyro-pxe/kyro), an open-source PXE server for
booting Windows 11 ISOs, and the future home of a browser-based
`autounattend.xml` generator.

> **Status: early development.** The site scaffold exists. The documentation
> pages and the generator are not built yet. Kyro itself cannot boot anything
> yet.

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
| `src/content/docs/` | Documentation pages (Markdown and MDX). English is at the root of this folder. |
| `src/content/i18n/` | Overrides and translations of interface strings. |
| `src/pages/` | Pages that are not plain documentation, such as `/generator`. |
| `src/styles/`, `src/components/` | Theme and component overrides. |
| `public/` | Files copied to the site root unchanged. |
| `docs/` | Documents about this repository, such as decision records. Not published on the site. |
| `astro.config.mjs` | Site configuration and sidebar. |

The site is built with [Astro](https://astro.build) and
[Starlight](https://starlight.astro.build) as static files. It loads no
third-party scripts, fonts or other resources and contains no tracking.

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
