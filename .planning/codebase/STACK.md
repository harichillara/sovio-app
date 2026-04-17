# Technology Stack

**Analysis Date:** 2026-04-15

## Languages

**Primary:**
- TypeScript ^5.4.0 - Used across all packages, apps, and configuration. 100% of application code.

**Secondary:**
- SQL - Supabase migrations (`supabase/migrations/*.sql`), pg_cron job definitions, RPC functions
- TypeScript (Deno) - Supabase Edge Functions (`supabase/functions/*/index.ts`) use Deno runtime with `https://deno.land/std@0.208.0` imports

## Runtime

**Client (Mobile):**
- React Native 0.74.5 via Expo SDK 51
- Metro bundler (configured in `apps/mobile/metro.config.js`)
- Babel with `babel-preset-expo` (`apps/mobile/babel.config.js`)

**Client (Web):**
- Node.js (Next.js server + SSR)
- Webpack (Next.js built-in)

**Server (Edge Functions):**
- Deno (Supabase Edge Functions runtime)
- `https://deno.land/std@0.208.0/http/server.ts` for HTTP serving

**Package Manager:**
- pnpm (workspaces)
- Lockfile: `pnpm-lock.yaml` (present, 10,175 lines)
- Workspace config: `pnpm-workspace.yaml`

## Frameworks

**Core:**
| Framework | Version | Package | Purpose |
|-----------|---------|---------|---------|
| React | 18.2.0 | `@sovio/mobile` | UI rendering (mobile + web) |
| React Native | 0.74.5 | `@sovio/mobile` | Cross-platform mobile |
| Expo | ~51.0.0 | `@sovio/mobile` | Mobile development platform |
| expo-router | ~3.5.0 | `@sovio/mobile` | File-based routing (mobile) |
| Next.js | ^14.2.0 | `@sovio/web` | Marketing site / web app |

**State Management:**
| Library | Version | Package | Purpose |
|---------|---------|---------|---------|
| Zustand | ^4.5.0 | `@sovio/core`, `@sovio/mobile` | Client-side stores |
| TanStack React Query | ^5.40.0 | `@sovio/core`, `@sovio/mobile` | Server state, caching, mutations |

**Backend:**
| Service | Version | Package | Purpose |
|---------|---------|---------|---------|
| @supabase/supabase-js | ^2.101.1 | `@sovio/core`, `@sovio/web` | Database, auth, realtime, storage, edge functions |
| @supabase/ssr | ^0.10.0 | `@sovio/web` | Server-side Supabase client for Next.js |

**Animation (Web):**
| Library | Version | Package | Purpose |
|---------|---------|---------|---------|
| framer-motion | ^12.38.0 | `@sovio/web` | Web animations on marketing site |

**Testing:**
- No test framework configured (no jest, vitest, or testing-library in any package.json)
- QA script uses Playwright for E2E: `scripts/qa-mobile-web.mjs`

**Build/Dev:**
| Tool | Purpose | Config File |
|------|---------|-------------|
| TypeScript | Type checking | `tsconfig.base.json` (root), per-package tsconfig |
| Metro | React Native bundler | `apps/mobile/metro.config.js` |
| Babel | JS transpilation (mobile) | `apps/mobile/babel.config.js` |
| Next.js | Web build | `apps/web/next.config.js` |
| Expo CLI | Mobile dev server | via `expo start` |

**Linting/Formatting:**
- No ESLint, Prettier, or Biome configured

## Monorepo Structure

```
sovio/
  apps/
    mobile/    @sovio/mobile    Expo 51 / React Native 0.74 app
    web/       @sovio/web       Next.js 14 marketing/web app
  packages/
    core/      @sovio/core      Services, hooks, stores, AI client
    tokens/    @sovio/tokens    Design tokens, theme, CSS vars
    ui/        @sovio/ui        React Native UI components
```

**Workspace dependency graph:**
```
@sovio/mobile ──> @sovio/core ──> @supabase/supabase-js
              ──> @sovio/tokens
              ──> @sovio/ui ──> @sovio/tokens
                            ──> react-native-svg

@sovio/web ──> @sovio/tokens
           ──> @supabase/ssr
           ──> @supabase/supabase-js
```

## Key Dependencies

**Critical (used throughout):**
| Package | Version | Why It Matters |
|---------|---------|----------------|
| `@supabase/supabase-js` | ^2.101.1 | All data access, auth, realtime, storage |
| `zustand` | ^4.5.0 | 7 client stores for auth, plans, messages, AI, location, suggestions, presence |
| `@tanstack/react-query` | ^5.40.0 | All server-state hooks, cache invalidation, mutations |
| `expo-router` | ~3.5.0 | File-based routing for entire mobile app |
| `expo-secure-store` | ~13.0.0 | Secure auth token storage (Keychain/EncryptedSharedPreferences) |

**Device Capabilities (mobile only):**
| Package | Version | Purpose |
|---------|---------|---------|
| `expo-location` | ~17.0.0 | Foreground location for nearby features |
| `expo-notifications` | ~0.28.0 | Push notification registration and handling |
| `expo-apple-authentication` | ~6.4.0 | Sign in with Apple |
| `expo-auth-session` | ~5.5.0 | OAuth redirect URI generation |
| `expo-web-browser` | ~13.0.0 | System browser for OAuth flows |
| `expo-device` | ~6.0.0 | Physical device detection for push |
| `expo-crypto` | ~13.0.0 | Cryptographic operations |
| `expo-constants` | ~16.0.0 | App constants |

**Infrastructure:**
| Package | Version | Purpose |
|---------|---------|---------|
| `react-native-screens` | 3.31.1 | Native screen containers |
| `react-native-safe-area-context` | 4.10.5 | Safe area insets |
| `react-native-url-polyfill` | ^2.0.0 | URL API polyfill for RN |
| `react-native-svg` | ^15.15.4 | SVG rendering in UI package |
| `react-native-web` | ~0.19.13 | Web compatibility for RN components |
| `base64-arraybuffer` | ^1.0.2 | Binary encoding for file uploads |

## TypeScript Configuration

**Base config (`tsconfig.base.json`):**
- Target: ES2022
- Module: ESNext
- Module resolution: bundler
- JSX: react-jsx
- Strict mode: enabled
- `noEmit: true` (type checking only, bundlers handle output)
- `isolatedModules: true` (required for Metro/Next.js)

**Mobile config (`apps/mobile/tsconfig.json`):**
- Extends `expo/tsconfig.base`
- Path aliases for workspace packages:
  - `@sovio/tokens` -> `../../packages/tokens/src/index.ts`
  - `@sovio/core` -> `../../packages/core/src/index.ts`
  - `@sovio/ui` -> `../../packages/ui/src/index.tsx`

**Web config (`apps/web/next.config.js`):**
- `transpilePackages: ['@sovio/tokens']`

## Environment Configuration

**Mobile app (Expo):**
- `EXPO_PUBLIC_SUPABASE_URL` - Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key

**Web app (Next.js):**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `WAITLIST_WEBHOOK_URL` - (optional) Webhook for waitlist signups

**Supabase Edge Functions (Deno env):**
- `SUPABASE_URL` - Auto-injected
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-injected
- `GEMINI_API_KEY` - Google AI API key
- `GOOGLE_MAPS_API_KEY` - Google Places API key
- `PREDICTHQ_API_TOKEN` - PredictHQ events API token
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret (dormant)

**Database settings (pg_cron):**
- `app.settings.edge_function_url` - Edge Function base URL
- `app.settings.service_role_key` - Service role key for cron HTTP calls

## Scripts

| Command | What It Does |
|---------|-------------|
| `pnpm dev` | Start Expo dev server (port 8081) |
| `pnpm dev:web` | Start Next.js dev server (port 3000) |
| `pnpm build` | Build Next.js web app |
| `pnpm typecheck` | Run `tsc --noEmit` across all 5 workspaces in dependency order |

## Platform Requirements

**Development:**
- Node.js (ES2022 target)
- pnpm
- Expo CLI (via `npx expo`)
- Supabase CLI (for local Edge Function development)
- Android Studio / Xcode for native builds

**Production:**
- Mobile: iOS (bundleIdentifier: `app.sovio.mobile`), Android (package: `app.sovio.mobile`)
- Web: Vercel or similar (Next.js 14 deployment)
- Backend: Supabase hosted (project ID: `kfqjapikievrgmszrimw`)
- Edge Functions: Supabase Deno runtime (6 functions deployed)

---

*Stack analysis: 2026-04-15*
