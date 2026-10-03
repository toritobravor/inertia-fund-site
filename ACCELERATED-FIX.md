# Accelerated Inertia Pipeline Fix

## Problem
After deploying PR #12, `accelerated.inertia.fund` loaded behind Access but showed no companies despite the Notion integration having read access to the database.

## Diagnosis

### Issue 1: Wrong Database ID ❌
**Location:** `src/notion-accelerated.js`

```javascript
// WRONG - This is the data source ID, not the database ID
const DATABASE_ID = "8ed354cc-e14d-4979-8d9c-6921d6654609";
```

**Problem:** With Notion-Version 2022-06-28, the endpoint `/v1/databases/{database_id}/query` requires the **database page ID** (32-hex UUID from the page URL), not the **data source ID**.

**Database URL:** `https://app.notion.com/p/0498728f95b14930a4a7dfc7925d7d11`
**Correct Database ID:** `0498728f-95b1-4930-a4a7-dfc7925d7d11`

The spec mentioned both IDs:
- Database page ID: `0498728f95b14930a4a7dfc7925d7d11` ✓ (correct for API)
- Data source ID: `8ed354cc-e14d-4979-8d9c-6921d6654609` (internal Notion reference)

**Reference:** The working triage site (`src/notion-grades.js`) uses the database page ID pattern:
```javascript
const DATABASE_ID = "43cda90877814ae89d2f5e80072b8730"; // Early Stage Grades database
```

### Issue 2: Empty Results Cached ❌
**Location:** `src/worker.js`

The code cached whatever Notion returned, even if it was 0 results due to an error. Once cached, the empty result would be served for 5 minutes.

```javascript
// WRONG - Caches empty results
await env.DESK_KV.put(ACCELERATED_CACHE_KEY, JSON.stringify({ data: pipeline, at: Date.now() }), {
  expirationTtl: ACCELERATED_CACHE_TTL_SEC * 2
});
```

### Issue 3: Frontend Errors Swallowed ❌
**Location:** `public/desk/accelerated/app.js`

API errors were logged to console but not displayed to partners, making diagnosis impossible.

```javascript
// WRONG - Errors hidden from users
console.error("API error:", errBody.error || `HTTP ${res.status}`);
DATA = [];
```

Partners saw empty lists with no indication of what went wrong.

## Fix

### 1. Use Correct Database ID ✅
```javascript
// Database page ID from https://app.notion.com/p/0498728f95b14930a4a7dfc7925d7d11
// With Notion-Version 2022-06-28, use /v1/databases/{database_id}/query with the database page ID
const DATABASE_ID = "0498728f-95b1-4930-a4a7-dfc7925d7d11";
const NOTION_VERSION = "2022-06-28";
```

### 2. Skip Caching Empty Results ✅
```javascript
// Only cache non-empty results; empty results may indicate an error that should not be cached
if (env.DESK_KV && pipeline.length > 0) {
  await env.DESK_KV.put(ACCELERATED_CACHE_KEY, JSON.stringify({ data: pipeline, at: Date.now() }), {
    expirationTtl: ACCELERATED_CACHE_TTL_SEC * 2
  });
  console.log("Cached accelerated pipeline in KV");
} else if (pipeline.length === 0) {
  console.warn("Skipping cache for empty pipeline result");
}
```

### 3. Surface Errors to Partners ✅
```javascript
let loadError = null;

async function loadData() {
  try {
    const res = await fetch("/desk/api/accelerated", { credentials: "same-origin", cache: "no-store" });
    if (res.ok) {
      const body = await res.json();
      DATA = body.pipeline || [];
      loadError = null;
      console.log(`Loaded ${DATA.length} accelerated pipeline entries`);
    } else {
      const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      const errorMsg = errBody.message || errBody.error || `HTTP ${res.status}`;
      loadError = `API error: ${errorMsg}`;
      console.error("API error:", errBody);
      DATA = [];
    }
  } catch (err) {
    loadError = `Failed to load pipeline: ${err.message}`;
    console.error("Failed to load pipeline:", err);
    DATA = [];
  }
}
```

Error display in UI:
```javascript
if (loadError) {
  container.innerHTML = `<div style="padding: 1.5rem; background: var(--warn); border-radius: 6px; margin: 1rem 0;">
    <strong>Error loading data:</strong><br>${esc(loadError)}<br>
    <small style="margin-top: 0.5rem; display: block;">Check the browser console and Worker logs for details.</small>
  </div>`;
  return;
}
```

### 4. Enhanced Worker Error Details ✅
```javascript
return json({ 
  error: "Failed to fetch from Notion", 
  message: err.message,
  details: err.stack,  // Added for debugging
  fallback: true 
}, 502);
```

## Root Cause (Two Sentences)

The code was using the data source ID (`8ed354cc-e14d-4979-8d9c-6921d6654609`) instead of the database page ID (`0498728f-95b1-4930-a4a7-dfc7925d7d11`) when calling `/v1/databases/{database_id}/query` with Notion-Version 2022-06-28, causing Notion to return zero results. Additionally, the empty result was cached in KV and frontend errors were hidden from partners, making the problem invisible until manually inspecting Worker logs.

## Pull Request

**PR #13:** https://github.com/toritobravor/inertia-fund-site/pull/13
**Branch:** `cursor/fix-accelerated-empty-pipeline-5578`
**Status:** Open, not merged (per instructions)

## Files Changed

1. `src/notion-accelerated.js` — Corrected DATABASE_ID to use database page ID
2. `src/worker.js` — Skip caching empty results, add error details
3. `public/desk/accelerated/app.js` — Surface API errors to partners in UI

## Testing Checklist

After merging:
- [ ] Visit https://accelerated.inertia.fund
- [ ] Verify companies appear in Scout Results
- [ ] Verify companies appear in Grades & Ranking
- [ ] Check Worker logs for successful Notion query
- [ ] Verify cache is working (second load faster)
- [ ] If still empty, check error message displayed in UI
- [ ] Confirm database ID matches: `0498728f-95b1-4930-a4a7-dfc7925d7d11`

## Notes

- The triage site uses the same pattern: database page ID with Notion-Version 2022-06-28
- The spec mentioned both IDs; the database page ID is correct for API calls
- Empty cache entries from the old code will be replaced on first successful query
- Partners now see error messages if Notion API fails
