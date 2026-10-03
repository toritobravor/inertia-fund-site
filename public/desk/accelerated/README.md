# Accelerated Inertia — Inertia Fund Desk

The Accelerated Inertia app at `accelerated.inertia.fund` shows every candidate the Scout brought forward, graded under Methodology v1.2.

## Purpose

Can this already-sold product be sold, made and financed again?

The power system needs more capacity, faster than it can be built. Many products that help already work and already have a paying customer. What they lack is the second, tenth and hundredth order: a buyer who trusts them, a factory that can make them, and money to deploy them. Accelerated Inertia backs that step with growth capital and with people who have built and run power systems.

## Data Source

- **Notion database**: Accelerated Inertia — Pipeline
- **Database ID**: `8ed354cc-e14d-4979-8d9c-6921d6654609`
- **Cache**: 5 minutes in KV (`DESK_KV` namespace)
- **Read-only**: The app never writes to Notion

## Methodology v1.2

### Entry Gates A1–A9
1. Sold and measured
2. Money buys repetition
3. Repeatable product
4. Delivery risk not physics
5. Improvable
6. Purpose fit
7. Size and role fit (rounds $30–150m, our check $20–75m as lead or co-lead)
8. Counterparty
9. No open kill

### Repeatability Scorecard

Eight axes scored 0–5:

| Axis | Weight |
|------|--------|
| D — Sold again | 20% |
| U — Unit economics and path to profit | 16% |
| M — Made again | 13% |
| F — Financed again | 13% |
| I — Improves again | 12% |
| R — Regime portability | 9% |
| T — Team, incentives and governance | 9% |
| P — Price and return path | 8% |

**Composite** = 20 × (0.20 D + 0.16 U + 0.13 M + 0.13 F + 0.12 I + 0.09 R + 0.09 T + 0.08 P)

All 3s = 60. Unknown scores at most 2.

### Floors

- **DIVE**: D and U ≥ 2
- **IC1/IC2**: D, U, P ≥ 3

### Screening Actions

- **STOP**: Gate fails, kill, D or U below 2, or composite below 45
- **WATCH**: 45–63.9
- **WATCH-PRICE**: DIVE-quality but P below 2
- **DIVE**: 64+ with at least two axes at 4

### Stress Overlay

Six shocks evaluated:
1. Rates
2. AI data-center bust
3. Policy reversal
4. Tariffs/China
5. Commodity swing
6. Grid reform works

Stressed composite = lowest of the six. Threshold is 55 at every stage after screening. Spread > 10 marks regime-dependent.

### Deal Fit

Reported beside the score, never blended into it:

- **L** — Our leverage (scored by a partner who is not the sponsor)
- **P** — Price
- **Portfolio fit**

### Flags

- Discretionary vs compliance-mandated subsidy share
- Runway under 18 months
- Competition (no written "why this one")
- Alignment

### Return Bar (proposed)

3x by year five or 4x by year seven, 22% gross base case, bear case returns capital, credible 5x upside.

## Files

- `index.html` — Main page with five views (Purpose, Scout Results, Grades & Ranking, Method, Change Log)
- `app.js` — Client-side application logic
- `style.css` — Accelerated Inertia brand styles
- `mock-data.js` — Mock data fixture for local development (10 companies)
- `README.md` — This file

## Local Development

```bash
npm run dev
```

To use mock data in `wrangler dev`:
1. Uncomment the mock-data.js script tag in `index.html`
2. Start the dev server

## Testing

```bash
npm test
```

Runs the forbidden-names check. Set `FORBIDDEN_NAMES` environment variable (comma-separated) to block specific names from appearing in the code.

Example:
```bash
FORBIDDEN_NAMES="alice,bob" npm test
```

## Privacy

- The managing partner's personal name appears nowhere in code, comments, or commit messages
- Human Intuition field is shown only if a value exists (read-only, never written)
- Graded by field is sanitized to "Investment Committee"
- Test suite enforces name denylist via `FORBIDDEN_NAMES` environment variable

## Change Log

### v1.0 — 3 Oct 2026
First version of the Accelerated Inertia app. Initial grading of 10 scout candidates under Methodology v1.2.

### Methodology v1.2 vs v1.1
- One scorecard (Investment Case Scorecard withdrawn)
- Deal Fit replaces the blended composite
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
