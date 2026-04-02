# Screen Layouts V2

## Navigation

Root Stack:
1. Entry screen (index)
2. Onboarding (7-step flow)
3. Tab navigator (5 tabs with Ionicons)

## Tabs

| Tab | Icon | Content |
|-----|------|---------|
| Home | home/home-outline | Hero suggestion + 2 mini cards + upgrade banner + AI token meter |
| Momentum | flash/flash-outline | Quick matching hero + 2 mini cards |
| Messages | chatbubble/chatbubble-outline | 2 thread mini cards + upgrade banner |
| Replay | refresh/refresh-outline | 2 missed-moment mini cards |
| Profile | person/person-outline | Theme toggle + 3 setting cards + upgrade banner |

## Tab screen pattern

All 5 tabs use the `TabScreen` template component:
```
<TabScreen title="..." subtitle="..." headerRight={optional}>
  {content cards}
</TabScreen>
```

## Home

One hero suggestion card and at most two smaller suggestion cards.
AI token meter in header right slot (32/100).
Upgrade banner at bottom.

## Entry

Centered layout: app name, hero card with Get Started / Skip, Open Sovio button.

## Onboarding

7 steps with StepProgress bar:
1. Welcome
2. Interests (PillChip multi-select)
3. Social preference (PillChip multi-select)
4. AI consent (two buttons)
5. Notifications (single button)
6. Location (single button)
7. Finish → navigate to tabs
