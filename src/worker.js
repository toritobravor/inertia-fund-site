// Inertia Fund — site Worker.
// Everything under /desk/ is password-protected and served only to a signed session.
// The password lives in the Cloudflare secret DESK_PASSWORD (never in this repository).
// Human-intuition reads for the early-stage triage are stored in the DESK_KV namespace.

const DESK_PREFIX = "/desk";
const COOKIE = "if_desk";
const SESSION_DAYS = 30;
const MAX_ATTEMPTS = 6;         // per client address
const ATTEMPT_WINDOW_S = 900;   // 15 minutes

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(DESK_PREFIX)) return env.ASSETS.fetch(request);
    if (!env.DESK_PASSWORD) return text("The desk is not configured yet. Set the DESK_PASSWORD secret in Cloudflare.", 503);

    if (url.pathname === `${DESK_PREFIX}/login`) return handleLogin(request, env, url);
    if (url.pathname === `${DESK_PREFIX}/logout`) return logout(url);

    const ok = await hasSession(request, env);
    if (!ok) {
      if (url.pathname.startsWith(`${DESK_PREFIX}/api/`)) return json({ error: "sign in first" }, 401);
      return loginPage(url, "", 401);
    }

    if (url.pathname.startsWith(`${DESK_PREFIX}/api/`)) return handleApi(request, env, url);

    const res = await env.ASSETS.fetch(request);
    const h = new Headers(res.headers);
    h.set("Cache-Control", "private, no-store");
    h.set("X-Robots-Tag", "noindex, nofollow");
    return new Response(res.body, { status: res.status, headers: h });
  },
};

// ---------- sessions
async function key(env) {
  const raw = new TextEncoder().encode(env.DESK_PASSWORD + "|session-key|v1");
  const digest = await crypto.subtle.digest("SHA-256", raw);
  return crypto.subtle.importKey("raw", digest, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function sign(env, msg) {
  const sig = await crypto.subtle.sign("HMAC", await key(env), new TextEncoder().encode(msg));
  return b64url(new Uint8Array(sig));
}
async function makeSession(env) {
  const exp = String(Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400);
  return `${exp}.${await sign(env, exp)}`;
}
async function hasSession(request, env) {
  const c = parseCookie(request.headers.get("Cookie") || "")[COOKIE];
  if (!c) return false;
  const [exp, sig] = c.split(".");
  if (!exp || !sig) return false;
  if (Number(exp) < Date.now() / 1000) return false;
  const expected = await sign(env, exp);
  return timingSafeEqual(expected, sig);
}
function cookieHeader(value, maxAge) {
  return `${COOKIE}=${value}; Path=${DESK_PREFIX}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}

// ---------- login
async function handleLogin(request, env, url) {
  if (request.method !== "POST") return loginPage(url, "");
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const attemptsKey = `attempts:${ip}`;
  const attempts = Number((await env.DESK_KV.get(attemptsKey)) || 0);
  if (attempts >= MAX_ATTEMPTS) return loginPage(url, "Too many attempts. Wait fifteen minutes and try again.", 429);

  const form = await request.formData();
  const pw = String(form.get("password") || "");
  const next = safeNext(String(form.get("next") || `${DESK_PREFIX}/`));
  const good = pw.length > 0 && timingSafeEqual(await sha256hex(pw), await sha256hex(env.DESK_PASSWORD));
  if (!good) {
    await env.DESK_KV.put(attemptsKey, String(attempts + 1), { expirationTtl: ATTEMPT_WINDOW_S });
    return loginPage(url, "That password is not right.", 401);
  }
  await env.DESK_KV.delete(attemptsKey);
  const session = await makeSession(env);
  return new Response(null, {
    status: 303,
    headers: { Location: next, "Set-Cookie": cookieHeader(session, SESSION_DAYS * 86400), "Cache-Control": "no-store" },
  });
}
function logout(url) {
  return new Response(null, { status: 303, headers: { Location: "/", "Set-Cookie": cookieHeader("", 0) } });
}
function safeNext(n) {
  return n.startsWith(DESK_PREFIX) && !n.includes("//") ? n : `${DESK_PREFIX}/`;
}
function loginPage(url, message, status = 200) {
  const next = safeNext(url.pathname === `${DESK_PREFIX}/login` ? (url.searchParams.get("next") || `${DESK_PREFIX}/`) : url.pathname);
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Inertia Fund — Desk</title>
<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/desk/desk.css"></head>
<body class="desk-login">
<main class="login">
  <div class="eyebrow">Inertia Fund · Desk</div>
  <h1>Partners and experts only</h1>
  <p>This part of the site is for Inertia Fund partners and the experts they name. Enter the desk password to continue.</p>
  <form method="post" action="${DESK_PREFIX}/login">
    <input type="hidden" name="next" value="${escapeHtml(next)}">
    <label for="password">Desk password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required autofocus>
    ${message ? `<p class="error">${escapeHtml(message)}</p>` : ""}
    <button type="submit">Enter the desk</button>
  </form>
  <p class="small">Sessions last thirty days on this browser. <a href="/">Back to inertia.fund</a></p>
</main>
</body></html>`;
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Content-Security-Policy": "default-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; script-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      "X-Frame-Options": "DENY",
    },
  });
}

// ---------- reads API (human intuition, shared across the partnership)
async function handleApi(request, env, url) {
  const parts = url.pathname.slice(`${DESK_PREFIX}/api/`.length).split("/").filter(Boolean);
  if (parts[0] !== "reads") return json({ error: "not found" }, 404);
  const id = parts[1];
  if (request.method === "GET" && !id) {
    const out = {};
    let cursor;
    do {
      const page = await env.DESK_KV.list({ prefix: "read:", cursor });
      for (const k of page.keys) {
        const v = await env.DESK_KV.get(k.name, "json");
        if (v) out[k.name.slice(5)] = v;
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
    if (!body.by || String(body.by).trim().length < 2) return json({ error: "a name is required" }, 400);
    if (!body.see || !body.wrong) return json({ error: "both paragraphs are required" }, 400);
    const doc = {
      score: body.score, by: String(body.by).slice(0, 80), see: String(body.see).slice(0, 4000), wrong: String(body.wrong).slice(0, 4000),
      date: String(body.date || new Date().toISOString().slice(0, 10)), savedAt: new Date().toISOString(),
      company: String(body.company || "").slice(0, 120), cardAction: body.cardAction, composite: body.composite, finalAction: body.finalAction,
      history: Array.isArray(body.history) ? body.history.slice(0, 10) : [],
    };
    await env.DESK_KV.put(`read:${id}`, JSON.stringify(doc));
    return json(doc);
  }
  if (request.method === "DELETE") {
    await env.DESK_KV.delete(`read:${id}`);
    return json({ ok: true });
  }
  return json({ error: "method" }, 405);
}

// ---------- helpers
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
function text(s, status = 200) {
  return new Response(s, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
function parseCookie(str) {
  const out = {};
  str.split(";").forEach((p) => { const i = p.indexOf("="); if (i > 0) out[p.slice(0, i).trim()] = p.slice(i + 1).trim(); });
  return out;
}
async function sha256hex(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function b64url(bytes) {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
