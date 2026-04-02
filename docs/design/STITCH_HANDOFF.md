# Stitch Handoff

Design a mobile-first social planning app called Sovio for Gen Z and young professionals.

## Visual direction
- 2040 consumer mobile UI
- Dark-mode-first (Neo Chartreuse #BDFF2E accent)
- SwiftUI-polished onboarding
- Layered cards on dark backgrounds
- Premium social utility
- Subtle motion
- No endless feed
- Low-friction decision UI
- Acid-bright accent on near-black backgrounds

## Color system
- Accent: #BDFF2E (Neo Chartreuse)
- Accent soft: #8ACC00
- Dark bg: #0D0D0D, surfaces: #1A1A1A, alt: #1A2A0A
- Light bg: #F8FFF0, surfaces: #FFFFFF, alt: #EEFFD6
- Success: #00D1A0 / #25D9A6
- Danger: #FF5A7A / #FF6F8F

## Architecture
- Components consume theme context internally (no prop drilling)
- Shared StyleSheet factory for consistent styles
- TabScreen template for all 5 tab screens
- Button component with variant prop (primary/secondary)
