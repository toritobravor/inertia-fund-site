// Notion integration for Early Stage Grades database.
// Maps Notion database properties to the card shape expected by the triage UI.

const DATABASE_ID = "43cda90877814ae89d2f5e80072b8730";
const NOTION_VERSION = "2022-06-28";
const PUBLISHED_PROPERTY = "Published"; // config: the checkbox property name

// Query all pages from the Notion database, handling pagination.
// Only returns pages where the Published checkbox is true.
export async function queryGrades(notionToken, publishedProp = PUBLISHED_PROPERTY) {
  if (!notionToken) throw new Error("NOTION_TOKEN is not set");

  const allPages = [];
  let hasMore = true;
  let startCursor = undefined;

  while (hasMore) {
    const url = `https://api.notion.com/v1/databases/${DATABASE_ID}/query`;
    const body = {
      filter: {
        property: publishedProp,
        checkbox: { equals: true }
      },
      page_size: 100
    };
    if (startCursor) body.start_cursor = startCursor;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${notionToken}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Notion API error ${response.status}: ${text}`);
    }

    const data = await response.json();
    allPages.push(...data.results);
    hasMore = data.has_more;
    startCursor = data.next_cursor;
  }

  return allPages;
}

// Extract property value from a Notion page object.
function prop(page, name) {
  const p = page.properties[name];
  if (!p) return null;

  switch (p.type) {
    case "title":
      return p.title.map(t => t.plain_text).join("");
    case "rich_text":
      return p.rich_text.map(t => t.plain_text).join("");
    case "number":
      return p.number;
    case "select":
      return p.select ? p.select.name : null;
    case "multi_select":
      return p.multi_select.map(s => s.name);
    case "checkbox":
      return p.checkbox;
    case "url":
      return p.url;
    case "date":
      return p.date ? p.date.start : null;
    case "formula":
      if (p.formula.type === "number") return p.formula.number;
      if (p.formula.type === "string") return p.formula.string;
      if (p.formula.type === "boolean") return p.formula.boolean;
      return null;
    case "people":
      return p.people.map(person => person.name || person.id);
    default:
      return null;
  }
}

// Map a Notion page to the card shape expected by the triage UI.
// Property names follow the Early Stage Grades schema (collection d366d623-7abb-4f1c-86a6-f43c52c2a2db).
// Grades has no People, Financing, Viability, Website or per-axis evidence columns: those card fields are
// left empty, except per-axis evidence, which is split out of the single Evidence text when it is labelled.

const AXES = [
  ["P", "Physics retired", 22],
  ["D", "Path to first unit", 20],
  ["B", "Buyer & license", 18],
  ["T", "Team that has built", 15],
  ["R", "Rate of progress", 15],
  ["K", "Capital position", 10],
];
const EVIDENCE_LABELS = {
  P: /physics retired/i, D: /path to first unit/i, B: /buyer (?:and|&) licen[cs]e/i,
  T: /team that has built/i, R: /rate of progress/i, K: /capital position/i,
};
const ACTIONS = new Set(["STOP", "WATCH", "DIVE", "SITE"]);

const isTrue = (v, words) => v === true || (typeof v === "string" && words.test(v.trim()));
const passes = (v) => isTrue(v, /^(yes|pass|passed|true)$/i);
const graveyardHit = (v) => isTrue(v, /^(yes|hit|true)$/i);

// The card id must equal the id the static cards and the stored human reads use. In order:
//   1. a "#card=<id>" fragment on the Ticket URL (used when the ticket link is an external source page);
//   2. the 32-hex page id of a Notion Ticket URL (the Scout ticket page);
//   3. the Grades page id.
function cardId(page, ticketURL) {
  const u = String(ticketURL || "");
  const f = /[#&]card=([A-Za-z0-9_-]{1,64})/.exec(u);
  if (f) return f[1];
  const m = /([0-9a-f]{32})(?:[?#].*)?$/i.exec(u.replace(/-/g, ""));
  if (m && /notion\.(so|com)/i.test(u)) return m[1].toLowerCase();
  return page.id.replace(/-/g, "");
}
// The source link shown on the card: the Ticket URL without the card-id fragment.
const sourceLink = (u) => String(u || "").replace(/[#&]card=[A-Za-z0-9_-]{1,64}$/, "").replace(/#$/, "");

// Composite: the 'Composite v2' formula when it has a value; else a number at the start of the Evidence
// text ("Composite 64.4: ..." or "64.4 ..."); else 20 x weighted mean of the six axes = sum(w*s)/5.
// Returns null when neither exists and an axis is missing, rather than inventing a low score.
export function compositeFor(formulaValue, evidenceText, scores) {
  if (typeof formulaValue === "number" && Number.isFinite(formulaValue)) return round1(formulaValue);
  if (typeof formulaValue === "string" && formulaValue.trim() !== "" && Number.isFinite(+formulaValue)) return round1(+formulaValue);
  const m = /^\s*(?:composite(?:\s*v2)?\s*[:=]?\s*)?(\d{1,3}(?:\.\d+)?)(?=\s|:|\/|$)/i.exec(evidenceText || "");
  if (m && +m[1] <= 100 && /^\s*composite/i.test(evidenceText)) return round1(+m[1]);
  if (!scores || AXES.some(([k]) => typeof scores[k] !== "number")) return null;
  return round1(AXES.reduce((sum, [k, , w]) => sum + w * scores[k], 0) / 5);
}
const round1 = (n) => Math.round(n * 10) / 10;

function splitEvidence(text) {
  const out = { P: "", D: "", B: "", T: "", R: "", K: "" };
  if (!text) return out;
  const hits = [];
  for (const [k, re] of Object.entries(EVIDENCE_LABELS)) {
    const m = new RegExp(re.source + "\\s*\\d?\\s*:?", "i").exec(text);
    if (m) hits.push({ k, at: m.index, body: m.index + m[0].length });
  }
  hits.sort((a, b) => a.at - b.at);
  hits.forEach((h, i) => { out[h.k] = text.slice(h.body, i + 1 < hits.length ? hits[i + 1].at : undefined).trim().replace(/[.;]\s*$/, "."); });
  return out;
}

export function mapNotionPageToCard(page) {
  const name = prop(page, "Name");
  if (!name) return null;

  const ticketURL = prop(page, "Ticket URL") || "";
  const stage = prop(page, "Stage") || "";
  const evidenceText = prop(page, "Evidence") || "";

  const raw = Object.fromEntries(AXES.map(([k, label]) => [k, prop(page, label)]));
  const haveAny = Object.values(raw).some((v) => typeof v === "number");
  const scores = haveAny ? raw : null;
  const fours = scores ? Object.values(scores).filter((v) => v >= 4).length : 0;
  const floor = scores ? (typeof scores.P === "number" && scores.P < 2) || (typeof scores.D === "number" && scores.D < 2) : false;

  // Filter pass and Graveyard are selects (YES/NO) in Grades; accept checkboxes and "Hit"/"Pass" too.
  const filterPass = passes(prop(page, "Filter pass"));
  const grave = graveyardHit(prop(page, "Graveyard"));

  // Same precedence as the static cards: graveyard, then a failed filter, then no scores at all.
  let status = "scored";
  if (grave) status = "graveyard";
  else if (!filterPass) status = "filter";
  else if (!scores) status = "unscored";

  const cardAction = prop(page, "Card action");
  const action = ACTIONS.has(cardAction) ? cardAction : "STOP";
  const gradeDate = prop(page, "Grade date") || "";

  return {
    id: cardId(page, ticketURL),
    grades_page_id: page.id.replace(/-/g, ""),
    name,
    country: prop(page, "Country") || "",
    sector: prop(page, "Sector") || "",
    stage,
    stage_used: stage,
    pursue: prop(page, "What they sell") || "",
    people: prop(page, "People") || "",
    financing: prop(page, "Financing") || "",
    viability: prop(page, "Viability note") || "",
    source: sourceLink(ticketURL),
    status,
    gate: filterPass ? [true, true, true, true] : [false, true, true, true],
    gate_note: prop(page, "Gate note") || "",
    grave,
    grave_note: prop(page, "Graveyard note") || "",
    crowding: prop(page, "Crowding") || "",
    origin: prop(page, "Origin review") || "",
    scores,
    evidence: splitEvidence(evidenceText),
    evidence_text: evidenceText,
    composite: compositeFor(prop(page, "Composite v2"), evidenceText, scores),
    fours,
    floor,
    action,
    final_action: prop(page, "Final action") || "",
    reason: prop(page, "Reason code") || "",
    analysis: prop(page, "Analysis") || evidenceText,
    wmbt: prop(page, "What must be true") || "",
    scorer: prop(page, "Scorer") || "",
    scorecard: prop(page, "Scorecard version") || "",
    links: {
      website: prop(page, "Website") || null,
      linkedin_company: prop(page, "LinkedIn company") || null,
      linkedin_people: [],
      x: [],
      other: [],
      note: "",
      checked: gradeDate,
    },
    graded: gradeDate,
  };
}

// Transform all Notion pages to cards.
export function transformNotionPages(pages) {
  return pages.map(mapNotionPageToCard).filter(card => card !== null);
}
