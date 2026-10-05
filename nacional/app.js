/* Página nacional — MOBI. Brasil, regiões, estados e cidades; todos os cargos; mapas, escolas, comparação, brancos e nulos.
   Dados: /brasil.json (arquivos oficiais do TSE por estado), /municipio.json (TSE por cidade) e os servidores de cada estado
   (/<uf>/api/...: boletins de urna por município e por escola). O número do candidato é só chave interna: nunca aparece na tela. */
"use strict";

/* ------------------------------------------------------------------ utilidades */
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const semAcento = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const nome = s => String(s ?? "").toLowerCase().replace(/(^|[\s(/-])\S/g, c => c.toUpperCase())
  .replace(/\b(De|Da|Do|Das|Dos|E)\b/g, m => m.toLowerCase()).replace(/\b(Ii|Iii|Iv)\b/g, m => m.toUpperCase());
const nf = new Intl.NumberFormat("pt-BR");
const int = v => v == null ? "–" : nf.format(Math.round(v));
const pct = (v, d = 1) => v == null || !isFinite(v) ? "–" : (v * 100).toLocaleString("pt-BR", {minimumFractionDigits: d, maximumFractionDigits: d}) + "%";
const div = (a, b) => b > 0 ? a / b : null;
const prog = f => `<span class="prog"><i style="width:${Math.min(100, (f || 0) * 100).toFixed(1)}%"></i></span>`;
async function api(u) {
  if (window.ESTATICO_NAC) return apiEstatica(u);
  const r = await fetch(u, {cache: "no-store"}); if (!r.ok) throw new Error(`${r.status} ${u}`); return r.json();
}
// Versão final estática (sem servidor): as mesmas respostas, lidas de arquivos gerados (scripts/gerar-estatico.mjs)
const cacheEst = new Map();
const lerEst = arq => {
  if (!cacheEst.has(arq)) cacheEst.set(arq, fetch(arq).then(r => { if (!r.ok) throw new Error(`${r.status} ${arq}`); return r.json(); }));
  const p = cacheEst.get(arq); p.catch(() => cacheEst.delete(arq)); return p;
};
async function apiEstatica(u) {
  const [rota, qs] = u.split("?"); const q = new URLSearchParams(qs || ""); let m;
  if (rota === "/brasil.json") return lerEst("/dados/brasil.json");
  if (rota === "/cidades.json") return lerEst("/dados/cidades.json");
  if (rota === "/camara.json") return lerEst(`/dados/camara-${q.get("cargo") === "7" ? 7 : 6}.json`);
  if (rota.startsWith("/geo/")) return lerEst(rota);
  if ((m = rota.match(/^\/(\w\w)\/geo\/\w\w\.geojson$/))) return lerEst(`/dados/${m[1]}/${m[1]}.geojson`);
  if ((m = rota.match(/^\/(\w\w)\/api\/(status|candidatos)$/))) return lerEst(`/dados/${m[1]}/${m[2]}.json`);
  if ((m = rota.match(/^\/(\w\w)\/api\/cargo-municipios$/))) return lerEst(`/dados/${m[1]}/cm-${q.get("cargo")}.json`);
  if ((m = rota.match(/^\/(\w\w)\/api\/cargo-locais$/))) {
    const uf = m[1], cargo = Number(q.get("cargo")), mun = Number(q.get("mun"));
    const [o, cands, cid] = await Promise.all([lerEst(`/dados/${uf}/locais/${mun}.json`), lerEst(`/dados/${uf}/candidatos.json`), lerEst("/dados/cidades.json")]);
    return {uf, cargo, mun, nome: cid.find(c => c[0] === uf && c[1] === mun)?.[2] || "", locais: o[cargo] || [],
      candidatos: cands.filter(c => c.cargo === cargo).map(c => ({numero: c.numero, nomeUrna: c.nomeUrna, partido: c.partido}))};
  }
  if (rota === "/municipio.json") {
    // resultado oficial da cidade direto do TSE (o TSE libera a leitura pelo navegador)
    const uf = q.get("uf"), mun = Number(q.get("mun")), cargo = Number(q.get("cargo")) || 1, el = cargo === 1 ? 6257 : 6259;
    const tse = `https://resultados.tse.jus.br/oficial/ele2026/${el}/dados/${uf}/${uf}${String(mun).padStart(5, "0")}-c${String(cargo).padStart(4, "0")}-e${String(el).padStart(6, "0")}-u.json`;
    const d = await lerEst(tse);
    const n = v => Number(String(v ?? "").replace(",", ".")) || 0;
    const cands = [];
    for (const a of d.carg?.[0]?.agr || []) for (const p of a.par || []) for (const c of p.cand || [])
      cands.push({n: Number(c.n), nome: c.nmu, partido: p.sg, votos: n(c.vap), pct: n(c.pvapn || c.pvap), eleito: c.e === "s" && !/2º turno/i.test(c.st || ""),
        turno2: /2º turno/i.test(c.st || ""), situacao: c.st || "", foto: c.sqcand ? `https://resultados.tse.jus.br/oficial/ele2026/${el}/fotos/${el === 6257 ? "br" : uf}/${c.sqcand}.jpeg` : null});
    cands.sort((a, b) => b.votos - a.votos);
    return {pct: n(d.s?.pstn || d.s?.pst), final: d.tf === "s", hora: d.hg ? `${d.dg} ${d.hg}` : null, vagas: Number(d.carg?.[0]?.nv) || 1,
      validos: n(d.v?.vv), brancos: n(d.v?.vb), nulos: n(d.v?.tvn), eleitores: n(d.e?.te), comparecimento: n(d.e?.c), abstencao: n(d.e?.a), candidatos: cands.slice(0, 60)};
  }
  throw new Error(`indisponível na versão final: ${u}`);
}
const lsGet = k => { try { return JSON.parse(localStorage.getItem("nac." + k)); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem("nac." + k, JSON.stringify(v)); } catch {} };

/* ------------------------------------------------------------------ animações (identidade MOBI)
   Números contam do zero até o valor quando aparecem, cartões entram ao rolar, barras crescem.
   Sem IntersectionObserver ou com "reduzir movimento": tudo aparece direto. */
const CALMO = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const TEM_IO = "IntersectionObserver" in window;
if (!CALMO && TEM_IO) document.documentElement.classList.add("anima");
const NUM_RE = /\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g;
function contar(el) {
  if (CALMO || document.hidden || !el?.isConnected) return;
  const txt = el.textContent;
  if (el.dataset.contou === txt) return;
  const nos = [];
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) { const n = w.currentNode; NUM_RE.lastIndex = 0; if (NUM_RE.test(n.nodeValue)) nos.push([n, n.nodeValue]); }
  if (!nos.length) return;
  el.dataset.contou = txt;
  const fmt = (m, k) => {
    if (/^(19|20)\d\d$/.test(m)) return m; // ano (ex.: 2026) fica como está
    const casas = (m.split(",")[1] || "").length;
    const v = parseFloat(m.replace(/\./g, "").replace(",", ".")) * k;
    return v.toLocaleString("pt-BR", {minimumFractionDigits: casas, maximumFractionDigits: casas, useGrouping: m.includes(".")});
  };
  const t0 = performance.now(), dur = 950, ease = x => 1 - Math.pow(1 - x, 3);
  const passo = agora => {
    const k = ease(Math.min(1, (agora - t0) / dur));
    if (k < 1) { for (const [n, orig] of nos) n.nodeValue = orig.replace(NUM_RE, m => fmt(m, k)); requestAnimationFrame(passo); }
    else for (const [n, orig] of nos) n.nodeValue = orig; // valor final exatamente como veio
  };
  for (const [n, orig] of nos) n.nodeValue = orig.replace(NUM_RE, m => fmt(m, 0));
  requestAnimationFrame(passo);
}
const ANIM_SEL = ".card, .pc, #conteudo > .tab-wrap, #conteudo > h3";
const CONTA_SEL = ".kpi .v, .kpi .s, .pc .v b, .pc .v small, .linha em, .uf-top .ap, .cands .card b";
const obsEntrada = !CALMO && TEM_IO ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) revelar(e.target); }), {threshold: 0.06, rootMargin: "0px 0px -3% 0px"}) : null;
function revelar(el) {
  obsEntrada?.unobserve(el);
  el.classList.add("visto");
  el.querySelectorAll("[data-conta]").forEach(n => { if (n.closest(".anim") === el) contar(n); });
}
const alvosDe = (raiz, sel) => [...(raiz.matches?.(sel) ? [raiz] : []), ...raiz.querySelectorAll(sel)];
function animar(raizes) {
  if (CALMO) return;
  let i = 0;
  for (const raiz of raizes) {
    if (!raiz.isConnected || raiz.closest(".leaflet-container") || raiz.tagName === "TR") continue;
    for (const el of alvosDe(raiz, ANIM_SEL)) {
      if (el.classList.contains("anim") || el.closest(".gaveta, .leaflet-container")) continue;
      el.classList.add("anim"); el.style.setProperty("--atraso", (i++ % 6) * 55 + "ms");
      if (obsEntrada) obsEntrada.observe(el); else el.classList.add("visto");
    }
    for (const n of alvosDe(raiz, CONTA_SEL)) {
      n.setAttribute("data-conta", "");
      const a = n.closest(".anim");
      if (!a || a.classList.contains("visto")) contar(n);
    }
  }
}
{
  const fila = new Set(); let marcado = false;
  const mo = new MutationObserver(ms => {
    for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) fila.add(n);
    if (!marcado && fila.size) { marcado = true; queueMicrotask(() => { marcado = false; const ns = [...fila]; fila.clear(); animar(ns); }); }
  });
  mo.observe($("#conteudo"), {childList: true, subtree: true});
  mo.observe($("#gaveta"), {childList: true, subtree: true});
}

/* ------------------------------------------------------------------ destaque no mapa e "ver no mapa"
   Os mapas registram as camadas por chave ("area|<estado ou município>", "loc|<colégio>"). Passar o mouse numa linha
   com data-lugar destaca o lugar; o botão data-ver rola até o mapa, dá zoom e pisca. No mapa do Brasil em SVG,
   passar o mouse num cartão de estado destaca o estado. */
const LUGARES = new Map();
function registrarMapa(id, mapa) { mapa._lugarId = id; LUGARES.set(id, {mapa, chaves: new Map()}); }
function registrar(mapa, chave, ly) {
  const r = LUGARES.get(mapa?._lugarId); if (!r || r.mapa !== mapa || !ly) return;
  const l = r.chaves.get(chave) || r.chaves.set(chave, []).get(chave);
  l.push(...(typeof ly.getLayers === "function" ? ly.getLayers() : [ly]));
}
function camadasDe(chave) {
  const out = [];
  for (const r of LUGARES.values()) {
    if (!r.mapa._loaded || !r.mapa.getContainer().isConnected) continue;
    const lys = (r.chaves.get(chave) || []).filter(l => l._map);
    if (lys.length) out.push({mapa: r.mapa, lys});
  }
  return out;
}
function realce(ly, liga) {
  if (!ly._map || !ly.setStyle) return;
  const ponto = typeof ly.getRadius === "function";
  if (liga) {
    if (!ly._orig) ly._orig = {color: ly.options.color, weight: ly.options.weight, opacity: ly.options.opacity, fillOpacity: ly.options.fillOpacity, raio: ponto ? ly.getRadius() : null};
    ly.setStyle(ponto ? {color: "#ffffff", weight: 2.5, opacity: 1, fillOpacity: 1} : {color: "#ffffff", weight: 3, opacity: 1});
    if (ponto) ly.setRadius(Math.max(ly._orig.raio * 1.5, ly._orig.raio + 4));
    ly.bringToFront?.();
  } else if (ly._orig) {
    const o = ly._orig; ly._orig = null;
    ly.setStyle({color: o.color, weight: o.weight, opacity: o.opacity, fillOpacity: o.fillOpacity});
    if (ponto && o.raio != null) ly.setRadius(o.raio);
  }
}
let lugarAtual = null, ufAtual = null;
function trocarDestaque(chave) {
  if (chave === lugarAtual) return;
  if (lugarAtual) for (const {lys} of camadasDe(lugarAtual)) lys.forEach(l => realce(l, false));
  lugarAtual = chave || null;
  if (lugarAtual) for (const {lys} of camadasDe(lugarAtual)) lys.forEach(l => realce(l, true));
}
function destacarUF(uf) {
  if (uf === ufAtual) return;
  document.querySelectorAll("#conteudo svg path.realce").forEach(p => p.classList.remove("realce"));
  ufAtual = uf || null;
  if (ufAtual) document.querySelectorAll(`#conteudo svg path[data-uf="${ufAtual}"]`).forEach(p => { p.classList.add("realce"); p.parentNode.appendChild(p); });
}
document.addEventListener("mouseover", e => {
  trocarDestaque(e.target.closest?.("[data-lugar]")?.dataset.lugar);
  const u = e.target.closest?.("[data-uf]");
  destacarUF(u && u.tagName !== "path" ? u.dataset.uf : null);
});
document.addEventListener("focusin", e => { const el = e.target.closest?.("[data-lugar],[data-ver]"); if (el) trocarDestaque(el.dataset.lugar || el.dataset.ver); });
function piscar(lys, chave) {
  let n = 0;
  lys.forEach(l => realce(l, true));
  const t = setInterval(() => {
    lys.forEach(l => l._map && l.setStyle({color: n % 2 ? "#ffffff" : "#55b8e6", weight: n % 2 ? 3 : 5}));
    if (++n > 7) { clearInterval(t); lys.forEach(l => { realce(l, false); if (lugarAtual === chave) realce(l, true); }); }
  }, 200);
}
function verNoMapa(chave) {
  const achado = typeof L === "undefined" ? null : camadasDe(chave)[0];
  if (!achado) return;
  const {mapa, lys} = achado;
  const el = mapa.getContainer();
  el.scrollIntoView({behavior: CALMO ? "auto" : "smooth", block: "center"});
  let feito = false;
  const fim = () => { if (feito) return; feito = true; piscar(lys, chave); if (lys.length === 1) lys[0].openTooltip?.(); };
  const op = {animate: !CALMO, duration: 1.1};
  setTimeout(() => {
    mapa.once("moveend", fim);
    if (lys.length === 1 && lys[0].getLatLng) mapa.flyTo(lys[0].getLatLng(), Math.max(mapa.getZoom(), 16), op);
    else { const b = L.latLngBounds([]); lys.forEach(l => b.extend(l.getBounds ? l.getBounds() : l.getLatLng())); mapa.flyToBounds(b.pad(0.2), {...op, maxZoom: 12}); }
    setTimeout(fim, 1600);
  }, CALMO ? 0 : 280);
}
document.addEventListener("click", e => {
  const b = e.target.closest?.("[data-ver]"); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  verNoMapa(b.dataset.ver);
}, true);
const btnVer = (chave, rot = "") => `<button type="button" class="ver-mapa" data-ver="${esc(chave)}" title="Ver no mapa" aria-label="Ver no mapa${rot ? ": " + esc(rot) : ""}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg><span class="t">Ver no mapa</span></button>`;

const NOMES = {ac: "Acre", al: "Alagoas", ap: "Amapá", am: "Amazonas", ba: "Bahia", ce: "Ceará", df: "Distrito Federal", es: "Espírito Santo", go: "Goiás",
  ma: "Maranhão", mt: "Mato Grosso", ms: "Mato Grosso do Sul", mg: "Minas Gerais", pa: "Pará", pb: "Paraíba", pr: "Paraná", pe: "Pernambuco", pi: "Piauí",
  rj: "Rio de Janeiro", rn: "Rio Grande do Norte", rs: "Rio Grande do Sul", ro: "Rondônia", rr: "Roraima", sc: "Santa Catarina", sp: "São Paulo", se: "Sergipe", to: "Tocantins"};
const REGIOES = {"Sudeste": ["sp", "mg", "rj", "es"], "Nordeste": ["ba", "pe", "ce", "ma", "pb", "rn", "al", "pi", "se"], "Sul": ["pr", "rs", "sc"],
  "Centro-Oeste": ["df", "go", "mt", "ms"], "Norte": ["pa", "am", "ro", "to", "ac", "ap", "rr"]};
const REGIAO_DE = Object.fromEntries(Object.entries(REGIOES).flatMap(([r, ufs]) => ufs.map(u => [u, r])));
const IBGE_UF = {11: "ro", 12: "ac", 13: "am", 14: "rr", 15: "pa", 16: "ap", 17: "to", 21: "ma", 22: "pi", 23: "ce", 24: "rn", 25: "pb", 26: "pe", 27: "al", 28: "se",
  29: "ba", 31: "mg", 32: "es", 33: "rj", 35: "sp", 41: "pr", 42: "sc", 43: "rs", 50: "ms", 51: "mt", 52: "go", 53: "df"};
const CAPITAL = {ac: 1200401, al: 2704302, ap: 1600303, am: 1302603, ba: 2927408, ce: 2304400, df: 5300108, es: 3205309, go: 5208707, ma: 2111300, mt: 5103403,
  ms: 5002704, mg: 3106200, pa: 1501402, pb: 2507507, pr: 4106902, pe: 2611606, pi: 2211001, rj: 3304557, rn: 2408102, rs: 4314902, ro: 1100205, rr: 1400100,
  sc: 4205407, sp: 3550308, se: 2800308, to: 1721000};
const CARGOS = [[1, "Presidente"], [3, "Governador"], [5, "Senador"], [6, "Dep. Federal"], [7, "Dep. Estadual"]];
const CHAVE_CARGO = {1: "presidente", 3: "governador", 5: "senador"};
// Paleta categórica validada para o fundo escuro; cinza para "outros"
const PALETA = ["#3d9fd6", "#c9782a", "#a467e0", "#2f9e6a", "#d1567a", "#c8b13a", "#5fb3b3", "#e07b53", "#8f9bd9", "#9bbf4a"];
const OUTRO = "#5b6470";
const RAMPA = ["#16324a", "#1d5578", "#2b7fb0", "#55b8e6", "#a9e0fa"];
const ESRI = "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/";

/* ------------------------------------------------------------------ estado */
const hashIni = Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
const N = {
  D: null, escopo: hashIni.e || "br", cargo: Number(hashIni.c) || 1, aba: hashIni.a || "resultado",
  modo: "lider", cidades: null, cmp: lsGet("cmp") || [], cmpCand: lsGet("cmpCand") || [], pk: null, escolaMun: {}, cacheUf: new Map(), mapa: null, geoBR: null, geoUF: new Map(),
};
const ehUF = e => !!NOMES[e];
const ehRegiao = e => e.startsWith("r:");
const ufsDoEscopo = () => N.escopo === "br" ? Object.keys(NOMES) : ehRegiao(N.escopo) ? REGIOES[N.escopo.slice(2)] : ehUF(N.escopo) ? [N.escopo] : [];
const nomeEscopo = () => N.escopo === "br" ? "Brasil" : ehRegiao(N.escopo) ? `Região ${N.escopo.slice(2)}` : N.escopo === "zz" ? "Exterior" : NOMES[N.escopo];
const cargoNome = c => c === 7 && N.escopo === "df" ? "Dep. Distrital" : (CARGOS.find(x => x[0] === c) || [, ""])[1];
const cargoReal = () => N.cargo === 7 && N.escopo === "df" ? 8 : N.cargo;
function salvarHash() { history.replaceState(null, "", `#e=${N.escopo}&c=${N.cargo}&a=${N.aba}`); }

/* ------------------------------------------------------------------ dados */
// Resumo de um escopo num cargo: o arquivo do TSE do Brasil/estado; regiões somam os estados (Presidente)
function resumoEscopo(cargo = N.cargo, escopo = N.escopo) {
  const D = N.D; if (!D) return null;
  if (cargo === 1 && escopo === "br") return D.brasil;
  if (ehUF(escopo) || escopo === "zz") return D.estados?.[escopo]?.[CHAVE_CARGO[cargo]] || null;
  if (cargo === 1 && ehRegiao(escopo)) return somar(REGIOES[escopo.slice(2)].map(u => D.estados?.[u]?.presidente).filter(Boolean));
  return null;
}
function somar(lista) {
  if (!lista.length) return null;
  const o = {validos: 0, brancos: 0, nulos: 0, eleitores: 0, comparecimento: 0, abstencao: 0, pctPeso: 0, final: lista.every(r => r.final), vagas: 1};
  const cands = new Map();
  for (const r of lista) {
    for (const k of ["validos", "brancos", "nulos", "eleitores", "comparecimento", "abstencao"]) o[k] += r[k] || 0;
    o.pctPeso += (r.pct || 0) * (r.eleitores || 0);
    for (const c of r.candidatos) { const x = cands.get(c.n) || {...c, votos: 0}; x.votos += c.votos; cands.set(c.n, x); }
  }
  o.pct = div(o.pctPeso, o.eleitores);
  o.candidatos = [...cands.values()].map(c => ({...c, pct: div(c.votos, o.validos) * 100, eleito: false})).sort((a, b) => b.votos - a.votos);
  return o;
}
// Deputados (e qualquer cargo num estado): status + lista de candidatos do servidor do estado
async function dadosUF(uf) {
  const c = N.cacheUf.get(uf);
  if (c && Date.now() - c.t < 30000) return c;
  const [status, cands] = await Promise.all([api(`/${uf}/api/status`), api(`/${uf}/api/candidatos`)]);
  const o = {t: Date.now(), status, cands, uf};
  N.cacheUf.set(uf, o);
  return o;
}
function resumoDeputados(du, cargo) {
  const s = du.status.cargos?.[cargo]; if (!s) return null;
  const lista = du.cands.filter(c => c.cargo === cargo).sort((a, b) => b.votos - a.votos)
    .map(c => ({n: c.numero, nome: c.nomeUrna, partido: c.partido, votos: c.votos, pct: c.pct, eleito: c.eleito, foto: fotoDep(du.uf, c)}));
  return {pct: s.secoes?.pct, validos: s.validos, brancos: s.brancos, nulos: s.nulos, eleitores: s.eleitores, comparecimento: s.comparecimento,
    abstencao: s.abstencao, final: s.totalizacaoFinal, vagas: s.vagas || 1, candidatos: lista};
}
async function resumoAtual() {
  if (N.cargo <= 5) return resumoEscopo();
  if (!ehUF(N.escopo)) return null;
  return resumoDeputados(await dadosUF(N.escopo), cargoReal());
}
// Cores: Presidente segue a ordem nacional; nos outros cargos, a ordem no escopo
function coresDe(r) {
  const m = new Map();
  const base = N.cargo === 1 && N.D?.brasil ? N.D.brasil.candidatos : r?.candidatos || [];
  base.forEach((c, i) => m.set(c.n, i < PALETA.length ? PALETA[i] : OUTRO));
  return m;
}
// Partidos (governador/senador por estado): cor por quantidade de estados liderados
function coresPartido(pares) {
  const cont = new Map();
  for (const p of pares) cont.set(p, (cont.get(p) || 0) + 1);
  const ord = [...cont.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0]);
  return new Map(ord.map((p, i) => [p, i < PALETA.length - 1 ? PALETA[i] : OUTRO]));
}

/* ------------------------------------------------------------------ topo */
function renderControles() {
  const sel = $("#escopo");
  sel.innerHTML = `<option value="br">Brasil (todo o país)</option>
    <optgroup label="Regiões">${Object.keys(REGIOES).map(r => `<option value="r:${r}">Região ${r}</option>`).join("")}</optgroup>
    <optgroup label="Estados">${Object.entries(NOMES).sort((a, b) => a[1].localeCompare(b[1])).map(([u, n]) => `<option value="${u}">${n}</option>`).join("")}</optgroup>
    <option value="zz">Exterior (Presidente)</option>`;
  sel.value = N.escopo;
  if (!$("#escBand")) sel.insertAdjacentHTML("beforebegin", `<span class="esc-band" id="escBand" aria-hidden="true"></span>`);
  $("#escBand").innerHTML = ehUF(N.escopo) ? bandeira(N.escopo, 30).replace(' loading="lazy"', "") : "";
  $("#cargos").innerHTML = CARGOS.map(([c]) => {
    const ok = N.escopo !== "zz" || c === 1;
    return `<button data-c="${c}" aria-pressed="${N.cargo === c}" ${ok ? "" : "disabled"} title="${ok ? "" : "No exterior só se vota para Presidente"}">${esc(cargoNome(c))}</button>`;
  }).join("");
  const abas = [["resultado", "Resultado"], ["mapa", "Mapa"], ["todos", "Mapa de todos os candidatos"], ["regioes", "Regiões e estados"], ["cidades", "Cidades"], ["escolas", "Colégios"], ["candidatos", "Comparar candidatos"], ["comparar", "Comparar cidades"]];
  $("#abas").innerHTML = abas.map(([k, n]) => `<button role="tab" data-a="${k}" aria-selected="${N.aba === k}">${n}${k === "comparar" && N.cmp.length ? ` (${N.cmp.length})` : k === "candidatos" && N.cmpCand.length ? ` (${N.cmpCand.length})` : ""}</button>`).join("");
  $("#titulo").textContent = `${cargoNome(N.cargo)} · ${nomeEscopo()}`;
  $("#painelUf").innerHTML = ehUF(N.escopo) ? `<a class="btn" href="/${N.escopo}/">${bandeira(N.escopo, 20)} Painel completo de ${esc(NOMES[N.escopo])} →</a>` : "";
}
$("#escopo").addEventListener("change", e => irPara(e.target.value));
$("#cargos").addEventListener("click", e => { const b = e.target.closest("button[data-c]"); if (!b || b.disabled) return; N.cargo = Number(b.dataset.c); N.modo = "lider"; render(); });
$("#abas").addEventListener("click", e => { const b = e.target.closest("[data-a]"); if (!b) return; N.aba = b.dataset.a; render(); });
function irPara(escopo, aba) {
  N.escopo = escopo; N.modo = "lider";
  if (escopo === "zz") N.cargo = 1;
  if (aba) N.aba = aba;
  render(); window.scrollTo({top: $("#controles").offsetTop - 4, behavior: "smooth"});
}

/* ------------------------------------------------------------------ blocos */
function selo(c, r, i) {
  if (c.eleito) return `<span class="selo">Eleito</span>`;
  if (c.turno2) return `<span class="selo t2">2º turno</span>`;
  if (r?.final && r.vagas === 1 && i < 2 && !r.candidatos.some(x => x.eleito) && (r.candidatos[0]?.pct || 0) <= 50 && [1, 3].includes(N.cargo)) return `<span class="selo t2">2º turno</span>`;
  return "";
}
const foto = (u, cls = "") => u ? `<img class="${cls}" src="${esc(u)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : "";
// Bandeiras dos estados (Wikimedia Commons, domínio público; PNG pequeno em /bandeiras/<uf>.png) e logos oficiais dos partidos (Commons); sem logo: círculo com a sigla
const bandeira = (uf, w = 22) => NOMES[uf] ? `<img class="bandeira" src="/bandeiras/${uf}.png" alt="Bandeira: ${esc(NOMES[uf])}" width="${w}" height="${Math.round(w * 0.7)}" loading="lazy" decoding="async" onerror="this.remove()">` : "";
const LOGOS_PARTIDOS = {AGIR: "svg", AVANTE: "svg", CIDADANIA: "svg", DC: "svg", DEMOCRATA: "png", MDB: "svg", MISSAO: "svg", MOBILIZA: "png", NOVO: "svg", PCB: "svg", PCDOB: "svg", PCO: "svg", PDT: "png", PL: "svg", PMB: "png", PODE: "svg", PP: "svg", PRD: "svg", PRTB: "png", PSB: "svg", PSD: "svg", PSDB: "svg", PSOL: "svg", PSTU: "png", PT: "svg", PV: "svg", REDE: "svg", REPUBLICANOS: "svg", SOLIDARIEDADE: "svg", UNIAO: "svg", UP: "svg"};
const siglaNorm = s => semAcento(s).toUpperCase().replace(/[^A-Z0-9]/g, "");
const PALETA_SEM_LOGO = ["#3d6fb6", "#b5473a", "#7a5bb8", "#2f8a64", "#b0832a", "#3a8f9c", "#a64d7c", "#5b7a2e"];
const corPartido = k => PALETA_SEM_LOGO[[...k].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % PALETA_SEM_LOGO.length];
function logoPartido(sigla, tam = 18) {
  const k = siglaNorm(sigla), ext = LOGOS_PARTIDOS[k];
  return `<span class="lp${ext ? "" : " sem"}" style="--lp:${tam}px;--lp-c:${corPartido(k)}" title="${esc(sigla)}"><span class="sg" aria-hidden="true">${esc(k.length > 4 ? k.slice(0, 3) : k)}</span>${ext
    ? `<img src="/partidos/${k}.${ext}" alt="" width="${tam}" height="${tam}" loading="lazy" decoding="async" onerror="this.parentNode.classList.add('sem');this.remove()">` : ""}</span>`;
}
// sigla com logo(s) (federação: logos lado a lado)
const logosDe = (sigla, tam = 18) => `<span class="logos">${String(sigla || "").split(/\s*\/\s*/).filter(Boolean).map(p => logoPartido(p, tam)).join("")}</span>`;
const partidoH = (sigla, tam = 16) => sigla ? `<span class="partido">${logosDe(sigla, tam)}<span>${esc(sigla)}</span></span>` : "";
// foto oficial do TSE pelo sqcand (deputados vêm da lista de candidatos de cada estado)
const fotoDep = (uf, c) => c.sqcand ? `https://resultados.tse.jus.br/oficial/ele2026/${c.cargo === 1 ? 6257 : 6259}/fotos/${c.cargo === 1 ? "br" : uf}/${c.sqcand}.jpeg` : null;
function kpis(r) {
  if (!r) return "";
  const comp = r.comparecimento || (r.validos + r.brancos + r.nulos);
  const el = r.eleitores || comp + (r.abstencao || 0);
  const partes = [["Válidos", r.validos, "#3d9fd6"], ["Brancos", r.brancos, "var(--branco)"], ["Nulos", r.nulos, "var(--nulo)"], ["Abstenção", r.abstencao, "var(--abst)"]];
  return `<div class="kpis">
    <div class="card kpi"><div class="l">Seções apuradas</div><div class="v">${pct((r.pct || 0) / 100, 2)}</div><div class="s">${r.final ? "totalização encerrada" : "apuração em andamento"}</div></div>
    <div class="card kpi"><div class="l">Eleitores</div><div class="v">${int(el)}</div><div class="s">aptos a votar</div></div>
    <div class="card kpi"><div class="l">Comparecimento</div><div class="v">${pct(div(comp, el))}</div><div class="s">${int(comp)} votaram</div></div>
    <div class="card kpi"><div class="l">Abstenção</div><div class="v">${pct(div(r.abstencao, el))}</div><div class="s">${int(r.abstencao)} não votaram</div></div>
    <div class="card kpi"><div class="l">Votos brancos</div><div class="v">${pct(div(r.brancos, comp))}</div><div class="s">${int(r.brancos)} dos votos</div></div>
    <div class="card kpi"><div class="l">Votos nulos</div><div class="v">${pct(div(r.nulos, comp))}</div><div class="s">${int(r.nulos)} dos votos</div></div>
  </div>
  <div class="card pad" style="margin-bottom:14px"><div class="nota">Do eleitorado total: quem votou válido, branco, nulo e quem não foi votar</div>
    <div class="comp">${partes.map(([n, v, c]) => `<i style="width:${((div(v, el) || 0) * 100).toFixed(2)}%;background:${c}" title="${n}: ${pct(div(v, el))}"></i>`).join("")}</div>
    <div class="leg">${partes.map(([n, v, c]) => `<span><b style="background:${c}"></b>${n} ${pct(div(v, el))}</span>`).join("")}</div></div>`;
}
function listaCands(r, limite = 60) {
  if (!r?.candidatos?.length) return `<div class="vazio">Sem votos apurados ainda.</div>`;
  const cores = coresDe(r), max = r.candidatos[0].pct || 1;
  return `<div class="cands">${r.candidatos.slice(0, limite).map((c, i) => `<button class="pc" data-cand="${c.n}">${foto(c.foto)}
      <div style="min-width:0;flex:1"><div class="n">${esc(nome(c.nome))}${selo(c, r, i)}</div><div class="s">${partidoH(c.partido, 16)} · ${i + 1}º</div>
        <div class="barra"><i style="width:${(c.pct / max * 100).toFixed(1)}%;background:${cores.get(c.n) || OUTRO}"></i></div></div>
      <div class="v"><b>${pct(c.pct / 100, 2)}</b><small>${int(c.votos)} votos</small></div></button>`).join("")}</div>
    ${r.candidatos.length > limite ? `<p class="nota">Mostrando os ${limite} mais votados de ${r.candidatos.length}. Veja todos no painel completo do estado.</p>` : ""}`;
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-cand]"); if (!b) return;
  N.modo = "c:" + b.dataset.cand; N.aba = "mapa"; render();
});
function linhaCand(c, cor) {
  return `<div class="linha">${c.foto ? foto(c.foto) : `<i class="bola" style="background:${cor}"></i>`}<span>${esc(nome(c.nome))} <small>${logosDe(c.partido, 14)} ${esc(c.partido)}</small></span><em>${pct(c.pct / 100)}</em></div>`;
}
function cartaoUF(uf, cargo) {
  const r = N.D?.estados?.[uf]?.[CHAVE_CARGO[cargo]];
  const n = cargo === 5 && r?.vagas > 1 ? 3 : 2;
  return `<button class="card uf" data-uf="${uf}">
    <div class="uf-top">${bandeira(uf, 30)}<span class="sigla">${uf.toUpperCase()}</span><b>${NOMES[uf]}</b>${r ? `<span class="ap">${prog((r.pct || 0) / 100)} ${pct((r.pct || 0) / 100, 0)}</span>` : ""}</div>
    <div>${r ? r.candidatos.slice(0, n).map((c, i) => linhaCand(c, PALETA[i]).replace("</span><em>", `${selo(c, r, i)}</span><em>`)).join("") : `<div class="nota">Carregando…</div>`}</div>
    ${r ? `<div class="nota">Brancos ${pct(div(r.brancos, r.comparecimento))} · Nulos ${pct(div(r.nulos, r.comparecimento))} · Abstenção ${pct(div(r.abstencao, r.eleitores))}</div>` : ""}
  </button>`;
}
document.addEventListener("click", e => { const b = e.target.closest("[data-uf]"); if (b && !e.target.closest(".leaflet-container")) irPara(b.dataset.uf); });
document.addEventListener("click", e => { const b = e.target.closest("[data-reg]"); if (b) irPara("r:" + b.dataset.reg); });

/* ------------------------------------------------------------------ abas */
async function viewResultado(main) {
  const t = N.tok;
  if (N.cargo > 5 && !ehUF(N.escopo)) return viewBancadas(main);
  const r = await resumoAtual();
  if (!vivo(t)) return;
  if (N.cargo !== 1 && !ehUF(N.escopo)) {
    // Governador/Senador no Brasil ou numa região: mapa por partido, partidos e um cartão por estado
    const mr = await mapaResumo(); if (!vivo(t)) return;
    main.innerHTML = `<div class="mapa-wrap" style="margin-bottom:14px">${mr}<div class="card pad">${resumoPartidos()}</div></div><p class="nota">Cada estado elege o seu ${N.cargo === 3 ? "governador" : "senador (duas vagas em 2026)"}. Clique num estado para ver todos os candidatos, o mapa por cidade e os colégios.</p>
      <div class="grade">${ufsDoEscopo().map(u => cartaoUF(u, N.cargo)).join("")}</div>`;
    main.insertAdjacentHTML("afterbegin", situacaoEstados());
    return;
  }
  const mapa = !ehUF(N.escopo) && N.escopo !== "zz" ? await mapaResumo() : "";
  if (!vivo(t)) return;
  main.innerHTML = kpis(r) + `<div class="${mapa ? "mapa-wrap" : ""}"><div class="card pad"><h2 style="margin-bottom:14px">${esc(cargoNome(N.cargo))} · ${esc(nomeEscopo())}</h2>${listaCands(r)}
    <p class="nota" style="margin-top:12px">Clique num candidato para ver o mapa da votação dele.</p></div>${mapa}</div>`;
  if (N.cargo > 5 && ehUF(N.escopo)) {
    const cam = await camara(N.cargo).catch(() => null);
    const e = cam?.estados?.[N.escopo];
    if (vivo(t) && e) main.insertAdjacentHTML("beforeend", `<div class="card pad" style="margin-top:14px">${blocoEleitos(N.escopo, e, coresBancada(cam), true)}</div>`);
  }
  if (N.cargo === 1 && N.escopo === "br") main.insertAdjacentHTML("beforeend", `<h3>Por região</h3>${blocoRegioes()}`);
  if (N.cargo === 1 && ehRegiao(N.escopo)) main.insertAdjacentHTML("beforeend", `<h3>Estados da região</h3><div class="grade">${ufsDoEscopo().map(u => cartaoUF(u, 1)).join("")}</div>`);
}
// Mapa do Brasil em SVG, clicável: cor de quem lidera em cada estado (Presidente) ou do partido líder (Governador/Senador)
async function mapaResumo() {
  const geo = await geoBR();
  const pc = caminhos(geo, f => IBGE_UF[f.properties.codarea]);
  const areas = areasEstados(N.cargo);
  const naRegiao = new Set(ufsDoEscopo());
  let corDe, leg = new Map();
  if (N.cargo === 1) {
    const cores = coresDe(N.D?.brasil);
    corDe = a => { const l = liderArea(a); return l ? cores.get(l[0]) || OUTRO : "#1a2129"; };
    for (const a of areas.values()) { const l = liderArea(a); if (l && naRegiao.has(a.id)) leg.set(nome(a.cands.find(c => c.n === l[0])?.nome || ""), cores.get(l[0]) || OUTRO); }
  } else {
    const cp = coresPartido([...areas.values()].filter(a => naRegiao.has(a.id)).map(a => a.cands[0]?.partido || ""));
    corDe = a => cp.get(a.cands[0]?.partido || "") || OUTRO;
    cp.forEach((c, p) => leg.set(p, c));
  }
  return `<div class="card pad"><h2 style="margin-bottom:6px">${N.cargo === 1 ? "Quem lidera em cada estado" : "Partido que lidera em cada estado"}</h2><p class="nota" style="margin:0 0 8px">Passe o mouse para ver os números; clique para abrir o estado.</p>
    <svg viewBox="-4 -4 ${pc.W + 8} ${pc.H + 8}" style="width:100%;height:auto;max-height:520px" role="img" aria-label="Mapa do Brasil por estado">
    ${pc.f.map(f => { const a = areas.get(f.id); const fora = !naRegiao.has(f.id);
      const top = a ? a.cands.slice(0, 3).map(c => `${nome(c.nome)} (${c.partido}): ${pct(c.pct / 100)}`).join("\n") : "";
      return `<path data-uf="${f.id}" d="${f.d}" fill="${a && !fora ? corDe(a) : "#12171d"}" fill-opacity="${fora ? 0.35 : 0.9}" stroke="#0b1015" stroke-width="0.8" style="cursor:pointer"><title>${esc(NOMES[f.id] || "")}\n${esc(top)}\nApurado ${pct((a ? a.pctApurado : 0), 0)}</title></path>`; }).join("")}
    </svg><div class="legenda">${[...leg].map(([n, c]) => `<span><b style="background:${c}"></b>${N.cargo === 1 ? "" : logosDe(n, 15) + " "}${esc(n)}</span>`).join("")}</div></div>`;
}
// Governador/Senador no Brasil: quantos estados cada partido lidera
function resumoPartidos() {
  const areas = [...areasEstados(N.cargo).values()].filter(a => ufsDoEscopo().includes(a.id));
  const cont = new Map();
  for (const a of areas) for (const c of a.cands.slice(0, N.cargo === 5 ? 2 : 1)) cont.set(c.partido, (cont.get(c.partido) || 0) + 1);
  const ord = [...cont.entries()].sort((a, b) => b[1] - a[1]);
  const mx = ord[0]?.[1] || 1;
  const decididos = areas.filter(a => a.cands.some(c => c.eleito)).length;
  return `<h2 style="margin-bottom:6px">${N.cargo === 3 ? "Governos estaduais" : "Senado (2 vagas por estado)"} por partido</h2>
    <p class="nota" style="margin:0 0 12px">${N.cargo === 3 ? "Estados em que cada partido lidera para governador" : "Vagas de cada partido pelos 2 mais votados de cada estado"} · ${decididos} de ${areas.length} estados já com eleito</p>
    ${ord.map(([p, n], i) => `<div class="linha"><i class="bola" style="background:${PALETA[i] || OUTRO}"></i><span style="flex:0 0 150px">${partidoH(p, 18)}</span><span class="barra" style="flex:1;margin:0;height:8px"><i style="width:${n / mx * 100}%;background:${PALETA[i] || OUTRO}"></i></span><em style="width:28px;text-align:right">${n}</em></div>`).join("")}`;
}
function blocoRegioes() {
  const cores = coresDe(N.D?.brasil);
  const linhas = Object.keys(REGIOES).map(reg => [reg, resumoEscopo(1, "r:" + reg)]).concat([["Exterior", N.D?.estados?.zz?.presidente]]);
  return `<div class="grade">${linhas.map(([reg, r]) => r ? `<button class="card uf" ${reg === "Exterior" ? `data-uf-ext` : `data-reg="${reg}"`} ${reg === "Exterior" ? `onclick="irPara('zz')"` : ""}>
    <div class="uf-top"><b>${reg === "Exterior" ? "Exterior" : "Região " + reg}</b><span class="ap">${prog((r.pct || 0) / 100)} ${pct((r.pct || 0) / 100, 0)}</span></div>
    <div>${r.candidatos.slice(0, 3).map(c => linhaCand(c, cores.get(c.n) || OUTRO)).join("")}</div>
    <div class="nota">Brancos ${pct(div(r.brancos, r.comparecimento))} · Nulos ${pct(div(r.nulos, r.comparecimento))} · Abstenção ${pct(div(r.abstencao, r.eleitores))}</div></button>` : "").join("")}</div>`;
}

// Quem já foi eleito e onde vai haver 2º turno (governador) / quem lidera o Senado
function situacaoEstados() {
  const ufs = ufsDoEscopo().filter(u => N.D?.estados?.[u]?.[CHAVE_CARGO[N.cargo]]);
  const eleitos = [], turno2 = [], aberto = [];
  for (const u of ufs) {
    const r = N.D.estados[u][CHAVE_CARGO[N.cargo]];
    const el = r.candidatos.filter(c => c.eleito);
    if (el.length) eleitos.push([u, el]);
    else if (r.candidatos.some(c => c.turno2)) turno2.push([u, r.candidatos.filter(c => c.turno2)]);
    else aberto.push([u, r.candidatos.slice(0, N.cargo === 5 ? 2 : 1)]);
  }
  const bloco = (tit, lista, cor) => lista.length ? `<div class="card pad"><h2 style="margin-bottom:10px">${tit} <span class="nota">(${lista.length})</span></h2>${lista.map(([u, cs]) =>
    `<div class="linha" data-uf="${u}" style="cursor:pointer">${bandeira(u, 24)}<span class="sigla" style="padding:5px 6px;font-size:11px">${u.toUpperCase()}</span><span>${cs.map(c => `${esc(nome(c.nome))} <small>${logosDe(c.partido, 13)} ${esc(c.partido)} ${pct(c.pct / 100)}</small>`).join(" × ")}</span></div>`).join("")}</div>` : "";
  return `<div class="grade" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr));margin-bottom:14px">${bloco("Eleitos", eleitos)}${bloco("2º turno", turno2)}${bloco(N.cargo === 3 ? "Ainda em apuração · lidera" : "Ainda em apuração · lideram", aberto)}</div>`;
}

/* ---------- valores por área para os mapas */
const MODOS_EXTRA = [["brancos", "Brancos"], ["nulos", "Nulos"], ["abst", "Abstenção"], ["apurado", "% apurado"]];
function valorArea(a, modo) {
  // a: {validos, brancos, nulos, comp, eleitores, aptos, votos: Map(n -> votos), pctApurado}
  if (modo === "brancos") return div(a.brancos, a.comp);
  if (modo === "nulos") return div(a.nulos, a.comp);
  if (modo === "abst") return a.aptos ? 1 - div(a.comp, a.aptos) : null;
  if (modo === "apurado") return a.pctApurado;
  if (modo.startsWith("c:")) return div(a.votos.get(Number(modo.slice(2))) || 0, a.validos);
  return null;
}
function liderArea(a) { let m = null; for (const [n, v] of a.votos) if (!m || v > m[1]) m = [n, v]; return m; }
// Estados (escopo Brasil/região): do arquivo oficial de cada estado
function areasEstados(cargo) {
  const out = new Map();
  for (const u of Object.keys(NOMES)) {
    const r = N.D?.estados?.[u]?.[CHAVE_CARGO[cargo]]; if (!r) continue;
    out.set(u, {id: u, nome: NOMES[u], validos: r.validos, brancos: r.brancos, nulos: r.nulos, comp: r.comparecimento, eleitores: r.eleitores,
      aptos: r.comparecimento + r.abstencao, pctApurado: (r.pct || 0) / 100, votos: new Map(r.candidatos.map(c => [c.n, c.votos])), cands: r.candidatos});
  }
  return out;
}
// Municípios (escopo estado): boletins de urna já baixados pelo servidor do estado
async function areasMunicipios(uf, cargo) {
  const d = await api(`/${uf}/api/cargo-municipios?cargo=${cargo}`);
  const nomes = new Map(d.candidatos.map(c => [c.numero, c]));
  const out = new Map();
  for (const m of d.municipios) out.set(String(m.ibge), {id: m.mun, uf, nome: m.nome, validos: m.validos, brancos: m.brancos, nulos: m.nulos, comp: m.comp,
    eleitores: m.eleitores, aptos: m.aptos, pctApurado: div(m.aptos, m.eleitores) ?? 0, votos: new Map(m.votos), nomes});
  return {areas: out, nomes, candidatos: d.candidatos};
}
const quebras = vals => { const v = vals.filter(x => x != null && isFinite(x)).sort((a, b) => a - b); if (!v.length) return [0, 0, 0, 0]; return [0.2, 0.4, 0.6, 0.8].map(q => v[Math.floor(q * (v.length - 1))]); };
const corRampa = (x, q) => x == null ? "#1a2129" : RAMPA[q.filter(t => x > t).length];

/* ---------- mapa grande (Leaflet) */
async function geoBR() { return N.geoBR ||= await api("/geo/br.geojson"); }
async function geoUF(uf) { if (!N.geoUF.has(uf)) N.geoUF.set(uf, await api(`/${uf}/geo/${uf}.geojson`)); return N.geoUF.get(uf); }
function novoMapa(el) {
  if (N.mapa) { N.mapa.remove(); N.mapa = null; }
  const m = L.map(el, {preferCanvas: true, zoomSnap: 0.25, scrollWheelZoom: false, attributionControl: true});
  registrarMapa(el.id, m); // camadas por chave para o destaque e o "ver no mapa"
  m.on("click focus", () => m.scrollWheelZoom.enable()); m.on("mouseout", () => m.scrollWheelZoom.disable());
  L.tileLayer(ESRI + "World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {maxZoom: 16, attribution: "Esri · IBGE · TSE"}).addTo(m);
  L.tileLayer(ESRI + "World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}", {maxZoom: 16, pane: "shadowPane", opacity: 0.7}).addTo(m);
  N.mapa = m; return m;
}
function seletorModos(cands, cores) {
  const opts = [["lider", "Quem lidera"]].concat(MODOS_EXTRA);
  return `<div class="modos"><div class="seg" id="modos">${opts.map(([k, n]) => `<button data-m="${k}" aria-pressed="${N.modo === k}">${n}</button>`).join("")}</div>
    ${cands?.length ? `<select class="sel" id="modoCand" aria-label="Votação de um candidato"><option value="">% de um candidato…</option>${cands.slice(0, 80).map(c =>
      `<option value="c:${c.n}" ${N.modo === "c:" + c.n ? "selected" : ""}>${esc(nome(c.nome))} (${esc(c.partido)})</option>`).join("")}</select>` : ""}</div>`;
}
function ligarModos() {
  $("#modos")?.addEventListener("click", e => { const b = e.target.closest("[data-m]"); if (b) { N.modo = b.dataset.m; render(); } });
  $("#modoCand")?.addEventListener("change", e => { if (e.target.value) { N.modo = e.target.value; render(); } });
}
function legendaHTML(modo, q, coresLegenda) {
  if (modo === "lider") return `<div class="legenda">${[...coresLegenda].map(([n, c]) => `<span><b style="background:${c}"></b>${esc(n)}</span>`).join("")}<span class="nota">Tom mais forte = vantagem maior</span></div>`;
  const f = x => pct(x, 0);
  return `<div class="legenda">${RAMPA.map((c, i) => `<span><b style="background:${c}"></b>${i === 0 ? "até " + f(q[0]) : i === 4 ? "acima de " + f(q[3]) : f(q[i - 1]) + "–" + f(q[i])}</span>`).join("")}</div>`;
}
function dicaArea(a, cargo, nomeDe) {
  const top = [...a.votos].sort((x, y) => y[1] - x[1]).slice(0, 4);
  return `<b>${esc(nome(a.nome))}</b><br>${top.map(([n, v]) => `${esc(nome(nomeDe(n)))}: ${pct(div(v, a.validos))}`).join("<br>")}
    <br><span style="color:#a7adb4">Brancos ${pct(div(a.brancos, a.comp))} · Nulos ${pct(div(a.nulos, a.comp))} · Apurado ${pct(a.pctApurado, 0)}</span>`;
}

async function viewMapa(main) {
  const t = N.tok;
  if (N.cargo > 5 && !ehUF(N.escopo)) return viewBancadas(main);
  if (N.escopo === "zz") { main.innerHTML = `<div class="vazio">No exterior não há mapa por estado. Veja o resultado na aba Resultado.</div>`; return; }
  const cargo = cargoReal();
  main.innerHTML = `<div class="vazio">Carregando mapa…</div>`;
  let areas, nomeDe, cands, chaveGeo, geo, coresN, porArea = "estado";
  if (!ehUF(N.escopo)) {
    areas = areasEstados(N.cargo); geo = await geoBR(); chaveGeo = f => IBGE_UF[f.properties.codarea];
    const r = resumoEscopo(N.cargo, "br") || {candidatos: []};
    cands = N.cargo === 1 ? r.candidatos : [];
    const todos = new Map(); for (const a of areas.values()) for (const c of a.cands) todos.set(c.n, c);
    nomeDe = n => todos.get(n)?.nome || "";
    coresN = N.cargo === 1 ? coresDe(r) : null;
  } else {
    porArea = "município";
    const [m, g, ru] = await Promise.all([areasMunicipios(N.escopo, cargo), geoUF(N.escopo), resumoAtual()]);
    areas = m.areas; geo = g; chaveGeo = f => String(f.properties.codarea);
    cands = ru?.candidatos || m.candidatos.map(c => ({n: c.numero, nome: c.nomeUrna, partido: c.partido}));
    nomeDe = n => m.nomes.get(n)?.nomeUrna || "";
    coresN = coresDe(ru);
  }
  if (!vivo(t)) return;
  // Quem lidera: cor do candidato (ou do partido, para governador/senador no Brasil)
  let corLider, coresLegenda = new Map();
  if (!coresN) {
    const partidoDe = a => a.cands?.[0]?.partido || "";
    const cp = coresPartido([...areas.values()].filter(a => ufsDoEscopo().includes(a.id)).map(partidoDe));
    corLider = a => cp.get(partidoDe(a)) || OUTRO;
    cp.forEach((c, p) => coresLegenda.set(p, c));
  } else {
    corLider = a => { const l = liderArea(a); return l ? coresN.get(l[0]) || OUTRO : null; };
    for (const a of areas.values()) { const l = liderArea(a); if (l) coresLegenda.set(nomeDe(l[0]) ? nome(nomeDe(l[0])) : "", coresN.get(l[0]) || OUTRO); }
  }
  const vals = [...areas.values()].map(a => valorArea(a, N.modo));
  const q = quebras(vals);
  const titulo = N.modo === "lider" ? "Quem lidera" : N.modo.startsWith("c:") ? `Votação de ${nome(nomeDe(Number(N.modo.slice(2))) || cands.find(c => c.n === Number(N.modo.slice(2)))?.nome || "")}` : (MODOS_EXTRA.find(x => x[0] === N.modo) || [, ""])[1];
  main.innerHTML = seletorModos(cands, coresN) + `<div class="mapa-wrap"><div><div class="mapa" id="mapaGrande"></div>${legendaHTML(N.modo, q, coresLegenda)}
    <p class="nota">${ehUF(N.escopo) ? "Por município, a partir dos boletins de urna já baixados do TSE." : "Por estado, com os arquivos oficiais do TSE."} Clique numa área para ver o detalhe.</p></div>
    <div class="card pad"><h2 style="margin-bottom:10px">${esc(titulo)}</h2><div class="tab-wrap" style="max-height:520px">${tabelaAreas(areas, nomeDe, coresN || null, porArea)}</div></div></div>`;
  ligarModos(); ligarTabela();
  const m = novoMapa($("#mapaGrande"));
  const naRegiao = new Set(ufsDoEscopo());
  const camada = L.geoJSON(geo, {
    style: f => {
      const a = areas.get(chaveGeo(f));
      const fora = !ehUF(N.escopo) && !naRegiao.has(chaveGeo(f));
      let fill = "#1a2129", op = 0.85;
      if (a && !fora) {
        if (N.modo === "lider") {
          fill = corLider(a) || "#1a2129";
          const l = liderArea(a); const seg = [...a.votos.values()].sort((x, y) => y - x)[1] || 0;
          op = l ? 0.45 + Math.min(0.5, (div(l[1] - seg, a.validos) || 0) * 2.5) : 0.2;
        } else fill = corRampa(valorArea(a, N.modo), q);
      }
      return {color: "rgba(220,230,235,.35)", weight: ehUF(N.escopo) ? 0.4 : 1, fillColor: fill, fillOpacity: fora ? 0.15 : op};
    },
    onEachFeature: (f, l) => {
      const a = areas.get(chaveGeo(f)); if (!a) return;
      l.bindTooltip(dicaArea(a, cargo, nomeDe), {className: "dica", sticky: true});
      registrar(m, `area|${a.id}`, l);
      l.on("click", () => ehUF(N.escopo) ? abrirCidade(N.escopo, a.id, a.nome) : irPara(a.id));
    },
  }).addTo(m);
  const alvo = ehUF(N.escopo) ? camada : L.geoJSON({type: "FeatureCollection", features: geo.features.filter(f => naRegiao.has(chaveGeo(f)))});
  m.fitBounds(alvo.getBounds(), {padding: [10, 10]});
}
function tabelaAreas(areas, nomeDe, cores, tipo) {
  const naRegiao = new Set(ufsDoEscopo());
  const linhas = [...areas.values()].filter(a => ehUF(N.escopo) || naRegiao.has(a.id)).map(a => {
    const l = liderArea(a);
    return {a, lider: l, v: N.modo === "lider" ? (l ? div(l[1], a.validos) : null) : valorArea(a, N.modo)};
  }).sort((x, y) => (y.v ?? -1) - (x.v ?? -1));
  return `<table class="ordenavel"><thead><tr><th>${tipo === "estado" ? "Estado" : "Município"}</th><th>${N.modo === "lider" ? "Líder" : "Valor"}</th><th aria-sort="descending">%</th><th>Apurado</th></tr></thead>
    <tbody>${linhas.map(({a, lider, v}) => `<tr data-area="${a.id}" data-nome="${esc(a.nome)}" data-lugar="area|${a.id}"><td>${esc(nome(a.nome))}${btnVer(`area|${a.id}`, nome(a.nome))}</td>
      <td class="lider">${lider ? `<span class="bola" style="background:${cores ? cores.get(lider[0]) || OUTRO : PALETA[0]}"></span>${esc(nome(nomeDe(lider[0])))}` : "–"}</td>
      <td data-v="${v ?? -1}">${pct(v)}</td><td data-v="${a.pctApurado}">${pct(a.pctApurado, 0)}</td></tr>`).join("")}</tbody></table>`;
}
function ligarTabela() {
  document.querySelectorAll("table.ordenavel").forEach(t => {
    t.querySelector("thead").addEventListener("click", e => {
      const th = e.target.closest("th"); if (!th) return;
      const i = [...th.parentNode.children].indexOf(th);
      const asc = th.getAttribute("aria-sort") === "descending";
      t.querySelectorAll("th").forEach(x => x.removeAttribute("aria-sort"));
      th.setAttribute("aria-sort", asc ? "ascending" : "descending");
      const linhas = [...t.tBodies[0].rows];
      const val = r => { const c = r.cells[i]; return c.dataset.v != null ? Number(c.dataset.v) : semAcento(c.textContent); };
      linhas.sort((a, b) => { const x = val(a), y = val(b); const d = typeof x === "number" ? x - y : String(x).localeCompare(String(y)); return asc ? d : -d; });
      linhas.forEach(r => t.tBodies[0].appendChild(r));
    });
    t.tBodies[0].addEventListener("click", e => {
      const tr = e.target.closest("tr[data-area]"); if (!tr) return;
      if (ehUF(N.escopo)) abrirCidade(N.escopo, Number(tr.dataset.area), tr.dataset.nome); else irPara(tr.dataset.area);
    });
  });
}

/* ---------- mapa de todos os candidatos (pequenos mapas lado a lado, em SVG) */
const cachePath = new WeakMap();
function caminhos(geo, chave) {
  if (cachePath.has(geo)) return cachePath.get(geo);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  const polys = f => f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const f of geo.features) for (const p of polys(f)) for (const [x, y] of p[0]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const k = Math.cos((y0 + y1) / 2 * Math.PI / 180), W = 300, esc_ = W / ((x1 - x0) * k), H = (y1 - y0) * esc_;
  const P = ([x, y]) => `${((x - x0) * k * esc_).toFixed(1)},${((y1 - y) * esc_).toFixed(1)}`;
  const out = {W, H, f: geo.features.map(f => ({id: chave(f), d: polys(f).map(p => p.map(anel => "M" + anel.map(P).join("L") + "Z").join("")).join("")}))};
  cachePath.set(geo, out); return out;
}
async function viewTodos(main) {
  const t = N.tok;
  if (N.cargo > 5 && !ehUF(N.escopo)) { main.innerHTML = escolhaEstado("o mapa de cada candidato a deputado"); return; }
  if (N.escopo === "zz") { main.innerHTML = `<div class="vazio">No exterior não há mapa.</div>`; return; }
  const cargo = cargoReal();
  if (!ehUF(N.escopo) && N.cargo !== 1) { main.innerHTML = `<div class="vazio">Governador e Senador têm candidatos diferentes em cada estado. Escolha um estado no seletor acima para ver o mapa de cada candidato.</div><div class="grade">${ufsDoEscopo().map(u => cartaoUF(u, N.cargo)).join("")}</div>`; return; }
  main.innerHTML = `<div class="vazio">Desenhando os mapas…</div>`;
  let areas, geo, chave, cands;
  if (ehUF(N.escopo)) {
    const [m, g, r] = await Promise.all([areasMunicipios(N.escopo, cargo), geoUF(N.escopo), resumoAtual()]);
    areas = m.areas; geo = g; chave = f => String(f.properties.codarea); cands = (r?.candidatos || []).slice(0, N.cargo > 5 ? 12 : 16);
  } else {
    areas = areasEstados(1); geo = await geoBR(); chave = f => IBGE_UF[f.properties.codarea]; cands = (resumoEscopo(1) || {candidatos: []}).candidatos.slice(0, 16);
  }
  if (!vivo(t)) return;
  const naRegiao = new Set(ufsDoEscopo());
  const pc = caminhos(geo, chave);
  // escala comum calibrada nos 3 mais votados (senão os nanicos achatam a escala e os líderes ficam todos iguais)
  const todosVals = cands.slice(0, 3).flatMap(c => [...areas.values()].filter(a => ehUF(N.escopo) || naRegiao.has(a.id)).map(a => valorArea(a, "c:" + c.n)));
  const q = quebras(todosVals.filter(v => v > 0));
  main.innerHTML = `<p class="nota">Um mapa para cada candidato, com a mesma escala de cores: quanto mais claro, maior a votação ${ehUF(N.escopo) ? "no município" : "no estado"}. Clique num mapa para abrir o mapa grande.</p>
    ${legendaHTML("c", q)}
    <div class="grade" style="grid-template-columns:repeat(auto-fill,minmax(250px,1fr));margin-top:12px">${cands.map((c, i) => `<button class="card uf" data-cand="${c.n}" style="align-items:stretch">
      <div class="uf-top">${c.foto ? foto(c.foto).replace("<img", '<img style="width:34px;height:46px;border-radius:7px;object-fit:cover"') : ""}<div style="min-width:0"><b style="font-size:15px">${esc(nome(c.nome))}</b><div class="nota">${esc(c.partido)} · ${i + 1}º</div></div>
        <span class="ap" style="font:700 17px var(--display);color:var(--fg)">${pct(c.pct / 100)}</span></div>
      <svg viewBox="-4 -4 ${pc.W + 8} ${pc.H + 8}" style="width:100%;height:auto;max-height:260px" role="img" aria-label="Mapa da votação de ${esc(nome(c.nome))}">
        ${pc.f.map(f => { const a = areas.get(f.id); const fora = !ehUF(N.escopo) && !naRegiao.has(f.id);
          const v = a && !fora ? valorArea(a, "c:" + c.n) : null;
          return `<path d="${f.d}" fill="${fora ? "#12171d" : corRampa(v, q)}" stroke="rgba(220,230,235,.25)" stroke-width="${ehUF(N.escopo) ? 0.15 : 0.5}"><title>${esc(nome(a?.nome || ""))}: ${pct(v)}</title></path>`; }).join("")}
      </svg></button>`).join("")}</div>`;
}

/* ---------- regiões e estados (tabela) */
async function viewRegioes(main) {
  const t = N.tok;
  if (N.cargo > 5) return viewBancadas(main, true);
  if (N.cargo === 1) {
    const cores = coresDe(N.D?.brasil);
    const top = (N.D?.brasil?.candidatos || []).slice(0, 4);
    const linhas = Object.keys(REGIOES).map(r => ({nome: "Região " + r, chave: "r:" + r, r: resumoEscopo(1, "r:" + r)}))
      .concat(Object.keys(NOMES).filter(u => ufsDoEscopo().includes(u) || !ehUF(N.escopo)).map(u => ({nome: NOMES[u], chave: u, r: N.D?.estados?.[u]?.presidente, reg: REGIAO_DE[u]})))
      .concat([{nome: "Exterior", chave: "zz", r: N.D?.estados?.zz?.presidente}]).filter(x => x.r);
    main.innerHTML = `${N.escopo === "br" ? `<h3 style="margin-top:0">Regiões do Brasil</h3>${blocoRegioes()}` : ""}<h3>Presidente por região e estado</h3>
      <div class="tab-wrap"><table class="ordenavel" id="tabReg"><thead><tr><th>Região / estado</th><th>Apurado</th>${top.map(c => `<th><span class="bola" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${cores.get(c.n)}"></span> ${esc(nome(c.nome))}</th>`).join("")}<th>Brancos</th><th>Nulos</th><th>Abstenção</th></tr></thead>
      <tbody>${linhas.map(({nome: n, chave, r, reg}) => {
        const v = new Map(r.candidatos.map(c => [c.n, c]));
        return `<tr data-escopo="${chave}"><td>${chave.startsWith("r:") ? `<b>${esc(n)}</b>` : `${bandeira(chave, 20)} ${esc(n)}`}${reg ? ` <span class="nota">${esc(reg)}</span>` : ""}</td><td data-v="${r.pct}">${pct((r.pct || 0) / 100, 0)}</td>
          ${top.map(c => `<td data-v="${v.get(c.n)?.pct ?? -1}">${pct((v.get(c.n)?.pct ?? 0) / 100)}</td>`).join("")}
          <td data-v="${div(r.brancos, r.comparecimento)}">${pct(div(r.brancos, r.comparecimento))}</td><td data-v="${div(r.nulos, r.comparecimento)}">${pct(div(r.nulos, r.comparecimento))}</td>
          <td data-v="${div(r.abstencao, r.eleitores)}">${pct(div(r.abstencao, r.eleitores))}</td></tr>`;
      }).join("")}</tbody></table></div>`;
  } else {
    const ufs = ehUF(N.escopo) ? Object.keys(NOMES) : ufsDoEscopo();
    main.innerHTML = `<h3 style="margin-top:0">${esc(cargoNome(N.cargo))} por estado</h3><div class="grade">${(N.cargo <= 5 ? ufs : []).map(u => cartaoUF(u, N.cargo)).join("") || `<div class="vazio">Deputados: veja o painel completo de cada estado.</div>`}</div>`;
  }
  ligarTabela();
  $("#tabReg")?.tBodies[0].addEventListener("click", e => { const tr = e.target.closest("tr[data-escopo]"); if (tr) irPara(tr.dataset.escopo, "resultado"); });
}

/* ---------- cidades do estado */
function escolhaEstado(oque) {
  return `<p class="nota">Escolha um estado para ver ${oque}.</p><div class="grade" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr))">${ufsDoEscopo().map(u =>
    `<button class="card uf" data-uf="${u}" style="flex-direction:row;align-items:center">${bandeira(u, 30)}<span class="sigla">${u.toUpperCase()}</span><b>${NOMES[u]}</b></button>`).join("")}</div>`;
}
async function viewCidades(main) {
  const t = N.tok;
  if (!ehUF(N.escopo)) { main.innerHTML = escolhaEstado("todas as cidades, com quem lidera em cada uma, brancos, nulos e abstenção"); return; }
  main.innerHTML = `<div class="vazio">Carregando cidades…</div>`;
  const cargo = cargoReal();
  const [m, r] = await Promise.all([areasMunicipios(N.escopo, cargo), resumoAtual()]);
  if (!vivo(t)) return;
  const cores = coresDe(r);
  const nomeDe = n => m.nomes.get(n)?.nomeUrna || "";
  const linhas = [...m.areas.values()].sort((a, b) => b.eleitores - a.eleitores);
  main.innerHTML = `<div class="barra-ferr"><label class="busca"><input id="qCid" type="search" placeholder="Filtrar cidade" aria-label="Filtrar cidade" autocomplete="off"></label>
    <span class="nota">${int(linhas.length)} cidades · a partir dos boletins de urna já baixados. Clique numa cidade para o resultado oficial completo.</span></div>
    <div class="tab-wrap"><table class="ordenavel" id="tabCid"><thead><tr><th>Cidade</th><th aria-sort="descending">Eleitores</th><th>Apurado</th><th>1º lugar</th><th>%</th><th>2º lugar</th><th>%</th><th>Brancos</th><th>Nulos</th><th>Abstenção</th></tr></thead>
    <tbody>${linhas.map(a => {
      const t = [...a.votos].sort((x, y) => y[1] - x[1]);
      const c = i => t[i] ? `<td class="lider"><span class="bola" style="background:${cores.get(t[i][0]) || OUTRO}"></span>${esc(nome(nomeDe(t[i][0])))}</td><td data-v="${div(t[i][1], a.validos)}">${pct(div(t[i][1], a.validos))}</td>` : `<td>–</td><td data-v="-1">–</td>`;
      return `<tr data-area="${a.id}" data-nome="${esc(a.nome)}"><td>${esc(nome(a.nome))}</td><td data-v="${a.eleitores}">${int(a.eleitores)}</td><td data-v="${a.pctApurado}">${pct(a.pctApurado, 0)}</td>
        ${c(0)}${c(1)}<td data-v="${div(a.brancos, a.comp) ?? -1}">${pct(div(a.brancos, a.comp))}</td><td data-v="${div(a.nulos, a.comp) ?? -1}">${pct(div(a.nulos, a.comp))}</td>
        <td data-v="${a.aptos ? 1 - div(a.comp, a.aptos) : -1}">${a.aptos ? pct(1 - div(a.comp, a.aptos)) : "–"}</td></tr>`;
    }).join("")}</tbody></table></div>`;
  ligarTabela();
  $("#qCid").addEventListener("input", e => { const q = semAcento(e.target.value); for (const tr of $("#tabCid").tBodies[0].rows) tr.hidden = q && !semAcento(tr.cells[0].textContent).includes(q); });
}

/* ---------- colégios (escolas) de uma cidade */
async function carregarCidades() { return N.cidades ||= await api("/cidades.json"); }
function caixaBusca(id, ph) { return `<label class="busca"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="${id}" type="search" placeholder="${ph}" autocomplete="off" aria-label="${ph}"><div class="sug" id="${id}Sug" role="listbox"></div></label>`; }
function ligarBusca(id, filtro, escolher) {
  const inp = $("#" + id), sug = $("#" + id + "Sug");
  const mostrar = async () => {
    const q = semAcento(inp.value.trim());
    if (q.length < 2) { sug.classList.remove("aberto"); return; }
    const lista = (await carregarCidades()).filter(c => filtro(c) && semAcento(c[2]).includes(q))
      .sort((a, b) => (semAcento(a[2]).startsWith(q) ? 0 : 1) - (semAcento(b[2]).startsWith(q) ? 0 : 1) || a[2].localeCompare(b[2])).slice(0, 30);
    sug.innerHTML = lista.map(c => `<button data-c="${c[0]}|${c[1]}|${esc(c[2])}"><span>${esc(nome(c[2]))}</span><small>${bandeira(c[0], 18)} ${c[0].toUpperCase()}</small></button>`).join("") || `<div class="nota" style="padding:10px">Nenhuma cidade</div>`;
    sug.classList.add("aberto");
  };
  inp.addEventListener("input", mostrar);
  inp.addEventListener("keydown", e => { if (e.key === "Enter") sug.querySelector("button")?.click(); if (e.key === "Escape") sug.classList.remove("aberto"); });
  sug.addEventListener("click", e => { const b = e.target.closest("button[data-c]"); if (!b) return; const [uf, mun, n] = b.dataset.c.split("|"); sug.classList.remove("aberto"); inp.value = ""; escolher(uf, Number(mun), n); });
  document.addEventListener("click", e => { if (!e.target.closest(".busca")) sug.classList.remove("aberto"); });
}
async function viewEscolas(main) {
  const t = N.tok;
  if (!ehUF(N.escopo)) { main.innerHTML = escolhaEstado("os colégios eleitorais de cada cidade no mapa"); return; }
  const uf = N.escopo, cargo = cargoReal();
  const cid = await carregarCidades();
  if (!vivo(t)) return;
  let atual = N.escolaMun[uf];
  if (!atual) { const c = cid.find(x => x[0] === uf && x[3] === CAPITAL[uf]); atual = N.escolaMun[uf] = c ? {mun: c[1], nome: c[2]} : null; }
  if (!atual) { main.innerHTML = `<div class="vazio">Escolha uma cidade.</div>`; return; }
  main.innerHTML = `<div class="barra-ferr">${caixaBusca("qEsc", `Trocar cidade (${NOMES[uf]})`)}<b>${esc(nome(atual.nome))}</b><span class="nota" id="escInfo">Carregando colégios…</span></div>
    <div class="mapa-wrap"><div><div class="mapa" id="mapaEsc"></div><div id="legEsc"></div></div><div class="card pad"><h2 style="margin-bottom:10px">Colégios</h2><div class="tab-wrap" style="max-height:520px" id="tabEscWrap"></div></div></div>`;
  ligarBusca("qEsc", c => c[0] === uf, (u, mun, n) => { N.escolaMun[uf] = {mun, nome: n}; render(); });
  let d;
  try { d = await api(`/${uf}/api/cargo-locais?cargo=${cargo}&mun=${atual.mun}`); } catch { $("#escInfo").textContent = "Ainda calculando; tente em alguns segundos."; return; }
  if (!vivo(t)) return;
  const nomes = new Map(d.candidatos.map(c => [c.numero, c]));
  const r = await resumoAtual();
  if (!vivo(t)) return;
  const cores = coresDe(r);
  const nomeDe = n => nomes.get(n)?.nomeUrna || "";
  const locais = d.locais.filter(l => l.validos + l.brancos + l.nulos > 0);
  $("#escInfo").textContent = `${int(locais.length)} colégios com boletim · ${int(locais.reduce((t, l) => t + l.secoes, 0))} seções`;
  const m = novoMapa($("#mapaEsc"));
  const pts = [], marc = new Map();
  const maxEl = Math.max(1, ...locais.map(l => l.eleitores));
  const usados = new Map();
  for (const l of locais) {
    if (l.lat == null) continue;
    const t = l.votos[0]; const cor = t ? cores.get(t[0]) || OUTRO : OUTRO;
    if (t) usados.set(nome(nomeDe(t[0])), cor);
    const mk = L.circleMarker([l.lat, l.lng], {radius: 4 + 10 * Math.sqrt(l.eleitores / maxEl), color: "#0b1015", weight: 1, fillColor: cor, fillOpacity: 0.85})
      .bindTooltip(`<b>${esc(nome(l.nome))}</b><br>${esc(nome(l.bairro))}<br>${l.votos.slice(0, 3).map(([n, v]) => `${esc(nome(nomeDe(n)))}: ${pct(div(v, l.validos))}`).join("<br>")}<br><span style="color:#a7adb4">Brancos ${pct(div(l.brancos, l.comp))} · Nulos ${pct(div(l.nulos, l.comp))}</span>`, {className: "dica"})
      .addTo(m);
    pts.push([l.lat, l.lng]); marc.set(l.id, mk); registrar(m, `loc|${l.id}`, mk);
  }
  if (pts.length) m.fitBounds(pts, {padding: [20, 20]}); else m.setView([-15, -50], 4);
  $("#legEsc").innerHTML = `<div class="legenda">${[...usados].map(([n, c]) => `<span><b style="background:${c};border-radius:50%"></b>${esc(n)}</span>`).join("")}<span class="nota">Cor = quem lidera no colégio · tamanho = eleitores</span></div>`;
  $("#tabEscWrap").innerHTML = `<table class="ordenavel" id="tabEsc"><thead><tr><th>Colégio</th><th aria-sort="descending">Eleitores</th><th>1º lugar</th><th>%</th><th>Brancos</th><th>Nulos</th></tr></thead><tbody>${locais.sort((a, b) => b.eleitores - a.eleitores).map(l => {
    const t = l.votos[0];
    return `<tr data-loc="${l.id}"${marc.has(l.id) ? ` data-lugar="loc|${l.id}"` : ""}><td>${esc(nome(l.nome))}${marc.has(l.id) ? btnVer(`loc|${l.id}`, nome(l.nome)) : ""}<br><span class="nota">${esc(nome(l.bairro))}</span></td><td data-v="${l.eleitores}">${int(l.eleitores)}</td>
      <td class="lider">${t ? `<span class="bola" style="background:${cores.get(t[0]) || OUTRO}"></span>${esc(nome(nomeDe(t[0])))}` : "–"}</td><td data-v="${t ? div(t[1], l.validos) : -1}">${t ? pct(div(t[1], l.validos)) : "–"}</td>
      <td data-v="${div(l.brancos, l.comp) ?? -1}">${pct(div(l.brancos, l.comp))}</td><td data-v="${div(l.nulos, l.comp) ?? -1}">${pct(div(l.nulos, l.comp))}</td></tr>`;
  }).join("")}</tbody></table>`;
  ligarTabela();
  $("#tabEsc").tBodies[0].addEventListener("click", e => {
    const tr = e.target.closest("tr[data-loc]"); if (tr && marc.has(tr.dataset.loc)) verNoMapa(`loc|${tr.dataset.loc}`);
  });
}

/* ---------- comparar cidades (resultado oficial do TSE de cada cidade) */
function addCmp(uf, mun, n) {
  if (!N.cmp.some(c => c.uf === uf && c.mun === mun)) N.cmp.push({uf, mun, nome: n});
  if (N.cmp.length > 8) N.cmp.shift();
  lsSet("cmp", N.cmp);
}
async function viewComparar(main) {
  const t = N.tok;
  const cargo = N.cargo > 5 ? 1 : N.cargo;
  main.innerHTML = `<div class="barra-ferr">${caixaBusca("qCmp", "Adicionar cidade de qualquer estado")}
    <button class="btn" id="cmpCapitais">Capitais do Sudeste</button><button class="btn" id="cmpNE">Capitais do Nordeste</button>${N.cmp.length ? `<button class="btn" id="cmpLimpar">Limpar</button>` : ""}</div>
    <div class="chips" id="cmpChips">${N.cmp.map((c, i) => `<span class="chip">${bandeira(c.uf, 20)}${esc(nome(c.nome))} <small class="nota">${c.uf.toUpperCase()}</small><button data-rm="${i}" aria-label="Remover ${esc(nome(c.nome))}">×</button></span>`).join("")}</div>
    <div id="cmpCorpo" style="margin-top:14px">${N.cmp.length ? `<div class="vazio">Carregando resultado oficial de cada cidade…</div>` : `<div class="vazio">Adicione até 8 cidades para comparar ${esc(cargoNome(cargo))}, brancos, nulos e abstenção lado a lado.</div>`}</div>
    ${N.cargo > 5 ? `<p class="nota">A comparação entre cidades mostra Presidente, Governador e Senador.</p>` : ""}`;
  ligarBusca("qCmp", () => true, (uf, mun, n) => { addCmp(uf, mun, n); render(); });
  const capitais = ufs => carregarCidades().then(cs => { for (const u of ufs) { const c = cs.find(x => x[0] === u && x[3] === CAPITAL[u]); if (c) addCmp(u, c[1], c[2]); } render(); });
  $("#cmpCapitais").onclick = () => capitais(["sp", "rj", "mg", "es"]);
  $("#cmpNE").onclick = () => capitais(["ba", "pe", "ce", "ma", "pb", "rn"]);
  if ($("#cmpLimpar")) $("#cmpLimpar").onclick = () => { N.cmp = []; lsSet("cmp", N.cmp); render(); };
  $("#cmpChips").addEventListener("click", e => { const b = e.target.closest("[data-rm]"); if (b) { N.cmp.splice(Number(b.dataset.rm), 1); lsSet("cmp", N.cmp); render(); } });
  if (!N.cmp.length) return;
  const res = await Promise.all(N.cmp.map(c => api(`/municipio.json?uf=${c.uf}&mun=${c.mun}&cargo=${cargo}`).catch(() => null)));
  if (!vivo(t)) return;
  const cols = N.cmp.map((c, i) => ({...c, r: res[i]}));
  const linhaTot = (rot, f) => `<tr><td>${rot}</td>${cols.map(c => `<td>${c.r ? f(c.r) : "–"}</td>`).join("")}</tr>`;
  const mesmoCand = cargo === 1 || new Set(cols.map(c => c.uf)).size === 1;
  let linhasCand = "";
  if (mesmoCand) {
    const base = cargo === 1 ? N.D?.brasil?.candidatos || [] : cols.find(c => c.r)?.r.candidatos || [];
    const cores = coresDe(cargo === 1 ? N.D?.brasil : cols.find(c => c.r)?.r);
    linhasCand = base.slice(0, 14).map(cd => {
      const vals = cols.map(c => c.r?.candidatos.find(x => x.n === cd.n)?.pct ?? null);
      const mx = Math.max(...vals.filter(v => v != null));
      return `<tr><td><span class="bola" style="display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;background:${cores.get(cd.n) || OUTRO}"></span>${esc(nome(cd.nome))} <span class="nota">${esc(cd.partido)}</span></td>
        ${vals.map(v => `<td class="${v === mx && v > 0 ? "eu" : ""}">${v == null ? "–" : pct(v / 100)}<span class="mini" style="width:${Math.round((v || 0) * 0.6)}px;background:${cores.get(cd.n) || OUTRO}"></span></td>`).join("")}</tr>`;
    }).join("");
  } else {
    linhasCand = [0, 1, 2, 3].map(i => `<tr><td>${i + 1}º lugar</td>${cols.map(c => { const x = c.r?.candidatos[i]; return `<td>${x ? `${esc(nome(x.nome))} <span class="nota">${esc(x.partido)}</span> ${pct(x.pct / 100)}` : "–"}</td>`; }).join("")}</tr>`).join("");
  }
  $("#cmpCorpo").innerHTML = `<div class="card pad"><h2 style="margin-bottom:12px">${esc(cargoNome(cargo))} · resultado oficial do TSE por cidade</h2><div class="tab-wrap cmp"><table>
    <thead><tr><th>&nbsp;</th>${cols.map(c => `<th style="cursor:default">${bandeira(c.uf, 18)} ${esc(nome(c.nome))} <span class="nota">${c.uf.toUpperCase()}</span></th>`).join("")}</tr></thead><tbody>
    ${linhasCand}
    ${linhaTot("<b>Seções apuradas</b>", r => pct((r.pct || 0) / 100, 1))}
    ${linhaTot("Eleitores", r => int(r.eleitores))}
    ${linhaTot("Comparecimento", r => pct(div(r.comparecimento, r.eleitores)))}
    ${linhaTot("Abstenção", r => pct(div(r.abstencao, r.eleitores)))}
    ${linhaTot("Votos brancos", r => `${pct(div(r.brancos, r.comparecimento))} <span class="nota">${int(r.brancos)}</span>`)}
    ${linhaTot("Votos nulos", r => `${pct(div(r.nulos, r.comparecimento))} <span class="nota">${int(r.nulos)}</span>`)}
    ${linhaTot("Votos válidos", r => int(r.validos))}
    </tbody></table></div><p class="nota" style="margin-top:10px">Brancos e nulos sobre o total de votos; abstenção sobre o eleitorado. Fonte: arquivos oficiais do TSE de cada município.</p></div>`;
}

/* ---------- comparar candidatos (de estados e cargos diferentes) e presidenciáveis por estado */
async function candidatosDe(uf, cargo) {
  if (cargo === 1 && uf === "br") return N.D?.brasil;
  if (cargo <= 5) return N.D?.estados?.[uf]?.[CHAVE_CARGO[cargo]];
  return resumoDeputados(await dadosUF(uf), uf === "df" && cargo === 7 ? 8 : cargo);
}
async function viewCandidatos(main) {
  const t = N.tok;
  if (!N.cmpCand.length && N.D?.brasil && !N.cmpLimpo) { N.cmpCand = N.D.brasil.candidatos.slice(0, 2).map(c => ({uf: "br", cargo: 1, n: c.n})); lsSet("cmpCand", N.cmpCand); }
  const pk = N.pk ||= {uf: ehUF(N.escopo) ? N.escopo : "br", cargo: ehUF(N.escopo) ? N.cargo : 1};
  if (pk.uf === "br") pk.cargo = 1;
  const opUf = `<option value="br">Brasil (Presidente)</option>` + Object.entries(NOMES).sort((a, b) => a[1].localeCompare(b[1])).map(([u, n]) => `<option value="${u}" ${pk.uf === u ? "selected" : ""}>${n}</option>`).join("");
  const opCargo = CARGOS.filter(([c]) => pk.uf !== "br" || c === 1).map(([c, n]) => `<option value="${c}" ${pk.cargo === c ? "selected" : ""}>${pk.uf === "df" && c === 7 ? "Dep. Distrital" : n}</option>`).join("");
  main.innerHTML = `<div class="card pad" style="margin-bottom:14px"><h2 style="margin-bottom:10px">Escolha os candidatos</h2>
    <div class="barra-ferr"><select class="sel" id="pkUf" aria-label="Estado">${opUf}</select><select class="sel" id="pkCargo" aria-label="Cargo">${opCargo}</select>
      <label class="busca"><input id="pkQ" type="search" placeholder="Nome do candidato ou partido" autocomplete="off" aria-label="Buscar candidato"><div class="sug" id="pkSug"></div></label>
      ${N.cmpCand.length ? `<button class="btn" id="pkLimpar">Limpar</button>` : ""}</div>
    <div class="chips" id="pkChips"></div>
    <p class="nota" style="margin:10px 0 0">Compare até 10 candidatos de qualquer estado e cargo: governadores de estados diferentes, o mesmo presidenciável em cada estado, deputados de estados vizinhos.</p></div>
    <div id="pkCorpo"><div class="vazio">Carregando…</div></div>`;
  $("#pkUf").value = pk.uf;
  $("#pkUf").onchange = e => { pk.uf = e.target.value; if (pk.uf === "br") pk.cargo = 1; render(); };
  $("#pkCargo").onchange = e => { pk.cargo = Number(e.target.value); render(); };
  if ($("#pkLimpar")) $("#pkLimpar").onclick = () => { N.cmpCand = []; N.cmpLimpo = true; lsSet("cmpCand", []); render(); };
  const lista = (await candidatosDe(pk.uf, pk.cargo).catch(() => null))?.candidatos || [];
  if (!vivo(t)) return;
  const inp = $("#pkQ"), sug = $("#pkSug");
  const mostrar = () => {
    const q = semAcento(inp.value.trim());
    const l = lista.filter(c => !q || semAcento(c.nome).includes(q) || semAcento(c.partido) === q).slice(0, 40);
    sug.innerHTML = l.map(c => `<button data-n="${c.n}"><span>${esc(nome(c.nome))} <small>${esc(c.partido)}</small></span><small>${pct(c.pct / 100)}</small></button>`).join("") || `<div class="nota" style="padding:10px">Nenhum candidato</div>`;
    sug.classList.add("aberto");
  };
  inp.addEventListener("focus", mostrar); inp.addEventListener("input", mostrar);
  inp.addEventListener("keydown", e => { if (e.key === "Enter") sug.querySelector("button")?.click(); if (e.key === "Escape") sug.classList.remove("aberto"); });
  sug.addEventListener("click", e => {
    const b = e.target.closest("button[data-n]"); if (!b) return;
    const it = {uf: pk.uf, cargo: pk.cargo, n: Number(b.dataset.n)};
    if (!N.cmpCand.some(x => x.uf === it.uf && x.cargo === it.cargo && x.n === it.n)) N.cmpCand.push(it);
    if (N.cmpCand.length > 10) N.cmpCand.shift();
    lsSet("cmpCand", N.cmpCand); render();
  });
  const itens = (await Promise.all(N.cmpCand.map(async it => {
    const r = await candidatosDe(it.uf, it.cargo).catch(() => null);
    const i = r?.candidatos.findIndex(c => c.n === it.n) ?? -1;
    return i < 0 ? null : {...it, r, c: r.candidatos[i], pos: i + 1};
  }))).filter(Boolean);
  if (!vivo(t)) return;
  const cor = i => PALETA[i % PALETA.length];
  const onde = x => x.uf === "br" ? "Brasil" : NOMES[x.uf];
  $("#pkChips").innerHTML = itens.map((x, i) => `<span class="chip"><i style="width:10px;height:10px;border-radius:50%;background:${cor(i)};display:inline-block"></i>${esc(nome(x.c.nome))} <small class="nota">${esc(cargoNome(x.cargo))} · ${x.uf === "br" ? "BR" : x.uf.toUpperCase()}</small><button data-rmc="${i}" aria-label="Remover ${esc(nome(x.c.nome))}">×</button></span>`).join("");
  $("#pkChips").onclick = e => {
    const b = e.target.closest("[data-rmc]"); if (!b) return; const x = itens[Number(b.dataset.rmc)];
    N.cmpCand = N.cmpCand.filter(y => !(y.uf === x.uf && y.cargo === x.cargo && y.n === x.n)); if (!N.cmpCand.length) N.cmpLimpo = true; lsSet("cmpCand", N.cmpCand); render();
  };
  if (!itens.length) { $("#pkCorpo").innerHTML = `<div class="vazio">Adicione candidatos pela busca acima.</div>`; return; }
  const mxPct = Math.max(...itens.map(x => x.c.pct)) || 1, mxV = Math.max(...itens.map(x => x.c.votos)) || 1;
  const barras = (rot, f, mx, fmt) => `<div class="nota" style="margin-top:12px">${rot}</div>` + itens.map((x, i) => `<div class="linha"><span style="flex:0 0 min(210px,40%)">${esc(nome(x.c.nome))} <small>${x.uf === "br" ? "BR" : x.uf.toUpperCase()}</small></span><span class="barra" style="flex:1;margin:0;height:10px"><i style="width:${f(x) / mx * 100}%;background:${cor(i)}"></i></span><em style="width:90px;text-align:right">${fmt(f(x))}</em></div>`).join("");
  let html = `<div class="cands" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">${itens.map((x, i) => `<div class="card pad" style="border-top:3px solid ${cor(i)}">
      <div style="display:flex;gap:12px;align-items:center">${x.c.foto ? foto(x.c.foto, "foto") : ""}<div style="min-width:0"><b style="font-size:16px">${esc(nome(x.c.nome))}</b>${selo(x.c, x.r, x.pos - 1)}
        <div class="nota">${esc(x.c.partido)} · ${esc(cargoNome(x.cargo))}<br>${esc(onde(x))}</div></div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px"><div><div class="nota">Válidos</div><b style="font:700 20px var(--display)">${pct(x.c.pct / 100, 2)}</b></div>
        <div><div class="nota">Votos</div><b style="font:700 20px var(--display)">${int(x.c.votos)}</b></div>
        <div><div class="nota">Posição</div><b>${x.pos}º de ${x.r.candidatos.length}</b></div><div><div class="nota">Apurado</div><b>${pct((x.r.pct || 0) / 100, 1)}</b></div></div></div>`).join("")}</div>
    <div class="card pad" style="margin-top:14px"><h2>Lado a lado</h2>${barras("% dos votos válidos (no estado e cargo de cada um)", x => x.c.pct, mxPct, v => pct(v / 100))}${barras("Votos absolutos", x => x.c.votos, mxV, int)}</div>`;
  // Presidenciáveis escolhidos: desempenho em cada região e estado
  const pres = [...new Map(itens.filter(x => x.cargo === 1).map(x => [x.n, x])).values()];
  if (pres.length) {
    const linhas = [["Brasil", "br", N.D.brasil]].concat(Object.keys(REGIOES).map(r => ["Região " + r, "r:" + r, resumoEscopo(1, "r:" + r)]))
      .concat(Object.entries(NOMES).sort((a, b) => a[1].localeCompare(b[1])).map(([u, n]) => [n, u, N.D.estados?.[u]?.presidente])).concat([["Exterior", "zz", N.D.estados?.zz?.presidente]]).filter(x => x[2]);
    const ci = new Map(itens.map((x, i) => [x.n, cor(i)]));
    html += `<div class="card pad" style="margin-top:14px"><h2 style="margin-bottom:6px">Presidenciáveis por região e estado</h2><p class="nota" style="margin:0 0 10px">% dos votos válidos em cada lugar; em destaque, quem vai melhor entre os escolhidos. Clique numa linha para abrir o lugar.</p>
      <div class="tab-wrap"><table class="ordenavel" id="tabPres"><thead><tr><th>Lugar</th>${pres.map(x => `<th><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${ci.get(x.n)}"></span> ${esc(nome(x.c.nome))}</th>`).join("")}${pres.length === 2 ? "<th>Diferença</th>" : ""}<th>Apurado</th></tr></thead>
      <tbody>${linhas.map(([n, k, r]) => {
        const v = pres.map(x => r.candidatos.find(c => c.n === x.n)?.pct ?? 0); const mx = Math.max(...v);
        return `<tr data-escopo="${k}"><td>${k === "br" || k.startsWith("r:") ? `<b>${esc(n)}</b>` : esc(n)}</td>${v.map((p, i) => `<td data-v="${p}" class="${p === mx && p > 0 ? "eu" : ""}" style="${p === mx && p > 0 ? `color:${ci.get(pres[i].n)}` : ""}">${pct(p / 100)}<span class="mini" style="width:${Math.round(p * 0.6)}px;background:${ci.get(pres[i].n)}"></span></td>`).join("")}
          ${pres.length === 2 ? `<td data-v="${v[0] - v[1]}">${v[0] - v[1] >= 0 ? "+" : ""}${(v[0] - v[1]).toLocaleString("pt-BR", {maximumFractionDigits: 1})} p.p.</td>` : ""}<td data-v="${r.pct}">${pct((r.pct || 0) / 100, 0)}</td></tr>`;
      }).join("")}</tbody></table></div></div>`;
  }
  $("#pkCorpo").innerHTML = html;
  ligarTabela();
  $("#tabPres")?.tBodies[0].addEventListener("click", e => { const tr = e.target.closest("tr[data-escopo]"); if (tr) { N.cargo = 1; irPara(tr.dataset.escopo, "resultado"); } });
}

/* ---------- bancadas: Câmara dos Deputados e Assembleias somando os estados */
const PALETA_PARTIDO = PALETA.concat(["#6bc4e8", "#e0a3c8", "#b07c4f", "#7fd1a3", "#f0c987", "#9a8cf0", "#d98e8e", "#8ab8a8"]);
const cacheCamara = new Map();
async function camara(cargo) {
  const c = cacheCamara.get(cargo);
  if (c && Date.now() - c.t < 60000) return c.v;
  const v = await api(`/camara.json?cargo=${cargo}`);
  cacheCamara.set(cargo, {t: Date.now(), v}); return v;
}
function coresBancada(cam) { return new Map((cam?.partidos || []).map((p, i) => [p.partido, i < PALETA_PARTIDO.length ? PALETA_PARTIDO[i] : OUTRO])); }
// Semicírculo do plenário: uma bolinha por cadeira, partidos da esquerda para a direita pelo tamanho da bancada
function plenario(lista, cores) {
  const S = lista.reduce((t, p) => t + p.cadeiras, 0); if (!S) return "";
  const R = Math.max(2, Math.round(Math.sqrt(S / 4.2)));
  const raios = Array.from({length: R}, (_, i) => 0.42 + 0.58 * i / Math.max(1, R - 1));
  const soma = raios.reduce((a, b) => a + b, 0);
  let n = raios.map(r => Math.max(1, Math.round(S * r / soma)));
  n[R - 1] += S - n.reduce((a, b) => a + b, 0);
  const pts = [];
  raios.forEach((r, i) => { for (let k = 0; k < n[i]; k++) { const a = Math.PI - (n[i] === 1 ? Math.PI / 2 : Math.PI * k / (n[i] - 1)); pts.push({a, x: r * Math.cos(a), y: r * Math.sin(a)}); } });
  pts.sort((p, q) => q.a - p.a);
  const cor = []; for (const p of lista) for (let k = 0; k < p.cadeiras; k++) cor.push([cores.get(p.partido) || OUTRO, p.partido]);
  const rb = Math.min(0.022, 0.5 / R * 0.42 * 1.0, 1.15 / Math.sqrt(S) * 0.5);
  return `<svg viewBox="-1.05 -1.05 2.1 1.12" style="width:100%;height:auto;max-height:340px" role="img" aria-label="Plenário com ${S} cadeiras">
    ${pts.map((p, i) => `<circle cx="${p.x.toFixed(4)}" cy="${(-p.y).toFixed(4)}" r="${rb.toFixed(4)}" fill="${cor[i]?.[0] || "#1a2129"}"><title>${esc(cor[i]?.[1] || "")}</title></circle>`).join("")}
    <text x="0" y="-0.08" text-anchor="middle" fill="#f5f7f9" style="font:700 0.16px var(--display)">${S}</text><text x="0" y="0.02" text-anchor="middle" fill="#a7adb4" style="font:500 0.06px var(--sans)">cadeiras</text></svg>`;
}
function blocoEleitos(uf, e, cores, aberto) {
  return `<details ${aberto ? "open" : ""}><summary style="cursor:pointer;display:flex;gap:10px;align-items:center;list-style:none">${bandeira(uf, 30)}<span class="sigla">${uf.toUpperCase()}</span><b style="font-size:16px">${esc(NOMES[uf])}</b>
      <span class="nota">${e.vagas} vagas · ${e.fonte === "tse" ? "cadeiras oficiais do TSE" : "projeção"} · ${pct((e.pct || 0) / 100, 0)} apurado</span></summary>
    <div class="leg" style="margin:10px 0">${e.agremiacoes.sort((a, b) => b.cadeiras - a.cadeiras).map(a => `<span><b style="background:${cores.get(a.sigla.split(/\s*\/\s*/)[0]) || OUTRO}"></b>${logosDe(a.sigla, 15)} ${esc(a.sigla)}: ${a.cadeiras}</span>`).join("")}</div>
    <div class="tab-wrap" style="max-height:360px"><table><thead><tr><th style="cursor:default">Quem entra</th><th style="cursor:default">Partido</th><th style="cursor:default">Votos</th></tr></thead>
    <tbody>${e.eleitos.map(c => `<tr style="cursor:default"><td>${esc(nome(c.nome))}${c.eleito ? '<span class="selo">Eleito</span>' : ""}</td><td><span class="bola" style="background:${cores.get(c.partido) || OUTRO}"></span>${partidoH(c.partido, 16)}</td><td>${int(c.votos)}</td></tr>`).join("")}</tbody></table></div></details>`;
}
async function viewBancadas(main, porRegiao) {
  const t = N.tok;
  main.innerHTML = `<div class="vazio">Somando as bancadas dos estados…</div>`;
  const cam = await camara(N.cargo);
  if (!vivo(t)) return;
  const ufs = ehUF(N.escopo) ? Object.keys(NOMES) : ufsDoEscopo();
  const cores = coresBancada(cam);
  const cont = new Map();
  for (const u of ufs) for (const c of cam.estados[u]?.eleitos || []) cont.set(c.partido, (cont.get(c.partido) || 0) + 1);
  const lista = [...cont.entries()].map(([partido, cadeiras]) => ({partido, cadeiras})).sort((a, b) => b.cadeiras - a.cadeiras);
  const vagas = ufs.reduce((tt, u) => tt + (cam.estados[u]?.vagas || 0), 0);
  const mx = lista[0]?.cadeiras || 1;
  const casa = N.cargo === 6 ? "Câmara dos Deputados" : "Assembleias Legislativas";
  // mapa: partido com a maior bancada em cada estado
  const geo = await geoBR(); if (!vivo(t)) return;
  const pc = caminhos(geo, f => IBGE_UF[f.properties.codarea]);
  const maior = u => { const m = new Map(); for (const c of cam.estados[u]?.eleitos || []) m.set(c.partido, (m.get(c.partido) || 0) + 1); return [...m].sort((a, b) => b[1] - a[1])[0]; };
  const naRegiao = new Set(ufs);
  main.innerHTML = `<div class="kpis">
      <div class="card kpi"><div class="l">${N.cargo === 6 ? "Cadeiras na Câmara" : "Cadeiras nas Assembleias"}</div><div class="v">${int(vagas)}</div><div class="s">${esc(nomeEscopo())}</div></div>
      <div class="card kpi"><div class="l">Partidos com cadeira</div><div class="v">${lista.length}</div><div class="s">projeção pelos votos já apurados</div></div>
      <div class="card kpi"><div class="l">Maior bancada</div><div class="v">${esc(lista[0]?.partido || "–")}</div><div class="s">${lista[0] ? lista[0].cadeiras + " cadeiras · " + pct(lista[0].cadeiras / vagas) : ""}</div></div>
      <div class="card kpi"><div class="l">Já eleitos oficialmente</div><div class="v">${int(ufs.reduce((tt, u) => tt + (cam.estados[u]?.eleitos.filter(c => c.eleito).length || 0), 0))}</div><div class="s">confirmados pelo TSE</div></div>
    </div>
    <div class="mapa-wrap"><div class="card pad"><h2 style="margin-bottom:6px">${casa} · ${esc(nomeEscopo())}</h2><p class="nota" style="margin:0 0 6px">Cadeiras de cada partido somando os estados (quociente eleitoral e sobras de cada estado; quando o TSE já publica as cadeiras, usamos o número oficial).</p>
      ${plenario(lista, cores)}
      ${lista.map(p => `<div class="linha"><i class="bola" style="background:${cores.get(p.partido) || OUTRO}"></i><span style="flex:0 0 150px">${partidoH(p.partido, 18)}</span><span class="barra" style="flex:1;margin:0;height:8px"><i style="width:${p.cadeiras / mx * 100}%;background:${cores.get(p.partido) || OUTRO}"></i></span><em style="width:80px;text-align:right">${p.cadeiras} <small>${pct(p.cadeiras / vagas, 0)}</small></em></div>`).join("")}</div>
    <div class="card pad"><h2 style="margin-bottom:6px">Maior bancada em cada estado</h2><p class="nota" style="margin:0 0 8px">Clique num estado para ver quem entra.</p>
      <svg viewBox="-4 -4 ${pc.W + 8} ${pc.H + 8}" style="width:100%;height:auto;max-height:480px">${pc.f.map(f => { const m = maior(f.id); const fora = !naRegiao.has(f.id);
        return `<path data-uf="${f.id}" d="${f.d}" fill="${m && !fora ? cores.get(m[0]) || OUTRO : "#12171d"}" fill-opacity="${fora ? 0.35 : 0.9}" stroke="#0b1015" stroke-width="0.8" style="cursor:pointer"><title>${esc(NOMES[f.id] || "")}: ${m ? esc(m[0]) + " " + m[1] + " de " + (cam.estados[f.id]?.vagas || "") : ""}</title></path>`; }).join("")}</svg></div></div>
    ${porRegiao ? `<h3>Por região</h3><div class="tab-wrap"><table class="ordenavel"><thead><tr><th>Região</th><th>Cadeiras</th>${lista.slice(0, 8).map(p => `<th>${esc(p.partido)}</th>`).join("")}</tr></thead><tbody>${Object.entries(REGIOES).map(([r, us]) => {
        const m = new Map(); let v = 0; for (const u of us) { v += cam.estados[u]?.vagas || 0; for (const c of cam.estados[u]?.eleitos || []) m.set(c.partido, (m.get(c.partido) || 0) + 1); }
        return `<tr data-escopo="r:${r}"><td>${r}</td><td data-v="${v}">${v}</td>${lista.slice(0, 8).map(p => `<td data-v="${m.get(p.partido) || 0}">${m.get(p.partido) || 0}</td>`).join("")}</tr>`; }).join("")}</tbody></table></div>` : ""}
    <h3>Quem entra em cada estado</h3>
    <div class="barra-ferr"><label class="busca"><input id="qDep" type="search" placeholder="Buscar deputado ou partido" autocomplete="off" aria-label="Buscar deputado ou partido"></label></div>
    <div id="listaDep" style="display:grid;gap:10px">${ufs.filter(u => cam.estados[u]).map(u => `<div class="card pad">${blocoEleitos(u, cam.estados[u], cores, ufs.length <= 4)}</div>`).join("")}</div>`;
  ligarTabela();
  main.querySelector("table.ordenavel")?.tBodies[0].addEventListener("click", e => { const tr = e.target.closest("tr[data-escopo]"); if (tr) irPara(tr.dataset.escopo, "resultado"); });
  $("#qDep").addEventListener("input", e => {
    const q = semAcento(e.target.value.trim());
    for (const card of $("#listaDep").children) {
      let algum = false;
      for (const tr of card.querySelectorAll("tbody tr")) { const ok = !q || semAcento(tr.textContent).includes(q); tr.hidden = !ok; algum ||= ok; }
      card.hidden = !algum; if (q && algum) card.querySelector("details").open = true;
    }
  });
}

/* ---------- detalhe de uma cidade (gaveta) */
async function abrirCidade(uf, mun, n) {
  const cargo = N.cargo > 5 ? 1 : N.cargo;
  const g = $("#gaveta");
  g.innerHTML = `<button class="btn fechar" id="gFechar" aria-label="Fechar">✕</button><div class="kicker" style="margin-top:0">${esc(cargoNome(cargo))} · ${esc(NOMES[uf])}</div><h2 style="margin:10px 0 14px">${esc(nome(n))}</h2><div class="vazio">Carregando resultado oficial…</div>`;
  g.classList.add("aberta"); $("#veu").classList.add("aberto");
  $("#gFechar").onclick = fecharGaveta;
  let r = null; try { r = await api(`/municipio.json?uf=${uf}&mun=${mun}&cargo=${cargo}`); } catch {}
  const salvo = N.cargo; N.cargo = cargo;
  g.innerHTML = `<button class="btn fechar" id="gFechar" aria-label="Fechar">✕</button><div class="kicker" style="margin-top:0">${esc(cargoNome(cargo))} · ${esc(NOMES[uf])}</div><h2 style="margin:10px 0 14px">${esc(nome(n))}</h2>
    <div class="barra-ferr"><button class="btn prim" id="gCmp">Adicionar à comparação</button><button class="btn" id="gEsc">Ver colégios</button><a class="btn" href="/${uf}/">Painel do estado</a></div>
    ${r ? kpis(r).replace('class="kpis"', 'class="kpis" style="grid-template-columns:repeat(2,1fr)"') + listaCands(r, 30) : `<div class="vazio">Resultado oficial indisponível agora.</div>`}`;
  N.cargo = salvo;
  $("#gFechar").onclick = fecharGaveta;
  $("#gCmp").onclick = () => { addCmp(uf, mun, n); fecharGaveta(); N.aba = "comparar"; render(); };
  $("#gEsc").onclick = () => { N.escolaMun[uf] = {mun, nome: n}; fecharGaveta(); irPara(uf, "escolas"); };
}
function fecharGaveta() { $("#gaveta").classList.remove("aberta"); $("#veu").classList.remove("aberto"); }
$("#veu").addEventListener("click", fecharGaveta);
document.addEventListener("keydown", e => { if (e.key === "Escape") fecharGaveta(); });

/* ------------------------------------------------------------------ render */
let renderTok = 0;
const vivo = t => t === N.tok;
async function render() {
  if (N.escopo === "zz" && N.cargo !== 1) N.cargo = 1;
  salvarHash(); renderControles();
  const tok = N.tok = ++renderTok;
  const main = $("#conteudo");
  obsEntrada?.disconnect();
  if (!N.D) { main.innerHTML = `<div class="vazio">Carregando dados do TSE…</div>`; return; }
  try {
    await ({resultado: viewResultado, mapa: viewMapa, todos: viewTodos, regioes: viewRegioes, cidades: viewCidades, escolas: viewEscolas, comparar: viewComparar, candidatos: viewCandidatos}[N.aba] || viewResultado)(main);
  } catch (e) {
    console.warn(e);
    if (tok === renderTok) main.innerHTML = `<div class="vazio">Não foi possível carregar agora (${esc(e.message)}). Os dados deste estado podem ainda estar sendo baixados; tente em alguns segundos.</div>`;
  }
}
async function carregar(primeira) {
  try {
    const D = await api("/brasil.json");
    const mudou = D !== N.D;
    N.D = D;
    const b = N.D.brasil;
    $("#hora").textContent = b ? (b.final ? "Totalização encerrada" : `Atualizado pelo TSE às ${(b.hora || "").split(" ")[1]?.slice(0, 5) || "–"}`) : "Aguardando o TSE";
    $("#pulso").classList.toggle("parado", !!b?.final);
    // Atualização automática só nas abas leves (não refaz mapas enquanto a pessoa navega)
    if (primeira || (mudou && ["resultado", "regioes"].includes(N.aba))) render();
  } catch (e) { console.warn(e); if (primeira) render(); }
}
render();
carregar(true);
setInterval(carregar, 60000);
