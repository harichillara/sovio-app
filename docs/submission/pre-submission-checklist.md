# Pre-submission checklist — Sovio mobile

Run this top-to-bottom before every first-time store submission and re-run the
changed rows for every subsequent submission. Owner of each row is in
parentheses; mark with `[x]` when actually done, not "looks fine."

Related docs:
- `apps/mobile/ios/PrivacyInfo.xcprivacy`
- `docs/submission/ios-app-privacy.md`
- `docs/submission/android-data-safety.md`
- `docs/submission/store-listing.md`

---

## Build

- [ ] EAS build profile = **production** (engineering)
  - `pnpm --filter @sovio/mobile build:prod`
- [ ] `version` in `apps/mobile/app.json` bumped from last submitted version
  (engineering)
- [ ] `runtimeVersion.policy` is still `"appVersion"` and `updates.url` is the
  real EAS project URL, not `REPLACE_WITH_EAS_PROJECT_ID` (engineering)
- [ ] Production env vars present in EAS (`EXPO_PUBLIC_*`, Sentry DSN,
  Supabase URL + anon key) (engineering)
- [ ] No debug-only code in the bundle: `__DEV__` gates, dev menu, mock
  accounts (engineering)
- [ ] App icon and splash exported at required resolutions (design)

---

## iOS-specific

- [ ] `apps/mobile/ios/PrivacyInfo.xcprivacy` committed and bundled into the
  .ipa (engineering)
- [ ] Required-reason APIs declared: **FileTimestamp (C617.1)**,
  **SystemBootTime (35F9.1)**, **DiskSpace (E174.1)**, **UserDefaults
  (CA92.1)** (engineering)
- [ ] `NSPrivacyTracking` = `false` in PrivacyInfo.xcprivacy; no ATT prompt;
  no `NSUserTrackingUsageDescription` in `app.json` (engineering)
- [ ] Usage strings reviewed and human-readable:
  `NSLocationWhenInUseUsageDescription`, `NSCameraUsageDescription` — both
  present in `app.json → ios.infoPlist` (product + engineering)
- [ ] APNs push certificate or APNs auth key uploaded to App Store Connect if
  notifications ship in this version (engineering)
- [ ] `ITSAppUsesNonExemptEncryption = false` set — or answer the encryption
  questionnaire in App Store Connect every submission (engineering)
- [ ] **App Privacy Details** form filled using
  `docs/submission/ios-app-privacy.md` (ops)
- [ ] App Information: support URL, marketing URL, privacy policy URL, copyright
  (ops)
- [ ] Build uploaded via EAS Submit or Transporter, processed in App Store
  Connect (engineering)
- [ ] TestFlight internal testing green on latest build (QA)

---

## Android-specific

- [ ] `android.versionCode` auto-incremented by EAS (check build output)
  (engineering)
- [ ] Google Play signing enrolled (engineering — one-time)
- [ ] Service account JSON at `secrets/play-store-service-account.json` (path
  in `eas.json`) exists locally and in CI (engineering)
- [ ] **Data safety** form filled using
  `docs/submission/android-data-safety.md` (ops)
- [ ] **App content** questionnaires complete: target audience, content
  rating, ads declaration, news app declaration, COVID-19 contact tracing
  declaration (ops)
- [ ] Internal testing track has at least one green build (QA)
- [ ] `google-services.json` placed (only if FCM native config is used —
  currently we use Expo's managed push, so likely N/A) (engineering)

---

## Cross-platform privacy & legal

- [ ] Privacy Policy live at `https://sovio.app/privacy` and reachable from
  both app listings (legal + ops)
- [ ] Terms of Service live at `https://sovio.app/terms` (legal + ops)
- [ ] DSAR endpoint live at `/api/dsar`, SLA 30 days, tested end-to-end
  (engineering)
  - Submitted and verified as part of a parallel task.
- [ ] In-app "Delete account" flow reaches the DSAR endpoint and returns a
  success state (engineering + QA)
- [ ] Data Processing Agreements signed with Sentry and Supabase and on file
  (legal)

---

## Reviewer sign-in + support

- [ ] Test account credentials prepared for App Review / Play reviewers
  (engineering + QA)
  - Store in `secrets/reviewer-credentials.md` (1Password/Bitwarden link only;
    do not commit raw creds).
- [ ] Review notes drafted explaining any non-obvious flows (Decision
  Autopilot, Presence Score) for both stores (product)
- [ ] Demo data pre-populated in the test account so reviewers see the
  product populated, not empty states (product)

---

## Assets

- [ ] Screenshots captured at all required resolutions per
  `docs/submission/store-listing.md` (design)
- [ ] Feature graphic 1024×500 for Play (design)
- [ ] App icon 1024×1024 (iOS) + 512×512 (Play) (design)
- [ ] Store copy in `docs/submission/store-listing.md` filled (no
  `[COPY_TO_FILL]` left) (marketing)

---

## Monetization (only if Sovio Pro ships on mobile this release)

- [ ] Paid Apps Agreement accepted in App Store Connect (finance)
- [ ] Banking + tax forms complete in App Store Connect and Play Console
  (finance)
- [ ] In-app purchase / subscription products configured in App Store Connect
  (monthly + annual, if applicable) (engineering)
- [ ] Subscription products configured in Play Console (engineering)
- [ ] Product IDs match what the client requests from the RevenueCat /
  StoreKit / Play Billing layer (engineering)
- [ ] Restore Purchases flow works end-to-end on a fresh install (QA)
- [ ] Subscription privacy policy and Terms of Service referenced from the
  IAP UI (legal)

---

## Export compliance

- [ ] HTTPS only — no plaintext `http://` in production bundle (engineering)
- [ ] Answer on every iOS submission: **"Uses standard encryption" = Yes**;
  no CCATS required. Set `ITSAppUsesNonExemptEncryption = false` to make this
  permanent (engineering)

---

## OTA / kill-switch (context)

A new `app_version_flags` table was added in Supabase to support an OTA
kill-switch — force a specific runtime version to refuse to boot, for
emergency revert. **The runtime check is NOT wired in this release.** Log it
on the release notes so support knows the flag exists but does not yet
activate. Scheduling the wire-up is tracked separately.

---

## Final gate

- [ ] Engineering lead signs off: build, telemetry, crash-free rate acceptable
  on TestFlight + internal track
- [ ] Product signs off: UX, copy, screenshots
- [ ] Legal signs off: policy, terms, DPAs, data-safety answers
- [ ] Hit **Submit for Review** (iOS) and **Send for review** (Play)
- [ ] Monitor reviewer status daily; prepare reply templates for likely
  rejection reasons (privacy policy mismatch, account deletion flow, guideline
  4.2 minimum functionality, guideline 5.1.1 data collection)
