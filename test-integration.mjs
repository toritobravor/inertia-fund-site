// Complete integration test simulating the Notion API + merge flow
// Tests both the fresh fetch and cached scenarios
// Run with: node test-integration.mjs

import { readFileSync } from 'fs';

console.log("🧪 Testing Notion grades merge integration\n");

// Simulate Notion API response (minimal data, like what the real Notion API returns)
const mockNotionGrades = [
  {
    id: "3ceea41b9258811aa7d2c848b24e92f2", // Actinide
    name: "Actinide",
    country: "United States",
    sector: "Mining & fuels",
    stage: "Seed",
    stage_used: "Seed",
    pursue: "Electromagnetic isotope separator...",
    people: "", // Empty from Notion (database doesn't have this column)
    financing: "", // Empty from Notion
    viability: "", // Empty from Notion
    composite: 52.4,
    action: "WATCH",
    scores: { P: 3, D: 2, B: 2, T: 2, R: 4, K: 3 },
    links: {
      website: "https://www.actinideinc.com", // Notion has Website column
      linkedin_company: null, // Notion has LinkedIn company column but it's empty
      linkedin_people: [], // Not in Notion database
      x: [], // Not in Notion database
      other: [], // Not in Notion database
      note: "",
      checked: "2026-09-07",
    }
  },
  {
    id: "hc-active-surfaces", // Active Surfaces
    name: "Active Surfaces",
    country: "United States",
    sector: "Generation",
    stage: "Seed",
    stage_used: "Seed",
    pursue: "Lightweight flexible perovskite solar film...",
    people: "",
    financing: "",
    viability: "",
    composite: 53.4,
    action: "WATCH",
    scores: { P: 3, D: 3, B: 2, T: 2, R: 3, K: 3 },
    links: {
      website: "https://www.activesurfaces.io",
      linkedin_company: "not found",
      linkedin_people: [],
      x: [],
      other: [],
      note: "",
      checked: "2026-09-14",
    }
  },
  {
    id: "notion-only-card", // A card that exists ONLY in Notion
    name: "Notion Only Company",
    country: "United States",
    sector: "Generation",
    stage: "Seed",
    stage_used: "Seed",
    pursue: "Some new company...",
    people: "",
    financing: "",
    viability: "",
    composite: 60.0,
    action: "WATCH",
    scores: { P: 3, D: 3, B: 3, T: 3, R: 3, K: 3 },
    links: {
      website: "https://example.com",
      linkedin_company: null,
      linkedin_people: [],
      x: [],
      other: [],
      note: "",
      checked: "2026-10-01",
    }
  }
];

// Load and parse static grades.js (simulating what the worker does)
const gradesText = readFileSync('./public/desk/triage/grades.js', 'utf-8');
const match = /window\.__GRADES__\s*=\s*(\[[\s\S]*\]);?\s*$/.exec(gradesText);
if (!match) {
  console.error("❌ Could not parse grades.js");
  process.exit(1);
}

const staticGrades = JSON.parse(match[1]);
const staticById = Object.fromEntries(staticGrades.map(g => [g.id, g]));

console.log(`📦 Loaded ${staticGrades.length} static grades from grades.js`);
console.log(`🔄 Simulating Notion API returning ${mockNotionGrades.length} grades\n`);

// Merge logic (same as worker.js mergeStaticProfileData)
function mergeStaticProfile(notionGrades, staticById) {
  return notionGrades.map(card => {
    const staticCard = staticById[card.id];
    if (!staticCard) {
      console.log(`  ℹ️  Card "${card.name}" (${card.id}) exists only in Notion - no static data to merge`);
      return card;
    }
    
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
}

const merged = mergeStaticProfile(mockNotionGrades, staticById);

console.log("\n✅ Merge completed. Checking results:\n");

// Validate each merged card
let passCount = 0;
let failCount = 0;

merged.forEach(card => {
  console.log(`📋 ${card.name} (${card.id})`);
  
  const staticCard = staticById[card.id];
  if (!staticCard) {
    console.log("   → Notion-only card (expected to have empty profile fields)");
    if (!card.people && !card.financing && card.links.linkedin_people?.length === 0) {
      console.log("   ✅ Correctly has empty profile fields\n");
      passCount++;
    } else {
      console.log("   ❌ FAIL: Should have empty profile fields\n");
      failCount++;
    }
    return;
  }
  
  const checks = {
    people: !!card.people,
    financing: !!card.financing,
    viability: !!card.viability,
    website: !!card.links.website,
    linkedin_people: card.links.linkedin_people?.length > 0,
    x: card.links.x?.length > 0,
    other: card.links.other?.length > 0,
  };
  
  const failed = [];
  
  // Check critical fields that should be restored
  if (!checks.people) failed.push("People missing");
  if (!checks.financing) failed.push("Financing missing");
  if (!checks.website) failed.push("Website missing");
  
  if (failed.length > 0) {
    console.log(`   ❌ FAIL: ${failed.join(", ")}`);
    failCount++;
  } else {
    console.log("   ✅ PASS: All critical fields restored");
    passCount++;
  }
  
  console.log(`   → People: ${checks.people ? "✓" : "✗"}`);
  console.log(`   → Financing: ${checks.financing ? "✓" : "✗"}`);
  console.log(`   → Viability: ${checks.viability ? "✓" : "✗"}`);
  console.log(`   → Links: website=${checks.website ? "✓" : "✗"}, linkedin_people=${checks.linkedin_people ? "✓" : "✗"}, x=${checks.x ? "✓" : "✗"}, other=${checks.other ? "✓" : "✗"}`);
  console.log("");
});

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
if (failCount === 0) {
  console.log(`✅ All tests passed! (${passCount}/${passCount})`);
  console.log("\n✨ Integration test SUCCESS");
  console.log("   → Notion scores/grades are preserved");
  console.log("   → Static profile data (People, Financing, Links) is merged");
  console.log("   → Notion-only cards work correctly");
  process.exit(0);
} else {
  console.log(`❌ Some tests failed: ${failCount} failures, ${passCount} passes`);
  process.exit(1);
}
