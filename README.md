# Inertia Fund — website

Source for [inertia.fund](https://inertia.fund). A static site served by Cloudflare Workers (static assets), deployed automatically from this repository by Cloudflare Workers Builds on every push to `main`.

## Layout

```
public/          everything in here is served as-is
  index.html     the site (single page)
  styles.css     brand system as CSS
  figure.js      the scroll-morphing wireframe (rotor → turbine → lattice), plain Canvas 2D
  fonts/         self-hosted woff2 (SIL OFL)
  favicon.svg    the boxed "In" device
  404.html       not-found page
  robots.txt
  _headers       security and caching headers
  desk/          the partners' desk (password-protected by the Worker; see below)
src/worker.js    the Worker: serves the static site, guards /desk/, stores human-intuition reads in KV
wrangler.jsonc   Cloudflare configuration (assets, KV binding)
tools/charts.py  generates the 'State of power' SVG panels; paste output between the chart markers in index.html
```

## Editing

The site is plain HTML and CSS — no build step. Edit `public/index.html`, commit, push. Cloudflare rebuilds and deploys within about a minute; preview deployments are created for other branches.

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

- `/desk/triage/` — **Early-Stage Triage**. Every company the Scout has ticketed, graded under Scorecard v2 (the grades are in `grades.js`; the page logic in `app.js`). The last field on every card, Human intuition, is written by a named partner and saved to the `DESK_KV` KV namespace through `/desk/api/reads`, so the whole partnership sees the same reads.

### Setting it up (once, in the Cloudflare dashboard)

1. Workers & Pages → the `inertia-fund-site` Worker → Settings → Variables and Secrets → add a **secret** named `DESK_USERS`. Its value is a JSON object with one entry per person — the key is the name they type at login (lowercase, no spaces), and each entry has a password, a display name, and a role:

   ```json
   {"jorge":{"password":"a-long-passphrase","name":"Jorge Camara","role":"partner"},
    "expert1":{"password":"another-passphrase","name":"Expert Name","role":"expert"}}
   ```

   `partner` reads govern a company's final action (the most recent partner read wins); `expert` reads are advisory and shown beside them. Every read is stored under the login that made it, so nobody can record under another name. Passwords are never in this repository. Changing any password signs everyone out. (`DESK_PASSWORD` alone still works as a single shared login named "Desk", for a quick start.)
2. The KV namespace `inertia-fund-desk` (id `81eb0ef89e134b3889d3b2ae54851882`) is already created and bound in `wrangler.jsonc`.
3. Push to `main`; Workers Builds deploys. Until the secret is set, `/desk/` answers with a short "not configured" message.

To add, remove or rotate a person, edit the `DESK_USERS` secret and deploy; every existing session becomes invalid at once.

To refresh the grades, regenerate `public/desk/triage/grades.js` from the Early Stage Grades book and commit it. Human-intuition reads live in KV, not in the repository, so a regrade does not erase them.
