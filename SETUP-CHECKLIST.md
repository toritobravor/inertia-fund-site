# Notion Live Grades Setup Checklist

Use this checklist when setting up the Notion integration for the first time.

## Prerequisites

- [ ] You have access to the Notion workspace containing "Early Stage Grades"
- [ ] You have admin access to the Cloudflare Workers dashboard for `inertia-fund-site`
- [ ] The PR has been merged to `main`

## Step 1: Create Notion Integration (5 minutes)

1. [ ] Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. [ ] Click **"+ New integration"**
3. [ ] Fill in the form:
   - **Name**: `Inertia Fund Triage` (or similar)
   - **Workspace**: Select the workspace with Early Stage Grades
   - **Capabilities**: Check only **"Read content"** (uncheck write, comment, user info)
4. [ ] Click **"Submit"**
5. [ ] Copy the **"Internal Integration Token"** (starts with `secret_`)
   - Save it securely - you'll need it in Step 4
   - This token is read-only and scoped to only what you share with it

## Step 2: Share Database with Integration (2 minutes)

1. [ ] Open the **"Early Stage Grades"** database in Notion
2. [ ] Click the **"••• More"** menu (top right)
3. [ ] Select **"Connections"** → **"Connect to"**
4. [ ] Find and select **"Inertia Fund Triage"** (your integration)
5. [ ] Confirm the connection
   - Only this database is shared; the integration cannot see other pages

## Step 3: Add Published Property (10 minutes)

1. [ ] In the "Early Stage Grades" database, add a new property:
   - **Name**: `Published`
   - **Type**: Checkbox
2. [ ] Tick the `Published` checkbox on the 138 companies currently in production
   - Use the list in `MIGRATION-COMPANY-LIST.md` or the PR description
   - Tip: Sort by Name to find each company quickly
   - Tip: Use Notion's bulk-select (Shift+click) to check multiple rows at once
3. [ ] Verify: 138 rows should have `Published` checked
4. [ ] Leave unpublished any new or draft grades that aren't ready to go live

## Step 4: Set Worker Secrets (3 minutes)

### Option A: Using wrangler CLI

```bash
cd /path/to/inertia-fund-site
wrangler secret put NOTION_TOKEN
# Paste the integration token from Step 1

wrangler secret put REFRESH_KEY
# Enter any random string (e.g. a UUID or password)
```

### Option B: Using Cloudflare Dashboard

1. [ ] Go to [Cloudflare Workers Dashboard](https://dash.cloudflare.com/)
2. [ ] Navigate to **Workers & Pages** → **inertia-fund-site**
3. [ ] Click **Settings** → **Variables and Secrets**
4. [ ] Under **"Environment Variables"**, click **"Add variable"**
5. [ ] Add the following **secrets** (click "Encrypt"):
   - **Name**: `NOTION_TOKEN`, **Value**: (paste the token from Step 1)
   - **Name**: `REFRESH_KEY`, **Value**: (any random string, e.g. `rnd_abc123xyz`)
6. [ ] Click **"Save"** (this will redeploy the Worker)

### Optional: Custom Published Property Name

If you named the checkbox something other than "Published":

```bash
wrangler secret put GRADES_PUBLISHED_PROPERTY
# Enter the exact property name
```

Or in the dashboard, add a **plain-text variable** (not encrypted):
- **Name**: `GRADES_PUBLISHED_PROPERTY`
- **Value**: `YourCustomName`

## Step 5: Deploy and Verify (5 minutes)

1. [ ] Ensure the PR is merged to `main`
2. [ ] Workers Builds deploys automatically within ~1 minute
3. [ ] Wait 5 minutes for any cache to warm up
4. [ ] Visit `https://triage.inertia.fund` (requires Cloudflare Access login)
5. [ ] Open browser DevTools → Console
6. [ ] Look for: `"Loaded 138 grades from Notion API"` (or your expected count)
7. [ ] If you see `"Using fallback static grades"`, check:
   - [ ] `NOTION_TOKEN` is set correctly
   - [ ] The integration is connected to the database
   - [ ] At least one row has `Published` checked
   - [ ] Check browser console for API errors

## Step 6: Test Force Refresh (2 minutes)

1. [ ] In Notion, change a company name or composite score
2. [ ] Tick `Published` on the edited row (if not already checked)
3. [ ] In your browser, visit:
   ```
   https://triage.inertia.fund/desk/api/grades?refresh=<REFRESH_KEY>
   ```
   (Replace `<REFRESH_KEY>` with the value from Step 4)
4. [ ] You should see a JSON response with the updated grades
5. [ ] Reload `https://triage.inertia.fund` and verify the change appears

## Step 7: Monitor (ongoing)

- [ ] Check Cloudflare Workers logs for any Notion API errors
- [ ] KV namespace `inertia-fund-desk` stores the cache and human-intuition reads
- [ ] Cache TTL is 5 minutes, so changes appear within 5 minutes (or instantly with force refresh)
- [ ] If Notion is down, the page falls back to the committed `grades.js` automatically

## Troubleshooting

### "Using fallback static grades" message

- Check that `NOTION_TOKEN` is set and valid
- Verify the integration is connected to "Early Stage Grades"
- Check browser console for error details

### "Failed to fetch from Notion" API error

- Check Notion API status: [status.notion.so](https://status.notion.so)
- Verify the integration token hasn't been revoked
- Check Cloudflare Workers logs for HTTP status codes

### No companies showing up

- Verify at least one row has `Published` checked
- Check that the checkbox property is named exactly `Published` (or matches `GRADES_PUBLISHED_PROPERTY`)
- Try force refresh with `?refresh=<key>`

### Changes in Notion not appearing

- Wait 5 minutes for cache to expire
- Use force refresh: `GET /desk/api/grades?refresh=<REFRESH_KEY>`
- Check that the row has `Published` checked

## Success Criteria

✅ Triage page loads 138 companies (or your expected count)  
✅ Console says `"Loaded N grades from Notion API"`  
✅ No fallback notice appears  
✅ Changes in Notion appear within 5 minutes (or instantly with force refresh)  
✅ Human intuition reads still work (stored in KV, not affected by this change)

---

**Time estimate**: ~30 minutes end-to-end  
**Rollback**: If anything goes wrong, the page automatically falls back to `grades.js`
