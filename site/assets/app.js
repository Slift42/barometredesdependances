/* Baromètre des dépendances, v0.8 : front statique, sans framework.
   Les données viennent de data/*.json (site) ou de window.BD_DATA (aperçu autonome).
   Les drapeaux viennent de assets/flags.js (window.BD_FLAGS). */
(function () {
"use strict";
const INF = Infinity;
const FILES = ["meta", "produits", "matrice", "atouts", "sources", "propositions", "bibliographie", "kii", "europe", "allies", "strategies", "chaines", "actus", "echeances", "zoom_armees", "carte"];
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
const BOLT = `<svg class="bolt" viewBox="0 0 16 16" aria-hidden="true"><path d="M9.2 1L3 9.2h4.1L6.4 15l6.6-8.6H8.8z"/></svg>`;

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
  const META = D.meta, P = D.produits, LV = D.live || {}, CARTE = D.carte || { pays: [], ancres: {}, noms: {} };
  const LVL = n => META.niveaux[n].nom;
  const LVS = { 5: "30 jours ou moins", 4: "de 31 à 90 jours", 3: "de 91 jours à un an, ou 50 à 79 % des besoins couverts", 2: "plus d'un an, ou 80 à 99 % des besoins couverts", 1: "la France produit plus qu'elle ne consomme" };
  const lvc = l => `var(--l${l})`;
  const BIB = {}; (D.bibliographie || []).forEach(b => { BIB[b.id] = b; });
  const TYPES = { institution: "Institution", parlement: "Parlement", doctrine: "Leurs textes", expertise: "Expertise", programme: "Programme", donnees: "Données", ong: "ONG", presse: "Presse" };

  /* ---------- drapeaux et noms de pays ---------- */
  const FL = window.BD_FLAGS || { sprite: "", alias: {} };
  if (FL.sprite && !$("flagSprite")) { const d = document.createElement("div"); d.id = "flagSprite"; d.innerHTML = FL.sprite; document.body.insertBefore(d, document.body.firstChild); }
  const FLAGSET = new Set((FL.sprite.match(/id="fl-([a-z]+)"/g) || []).map(s => s.slice(7, -1)));
  const nom = c => c === "DIV" ? "Fournisseurs diversifiés" : c === "CPI" ? "Cour pénale internationale" : (META.detenteurs[c] || CARTE.noms[c] || c);
  function flag(c, cls) {
    if (!c) return "";
    const k = String(c).toLowerCase(), cl = cls ? " fl-" + cls : "";
    if (c === "DIV") return `<svg class="fl div${cl}" viewBox="0 0 20 15" role="img" aria-label="${nom(c)}"><title>${nom(c)}</title><circle cx="10" cy="7.5" r="6.2" fill="none" stroke="currentColor" stroke-width="1.4"/><ellipse cx="10" cy="7.5" rx="2.7" ry="6.2" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M3.8 7.5h12.4" stroke="currentColor" stroke-width="1.1"/></svg>`;
    if (!FLAGSET.has(k)) return `<span class="fl txt${cl}" title="${esc(nom(c))}">${esc(c)}</span>`;
    return `<svg class="fl${cl}" viewBox="0 0 640 480" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(nom(c))}"><title>${esc(nom(c))}</title><use href="#fl-${k}"/></svg>`;
  }
  const codeOf = name => { const n = norm(String(name).replace(/\(.*?\)/g, "")).trim(); return FL.alias[n] || null; };
  const codesIn = txt => [...new Set(String(txt || "").split(/,| puis | et /).map(codeOf).filter(Boolean))];
  const POW = { CN: "var(--cn)", US: "var(--us)", RU: "var(--ru)" };
  const pcol = c => POW[c] || "var(--other)";
  const foreign = p => (p.h || []).filter(h => h !== "FR");
  const tileFlags = p => { const f = foreign(p); return (f.length ? f : (p.h || [])).slice(0, 3); };

  /* ---------- liens vers la source exacte ---------- */
  function deepLink(b, pr) {
    if (!b || !b.url) return "";
    const u = b.url.split("#")[0];
    const m = /p\.\s*(\d+)/.exec((pr && pr.loc) || "");
    if (/\.pdf($|\?)/i.test(u)) return m ? u + "#page=" + m[1] : u;
    if (pr && pr.cit && !pr.tab && !pr.sub) {
      const words = pr.cit.replace(/[«»"“”…]/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 6).join(" ");
      if (words) return u + "#:~:text=" + encodeURIComponent(words);
    }
    return b.url;
  }
  const year = d => String(d || "").slice(0, 4);
  const shortSrc = b => `${esc(b.auteur.split(" (")[0])}${b.date ? ", " + esc(year(b.date)) : ""}`;
  function proof(pr) {
    const b = BIB[pr.ref]; if (!b) return "";
    const href = deepLink(b, pr);
    const head = pr.tab ? `<span class="tabx">${esc(pr.cit)}</span>` : pr.sub ? `<span class="subx">En substance : ${esc(pr.cit)}</span>` : `<q>${esc(pr.fr || pr.cit)}</q>`;
    const orig = pr.fr ? `<span class="orig">Texte original : « ${esc(pr.cit)} »</span>` : "";
    const meta = [pr.loc ? esc(pr.loc) : "", pr.tab ? "extrait de tableau" : "", pr.fr ? "traduit de l'anglais" : ""].filter(Boolean).join(", ");
    return `<li class="proof">${head}${orig}<span class="psrc">${href ? `<a class="ext" href="${esc(href)}" target="_blank" rel="noopener">${shortSrc(b)}, <i>${esc(b.titre)}</i></a>` : `${shortSrc(b)}, <i>${esc(b.titre)}</i>`}${meta ? ` (${meta})` : ""}</span></li>`;
  }
  const proofs = list => (list && list.length) ? `<ol class="proofs">${list.map(proof).join("")}</ol>` : "";
  function refLabel(id) {
    const b = BIB[id]; if (!b) return "";
    const lab = `${esc(b.auteur.split(" (")[0].split(",")[0])} (${esc(year(b.date))})`;
    return b.url ? `<a href="${esc(b.url)}" target="_blank" rel="noopener" title="${esc(b.titre)}">${lab}</a>` : `<span title="${esc(b.titre)}">${lab}</span>`;
  }
  const refList = ids => { const L = (ids || []).map(refLabel).filter(Boolean); return L.length ? `<span class="refs">${L.length > 1 ? "Sources" : "Source"} : ${L.join(", ")}</span>` : ""; };
  const fmtD = s => new Date(String(s).slice(0, 10) + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const fmtM = s => new Date(String(s).slice(0, 10) + "T12:00:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const md = v => num(String(v >= 10000 ? Math.round(v / 1000) : Math.round(v / 100) / 10));
  function money(lo, hi) {
    if (!hi) return "pas de dépense chiffrée";
    if (lo === hi) return hi >= 1000 ? `${md(hi)} Md€` : `${hi} M€`;
    if (lo >= 1000) return `${md(lo)} à ${md(hi)} Md€`;
    if (hi >= 1000) return `${lo ? lo + " M€" : "0"} à ${md(hi)} Md€`;
    return lo ? `${lo} à ${hi} M€` : `jusqu'à ${hi} M€`;
  }
  const amount = c => (c.hi && !(c.lo === c.hi && c.refs && c.refs.length) ? "≈ " : "") + money(c.lo, c.hi);
  const daysTo = s => Math.round((new Date(s + "T00:00:00") - today) / 86400000);
  $("majDate").textContent = fmtD(META.maj);

  /* ---------- niveaux ---------- */
  const byDays = d => d === INF ? 1 : d > 365 ? 2 : d > 90 ? 3 : d > 30 ? 4 : 5;
  function baseLevel(p) {
    if (p.cov !== undefined) return p.cov >= 100 ? 1 : p.cov >= 80 ? 2 : p.cov >= 50 ? 3 : (p.d !== undefined ? byDays(p.d) : 4);
    if (p.d === undefined) return 0;
    return byDays(p.d);
  }
  function level(p) { let b = baseLevel(p); if (b && p.l === 2 && b > 1 && b < 5) b++; return b; }
  const rated = p => p.d !== undefined || p.cov !== undefined;
  // une échelle commune aux jours et aux taux de couverture, pour trier les produits entre eux
  function tenue(p) {
    if (p.d !== undefined && p.cov === undefined) return p.d === INF ? 1e6 : p.d;
    const c = p.cov || 0;
    if (c >= 100) return 1e6 + c;
    if (c >= 80) return 366 + (c - 80) * 10;
    if (c >= 50) return 91 + (c - 50) * 9;
    return p.d !== undefined ? p.d : c / 50 * 90;
  }
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
    if (p.cov !== undefined) t = `La France produit ${p.k === "est" ? "environ " : ""}${p.cov} % de ce qu'elle consomme. Le produit est donc classé <b>${LVL(base)}</b> (${esc(LVS[base])}).`;
    else if (p.d === INF) t = `La production nationale ou européenne dépasse nos besoins. Le produit est donc classé <b>${LVL(1)}</b>.`;
    else t = `La France tiendrait ${p.k === "est" ? "environ " : ""}${p.d} jour${p.d > 1 ? "s" : ""}. Le produit est donc classé <b>${LVL(base)}</b> (${esc(LVS[base])}).`;
    if (p.l === 2 && base > 1 && base < 5) t += ` Comme le fournisseur s'est déjà servi de ce levier, le produit perd un niveau et passe à <b>${LVL(base + 1)}</b>.`;
    else if (p.l === 2) t += " Le fournisseur s'est déjà servi de ce levier.";
    return t;
  }

  /* ---------- normalisation et données en direct ---------- */
  const LIVE_NEWS = [];
  P.forEach((p, i) => {
    p.i = i;
    if (p.d === "auto") p.d = INF;
    if (p.live === "gaz" && LV.gaz) {
      const g = LV.gaz;
      p.d = Math.round(g.stock_twh / g.conso_moyenne_twh_j);
      p.k = "calc";
      p.src = `${g.source}, jour gazier du ${fmtD(g.jour_gazier)}`;
      p.note = `Les stockages contiennent ${num(g.stock_twh)} TWh, soit un remplissage de ${num(g.remplissage_pct)} %. ` + (p.note || "");
      p.isLive = true;
      LIVE_NEWS.push({ d: g.jour_gazier, titre: `Les stocks de gaz sont remplis à ${num(g.remplissage_pct)} %`, texte: `Ils couvriraient environ ${p.d} jours de consommation moyenne si plus rien n'entrait. Ce relevé est automatique.`, produits: [p.id], effet: "surveille", url: g.url, source: g.source, live: true });
    }
    p.lv = level(p);
    p.t = tenue(p);
    p.key = norm(`${p.n} ${p.id} ${META.familles[p.f] || ""} ${(p.h || []).map(nom).join(" ")}`);
  });
  const inst = P.filter(rated);
  const byId = {}; P.forEach(p => { byId[p.id] = p; });
  const FAM = META.familles;
  const famShare = {}; Object.keys(FAM).forEach(k => { const L = inst.filter(p => p.f === k); famShare[k] = L.length ? L.filter(p => p.lv >= 4).length / L.length : 0; });
  const FAM_ORDER = Object.keys(FAM).sort((a, b) => famShare[b] - famShare[a] || FAM[a].localeCompare(FAM[b], "fr"));
  const levelSort = (a, b) => b.lv - a.lv || (+(b.l === 2) - +(a.l === 2)) || a.t - b.t || a.n.localeCompare(b.n, "fr");

  /* ---------- comptes par pays fournisseur ---------- */
  const HOLD = {};
  inst.forEach(p => (p.h || []).forEach(h => { if (h === "FR" || h === "DIV" || h === "EU") return; (HOLD[h] = HOLD[h] || []).push(p); }));
  const HOLD_RANK = Object.entries(HOLD).sort((a, b) => b[1].length - a[1].length || nom(a[0]).localeCompare(nom(b[0]), "fr"));
  const ALLY = {};
  P.forEach(p => (p.al || []).forEach(a => a.pays.forEach(n => { const c = codeOf(n); if (!c || c === "FR" || c === "AFR") return; (ALLY[c] = ALLY[c] || new Set()).add(p); })));
  Object.keys(ALLY).forEach(c => { ALLY[c] = [...ALLY[c]]; });
  const ALLY_RANK = Object.entries(ALLY).sort((a, b) => b[1].length - a[1].length || nom(a[0]).localeCompare(nom(b[0]), "fr"));

  /* ---------- toutes les actus : vérifiées + détections automatiques ---------- */
  const NEWS = [];
  (D.actus || []).forEach(a => NEWS.push(Object.assign({ verif: true }, a)));
  LIVE_NEWS.forEach(a => NEWS.push(a));
  const auto = (LV.actus_auto && LV.actus_auto.items) || [];
  auto.forEach(a => NEWS.push({ d: a.d, titre: a.titre, texte: a.resume_ia || "", ia: !!a.resume_ia, produits: a.produits || [], effet: "auto", url: a.url, source: a.source, auto: true }));
  NEWS.sort((a, b) => String(b.d).localeCompare(String(a.d)));
  NEWS.forEach(a => {
    if (a.pays) return;
    const c = {}; (a.produits || []).forEach(id => { const p = byId[id]; if (p) foreign(p).forEach(h => { if (h !== "DIV") c[h] = (c[h] || 0) + 1; }); });
    a.pays = Object.entries(c).sort((x, y) => y[1] - x[1]).map(x => x[0]).slice(0, 3);
  });

  /* ---------- bulles « i » : explications et méthode ---------- */
  const MET = META.methodes_estimation || {}, SEU = META.seuils || {}, REM = META.remedes || {};
  const nkEst = inst.filter(p => p.k === "est").length;
  const INFO = {
    cadran: ["Comment lire le cadran", `<p>Chaque produit reçoit une note de 1 (souverain) à 5 (totalement dépendant). L'aiguille indique la moyenne des ${inst.length} produits, et le mot affiché correspond au niveau le plus proche de cette moyenne.</p><p>L'aiguille bouge quand un stock, un fournisseur ou une règle d'exportation change.</p><p><a href="#methode">Voir la méthode complète</a></p>`],
    niveaux: ["Les cinq niveaux", `<ul>${[5, 4, 3, 2, 1].map(l => `<li><b>${LVL(l)}</b> : ${esc(LVS[l])}.</li>`).join("")}</ul><p>Si le pays fournisseur s'est déjà servi de ce levier contre la France ou l'Europe, le produit perd un niveau.</p><p><a href="#methode">Voir la méthode complète</a></p>`],
    podium: ["Comment est fait ce classement", `<p>Nous rangeons les produits selon leur taux de couverture, c'est-à-dire la production française divisée par la consommation française. Un taux de 193 % veut dire que la France produit presque deux fois ce qu'elle consomme, et exporte le reste.</p><p>Seuls les produits mesurés de cette façon peuvent entrer sur le podium. Les autres produits souverains, comme l'électricité ou le lancement spatial, sont cités à côté.</p><p>Source : FranceAgriMer, bilans d'approvisionnement.</p>`],
    pays: ["Comment nous comptons", `<p>Pour chacun des cent produits, nous notons les pays qui fournissent l'essentiel de ce que la France achète, à l'origine ultime : un aimant acheté en Allemagne mais fabriqué avec des terres rares chinoises compte pour la Chine.</p><p>Un même produit peut compter pour plusieurs pays. L'Union européenne et les fournisseurs diversifiés ne sont pas comptés ici.</p>`],
    test: ["Comment nous calculons les jours de tenue", `<p>Nous additionnons les stocks publics, les stocks des entreprises et la production nationale mobilisable, puis nous divisons par la consommation vitale d'une journée.</p><p>Pour ce que la France produit en partie, nous mesurons plutôt la part des besoins couverte, en pourcentage.</p><p>Nous proposons un seuil de 90 jours : sous ce seuil, l'État devrait présenter un plan. ${nkEst} chiffres sur 100 sont des estimations, signalées par « ≈ ».</p><p><a href="#methode">Voir la méthode complète</a></p>`],
    secteurs: ["Comment lire ce graphique", `<p>Chaque barre représente tous les produits d'un secteur, découpés selon leur niveau. Les secteurs sont classés selon la part de produits dépendants ou totalement dépendants, c'est-à-dire qui tiennent moins de 90 jours.</p><p>Cliquez sur un secteur pour retrouver ses produits.</p>`],
    filieres: ["Comment lire une filière", `<p>Chaque rond est une étape de fabrication, de la mine au produit fini. Sa couleur indique notre niveau de dépendance pour cette étape, et le drapeau montre le pays qui la domine.</p><p>Les filières sont classées de la plus dépendante à la moins dépendante, selon la moyenne de leurs étapes.</p>`],
    armees: ["D'où viennent ces informations", `<p>La liste vient du rapport de la mission d'information de l'Assemblée nationale sur les dépendances de nos armées, publié en avril 2026. Le pays indiqué est celui du fournisseur principal aujourd'hui.</p><p>Le niveau est notre lecture de ce rapport : il n'existe pas de chiffre public de stock pour ces équipements. Cliquez sur une ligne pour lire le constat.</p>`],
    carte: ["Comment lire la carte", `<p><b>Les pays qui nous fournissent</b> : plus un pays est foncé, plus il fournit de produits parmi nos cent. L'épaisseur du lien vers la France suit le même nombre. Les liens de la Chine, des États-Unis et de la Russie ont leur propre couleur.</p><p><b>Les alliances possibles</b> : plus un pays est foncé, plus il revient souvent dans nos propositions de partenariat.</p><p>La projection Equal Earth respecte la surface des pays. Certains petits pays n'apparaissent qu'au cadrage Europe.</p>`],
    puissances: ["Assumé ou documenté", `<p>Un levier est « assumé » quand la puissance l'a annoncé elle-même : loi, décret, communiqué officiel ou doctrine publiée.</p><p>Il est « documenté » quand l'État français ou des chercheurs le lui attribuent, sans qu'elle le reconnaisse.</p><p>La frise place côte à côte ce que chaque puissance écrit et ce qu'elle fait.</p>`],
    moyens: ["Les six moyens de pression", `<p>Un pays peut peser sur un autre par ses matières premières, ses technologies, son droit, ses capitaux, ses récits ou ses relais politiques.</p><ul><li><b>${esc(D.matrice.statuts.act)}</b> : ce moyen a déjà servi contre la France ou l'Union.</li><li><b>${esc(D.matrice.statuts.str)}</b> : la prise existe, mais elle n'a pas encore été utilisée.</li><li><b>${esc(D.matrice.statuts.lat)}</b> : la France est peu exposée.</li></ul>`],
    europe: ["D'où viennent ces chiffres", `<p>Les chiffres viennent de la Commission européenne, de la Cour des comptes européenne, de l'Agence internationale de l'énergie et d'instituts de recherche indépendants. Chaque carte cite ses sources.</p><p>Les jauges montrent une part en pourcentage. Le trait pointillé marque l'objectif que l'Union s'était fixé, quand il existe.</p>`],
    allies: ["Comment lire ce tableau", `<p>À gauche, un achat qui renforce la dépendance : les drapeaux de gauche désignent les acheteurs, ceux de droite le fournisseur.</p><p>À droite, un pays européen qui a fait un autre choix dans le même domaine. Quand aucun contre-exemple n'existe, la case reste vide.</p>`],
    actus: ["Comment nous choisissons les actualités", `<p>Les actualités vérifiées ont été lues et sourcées par notre équipe. Les détections automatiques viennent d'un robot qui lit chaque matin des flux de presse et d'instituts : elles sont toujours marquées « à vérifier ».</p><p>Les drapeaux indiquent les pays fournisseurs des produits concernés.</p>`],
    propositions: ["Comment lire la feuille de route", `<p>Les deux mesures phares s'appliquent dès le début du mandat. Les mesures suivantes sont rangées selon le délai nécessaire pour les voter et les appliquer.</p><p>Les alliances se construisent pendant tout le mandat, produit par produit.</p>`],
    couts: ["Comment nous avons chiffré", ((META.couts || {}).methode || []).map(([t, x]) => `<p><b>${esc(t)}</b> ${esc(x)}</p>`).join("")]
  };
  const pop = $("pop"); let popBtn = null;
  function closePop() { if (popBtn) popBtn.setAttribute("aria-expanded", "false"); popBtn = null; pop.hidden = true; }
  function openPop(btn) {
    const I = INFO[btn.dataset.info]; if (!I) return;
    if (popBtn === btn) { closePop(); return; }
    closePop();
    pop.innerHTML = `<button type="button" class="x" aria-label="Fermer">×</button><h4>${esc(I[0])}</h4>${I[1]}`;
    pop.hidden = false; popBtn = btn; btn.setAttribute("aria-expanded", "true");
    const r = btn.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    let left = r.left + window.scrollX + r.width / 2 - w / 2;
    left = Math.max(16 + window.scrollX, Math.min(left, window.scrollX + document.documentElement.clientWidth - w - 16));
    let top = r.bottom + window.scrollY + 10;
    if (r.bottom + h + 20 > innerHeight && r.top > h + 20) top = r.top + window.scrollY - h - 10;
    pop.style.left = left + "px"; pop.style.top = top + "px";
    const x = pop.querySelector(".x"); if (x) x.focus({ preventScroll: true });
  }
  document.addEventListener("click", e => {
    const b = e.target.closest(".info"); if (b) { e.preventDefault(); openPop(b); return; }
    if (e.target.closest(".pop .x")) { const b0 = popBtn; closePop(); if (b0) b0.focus({ preventScroll: true }); return; }
    if (!e.target.closest(".pop")) closePop();
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && popBtn) { const b0 = popBtn; closePop(); b0.focus({ preventScroll: true }); } });
  window.addEventListener("resize", closePop);

  /* ---------- onglets (le routeur est complété plus bas) ---------- */
  const FIRST = { accueil: "accueil", test: "test", detail: "secteurs", puissances: "carte", europe: "europe", actus: "actus", propositions: "propositions", methode: "methode", sources: "sources" };
  const ALIAS = { detail: "secteurs", strategies: "puissances", leviers: "puissances", robinet: "comparaison", reussites: "reussites" };
  const router = { cur: null, first: v => FIRST[v] || v, go: () => {} };

  /* ======================================================================
     ACCUEIL
     ====================================================================== */
  (function dial() {
    const svg = $("dial"), NS = "http://www.w3.org/2000/svg";
    const cx = 180, cy = 178, r = 122;
    const pt = (a, rr) => [cx + rr * Math.cos(a * Math.PI / 180), cy - rr * Math.sin(a * Math.PI / 180)];
    const el = (t, a, parent) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); (parent || svg).appendChild(e); return e; };
    [5, 4, 3, 2, 1].forEach((l, j) => {
      const a0 = 180 - j * 36, a1 = a0 - 36;
      const [x0, y0] = pt(a0 - 1, r), [x1, y1] = pt(a1 + 1, r);
      el("path", { d: `M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}`, fill: "none", style: `stroke:var(--l${l})`, "stroke-width": 24 });
      const words = LVL(l).split(" ");
      const mid = (a0 + a1) / 2, side = mid < 40 ? "start" : mid > 140 ? "end" : "middle";
      const [lx, ly] = pt(mid, side === "middle" ? r + 28 : r + 22);
      const t = el("text", { x: lx, y: ly + 4 - (words.length - 1) * 7, "text-anchor": side, style: "fill:var(--ink-2);font-family:var(--f-body);font-size:13px;font-weight:500" });
      words.forEach((w, k) => { const s = document.createElementNS(NS, "tspan"); s.setAttribute("x", lx); if (k) s.setAttribute("dy", "14"); s.textContent = w; t.appendChild(s); });
    });
    for (let a = 0; a <= 180; a += 6) {
      const long = a % 36 === 0, [x0, y0] = pt(a, r - 16), [x1, y1] = pt(a, r - (long ? 32 : 23));
      el("line", { x1: x0, y1: y0, x2: x1, y2: y1, style: "stroke:var(--ink-3)", "stroke-width": long ? 2 : 1 });
    }
    const avg = inst.reduce((s, p) => s + p.lv, 0) / Math.max(1, inst.length);
    const ang = 18 + (avg - 1) * 36;
    const g = el("g", { id: "needle" });
    el("path", { d: `M${cx - 16} ${cy - 3} L${cx + r - 28} ${cy} L${cx - 16} ${cy + 3} Z`, style: "fill:var(--ink)" }, g);
    g.style.transformOrigin = `${cx}px ${cy}px`; g.style.transformBox = "view-box";
    if (REDUCED) g.style.transform = `rotate(${-ang}deg)`;
    else { g.style.transform = "rotate(-180deg)"; requestAnimationFrame(() => requestAnimationFrame(() => { g.style.transform = `rotate(${-ang}deg)`; })); }
    el("circle", { cx, cy, r: 10, style: "fill:var(--ink)" });
    el("circle", { cx, cy, r: 4, style: "fill:var(--surface)" });
    const state = Math.round(avg);
    const FEM = { 1: "souveraine", 2: "indépendante", 3: "résiliente", 4: "dépendante", 5: "totalement dépendante" };
    const v = $("dialVal"); v.textContent = FEM[state];
    v.style.color = lvc(state);
    $("dialNote").textContent = `La note moyenne de nos ${inst.length} produits vitaux est de ${num(avg.toFixed(1))} sur une échelle qui va de 1 (souverain) à 5 (totalement dépendant).`;
  })();

  (function spread() {
    const L = inst.slice().sort(levelSort);
    $("spreadGrid").innerHTML = L.map(p => `<button type="button" data-open="${esc(p.id)}" style="background:${lvc(p.lv)}" title="${esc(p.n)} : ${esc(valTxt(p))}, ${esc(LVL(p.lv))}" aria-label="${esc(p.n)}"></button>`).join("");
    $("spreadLegend").innerHTML = [5, 4, 3, 2, 1].map(l => { const n = inst.filter(p => p.lv === l).length; return `<li><i style="background:${lvc(l)}"></i><b>${n}</b><span>${n > 1 ? "produits sont" : "produit est"} <strong>${LVL(l).toLowerCase()}${n > 1 ? "s" : ""}</strong> <em>: ${esc(LVS[l])}</em></span></li>`; }).join("");
  })();

  (function kpis() {
    const under = inst.filter(p => p.lv >= 4).length;
    const act = inst.filter(p => p.l === 2).length;
    const next = (D.echeances || []).filter(e => !e.approx && daysTo(e.d) >= 0).sort((a, b) => a.d.localeCompare(b.d))[0];
    let cd = "";
    if (next) { const n = daysTo(next.d); cd = `<div class="kpi dark"><span class="n">${n ? "J-" + n : "Jour J"}</span>Le ${fmtD(next.d)} : ${esc(next.titre.charAt(0).toLowerCase() + next.titre.slice(1))}.</div>`; }
    $("kpis").innerHTML = `
      <div class="kpi"><span class="n" style="color:var(--l5)"><span data-count="${under}">${under}</span><small> sur 100</small></span>produits vitaux tiendraient moins de 90 jours si les importations s'arrêtaient.</div>
      <div class="kpi"><span class="n"><span data-count="${act}">${act}</span></span>produits ont déjà servi de moyen de pression : leur pays fournisseur s'en est servi contre la France ou l'Europe.</div>
      <div class="kpi"><span class="n"><span data-count="54">54</span><small> Md€</small></span>partent chaque année de France vers les clouds et les logiciels américains.</div>
      ${cd}`;
    if (REDUCED) return;
    document.querySelectorAll("#kpis [data-count]").forEach(s => {
      const to = +s.dataset.count, t0 = performance.now(), dur = 1100;
      const step = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); s.textContent = Math.round(to * e); if (k < 1) requestAnimationFrame(step); };
      s.textContent = "0"; requestAnimationFrame(step);
    });
  })();

  (function podium() {
    const top = inst.filter(p => p.cov !== undefined && p.cov >= 100).sort((a, b) => b.cov - a.cov);
    const three = top.slice(0, 3), max = three.length ? three[0].cov : 100;
    const order = [three[1], three[0], three[2]].filter(Boolean);
    $("podium").innerHTML = order.map(p => {
      const rk = three.indexOf(p) + 1, h = Math.round(70 + (p.cov - 100) / Math.max(1, max - 100) * 110 * (rk === 1 ? 1 : .85));
      return `<button type="button" class="step s${rk}" data-open="${esc(p.id)}" aria-label="${rk}e place : ${esc(p.n)}, ${p.cov} % des besoins couverts"><span class="who">${flag("FR", "lg")}<b>${esc(p.n)}</b><span>${p.cov} %</span><small>de nos besoins couverts</small></span><span class="plinth" style="height:${h}px">${rk}</span></button>`;
    }).join("") + `<span class="base"></span>`;
    const rest = inst.filter(p => p.lv === 1 && !three.includes(p)).sort((a, b) => a.n.localeCompare(b.n, "fr"));
    $("alsoGood").innerHTML = `<h3>La France est aussi souveraine pour</h3><p class="hint">Pour ces produits, la production française ou européenne dépasse nos besoins.</p><div class="chips">${rest.map(p => `<button type="button" class="tag" data-open="${esc(p.id)}"><i style="background:var(--l1)"></i>${esc(p.n)}</button>`).join("")}</div>`;
  })();

  (function homeHolders() {
    $("homeHolders").innerHTML = HOLD_RANK.slice(0, 6).map(([c, ps]) => `<button type="button" class="hh" data-holder="${c}" style="--c:${pcol(c)}"><span class="nm">${flag(c, "lg")}${esc(nom(c))}</span><span class="n">${ps.length}</span><span class="t">${ps.length > 1 ? "produits vitaux" : "produit vital"} dont ce pays est un fournisseur principal</span></button>`).join("");
  })();

  /* ======================================================================
     LES 100 PRODUITS : légende-filtre, filtres, tris, cases et barres
     ====================================================================== */
  const PAYS_OPTS = ["CN", "US", "RU", "EU", "IN", "JP", "KR"];
  const S = { fams: new Set(), lvls: new Set(), pays: null, lev: false, pub: false, q: "", sort: store.get("bd-sort") || "dep" };
  if (!["dep", "res", "fam", "pays", "az"].includes(S.sort)) S.sort = "dep";
  const qEl = $("q"), sortEl = $("sort");
  sortEl.value = S.sort;
  const paysMatch = (p, c) => c === "AUT" ? (p.h || []).some(h => !PAYS_OPTS.includes(h) && !["FR", "DIV"].includes(h)) : (p.h || []).includes(c);
  const visible = p => (!S.fams.size || S.fams.has(p.f)) && (!S.lvls.size || S.lvls.has(p.lv)) && (!S.pays || paysMatch(p, S.pays)) &&
    (!S.lev || p.l === 2) && (!S.pub || p.k !== "est") && (!S.q || p.key.includes(S.q));
  const active = () => S.fams.size || S.lvls.size || S.pays || S.lev || S.pub || S.q;
  const mainHolder = p => { const f = foreign(p).filter(h => h !== "DIV"); return f[0] || (p.h || [])[0] || "DIV"; };

  function sorted(L) {
    const A = L.slice();
    if (S.sort === "res") return A.sort((a, b) => -levelSort(a, b));
    if (S.sort === "az") return A.sort((a, b) => a.n.localeCompare(b.n, "fr"));
    return A.sort(levelSort);
  }
  function groups(L) {
    const A = sorted(L);
    if (S.sort === "dep" || S.sort === "res") {
      const ord = S.sort === "dep" ? [5, 4, 3, 2, 1] : [1, 2, 3, 4, 5];
      return ord.map(l => ({ key: "l" + l, color: lvc(l), title: LVL(l), desc: LVS[l], items: A.filter(p => p.lv === l) })).filter(g => g.items.length);
    }
    if (S.sort === "fam") return FAM_ORDER.map(f => { const it = A.filter(p => p.f === f); const bad = it.filter(p => p.lv >= 4).length; return { key: f, title: FAM[f], desc: `${bad} sur ${it.length} tiennent moins de 90 jours`, items: it }; }).filter(g => g.items.length);
    if (S.sort === "pays") {
      const m = {}; A.forEach(p => { const c = mainHolder(p); (m[c] = m[c] || []).push(p); });
      return Object.entries(m).sort((a, b) => (a[0] === "FR") - (b[0] === "FR") || (a[0] === "DIV") - (b[0] === "DIV") || b[1].length - a[1].length || nom(a[0]).localeCompare(nom(b[0]), "fr"))
        .map(([c, it]) => ({ key: c, color: pcol(c), flag: c, title: c === "FR" ? "Surtout produits en France" : c === "DIV" ? "Fournisseurs diversifiés" : nom(c), desc: c === "FR" || c === "DIV" ? "" : "premier fournisseur étranger", items: it }));
    }
    return [{ key: "all", title: "", items: A }];
  }
  function tile(p, k) {
    const a = p.k === "est" ? "≈ " : "";
    const d = p.cov !== undefined ? `${a}${p.cov}<small>%</small>` : p.d === INF ? "Autonome" : `${a}${p.d}<small>j</small>`;
    const lab = `${p.n} : ${valTxt(p)}, ${LVL(p.lv)}${p.l === 2 ? ", levier déjà activé" : ""}${p.k === "est" ? ", estimation" : ""}`;
    return `<button type="button" class="tile lv${p.lv}${p.k === "est" ? " est" : ""}${S.q ? " hit" : ""}" style="--i:${k}" data-i="${p.i}" aria-label="${esc(lab)}"><span class="top">${tileFlags(p).map(c => flag(c)).join("")}${p.l === 2 ? BOLT : ""}</span><span class="nm">${esc(p.n)}</span><span class="dy">${d}</span></button>`;
  }
  const groupHead = g => g.title ? `<div class="group-h" style="--gc:${g.color || "var(--ink)"}"><b>${g.flag ? flag(g.flag, "lg") : g.color && g.key[0] === "l" ? `<i class="sw" style="background:${g.color};width:16px;height:16px"></i>` : ""}${esc(g.title)}</b><span class="gn">${g.items.length} produit${g.items.length > 1 ? "s" : ""}</span>${g.desc ? `<span>${esc(g.desc)}</span>` : ""}</div>` : "";
  function renderWall() {
    const L = P.filter(visible);
    let k = 0;
    $("wall").innerHTML = L.length ? groups(L).map(g => `<div class="group">${groupHead(g)}<div class="wall">${g.items.map(p => tile(p, k++)).join("")}</div></div>`).join("")
      : `<p class="empty">Aucun produit ne correspond à ces filtres. <button type="button" class="reset" data-reset>Tout afficher</button></p>`;
  }
  const LOGMAX = Math.log10(1000);
  const pos = d => d === INF ? 100 : Math.max(0, Math.min(100, Math.log10(Math.max(d, 1)) / LOGMAX * 100));
  const THR = pos(META.seuil_jours);
  function lrow(p, w, thr) {
    return `<div class="frow" data-i="${p.i}" role="button" tabindex="0" aria-label="${esc(p.n)} : ${esc(valTxt(p))}"><span class="fname">${p.isLive ? '<span class="live-dot" title="Donnée en direct"></span>' : ""}${tileFlags(p).slice(0, 2).map(c => flag(c)).join("")}${esc(p.n)}${p.l === 2 ? BOLT : ""}</span><div class="track" style="--thr:${thr}%"><div class="lbar${p.k === "est" ? " est" : ""}" style="width:${w}%;background:${lvc(p.lv)};--bc:${lvc(p.lv)}"></div><span class="thr"></span></div><span class="fval">${esc(valTxt(p))}</span></div>`;
  }
  function renderLine() {
    const L = sorted(P.filter(visible));
    const days = L.filter(p => p.cov === undefined), cov = L.filter(p => p.cov !== undefined);
    const ticks = [[1, "1 jour"], [7, "1 semaine", "mid"], [30, "1 mois"], [365, "1 an"], [1000, "1 000 jours et plus"]];
    let h = "";
    if (days.length) h += `<div class="lrows"><div class="axis"><span class="cap">Produit et principaux fournisseurs</span><div class="ticks">${ticks.map(([d, l, c]) => `<span class="${c || ""}" style="left:${pos(d)}%;${d === 1 ? "transform:none" : d === 1000 ? "transform:translateX(-100%)" : ""}">${l}</span>`).join("")}<span class="thr-l" style="left:${THR}%">seuil proposé : ${META.seuil_jours} jours</span></div><span class="cap" style="text-align:right">Tenue</span></div>${days.map(p => lrow(p, p.d === 0 ? 0 : pos(p.d), THR)).join("")}</div>`;
    if (cov.length) h += `<p class="cov-h">Pour ces produits, nous mesurons la part des besoins couverte par la production française. Le trait pointillé marque 100 %.</p><div class="lrows">${cov.map(p => lrow(p, Math.min(100, p.cov / 2), 50)).join("")}</div>`;
    $("rows").innerHTML = h || `<p class="empty">Aucun produit ne correspond à ces filtres. <button type="button" class="reset" data-reset>Tout afficher</button></p>`;
  }
  function renderLegend() {
    const el = $("lvLegend");
    el.classList.toggle("filtering", S.lvls.size > 0);
    el.innerHTML = [5, 4, 3, 2, 1].map(l => { const n = inst.filter(p => p.lv === l).length; return `<button type="button" class="lg" data-lv="${l}" aria-pressed="${S.lvls.has(l)}" title="Afficher seulement ce niveau"><i style="background:${lvc(l)};color:var(--on-l${l})">${n}</i><b>${LVL(l)}</b><span>${esc(LVS[l])}</span></button>`; }).join("");
  }
  function renderChips() {
    $("famChips").innerHTML = FAM_ORDER.map(k => `<button type="button" class="chip" data-f="${k}" aria-pressed="${S.fams.has(k)}">${esc(FAM[k])} <span class="c">${P.filter(p => p.f === k).length}</span></button>`).join("");
    const opts = [...PAYS_OPTS.map(c => [c, flag(c) + esc(nom(c))]), ["AUT", "Autres pays"], ["FR", flag("FR") + "Production française"], ["DIV", flag("DIV") + "Fournisseurs diversifiés"]];
    $("paysChips").innerHTML = opts.map(([c, lab]) => { const n = P.filter(p => paysMatch(p, c)).length; return `<button type="button" class="chip" data-p="${c}" aria-pressed="${S.pays === c}">${lab} <span class="c">${n}</span></button>`; }).join("");
    $("optChips").innerHTML = `<button type="button" class="chip" data-o="lev" aria-pressed="${S.lev}">${BOLT}Levier déjà activé <span class="c">${P.filter(p => p.l === 2).length}</span></button><button type="button" class="chip" data-o="pub" aria-pressed="${S.pub}">Chiffres publiés ou calculés, sans estimation <span class="c">${P.filter(p => p.k !== "est").length}</span></button>`;
    const n = P.filter(visible).length;
    $("result").innerHTML = active() ? `<span><b>${n}</b> produit${n > 1 ? "s" : ""} sur 100 correspond${n > 1 ? "ent" : ""} à votre sélection.</span><button type="button" class="reset" data-reset>Effacer les filtres</button>` : `<span>Les <b>100</b> produits sont affichés.</span>`;
  }
  function refresh() { renderLegend(); renderChips(); renderWall(); renderLine(); }
  function resetFilters() { S.fams.clear(); S.lvls.clear(); S.pays = null; S.lev = false; S.pub = false; S.q = ""; qEl.value = ""; refresh(); }
  $("lvLegend").addEventListener("click", e => { const b = e.target.closest(".lg"); if (!b) return; const l = +b.dataset.lv; S.lvls.has(l) ? S.lvls.delete(l) : S.lvls.add(l); refresh(); });
  $("famChips").addEventListener("click", e => { const b = e.target.closest(".chip"); if (!b) return; const f = b.dataset.f; S.fams.has(f) ? S.fams.delete(f) : S.fams.add(f); refresh(); });
  $("paysChips").addEventListener("click", e => { const b = e.target.closest(".chip"); if (!b) return; S.pays = S.pays === b.dataset.p ? null : b.dataset.p; refresh(); });
  $("optChips").addEventListener("click", e => { const b = e.target.closest(".chip"); if (!b) return; S[b.dataset.o] = !S[b.dataset.o]; refresh(); });
  document.addEventListener("click", e => { if (e.target.closest("[data-reset]")) { e.preventDefault(); resetFilters(); } });
  sortEl.addEventListener("change", () => { S.sort = sortEl.value; store.set("bd-sort", S.sort); renderWall(); renderLine(); });
  const vWall = $("vWall"), vLine = $("vLine");
  function setView(v) {
    vWall.setAttribute("aria-pressed", v === "wall"); vLine.setAttribute("aria-pressed", v === "line");
    $("wallView").hidden = v !== "wall"; $("lineView").hidden = v !== "line";
    store.set("bd-view", v);
  }
  vWall.onclick = () => setView("wall"); vLine.onclick = () => setView("line");
  qEl.addEventListener("input", () => { S.q = norm(qEl.value.trim()); refresh(); });
  qEl.addEventListener("keydown", e => {
    if (e.key === "Enter") { const p = sorted(P.filter(visible))[0]; if (p && S.q) { e.preventDefault(); openSheet(p.i); } }
    if (e.key === "Escape") { qEl.value = ""; S.q = ""; refresh(); }
  });
  const focusSearch = () => { router.go("test"); setTimeout(() => qEl.focus({ preventScroll: true }), REDUCED ? 0 : 480); };
  $("searchBtn").onclick = focusSearch;
  $("keys").innerHTML = `<span>${BOLT}Le pays fournisseur s'est déjà servi de ce levier contre la France ou l'Europe.</span><span><span class="k">≈</span>Le chiffre est une estimation.</span><span>${flag("CN")}${flag("US")}Les drapeaux montrent les principaux pays fournisseurs.</span><span><span class="k">j</span>jours de tenue</span><span><span class="k">%</span>part des besoins couverte par la production française</span>`;
  // ouvre la liste filtrée sur un secteur ou un pays (depuis l'accueil, l'analyse, la carte)
  function showFiltered(o) {
    resetFilters();
    if (o.f) S.fams.add(o.f);
    if (o.pays) S.pays = PAYS_OPTS.includes(o.pays) || o.pays === "FR" || o.pays === "DIV" ? o.pays : null;
    if (o.pays && !S.pays) { S.q = norm(nom(o.pays)); qEl.value = nom(o.pays); }
    if (o.lv) S.lvls.add(o.lv);
    refresh(); setView("wall"); router.go("test");
  }
  document.addEventListener("click", e => { const b = e.target.closest("[data-holder]"); if (b) { e.preventDefault(); showFiltered({ pays: b.dataset.holder }); } });

  /* ======================================================================
     FICHE PRODUIT
     ====================================================================== */
  const sheet = $("sheet"), scrim = $("scrim");
  let lastFocus = null, cur = -1;
  function alliances(p) {
    const chip = n => { const c = codeOf(n); return `<span>${c && c !== "AFR" ? flag(c) : ""}${esc(n)}</span>`; };
    if (!p.al || !p.al.length) return `<div class="alli"><h4>Avec qui faire autrement</h4><div class="al"><p>${esc(META.pistes_alliance[p.f])}</p></div></div>`;
    return `<div class="alli"><h4>Avec qui faire autrement</h4>` + p.al.map(a => {
      const co = a.type === "codependance";
      return `<div class="al ${co ? "co" : "red"}"><span class="ty">${co ? "Co-dépendance : un échange où chacun a besoin de l'autre" : "Redondance : plusieurs fournisseurs, pour qu'aucun ne puisse nous priver seul"}</span><div class="pays">${a.pays.map(chip).join("")}</div><p>${esc(a.txt)}</p></div>`;
    }).join("") + `</div>`;
  }
  function related(p) {
    const L = NEWS.filter(a => (a.produits || []).includes(p.id)).slice(0, 4);
    if (!L.length) return "";
    return `<div class="rel"><h4>Ce qui a changé récemment</h4><ul>${L.map(a => `<li><time datetime="${esc(a.d)}">${fmtD(a.d)}</time>${a.url ? `<a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.titre)}</a>` : esc(a.titre)}${a.auto ? ' <span class="badge">à vérifier</span>' : ""}</li>`).join("")}</ul></div>`;
  }
  const order = () => { const L = sorted(P.filter(visible)); return L.length ? L : sorted(P); };
  function levBlock(p) {
    if (!p.l) return `<div class="box"><h4>Levier</h4><p>Aucun usage coercitif n'est documenté contre la France pour ce produit.</p></div>`;
    const X = p.lev || {};
    return `<div class="box lev${p.l}"><h4>${p.l === 2 ? BOLT : ""}Levier <span class="tagx ${p.l === 2 ? "red" : "amb"}">${esc(META.leviers[p.l])}</span></h4>
      <dl><dt>Par qui</dt><dd>${esc(X.qui || "Non documenté")}</dd><dt>Comment</dt><dd>${esc(X.comment || "Non documenté")}</dd>${X.quand && X.quand !== "—" ? `<dt>Quand</dt><dd>${esc(X.quand)}</dd>` : ""}<dt>${p.l === 2 ? "Effets" : "Le risque"}</dt><dd>${esc(X.effet || "Non documenté")}</dd></dl>${refList(X.refs)}</div>`;
  }
  const noteBlock = p => p.note ? `<div class="box"><h4>À savoir</h4><p>${esc(p.note)}</p></div>` : "";
  function figureSource(p) {
    if (p.k === "est" && p.estim) return `Il s'agit de notre estimation, selon la méthode « ${esc((MET[p.estim.m] || {}).nom || p.estim.m)} », détaillée plus bas.`;
    if (p.isLive) return esc(p.src);
    const pr = p.preuves && p.src_i != null ? p.preuves[p.src_i] : null;
    if (pr && BIB[pr.ref]) { const b = BIB[pr.ref], h = deepLink(b, pr); return `${h ? `<a class="ext" href="${esc(h)}" target="_blank" rel="noopener">${shortSrc(b)}, <i>${esc(b.titre)}</i></a>` : shortSrc(b)}${pr.loc ? `, ${esc(pr.loc)}` : ""}<span class="figq">${pr.tab ? esc(pr.cit) : "« " + esc(pr.fr || pr.cit) + " »"}</span>`; }
    return esc(p.src);
  }
  function estBlock(p) {
    if (p.k !== "est" || !p.estim) return "";
    const mm = MET[p.estim.m] || { nom: p.estim.m, conf: "faible" };
    return `<div class="box est"><h4>Comment nous avons estimé <span class="tagx">${esc(mm.nom)}</span><span class="conf ${esc(mm.conf)}">confiance ${esc(mm.conf)}</span></h4><p>${esc(p.estim.txt)}</p>${refList(p.estim.refs)}<p><a href="#estimations">Toutes nos méthodes d'estimation sont expliquées dans l'onglet Méthode.</a></p></div>`;
  }
  function seuilBlock(p) {
    const S0 = p.seuil && SEU[p.seuil]; if (!S0 || S0.jours >= 100) return "";
    return `<div class="seuil-box"><h4>${esc(S0.titre)}</h4><ol>${S0.points.map(([t, x, r]) => `<li><div><b>${esc(t)}</b> ${esc(x)} ${refList(r)}</div></li>`).join("")}</ol><p class="concl">${esc(S0.conclusion)}</p></div>`;
  }
  function coutBlock(p) {
    if (!p.cout || !p.cout.length) return "";
    return `<div class="box"><h4>Combien coûterait l'indépendance</h4><div class="cost-items">${p.cout.map(c => `<div class="cost-item${c.deja ? " deja" : ""}"><div class="top"><span class="tagx">${esc(REM[c.r] || c.r)}</span>${c.deja ? '<span class="tagx ok">déjà engagé</span>' : ""}</div><div class="top"><span class="amt">${amount(c)}</span><span class="per">${c.hi ? (c.per === "an" ? "par an" : "une seule fois") : ""}</span></div><p>${esc(c.txt)}</p>${refList(c.refs)}</div>`).join("")}</div><p style="margin:10px 0 0"><a href="#couts">Voir le chiffrage complet et sa méthode</a></p></div>`;
  }
  function openSheet(i) {
    const p = P[i]; if (!p) return;
    closePop();
    if (!sheet.classList.contains("on")) lastFocus = document.activeElement;
    cur = i;
    const lvl = p.lv ? `<span class="lvpill" style="background:${lvc(p.lv)};color:var(--on-l${p.lv})">${p.l === 2 ? BOLT : ""}${LVL(p.lv)}</span>` : `<span class="badge">À instruire</span>`;
    let big;
    if (p.cov !== undefined) big = `<span class="d">${p.k === "est" ? "≈ " : ""}${p.cov} %</span><span class="u">de nos besoins sont couverts par la production française.</span>`;
    else if (p.d === INF) big = `<span class="d">Autonome</span><span class="u">La France produit plus qu'elle ne consomme.</span>`;
    else big = `<span class="d">${p.k === "est" ? "≈ " : ""}${p.d}</span><span class="u">jour${p.d > 1 ? "s" : ""} de tenue si plus rien n'entrait.</span>`;
    const holders = (p.h || []).map(h => `<span>${flag(h)}${esc(nom(h))}</span>`).join("");
    const body = `<div class="big">${big}</div><span class="badge">${p.isLive ? '<span class="live-dot"></span>' : ""}${esc(META.natures[p.k])}</span>
      ${p.gens ? `<div class="gens"><p>${esc(p.gens)}</p></div>` : ""}
      <dl class="facts">
        <div><dt>Principaux fournisseurs</dt><dd><span class="flags">${holders}</span></dd></div>
        <div><dt>Notre dépendance</dt><dd>${esc(p.dep)}</dd></div>
        ${p.conc ? `<div><dt>Dans le monde</dt><dd>${esc(p.conc)}</dd></div>` : ""}
        <div><dt>Seuil légal de stock</dt><dd>${p.seuil && SEU[p.seuil] ? esc(SEU[p.seuil].court) : "Il n'y en a pas : personne n'est obligé d'en stocker."}</dd></div>
        <div><dt>D'où vient le chiffre</dt><dd>${figureSource(p)}</dd></div>
      </dl>` + levBlock(p) + noteBlock(p) + seuilBlock(p) +
      `<div class="why"><h4>Pourquoi cette note</h4>${p.pourquoi ? `<p class="recit">${esc(p.pourquoi)}</p>` : ""}<p class="rule">${explain(p)}</p>${p.preuves && p.preuves.length ? `<h4 class="ph">Les preuves, à la source</h4>${proofs(p.preuves)}` : `<p class="rule">Nous n'avons pas encore de citation publiée pour ce produit : la fiche est à compléter.</p>`}</div>` + estBlock(p) + alliances(p) + coutBlock(p) +
      (META.mesures[p.m] ? `<div class="mesure"><b>Ce que nous proposons</b>${esc(META.mesures[p.m])}</div>` : "") + related(p);
    const L = order(), k = L.indexOf(p);
    sheet.innerHTML = `<div class="sheet-bar">
        <button type="button" class="sbtn" data-act="prev" aria-label="Produit précédent" title="Précédent (flèche gauche)">‹</button>
        <button type="button" class="sbtn" data-act="next" aria-label="Produit suivant" title="Suivant (flèche droite)">›</button>
        <button type="button" class="sbtn" data-act="link" title="Copier le lien de cette fiche">Copier le lien</button>
        <span class="sp"></span>
        <button type="button" class="sbtn" data-act="close" aria-label="Fermer la fiche" title="Fermer (Échap)">×</button></div>
      <div class="sh-fam">${esc(FAM[p.f])}, produit ${k >= 0 ? k + 1 : p.i + 1} sur ${L.length}</div>
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
  function closeSheet(keepHash) {
    if (!sheet.classList.contains("on")) return;
    sheet.classList.remove("on"); sheet.setAttribute("aria-hidden", "true"); scrim.classList.remove("on");
    document.documentElement.style.overflow = "";
    cur = -1;
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    if (keepHash !== true) { try { history.replaceState(null, "", "#" + (router.cur ? router.first(router.cur) : "accueil")); } catch (e) { /* cadre restreint */ } }
  }
  sheet.addEventListener("click", e => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const a = b.dataset.act;
    if (a === "close") closeSheet();
    else if (a === "prev") step(-1);
    else if (a === "next") step(1);
    else if (a === "link") {
      const url = location.href.split("#")[0] + "#" + P[cur].id;
      const ok = () => toast("Le lien est copié.");
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
  // tout élément portant data-open="identifiant" ouvre la fiche correspondante
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-open]"); if (!t) return;
    const p = byId[t.dataset.open]; if (p) { e.preventDefault(); openSheet(p.i); }
  });

  /* ======================================================================
     ANALYSE DÉTAILLÉE
     ====================================================================== */
  const lvLegendHtml = [5, 4, 3, 2, 1].map(l => `<span><i class="sw" style="background:${lvc(l)}"></i>${LVL(l)}</span>`).join("");
  $("famLegend").innerHTML = lvLegendHtml;
  $("famBars").innerHTML = FAM_ORDER.map(k => {
    const ps = inst.filter(p => p.f === k), bad = ps.filter(p => p.lv >= 4).length;
    const seg = [5, 4, 3, 2, 1].map(l => { const n = ps.filter(p => p.lv === l).length; return n ? `<i style="width:${n / ps.length * 100}%;background:${lvc(l)}" title="${LVL(l)} : ${n}"></i>` : ""; }).join("");
    return `<button type="button" class="hbar" data-f="${k}" title="Voir les produits de ce secteur"><span class="lab">${esc(FAM[k])}</span><span class="stack">${seg}</span><span class="num"><b>${bad}</b> sur ${ps.length}</span></button>`;
  }).join("") + `<p class="foot">Le chiffre de droite compte les produits du secteur qui tiennent moins de 90 jours.</p>`;
  $("famBars").addEventListener("click", e => { const b = e.target.closest(".hbar"); if (b) showFiltered({ f: b.dataset.f }); });

  $("holderLegend").innerHTML = `<span><i class="sw" style="background:var(--cn)"></i>Chine</span><span><i class="sw" style="background:var(--us)"></i>États-Unis</span><span><i class="sw" style="background:var(--ru)"></i>Russie</span><span><i class="sw" style="background:var(--other)"></i>Autres pays</span>`;
  (function holders() {
    const top = HOLD_RANK.slice(0, 16), max = top.length ? top[0][1].length : 1;
    $("holderBars").innerHTML = top.map(([c, ps]) => `<button type="button" class="hbar" data-holder="${c}" title="Voir les produits fournis par ce pays"><span class="lab">${flag(c)}${esc(nom(c))}</span><span class="sbar-w"><span class="sbar" style="display:block;width:${ps.length / max * 100}%;background:${pcol(c)}"></span></span><span class="num"><b>${ps.length}</b> produit${ps.length > 1 ? "s" : ""}</span></button>`).join("");
  })();

  if (D.chaines && D.chaines.length) {
    const sev = c => c.etapes.reduce((s, x) => s + (x.lv || 3), 0) / c.etapes.length;
    const CH = D.chaines.slice().sort((a, b) => sev(b) - sev(a));
    let ch = store.get("bd-chain"); if (!CH.some(c => c.id === ch)) ch = CH[0].id;
    const renderChain = () => {
      $("chainTabs").innerHTML = CH.map(c => `<button type="button" data-c="${esc(c.id)}" aria-pressed="${c.id === ch}"><i style="background:${lvc(Math.round(sev(c)))}"></i>${esc(c.titre)}</button>`).join("");
      const C = CH.find(c => c.id === ch), pr = byId[C.produit];
      $("chainBody").innerHTML = `<p class="chain-intro">${esc(C.intro)}${pr ? ` <a href="#${esc(pr.id)}" data-open="${esc(pr.id)}">Ouvrir la fiche « ${esc(pr.n)} »</a>` : ""}</p><div class="bar-legend">${lvLegendHtml}</div><div class="chain">` +
        C.etapes.map((s, k) => { const cs = codesIn(s.qui); return `<div class="stage"><span class="dot"><i style="background:${lvc(s.lv || 3)};color:var(--on-l${s.lv || 3})">${k + 1}</i></span><span class="sn">${esc(s.nom)}</span><span class="sq">${cs.map(c => flag(c)).join("")}${esc(s.qui)}</span><span class="sp">${esc(s.part)}</span><span class="lvn" style="color:${lvc(s.lv || 3)}">${LVL(s.lv || 3)}</span>${refList(s.refs)}</div>`; }).join("") + `</div>`;
    };
    $("chainTabs").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; ch = b.dataset.c; store.set("bd-chain", ch); renderChain(); });
    renderChain();
  }

  if (D.zoom_armees) {
    const Z = D.zoom_armees, IT = Z.items.slice().sort((a, b) => b.lv - a.lv);
    $("zoomIntro").textContent = Z.intro;
    const cnt = {}; IT.forEach(x => (x.pays || []).forEach(c => { cnt[c] = (cnt[c] || 0) + 1; }));
    const topc = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
    const n5 = IT.filter(x => x.lv === 5).length, n4 = IT.filter(x => x.lv === 4).length;
    const NB = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix"];
    $("zoomSummary").innerHTML = `Sur <b>${IT.length}</b> équipements examinés, <b>${n5}</b> sont totalement dépendants et <b>${n4}</b> dépendants. ${topc ? `${NB[topc[1]] ? NB[topc[1]].charAt(0).toUpperCase() + NB[topc[1]].slice(1) : topc[1]} d'entre eux dépendent ${topc[0] === "US" ? "des États-Unis" : "de " + nom(topc[0])} ${flag(topc[0])}.` : ""}`;
    const SH = { 5: "Tot.", 4: "Dép.", 3: "Rés.", 2: "Ind.", 1: "Souv." };
    $("zoomChart").innerHTML = `<div class="zrow head"><span>Équipement et pays fournisseur</span>${[5, 4, 3, 2, 1].map(l => `<span data-s="${SH[l]}">${LVL(l)}</span>`).join("")}</div>` +
      IT.map((x, i) => `<div class="zrow" data-z="${i}" role="button" tabindex="0" aria-expanded="false"><span class="zq">${(x.pays || []).map(c => flag(c)).join("")}${esc(x.quoi)}</span>${[5, 4, 3, 2, 1].map(l => `<span class="zc${x.lv === l ? " on" : ""}"><i${x.lv === l ? ` style="background:${lvc(l)}"` : ""}></i></span>`).join("")}<span class="zt">${esc(x.constat)}</span></div>`).join("");
    const tog = e => { const r = e.target.closest(".zrow[data-z]"); if (!r) return; if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return; e.preventDefault(); r.classList.toggle("open"); r.setAttribute("aria-expanded", r.classList.contains("open")); };
    $("zoomChart").addEventListener("click", tog); $("zoomChart").addEventListener("keydown", tog);
    $("zoomRefs").innerHTML = `<p class="foot">Cliquez sur un équipement pour lire le constat. ${refList(Z.refs)}</p>`;
  }
  $("assets").innerHTML = D.atouts.map(([a, b]) => `<div class="asset"><b>${flag("FR")}${esc(a)}</b><span>${esc(b)}</span></div>`).join("");

  /* ======================================================================
     LA CARTE
     ====================================================================== */
  const MAP = { mode: "dep", zoom: "monde", sel: null, vb: [0, 0, CARTE.w || 960, CARTE.h || 470] };
  let setPw = () => {};
  (function mapView() {
    const svg = $("map"); if (!CARTE.pays.length) { svg.parentNode.innerHTML = `<p class="empty">La carte n'a pas pu être chargée.</p>`; return; }
    const NS = "http://www.w3.org/2000/svg", A = CARTE.ancres, W = CARTE.w, H = CARTE.h;
    const el = (t, a, parent) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); (parent || svg).appendChild(e); return e; };
    svg.setAttribute("viewBox", MAP.vb.join(" "));
    const gL = el("g", {}), gA = el("g", {}), gH = el("g", {});
    const paths = {};
    CARTE.pays.forEach(c => { paths[c.c] = el("path", { d: c.d, class: "land" + (c.c === "FR" ? " fr" : ""), "data-c": c.c }, gL); });
    const fr = A.FR;
    el("circle", { cx: fr[0], cy: fr[1], r: 4.5, class: "hub" }, gH);
    const counts = () => MAP.mode === "dep" ? HOLD : ALLY;
    const bin = n => !n ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 9 ? 3 : n <= 19 ? 4 : 5;
    const BINS = ["aucun", "1", "2 ou 3", "4 à 9", "10 à 19", "20 et plus"];
    const fillOf = n => MAP.mode === "dep" ? `var(--m${bin(n)})` : (bin(n) ? `var(--a${bin(n)})` : "var(--m0)");
    function paint() {
      const C = counts();
      Object.entries(paths).forEach(([c, p]) => { if (c === "FR") return; const n = (C[c] || []).length; p.style.fill = fillOf(n); p.classList.toggle("sel", c === MAP.sel); });
      gA.innerHTML = "";
      const rank = MAP.mode === "dep" ? HOLD_RANK : ALLY_RANK;
      rank.slice().reverse().forEach(([c, ps]) => {
        const a = A[c]; if (!a || c === "FR") return;
        const dx = fr[0] - a[0], dy = fr[1] - a[1], dist = Math.hypot(dx, dy); if (dist < 4) return;
        const mx = (a[0] + fr[0]) / 2, my = (a[1] + fr[1]) / 2, k = Math.min(.32, 14 / dist + .18);
        let nx = -dy / dist, ny = dx / dist; if (ny > 0) { nx = -nx; ny = -ny; }
        const d = `M${a[0]} ${a[1]} Q${mx + nx * dist * k} ${my + ny * dist * k} ${fr[0]} ${fr[1]}`;
        const w = MAP.mode === "dep" ? 1 + Math.sqrt(ps.length) * 1.25 : .8 + Math.sqrt(ps.length) * .7;
        const p = el("path", { d, class: "arc" + (MAP.mode === "al" ? " al" : ""), style: `stroke:${MAP.mode === "dep" ? pcol(c) : "var(--ally)"};stroke-width:${w}` }, gA);
        if (!REDUCED && MAP.mode === "dep") { const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; p.getBoundingClientRect(); p.style.transition = "stroke-dashoffset 1s var(--ease)"; requestAnimationFrame(() => { p.style.strokeDashoffset = 0; }); }
      });
      const ramp = (MAP.mode === "dep" ? [1, 2, 3, 4, 5].map(i => `var(--m${i})`) : [1, 2, 3, 4, 5].map(i => `var(--a${i})`)).map(c => `<i style="background:${c}"></i>`).join("");
      $("mapLegend").innerHTML = MAP.mode === "dep"
        ? `<span>Nombre de nos produits fournis : <span class="ramp">${ramp}</span> de 1 à 20 et plus</span><span><i class="ln" style="border-color:var(--cn)"></i>Chine</span><span><i class="ln" style="border-color:var(--us)"></i>États-Unis</span><span><i class="ln" style="border-color:var(--ru)"></i>Russie</span><span><i class="ln" style="border-color:var(--other)"></i>Autres pays</span><span><i class="sw" style="background:var(--navy)"></i>France</span>`
        : `<span>Nombre de produits pour lesquels ce pays est un partenaire possible : <span class="ramp">${ramp}</span> de 1 à 20 et plus</span><span><i class="ln d" style="border-color:var(--ally)"></i>Alliance proposée</span><span><i class="sw" style="background:var(--navy)"></i>France</span>`;
      panel();
    }
    const tagL = L => `<div class="plist">${L.slice().sort(levelSort).map(p => `<button type="button" class="tag" data-open="${esc(p.id)}"><i style="background:${lvc(p.lv)}"></i>${esc(p.n)}</button>`).join("")}</div>`;
    function panel() {
      const el2 = $("mapPanel"), c = MAP.sel;
      if (!c) {
        const rank = (MAP.mode === "dep" ? HOLD_RANK : ALLY_RANK).slice(0, 14);
        el2.innerHTML = `<h3>${MAP.mode === "dep" ? "Les pays qui nous fournissent le plus" : "Nos partenaires possibles les plus fréquents"}</h3><p class="hint">${MAP.mode === "dep" ? "Nombre de nos produits vitaux dont ce pays est un fournisseur principal." : "Nombre de produits pour lesquels nous proposons une alliance avec ce pays."}</p><ol class="rank">${rank.map(([k, ps], i) => `<li><button type="button" data-mc="${k}"><span>${i + 1}</span><span>${flag(k)} ${esc(nom(k))}</span><b>${ps.length}</b></button></li>`).join("")}</ol>`;
        return;
      }
      const h = HOLD[c] || [], a = ALLY[c] || [];
      let html = `<button type="button" class="back" data-mc="">Revenir au classement</button><h3>${flag(c, "xl")}${esc(nom(c))}</h3>`;
      if (c === "FR") html += `<p>La France est au centre de la carte : tous les liens mènent à elle.</p>`;
      if (h.length) html += `<h4>Ce pays est un fournisseur principal pour ${h.length} de nos produits vitaux.</h4>${tagL(h)}`;
      if (a.length) html += `<h4>Nous proposons une alliance avec ce pays pour ${a.length} produit${a.length > 1 ? "s" : ""}.</h4>${tagL(a)}`;
      if (!h.length && !a.length && c !== "FR") html += `<p class="hint">Ce pays n'apparaît pas encore dans le baromètre.</p>`;
      if (POW[c]) html += `<p style="margin-top:14px"><a href="#puissances" data-pw="${c}">Lire la stratégie ${c === "US" ? "des États-Unis" : c === "CN" ? "de la Chine" : "de la Russie"}, ses textes et ses leviers</a></p>`;
      else if (h.length) html += `<p style="margin-top:14px"><button type="button" class="reset" data-holder="${c}">Voir ces produits dans la liste des 100</button></p>`;
      el2.innerHTML = html;
    }
    function select(c) { MAP.sel = c || null; paint(); if (c && innerWidth < 980) $("mapPanel").scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "nearest" }); }
    $("mapPanel").addEventListener("click", e => { const b = e.target.closest("[data-mc]"); if (b) select(b.dataset.mc); const w = e.target.closest("[data-pw]"); if (w) setPw(w.dataset.pw); });
    const tip = $("mapTip"), box = svg.parentNode;
    svg.addEventListener("mousemove", e => {
      const p = e.target.closest(".land"); if (!p) { tip.hidden = true; return; }
      const c = p.dataset.c, n = (counts()[c] || []).length, r = box.getBoundingClientRect();
      tip.innerHTML = `<b>${esc(nom(c))}</b><br>${c === "FR" ? "La France" : MAP.mode === "dep" ? (n ? `Fournisseur principal pour ${n} de nos produits` : "Pas de produit fourni parmi nos cent") : (n ? `Partenaire possible pour ${n} produit${n > 1 ? "s" : ""}` : "Pas d'alliance proposée")}`;
      tip.hidden = false; tip.style.left = (e.clientX - r.left) + "px"; tip.style.top = (e.clientY - r.top) + "px";
    });
    svg.addEventListener("mouseleave", () => { tip.hidden = true; });
    svg.addEventListener("click", e => { const p = e.target.closest(".land"); if (p) select(p.dataset.c === MAP.sel ? null : p.dataset.c); });
    document.querySelectorAll("[data-mode]").forEach(b => b.addEventListener("click", () => { MAP.mode = b.dataset.mode; document.querySelectorAll("[data-mode]").forEach(x => x.setAttribute("aria-pressed", x === b)); paint(); }));
    // cadrage Europe : boîte calculée à partir de quelques pays repères
    const EU_BOX = (() => {
      const pts = ["PT", "IE", "NO", "FI", "UA", "GR", "MA", "DZ", "TR"].map(c => A[c]).filter(Boolean);
      let x0 = Math.min(...pts.map(p => p[0])) - 16, x1 = Math.max(...pts.map(p => p[0])) + 16, y0 = Math.min(...pts.map(p => p[1])) - 14, y1 = Math.max(...pts.map(p => p[1])) + 14;
      const w = x1 - x0, h = y1 - y0, ar = W / H;
      if (w / h > ar) { const nh = w / ar; y0 -= (nh - h) / 2; return [x0, y0, w, nh]; }
      const nw = h * ar; x0 -= (nw - w) / 2; return [x0, y0, nw, h];
    })();
    function zoomTo(target) {
      const from = MAP.vb.slice(), to = target === "europe" ? EU_BOX : [0, 0, W, H];
      MAP.zoom = target;
      if (REDUCED) { MAP.vb = to; svg.setAttribute("viewBox", to.join(" ")); return; }
      const t0 = performance.now(), dur = 650;
      const stepz = t => { const k = Math.min(1, (t - t0) / dur), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; MAP.vb = from.map((v, i) => v + (to[i] - v) * e); svg.setAttribute("viewBox", MAP.vb.join(" ")); if (k < 1) requestAnimationFrame(stepz); };
      requestAnimationFrame(stepz);
    }
    document.querySelectorAll("[data-zoom]").forEach(b => b.addEventListener("click", () => { document.querySelectorAll("[data-zoom]").forEach(x => x.setAttribute("aria-pressed", x === b)); zoomTo(b.dataset.zoom); }));
    paint();
  })();

  /* ======================================================================
     LES PUISSANCES : trois stratégies, textes et leviers sur une même frise
     ====================================================================== */
  const K = D.kii, ST = D.strategies, MX = D.matrice;
  const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const one = s => { const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(s.trim()); if (!m) return s; return m[3] ? `${+m[3] === 1 ? "1er" : +m[3]} ${MOIS[+m[2] - 1]} ${m[1]}` : m[2] ? `${MOIS[+m[2] - 1]} ${m[1]}` : m[1]; };
  const prettyDate = s => { s = String(s); if (s.includes("→")) { const [a, b] = s.split("→"); return `de ${one(a)} à ${one(b)}`; } if (s.includes("/")) return s.split("/").map(one).join(", puis "); return one(s); };
  const sortKey = s => { const m = /(\d{4})(?:-(\d{2}))?/.exec(String(s)); return m ? m[1] + "-" + (m[2] || "00") : "0000"; };
  const PW_ORDER = ["CN", "US", "RU"].filter(c => K && K.puissances.some(x => x.code === c));
  let pw = store.get("bd-pw") || PW_ORDER[0]; if (!PW_ORDER.includes(pw)) pw = PW_ORDER[0];
  const mxIdx = c => Object.keys(MX.puissances).indexOf(c);
  function renderPw() {
    const X = (ST.puissances || []).find(x => x.code === pw), Y = K.puissances.find(x => x.code === pw);
    $("pwTabs").innerHTML = PW_ORDER.map(c => { const y = K.puissances.find(x => x.code === c), n = (HOLD[c] || []).length; return `<button type="button" data-p="${c}" aria-pressed="${c === pw}" style="--c:${pcol(c)}">${flag(c, "lg")}<span><b>${esc(y.nom)}</b><span>${n} de nos produits, ${y.leviers.length} leviers documentés</span></span></button>`; }).join("");
    const holds = HOLD[pw] || [], ass = Y.leviers.filter(l => l.assume).length;
    const cases = MX.cases[pw] || [], nAct = cases.filter(x => x[0] === "act").length;
    const ev = [...(X ? X.textes.map(t => ({ k: "txt", d: t.date, t })) : []), ...Y.leviers.map(l => ({ k: "act", d: l.date, l }))].sort((a, b) => sortKey(a.d).localeCompare(sortKey(b.d)));
    const card = e => e.k === "txt"
      ? `<article class="ev txt"><span class="kind">Leur texte</span><span class="dt">${esc(prettyDate(e.d))}</span><h4>${esc(e.t.titre)}</h4><blockquote>${esc(e.t.citation)}</blockquote><p>${esc(e.t.lecture)}</p>${refList(e.t.refs)}</article>`
      : `<article class="ev act"><span class="kind">Leur levier</span><span class="dt">${esc(prettyDate(e.d))}</span><span class="badge">${e.l.assume ? "assumé" : "documenté"}</span><span class="badge">${esc(e.l.vecteur)}</span><h4>${esc(e.l.titre)}</h4><p>${esc(e.l.preuve)}</p><p><b>Ce que ça nous fait.</b> ${esc(e.l.effet)}</p>${refList(e.l.refs)}</article>`;
    const years = [...new Set(ev.map(e => sortKey(e.d).slice(0, 4)))];
    const tl = years.map(y => { const E = ev.filter(e => sortKey(e.d).slice(0, 4) === y); return `<div class="tly"><span class="yr">${y}</span><div class="col">${E.filter(e => e.k === "txt").map(card).join("")}</div><div class="col">${E.filter(e => e.k === "act").map(card).join("")}</div></div>`; }).join("");
    $("pwBody").innerHTML = `<div class="pw" style="--c:${pcol(pw)}">
      <div class="pw-band">${flag(pw, "xl")}<p class="these">${esc(X ? X.these : Y.resume)}<small>Notre lecture de sa stratégie, à partir de ses propres textes. ${esc(Y.resume)}</small></p></div>
      <div class="pw-stats"><div><b>${holds.length}</b>de nos cent produits vitaux dépendent en partie de ce pays.</div><div><b>${Y.leviers.length}</b>leviers de pression sont documentés, dont ${ass} assumé${ass > 1 ? "s" : ""} publiquement par ${pw === "US" ? "Washington" : pw === "CN" ? "Pékin" : "Moscou"}.</div><div><b>${nAct} sur 6</b>moyens de pression ont déjà été utilisés contre la France ou l'Union.</div></div>
      <div class="pw-grid">
        <div><div class="tl-head"><span>Ce qu'ils écrivent</span><span>Ce qu'ils font</span></div><div class="tl">${tl}</div></div>
        <aside class="pw-side">
          <div class="panel"><h4>Ses moyens de pression</h4><div class="vecs">${MX.vecteurs.map((v, i) => { const x = cases[i]; return x ? `<div class="vec"><span>${esc(v[0])}</span><span class="st ${x[0]}">${esc(MX.statuts[x[0]])}</span></div>` : ""; }).join("")}</div><p class="foot"><a href="#comparaison">Comparer avec les autres puissances</a></p></div>
          ${X && X.experts && X.experts.length ? `<div class="panel"><h4>Ce qu'en disent les chercheurs</h4><ul>${X.experts.map(e => `<li>${esc(e.idee)} ${refList(e.refs)}</li>`).join("")}</ul></div>` : ""}
          ${X && X.faille ? `<div class="panel faille"><h4>Son point faible, notre levier</h4><p>${esc(X.faille)}</p>${refList(X.faille_refs)}</div>` : ""}
          ${holds.length ? `<div class="panel"><h4>Les produits qu'il nous fournit</h4>${tagList(holds.slice().sort(levelSort).slice(0, 14))}${holds.length > 14 ? `<p class="foot"><button type="button" class="reset" data-holder="${pw}">Voir les ${holds.length} produits</button></p>` : ""}</div>` : ""}
        </aside>
      </div></div>`;
  }
  function tagList(L) { return `<div class="plist">${L.map(p => `<button type="button" class="tag" data-open="${esc(p.id)}"><i style="background:${lvc(p.lv)}"></i>${esc(p.n)}</button>`).join("")}</div>`; }
  if (K && ST) {
    $("stratIntro").textContent = "Pékin, Washington et Moscou écrivent leurs intentions dans des discours, des lois et des stratégies officielles. Pour chaque puissance, nous plaçons sur une même frise ce qu'elle écrit et ce qu'elle fait.";
    setPw = c => { if (!PW_ORDER.includes(c)) return; pw = c; store.set("bd-pw", pw); renderPw(); };
    $("pwTabs").addEventListener("click", e => { const b = e.target.closest("button[data-p]"); if (b) setPw(b.dataset.p); });
    document.addEventListener("click", e => { const w = e.target.closest("a[data-pw]"); if (w) setPw(w.dataset.pw); });
    renderPw();
  }
  (function heat() {
    const mo = PW_ORDER.filter(c => MX.cases[c]);
    $("heatLegend").innerHTML = Object.entries(MX.statuts).map(([k, v]) => `<span><span class="st ${k}">${esc(v)}</span></span>`).join("");
    $("heat").innerHTML = `<thead><tr><th scope="col"><span class="sr">Moyen de pression</span></th>${mo.map(c => `<th scope="col" style="--c:${pcol(c)}"><span>${flag(c, "lg")}${esc(MX.puissances[c])}</span></th>`).join("")}</tr></thead><tbody>` +
      MX.vecteurs.map((v, i) => `<tr><th scope="row">${esc(v[0])}<small>${esc(v[1])}</small></th>${mo.map(c => { const [s, t] = MX.cases[c][i]; return `<td class="${s}"><b>${esc(MX.statuts[s])}</b>${esc(t)}</td>`; }).join("")}</tr>`).join("") + `</tbody>`;
  })();

  /* ======================================================================
     EUROPE ET ALLIÉS
     ====================================================================== */
  if (D.europe) {
    const TH = ["Énergie", "Matières et industrie", "Numérique", "Défense", "Droit et riposte"];
    const th = [...new Set([...TH, ...D.europe.map(e => e.theme || "Autres")])];
    $("euGrid").innerHTML = th.map(t => {
      const L = D.europe.filter(e => (e.theme || "Autres") === t).sort((a, b) => ((b.jauge || {}).v || 0) - ((a.jauge || {}).v || 0));
      if (!L.length) return "";
      return `<div class="eu-theme"><h3>${esc(t)}</h3><div class="eu-grid">${L.map(c => `<article class="eu"><span class="big">${esc(c.chiffre)}</span><h4>${esc(c.titre.charAt(0).toUpperCase() + c.titre.slice(1))}</h4>${c.jauge ? `<div class="gauge" role="img" aria-label="${esc(c.jauge.lab)} : ${num(c.jauge.v)} %"><i style="width:${c.jauge.v}%"></i>${c.jauge.cible ? `<em style="left:${c.jauge.cible}%" title="Objectif : ${c.jauge.cible} %"></em>` : ""}</div><span class="gauge-l">${esc(c.jauge.lab.charAt(0).toUpperCase() + c.jauge.lab.slice(1))}</span>` : ""}<p>${esc(c.texte)}</p>${refList(c.refs)}</article>`).join("")}</div></div>`;
    }).join("");
  }
  if (D.allies) {
    const doms = [...new Set(D.allies.map(a => a.domaine))];
    const fl = L => (L || []).map(c => c === "CPI" ? `<span class="cpi" title="Cour pénale internationale">CPI</span>` : flag(c)).join("");
    const card = a => {
      const ok = a.sens === "contre-exemple";
      return `<div class="choice${ok ? " ok" : ""}"><span class="lab">${ok ? "Ils font un autre choix" : "Ils renforcent la dépendance"}</span><div class="flow"><span class="flags">${fl(a.acheteurs)}</span>${a.n ? `<span class="hint" style="margin:0">${a.n} pays au départ</span>` : ""}<span class="ar" aria-hidden="true">→</span><span class="flags">${fl(a.fournisseurs)}</span><span class="ch">${esc(a.choix || "")}</span></div>${a.part ? `<div class="part"><b>${num(a.part)} %</b><span class="gauge"><i style="width:${a.part}%;background:${ok ? "var(--l1)" : "var(--l4)"}"></i></span></div>` : ""}<p>${esc(a.comportement)}</p><p class="cout">${esc(a.cout)}</p>${a.contre ? `<p class="cout">Ceux qui ont acheté le Rafale : <span class="flags">${fl(a.contre)}</span></p>` : ""}${refList(a.refs)}</div>`;
    };
    $("allyList").innerHTML = doms.map(d => {
      const L = D.allies.filter(a => a.domaine === d), dep = L.filter(a => a.sens !== "contre-exemple"), ok = L.filter(a => a.sens === "contre-exemple");
      return `<div class="arow"><div class="dom">${esc(d)}</div><div>${dep.map(card).join("") || `<div class="choice none">Pas d'achat dépendant relevé.</div>`}</div><div>${ok.map(card).join("") || `<div class="choice none">Nous n'avons pas encore trouvé de pays européen qui fasse autrement.</div>`}</div></div>`;
    }).join("");
  }

  /* ======================================================================
     ACTUALITÉS ET ÉCHÉANCES
     ====================================================================== */
  (function actus() {
    const EFF = { aggrave: "La situation s'aggrave", ameliore: "La situation s'améliore", surveille: "À surveiller", auto: "Détection automatique" };
    const FILTERS = [["all", "Toutes"], ["verif", "Vérifiées"], ["aggrave", "La situation s'aggrave"], ["ameliore", "La situation s'améliore"], ["surveille", "À surveiller"], ["auto", "Détections automatiques"]];
    const match = (a, f) => f === "all" || (f === "verif" ? !!a.verif : f === "auto" ? !!a.auto : a.effet === f);
    let f = "all", shown = 8;
    const item = a => {
      const tags = (a.produits || []).map(id => byId[id]).filter(Boolean).map(p => `<button type="button" class="tag" data-open="${esc(p.id)}"><i style="background:${lvc(p.lv)}"></i>${esc(p.n)}</button>`).join("");
      const src = a.refs && a.refs.length ? refList(a.refs) : a.url ? `<span class="refs">Source : <a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.source || "lien")}</a></span>` : "";
      const txt = a.texte ? `<p>${a.ia ? '<span class="badge">Résumé automatique, à vérifier</span> ' : ""}${esc(a.texte)}</p>` : "";
      return `<li class="${a.auto ? "auto" : ""}"><time datetime="${esc(a.d)}">${fmtD(a.d)}</time><div><div class="meta"><span class="eff ${esc(a.effet)}">${a.live ? '<span class="live-dot"></span>' : ""}${EFF[a.effet] || ""}</span>${(a.pays || []).length ? `<span class="flags">${a.pays.map(c => flag(c)).join("")}</span>` : ""}${a.auto ? '<span class="badge">à vérifier</span>' : ""}</div><span class="ti">${a.auto && a.url ? `<a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.titre)}</a>` : esc(a.titre)}</span>${txt}${src}${tags ? `<div class="tags">${tags}</div>` : ""}</div></li>`;
    };
    const render = () => {
      $("actuChips").innerHTML = FILTERS.map(([k, v]) => { const n = NEWS.filter(a => match(a, k)).length; return (k === "auto" && !n) ? "" : `<button type="button" class="chip" data-a="${k}" aria-pressed="${k === f}">${esc(v)} <span class="c">${n}</span></button>`; }).join("");
      const L = NEWS.filter(a => match(a, f));
      $("feed").innerHTML = L.slice(0, shown).map(item).join("") || `<li><span></span><div><p>Il n'y a rien dans cette catégorie pour l'instant.</p></div></li>`;
      const more = $("feedMore"); more.hidden = L.length <= shown; more.textContent = `Voir les ${Math.min(8, L.length - shown)} actualités suivantes`;
    };
    $("actuChips").addEventListener("click", e => { const b = e.target.closest(".chip"); if (!b) return; f = b.dataset.a; shown = 8; render(); });
    $("feedMore").onclick = () => { shown += 8; render(); };
    render();

    const E = (D.echeances || []).slice().filter(e => daysTo(e.d) >= -30).sort((a, b) => a.d.localeCompare(b.d));
    if (!E.length) return;
    const t0 = today.getTime(), t1 = new Date(E[E.length - 1].d + "T00:00:00").getTime() + 40 * 86400000;
    const x = d => Math.max(2, Math.min(98, (new Date(d + "T00:00:00").getTime() - t0) / (t1 - t0) * 100));
    const yrs = []; for (let y = today.getFullYear() + 1; y <= new Date(t1).getFullYear(); y++) yrs.push(y);
    $("timeline").innerHTML = `<span class="rail"></span><span class="now" style="left:0;transform:none">Aujourd'hui</span>${yrs.map(y => `<span class="yr" style="left:${x(y + "-01-01")}%">${y}</span>`).join("")}` +
      E.map((e, i) => `<span class="pt${e.approx ? " approx" : ""}" style="left:${x(e.d)}%" title="${esc(e.titre)}"><b>${i + 1}</b></span>`).join("");
    $("deadlines").innerHTML = E.map(e => {
      const n = daysTo(e.d);
      const j = n < 0 ? "Passée" : e.approx ? `≈ ${Math.max(1, Math.round(n / 30.4))} mois` : n === 0 ? "Aujourd'hui" : `J-${n}`;
      return `<li class="${e.approx ? "approx" : ""}"><span class="j">${j}<small>${e.approx ? "vers " + fmtM(e.d) : "le " + fmtD(e.d)}</small></span><div><b>${(e.pays || []).map(c => flag(c)).join("")}${esc(e.titre)}</b><span class="d">${esc(e.detail)}</span>${refList(e.refs)}</div></li>`;
    }).join("");
  })();

  /* ======================================================================
     PROPOSITIONS ET COÛTS
     ====================================================================== */
  (function roadmap() {
    const L = D.propositions || [];
    const flag1 = L.filter(x => x[3]);
    const LANES = [["0-18 mois", "Dans les dix-huit premiers mois", "1"], ["18 mois-5 ans", "De dix-huit mois à cinq ans", "2"], ["Alliances", "Tout au long du mandat", "∞"]];
    $("props").innerHTML = `<div class="flagship">${flag1.map(x => `<div><small>Mesure phare, dès le début du mandat</small><b>${esc(x[1])}</b><span>${esc(x[2])}</span></div>`).join("")}</div>
      <div class="lanes">${LANES.map(([k, t, n]) => { const it = L.filter(x => !x[3] && x[0] === k); return `<div class="lane${k === "Alliances" ? " all" : ""}"><h3><i>${n}</i>${esc(t)}</h3>${it.map(x => `<div class="pp"><b>${esc(x[1])}</b><span>${esc(x[2])}</span></div>`).join("")}</div>`; }).join("")}</div>`;
  })();
  (function costs() {
    const C0 = META.couts; if (!C0) return;
    $("coutIntro").textContent = C0.intro;
    const sum = (items, per, deja) => items.filter(x => x.c.per === per && !!x.c.deja === deja).reduce((a, x) => [a[0] + x.c.lo, a[1] + x.c.hi], [0, 0]);
    const all = P.flatMap(p => (p.cout || []).map(c => ({ p, c })));
    const fams = Object.entries(FAM).map(([k, v]) => { const items = all.filter(x => x.p.f === k); return { k, v, items, u: sum(items, "u", false), an: sum(items, "an", false), deja: sum(items, "u", true) }; }).sort((a, b) => b.u[1] - a.u[1] || b.u[0] - a.u[0]);
    const T = { u: sum(all, "u", false), an: sum(all, "an", false), deja: sum(all, "u", true) };
    const cmp = (C0.comparateurs || [])[0];
    $("costTotals").innerHTML = `
      <div><span class="n">≈ ${money(T.u[0], T.u[1])}</span>Il faudrait investir cette somme une seule fois pour que les cent produits tiennent au moins 100 jours.</div>
      <div><span class="n">≈ ${money(T.an[0], T.an[1])}</span>Il faudrait ensuite payer chaque année l'entretien des stocks, les contrats et les prix garantis.</div>
      <div><span class="n" style="color:var(--l1)">≈ ${money(T.deja[0], T.deja[1])}</span>Ces fonds sont déjà engagés dans des usines en construction ou achevées, comme celles d'Orano, de Verkor, d'Eurenco ou de Caremag.</div>
      ${cmp ? `<div><span class="n" style="color:var(--l5)">${esc(cmp.val)}</span>C'est ce qu'ont coûté les ${esc(cmp.lab.charAt(0).toLowerCase() + cmp.lab.slice(1))} : le prix de l'imprévoyance.</div>` : ""}`;
    $("costLegend").innerHTML = `<span><i class="sw" style="background:var(--navy)"></i>Bas de la fourchette</span><span><i class="sw" style="background:color-mix(in srgb,var(--navy) 28%,var(--surface))"></i>Haut de la fourchette</span>`;
    const max = Math.max(...fams.map(f => f.u[1]), 1);
    let sel = fams[0].k;
    const renderFams = () => {
      $("costFams").innerHTML = fams.map(f => `<button type="button" class="rbar" data-cf="${f.k}" aria-pressed="${f.k === sel}"><span class="lab">${esc(f.v)}</span><span class="rtrack"><i class="hi" style="width:${f.u[1] / max * 100}%"></i><i class="lo" style="width:${f.u[0] / max * 100}%"></i></span><span class="num">${f.u[1] ? "≈ " + money(f.u[0], f.u[1]) : "non chiffré"}</span></button>`).join("");
      const F = fams.find(f => f.k === sel);
      const rows = F.items.slice().sort((a, b) => (+!!a.c.deja - +!!b.c.deja) || b.c.hi - a.c.hi);
      $("costDetail").innerHTML = `<h3>${esc(F.v)} <small>Investissement : ≈ ${money(F.u[0], F.u[1])}. Coût annuel : ${F.an[1] ? "≈ " + money(F.an[0], F.an[1]) + " par an" : "non chiffré"}.${F.deja[1] ? " Déjà engagé : " + money(F.deja[0], F.deja[1]) + "." : ""}</small></h3>
        <div class="ctable-scroll"><table class="ctable"><thead><tr><th>Produit</th><th>Remède</th><th>Montant</th><th>Comment nous l'obtenons</th></tr></thead><tbody>${rows.map(({ p, c }) => `<tr class="${c.deja ? "deja" : ""}"><td><button type="button" class="lnk" data-open="${esc(p.id)}">${esc(p.n)}</button></td><td>${esc(REM[c.r] || c.r)}${c.deja ? ' <span class="tagx ok">engagé</span>' : ""}</td><td class="amt">${amount(c)}${c.hi ? (c.per === "an" ? " par an" : "") : ""}</td><td class="txt">${esc(c.txt)} ${refList(c.refs)}</td></tr>`).join("")}</tbody></table></div>`;
    };
    $("costFams").addEventListener("click", e => { const b = e.target.closest(".rbar"); if (!b) return; sel = b.dataset.cf; renderFams(); });
    renderFams();
    $("costCompare").innerHTML = `<div class="cmp">${(C0.comparateurs || []).map(c => `<div><span>${esc(c.lab)}</span><b>${esc(c.val)}</b>${refList(c.refs)}</div>`).join("")}</div>`;
    router.totalCost = T;
  })();

  /* ======================================================================
     MÉTHODE ET SOURCES
     ====================================================================== */
  $("scale").innerHTML = [5, 4, 3, 2, 1].map(l => `<div><span class="pill" style="background:${lvc(l)};color:var(--on-l${l})">${LVL(l)}</span><span>${esc(LVS[l].charAt(0).toUpperCase() + LVS[l].slice(1))}</span></div>`).join("");
  (function estimations() {
    const ORDER = ["crise", "filiere", "production", "numerique", "usage", "analogie", "defense", "hypothese"].filter(m => MET[m]);
    const used = m => P.filter(p => p.k === "est" && p.estim && p.estim.m === m);
    $("estIntro").textContent = `${nkEst} notes sur 100 reposent sur une estimation, affichée « ≈ ». Voici nos méthodes, de la plus solide à la plus fragile. Chaque fiche dit laquelle a servi et avec quelles sources. Les estimations de confiance faible sont les premières que nous voulons remplacer par un chiffre publié.`;
    $("estGrid").innerHTML = ORDER.map(m => { const L0 = used(m), mm = MET[m]; return `<article class="est"><h3>${esc(mm.nom)} <span class="conf ${esc(mm.conf)}">confiance ${esc(mm.conf)}</span></h3><p>${esc(mm.desc)}</p><span class="count">Cette méthode sert pour ${L0.length} produit${L0.length > 1 ? "s" : ""}.</span>${tagList(L0)}</article>`; }).join("");
  })();
  (function health() {
    const cells = [];
    const nk = k => inst.filter(p => p.k === k).length;
    cells.push(`<div class="hcell"><b>Les cent produits</b><span class="ok">${inst.length} sont notés</span> : ${nk("src")} sur une donnée publiée, ${nk("calc")} par un calcul, et <span class="na">${nk("est")} par une estimation</span>.</div>`);
    const g = LV.gaz;
    cells.push(`<div class="hcell"><b>Gaz, relevé quotidien</b>${g ? `Les stocks étaient remplis à <span class="${daysTo(g.jour_gazier) > -4 ? "ok" : "ko"}">${num(g.remplissage_pct)} %</span> le ${fmtD(g.jour_gazier)} (${esc(g.collecte || g.source)}).` : '<span class="na">Le premier relevé n\'a pas encore eu lieu.</span>'}</div>`);
    const el = LV.electricite;
    cells.push(`<div class="hcell"><b>Électricité, RTE</b>${el ? `La France était <span class="ok">${el.solde_exportateur_gwh > 0 ? "exportatrice" : "importatrice"}</span>, avec un solde de ${Math.round(Math.abs(el.solde_exportateur_gwh)).toLocaleString("fr-FR")} GWh sur sept jours (au ${fmtD(el.fin)}).` : '<span class="na">Le premier relevé aura lieu au prochain passage du robot.</span>'}</div>`);
    const ve = LV.veille_etat;
    if (ve) { const v = Object.values(ve), ok = v.filter(x => x.statut === "ok").length; cells.push(`<div class="hcell"><b>Veille automatique</b>Le robot a lu <span class="${ok === v.length ? "ok" : "ko"}">${ok} flux sur ${v.length}</span> et repéré ${auto.length} articles, tous à vérifier.</div>`); }
    else cells.push(`<div class="hcell"><b>Veille automatique</b><span class="na">Le robot lira chaque matin des flux de presse et d'instituts.</span></div>`);
    const se = LV.sources_etat;
    if (se) { const v = Object.values(se), ok = v.filter(x => x.statut !== "à vérifier").length; cells.push(`<div class="hcell"><b>Liens de la bibliothèque</b><span class="${ok === v.length ? "ok" : "ko"}">${ok} liens sur ${v.length}</span> répondent. Le contrôle a lieu chaque lundi.</div>`); }
    else cells.push(`<div class="hcell"><b>Liens de la bibliothèque</b>La bibliothèque compte <span class="na">${(D.bibliographie || []).length} sources</span>, contrôlées automatiquement chaque lundi.</div>`);
    $("health").innerHTML = cells.join("");
  })();
  $("pipe").innerHTML = `<thead><tr><th>Source</th><th>Ce que nous en tirons</th><th>Rythme</th><th>Automatisable</th></tr></thead><tbody>` +
    D.sources.map(r => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`).join("") + `</tbody>`;

  if (D.bibliographie) {
    let bt = "all", bq = "";
    const SE = LV.sources_etat || {};
    const counts = {}; D.bibliographie.forEach(b => { counts[b.type] = (counts[b.type] || 0) + 1; b.key = norm(`${b.auteur} ${b.titre} ${b.apport} ${b.date}`); });
    const bo = ["institution", "parlement", "doctrine", "expertise", "donnees", "ong", "programme", "presse"].filter(t => counts[t]);
    const cited = {};
    P.forEach(p => {
      const ids = new Set([...(p.preuves || []).map(x => x.ref), ...((p.lev || {}).refs || []), ...((p.estim || {}).refs || []), ...(p.cout || []).flatMap(c => c.refs || [])]);
      ids.forEach(r => { (cited[r] = cited[r] || []).push(p); });
    });
    const citedIn = b => { const L = cited[b.id]; if (!L || !L.length) return ""; return `<span class="cited">Cette source sert dans ${L.length} fiche${L.length > 1 ? "s" : ""} : ${L.slice(0, 8).map(p => `<button type="button" class="tag" data-open="${esc(p.id)}">${esc(p.n)}</button>`).join("")}${L.length > 8 ? ` <span>et ${L.length - 8} autres</span>` : ""}</span>`; };
    const lk = b => { const s = SE[b.id]; if (!s) return ""; return s.statut === "à vérifier" ? `<span class="lk ko">Le lien est à vérifier (${esc(s.code)}).</span>` : `<span class="lk">Lien vérifié le ${fmtD(s.verifie)}.</span>`; };
    const renderBib = () => {
      $("bibChips").innerHTML = [["all", "Toutes", D.bibliographie.length], ...bo.map(t => [t, TYPES[t], counts[t]])].map(([k, v, n]) => `<button type="button" class="chip" data-t="${k}" aria-pressed="${k === bt}">${esc(v)} <span class="c">${n}</span></button>`).join("");
      const list = D.bibliographie.filter(b => (bt === "all" || b.type === bt) && (!bq || b.key.includes(bq))).slice().sort((a, b) => bo.indexOf(a.type) - bo.indexOf(b.type) || String(b.date).localeCompare(String(a.date)));
      $("bibList").innerHTML = list.map(b => `<li id="ref-${esc(b.id)}"><span class="bt ${b.type}">${TYPES[b.type] || b.type}</span><div><span class="ba">${esc(b.auteur)}, ${esc(year(b.date))}</span>${b.url ? `<a class="bti ext" href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.titre)}</a>` : `<span class="bti">${esc(b.titre)}</span>`}<p>${esc(b.apport)}</p>${citedIn(b)}${lk(b)}</div></li>`).join("") || `<li><span></span><div><p>Aucune source ne correspond à cette recherche.</p></div></li>`;
    };
    $("bibChips").addEventListener("click", e => { const b = e.target.closest(".chip"); if (!b) return; bt = b.dataset.t; renderBib(); });
    $("bq").addEventListener("input", e => { bq = norm(e.target.value.trim()); renderBib(); });
    renderBib();
  }

  /* ---------- accueil : les portes d'entrée ---------- */
  (function cards() {
    const under = inst.filter(p => p.lv >= 4).length;
    const T = router.totalCost;
    const C1 = [
      ["test", "Les 100 produits", "Combien de jours la France tiendrait sans importations, produit par produit.", `${under} produits tiennent moins de 90 jours.`],
      ["detail", "Analyse détaillée", "Les secteurs, les pays fournisseurs, sept filières et nos armées.", `${(D.chaines || []).length} filières examinées étape par étape.`],
      ["puissances", "Les puissances", "La carte de nos dépendances, et les stratégies de Pékin, Washington et Moscou.", `${HOLD_RANK.length} pays fournisseurs sur la carte.`],
      ["europe", "Europe et alliés", "Ce que la dépendance coûte à l'Europe, et ce que choisissent nos voisins.", `${(D.allies || []).length} choix d'achat comparés.`],
      ["actus", "Actualités", "Ce qui a changé ces dernières semaines, et les prochaines échéances.", `${NEWS.length} actualités publiées.`],
      ["propositions", "Propositions", "Nos mesures dans l'ordre, et le coût de l'indépendance.", T ? `≈ ${money(T.u[0], T.u[1])} d'investissement.` : ""],
      ["methode", "Méthode", "La règle de calcul, les cinq niveaux, et nos méthodes d'estimation.", `${nkEst} estimations signalées.`],
      ["sources", "Sources", "Rapports officiels, travaux de chercheurs, et textes des puissances elles-mêmes.", `${(D.bibliographie || []).length} sources consultables.`],
    ];
    $("cards").innerHTML = C1.map(([v, b, t, f]) => `<a class="card" href="#${router.first(v)}"><b>${esc(b)}</b><span class="t">${esc(t)}</span><span class="fig">${f}</span></a>`).join("");
  })();

  refresh();
  setView(store.get("bd-view") === "line" ? "line" : "wall");
  effects();

  /* ---------- routeur : une rubrique à la fois, transitions douces ---------- */
  (function routing() {
    const VIEWS = [...document.querySelectorAll(".view")];
    const NAMES = VIEWS.map(v => v.dataset.view);
    const tabs = $("tabs"), ink = $("tabInk");
    const tabOf = n => tabs.querySelector(`[data-tab="${n}"]`);
    const moveInk = smooth => {
      const a = tabOf(router.cur); if (!a || !ink) return;
      if (!smooth) ink.style.transition = "none";
      ink.style.width = a.offsetWidth + "px"; ink.style.transform = `translateX(${a.offsetLeft}px)`;
      if (!smooth) { void ink.offsetWidth; ink.style.transition = ""; }
      const left = a.offsetLeft - (tabs.clientWidth - a.offsetWidth) / 2;
      tabs.scrollTo({ left, behavior: smooth && !REDUCED ? "smooth" : "auto" });
    };
    VIEWS.forEach((v, i) => {
      const nav = v.querySelector(".view-nav"); if (!nav) return;
      const pv = VIEWS[i - 1], nx = VIEWS[i + 1];
      nav.innerHTML = (pv ? `<a class="prev" href="#${router.first(pv.dataset.view)}"><span>Rubrique précédente</span><b>${esc(pv.dataset.title)}</b></a>` : "") +
        (nx ? `<a class="next" href="#${router.first(nx.dataset.view)}"><span>Rubrique suivante</span><b>${esc(nx.dataset.title)}</b></a>` : "");
    });
    function show(name, target) {
      closePop();
      const v = VIEWS.find(x => x.dataset.view === name) || VIEWS[0];
      const prev = VIEWS.find(x => x.dataset.view === router.cur);
      const scrollTo = () => {
        const el = target && target !== router.first(v.dataset.view) ? $(target) : null;
        if (el) el.scrollIntoView({ block: "start" }); else window.scrollTo(0, 0);
      };
      if (prev === v) {
        const el = target && target !== router.first(name) ? $(target) : null;
        if (el) el.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" });
        else window.scrollTo({ top: 0, behavior: REDUCED ? "auto" : "smooth" });
        return;
      }
      const back = prev && NAMES.indexOf(name) < NAMES.indexOf(prev.dataset.view);
      const swap = () => {
        VIEWS.forEach(x => { x.hidden = x !== v; });
        router.cur = v.dataset.view;
        tabs.querySelectorAll("a").forEach(a => a.removeAttribute("aria-current"));
        const cura = tabOf(router.cur); if (cura) cura.setAttribute("aria-current", "page");
        document.title = (v.dataset.view === "accueil" ? "" : v.dataset.title + ", ") + "Baromètre des dépendances";
        scrollTo();
        moveInk(!!prev);
      };
      if (!prev || REDUCED) { swap(); return; }
      if (document.startViewTransition) {
        document.documentElement.classList.toggle("vt-back", !!back);
        document.startViewTransition(swap);
      } else {
        swap();
        v.classList.remove("enter", "back"); void v.offsetWidth;
        v.classList.add("enter"); if (back) v.classList.add("back");
      }
    }
    let lastH = null;
    function route(raw) {
      let h = decodeURIComponent(String(raw || "").replace(/^#/, ""));
      if (ALIAS[h]) h = ALIAS[h];
      lastH = "#" + h;
      if (h && byId[h]) {
        if (!router.cur || router.cur === "accueil") show("test");
        openSheet(byId[h].i); return;
      }
      if (sheet.classList.contains("on")) closeSheet(true);
      const el = h ? $(h) : null;
      const v = el ? el.closest(".view") : null;
      if (v) {
        show(v.dataset.view, h);
        if (h.startsWith("ref-")) { el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }
        return;
      }
      show(router.cur || "accueil");
    }
    router.go = (name, target) => { const id = target || router.first(name); try { history.pushState(null, "", "#" + id); } catch (e) { /* cadre restreint */ } route(id); };
    document.addEventListener("click", e => {
      const a = e.target.closest('a[href^="#"]'); if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
      const h = a.getAttribute("href"); if (h.length < 2) return;
      e.preventDefault();
      try { history.pushState(null, "", h); } catch (err) { /* cadre restreint */ }
      route(h);
    });
    const fromLocation = () => { if (decodeURIComponent(location.hash) !== lastH) route(location.hash); };
    window.addEventListener("popstate", fromLocation);
    window.addEventListener("hashchange", fromLocation);
    window.addEventListener("resize", () => moveInk(false));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => moveInk(false));
    tabs.addEventListener("keydown", e => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const i = NAMES.indexOf(router.cur), n = NAMES[(i + (e.key === "ArrowRight" ? 1 : -1) + NAMES.length) % NAMES.length];
      e.preventDefault(); router.go(n); const a = tabOf(n); if (a) a.focus();
    });
    route(location.hash);
  })();
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
  if (!("IntersectionObserver" in window) || REDUCED) return;
  const wall = $("wall");
  const wo = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { wall.querySelectorAll(".wall").forEach(w => w.classList.add("pop")); wo.disconnect(); } }), { threshold: 0.05 });
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
