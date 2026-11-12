# Design direction

> Drafted by the coding agent on 2026-11-12 from the maintainer's brief ("dark
> by default, one restrained accent, logo placeholder, honest about status").
> The maintainer owns this file. Direction written by an agent tends toward
> generic taste, so anything here may be replaced.

## Design read

A manual and a utility for people who install Windows on other people's
machines. It should read like good technical documentation: plain, exact, and
open about what does not work yet. It is not a product landing page and has
nothing to sell.

Dial: ENERGY 1 / RHYTHM 2 / MOTION 1

## Identity

- **Status is the motif.** Every feature states how far it is, using the
  roadmap's four words: planned, in progress, working, tested. Each has a
  square marker (empty, half, filled, filled with a ring) and always the word
  next to it. The marker repeats on the home page, on feature pages and next
  to untested generator options.
- **The boot chain is the picture.** Where another site would put a
  screenshot, this one shows the numbered steps from power-on to Windows
  Setup, with protocol and status per step. There are no illustrations.
- **Wordmark.** The name "Kyro" as text. There is no logo yet and none is
  imitated. When a logo exists, it replaces the text in
  `src/components/SiteNav.astro` and `public/favicon.svg`.

## Decisions and their reasons

| Decision | Reason |
| -------- | ------ |
| Dark by default, light and system selectable | The maintainer's brief. Readers work next to consoles and installer screens. |
| One cold hue (200 neutrals, 188 accent) | The name reads as "cryo". Neutrals carry the hue at low saturation, the accent at full. Amber and red stay free for warnings and destructive options in the generator. |
| Accent only on links, focus rings and the one primary action of a page | An accent that is everywhere stops marking anything. |
| System fonts, with Segoe UI and Cascadia Mono first on Windows | No font files to ship, license or request. The site looks native on the system its readers administer, and XML looks as it does in their terminal. |
| Square containers, 3px radius on controls | Tells "this holds content" from "this can be pressed" by shape. |
| Hairlines instead of cards and shadows | Nothing on these pages floats above anything else, so nothing gets elevation. |
| Notices use a full hairline border and a word, no stripe, fill or icon | The word carries the meaning. Colour alone never does. |
| Text links instead of icons in the navigation | Three destinations do not need an icon set. |
| No motion beyond hover and focus colour changes | Nothing on the site happens over time. |
| Left-aligned text column, wide only for the boot chain and the generator | Text gets a readable measure. The two things that are tables or tools get the width. |

## Tokens

Defined in `src/styles/tokens.css`. All text pairings meet WCAG AA (4.5:1),
control edges meet 3:1.

| Token | Dark | Light | Use |
| ----- | ---- | ----- | --- |
| `--bg` | `#121517` | `#f9fafb` | Page |
| `--surface` | `#1c2022` | `#edf1f2` | Code, inputs |
| `--line` | `#31373a` | `#d2d8da` | Dividers (decorative) |
| `--edge` | `#6e787c` | `#697277` | Control borders, status markers |
| `--text` | `#d2d8da` | `#2d3539` | Body text |
| `--strong` | `#f3f5f6` | `#101618` | Headings, emphasis |
| `--muted` | `#9ea5a9` | `#565e61` | Secondary text |
| `--accent` | `#72beca` | `#0f5c6b` | Links, focus, primary action |

## Layout

- Spacing steps: 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4.5 rem.
- Page gutter: 1 rem on phones, 1.5 rem from 40 rem, 2 rem from 64 rem.
- Text measure: 42 rem. Page width: 64 rem.
- Interactive targets are at least 44 px high on touch screens.
