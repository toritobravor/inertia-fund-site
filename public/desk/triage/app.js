window.__DESK_MODE__='site';
(function(){
const MODE = window.__DESK_MODE__ || "artifact";   // "site" (login, per-user API) or "artifact" (claude.ai shared db, typed name)
const DATA = window.__GRADES__ || JSON.parse(document.getElementById('data').textContent);
const AX = [["P","Physics retired",22],["D","Path to first unit",20],["R","Rate of progress",15],["T","Team that has built",15],["B","Buyer and license",18],["K","Capital position",10]];
const ORDER = {SITE:0,DIVE:1,WATCH:2,STOP:3};
const STEP = ["STOP","WATCH","DIVE","SITE"];
const byId = Object.fromEntries(DATA.map(d=>[d.id,d]));
let reads = {};            // id -> { userKey -> read doc }
let me = null;             // {user, name, role}
let filter = "ALL", query = "", current = null;
let store = null, storeNote = "";

// ---------- helpers
const esc = s => String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmt = n => n==null ? "—" : n.toFixed(1);
const slug = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,40) || "reader";
function gateStop(d){ return d.status!=="scored" || d.floor; }
function readsFor(d){ return Object.values(reads[d.id]||{}).sort((a,b)=>String(b.savedAt||"").localeCompare(String(a.savedAt||""))); }
// The read that governs the card: the most recent read by a partner. Experts' reads are advisory and shown beside it.
function governing(d){ const rs=readsFor(d); return rs.find(r=>r.role==="partner") || null; }
function applyRead(d, r){
  const card = d.action;
  if(!r || r.score==null) return {action:card, why:"No partner read yet."};
  const s = r.score;
  if(gateStop(d) && s>0) return {action:card, why:"A gate, the graveyard or a hard floor holds this at STOP. A read cannot move it."};
  let i = STEP.indexOf(card), n = i, why = "The read confirms the card.";
  if(s===2 && i<3){ n=i+1; why="A +2 moves the card one step up."; }
  else if(s===-2 && i>0){ n=i-1; why="A −2 moves the card one step down."; }
  else if(s===1){
    if(card==="WATCH" && d.composite>=61 && d.fours>=2){ n=2; why="A +1 breaks the tie: within three points of 64 and the shape rule is met."; }
    else if(card==="DIVE" && d.composite>=75){ n=3; why="A +1 breaks the tie: within three points of 78."; }
    else why="A +1 is recorded. It moves the action only when the composite sits within three points of a line.";
  } else if(s===-1){
    if(card==="DIVE" && d.composite<67){ n=1; why="A −1 breaks the tie: within three points of 64."; }
    else if(card==="SITE" && d.composite<81){ n=2; why="A −1 breaks the tie: within three points of 78."; }
    else why="A −1 is recorded. It moves the action only when the composite sits within three points of a line.";
  }
  return {action:STEP[n], why};
}
function finalAction(d){ return applyRead(d, governing(d)); }

// ---------- snowflake (deviation from 3)
function flake(d){
  const s = d.scores; const W=380,H=320,cx=190,cy=160,R=110; const n=6; const ang=i=>(-90+i*60)*Math.PI/180;
  const pt=(i,rad)=>[cx+rad*Math.cos(ang(i)), cy+rad*Math.sin(ang(i))];
  let g="";
  for(let k=1;k<=5;k++){ const rad=R*k/5; const poly=[...Array(n)].map((_,i)=>pt(i,rad).join(",")).join(" ");
    g+=`<polygon points="${poly}" fill="none" stroke="var(--hair)" stroke-width="${k===3?1.4:0.8}" ${k===3?'stroke-dasharray="4 3"':''}/>`; }
  for(let i=0;i<n;i++){ const [x,y]=pt(i,R); g+=`<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--hair)" stroke-width=".8"/>`; }
  let shape="";
  if(s){ const poly=AX.map((a,i)=>pt(i, R*Math.max(0.5,s[a[0]])/5).join(",")).join(" ");
    shape=`<polygon points="${poly}" fill="var(--arc)" fill-opacity=".14" stroke="var(--arc)" stroke-width="1.6" stroke-linejoin="round"/>`;
    shape+=AX.map((a,i)=>{const [x,y]=pt(i,R*Math.max(0.5,s[a[0]])/5); return `<circle cx="${x}" cy="${y}" r="3" fill="var(--arc)"/>`;}).join(""); }
  const labels=AX.map((a,i)=>{ const [x,y]=pt(i,R+22); const anchor = Math.abs(x-cx)<8?"middle":(x>cx?"start":"end");
    const v = s? s[a[0]] : "—"; return `<text x="${x}" y="${y+4}" text-anchor="${anchor}" font-family="var(--mono)" font-size="10.5" fill="var(--ink3)">${a[1].split(" ")[0].toUpperCase()} <tspan fill="var(--ink)" font-weight="500">${v}</tspan></text>`; }).join("");
  const g0=governing(d);
  const readLine = g0 ? `Partner read: ${g0.score>0?"+":""}${g0.score} · ${esc(g0.by)} · ${esc(g0.date)}` : "Partner read: not yet recorded";
  return `<div class="flake"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Snowflake of six axis scores as deviation from 3">${g}${shape}${labels}</svg>
    <div class="src">Dashed ring = 3 on every axis. Outside is a strength, inside a weakness.<br>Inertia Fund judgment · v2 grader · 7 Sept 2026<br>${readLine}</div></div>`;
}

// ---------- links block
function linksBlock(d){
  const L=d.links||{}; const items=[];
  if(L.website) items.push(`<a class="lk" href="${esc(L.website)}" target="_blank" rel="noopener"><b>Website</b>${esc(L.website.replace(/^https?:\/\/(www\.)?/,"").replace(/\/$/,""))}</a>`);
  if(L.linkedin_company) items.push(`<a class="lk" href="${esc(L.linkedin_company)}" target="_blank" rel="noopener"><b>LinkedIn</b>company page</a>`);
  (L.linkedin_people||[]).forEach(p=>items.push(`<a class="lk" href="${esc(p.url)}" target="_blank" rel="noopener"><b>LinkedIn</b>${esc(p.name)}${p.role?` · ${esc(p.role)}`:""}</a>`));
  (L.x||[]).forEach(p=>items.push(`<a class="lk" href="${esc(p.url)}" target="_blank" rel="noopener"><b>X</b>${esc(p.handle||p.url)}${p.who&&p.who!=="company"?` · ${esc(p.who)}`:""}</a>`));
  (L.other||[]).forEach(p=>items.push(`<a class="lk" href="${esc(p.url)}" target="_blank" rel="noopener"><b>${esc(p.label||"Link")}</b>${esc(p.url.replace(/^https?:\/\/(www\.)?/,"").slice(0,48))}</a>`));
  const missing=[]; if(!L.website) missing.push("website"); if(!L.linkedin_company) missing.push("company LinkedIn"); if(!(L.linkedin_people||[]).length) missing.push("leader profiles"); if(!(L.x||[]).length) missing.push("X account");
  return `<section class="blk"><h3>Public presence</h3>
    ${items.length?`<div class="links">${items.join("")}</div>`:`<div class="note">Nothing found in the public-links pass.</div>`}
    <div class="note small">${missing.length?`Not found in the ${esc(L.checked||"")} pass: ${missing.join(", ")}. `:""}${esc(L.note||"")} Only links seen in a search result or on the company's own site are listed; nothing is guessed.</div>
  </section>`;
}

// ---------- list
function visible(){
  const q=query.trim().toLowerCase();
  return DATA.filter(d=>{
    const fa = finalAction(d).action;
    if(filter==="UNSCORED"){ if(d.status==="scored") return false; }
    else if(filter==="TOREAD"){ if(!(["DIVE","SITE"].includes(fa)) || readsFor(d).length) return false; }
    else if(filter!=="ALL" && fa!==filter) return false;
    if(q && !(d.name+" "+d.sector+" "+d.country).toLowerCase().includes(q)) return false;
    return true;
  }).sort((a,b)=>{ const fa=finalAction(a).action, fb=finalAction(b).action;
    if(ORDER[fa]!==ORDER[fb]) return ORDER[fa]-ORDER[fb];
    return (b.composite??-1)-(a.composite??-1) || a.name.localeCompare(b.name); });
}
function renderList(){
  const v=visible();
  document.getElementById('list').innerHTML = v.map(d=>{
    const fa=finalAction(d).action; const n=readsFor(d).length;
    const meta = d.status==="scored" ? `${d.sector} · ${d.stage_used}` : (d.status==="unscored"?"ticket incomplete":d.status==="graveyard"?"graveyard":"gate fail");
    return `<button class="row" role="option" data-id="${d.id}" aria-current="${current===d.id}">
      <span class="sc ${d.composite==null?'na':''}">${d.composite==null?"—":fmt(d.composite)}</span>
      <span><span class="nm">${esc(d.name)}${n?`<span class="read" title="${n} read${n>1?"s":""} recorded"></span>`:''}</span><span class="meta">${esc(meta)}</span></span>
      <span class="pill ${fa}">${fa}</span></button>`; }).join("") || `<div class="empty">Nothing matches.</div>`;
  document.querySelectorAll('.row').forEach(b=>b.addEventListener('click',()=>{ current=b.dataset.id; renderList(); renderMain(); }));
}
function renderChips(){
  const opts=[["ALL","All"],["SITE","Site"],["DIVE","Dive"],["WATCH","Watch"],["STOP","Stop"],["TOREAD","To read"],["UNSCORED","Unscored"]];
  document.getElementById('chips').innerHTML = opts.map(([k,l])=>`<button class="chip" data-f="${k}" aria-pressed="${filter===k}">${l}</button>`).join("");
  document.querySelectorAll('.chip').forEach(b=>b.addEventListener('click',()=>{ filter=b.dataset.f; renderChips(); renderList(); }));
}
function renderCounts(){
  const c={SITE:0,DIVE:0,WATCH:0,STOP:0}; let readN=0;
  DATA.forEach(d=>{ c[finalAction(d).action]++; if(readsFor(d).length) readN++; });
  document.getElementById('counts').innerHTML = `
    <div class="count"><b>${DATA.length}</b><span>Ticketed</span></div>
    <div class="count site"><b>${c.SITE}</b><span>Site</span></div>
    <div class="count dive"><b>${c.DIVE}</b><span>Dive</span></div>
    <div class="count watch"><b>${c.WATCH}</b><span>Watch</span></div>
    <div class="count"><b>${c.STOP}</b><span>Stop</span></div>
    <div class="count"><b>${readN}</b><span>With reads</span></div>`;
  const who=document.getElementById('who'); if(who) who.textContent = me ? `${me.name} · ${me.role}` : "";
}

// ---------- detail
function renderMain(){
  const d=byId[current]; const m=document.getElementById('main');
  if(!d){ m.innerHTML=`<div class="empty">Choose a company on the left.</div>`; return; }
  const fin=finalAction(d); const gov=governing(d); const all=readsFor(d);
  const mine = me ? (reads[d.id]||{})[me.user] : null;
  const gates = d.gate ? d.gate.map((ok,i)=>{ const names=["A 2025–26 physical break, with a dated figure","A technical or process path that uses it","A repeatable company, not a one-off plant","Capital still idea-to-first-unit"];
     return `<div class="gate ${ok?'ok':'no'}"><b>Q${i+1} · ${ok?'yes':'no'}</b>${names[i]}</div>`; }).join("") : `<div class="gate no"><b>Not run</b>The ticket is incomplete, so Gate 0 was not asked.</div>`;
  const axes = d.scores ? AX.map(a=>{ const v=d.scores[a[0]]; const low = ((a[0]==="P"||a[0]==="D") && v<2);
     return `<div class="axis"><span class="an">${a[1]}</span><span class="aw">w ${a[2]}</span><span class="as ${low?'low':''}">${v}</span><span class="bar"><i class="w${v} ${v>=4?'hi':''}"></i></span><span class="ev">${esc(d.evidence[a[0]]||"")}</span></div>`; }).join("") : "";
  const stageNote = d.stage!==d.stage_used ? ` <span title="Declared stage on the ticket">(ticket says ${esc(d.stage)})</span>` : "";
  const provisional = fin.action==="SITE" ? `<div class="warn">SITE is provisional: it needs the cost-floor answer and a second independent score within one point on Physics and Path before travel is spent.</div>` : "";
  const readsHtml = all.length ? `<div class="reads">${all.map(r=>{ const eff=applyRead(d,r); const isGov = gov && r===gov;
      return `<div class="rd ${isGov?'gov':''}"><div class="rdh"><span class="rs">${r.score>0?"+":""}${r.score}</span><span class="who">${esc(r.by)} · ${esc(r.role||"partner")} · ${esc(r.date)}</span>${isGov?`<span class="pill solid ${eff.action}">${eff.action}</span><span class="tag">governs the card</span>`:(r.role==="partner"?`<span class="tag">earlier partner read</span>`:`<span class="tag">advisory</span>`)}</div>
        <p><b>What I see that the card does not.</b> ${esc(r.see)}</p><p><b>What would prove me wrong.</b> ${esc(r.wrong)}</p>
        ${isGov?`<div class="status">${esc(eff.why)}</div>`:""}</div>`; }).join("")}</div>` : `<div class="note">No read recorded yet.</div>`;
  const identity = MODE==="site"
    ? (me ? `<div class="me">Recording as <b>${esc(me.name)}</b> (${esc(me.role)}). Reads are saved under your login; you can change only your own.</div>` : `<div class="warn">Not signed in.</div>`)
    : `<div><label for="by">Your name</label><input type="text" id="by" placeholder="Partner or expert, by name" value="${esc((me&&me.name)||'')}"></div>`;
  m.innerHTML = `
  <div class="head">
    <div>
      <div class="eyebrow">${esc(d.sector)} · ${esc(d.country)} · ${esc(d.stage_used)}${stageNote}</div>
      <h2>${esc(d.name)}</h2>
      <div class="kv"><span>Crowding ${esc(d.crowding)}</span><span>Origin review ${esc(d.origin)}</span>${d.links&&d.links.website?`<a href="${esc(d.links.website)}" target="_blank" rel="noopener">Website ↗</a>`:""}${d.source?`<a href="${esc(d.source)}" target="_blank" rel="noopener">Ticket source ↗</a>`:""}</div>
    </div>
    <div class="scoreblock">
      <div class="big">${d.composite==null?"—":fmt(d.composite)}<small> / 100</small></div>
      <div class="actions"><span class="eyebrow">Card</span><span class="pill ${d.action}">${d.action}</span>
        ${gov?`<span class="arrow">→</span><span class="eyebrow">Final</span><span class="pill solid ${fin.action}">${fin.action}</span>`:""}</div>
      <div class="status">Reason code · ${esc(d.action==="STOP"||d.action==="WATCH"?d.reason:"None")}</div>
    </div>
  </div>

  <section class="blk"><h3>The ticket</h3>
    <div class="ticket">
      <div><span class="eyebrow">What they sell</span>${esc(d.pursue)}</div>
      <div><span class="eyebrow">People</span>${esc(d.people)}</div>
      <div><span class="eyebrow">Financing</span>${esc(d.financing)}</div>
      <div><span class="eyebrow">Scout's viability note</span>${esc(d.viability)}</div>
    </div></section>

  ${linksBlock(d)}

  <section class="blk"><h3>Gate 0 and Gate 1</h3>
    <div class="gates">${gates}</div>
    <div class="note">${esc(d.gate_note)}</div>
    ${d.grave!=null?`<div class="note"><span class="eyebrow">Graveyard · ${d.grave?'hit':'clear'}</span><br>${esc(d.grave_note||"None of the five patterns applies.")}</div>`:""}
  </section>

  ${d.scores?`<section class="blk"><h3>Six axes</h3>
    <div class="axes"><div>${axes}</div>${flake(d)}</div>
    ${d.floor?`<div class="warn mt">Hard floor: Physics retired or Path to first unit is below 2. DIVE and SITE are blocked whatever the composite says.</div>`:""}
    ${d.action==="WATCH"&&d.composite>=64?`<div class="note">Composite clears 64 but fewer than two axes are at 4, so the shape rule holds it at WATCH.</div>`:""}
  </section>`:""}

  <section class="blk"><h3>The grader's read</h3>
    <p class="analysis">${esc(d.analysis)}</p>
    <div class="mods"><div class="mod"><b>What must be true in 90 days</b>${esc(d.wmbt)}</div></div>
  </section>

  <div class="hitl" id="hitl">
    <h3>Human intuition</h3>
    <p class="lead">Read the card above first, then record what you see: a number from −2 to +2 and two short paragraphs — what you see that the card does not, and what would prove you wrong. Every partner and expert records their own read under their own name. The most recent partner read governs the card; expert reads are advisory. AI systems never fill this field.</p>
    ${provisional}
    <h4 class="eyebrow">Reads on this company</h4>
    ${readsHtml}
    <h4 class="eyebrow mt18">${mine?"Your read (edit and record again to replace it)":"Your read"}</h4>
    <div class="grid">
      ${identity}
      <div><label>Your score</label><div class="scale" id="scale">
        ${[[-2,"I would not spend a day on this"],[-1,"Less here than the card shows"],[0,"The card is right"],[1,"More here than the card shows"],[2,"I have seen this shape win"]].map(([v,l])=>`<button type="button" data-v="${v}" aria-pressed="${mine&&mine.score===v}"><b>${v>0?"+":""}${v}</b><span>${l}</span></button>`).join("")}
      </div></div>
      <div><label for="see">What I see that the card does not</label><textarea id="see">${esc(mine?mine.see:"")}</textarea></div>
      <div><label for="wrong">What would prove me wrong</label><textarea id="wrong">${esc(mine?mine.wrong:"")}</textarea></div>
    </div>
    <div class="foot">
      <button class="btn" id="save" disabled>${mine?"Record the read again":"Record the read"}</button>
      ${mine?`<button class="btn ghost" id="clear">Withdraw my read</button>`:""}
      <span class="status" id="hstatus">${esc(storeNote)}</span>
    </div>
    ${gateStop(d)?`<div class="warn mt">This card is held at STOP by a gate, the graveyard or a hard floor. A read is still recorded and useful, but it cannot move the action.</div>`:""}
  </div>`;
  wireHitl(d, mine);
  window.scrollTo({top:0});
}
let pick=null;
function wireHitl(d, mine){
  pick = mine ? mine.score : null;
  const btns=[...document.querySelectorAll('#scale button')];
  const by=document.getElementById('by'), see=document.getElementById('see'), wrong=document.getElementById('wrong'), save=document.getElementById('save');
  function check(){ const nameOk = MODE==="site" ? !!me : (by && by.value.trim().length>1); save.disabled = !(pick!=null && nameOk && see.value.trim().length>20 && wrong.value.trim().length>20); }
  btns.forEach(b=>b.addEventListener('click',()=>{ pick=+b.dataset.v; btns.forEach(x=>x.setAttribute('aria-pressed',x===b)); check(); }));
  [by,see,wrong].filter(Boolean).forEach(el=>el.addEventListener('input',check));
  check();
  save.addEventListener('click',()=>{
    if(MODE!=="site"){ const nm=by.value.trim(); me={user:slug(nm), name:nm, role:"partner"}; try{ localStorage.setItem('if_reader', nm); }catch(e){} }
    saveRead(d,{score:pick,see:see.value.trim(),wrong:wrong.value.trim()});
  });
  const clr=document.getElementById('clear'); if(clr) clr.addEventListener('click',()=>clearRead(d));
}

// ---------- persistence
function today(){ return new Date().toISOString().slice(0,10); }
function buildDoc(d, v){
  const prev = (reads[d.id]||{})[me.user];
  const doc = {score:v.score, by:me.name, user:me.user, role:me.role, see:v.see, wrong:v.wrong, date:today(), savedAt:new Date().toISOString(),
               companyId:d.id, company:d.name, cardAction:d.action, composite:d.composite,
               history: prev&&prev.score!=null ? [{score:prev.score,date:prev.date}].concat(prev.history||[]).slice(0,10) : []};
  doc.impliedAction = applyRead(d, doc).action;
  return doc;
}
async function saveRead(d, v){
  const st=document.getElementById('hstatus'); st.textContent="Recording…";
  const doc=buildDoc(d, v);
  try{ await store.put(d, doc); reads[d.id]=reads[d.id]||{}; reads[d.id][me.user]=doc; st.textContent="Recorded."; renderAll(); }
  catch(e){ st.textContent="Could not record: "+(e&&e.message||e); }
}
async function clearRead(d){
  try{ await store.del(d); if(reads[d.id]) delete reads[d.id][me.user]; renderAll(); }
  catch(e){ document.getElementById('hstatus').textContent="Could not withdraw: "+(e&&e.message||e); }
}
function renderAll(){ renderCounts(); renderList(); renderMain(); }

// site store: per-user API behind the desk login
const siteStore = {
  async init(){
    const r = await fetch("/desk/api/me",{credentials:"same-origin",cache:"no-store"});
    if(r.status===401){ location.href="/desk/login?next="+encodeURIComponent(location.pathname); throw new Error("sign in"); }
    me = await r.json();
    const rr = await fetch("/desk/api/reads",{credentials:"same-origin",cache:"no-store"}); if(!rr.ok) throw new Error("HTTP "+rr.status);
    reads = await rr.json(); storeNote="Reads are shared with every partner who opens this page.";
    setInterval(async()=>{ try{ const x=await fetch("/desk/api/reads",{credentials:"same-origin",cache:"no-store"}); if(x.ok){ reads=await x.json(); renderCounts(); renderList(); } }catch(e){} }, 60000);
  },
  async put(d, doc){ const r=await fetch("/desk/api/reads/"+d.id,{method:"PUT",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(doc)}); if(!r.ok){ const e=await r.json().catch(()=>({})); throw new Error(e.error||("HTTP "+r.status)); } },
  async del(d){ const r=await fetch("/desk/api/reads/"+d.id,{method:"DELETE",credentials:"same-origin"}); if(!r.ok) throw new Error("HTTP "+r.status); }
};
// artifact store: claude.ai shared db; identity is the typed name
const artifactStore = {
  db:null,
  async init(){
    try{ const nm=localStorage.getItem('if_reader'); if(nm) me={user:slug(nm),name:nm,role:"partner"}; }catch(e){}
    this.db = (window.claude && window.claude.use) ? await window.claude.use("db") : null;
    if(this.db){
      storeNote="Reads are shared with everyone who opens this page.";
      this.db.collection("reads").onSnapshot(snap=>{ const next={}; snap.docs.forEach(s=>{ if(!s.exists) return; const v=s.data(); const cid=v.companyId||s.id; (next[cid]=next[cid]||{})[v.user||"reader"]=v; }); reads=next; renderAll(); },
        err=>{ storeNote="Live sharing stopped ("+err.code+")."; renderMain(); });
    } else {
      storeNote="Shared storage is not available in this view; reads stay in this browser.";
      DATA.forEach(d=>{ try{ const s=localStorage.getItem('if_reads_'+d.id); if(s) reads[d.id]=JSON.parse(s); }catch(e){} });
    }
  },
  async put(d, doc){ if(this.db){ await this.db.doc("reads/"+d.id+"__"+me.user).set(doc); } else { const m=reads[d.id]||{}; m[me.user]=doc; try{ localStorage.setItem('if_reads_'+d.id, JSON.stringify(m)); }catch(e){} } },
  async del(d){ if(this.db){ await this.db.doc("reads/"+d.id+"__"+me.user).delete(); } else { const m=reads[d.id]||{}; delete m[me.user]; try{ localStorage.setItem('if_reads_'+d.id, JSON.stringify(m)); }catch(e){} } }
};

// ---------- boot
document.getElementById('q').addEventListener('input',e=>{ query=e.target.value; renderList(); });
renderChips();
current = (DATA.slice().sort((a,b)=>ORDER[a.action]-ORDER[b.action]||(b.composite??-1)-(a.composite??-1))[0]||{}).id;
renderAll();
store = MODE==="site" ? siteStore : artifactStore;
store.init().then(renderAll).catch(e=>{ storeNote="Shared storage could not be reached ("+(e&&e.message||e)+")."; renderMain(); });
})();
