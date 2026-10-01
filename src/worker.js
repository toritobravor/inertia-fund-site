// Inertia Fund — site Worker.
//
// Two hostnames, one Worker:
//   inertia.fund / www.inertia.fund   public site. No desk, no triage, no API.
//   triage.inertia.fund               the partners' triage desk, behind Cloudflare Access.
//
// Identity is NOT handled here. Cloudflare Access authenticates the user against Google
// before the request reaches this Worker, and forwards a signed RS256 JWT in the
// Cf-Access-Jwt-Assertion header. This Worker verifies that token against the team's
// public keys and reads the verified email from it. There is no password, no login form,
// and no session cookie of our own.
//
// Variables and secrets (Cloudflare dashboard → Workers → inertia-fund-site → Settings):
//   CF_ACCESS_TEAM_DOMAIN  plain var, e.g. https://inertiafund.cloudflareaccess.com
//   CF_ACCESS_AUD          plain var, the Application Audience tag of the Access application
//   DESK_ROLES             secret, JSON: { "jorge@example.com": { "name": "Jorge Camara", "role": "partner" }, ... }
//                          role is "partner" (their read governs the card) or "expert" (advisory)
//   NOTION_TOKEN           secret, the Notion integration token for reading Early Stage Grades
//   REFRESH_KEY            secret, the key to force-refresh the Notion grades cache

import { queryGrades, transformNotionPages } from "./notion-grades.js";

const TRIAGE_HOST = "triage.inertia.fund";
const PUBLIC_HOSTS = new Set(["inertia.fund", "www.inertia.fund"]);

// Paths the triage host is allowed to serve from the assets bundle. Everything else is 404,
// so the public marketing pages are not reachable from the private hostname.
const TRIAGE_ASSETS = ["/desk/triage/", "/desk/desk.css", "/styles.css", "/favicon.svg", "/favicon.ico"];

const JWKS_TTL_MS = 3600_000; // Access rotates signing keys every six weeks; an hour is ample.
let jwksCache = { url: "", at: 0, keys: null };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();

    if (host === TRIAGE_HOST) return triage(request, env, url);
    if (PUBLIC_HOSTS.has(host)) return publicSite(request, env, url);

    // Any other hostname reaching this Worker — a workers.dev route, a preview URL, a
    // misconfigured custom domain — is refused outright. Those hostnames are not covered by
    // the Access policy, so serving anything on them would be a way around the front door.
    return text("Not served on this hostname.", 403);
  },
};

// ---------- public site

async function publicSite(request, env, url) {
  // The desk used to live at inertia.fund/desk/. It has moved to its own protected hostname,
  // which is where the Access policy applies. Refuse the old paths here rather than serving
  // them, otherwise the move would leave a door open behind the new lock.
  if (url.pathname === "/desk" || url.pathname.startsWith("/desk/")) {
    return text("The desk has moved to https://triage.inertia.fund", 404);
  }
  const res = await env.ASSETS.fetch(request);
  const h = new Headers(res.headers);
  h.set("X-Content-Type-Options", "nosniff");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return new Response(res.body, { status: res.status, headers: h });
}

// ---------- triage host

async function triage(request, env, url) {
  if (!env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD) {
    return text("Access is not configured. Set CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD.", 503);
  }

  if (url.pathname === "/robots.txt") {
    return new Response("User-agent: *\nDisallow: /\n", {
      headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  const diag = {};
  const claims = await verifyAccessJwt(request, env, diag);
  if (!claims) {
    // Reaching this means the request did not come through Access, or the token is bad.
    // diag.why names the specific check that failed. None of it is secret: the team domain
    // and AUD tag identify the application, they do not authorize anything.
    return json({ error: "not authenticated through Cloudflare Access", why: diag.why || "no reason recorded" }, 403);
  }

  const email = String(claims.email || "").toLowerCase();
  if (!email) return json({ error: "service tokens are not accepted on this application" }, 403);

  const roles = loadRoles(env);
  if (!roles) return text("The desk is not configured yet. Set the DESK_ROLES secret.", 503);
  const rec = roles[email];
  if (!rec) {
    // Access let them in but the partnership has not given them a role. Two allowlists,
    // deliberately: one at the edge, one here.
    return json({ error: `${email} is authenticated but has no role on this desk` }, 403);
  }
  const who = { user: email, name: rec.name, role: rec.role };

  if (url.pathname.startsWith("/desk/api/")) return handleApi(request, env, url, who);

  // The triage page is built with absolute asset paths under /desk/triage/, so the root of
  // this hostname maps onto that directory and every other reference resolves unchanged.
  let assetPath = url.pathname;
  if (assetPath === "/" || assetPath === "/index.html") assetPath = "/desk/triage/index.html";
  if (!TRIAGE_ASSETS.some((p) => (p.endsWith("/") ? assetPath.startsWith(p) : assetPath === p))) {
    return text("Not found.", 404);
  }

  const res = await env.ASSETS.fetch(new Request(new URL(assetPath, url.origin), request));
  const h = new Headers(res.headers);
  h.set("Cache-Control", "private, no-store");
  h.set("X-Robots-Tag", "noindex, nofollow");
  h.set("X-Content-Type-Options", "nosniff");
  h.set("X-Frame-Options", "DENY");
  h.set("Referrer-Policy", "no-referrer");
  if ((h.get("Content-Type") || "").includes("text/html")) {
    h.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    );
  }
  return new Response(res.body, { status: res.status, headers: h });
}

// ---------- Cloudflare Access JWT
// Verified with WebCrypto directly rather than a library, so the Worker has no npm
// dependency and the repository can be edited through the GitHub web interface.

async function verifyAccessJwt(request, env, diag = {}) {
  const fail = (why) => { diag.why = why; return null; };

  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return fail("no Cf-Access-Jwt-Assertion header: the request did not come through Cloudflare Access");
  const parts = token.split(".");
  if (parts.length !== 3) return fail("token is not a three-part JWT");

  let header, payload;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1])));
  } catch {
    return fail("token header or payload is not valid JSON");
  }
  if (header.alg !== "RS256" || !header.kid) return fail(`unexpected token algorithm ${header.alg}`);

  const teamDomain = String(env.CF_ACCESS_TEAM_DOMAIN).replace(/\/+$/, "");
  const keys = await accessKeys(teamDomain);
  if (!keys) return fail(`could not fetch signing keys from ${teamDomain}/cdn-cgi/access/certs — check CF_ACCESS_TEAM_DOMAIN`);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) return fail("token was signed by a key this team domain does not publish — CF_ACCESS_TEAM_DOMAIN is probably the wrong team");

  let key;
  try {
    key = await crypto.subtle.importKey(
      "jwk",
      { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
  } catch {
    return fail("could not import the signing key");
  }

  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    b64urlDecode(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!ok) return fail("signature did not verify");

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp <= now) return fail("token has expired — sign in again");
  if (typeof payload.nbf === "number" && payload.nbf > now + 60) return fail("token is not valid yet");
  if (payload.iss !== teamDomain) {
    return fail(`issuer mismatch: token says "${payload.iss}", CF_ACCESS_TEAM_DOMAIN is "${teamDomain}" — make them identical, including https://`);
  }
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(env.CF_ACCESS_AUD)) {
    return fail(`audience mismatch: token is for "${aud.join(", ")}", CF_ACCESS_AUD is "${env.CF_ACCESS_AUD}" — re-copy the AUD tag from the live application`);
  }

  return payload;
}

async function accessKeys(teamDomain) {
  const url = `${teamDomain}/cdn-cgi/access/certs`;
  if (jwksCache.keys && jwksCache.url === url && Date.now() - jwksCache.at < JWKS_TTL_MS) {
    return jwksCache.keys;
  }
  try {
    const res = await fetch(url, { cf: { cacheTtl: 3600, cacheEverything: true } });
    if (!res.ok) return jwksCache.keys; // keep serving on a transient failure
    const body = await res.json();
    if (!Array.isArray(body.keys)) return jwksCache.keys;
    jwksCache = { url, at: Date.now(), keys: body.keys };
    return body.keys;
  } catch {
    return jwksCache.keys;
  }
}

// ---------- roles

function loadRoles(env) {
  if (!env.DESK_ROLES) return null;
  try {
    const parsed = JSON.parse(env.DESK_ROLES);
    const out = {};
    for (const [emailRaw, v] of Object.entries(parsed)) {
      const email = String(emailRaw).trim().toLowerCase();
      if (!email || !v) continue;
      out[email] = { name: v.name || email, role: v.role === "expert" ? "expert" : "partner" };
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

// ---------- reads API (human intuition, shared across the partnership)
// Keys are read:<companyId>:<email>. Reads written under the old password logins remain
// readable under their old usernames; nothing is deleted or rewritten.

async function handleApi(request, env, url, who) {
  const parts = url.pathname.slice("/desk/api/".length).split("/").filter(Boolean);
  if (parts[0] === "me") return json(who);
  
  // /desk/api/grades — Notion Early Stage Grades, cached for 5 minutes
  if (parts[0] === "grades") {
    return handleGrades(request, env, url);
  }
  
  if (parts[0] !== "reads") return json({ error: "not found" }, 404);
  const id = parts[1];

  if (request.method === "GET" && !id) {
    const out = {};
    let cursor;
    do {
      const page = await env.DESK_KV.list({ prefix: "read:", cursor });
      for (const k of page.keys) {
        const v = await env.DESK_KV.get(k.name, "json");
        if (!v) continue;
        const idx = k.name.indexOf(":", 5);
        if (idx < 0) continue;
        const cid = k.name.slice(5, idx);
        const user = k.name.slice(idx + 1);
        if (!user) continue; // ignore legacy single-user keys
        (out[cid] = out[cid] || {})[user] = v;
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    return json(out);
  }

  if (!id || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return json({ error: "bad id" }, 400);

  if (request.method === "PUT") {
    let body;
    try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
    if (typeof body !== "object" || body === null) return json({ error: "bad body" }, 400);
    if (![-2, -1, 0, 1, 2].includes(body.score)) return json({ error: "score must be -2 to +2" }, 400);
    if (!body.see || !body.wrong) return json({ error: "both paragraphs are required" }, 400);
    // Identity comes from the verified Access token, never from the body. A reader cannot
    // file a read as someone else, and cannot overwrite or withdraw anyone else's.
    const doc = {
      score: body.score, by: who.name, user: who.user, role: who.role,
      see: String(body.see).slice(0, 4000), wrong: String(body.wrong).slice(0, 4000),
      date: String(body.date || new Date().toISOString().slice(0, 10)), savedAt: new Date().toISOString(),
      companyId: id, company: String(body.company || "").slice(0, 120),
      cardAction: body.cardAction, composite: body.composite, impliedAction: body.impliedAction,
      history: Array.isArray(body.history) ? body.history.slice(0, 10) : [],
    };
    await env.DESK_KV.put(`read:${id}:${who.user}`, JSON.stringify(doc));
    return json(doc);
  }

  if (request.method === "DELETE") {
    await env.DESK_KV.delete(`read:${id}:${who.user}`);
    return json({ ok: true });
  }
  return json({ error: "method" }, 405);
}

// ---------- grades API (Notion Early Stage Grades database)
// Serves the grades live from Notion, with a 5-minute cache.
// If Notion is unreachable or the token is missing, the triage page should fall back to the
// committed grades.js file. This endpoint only returns rows where Published = true.

const GRADES_CACHE_KEY = "notion:grades";
const GRADES_CACHE_TTL_SEC = 300; // 5 minutes

async function handleGrades(request, env, url) {
  // Query param ?refresh=<key> forces a cache refresh if the key matches REFRESH_KEY
  const forceRefresh = url.searchParams.get("refresh") === env.REFRESH_KEY && env.REFRESH_KEY;

  if (!env.NOTION_TOKEN) {
    console.error("NOTION_TOKEN not configured");
    return json({ error: "NOTION_TOKEN not configured", fallback: true }, 503);
  }

  let grades = null;
  let fromCache = false;

  // Try KV cache first unless force refresh
  // NOTE: Cache stores Notion-sourced data only; we merge static profile data on every serve
  if (!forceRefresh && env.DESK_KV) {
    try {
      const cached = await env.DESK_KV.get(GRADES_CACHE_KEY, "json");
      if (cached && cached.at && Date.now() - cached.at < GRADES_CACHE_TTL_SEC * 1000) {
        grades = cached.data;
        fromCache = true;
        console.log(`Serving ${grades.length} grades from cache (age: ${Math.floor((Date.now() - cached.at) / 1000)}s)`);
      }
    } catch (err) {
      console.error("Failed to read cache:", err.message);
      // Continue to fetch from Notion
    }
  }

  // Fetch from Notion if not cached
  if (!grades) {
    try {
      console.log("Fetching grades from Notion...");
      const pages = await queryGrades(env.NOTION_TOKEN, env.GRADES_PUBLISHED_PROPERTY || "Published");
      grades = transformNotionPages(pages);
      console.log(`Fetched ${grades.length} grades from Notion (${pages.length} pages queried)`);

      // Cache in KV (before merge, to keep cache size small)
      if (env.DESK_KV) {
        try {
          await env.DESK_KV.put(GRADES_CACHE_KEY, JSON.stringify({ data: grades, at: Date.now() }), {
            expirationTtl: GRADES_CACHE_TTL_SEC * 2
          });
          console.log("Cached grades in KV");
        } catch (err) {
          console.error("Failed to cache grades:", err.message);
          // Continue serving the response
        }
      }
    } catch (err) {
      console.error("Failed to fetch from Notion:", err.message, err.stack);
      return json({ 
        error: "Failed to fetch from Notion", 
        message: err.message, 
        fallback: true 
      }, 502);
    }
  }

  // Always merge profile data from static grades.js (whether from cache or fresh from Notion)
  grades = await mergeStaticProfileData(env, grades);

  const res = json({ 
    grades, 
    count: grades.length,
    cached: fromCache,
    cached_at: Date.now() 
  });
  res.headers.set("Cache-Control", `private, max-age=${GRADES_CACHE_TTL_SEC}`);
  return res;
}

// Merge profile data from static grades.js into Notion-sourced grades.
// Notion has scores/actions/grades, but lacks People, Financing, Viability, and full links.
async function mergeStaticProfileData(env, notionGrades) {
  try {
    // Fetch the static grades.js file from the ASSETS bundle
    const gradesUrl = new URL("/desk/triage/grades.js", "https://placeholder.local");
    const res = await env.ASSETS.fetch(new Request(gradesUrl));
    if (!res.ok) {
      console.warn("Could not fetch static grades.js for profile merge");
      return notionGrades;
    }
    
    const gradesText = await res.text();
    // Extract the __GRADES__ array. The file contains: window.__GRADES__=[{...},...]
    const match = /window\.__GRADES__\s*=\s*(\[[\s\S]*\]);?\s*$/.exec(gradesText);
    if (!match) {
      console.warn("Could not parse static grades.js");
      return notionGrades;
    }
    
    const staticGrades = JSON.parse(match[1]);
    const staticById = Object.fromEntries(staticGrades.map(g => [g.id, g]));
    
    // Merge profile fields into Notion grades by id
    const merged = notionGrades.map(card => {
      const staticCard = staticById[card.id];
      if (!staticCard) return card;
      
      return {
        ...card,
        // Merge profile fields that Notion doesn't have
        people: card.people || staticCard.people || "",
        financing: card.financing || staticCard.financing || "",
        viability: card.viability || staticCard.viability || "",
        // Merge the full links object, keeping Notion's website/linkedin_company if present
        links: {
          website: card.links?.website || staticCard.links?.website || null,
          linkedin_company: card.links?.linkedin_company || staticCard.links?.linkedin_company || null,
          linkedin_people: staticCard.links?.linkedin_people || [],
          x: staticCard.links?.x || [],
          other: staticCard.links?.other || [],
          note: staticCard.links?.note || "",
          checked: card.links?.checked || staticCard.links?.checked || "",
        }
      };
    });
    
    console.log(`Merged profile data from static grades for ${merged.length} cards`);
    return merged;
  } catch (err) {
    console.error("Failed to merge static profile data:", err.message);
    return notionGrades;
  }
}

// ---------- helpers

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}
function text(s, status = 200) {
  return new Response(s, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
function b64urlDecode(s) {
  const b = atob(String(s).replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}
