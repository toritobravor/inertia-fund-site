// Test the Notion-to-card mapping with a sample Notion API response

import { mapNotionPageToCard, transformNotionPages } from "./src/notion-grades.js";

// Mock Notion API page response for Actinide
const mockNotionPage = {
  "id": "3ceea41b-9258-811a-a7d2-c848b24e92f2",
  "properties": {
    "Name": {
      "type": "title",
      "title": [{ "plain_text": "Actinide" }]
    },
    "Sector": {
      "type": "select",
      "select": { "name": "Mining & fuels" }
    },
    "Stage": {
      "type": "select",
      "select": { "name": "Seed" }
    },
    "Filter pass": {
      "type": "select",
      "select": { "name": "Pass" }
    },
    "Graveyard": {
      "type": "select",
      "select": null
    },
    "Crowding": {
      "type": "select",
      "select": { "name": "3–6" }
    },
    "Origin review": {
      "type": "select",
      "select": { "name": "Not applicable" }
    },
    "Card action": {
      "type": "select",
      "select": { "name": "WATCH" }
    },
    "Final action": {
      "type": "select",
      "select": { "name": "WATCH" }
    },
    "Reason code": {
      "type": "select",
      "select": { "name": "Delivery" }
    },
    "Physics retired": {
      "type": "number",
      "number": 3
    },
    "Path to first unit": {
      "type": "number",
      "number": 2
    },
    "Buyer & license": {
      "type": "number",
      "number": 2
    },
    "Team that has built": {
      "type": "number",
      "number": 2
    },
    "Rate of progress": {
      "type": "number",
      "number": 4
    },
    "Capital position": {
      "type": "number",
      "number": 3
    },
    "Composite v2": {
      "type": "formula",
      "formula": {
        "type": "number",
        "number": 52.4
      }
    },
    "Published": {
      "type": "checkbox",
      "checkbox": true
    },
    "Country": {
      "type": "rich_text",
      "rich_text": [{ "plain_text": "United States" }]
    },
    "What they sell": {
      "type": "rich_text",
      "rich_text": [{ "plain_text": "Electromagnetic isotope separator (calutron). Research-scale natural U to 15.38% U-235 (ISO/IEC 17025 assay), solid HALEU, bypassing UF6 deconversion. Building second-gen Fortitude." }]
    },
    "People": {
      "type": "rich_text",
      "rich_text": [{ "plain_text": "Eric Olszewski (CEO); Robert Mendelsohn (CTO)." }]
    },
    "Financing": {
      "type": "rich_text",
      "rich_text": [{ "plain_text": "Founded Sep 2025. Oversubscribed seed, Mar 2026, led by Onto Ventures; Neo, Mana, Discipulus, Shor Capital. Amount not disclosed. HALEU demo PR 26 Aug 2026." }]
    },
    "Viability note": {
      "type": "rich_text",
      "rich_text": [{ "plain_text": "High on demo and team; medium on scale vs centrifuges and on licensing past lab exclusion." }]
    },
    "Ticket URL": {
      "type": "url",
      "url": "https://www.actinideinc.com/press/actinide-becomes-first-startup-to-ever-enrich-natural-uranium-to-produce-haleu"
    },
    "Gate note": {
      "type": "rich_text",
      "rich_text": [{ "plain_text": "HALEU supply is a checked 2025–26 break: DOE's HALEU availability program and the June 2026 supply-chain loans exist because no commercial US source is operating." }]
    },
    "Graveyard note": {
      "type": "rich_text",
      "rich_text": []
    },
    "Physics retired evidence": {
      "type": "rich_text",
      "rich_text": [{ "plain_text": "Natural uranium was enriched to 15.38% U-235 at research scale with an ISO/IEC 17025 assay (company PR, 26 Aug 2026), which is an independent measurement of a working process; scale against centrifuges is still open." }]
    },
    "Path evidence": {
      "type": "rich_text",
      "rich_text": [{ "plain_text": "A second-generation machine (Fortitude) is being built, but the ticket names no licensing route past the laboratory exclusion, no site, and no date that can be checked." }]
    },
    "Buyer evidence": {
      "type": "rich_text",
      "rich_text": [{ "plain_text": "The buyer class is advanced-reactor developers and DOE, and no named buyer or letter is on the ticket." }]
    },
    "Team evidence": {
      "type": "rich_text",
      "rich_text": [{ "plain_text": "The CEO and CTO are named; the ticket shows no one who has delivered a physical or regulated product to a paying customer." }]
    },
    "Rate evidence": {
      "type": "rich_text",
      "rich_text": [{ "plain_text": "Founded September 2025, an oversubscribed seed in March 2026, and a HALEU demonstration in August 2026 are three dated milestones inside twelve months." }]
    },
    "Capital evidence": {
      "type": "rich_text",
      "rich_text": [{ "plain_text": "An undisclosed seed led by Onto Ventures is an idea-to-first-unit round and our instrument fits; the shortage is known but the company is not yet priced on it." }]
    },
    "Analysis": {
      "type": "rich_text",
      "rich_text": [{ "plain_text": "Actinide has shown that its separator produces HALEU, and it has moved fast. What it has not shown is how a calutron gets licensed and scaled, or who signs for the product. That is a delivery question, which is exactly the kind this desk should watch rather than visit until a licensing document exists." }]
    },
    "What must be true": {
      "type": "rich_text",
      "rich_text": [{ "plain_text": "A written NRC or DOE licensing pathway for enrichment outside the laboratory exclusion, and one named offtaker with a letter." }]
    },
    "Website": {
      "type": "url",
      "url": "https://www.actinideinc.com"
    },
    "LinkedIn company": {
      "type": "url",
      "url": null
    },
    "Grade date": {
      "type": "date",
      "date": { "start": "2026-09-07" }
    }
  }
};

// Test the mapping
console.log("Testing Notion-to-card mapping...\n");

const card = mapNotionPageToCard(mockNotionPage);

console.log("Input: Mock Notion page for 'Actinide'");
console.log("\nOutput card:");
console.log(JSON.stringify(card, null, 2));

// Validate key fields
console.log("\n--- Validation ---");
const checks = [
  ["Name", card.name === "Actinide"],
  ["Sector", card.sector === "Mining & fuels"],
  ["Composite", card.composite === 52.4],
  ["Action", card.action === "WATCH"],
  ["Status", card.status === "scored"],
  ["Gate passes", card.gate.every(g => g === true)],
  ["Graveyard", card.grave === false],
  ["Physics score", card.scores.P === 3],
  ["Path score", card.scores.D === 2],
  ["Rate score", card.scores.R === 4],
  ["Fours count", card.fours === 1],
  ["Floor check", card.floor === false],
  ["Reason code", card.reason === "Delivery"],
  ["Evidence has Physics", card.evidence.P.includes("ISO/IEC 17025")],
  ["Links website", card.links.website === "https://www.actinideinc.com"]
];

let passed = 0;
checks.forEach(([name, result]) => {
  console.log(`${result ? "✓" : "✗"} ${name}`);
  if (result) passed++;
});

console.log(`\n${passed}/${checks.length} checks passed`);

if (passed === checks.length) {
  console.log("\n✓ All tests passed!");
  process.exit(0);
} else {
  console.log("\n✗ Some tests failed");
  process.exit(1);
}
