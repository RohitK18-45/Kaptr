---
name: creative-ui-craft
description: Guidelines and design standards for crafting atmospheric, high-aesthetic, and micro-interactive web interfaces.
trigger: model_decision
---

# Creative UI & Atmospheric Interface Craft

When designing, styling, or enhancing web interfaces and components, avoid flat, generic templates. Elevate the design by applying these core visual craft principles:

## 1. Canvas & Atmospheric Depth
- **Obsidian Baseline**: Avoid raw `#000000`. Use deep, tinted dark bases (e.g., `#06060a` with secondary background `#0a0a11`).
- **Organic Gradient Aurora**: Incorporate multi-stop, blurred radial blobs (`120px–130px` blur, opacity `0.2–0.5`) with slow, non-synchronous drift animations (25s–35s ease-in-out alternate) to give the page subtle organic life.
- **Radial-Masked Grid Veil**: Ground technical products with a hairline grid (`rgba(255, 255, 255, 0.04)` at `60px–70px` pitch) masked by an elliptical radial gradient (`mask-image: radial-gradient(ellipse ...)`).
- **Anti-Banding Micro-Texture**: Overlay an SVG fractal noise filter (`feTurbulence baseFrequency='.85'` at `3%–4%` opacity, `mix-blend-mode: overlay`) to eliminate digital gradient banding.
- **Interactive Cursor Spotlight**: Track pointer coordinates (`--mx`, `--my`) on mousemove to project a soft, ambient radial glow (`500px` circle) beneath interactive elements.

## 2. Glassmorphism & Surface Tokens
- **Stepped Translucency**:
  - Surface base: `rgba(255, 255, 255, 0.038)`
  - Elevated card: `rgba(255, 255, 255, 0.065)`
  - Active / Hover highlight: `rgba(255, 255, 255, 0.10)`
- **Hairline Silhouette Borders**: Use ultra-subtle translucent borders (`1px solid rgba(255, 255, 255, 0.085)`) to keep cards sharply defined against blurred backdrops.
- **Bento Grid Spotlight Glow**: Calculate relative card pointer coordinates on hover (`--x`, `--y`) to illuminate borders with a cursor-following radial highlight.
- **Generous Corner Radii**: Define consistent, polished radii hierarchy (e.g., `sm: 12px`, `md: 16px`, `lg: 24px`, `xl: 32px`).

## 3. Four-Tier Typographic Tension
Create deliberate visual contrast between four purposeful typographic roles:
1. **Display Sans** (e.g., `Space Grotesk`): Tight letter-spacing (`-0.035em`), tight line-height (`1.05`), bold, confident hero titles.
2. **Body Sans** (e.g., `Inter`): Clean, neutral, high-legibility readability for body copy and descriptions (`line-height: 1.6`).
3. **Editorial Serif Italic** (e.g., `Instrument Serif`): Used selectively for taglines, quotes, or humanizing editorial accents.
4. **Precision Monospace** (e.g., `JetBrains Mono`): Micro-labels, badges, formats, timestamps, and status pills in uppercase with wide tracking (`letter-spacing: 0.06em`).

## 4. Micro-Interactions & State Architecture
- **Kinetic Easing**: Use snappy, spring-like bezier easing curves: `cubic-bezier(0.2, 0.75, 0.2, 1)`.
- **Context-Reactive Theming**: Adapt accent colors and glows dynamically to user inputs (e.g., brand-tinted glows when platform links are detected).
- **Multi-Stage Action Buttons**: Primary buttons should communicate clear state transitions:
  - `Idle` -> `Loading (Spinner)` -> `Active (Inline Progress Bar)` -> `Completed (Checkmark + Direct Action)` -> `Reset`.
- **Keyboard Affordances**: Embed sleek shortcut badges (e.g., `Cmd/Ctrl + K`, `Paste`) directly inside input controls.
- **Complete Theme Symmetry**: Ensure light mode is mathematically balanced with tinted surfaces and glowing accents rather than flattening into pure white.
