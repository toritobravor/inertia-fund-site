// Notion integration for Accelerated Inertia — Pipeline database.
// Maps Notion database properties to the shape expected by the Accelerated Inertia UI.

// Database page ID from https://app.notion.com/p/0498728f95b14930a4a7dfc7925d7d11
// With Notion-Version 2022-06-28, use /v1/databases/{database_id}/query with the database page ID
const DATABASE_ID = "0498728f-95b1-4930-a4a7-dfc7925d7d11";
const NOTION_VERSION = "2022-06-28";

export async function queryAcceleratedPipeline(notionToken) {
  if (!notionToken) throw new Error("NOTION_TOKEN is not set");

  const allPages = [];
  let hasMore = true;
  let startCursor = undefined;

  while (hasMore) {
    const url = `https://api.notion.com/v1/databases/${DATABASE_ID}/query`;
    const body = {
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

// Compute composite as fallback if formula is null
// Composite = 20 × (0.20 D + 0.16 U + 0.13 M + 0.13 F + 0.12 I + 0.09 R + 0.09 T + 0.08 P)
function computeComposite(scores) {
  if (!scores) return null;
  const weights = {
    D: 0.20,
    U: 0.16,
    M: 0.13,
    F: 0.13,
    I: 0.12,
    R: 0.09,
    T: 0.09,
    P: 0.08
  };
  
  const axes = ['D', 'U', 'M', 'F', 'I', 'R', 'T', 'P'];
  if (axes.some(k => typeof scores[k] !== 'number')) return null;
  
  const sum = axes.reduce((acc, k) => acc + weights[k] * scores[k], 0);
  return Math.round(sum * 20 * 10) / 10;
}

export function mapAcceleratedPageToCard(page) {
  const company = prop(page, "Company");
  if (!company) return null;

  // v1.3 screen scores (O1–O9)
  const screenScores = {
    O1: prop(page, "O1 Sold, quality-weighted"),
    O2: prop(page, "O2 Repeat-order footprint"),
    O3: prop(page, "O3 Footprint diversity"),
    O4: prop(page, "O4 Validation of unit economics"),
    O5: prop(page, "O5 Capital efficiency"),
    O6: prop(page, "O6 Manufacturing repeatability"),
    O7: prop(page, "O7 Team"),
    O8: prop(page, "O8 Regime portability"),
    O9: prop(page, "O9 Hiring momentum")
  };
  
  const haveScreenScores = Object.values(screenScores).some(v => typeof v === 'number');
  const finalScreenScores = haveScreenScores ? screenScores : null;
  
  const screenComposite = prop(page, "Screen composite");
  const screenVerified = prop(page, "Screen verified (n/9)");

  // v1.2 deep dive scores (D–P, legacy)
  const scores = {
    D: prop(page, "D Sold again"),
    U: prop(page, "U Unit economics"),
    M: prop(page, "M Made again"),
    F: prop(page, "F Financed again"),
    I: prop(page, "I Improves again"),
    R: prop(page, "R Regime portability"),
    T: prop(page, "T Team"),
    P: prop(page, "P Price")
  };

  const haveScores = Object.values(scores).some(v => typeof v === 'number');
  const finalScores = haveScores ? scores : null;

  const compositeFormula = prop(page, "Composite");
  const composite = compositeFormula != null ? compositeFormula : computeComposite(finalScores);

  const stressedComposite = prop(page, "Stressed composite");
  const stressResult = prop(page, "Stress result (>=55)");
  
  const floorDive = prop(page, "Floor check DIVE (D,U>=2)");
  const floorIc = prop(page, "Floor check IC1/IC2 (D,U,P>=3)");

  return {
    id: page.id.replace(/-/g, ""),
    company,
    rank: prop(page, "Rank"),
    screenScores: finalScreenScores,
    screenComposite,
    screenVerified,
    scores: finalScores,
    composite,
    verifiedAxes: prop(page, "Verified axes"),
    list: prop(page, "List"),
    stopReason: prop(page, "Stop reason"),
    stage: prop(page, "Stage"),
    action: prop(page, "Action"),
    gates: prop(page, "Gates A1-A9"),
    floorDive,
    floorIc,
    stressedComposite,
    worstShock: prop(page, "Worst shock"),
    stressSpread: prop(page, "Stress spread"),
    stressResult,
    regimeDependent: prop(page, "Regime-dependent"),
    dealFitL: prop(page, "Deal Fit L (leverage)"),
    dealFitLStatus: prop(page, "Deal Fit L status"),
    dealFitP: prop(page, "Deal Fit P (price)"),
    dealFitPortfolio: prop(page, "Deal Fit Portfolio fit"),
    flagDiscretionary: prop(page, "Flag: discretionary subsidy share"),
    flagCompliance: prop(page, "Flag: compliance-mandated share"),
    flagRunway: prop(page, "Flag: runway"),
    flagCompetition: prop(page, "Flag: competition"),
    flagAlignment: prop(page, "Flag: alignment"),
    whyThisOne: prop(page, "Why this one"),
    thesis: prop(page, "Thesis"),
    methodologyVersion: prop(page, "Methodology version"),
    scoreStatus: prop(page, "Score status"),
    gradedBy: prop(page, "Graded by"),
    gradeDate: prop(page, "Grade date"),
    dataConfidence: prop(page, "Data confidence"),
    rationaleAndSources: prop(page, "Rationale and sources"),
    unknowns: prop(page, "Unknowns"),
    watchTrigger: prop(page, "Watch trigger"),
    scoutSummary: prop(page, "Scout summary"),
    foundBy: prop(page, "Found by"),
    dateFound: prop(page, "Date found"),
    scoutSource: prop(page, "Scout source"),
    companyDescription: prop(page, "Company description"),
    whatTheySell: prop(page, "What they sell"),
    proofSoldAgain: prop(page, "Proof: sold again"),
    proofMadeAgain: prop(page, "Proof: made again"),
    proofFinancedAgain: prop(page, "Proof: financed again"),
    thesisVerdict: prop(page, "Thesis verdict"),
    partnerQuestions: prop(page, "Partner questions"),
    website: prop(page, "Website"),
    linkedinCompany: prop(page, "LinkedIn company"),
    keyPeople: prop(page, "Key people"),
    publicLinksChecked: prop(page, "Public links checked"),
    capitalRaisedTotal: prop(page, "Capital raised total"),
    fundingRounds: prop(page, "Funding rounds"),
    investors: prop(page, "Investors"),
    founded: prop(page, "Founded"),
    hq: prop(page, "HQ"),
    employees: prop(page, "Employees"),
    businessCase: prop(page, "Business case"),
    customersProof: prop(page, "Customers & proof"),
    otherLinks: prop(page, "Other links"),
    lastRaise: prop(page, "Last raise"),
    country: prop(page, "Country"),
    bottleneck: prop(page, "Bottleneck"),
    aiDependence: prop(page, "AI dependence"),
    originRisk: prop(page, "Origin risk"),
    humanIntuition: prop(page, "Human intuition")
  };
}

export function transformAcceleratedPages(pages) {
  return pages.map(mapAcceleratedPageToCard).filter(card => card !== null);
}
