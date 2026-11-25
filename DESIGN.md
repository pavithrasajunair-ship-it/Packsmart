# PackSmart design system (v2)

Direction: luxury travel editorial + premium product design + intelligent AI dashboard. Expensive, specific, never template-like.

## Palette (tokens in `src/index.css`, use Tailwind classes such as `bg-forest`, `text-ivory`, `text-champagne`)
| Token | Hex | Use |
|---|---|---|
| forest | #0F3D35 | immersive dark sections, primary ink on light |
| teal | #0B3B40 | deepest dark, hero ground |
| ivory | #F6F1E7 | main light ground, text on dark |
| sage | #A9B8A3 | secondary surfaces, soft chart fills |
| stone | #D9D3C7 | dividers, quiet cards, inputs |
| champagne | #C9A96E | the ONE accent: key numbers, highlights, CTA hover. Use sparingly |
| jet | #0A0A0A | text on light, deepest contrast |
Alternate dark immersive sections and bright editorial sections. No pure white, no neon, no purple/blue gradients, no rainbow.

## Type
- Display: **Bricolage Grotesque** (700-800, tight tracking -0.03em to -0.045em), class `font-display`. Big editorial headlines, and ALL big numbers (use `tabular-nums`).
- Body/UI: **Plus Jakarta Sans** (400-700), class `font-sans`.
- Clear hierarchy: oversized headline, compact label, readable body (min 15px on mobile).

## Composition rules
- Asymmetric 12-column grids, overlapping photography and widgets, one dominant element per section, full-bleed bands used deliberately.
- Mix large editorial type with compact live widgets. No giant empty sections: every section has a purpose and real content.
- Do NOT repeat one card style. Vary: photo-led panels, data strips, dials, timelines, boards, tables, tickets.
- Use the real photography already in `src/assets/images/*.jpg` (destinations, packing, wardrobe, vault). No hotlinked images, no new dependencies.

## Motion
Motion must communicate or help usability (progress, capacity filling, recommendation reveal, hover that reveals info). Respect `prefers-reduced-motion`. Never put filter/transform on ancestors of GSAP-pinned elements.

## Hard rules
Preserve every existing feature, API, auth, routing, saved data and interaction. No mock data replacing real logic. Responsive down to 360px. No new dependencies. No emoji.
