# Component System V2

All components live in `packages/ui/src/` as individual files.
Components consume theme via `useTheme()` internally — no theme prop drilling.
Shared styles come from `createStyles(theme)` in `styles.ts`.

## Components

| Component | File | Purpose |
|-----------|------|---------|
| AppScreen | AppScreen.tsx | Root screen wrapper (background, padding) |
| AppHeader | AppHeader.tsx | Dual-line header with optional right slot |
| HeroActionCard | HeroActionCard.tsx | Large card: eyebrow, title, body, 2 buttons |
| MiniActionCard | MiniActionCard.tsx | Compact card: title, body, action label |
| PillChip | PillChip.tsx | Toggle-able pill for selections |
| UpgradeBanner | UpgradeBanner.tsx | Pro upsell card (inverted accent bg) |
| TokenMeter | TokenMeter.tsx | AI token usage bar |
| StepProgress | StepProgress.tsx | Step indicator dots/bars |
| Button | Button.tsx | Primary/secondary via `variant` prop |
| TabScreen | TabScreen.tsx | Template: AppScreen + AppHeader + ScrollView |
| ThemeToggle | ThemeToggle.tsx | Dark/light mode switch |

## Shared infrastructure

- `types.ts` — all component prop interfaces
- `styles.ts` — `createStyles(theme)` shared StyleSheet factory
- `index.tsx` — barrel re-exports
