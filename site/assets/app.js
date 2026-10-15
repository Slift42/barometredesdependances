/* Baromètre des dépendances, v0.8 : front statique, sans framework.
   Les données viennent de data/*.json (site) ou de window.BD_DATA (aperçu autonome).
   Les drapeaux viennent de assets/flags.js (window.BD_FLAGS). */
(function () {
"use strict";
const INF = Infinity;
const FILES = ["meta", "produits", "matrice", "atouts", "sources", "propositions", "bibliographie", "kii", "europe", "allies", "strategies", "chaines", "actus", "echeances", "zoom_armees", "carte", "partenaires", "pays"];
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
  const LVS = { 5: "30 jours ou moins", 4: "de 31 à 90 jours", 3: "de 91 jours à un an, ou 50 à 79 % des besoins couverts", 2: "plus d'un an, ou au moins 80 % des besoins couverts avec des intrants importés", 1: "la France produit sans dépendre d'un autre pays" };
  const lvc = l => `var(--l${l})`;
  const BIB = {}; (D.bibliographie || []).forEach(b => { BIB[b.id] = b; });
  const TYPES = { institution: "Institution", etat: "Pays producteurs", parlement: "Parlement", doctrine: "Leurs textes", expertise: "Expertise", programme: "Programme", donnees: "Données", ong: "ONG", presse: "Presse" };

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
  function rawLevel(p) {
    if (p.cov !== undefined) return p.cov >= 100 ? 1 : p.cov >= 80 ? 2 : p.cov >= 50 ? 3 : (p.d !== undefined ? byDays(p.d) : 4);
    if (p.d === undefined) return 0;
    return byDays(p.d);
  }
  // souveraineté : produire sans dépendre d'autrui, ou pouvoir relocaliser avant l'épuisement des stocks
  const surplus = p => (p.cov !== undefined && p.cov >= 100) || p.d === INF;
  const hasInputs = p => !!(p.intrants && p.intrants.length);
  function baseLevel(p) {
    let b = rawLevel(p);
    if (b === 1 && hasInputs(p)) b = 2;
    if (b > 1 && p.reloc && p.d !== undefined && p.d !== INF && p.d >= p.reloc) b = 1;
    return b;
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
    if (p.d === INF) return "Excédent";
    return `${a}${p.d} j`;
  }
  function explain(p) {
    const base = baseLevel(p); if (!base) return "";
    let t;
    const inNames = () => (p.intrants || []).map(id => byId[id] ? byId[id].n.toLowerCase() : id).join(", ");
    if (surplus(p) && hasInputs(p)) t = `La France produit ${p.cov !== undefined ? (p.k === "est" ? "environ " : "") + p.cov + " % de ce qu'elle consomme" : "plus qu'elle ne consomme"}, mais cette production dépend d'intrants importés (${esc(inNames())}). Le produit est donc classé <b>${LVL(2)}</b>, et non souverain : être souverain, c'est pouvoir produire sans dépendre d'un autre pays.`;
    else if (p.reloc && base === 1) t = `Nos stocks tiennent ${p.d} jours, plus longtemps que les ${p.reloc} jours qu'il faudrait pour relocaliser la production. Le produit est donc classé <b>${LVL(1)}</b>.`;
    else if (p.cov !== undefined) t = `La France produit ${p.k === "est" ? "environ " : ""}${p.cov} % de ce qu'elle consomme. Le produit est donc classé <b>${LVL(base)}</b> (${esc(LVS[base])}).`;
    else if (p.d === INF) t = `La production nationale ou européenne couvre nos besoins sans dépendre d'un autre pays. Le produit est donc classé <b>${LVL(1)}</b>.`;
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
  // ordre de grandeur : d'abord le niveau, puis la tenue (du plus court au plus long)
  const levelSort = (a, b) => b.lv - a.lv || a.t - b.t || (+(b.l === 2) - +(a.l === 2)) || a.n.localeCompare(b.n, "fr");
  const magSort = (a, b) => a.t - b.t || b.lv - a.lv || (+(b.l === 2) - +(a.l === 2)) || a.n.localeCompare(b.n, "fr");
  // nuance : dans un même niveau, plus le produit tient longtemps, plus sa couleur s'éclaircit
  const BAND = { 5: [1, 30], 4: [31, 90], 3: [91, 365], 2: [366, 1095], 1: [1, 1] };
  function shade(p) {
    const [lo, hi] = BAND[p.lv] || [1, 1]; if (hi <= lo) return 0;
    const k = (Math.log10(Math.max(p.t, 1)) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo));
    return Math.max(0, Math.min(1, k));
  }
  const pcol2 = (p, extra) => `color-mix(in oklab, var(--l${p.lv}) ${Math.round(100 - shade(p) * 22 - (extra || 0))}%, #fff)`;
  const USES = {}; P.forEach(p => (p.intrants || []).forEach(id => { (USES[id] = USES[id] || []).push(p); }));

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
    niveaux: ["Les cinq niveaux", `<ul>${[5, 4, 3, 2, 1].map(l => `<li><b>${LVL(l)}</b> : ${esc(LVS[l])}.</li>`).join("")}</ul><p>Être souverain, ce n'est pas produire plus que ce que l'on consomme : c'est produire sans dépendre d'un autre pays, ou pouvoir relocaliser avant l'épuisement des stocks.</p><p>Si le pays fournisseur s'est déjà servi de ce levier contre la France ou l'Europe, le produit perd un niveau.</p><p><a href="#souverainete">Ce que nous appelons souveraineté</a></p>`],
    podium: ["Comment est fait ce classement", `<p>Nous rangeons les produits selon leur taux de couverture, c'est-à-dire la production française divisée par la consommation française. Un taux de 193 % veut dire que la France produit presque deux fois ce qu'elle consomme, et exporte le reste.</p><p>Un excédent n'est pas la souveraineté. Quand la production dépend d'intrants importés, comme les engrais pour le blé, le produit reste au niveau Indépendant.</p><p>Source : FranceAgriMer, bilans d'approvisionnement. <a href="#souverainete">Ce que nous appelons souveraineté</a></p>`],
    pays: ["Comment nous comptons", `<p>Pour chacun des cent produits, nous notons les pays qui fournissent l'essentiel de ce que la France achète, à l'origine ultime : un aimant acheté en Allemagne mais fabriqué avec des terres rares chinoises compte pour la Chine.</p><p>Un même produit peut compter pour plusieurs pays. L'Union européenne et les fournisseurs diversifiés ne sont pas comptés ici.</p>`],
    test: ["Comment nous calculons les jours de tenue", `<p>Nous additionnons les stocks publics, les stocks des entreprises et la production nationale mobilisable, puis nous divisons par la consommation vitale d'une journée.</p><p>Pour ce que la France produit en partie, nous mesurons plutôt la part des besoins couverte, en pourcentage.</p><p>Nous proposons un seuil de 90 jours : sous ce seuil, l'État devrait présenter un plan. ${nkEst} chiffres sur 100 sont des estimations, signalées par « ≈ ».</p><p><a href="#methode">Voir la méthode complète</a></p>`],
    secteurs: ["Comment lire ce graphique", `<p>Chaque barre représente tous les produits d'un secteur, découpés selon leur niveau. Les secteurs sont classés selon la part de produits dépendants ou totalement dépendants, c'est-à-dire qui tiennent moins de 90 jours.</p><p>Cliquez sur un secteur pour retrouver ses produits.</p>`],
    filieres: ["Comment lire une filière", `<p>Chaque rond est une étape de fabrication, de la mine au produit fini. Sa couleur indique notre niveau de dépendance pour cette étape, et le drapeau montre le pays qui la domine.</p><p>Les filières sont classées de la plus dépendante à la moins dépendante, selon la moyenne de leurs étapes.</p>`],
    armees: ["D'où viennent ces informations", `<p>La liste vient du rapport de la mission d'information de l'Assemblée nationale sur les dépendances de nos armées, publié en avril 2026. Le pays indiqué est celui du fournisseur principal aujourd'hui.</p><p>Le niveau est notre lecture de ce rapport : il n'existe pas de chiffre public de stock pour ces équipements. Cliquez sur une ligne pour lire le constat.</p>`],
    carte: ["Comment lire la carte", `<p><b>Les pays qui nous fournissent</b> : plus un pays est foncé, plus il fournit de produits parmi nos cent. L'épaisseur du lien vers la France suit le même nombre. Les liens de la Chine, des États-Unis et de la Russie ont leur propre couleur.</p><p><b>Les alliances possibles</b> : plus un pays est foncé, plus il revient souvent dans nos propositions de partenariat.</p><p><b>Les pays producteurs</b> : plus un pays est foncé, plus il fournit au moins 5 % de la production mondiale d'un grand nombre des matières que nous suivons. Cliquez sur un pays pour lire ce qu'il produit et ce que son gouvernement a décidé.</p><p>La projection Equal Earth respecte la surface des pays. Certains petits pays n'apparaissent qu'au cadrage Europe.</p>`],
    puissances: ["Assumé ou documenté", `<p>Un levier est « assumé » quand la puissance l'a annoncé elle-même : loi, décret, communiqué officiel ou doctrine publiée.</p><p>Il est « documenté » quand l'État français ou des chercheurs le lui attribuent, sans qu'elle le reconnaisse.</p><p>La frise place côte à côte ce que chaque puissance écrit et ce qu'elle fait.</p>`],
    moyens: ["Les six moyens de pression", `<p>Un pays peut peser sur un autre par ses matières premières, ses technologies, son droit, ses capitaux, ses récits ou ses relais politiques.</p><ul><li><b>${esc(D.matrice.statuts.act)}</b> : ce moyen a déjà servi contre la France ou l'Union.</li><li><b>${esc(D.matrice.statuts.str)}</b> : la prise existe, mais elle n'a pas encore été utilisée.</li><li><b>${esc(D.matrice.statuts.lat)}</b> : la France est peu exposée.</li></ul>`],
    europe: ["D'où viennent ces chiffres", `<p>Les chiffres viennent de la Commission européenne, de la Cour des comptes européenne, de l'Agence internationale de l'énergie et d'instituts de recherche indépendants. Chaque carte cite ses sources.</p><p>Les jauges montrent une part en pourcentage. Le trait pointillé marque l'objectif que l'Union s'était fixé, quand il existe.</p>`],
    allies: ["Comment lire ce tableau", `<p>À gauche, un achat qui renforce la dépendance : les drapeaux de gauche désignent les acheteurs, ceux de droite le fournisseur.</p><p>À droite, un pays européen qui a fait un autre choix dans le même domaine. Quand aucun contre-exemple n'existe, la case reste vide.</p>`],
    actus: ["Comment nous choisissons les actualités", `<p>Les actualités vérifiées ont été lues et sourcées par notre équipe. Les détections automatiques viennent d'un robot qui lit chaque matin des flux de presse et d'instituts : elles sont toujours marquées « à vérifier ».</p><p>Les drapeaux indiquent les pays fournisseurs des produits concernés.</p>`],
    propositions: ["Comment lire la feuille de route", `<p>Les deux mesures phares s'appliquent dès le début du mandat. Les mesures suivantes sont rangées selon le délai nécessaire pour les voter et les appliquer.</p><p>Les alliances se construisent pendant tout le mandat, produit par produit.</p>`],
    hhi: ["L'indice de concentration", `<p>L'indice de Herfindahl-Hirschman additionne le carré de la part de chaque pays producteur, exprimée en pourcentage. Un seul pays qui fait tout donne 10 000 points ; dix pays à parts égales donnent 1 000 points.</p><p>Les autorités américaines de la concurrence jugent un marché très concentré au-delà de 1 800 points, et modérément concentré entre 1 000 et 1 800.</p><p>Nous le calculons sur les pays détaillés par la source ; les « autres pays » en sont exclus, ce qui le sous-estime légèrement.</p>`],
    partenaires: ["Comment lire cette page", `<p>Pour chaque matière, nous reprenons la production et les réserves publiées pays par pays, surtout par l'institut géologique américain (USGS) et, pour l'uranium, par la World Nuclear Association et le Livre rouge de l'AIEA et de l'AEN.</p><p>Les chiffres de l'USGS paraissent en janvier ; ceux de la dernière année sont des estimations de l'institut, que nous confrontons aux chiffres des gouvernements producteurs dans la section « Quand les sources ne disent pas la même chose ».</p><p>Nous en tirons six calculs : la part de chaque pays, la part de la Chine et de la Russie, l'indice de concentration, l'écart entre réserves et production, la durée de vie des réserves et, quand le besoin français est publié, la couverture de nos besoins. Les fiches des partenaires ajoutent les projets miniers, sourcés un par un, et les risques.</p><p><a href="#evaluation">Voir la méthode</a></p>`],
    croisement: ["Comment lire le tableau croisé", `<p>Chaque ligne est un pays, chaque colonne une matière. La case donne la part du pays dans la production mondiale, la dernière année publiée. Six teintes : moins de 1 %, de 1 à 5 %, de 5 à 15 %, de 15 à 30 %, de 30 à 50 %, plus de 50 %.</p><p>Nous gardons les pays qui fournissent au moins 3 % d'une des matières. Les pays sont rangés par continent, selon la nomenclature des Nations unies, puis par nombre de matières où ils pèsent au moins 5 %.</p><p>La Chine et la Russie sont signalées par un trait de couleur : elles ont déjà utilisé leurs matières premières comme moyen de pression.</p>`],
    afrique: ["Comment nous calculons la part de l'Afrique", `<p>Nous additionnons les parts des pays africains détaillés par la source, la même année. Les « autres pays » que la source ne détaille pas ne sont rattachés à aucun continent : la part africaine est donc un minimum.</p><p>Le point indique la part de l'Afrique dans les réserves mondiales, quand la source les publie pays par pays.</p><p>Les décisions des gouvernements africains viennent de leurs textes officiels quand ils sont en ligne (Ghana, Zambie, Union africaine), sinon de la presse qui rapporte le conseil des ministres ou la déclaration du ministre.</p>`],
    producteurs: ["Comment nous classons les décisions", `<p>Nous relevons les décisions des pays producteurs qui changent ce que nous pourrons leur acheter : interdire l'export de minerai brut, plafonner les ventes, prendre une part du capital, exiger des usines sur place, adopter une loi ou une stratégie, construire des voies d'export, signer des contrats avec des industriels étrangers.</p><p>Chaque décision porte une date et un état : en vigueur, annoncée (pour une date future), en suspens ou abandonnée.</p><p>Nous préférons le texte officiel du pays. Quand il n'est pas en ligne, nous citons la presse qui rapporte la décision, et nous le signalons dans la source.</p>`],
    ecarts: ["Pourquoi comparer les sources", `<p>Pour comparer les pays entre eux, il faut une seule source par matière, dans la même unité : nous prenons l'institut géologique américain (USGS), qui publie chaque année les mêmes tableaux pour tous les pays. Ses chiffres de la dernière année sont des estimations, publiées en janvier.</p><p>Les gouvernements producteurs publient parfois d'autres chiffres. Nous les confrontons : quand l'écart dépasse quelques pour cent, nous le montrons et nous disons quel chiffre nous retenons, et pourquoi.</p>`],
    mannes: ["Comment nous repérons les gisements de demain", `<p>Un pays qui possède une grande part des réserves mondiales mais n'en extrait qu'une petite part est un partenaire d'avenir : il a de quoi produire plus.</p><p>Nous calculons, pour chaque matière, la différence entre sa part des réserves et sa part de la production, en points. Nous gardons les écarts d'au moins 4 points, hors Chine et Russie.</p><p>Les réserves sont celles que publie l'USGS : elles suivent les normes de chaque pays, qui ne sont pas toutes équivalentes.</p>`],
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
  const FIRST = { accueil: "accueil", test: "test", detail: "secteurs", puissances: "carte", partenaires: "partenaires", europe: "europe", actus: "actus", propositions: "propositions", methode: "souverainete", sources: "sources" };
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

  (function spectrum() {
    $("spectrum").innerHTML = [5, 4, 3, 2, 1].map(l => {
      const L = inst.filter(p => p.lv === l).sort(levelSort), n = L.length;
      return `<div class="band" style="--c:${lvc(l)}"><div class="band-h"><b>${n}</b><span><strong>${n > 1 ? "produits" : "produit"} ${LVL(l).toLowerCase()}${n > 1 ? "s" : ""}</strong>${esc(LVS[l])}</span></div><div class="band-chips">${L.map(p => `<button type="button" class="pchip" data-open="${esc(p.id)}" style="background:${pcol2(p)};color:var(--on-l${l})" title="${esc(p.n)} : ${esc(valTxt(p))}">${p.l === 2 ? BOLT : ""}${esc(p.n)}<span>${esc(valTxt(p))}</span></button>`).join("")}</div></div>`;
    }).join("");
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
      return `<button type="button" class="step s${rk}" data-open="${esc(p.id)}" aria-label="${rk}e place : ${esc(p.n)}, ${p.cov} % des besoins couverts"><span class="who">${flag("FR", "lg")}<b>${esc(p.n)}</b><span style="color:${lvc(p.lv)}">${p.cov} %</span><small>de nos besoins couverts</small></span><span class="plinth" style="height:${h}px;background:${rk === 1 ? lvc(p.lv) : `color-mix(in oklab, ${lvc(p.lv)} 75%, var(--surface))`};color:var(--on-l${p.lv})">${rk}</span></button>`;
    }).join("") + `<span class="base"></span>`;
    const dep3 = three.filter(hasInputs);
    $("podiumNote").innerHTML = dep3.length ? `Attention : ${dep3.length === three.length ? "ces trois productions dépendent" : "certaines de ces productions dépendent"} d'engrais en grande partie importés. Elles sont <b>indépendantes</b>, mais pas souveraines.` : "";
    const sov = inst.filter(p => p.lv === 1).sort((a, b) => a.n.localeCompare(b.n, "fr"));
    const more = inst.filter(p => surplus(p) && p.lv !== 1 && !three.includes(p)).sort((a, b) => a.n.localeCompare(b.n, "fr"));
    const tg = p => `<button type="button" class="tag" data-open="${esc(p.id)}"><i style="background:${lvc(p.lv)}"></i>${esc(p.n)}</button>`;
    $("alsoGood").innerHTML = `<h3>Là où la France est vraiment souveraine</h3><p class="hint">Pour ces produits, la France, seule ou avec ses partenaires européens, produit ce dont elle a besoin sans dépendre d'un autre pays.</p><div class="chips">${sov.map(tg).join("")}</div>` +
      (more.length ? `<h3 style="margin-top:18px">Elle produit aussi plus qu'elle ne consomme pour</h3><p class="hint">Mais ces productions dépendent encore d'intrants importés.</p><div class="chips">${more.map(tg).join("")}</div>` : "");
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

  function sorted(L, mag) {
    const A = L.slice();
    if (mag && S.sort === "dep") return A.sort(magSort);
    if (mag && S.sort === "res") return A.sort((a, b) => -magSort(a, b));
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
    const d = p.cov !== undefined ? `${a}${p.cov}<small>%</small>` : p.d === INF ? "Excédent" : `${a}${p.d}<small>j</small>`;
    const lab = `${p.n} : ${valTxt(p)}, ${LVL(p.lv)}${p.l === 2 ? ", levier déjà activé" : ""}${p.k === "est" ? ", estimation" : ""}`;
    return `<button type="button" class="tile lv${p.lv}${p.k === "est" ? " is-est" : ""}${S.q ? " hit" : ""}" style="--i:${k};background:${pcol2(p)}" data-i="${p.i}" aria-label="${esc(lab)}"><span class="top">${tileFlags(p).map(c => flag(c)).join("")}${p.l === 2 ? BOLT : ""}</span><span class="nm">${esc(p.n)}</span><span class="dy">${d}</span></button>`;
  }
  const groupHead = g => g.title ? `<div class="group-h" style="--gc:${g.color || "var(--ink)"}"><b>${g.flag ? flag(g.flag, "lg") : g.color && g.key[0] === "l" ? `<i class="sw" style="background:${g.color};width:16px;height:16px"></i>` : ""}${esc(g.title)}</b><span class="gn">${g.items.length} produit${g.items.length > 1 ? "s" : ""}</span>${g.desc ? `<span>${esc(g.desc)}</span>` : ""}</div>` : "";
  function renderWall() {
    const L = P.filter(visible);
    let k = 0;
    $("wall").innerHTML = L.length ? groups(L).map(g => `<div class="group">${groupHead(g)}<div class="wall">${g.items.map(p => tile(p, k++)).join("")}</div></div>`).join("")
      : `<p class="empty">Aucun produit ne correspond à ces filtres. <button type="button" class="reset" data-reset>Tout afficher</button></p>`;
  }
  const LOGMAX = Math.log10(1095);
  const pos = d => d === INF ? 100 : Math.max(0, Math.min(100, Math.log10(Math.max(d, 1)) / LOGMAX * 100));
  const THR = pos(META.seuil_jours);
  function lrow(p, w, thr) {
    return `<div class="frow" data-i="${p.i}" role="button" tabindex="0" aria-label="${esc(p.n)} : ${esc(valTxt(p))}"><span class="fname">${p.isLive ? '<span class="live-dot" title="Donnée en direct"></span>' : ""}${tileFlags(p).slice(0, 2).map(c => flag(c)).join("")}${esc(p.n)}${p.l === 2 ? BOLT : ""}</span><div class="track" style="--thr:${thr}%"><div class="lbar" style="width:${w}%;background:${pcol2(p)}"></div><span class="thr"></span></div><span class="fval">${esc(valTxt(p))}</span></div>`;
  }
  function renderLine() {
    const L = sorted(P.filter(visible), true);
    const days = L.filter(p => p.cov === undefined), cov = L.filter(p => p.cov !== undefined);
    const ticks = [[1, "1 jour"], [7, "1 semaine", "mid"], [30, "1 mois"], [365, "1 an"], [1095, "3 ans et plus"]];
    let h = "";
    if (days.length) h += `<div class="lrows"><div class="axis"><span class="cap">Produit et principaux fournisseurs</span><div class="ticks">${ticks.map(([d, l, c]) => `<span class="${c || ""}" style="left:${pos(d)}%;${d === 1 ? "transform:none" : d === 1095 ? "transform:translateX(-100%)" : ""}">${l}</span>`).join("")}<span class="thr-l" style="left:${THR}%">seuil proposé : ${META.seuil_jours} jours</span></div><span class="cap" style="text-align:right">Tenue</span></div>${days.map(p => lrow(p, p.d === 0 ? 0 : pos(p.d), THR)).join("")}</div>`;
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
  $("keys").innerHTML = `<span>${BOLT}Le pays fournisseur s'est déjà servi de ce levier contre la France ou l'Europe.</span><span><span class="k">≈</span>Le chiffre est une estimation (soulignée en pointillés).</span><span><i class="sw" style="background:linear-gradient(90deg,var(--l5),color-mix(in oklab,var(--l5) 78%,#fff))"></i>Plus la couleur est pâle, plus le produit tient longtemps dans son niveau.</span><span>${flag("CN")}${flag("US")}Les drapeaux montrent les principaux pays fournisseurs.</span><span><span class="k">j</span>jours de tenue</span><span><span class="k">%</span>part des besoins couverte par la production française</span>`;
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
  function amontBlock(p) {
    if (!hasInputs(p)) return "";
    const A0 = p.amont || {};
    return `<div class="box amont"><h4>Pourquoi ce produit n'est pas souverain</h4>${A0.txt ? `<p>${esc(A0.txt)}</p>` : ""}<p>Sa production dépend de :</p>${tagList(p.intrants.map(id => byId[id]).filter(Boolean))}${refList(A0.refs)}</div>`;
  }
  function partBlock(p) {
    const L = (D.partenaires || { matieres: [] }).matieres.filter(m => (m.produits || []).includes(p.id));
    if (!L.length) return "";
    return `<div class="box"><h4>Qui d'autre en produit</h4>${L.map(m => { const st = matStats(m), alt = st.rows.filter(r => !IMP.includes(r.c) && r.c !== "ZZ" && !st.risky.has(r.c)).slice(0, 3); return `<p><b>${esc(m.nom)}.</b> La Chine et la Russie en ont extrait ${pct(st.imp)} en ${m.annees[st.k]}. Les principaux autres producteurs sont ${alt.map(r => `${flag(r.c)} ${esc(nom(r.c))} (${pct(r.s)})`).join(", ")}. <a href="#partenaires" data-mat="${esc(m.id)}">Voir les partenaires possibles</a></p>`; }).join("")}</div>`;
  }
  function usesBlock(p) {
    const U = USES[p.id]; if (!U || !U.length) return "";
    return `<div class="box"><h4>Si ce produit manque</h4><p>Ces productions françaises en ont besoin et seraient touchées :</p>${tagList(U)}</div>`;
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
    else if (p.d === INF) big = `<span class="d">Excédent</span><span class="u">La France produit plus qu'elle ne consomme.</span>`;
    else big = `<span class="d">${p.k === "est" ? "≈ " : ""}${p.d}</span><span class="u">jour${p.d > 1 ? "s" : ""} de tenue si plus rien n'entrait.</span>`;
    const holders = (p.h || []).map(h => `<span>${flag(h)}${esc(nom(h))}</span>`).join("");
    const body = `<div class="sh-big">${big}</div><span class="badge">${p.isLive ? '<span class="live-dot"></span>' : ""}${esc(META.natures[p.k])}</span> <a class="badge sol ${solLab(p.sol)}" href="#solidite" title="Comment est calculée cette note">Solidité de la preuve : ${num(p.sol)} sur 5, ${solLab(p.sol)}</a>
      ${p.gens ? `<div class="gens"><p>${esc(p.gens)}</p></div>` : ""}
      <dl class="facts">
        <div><dt>Principaux fournisseurs</dt><dd><span class="flags">${holders}</span></dd></div>
        <div><dt>Notre dépendance</dt><dd>${esc(p.dep)}</dd></div>
        ${p.conc ? `<div><dt>Dans le monde</dt><dd>${esc(p.conc)}</dd></div>` : ""}
        <div><dt>Seuil légal de stock</dt><dd>${p.seuil && SEU[p.seuil] ? esc(SEU[p.seuil].court) : "Il n'y en a pas : personne n'est obligé d'en stocker."}</dd></div>
        <div><dt>D'où vient le chiffre</dt><dd>${figureSource(p)}</dd></div>
      </dl>` + amontBlock(p) + usesBlock(p) + partBlock(p) + levBlock(p) + noteBlock(p) + seuilBlock(p) +
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
  document.addEventListener("click", e => { const t = e.target.closest("a[data-mat]"); if (t && sheet.classList.contains("on")) closeSheet(true); });
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
    const counts = () => MAP.mode === "dep" ? HOLD : MAP.mode === "al" ? ALLY : MINC;
    const rankOf = () => MAP.mode === "dep" ? HOLD_RANK : MAP.mode === "al" ? ALLY_RANK : MIN_RANK;
    const binMin = n => !n ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : n <= 7 ? 4 : 5;
    const bin = n => !n ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 9 ? 3 : n <= 19 ? 4 : 5;
    const BINS = ["aucun", "1", "2 ou 3", "4 à 9", "10 à 19", "20 et plus"];
    const fillOf = n => MAP.mode === "dep" ? `var(--m${bin(n)})` : MAP.mode === "min" ? `var(--m${binMin(n)})` : (bin(n) ? `var(--a${bin(n)})` : "var(--m0)");
    function paint() {
      const C = counts();
      Object.entries(paths).forEach(([c, p]) => { if (c === "FR") return; const n = (C[c] || []).length; p.style.fill = fillOf(n); p.classList.toggle("sel", c === MAP.sel); });
      gA.innerHTML = "";
      const rank = MAP.mode === "min" ? [] : rankOf();
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
      const ramp = (MAP.mode !== "al" ? [1, 2, 3, 4, 5].map(i => `var(--m${i})`) : [1, 2, 3, 4, 5].map(i => `var(--a${i})`)).map(c => `<i style="background:${c}"></i>`).join("");
      $("mapLegend").innerHTML = MAP.mode === "min" ? `<span>Nombre de matières dont le pays fournit au moins 5 % de la production mondiale : <span class="ramp">${ramp}</span> 1, 2, 3 ou 4, 5 à 7, 8 et plus</span><span><i class="sw" style="background:var(--navy)"></i>France</span>`
        : MAP.mode === "dep"
        ? `<span>Nombre de nos produits fournis : <span class="ramp">${ramp}</span> de 1 à 20 et plus</span><span><i class="ln" style="border-color:var(--cn)"></i>Chine</span><span><i class="ln" style="border-color:var(--us)"></i>États-Unis</span><span><i class="ln" style="border-color:var(--ru)"></i>Russie</span><span><i class="ln" style="border-color:var(--other)"></i>Autres pays</span><span><i class="sw" style="background:var(--navy)"></i>France</span>`
        : `<span>Nombre de produits pour lesquels ce pays est un partenaire possible : <span class="ramp">${ramp}</span> de 1 à 20 et plus</span><span><i class="ln d" style="border-color:var(--ally)"></i>Alliance proposée</span><span><i class="sw" style="background:var(--navy)"></i>France</span>`;
      panel();
    }
    const tagL = L => `<div class="plist">${L.slice().sort(levelSort).map(p => `<button type="button" class="tag" data-open="${esc(p.id)}"><i style="background:${lvc(p.lv)}"></i>${esc(p.n)}</button>`).join("")}</div>`;
    function panel() {
      const el2 = $("mapPanel"), c = MAP.sel;
      if (!c) {
        const rank = rankOf().slice(0, 14);
        el2.innerHTML = `<h3>${MAP.mode === "dep" ? "Les pays qui nous fournissent le plus" : MAP.mode === "min" ? "Les grands pays producteurs" : "Nos partenaires possibles les plus fréquents"}</h3><p class="hint">${MAP.mode === "dep" ? "Nombre de nos produits vitaux dont ce pays est un fournisseur principal." : MAP.mode === "min" ? `Nombre de matières, parmi les ${MAT_ORDER.length} que nous suivons, dont ce pays fournit au moins 5 % de la production mondiale.` : "Nombre de produits pour lesquels nous proposons une alliance avec ce pays."}</p><ol class="rank">${rank.map(([k, ps], i) => `<li><button type="button" data-mc="${k}"><span>${i + 1}</span><span>${flag(k)} ${esc(nom(k))}</span><b>${ps.length}</b></button></li>`).join("")}</ol>`;
        return;
      }
      const h = HOLD[c] || [], a = ALLY[c] || [];
      let html = `<button type="button" class="back" data-mc="">Revenir au classement</button><h3>${flag(c, "xl")}${esc(nom(c))}</h3>`;
      if (c === "FR") html += `<p>La France est au centre de la carte : tous les liens mènent à elle.</p>`;
      if (h.length) html += `<h4>Ce pays est un fournisseur principal pour ${h.length} de nos produits vitaux.</h4>${tagL(h)}`;
      if (a.length) html += `<h4>Nous proposons une alliance avec ce pays pour ${a.length} produit${a.length > 1 ? "s" : ""}.</h4>${tagL(a)}`;
      const PB = (PROD_BY[c] || []).slice().sort((x, y) => y.s - x.s);
      if (PB.length) html += `<h4>Ce que ce pays extrait, parmi les matières que nous suivons</h4><ul class="pb-list">${PB.map(x => `<li><a href="#partenaires" data-mat="${esc(x.m.id)}">${esc(x.m.nom)}</a> : ${pct(x.s)} de la production mondiale (${x.rank === 1 ? "1er" : x.rank + "e"} rang)</li>`).join("")}</ul>`;
      const DO = DOSS[c];
      if (!h.length && !a.length && c !== "FR" && !PB.length && !DO) html += `<p class="hint">Ce pays n'apparaît pas encore dans le baromètre.</p>`;
      if (DO) html += `<h4>Ce que son gouvernement a décidé</h4>${mesuresHTML(DO, true)}<p><a href="#pays-${esc(c)}" data-goto-pays="${esc(c)}">Lire la fiche complète et ses sources</a></p>`;
      if (UEP[c]) html += ueLine(c);
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
      tip.innerHTML = `<b>${esc(nom(c))}</b><br>${c === "FR" ? "La France" : MAP.mode === "min" ? (n ? `Au moins 5 % de la production mondiale pour ${n} matière${n > 1 ? "s" : ""}` : "Moins de 5 % pour chacune de nos matières") : MAP.mode === "dep" ? (n ? `Fournisseur principal pour ${n} de nos produits` : "Pas de produit fourni parmi nos cent") : (n ? `Partenaire possible pour ${n} produit${n > 1 ? "s" : ""}` : "Pas d'alliance proposée")}`;
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
     LES PARTENAIRES DE DEMAIN : production, réserves, concentration, projets
     ====================================================================== */
  const PA = D.partenaires || { matieres: [] };
  const IMP = ["CN", "RU"]; // puissances qui ont déjà utilisé ce levier contre la France ou l'Europe
  const fmtN = (v, d) => (v == null ? "n.d." : v.toLocaleString("fr-FR", { maximumFractionDigits: d == null ? 0 : d }));
  const pct = (v, d) => num((v * 100).toFixed(d == null ? (v < 0.1 ? 1 : 0) : d)) + " %";
  // indice de Herfindahl-Hirschman : somme des carrés des parts (en points de pourcentage)
  const hhiOf = parts => Math.round(parts.reduce((s, x) => s + Math.pow(x * 100, 2), 0));
  const hhiLabel = h => h > 1800 ? "très concentré" : h >= 1000 ? "modérément concentré" : "peu concentré";
  function matStats(m) {
    const k = m.annees.length - 1, W = m.monde[k];
    const rows = Object.entries(m.prod).map(([c, v]) => ({ c, p: v[k], s: v[k] / W })).filter(r => r.p > 0).sort((a, b) => b.p - a.p);
    const named = rows.filter(r => r.c !== "ZZ");
    const partners = new Set((m.partenaires || []).filter(p => !p.prudence).map(p => p.c)), risky = new Set((m.partenaires || []).filter(p => p.prudence).map(p => p.c));
    const share = f => rows.filter(f).reduce((s, r) => s + r.s, 0);
    const R = m.res && Object.keys(m.res).length && m.monde_res ? m.monde_res : 0;
    const gaps = R ? Object.entries(m.res).filter(([c]) => c !== "ZZ").map(([c, r]) => { const pv = (m.prod[c] || [0, 0])[k] || 0; return { c, rs: r / R, ps: pv / W, rp: pv ? r / pv : null }; }).sort((a, b) => (b.rs - b.ps) - (a.rs - a.ps)) : [];
    return { k, W, rows, top: rows[0], hhi: hhiOf(named.map(r => r.s)), imp: share(r => IMP.includes(r.c)), cn: share(r => r.c === "CN"), top3: named.slice(0, 3).reduce((s, r) => s + r.s, 0), allies: share(r => partners.has(r.c)), gaps, partners, risky };
  }
  const blocOf = (c, partners, risky) => IMP.includes(c) ? (c === "CN" ? "var(--cn)" : "var(--ru)") : c === "US" ? "var(--us)" : risky && risky.has(c) ? "var(--l4)" : partners.has(c) ? "var(--ally)" : "var(--other)";
  const MAT_ORDER = PA.matieres.map(m => ({ m, st: matStats(m) }));
  let matSel = store.get("bd-mat"); if (!PA.matieres.some(m => m.id === matSel)) matSel = (PA.matieres[0] || {}).id;

  function prodChart(m, st) {
    const max = st.rows[0] ? st.rows[0].s : 1;
    const top = st.rows.filter(r => r.c !== "ZZ").slice(0, 10), rest = st.rows.filter(r => !top.includes(r));
    const restS = rest.reduce((s, r) => s + r.s, 0), restP = rest.reduce((s, r) => s + r.p, 0);
    const line = (lab, s, p, col) => `<div class="pbar"><span class="lab">${lab}</span><span class="pb-w"><i style="width:${Math.max(.6, s / max * 100)}%;background:${col}"></i></span><span class="num"><b>${pct(s)}</b> ${fmtN(p)}</span></div>`;
    return `<h3>Qui produit <small>en ${m.annees[st.k]}, en ${esc(m.unite)}</small></h3>` + top.map(r => line(`${flag(r.c)}${esc(nom(r.c))}`, r.s, r.p, blocOf(r.c, st.partners, st.risky))).join("") + (restS > 0 ? line("Autres pays", restS, restP, "var(--other)") : "");
  }
  function gapChart(m, st) {
    if (!st.gaps.length) return `<h3>Production et réserves</h3><p class="hint">${esc(m.res_note || "Pas de réserves publiées pour cette matière.")}</p>`;
    const G = st.gaps.slice().sort((x, y) => y.rs - x.rs).slice(0, 9).sort((x, y) => (y.rs - y.ps) - (x.rs - x.ps));
    return `<h3>Ce qu'ils possèdent, et ce qu'ils extraient <small>part des réserves et de la production mondiales</small></h3>
      <div class="gap-legend"><span><i class="dot p"></i>Part de la production</span><span><i class="dot r"></i>Part des réserves</span></div>` +
      G.map(g => { const d = g.rs - g.ps, lo = Math.min(g.rs, g.ps) * 100, hi = Math.max(g.rs, g.ps) * 100; return `<div class="gbar${IMP.includes(g.c) ? " imp" : ""}"><span class="lab">${flag(g.c)}${esc(nom(g.c))}</span><span class="gb-w"><em style="left:${lo}%;width:${hi - lo}%;background:${d > 0 ? "var(--ally)" : "var(--l4)"}"></em><i class="dot p" style="left:${g.ps * 100}%"></i><i class="dot r" style="left:${g.rs * 100}%"></i></span><span class="num"><b>${d > 0 ? "+" : ""}${num((d * 100).toFixed(0))} pts</b>${g.rp && g.rp < 5000 ? `${fmtN(g.rp)} ans` : g.rp ? "plus de 5 000 ans" : "pas extrait"}</span></div>`; }).join("") +
      `<p class="foot">Nous montrons les neuf pays qui détiennent le plus de réserves, classés selon l'écart entre leur part des réserves et leur part de la production, en points. Le second chiffre dit combien d'années dureraient leurs réserves au rythme actuel. ${m.res_label ? esc(m.res_label) + "." : ""}</p>`;
  }
  function ctrlChart(m) {
    const C = m.controle; if (!C) return "";
    const T = C.lignes.reduce((s, l) => s + l[2], 0), imp = C.lignes.filter(l => IMP.includes(l[1])).reduce((s, l) => s + l[2], 0);
    return `<div class="panel"><h3>${esc(C.titre)} <small>${esc(C.note)}</small></h3><div class="stackbar">${C.lignes.map(l => `<i style="flex:${l[2]};background:${IMP.includes(l[1]) ? (l[1] === "CN" ? "var(--cn)" : "var(--ru)") : l[1] === "US" ? "var(--us)" : l[1] === "FR" ? "var(--navy)" : l[1] === "ZZ" ? "var(--other)" : "var(--ally)"}" title="${esc(l[0])} : ${fmtN(l[2])} t"></i>`).join("")}</div>
      <ul class="ctrl-list">${C.lignes.map(l => `<li>${l[1] !== "ZZ" ? flag(l[1]) : ""}<span>${esc(l[0])}</span><b>${pct(l[2] / T)}</b></li>`).join("")}</ul>
      <p class="hint" style="margin:10px 0 0">Les groupes chinois et russes contrôlent ${pct(imp / T)} de l'uranium extrait dans le monde, y compris hors de leurs frontières. ${refList(C.refs)}</p></div>`;
  }
  function raffChart(m) {
    const R0 = m.raffinage; if (!R0) return "";
    const L = Object.entries(R0.lignes).filter(([c]) => c !== "ZZ").sort((a, b) => b[1] - a[1]).slice(0, 8), max = L[0][1];
    return `<div class="panel"><h3>${esc(R0.titre)} <small>en ${R0.annee}, en milliers de t</small></h3>${L.map(([c, v]) => `<div class="pbar"><span class="lab">${flag(c)}${esc(nom(c))}</span><span class="pb-w"><i style="width:${v / max * 100}%;background:${blocOf(c, new Set((m.partenaires || []).map(p => p.c)))}"></i></span><span class="num"><b>${pct(v / R0.monde)}</b> ${fmtN(v)}</span></div>`).join("")}</div>`;
  }
  function renderMat() {
    const m = PA.matieres.find(x => x.id === matSel); if (!m) return;
    const st = matStats(m);
    $("matTabs").innerHTML = MAT_ORDER.map(({ m: x, st: s }) => `<button type="button" data-m="${esc(x.id)}" aria-pressed="${x.id === matSel}"><i style="background:${s.imp > .5 ? "var(--cn)" : s.imp > .25 ? "var(--l4)" : "var(--ally)"}"></i>${esc(x.nom)}</button>`).join("");
    const top = st.top, B0 = m.besoin;
    const verdict = `En ${m.annees[st.k]}, le premier producteur ${esc(m.de)}, ${flag(top.c)} ${esc(nom(top.c))}, en a fourni ${pct(top.s)}. Les trois premiers producteurs en ont fourni ${pct(st.top3)}.`;
    const tiles = `<div class="mstats">
      <div><b style="color:${st.imp > .5 ? "var(--cn)" : "inherit"}">${pct(st.imp)}</b>de la production vient de Chine ou de Russie, deux pays qui ont déjà utilisé ce levier.</div>
      <div><b style="color:var(--ally)">${pct(st.allies)}</b>vient des pays que nous jugons fiables comme partenaires possibles.${st.risky.size ? ` Nous écartons ${[...st.risky].map(nom).join(" et ")}, dont la production est contrôlée ou captée par une puissance.` : ""}</div>
      <div><b>${fmtN(st.hhi)}</b>points d'indice de concentration : le marché est ${hhiLabel(st.hhi)}. <button class="info" type="button" data-info="hhi" aria-label="Qu'est-ce que l'indice de concentration ?">i</button></div>
      ${B0 ? `<div><b>${fmtN(B0.v)} t par an</b>${esc(B0.court)} ${refList(B0.refs)}</div>` : ""}
    </div>`;
    const cov = B0 ? `<p class="cov-note">Pour comparer, voici la production de chaque partenaire rapportée à nos besoins annuels : ${m.partenaires.filter(p => m.prod[p.c] && m.prod[p.c][st.k]).map(p => `${flag(p.c)} ${esc(nom(p.c))} ${num((m.prod[p.c][st.k] / B0.v).toFixed(1))} fois`).join(", ")}.</p>` : "";
    const prods = (m.produits || []).map(id => byId[id]).filter(Boolean);
    $("matBody").innerHTML = `<div class="mat swap">
      <p class="mat-verdict">${verdict}</p>${tiles}${cov}
      <div class="mat-grid"><div class="panel">${prodChart(m, st)}<div class="bar-legend" style="margin-top:12px"><span><i class="sw" style="background:var(--cn)"></i>Chine</span><span><i class="sw" style="background:var(--ru)"></i>Russie</span><span><i class="sw" style="background:var(--us)"></i>États-Unis</span><span><i class="sw" style="background:var(--ally)"></i>Partenaires possibles</span><span><i class="sw" style="background:var(--l4)"></i>Fournisseurs sous influence</span><span><i class="sw" style="background:var(--other)"></i>Autres</span></div><p class="foot">${refList(m.refs)}</p></div><div class="panel">${gapChart(m, st)}</div></div>
      ${ctrlChart(m)}${raffChart(m)}
      ${(m.notes || []).length ? `<ul class="mat-notes">${m.notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}
      <h3 class="pcards-h">Les partenaires possibles, un par un</h3>
      <div class="pcards">${(m.partenaires || []).map(p => {
        const v = m.prod[p.c] ? m.prod[p.c][st.k] : 0, r = m.res && m.res[p.c];
        const comp = [v ? `${pct(v / st.W)} de la production mondiale` : "", r && m.monde_res ? `${pct(r / m.monde_res)} des réserves` : "", v && r ? `${fmtN(r / v)} ans de réserves au rythme actuel` : "", v && B0 ? `${num((v / B0.v).toFixed(1))} fois nos besoins annuels` : ""].filter(Boolean);
        return `<article class="pcard${p.prudence ? " risky" : ""}" style="--c:${blocOf(p.c, st.partners, st.risky)}"><header>${flag(p.c, "lg")}<div><b>${esc(nom(p.c))}</b><span>${esc(p.role)}</span></div></header>
          ${comp.length ? `<p class="calc">Notre calcul : ${comp.join(", ")}.</p>` : ""}
          ${p.chiffres.length ? `<dl>${p.chiffres.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join("")}</dl>` : ""}
          <p>${esc(p.txt)}</p>
          ${p.projets.map(x => `<div class="proj"><b>${esc(x.nom)}</b><p>${esc(x.txt)}</p>${refList(x.refs)}</div>`).join("")}
          ${p.risque ? `<p class="risk"><b>À surveiller.</b> ${esc(p.risque)}</p>` : ""}${refList(p.refs)}</article>`;
      }).join("")}</div>
      ${prods.length ? `<p class="mat-prods">Les produits du baromètre concernés : ${tagList(prods)}</p>` : ""}
    </div>`;
  }
  if (PA.matieres.length) {
    $("matTabs").addEventListener("click", e => { const b = e.target.closest("button[data-m]"); if (!b) return; matSel = b.dataset.m; store.set("bd-mat", matSel); renderMat(); });
    document.addEventListener("click", e => { const a = e.target.closest("[data-mat]"); if (!a) return; matSel = a.dataset.mat; store.set("bd-mat", matSel); renderMat(); });
    renderMat();
    // les gisements de demain : écart entre part des réserves et part de la production, toutes matières confondues
    (function mannes() {
      const L = [];
      MAT_ORDER.filter(({ m }) => !m.hors_mannes).forEach(({ m, st }) => st.gaps.forEach(g => { if (IMP.includes(g.c) || g.c === "US" && m.id === "lithium") return; const d = g.rs - g.ps; if (d >= .04) L.push({ m, g, d }); }));
      L.sort((a, b) => b.d - a.d);
      $("mannesChart").innerHTML = `<div class="gap-legend"><span><i class="dot p"></i>Part de la production mondiale</span><span><i class="dot r"></i>Part des réserves mondiales</span></div>` + L.slice(0, 14).map(({ m, g, d }) => `<button type="button" class="gbar big" data-mat="${esc(m.id)}"><span class="lab">${flag(g.c)}<span><b>${esc(nom(g.c))}</b><small>${esc(m.nom)}</small></span></span><span class="gb-w"><em style="left:${g.ps * 100}%;width:${d * 100}%;background:var(--ally)"></em><i class="dot p" style="left:${g.ps * 100}%"></i><i class="dot r" style="left:${g.rs * 100}%"></i></span><span class="num"><b>+${num((d * 100).toFixed(0))} pts</b>${pct(g.rs)} des réserves, ${pct(g.ps)} de la production</span></button>`).join("") +
        `<p class="foot">Nous excluons la Chine et la Russie, ainsi que le lithium américain, dont la production n'est pas publiée. Cliquez sur une ligne pour ouvrir la matière.</p>`;
      $("mannesChart").addEventListener("click", e => { const b = e.target.closest("[data-mat]"); if (!b) return; $("partenaires").scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" }); });
    })();
  }
  // ce que produit chaque pays, pour la carte
  const PROD_BY = {};
  MAT_ORDER.forEach(({ m, st }) => st.rows.forEach((r, i) => { if (r.c === "ZZ") return; (PROD_BY[r.c] = PROD_BY[r.c] || []).push({ m, s: r.s, rank: i + 1 }); }));

  /* ======================================================================
     LES PAYS PRODUCTEURS : tableau croisé, Afrique, décisions, écarts entre sources
     ====================================================================== */
  const PY = D.pays || { continents: {}, types: {}, dossiers: [], ue: [], ecarts: [] };
  const CONT = {}; Object.entries(PY.continents || {}).forEach(([k, L]) => L.forEach(c => { CONT[c] = k; }));
  const DOSS = {}; (PY.dossiers || []).forEach(d => { DOSS[d.c] = d; });
  const UEP = {}; (PY.ue || []).forEach(([c, d, s]) => { UEP[c] = { d, s }; });
  const SHARE = {}; MAT_ORDER.forEach(({ m, st }) => st.rows.forEach(r => { if (r.c !== "ZZ") (SHARE[r.c] = SHARE[r.c] || {})[m.id] = r.s; }));
  // pays qui fournissent au moins 5 % d'une matière : sert à la carte
  const MINC = {}; Object.entries(SHARE).forEach(([c, o]) => { const L = MAT_ORDER.filter(({ m }) => (o[m.id] || 0) >= .05).map(({ m }) => ({ m, s: o[m.id] })); if (L.length) MINC[c] = L; });
  const MIN_RANK = Object.entries(MINC).sort((a, b) => b[1].length - a[1].length || nom(a[0]).localeCompare(nom(b[0]), "fr"));
  const short = m => m.court || m.nom;
  const typeTag = t => `<span class="dtype t-${esc(t)}">${esc((PY.types || {})[t] || t)}</span>`;
  const statTag = s => s && s !== "en vigueur" ? `<span class="dstat s-${esc(s.replace(/\s+/g, "-").normalize("NFD").replace(/[̀-ͯ]/g, ""))}">${esc(s)}</span>` : "";
  const ueLine = c => UEP[c] ? `<p class="ue-line">${UEP[c].s === "suspendu" ? "Le partenariat avec l'Union européenne sur les matières premières, signé" : "Partenariat avec l'Union européenne sur les matières premières, signé"} ${UEP[c].d.length > 7 ? "le" : "en"} ${one(UEP[c].d)}${UEP[c].s === "suspendu" ? ", est suspendu." : "."}</p>` : "";
  function mesuresHTML(d, compact) {
    return `<ol class="mesures">${d.mesures.slice().sort((a, b) => b.date.localeCompare(a.date)).map(x => `<li><div class="mhead"><time>${esc(one(x.date))}</time>${typeTag(x.type)}${statTag(x.statut)}</div><p>${esc(x.txt)}</p>${x.cit && !compact ? `<blockquote class="mcit" lang="en">« ${esc(x.cit)} »</blockquote>` : ""}${compact ? "" : refList(x.refs)}</li>`).join("")}</ol>`;
  }

  /* ---------- le tableau croisé ---------- */
  const cellCls = s => s >= .5 ? 6 : s >= .3 ? 5 : s >= .15 ? 4 : s >= .05 ? 3 : s >= .01 ? 2 : s > 0 ? 1 : 0;
  let crossCont = "all";
  function renderCross() {
    if (!MAT_ORDER.length) return;
    const rows = Object.entries(SHARE).filter(([, o]) => Math.max(...Object.values(o)) >= .03)
      .map(([c, o]) => ({ c, o, n5: Object.values(o).filter(v => v >= .05).length, mx: Math.max(...Object.values(o)), k: CONT[c] || "Autres" }));
    const order = Object.keys(PY.continents || {});
    const counts = {}; rows.forEach(r => { counts[r.k] = (counts[r.k] || 0) + 1; });
    $("croiseCont").innerHTML = [["all", "Tous les continents", rows.length], ...order.filter(k => counts[k]).map(k => [k, k, counts[k]])].map(([k, v, n]) => `<button type="button" class="chip" data-k="${esc(k)}" aria-pressed="${k === crossCont}">${esc(v)} <span class="c">${n}</span></button>`).join("");
    const R = rows.filter(r => crossCont === "all" || r.k === crossCont).sort((a, b) => order.indexOf(a.k) - order.indexOf(b.k) || b.n5 - a.n5 || b.mx - a.mx);
    const cols = MAT_ORDER.map(x => x.m);
    let last = "";
    const body = R.map(r => {
      const grp = r.k !== last && crossCont === "all" ? `<tr class="grp"><th scope="rowgroup" colspan="${cols.length + 1}">${esc(r.k)}</th></tr>` : ""; last = r.k;
      return grp + `<tr${IMP.includes(r.c) ? ` class="imp" style="--c:${r.c === "CN" ? "var(--cn)" : "var(--ru)"}"` : ""}><th scope="row">${flag(r.c)}<span>${esc(nom(r.c))}</span></th>${cols.map(m => { const s = r.o[m.id] || 0, k = cellCls(s); return `<td class="h${k}">${s ? `<button type="button" data-mat="${esc(m.id)}" title="${esc(nom(r.c))}, ${esc(m.nom)} : ${pct(s)} de la production mondiale en ${m.annees[m.annees.length - 1]}">${s >= .01 ? Math.round(s * 100) : "‹1"}</button>` : ""}</td>`; }).join("")}</tr>`;
    }).join("");
    $("croise").innerHTML = `<table class="cross"><caption class="sr">Part de chaque pays dans la production mondiale de chaque matière, en pourcentage</caption><thead><tr><th scope="col"><span class="sr">Pays</span></th>${cols.map(m => `<th scope="col"><span>${esc(short(m))}</span></th>`).join("")}</tr></thead><tbody>${body}</tbody></table>
      <div class="cross-legend"><span>Part de la production mondiale :</span>${["moins de 1 %", "1 à 5 %", "5 à 15 %", "15 à 30 %", "30 à 50 %", "plus de 50 %"].map((t, i) => `<span><i class="h${i + 1}"></i>${t}</span>`).join("")}<span><i class="ln" style="border-color:var(--cn)"></i>Chine ou Russie</span></div>`;
  }
  if ($("croise")) {
    renderCross();
    $("croiseCont").addEventListener("click", e => { const b = e.target.closest("[data-k]"); if (!b) return; crossCont = b.dataset.k; renderCross(); });
    $("croise").addEventListener("click", e => { if (e.target.closest("[data-mat]")) $("partenaires").scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" }); });
  }

  /* ---------- l'Afrique ---------- */
  if ($("afChart") && MAT_ORDER.length) {
    const isAf = c => CONT[c] === "Afrique";
    const AF = MAT_ORDER.map(({ m, st }) => {
      const p = st.rows.filter(r => isAf(r.c)).reduce((s, r) => s + r.s, 0);
      const R = m.res && m.monde_res ? Object.entries(m.res).filter(([c]) => isAf(c)).reduce((s, [, v]) => s + v, 0) / m.monde_res : null;
      const top = st.rows.filter(r => isAf(r.c))[0];
      return { m, p, R: Object.keys(m.res || {}).length ? R : null, top, cn: st.cn };
    }).sort((a, b) => b.p - a.p);
    const half = AF.filter(x => x.p >= .5), quarter = AF.filter(x => x.p >= .25);
    const lastY = Math.max(...MAT_ORDER.map(x => x.m.annees.slice(-1)[0])), older = MAT_ORDER.filter(x => x.m.annees.slice(-1)[0] < lastY).map(x => x.m.nom.toLowerCase());
    $("afIntro").textContent = `En ${lastY}${older.length ? ` (${lastY - 1} pour ${older.join(" et ")})` : ""}, l'Afrique a fourni plus de la moitié de la production mondiale pour ${half.length} des ${AF.length} matières que nous suivons, et plus du quart pour ${quarter.length} d'entre elles. Ses gouvernements veulent désormais transformer ce minerai sur place.`;
    $("afChart").innerHTML = `<h3>La part de l'Afrique, matière par matière <small>production de la dernière année publiée</small></h3><div class="gap-legend af-legend"><span><i class="sw" style="background:var(--ally)"></i>Part de la production mondiale</span><span><i class="dot r"></i>Part des réserves mondiales</span></div>` +
      AF.filter(x => x.p > 0).map(x => `<button type="button" class="afrow" data-mat="${esc(x.m.id)}"><span class="lab"><b>${esc(short(x.m))}</b>${x.top ? `<small>${flag(x.top.c)} ${esc(nom(x.top.c))} ${pct(x.top.s)}</small>` : ""}</span><span class="pb-w">${x.p ? `<i style="width:${Math.max(.6, x.p * 100)}%;background:var(--ally)"></i>` : ""}${x.R ? `<i class="dot r" style="left:${x.R * 100}%"></i>` : ""}</span><span class="num"><b>${x.p ? pct(x.p) : "0 %"}</b>${x.R ? `${pct(x.R)} des réserves` : x.R === 0 ? "réserves africaines non publiées" : ""}</span></button>`).join("") +
      `<p class="foot">${AF.filter(x => !x.p).length ? `Aucun pays africain n'est détaillé par la source pour ${AF.filter(x => !x.p).map(x => x.m.nom.toLowerCase()).join(", ")}. ` : ""}Les « autres pays » non détaillés par la source ne sont comptés dans aucun continent : la part africaine est un minimum. Cliquez sur une matière pour l'ouvrir. ${refList(["usgs-2026", "wna-mines-2026"])}</p>`;
    $("afChart").addEventListener("click", e => { if (e.target.closest("[data-mat]")) $("partenaires").scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" }); });
    const afD = (PY.dossiers || []).filter(d => isAf(d.c));
    const exig = afD.filter(d => d.mesures.some(x => ["brut", "transfo", "etat", "quota"].includes(x.type)));
    const ueAf = (PY.ue || []).filter(([c]) => isAf(c));
    const gn = DOSS.GN, ne = DOSS.NE;
    $("afText").innerHTML = `<h3>Ce que l'Afrique exige</h3><p>${exig.length} des ${afD.length} pays africains que nous suivons ont décidé, depuis 2020, d'interdire l'export de minerai brut, de plafonner leurs ventes, de prendre une part du capital ou d'exiger des usines sur place : ${exig.map(d => `${flag(d.c)} ${esc(nom(d.c))}`).join(", ")}.</p>
      <p>L'Union africaine a fixé le cap en mars 2025, dans sa stratégie des minerais verts :</p><blockquote class="mcit"><span lang="en">« The AGMS recognizes that Africa must move beyond raw mineral exports and build strong, integrated value chains »</span><span class="tr">L'Afrique doit dépasser l'export de minerais bruts et bâtir des chaînes de valeur solides et intégrées.</span></blockquote>${refList(["au-agms-2025"])}
      <h3>Ce que font la Chine et l'Europe</h3><p>La Chine est le premier acheteur : ${gn ? "74 % de la bauxite exportée par la Guinée en 2025 est partie vers la Chine. " : ""}Selon l'institut allemand SWP, les contrats d'achat de long terme profitent surtout aux acheteurs chinois.</p>
      <p>L'Union européenne a signé ${ueAf.length} partenariats sur les matières premières en Afrique : ${ueAf.map(([c, d, s]) => `${flag(c)} ${esc(nom(c))} (${esc(year(d))}${s ? ", " + esc(s) : ""})`).join(", ")}. Le même institut juge qu'elle peine à les traduire en projets :</p><blockquote class="mcit"><span lang="en">« African partners expect cooperation on industrial projects and deeper integration into value chains »</span><span class="tr">Les partenaires africains attendent une coopération sur des projets industriels et une place plus grande dans les chaînes de valeur.</span></blockquote>${refList(["swp-afrique-2026", "reuters-gn-2026"])}
      <h3>Ce que la France peut proposer</h3><p>Acheter des produits transformés en Afrique, comme des alliages de manganèse ou du sulfate de cobalt, plutôt que du minerai. Financer avec nos partenaires les usines et les voies ferrées, comme l'Agence française de développement le fait pour le Transgabonais. Partager la valeur dès le contrat.</p>${ne ? `<p>Le Niger montre ce que coûte un partenariat que le pays producteur juge déséquilibré : son gouvernement a nationalisé la Somaïr en 2025, en reprochant à Orano d'avoir pris 86,3 % de la production depuis 1971. ${refList(["aj-niger-2025"])}</p>` : ""}`;
  }

  /* ---------- ce que décident les pays producteurs ---------- */
  if ($("dossiers") && (PY.dossiers || []).length) {
    const DS = PY.dossiers, ALLM = DS.flatMap(d => d.mesures.map(x => ({ d, x })));
    const brut = new Set(ALLM.filter(({ x }) => x.type === "brut" && x.statut !== "abandonnée").map(({ d }) => d.c));
    $("prodIntro").textContent = `Nous avons relevé ${ALLM.length} décisions prises par ${DS.length} pays producteurs. ${brut.size} d'entre eux interdisent déjà, ou ont décidé d'interdire, l'export de minerai brut : ce que nous achèterons demain sera de plus en plus souvent transformé chez eux.`;
    const PS = { cont: "all", type: "all" };
    const order = Object.keys(PY.continents || {});
    function renderDoss() {
      const conts = order.filter(k => DS.some(d => CONT[d.c] === k));
      $("prodCont").innerHTML = [["all", "Tous les continents"], ...conts.map(k => [k, k])].map(([k, v]) => `<button type="button" class="chip" data-k="${esc(k)}" aria-pressed="${k === PS.cont}">${esc(v)} <span class="c">${DS.filter(d => k === "all" || CONT[d.c] === k).length}</span></button>`).join("");
      $("prodType").innerHTML = [["all", "Toutes les décisions"], ...Object.entries(PY.types || {})].map(([k, v]) => { const n = ALLM.filter(({ x }) => k === "all" || x.type === k).length; return n ? `<button type="button" class="chip" data-t="${esc(k)}" aria-pressed="${k === PS.type}">${k === "all" ? "" : `<i class="tdot t-${esc(k)}"></i>`}${esc(v)} <span class="c">${n}</span></button>` : ""; }).join("");
      const L = DS.filter(d => (PS.cont === "all" || CONT[d.c] === PS.cont) && (PS.type === "all" || d.mesures.some(x => x.type === PS.type)))
        .sort((a, b) => order.indexOf(CONT[a.c]) - order.indexOf(CONT[b.c]) || b.mesures.length - a.mesures.length);
      $("dossiers").innerHTML = L.map(d => {
        const PB = (PROD_BY[d.c] || []).filter(x => x.s >= .01).sort((a, b) => b.s - a.s);
        const dd = PS.type === "all" ? d : Object.assign({}, d, { mesures: d.mesures.filter(x => x.type === PS.type) });
        return `<article class="dossier" id="pays-${esc(d.c)}"><header>${flag(d.c, "lg")}<div><b>${esc(nom(d.c))}</b><span>${esc(CONT[d.c] || "")}</span></div></header><p class="dres">${esc(d.resume)}</p>
          ${PB.length ? `<p class="dmat">${PB.map(x => `<a href="#partenaires" data-mat="${esc(x.m.id)}">${esc(short(x.m))} ${pct(x.s)}</a>`).join("")}</p>` : ""}
          ${mesuresHTML(dd)}
          ${d.calcul ? `<p class="calc"><b>Notre calcul.</b> ${esc(d.calcul)}</p>` : ""}${d.verif ? `<p class="verif"><b>Vérification.</b> ${esc(d.verif)}</p>` : ""}${d.lecture ? `<p class="lect"><b>Notre lecture.</b> ${esc(d.lecture)}</p>` : ""}${d.refs ? refList(d.refs) : ""}${ueLine(d.c)}</article>`;
      }).join("") || `<p class="empty">Aucune décision de ce type pour ce continent.</p>`;
    }
    renderDoss();
    $("prodCont").addEventListener("click", e => { const b = e.target.closest("[data-k]"); if (!b) return; PS.cont = b.dataset.k; renderDoss(); });
    $("prodType").addEventListener("click", e => { const b = e.target.closest("[data-t]"); if (!b) return; PS.type = b.dataset.t; renderDoss(); });
    // un lien vers une fiche pays : on lève les filtres pour que la fiche existe
    document.addEventListener("click", e => { if (e.target.closest("[data-goto-pays]") && (PS.cont !== "all" || PS.type !== "all")) { PS.cont = PS.type = "all"; renderDoss(); } }, true);
    const U = (PY.ue || []).slice().sort((a, b) => a[1].localeCompare(b[1]));
    const byC = {}; U.forEach(([c]) => { const k = CONT[c] || "Autres"; byC[k] = (byC[k] || 0) + 1; });
    $("uePanel").innerHTML = `<h3>Les partenariats de l'Union européenne sur les matières premières</h3><p class="hint">L'Union a signé ${U.length} partenariats depuis 2021 : ${Object.entries(byC).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n} ${k === "Europe" ? "en Europe" : k === "Afrique" ? "en Afrique" : k === "Asie" ? "en Asie" : k === "Océanie" ? "en Océanie" : "dans les " + k}`).join(", ")}. Aucun ne lie un pays d'Asie du Sud-Est, où se trouvent le nickel indonésien et la bauxite vietnamienne.</p><ol class="ue-tl">${U.map(([c, d, s]) => `<li${s ? ` class="off"` : ""}><time>${esc(one(d))}</time><span>${flag(c)} ${esc(nom(c))}${s ? ` <em>${esc(s)}</em>` : ""}</span></li>`).join("")}</ol>${refList(PY.ue_refs)}`;
  }

  /* ---------- quand les sources divergent ---------- */
  if ($("ecartList") && (PY.ecarts || []).length) {
    const V = { accord: ["Les sources concordent", "ok"], ecart: ["Les sources divergent", "ko"], incomparable: ["Chiffres non comparables", "na"] };
    $("ecartList").innerHTML = PY.ecarts.map(e => {
      const m = PA.matieres.find(x => x.id === e.mat), v = V[e.verdict] || V.ecart;
      return `<article class="ecart"><header>${flag(e.c, "lg")}<div><b>${esc(e.titre)}</b>${m ? `<a href="#partenaires" data-mat="${esc(m.id)}">${esc(m.nom)}</a>` : ""}</div><span class="verdict ${v[1]}">${v[0]}</span></header>
        <div class="two">${[e.a, e.b].map(([l, val, r]) => `<div><span class="lab">${esc(l)}</span><b>${esc(val)}</b>${refList([r])}</div>`).join("")}</div><p>${esc(e.txt)}</p></article>`;
    }).join("");
  }

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
  if (META.souverainete) {
    const SV = META.souverainete;
    $("souvTitle").textContent = SV.titre; $("souvDef").textContent = SV.def;
    const sov = inst.filter(p => p.lv === 1), cap = inst.filter(p => surplus(p) && hasInputs(p));
    $("souvPoints").innerHTML = SV.points.map(([t, x]) => `<div><b>${esc(t)}</b>${esc(x)}</div>`).join("") +
      `<div class="souv-sum"><b>Ce que ça donne aujourd'hui.</b>${sov.length} produit${sov.length > 1 ? "s sont souverains" : " est souverain"} : ${sov.map(p => `<button type="button" class="lnk" data-open="${esc(p.id)}">${esc(p.n)}</button>`).join(", ")}. ${cap.length} autres produits sont excédentaires mais dépendent d'intrants importés : ${cap.map(p => `<button type="button" class="lnk" data-open="${esc(p.id)}">${esc(p.n)}</button>`).join(", ")}.</div>`;
  }
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
  // la méthode des partenaires
  $("evalCards").innerHTML = [
    ["La part de chaque pays", "part = production du pays ÷ production mondiale", "La même année, dans la même unité. Les « autres pays » de la source sont regroupés."],
    ["La part des puissances", "part = (production chinoise + production russe) ÷ production mondiale", "Nous retenons la Chine et la Russie, qui ont déjà utilisé leurs matières premières contre la France ou l'Europe."],
    ["L'indice de concentration", "indice = somme des carrés des parts, en points", "Au-delà de 1 800 points, le marché est très concentré, selon les lignes directrices américaines de 2023."],
    ["L'écart réserves-production", "écart = part des réserves − part de la production", "Un écart positif signale un pays qui a de quoi produire davantage : un gisement de demain."],
    ["La durée des réserves", "durée = réserves ÷ production annuelle", "C'est un ordre de grandeur : les réserves évoluent avec les prix, les découvertes et les techniques."],
    ["La couverture de nos besoins", "couverture = production du partenaire ÷ besoin annuel français", "Nous ne la calculons que lorsque le besoin français est publié, comme pour l'uranium."],
    ["La part de l'Afrique", "part africaine = somme des parts des pays africains", "Les pays sont rattachés aux continents selon la nomenclature des Nations unies. Les « autres pays » non détaillés par la source ne comptent pour aucun continent : la part africaine est un minimum."],
    ["Le tableau croisé", "case = part du pays dans la production mondiale", "Nous montrons les pays qui fournissent au moins 3 % d'une matière, en six teintes : moins de 1 %, 1 à 5 %, 5 à 15 %, 15 à 30 %, 30 à 50 %, plus de 50 %."],
    ["Les décisions des producteurs", "une décision = un texte daté, classé dans un des sept types", "Interdiction du brut, quota, part de l'État, usines exigées, loi ou stratégie, voies d'export, contrats. Chaque décision a un état : en vigueur, annoncée, en suspens ou abandonnée."],
    ["Les écarts entre sources", "écart = chiffre du pays ÷ chiffre de l'USGS − 1", "Nous gardons une seule source par matière pour comparer les pays ; quand le pays producteur publie un autre chiffre, nous montrons les deux et disons lequel nous retenons."]
  ].map(([t, f, x]) => `<div class="mcard"><h3>${esc(t)}</h3><div class="formula">${esc(f)}</div><p>${esc(x)}</p></div>`).join("");
  // solidité des preuves : nature du chiffre, nombre de preuves, qualité et fraîcheur des sources
  const SOLW = { institution: 1, etat: 1, parlement: 1, donnees: 1, expertise: .75, ong: .75, programme: .5, doctrine: .5, presse: .25 };
  function solidite(p) {
    const pr = p.preuves || [];
    let s = { src: 2, calc: 1.5, est: .5 }[p.k] || 0;
    s += Math.min(3, pr.length) * .5;
    s += Math.max(0, ...pr.map(x => SOLW[(BIB[x.ref] || {}).type] || 0));
    const yrs = pr.map(x => +year((BIB[x.ref] || {}).date)).filter(Boolean);
    if (yrs.length && Math.max(...yrs) >= 2025) s += .5;
    return Math.round(s * 2) / 2;
  }
  P.forEach(p => { p.sol = solidite(p); });
  const solLab = v => v >= 4 ? "solide" : v >= 2.5 ? "correcte" : "fragile";
  (function sol() {
    const bins = [0, .5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map(v => ({ v, n: P.filter(p => p.sol === v).length }));
    const max = Math.max(...bins.map(b => b.n), 1), nS = P.filter(p => p.sol >= 4).length, nF = P.filter(p => p.sol < 2.5).length;
    $("solIntro").textContent = `Chaque fiche reçoit une note de solidité sur 5. Elle tient compte de la nature du chiffre (publié, calculé ou estimé), du nombre de preuves citées, du type de la meilleure source et de sa date. Aujourd'hui, ${nS} fiches sont solides et ${nF} restent fragiles : ce sont elles que nous voulons consolider en premier.`;
    $("solChart").innerHTML = `<h3>Les cent fiches, selon leur solidité</h3><div class="hist">${bins.map(b => `<div class="hcol"><span class="hn">${b.n || ""}</span><i style="height:${b.n / max * 100}%;background:${b.v >= 4 ? "var(--l1)" : b.v >= 2.5 ? "var(--l3)" : "var(--l4)"}"></i><span class="hl">${num(b.v)}</span></div>`).join("")}</div><p class="foot">Note = nature du chiffre (2 si publié, 1,5 si calculé, 0,5 si estimé) + 0,5 par preuve citée, jusqu'à 3 + 1 pour une source institutionnelle ou statistique (0,75 pour un institut de recherche, 0,25 pour la presse) + 0,5 si la source date de 2025 ou après.</p>`;
    const F = P.slice().sort((a, b) => a.sol - b.sol || a.n.localeCompare(b.n, "fr")).slice(0, 12);
    $("solList").innerHTML = `<h3>Les douze fiches à consolider en priorité</h3><ol class="sol-list">${F.map(p => `<li><button type="button" class="lnk" data-open="${esc(p.id)}">${esc(p.n)}</button><span>${num(p.sol)} sur 5</span></li>`).join("")}</ol>`;
  })();
  $("pipe").innerHTML = `<thead><tr><th>Source</th><th>Ce que nous en tirons</th><th>Rythme</th><th>Automatisable</th></tr></thead><tbody>` +
    D.sources.map(r => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`).join("") + `</tbody>`;

  if (D.bibliographie) {
    let bt = "all", bq = "";
    const SE = LV.sources_etat || {};
    const counts = {}; D.bibliographie.forEach(b => { counts[b.type] = (counts[b.type] || 0) + 1; b.key = norm(`${b.auteur} ${b.titre} ${b.apport} ${b.date}`); });
    const bo = ["institution", "etat", "parlement", "doctrine", "expertise", "donnees", "ong", "programme", "presse"].filter(t => counts[t]);
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
      ["puissances", "Carte des dépendances", "La carte du monde de nos dépendances, et les stratégies de Pékin, Washington et Moscou.", `${HOLD_RANK.length} pays fournisseurs sur la carte.`],
      ["partenaires", "Partenaires de demain", "Pour vingt matières critiques, qui produit, qui possède les réserves, et qui pourrait nous fournir.", `${(D.partenaires || { matieres: [] }).matieres.length} matières, chiffres à l'appui.`],
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
        if (h.startsWith("ref-") || h.startsWith("pays-")) { el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }
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
  const wo = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { wall.querySelectorAll(".wall").forEach(w => w.classList.add("anim")); wo.disconnect(); } }), { threshold: 0.05 });
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
