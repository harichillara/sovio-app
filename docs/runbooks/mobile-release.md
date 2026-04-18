# Mobile Release Runbook (EAS)

This covers cutting a store-submitted iOS + Android build via EAS, and
the narrower case of shipping an OTA JS-only update without a native
rebuild. Web releases are separate (Vercel; deploys on master merge).

---

## 1. First-time setup (run once, then forget)

1. Create an EAS project + grab the project ID
   ```bash
   pnpm --filter @sovio/mobile exec eas init
   # This writes `extra.eas.projectId` back into apps/mobile/app.json.
   # Replace the two REPLACE_WITH_EAS_PROJECT_ID placeholders with that ID.
   ```

2. Configure build credentials (interactive — keep certs on EAS)
   ```bash
   pnpm --filter @sovio/mobile exec eas credentials
   ```
   - Pick "Let EAS manage" for iOS signing (certs live server-side).
   - Android uploads a keystore EAS generates; back up the download link
     it prints — losing the keystore means you cannot ship updates.

3. App Store Connect + Play Console
   - Create an iOS app record in App Store Connect with bundle id
     `app.sovio.mobile` (matches `apps/mobile/app.json → ios.bundleIdentifier`).
   - Create a Play Console app with package name `app.sovio.mobile`.
   - Fill in the three iOS placeholders in `apps/mobile/eas.json`:
     `submit.production.ios.appleId`, `ascAppId`, `appleTeamId`.

4. Play Store service account
   - In Google Cloud Console, create a service account with
     "Service Account User" role on the Play Console.
   - Download its JSON key. Base64-encode it and paste into GitHub secrets
     as `GOOGLE_SERVICE_ACCOUNT_KEY_B64`:
     ```bash
     base64 -w0 play-store-key.json | pbcopy   # macOS
     base64 -w0 play-store-key.json            # Linux/WSL
     certutil -encode play-store-key.json tmp.b64 && type tmp.b64  # Windows PS
     ```

5. GitHub repository secrets
   Set via Settings → Secrets and variables → Actions:
   - `EXPO_TOKEN` — from https://expo.dev/settings/access-tokens
   - `GOOGLE_SERVICE_ACCOUNT_KEY_B64` — from step 4

---

## 2. Cutting a store release

The `.github/workflows/mobile-release.yml` workflow triggers on annotated
tags matching `mobile-v*`.

```bash
# Make sure master is green first.
git fetch --tags
git tag -a mobile-v1.2.3 -m "Pro subscription UI + event-card v2"
git push origin mobile-v1.2.3
```

What happens:
1. GitHub Actions runs `eas build --profile production --platform all --non-interactive --auto-submit`.
2. EAS builds iOS + Android. ~18-25 min iOS (queue + build), ~10 min Android.
3. On success, EAS Submit uploads iOS to TestFlight and Android to the
   Play Console internal track (see `submit.production.android.track`).
4. You manually promote from TestFlight to App Store (Apple still requires
   human review; EAS can't automate that).
5. Same for Play: promote internal → closed testing → production via
   Play Console.

Monitor the build at https://expo.dev/accounts/<slug>/projects/sovio/builds.

---

## 3. Shipping an OTA update (no native rebuild)

Use only when the change is JS-only — any native module touch (new Expo
plugin, SDK upgrade, added permission) requires a real build above.

```bash
pnpm --filter @sovio/mobile exec eas update \
  --branch production \
  --message "Fix suggestions pagination N+1"
```

The app picks up the OTA on the next cold start if `runtimeVersion` on the
installed binary matches the update's runtime version (we use
`policy: appVersion`, so bumping the native version in `app.json` breaks
the OTA chain — that's intentional).

**Do NOT** OTA a fix into production for a bug you haven't reproduced in
a `preview` build first. OTAs are fast and silent — both feature, both bug.

---

## 4. Rolling back

- **Store build**: no "rollback" button. Submit the previous good version as
  a new build with a higher versionCode (Play) / build number (iOS). Apple
  review adds ~24h latency — plan OTA coverage for the gap.
- **OTA**: republish the previous update.
  ```bash
  eas update --branch production --message "Revert to build 42 behavior" \
    --republish --group <previous-update-group-id>
  ```

---

## 5. Version numbering

- `apps/mobile/app.json → expo.version` is the user-visible version ("1.2.3").
- `versionCode` (Android) and `buildNumber` (iOS) are managed by EAS via
  `build.production.autoIncrement: true` in eas.json. Don't hand-edit those.
- Git tag matches `mobile-v${expo.version}`. If you rev `app.json` to 1.2.3,
  the tag is `mobile-v1.2.3`. CI uses the tag as the authoritative signal.
