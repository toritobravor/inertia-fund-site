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
wrangler.jsonc   Cloudflare configuration
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
