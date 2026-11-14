# Generator design delivery gate

Reviewed 2026-11-14. This records the antislop delivery gate for the generator
UI, not Windows installation validation. Evidence and limitations are in
[the generator notes](generator.md).

## Hard gate

- R-02 PASS: new product copy contains no em dashes.
- R-03 PASS: Chromium checked every section at seven widths from 320 to 1440 pixels without page overflow, plus 200% text sizing.
- R-17 PASS: no product statistics are displayed; file sizes and account counts derive from current state.
- R-18 PASS: no testimonials or invented people appear.
- R-23 PASS: existing mark, fonts and navigation are reused; no visual assets were created.
- R-24 PASS: site navigation still points to the existing home, generator and repository.
- R-25 PASS: computed text contrast audit found a minimum 5.31:1 across 1342 visible instances; controls use existing verified edge and accent tokens.
- R-26 PASS: browser flow exercised form fields, dynamic controls, imports, downloads, preview, reset and section navigation.
- R-27 PASS: loading text is replaced on mount; empty accounts/scripts/fragments explain the next action; invalid input and imports show actionable errors.
- R-28 PASS: no FAQ is included.
- R-32 PASS: native controls, visible global focus, keyboard tab navigation, arrow/Home/End handling and dialog Escape were verified.
- R-33 PASS: features are written in Astro, TSX, TypeScript and CSS source, without runtime source patching.
- R-34 PASS: both themes and the system selector were exercised in Chromium.
- R-35 PASS: build, type checks, unit tests and the recorded complete browser flow pass; installed-Windows testing remains explicitly pending.
- R-36 PASS: no fabricated deployment, performance, compliance or security guarantees appear.
- R-37 PASS: the maintainer's DESIGN.md supplies direction and the declared dials are 2/3/1.
- R-38 PASS: only real configuration, generated output and documented limitations are shown.

## Purpose gate

- R-01 PASS: existing solid theme tokens are used, without gradients or decorative glow.
- R-04 PASS: no generic feature icons or new icon set are used.
- R-06 PASS: Archivo preserves brand headings; IBM Plex Mono identifies code and literal package names.
- R-07 PASS: no decorative background grid or pattern is added.
- R-08 PASS: action buttons use descriptive text without decorative arrows.
- R-09 PASS: square markers show actual configured state; no promotional badges are added.
- R-10 PASS: no glassmorphism is used.
- R-12 PASS: no new shadows are used.
- R-13 PASS: no glows are used.
- R-14 PASS: sections group configuration tasks; no feature-card grid is added.
- R-19 PASS: interaction states match MOTION 1; there are no continuous animations.
- R-22 PASS: no illustration is used; the output preview is the actual generated file.

## Liveliness

- Dials PASS: ENERGY 2 / RHYTHM 3 / MOTION 1 declared before implementation.
- Consistency PASS: wide Archivo introduction, task navigation, form groups, output rail and code preview provide distinct content roles without animation.
- Focal point PASS: the heading introduces the tool; the one filled download button leads the work area.
- Whitespace PASS: section dividers and the output gutter separate different tasks; mobile spacing is reduced.
- Accent PASS: the site accent identifies the heading, active status, focus and download action.
- Identity PASS: numbered square state markers extend Kyro's existing status motif.
- Design Read PASS: the existing Kyro deployment-tool direction was stated in chat before generation and recorded in the notes.

## Craftsmanship and quality locks

- C-1 PASS: major visual decisions have one-line reasons in the generator notes.
- C-2 PASS: all displayed interactive controls have working behavior in the browser flow.
- C-3 PASS: sections correspond to settings, output, import/export or deployment limitations.
- C-4 PASS: loading/empty/error states, both themes, keyboard navigation, resizing and responsive widths were checked.
- C-5 PASS: compatibility claims distinguish XML/import checks from pending Windows installation testing.
- R-05 PASS: composition follows configuration tasks and output review, without a marketing template.
- R-11 PASS: existing 6px control and 10px panel radii are retained.
- R-15 PASS: actions name their operation, including Download Kyro profile, Add local account and Import file.
- R-16 PASS: product text uses concrete settings and behaviors, without marketing buzzwords.
- R-20 PASS: the existing Kyro palette, heading cut and status motif identify the page.
- R-21 PASS: existing dark, light and system theme controls remain functional.
- R-29 PASS: neutrals and one site accent are used; amber and red identify warnings and errors.
- R-30 PASS: no external product's visual design is cloned; the reference informed functionality.
- R-31 PASS: palette, typography, layout, spacing, markers and panels have recorded reasons.

## Human and responsive supplements

- Contrast PASS: measured visible text meets AA; inherited control edges and focus tokens meet the site's non-text contrast rules.
- Keyboard PASS: logical source order, native controls, tab arrow keys and dialog cancellation work.
- States PASS: status and errors have visible words and live announcements, not color alone.
- Reflow PASS: distinct single-column, intermediate and wide layouts exist at 38, 58 and 72 rem.
- Targets PASS: form controls and generator buttons have at least 44px height; checks are contained in clickable labels.
- Touch PASS: interactions use clicks or native controls, with no hover-only content.
- Fixed UI PASS: output is sticky only on wide screens; no fixed mobile navigation covers content.
- Zoom PASS: 200% text at 640px reflows without horizontal overflow.

## Account form follow-up

Reviewed the reported field alignment and stale validation errors on
2026-11-14. The existing design direction and dials remain unchanged.

- R-03 PASS: account inputs and selects have equal heights; adjacent controls align within one pixel in both themes at 390, 640, 960, 1200 and 1440 pixels. No horizontal overflow was detected.
- R-26 PASS: synchronous change-only autofill updates all account and domain fields without overwriting earlier changes. The browser test checks the generated XML values, including encoded passwords.
- R-27 PASS: invalid account names show an inline explanation; incomplete validation no longer shows the misleading No warnings heading.
- R-32 PASS: invalid account-name inputs expose aria-invalid and reference their error text with aria-describedby. Native controls and existing focus styles remain intact.
- R-34 PASS: alignment checks cover dark and light themes; the existing complete browser flow still covers the theme selector and keyboard controls.
- R-35 PASS: lint, build, all 86 unit/site tests and all three browser tests passed. The corrected account form was also visually inspected from a browser screenshot.
- R-31 PASS: fields keep their natural height so helper text cannot stretch adjacent controls; functional state updates preserve changes when autofill updates several fields together.
