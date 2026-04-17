# iOS — App Store Connect App Privacy answers

Literal answers for the **App Privacy** section at
App Store Connect → My Apps → Sovio → App Privacy.

Reviewed against Apple's [Data Collection categories](https://developer.apple.com/app-store/app-privacy-details/).
Re-review whenever `apps/mobile/ios/PrivacyInfo.xcprivacy` changes, whenever a
new SDK is added, or at minimum every 12 months.

---

## Q1. Do you or your third-party partners collect data from this app?

**Answer:** Yes.

Third-party SDKs present:
- Sentry (`@sentry/react-native`) — crash + performance diagnostics.
- Supabase (via `@sovio/core`) — backend of record; first-party-equivalent for
  our purposes since we operate the Supabase project ourselves.

---

## Q2. Data types collected

For every "Yes", Apple asks:
1. Is it **linked to the user's identity**?
2. Is it **used for tracking**? (Tracking = linking with third-party data for
   advertising or sharing with a data broker.) **Always "No" for Sovio.**
3. **Purposes.** Pick from: App Functionality, Analytics, Product
   Personalization, App Advertising, Other Advertising, Developer
   Communications, Third-Party Advertising, Fraud Prevention, Other.

### Contact Info → Email Address
- Collected: **Yes**
- Linked to user: **Yes**
- Used for tracking: **No**
- Purposes: **App Functionality**, **Account Management** (maps to "App
  Functionality" in App Store Connect's picker)

### Contact Info → Name
- Collected: **Yes** (display name)
- Linked to user: **Yes**
- Used for tracking: **No**
- Purposes: **App Functionality**

### User Content → Photos or Videos
- Collected: **Yes** (profile photos)
- Linked to user: **Yes**
- Used for tracking: **No**
- Purposes: **App Functionality**

### User Content → Other User Content
- Collected: **Yes** (chat messages + AI-generated suggestions saved to the
  user's account)
- Linked to user: **Yes**
- Used for tracking: **No**
- Purposes: **App Functionality**

### Identifiers → User ID
- Collected: **Yes** (Supabase `auth.uid` UUID)
- Linked to user: **Yes**
- Used for tracking: **No**
- Purposes: **App Functionality**

### Identifiers → Device ID
- Collected: **Yes** (APNs device push token — stored server-side so we can
  send notifications)
- Linked to user: **Yes**
- Used for tracking: **No**
- Purposes: **App Functionality**

### Location → Coarse Location
- Collected: **Yes, but only if the user grants the prompt**
- Linked to user: **Yes**
- Used for tracking: **No**
- Purposes: **App Functionality**
- Note: we never request precise location. `NSLocationWhenInUseUsageDescription`
  is the only location-permission string we declare.

### Diagnostics → Crash Data
- Collected: **Yes** (Sentry)
- Linked to user: **No** (Sentry user scope is stripped to a random session id
  before ingestion — confirm with ops before submitting)
- Used for tracking: **No**
- Purposes: **App Functionality**, **Analytics**

### Diagnostics → Performance Data
- Collected: **Yes** (Sentry traces: cold-start, slow-frame counters, API
  latency)
- Linked to user: **No**
- Used for tracking: **No**
- Purposes: **App Functionality**, **Analytics**

---

## Q3. Data NOT collected (explicit "No" — document so the reviewer doesn't ask)

- **Contact Info → Phone Number, Physical Address, Other Contact Info.**
- **Health & Fitness.**
- **Financial Info.** Billing is Stripe-hosted on web; no card data passes
  through the mobile app.
- **Location → Precise Location.**
- **Sensitive Info.** (Race, religion, sexual orientation, political opinion,
  etc.)
- **Contacts.** We don't read the device address book.
- **Audio Data, Gameplay Content, Customer Support data.**
- **Browsing History, Search History.**
- **Identifiers → Advertising Data / IDFA.** Sovio does **not** request ATT.
- **Usage Data → Product Interaction, Advertising Data, Other Usage Data.**
  `app_events` are stored server-side but not shared and not used for
  advertising; if App Store Connect flags them, file under **Other Data Types →
  Other Data** with purpose **App Functionality** only.
- **Surroundings → Environment Scanning.**
- **Body → any.**

---

## Q4. Third-party partners — attestations ops must verify before submit

- Sentry: SOC 2 Type II, EU + US regions. Configure project for EU region if
  the business is GDPR-sensitive.
- Supabase: SOC 2 Type II. Hosted on AWS (region per project).

---

## Q5. Privacy Policy URL

`https://sovio.app/privacy` — must be reachable and must specifically name
Sentry and Supabase.

---

## Q6. Data Use — App Tracking Transparency

Sovio **does not** use App Tracking Transparency (no `NSUserTrackingUsageDescription`).
If a future build adds an ad SDK or attribution SDK, this file must be updated
and a tracking-permission prompt added before submission.
