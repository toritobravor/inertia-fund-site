(async function() {
  let DATA = [];
  let current = null;
  let filter = "ALL";
  let query = "";
  let mode = "ranked"; // "ranked" or "scout"
  let loadError = null;

  const AXES = [
    ['D', 'Sold again', 0.20],
    ['U', 'Unit economics', 0.16],
    ['M', 'Made again', 0.13],
    ['F', 'Financed again', 0.13],
    ['I', 'Improves again', 0.12],
    ['R', 'Regime portability', 0.09],
    ['T', 'Team', 0.09],
    ['P', 'Price', 0.08]
  ];

  const ORDER = {DIVE:0,WATCH:1,'WATCH-PRICE':2,STOP:3};

  // ---------- helpers
  const esc = s => String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const fmt = n => n==null ? "—" : n.toFixed(1);
  
  function autoLink(text) {
    if (!text) return '';
    return String(text).replace(/(https?:\/\/[^\s<>"]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  }

  function parseKeyPeople(text) {
    if (!text) return [];
    const lines = String(text).split('\n').filter(l => l.trim());
    return lines.map(line => {
      // Format: name – title – LinkedIn URL or 'not found'
      const match = line.match(/^(.+?)\s*[–—-]\s*(.+?)\s*[–—-]\s*(.+)$/);
      if (match) {
        const name = match[1].trim();
        const title = match[2].trim();
        const urlPart = match[3].trim();
        const url = urlPart.match(/^https?:\/\//) ? urlPart : '';
        return { name, title, url, notFound: !url };
      }
      return { name: line.trim(), title: '', url: '', notFound: false };
    });
  }

  function parseFundingRounds(text) {
    if (!text) return [];
    const lines = String(text).split('\n').filter(l => l.trim());
    return lines.map(line => {
      // Format: date | round | amount | leads | source URL
      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 3) {
        return {
          date: parts[0] || '',
          round: parts[1] || '',
          amount: parts[2] || '',
          leads: parts[3] || '',
          url: parts[4] || ''
        };
      }
      return { date: '', round: '', amount: '', leads: '', url: '', raw: line };
    });
  }

  function formatCapital(amount) {
    if (amount == null || amount === '') return 'not verified';
    if (typeof amount === 'number') return `$${amount}M`;
    return String(amount);
  }

  // ---------- data loading
  async function loadData() {
    try {
      const res = await fetch("/desk/api/accelerated", { credentials: "same-origin", cache: "no-store" });
      if (res.ok) {
        const body = await res.json();
        DATA = body.pipeline || [];
        loadError = null;
        console.log(`Loaded ${DATA.length} accelerated pipeline entries from ${body.cached ? 'cache' : 'Notion API'}`);
      } else {
        const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        const errorMsg = errBody.message || errBody.error || `HTTP ${res.status}`;
        loadError = `API error: ${errorMsg}`;
        console.error("API error:", errBody);
        if (window.__ACCELERATED_MOCK__) {
          console.log("Using mock data for local development");
          DATA = window.__ACCELERATED_MOCK__;
          loadError = null;
        } else {
          DATA = [];
        }
      }
    } catch (err) {
      loadError = `Failed to load pipeline: ${err.message}`;
      console.error("Failed to load pipeline:", err);
      if (window.__ACCELERATED_MOCK__) {
        console.log("Using mock data for local development");
        DATA = window.__ACCELERATED_MOCK__;
        loadError = null;
      } else {
        DATA = [];
      }
    }
  }

  // ---------- navigation
  function switchPage(page) {
    document.querySelectorAll('.navlink').forEach(n => n.classList.remove('active'));
    document.querySelector(`.navlink[data-page="${page}"]`)?.classList.add('active');
    
    document.getElementById('main-view').style.display = page === 'main' ? 'grid' : 'none';
    ['purpose','method','changelog'].forEach(p => {
      const el = document.getElementById(`${p}-view`);
      if (el) el.style.display = page === p ? 'block' : 'none';
    });
  }

  // ---------- counts
  function renderCounts() {
    const c = {DIVE:0,WATCH:0,'WATCH-PRICE':0,STOP:0};
    DATA.forEach(d => {
      if (d.action) c[d.action] = (c[d.action] || 0) + 1;
    });
    document.getElementById('counts').innerHTML = `
      <div class="count"><b>${DATA.length}</b><span>Total</span></div>
      <div class="count dive"><b>${c.DIVE||0}</b><span>Dive</span></div>
      <div class="count watch"><b>${(c.WATCH||0)+(c['WATCH-PRICE']||0)}</b><span>Watch</span></div>
      <div class="count"><b>${c.STOP||0}</b><span>Stop</span></div>
    `;
    
    const firstDate = DATA.find(d => d.gradeDate)?.gradeDate || "";
    document.getElementById('grade-date').textContent = firstDate;
  }

  // ---------- chips
  function renderChips() {
    const opts = [["ALL","All"],["DIVE","Dive"],["WATCH","Watch"],["WATCH-PRICE","Watch-Price"],["STOP","Stop"]];
    document.getElementById('chips').innerHTML = opts.map(([k,l]) => 
      `<button class="chip" data-f="${k}" aria-pressed="${filter===k}">${l}</button>`
    ).join("");
    document.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => {
      filter = b.dataset.f;
      renderChips();
      renderList();
    }));
  }

  // ---------- list
  function visible() {
    const q = query.trim().toLowerCase();
    return DATA.filter(d => {
      if (filter !== "ALL" && d.action !== filter) return false;
      if (q && !(d.company+" "+(d.country||"")).toLowerCase().includes(q)) return false;
      return true;
    }).sort((a,b) => {
      if (mode === 'scout') {
        return String(b.dateFound||"").localeCompare(String(a.dateFound||""));
      }
      if (a.rank != null && b.rank != null) return a.rank - b.rank;
      if (a.rank != null) return -1;
      if (b.rank != null) return 1;
      const oa = ORDER[a.action] ?? 999;
      const ob = ORDER[b.action] ?? 999;
      if (oa !== ob) return oa - ob;
      return (b.composite||0) - (a.composite||0);
    });
  }

  function renderList() {
    const v = visible();
    const container = document.getElementById('list');
    
    if (loadError) {
      container.innerHTML = `<div class="empty">${esc(loadError)}</div>`;
      return;
    }
    
    if (v.length === 0) {
      container.innerHTML = `<div class="empty">No companies match.</div>`;
      return;
    }
    
    if (mode === 'scout') {
      container.innerHTML = v.map(d => `
        <button class="row" role="option" data-id="${d.id}" aria-current="${current===d.id}">
          <span class="sc">${d.dateFound||"—"}</span>
          <span><span class="nm">${esc(d.company)}</span><span class="meta">${esc(d.foundBy||"Scout")}</span></span>
          <span class="pill ${d.action||'STOP'}">${d.action||'—'}</span>
        </button>
      `).join('');
    } else {
      container.innerHTML = v.map(d => {
        const stressBadge = d.stressResult != null ? `<span class="pill ${d.stressResult?'Pass':'Fail'}">${d.stressResult?'✓':'✗'}</span>` : '';
        return `
          <button class="row" role="option" data-id="${d.id}" aria-current="${current===d.id}">
            <span class="sc ${d.composite==null?'na':''}">${d.composite==null?"—":fmt(d.composite)}</span>
            <span><span class="nm">${d.rank?`${d.rank}. `:''}${esc(d.company)}</span><span class="meta">${esc(d.country||"")} ${stressBadge}</span></span>
            <span class="pill ${d.action||'STOP'}">${d.action||'—'}</span>
          </button>
        `;
      }).join('');
    }
    
    document.querySelectorAll('.row').forEach(b => b.addEventListener('click', () => {
      current = b.dataset.id;
      renderList();
      renderMain();
    }));
  }

  // ---------- detail
  function renderMain() {
    const d = DATA.find(x => x.id === current);
    const m = document.getElementById('main');
    
    if (!d) {
      m.innerHTML = `<div class="empty">Choose a company from the list.</div>`;
      return;
    }

    // Build links box
    let linksHtml = '';
    const links = [];
    if (d.website) links.push(`<div class="lk"><b>Website</b><a href="${esc(d.website)}" target="_blank" rel="noopener">${esc(d.website.replace(/^https?:\/\/(www\.)?/,''))}</a></div>`);
    if (d.linkedinCompany) links.push(`<div class="lk"><b>LinkedIn</b><a href="${esc(d.linkedinCompany)}" target="_blank" rel="noopener">Company page</a></div>`);
    
    const people = parseKeyPeople(d.keyPeople);
    people.forEach(p => {
      if (p.url) {
        links.push(`<div class="lk"><b>LinkedIn</b><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.name)}${p.title?` · ${esc(p.title)}`:''}</a></div>`);
      } else if (p.name) {
        const notFoundNote = p.notFound ? ' <span style="color:var(--ink3);font-size:11px">(not found)</span>' : '';
        links.push(`<div class="lk"><b>Key person</b>${esc(p.name)}${p.title?` · ${esc(p.title)}`:''}${notFoundNote}</div>`);
      }
    });
    
    if (d.capitalRaisedTotal != null || d.capitalRaisedTotal === 0) {
      links.push(`<div class="lk"><b>Capital raised</b>${formatCapital(d.capitalRaisedTotal)}</div>`);
    }
    
    if (d.otherLinks) {
      const otherUrls = String(d.otherLinks).match(/(https?:\/\/[^\s<>"]+)/g);
      if (otherUrls) {
        otherUrls.forEach(url => links.push(`<div class="lk"><b>Link</b><a href="${esc(url)}" target="_blank" rel="noopener">${esc(url.replace(/^https?:\/\/(www\.)?/,'').slice(0,50))}</a></div>`));
      }
    }
    
    if (links.length > 0) {
      const presenceNote = d.publicLinksChecked 
        ? `<div class="note small" style="margin-top:10px">Public presence: ${esc(d.publicLinksChecked)}</div>`
        : '';
      linksHtml = `<section class="blk"><h3>Links</h3><div class="linkbox">${links.join('')}</div>${presenceNote}</section>`;
    }

    // Build axes with rationale
    let axesHtml = '';
    if (d.scores) {
      const rationaleLines = {};
      if (d.rationaleAndSources) {
        String(d.rationaleAndSources).split('\n').forEach(line => {
          const m = line.match(/^([DUMFIRTP]):\s*(.+)$/i);
          if (m) rationaleLines[m[1].toUpperCase()] = m[2].trim();
        });
      }
      
      axesHtml = AXES.map(([key,label,weight]) => {
        const score = d.scores[key];
        const low = ((key==='D'||key==='U') && score<2);
        const rationale = rationaleLines[key] || '';
        const rationaleWithLinks = autoLink(rationale);
        return `
          <div class="axis">
            <span class="an">${label}</span>
            <span class="aw">w ${Math.round(weight*100)}</span>
            <span class="as ${low?'low':''}">${score!=null?score:'—'}</span>
            <span class="bar"><i class="w${score||0} ${score>=4?'hi':''}"></i></span>
          </div>
          ${rationaleWithLinks ? `<div style="grid-column:1/-1;font-size:13px;color:var(--ink2);padding:0 0 12px;border-bottom:1px solid var(--hair)">${rationaleWithLinks}</div>` : ''}
        `;
      }).join('');
    }

    // Build flags
    const flags = [];
    if (d.flagDiscretionary) flags.push('Discretionary subsidy');
    if (d.flagCompliance) flags.push('Compliance-mandated');
    if (d.flagRunway) flags.push('Runway <18mo');
    if (d.flagCompetition) flags.push('Competition');
    if (d.flagAlignment) flags.push('Alignment');
    
    const flagsHtml = flags.length > 0 
      ? `<section class="blk"><h3>Flags</h3><div class="flags">${flags.map(f => `<span class="flag">${esc(f)}</span>`).join('')}</div></section>`
      : '';

    // Build Deal Fit
    const dealFitL = d.dealFitL || d.dealFitLStatus || "Partner to score";
    const dealFitHtml = `
      <div class="dealfit">
        <h4>Deal Fit (reported separately, never blended into composite)</h4>
        <p><strong>L (Leverage):</strong> ${esc(dealFitL)}</p>
        <p><strong>P (Price):</strong> ${d.dealFitP!=null?d.dealFitP:'—'}</p>
        ${d.dealFitPortfolio?`<p><strong>Portfolio fit:</strong> ${esc(d.dealFitPortfolio)}</p>`:''}
      </div>
    `;

    m.innerHTML = `
      <div class="head">
        <div>
          <div class="eyebrow">${esc(d.country||'')} ${d.founded?`· Founded ${esc(d.founded)}`:''}${d.hq?` · HQ ${esc(d.hq)}`:''}</div>
          <h2>${esc(d.company)}</h2>
          <div class="kv">
            ${d.website?`<a href="${esc(d.website)}" target="_blank" rel="noopener">Website ↗</a>`:''}
            ${d.stage?`<span>Stage: ${esc(d.stage)}</span>`:''}
            ${d.employees?`<span>Employees: ${esc(d.employees)}</span>`:''}
          </div>
        </div>
        <div class="scoreblock">
          <div class="big">${fmt(d.composite)}<small> / 100</small></div>
          <div class="actions">
            ${d.rank?`<span class="eyebrow">Rank ${d.rank}</span>`:''}
            ${d.action?`<span class="pill solid ${d.action}">${d.action}</span>`:''}
          </div>
          <div style="font-family:var(--mono);font-size:11px;color:var(--ink3)">
            ${d.dataConfidence?`Confidence: ${esc(d.dataConfidence)}`:''}<br>
            ${d.stressResult!=null?`Stress: <span class="pill ${d.stressResult?'Pass':'Fail'}">${d.stressResult?'Pass':'Fail'} at 55</span>`:''}
          </div>
        </div>
      </div>

      ${d.whatTheySell?`<section class="blk"><h3>What they sell</h3><div class="ticket"><div style="grid-column:1/-1;font-size:14px;color:var(--ink2)">${autoLink(esc(d.whatTheySell))}</div></div></section>`:''}

      ${linksHtml}

      ${d.businessCase?`<section class="blk"><h3>Business case</h3><p>${autoLink(esc(d.businessCase))}</p></section>`:''}

      ${d.customersProof?`<section class="blk"><h3>Customers & proof</h3><p>${autoLink(esc(d.customersProof))}</p></section>`:''}

      ${d.fundingRounds||d.investors||d.capitalRaisedTotal!=null?`<section class="blk"><h3>Funding</h3>
        ${d.capitalRaisedTotal!=null?`<p><strong>Capital raised total:</strong> ${formatCapital(d.capitalRaisedTotal)}</p>`:''}
        ${d.fundingRounds?(() => {
          const rounds = parseFundingRounds(d.fundingRounds);
          if (rounds.length > 0 && rounds[0].date) {
            return `<table style="margin:12px 0"><tr><th>Date</th><th>Round</th><th>Amount</th><th>Leads</th></tr>` +
              rounds.map(r => {
                const sourceLink = r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener" style="color:var(--arc);text-decoration:none">→</a>` : '';
                return `<tr><td>${esc(r.date)}</td><td>${esc(r.round)}</td><td>${esc(r.amount)}</td><td>${esc(r.leads)} ${sourceLink}</td></tr>`;
              }).join('') + `</table>`;
          }
          return `<p><strong>Funding rounds:</strong> ${esc(d.fundingRounds)}</p>`;
        })():''}
        ${d.investors?`<p><strong>Investors:</strong> ${esc(d.investors)}</p>`:''}
      </section>`:''}

      ${d.scores?`<section class="blk"><h3>Repeatability Scorecard (8 axes)</h3>
        <div class="axes">${axesHtml}</div>
        ${d.floorDive!=null||d.floorIc!=null?`<div class="note">
          <strong>Floors:</strong> 
          DIVE (D,U≥2): ${d.floorDive?'Pass':'Fail'} · 
          IC1/IC2 (D,U,P≥3): ${d.floorIc?'Pass':'Fail'}
        </div>`:''}
      </section>`:''}

      ${d.stressedComposite!=null?`<section class="blk"><h3>Stress Testing</h3>
        <p><strong>Stressed composite:</strong> ${fmt(d.stressedComposite)} (lowest of 6 shocks)</p>
        ${d.worstShock?`<p><strong>Worst shock:</strong> ${esc(d.worstShock)}</p>`:''}
        ${d.stressSpread!=null?`<p><strong>Stress spread:</strong> ${d.stressSpread}</p>`:''}
        ${d.regimeDependent?`<p style="color:var(--arc);font-weight:500">Regime-dependent (spread > 10)</p>`:''}
      </section>`:''}

      ${dealFitHtml}

      ${flagsHtml}

      ${d.gates?`<section class="blk"><h3>Gates A1–A9</h3><p>${esc(d.gates)}</p></section>`:''}

      ${d.whyThisOne?`<section class="blk"><h3>Why this one</h3><p>${autoLink(esc(d.whyThisOne))}</p></section>`:''}

      ${d.thesis?`<section class="blk"><h3>Thesis</h3><p>${autoLink(esc(d.thesis))}</p></section>`:''}

      ${d.unknowns?`<section class="blk"><h3>Unknowns</h3><p>${autoLink(esc(d.unknowns))}</p></section>`:''}

      ${d.watchTrigger?`<section class="blk"><h3>Watch trigger</h3><p>${autoLink(esc(d.watchTrigger))}</p></section>`:''}

      ${d.humanIntuition?`<section class="blk"><h3>Human Intuition</h3><p>${autoLink(esc(d.humanIntuition))}</p><div class="note small">Recorded by a named partner. The app never writes this field.</div></section>`:''}

      <section class="blk">
        <h3>Metadata</h3>
        <div class="note">
          <strong>Methodology:</strong> ${esc(d.methodologyVersion||'—')}<br>
          <strong>Score status:</strong> ${esc(d.scoreStatus||'—')}<br>
          <strong>Graded by:</strong> ${esc(d.gradedBy||'—')}<br>
          <strong>Grade date:</strong> ${esc(d.gradeDate||'—')}
        </div>
      </section>
    `;
    
    window.scrollTo({top:0,behavior:'smooth'});
  }

  // ---------- init
  document.getElementById('q').addEventListener('input', e => {
    query = e.target.value;
    renderList();
  });

  document.getElementById('scout-toggle').addEventListener('click', e => {
    if (e.target.classList.contains('toggle-option')) {
      mode = e.target.dataset.mode;
      document.querySelectorAll('.toggle-option').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      renderList();
    }
  });

  document.querySelectorAll('.navlink').forEach(link => {
    link.addEventListener('click', () => switchPage(link.dataset.page));
  });

  await loadData();
  renderCounts();
  renderChips();
  renderList();
  
  if (DATA.length > 0) {
    current = DATA[0].id;
    renderList();
    renderMain();
  }
})();
