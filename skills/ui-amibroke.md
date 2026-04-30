# Skill: UI — AmIBroke Finance Tracker

> Project-specific UI skill. Overrides `skills/ui.md` for this project.
> Check `manifest.md` — this skill is listed there. Use it instead of the base `@ui` skill.

---

## Purpose
Builds UI components for AmIBroke using the Velvet Ledger design system defined in `docs/design-decisions.md`. Applies dark-mode tokens, tonal layering, glassmorphism, and Manrope/Inter typography consistently across all six tabs.

---

## Modes

### `@ui-amibroke` (reference)
Confirms active design direction and platform target. Reads `docs/design-decisions.md` and reports: active color tokens, platform constraints, and component library.

### `@ui-amibroke [feature]`
Builds the specified feature or component using Velvet Ledger rules. Examples:
- `@ui-amibroke dashboard` — builds Dashboard tab layout and cards
- `@ui-amibroke add-transaction-modal` — builds the glassmorphism modal
- `@ui-amibroke spending-chart` — builds a Recharts donut/bar chart with Velvet Ledger palette

---

## Pre-conditions

Before building any component:
1. Read `docs/design-decisions.md` — confirm color tokens and rules are loaded
2. Read the task spec in `docs/plan.md` — understand exactly what to build
3. Confirm stack: Next.js 14 App Router, React, Tailwind CSS, shadcn/ui, Recharts
4. Check `manifest.md` → `## Available MCPs` — use Playwright for visual verification if configured

### Platform Constraints
**Web — desktop only.** Applied to every component:
- Minimum viewport: 1280px — no mobile breakpoints required
- Hover interactions: allowed and encouraged
- Dense information layouts: acceptable
- Touch targets: not a constraint

---

## Process

### For every component:
1. Identify the surface tier — which level (0 / 1 / 2 / recessed) does this component sit on?
2. Apply background color from the surface hierarchy — never add a border to separate it
3. Apply correct typography: Manrope for any number or title, Inter for body and labels
4. Apply correct accent color: emerald for income/positive, blue for investments, soft red for spending
5. Use shadcn/ui as the base component — override its default palette with Velvet Ledger tokens
6. Present code to builder for review before writing to disk

### For charts (Recharts):
1. Use `#4edea3` for income series, `#ffb3ad` for spending series, `#adc6ff` for investment series
2. Apply glow on active/hover data points via `filter: drop-shadow`
3. Chart background: `surface` (`#131313`) — no chart border
4. Grid lines: `surface-container-high` (`#2a2a2a`) at low opacity — subtle only
5. Tooltip: glassmorphism style — `surface-variant` at 40% opacity, `backdrop-blur-md`

### For modals (glassmorphism):
1. Overlay: `rgba(0,0,0,0.6)` backdrop
2. Modal panel: `rgba(53, 53, 52, 0.4)` + `backdrop-filter: blur(24px)`
3. Shadow: `0px 24px 48px rgba(0,0,0,0.4)`
4. No hard border — ghost border fallback only if accessibility requires it
5. Use shadcn `Dialog` as the base — override background and backdrop styles

### For lists and transaction feeds:
1. No `<hr>` or border-bottom between items — ever
2. Each item: `surface-container-low` (`#1c1b1b`) background
3. Hover: transition to `surface-container-highest` (`#353534`)
4. Padding: `1.5rem` horizontal, `0.75rem` vertical minimum

### For input fields:
1. Resting background: `surface-container-lowest` (`#0e0e0e`)
2. Resting border: `outline-variant` (`#3c4a42`) at 15% opacity
3. Focus border: `primary` (`#4edea3`) at 100% opacity — transition with `duration-150`
4. Use shadcn `Input` — override background and ring styles

---

## Tailwind Configuration Requirements

The following custom colors must be added to `tailwind.config.ts` before any components are built:

```ts
colors: {
  surface: '#131313',
  'surface-low': '#1c1b1b',
  'surface-high': '#2a2a2a',
  'surface-highest': '#353534',
  'surface-lowest': '#0e0e0e',
  'surface-variant': '#353534',
  primary: '#4edea3',
  'primary-container': '#10b981',
  secondary: '#adc6ff',
  'secondary-container': '#0566d9',
  tertiary: '#ffb3ad',
  'tertiary-container': '#ff7a73',
  'on-surface': '#e5e2e1',
  'on-surface-variant': '#bbcabf',
  'outline-variant': '#3c4a42',
}
```

Google Fonts: load `Manrope` (weights 600, 700) and `Inter` (weights 400, 500) via `next/font/google`.

---

## Visual Verification

If Playwright MCP is listed in `manifest.md → ## Available MCPs`:
1. After building each component, take a screenshot
2. Compare against `docs/design-decisions.md` — surface tier correct? Accent color correct? No borders?
3. Report: "Screenshot taken — matches design direction." or "Gap found: [specific issue], fixed."

If no Playwright MCP: report the component built and note "No visual MCP — visual verification skipped."

---

## Common Violations to Catch

Before presenting any component for review, self-check:
- [ ] No `border` or `divide-` Tailwind classes used for layout separation
- [ ] No `#ffffff` or `white` text color anywhere — use `#e5e2e1`
- [ ] No shadcn default gray/zinc/slate backgrounds — all replaced with surface tokens
- [ ] Numbers and titles use Manrope — body text uses Inter
- [ ] Positive values colored `primary` (`#4edea3`), negative colored `tertiary` (`#ffb3ad`)
- [ ] Investment data colored `secondary` (`#adc6ff`)

---

## Closing

After building, approval, writing, and visual verification:
"Built [component] — Velvet Ledger applied. Surface tier: [level]. [Screenshot match / No visual MCP configured]. Next: [next task from plan.md]."
