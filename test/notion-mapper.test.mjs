// Checks the Early Stage Grades -> triage card mapper against rows exported from Notion on 30 Sep 2026.
// Usage: node test/notion-mapper.test.mjs
import { mapNotionPageToCard, compositeFor } from "../src/notion-grades.js";

const sel = (v) => ({ type: "select", select: v == null ? null : { name: v } });
const txt = (v) => ({ type: "rich_text", rich_text: v ? [{ plain_text: v }] : [] });
const num = (v) => ({ type: "number", number: v });
const page = (id, name, p, axes, extra = {}) => ({
  id, properties: {
    Name: { type: "title", title: [{ plain_text: name }] }, Published: { type: "checkbox", checkbox: true },
    "Composite v2": { type: "formula", formula: { type: "number", number: p.composite ?? null } },
    "Card action": sel(p.action), "Final action": sel(p.final ?? null), "Filter pass": sel(p.filter), Graveyard: sel(p.grave),
    "Ticket URL": { type: "url", url: p.ticket ?? null }, "Grade date": { type: "date", date: { start: p.date } },
    "Physics retired": num(axes[0]), "Path to first unit": num(axes[1]), "Buyer & license": num(axes[2]),
    "Team that has built": num(axes[3]), "Rate of progress": num(axes[4]), "Capital position": num(axes[5]), ...extra,
  },
});

// Fixture: four published rows (text trimmed). Blossom v2 complete, Dig Energy v1 (three axes empty),
// Arinna graveyard with no scores, Elmery approved 30 Sep with an external Ticket URL.
const rows = [
  page("3dbea41b-9258-8147-b375-c4028b123104", "Blossom Energy",
    { action: "DIVE", filter: "YES", grave: "NO", ticket: "https://app.notion.com/3ceea41b925881d1b484d0a5cd949f96", date: "2026-09-14" }, [4, 4, 4, 3, 4, 3],
    { Country: txt("Japan"), Sector: sel("Storage"), Stage: sel("Seed"), "Reason code": sel("None"), Crowding: sel("3–6"), "Origin review": sel("Not done"),
      "What they sell": txt("Graphite thermal-energy storage boiler (G-TES)."),
      Evidence: txt("Physics retired 4: a graphite TES boiler is running at Setouchi Golf Resort. Path to first unit 4: the first commercial unit is operating. Buyer and license 4: a named host. Team that has built 3: Shinpei Hamamoto is CEO. Rate of progress 4: March 2026 start. Capital position 3: about JPY 750M cumulative."),
      "What must be true": txt("Cost of the next graphite boiler.") }),
  page("3d4ea41b-9258-8100-92f7-fab05678f008", "Dig Energy", { action: "DIVE", filter: "YES", grave: "NO", date: "2026-09-07" }, [3, null, null, 2, null, 3],
    { Country: txt("United States"), Sector: sel("Generation"), Stage: sel("Seed"), Evidence: txt("C4 GSHP drill cost and time. P3 water-jet vs carbide is an engineering bet.") }),
  page("3dbea41b-9258-81b3-8173-e0fe70c80b12", "Arinna", { action: "STOP", filter: "NO", grave: "YES", date: "2026-09-14" }, [null, null, null, null, null, null]),
  page("3ebea41b-9258-81ea-b06a-c50694c3b42b", "Elmery", { action: "DIVE", final: "DIVE", filter: "YES", grave: "NO", ticket: "https://example.org/more-predictable-metal-recovery/", date: "2026-09-30", composite: 68 }, [4, 3, 4, 3, 3, 3],
    { Country: txt("Chile"), Sector: sel("Mining & fuels") }),
];

let fail = 0;
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) fail++; };
const [bl, dig, ari, elm] = rows.map(mapNotionPageToCard);

ok(bl.id === "3ceea41b925881d1b484d0a5cd949f96", "id comes from the Notion Ticket URL (same id as the static card and stored reads)");
ok(elm.id === "3ebea41b925881eab06ac50694c3b42b", "external Ticket URL without a card fragment falls back to the Grades page id");
const frag = mapNotionPageToCard(page("3dbea41b-9258-81b3-8173-e0fe70c80b12", "Arinna", { action: "STOP", filter: "NO", grave: "YES", ticket: "https://tomkat.stanford.edu/innovation-transfer/arinna#card=hc-arinna", date: "2026-09-14" }, [null, null, null, null, null, null]));
ok(frag.id === "hc-arinna" && frag.source === "https://tomkat.stanford.edu/innovation-transfer/arinna", "#card= fragment sets the card id and is stripped from the source link");
ok(bl.country === "Japan" && bl.sector === "Storage" && bl.pursue.startsWith("Graphite") && bl.stage_used === "Seed", "Country, Sector, What they sell, Stage");
ok(bl.composite === 75 && bl.action === "DIVE" && bl.fours === 4 && !bl.floor && bl.status === "scored", "Blossom: composite from axes = 75, card DIVE");
ok(bl.evidence.P.startsWith("a graphite") && bl.evidence.T.startsWith("Shinpei") && bl.evidence.K.startsWith("about JPY"), "labelled Evidence is split per axis");
ok(bl.reason === "None" && bl.crowding === "3–6" && bl.origin === "Not done" && bl.wmbt.startsWith("Cost"), "reason code, crowding, origin, what must be true");
ok(elm.composite === 68, "Composite v2 formula value is used when present");
ok(dig.composite === null && dig.status === "scored", "v1 row with empty axes: composite null, not an invented low score");
ok(ari.grave === true && ari.status === "graveyard" && ari.scores === null, "Graveyard YES is a hit; no scores -> scores null");
ok(compositeFor(null, "", { P: 3, D: 3, B: 3, T: 3, R: 3, K: 3 }) === 60, "all 3s = 60.0 (sum(w*s)/5)");
ok(compositeFor(null, "Composite 64.4: Physics retired 4 ...", null) === 64.4, "composite parsed from the start of Evidence");
ok(compositeFor(null, "C4 GSHP drill", null) === null, "no composite in Evidence text that does not start with one");
const g = (v) => mapNotionPageToCard(page("00000000-0000-0000-0000-000000000000", "X", { action: "STOP", filter: "YES", grave: null, date: "2026-09-30" }, [2, 2, 2, 2, 2, 2], { Graveyard: v })).grave;
ok(g(sel("Hit")) && g({ type: "checkbox", checkbox: true }) && !g(sel("NO")) && !g({ type: "checkbox", checkbox: false }), "Graveyard Hit / checked box are hits; NO / unchecked are not");
const f = mapNotionPageToCard(page("00000000-0000-0000-0000-000000000000", "Y", { action: "STOP", filter: "NO", grave: "NO", date: "2026-09-30" }, [2, 2, 2, 2, 2, 2]));
ok(f.status === "filter" && f.gate[0] === false, "Filter pass NO is a fail (the old mapper treated the string as true)");

console.log(fail ? `\n${fail} failed` : "\nall passed");
process.exit(fail ? 1 : 0);
