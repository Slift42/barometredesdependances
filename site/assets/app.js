/* Baromètre des dépendances — front statique, sans framework.
   Les données viennent de data/*.json (site) ou de window.BD_DATA (aperçu autonome). */
(function () {
"use strict";
const INF = Infinity;
const FILES = ["meta", "produits", "matrice", "atouts", "sources", "propositions", "bibliographie", "kii", "europe", "allies", "strategies", "chaines", "actus", "echeances", "zoom_armees"];
const LIVE = ["gaz", "electricite", "actus_auto", "veille_etat", "sources_etat"];
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const $ = id => document.getElementById(id);
const REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* stockage indisponible */ } }
};
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const num = x => String(x).replace(".", ",");

async function loadData() {
  if (window.BD_DATA) return window.BD_DATA;
  const out = {};
  await Promise.all(FILES.map(async f => {
    const r = await fetch(`data/${f}.json`, { cache: "no-cache" });
    if (!r.ok) throw new Error(`data/${f}.json : ${r.status}`);
    out[f] = await r.json();
  }));
  out.live = {};
  await Promise.all(LIVE.map(async f => {
    try { const r = await fetch(`data/live/${f}.json`, { cache: "no-cache" }); if (r.ok) out.live[f] = await r.json(); } catch (e) { /* pas encore collecté */ }
  }));
  return out;
}

/* ---------- petit message en bas d'écran ---------- */
let toastEl = null, toastT = 0;
function toast(msg) {
  if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "toast"; toastEl.setAttribute("role", "status"); document.body.appendChild(toastEl); }
  toastEl.textContent = msg; toastEl.classList.add("on");
  clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove("on"), 2200);
}

function init(D) {
  const META = D.meta, P = D.produits, LV = D.live || {};
  const LVL = n => META.niveaux[n].nom;
  const BIB = {}; (D.bibliographie || []).forEach(b => { BIB[b.id] = b; });
  const TYPES = { institution: "Institution", parlement: "Parlement", doctrine: "Leurs textes", expertise: "Expertise", programme: "Programme", donnees: "Données", comite: "Comité", presse: "Presse" };
  const year = d => String(d || "").slice(0, 4);
  function refLabel(id) {
    const b = BIB[id]; if (!b) return "";
    const lab = `${esc(b.auteur.split(" (")[0].split(",")[0])} (${esc(year(b.date))})`;
    return b.url ? `<a href="${esc(b.url)}" target="_blank" rel="noopener" title="${esc(b.titre)}">${lab}</a>` : `<span title="${esc(b.titre)}">${lab}</span>`;
  }
  const refList = ids => (ids && ids.length) ? `<span class="refs">Sources : ${ids.map(refLabel).filter(Boolean).join(" · ")}</span>` : "";
  const fmtD = s => new Date(String(s).slice(0, 10) + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const daysTo = s => Math.round((new Date(s + "T00:00:00") - today) / 86400000);
  $("majDate").textContent = fmtD(META.maj);

  /* ---------- niveaux ---------- */
  const byDays = d => d === INF ? 1 : d > 365 ? 2 : d > 90 ? 3 : d > 30 ? 4 : 5;
  function baseLevel(p) {
    if (p.cov !== undefined) return p.cov >= 100 ? 1 : p.cov >= 80 ? 2 : p.cov >= 50 ? 3 : (p.d !== undefined ? byDays(p.d) : 4);
    if (p.d === undefined) return 0;
    return byDays(p.d);
  }
  function level(p) {
    let b = baseLevel(p);
    if (b && p.l === 2 && b > 1 && b < 5) b++;
    return b;
  }
  const rated = p => p.d !== undefined || p.cov !== undefined;
  function valTxt(p) {
    const a = p.k === "est" ? "≈ " : "";
    if (p.cov !== undefined) return `${a}${p.cov} %`;
    if (p.d === undefined) return "à instruire";
    if (p.d === INF) return "Autonome";
    return `${a}${p.d} j`;
  }
  function explain(p) {
    const base = baseLevel(p); if (!base) return "";
    let t;
    if (p.cov !== undefined) t = `La France produit ${p.k === "est" ? "environ " : ""}${p.cov} % de ce qu'elle consomme : niveau <b>${LVL(base)}</b> (${esc(META.niveaux[base].desc)}).`;
    else if (p.d === INF) t = `Production nationale ou européenne excédentaire : niveau <b>${LVL(1)}</b>.`;
    else t = `${p.k === "est" ? "Environ " : ""}${p.d} jour${p.d > 1 ? "s" : ""} de tenue : niveau <b>${LVL(base)}</b> (${esc(META.niveaux[base].desc)}).`;
    if (p.l === 2 && base > 1 && base < 5) t += ` Le fournisseur s'est déjà servi de ce levier : on descend d'un cran, <b>${LVL(base + 1)}</b>.`;
    else if (p.l === 2) t += " Le fournisseur s'est déjà servi de ce levier.";
    return t;
  }

  /* ---------- normalisation + données en direct ---------- */
  const LIVE_NEWS = [];
  P.forEach((p, i) => {
    p.i = i;
    if (p.d === "auto") p.d = INF;
    if (p.live === "gaz" && LV.gaz) {
      const g = LV.gaz;
      p.d = Math.round(g.stock_twh / g.conso_moyenne_twh_j);
      p.k = "calc";
      p.src = `${g.source}, jour gazier du ${fmtD(g.jour_gazier)}`;
      p.note = `${num(g.stock_twh)} TWh stockés (${num(g.remplissage_pct)} % de remplissage). ` + (p.note || "");
      p.isLive = true;
      LIVE_NEWS.push({ d: g.jour_gazier, titre: `Stocks de gaz remplis à ${num(g.remplissage_pct)} %`, texte: `Soit environ ${p.d} jours de consommation moyenne si plus rien n'entrait. Relevé automatique.`, produits: [p.id], effet: "surveille", url: g.url, source: g.source, live: true });
    }
    p.lv = level(p);
    p.key = norm(`${p.n} ${p.id} ${META.familles[p.f] || ""} ${(p.h || []).map(h => META.detenteurs[h] || h).join(" ")}`);
  });
  const inst = P.filter(rated);
  const byId = {}; P.forEach(p => { byId[p.id] = p; });

  /* ---------- toutes les actus : vérifiées + détections automatiques ---------- */
  const NEWS = [];
  (D.actus || []).forEach(a => NEWS.push(Object.assign({ verif: true }, a)));
  LIVE_NEWS.forEach(a => NEWS.push(a));
  const auto = (LV.actus_auto && LV.actus_auto.items) || [];
  auto.forEach(a => NEWS.push({ d: a.d, titre: a.titre, texte: a.resume_ia || "", ia: !!a.resume_ia, produits: a.produits || [], effet: "auto", url: a.url, source: a.source, auto: true }));
  NEWS.sort((a, b) => String(b.d).localeCompare(String(a.d)));

  /* ---------- cadran ---------- */
  (function dial() {
    const svg = $("dial"), NS = "http://www.w3.org/2000/svg";
    const cx = 180, cy = 176, r = 120;
    const pt = (a, rr) => [cx + rr * Math.cos(a * Math.PI / 180), cy - rr * Math.sin(a * Math.PI / 180)];
    const el = (t, a, parent) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); (parent || svg).appendChild(e); return e; };
    [5, 4, 3, 2, 1].forEach((l, j) => {
      const a0 = 180 - j * 36, a1 = a0 - 36;
      const [x0, y0] = pt(a0 - 0.8, r), [x1, y1] = pt(a1 + 0.8, r);
      el("path", { d: `M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}`, fill: "none", style: `stroke:var(--l${l})`, "stroke-width": 20 });
      const words = LVL(l).toUpperCase().split(" ");
      const mid = (a0 + a1) / 2, side = mid < 40 ? "start" : mid > 140 ? "end" : "middle";
      const [lx, ly] = pt(mid, side === "middle" ? r + 26 : r + 18);
      const t = el("text", { x: lx, y: ly + 4 - (words.length - 1) * 6, "text-anchor": side, style: "fill:var(--ink-2);font-family:var(--f-mono);font-size:10px;letter-spacing:.06em" });
      words.forEach((w, k) => { const s = document.createElementNS(NS, "tspan"); s.setAttribute("x", lx); if (k) s.setAttribute("dy", "12"); s.textContent = w; t.appendChild(s); });
    });
    for (let a = 0; a <= 180; a += 6) {
      const long = a % 36 === 0, [x0, y0] = pt(a, r - 14), [x1, y1] = pt(a, r - (long ? 30 : 21));
      el("line", { x1: x0, y1: y0, x2: x1, y2: y1, style: "stroke:var(--brass)", "stroke-width": long ? 2 : 1 });
    }
    const avg = inst.reduce((s, p) => s + p.lv, 0) / Math.max(1, inst.length);
    const ang = 18 + (avg - 1) * 36;
    // aiguille dessinée vers la droite (angle 0), puis tournée : part de « totalement dépendant » et vient se poser
    const g = el("g", { id: "needle" });
    el("line", { x1: cx - 18, y1: cy, x2: cx + r - 26, y2: cy, style: "stroke:var(--ink)", "stroke-width": 3, "stroke-linecap": "round" }, g);
    g.style.transformOrigin = `${cx}px ${cy}px`; g.style.transformBox = "view-box";
    if (REDUCED) g.style.transform = `rotate(${-ang}deg)`;
    else { g.style.transform = "rotate(-180deg)"; requestAnimationFrame(() => requestAnimationFrame(() => { g.style.transform = `rotate(${-ang}deg)`; })); }
    el("circle", { cx, cy, r: 9, style: "fill:var(--brass)" });
    el("circle", { cx, cy, r: 3.5, style: "fill:var(--surface)" });
    const state = Math.round(avg);
    const v = $("dialVal"); v.textContent = LVL(state); v.style.color = `var(--l${state})`;
    $("dialNote").textContent = `C'est la moyenne des ${inst.length} produits notés : ${num(avg.toFixed(1))} sur une échelle qui va de 1 (souverain) à 5 (totalement dépendant). L'aiguille bouge quand les stocks ou les fournisseurs bougent.`;
  })();

  /* ---------- chiffres clés ---------- */
  (function kpis() {
    const under = inst.filter(p => p.lv >= 4).length;
    const act = inst.filter(p => p.l === 2).length;
    const next = (D.echeances || []).filter(e => !e.approx && daysTo(e.d) >= 0).sort((a, b) => a.d.localeCompare(b.d))[0];
    let cd = "";
    if (next) {
      const n = daysTo(next.d);
      cd = `<div class="kpi countdown"><span class="n">${n ? "J-" + n : "Jour J"}</span><span class="t">${esc(next.titre)}, le ${fmtD(next.d)}.</span></div>`;
    }
    $("kpis").innerHTML = `
      <div class="kpi"><span class="n"><span data-count="${inst.length}">${inst.length}</span><small> / 100</small></span><span class="t">produits vitaux notés, un par un</span></div>
      <div class="kpi"><span class="n" style="color:var(--l5)"><span data-count="${under}">${under}</span></span><span class="t">sous la ligne de flottaison : dépendants ou totalement dépendants</span></div>
      <div class="kpi"><span class="n"><span data-count="${act}">${act}</span></span><span class="t">robinets déjà fermés, au moins une fois, contre la France ou l'Europe</span></div>
      <div class="kpi"><span class="n"><span data-count="54">54</span><small> Md€</small></span><span class="t">versés chaque année aux clouds et logiciels américains</span></div>
      ${cd}`;
    if (REDUCED) return;
    document.querySelectorAll("#kpis [data-count]").forEach(s => {
      const to = +s.dataset.count, t0 = performance.now(), dur = 1100;
      const step = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); s.textContent = Math.round(to * e); if (k < 1) requestAnimationFrame(step); };
      s.textContent = "0"; requestAnimationFrame(step);
    });
  })();

  /* ---------- le mur, la ligne, filtres et recherche ---------- */
  const FAM = META.familles;
  let fam = store.get("bd-fam") || "all";
  if (fam !== "all" && !FAM[fam]) fam = "all";
  let query = "";
  const visible = p => (fam === "all" || p.f === fam) && (!query || p.key.includes(query));
  const chips = $("famChips");
  function renderChips() {
    const opts = [["all", "Tous"], ...Object.entries(FAM)];
    chips.innerHTML = opts.map(([k, v]) => {
      const n = k === "all" ? P.length : P.filter(p => p.f === k).length;
      return `<button type="button" class="chip" data-f="${k}" aria-pressed="${k === fam}">${esc(v)} <span style="opacity:.6">${n}</span></button>`;
    }).join("");
  }
  function setFam(f) { fam = f; store.set("bd-fam", fam); renderChips(); applyFilter(); renderLine(); }
  chips.addEventListener("click", e => { const b = e.target.closest(".chip"); if (b) setFam(b.dataset.f); });

  function renderWall() {
    $("wall").innerHTML = P.map((p, k) => {
      const lev = p.l === 2 ? `<span class="bolt" title="Levier déjà activé"></span>` : "";
      const a = p.k === "est" ? "≈" : "";
      const d = !rated(p) ? "à instruire" : p.cov !== undefined ? `${a}${p.cov}<small>%</small>` : p.d === INF ? "Auto." : `${a}${p.d}<small>j</small>`;
      return `<div class="tile-wrap"><button type="button" class="tile lv${p.lv}" style="--i:${k}" data-i="${p.i}" aria-label="${esc(p.n)} : ${esc(valTxt(p))}, ${p.lv ? esc(LVL(p.lv)) : "à instruire"}">${lev}<span class="nm">${esc(p.n)}</span><span class="dy">${d}</span></button></div>`;
    }).join("");
  }
  function applyFilter() {
    document.querySelectorAll("#wall .tile").forEach(t => {
      const p = P[+t.dataset.i];
      const on = visible(p);
      t.classList.toggle("dim", !on);
      t.classList.toggle("hit", !!query && on);
    });
  }

  const LOGMAX = Math.log10(1000);
  const pos = d => d === INF ? 100 : Math.max(0, Math.min(100, Math.log10(Math.max(d, 1)) / LOGMAX * 100));
  const THR = pos(META.seuil_jours);
  function row(p, w, thr) {
    return `<div class="frow" data-i="${p.i}" role="button" tabindex="0" aria-label="${esc(p.n)} : ${esc(valTxt(p))}"><span class="fname">${p.isLive ? '<span class="live-dot" title="Donnée en direct"></span>' : ""}${esc(p.n)} <span class="hc">${(p.h || []).join(" · ")}</span></span><div class="track" style="--thr:${thr}%"><div class="bar${p.k === "est" ? " est" : ""}" style="width:${w}%;background-color:var(--l${p.lv})"></div><span class="thr"></span></div><span class="fval">${esc(valTxt(p))}</span></div>`;
  }
  function renderLine() {
    const ticks = [[1, "1 j"], [7, "7"], [30, "30"], [90, "90"], [365, "1 an"], [1000, "1000+"]];
    $("axis").innerHTML =
      `<span class="cap">produit · qui tient le robinet</span><div class="ticks">${ticks.map(([d, l]) => `<span style="left:${pos(d)}%;${d === 1 ? "transform:none" : d === 1000 ? "transform:translateX(-100%)" : ""}">${l}</span>`).join("")}<span class="thr-l" style="left:${THR}%">seuil proposé : ${META.seuil_jours} jours</span></div><span class="cap" style="text-align:right">tenue</span>`;
    const L = inst.filter(visible);
    const days = L.filter(p => p.cov === undefined).sort((a, b) => (a.d === INF ? 1e9 : a.d) - (b.d === INF ? 1e9 : b.d));
    const cov = L.filter(p => p.cov !== undefined).sort((a, b) => a.cov - b.cov);
    let h = days.map(p => row(p, p.d === 0 ? 0 : pos(p.d), THR)).join("");
    if (cov.length) h += `<div class="cov-sep">Part des besoins couverts par la production française · le trait marque 100 %</div>` + cov.map(p => row(p, Math.min(100, p.cov / 2), 50)).join("");
    $("rows").innerHTML = h || `<p class="loading">Rien ne correspond. Essayez un autre mot ou une autre famille.</p>`;
  }
  const vWall = $("vWall"), vLine = $("vLine");
  function setView(v) {
    vWall.setAttribute("aria-pressed", v === "wall"); vLine.setAttribute("aria-pressed", v === "line");
    $("wallView").hidden = v !== "wall"; $("lineView").hidden = v !== "line";
    store.set("bd-view", v);
  }
  vWall.onclick = () => setView("wall"); vLine.onclick = () => setView("line");

  const qEl = $("q");
  qEl.addEventListener("input", () => { query = norm(qEl.value.trim()); applyFilter(); renderLine(); });
  qEl.addEventListener("keydown", e => {
    if (e.key === "Enter") { const p = P.find(visible); if (p && query) { e.preventDefault(); openSheet(p.i); } }
    if (e.key === "Escape") { qEl.value = ""; query = ""; applyFilter(); renderLine(); }
  });
  const focusSearch = () => { $("test").scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" }); setTimeout(() => qEl.focus({ preventScroll: true }), REDUCED ? 0 : 450); };
  $("searchBtn").onclick = focusSearch;

  $("legend").innerHTML =
    [5, 4, 3, 2, 1].map(l => `<span><i class="sw" style="background:var(--l${l})"></i>${LVL(l)}</span>`).join("") +
    `<span><i class="sw" style="background:var(--ink-2);border-radius:50%;width:9px;height:9px"></i>Levier déjà activé</span><span>« j » jours de tenue · « % » part des besoins couverts en France · « ≈ » estimation, barres hachurées</span>`;

  /* ---------- fiche ---------- */
  const sheet = $("sheet"), scrim = $("scrim");
  let lastFocus = null, cur = -1;
  function alliances(p) {
    if (!p.al || !p.al.length) return `<div class="alli"><h4>Avec qui faire autrement</h4><div class="al red"><p>${esc(META.pistes_alliance[p.f])}</p></div></div>`;
    return `<div class="alli"><h4>Avec qui faire autrement</h4>` + p.al.map(a => {
      const co = a.type === "codependance";
      return `<div class="al ${co ? "co" : "red"}"><span class="ty">${co ? "Co-dépendance : on se tient mutuellement" : "Redondance : plusieurs fournisseurs plutôt qu'un"}</span><div class="pays">${a.pays.map(x => `<span>${esc(x)}</span>`).join("")}</div><p>${esc(a.txt)}</p></div>`;
    }).join("") + `</div>`;
  }
  function related(p) {
    const L = NEWS.filter(a => (a.produits || []).includes(p.id)).slice(0, 4);
    if (!L.length) return "";
    return `<div class="rel"><h4>Ce qui a bougé récemment</h4><ul>${L.map(a => `<li><time datetime="${esc(a.d)}">${fmtD(a.d)}</time>${a.url ? `<a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.titre)}</a>` : esc(a.titre)}${a.auto ? ' <span class="badge">à vérifier</span>' : ""}</li>`).join("")}</ul></div>`;
  }
  const order = () => { const L = P.filter(visible); return L.length ? L : P; };
  function openSheet(i) {
    const p = P[i]; if (!p) return;
    if (!sheet.classList.contains("on")) lastFocus = document.activeElement;
    cur = i;
    const lvl = p.lv ? `<span class="lvpill" style="background:var(--l${p.lv});color:var(--on-l${p.lv})">${LVL(p.lv)}</span>` : `<span class="badge">À instruire</span>`;
    let body;
    if (!rated(p)) {
      body = `<p style="margin-top:16px">Ce produit fait partie des cent, mais on n'a pas encore assez de chiffres pour le noter.</p>
        <dl class="facts"><div><dt>Où chercher</dt><dd>${esc(META.sources_a_mobiliser[p.f])}</dd></div></dl>` + alliances(p);
    } else {
      let big;
      if (p.cov !== undefined) big = `<span class="d">${p.k === "est" ? "≈ " : ""}${p.cov} %</span><span class="u">de nos besoins couverts par ce qu'on produit en France</span>`;
      else if (p.d === INF) big = `<span class="d">Autonome</span><span class="u">on produit plus qu'on ne consomme</span>`;
      else big = `<span class="d">${p.k === "est" ? "≈ " : ""}${p.d}</span><span class="u">jours de tenue si plus rien n'entre</span>`;
      body = `<div class="big">${big}</div><span class="badge">${p.isLive ? '<span class="live-dot"></span>' : ""}${esc(META.natures[p.k])}</span>
        ${p.gens ? `<div class="gens"><h4>Ce que ça change pour les gens</h4><p>${esc(p.gens)}</p></div>` : ""}
        <dl class="facts">
          <div><dt>Qui tient le robinet</dt><dd>${(p.h || []).map(h => esc(META.detenteurs[h] || h)).join(", ")}</dd></div>
          <div><dt>Notre dépendance</dt><dd>${esc(p.dep)}</dd></div>
          ${p.conc ? `<div><dt>Dans le monde</dt><dd>${esc(p.conc)}</dd></div>` : ""}
          <div><dt>Levier</dt><dd>${esc(META.leviers[p.l])}</dd></div>
          ${p.note ? `<div><dt>À savoir</dt><dd>${esc(p.note)}</dd></div>` : ""}
          <div><dt>D'où vient le chiffre</dt><dd>${esc(p.src)}</dd></div>
        </dl>
        <div class="why"><h4>Pourquoi cette note</h4><p class="rule">${explain(p)}</p>${p.pourquoi ? `<p>${esc(p.pourquoi)}</p>` : ""}${refList(p.refs)}</div>` + alliances(p) +
        (META.mesures[p.m] ? `<div class="mesure"><b>Ce que nous proposons</b>${esc(META.mesures[p.m])}</div>` : "") + related(p);
    }
    const L = order(), k = L.indexOf(p);
    sheet.innerHTML = `<div class="sheet-bar">
        <button type="button" class="sbtn" data-act="prev" aria-label="Produit précédent" title="Précédent (←)">←</button>
        <button type="button" class="sbtn" data-act="next" aria-label="Produit suivant" title="Suivant (→)">→</button>
        <button type="button" class="sbtn" data-act="link" title="Copier le lien de cette fiche">Copier le lien</button>
        <span class="sp"></span>
        <button type="button" class="sbtn" data-act="close" aria-label="Fermer la fiche" title="Fermer (Échap)">×</button></div>
      <div class="eyebrow">${esc(FAM[p.f])} · ${k >= 0 ? k + 1 : p.i + 1} / ${L.length}</div>
      <h3 id="shTitle">${esc(p.n)}</h3>${lvl}${body}`;
    sheet.scrollTop = 0;
    sheet.classList.add("on"); sheet.setAttribute("aria-hidden", "false"); scrim.classList.add("on");
    document.documentElement.style.overflow = "hidden";
    const c = sheet.querySelector('[data-act="close"]'); if (c) c.focus({ preventScroll: true });
    if (p.id) { try { history.replaceState(null, "", "#" + p.id); } catch (e) { /* cadre restreint */ } }
  }
  function step(dir) {
    const L = order(); if (!L.length) return;
    let k = L.indexOf(P[cur]); k = k < 0 ? 0 : (k + dir + L.length) % L.length;
    openSheet(L[k].i);
  }
  function closeSheet() {
    if (!sheet.classList.contains("on")) return;
    sheet.classList.remove("on"); sheet.setAttribute("aria-hidden", "true"); scrim.classList.remove("on");
    document.documentElement.style.overflow = "";
    cur = -1;
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    if (location.hash) { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* cadre restreint */ } }
  }
  sheet.addEventListener("click", e => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const a = b.dataset.act;
    if (a === "close") closeSheet();
    else if (a === "prev") step(-1);
    else if (a === "next") step(1);
    else if (a === "link") {
      const url = location.href.split("#")[0] + "#" + P[cur].id;
      const ok = () => toast("Lien copié : collez-le où vous voulez.");
      try { navigator.clipboard.writeText(url).then(ok, () => toast(url)); } catch (err) { toast(url); }
    }
  });
  scrim.onclick = closeSheet;
  document.addEventListener("keydown", e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || "");
    if (sheet.classList.contains("on")) {
      if (e.key === "Escape") { e.preventDefault(); closeSheet(); }
      else if (!typing && e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
      else if (!typing && e.key === "ArrowRight") { e.preventDefault(); step(1); }
      return;
    }
    if (!typing && e.key === "/" && !e.ctrlKey && !e.metaKey) { e.preventDefault(); focusSearch(); }
  });
  $("wall").addEventListener("click", e => { const t = e.target.closest(".tile"); if (t) openSheet(+t.dataset.i); });
  const rowsEl = $("rows");
  rowsEl.addEventListener("click", e => { const t = e.target.closest(".frow"); if (t) openSheet(+t.dataset.i); });
  rowsEl.addEventListener("keydown", e => { const t = e.target.closest(".frow"); if (t && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openSheet(+t.dataset.i); } });
  // tout élément portant data-open="identifiant" ouvre la fiche correspondante (actus, chaînes…)
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-open]"); if (!t) return;
    const p = byId[t.dataset.open]; if (p) { e.preventDefault(); openSheet(p.i); }
  });

  /* ---------- baromètre détaillé ---------- */
  const stack = (ps, scale) => [1, 2, 3, 4, 5].map(l => { const n = ps.filter(p => p.lv === l).length; return n ? `<i style="width:${n / scale * 100}%;background:var(--l${l})" title="${LVL(l)} : ${n}"></i>` : ""; }).join("");
  $("famBars").innerHTML = Object.entries(FAM).map(([k, v]) => {
    const ps = P.filter(p => p.f === k && p.lv), bad = ps.filter(p => p.lv >= 4).length;
    return `<div class="hbar" role="button" tabindex="0" data-f="${k}" title="Voir ${esc(v)} dans le mur"><span class="lab">${esc(v)}</span><span class="stack">${stack(ps, ps.length || 1)}</span><span class="num"><span class="act">${bad}</span>/${ps.length}</span></div>`;
  }).join("") + `<p class="hint" style="margin-top:8px">En rouge, le nombre de produits dépendants ou totalement dépendants dans la famille.</p>`;
  const famGo = e => { const b = e.target.closest(".hbar[data-f]"); if (!b) return; if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return; e.preventDefault(); setFam(b.dataset.f); setView("wall"); $("test").scrollIntoView({ behavior: REDUCED ? "auto" : "smooth" }); };
  $("famBars").addEventListener("click", famGo); $("famBars").addEventListener("keydown", famGo);

  (function holders() {
    const cnt = {};
    inst.forEach(p => (p.h || []).forEach(h => { if (h === "FR" || h === "DIV" || h === "EU") return; (cnt[h] = cnt[h] || []).push(p); }));
    const top = Object.entries(cnt).sort((a, b) => b[1].length - a[1].length).slice(0, 10);
    const max = top.length ? top[0][1].length : 1;
    $("holderBars").innerHTML = top.map(([h, ps]) => `<div class="hbar" role="button" tabindex="0" data-h="${esc(META.detenteurs[h] || h)}" title="Chercher ces produits dans le mur"><span class="lab">${esc(META.detenteurs[h] || h)}</span><span class="stack" style="background:transparent">${stack(ps, max)}</span><span class="num">${ps.length}</span></div>`).join("");
    const go = e => { const b = e.target.closest(".hbar[data-h]"); if (!b) return; if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return; e.preventDefault(); qEl.value = b.dataset.h; query = norm(b.dataset.h); setFam("all"); setView("wall"); $("test").scrollIntoView({ behavior: REDUCED ? "auto" : "smooth" }); };
    $("holderBars").addEventListener("click", go); $("holderBars").addEventListener("keydown", go);
  })();

  if (D.chaines && D.chaines.length) {
    let ch = store.get("bd-chain"); if (!D.chaines.some(c => c.id === ch)) ch = D.chaines[0].id;
    const renderChain = () => {
      $("chainTabs").innerHTML = D.chaines.map(c => `<button type="button" data-c="${esc(c.id)}" aria-pressed="${c.id === ch}">${esc(c.titre)}</button>`).join("");
      const C = D.chaines.find(c => c.id === ch);
      const pr = byId[C.produit];
      $("chainBody").innerHTML = `<p class="chain-intro">${esc(C.intro)}${pr ? ` <a href="#${esc(pr.id)}" data-open="${esc(pr.id)}">Voir la fiche « ${esc(pr.n)} »</a>` : ""}</p><div class="chain">` +
        C.etapes.map((s, k) => `${k ? '<span class="arrow" aria-hidden="true"></span>' : ""}<div class="link"><div class="stage" style="--i:${k};border-top-color:var(--l${s.lv || 3})"><span class="sn">${k + 1}. ${esc(s.nom)}</span><span class="sq">${esc(s.qui)}</span><span class="sp">${esc(s.part)}</span>${refList(s.refs)}</div></div>`).join("") + `</div>`;
    };
    $("chainTabs").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; ch = b.dataset.c; store.set("bd-chain", ch); renderChain(); });
    renderChain();
  }

  if (D.zoom_armees) {
    const Z = D.zoom_armees;
    $("zoomTitle").textContent = Z.titre; $("zoomIntro").textContent = Z.intro;
    $("zoomList").innerHTML = Z.items.map(x => `<li><i style="background:var(--l${x.lv})" title="${LVL(x.lv)}"></i><div><b>${esc(x.quoi)}</b>${esc(x.constat)}</div></li>`).join("");
    $("zoomRefs").innerHTML = refList(Z.refs);
  }
  $("assets").innerHTML = D.atouts.map(([a, b]) => `<div class="asset"><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join("");

  /* ---------- stratégies + leviers assumés (KII), puissance partagée ---------- */
  const K = D.kii, S = D.strategies;
  let pw = store.get("bd-kii") || (K ? K.puissances[0].code : "CN");
  if (K && !K.puissances.some(x => x.code === pw)) pw = K.puissances[0].code;
  let renderKii = () => {};
  const renderStrat = () => {
    if (!S) return;
    $("stratTabs").innerHTML = S.puissances.map(x => `<button type="button" data-p="${x.code}" aria-pressed="${x.code === pw}">${esc(x.nom)} <span>${x.textes.length} textes de référence</span></button>`).join("");
    const X = S.puissances.find(x => x.code === pw) || S.puissances[0];
    $("stratBody").innerHTML = `<div class="swap"><p class="these">« ${esc(X.these)} »</p>
      <div class="strat-grid"><div class="docs">${X.textes.map(t => `
        <article class="doc"><span class="dt">${esc(t.date)}</span><h4>${esc(t.titre)}</h4><blockquote>${esc(t.citation)}</blockquote><p>${esc(t.lecture)}</p>${refList(t.refs)}</article>`).join("")}</div>
        <aside class="strat-side">
          <h4>Ce qu'en disent les chercheurs</h4>
          <ul>${X.experts.map(e => `<li>${esc(e.idee)} ${refList(e.refs)}</li>`).join("")}</ul>
          <h4>Ce que ça explique</h4><p>${esc(X.explique)} <a href="#leviers">Voir les leviers</a></p>
          <div class="faille"><h4>Leur point faible, notre levier</h4><p>${esc(X.faille)}</p>${refList(X.faille_refs)}</div>
        </aside></div></div>`;
  };
  const setPw = c => { pw = c; store.set("bd-kii", pw); renderStrat(); renderKii(); };
  if (S) {
    $("stratIntro").textContent = S.intro;
    $("stratTabs").addEventListener("click", e => { const b = e.target.closest("button"); if (b) setPw(b.dataset.p); });
    renderStrat();
  }
  if (K) {
    $("kiiIntro").textContent = K.intro;
    const tabs = $("kiiTabs");
    renderKii = () => {
      tabs.innerHTML = K.puissances.map(x => `<button type="button" data-p="${x.code}" aria-pressed="${x.code === pw}">${esc(x.nom)} <span>${x.leviers.filter(l => l.assume).length} leviers assumés sur ${x.leviers.length}</span></button>`).join("");
      const P0 = K.puissances.find(x => x.code === pw);
      $("kiiBody").innerHTML = `<div class="swap"><p class="kii-resume">${esc(P0.resume)}</p><div class="kii-list">` + P0.leviers.map(l => `
        <article class="lev">
          <div class="lev-top"><span class="vec">${esc(l.vecteur)}</span><span class="ass ${l.assume ? "yes" : "no"}">${l.assume ? "Assumé" : "Documenté"}</span><span class="dt">${esc(l.date)}</span></div>
          <h4>${esc(l.titre)}</h4>
          <p><b>La preuve.</b> ${esc(l.preuve)}</p>
          <p><b>Ce que ça nous fait.</b> ${esc(l.effet)}</p>
          ${refList(l.refs)}
        </article>`).join("") + `</div></div>`;
    };
    tabs.addEventListener("click", e => { const b = e.target.closest("button"); if (b) setPw(b.dataset.p); });
    renderKii();
  }

  /* ---------- matrice ---------- */
  const MX = D.matrice;
  const mo = Object.keys(MX.puissances);
  $("matrix").innerHTML =
    `<thead><tr><th scope="col">Porte d'entrée</th>${mo.map(c => `<th scope="col">${esc(MX.puissances[c])}</th>`).join("")}</tr></thead><tbody>` +
    MX.vecteurs.map((v, i) => `<tr><th scope="row">${esc(v[0])}<small>${esc(v[1])}</small></th>${mo.map(c => { const [s, t] = MX.cases[c][i]; return `<td><span class="st ${s}">${MX.statuts[s]}</span><br>${esc(t)}</td>`; }).join("")}</tr>`).join("") + `</tbody>`;

  /* ---------- Europe et alliés ---------- */
  if (D.europe) $("euGrid").innerHTML = D.europe.map(c => `<article class="eu"><span class="big">${esc(c.chiffre)}</span><h4>${esc(c.titre)}</h4><p>${esc(c.texte)}</p>${refList(c.refs)}</article>`).join("");
  if (D.allies) $("allyList").innerHTML = D.allies.map(a => `<article class="ally ${a.sens === "contre-exemple" ? "counter" : ""}">
      <div class="ally-h"><b>${esc(a.domaine)}</b><span class="sens">${a.sens === "contre-exemple" ? "Ils font autrement" : "Réflexe de dépendance"}</span></div>
      <p>${esc(a.comportement)}</p><p class="cout">${esc(a.cout)}</p>${refList(a.refs)}</article>`).join("");

  /* ---------- Actus ---------- */
  (function actus() {
    const EFF = { aggrave: "Ça s'aggrave", ameliore: "Ça avance", surveille: "À surveiller", auto: "Détection automatique" };
    const FILTERS = [["all", "Toutes"], ["verif", "Vérifiées"], ["aggrave", "Ça s'aggrave"], ["ameliore", "Ça avance"], ["auto", "Détections automatiques"]];
    const match = (a, f) => f === "all" || (f === "verif" ? !!a.verif : f === "auto" ? !!a.auto : a.effet === f);
    let f = "all", shown = 8;
    const item = a => {
      const tags = (a.produits || []).map(id => byId[id]).filter(Boolean).map(p => `<button type="button" class="tag" data-open="${esc(p.id)}">${esc(p.n)}</button>`).join("");
      const src = a.refs && a.refs.length ? refList(a.refs) : a.url ? `<span class="refs">Source : <a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.source || "lien")}</a></span>` : "";
      const txt = a.texte ? `<p>${a.ia ? '<span class="badge">Résumé IA, à vérifier</span> ' : ""}${esc(a.texte)}</p>` : "";
      return `<li class="${a.auto ? "auto" : ""}"><time datetime="${esc(a.d)}">${fmtD(a.d)}</time><div><div class="meta"><span class="eff ${esc(a.effet)}">${a.live ? '<span class="live-dot"></span>' : ""}${EFF[a.effet] || ""}</span>${a.auto ? '<span class="badge">à vérifier</span>' : ""}</div><span class="ti">${a.auto && a.url ? `<a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.titre)}</a>` : esc(a.titre)}</span>${txt}${src}${tags ? `<div class="tags">${tags}</div>` : ""}</div></li>`;
    };
    const render = () => {
      $("actuChips").innerHTML = FILTERS.map(([k, v]) => { const n = NEWS.filter(a => match(a, k)).length; return (k === "auto" && !n) ? "" : `<button type="button" class="chip" data-a="${k}" aria-pressed="${k === f}">${esc(v)} <span style="opacity:.6">${n}</span></button>`; }).join("");
      const L = NEWS.filter(a => match(a, f));
      $("feed").innerHTML = L.slice(0, shown).map(item).join("") || `<li><span></span><div><p>Rien dans cette catégorie pour l'instant.</p></div></li>`;
      const more = $("feedMore"); more.hidden = L.length <= shown; more.textContent = `Voir les ${Math.min(8, L.length - shown)} suivantes`;
    };
    $("actuChips").addEventListener("click", e => { const b = e.target.closest(".chip"); if (!b) return; f = b.dataset.a; shown = 8; render(); });
    $("feedMore").onclick = () => { shown += 8; render(); };
    render();

    $("deadlines").innerHTML = (D.echeances || []).slice().sort((a, b) => a.d.localeCompare(b.d)).map(e => {
      const n = daysTo(e.d);
      const j = n < 0 ? "Échue" : e.approx ? `≈ ${Math.max(1, Math.round(n / 30.4))} mois` : n === 0 ? "Jour J" : `J-${n}`;
      return `<li><span class="j">${j}<small>${e.approx ? "vers " : ""}${fmtD(e.d)}</small></span><div><b>${esc(e.titre)}</b><span>${esc(e.detail)}</span> ${refList(e.refs)}</div></li>`;
    }).join("");
  })();

  /* ---------- méthode : échelle, santé des données, pipeline ---------- */
  $("scale").innerHTML = [5, 4, 3, 2, 1].map(l => `<div><span class="pill" style="background:var(--l${l});color:var(--on-l${l})">${LVL(l)}</span><span>${esc(META.niveaux[l].desc)}</span></div>`).join("");
  (function health() {
    const cells = [];
    const nk = k => inst.filter(p => p.k === k).length;
    cells.push(`<div class="hcell"><b>Les 100 produits</b><span class="ok">${inst.length} notés</span> · ${nk("src")} sur donnée publiée, ${nk("calc")} calculés, <span class="na">${nk("est")} estimés (≈)</span></div>`);
    const g = LV.gaz;
    cells.push(`<div class="hcell"><b>Gaz · relevé quotidien</b>${g ? `<span class="${daysTo(g.jour_gazier) > -4 ? "ok" : "ko"}">${num(g.remplissage_pct)} %</span> au ${fmtD(g.jour_gazier)} · ${esc(g.collecte || g.source)}` : '<span class="na">pas encore collecté</span>'}</div>`);
    const el = LV.electricite;
    cells.push(`<div class="hcell"><b>Électricité · RTE</b>${el ? `<span class="ok">${el.solde_exportateur_gwh > 0 ? "exportatrice" : "importatrice"}</span> : solde de ${Math.round(Math.abs(el.solde_exportateur_gwh)).toLocaleString("fr-FR")} GWh sur 7 jours (au ${fmtD(el.fin)})` : '<span class="na">premier relevé au prochain passage du robot</span>'}</div>`);
    const ve = LV.veille_etat;
    if (ve) { const v = Object.values(ve), ok = v.filter(x => x.statut === "ok").length; cells.push(`<div class="hcell"><b>Veille automatique</b><span class="${ok === v.length ? "ok" : "ko"}">${ok}/${v.length} flux lus</span> · ${auto.length} articles repérés, tous à vérifier</div>`); }
    else cells.push(`<div class="hcell"><b>Veille automatique</b><span class="na">en attente du premier passage</span> · flux de presse et d'instituts lus chaque matin</div>`);
    const se = LV.sources_etat;
    if (se) { const v = Object.values(se), ok = v.filter(x => x.statut !== "à vérifier").length; cells.push(`<div class="hcell"><b>Liens de la bibliothèque</b><span class="${ok === v.length ? "ok" : "ko"}">${ok}/${v.length} répondent</span> · contrôle chaque lundi</div>`); }
    else cells.push(`<div class="hcell"><b>Liens de la bibliothèque</b><span class="na">${(D.bibliographie || []).length} sources</span> · contrôle automatique chaque lundi</div>`);
    $("health").innerHTML = cells.join("");
  })();
  $("pipe").innerHTML = `<thead><tr><th>Source</th><th>Ce qu'on en tire</th><th>Cadence</th><th>Automatisable</th></tr></thead><tbody>` +
    D.sources.map(r => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td class="cad">${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`).join("") + `</tbody>`;
  $("props").innerHTML = D.propositions.map(([w, b, s, f]) => `<div class="prop${f ? " flag" : ""}"><span class="when">${esc(w)}</span><b>${esc(b)}</b><span>${esc(s)}</span></div>`).join("");

  /* ---------- bibliothèque des sources ---------- */
  if (D.bibliographie) {
    let bt = "all", bq = "";
    const SE = LV.sources_etat || {};
    const counts = {}; D.bibliographie.forEach(b => { counts[b.type] = (counts[b.type] || 0) + 1; b.key = norm(`${b.auteur} ${b.titre} ${b.apport} ${b.date}`); });
    const bo = ["institution", "parlement", "doctrine", "expertise", "programme", "donnees", "comite", "presse"].filter(t => counts[t]);
    const lk = b => { const s = SE[b.id]; if (!s) return ""; return s.statut === "à vérifier" ? `<span class="lk ko">lien à vérifier (${esc(s.code)})</span>` : `<span class="lk">lien vérifié le ${fmtD(s.verifie)}</span>`; };
    const renderBib = () => {
      $("bibChips").innerHTML = [["all", `Toutes ${D.bibliographie.length}`], ...bo.map(t => [t, `${TYPES[t]} ${counts[t]}`])].map(([k, v]) => `<button type="button" class="chip" data-t="${k}" aria-pressed="${k === bt}">${esc(v)}</button>`).join("");
      const list = D.bibliographie.filter(b => (bt === "all" || b.type === bt) && (!bq || b.key.includes(bq))).slice().sort((a, b) => bo.indexOf(a.type) - bo.indexOf(b.type) || String(b.date).localeCompare(String(a.date)));
      $("bibList").innerHTML = list.map(b => `<li id="ref-${esc(b.id)}"><span class="bt ${b.type}">${TYPES[b.type] || b.type}</span><div><span class="ba">${esc(b.auteur)} · ${esc(year(b.date))}</span>${b.url ? `<a class="bti" href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.titre)}</a>` : `<span class="bti">${esc(b.titre)}</span>`}<p>${esc(b.apport)}</p>${lk(b)}</div></li>`).join("") || `<li><span></span><div><p>Aucune source ne correspond.</p></div></li>`;
    };
    $("bibChips").addEventListener("click", e => { const b = e.target.closest(".chip"); if (!b) return; bt = b.dataset.t; renderBib(); });
    $("bq").addEventListener("input", e => { bq = norm(e.target.value.trim()); renderBib(); });
    renderBib();
  }

  renderChips(); renderWall(); applyFilter(); renderLine();
  setView(store.get("bd-view") === "line" ? "line" : "wall");
  effects();

  // lien direct vers une fiche : barometredesdependances.com/#gallium
  const fromHash = () => { const h = decodeURIComponent(location.hash.slice(1)); if (!h) return; if (byId[h]) openSheet(byId[h].i); else if (h.startsWith("ref-")) { const li = $(h); if (li) { li.classList.remove("flash"); void li.offsetWidth; li.classList.add("flash"); } } };
  fromHash();
  window.addEventListener("hashchange", fromHash);
}

/* ---------- effets de navigation ---------- */
function effects() {
  const prog = $("progress"), head = document.querySelector("header.top"), top = $("toTop");
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const y = window.scrollY, h = document.documentElement.scrollHeight - innerHeight;
    if (prog) prog.style.transform = `scaleX(${h > 0 ? Math.min(1, y / h) : 0})`;
    if (head) head.classList.toggle("scrolled", y > 8);
    if (top) top.classList.toggle("on", y > 900);
  };
  window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
  if (top) top.onclick = () => window.scrollTo({ top: 0, behavior: REDUCED ? "auto" : "smooth" });

  if (!("IntersectionObserver" in window)) return;
  // sommaire : le chapitre en cours s'allume
  const links = {}; document.querySelectorAll("#nav a").forEach(a => { links[a.getAttribute("href").slice(1)] = a; });
  const MAP = { test: "test", detail: "detail", strategies: "strategies", leviers: "strategies", robinet: "strategies", europe: "europe", allies: "europe", actus: "actus", methode: "methode", sources: "sources", propositions: "propositions" };
  const spy = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const k = MAP[e.target.id];
    Object.values(links).forEach(a => a.classList.toggle("on", a === links[k]));
  }), { rootMargin: "-40% 0px -55% 0px" });
  Object.keys(MAP).forEach(id => { const s = $(id); if (s) spy.observe(s); });

  if (REDUCED) return;
  // apparition douce des chapitres (déplacement seulement : le contenu reste toujours lisible)
  document.documentElement.classList.add("reveal-ready");
  const rv = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); rv.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll(".reveal").forEach(s => rv.observe(s));
  const wall = $("wall");
  const wo = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { wall.classList.add("pop"); wo.disconnect(); } }), { threshold: 0.15 });
  wo.observe(wall);
}

/* ---------- thème ---------- */
function theme() {
  const root = document.documentElement, tb = $("themeBtn");
  const curDark = () => { const a = root.getAttribute("data-theme"); return a ? a === "dark" : matchMedia("(prefers-color-scheme: dark)").matches; };
  const sync = () => { tb.textContent = curDark() ? "Clair" : "Sombre"; tb.setAttribute("aria-label", curDark() ? "Passer au thème clair" : "Passer au thème sombre"); };
  const t = store.get("bd-theme"); if (t === "dark" || t === "light") root.setAttribute("data-theme", t);
  tb.onclick = () => { const n = curDark() ? "light" : "dark"; root.setAttribute("data-theme", n); store.set("bd-theme", n); sync(); };
  try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", sync); } catch (e) { /* navigateur ancien */ }
  sync();
}

function start() {
  theme();
  loadData().then(init).catch(err => {
    $("wall").innerHTML = `<p class="loading">Les données n'ont pas pu être chargées (${esc(err.message)}). Rechargez la page.</p>`;
    console.error(err);
  });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
