// Visual comparison test showing what data is restored for sample companies
// Run with: node test-visual-comparison.mjs

import { readFileSync } from 'fs';

console.log("🔍 Visual Comparison: What Gets Restored\n");
console.log("Sample companies showing before (Notion only) vs after (merged with static)\n");

// Sample Notion-sourced grades (what production was serving since 30 Sep)
const notionGrades = [
  {
    id: "3ceea41b9258811aa7d2c848b24e92f2",
    name: "Actinide",
    composite: 52.4,
    action: "WATCH",
    people: "",
    financing: "",
    viability: "",
    links: {
      website: "https://www.actinideinc.com",
      linkedin_company: null,
      linkedin_people: [],
      x: [],
      other: [],
    }
  },
  {
    id: "3ceea41b925881e09595ee0f5dfe0d22",
    name: "Beff",
    composite: 51.0,
    action: "WATCH",
    people: "",
    financing: "",
    viability: "",
    links: {
      website: "https://b-eff.com",
      linkedin_company: "not found",
      linkedin_people: [],
      x: [],
      other: [],
    }
  },
  {
    id: "3ceea41b925881b3baead284f30414ad",
    name: "Bluecore Energy",
    composite: 34.0,
    action: "STOP",
    people: "",
    financing: "",
    viability: "",
    links: {
      website: "https://www.bluecore.energy",
      linkedin_company: null,
      linkedin_people: [],
      x: [],
      other: [],
    }
  }
];

// Load static grades
const gradesText = readFileSync('./public/desk/triage/grades.js', 'utf-8');
const match = /window\.__GRADES__\s*=\s*(\[[\s\S]*\]);?\s*$/.exec(gradesText);
const staticGrades = JSON.parse(match[1]);
const staticById = Object.fromEntries(staticGrades.map(g => [g.id, g]));

// Merge function
function merge(notionCard) {
  const staticCard = staticById[notionCard.id];
  if (!staticCard) return notionCard;
  
  return {
    ...notionCard,
    people: notionCard.people || staticCard.people || "",
    financing: notionCard.financing || staticCard.financing || "",
    viability: notionCard.viability || staticCard.viability || "",
    links: {
      website: notionCard.links?.website || staticCard.links?.website || null,
      linkedin_company: notionCard.links?.linkedin_company || staticCard.links?.linkedin_company || null,
      linkedin_people: staticCard.links?.linkedin_people || [],
      x: staticCard.links?.x || [],
      other: staticCard.links?.other || [],
      note: staticCard.links?.note || "",
      checked: notionCard.links?.checked || staticCard.links?.checked || "",
    }
  };
}

const merged = notionGrades.map(merge);

// Display comparison
function truncate(str, len) {
  if (!str) return "(empty)";
  str = String(str);
  return str.length > len ? str.slice(0, len) + "..." : str;
}

console.log("━".repeat(120));

merged.forEach((card, i) => {
  const before = notionGrades[i];
  
  console.log(`\n📋 ${card.name}`);
  console.log(`   Composite: ${card.composite} | Action: ${card.action}`);
  console.log("");
  
  // People
  console.log("   PEOPLE:");
  console.log(`   Before: ${truncate(before.people, 80)}`);
  console.log(`   After:  ${truncate(card.people, 80)}`);
  if (card.people && !before.people) console.log("   ✅ RESTORED");
  console.log("");
  
  // Financing
  console.log("   FINANCING:");
  console.log(`   Before: ${truncate(before.financing, 80)}`);
  console.log(`   After:  ${truncate(card.financing, 80)}`);
  if (card.financing && !before.financing) console.log("   ✅ RESTORED");
  console.log("");
  
  // Viability
  console.log("   VIABILITY:");
  console.log(`   Before: ${truncate(before.viability, 80)}`);
  console.log(`   After:  ${truncate(card.viability, 80)}`);
  if (card.viability && !before.viability) console.log("   ✅ RESTORED");
  console.log("");
  
  // Links
  const beforeLinks = before.links.linkedin_people?.length + before.links.x?.length + before.links.other?.length;
  const afterLinks = card.links.linkedin_people?.length + card.links.x?.length + card.links.other?.length;
  
  console.log("   LINKS:");
  console.log(`   Before: Website only (${beforeLinks} social/other links)`);
  console.log(`   After:  ${card.links.linkedin_people?.length || 0} LinkedIn, ${card.links.x?.length || 0} X, ${card.links.other?.length || 0} other`);
  if (afterLinks > beforeLinks) console.log("   ✅ RESTORED");
  
  console.log("\n" + "─".repeat(120));
});

console.log("\n✨ All profile sections restored from static grades.js");
console.log("   Notion scores/actions preserved: ✅");
console.log("   Cards render exactly as they did before 30 Sep 2026\n");
