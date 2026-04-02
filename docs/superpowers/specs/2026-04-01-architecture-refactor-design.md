# Sovio Architecture Refactor — Design Spec

## Problem

The codebase has significant redundancy:
- `theme` prop drilled through ~50 sites (every component + every screen)
- 5 tab screens repeat identical AppScreen → AppHeader → ScrollView boilerplate
- 11 components + 11 interfaces in a single 200-line monolith file
- Web pages hardcode hex colors that exist as tokens
- `PrimaryButton` and `SecondaryButton` are identical except background/text color
- `BottomTabs` component is dead code (Expo Router Tabs replaced it)
- `docs/updates/` contains dead overlay workflow files
- Inline styles with identical values repeated across components (card radius, pill shape, font weights)

## Solution: Context-based theming + shared styles + templates

### Principle 1: Components consume theme context directly

Every UI component calls `useTheme()` internally. The `theme: SovioTheme` prop is removed from all 11 component interfaces. Screens no longer need to call `useTheme()` or pass `theme={theme}`.

**Before:** `<MiniActionCard theme={theme} title="..." body="..." label="..." />`
**After:** `<MiniActionCard title="..." body="..." label="..." />`

### Principle 2: Styles at the template level

A shared `createStyles(theme)` factory in `packages/ui/src/styles.ts` produces named `StyleSheet` entries for all reusable patterns:
- Card variants: `heroCard`, `miniCard`, `invertedCard`
- Text presets: `heading`, `title`, `body`, `label`, `eyebrow`
- Button variants: `btnPrimary`, `btnSecondary`, `btnTextLight`, `btnTextDark`
- Shapes: `pill`, `progressBar`
- Layout: `scrollContent`

Components consume these named styles instead of inline objects.

### Principle 3: Screen templates

`TabScreen` is a new component that encapsulates the `AppScreen + AppHeader + ScrollView` pattern shared by all 5 tab screens. Props: `title`, `subtitle`, `headerRight?`, `children`.

### Principle 4: One file per component

Split the monolith `packages/ui/src/index.tsx` into individual files:
- `AppScreen.tsx`, `AppHeader.tsx`, `HeroActionCard.tsx`, `MiniActionCard.tsx`
- `PillChip.tsx`, `UpgradeBanner.tsx`, `TokenMeter.tsx`, `StepProgress.tsx`
- `Button.tsx` (replaces PrimaryButton + SecondaryButton, `variant: 'primary' | 'secondary'`)
- `TabScreen.tsx` (new template)
- `ThemeToggle.tsx` (extracted from profile.tsx)
- `types.ts` (all interfaces)
- `styles.ts` (shared style factory)
- `index.tsx` (barrel re-exports)

### Principle 5: Web uses token CSS variables

`@sovio/tokens/css` exports a `cssVars(theme)` helper that maps theme keys to `--sovio-*` CSS custom properties. Web `layout.tsx` applies these to `<body>` style. All web pages reference `var(--sovio-accent)` etc.

## File Structure

```
packages/tokens/src/
  types.ts           — SovioTheme interface
  themes.ts          — lightTheme, darkTheme objects
  ThemeContext.tsx    — ThemeProvider, useTheme
  css.ts             — cssVars() for web
  index.ts           — barrel

packages/core/src/   — unchanged

packages/ui/src/
  types.ts           — component prop interfaces (no theme prop)
  styles.ts          — createStyles(theme) factory
  AppScreen.tsx
  AppHeader.tsx
  HeroActionCard.tsx
  MiniActionCard.tsx
  PillChip.tsx
  UpgradeBanner.tsx
  TokenMeter.tsx
  StepProgress.tsx
  Button.tsx          — variant-based (primary/secondary)
  TabScreen.tsx       — tab screen template
  ThemeToggle.tsx     — dark/light toggle widget
  index.tsx           — barrel

apps/mobile/app/
  _layout.tsx         — ThemeProvider + StatusBar
  index.tsx           — entry screen (no theme drilling)
  onboarding.tsx      — onboarding flow (no theme drilling)
  (tabs)/_layout.tsx  — Expo Router Tabs with Ionicons
  (tabs)/home.tsx     — uses TabScreen
  (tabs)/momentum.tsx — uses TabScreen
  (tabs)/messages.tsx — uses TabScreen
  (tabs)/replay.tsx   — uses TabScreen
  (tabs)/profile.tsx  — uses TabScreen + ThemeToggle

apps/web/app/
  layout.tsx          — applies cssVars to body
  page.tsx            — uses CSS variables
  pricing/page.tsx    — uses CSS variables

DELETE:
  docs/updates/APPLY_THESE_UPDATES.md
  docs/updates/FILE_MANIFEST.json
```

## Button component design

Merges PrimaryButton + SecondaryButton into:
```
interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';  // default: 'primary'
}
```

## TabScreen component design

```
interface TabScreenProps {
  title: string;
  subtitle: string;
  headerRight?: ReactNode;
  children: ReactNode;
}
```
Renders: `AppScreen → AppHeader → ScrollView(gap:14, pb:22)` with children inside the scroll.

## ThemeToggle component design

Extracted from profile.tsx. Self-contained — calls `useTheme()` internally.
Renders: row with icon (moon/sunny) + label + toggle switch.

## Web token integration

`cssVars(lightTheme)` produces:
```
{ '--sovio-background': '#F7F8FC', '--sovio-accent': '#6C5CFF', ... }
```
Applied as inline style on `<body>`. Pages use `var(--sovio-accent)` everywhere.

## Cleanup

- Delete `BottomTabs` (dead code since Tabs layout handles navigation)
- Delete `docs/updates/APPLY_THESE_UPDATES.md` (dead overlay workflow)
- Delete `docs/updates/FILE_MANIFEST.json` (dead overlay workflow)
- Remove `docs/updates/` directory if empty after deletion
