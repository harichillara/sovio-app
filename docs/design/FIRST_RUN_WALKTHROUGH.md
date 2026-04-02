# First Run Walkthrough

7-step onboarding flow with StepProgress indicator.
Selections persist in component state.
Default theme: dark mode (Neo Chartreuse).

## Steps

1. **Welcome** — hero copy, Continue button
2. **Interests** — 8 PillChip options (multi-select, toggle on/off):
   Coffee, Food, Nightlife, Live music, Fitness, Walks, Creative spots, Chill hangs
3. **Social preference** — 4 PillChip options (multi-select):
   Solo ideas, Close friends, Small groups, Open to meeting people
4. **AI consent** — Two buttons: Turn on AI help / Maybe later
5. **Notifications** — Enable notifications button
6. **Location** — Enable location button
7. **Finish** — "You're in" confirmation, Open Sovio navigates to tabs

## Navigation
- Continue/Back buttons at bottom of every step
- Final step uses `router.replace('/(tabs)/home')` (no back navigation to onboarding)
