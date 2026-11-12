# Design direction

> The maintainer set this direction on 2026-11-12 after rejecting two earlier
> looks as too bare, too document-like, dull in colour and generic in type:
> a project landing page, a self-hosted typeface, and a drafted mark until a
> real logo exists. The coding agent worked those decisions out into what
> follows. The maintainer owns this file, and anything here may be replaced.

## Design read

The front page of an open-source project for people who install Windows on
many machines. It has to say in one screen what Kyro is for, show how it
works, and be honest that almost none of it is built. It sells nothing: the
actions lead to the source code and the roadmap.

Dial: ENERGY 2 / RHYTHM 3 / MOTION 1

## Identity

- **The boot chart is the picture.** The steps from power-on to Windows
  Setup, one row per step and one column per protocol. A bar marks which
  protocol carries a step. No screenshot, because there is no product to
  take one of, and no imitation of a terminal.
- **Status is the motif.** A bar or marker is outlined when a part is
  planned, half filled when it is in progress, filled when it works, and
  filled with a ring when it is tested. The chart therefore fills in as Kyro
  gets built. The word is always next to the shape.
- **Mark (draft).** A letter K made of an upright stem and an angle. The
  agent drew it as a stand-in; it is not a logo. A real logo replaces
  `src/components/Mark.astro` and `public/favicon.svg` together.

## Decisions and their reasons

| Decision | Reason |
| -------- | ------ |
| Dark by default, light and system selectable | The maintainer's brief. Readers work next to consoles and installer screens. |
| A cold blue-black with one ice-blue accent | The name reads as "cryo". The first palette used the same idea at low saturation and came out grey, so this one commits to it. |
| The accent marks the second half of the headline, the one filled button, links, focus rings and the chart | These are the places a visitor should look at or can act on. Nothing else is coloured. Amber and red stay free for warnings in the generator. |
| Archivo for text and headings, with its wide cut for headings | One family gives two voices. The wide, heavy cut looks like lettering on equipment, which suits a tool for hardware rollouts. |
| IBM Plex Mono for XML and protocol names | Answer files are the product of the generator, so their type matters. Used only for literal text. |
| Fonts are served from this site | No request to another server, as the site promises. Both families are under the SIL Open Font License. |
| Headline first, then text beside a figure | Each section makes one statement and backs it with one figure: chart, fact list, menu example, XML fragment. |
| Sections differ in form | A page of identical blocks reads as a template. Here a chart, a list of facts, a tree, a band with code and a plain list follow each other. |
| Panels with a hairline and a 10px radius, controls with 6px | Panels hold figures, controls can be pressed. Nothing has a shadow, because nothing floats. |
| One filled button per page | It names the most useful action that exists today: reading the source. When the generator works, that becomes the filled button. |
| No motion beyond hover and focus | Nothing on the site happens over time. |
| Every part states its status in words | The project is early. A landing page without that would promise things that do not exist. |

## Tokens

Defined in `src/styles/tokens.css`. All text pairings meet WCAG AA (4.5:1),
control edges meet 3:1.

| Token | Dark | Light | Use |
| ----- | ---- | ----- | --- |
| `--bg` | `#0a0e14` | `#f4f7fb` | Page |
| `--surface` | `#111822` | `#ffffff` | Panels, bands, footer |
| `--raised` | `#1a2331` | `#e9eef5` | Items inside a panel |
| `--line` | `#263244` | `#d2dae6` | Dividers (decorative) |
| `--edge` | `#6f7e94` | `#66758a` | Control borders, connectors |
| `--text` | `#c5cfdc` | `#2b3545` | Body text |
| `--strong` | `#f3f6fa` | `#0a111b` | Headings, emphasis |
| `--muted` | `#94a1b3` | `#556275` | Secondary text |
| `--accent` | `#5fd6f2` | `#0a6885` | Links, focus, primary action, chart |
| `--on-accent` | `#04141b` | `#ffffff` | Text on the accent |

## Layout

- Spacing steps: 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4.5 rem. Sections are 4 to
  7.5 rem apart, depending on the width of the screen.
- Page gutter: 1 rem on phones, 1.5 rem from 40 rem, 2 rem from 64 rem.
- Text measure: 38 rem. Page width: 72 rem.
- One column on phones and tablets, two from 60 rem.
- Interactive targets are at least 44 px high on touch screens.
