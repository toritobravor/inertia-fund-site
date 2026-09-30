# Inertia Fund — website

Source for [inertia.fund](https://inertia.fund). A static site served by Cloudflare Workers (static assets), deployed automatically from this repository by Cloudflare Workers Builds on every push to `main`.

## Layout

```
public/          everything in here is served as-is
  index.html     the site (single page): 'The path of a megawatt'
  styles.css     brand system as CSS (page-specific styles are inline in index.html)
  stage.js       the 3D scene — LP turbine rotor and step-up transformer, camera driven by scroll (Three.js)
  vendor/        three.js (MIT), self-hosted
  fonts/         self-hosted woff2 (SIL OFL)
  favicon.svg    the boxed "In" device
  404.html       not-found page
  robots.txt
  _headers       security and caching headers
  desk/          the partners' desk (password-protected by the Worker; see below)
src/worker.js    the Worker: serves the static site, guards /desk/, stores human-intuition reads in KV
wrangler.jsonc   Cloudflare configuration (assets, KV binding)
```

## Editing

The site is plain HTML, CSS and one ES module — no build step. Edit `public/index.html`, commit, push. Cloudflare rebuilds and deploys within about a minute; preview deployments are created for other branches.

## House style

Follows the Inertia Fund brand system: Baskervville for display, Public Sans for body, IBM Plex Mono for every figure, eyebrow and label. Hairlines, not boxes. Arc (`#CC4318`) on no more than about three percent of any surface. American spelling. The firm is always written "Inertia Fund" in full.

## Local preview

```
npm install
npm run dev
```

## The desk (`/desk/`)

Everything under `/desk/` is for partners and named experts. The Worker (`src/worker.js`) runs first for those paths, shows a login page, and only serves the pages to a browser holding a signed session cookie (thirty days). Search engines are told to stay out (`robots.txt`, `X-Robots-Tag`), and nothing under `/desk/` is cached.

Tools on the desk:

- `/desk/triage/` — **Early-Stage Triage**. Every company the Scout has ticketed, graded under Scorecard v2. The grades are loaded live from the Notion database "Early Stage Grades" (see setup below). The last field on every card, Human intuition, is written by a named partner and saved to the `DESK_KV` KV namespace through `/desk/api/reads`, so the whole partnership sees the same reads.

### Setting up Cloudflare Access and roles (once, in the Cloudflare dashboard)

1. Workers & Pages → the `inertia-fund-site` Worker → Settings → Variables and Secrets:
   - Add plain-text variables: `CF_ACCESS_TEAM_DOMAIN` (e.g. `https://inertiafund.cloudflareaccess.com`) and `CF_ACCESS_AUD` (the Application Audience tag from the Access application).
   - Add a **secret** named `DESK_ROLES`. Its value is a JSON object with one entry per person — the key is their verified email (lowercase), and each entry has a display name and a role:

   ```json
   {"jorge@example.com":{"name":"Jorge Camara","role":"partner"},
    "expert1@example.com":{"name":"Expert Name","role":"expert"}}
   ```

   `partner` reads govern a company's final action (the most recent partner read wins); `expert` reads are advisory and shown beside them. Passwords are never in this repository. Changing any email or role signs everyone out.
2. The KV namespace `inertia-fund-desk` (id `81eb0ef89e134b3889d3b2ae54851882`) is already created and bound in `wrangler.jsonc`.
3. Push to `main`; Workers Builds deploys. Until the secrets are set, `/desk/` answers with a short "not configured" message.

To add, remove or change a person, edit the `DESK_ROLES` secret and deploy; every existing session becomes invalid at once.

### Setting up Notion integration for live grades

The triage desk loads grades live from the Notion database "Early Stage Grades" (database id `43cda90877814ae89d2f5e80072b8730`). To set this up:

1. **Create a Notion internal integration** with read-only access:
   - Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
   - Click "New integration"
   - Name it "Inertia Fund Triage" (or similar)
   - Select the workspace that contains the Early Stage Grades database
   - Set capabilities: **Read content** only (no write, no comment, no user info)
   - Submit and copy the "Internal Integration Token" (starts with `secret_`)

2. **Share the Early Stage Grades database with the integration**:
   - Open the "Early Stage Grades" database in Notion
   - Click the "••• More" menu → "Connections" → "Connect to"
   - Find and select your integration
   - Only this database is shared; the integration cannot see other pages

3. **Add the Published checkbox property to the database**:
   - Open the database in Notion
   - Add a new property named `Published` with type **Checkbox**
   - Tick the checkbox on every row that should appear on the triage site
   - Unpublished rows (checkbox not ticked) will never be served to the page

4. **Add the Notion token to Cloudflare**:
   - Workers & Pages → `inertia-fund-site` → Settings → Variables and Secrets
   - Add a secret named `NOTION_TOKEN` and paste the integration token
   - Optionally add a secret named `REFRESH_KEY` (any random string) to enable force-refresh via `GET /desk/api/grades?refresh=<key>`
   - Optionally add a plain-text variable `GRADES_PUBLISHED_PROPERTY` if you named the checkbox something other than "Published"

5. **Deploy**: Push to `main` and the triage page will start loading grades from Notion within 5 minutes (the cache TTL).

**Fallback behavior**: If Notion is unreachable or the `NOTION_TOKEN` is missing, the page falls back to the committed `public/desk/triage/grades.js` file and shows a small "showing cached ranking" notice. Human-intuition reads from KV keep working regardless.

**Cache refresh**: Grades are cached for 5 minutes. To force an immediate refresh, call `GET /desk/api/grades?refresh=<REFRESH_KEY>` (authenticated partners only).

**Current grades in grades.js**: The static file currently contains 138 company entries. When you first enable the Published checkbox in Notion, tick it on exactly those rows so nothing disappears from the site at cutover. The list of current names is in the pull request description.
