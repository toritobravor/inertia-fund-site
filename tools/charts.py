"""Generates the 'State of power' panels as inline SVG.
Run:  python3 tools/charts.py > /tmp/state.html   then paste between the markers in public/index.html.
Every figure is dated and traced to its source in claude/twelve-theses.md (31 Aug 2026)."""

INK, INK2, INK3, INK4, HAIR, ARC = "#15191D", "#3E4750", "#6B7783", "#9AA3AC", "#D8D3CA", "#CC4318"
W = 340  # viewBox width (≈ rendered width at desktop, so type stays 1:1)

def esc(s): return s.replace("&", "&amp;").replace("<", "&lt;")

def text(x, y, s, cls="lab", anchor="start", fill=None, size=None):
    st = f' style="fill:{fill}"' if fill else ""
    sz = f' font-size="{size}"' if size else ""
    return f'<text x="{x}" y="{y}" class="{cls}" text-anchor="{anchor}"{st}{sz}>{esc(s)}</text>'

def hbar_chart(rows, vmax, unit, highlight=None, note=None):
    """rows: [(label, value, value_label)] horizontal bars; one series, one color."""
    left, right, top, rowh = 126, 44, 14, 36
    plotw = W - left - right
    nl = (len(note) if isinstance(note, (list, tuple)) else 1) if note else 0
    h = top + rowh * len(rows) + 8 + 15 * nl + (10 if nl else 0)
    out = [f'<svg viewBox="0 0 {W} {h}" role="img" xmlns="http://www.w3.org/2000/svg">']
    # baseline
    out.append(f'<line x1="{left}" y1="{top-6}" x2="{left}" y2="{top + rowh*len(rows) - 12}" stroke="{HAIR}" stroke-width="1"/>')
    for i, (lab, v, vl) in enumerate(rows):
        y = top + i * rowh
        w = plotw * v / vmax
        col = ARC if lab == highlight else INK3
        out.append(text(left - 14, y + 13, lab, "lab", "end"))
        out.append(f'<path d="M{left},{y+3} h{w-4:.1f} a4,4 0 0 1 4,4 v2 a4,4 0 0 1 -4,4 h-{w-4:.1f} z" fill="{col}"><title>{esc(lab)}: {esc(vl)} {esc(unit)}</title></path>')
        out.append(text(left + w + 10, y + 13, vl, "val", fill=INK if lab != highlight else ARC))
    if note:
        out += notes(left, h, note)
    out.append('</svg>')
    return "\n".join(out)

def notes(x, h, note):
    lines = note if isinstance(note, (list, tuple)) else [note]
    return [text(x, h - 8 - 15 * (len(lines) - 1 - i), l, "note") for i, l in enumerate(lines)]

def dots_cap_chart(rows, vmin, vmax, unit, note):
    """PJM: dot at clearing price with a cap tick at the same position."""
    left, right, top, rowh = 56, 66, 14, 36
    plotw = W - left - right
    nl = len(note) if isinstance(note, (list, tuple)) else 1
    h = top + rowh * len(rows) + 30 + 15 * nl
    x = lambda v: left + plotw * (v - vmin) / (vmax - vmin)
    out = [f'<svg viewBox="0 0 {W} {h}" role="img" xmlns="http://www.w3.org/2000/svg">']
    axy = top + rowh * len(rows) - 6
    out.append(f'<line x1="{left}" y1="{axy}" x2="{left+plotw}" y2="{axy}" stroke="{HAIR}"/>')
    for v in (250, 300, 350):
        out.append(f'<line x1="{x(v):.1f}" y1="{axy}" x2="{x(v):.1f}" y2="{axy+4}" stroke="{HAIR}"/>')
        out.append(text(f"{x(v):.1f}", axy + 17, f"${v}", "tick", "middle"))
    for i, (lab, v, cap) in enumerate(rows):
        y = top + i * rowh + 8
        out.append(text(left - 14, y + 4, lab, "lab", "end"))
        out.append(f'<line x1="{left}" y1="{y}" x2="{x(v):.1f}" y2="{y}" stroke="{HAIR}"/>')
        out.append(f'<line x1="{x(cap):.1f}" y1="{y-10}" x2="{x(cap):.1f}" y2="{y+10}" stroke="{INK}" stroke-width="1.2"/>')
        out.append(f'<circle cx="{x(v):.1f}" cy="{y}" r="5" fill="{ARC}" stroke="#fff" stroke-width="2"><title>{esc(lab)}: ${v:.2f}/MW-day, cleared at the cap</title></circle>')
        out.append(text(x(v) + 14, y + 4, f"${v:,.2f}", "val", fill=INK))
    out += notes(left, h, note)
    out.append('</svg>')
    return "\n".join(out)

def line_chart(points, ymin, ymax, unit, note):
    left, right, top, bottom = 38, 44, 18, 62
    h = 196
    plotw, ploth = W - left - right, h - top - bottom
    xs = [left + plotw * i / (len(points) - 1) for i in range(len(points))]
    y = lambda v: top + ploth * (1 - (v - ymin) / (ymax - ymin))
    out = [f'<svg viewBox="0 0 {W} {h}" role="img" xmlns="http://www.w3.org/2000/svg">']
    for g in (50, 75):
        out.append(f'<line x1="{left}" y1="{y(g):.1f}" x2="{left+plotw}" y2="{y(g):.1f}" stroke="{HAIR}"/>')
        out.append(text(left - 8, y(g) + 4, f"{g}%", "tick", "end"))
    out.append(f'<line x1="{left}" y1="{top+ploth}" x2="{left+plotw}" y2="{top+ploth}" stroke="{HAIR}"/>')
    d = " ".join(f"{'M' if i==0 else 'L'}{xs[i]:.1f},{y(p[1]):.1f}" for i, p in enumerate(points))
    out.append(f'<path d="{d}" fill="none" stroke="{INK2}" stroke-width="2" stroke-linejoin="round"/>')
    for i, (lab, v) in enumerate(points):
        last = i == len(points) - 1
        out.append(f'<circle cx="{xs[i]:.1f}" cy="{y(v):.1f}" r="{5 if last else 4}" fill="{ARC if last else INK2}" stroke="#fff" stroke-width="2"><title>{esc(lab)}: {v}% oppose</title></circle>')
        out.append(text(xs[i], top + ploth + 18, lab, "tick", "middle"))
        out.append(text(xs[i] + (0 if not last else 0), y(v) - 12, f"{v}%", "val", "middle", fill=ARC if last else INK))
    out += notes(left, h, note)
    out.append('</svg>')
    return "\n".join(out)

def proportion_chart(total, part, labels, note):
    left, right, top = 4, 4, 40
    h = 140
    plotw = W - left - right
    pw = max(plotw * part / total, 4)
    out = [f'<svg viewBox="0 0 {W} {h}" role="img" xmlns="http://www.w3.org/2000/svg">']
    out.append(text(left, 18, labels[0], "lab"))
    out.append(text(left + plotw, 18, labels[1], "val", "end", fill=INK))
    out.append(f'<rect x="{left}" y="{top}" width="{plotw}" height="14" rx="4" fill="none" stroke="{INK4}"/>')
    out.append(f'<rect x="{left}" y="{top}" width="{pw:.1f}" height="14" rx="4" fill="{ARC}"><title>{esc(labels[2])}</title></rect>')
    out.append(text(left, top + 40, labels[2], "val", fill=ARC))
    out.append(text(left + plotw, top + 40, labels[3], "lab", "end"))
    out += notes(left, h, note)
    out.append('</svg>')
    return "\n".join(out)

def stat_tile(num, unit, what, how):
    return f'''<div class="stat">
  <span class="num">{num}<sup>{unit}</sup></span>
  <span class="what">{what}</span>
  <span class="how">{how}</span>
</div>'''

def panel(title, svg, source, table):
    thead = "".join(f"<th>{esc(c)}</th>" for c in table[0])
    rows = "".join("<tr>" + "".join(f"<td>{esc(str(c))}</td>" for c in r) + "</tr>" for r in table[1:])
    return f'''<figure class="panel">
  <figcaption><h3>{title}</h3></figcaption>
  {svg}
  <span class="fig-source">{source}</span>
  <details class="data"><summary>Data</summary><table><thead><tr>{thead}</tr></thead><tbody>{rows}</tbody></table></details>
</figure>'''

panels = []

panels.append(panel(
    "The wait for equipment, in weeks",
    hbar_chart([("HV switchgear", 44, "44"), ("Power transformer", 128, "128"), ("Step-up (GSU)", 143, "143")], 160, "weeks",
               note=["Transformer prices +75–80%", "since 2019."]),
    "Wood Mackenzie / American Clean Power, Q2 2025. Constrained units quoted to four years (PwC, May 2026).",
    [("Equipment", "Lead time (weeks)"), ("HV switchgear", 44), ("Large power transformer", 128), ("Generator step-up transformer", "143–144")]))

panels.append(panel(
    "Gas turbine order books, GW",
    hbar_chart([("GE Vernova", 116, "116"), ("Siemens Energy", 69, "69"), ("Mitsubishi", 35, "35")], 130, "GW",
               note=["~220 GW committed; new large-frame", "slots deliver 2029–31."]),
    "Company reporting, mid-2026. GE Vernova separately discloses 63 GW of slot reservations, a softer commitment than firm backlog.",
    [("Manufacturer", "Backlog (GW)"), ("GE Vernova", 116), ("Siemens Energy", 69), ("Mitsubishi", 35)]))

panels.append(panel(
    "PJM capacity price, cleared at the cap three times",
    dots_cap_chart([("2026/27", 329.17, 329.17), ("2027/28", 333.44, 333.44), ("2028/29", 325.00, 325.00)], 240, 360, "$/MW-day",
                   ["Latest auction: 525 MW of new generation", "cleared; 6,831 MW short of requirement."]),
    "PJM Base Residual Auction results, 2024–July 2026. Tick marks the administrative price cap. $/MW-day.",
    [("Delivery year", "Clearing price ($/MW-day)", "Cap"), ("2026/27", "329.17", "yes"), ("2027/28", "333.44", "yes"), ("2028/29", "325.00", "yes")]))

panels.append(panel(
    "Voters opposed to a data center near their home",
    line_chart([("Feb 2026", 51), ("May 2026", 70), ("Aug 2026", 75)], 30, 85, "%",
               ["33-point net swing in a year;", "opposition is bipartisan."]),
    "Embold Research, registered voters, n=2,045 (8–13 Aug 2026). Gallup, March 2026: 70% opposed.",
    [("Survey", "Oppose (%)"), ("February 2026", 51), ("May 2026", 70), ("August 2026", 75)]))

panels.append(panel(
    "On-site power for data centers: announced against operating",
    proportion_chart(90, 2, ("Announced, 59 projects", "~90 GW", "~2 GW operating", "2.2% of announced"),
                     ["Up from 56 GW announced four months", "earlier; roughly three-quarters gas."]),
    "Cleanview, June 2026. Announcement-driven series; treat as directional.",
    [("Status", "GW"), ("Announced", "~90"), ("Permitted", "~32 (36%)"), ("Operating", "~2 (2.2%)")]))

stat = stat_tile("61", "months", "Median wait from interconnection request to commercial operation, US projects completed in 2025",
                 "Down from ~65 months. The active queue is 2,061 GW, shrinking through withdrawals rather than throughput: more than 750 GW withdrew in 2025. Lawrence Berkeley National Laboratory, <em>Queued Up</em>, 2026 edition.")

print('<div class="panels">')
print("\n".join(panels))
print(stat)
print('</div>')
