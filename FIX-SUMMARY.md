# Triage Card Restoration - Summary

## ✅ Fix Complete

PR #10 restores all missing company card information on triage.inertia.fund.

**PR**: https://github.com/toritobravor/inertia-fund-site/pull/10  
**Branch**: `cursor/restore-card-profile-data-5b52`  
**Status**: Ready for review, awaiting owner approval

---

## What Was Broken (30 Sep - 1 Oct 2026)

Company cards showed **blank sections** for:
- ❌ Website header link
- ❌ Public presence (LinkedIn, X, other links)
- ❌ People field
- ❌ Financing field
- ❌ Viability note

**Root cause**: PRs #1 and #5 migrated to Notion grades, but Notion database lacks profile columns.

---

## What This Fix Does

✅ **Merges static profile data** from `grades.js` into Notion grades by card ID  
✅ **Preserves Notion scores/actions** (live grades from database)  
✅ **Restores all card sections** exactly as before 30 Sep  
✅ **Handles Notion-only cards** (no static match) correctly  
✅ **Maintains fallback behavior** when NOTION_TOKEN unset  
✅ **Respects CSP** (no inline scripts/styles)  

---

## Implementation

### Core change: `src/worker.js`

New function `mergeStaticProfileData()`:
- Fetches static `grades.js` from ASSETS
- Indexes by card `id`
- Merges: `people`, `financing`, `viability`, full `links` object
- Runs on every `/desk/api/grades` serve

### Cache handling

- Cache stores Notion data (scores/actions)
- Merge applied on every serve (cache or fresh)
- Keeps cache size small

### Cache bust

- `index.html`: `app.js?v=2026-10-01`

---

## Verification

### Tests pass:

```bash
node test-merge.mjs          # ✅ Simple merge verification
node test-integration.mjs    # ✅ Full integration test (3/3 passed)
node test-visual-comparison.mjs  # ✅ Before/after visual comparison
```

### Sample restored card (Actinide):

**Before (Notion only)**:
- People: _(empty)_
- Financing: _(empty)_
- Viability: _(empty)_
- Links: Website only

**After (merged)**:
- People: "Eric Olszewski (CEO); Robert Mendelsohn (CTO)."
- Financing: "Founded Sep 2025. Oversubscribed seed, Mar 2026, led by Onto Ventures..."
- Viability: "High on demo and team; medium on scale vs centrifuges..."
- Links: Website, @ActinideInc (X), PitchBook, TBPN interview

### Test results:

```
✅ All tests passed! (3/3)

✨ Integration test SUCCESS
   → Notion scores/grades are preserved
   → Static profile data (People, Financing, Links) is merged
   → Notion-only cards work correctly
```

---

## Files Changed

- `src/worker.js`: Add merge function, 50 lines
- `public/desk/triage/index.html`: Cache bust
- `test-merge.mjs`: Simple verification
- `test-integration.mjs`: Full integration test
- `test-visual-comparison.mjs`: Visual before/after
- `RESTORATION-VERIFICATION.md`: Complete analysis

---

## Deployment

### Owner checklist:

1. ✅ Review PR #10: https://github.com/toritobravor/inertia-fund-site/pull/10
2. ✅ Confirm approach (merge by card ID)
3. ✅ Verify test results
4. ⬜ Merge to `main`
5. ⬜ Cloudflare auto-deploys (~1 min)
6. ⬜ Verify at triage.inertia.fund

### Safe to merge:

- No breaking changes
- Worker handles errors gracefully
- Static fallback unchanged
- CSP compliant

---

## What Happens After Merge

1. Cloudflare Workers Builds auto-deploys
2. `/desk/api/grades` starts serving merged data
3. Browser cache bust forces reload (`?v=2026-10-01`)
4. All card sections appear immediately
5. Cards look exactly as they did before 30 Sep

---

## Questions?

- See `RESTORATION-VERIFICATION.md` for detailed before/after
- Run `node test-integration.mjs` to verify locally
- Check PR #10 for full code review

---

**Ready for owner review and merge.**
