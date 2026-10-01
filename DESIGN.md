# SkillBridge — Design System

> The single source of truth for how SkillBridge looks, moves, and behaves.
> This document describes the system **as it exists in code today**. It is not an
> aspiration. Every token, radius, shadow, and timing below was read out of the
> source. Where the current implementation has a known weakness, it is marked
> **[KNOWN GAP]** and carries a binding rule for future work.

**Read this before writing any UI code.** If your change needs a value that is not
in this document, you do not get to invent one — you extend this document first,
or you reuse something that already exists. See §12.

---

## Table of contents

1. [Product identity](#1-product-identity)
2. [Atmosphere and visual thesis](#2-atmosphere-and-visual-thesis)
3. [Color](#3-color)
4. [Typography](#4-typography)
5. [Spacing, layout, and grid](#5-spacing-layout-and-grid)
6. [Navigation](#6-navigation)
7. [Buttons and interaction states](#7-buttons-and-interaction-states)
8. [Surfaces, cards, radii, borders, shadows](#8-surfaces-cards-radii-borders-shadows)
9. [Forms and inputs](#9-forms-and-inputs)
10. [Data, tables, and dashboards](#10-data-tables-and-dashboards)
11. [Icons](#11-icons)
12. [Motion](#12-motion)
13. [Responsive behavior](#13-responsive-behavior)
14. [Accessibility](#14-accessibility)
15. [Anti-generic-AI-UI rules](#15-anti-generic-ai-ui-rules)
16. [Do's and Don'ts](#16-dos-and-donts)
17. [Change protocol](#17-change-protocol)

---

## 1. Product identity

**SkillBridge** is an education-to-employment platform. It reads a learner's
resume, compares it against a target role, and returns a ranked roadmap of the
skills to acquire next, sized to the time the learner actually has.

| | |
|---|---|
| **Audience** | Students and early-career professionals, typically 16–25, planning a first or second career move. |
| **Promise** | "Here is the shortest credible path from where you are to the job you want." |
| **Tone** | Calm, precise, evidence-backed. Never gamified, never hustle-coded, never condescending. |
| **Register** | Plain professional English. Short declaratives. No exclamation marks. No growth-marketing verbs. |
| **Density** | Information-dense on product surfaces, spacious on marketing surfaces. The product earns trust by showing detail, not by hiding it. |

### Voice rules

- Lead with the **decision**, not the feature. "Embedded Systems is your #2 gap" beats "Our AI-powered analysis engine surfaces key skills."
- Percentages and job-posting counts are the product's credibility. Show them.
- Never invent urgency, scarcity, or social proof. There is no "students are enrolling now."
- Copy is sentence case everywhere, including buttons and headings.

---

## 2. Atmosphere and visual thesis

**The thesis: a calm violet blueprint on paper, annotated by hand.**

SkillBridge's identity comes from a deliberate tension between two registers that
the product holds together on purpose:

- **The analytical layer** — precise, cool, engineered. Space Grotesk. Violet
  `#5b46d8`. Thin violet lines. Tabular numerals. Sortable rows. Workspace chrome.
- **The human layer** — warm, loose, encouraging. Public Sans body copy. Kalam
  handwriting for annotations. Cream `#f6efe1` paper. Slightly rotated sticky notes.

The analytical layer earns trust. The human layer is why anyone reads it. A screen
that is only analytical feels like a spreadsheet. A screen that is only human feels
like a blog. The final conversion moment of the entire site — the closing CTA — is
the one place the two fully commit: cream paper, hand annotations, an illustrated
scene, soft and warm against everything before it.

**What we are not:** we are not a neon cyber dashboard, not a glassmorphic
"AI-native" product, not a dark-mode-first developer tool, and not a playful
cartoony education brand. Those are all generic. See §15.

### Light-mode only

`color-scheme: light` is set deliberately. There is no dark theme and no theme
switcher. Do not add one without a full token re-derivation — the paper metaphor
in §2 is load-bearing, and it does not survive inversion.

---

## 3. Color

The system runs on **three scoped token sets**, not one. This is the single most
important structural rule in this document.

- **`src/styles.css` `:root`** — the marketing site. Neutral-cool grays with a
  cool indigo brand.
- **`src/components/careerBridge.css` `.career-bridge`** — the product workspace.
  A deliberately **separate, warmer** scope (`--cb-*`), so the workspace never
  inherits or fights homepage tokens. Comment in source: *"Scoped to the component;
  does not touch global/homepage styles."*
- **`src/components/ctm.css` `.ctm`** — the Curriculum Time Machine workspace
  (`--ctm-*`). Same rule, same reason: the CTM page is a workspace, not marketing,
  so it gets its own scope rather than reaching into `:root`. Its values are
  **not** new values — every one is copied from the `--cb-*` table in 3.2, so the
  two workspaces read as one product.

Never mix the scopes. A `--cb-*` token inside `src/styles.css` is a bug. A `:root`
token inside `careerBridge.css` or `ctm.css` is a bug. A `--ctm-*` token outside
`ctm.css` is a bug.

### 3.1 Global palette (marketing)

| Token | Hex | Role |
|---|---|---|
| `--paper` | `#f7f7f7` | Page background. The default canvas. |
| `--paper-2` | `#f0f0f0` | Recessed band, alternating section background. |
| `--card` | `#ffffff` | Elevated surface. |
| `--ink` | `#17151f` | Primary text, near-black with a violet cast. |
| `--ink-2` | `#4a4658` | Secondary text, body copy. |
| `--muted` | `#8c8796` | Tertiary text, metadata. **Never body copy** — see gap below. |
| `--line` | `#e7e6ea` | Card and section borders. |
| `--line-soft` | `#f0eff2` | Internal dividers, hairlines. |
| `--indigo` | `#4b33a5` | Brand primary. Buttons, active state, kicker rule. |
| `--indigo-deep` | `#372a80` | Brand primary hover/pressed. |
| `--indigo-bright` | `#5a44f0` | Brand accent on dark or artwork surfaces. |
| `--lavender` | `#b3a1fd` | Decorative only. **Never text.** |
| `--lavender-soft` | `#e9e7fb` | Tinted chip / hover fill. |
| `--lavender-pale` | `#f6f4fd` | Tinted panel / active row fill. |
| `--slate` | `#4a4657` | Neutral supporting text. |
| `--panel` | `#f6efe1` | Warm cream. The final CTA only. |
| `--panel-line` | `#ecdfc9` | Warm divider inside the CTA. |

### 3.2 Career Bridge palette (product workspace)

| Token | Hex | Role |
|---|---|---|
| `--cb-paper` | `#f8f7f3` | Workspace background. Warm off-white, **not** gray. |
| `--cb-card` | `#ffffff` | Panel and card surface. |
| `--cb-ink` | `#15131c` | Primary text. |
| `--cb-ink-2` | `#4c4859` | Secondary text, descriptions. |
| `--cb-muted` | `#8d8794` | Labels, metadata, hours. |
| `--cb-violet` | `#5b46d8` | Brand. Rank, active row, links, slider fill. |
| `--cb-violet-deep` | `#4433b0` | Link hover, emphasized violet. |
| `--cb-lilac` | `#a79bf0` | Decorative, borders, left rules. **Never body text.** |
| `--cb-violet-soft` | `#e7e2fb` | Chip fill / border. |
| `--cb-violet-pale` | `#f2effc` | Hover and active row fill. |
| `--cb-line` | `#e5e2e4` | Panel border. |
| `--cb-line-soft` | `#ece9e6` | Internal divider. |

Note the workspace violet `#5b46d8` and the marketing indigo `#4b33a5` are
**different values on purpose.** Do not "harmonize" them.

### 3.3 Semantic data colors

Trend is encoded with a **colored dot inside a tinted circle**, never as a bare
colored word. The tint provides the fill, the text color provides the label, and
the shape carries the meaning redundantly.

| Trend | Text | Background |
|---|---|---|
| Rising | `--cb-rise` `#1e7a4f` | `--cb-rise-bg` `#e6f1eb` |
| Stable | `--cb-stable` `#6a6e78` | `--cb-stable-bg` `#ececee` |
| Declining | `--cb-fall` `#c2503b` | `--cb-fall-bg` `#f8e9e5` |

Priority is a **pill chip** with text + tinted background + tinted border:

| Priority | Text | Background | Border |
|---|---|---|---|
| High | `#4d3cc0` | `#f3eefb` | `#ddd5f5` |
| Medium | `#7a6246` | `#f4efe6` | `#e5dccb` |
| Low | `#3e7a55` | `#eaf3ec` | `#d5e5db` |

Priority colors are deliberately **not** a red/amber/green ramp. High is violet
because it is a *priority*, not a *warning*; medium is a warm brown; low is a
muted green. They must not read as a severity scale.

### 3.4 Verified contrast

Measured WCAG 2.1 ratios from the actual hex values. This table is the reason
several tokens have the restrictions they do.

| Pair | Ratio | Verdict |
|---|---|---|
| `--ink` on `--paper` | 16.85 | AAA |
| `--ink-2` on `--paper` | 8.49 | AAA |
| `--indigo` on `--paper` | 8.46 | AAA |
| `#fff` on `--indigo` | 9.07 | AAA |
| `#fff` on `--indigo-deep` | 11.63 | AAA |
| `#fff` on `--ink` | 18.05 | AAA |
| `#5b46d8` on `#f8f7f3` | 5.91 | AA |
| `#5b46d8` on `#fff` | 6.34 | AA |
| `#4d3cc0` on `#f3eefb` | 6.77 | AA |
| `#7a6246` on `#f4efe6` | 5.01 | AA |
| `#3e7a55` on `#eaf3ec` | 4.50 | AA (borderline) |
| `#1e7a4f` on `#e6f1eb` | 4.59 | AA |
| **`--muted` on `--paper`** | **3.26** | **FAILS AA for body text** |
| **`--muted` on `#fff`** | **3.49** | **FAILS AA for body text** |
| **`--cb-stable` on `--cb-stable-bg`** | **4.33** | **FAILS AA** |
| **`--cb-fall` on `--cb-fall-bg`** | **3.95** | **FAILS AA** |
| **`--lavender` on `--paper`** | **2.08** | Decorative only, never text |
| **`--cb-lilac` on `#fff`** | **2.44** | Decorative only, never text |
| **`--line` on `--paper`** | **1.16** | Borders only, never a sole boundary |

**[KNOWN GAP] `--muted` is used for 10–11px uppercase labels**, which is the worst
case — small text needs 4.5:1, and these land at 3.3–3.5:1. The same applies to
`--cb-stable` and `--cb-fall`.

**Binding rules:**
- `--muted` is for **large text, icons, and disabled states only** — never for
  copy a user must read to act.
- If new UI must convey meaning in `--muted` at small sizes, use `--ink-2`
  instead. Do not add a fourth gray.
- Any new trend or status color must reach **4.5:1** on its own tint. Verify it
  before shipping, do not eyeball it.

---

## 4. Typography

Three families, each with exactly one job. Loaded from Google Fonts in
`index.html`; referenced in CSS as `--font-display` and `--font-body`.

| Family | Variable | Job |
|---|---|---|
| **Space Grotesk** | `--font-display` | All headings, numerals, UI labels, and anything engineered. |
| **Public Sans** | `--font-body` | All body copy, descriptions, links, controls. |
| **Kalam** | `--font-hand` | Human annotations and handwritten notes **only**. |

**Kalam is not a text font.** It appears in exactly three contexts: hero
annotations, sticky notes, and the final CTA scene. It is never used for UI,
never for data, and never for anything a user must parse for accuracy.

### Type scale

Marketing surface:

| Role | Size | Line height | Tracking | Family |
|---|---|---|---|---|
| Hero line 1 | `clamp(30px, 8.6vw, 44px)` @≤720 | — | — | Display |
| Hero line 2 (accent) | `clamp(36px, 10.2vw, 54px)` @≤720 | — | — | Display, violet |
| Hero headline | `clamp(22px, 9.6vw, 40px)` @≤720 | — | — | Display |
| `.section-title` | `clamp(2.2rem, 4.6vw, 3.6rem)` | `1.06` | `-0.02em` | Display 700 |
| `.section-lead` | `17px` | `1.65` | — | Body, `--ink-2`, max `52ch` |
| `.section-kicker` | `13px` | — | `0.18em` | Body 600, uppercase |
| `.btn` | `15px` (`.btn-lg` 16px) | — | — | Body 600 |
| `.nav-link` | `14.5px` | — | `0.01em` | Body 500 |
| `.nav-cta` | `14px` | — | — | Body 600 |
| `.nav-logo` | `20px` | — | `-0.02em` | Display 700 |
| Hero note | `17px` → `15px` @≤720 | — | — | Hand (Kalam) |

Product workspace — the scale tightens sharply. Workspace data is dense on purpose:

| Role | Size | Family |
|---|---|---|
| Skill detail title | `clamp(1.15rem, 1.8vw, 1.5rem)` | Display 700 |
| Panel heading | `clamp(1rem, 1.6vw, 1.3rem)` | Display 700 |
| Summary headline | `14px` | Display 600 |
| Route name | `13px` | Body 600 |
| Description / body | `12.5px` | Body |
| Resource link | `12px` | Body |
| Hours, facts | `11.5–12px` | Body |
| Proof heading | `13px` | Display 700 |
| **All-caps label** | **`10px`, `0.11em` tracking** | Body 600, `--muted` |

**Binding rules**
- Headings are always `--font-display` at weight 600–700 with negative tracking
  (`-0.01em` to `-0.02em`). Never positive tracking on a heading.
- Uppercase is reserved for **10–13px labels** with wide tracking. Never uppercase
  a heading, a sentence, or a button longer than two words.
- Accent color inside a heading is done with `<em>` at
  `styles.css:662` — italic, `--indigo`. It is the one permitted italic.
- Body copy measure stays at or below `52ch`.
- Numerals that change in place (hours, ranks, totals) use
  `font-variant-numeric: tabular-nums` so the layout does not jitter.

---

## 5. Spacing, layout, and grid

### The two padding systems

```css
--section-pad: clamp(72px, 11vh, 132px) 6vw;   /* marketing, :root */
```

Marketing sections are vertically generous and view-relative. The vertical pad
shrinks to a flat `64px` at ≤720px.

```css
.career-bridge { padding: clamp(72px, 8vw, 80px) 0 0; }
.cb-inner      { width: min(100%, 1480px);
                 padding: 0 clamp(28px, 5vw, 72px); }
```

The workspace is **narrower-gutter and viewport-based**, because it is a tool, not
a story. It is a single-viewport surface: a user should never have to scroll far to
move the budget slider and watch the roadmap re-rank.

### Widths

| Context | Max width |
|---|---|
| Marketing measure | `760px` (`.subpage`) |
| Career Bridge inner | `min(100%, 1480px)` |
| Career Bridge hero art | `1580px` native |
| Subpage lead | `52ch` |

### Grid patterns

| Pattern | Definition |
|---|---|
| Summary row | `repeat(3, 1fr)`, gap `clamp(12px, 1.4vw, 18px)` |
| Workspace main | `minmax(0, 0.38fr) minmax(0, 0.62fr)` — list/detail split |
| Detail facts | `1fr 1fr`, gap `8px 18px` |
| Proof cards | `repeat(3, 1fr)`, gap `12px` |
| Resources | `1fr 1fr`, gap `3px 14px` |
| Homepage two-up | `1fr 1fr` (Impact, Roadmap) |

The `minmax(0, …)` on the workspace columns is mandatory. It is what allows long
skill names to ellipsize instead of forcing the grid to overflow.

### Spacing rhythm

Use these steps. Do not introduce a 7px or a 13px margin.

```
4 · 5 · 6 · 7 · 8 · 10 · 12 · 14 · 16 · 18 · 20 · 24 · 30 · 32
```

Internal padding: `clamp(12px, 1.4vw, 20px)` for panels, `10px clamp(10px, 1.2vw, 16px)`
for summary cards, `8px` for rows, `4px 7px` for resource links.

---

## 6. Navigation

A single fixed navbar serves every route. There is no per-page header.

```
┌──────────────────────────────────────────────────────────────┐
│ [logo]              [link] [link] [link]        [Get Started] │
└──────────────────────────────────────────────────────────────┘
```

| Property | Value |
|---|---|
| Position | `fixed`, `z-index: 40` |
| Height | `80px` desktop → `64px` at ≤720px |
| Horizontal padding | `clamp(24px, 5vw, 88px)` → `6vw` at ≤720px |
| Background | transparent at top, `--paper` + `--line-soft` bottom border once scrolled |
| Transition | `0.3s ease` on background and border-color |
| Layout | `space-between`; center links absolutely positioned at `left: 50%` + `translateX(-50%)` |
| Link gap | `clamp(18px, 2.6vw, 34px)` |

### Active state

The active link is marked by a **4px dot below the label** (`.nav-dot`), not by a
color change, background pill, or underline bar.

```css
.nav-dot { width: 4px; height: 4px; border-radius: 50%;
           background: var(--ink); opacity: 0; }
.nav-link.is-active .nav-dot { opacity: 1; }
```

The dot is a child of the link and inherits the link's color on hover. Reserve
vertical space for it at all times so activating a link never shifts the navbar.

### Mobile navigation

At ≤720px there is **no hamburger and no menu drawer**. Instead:

```css
.nav-center .nav-link:not(.is-active) { display: none; }
```

The active route is shown, the rest collapse. This is deliberate — the site has
four routes and a persistent CTA. Do not introduce a hamburger menu without a
navigation design review.

The `.nav-cta` shrinks to `padding: 8px 14px; font-size: 13px` at ≤720px and
remains visible at every width.

---

## 7. Buttons and interaction states

### The base

```css
.btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: 8px;
  border-radius: 999px;          /* pill */
  font-weight: 600; font-size: 15px;
  padding: 13px 24px;
  border: 1.5px solid transparent;
  transition: background 0.2s ease, border-color 0.2s ease,
              color 0.2s ease, transform 0.2s ease;
}
.btn:hover  { transform: translateY(-2px); }
.btn-lg     { padding: 16px 30px; font-size: 16px; }
```

All buttons are **pills**, all are **1.5px bordered**, and all lift **2px on
hover**. Buttons are not rounded rectangles. Never introduce a `border-radius`
between 4px and 16px on a button.

### Variants

| Class | Rest | Hover | Contrast |
|---|---|---|---|
| `.btn-primary` | `--indigo` bg, `#fff` text | `--indigo-deep` bg | 9.07 / 11.63 — AAA |
| `.btn-dark` | `--ink` bg, `#fff` text | `#2b2833` bg | 18.05 — AAA |
| `.btn-ghost` | transparent, `--ink` text, `#d8d8d8` border | border → `--ink` | 18.05 — AAA |

`.nav-cta` is a fourth, navigation-scoped pill: `--ink` bg, `#fff` text, `1px`
border, `padding: 9px 16px`, hover `background: #000` + `translateY(-1px)`.

### Binding rules

- **One primary per view.** If a section has two `.btn-primary` elements, one of
  them is wrong.
- Primary is for the single next action. Ghost is for the alternative. Dark is
  reserved for high-contrast conversion moments.
- Icon inside a button: `8px` gap, icon `11px` (`.nav-arrow`), stroke not fill.
- Button labels are sentence case, verb-first, 1–3 words: "See the roadmap",
  "Get started", "Re-upload".
- Every button is a real `<button>`. A link that navigates is an `<a>`; a button
  that acts in place is a `<button>`. Never an `<a>` with `onClick` alone, never a
  `<div>` with a click handler.

### Interactive rows and links

| Element | Rest | Hover | Active/selected |
|---|---|---|---|
| `.cb-route` row | transparent bg, transparent border, `9px` radius, `6px 8px` pad | `--cb-violet-pale` bg + `--cb-lilac` border, arrow nudges `-1px` | `.is-active`: pale bg + `--cb-violet` border, name turns violet |
| `.cb-evidence-toggle` | card bg, `--cb-line` border, `12px` radius, 11px uppercase | pale bg + lilac border | `.is-open` same, chevron rotates `180deg` |
| `.cb-resource` | transparent border, `8px` radius | pale bg, lilac border, `translateY(-1px)`, icon opacity → 1 | — |
| `.cb-proof-link` | violet text, transparent | `gap` grows `6px` → `10px`, color → `--cb-violet-deep` | — |
| `.cb-reupload` | transparent, lilac border pill, 10.5px | pale bg, violet border | — |

Note the two distinct hover idioms, both intentional:
- **Fill and border** for row-like targets that need a selected state.
- **Micro-translation** (`-1px` / `-2px`) and **gap growth** for links that should
  feel like a link, not a control.

Selected rows always pair the tint with a border-color change, so selection is
not conveyed by background alone.

---

## 8. Surfaces, cards, radii, borders, shadows

### Radii — a deliberately narrow set

| Radius | Where |
|---|---|
| `999px` | All buttons, all chips, all pills, the nav dot, the slider |
| `16px` | Workspace panels (`.cb-panel`) |
| `14px` | Summary cards (`.cb-summary-card`) |
| `12px` | Evidence toggle and panel, proof cards, nav? no |
| `9px` | Route rows |
| `8px` | Resource links, icon tiles (`.cb-summary-icon`, `.cb-fact-ic`, `.cb-proof-ico`) |
| `7px` | `.cb-evidence-ic` |
| `6px` | Label icon tiles (`.cb-label-ic`) |
| `5px` | Smallest icon tile (`.cb-fact-ic`) |
| `3px` | Kicker rule (`.section-kicker::before`) |

**Binding rule:** panels are `12–16px`, controls inside them are `5–9px`, and
everything clickable-shaped is a pill. The large-radius-containment-smaller-radius
relationship is intentional and must be preserved. There is no `border-radius`
between 16px and 999px in this system.

### Borders

- Marketing cards: `1px solid var(--line)`.
- Workspace panels: `1px solid var(--cb-line)`.
- Internal dividers: `1px solid var(--line-soft)` / `--cb-line-soft`.
- Buttons: `1.5px solid transparent` (ghost overrides to `#d8d8d8`).
- Tinted chips: `1px` in a lighter tint of their own background.

All borders are hairlines. No 2px+ borders, ever.

### Shadows — exactly two recipes

```css
/* marketing, styles.css:487 */
box-shadow: 0 16px 36px rgba(23, 21, 31, 0.06), 0 2px 5px rgba(23, 21, 31, 0.03);

/* workspace panels & summary cards, careerBridge.css */
box-shadow: 0 16px 32px rgba(91, 70, 216, 0.05), 0 4px 12px rgba(16, 16, 16, 0.04);
```

Both are two-layer, low-alpha, wide-blob + tight-contact. The marketing version is
neutral-tinted; the workspace version is violet-tinted. That difference is
intentional.

Plus one raised state:

```css
box-shadow: 0 12px 26px rgba(16, 16, 16, 0.14);   /* styles.css:1415, lifted element */
```

**Binding rules**
- Resting shadows are `0.04–0.06` alpha. If a shadow is visible at a glance, it is
  too dark.
- Never use a shadow to create a hover effect; use a background, border, or
  transform. Shadows are for elevation, not feedback.
- No colored/neon glows, no `0 0 40px` bloom, no multi-ring stacked shadows.
- Do not add a third shadow recipe without documenting it here.

### Gradient policy

The `styles.css` header states the rule: **no gradients, no glassmorphism, no
invented decoration.** Existing radial wash glows behind the hero illustration and
gradients inside the CTA illustration SVG are **baked into the artwork**, and are
part of the approved visual, not a CSS technique to copy.

**Binding rule:** do not add a `linear-gradient` or `radial-gradient` to a CSS
surface, border, or background. Artwork may contain them. If a design seems to
need a gradient fill, it needs a different design.

**Documented exception — subpage hero legibility scrim.** A subpage hero that sits
directly under a photograph or illustration may lay paper-to-transparent
`linear-gradient` scrims over the artwork so the headline keeps AA contrast. This
is a scrim over artwork, not a fill on a surface, and it is the only gradient the
system permits outside artwork. It ships in `.ev-hero-copy` (Evidence, a single
horizontal ramp) and `.ctm-top-art-veil` (Curriculum Time Machine, a horizontal
ramp plus a vertical top wash on its `::after`); match one of those rather than
inventing a new ramp. Constraints: the page's own paper token only, no hue shift,
no mesh, no second brand colour, at most a horizontal ramp plus a vertical top
wash, and never on a card, panel, or button. Any other gradient need still
requires a different design.

---

## 9. Forms and inputs

There is no traditional form in the product today. The Career Bridge input row is
a **budget slider** plus a file re-upload control, and its patterns are the
reference for any future input.

### Slider

```css
.cb-slider { width: 100%; height: 5px; appearance: none;
             border-radius: 999px; background: var(--cb-violet-soft); }
/* thumb: 15px circle, 3.5px solid --cb-violet, white center,
   0 2px 6px rgba(91,70,216,0.3) */
.cb-slider:hover::-webkit-slider-thumb { transform: scale(1.08); }
.cb-slider:active::-webkit-slider-thumb { transform: scale(1.16);
  box-shadow: 0 0 0 6px rgba(91, 70, 216, 0.16), ...; }
.cb-slider:focus-visible { box-shadow: 0 0 0 3px rgba(91, 70, 216, 0.22); }
```

A 5px track is too thin to be a hit target, so the `<input>` keeps full slider
height for interaction and the visible rail is drawn by CSS. Both `-webkit-` and
`-moz-` thumb rules are maintained — dropping one breaks Firefox or Chrome
silently.

Scale labels sit under the rail at `9px` in `--cb-muted`, distributed with
`justify-content: space-between`. The value readout is display type at
`clamp(1.15rem, 1.8vw, 1.35rem)`, with its unit in `12px` `--cb-muted` on the
same baseline (`align-items: baseline`).

Range: `10–200` hours, default `60`, snap bands at `30 / 60 / 90 / 120 / 150`.

### File / re-upload control

Rendered as a small text pill, not a `<label>`-dropzone: violet text, `--cb-lilac`
border, `border-radius: 999px`, `padding: 3px 8px`, `10.5px`. Hover fills
`--cb-violet-pale`.

### Binding rules for any new input

- Focus ring is mandatory and must come from `:focus-visible` (see §14).
- Placeholder text is **not** a label. Every input has a real `<label>`.
- Never disable paste, autofill, or the browser's zoom.
- Inputs on mobile are `font-size: 16px` minimum to prevent iOS focus-zoom.
- File inputs get a loading state and an error state before they ship.
- Do not clear a user's input on error. Preserve and annotate.

---

## 10. Data, tables, and dashboards

The Career Bridge workspace is the reference dashboard. Its layout is:

```
┌───────────────┬───────────────┬───────────────┐  summary: 3-up
├───────────────┴───────────────┴───────────────┤
│ ROUTE LIST 0.38fr  │  SKILL DETAIL 0.62fr     │  main split
│ (8 rows, re-ranks)│  (title, meta, desc,      │
│                   │   facts, topics, links)   │
├───────────────────┴───────────────────────────┤
│ ▸ EVIDENCE & INSIGHTS  (collapsible, 3 proofs)│
├───────────────────────────────────────────────┤
│ footer meta line                              │
└───────────────────────────────────────────────┘
```

### Row anatomy

```
[rank] [skill name .................] [type chip] [priority chip] [trend ○ +%]
```

- `grid-template-columns: 25px minmax(0, 1fr) auto auto auto`
- Rank is display type in `--cb-violet`, `11.5px`.
- Name truncates with `text-overflow: ellipsis; white-space: nowrap` — it never
  wraps, because rows are a fixed height.
- Hours use `tabular-nums` so the column does not shimmer as values change.
- Row height is compact (`6px 8px` padding). This is a scannable list, not a
  card grid.

### Re-ranking behavior

When the budget band changes, the route list re-sorts. The visual language for
"something moved" is:

- `@keyframes cb-row-in` — staggered `translateY(5px)` → `0` with `0.045s`
  increments per row, capped at 8 rows (`0.27s` total).
- `@keyframes cb-trend-pop` — the trend arrow pops `scale(0.9)` → `1` and fades in.

Stagger caps at the 8th row. Do not extend the delay formula past that, and do not
re-animate rows that did not change rank.

### Detail panel anatomy

Kicker → title → trend mark → meta chips → description (with a 3px
`--cb-lilac` left rule) → facts grid → topics → resources. Each of topics and
resources is separated by a `1px` `--cb-line-soft` top border with `10px` padding —
**use dividers, not nested cards**, to separate detail subsections.

The description's left rule is the one place a 3px solid accent appears. It is the
"this is the important sentence" signal of the workspace.

### Collapsible disclosure

The evidence section is a full-width button that becomes the header of its own
panel on open:

```css
.cb-evidence-toggle { width: 100%; display: flex; justify-content: space-between; }
.cb-evidence-panel  { border: 1px solid var(--cb-line); border-top: none;
                     border-radius: 0 0 12px 12px; }
```

The border-top is removed on open and the radii are **not** rounded on the top
corners, so the toggle and panel read as one object. Content fades in with
`cb-evidence-in` (`0.28s`).

**Binding rules for data surfaces**
- Encode meaning redundantly: color + shape + text. Never color alone.
- Tabular numerals for any value that changes in place.
- Sort order and rank are communicated by position, and the top of the list gets
  the strongest rank treatment.
- Do not build a chart when a sorted list answers the question. There is no chart
  library in this project and none is needed.
- Loading and empty states are mandatory for any data surface. `.cb-detail-empty`
  (`13px`, `--muted`, `1.6`) is the reference empty state.
- The 3-up summary, 0.38/0.62 split, and 3-up proof grid are the only dashboard
  grids. Do not introduce a fourth.

---

## 11. Icons

**There is no icon library.** Every icon in this project is hand-authored inline
SVG in a `24×24` viewBox, stroke-based.

```jsx
const common = { viewBox: '0 0 24 24', className: 'sc-icon' }
<path d="..." fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
```

### Binding rules

- **`24×24` viewBox. Always.** It is the coordinate system every icon is drawn in.
- **`stroke="currentColor"`.** Never a hardcoded hex. Icons inherit their
  container's color so they follow text and button states automatically.
- **`stroke-width` 1.8 for primary strokes, 1.4 for secondary detail.** Nothing
  heavier than 2, nothing lighter than 1.4.
- Round caps and round joins everywhere.
- `fill="none"` unless the icon is a solid shape by nature.
- Rendered size is set by CSS at the container, not by the SVG attributes. Icon
  tiles are `5px`–`8px` radius, `16px`–`30px` box, `12px`–`16px` glyph.
- Icons are decorative when adjacent to a text label — the label carries the
  meaning. An icon-only control needs an accessible name.

### The icon tile

```
┌────┐
│ ⌗  │   pale violet bg, violet-soft border, violet glyph
└────┘
```

```css
.cb-summary-icon { width: 24px; height: 24px; border-radius: 8px;
                   background: var(--cb-violet-pale);
                   border: 1px solid var(--cb-violet-soft);
                   color: var(--cb-violet); }
```

One tile treatment, scaled. Icon tiles are `--cb-violet-pale` fill and
`--cb-violet` glyph **everywhere** — no per-icon brand colors. The two exceptions
in the codebase are hero skill cards, where a card's own accent is part of the
artwork, not a system color.

**Never** add an icon font, an emoji as UI chrome, or a third-party icon
dependency. If you need a new icon, draw it in the existing 24×24 stroke system
and reuse a tile wrapper.

---

## 12. Motion

Motion is a two-register system, matching §2.

### Easing and duration

| Duration | Used for |
|---|---|
| `0.15s` | Thumb scale on slider hover |
| `0.18s` | Resource link hover |
| `0.2s` | **The default.** All buttons, rows, chips, toggles, color and transform transitions |
| `0.28s` | Evidence panel reveal |
| `0.3s` | Navbar background on scroll |
| `0.32s` | Detail panel content swap |
| `0.4s` | Staggered route row entrance (max 8 rows) |
| `0.45s` | Trend arrow pop |
| `0.75s` | Full-screen route curtain: 0-300ms cover, 300-450ms covered route switch, 450-750ms reveal |

Standard easing is `ease`. The 0.75s route curtain is the sole full-screen
transition exception; it becomes a 0.2s crossfade under reduced motion.

### Movement vocabulary

| Idiom | Transform | Where |
|---|---|---|
| Lift | `translateY(-2px)` | All buttons on hover |
| Nudge | `translateY(-1px)` | Nav CTA, resource links |
| Inset | `translateY(5px)` → `0` | Route rows, detail content, evidence panel |
| Pop | `scale(0.9)` → `1` | Trend arrows |
| Grow | `gap: 6px` → `10px` | Proof links — the arrow "travels" |
| Rotate | `rotate(180deg)` | Disclosure chevron |
| Arc | `rotate(-2deg)`, `rotate(-3deg)` | Handwritten notes only |

### The hero field

The homepage skill-card gallery is a **continuous 3D track**, not a carousel of
array items. Eight unique card designs are rendered as three repetitions (24 fixed
DOM slots) and advanced by a single shared progress value. One value moves
everything, so the sequence can never break or double up.

```
t = normalized distance from screen center (0..1)
yaw     = t × 10°        center 0°, edges ±10° — never sideways
scale   = 1 − 0.32t      center 1, far edge 0.68
opacity = 1 − 0.62t      center 1, far edge 0.38
blur    = 5.4(t−0.12)/0.88   the two centre cards stay 0px — OCR sharp
y       = band + t × 36px    outer cards dip lower — shallow wall arc
```

The two centre cards are intentionally unblurred so the skill names stay readable.
Cards overlap at ~5% of card width so the wall reads as one dense panel. Outer
cards get ~2× the mouse parallax of inner cards. Left and right are exact
mirrors — there is no independent card animation.

**Binding rules**
- Animate `transform` and `opacity`. Never animate `width`, `height`, `top`,
  `left`, or `filter: blur` in a layout-critical path.
- No parallax for its own sake. Depth must be doing work: focus, hierarchy, or
  legibility.
- Anything continuous must be interruptible and must not fight the scroll.
- Add a `@media (prefers-reduced-motion: reduce)` block for any new motion
  (see §14).

### Reduced motion — required, not optional

The global block at `styles.css:1569`:

```css
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .hero-field, .hero-student img { opacity: 1; }
  *, *::before, *::after {
    animation-duration: 0.001s !important;
    transition-duration: 0.001s !important;
  }
}
```

Any new component that animates **must** add its own rule to this block so it
resolves to a visible, static end state. Setting `animation-duration` to `0.001s`
is only correct if the element's resting state is its final state. Verify it.

---

## 13. Responsive behavior

Breakpoints are `max-width` and there are exactly four of them across the project.

| Breakpoint | What changes |
|---|---|
| `≤1120px` | `.cb-intro` releases its fixed height; hero art stops being viewport-pinned |
| `≤1024px` | `.impact` and `.roadmap` collapse to one column; `.impact-bridge` decorative bridge is `display: none`; hero note drops to `17px` |
| `≤880px` | Workspace main → one column; summary 3-up → 1-up; proofs 3-up → 1-up |
| `≤720px` | `--section-pad` → `64px 6vw`; hero type re-clamps; nav 80→64px, non-active links hidden; nav CTA shrinks; stats/flow/journey → 1 column; `.journey-svg` and `.hero-accent` removed |
| `≤640px` | Hero art scrolls horizontally at a 760px readable minimum; route rows drop the type/priority chips to 3 columns; resources and facts → 1 column |

### Rules

- **Illustration first, then type.** Decorative scenes (`.impact-bridge`,
  `.journey-svg`, `.hero-accent`) are `display: none` on small screens, never
  scaled into illegibility. The text reflows; the art leaves.
- **The hero artwork is not redrawn or cropped at 640px.** It is a ~6:1 banner
  with baked-in typography, so proportional scaling would shrink its own text
  past legibility. The figure becomes a horizontal scroll region at a 760px
  readable minimum:
  ```css
  .cb-hero-figure { overflow-x: auto; overscroll-behavior-x: contain;
                    -webkit-overflow-scrolling: touch; }
  .cb-hero-art    { width: 760px; max-width: none; }
  ```
  This is a deliberate exception to `max-width`. Do not "fix" it.
- **Grids collapse to one column, not two-thirds.** No intermediate widths.
- Test 1440, 1024, 720, and 390 before calling a layout done.

---

## 14. Accessibility

Baseline: **WCAG 2.1 AA**, light mode only, keyboard-first.

### Keyboard and focus

There is exactly one global focus rule and it is the whole system:

```css
:focus-visible { outline: 2px solid var(--indigo); outline-offset: 2px; }
```

- `2px` solid `--indigo`, `2px` offset. Never remove an outline without providing
  an equal or better replacement.
- The workspace slider has its own `:focus-visible` ring because the track is
  5px tall and the default outline does not read against it.
- `[KNOWN GAP]` **the workspace's own controls — `.cb-route`, `.cb-evidence-toggle`,
  `.cb-reupload`, `.cb-proof-link` — have no bespoke `:focus-visible` rule** and
  inherit the global indigo outline, which is a *marketing* token. On the
  `#f8f7f3` workspace canvas this is acceptable contrast, but it is not
  workspace-native. When you touch these components, add
  `outline: 2px solid var(--cb-violet); outline-offset: 2px;`.
- `outline-offset: 2px` means focus rings never touch the element border, so they
  stay visible on tinted and transparent backgrounds.

### Targets

- `24×24px` minimum for desktop pointer targets.
- `44×44px` minimum for touch.
- Compact workspace rows are a known exception — they are 24px+ tall and dense by
  design. Any row-dense list that gains new row-level actions must either
  increase row height or provide a secondary, larger target.

### Text

- Body copy: `17px` marketing / `12.5–13px` workspace, line-height `1.5–1.65`.
- Never body copy in `--muted` (3.26–3.49:1 — fails AA). Use `--ink-2`.
- Uppercase labels: `10–13px`, `0.11–0.18em` tracking, `--ink-2` or larger.
- Measure ≤ `52ch`.
- No text baked into an image without a live text equivalent. The Career Bridge
  hero is the pattern: the artwork's typography is duplicated in a visually hidden
  but screen-reader-available element so it stays in the document outline.

### Semantics and structure

- One `<h1>` per page. `<h2>` per section. No level skips.
- Real `<button>` for actions, real `<a href>` for navigation. Route changes go
  through the router, not `onClick`.
- Lists are `<ul>`/`<ol>`; the route list is a `<ul class="cb-routes">`.
- Decorative SVGs take `aria-hidden="true"` and are not focusable.
- Meaningful images have real `alt` text. Illustrative ones are marked decorative.
- Live data (budget slider → re-ranked roadmap) is announced via `aria-live`.

### Forms

- Every input has a `<label>`. Placeholder is not a label.
- 16px minimum font on inputs at mobile widths to prevent iOS focus-zoom.
- Never block paste or autofill. Never disable pinch-zoom.
- Errors are text next to the field, not color-only, and never clear input.

### Color and contrast

- The contrast table in §3.4 is the source of truth. Any new color is measured
  before it ships.
- Trend and priority always pair color with a shape and a word.
- Focus rings must reach 3:1 against their adjacent background.

### Motion and loading

- `prefers-reduced-motion: reduce` is honored globally (§12).
- Loading states reserve the final layout's dimensions so nothing shifts.
- Async states use `aria-live`, not a spinner alone.
- The budget slider's re-rank is a state change, not a page change — focus stays
  on the slider.

---

## 15. Anti-generic-AI-UI rules

These exist because the failure mode is specific and predictable. Each one is a
pattern this project has already declined.

**Never use a gradient as a brand signal.** No purple-to-pink mesh, no
`linear-gradient(135deg, …)` on a background, border, or card. The brand is a
flat violet. (Artwork may contain gradients; CSS surfaces may not. The one
permitted CSS gradient is the subpage hero legibility scrim, §8, and it carries
no brand signal.)

**Never use glassmorphism.** No `backdrop-filter: blur()`, no translucent white
panels, no "frosted" nav. The navbar is either fully transparent or fully
`--paper`.

**Never use the purple-blue SaaS gradient hero.** The SkillBridge hero is a
hand-annotated illustrated scene on warm paper, not a centered gradient headline
over a blurred blob.

**Never put everything in a card.** Sections are separated by whitespace, hairline
borders, and background tone. A card is for a discrete, bounded object — a
summary metric, a skill, a proof. Wrapping a paragraph in a card is decoration.

**Never use a uniform 12px radius on everything.** This system's radii encode
hierarchy: pills for actions, `16px` for panels, `8px` for tiles, `5px` for
small icons. Flattening them all to one radius destroys that.

**Never use a violet-tinted shadow.** Resting shadows are `0.04–0.06` alpha, either
neutral or faintly violet. Not a colored glow.

**Never use emoji as UI chrome.** No 🚀 in a button, no ✅ in a status. Status is a
tinted chip; the glyph is a hand-drawn SVG.

**Never add a generic dark-mode toggle.** Light mode is a decision (§2).

**Never use a centered hero with three evenly spaced feature cards.** That layout
belongs to every template ever generated and belongs to none of SkillBridge's
actual product.

**Never animate on scroll-jank.** The hero field is a single shared progress value
with a bounded envelope. A new "scroll-driven reveal" library is not needed and
would cost legibility.

**Never make a data table decorative.** If it looks like a chart, it must encode
something. Otherwise it is a sorted list — and a sorted list is the right answer
more often than it seems.

**Never invent social proof, urgency, or metrics.** Every number on screen traces
to `src/data/careerBridgeMock.js` or is computed from it.

---

## 16. Do's and Don'ts

### Do

- Reach for an existing token before introducing a value.
- Use `--cb-*` inside Career Bridge and `:root` tokens everywhere else.
- Encode state with color **and** shape **and** text.
- Use `tabular-nums` for anything that changes in place.
- Separate detail subsections with a hairline divider, not a nested card.
- Use `display: none` to remove decorative scenes on small screens.
- Measure contrast before shipping a new color.
- Add a `prefers-reduced-motion` rule with any new animation.
- Keep the analytical layer cool and the human layer warm, and keep them distinct.
- Put the warmth where it converts: the final CTA is the one cream panel on the
  site.

### Don't

- Don't add a gradient, a glass panel, or a new shadow recipe.
- Don't use `--muted` for copy a user must read.
- Don't use `--lavender` or `--cb-lilac` as text colors.
- Don't set `border-radius` between 16px and 999px.
- Don't use a shadow to signal hover.
- Don't wrap prose in a card.
- Don't collapse grids to anything but one column on small screens.
- Don't redraw, crop, or scale the Career Bridge hero art; scroll it.
- Don't use a third-party icon library, and don't hardcode an icon's color.
- Don't animate more than `0.45s`, and never animate layout properties in a
  critical path.
- Don't add a hamburger menu.
- Don't mix the token scopes.
- Don't invent a number, a metric, or a testimonial.

---

## 17. Change protocol

**This document is binding. Code is not allowed to drift from it.**

1. **Reuse first.** Search this document before creating a token, radius, shadow,
   duration, or component pattern. Most needs are already met.
2. **Never hardcode a value that has a token.** If you find yourself typing a hex
   color, a `border-radius`, or a `0.2s` in new CSS, stop and check §3, §8, §12.
3. **Extending the system is a documented change.** To add a token, radius,
   shadow, or duration:
   - add it to the correct scope in `src/styles.css`,
     `src/components/careerBridge.css`, or `src/components/ctm.css`,
   - add it to the matching table in this document,
   - record its contrast ratio in §3.4 if it carries meaning.
4. **Redesigning an existing pattern is out of scope** for a feature task. This
   document describes the system; it is not a backlog of things to tidy.
5. **Keep §3.4 honest.** It is measured, not estimated. If a token changes,
   re-measure and update the ratio.
6. **When in doubt, match the nearest existing surface.** Consistency with what
   is already shipped beats an independently "better" choice.

### Source of truth map

| Concern | File |
|---|---|
| Global tokens, marketing styles, responsive, reduced motion | `src/styles.css` |
| Workspace tokens, panels, rows, chips, slider, data surfaces | `src/components/careerBridge.css` |
| CTM workspace tokens, rank nodes, slice panels, path, disclosure | `src/components/ctm.css` |
| Fonts | `index.html` (Google Fonts link) |
| Route definitions | `src/App.jsx` |
| Hero card field geometry constants | `src/components/HeroCardField.jsx` |
| Roadmap, hours, priority, trend data | `src/data/careerBridgeMock.js` |
| Approved hero artwork | `public/references/` |

---

*SkillBridge — a calm violet blueprint on paper, annotated by hand.*
