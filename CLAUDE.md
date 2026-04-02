# Sovio — Project Rules

## Architecture
- Monorepo: pnpm workspaces with `packages/` and `apps/`
- Components consume theme via `useTheme()` — never pass `theme` as a prop
- Shared styles via `createStyles(theme)` in `@sovio/ui/styles`
- Tab screens use `TabScreen` template — don't rebuild the boilerplate
- Button uses `variant` prop — don't create separate Primary/Secondary components

## Design tokens
- All colors come from `@sovio/tokens` — never hardcode hex values in components or screens
- Accent: Neo Chartreuse `#BDFF2E`
- Default mode: dark
- Web uses CSS custom properties via `cssVars()` from `@sovio/tokens/css`

## File conventions
- One component per file in `packages/ui/src/`
- Prop interfaces in `packages/ui/src/types.ts`
- Barrel re-exports in `index.tsx` / `index.ts`
- Screen files import from `@sovio/ui` and `@sovio/tokens/ThemeContext`

## Brand tone
- warm, not cheesy
- sharp, not robotic
- youthful, not childish
- premium, not luxury
- social, not loud

## Dev servers
- Mobile: `pnpm dev` (Expo on port 8081)
- Web: `pnpm dev:web` (Next.js on port 3000)
