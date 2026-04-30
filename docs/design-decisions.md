# Design Decisions: AmIBroke Finance Tracker

**Source:** Google Stitch project `10442589427945109783`
**System name:** The Velvet Ledger
**Mode:** Dark only — no light mode
**Platform Target:** Web — desktop only (1280px+ viewport)

---

## Color System

### Surface Hierarchy

Treat the UI as physical layers. Each inner card shifts one step up in the container tier.

| Level | Token | Hex | Usage |
|-------|-------|-----|-------|
| 0 | `surface` | `#131313` | Main canvas, page background |
| 1 | `surface-container-low` | `#1c1b1b` | Section blocks, sidebar background |
| 2 | `surface-container-high` | `#2a2a2a` | Cards, active elements |
| Recessed | `surface-container-lowest` | `#0e0e0e` | Input fields at rest |
| Hover | `surface-container-highest` | `#353534` | List item hover, progress bar tracks |

### Semantic Accent Colors

| Role | Text token | Container token | Usage |
|------|-----------|-----------------|-------|
| Primary — growth/income | `#4edea3` | `#10b981` | Income values, positive numbers, CTAs |
| Secondary — investments | `#adc6ff` | `#0566d9` | Investment data, future-facing figures |
| Tertiary — spending | `#ffb3ad` | `#ff7a73` | Spending, outflows, negative values |
| Error | `#ffb4ab` | `#93000a` | Form validation errors |

### Text Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `on-surface` | `#e5e2e1` | All primary text — never use `#ffffff` |
| `on-surface-variant` | `#bbcabf` | Labels, secondary text, metadata |
| `outline` | `#86948a` | Standard outline |
| `outline-variant` | `#3c4a42` | Ghost border base (used at 15% opacity) |

---

## The No-Line Rule

**Strictly enforced.** Never use 1px solid borders to divide UI sections.

Separation is achieved only through:
1. **Background shifts** — a `surface-container-low` section placed on a `surface` canvas is visually distinct without any border
2. **Negative space** — generous padding creates distinct visual islands

**Ghost Border (fallback only):** `outline-variant` at 15% opacity — use only when a background shift alone is insufficient for accessibility. Never decorative.

---

## Glassmorphism

Applied to: Add Transaction modal, dropdowns, tooltips — any floating element.

```css
background: rgba(53, 53, 52, 0.4); /* surface-variant at 40% opacity */
backdrop-filter: blur(24px);
box-shadow: 0px 24px 48px rgba(0, 0, 0, 0.4);
```

No hard border on glassmorphism elements. Ghost border fallback if accessibility requires containment.

---

## Typography

Two typefaces with strict role assignments — never mix them.

| Scale | Typeface | Weight | Letter-spacing | Usage |
|-------|----------|--------|----------------|-------|
| Display | Manrope | 700 | default | Hero numbers: Liquid Cash, Net Worth totals |
| Headline | Manrope | 600 | default | Section titles, tab headers |
| Body | Inter | 400 | `+0.01em` | Transaction lists, descriptions, supporting text |
| Label | Inter | 500 | `+0.05em` | Uppercase category tags, metadata, timestamps |

Primary text color: `on-surface` (`#e5e2e1`). Never `#ffffff`.

---

## Buttons

| Type | Background | Text | Shape |
|------|-----------|------|-------|
| Primary CTA | `#10b981` | `#00422b` | `rounded-md` (6px) |
| Secondary / ghost | Transparent | `#4edea3` | `rounded-md`, outline at 20% opacity |
| Destructive | `#ff7a73` | `#79000e` | `rounded-md` |

---

## Data Visualization

### Color Assignments
- Income / positive: `#4edea3` (emerald)
- Spending / negative: `#ffb3ad` (soft red)
- Investments: `#adc6ff` (electric blue)

### Active Data Points
Active points on charts get an outer glow using their own color:
```css
filter: drop-shadow(0 0 6px #4edea3); /* emerald glow for income */
```

### Progress Bars
- Track: `surface-container-highest` (`#353534`)
- Fill: `linear-gradient(135deg, #4edea3, #10b981)`

### Signature Gradient (CTAs, growth charts)
```css
background: linear-gradient(135deg, #4edea3, #10b981);
```

---

## Cards and Lists

- No dividers between list items — background shifts only
- List item resting: `surface-container-low` (`#1c1b1b`)
- List item hover: `surface-container-highest` (`#353534`)
- Internal card padding: `1.5rem` minimum

---

## Input Fields

| State | Background | Border |
|-------|-----------|--------|
| Resting | `#0e0e0e` | Ghost border — `outline-variant` at 15% opacity |
| Focused | `#0e0e0e` | `primary` (`#4edea3`) at 100% opacity |
| Error | `#0e0e0e` | `error` (`#ffb4ab`) |

---

## Layout

**Asymmetric two-column + feed:**

```
+-- Sidebar (220px) --+-- Main content (~60%) --+-- Feed (~30%) --+
| surface-container   |  surface (#131313)       |  surface        |
| low (#1c1b1b)       |                          |                 |
+---------------------+--------------------------+-----------------+
```

Top bar: `surface-container-low`, contains global time range selector (Monthly / Quarterly / Yearly) and manual sync button. Spans full width above the column layout.

No horizontal rules or separators anywhere in the layout.

---

## Component Libraries

| Library | Role |
|---------|------|
| shadcn/ui | All base components: dialog, select, button, input, table, dropdown |
| Recharts | All charts: line, donut/pie, bar — styled to Velvet Ledger palette |

**Critical:** Velvet Ledger overrides all shadcn defaults. Apply the color tokens above to every shadcn component. Do not use shadcn's default gray/zinc/slate palette anywhere.
