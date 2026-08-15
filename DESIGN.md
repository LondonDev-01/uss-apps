---
name: USS Apps Ecosystem
description: Academic ecosystem for Universidad San Sebastián — schedule optimization, curriculum mapping, and student tools
colors:
  deep-midnight: "#0a0d14"
  elevated-slate: "#11151f"
  surface: "#161b27"
  surface-hover: "#1c2230"
  subtle-border: "#232a39"
  strong-border: "#2d3548"
  light-text: "#e4e7eb"
  muted-text: "#9ba3b0"
  subtle-text: "#5e6675"
  steel-blue: "#6b7a99"
  steel-blue-hover: "#8895b3"
  steel-blue-light: "#2a3142"
  warm-gold: "#c4a87a"
  warm-gold-hover: "#d4bc92"
  warm-gold-light: "#3d3625"
  sage-green: "#7a9971"
  sage-light: "#2a3826"
  warm-amber: "#b8956b"
  amber-light: "#3d3122"
  muted-rose: "#b87878"
  rose-light: "#3a2828"
  dusty-rose: "#b87a96"
  dusty-rose-light: "#3a2530"
  muted-teal: "#7a9999"
  teal-light: "#253838"
  pastel-blue: "#BFDBFE"
  pastel-green: "#BBF7D0"
  pastel-yellow: "#FEF3C7"
  pastel-red: "#FECACA"
  pastel-purple: "#DDD6FE"
typography:
  body:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  heading:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "normal"
  label:
    fontFamily: "Plus Jakarta Sans, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.05em"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.8rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  xl: "20px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.light-text}"
    textColor: "{colors.deep-midnight}"
    rounded: "{rounded.lg}"
    padding: "12px 20px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.light-text}"
    rounded: "{rounded.lg}"
    padding: "8px 14px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.light-text}"
    rounded: "{rounded.lg}"
    padding: "8px 14px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.light-text}"
    rounded: "{rounded.lg}"
    padding: "16px"
  input:
    backgroundColor: "{colors.elevated-slate}"
    textColor: "{colors.light-text}"
    rounded: "6px"
    padding: "10px 12px"
  chip-priority:
    backgroundColor: "{colors.dusty-rose-light}"
    textColor: "{colors.dusty-rose}"
    rounded: "{rounded.lg}"
    padding: "4px 12px"
  chip-optional:
    backgroundColor: "{colors.warm-gold-light}"
    textColor: "{colors.warm-gold}"
    rounded: "{rounded.lg}"
    padding: "4px 12px"
  chip-elective:
    backgroundColor: "{colors.teal-light}"
    textColor: "{colors.muted-teal}"
    rounded: "{rounded.lg}"
    padding: "4px 12px"
---

# Design System: USS Apps Ecosystem

## Overview

**Creative North Star: "The Scholar's Desk"**

The ecosystem aspires to feel like a well-organized academic workspace — serious enough to trust with consequential decisions (your semester schedule matters), but warm enough to stay in for an hour without fatigue. Technical elegance is the guiding aesthetic: precision in layout and information hierarchy, with a subtle warmth that comes from the gold accent and muted, human-friendly color choices. The dark theme is not "dark mode as afterthought" — it's the native habitat, designed for late-night study sessions where the interface recedes and the data leads.

**Key Characteristics:**
- Muted, desaturated palette — no neon, no saturated primaries; every color earns its place
- Tonal layering over heavy shadows; depth comes from background hierarchy, not drop shadows
- Warm gold accent as the single point of visual energy — used sparingly, never overwhelming
- Typography-first hierarchy; information density without clutter
- Shared token vocabulary across all apps; UniHorario's visual language is the ecosystem standard

## Colors

A muted, academic palette built on deep slate neutrals with warm gold as the single accent of visual energy.

### Primary (Neutral — Slate)
- **Deep Midnight** (`#0a0d14`): The foundational dark. App background, default canvas.
- **Elevated Slate** (`#11151f`): Elevated surfaces — tab bars, header backgrounds, code blocks.
- **Surface** (`#161b27`): Card backgrounds, schedule grid cells, content containers.
- **Surface Hover** (`#1c2230`): Hover state for interactive surfaces.

### Border
- **Subtle Border** (`#232a39`): Default dividers, card borders, input strokes. Barely visible but structurally present.
- **Strong Border** (`#2d3548`): Emphasized borders — active inputs, focused states, section dividers.

### Text
- **Light Text** (`#e4e7eb`): Primary text on dark backgrounds. High contrast, never pure white.
- **Muted Text** (`#9ba3b0`): Secondary labels, timestamps, metadata. Clearly subordinate.
- **Subtle Text** (`#5e6675`): Tertiary text, disabled states, placeholder content.

### Accent (Steel Blue)
- **Steel Blue** (`#6b7a99`): Primary interactive color — focus rings, active states, links. The workhorse.
- **Steel Blue Hover** (`#8895b3`): Hover state for interactive elements.
- **Steel Blue Light** (`#2a3142`): Subtle tinted backgrounds for selected items, tag backgrounds.

### Accent (Warm Gold)
- **Warm Gold** (`#c4a87a`): The signature accent. Category chips (Opcionales), schedule highlights, accent details. Used sparingly — its rarity is the point.
- **Warm Gold Hover** (`#d4bc92`): Hover state for gold accent elements.
- **Warm Gold Light** (`#3d3625`): Tinted background for gold accent containers.

### Status
- **Sage Green** (`#7a9971`): Success states, completion indicators. Muted, not celebratory.
- **Warm Amber** (`#b8956b`): Warnings, caution states. Warm without being alarming.
- **Muted Rose** (`#b87878`): Danger, errors, destructive actions. Present but not aggressive.

### Category (Priority Levels)
- **Dusty Rose** (`#b87a96`): P0 — Prioridad (required). The most urgent, used on mandatory items.
- **Warm Gold** (`#c4a87a`): P1 — Opcionales (wanted). The same gold as the accent, reinforcing importance.
- **Muted Teal** (`#7a9999`): P2 — Electivos (nice-to-have). Calm, lowest visual weight.

### Schedule Block Palette (Pastels)
- Pastel Blue (`#BFDBFE`), Pastel Green (`#BBF7D0`), Pastel Yellow (`#FEF3C7`), Pastel Red (`#FECACA`), Pastel Purple (`#DDD6FE`), Pastel Pink (`#F5D0FE`), Pastel Orange (`#FED7AA`), Pastel Violet (`#E9D5FF`), Pastel Cyan (`#A5F3FC`), Pastel Gold (`#FDE68A`), Pastel Rose (`#FBCFE8`), Pastel Indigo (`#C7D2FE`), Pastel Lime (`#D9F99D`), Pastel Crimson (`#FCA5A5`), Pastel Emerald (`#A7F3D0`). Used for course blocks in the schedule grid — distinct per course, soft enough to not clash.

### Named Rules
**The Gold Accent Rule.** Warm Gold appears on ≤15% of any given screen. Its rarity is the point — it draws the eye to what matters most (category chips, accent highlights) without competing with the data.

**The Muted Palette Rule.** Every color in this system is desaturated by at least 30% from its pure hue. If a color looks vibrant, it's wrong. The palette earns trust through restraint.

## Typography

**Display/Body Font:** Plus Jakarta Sans (with system-ui fallback)
**Grid/Mono Font:** JetBrains Mono (with monospace fallback)

**Character:** A geometric sans-serif with warmth — rounded terminals and open counters that feel approachable without being playful. Paired with a precise mono for data-dense surfaces (time cells, NRC codes).

### Hierarchy
- **Heading** (700, 1.25rem, 1.3): Section titles, page headings. Bold but not heavy.
- **Body** (400, 15px, 1.6): Primary reading text. Optimized for extended reading sessions.
- **Label** (600, 0.75rem, letter-spacing 0.05em): Category labels, table headers, chip text. Uppercase in schedule grid headers.
- **Mono** (400, 0.8rem, 1.5): Time cells, NRC codes, technical identifiers. Distinguished by weight and size, not color.

### Named Rules
**The No-Caps Exception Rule.** Text is never ALL CAPS except schedule grid day/time headers and category chip labels. When caps appear, they carry structural meaning — not decoration.

## Layout

The spatial model is a single-column centered layout with generous horizontal padding. Content containers max at ~960px; the schedule grid is the one component that breaks this constraint (it needs horizontal scroll on mobile).

**Grid behavior:** No CSS grid framework — layout is flex-based with consistent gap rhythms. Cards use `padding: 16px` (1rem). Page sections stack vertically with `gap: 24px` or `gap: 32px`.

**Responsive:** On mobile (<768px), the sidebar collapses to a top bar, the schedule grid scrolls horizontally, and card padding reduces to `12px`. The schedule grid uses `min-width: 110px` per day column.

**Density:** Medium density by default. Not cramped, not spacious. The schedule grid is the densest surface (0.85rem font, 56px row height) — it earns this density because time is the scarcest resource.

## Elevation & Depth

The system uses layered depth through tonal differentiation of backgrounds (deep-midnight → elevated-slate → surface) and ambient shadows. Glass morphism is reserved for transient overlays (toasts, modals). Shadows are structural, not decorative — they separate layers, not add drama.

### Shadow Vocabulary
- **Subtle** (`0 1px 2px 0 rgb(0 0 0 / 0.3)`): Minimal lift for chips, small elements.
- **Default** (`0 1px 3px 0 rgb(0 0 0 / 0.4), 0 1px 2px -1px rgb(0 0 0 / 0.3)`): Cards, containers. Present but not attention-grabbing.
- **Medium** (`0 4px 6px -1px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.3)`): Dropdowns, popovers, elevated panels.
- **Large** (`0 10px 15px -3px rgb(0 0 0 / 0.5), 0 4px 6px -4px rgb(0 0 0 / 0.3)`): Modals, dialogs.
- **Glow** (`0 0 30px rgba(107, 122, 153, 0.08)`): Atmospheric background effect only — never on interactive elements.

### Named Rules
**The Tonal Layer Rule.** Depth is communicated through background color hierarchy (bg → bg-elevated → surface), not through shadows alone. Shadows reinforce what the tonal layering already suggests.

## Shapes

Gently rounded corners throughout — the system avoids both sharp edges and pill shapes. Radius scales from 6px (inputs, small elements) to 20px (full-width containers, modals). The schedule grid is the one exception: its cells have no radius (the grid is a continuous surface).

**Corner strategy:** `6px` for inputs and chips, `10px` for buttons and small cards, `14px` for main content cards, `20px` for modals and full-width containers. The progression is consistent and predictable.

**Borders:** 1px solid borders on cards, inputs, and containers. Border color shifts from subtle-border (default) to strong-border (focused/active). No double borders, no dashed borders, no decorative borders.

## Components

### Buttons
- **Shape:** Gently rounded (14px radius), matching the card language.
- **Primary:** Background uses `--color-fg` (light text on dark) — an inverted button that stands out through contrast, not color. Text uses `--color-bg`. Padding: 12px 20px. Font weight: 600.
- **Secondary:** Background uses `--color-surface`, border uses `--color-border`. Subtler than primary, for less critical actions.
- **Ghost:** Transparent background, no border. Appears on hover only. For tertiary actions.
- **Hover/Focus:** Primary shifts to `--color-primary-hover` (steel blue). Secondary darkens surface. Focus ring uses `--color-primary` outline.

### Chips / Tags
- **Style:** Rounded rectangle (14px radius) with tinted background matching the category color. Text color matches the category's main color. Border: 1px solid category color at 20% opacity.
- **States:** P0 (Dusty Rose), P1 (Warm Gold), P2 (Muted Teal). Each chip is self-contained — background, text, and border all derive from the same color family.

### Cards / Containers
- **Corner Style:** 14px radius (the standard card radius).
- **Background:** `--color-surface`. Sits above the page background through tonal layering.
- **Shadow Strategy:** Default ambient shadow. No dramatic elevation changes.
- **Border:** 1px solid `--color-border`. Structural, not decorative.
- **Internal Padding:** 16px (1rem) standard, 12px on mobile.

### Inputs / Fields
- **Style:** Background uses `--color-bg-elevated`. Border: 1px solid `--color-border`. Radius: 6px. Padding: 10px 12px.
- **Focus:** Border shifts to `--color-primary` (steel blue). A subtle 3px glow ring appears: `0 0 0 3px rgba(107, 122, 153, 0.12)`.
- **Error:** Border shifts to `--color-danger`. No shake animation — the border color change is sufficient.

### Navigation
- **Style:** Tab bar with horizontal scroll. Background: `--color-bg-elevated`. Active tab has `--color-surface` background with subtle shadow.
- **Typography:** Labels use muted text by default, light text on hover/active. Uppercase in schedule grid headers only.
- **Mobile:** Collapses to a top bar with hamburger menu. No bottom nav.

### Schedule Grid (Signature Component)
- **Structure:** CSS table with sticky headers. Day columns (Mon–Sat), time rows (08:00–19:00).
- **Cells:** 56px height, 110px min-width. Background: `--color-surface`. Border: 1px solid `--color-border`.
- **Time cells:** Background: `--color-bg-elevated`. Mono font. Muted text.
- **Course blocks:** Pastel background per course, with darker text (`#0f172a`). TEO (theory) blocks are slightly brighter; LAB blocks are slightly muted. Block title is bold 0.85rem; metadata is 0.7rem.
- **Headers:** Uppercase, 0.75rem, letter-spacing 0.05em. Background: `--color-bg-elevated`.

### Loading Modal (Signature Component)
- **Style:** Full-screen overlay with `bg-black/80 backdrop-blur-md`. Centered card with progress bar.
- **Progress bar:** 3px height, `--color-primary` fill. Subtle, not celebratory.
- **Messages:** Rotating humorous loading messages — personality in the details.

## Do's and Don'ts

### Do:
- **Do** use the tonal layer hierarchy consistently: bg → bg-elevated → surface. Never skip a layer.
- **Do** keep Warm Gold reserved for accent moments — category chips, highlight states, subtle emphasis. Its power comes from scarcity.
- **Do** use Plus Jakarta Sans for all UI text. JetBrains Mono only for time codes, NRC numbers, and technical identifiers.
- **Do** maintain the 6/10/14/20px radius progression. Never use values outside this scale.
- **Do** use ambient shadows at their documented intensities. Never add glow, neon, or colored shadows.
- **Do** keep schedule grid cells at 56px height and 110px min-width. The grid's density is calibrated — don't loosen it.

### Don't:
- **Don't** use saturated or vibrant colors. Every color in this system is muted. If it looks bright, desaturate it.
- **Don't** add decorative borders, double lines, or dashed borders. Borders are structural — 1px solid, subtle-border color.
- **Don't** use ALL CAPS outside schedule grid headers and category chips. Caps carry structural meaning.
- **Don't** add hover animations that transform scale or add dramatic shadows. Transitions are 200ms ease, subtle and quick.
- **Don't** introduce new color families without mapping them to an existing tonal role. The palette is closed.
- **Don't** use the primary color (steel blue) for large background fills. It's an interactive accent, not a fill color.
