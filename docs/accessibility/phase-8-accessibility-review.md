# Phase 8 accessibility review

Per the root README's Phase 8 checklist item "Conduct accessibility
testing", and the spec's WCAG 2.2 AA requirement. This is scoped
honestly to what actually exists: almost no rendered page UI has been
built yet. Phases 2-7 were entirely backend/API work (domain use cases
and Next.js route handlers, no page components); the only real,
rendered UI in this repository is the Phase 0/1 foundation scaffold -
one page (`apps/web/app/page.tsx`), the root layout
(`apps/web/app/layout.tsx`), and five design-system primitives
(`Button`, `Input`, `Skeleton`, `EmptyState`, `ErrorState`) that no page
currently uses.

**What this review is not**: a testing pass against the real
five-destination product experience (Today, Learn, Build, Execute,
Review) - that UI doesn't exist yet, so there is nothing there to test.
Claiming otherwise would be exactly the kind of fabricated completion
this session's other Phase 8 slices (legacy data, parity) already
refused to do for the same reason. What follows is a genuine review of
what's actually in the tree.

## Method and findings

### Fixed

- **Two design-system colors failed WCAG 2.2 AA contrast** - computed
  the actual relative-luminance/contrast-ratio formula (not eyeballed)
  for every color pair used in the existing page and components:
  - `Input`'s border (`border-gray-300`, 1.47:1) and placeholder text
    (`placeholder:text-gray-400`, 2.54:1) both failed - SC 1.4.11
    requires 3:1 for a form field's visible boundary, SC 1.4.3 requires
    4.5:1 for text. Both now use `gray-500` (4.83:1), the lightest step
    in this palette that clears both requirements.
  - `EmptyState`'s dashed border (`border-gray-300`, same 1.47:1) - same
    fix, same reasoning.
  - `tokens.ts`'s own `color.border` token (`#d2d2d7`, 1.51:1) - a
    second, independent instance of the same gap, in a file whose other
    four colors' contrast claims were verified accurate. Fixed to
    `#8e8e93` (~3.3:1), staying within the token file's existing
    Apple-inspired palette.
  - Every other color already in use (headings, body text, button
    text/backgrounds, error states) was checked the same way and
    already passes - see `packages/design-system/src/tokens.test.ts`
    for the full, automated list.

- **`eslint-plugin-jsx-a11y` was not installed or configured at all** -
  a real, structural gap: no automated check existed for missing alt
  text, unlabeled form controls, interactive `div`s, or any of the
  dozens of common accessibility mistakes this plugin's recommended
  rule set catches. Added and wired into `eslint.config.mjs`.

- **The `.tsx` lint block was not actually running on any file** -
  found while verifying the jsx-a11y addition actually worked: the glob
  `files: ["**/*.{tsx}"]` is a single-item brace group, which this
  project's glob matcher does not expand into an alternation - it only
  matches a filename literally ending in the four characters `.{tsx}`,
  which no real file has. This meant **react's and react-hooks'
  recommended rules were also silently never enforced**, not just the
  newly-added jsx-a11y rules - a pre-existing bug, not something this
  slice introduced. Confirmed the fix by deliberately planting a
  missing-`alt` `<img>` and a missing-`key` list render in a scratch
  file: neither was flagged with the old glob, both were flagged
  immediately after changing it to `**/*.tsx`. Running the corrected
  lint config against every real file in the repository found zero
  violations - the existing code was already accessible, only the
  enforcement mechanism was broken.

### Confirmed already correct (in the code that exists)

- `apps/web/app/layout.tsx` sets `lang="en"` on `<html>` - required for
  assistive technology to pronounce content correctly.
- `apps/web/app/page.tsx` uses genuine semantic HTML (`<main>`, a single
  `<h1>`, paragraphs) rather than generic `<div>`s standing in for
  structural elements.
- `Button.tsx` renders a native `<button>` (correct keyboard
  activation - Space/Enter - and focus behavior for free, rather than a
  styled `<div>` with a click handler) and has a visible
  `focus-visible` outline.
- `Input.tsx` wires its label, hint and error text together correctly
  (`htmlFor`/`id`, `aria-describedby`, `aria-invalid`) - never relies on
  color alone to convey an error state, and the error text itself has
  `role="alert"` so assistive tech announces it without the user having
  to find it visually.
- `ErrorState.tsx` uses `role="alert"` for the same reason.
- `Skeleton.tsx` is marked `aria-hidden="true"` (it's a loading
  placeholder, not real content) and respects `prefers-reduced-motion`
  via `motion-reduce:animate-none` instead of forcing the pulse
  animation on everyone.

## What's still untested, honestly

- **Keyboard navigation and screen-reader walkthroughs** of a real
  multi-page flow - there is exactly one static page with no
  interactive elements to tab through yet, so there is no navigation
  flow to test. This needs a real page (or several) to exist first.
- **The five design-system primitives in actual use** - `Button`,
  `Input`, `Skeleton`, `EmptyState`, and `ErrorState` are reviewed here
  as standalone components, but no page currently renders any of them,
  so their behavior inside a real form or list has not been observed.
- **Automated tooling beyond linting** - no axe-core/Lighthouse
  accessibility scan has been run, since there is no meaningfully-sized
  rendered page to scan yet; running one against a single static
  paragraph would produce a report with nothing to say.
- **Manual assistive-technology testing** (a real screen reader, not
  just the ARIA attributes' correctness on paper) has not been done at
  all.

All of the above should happen as real pages get built in a future
phase - this review's job was to make sure the _foundation_ (design
tokens, shared primitives, and the tooling that catches regressions)
starts from a genuinely accessible baseline, which it now does more
concretely than before this pass (a working contrast test, a working
lint rule set) as well as in the two respects fixed above.

## Verification

- `pnpm -r typecheck`, `pnpm lint`, `pnpm test` (full monorepo) - all
  green, including the new `packages/design-system/src/tokens.test.ts`
  (10 tests: six real contrast checks plus four tests proving the
  contrast-ratio helper itself is correct and discriminates pass/fail,
  including a literal regression test against the exact color value
  this audit fixed).
- Proved the new jsx-a11y/react lint enforcement actually works, not
  just that it's configured: planted two deliberate violations
  (missing `alt`, missing `key`) in a scratch file, confirmed both were
  silently missed under the old broken glob and both correctly flagged
  after the fix, then removed the scratch file and re-ran lint clean
  against the real repository.
