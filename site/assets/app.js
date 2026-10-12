/* Baromètre des dépendances — front statique.
   Les données viennent de data/*.json (site) ou de window.BD_DATA (aperçu autonome). */
(function () {
"use strict";
const INF = Infinity;
const FILES = ["meta", "produits", "matrice", "vigie", "atouts", "sources", "propositions", "bibliographie", "kii", "europe", "allies", "strategies"];
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const $ = id => document.getElementById(id);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* stockage indisponible */ } }
};

async function loadData() {
  if (window.BD_DATA) return window.BD_DATA;
  const out = {};
  await Promise.all(FILES.map(async f => {
    const r = await fetch(`data/${f}.json`, { cache: "no-cache" });
    if (!r.ok) throw new Error(`data/${f}.json : ${r.status}`);
    out[f] = await r.json();
  }));
  out.live = {};
  try { const r = await fetch("data/live/gaz.json", { cache: "no-cache" }); if (r.ok) out.live.gaz = await r.json(); } catch (e) { /* pas de donnée en direct */ }
  return out;
}

function init(D) {
  const META = D.meta, P = D.produits;
  const LVL = n => META.niveaux[n].nom;
  const BIB = {}; (D.bibliographie || []).forEach(b => { BIB[b.id] = b; });
  const TYPES = { institution: "Institution", parlement: "Parlement", doctrine: "Texte officiel étranger", expertise: "Expertise", donnees: "Données", presse: "Presse", comite: "Comité" };
  const year = d => String(d || "").slice(0, 4);
  function refLabel(id) {
    const b = BIB[id]; if (!b) return "";
    const lab = `${esc(b.auteur.split(" (")[0].split(",")[0])} (${esc(year(b.date))})`;
    return b.url ? `<a href="${esc(b.url)}" target="_blank" rel="noopener" title="${esc(b.titre)}">${lab}</a>` : `<span title="${esc(b.titre)}">${lab}</span>`;
  }
  const refList = ids => (ids && ids.length) ? `<span class="refs">Sources : ${ids.map(refLabel).filter(Boolean).join(" · ")}</span>` : "";
  const fmtD = s => new Date(s + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  $("majDate").textContent = fmtD(META.maj);

  /* ---------- normalisation + données en direct ---------- */
  const FEED = D.vigie.slice();
  P.forEach((p, i) => {
    p.i = i;
    if (p.d === "auto") p.d = INF;
    if (p.live === "gaz" && D.live && D.live.gaz) {
      const g = D.live.gaz;
      p.d = Math.round(g.stock_twh / g.conso_moyenne_twh_j);
      p.k = "calc";
      p.src = `${g.source}, jour gazier du ${fmtD(g.jour_gazier)}`;
      p.note = `${String(g.stock_twh).replace(".", ",")} TWh stockés (${String(g.remplissage_pct).replace(".", ",")} % de remplissage). ` + p.note;
      p.isLive = true;
      FEED.push({ d: g.jour_gazier, t: "Signal", ti: `Stocks de gaz français remplis à ${String(g.remplissage_pct).replace(".", ",")} %, soit environ ${p.d} jours de consommation moyenne`, so: g.source, live: true });
    }
    p.lv = level(p);
  });
  FEED.sort((a, b) => b.d.localeCompare(a.d));
  const inst = P.filter(p => p.d !== undefined);

  function level(p) {
    if (p.d === undefined) return 0;
    let b = p.d === INF ? 1 : p.d > 365 ? 2 : p.d > 90 ? 3 : p.d > 30 ? 4 : 5;
    if (p.l === 2 && p.d !== INF && b < 5) b++;
    return b;
  }
  function explain(p) {
    if (p.d === undefined) return "";
    if (p.d === INF) return `Production nationale ou européenne excédentaire : niveau <b>${LVL(1)}</b>.`;
    const base = p.d > 365 ? 2 : p.d > 90 ? 3 : p.d > 30 ? 4 : 5;
    let t = `${p.k === "est" ? "Environ " : ""}${p.d} jour${p.d > 1 ? "s" : ""} de tenue : niveau <b>${LVL(base)}</b> (${esc(META.niveaux[base].desc)}).`;
    if (p.l === 2 && base < 5) t += ` Le fournisseur a déjà activé ce levier : un niveau de plus, <b>${LVL(base + 1)}</b>.`;
    else if (p.l === 2) t += " Le fournisseur a déjà activé ce levier.";
    return t;
  }
  function daysTxt(p) {
    if (p.d === undefined) return "à instruire";
    if (p.d === INF) return "Autonome";
    return (p.k === "est" ? "≈ " : "") + p.d + " j";
  }

  /* ---------- cadran ---------- */
  (function dial() {
    const svg = $("dial"), NS = "http://www.w3.org/2000/svg";
    const cx = 180, cy = 176, r = 120;
    const pt = (a, rr) => [cx + rr * Math.cos(a * Math.PI / 180), cy - rr * Math.sin(a * Math.PI / 180)];
    const el = (t, a) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); svg.appendChild(e); return e; };
    // de gauche (totalement dépendant) à droite (souverain), 36° par niveau
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
    const avg = inst.reduce((s, p) => s + p.lv, 0) / inst.length;
    const ang = 18 + (avg - 1) * 36;
    const [nx, ny] = pt(ang, r - 26), [tx, ty] = pt(ang + 180, 18);
    el("line", { x1: tx, y1: ty, x2: nx, y2: ny, style: "stroke:var(--ink)", "stroke-width": 3, "stroke-linecap": "round" });
    el("circle", { cx, cy, r: 9, style: "fill:var(--brass)" });
    el("circle", { cx, cy, r: 3.5, style: "fill:var(--surface)" });
    const state = Math.round(avg);
    const v = $("dialVal"); v.textContent = LVL(state); v.style.color = `var(--l${state})`;
    $("dialNote").textContent = `Moyenne des ${inst.length} produits instruits sur 100 (niveau moyen ${avg.toFixed(1).replace(".", ",")} sur une échelle de 1, souverain, à 5, totalement dépendant).`;
  })();

  /* ---------- chiffres clés ---------- */
  (function kpis() {
    const under = inst.filter(p => p.lv >= 4).length;
    const act = inst.filter(p => p.l === 2).length;
    const next = FEED.filter(f => f.compte_a_rebours).sort((a, b) => a.d.localeCompare(b.d))[0];
    let cd = "";
    if (next) {
      const days = Math.ceil((new Date(next.d + "T00:00:00") - new Date()) / 86400000);
      const lab = days > 0 ? `J-${days}` : days === 0 ? "Jour J" : "Échue";
      cd = `<div class="kpi countdown"><span class="n">${lab}</span><span class="t">${esc(next.ti)}, le ${fmtD(next.d)}.</span></div>`;
    }
    $("kpis").innerHTML = `
      <div class="kpi"><span class="n">${inst.length}<small style="font-size:16px"> / 100</small></span><span class="t">produits vitaux instruits</span></div>
      <div class="kpi"><span class="n" style="color:var(--l5)">${under}</span><span class="t">dépendants ou totalement dépendants</span></div>
      <div class="kpi"><span class="n">${act}</span><span class="t">leviers déjà activés contre la France ou l'UE</span></div>
      <div class="kpi"><span class="n">54<small style="font-size:16px"> Md€</small></span><span class="t">versés chaque année aux clouds et logiciels américains</span></div>
      ${cd}`;
  })();

  /* ---------- filtres + vues ---------- */
  const FAM = META.familles;
  let fam = store.get("bd-fam") || "all";
  if (fam !== "all" && !FAM[fam]) fam = "all";
  const chips = $("famChips");
  function renderChips() {
    const opts = [["all", "Tous"], ...Object.entries(FAM)];
    chips.innerHTML = opts.map(([k, v]) => {
      const n = k === "all" ? P.length : P.filter(p => p.f === k).length;
      return `<button type="button" class="chip" data-f="${k}" aria-pressed="${k === fam}">${esc(v)} <span style="opacity:.6">${n}</span></button>`;
    }).join("");
  }
  chips.addEventListener("click", e => {
    const b = e.target.closest(".chip"); if (!b) return;
    fam = b.dataset.f; store.set("bd-fam", fam);
    renderChips(); renderWall(); renderLine();
  });

  function renderWall() {
    $("wall").innerHTML = P.map(p => {
      const dim = fam !== "all" && p.f !== fam ? " dim" : "";
      const lev = p.l === 2 ? `<span class="bolt" title="Levier déjà activé"></span>` : "";
      const d = p.d === undefined ? "à instruire" : p.d === INF ? "Auto." : `${p.k === "est" ? "≈" : ""}${p.d}<small>j</small>`;
      return `<div class="tile-wrap"><button type="button" class="tile lv${p.lv}${dim}" data-i="${p.i}" aria-label="${esc(p.n)} : ${esc(daysTxt(p))}">${lev}<span class="nm">${esc(p.n)}</span><span class="dy">${d}</span></button></div>`;
    }).join("");
  }

  const LOGMAX = Math.log10(1000);
  const pos = d => d === INF ? 100 : Math.max(0, Math.min(100, Math.log10(Math.max(d, 1)) / LOGMAX * 100));
  const THR = pos(META.seuil_jours);
  function renderLine() {
    const ticks = [[1, "1 j"], [7, "7"], [30, "30"], [90, "90"], [365, "1 an"], [1000, "1000+"]];
    $("axis").innerHTML =
      `<span class="cap">produit · détenteur</span><div class="ticks">${ticks.map(([d, l]) => `<span style="left:${pos(d)}%;${d === 1 ? "transform:none" : d === 1000 ? "transform:translateX(-100%)" : ""}">${l}</span>`).join("")}<span class="thr-l" style="left:${THR}%">seuil proposé : ${META.seuil_jours} jours</span></div><span class="cap" style="text-align:right">tenue</span>`;
    const list = inst.filter(p => fam === "all" || p.f === fam).slice().sort((a, b) => (a.d === INF ? 1e9 : a.d) - (b.d === INF ? 1e9 : b.d));
    $("rows").innerHTML = list.length ? list.map(p => {
      const w = p.d === 0 ? 0 : pos(p.d);
      return `<div class="frow" data-i="${p.i}" role="button" tabindex="0" aria-label="${esc(p.n)}"><span class="fname">${p.isLive ? '<span class="live-dot" title="Donnée en direct"></span>' : ""}${esc(p.n)} <span class="hc">${p.h.join(" · ")}</span></span><div class="track" style="--thr:${THR}%"><div class="bar${p.k === "est" ? " est" : ""}" style="width:${w}%;background-color:var(--l${p.lv})"></div><span class="thr"></span></div><span class="fval">${esc(daysTxt(p))}</span></div>`;
    }).join("") : `<p class="loading">Aucun produit instruit dans cette famille pour l'instant.</p>`;
  }
  const vWall = $("vWall"), vLine = $("vLine");
  function setView(v) {
    vWall.setAttribute("aria-pressed", v === "wall"); vLine.setAttribute("aria-pressed", v === "line");
    $("wallView").hidden = v !== "wall"; $("lineView").hidden = v !== "line";
    store.set("bd-view", v);
  }
  vWall.onclick = () => setView("wall"); vLine.onclick = () => setView("line");

  $("legend").innerHTML =
    [5, 4, 3, 2, 1].map(l => `<span><i class="sw" style="background:var(--l${l})"></i>${LVL(l)}</span>`).join("") +
    `<span><i class="sw todo"></i>À instruire</span><span><i class="sw" style="background:var(--ink-2);border-radius:50%;width:9px;height:9px"></i>Levier déjà activé</span><span>« ≈ » estimation de travail · barres hachurées dans la ligne de flottaison</span>`;

  /* ---------- fiche ---------- */
  const sheet = $("sheet"), scrim = $("scrim");
  let lastFocus = null;
  function alliances(p) {
    if (!p.al || !p.al.length) {
      return `<div class="alli"><h4>Pistes d'alliance</h4><div class="al red"><p>${esc(META.pistes_alliance[p.f])}</p></div></div>`;
    }
    return `<div class="alli"><h4>Avec qui bâtir d'autres alliances</h4>` + p.al.map(a => {
      const co = a.type === "codependance";
      return `<div class="al ${co ? "co" : "red"}"><span class="ty">${co ? "Co-dépendance" : "Redondance"}</span><div class="pays">${a.pays.map(x => `<span>${esc(x)}</span>`).join("")}</div><p>${esc(a.txt)}</p></div>`;
    }).join("") + `</div>`;
  }
  function openSheet(i) {
    const p = P[i]; lastFocus = document.activeElement;
    const lvl = p.lv ? `<span class="lvpill" style="background:var(--l${p.lv});color:var(--on-l${p.lv})">${LVL(p.lv)}</span>` : `<span class="badge">À instruire</span>`;
    let body;
    if (p.d === undefined) {
      body = `<p style="margin-top:16px">Ce produit fait partie de la liste des 100 mais n'est pas encore instruit.</p>
        <dl class="facts"><div><dt>Sources à mobiliser</dt><dd>${esc(META.sources_a_mobiliser[p.f])}</dd></div>
        <div><dt>À établir</dt><dd>Stocks publics et privés, production nationale mobilisable, consommation vitale par jour, pays d'origine ultime, historique de coercition, partenaires possibles.</dd></div></dl>` + alliances(p);
    } else {
      const big = p.d === INF ? `<span class="d">Autonome</span><span class="u">production nationale excédentaire</span>` : `<span class="d">${p.k === "est" ? "≈ " : ""}${p.d}</span><span class="u">jours de tenue si le flux extérieur s'arrête</span>`;
      body = `<div class="big">${big}</div><span class="badge">${p.isLive ? '<span class="live-dot"></span>' : ""}${esc(META.natures[p.k])}</span>
        <dl class="facts">
          <div><dt>Qui tient le robinet</dt><dd>${p.h.map(h => esc(META.detenteurs[h] || h)).join(", ")}</dd></div>
          <div><dt>Notre dépendance</dt><dd>${esc(p.dep)}</dd></div>
          ${p.conc ? `<div><dt>Concentration mondiale</dt><dd>${esc(p.conc)}</dd></div>` : ""}
          <div><dt>Levier</dt><dd>${esc(META.leviers[p.l])}</dd></div>
          ${p.note ? `<div><dt>À retenir</dt><dd>${esc(p.note)}</dd></div>` : ""}
          <div><dt>Source du chiffre</dt><dd>${esc(p.src)}</dd></div>
        </dl>
        <div class="why"><h4>Pourquoi ce niveau</h4><p class="rule">${explain(p)}</p>${p.pourquoi ? `<p>${esc(p.pourquoi)}</p>` : ""}${refList(p.refs)}</div>` + alliances(p) +
        `<div class="mesure"><b>Ce que nous proposons</b>${esc(META.mesures[p.m])}</div>`;
    }
    sheet.innerHTML = `<button type="button" class="close" id="shClose" aria-label="Fermer la fiche">×</button>
      <div class="eyebrow">${esc(FAM[p.f])} · produit ${p.i + 1} / ${P.length}</div>
      <h3 id="shTitle">${esc(p.n)}</h3>${lvl}${body}`;
    sheet.hidden = false; scrim.hidden = false;
    $("shClose").onclick = closeSheet;
    $("shClose").focus();
    if (p.id) { try { history.replaceState(null, "", "#" + p.id); } catch (e) { /* cadre restreint */ } }
  }
  function closeSheet() {
    sheet.hidden = true; scrim.hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    if (location.hash) { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* cadre restreint */ } }
  }
  scrim.onclick = closeSheet;
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !sheet.hidden) closeSheet(); });
  $("wall").addEventListener("click", e => { const t = e.target.closest(".tile"); if (t) openSheet(+t.dataset.i); });
  const rowsEl = $("rows");
  rowsEl.addEventListener("click", e => { const t = e.target.closest(".frow"); if (t) openSheet(+t.dataset.i); });
  rowsEl.addEventListener("keydown", e => { const t = e.target.closest(".frow"); if (t && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openSheet(+t.dataset.i); } });

  /* ---------- matrice ---------- */
  const MX = D.matrice;
  const order = Object.keys(MX.puissances);
  $("matrix").innerHTML =
    `<thead><tr><th scope="col">Vecteur</th>${order.map(c => `<th scope="col">${esc(MX.puissances[c])}</th>`).join("")}</tr></thead><tbody>` +
    MX.vecteurs.map((v, i) => `<tr><th scope="row">${esc(v[0])}<small>${esc(v[1])}</small></th>${order.map(c => { const [s, t] = MX.cases[c][i]; return `<td><span class="st ${s}">${MX.statuts[s]}</span><br>${esc(t)}</td>`; }).join("")}</tr>`).join("") + `</tbody>`;

  /* ---------- vigie ---------- */
  $("feed").innerHTML = FEED.map(f => {
    const so = f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.so)}</a>` : esc(f.so);
    return `<li class="${f.compte_a_rebours ? "next" : ""}"><time datetime="${f.d}">${fmtD(f.d)}</time><div><span class="ty">${f.live ? '<span class="live-dot"></span>' : ""}${esc(f.t)}</span><span class="ti">${esc(f.ti)}</span><span class="so">${so}</span></div></li>`;
  }).join("");

  /* ---------- atouts, méthode, propositions ---------- */
  $("assets").innerHTML = D.atouts.map(([a, b]) => `<div class="asset"><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join("");
  $("scale").innerHTML = [5, 4, 3, 2, 1].map(l => `<div><span class="pill" style="background:var(--l${l});color:var(--on-l${l})">${LVL(l)}</span><span>${esc(META.niveaux[l].desc)}</span></div>`).join("");
  $("pipe").innerHTML = `<thead><tr><th>Source</th><th>Ce qu'on en tire</th><th>Cadence</th><th>Automatisable</th></tr></thead><tbody>` +
    D.sources.map(r => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td class="cad">${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`).join("") + `</tbody>`;
  $("props").innerHTML = D.propositions.map(([w, b, s, f]) => `<div class="prop${f ? " flag" : ""}"><span class="when">${esc(w)}</span><b>${esc(b)}</b><span>${esc(s)}</span></div>`).join("");

  /* ---------- stratégies + leviers assumés (KII), puissance partagée ---------- */
  const K = D.kii, S = D.strategies;
  let pw = store.get("bd-kii") || (K ? K.puissances[0].code : "CN");
  if (K && !K.puissances.some(x => x.code === pw)) pw = K.puissances[0].code;
  let renderKii = () => {};
  const renderStrat = () => {
    if (!S) return;
    $("stratTabs").innerHTML = S.puissances.map(x => `<button type="button" data-p="${x.code}" aria-pressed="${x.code === pw}">${esc(x.nom)} <span>${x.textes.length} textes de référence</span></button>`).join("");
    const X = S.puissances.find(x => x.code === pw) || S.puissances[0];
    $("stratBody").innerHTML = `<p class="these">« ${esc(X.these)} »</p>
      <div class="strat-grid"><div class="docs">${X.textes.map(t => `
        <article class="doc"><span class="dt">${esc(t.date)}</span><h4>${esc(t.titre)}</h4><blockquote>${esc(t.citation)}</blockquote><p>${esc(t.lecture)}</p>${refList(t.refs)}</article>`).join("")}</div>
        <aside class="strat-side">
          <h4>Ce qu'en disent les experts</h4>
          <ul>${X.experts.map(e => `<li>${esc(e.idee)} ${refList(e.refs)}</li>`).join("")}</ul>
          <h4>Ce que cela explique</h4><p>${esc(X.explique)} <a href="#leviers">Voir les leviers</a></p>
          <div class="faille"><h4>Leur point faible, notre levier</h4><p>${esc(X.faille)}</p>${refList(X.faille_refs)}</div>
        </aside></div>`;
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
      tabs.innerHTML = K.puissances.map(x => `<button type="button" data-p="${x.code}" aria-pressed="${x.code === pw}">${esc(x.nom)} <span>${x.leviers.filter(l => l.assume).length}/${x.leviers.length} assumés</span></button>`).join("");
      const P0 = K.puissances.find(x => x.code === pw);
      $("kiiBody").innerHTML = `<p class="kii-resume">${esc(P0.resume)}</p><div class="kii-list">` + P0.leviers.map(l => `
        <article class="lev">
          <div class="lev-top"><span class="vec">${esc(l.vecteur)}</span><span class="ass ${l.assume ? "yes" : "no"}">${l.assume ? "Assumé" : "Documenté"}</span><span class="dt">${esc(l.date)}</span></div>
          <h4>${esc(l.titre)}</h4>
          <p><b>Preuve.</b> ${esc(l.preuve)}</p>
          <p><b>Effet.</b> ${esc(l.effet)}</p>
          ${refList(l.refs)}
        </article>`).join("") + `</div>`;
    };
    tabs.addEventListener("click", e => { const b = e.target.closest("button"); if (b) setPw(b.dataset.p); });
    renderKii();
  }

  /* ---------- Europe ---------- */
  if (D.europe) $("euGrid").innerHTML = D.europe.map(c => `<article class="eu"><span class="big">${esc(c.chiffre)}</span><h4>${esc(c.titre)}</h4><p>${esc(c.texte)}</p>${refList(c.refs)}</article>`).join("");

  /* ---------- alliés ---------- */
  if (D.allies) $("allyList").innerHTML = D.allies.map(a => `<article class="ally ${a.sens === "contre-exemple" ? "counter" : ""}">
      <div class="ally-h"><b>${esc(a.domaine)}</b><span class="sens">${a.sens === "contre-exemple" ? "Contre-exemple" : "Dépendance"}</span></div>
      <p>${esc(a.comportement)}</p><p class="cout">${esc(a.cout)}</p>${refList(a.refs)}</article>`).join("");

  /* ---------- bibliothèque des sources ---------- */
  if (D.bibliographie) {
    let bt = "all";
    const counts = {}; D.bibliographie.forEach(b => { counts[b.type] = (counts[b.type] || 0) + 1; });
    const order = ["institution", "parlement", "doctrine", "expertise", "donnees", "comite", "presse"].filter(t => counts[t]);
    const renderBib = () => {
      $("bibChips").innerHTML = [["all", `Toutes ${D.bibliographie.length}`], ...order.map(t => [t, `${TYPES[t]} ${counts[t]}`])].map(([k, v]) => `<button type="button" class="chip" data-t="${k}" aria-pressed="${k === bt}">${esc(v)}</button>`).join("");
      const list = D.bibliographie.filter(b => bt === "all" || b.type === bt).slice().sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type) || String(b.date).localeCompare(String(a.date)));
      $("bibList").innerHTML = list.map(b => `<li id="ref-${esc(b.id)}"><span class="bt ${b.type}">${TYPES[b.type] || b.type}</span><div><span class="ba">${esc(b.auteur)} · ${esc(year(b.date))}</span>${b.url ? `<a class="bti" href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.titre)}</a>` : `<span class="bti">${esc(b.titre)}</span>`}<p>${esc(b.apport)}</p></div></li>`).join("");
    };
    $("bibChips").addEventListener("click", e => { const b = e.target.closest(".chip"); if (!b) return; bt = b.dataset.t; renderBib(); });
    renderBib();
  }

  renderChips(); renderWall(); renderLine();
  setView(store.get("bd-view") === "line" ? "line" : "wall");

  // lien direct vers une fiche : barometredesdependances.com/#gallium
  const h = location.hash.slice(1);
  if (h) { const p = P.find(x => x.id === h); if (p) openSheet(p.i); }
}

/* ---------- thème ---------- */
function theme() {
  const root = document.documentElement, tb = $("themeBtn");
  const curDark = () => { const a = root.getAttribute("data-theme"); return a ? a === "dark" : matchMedia("(prefers-color-scheme: dark)").matches; };
  const sync = () => { tb.textContent = curDark() ? "Clair" : "Sombre"; tb.setAttribute("aria-label", curDark() ? "Passer au thème clair" : "Passer au thème sombre"); };
  const t = store.get("bd-theme"); if (t === "dark" || t === "light") root.setAttribute("data-theme", t);
  tb.onclick = () => { const n = curDark() ? "light" : "dark"; root.setAttribute("data-theme", n); store.set("bd-theme", n); sync(); };
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
