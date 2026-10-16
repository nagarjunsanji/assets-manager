# ASSET-MANAGER

A self-hosted, frontend-only **family office dashboard** for tracking a household's whole asset base: investments, real estate, agriculture, livestock, private lending, insurance, liabilities and goals. It is built on Angular 20 and Firebase (Auth, Firestore and Hosting).

---

## Tech stack

| Layer | Technology |
| --- | --- |
| UI | Angular 20 (standalone components, Signals, new control flow), Angular Material 3, SCSS |
| Charts | ApexCharts + ng-apexcharts |
| State | Angular Signals + RxJS interop (`toSignal`/`toObservable`) |
| Data | Cloud Firestore (with offline persistence), per-user subcollections |
| Files | Small PDFs and images stored as Firestore documents |
| Auth | Firebase Authentication (Google sign-in, allowlisted account only) |
| Hosting | Firebase Hosting + Angular service worker (PWA) |

---

## Features

- **Dashboard**: net worth, total assets and liabilities, passive income, monthly cash flow, investment returns, and a 0–100 financial health score.
- **Modules** (all with CRUD, KPIs and charts): Properties, Agriculture Lands, Livestock (family tree with age and performance hover cards), Private Lending (flat, reducing-balance and bullet interest), Stocks, Mutual Funds (CAGR and XIRR), Fixed Deposits, Other Assets (bonds, savings, gold, silver, crypto, EPF, PPF, NPS, machinery, receivables), Insurance (renewal alerts), Vehicles, Liabilities, Goals.
- **Document Vault**: store PDFs and images up to 700 KB directly in Firestore and link them to properties, livestock, insurance policies or loans.
- **Analytics**: 15 ApexCharts views (net worth growth, allocation, assets vs liabilities, passive income, wealth trend, investment growth, lending growth, agriculture revenue, livestock profitability by location, livestock value, property appreciation, goal progress, FIRE progress, cash flow, income sources).
- **FIRE dashboard**: target, progress, gap, estimated FIRE date and a projection chart.
- **Wealth simulator**: best, expected and worst cases plus an inflation-adjusted projection.
- **Layout**: collapsible sidebar, global search, notifications (insurance renewals, FD maturities, loan due dates, vaccinations), profile menu, and a dark/light theme switcher.
- **PWA**: installable, with offline caching of the app shell and Firestore's offline cache.
- **International stocks**: USD stock quotes (Yahoo Finance) and USD/INR reference rates (Frankfurter) refresh independently at most once per day from the browser. If either provider is unavailable, the last saved value for that field is retained. This best-effort refresh may be blocked by browser CORS or rate limits.

---

## Folder structure

```
asset-manager/
├── firebase.json              # Hosting, rules, emulators
├── .firebaserc                # Project: nsanji-asset-manager
├── firestore.rules            # Per-user data isolation
├── firestore.indexes.json
├── ngsw-config.json           # Service worker caching
├── public/                    # Manifest, icons
└── src/
    ├── environments/          # Firebase config per build
    ├── styles.scss            # Material theme entry
    ├── styles/                # Design tokens, Material overrides, layout and animations
    └── app/
        ├── app.config.ts      # Providers (router, http, SW)
        ├── app.routes.ts      # Lazy-loaded feature routes
        ├── core/
        │   ├── auth/          # Google-only AuthService with account allowlist
        │   ├── data/          # Firestore-backed user data store
        │   ├── firebase/      # Lazy Firebase SDK initialisation
        │   ├── layout/        # Shell: sidebar, toolbar, search, notifications
        │   └── theme/         # ThemeService (dark/light)
        ├── guards/            # authGuard, guestGuard
        ├── interceptors/      # HTTP error interceptor
        ├── models/            # Strongly typed domain models
        ├── services/
        │   ├── repositories/  # BaseRepository<T> + one repository per collection
        │   ├── portfolio.service.ts      # Aggregated analytics (signals)
        │   ├── notification.service.ts   # Renewal and maturity alerts
        │   ├── search.service.ts         # Global search index
        │   ├── document-vault.service.ts
        │   ├── profile.service.ts
        │   └── portfolio-backup.service.ts
        ├── shared/
        │   ├── components/    # EntityPage, DataTable, ChartCard, StatCard, CountUp, PageHeader
        │   └── dialogs/       # Generic EntityFormDialog, ConfirmDialog
        ├── utilities/         # Finance math (XIRR, CAGR, EMI, FD, lending), portfolio engine
        └── features/          # One folder per module (lazy-loaded pages)
```

---

## Data model (Firestore)

Each user's data lives under their own document, so security rules stay simple and strict:

```
users/{uid}                         # profile: income, expenses, SWR, return, inflation
users/{uid}/assets/{id}             # bonds, savings, gold, silver, crypto, EPF, PPF, NPS, machinery, receivables
users/{uid}/properties/{id}
users/{uid}/agricultureLands/{id}
users/{uid}/livestock/{id}          # optional farm name/location stored on livestock
users/{uid}/lending/{id}
users/{uid}/stocks/{id}
users/{uid}/mutualFunds/{id}
users/{uid}/fixedDeposits/{id}
users/{uid}/insurance/{id}
users/{uid}/vehicles/{id}
users/{uid}/liabilities/{id}
users/{uid}/goals/{id}
users/{uid}/documents/{id}          # document metadata and optional small base64 file content
users/{uid}/networthHistory/{YYYY-MM}
```

All reads and writes go through repository services (`PropertyRepositoryService`, `LivestockRepositoryService`, `LendingRepositoryService`, and so on), which extend a generic `BaseRepository<T>`. Each repository exposes:

- `items`: a live `Signal<T[]>` backed by `onSnapshot`
- `create`, `update`, `upsert`, `delete`, `replaceAll`, `clear`

`networthHistory` gets a monthly snapshot automatically. The trend charts use it.

---

## Getting started

### Prerequisites

- Node.js 20.19+ or 22.12+
- A Firebase project (default: `nsanji-asset-manager`)

### 1. Install

```bash
npm install
```

### 2. Configure Firebase

1. In the [Firebase console](https://console.firebase.google.com/), open **nsanji-asset-manager**, go to **Project settings → Your apps**, and add a **Web app**.
2. Copy the config into `src/environments/environment.ts` (production) and `src/environments/environment.development.ts` (dev).
3. **Authentication → Sign-in method**: enable **Google** and disable all other providers. The verified Google account `nagarjun.sanji@gmail.com` is the app owner. Other verified Google accounts can request access; the owner must approve them in Firestore before they can use the app.
4. **Authentication → Settings → Authorized domains**: ensure `nsanji-asset-manager.firebaseapp.com` and, for local development, `localhost` are authorized.
5. Create a **Firestore database** in production mode.

> The Firebase web config is not a secret. Data access is enforced by `firestore.rules`. The super-admin is identified by the verified email `nagarjun.sanji@gmail.com`; the rules compare the email case-insensitively.

### 3. Run locally

```bash
npm start          # http://localhost:4200
```

Sign in with the Google account `nagarjun.sanji@gmail.com`. Other verified Google accounts can sign in to request access, but remain blocked from app data until approved. As super admin, review pending requests from the **Access approvals** panel on your dashboard and choose **Approve**. Until approval, the applicant sees an approval-pending message. The panel updates live from Firestore; no direct database edits or Cloud Functions are required. This manual flow does not send an email notification. In Settings, choose **Test Firestore connection** to verify the signed-in account can reach the live database, or **Export JSON backup** to download a local backup. Production UI does not include sample-data loading or bulk record deletion.

The document vault stores files directly in Firestore, so uploads are limited to 700 KB. Larger files must be kept outside the app and can be linked separately.

### 4. Firebase emulators (optional)

```bash
npm run emulators
```

---

## Deployment

### Live application

The production app is hosted at **[https://nsanji-asset-manager.firebaseapp.com](https://nsanji-asset-manager.firebaseapp.com)**. Dashboard route: [https://nsanji-asset-manager.firebaseapp.com/dashboard](https://nsanji-asset-manager.firebaseapp.com/dashboard).

### Manual deployment

```bash
# one-time
npx firebase-tools login

# deploy security rules and indexes
npm run deploy:rules

# build and deploy hosting
npm run deploy:hosting

# or everything at once
npm run deploy
```

The production build is written to `dist/asset-manager/browser`, which `firebase.json` serves with:

- SPA rewrites to `index.html`
- Long-lived immutable caching for hashed assets
- `no-cache` for `index.html`, `ngsw-worker.js` and `ngsw.json`, so PWA updates roll out right away
- Security headers (HSTS, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`)

### Automatic deployment (GitHub Actions)

The workflow in `.github/workflows/firebase-deploy.yml` builds the app and deploys Firebase Hosting, Firestore rules, and Firestore indexes to project `nsanji-asset-manager` whenever code is pushed to `main`. It can also be started manually from the repository's **Actions → Deploy to Firebase → Run workflow** page. After a successful run, the updated app is available at the live URL above.

#### GitHub Actions setup

The deployment workflow is configured and has successfully deployed the hosted app. To recreate or troubleshoot its setup:

1. Create a dedicated Google Cloud service account for Firebase deployment in project `nsanji-asset-manager` and grant it:
   - **Firebase Hosting Admin** (`roles/firebasehosting.admin`) for Hosting deployments.
   - **Firebase Rules Admin** (`roles/firebaserules.admin`) for Firestore rules.
   - **Cloud Datastore Index Admin** (`roles/datastore.indexAdmin`) for Firestore indexes.
   - **Service Usage Consumer** (`roles/serviceusage.serviceUsageConsumer`) so Firebase CLI can check whether required Google APIs are enabled.
2. Generate a JSON key for the service account.
3. In the GitHub repository, go to **Settings → Secrets and variables → Actions → New repository secret**. Name it `FIREBASE_SERVICE_ACCOUNT` and use the complete JSON key as the value. Never commit the key to the repository.
4. Push to `main` and check **Actions → Deploy to Firebase** for the build and deployment result.

Required Google APIs must be enabled on the project. If a deployment fails with `Permission denied to get service ...` from `serviceusage.googleapis.com`, make sure the deployment service account has **Service Usage Consumer** on `nsanji-asset-manager`, then rerun the failed workflow. If an API is disabled, ask a project administrator to enable it. Do not grant broad Owner access to the deployment account.

The deployment job runs only after the production build succeeds. Pull requests and pushes to other branches do not deploy to production.

---

## Calculations

| Metric | Formula |
| --- | --- |
| Appreciation | (current − cost) / cost |
| Property ROI | (capital gain + net rent × years held) / cost |
| Rental yield | annual rent / current value |
| Revenue per acre | annual revenue / acres |
| CAGR | (end / start)^(1/years) − 1 |
| XIRR | Newton–Raphson with bisection fallback over the SIP cash flows |
| FD value | P(1 + r/n)^(nt), or simple interest |
| Lending (flat) | P × r × t |
| Lending (reducing) | EMI amortisation; sum of the interest portions |
| Lending (bullet) | P((1 + r/12)^m − 1), due at maturity |
| Liability interest paid | EMI × months elapsed − principal repaid |
| FIRE target | annual expenses × (100 / SWR) |
| FIRE date | month-by-month compounding against an inflation-adjusted target |
| Health score | emergency fund (20) + debt load (20) + insurance (20) + savings rate (20) + diversification (20) |

---

## Security notes

- Every user Firestore path is scoped to `request.auth.uid` and requires an approved, verified Google account. Users can create their own pending access request but cannot approve themselves; only the owner account can change approval flags. All other paths are denied.
- Document uploads are limited to PDFs and images under 700 KB in the app; Firestore rules limit embedded file data to fit safely under the 1 MiB per-document limit.
- The post-login `returnUrl` is restricted to in-app relative paths, which blocks open redirects.
- External document links use `rel="noopener noreferrer"`.
