# Sovio

**Plans, without the effort.**

Sovio is a mobile-first social planning app for Gen Z and young professionals. It turns "we should do something" into an actual plan with AI assistance, low-friction coordination, and smart suggestions.

## Getting started

```bash
pnpm install
pnpm dev        # Start Expo mobile dev server (port 8081)
pnpm dev:web    # Start Next.js web dev server (port 3000)
```

## Monorepo structure

```
packages/
  tokens/    @sovio/tokens   Design tokens, ThemeContext, CSS helper
  core/      @sovio/core     Brand constants, onboarding data
  ui/        @sovio/ui       11 React Native components (context-based theming)

apps/
  mobile/    @sovio/mobile   Expo + Expo Router mobile app
  web/       @sovio/web      Next.js landing + pricing pages

docs/
  brand/                     Brand system, app store copy
  design/                    Component system, screen layouts, stitch handoff
```

## Architecture

- **No prop drilling** — UI components call `useTheme()` internally
- **Shared styles** — `createStyles(theme)` produces named StyleSheet entries
- **TabScreen template** — eliminates boilerplate across all 5 tab screens
- **Button variant** — single `Button` component with `variant: 'primary' | 'secondary'`
- **CSS tokens for web** — `cssVars(theme)` maps tokens to `--sovio-*` custom properties

## Design system

- **Palette:** Neo Chartreuse — accent `#BDFF2E`, dark-mode-first
- **Visual direction:** 2040 futuristic, acid-bright on dark, layered cards
- **Tone:** warm, sharp, youthful, premium, social

## Tech stack

- React Native + Expo SDK 51 + Expo Router v3
- Next.js 14
- TypeScript (strict)
- pnpm workspaces
