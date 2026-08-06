# Product

## Register

product

## Users

Two overlapping audiences, depending on surface:

- **Exam-pressured students** (Grade 10–12 Egyptian secondary): use the library, quizzes, and AI assistant under high stakes. They open the app with a specific goal — find a video, complete a quiz, check their progress. They need speed, clarity, and zero friction.
- **Curious explorers** (landing page, courses browse): students deciding whether to join, or returning users discovering new subjects. They need confidence that this is a serious, worth-paying-for platform built for them — not a generic global EdTech clone.

Context: used on phones and laptops, often in noisy home environments or between classes. Arabic RTL is the primary language; the experience must feel native to Egyptian students, not translated.

## Product Purpose

Code-UP is a premium Egyptian EdTech platform for secondary school students covering Math, Physics, Chemistry, and Programming. It provides video lectures (Bunny CDN), interactive quizzes, AI-powered study assistance, and an access-code enrollment system managed by teachers and superadmins.

Success looks like: a student opens Code-UP when they need to study, not as a last resort. They trust it, they navigate it without thinking, and they come back the next day.

## Brand Personality

Premium · Focused · Trustworthy

- **Premium**: positions Code-UP above free-for-all YouTube tutorials or generic Arab platforms — it's a service worth paying for.
- **Focused**: every screen serves one job. No clutter, no noise, no upsell distractions.
- **Trustworthy**: the UI feels built by people who understand Egyptian students — the language, the grade system, the pressure of the Thanaweya.

## References

- **bassthalk.com** — loved for: accessible navigation, local Egyptian feel, everything reachable. Disliked: courses are hard to access (buried or unclear). Code-UP should match the accessibility warmth of bassthalk while making course discovery the most obvious action on every page.

## Anti-references

- Generic "global EdTech" blue-and-white (Coursera, edX aesthetic) — feels foreign to Egyptian students, signals "not made for us."
- Cluttered Arabic portals with competing banners, popups, and autoplaying media — exactly what Code-UP should not be.
- SaaS dashboard chrome: data tables, metric cards, sidebar + topbar layouts on student-facing pages — this is a learning tool, not a productivity app.

## Design Principles

1. **Course access is the main event.** Every page should make it trivially easy to reach a course, a video, or a quiz. No hunting, no three-click journeys.
2. **Local before global.** The visual language should feel native to an Egyptian teenage context — not translated from English product conventions.
3. **Trust through restraint.** Premiumness comes from what's removed, not added. Sparse, legible, unhurried layouts signal quality better than decoration.
4. **Dark by default, light by choice.** The hero and core learning surfaces lean dark — students study late at night, in dim rooms. Light mode is the toggle, not the default.
5. **Motion earns its place.** Animation serves orientation (transitions between views, loading feedback, subject rotators) and nothing else.

## Accessibility & Inclusion

- WCAG AA as the baseline: contrast ≥4.5:1 for body text, ≥3:1 for large text, keyboard-navigable, screen-reader-friendly.
- Full RTL support throughout — Arabic is the primary direction; English labels/brand names render LTR inline.
- Reduced motion support on all animations; every entrance/transition has a `prefers-reduced-motion` fallback.
- Touch-first interaction on mobile — tap targets ≥44px, no hover-only affordances.
