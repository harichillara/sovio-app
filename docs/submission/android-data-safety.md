# Android — Google Play Console Data Safety answers

Literal answers for the **Data safety** section at
Play Console → Sovio → App content → Data safety.

Reviewed against Google Play's [Data safety requirements](https://support.google.com/googleplay/android-developer/answer/10787469).
Re-review whenever a new SDK is added, whenever the backend starts storing a
new field, or at minimum every 12 months.

---

## Section 1: Data collection and security

### Does your app collect or share any of the required user data types?
**Yes.**

### Is all of the user data collected by your app encrypted in transit?
**Yes.** All network traffic from the app to our Supabase backend and to Sentry
goes over HTTPS/TLS 1.2+. No plaintext HTTP endpoints.

### Do you provide a way for users to request that their data be deleted?
**Yes.** In-app: Settings → Delete account. Web: DSAR form at
`https://sovio.app/privacy/dsar`. Both route to the `/api/dsar` endpoint that
deletes the auth user, soft-deletes personal records, and purges storage
objects. SLA: 30 days.

### Has your app been independently validated against a global security standard (MASA)?
**No** (optional; revisit if we pursue the Play Store security badge).

---

## Section 2: Data types — per-type answers

For each type Google asks:
1. **Collected?** (data leaves the device)
2. **Shared?** (transferred to a third party — processors under contract are
   generally **not** considered "shared"; Google's own wording covers this)
3. **Processing is optional?** (can the user use the app without it)
4. **Collection purposes:** App functionality / Analytics / Developer
   communications / Advertising or marketing / Fraud prevention, security, and
   compliance / Personalization / Account management
5. **Ephemeral?** (processed in memory only, never persisted)

All Sovio data is **encrypted in transit**. None is shared with third parties
for their independent use. None is used for **advertising or marketing**.

### Personal info → Name
- Collected: **Yes** (display name)
- Shared: **No**
- Optional: **No** (required at signup)
- Purposes: App functionality, Account management

### Personal info → Email address
- Collected: **Yes**
- Shared: **No**
- Optional: **No**
- Purposes: App functionality, Account management

### Personal info → User IDs
- Collected: **Yes** (Supabase `auth.uid`)
- Shared: **No**
- Optional: **No**
- Purposes: App functionality, Account management

### Photos and videos → Photos
- Collected: **Yes** (profile photos only)
- Shared: **No**
- Optional: **Yes** (can skip uploading a profile photo)
- Purposes: App functionality, Personalization

### Messages → Other in-app messages
- Collected: **Yes** (chat threads + AI-generated suggestions)
- Shared: **No**
- Optional: **No** (messaging is the core product)
- Purposes: App functionality

### Location → Approximate location
- Collected: **Yes, but only with runtime permission**
- Shared: **No**
- Optional: **Yes**
- Purposes: App functionality

### Location → Precise location
- Collected: **No**

### App activity → App interactions
- Collected: **Yes** (our `app_events` telemetry: taps on key flows, feature
  entry points)
- Shared: **No**
- Optional: **No**
- Purposes: Analytics, App functionality

### Device or other IDs → Device or other IDs
- Collected: **Yes** (FCM registration token)
- Shared: **No**
- Optional: **Yes** (user can deny push permission)
- Purposes: App functionality

### App info and performance → Crash logs
- Collected: **Yes** (via Sentry)
- Shared: **No** (Sentry is a processor under contract, not an independent
  controller)
- Optional: **No**
- Purposes: Analytics, App functionality

### App info and performance → Diagnostics
- Collected: **Yes** (Sentry performance traces)
- Shared: **No**
- Optional: **No**
- Purposes: Analytics, App functionality

---

## Section 3: Data types — explicit "No"

- Financial info (no card or bank data in the mobile app; Stripe lives on web).
- Health and fitness.
- Contacts.
- Calendar.
- Audio files, voice or sound recordings.
- Music files.
- Web browsing history.
- Installed apps.
- Other user-generated content (beyond messages + photos — none).
- Advertising ID.
- Other app performance data.
- Files and docs.

---

## Section 4: Security practices — literal answers

- **Is data encrypted in transit?** Yes.
- **Is data encrypted at rest?** Yes (Supabase Postgres and Storage default to
  AES-256 at rest; Sentry encrypts at rest).
- **Can users request data deletion?** Yes — in-app and via
  `https://sovio.app/privacy/dsar`.
- **Do you follow the Families Policy?** No (Sovio is 12+/Teen, not
  directed to children under 13).
- **Has your app been independently reviewed (MASA)?** No.

---

## Section 5: Play Console "Target audience and content"

- Target age group: **13+** (matches the IARC Teen rating).
- Ads: **No ads** (Sovio does not show ads).
- Purchases: **Yes** (Sovio Pro subscription, if mobile IAP ships).
- User-generated content: **Yes** — messages, profile photos. Moderation:
  Supabase RLS + reporting flow in-app; abuse escalation to
  `trust@sovio.app`.

---

## Section 6: Privacy Policy URL

`https://sovio.app/privacy` — must explicitly name Sentry and Supabase, list
collected fields, and describe the DSAR path. Play will reject a generic
boilerplate policy.
