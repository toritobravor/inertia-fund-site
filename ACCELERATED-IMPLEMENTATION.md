# Accelerated Inertia Implementation Summary

## Completed: 3 October 2026

This document summarizes the implementation of the Accelerated Inertia app at `accelerated.inertia.fund`.

## Architecture

### Worker Configuration
- **Hostname**: `accelerated.inertia.fund`
- **Worker**: `inertia-fund-site` (same Worker as triage, new hostname routing)
- **Access control**: Same Cloudflare Access + DESK_ROLES gating as triage.inertia.fund
- **Pattern**: Read-only, Notion-backed, cached, partner-gated

### Data Flow
1. User visits `accelerated.inertia.fund`
2. Cloudflare Access authenticates via Google OAuth
3. Worker verifies JWT, checks DESK_ROLES
4. Worker serves HTML/CSS/JS from assets bundle
5. Client fetches data from `/desk/api/accelerated`
6. Worker queries Notion database `8ed354cc-e14d-4979-8d9c-6921d6654609`
7. Worker caches response in KV for 5 minutes
8. Client renders five views from Notion data

### Files Created

#### Backend
- `src/notion-accelerated.js` — Notion integration for Accelerated Inertia Pipeline database
  - `queryAcceleratedPipeline()` — Fetch all pages with pagination
  - `mapAcceleratedPageToCard()` — Transform Notion properties to card shape
  - `transformAcceleratedPages()` — Batch transform
  - Composite calculation fallback: 20 × (0.20 D + 0.16 U + 0.13 M + 0.13 F + 0.12 I + 0.09 R + 0.09 T + 0.08 P)

#### Worker Routes (src/worker.js)
- New constant: `ACCELERATED_HOST = "accelerated.inertia.fund"`
- New handler: `accelerated()` — Same Access gating as triage, serves `/desk/accelerated/` assets
- New API: `handleAcceleratedApi()` — `GET /desk/api/accelerated` with 5-min KV cache
- New cache key: `ACCELERATED_CACHE_KEY = "notion:accelerated"`

#### Frontend
- `public/desk/accelerated/index.html` — Main page with five tabs (Purpose, Scout Results, Grades & Ranking, Method, Change Log)
- `public/desk/accelerated/style.css` — Brand styles, card layout, pills, detail panel
- `public/desk/accelerated/app.js` — Client-side logic: data loading, tab switching, rendering
- `public/desk/accelerated/mock-data.js` — Mock fixture of 10 companies for local development
- `public/desk/accelerated/README.md` — Documentation of the app and methodology

#### Testing
- `test-forbidden-names.mjs` — CI test to block forbidden names from appearing in code
- Checks 5 files: notion-accelerated.js, index.html, style.css, app.js, mock-data.js
- Reads denylist from `FORBIDDEN_NAMES` environment variable (comma-separated)
- Exits with code 1 if any forbidden name is found

#### Configuration
- `package.json` — Added `test` script: `node test-forbidden-names.mjs`

## Features Implemented

### 1. Purpose View
- The Accelerated Inertia purpose line (draft for committee to edit)
- The investment question: "Can this already-sold product be sold, made and financed again?"

### 2. Scout Results View
- Every candidate the Scout brought forward
- Scout summary, scout source link, found-by, date found
- All rows from the database (no filtering)

### 3. Grades & Ranking View
- Ranked cards with rank, composite /100, stressed composite, action, data confidence
- Pass/Fail at 55 for stress result
- Floor checks: DIVE (D, U ≥ 2) and IC1/IC2 (D, U, P ≥ 3)
- Label: "Grading under Methodology v1.2 — graded <Grade date>"
- Score status displayed (e.g., "Graded (v1.2)")
- Click a card to open detail panel

### 4. Company Detail Panel
- **8-axis breakdown**: D, U, M, F, I, R, T, P with weights and scores
- **Bar view** with axis grid
- **Rationale and sources**: One line per axis, each with a clickable URL
- **Gates A1–A9**: Pass/fail status
- **Floors**: DIVE and IC1/IC2 floor checks
- **Stress result**: Stressed composite, worst shock, stress spread, pass/fail at 55, regime-dependent flag
- **Deal Fit box**: Visibly separate from composite, never added in
  - L (leverage): "Partner to score" when blank
  - P (price)
  - Portfolio fit
- **Flags**: Discretionary subsidy, compliance-mandated, runway <18mo, competition, alignment
- **Why this one**: Differentiation statement
- **Thesis**: Investment thesis
- **Unknowns**: Key unknowns
- **Watch trigger**: Milestone to watch
- **Key people**: Leadership
- **Last raise**: Financing history
- **Website**: Company URL
- **Metadata**: Methodology version, score status, graded by (sanitized to "Investment Committee"), grade date, data confidence
- **Human Intuition**: Shown only if a value exists (read-only, never written)

### 5. Method View
- Summary of Methodology v1.2
- Entry gates A1–A9
- Repeatability Scorecard with 8 axes and weights
- Composite formula
- Floors by stage
- Screening actions (STOP, WATCH, WATCH-PRICE, DIVE)
- Stress overlay (six shocks)
- Deal Fit (L, P, Portfolio fit)
- Flags
- Return bar (proposed)

### 6. Change Log View
- v1.0: 3 Oct 2026, first grading of 10 scout candidates under v1.2
- Methodology v1.2 vs v1.1 changes:
  - One scorecard (Investment Case Scorecard withdrawn)
  - Deal Fit replaces blended composite
  - Return bar reconciled with 16–20% net target
  - Position limits: 10% initial / 20% total
  - Blind second score before IC1, dissent memo at IC2
  - Expedited track
  - Gate A6 split
  - Subsidy rule narrowed to discretionary subsidy
  - New runway, competition, and alignment flags
  - Unknown rule closed
  - 12-month outcome measures
  - Falsifiable outcome log

## Privacy Constraints (Hard Constraints Met)

✅ The managing partner's personal name appears nowhere:
- Not in code
- Not in copy
- Not in comments
- Not in commit messages
- Not in the PR title or body
- Not in test fixtures

✅ Sanitization:
- "Graded by" field shows "Investment Committee" instead of partner names
- Human Intuition field only shown if a value exists (read-only)

✅ CI/test check:
- `test-forbidden-names.mjs` fails if any name from `FORBIDDEN_NAMES` appears in the new app's files
- Denylist read from CI secret/env var, never hard-coded in repo

✅ Read-only against Notion:
- The app never writes Human Intuition or any other field
- All Notion operations are `queryAcceleratedPipeline()` (query only, no mutations)

## Manual Cloudflare Setup Required

The following steps must be completed manually in the Cloudflare dashboard:

### 1. Worker Route / Custom Domain
- Add custom domain: `accelerated.inertia.fund` to Worker `inertia-fund-site`
- Or configure DNS CNAME: `accelerated` → `inertia-fund-site.workers.dev` (proxied)

### 2. Cloudflare Access
**Option A** (recommended): Add hostname to existing Access app
- Edit the Access application that covers `triage.inertia.fund`
- Add application domain: `accelerated.inertia.fund`

**Option B**: Create new Access app
- Application name: Accelerated Inertia Desk
- Application domain: `accelerated.inertia.fund`
- Policy: Same partner policy as triage
- Note the AUD tag (reuse `CF_ACCESS_AUD` if same policy)

### 3. Secrets (already configured, reused)
- `NOTION_TOKEN` — Notion integration token (read access to both databases)
- `CF_ACCESS_TEAM_DOMAIN` — e.g. `https://inertiafund.cloudflareaccess.com`
- `CF_ACCESS_AUD` — Application Audience tag
- `DESK_ROLES` — JSON partner/expert mapping
- `REFRESH_KEY` — Optional cache refresh key

### 4. Share Notion Database
- Open: https://app.notion.com/p/0498728f95b14930a4a7dfc7925d7d11
- Click **••• More** → **Connections** → **Connect to**
- Select the integration that owns `NOTION_TOKEN`
- Grant read-only access

### 5. KV Namespace (already exists)
- `inertia-fund-desk` (ID: `81eb0ef89e134b3889d3b2ae54851882`)
- Bound in `wrangler.jsonc` as `DESK_KV`
- Reused for caching both triage grades and accelerated pipeline

### 6. Deploy
- Merge PR to `main`
- Cloudflare Workers Builds deploys automatically
- Verify at: https://accelerated.inertia.fund

## Testing

### Local Development
```bash
npm run dev
```

Uncomment the mock-data.js script tag in `index.html` to use mock data.

### Unit Tests
```bash
npm test
```

Runs the forbidden-names check with `FORBIDDEN_NAMES` environment variable.

### Manual Testing Checklist
- [ ] Worker builds successfully
- [ ] `npm test` passes
- [ ] Custom domain `accelerated.inertia.fund` configured
- [ ] DNS record proxied
- [ ] Cloudflare Access application covers `accelerated.inertia.fund`
- [ ] Notion database shared with integration
- [ ] All secrets and variables set
- [ ] Access policy grants entry to partner emails
- [ ] Visit https://accelerated.inertia.fund
- [ ] Login via Cloudflare Access succeeds
- [ ] Purpose view loads
- [ ] Scout Results view shows all candidates
- [ ] Grades & Ranking view shows ranked cards from Notion
- [ ] Clicking a card opens detail panel
- [ ] Detail panel shows all fields
- [ ] Method view shows methodology
- [ ] Change Log view shows v1.0 and v1.2 changes
- [ ] Human Intuition only shown if value exists
- [ ] No forbidden names appear in UI
- [ ] Cache refresh works: `?refresh=<REFRESH_KEY>`
- [ ] Cache served on repeated loads within 5 minutes

## Notion Database Properties Read

The app reads these properties from the "Accelerated Inertia — Pipeline" database:

### Company Identification
- Company (title)
- Rank (number)

### Scorecard
- D Sold again (number)
- U Unit economics (number)
- M Made again (number)
- F Financed again (number)
- I Improves again (number)
- R Regime portability (number)
- T Team (number)
- P Price (number)
- Composite (formula, computed as fallback if null)

### Screening
- Stage (select)
- Action (select)
- Gates A1-A9 (rich text)
- Floor check DIVE (D,U>=2) (formula)
- Floor check IC1/IC2 (D,U,P>=3) (formula)

### Stress Testing
- Stressed composite (formula)
- Worst shock (select)
- Stress spread (number)
- Stress result (>=55) (formula)
- Regime-dependent (checkbox)

### Deal Fit
- Deal Fit L (leverage) (number or text)
- Deal Fit L status (rich text)
- Deal Fit P (price) (number)
- Deal Fit Portfolio fit (rich text)

### Flags
- Flag: discretionary subsidy share (checkbox)
- Flag: compliance-mandated share (checkbox)
- Flag: runway (checkbox)
- Flag: competition (checkbox)
- Flag: alignment (checkbox)

### Analysis
- Why this one (rich text)
- Thesis (rich text)
- Unknowns (rich text)
- Watch trigger (rich text)
- Rationale and sources (rich text, one line per axis with URLs)

### Metadata
- Methodology version (select)
- Score status (select)
- Graded by (people, sanitized to "Investment Committee")
- Grade date (date)
- Data confidence (select)

### Scout Information
- Scout summary (rich text)
- Found by (rich text)
- Date found (date)
- Scout source (url)

### Company Profile
- Website (url)
- Key people (rich text)
- Last raise (rich text)
- Country (select)
- Bottleneck (rich text)
- AI dependence (select)
- Origin risk (select)

### Human Intuition
- Human intuition (rich text, shown only if exists, read-only)

## Pull Request

- **PR**: https://github.com/toritobravor/inertia-fund-site/pull/12
- **Branch**: `cursor/accelerated-inertia-app-5578`
- **Status**: Open (not merged)
- **Ready to merge**: After manual Cloudflare setup is complete

## Done When

✅ The Worker builds successfully
✅ Tests pass locally (`npm test`)
✅ Every page renders from a fixture of 10 rows (mock-data.js)
✅ The name-check passes
✅ A PR is open (not merged) with the manual steps listed

## Next Steps

1. Review the PR: https://github.com/toritobravor/inertia-fund-site/pull/12
2. Complete the manual Cloudflare setup steps above
3. Test the app end-to-end at https://accelerated.inertia.fund
4. Merge the PR to `main` once testing is complete

---

Implementation completed by Cursor Cloud Agent on 3 October 2026.
