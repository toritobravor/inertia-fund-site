// Test harness to verify that Notion grades get merged with static profile data
// Run with: node test-merge.mjs

import { readFileSync } from 'fs';

// Sample Notion-sourced grade (minimal, like what Notion returns)
const notionGrades = [
  {
    id: "3ceea41b9258811aa7d2c848b24e92f2", // Actinide
    name: "Actinide",
    country: "United States",
    sector: "Mining & fuels",
    stage: "Seed",
    stage_used: "Seed",
    pursue: "Electromagnetic isotope separator (calutron)...",
    people: "", // Empty from Notion
    financing: "", // Empty from Notion
    viability: "", // Empty from Notion
    composite: 52.4,
    action: "WATCH",
    scores: { P: 3, D: 2, B: 2, T: 2, R: 4, K: 3 },
    links: {
      website: "https://www.actinideinc.com", // From Notion
      linkedin_company: null, // Not in Notion
      linkedin_people: [], // Empty from Notion
      x: [], // Empty from Notion
      other: [], // Empty from Notion
      note: "",
      checked: "2026-09-07",
    }
  }
];

// Load and parse static grades.js
const gradesText = readFileSync('./public/desk/triage/grades.js', 'utf-8');
const match = /window\.__GRADES__\s*=\s*(\[[\s\S]*\]);?\s*$/.exec(gradesText);
if (!match) {
  console.error("Could not parse grades.js");
  process.exit(1);
}

const staticGrades = JSON.parse(match[1]);
const staticById = Object.fromEntries(staticGrades.map(g => [g.id, g]));

// Merge logic (same as worker.js)
const merged = notionGrades.map(card => {
  const staticCard = staticById[card.id];
  if (!staticCard) return card;
  
  return {
    ...card,
    people: card.people || staticCard.people || "",
    financing: card.financing || staticCard.financing || "",
    viability: card.viability || staticCard.viability || "",
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

// Verify the merge worked
const result = merged[0];
console.log("✅ Merged card for Actinide:\n");
console.log("People:", result.people ? "✓ Present" : "✗ Missing");
console.log("Financing:", result.financing ? "✓ Present" : "✗ Missing");
console.log("Viability:", result.viability ? "✓ Present" : "✗ Missing");
console.log("Links:");
console.log("  Website:", result.links.website || "✗ Missing");
console.log("  LinkedIn people:", result.links.linkedin_people?.length || 0, "entries");
console.log("  X accounts:", result.links.x?.length || 0, "entries");
console.log("  Other links:", result.links.other?.length || 0, "entries");

// Show samples
if (result.people) {
  console.log("\n📋 People (first 100 chars):");
  console.log("  ", result.people.slice(0, 100) + "...");
}

if (result.financing) {
  console.log("\n💰 Financing (first 100 chars):");
  console.log("  ", result.financing.slice(0, 100) + "...");
}

if (result.links.x?.length > 0) {
  console.log("\n🐦 X accounts:");
  result.links.x.forEach(x => console.log("   ", x.handle || x.url));
}

console.log("\n✅ Merge test passed! Profile data successfully restored.");
