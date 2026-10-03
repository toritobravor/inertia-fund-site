(async function() {
  let DATA = [];
  let currentView = 'purpose';
  let selectedCompany = null;

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

  async function loadData() {
    try {
      const res = await fetch("/desk/api/accelerated", { credentials: "same-origin", cache: "no-store" });
      if (res.ok) {
        const body = await res.json();
        DATA = body.pipeline || [];
        console.log(`Loaded ${DATA.length} accelerated pipeline entries from ${body.cached ? 'cache' : 'Notion API'}`);
      } else {
        const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        console.error("API error:", errBody.error || `HTTP ${res.status}`);
        if (window.__ACCELERATED_MOCK__) {
          console.log("Using mock data for local development");
          DATA = window.__ACCELERATED_MOCK__;
        } else {
          DATA = [];
        }
      }
    } catch (err) {
      console.error("Failed to load pipeline:", err);
      if (window.__ACCELERATED_MOCK__) {
        console.log("Using mock data for local development");
        DATA = window.__ACCELERATED_MOCK__;
      } else {
        DATA = [];
      }
    }
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  }

  function fmt(n) {
    return n == null ? "—" : n.toFixed(1);
  }

  function renderTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const view = tab.dataset.view;
        switchView(view);
      });
    });
  }

  function switchView(view) {
    currentView = view;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    
    const activeTab = document.querySelector(`.tab[data-view="${view}"]`);
    const activeView = document.getElementById(`view-${view}`);
    
    if (activeTab) activeTab.classList.add('active');
    if (activeView) activeView.classList.add('active');

    if (view === 'scout') renderScoutResults();
    if (view === 'grades') renderGrades();
  }

  function renderScoutResults() {
    const container = document.getElementById('scout-list');
    if (!container) return;

    if (DATA.length === 0) {
      container.innerHTML = '<p class="eyebrow">No scout results available.</p>';
      return;
    }

    const html = DATA.map(d => {
      return `
        <div class="scout-card">
          <h4>${esc(d.company)}</h4>
          <div class="scout-meta">
            Found by: ${esc(d.foundBy || "—")} · 
            Date found: ${esc(d.dateFound || "—")}
          </div>
          ${d.scoutSummary ? `<div class="scout-summary">${esc(d.scoutSummary)}</div>` : ''}
          ${d.scoutSource ? `<div class="scout-source">Source: <a href="${esc(d.scoutSource)}" target="_blank" rel="noopener">${esc(d.scoutSource)}</a></div>` : ''}
        </div>
      `;
    }).join('');

    container.innerHTML = html;
  }

  function renderGrades() {
    const container = document.getElementById('grades-list');
    const detailPanel = document.getElementById('detail-panel');
    if (!container) return;

    const graded = DATA.filter(d => d.composite != null);
    
    if (graded.length === 0) {
      container.innerHTML = '<p class="eyebrow">No graded companies available.</p>';
      return;
    }

    const firstDate = graded.find(d => d.gradeDate)?.gradeDate || "";
    const firstStatus = graded.find(d => d.scoreStatus)?.scoreStatus || "";
    
    const gradeDateEl = document.getElementById('grade-date');
    const scoreStatusEl = document.getElementById('score-status');
    if (gradeDateEl) gradeDateEl.textContent = firstDate;
    if (scoreStatusEl) scoreStatusEl.textContent = firstStatus;

    const sorted = graded.sort((a, b) => {
      if (a.rank != null && b.rank != null) return a.rank - b.rank;
      if (a.rank != null) return -1;
      if (b.rank != null) return 1;
      return (b.composite || 0) - (a.composite || 0);
    });

    const html = sorted.map(d => {
      const stressPill = d.stressResult != null 
        ? `<span class="pill ${d.stressResult ? 'Pass' : 'Fail'}">${d.stressResult ? 'Pass' : 'Fail'} at 55</span>`
        : '';
      
      return `
        <div class="card" data-id="${esc(d.id)}">
          <div class="card-header">
            <div>
              <div class="card-title">${d.rank ? `${d.rank}. ` : ''}${esc(d.company)}</div>
              <div class="card-meta">
                ${esc(d.stage || "")} · 
                ${esc(d.country || "")} · 
                Data confidence: ${esc(d.dataConfidence || "—")}
              </div>
            </div>
            <div style="text-align: right;">
              <div class="score-badge">${fmt(d.composite)}</div>
              <div style="font-size: 0.875rem; color: var(--ink2);">/ 100</div>
            </div>
          </div>
          <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
            ${d.action ? `<span class="pill ${d.action}">${d.action}</span>` : ''}
            ${stressPill}
            ${d.floorDive != null ? `<span style="font-size: 0.875rem;">DIVE floor: ${d.floorDive ? 'Pass' : 'Fail'}</span>` : ''}
            ${d.floorIc != null ? `<span style="font-size: 0.875rem;">IC floor: ${d.floorIc ? 'Pass' : 'Fail'}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = html;

    document.querySelectorAll('.card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        selectedCompany = DATA.find(d => d.id === id);
        renderDetail();
      });
    });
  }

  function renderDetail() {
    const panel = document.getElementById('detail-panel');
    if (!panel || !selectedCompany) return;

    const d = selectedCompany;

    const axesHtml = AXES.map(([key, label, weight]) => {
      const score = d.scores ? d.scores[key] : null;
      return `
        <div class="axis-row">
          <div class="axis-label">${label}</div>
          <div class="axis-weight">${Math.round(weight * 100)}%</div>
          <div class="axis-score">${score != null ? score : '—'}</div>
        </div>
      `;
    }).join('');

    const rationaleLines = (d.rationaleAndSources || '').split('\n').filter(line => line.trim()).map(line => {
      const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
      if (urlMatch) {
        const url = urlMatch[1];
        const text = line.replace(url, '').trim();
        return `<div class="rationale-source">${esc(text)} <a href="${esc(url)}" target="_blank" rel="noopener">→ source</a></div>`;
      }
      return `<div class="rationale-source">${esc(line)}</div>`;
    }).join('');

    const flags = [];
    if (d.flagDiscretionary) flags.push('Discretionary subsidy share');
    if (d.flagCompliance) flags.push('Compliance-mandated share');
    if (d.flagRunway) flags.push('Runway under 18 months');
    if (d.flagCompetition) flags.push('Competition');
    if (d.flagAlignment) flags.push('Alignment');

    const dealFitL = d.dealFitL || d.dealFitLStatus || "Partner to score";

    const html = `
      <div class="detail-header">
        <h2>${esc(d.company)}</h2>
        <div class="eyebrow">
          ${esc(d.stage || "")} · 
          ${esc(d.country || "")} · 
          ${d.website ? `<a href="${esc(d.website)}" target="_blank" rel="noopener">Website ↗</a>` : ''}
        </div>
        <div style="display: flex; gap: 2rem; margin-top: 1rem; align-items: start;">
          <div>
            <div class="score-badge">${fmt(d.composite)}</div>
            <div style="font-size: 0.875rem; color: var(--ink2);">Composite / 100</div>
          </div>
          <div>
            ${d.action ? `<span class="pill ${d.action}">${d.action}</span>` : ''}
          </div>
        </div>
      </div>

      <div class="detail-section">
        <h3>8-Axis Breakdown</h3>
        <div class="axis-grid">
          <div style="font-weight: 600; border-bottom: 2px solid var(--hair);">Axis</div>
          <div style="font-weight: 600; text-align: right; border-bottom: 2px solid var(--hair);">Weight</div>
          <div style="font-weight: 600; text-align: right; border-bottom: 2px solid var(--hair);">Score</div>
          ${axesHtml}
        </div>
        ${rationaleLines ? `<div style="margin-top: 1rem;"><strong>Rationale and sources:</strong>${rationaleLines}</div>` : ''}
      </div>

      ${d.gates ? `
        <div class="detail-section">
          <h3>Gates A1–A9</h3>
          <p>${esc(d.gates)}</p>
        </div>
      ` : ''}

      <div class="detail-section">
        <h3>Floors</h3>
        <p>DIVE floor (D, U ≥ 2): ${d.floorDive != null ? (d.floorDive ? 'Pass' : 'Fail') : '—'}</p>
        <p>IC1/IC2 floor (D, U, P ≥ 3): ${d.floorIc != null ? (d.floorIc ? 'Pass' : 'Fail') : '—'}</p>
      </div>

      <div class="detail-section">
        <h3>Stress Result</h3>
        <p>Stressed composite: ${fmt(d.stressedComposite)}</p>
        <p>Worst shock: ${esc(d.worstShock || "—")}</p>
        <p>Stress spread: ${d.stressSpread != null ? d.stressSpread : '—'}</p>
        <p>Stress result (≥55): <span class="pill ${d.stressResult ? 'Pass' : 'Fail'}">${d.stressResult ? 'Pass' : 'Fail'}</span></p>
        ${d.regimeDependent ? `<p style="margin-top: 0.5rem; color: var(--arc); font-weight: 500;">Regime-dependent (spread > 10)</p>` : ''}
      </div>

      <div class="deal-fit-box">
        <h4>Deal Fit</h4>
        <p><strong>L (Leverage):</strong> ${esc(dealFitL)}</p>
        <p><strong>P (Price):</strong> ${d.dealFitP != null ? d.dealFitP : '—'}</p>
        <p><strong>Portfolio fit:</strong> ${esc(d.dealFitPortfolio || "—")}</p>
        <p style="font-size: 0.875rem; color: var(--ink2); margin-top: 0.5rem;">Deal Fit is reported beside the score and never blended into it.</p>
      </div>

      ${flags.length > 0 ? `
        <div class="detail-section">
          <h3>Flags</h3>
          <div>
            ${flags.map(f => `<span class="flag">${esc(f)}</span>`).join('')}
          </div>
        </div>
      ` : ''}

      ${d.whyThisOne ? `
        <div class="detail-section">
          <h3>Why This One</h3>
          <p>${esc(d.whyThisOne)}</p>
        </div>
      ` : ''}

      ${d.thesis ? `
        <div class="detail-section">
          <h3>Thesis</h3>
          <p>${esc(d.thesis)}</p>
        </div>
      ` : ''}

      ${d.unknowns ? `
        <div class="detail-section">
          <h3>Unknowns</h3>
          <p>${esc(d.unknowns)}</p>
        </div>
      ` : ''}

      ${d.watchTrigger ? `
        <div class="detail-section">
          <h3>Watch Trigger</h3>
          <p>${esc(d.watchTrigger)}</p>
        </div>
      ` : ''}

      ${d.keyPeople ? `
        <div class="detail-section">
          <h3>Key People</h3>
          <p>${esc(d.keyPeople)}</p>
        </div>
      ` : ''}

      ${d.lastRaise ? `
        <div class="detail-section">
          <h3>Last Raise</h3>
          <p>${esc(d.lastRaise)}</p>
        </div>
      ` : ''}

      ${d.bottleneck ? `
        <div class="detail-section">
          <h3>Bottleneck</h3>
          <p>${esc(d.bottleneck)}</p>
        </div>
      ` : ''}

      ${d.humanIntuition ? `
        <div class="detail-section">
          <h3>Human Intuition</h3>
          <p>${esc(d.humanIntuition)}</p>
          <p style="font-size: 0.875rem; color: var(--ink2); margin-top: 0.5rem;">This field is shown only if a named partner recorded a value. The app never writes to Notion.</p>
        </div>
      ` : ''}

      <div class="detail-section">
        <h3>Metadata</h3>
        <p><strong>Methodology version:</strong> ${esc(d.methodologyVersion || "—")}</p>
        <p><strong>Score status:</strong> ${esc(d.scoreStatus || "—")}</p>
        <p><strong>Graded by:</strong> ${esc(d.gradedBy || "—")}</p>
        <p><strong>Grade date:</strong> ${esc(d.gradeDate || "—")}</p>
        <p><strong>Data confidence:</strong> ${esc(d.dataConfidence || "—")}</p>
      </div>
    `;

    panel.innerHTML = html;
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  await loadData();
  renderTabs();
  renderScoutResults();
  renderGrades();
})();
