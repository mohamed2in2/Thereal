---
name: Code-UP
description: Premium Egyptian EdTech platform for secondary school students — Arabic-first, dark-native, exam-focused.
colors:
  ink-deep: "#0b0f19"
  ink-surface: "#0f172a"
  ink-card: "#1e293b"
  ink-muted-bg: "#020617"
  sky-accent: "#2563eb"
  sky-accent-dark: "#1d4ed8"
  sky-accent-light: "#60a5fa"
  sky-highlight: "#e0f2fe"
  indigo-accent: "#4f46e5"
  indigo-glow: "#6366f1"
  text-primary-dark: "#e2e8f0"
  text-muted-dark: "#94a3b8"
  text-primary-light: "#0f172a"
  text-muted-light: "#64748b"
  border-dark: "rgba(148,163,184,0.16)"
  border-light: "rgba(148,163,184,0.22)"
  card-dark: "rgba(15,23,42,0.78)"
  card-light: "rgba(240,249,255,0.85)"
  error: "#f43f5e"
  success: "#10b981"
  warning: "#f59e0b"
typography:
  display:
    fontFamily: "Cairo, Segoe UI, Arial, sans-serif"
    fontSize: "clamp(2.5rem, 6vw, 5.25rem)"
    fontWeight: 900
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Cairo, Segoe UI, Arial, sans-serif"
    fontSize: "clamp(1.75rem, 4vw, 2.5rem)"
    fontWeight: 800
    lineHeight: 1.25
  title:
    fontFamily: "Cairo, Segoe UI, Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "Cairo, Segoe UI, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Cairo, Segoe UI, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  2xl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.sky-accent}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "12px 28px"
  button-primary-hover:
    backgroundColor: "{colors.sky-accent-dark}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "12px 28px"
  button-ghost:
    backgroundColor: "rgba(255,255,255,0.05)"
    textColor: "{colors.text-primary-dark}"
    rounded: "{rounded.md}"
    padding: "12px 28px"
  button-ghost-hover:
    backgroundColor: "rgba(255,255,255,0.10)"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "12px 28px"
  button-cta:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink-deep}"
    rounded: "{rounded.full}"
    padding: "14px 32px"
  nav-link-active:
    backgroundColor: "rgba(14,165,233,0.15)"
    textColor: "#7dd3fc"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  nav-link-default:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted-dark}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  chip-grade:
    backgroundColor: "rgba(255,255,255,0.05)"
    textColor: "rgba(255,255,255,0.70)"
    rounded: "{rounded.full}"
    padding: "8px 16px"
  chip-grade-hover:
    backgroundColor: "rgba(99,102,241,0.15)"
    textColor: "#ffffff"
    rounded: "{rounded.full}"
    padding: "8px 16px"
---

# Design System: Code-UP

## 1. Overview

**Creative North Star: "The Premium Prep Center"**

Code-UP looks and feels like the best exam preparation center in Egypt — one students pay for and trust with their academic futures. The interface is confident, focused, and unhurried. It never performs busyness. The dark-native surfaces reduce eye strain for students studying late at night; the light mode is an option, not the default. The typography is Arabic-first (Cairo), with scale ratios calibrated for RTL reading rhythm. Every interactive element responds with quiet precision — a subtle shadow on press, a smooth color shift — without choreography that wastes the student's time.

The system explicitly rejects the following: the generic blue-and-white "global EdTech" aesthetic (Coursera, edX) that signals "not made for us"; the cluttered Arabic portal pattern with competing banners, pop-ups, and autoplay; and SaaS dashboard chrome (metric cards, sidebar layouts, data tables) on student-facing pages. Code-UP is a learning tool, not a productivity app.

Color strategy is **Restrained**: dark-navy surfaces carry the canvas; one saturated sky-blue accent marks primary actions and navigation state. The indigo glow reserved for the hero section only — a signature moment, not a pattern.

**Key Characteristics:**
- Dark-native canvas (near-black ink-deep `#0b0f19`) with sky-blue as the single accent
- Arabic-first (RTL, Cairo), weights from 400–900 across the scale
- Spacing varies deliberately; rhythm over uniformity
- Framer Motion for entrance and state transitions; never orchestrated page-load sequences on the app surface
- Reduced motion respected unconditionally — every animation has a crossfade fallback
- Touch-first tap targets (≥44px), keyboard-navigable, WCAG AA contrast throughout

---

## 2. Colors: The Ink and Sky Palette

Two anchors: a near-black ink family for surfaces, a sky-blue accent for action and attention.

### Primary
- **Sky Action Blue** (`#2563eb`): Primary interactive color — call-to-action buttons, active nav indicators, focus rings, links. Used sparingly so every instance carries weight.
- **Sky Light** (`#60a5fa`): Dark-mode variant of the primary; used when the saturated `#2563eb` would be too heavy against dark surfaces.
- **Indigo Glow** (`#6366f1`): Hero-section only. The spotlight cursor glow, subtle background ellipsis, and rotating subject text use this. Never applied to buttons or standard UI.

### Secondary
- **Indigo Deep** (`#4f46e5`): Gradient partner in hero background washes. Not a standalone action color.

### Tertiary
- **Sky Highlight** (`#e0f2fe`): Light-mode body background. On dark mode, functions as the base for card-light overlays (`rgba(240,249,255,0.85)`).

### Neutral
- **Ink Deep** (`#0b0f19`): Hero section background — the darkest surface, reserved for the most prominent page moment.
- **Ink Surface** (`#0f172a`): Dark-mode body background. The main canvas.
- **Ink Card** (`#1e293b`): Elevated card surfaces in dark mode.
- **Ink Muted Bg** (`#020617`): Deepest shade, used as dark-mode admin/secondary surface.
- **Text Primary Dark** (`#e2e8f0`): Body text on dark surfaces. ≥4.5:1 against Ink Surface.
- **Text Muted Dark** (`#94a3b8`): Labels, captions, helper text on dark surfaces.
- **Text Primary Light** (`#0f172a`): Body text on light surfaces.
- **Text Muted Light** (`#64748b`): Labels and secondary text on light surfaces.
- **Border Dark** (`rgba(148,163,184,0.16)`): Dividers and card borders in dark mode — barely-there structure.
- **Border Light** (`rgba(148,163,184,0.22)`): Same role in light mode.

### Semantic
- **Error Red** (`#f43f5e`): Validation errors, destructive action states.
- **Success Green** (`#10b981`): Completion states, progress indicators.
- **Warning Amber** (`#f59e0b`): Caution states, rate-limit warnings.

### Named Rules
**The One Voice Rule.** Sky Action Blue is used on ≤10% of any given screen. Its rarity is exactly what makes it legible as "tap here." Avoid using it for decorative borders, backgrounds, or icons that don't invite interaction.

**The Hero Signature Rule.** Indigo Glow (`#6366f1`) is exclusively a hero-section material — spotlight, glow, background atmosphere. Applying it to buttons, cards, or navigation in the app surface is prohibited.

---

## 3. Typography: The Cairo System

**Primary Font:** Cairo (Arabic geometric sans-serif, Google Fonts, weights 300–900)  
**Fallback Stack:** Segoe UI, Arial, sans-serif

**Character:** A single family across all scales. Cairo's geometric construction reads clearly at small label sizes and commands authority at display sizes in Arabic — no pairing needed. Weight is the differentiator: 400 for body, 500 for labels, 700 for titles, 800–900 for headlines and display.

### Hierarchy
- **Display** (900, `clamp(2.5rem, 6vw, 5.25rem)`, 1.15 line-height, -0.02em tracking): Hero headlines only. The rotating subject name (`الرياضيات`, `الفيزياء`) is display scale.
- **Headline** (800, `clamp(1.75rem, 4vw, 2.5rem)`, 1.25): Page section headings — courses header, library title, dashboard welcome.
- **Title** (700, `1.25rem`, 1.4): Card headings, panel titles, modal headers.
- **Body** (400, `1rem`, 1.6): Course descriptions, lesson content, AI chat bubbles. Cap at 65ch for Arabic prose readability.
- **Label** (500, `0.875rem`, 1.4): Nav links, button text, form labels, metadata chips.

### Named Rules
**The Single Family Rule.** Cairo only. No serif display pairing, no "brand font" injected for headings. Consistency of shape across the interface is the signal of quality.

**The Weight Axis Rule.** Weight is the hierarchy, not size alone. A 700 title at `1.25rem` outranks a 400 body at `1.5rem` even though the body is larger. Never use `font-weight: 400` for headings.

---

## 4. Elevation

Code-UP uses **tonal layering** as its primary depth language, not drop shadows. Surfaces stack by darkening: Ink Muted Bg → Ink Surface → Ink Card. This keeps the dark-native canvas coherent without the "floating UI" feel of heavy box-shadows.

Shadows appear **only in response to state**, not at rest:

### Shadow Vocabulary
- **Hover glow** (`0 0 40px rgba(255,255,255,0.25)`): White CTA button hover — an ambient light burst, not a lift.
- **Focus ring** (`0 0 0 3px rgba(59,130,246,0.18)`): Keyboard focus indicator across all interactive elements.
- **Nav shadow** (`0 10px 30px -20px rgba(15,23,42,0.45)`): Sticky nav — a directional shadow that reinforces the sticky position without floating.
- **Card lift** (reserved for interactive cards on hover): `0 4px 24px rgba(0,0,0,0.18)`.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. The eye navigates by tonal contrast between `--card` and `--background`, not by shadow. Applying shadows to static cards, panels, or text blocks is prohibited.

---

## 5. Components

### Buttons

Refined and tactile — subtle shadow on press, smooth color shift, no hover fluff.

- **Shape:** Gently rounded (12px / `rounded.md`); pill-shaped (`rounded.full`) for CTAs and grade chips only.
- **Primary (sky):** Sky Action Blue (`#2563eb`) background, white text, `12px 28px` padding, 700 weight. Hover: `#1d4ed8`. Active: scale `0.97`. Transition `160ms ease`.
- **Primary CTA (pill):** White background, Ink Deep (`#0b0f19`) text, pill-shaped (`9999px`). A shimmer sweep on hover (a `skew-x` translucent band that travels left → right), no color change. This is the hero CTA only.
- **Ghost:** `rgba(255,255,255,0.05)` background, `1px rgba(255,255,255,0.10)` border. Hover: `rgba(255,255,255,0.10)`. Backdrop-blur on hero surfaces only.
- **Destructive:** Rose-tinted (`#f43f5e` text, `rgba(244,63,94,0.10)` background). No solid red fills.
- **Disabled:** `opacity: 0.4`, `cursor: not-allowed`, no hover state.

### Chips / Grade Pills

- **Style:** Pill-shaped (`rounded.full`), `rgba(255,255,255,0.05)` background, `1px rgba(255,255,255,0.10)` border. Label (500, 0.875rem).
- **Hover:** `rgba(99,102,241,0.15)` background, `rgba(99,102,241,0.40)` border, text snaps to full white. The RTL directional arrow (`←`) translates -0.5px. Transition 200ms.
- **Active/selected:** Sky accent background, white text, no border.

### Cards / Containers

- **Corner Style:** Gently rounded — `16px` (`rounded.lg`) for course cards; `12px` (`rounded.md`) for content panels and modals.
- **Dark Background:** `rgba(15,23,42,0.78)` (card-dark token) with `backdrop-filter: blur(12px)` on overlay contexts only. Plain `#1e293b` (ink-card) for structural panels.
- **Light Background:** `rgba(240,249,255,0.85)` (card-light) in light mode.
- **Shadow:** None at rest. `0 4px 24px rgba(0,0,0,0.18)` on hover for clickable cards.
- **Border:** `1px solid rgba(148,163,184,0.16)` (border-dark) — barely-there structure, not a decorative frame.
- **Internal Padding:** `24px` (`spacing.lg`) standard; `16px` (`spacing.md`) for compact course list items.

### Inputs / Fields

- **Style:** `#1e293b` background (ink-card), `1px rgba(148,163,184,0.22)` border, `12px` radius. Full-width in forms.
- **Focus:** Sky focus ring `0 0 0 3px rgba(59,130,246,0.18)`, border-color shifts to `rgba(59,130,246,0.5)`. No outline.
- **Error:** Border shifts to `#f43f5e`, `0 0 0 3px rgba(244,63,94,0.15)` ring. Error message in error-red text below the field.
- **Disabled:** `opacity: 0.5`, `cursor: not-allowed`, background `rgba(30,41,59,0.5)`.
- **Placeholder:** `#64748b` (text-muted-light) — must achieve ≥4.5:1 against the card background.

### Navigation (Navbar)

- **Container:** `sticky top-0`, `1px` border-bottom (`rgba(255,255,255,0.05)` dark / `rgba(255,255,255,0.40)` light), `backdrop-blur-xl`, `rgba(15,23,42,0.70)` dark bg / `rgba(255,255,255,0.80)` light bg.
- **Nav links:** Label scale (500, 0.875rem). Default: text-muted. Hover: text-primary + `rgba(255,255,255,0.05)` bg. Active: sky-accent text + `rgba(14,165,233,0.15)` bg. All transitions 160ms.
- **Mobile:** Hamburger → full-width dropdown list below the nav bar, not a modal or overlay. Same link styles.
- **Height:** `64px` (4rem). Consistent across all pages.

### Signature: Spotlight Hero

The hero section (`#0b0f19` base) has a cursor-following radial gradient spotlight (indigo glow, 640px circle, opacity spring-animated via Framer Motion). A subtle grid overlay (`1px rgba(255,255,255,0.035)` lines, masked with a radial ellipse) provides texture without decoration. A noise texture SVG at `opacity: 0.02` adds grain. These are the hero's signature materials — prohibited outside the hero.

### Skeleton Loader

Shimmer animation (`shimmer` keyframe: `background-position: -200% → 200%`, 1.5s infinite). Background: `linear-gradient(90deg, var(--card) 25%, var(--border) 50%, var(--card) 75%)`. `border-radius: 8px`. Used on all data-fetching pages; never a centered spinner.

---

## 6. Do's and Don'ts

### Do:
- **Do** use Cairo at 700–900 for all headings. Weight is the hierarchy signal.
- **Do** use Sky Action Blue (`#2563eb`) exclusively for interactive affordances — buttons, links, active nav state, focus rings. Not for decoration.
- **Do** verify ≥4.5:1 contrast for every text element including placeholders and muted labels. `#94a3b8` on `#0f172a` passes; `#64748b` on `#e0f2fe` passes. Check before shipping any new surface.
- **Do** use skeleton loaders on every data-fetching surface. Students are on mobile networks; loading states are not edge cases.
- **Do** keep tap targets ≥44px. Every nav link, button, and chip must be touchable on a small phone screen.
- **Do** provide a `prefers-reduced-motion` fallback for every Framer Motion animation — typically `initial={false}` with instant opacity-only transitions.
- **Do** respect RTL throughout: `direction: rtl` on `<html>`, flip directional icons, ensure no LTR-only layout assumptions in flex/grid.
- **Do** use the tonal layer system (Ink Muted Bg → Ink Surface → Ink Card) to communicate depth. Tonal contrast is the primary elevation signal.
- **Do** vary spacing deliberately. The scale goes xs(4) → sm(8) → md(16) → lg(24) → xl(40) → 2xl(64). Use the full range; uniform gutters flatten hierarchy.

### Don't:
- **Don't** use the generic blue-and-white "global EdTech" aesthetic (Coursera, edX). It signals "not made for Egyptian students." Code-UP's color identity is dark-navy with sky accent — not "education blue on white."
- **Don't** use cluttered Arabic portal patterns: competing banners, pop-ups, autoplay content. Every screen has one primary action; surface it without competition.
- **Don't** bring SaaS dashboard chrome — metric cards, hero-metric templates (big number + small label + gradient accent), sidebar + topbar layouts — onto student-facing pages. Course access is the main event.
- **Don't** use `background-clip: text` gradient text. Gradient text is decorative and fails accessibility. Use a solid ink-deep or white for emphasis; use font weight for hierarchy.
- **Don't** use `border-left` or `border-right` > 1px as a colored stripe on cards or alerts. Use background tints or full borders instead.
- **Don't** apply the Indigo Glow (`#6366f1`) outside the hero section. It is a signature hero material — overuse collapses the section's identity.
- **Don't** gate content visibility on a class-toggled transition. Animations must enhance visible content, not reveal hidden content — transitions pause on background tabs.
- **Don't** use drop shadows on static surfaces. Shadows are state-feedback only (hover, focus, sticky nav). Flat-by-default.
- **Don't** apply `backdrop-filter: blur` decoratively. Use it only where there is genuinely layered content beneath (nav, modal overlays, hero chips). Glass cards as decoration are prohibited.
- **Don't** animate layout properties (height, width, padding) in state transitions. Animate `transform` and `opacity` only.
- **Don't** use identical card grids — same icon + heading + text, repeated in a uniform grid. Course cards may share a template but must differ in thumbnail, stage badge, and teacher; they should not look like a pattern library.
