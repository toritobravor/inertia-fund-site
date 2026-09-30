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
export function mapNotionPageToCard(page) {
  // Required fields
  const name = prop(page, "Name");
  if (!name) return null; // skip rows with no name

  const sector = prop(page, "Sector") || "";
  const stage = prop(page, "Stage") || "";
  const composite = prop(page, "Composite v2");
  const action = prop(page, "Card action") || "STOP";

  // Gate fields (4 boolean questions)
  const filterPass = prop(page, "Filter pass");
  const gate = filterPass ? [true, true, true, true] : [false, false, false, false];

  // Graveyard
  const graveyard = prop(page, "Graveyard");
  const grave = graveyard ? (graveyard === "Hit" || graveyard === "hit") : false;

  // Six axis scores
  const scores = {
    P: prop(page, "Physics retired") || 0,
    D: prop(page, "Path to first unit") || 0,
    B: prop(page, "Buyer & license") || 0,
    T: prop(page, "Team that has built") || 0,
    R: prop(page, "Rate of progress") || 0,
    K: prop(page, "Capital position") || 0
  };

  // Count how many axes are at 4 or higher
  const fours = Object.values(scores).filter(v => v >= 4).length;

  // Hard floor: Physics or Path below 2
  const floor = scores.P < 2 || scores.D < 2;

  // Evidence fields (text for each axis)
  // Try multiple possible property names for evidence fields
  const evidence = {
    P: prop(page, "Physics retired evidence") || prop(page, "P evidence") || prop(page, "Physics evidence") || "",
    D: prop(page, "Path evidence") || prop(page, "D evidence") || prop(page, "Path to first unit evidence") || "",
    B: prop(page, "Buyer evidence") || prop(page, "B evidence") || prop(page, "Buyer & license evidence") || "",
    T: prop(page, "Team evidence") || prop(page, "T evidence") || prop(page, "Team that has built evidence") || "",
    R: prop(page, "Rate evidence") || prop(page, "R evidence") || prop(page, "Rate of progress evidence") || "",
    K: prop(page, "Capital evidence") || prop(page, "K evidence") || prop(page, "Capital position evidence") || ""
  };

  // Determine status
  let status = "scored";
  if (!filterPass) status = "unscored";
  else if (grave) status = "graveyard";

  // Reason code
  const reasonCode = prop(page, "Reason code") || "";

  // Other fields
  const crowding = prop(page, "Crowding") || "";
  const originReview = prop(page, "Origin review") || "";
  const finalAction = prop(page, "Final action") || action;

  // Text fields
  const humanIntuition = prop(page, "Human intuition") || "";
  const evidenceText = prop(page, "Evidence") || "";
  const wmbt = prop(page, "What must be true") || "";
  const scorer = prop(page, "Scorer") || "";
  const outcomeNote = prop(page, "Outcome note") || "";

  // Dates
  const gradeDate = prop(page, "Grade date") || new Date().toISOString().slice(0, 10);

  // URL
  const ticketURL = prop(page, "Ticket URL") || "";

  // Build the card object matching the expected shape
  return {
    id: page.id.replace(/-/g, ""),
    name,
    country: prop(page, "Country") || "Unknown",
    sector,
    stage,
    stage_used: stage,
    pursue: prop(page, "What they sell") || "",
    people: prop(page, "People") || "",
    financing: prop(page, "Financing") || "",
    viability: prop(page, "Viability note") || "",
    source: ticketURL,
    status,
    gate,
    gate_note: prop(page, "Gate note") || "",
    grave,
    grave_note: prop(page, "Graveyard note") || "",
    crowding,
    origin: originReview,
    scores,
    evidence,
    composite,
    fours,
    floor,
    action,
    reason: reasonCode,
    analysis: prop(page, "Analysis") || "",
    wmbt,
    links: {
      website: prop(page, "Website") || null,
      linkedin_company: prop(page, "LinkedIn company") || null,
      linkedin_people: [],
      x: [],
      other: [],
      note: "",
      checked: gradeDate
    },
    graded: gradeDate
  };
}

// Transform all Notion pages to cards.
export function transformNotionPages(pages) {
  return pages.map(mapNotionPageToCard).filter(card => card !== null);
}
