#!/usr/bin/env node
/* Construit la carte du monde (site/data/carte.json) et les drapeaux (site/assets/flags.js).
   Dépendances (à installer une fois, hors du dépôt) :
     npm i --no-save world-atlas@2.0.2 d3-geo@3.1.1 topojson-client@3.1.0 i18n-iso-countries@7.13.0 flag-icons@7.2.3
   Usage : node tools/build_carte.js [dossier node_modules]
   Tout est précalculé : le site n'a besoin d'aucune bibliothèque pour afficher la carte. */
const path = require("path"), fs = require("fs");
const NM = process.argv[2] || path.join(process.cwd(), "node_modules");
const req = m => require(path.join(NM, m));
const topo = req("topojson-client"), geo = req("d3-geo");
const iso = req("i18n-iso-countries"); iso.registerLocale(req("i18n-iso-countries/langs/fr.json"));
const world = req("world-atlas/countries-110m.json");
const ROOT = path.resolve(__dirname, ".."), DATA = path.join(ROOT, "site", "data");
const J = f => JSON.parse(fs.readFileSync(path.join(DATA, f + ".json"), "utf8"));

// noms courts en français (ceux du site priment sur ceux de la norme)
const META = J("meta");
const NOMS = Object.assign({ AE: "Émirats arabes unis", NG: "Nigeria", KR: "Corée du Sud", KP: "Corée du Nord", CD: "RD Congo", CG: "Congo", US: "États-Unis", RU: "Russie", GB: "Royaume-Uni",
  CZ: "Tchéquie", VN: "Viêt Nam", IR: "Iran", SY: "Syrie", TZ: "Tanzanie", BO: "Bolivie", VE: "Venezuela", MD: "Moldavie", LA: "Laos", TW: "Taïwan",
  CI: "Côte d'Ivoire", MK: "Macédoine du Nord", BA: "Bosnie-Herzégovine", NC: "Nouvelle-Calédonie" }, META.detenteurs);
const nomFr = c => NOMS[c] || iso.getName(c, "fr", { select: "alias" }) || iso.getName(c, "fr") || c;

const fc = topo.feature(world, world.objects.countries);
fc.features = fc.features.filter(f => f.id !== "010"); // sans l'Antarctique
const W = 960, H = 470;
const proj = geo.geoEqualEarth().rotate([-10, 0]).fitExtent([[4, 4], [W - 4, H - 4]], fc);
const gp = geo.geoPath(proj).digits(1);
const pays = [], ancres = {};
fc.features.forEach(f => {
  let c = iso.numericToAlpha2(f.id);
  if (!c && f.properties.name === "Kosovo") c = "XK";
  if (!c && /Cyprus/.test(f.properties.name)) c = "CY";
  if (!c) c = "X" + (f.id || f.properties.name).slice(0, 2);
  const d = gp(f); if (!d) return;
  // ancre : centre du plus grand morceau (la France métropolitaine plutôt que la Guyane)
  let g = f.geometry;
  if (g.type === "MultiPolygon") {
    const parts = g.coordinates.map(p => ({ type: "Polygon", coordinates: p }));
    g = parts.reduce((a, b) => geo.geoArea(b) > geo.geoArea(a) ? b : a);
  }
  const [x, y] = proj(c === "FR" ? [2.4, 46.6] : c === "US" ? [-98, 39] : c === "NO" ? [9, 61] : c === "RU" ? [60, 58] : c === "CA" ? [-100, 56] : geo.geoCentroid(g));
  ancres[c] = [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  pays.push({ c, n: nomFr(c), d });
});
// petits pays absents au 1/110 000 000 : on place seulement une ancre
[["SG", [103.8, 1.35]], ["MT", [14.4, 35.9]], ["BH", [50.5, 26]], ["NC", [165.6, -21.3]], ["TT", [-61.2, 10.4]], ["MU", [57.6, -20.3]]].forEach(([c, ll]) => {
  if (!ancres[c]) { const [x, y] = proj(ll); ancres[c] = [Math.round(x * 10) / 10, Math.round(y * 10) / 10]; }
});
const noms = {}; Object.keys(ancres).forEach(c => { noms[c] = nomFr(c); });
fs.writeFileSync(path.join(DATA, "carte.json"), JSON.stringify({ w: W, h: H, pays, ancres, noms }));
console.log("carte.json :", pays.length, "pays,", (fs.statSync(path.join(DATA, "carte.json")).size / 1024).toFixed(0), "Ko");

// ---------- drapeaux : uniquement ceux dont le site parle ----------
const norm = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const parNom = {};
Object.entries(iso.getNames("fr", { select: "official" })).forEach(([c, n]) => { parNom[norm(n)] = c; });
Object.entries(NOMS).forEach(([c, n]) => { parNom[norm(n)] = c; });
Object.assign(parNom, { europe: "EU", "union europeenne": "EU", ue: "EU", coree: "KR", "pays africains": "AFR" });
const besoin = new Set(["FR", "EU"]);
const ajoute = n => { const k = parNom[norm(String(n).replace(/\(.*?\)/g, ""))]; if (k) besoin.add(k); };
Object.keys(META.detenteurs).forEach(c => besoin.add(c));
J("produits").forEach(p => (p.al || []).forEach(a => a.pays.forEach(ajoute)));
J("chaines").forEach(ch => ch.etapes.forEach(s => String(s.qui).split(/,| puis | et /).forEach(ajoute)));
(J("zoom_armees").items || []).forEach(x => (x.pays || []).forEach(c => besoin.add(c)));
J("allies").forEach(a => [...(a.pays || []), ...(a.fournisseurs || [])].forEach(c => besoin.add(c)));
(J("actus") || []).forEach(a => (a.pays || []).forEach(c => besoin.add(c)));
const PA = fs.existsSync(path.join(DATA, "partenaires.json")) ? J("partenaires") : { matieres: [] };
PA.matieres.forEach(m => {
  [m.prod, m.res, (m.raffinage || {}).lignes].forEach(o => Object.keys(o || {}).forEach(c => besoin.add(c)));
  (m.partenaires || []).forEach(x => besoin.add(x.c));
  ((m.controle || {}).lignes || []).forEach(l => besoin.add(l[1]));
});
(J("echeances") || []).forEach(e => (e.pays || []).forEach(c => besoin.add(c)));
if (fs.existsSync(path.join(DATA, "pays.json"))) { const PY = J("pays"); (PY.dossiers || []).forEach(d => besoin.add(d.c)); (PY.ue || []).forEach(u => besoin.add(u[0])); (PY.ecarts || []).forEach(e => besoin.add(e.c)); }
besoin.delete("ZZ");
besoin.delete("DIV"); besoin.delete("AFR");
const FL = path.join(NM, "flag-icons", "flags", "4x3");
// drapeaux trop lourds (armoiries détaillées) : version simplifiée, lisible à petite taille
const bandes = (a, b, c) => `<path fill="${a}" d="M0 0h640v160H0z"/><path fill="${b}" d="M0 160h640v160H0z"/><path fill="${c}" d="M0 320h640v160H0z"/>`;
let damier = ""; for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) if ((i + j) % 2 === 0) damier += `<path fill="#f00" d="M${280 + j * 16} ${150 + i * 16}h16v16h-16z"/>`;
const vbandes = (a, b, c) => `<path fill="${a}" d="M0 0h213v480H0z"/><path fill="${b}" d="M213 0h214v480H213z"/><path fill="${c}" d="M427 0h213v480H427z"/>`;
const SIMPLES = {
  ES: `<path fill="#AA151B" d="M0 0h640v480H0z"/><path fill="#F1BF00" d="M0 120h640v240H0z"/>`,
  BO: bandes("#D52B1E", "#F9E300", "#007934"),
  RS: bandes("#C6363C", "#0C4076", "#fff"),
  HR: bandes("#f00", "#fff", "#171796") + `<path fill="#fff" stroke="#f00" stroke-width="4" d="M280 150h80v70q0 40-40 52-40-12-40-52z"/>` + damier,
  EG: bandes("#CE1126", "#fff", "#000") + `<circle cx="320" cy="240" r="40" fill="#C09300"/>`,
  MX: vbandes("#006847", "#fff", "#CE1126") + `<circle cx="320" cy="240" r="44" fill="#8C5A2B"/>`,
  GT: vbandes("#4997D0", "#fff", "#4997D0") + `<circle cx="320" cy="240" r="40" fill="none" stroke="#5C8A3B" stroke-width="10"/>`,
  IR: bandes("#239F40", "#fff", "#DA0000") + `<circle cx="320" cy="240" r="34" fill="none" stroke="#DA0000" stroke-width="10"/>`,
  LK: `<path fill="#FFBE29" d="M0 0h640v480H0z"/><path fill="#00534E" d="M30 30h80v420H30z"/><path fill="#EB7400" d="M110 30h80v420h-80z"/><path fill="#8D153A" d="M220 30h390v420H220z"/>`
};
let sprite = "", n = 0;
[...besoin].sort().forEach(c => {
  const f = path.join(FL, c.toLowerCase() + ".svg");
  if (!SIMPLES[c] && !fs.existsSync(f)) { console.warn("pas de drapeau pour", c); return; }
  let s = SIMPLES[c] ? `<svg viewBox="0 0 640 480">${SIMPLES[c]}</svg>` : fs.readFileSync(f, "utf8");
  const vb = (/viewBox="([^"]+)"/.exec(s) || [, "0 0 640 480"])[1];
  s = s.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const p = "f" + c.toLowerCase() + "-";
  s = s.replace(/id="([^"]+)"/g, `id="${p}$1"`).replace(/url\(#([^)]+)\)/g, `url(#${p}$1)`).replace(/href="#([^"]+)"/g, `href="#${p}$1"`);
  s = s.replace(/>\s+</g, "><").replace(/\s{2,}/g, " ");
  sprite += `<symbol id="fl-${c.toLowerCase()}" viewBox="${vb}">${s}</symbol>`; n++;
});
const alias = {}; Object.entries(parNom).forEach(([k, c]) => { if (besoin.has(c) || c === "AFR") alias[k] = c; });
const out = `/* Drapeaux (flag-icons, licence MIT, https://github.com/lipis/flag-icons), générés par tools/build_carte.js. */\nwindow.BD_FLAGS = ${JSON.stringify({ sprite: `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">${sprite}</svg>`, alias })};\n`;
fs.writeFileSync(path.join(ROOT, "site", "assets", "flags.js"), out);
console.log("flags.js :", n, "drapeaux,", (out.length / 1024).toFixed(0), "Ko");
