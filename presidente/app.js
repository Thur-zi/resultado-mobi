/* Presidente 2022 × 2026 em Minas Gerais — quadro comparativo por macrorregião, região, zona e cidade,
   cruzado com os deputados federais e estaduais de 2022 e 2026 (até 4 ao mesmo tempo).
   Unidade básica dos dados: município + zona eleitoral ("mun-zona"); tudo é somado aqui no navegador.
   Abas: visão geral, mapa, mapas de cada região, tabela, deputados e o lugar escolhido. */
"use strict";
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const nf = new Intl.NumberFormat("pt-BR");
const int = v => v == null || !isFinite(v) ? "–" : nf.format(Math.round(v));
const pct = (v, d = 1) => v == null || !isFinite(v) ? "–" : (v * 100).toLocaleString("pt-BR", {minimumFractionDigits: d, maximumFractionDigits: d}) + "%";
const pp = (v, d = 1) => v == null || !isFinite(v) ? "–" : (v > 0 ? "+" : "") + (v * 100).toLocaleString("pt-BR", {minimumFractionDigits: d, maximumFractionDigits: d}) + " p.p.";
const dec = (v, d = 2) => v == null || !isFinite(v) ? "–" : v.toLocaleString("pt-BR", {minimumFractionDigits: d, maximumFractionDigits: d});
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const semAc = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const LULA = "Lula", JB = "Jair Bolsonaro", FB = "Flavio Bolsonaro";
const NOME_EXIBE = n => n === FB ? "Flávio Bolsonaro" : n;
const COR = {lula: "#e0533d", bolso: "#3d8fd6", outro: "#7a7f86", brand: "#55b8e6"};
const CORES_DEP = ["#3ec6a8", "#fab219", "#c77dff", "#ff8fab"];
const corCand = n => n === LULA ? COR.lula : (n === JB || n === FB) ? COR.bolso : COR.outro;
const familia = n => n === LULA ? "lula" : (n === JB || n === FB) ? "bolso" : "outro";
const cargoNome = c => c === 6 ? "Dep. Federal" : "Dep. Estadual";
const rotDep = d => `${d.nome} · ${d.partido} · ${cargoNome(d.cargo)} 20${d.ano}`;
// logos dos partidos disponíveis (os mesmos do site de resultados); sem logo, só a sigla
const LOGOS = new Map(["AGIR.svg", "AVANTE.svg", "CIDADANIA.svg", "DC.svg", "DEMOCRATA.png", "MDB.svg", "MISSAO.svg", "MOBILIZA.png", "NOVO.svg", "PCB.svg", "PCDOB.svg", "PCO.svg", "PDT.png", "PL.svg", "PMB.png", "PODE.svg", "PP.svg", "PRD.svg", "PRTB.png", "PSB.svg", "PSD.svg", "PSDB.svg", "PSOL.svg", "PSTU.png", "PT.svg", "PV.svg", "REDE.svg", "REPUBLICANOS.svg", "SOLIDARIEDADE.svg", "UNIAO.svg", "UP.svg"].map(f => [f.split(".")[0], f]));
const logo = p => { const f = LOGOS.get(semAc(p).toUpperCase().replace(/[^A-Z]/g, "")); return f ? `<img class="logo-p" src="partidos/${f}" alt="" loading="lazy" onerror="this.remove()">` : ""; };
const avatar = (foto, nome, cor, cls = "av") => foto
  ? `<img class="${cls}" src="${esc(foto)}" alt="Foto de ${esc(nome)}" loading="lazy" style="--anel:${cor}" onerror="this.outerHTML='<span class=&quot;${cls}&quot; style=&quot;background:${cor}&quot;>${esc(nome[0] || "")}</span>'">`
  : `<span class="${cls}" style="background:${cor}">${esc(nome[0] || "")}</span>`;
Chart.defaults.color = "#a7adb4"; Chart.defaults.font.family = "Inter Tight, system-ui, sans-serif";

const E = {B: null, nivel: "mun", turno: "1", deps: [], filtroCargo: 0, filtroAno: 0, unidades: [], sel: null, modo: "venc26", mapa: null, camada: null, geo: null, graficos: [], topAno: "26",
  aba: "geral", galNivel: "me", galModo: "venc26", galOrdem: "aptos", detModo: "venc26", detMapa: null, detCamada: null};
const NIVEIS = {mg: "Minas Gerais", me: "Macrorregiões", mi: "Microrregiões", ri: "Regiões intermediárias", rm: "Regiões imediatas", zona: "Zonas eleitorais", mun: "Cidades"};
const NIVEL1 = {mg: "Estado", me: "Macrorregião", mi: "Microrregião", ri: "Região intermediária", rm: "Região imediata", zona: "Zona eleitoral", mun: "Cidade"};
const REGIAO = n => ["me", "mi", "ri", "rm"].includes(n);

function toast(t) { const el = $("#toast"); el.innerHTML = t; el.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("on"), 3600); }

/* ---------------- agregação */
function validos(d) { const B = E.B; return d.ano === 26 ? (d.cargo === 6 ? B.val6 : B.val7) : (d.cargo === 6 ? B.val6_22 : B.val7_22); }
function somar(mzs) {
  const B = E.B, t = E.turno, o = {v22: {}, v26: {}, d22: [0, 0, 0, 0, 0], d26: [0, 0, 0, 0, 0]};
  const dv = E.deps.map(() => 0), dval = E.deps.map(() => 0), vals = E.deps.map(s => validos(s.d));
  for (const k of mzs) {
    const a = B.v22[t][k]; if (a) for (const n in a) o.v22[n] = (o.v22[n] || 0) + a[n];
    const b = B.v26[k]; if (b) for (const n in b) o.v26[n] = (o.v26[n] || 0) + b[n];
    const c = B.d22[t][k]; if (c) for (let i = 0; i < 5; i++) o.d22[i] += c[i];
    const d = B.d26[k]; if (d) for (let i = 0; i < 5; i++) o.d26[i] += d[i];
    for (let j = 0; j < E.deps.length; j++) { dv[j] += E.deps[j].votos[k] || 0; dval[j] += vals[j][k] || 0; }
  }
  const tot = v => Object.values(v).reduce((x, y) => x + y, 0);
  o.t22 = tot(o.v22); o.t26 = tot(o.v26);
  const venc = v => Object.entries(v).sort((a, b) => b[1] - a[1])[0]?.[0];
  o.venc22 = venc(o.v22); o.venc26 = venc(o.v26);
  o.lula22 = (o.v22[LULA] || 0) / o.t22; o.lula26 = (o.v26[LULA] || 0) / o.t26;
  o.bol22 = (o.v22[JB] || 0) / o.t22; o.bol26 = (o.v26[FB] || 0) / o.t26;
  o.dLula = o.lula26 - o.lula22; o.dBol = o.bol26 - o.bol22;
  o.abst22 = o.d22[0] ? o.d22[2] / o.d22[0] : null; o.abst26 = o.d26[0] ? o.d26[2] / o.d26[0] : null;
  o.bn22 = o.d22[1] ? (o.d22[3] + o.d22[4]) / o.d22[1] : null; o.bn26 = o.d26[1] ? (o.d26[3] + o.d26[4]) / o.d26[1] : null;
  o.aptos = o.d26[0] || o.d22[0];
  o.virou = familia(o.venc22) !== familia(o.venc26);
  for (let j = 0; j < E.deps.length; j++) { o["dv" + j] = dv[j]; o["dp" + j] = dval[j] ? dv[j] / dval[j] : null; }
  if (E.deps.length > 1) { let m = -1; for (let j = 0; j < E.deps.length; j++) if (o["dp" + j] != null && (m < 0 || o["dp" + j] > o["dp" + m])) m = j; o.melhor = m; }
  return o;
}
function chaveDe(nivel, k) {
  const [m, z] = k.split("-"), mun = E.B.municipios[m];
  if (nivel === "mg") return ["mg", "Minas Gerais"];
  if (nivel === "me") return [mun?.me || "?", mun?.me];
  if (nivel === "mi") return [mun?.mi || "?", `Microrregião de ${mun?.mi}`];
  if (nivel === "ri") return [mun?.ri || "?", `Região intermediária de ${mun?.ri}`];
  if (nivel === "rm") return [mun?.rm || "?", `Região imediata de ${mun?.rm}`];
  if (nivel === "zona") return [z, E.B.zonas[z]?.nome || `Zona ${z}`];
  return [m, mun?.nome || m];
}
const todasMz = () => [...new Set([...Object.keys(E.B.v26), ...Object.keys(E.B.v22[E.turno])])];
// cache por nível; invalidado quando muda o turno ou os deputados
let CACHE = {};
function agrupar(nivel) {
  if (CACHE[nivel]) return CACHE[nivel];
  const grupos = new Map();
  for (const k of todasMz()) {
    const [chave, nome] = chaveDe(nivel, k);
    if (!grupos.has(chave)) grupos.set(chave, {chave, nome, nivel, mzs: []});
    grupos.get(chave).mzs.push(k);
  }
  return CACHE[nivel] = [...grupos.values()].map(g => Object.assign(g, somar(g.mzs), maisVotados(nivel, g.chave), posicoes(nivel, g.chave)));
}
const unidade = (nivel, chave) => agrupar(nivel).find(u => u.chave === chave);
const cidadesDe = u => [...new Set(u.mzs.map(k => k.split("-")[0]))];
// deputado mais votado de cada cargo e ano num lugar: {f26: [deputado, votos], e26, f22, e22}
function maisVotados(nivel, chave) {
  const g = E.top?.[nivel === "mg" ? "mg" : `${nivel}:${chave}`] || {}, o = {};
  for (const [k, cg, ano] of [["f26", 6, 26], ["e26", 7, 26], ["f22", 6, 22], ["e22", 7, 22]]) { const x = g[`${cg}-${ano}`]?.[0]; o[k] = x ? [E.B.deputados[x[0]], x[1]] : null; o[k + "n"] = x ? E.B.deputados[x[0]].nome : ""; }
  return o;
}
// posição (1 = mais votado do cargo e ano) de cada deputado escolhido; 99 = abaixo do 20º ou sem voto
function posicoes(nivel, chave) {
  const g = E.top?.[nivel === "mg" ? "mg" : `${nivel}:${chave}`] || {}, o = {};
  E.deps.forEach((s, j) => { const l = g[`${s.d.cargo}-${s.d.ano}`] || [], i = l.findIndex(x => x[0] === s.i); o["rk" + j] = i >= 0 ? i + 1 : 99; });
  return o;
}
const celTop = x => x ? `<span class="topcel">${avatar(x[0].foto, x[0].nome, "#2a333d", "av-m")}<span>${esc(x[0].nome)} <small>${esc(x[0].partido)} · ${int(x[1])}</small></span></span>` : "–";

/* ---------------- modos e abas */
const GRUPOS = {pres: [["geral", "Visão geral"], ["mapa", "Mapa"], ["regioes", "Mapas das regiões"], ["tabela", "Tabela"]],
  deps: [["deps", "Perfil e comparação"], ["depreg", "Por região"]], mesc: [["mesc", "Cruzamento"]], lugar: [["lugar", "Lugar"]]};
const grupoDe = a => Object.keys(GRUPOS).find(g => GRUPOS[g].some(x => x[0] === a)) || "pres";
E.ultima = {pres: "geral", deps: "deps", mesc: "mesc", lugar: "lugar"};
function irAba(aba, rolar = true) {
  const g = grupoDe(aba);
  E.aba = aba; E.grupo = g; E.ultima[g] = aba;
  $$("#modos [data-g]").forEach(b => b.setAttribute("aria-selected", b.dataset.g === g));
  $("#abas").innerHTML = GRUPOS[g].length > 1 ? GRUPOS[g].map(([k, n]) => `<button role="tab" data-aba="${k}" aria-selected="${k === aba}">${n}</button>`).join("") : "";
  $("#abas").hidden = GRUPOS[g].length < 2;
  $("#seletorDeps").hidden = !(g === "deps" || g === "mesc");
  $$(".painel").forEach(p => p.hidden = p.id !== "p-" + aba);
  if (history.replaceState) history.replaceState(null, "", "#" + aba);
  if (aba === "mapa") desenharMapa();
  if (aba === "regioes") galeria();
  if (aba === "tabela") tabela();
  if (aba === "lugar") desenharDetMapa();
  if (aba === "deps") renderDeps();
  if (aba === "depreg") depRegioes();
  if (aba === "mesc") renderMesc();
  if (rolar) { const y = $("#controles").getBoundingClientRect().top + scrollY - 4; if (scrollY > y) scrollTo({top: y, behavior: "smooth"}); }
}
$("#modos").addEventListener("click", e => { const b = e.target.closest("[data-g]"); if (b) irAba(E.ultima[b.dataset.g]); });
$("#abas").addEventListener("click", e => { const b = e.target.closest("[data-aba]"); if (b) irAba(b.dataset.aba); });
document.addEventListener("click", e => { const a = e.target.closest("[data-ir]"); if (a) { e.preventDefault(); irAba(a.dataset.ir); $("#toast").classList.remove("on"); } });
const renderDepsAtual = () => { if (E.aba === "deps") renderDeps(); if (E.aba === "depreg") depRegioes(); if (E.aba === "mesc") renderMesc(); };

/* ---------------- destaques (Minas) */
function destaques() {
  const mg = somar(todasMz()), cid = agrupar("mun"), me = agrupar("me");
  const t22 = E.turno === "1" ? "1º turno de 2022" : "2º turno de 2022";
  const l2b = cid.filter(c => familia(c.venc22) === "lula" && familia(c.venc26) === "bolso").length;
  const b2l = cid.filter(c => familia(c.venc22) === "bolso" && familia(c.venc26) === "lula").length;
  const maxB = cid.filter(c => c.aptos >= 50000).sort((a, b) => b.dBol - a.dBol)[0];
  const meL = me.slice().sort((a, b) => a.dLula - b.dLula)[0], meM = me.slice().sort((a, b) => b.dLula - a.dLula)[0];
  const abre = (u) => `data-abrir="${u.nivel}|${esc(u.chave)}"`;
  $("#destGrid").innerHTML = `
    <div class="dest forte"><span class="dl">Quem venceu em Minas em 2026</span><b>${esc(NOME_EXIBE(mg.venc26))}</b><span>${pct(mg.bol26)} contra ${pct(mg.lula26)} do Lula · diferença de ${int(Math.abs((mg.v26[FB] || 0) - (mg.v26[LULA] || 0)))} votos</span></div>
    <div class="dest"><span class="dl">Lula em Minas · ${t22} → 2026</span><b class="${mg.dLula > 0 ? "pos" : "neg"}">${pp(mg.dLula)}</b><span>${pct(mg.lula22)} → ${pct(mg.lula26)}</span></div>
    <div class="dest"><span class="dl">Bolsonaro · Jair (2022) → Flávio (2026)</span><b class="${mg.dBol > 0 ? "pos" : "neg"}">${pp(mg.dBol)}</b><span>${pct(mg.bol22)} → ${pct(mg.bol26)}</span></div>
    <button class="dest" data-ir="mapa"><span class="dl">Cidades que mudaram de lado</span><b>${int(l2b + b2l)} <small>de ${int(cid.length)}</small></b><span>${int(l2b)} saíram do Lula para o Flávio · ${int(b2l)} do Bolsonaro para o Lula</span></button>
    <button class="dest" ${abre(meL)}><span class="dl">Macrorregião onde o Lula mais caiu</span><b>${esc(meL.nome)}</b><span>${pp(meL.dLula)} · onde menos caiu: ${esc(meM.nome)} (${pp(meM.dLula)})</span></button>
    ${maxB ? `<button class="dest" ${abre(maxB)}><span class="dl">Maior avanço do Flávio sobre o Jair <small>(cidades com 50 mil+ eleitores)</small></span><b>${esc(maxB.nome)}</b><span>${pp(maxB.dBol)} · ${pct(maxB.bol22)} → ${pct(maxB.bol26)}</span></button>` : ""}`;
}
document.addEventListener("click", e => { if (e.target.closest("[data-pop]")) return; const a = e.target.closest("[data-abrir]"); if (a) { const [n, ...c] = a.dataset.abrir.split("|"); abrir(n, c.join("|")); } });

/* ---------------- quadro de uma unidade */
function listaCand(v, tot, fotos, n = 12) {
  const ord = Object.entries(v).sort((a, b) => b[1] - a[1]).slice(0, n), mx = ord[0]?.[1] || 1;
  return ord.map(([nome, q], i) => `<div class="cand${i === 0 ? " lider" : ""}">${avatar(fotos.get(nome), NOME_EXIBE(nome), corCand(nome))}
    <div><div class="n">${esc(NOME_EXIBE(nome))}${i === 0 ? '<span class="tag-v">mais votado</span>' : ""}<small>${logo(E.partidos.get(nome) || "")}${esc(E.partidos.get(nome) || "")}</small></div><div class="b"><i style="width:${q / mx * 100}%;background:${corCand(nome)}"></i></div></div>
    <div class="v"><b>${pct(q / tot)}</b><small>${int(q)} votos</small></div></div>`).join("");
}
function quadro(u, alvo) {
  const t = E.turno === "1" ? "2022 · 1º turno" : "2022 · 2º turno";
  const cls = v => v > 0 ? "pos" : v < 0 ? "neg" : "";
  alvo.innerHTML = `<div class="anos"><div class="card ano"><h4>${t}</h4>${listaCand(u.v22, u.t22, E.fotos22)}</div>
    <div class="card ano"><h4>2026 · 1º turno</h4>${listaCand(u.v26, u.t26, E.fotos26)}</div></div>
    <div class="delta">
      <div class="card"><div class="l">Lula</div><div class="v ${cls(u.dLula)}">${pp(u.dLula)}</div><div class="s">${pct(u.lula22)} → ${pct(u.lula26)}<br>${int(u.v22[LULA])} → ${int(u.v26[LULA])} votos</div></div>
      <div class="card"><div class="l">Jair (2022) → Flávio (2026)</div><div class="v ${cls(u.dBol)}">${pp(u.dBol)}</div><div class="s">${pct(u.bol22)} → ${pct(u.bol26)}<br>${int(u.v22[JB])} → ${int(u.v26[FB])} votos</div></div>
      <div class="card ${u.virou ? "alerta" : ""}"><div class="l">Vencedor</div><div class="v txt">${esc(NOME_EXIBE(u.venc22))} → ${esc(NOME_EXIBE(u.venc26))}</div><div class="s">${u.virou ? "<b>mudou de lado</b>" : "manteve o lado"}</div></div>
      <div class="card"><div class="l">Abstenção</div><div class="v txt">${pct(u.abst22)} → ${pct(u.abst26)}</div><div class="s">dos eleitores aptos</div></div>
      <div class="card"><div class="l">Brancos e nulos</div><div class="v txt">${pct(u.bn22)} → ${pct(u.bn26)}</div><div class="s">dos votos</div></div>
      <div class="card"><div class="l">Votos válidos</div><div class="v txt">${int(u.t22)} → ${int(u.t26)}</div><div class="s">para Presidente · ${int(u.aptos)} eleitores</div></div>
    </div>`;
}

/* ---------------- cores e legendas (compartilhadas por todos os mapas) */
const MODOS = () => [["venc26", "Vencedor 2026"], ["venc22", "Vencedor 2022"], ["virou", "Mudou de lado"], ["dLula", "Δ Lula"], ["dBol", "Δ Bolsonaro"], ["lula26", "Lula 2026"], ["bol26", "Flávio 2026"], ["lula22", "Lula 2022"], ["bol22", "Jair 2022"], ["abst26", "Abstenção 2026"]]
  .concat(E.deps.flatMap((s, j) => [["rk" + j, `${s.d.nome} ${s.d.ano}: onde foi o mais votado`], ["dp" + j, `${s.d.nome} ${s.d.ano}: %`]])).concat(E.deps.length > 1 ? [["melhor", "Qual deputado foi melhor"]] : []);
const mistura = (c, t) => { const a = parseInt(c.slice(1), 16), b = 0x11171d; const r = s => Math.round(((b >> s) & 255) * (1 - t) + ((a >> s) & 255) * t); return `rgb(${r(16)},${r(8)},${r(0)})`; };
const rampa = c => [.18, .36, .56, .78, 1].map(t => mistura(c, t));
const RAMPAS = {lula: rampa(COR.lula), bolso: rampa(COR.bolso), cinza: rampa("#9aa6b2")};
const DIV = ["#215c8c", "#4f93cc", "#8a96a3", "#e48a76", "#c4503e"];
function quebras(vals) { const v = vals.filter(x => x != null && isFinite(x)).sort((a, b) => a - b); return [0.2, 0.4, 0.6, 0.8].map(q => v[Math.floor(q * (v.length - 1))]); }
const rampaDo = modo => /^dp\d/.test(modo) ? rampa(E.deps[+modo.slice(2)].cor) : /lula/.test(modo) ? RAMPAS.lula : /bol/.test(modo) ? RAMPAS.bolso : RAMPAS.cinza;
const POS = m => /^rk\d/.test(m) || /^pr(22|26):/.test(m);
const CATEG = m => ["venc26", "venc22", "virou", "melhor"].includes(m) || POS(m);
function posDe(u, modo) {
  if (!u) return null;
  if (/^rk\d/.test(modo)) return u[modo] ?? null;
  const m = /^pr(22|26):(.+)$/.exec(modo); if (!m) return null;
  const v = m[1] === "26" ? u.v26 : u.v22; if (!v || !v[m[2]]) return 99;
  return 1 + Object.values(v).filter(x => x > v[m[2]]).length;
}
const corBasePos = modo => /^rk\d/.test(modo) ? E.deps[+modo.slice(2)].cor : (() => { const n = modo.split(":")[1]; return n === LULA || n === JB || n === FB ? corCand(n) : COR.brand; })();
const FAIXAS_POS = [[1, "1º · mais votado"], [3, "2º ou 3º"], [10, "4º ao 10º"], [20, "11º ao 20º"], [1e9, "abaixo do 20º"]];
function corPos(r, base) { if (r == null) return "#1a2129"; return r <= 1 ? base : r <= 3 ? mistura(base, .42) : r <= 10 ? mistura(base, .24) : r <= 20 ? mistura(base, .13) : "#1a2027"; }
const nomeModo = m => { const x = MODOS().find(y => y[0] === m); if (x) return x[1]; const q = /^pr(22|26):(.+)$/.exec(m); return q ? `${NOME_EXIBE(q[2])} ${q[1] === "26" ? "2026" : "2022"}: onde foi o mais votado` : m; };
function corValor(u, modo, q) {
  if (!u) return "#1a2129";
  if (modo === "venc26") return corCand(u.venc26);
  if (modo === "venc22") return corCand(u.venc22);
  if (modo === "virou") return u.virou ? "#fab219" : "#2a333d";
  if (modo === "melhor") return u.melhor >= 0 ? E.deps[u.melhor].cor : "#1a2129";
  if (POS(modo)) return corPos(posDe(u, modo), corBasePos(modo));
  const x = u[modo]; if (x == null || !isFinite(x)) return "#1a2129";
  if (modo === "dLula" || modo === "dBol") { const i = q.filter(t => x > t).length; return modo === "dLula" ? DIV[i] : DIV[4 - i]; }
  return rampaDo(modo)[q.filter(t => x > t).length];
}
const fmtModo = (modo, x) => modo === "dLula" || modo === "dBol" ? pp(x) : pct(x, /^dp/.test(modo) ? 2 : 1);
function legenda(modo, q) {
  if (modo === "venc26" || modo === "venc22") return `<span><b style="background:${COR.lula}"></b>Lula</span><span><b style="background:${COR.bolso}"></b>${modo === "venc22" ? "Jair Bolsonaro" : "Flávio Bolsonaro"}</span><span><b style="background:${COR.outro}"></b>outro</span>`;
  if (modo === "virou") return `<span><b style="background:#fab219"></b>mudou de lado</span><span><b style="background:#2a333d"></b>manteve</span>`;
  if (POS(modo)) { const b = corBasePos(modo); return FAIXAS_POS.map(([r, t], i) => `<span><b style="background:${corPos(i === 4 ? 99 : r, b)}"></b>${t}</span>`).join("") + `<span class="nota">(posição entre os candidatos do mesmo cargo e ano)</span>`; }
  if (modo === "melhor") return E.deps.map(s => `<span><b style="background:${s.cor}"></b>${esc(s.d.nome)} ${s.d.ano}</span>`).join("") + `<span class="nota">(maior % dos válidos do próprio cargo)</span>`;
  const c = modo === "dLula" ? DIV : modo === "dBol" ? DIV.slice().reverse() : rampaDo(modo), f = x => fmtModo(modo, x);
  return c.map((cor, i) => `<span><b style="background:${cor}"></b>${i === 0 ? "até " + f(q[0]) : i === 4 ? "acima de " + f(q[3]) : f(q[i - 1]) + " a " + f(q[i])}</span>`).join("") + `<span class="nota">(5 faixas com o mesmo número de lugares)</span>`;
}
function dica(u) {
  return `<b>${esc(u.nome)}</b><br>2022: Lula ${pct(u.lula22)} · Jair ${pct(u.bol22)}<br>2026: Lula ${pct(u.lula26)} · Flávio ${pct(u.bol26)}<br>Δ Lula ${pp(u.dLula)} · Δ Bolsonaro ${pp(u.dBol)}${u.virou ? " · <b style='color:#fab219'>mudou de lado</b>" : ""}`
    + (u.f26 ? `<br>Mais votados 2026: <b>${esc(u.f26[0].nome)}</b> (fed.) · <b>${esc(u.e26?.[0].nome)}</b> (est.)` : "")
    + (u.f22 ? `<br>Mais votados 2022: ${esc(u.f22[0].nome)} (fed.) · ${esc(u.e22?.[0].nome)} (est.)` : "")
    + E.deps.map((s, j) => `<br><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${s.cor}"></i> ${esc(s.d.nome)} ${s.d.ano}: ${int(u["dv" + j])} votos (${pct(u["dp" + j], 2)})${u["rk" + j] ? ` · <b>${u["rk" + j] === 1 ? "1º, mais votado" : u["rk" + j] < 99 ? u["rk" + j] + "º" : "abaixo do 20º"}</b>` : ""}`).join("");
}
const botoesModo = (sel, atual) => {
  const pres = [["26", E.B.cand26], ["22", E.B.cand22["1"]]].flatMap(([a, l]) => l.map(c => [`pr${a}:${c[0]}`, `${NOME_EXIBE(c[0])} · 20${a}`]));
  $(sel).innerHTML = MODOS().map(([k, n]) => { const j = /^(dp|rk)(\d)/.exec(k); return `<button data-m="${k}" aria-pressed="${atual === k}">${j ? `<i class="pt" style="background:${E.deps[+j[2]].cor}"></i>` : ""}${esc(n)}</button>`; }).join("")
    + `<select class="sel-pres${/^pr/.test(atual) ? " on" : ""}" aria-label="Candidato a Presidente: onde foi o mais votado"><option value="">Presidente: onde foi o mais votado…</option>${pres.map(([k, n]) => `<option value="${esc(k)}" ${k === atual ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>`;
};
const validaModo = m => MODOS().some(x => x[0] === m) || /^pr(22|26):/.test(m) ? m : "venc26";
document.addEventListener("change", e => {
  const s = e.target.closest(".sel-pres"); if (!s || !s.value) return;
  const id = s.parentElement.id;
  if (id === "modoMapa") { E.modo = s.value; desenharMapa(); } else if (id === "galModo") { E.galModo = s.value; galeria(); } else if (id === "detModo") { E.detModo = s.value; desenharDetMapa(); }
});

/* ---------------- mapinhas em SVG (galeria de regiões) */
function prepararGeo() {
  const k = Math.cos(18.5 * Math.PI / 180);
  E.pth = new Map(); E.bb = new Map();
  let X0 = 1e9, X1 = -1e9, Y0 = 1e9, Y1 = -1e9;
  for (const f of E.geo.features) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    const anel = a => "M" + a.map(([x, y]) => { const X = x * k * 100, Y = -y * 100; if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y; return X.toFixed(1) + "," + Y.toFixed(1); }).join("L") + "Z";
    const g = f.geometry, d = (g.type === "Polygon" ? [g.coordinates] : g.coordinates).map(p => p.map(anel).join("")).join("");
    E.pth.set(f.properties.ibge, d); E.bb.set(f.properties.ibge, [x0, y0, x1, y1]);
    X0 = Math.min(X0, x0); X1 = Math.max(X1, x1); Y0 = Math.min(Y0, y0); Y1 = Math.max(Y1, y1);
  }
  E.munDe = new Map(Object.entries(E.B.municipios).map(([m, x]) => [x.ibge, m]));
  E.vbMG = `${X0 - 4} ${Y0 - 4} ${X1 - X0 + 8} ${Y1 - Y0 + 8}`;
  // Minas inteira num só desenho, reaproveitado pelos mapinhas de localização
  document.body.insertAdjacentHTML("beforeend", `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><path id="mgTodo" d="${[...E.pth.values()].join("")}"/></defs></svg>`);
}
const ibgeDe = m => E.B.municipios[m]?.ibge;
function miniSvg(itens, cls = "mini-mapa") {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const it of itens) { const b = E.bb.get(it.ibge); if (!b) continue; x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); }
  const pad = Math.max(x1 - x0, y1 - y0) * .05;
  return `<svg class="${cls}" viewBox="${(x0 - pad).toFixed(1)} ${(y0 - pad).toFixed(1)} ${(x1 - x0 + 2 * pad).toFixed(1)} ${(y1 - y0 + 2 * pad).toFixed(1)}" preserveAspectRatio="xMidYMid meet" role="img">${itens.map(it => `<path d="${E.pth.get(it.ibge) || ""}" fill="${it.cor}"${it.pop ? ` data-pop="${esc(it.pop)}"` : ""}><title>${esc(it.titulo)}</title></path>`).join("")}</svg>`;
}
const localizador = ibges => `<svg class="loc" viewBox="${E.vbMG}" aria-hidden="true"><use href="#mgTodo" fill="#2a333d"/><path d="${ibges.map(i => E.pth.get(i) || "").join("")}" fill="${COR.brand}"/></svg>`;
function cartaoRegiao(u, modo, q, cidMap) {
  const muns = cidadesDe(u);
  const itens = muns.map(m => { const c = cidMap.get(m); return {ibge: ibgeDe(m), pop: `mun|${m}`, cor: corValor(c, modo, q), titulo: c ? `${c.nome}: Lula ${pct(c.lula26)} · Flávio ${pct(c.bol26)}` : ""}; });
  const viraram = muns.filter(m => cidMap.get(m)?.virou).length, nLula = muns.filter(m => familia(cidMap.get(m)?.venc26) === "lula").length;
  const barra = (a, b, ca, cb) => `<div class="duo"><i style="width:${a * 100}%;background:${ca}"></i><i style="width:${b * 100}%;background:${cb}"></i></div>`;
  return `<div class="card regiao" role="button" tabindex="0" data-focar="${u.nivel}|${esc(u.chave)}" title="Ver ${esc(u.nome)} grande no mapa">
    <div class="rg-cab"><div><b>${esc(u.nivel === "me" ? u.nome : u.nome.replace(/^(Microrregião|Região intermediária|Região imediata) de /, ""))}</b><small>${int(muns.length)} ${muns.length === 1 ? "cidade" : "cidades"} · ${int(u.aptos)} eleitores</small></div>${localizador(muns.map(ibgeDe))}</div>
    ${miniSvg(itens)}
    <div class="rg-venc"><span class="venc"><i style="background:${corCand(u.venc26)}"></i>${esc(NOME_EXIBE(u.venc26))}</span>${u.virou ? '<span class="virou">virou</span>' : ""}</div>
    <div class="rg-linha"><span>2026</span>${barra(u.lula26, u.bol26, COR.lula, COR.bolso)}<small>Lula ${pct(u.lula26)} · Flávio ${pct(u.bol26)}</small></div>
    <div class="rg-linha"><span>2022</span>${barra(u.lula22, u.bol22, COR.lula, COR.bolso)}<small>Lula ${pct(u.lula22)} · Jair ${pct(u.bol22)}</small></div>
    <div class="rg-chips"><span class="${u.dLula > 0 ? "pos" : "neg"}">Lula ${pp(u.dLula)}</span><span class="${u.dBol > 0 ? "pos" : "neg"}">Bolsonaro ${pp(u.dBol)}</span><span>${int(nLula)} de ${int(muns.length)} com Lula</span>${viraram ? `<span class="am">${int(viraram)} viraram</span>` : ""}</div>
    ${u.f26 ? `<div class="rg-top"><span>Mais votados 2026</span>${celTop(u.f26)}${celTop(u.e26)}</div>` : ""}
    <div class="rg-bts"><span class="rg-ver">Ver no mapa grande ↗</span><button class="btn mini" data-abrir="${u.nivel}|${esc(u.chave)}">Comparativo completo</button></div>
    ${E.deps.length ? `<div class="rg-deps">${E.deps.map((s, j) => { const nm = muns.filter(m => cidMap.get(m)?.["rk" + j] === 1).length; return `<span><i style="background:${s.cor}"></i>${esc(s.d.nome)} ${s.d.ano}: <b>${pct(u["dp" + j], 2)}</b> · ${u["rk" + j] === 1 ? "<b>1º aqui</b>" : u["rk" + j] < 99 ? u["rk" + j] + "º aqui" : "abaixo do 20º"} · mais votado em ${int(nm)} ${nm === 1 ? "cidade" : "cidades"}</span>`; }).join("")}</div>` : ""}
  </div>`;
}
function galeria() {
  E.galModo = validaModo(E.galModo); botoesModo("#galModo", E.galModo);
  const cid = agrupar("mun"), cidMap = new Map(cid.map(c => [c.chave, c])), q = quebras(cid.map(c => c[E.galModo]));
  const o = E.galOrdem, lista = agrupar(E.galNivel).slice().sort((a, b) => o === "nome" ? a.nome.localeCompare(b.nome) : o === "dLula" ? a.dLula - b.dLula : (b[o] - a[o]));
  $("#galLegenda").innerHTML = `<span class="nota">Cidades pintadas por <strong>${esc(nomeModo(E.galModo))}</strong>:</span>` + legenda(E.galModo, q);
  // desenha em lotes para a página não travar (zonas e regiões imediatas têm muitos cartões)
  const alvo = $("#galeria"), vez = (E.galVez = (E.galVez || 0) + 1);
  alvo.innerHTML = "";
  let i = 0;
  const lote = () => { if (vez !== E.galVez) return; alvo.insertAdjacentHTML("beforeend", lista.slice(i, i + 24).map(u => cartaoRegiao(u, E.galModo, q, cidMap)).join("")); i += 24; if (i < lista.length) requestAnimationFrame(lote); };
  lote();
}
function galeriaGeral() {
  const cid = agrupar("mun"), cidMap = new Map(cid.map(c => [c.chave, c])), q = quebras(cid.map(c => c.venc26));
  $("#geralRegioes").innerHTML = agrupar("me").slice().sort((a, b) => b.aptos - a.aptos).map(u => cartaoRegiao(u, "venc26", q, cidMap)).join("");
}
$("#galNivel").addEventListener("click", e => { const b = e.target.closest("[data-g]"); if (!b) return; E.galNivel = b.dataset.g; $$("#galNivel button").forEach(x => x.setAttribute("aria-pressed", x === b)); galeria(); });
$("#galModo").addEventListener("click", e => { const b = e.target.closest("[data-m]"); if (b) { E.galModo = b.dataset.m; galeria(); } });
$("#galOrdem").addEventListener("click", e => { const b = e.target.closest("[data-o]"); if (!b) return; E.galOrdem = b.dataset.o; $$("#galOrdem button").forEach(x => x.setAttribute("aria-pressed", x === b)); galeria(); });

/* ---------------- tabela */
let ord = {k: "aptos", dir: -1}, filtroTab = "";
const COLS = () => [
  {t: "Lugar", k: "nome", f: u => `<b>${esc(u.nome)}</b>`},
  {t: "Eleitores", k: "aptos", f: u => int(u.aptos)},
  {t: "Lula 22", k: "lula22", f: u => pct(u.lula22)}, {t: "Lula 26", k: "lula26", f: u => pct(u.lula26)},
  {t: "Δ Lula", k: "dLula", f: u => `<span class="${u.dLula > 0 ? "pos" : "neg"}">${pp(u.dLula)}</span>`},
  {t: "Jair 22", k: "bol22", f: u => pct(u.bol22)}, {t: "Flávio 26", k: "bol26", f: u => pct(u.bol26)},
  {t: "Δ Bolsonaro", k: "dBol", f: u => `<span class="${u.dBol > 0 ? "pos" : "neg"}">${pp(u.dBol)}</span>`},
  {t: "Vencedor 22", k: "venc22", f: u => `<span class="venc"><i style="background:${corCand(u.venc22)}"></i>${esc(NOME_EXIBE(u.venc22))}</span>`},
  {t: "Vencedor 26", k: "venc26", f: u => `<span class="venc"><i style="background:${corCand(u.venc26)}"></i>${esc(NOME_EXIBE(u.venc26))}</span>${u.virou ? '<span class="virou">virou</span>' : ""}`},
  {t: "Abstenção 22", k: "abst22", f: u => pct(u.abst22)}, {t: "Abstenção 26", k: "abst26", f: u => pct(u.abst26)},
  {t: "Brancos+nulos 26", k: "bn26", f: u => pct(u.bn26)},
  {t: "Federal + votado 26", k: "f26n", f: u => celTop(u.f26)}, {t: "Estadual + votado 26", k: "e26n", f: u => celTop(u.e26)},
  {t: "Federal + votado 22", k: "f22n", f: u => celTop(u.f22)}, {t: "Estadual + votado 22", k: "e22n", f: u => celTop(u.e22)},
].concat(E.deps.flatMap((s, j) => [{t: `${s.d.nome} ${s.d.ano}: votos`, k: "dv" + j, cor: s.cor, f: u => int(u["dv" + j])}, {t: `${s.d.nome} ${s.d.ano}: %`, k: "dp" + j, cor: s.cor, f: u => pct(u["dp" + j], 2)}]));
function tabela() {
  const cols = COLS(), linhas = E.unidades.filter(u => !filtroTab || semAc(u.nome).includes(filtroTab))
    .sort((a, b) => { const x = a[ord.k], y = b[ord.k]; return (typeof x === "string" ? x.localeCompare(y) : ((x ?? -1e9) - (y ?? -1e9))) * ord.dir; });
  $("#tabela").innerHTML = `<table><thead><tr>${cols.map(c => `<th data-k="${c.k}" ${c.cor ? `style="box-shadow:inset 0 -3px 0 ${c.cor}"` : ""} ${c.k === ord.k ? `aria-sort="${ord.dir < 0 ? "descending" : "ascending"}"` : ""}>${esc(c.t)}</th>`).join("")}</tr></thead>
    <tbody>${linhas.map(u => `<tr data-ch="${esc(u.chave)}">${cols.map(c => `<td>${c.f(u)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  $("#tabTitulo").textContent = `Tabela · ${NIVEIS[E.nivel]} (${int(E.unidades.length)})`;
  const viraram = E.unidades.filter(u => u.virou).length;
  $("#tabNota").innerHTML = E.nivel === "mg" ? "Escolha um recorte em <b>Ver por</b> para listar cidades, zonas ou regiões." : `<b>${int(viraram)} de ${int(E.unidades.length)}</b> mudaram de lado entre o ${E.turno === "1" ? "1º" : "2º"} turno de 2022 e 2026.`;
}
$("#tabela").addEventListener("click", e => {
  const th = e.target.closest("th[data-k]");
  if (th) { if (ord.k === th.dataset.k) ord.dir = -ord.dir; else ord = {k: th.dataset.k, dir: -1}; return tabela(); }
  const tr = e.target.closest("tr[data-ch]"); if (tr) abrir(E.nivel, tr.dataset.ch);
});
$("#qTab").addEventListener("input", e => { filtroTab = semAc(e.target.value); tabela(); });
$("#csv").addEventListener("click", () => {
  const cols = COLS(), txt = c => String(c).replace(/<[^>]+>/g, "").replace(/"/g, '""');
  const linhas = [cols.map(c => `"${txt(c.t)}"`).join(";")].concat(E.unidades.map(u => cols.map(c => `"${txt(c.f(u))}"`).join(";")));
  Object.assign(document.createElement("a"), {href: URL.createObjectURL(new Blob(["﻿" + linhas.join("\n")], {type: "text/csv"})), download: `presidente-mg-${E.nivel}.csv`}).click();
});

/* ---------------- mapa grande */
function novoMapa(id) {
  const m = L.map(id, {scrollWheelZoom: false, zoomSnap: .25, preferCanvas: true});
  L.tileLayer("https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {attribution: "Esri · IBGE · TSE", maxZoom: 14}).addTo(m);
  m.on("click focus", () => m.scrollWheelZoom.enable());
  m.setView([-18.6, -44.6], 6);
  // o mapa pode nascer escondido (aba fechada); reenquadra quando ganhar tamanho
  let larg = 0;
  new ResizeObserver(() => { const w = $("#" + id).clientWidth; if (w && Math.abs(w - larg) > 40) { larg = w; m.invalidateSize(); const alvo = m._alvo || m._limites; if (alvo) m.fitBounds(alvo); } }).observe($("#" + id));
  return m;
}
// ---- explorador: clicar numa região dá zoom nela e mostra só as cidades dela; trilha para voltar
const PAI = {mi: "me", rm: "ri"};
const FILHO = {me: "mi", ri: "rm"};
function paiDe(nivel, chave) { const p = PAI[nivel]; if (!p) return null; const u = unidade(nivel, chave); const m = u && E.B.municipios[u.mzs[0].split("-")[0]]; return m ? {nivel: p, chave: m[p]} : null; }
function focar(nivel, chave, irPara = true) {
  if (nivel && nivel !== "zona" && nivel !== "mun" && E.nivel !== nivel && !(PAI[nivel] && E.nivel === PAI[nivel])) { E.nivel = nivel; segNivel(); E.unidades = agrupar(E.nivel); }
  if (nivel === "zona" && E.nivel !== "zona") { E.nivel = "zona"; segNivel(); E.unidades = agrupar("zona"); }
  E.foco = nivel ? {nivel, chave} : null; E.voar = true;
  fecharPop();
  if (irPara && E.aba !== "mapa") irAba("mapa"); else desenharMapa();
}
document.addEventListener("click", e => {
  if (e.target.closest("[data-pop]") || e.target.closest("[data-abrir]")) return;
  const f = e.target.closest("[data-focar]"); if (!f) return;
  const v = f.dataset.focar; if (!v) return focar(null);
  const [n, ...c] = v.split("|"); focar(n, c.join("|"));
});
document.addEventListener("keydown", e => { const f = e.target.closest?.("[data-focar]"); if (f && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); f.click(); } });
function migalhas() {
  const f = E.foco, partes = [`<button data-focar="" class="${f ? "" : "atual"}">Minas Gerais</button>`];
  if (f) { const pai = paiDe(f.nivel, f.chave); if (pai) { const up = unidade(pai.nivel, pai.chave); partes.push(`<button data-focar="${pai.nivel}|${esc(pai.chave)}">${esc(up?.nome || pai.chave)}</button>`); }
    const u = unidade(f.nivel, f.chave); partes.push(`<button class="atual" data-focar="${f.nivel}|${esc(f.chave)}"><small>${NIVEL1[f.nivel]}</small> ${esc(u?.nome || "")}</button>`); }
  $("#migalhas").innerHTML = partes.join('<span class="sep" aria-hidden="true">›</span>') + (f ? `<button class="voltar" data-focar="${(() => { const p = paiDe(f.nivel, f.chave); return p ? `${p.nivel}|${esc(p.chave)}` : ""; })()}">← Voltar</button>` : "");
  // atalhos: todas as regiões do recorte atual, para ir direto
  const nv = f ? (FILHO[f.nivel] || null) : (REGIAO(E.nivel) ? E.nivel : null);
  let lista = nv ? agrupar(nv) : [];
  if (f && nv) { const s = new Set(cidadesDe(unidade(f.nivel, f.chave))); lista = lista.filter(u => s.has(u.mzs[0].split("-")[0])); }
  $("#atalhos").innerHTML = lista.length ? `<span class="rot">${f ? "Dentro daqui" : NIVEIS[nv]}</span>` + lista.slice().sort((a, b) => b.aptos - a.aptos).map(u => `<button data-focar="${u.nivel}|${esc(u.chave)}" class="${E.foco?.chave === u.chave ? "on" : ""}"><i style="background:${corCand(u.venc26)}"></i>${esc(u.nome.replace(/^(Microrregião|Região intermediária|Região imediata) de /, ""))}</button>`).join("") : (!f ? `<span class="nota">Escolha <b>Macrorregiões</b>, <b>Microrregiões</b> ou <b>Regiões</b> em "Ver por" para navegar por elas; toque numa região no mapa para dar zoom.</span>` : "");
}
function desenharMapa() {
  if (E.aba !== "mapa") return;
  if (!E.mapa) E.mapa = novoMapa("mapa");
  const pane = E.mapa.getPanes().overlayPane;
  pane.classList.add("trocando");
  if (E.camada) E.camada.remove();
  E.modo = validaModo(E.modo); botoesModo("#modoMapa", E.modo);
  const foco = E.foco && unidade(E.foco.nivel, E.foco.chave);
  if (E.foco && !foco) E.foco = null;
  // cor de cada município: a da unidade que o contém (região) ou a da própria cidade
  const unidadeDe = new Map();
  const nivelMapa = E.nivel === "mg" || E.nivel === "zona" ? "mun" : E.nivel;
  const lista = agrupar(nivelMapa);
  for (const u of lista) for (const k of u.mzs) unidadeDe.set(k.split("-")[0], u);
  const cidMap = new Map(agrupar("mun").map(c => [c.chave, c]));
  // dentro do foco: cada cidade com o próprio resultado (numa zona, a parte da cidade que fica nela)
  const dentro = new Map();
  if (foco) {
    if (E.foco.nivel === "zona") for (const k of foco.mzs) { const m = k.split("-")[0]; dentro.set(m, Object.assign(somar([k]), {nome: `${E.B.municipios[m]?.nome} (Zona ${E.foco.chave})`, nivel: "mun", chave: m}, maisVotados("mun", m), posicoes("mun", m))); }
    else for (const m of cidadesDe(foco)) dentro.set(m, cidMap.get(m));
  }
  const q = quebras(lista.map(u => u[E.modo])), qc = quebras(agrupar("mun").map(c => c[E.modo]));
  const grupo = L.featureGroup(), grupoFoco = L.featureGroup(), regiao = REGIAO(E.nivel);
  L.geoJSON(E.geo, {
    style: f => {
      const m = E.munDe.get(f.properties.ibge), c = dentro.get(m);
      if (c) return {color: "#0b1015", weight: .8, fillOpacity: .95, fillColor: corValor(c, E.modo, qc)};
      const u = unidadeDe.get(m);
      if (foco) return {color: "rgba(255,255,255,.05)", weight: .3, fillOpacity: .12, fillColor: corValor(u, E.modo, q)};
      return {color: regiao ? "rgba(11,16,21,.35)" : "#0b1015", weight: regiao ? .2 : .4, fillOpacity: E.nivel === "zona" ? .25 : .9, fillColor: corValor(u, E.modo, q)};
    },
    onEachFeature: (f, l) => {
      const m = E.munDe.get(f.properties.ibge), c = dentro.get(m);
      if (c) { l.addTo(grupoFoco); l.bindTooltip(dica(c), {sticky: true}); l.on("click", ev => popover("mun", m, ev)); return; }
      const u = unidadeDe.get(m); if (!u) return;
      const vaiFocar = u.nivel !== "mun";
      l.bindTooltip(foco ? `<b>${esc(u.nome)}</b><br><small>${vaiFocar ? "toque para ir até lá" : "toque para ver detalhes"}</small>` : dica(u) + (vaiFocar ? "<br><small style='color:#55b8e6'>toque para dar zoom</small>" : ""), {sticky: true});
      l.on("click", ev => vaiFocar ? focar(u.nivel, u.chave) : popover("mun", u.chave, ev));
    }}).addTo(grupo);
  let listaRank = foco ? [...dentro.values()] : lista;
  if (E.nivel === "zona" && !foco) {
    listaRank = E.unidades;
    const qz = quebras(E.unidades.map(u => u[E.modo])), mx = Math.max(...E.unidades.map(u => u.aptos));
    for (const u of E.unidades) {
      const z = E.B.zonas[u.chave]; if (!z?.lat) continue;
      L.circleMarker([z.lat, z.lng], {radius: 4 + 14 * Math.sqrt(u.aptos / mx), color: "#0b1015", weight: 1, fillOpacity: .9, fillColor: corValor(u, E.modo, qz)})
        .bindTooltip(dica(u) + "<br><small style='color:#55b8e6'>toque para dar zoom</small>", {sticky: true}).on("click", () => focar("zona", u.chave)).addTo(grupo);
    }
  }
  E.camada = grupo.addTo(E.mapa);
  if (!E.mapa._limites) { E.mapa._limites = grupo.getBounds(); if ($("#mapa").clientWidth) E.mapa.fitBounds(E.mapa._limites); }
  if (E.voar) { E.voar = false; const alvo = foco ? grupoFoco.getBounds().pad(.06) : E.mapa._limites; E.mapa._alvo = foco ? alvo : null; if (alvo?.isValid() && $("#mapa").clientWidth) { let foi = false; E.mapa.once("moveend", () => foi = true); E.mapa.flyToBounds(alvo, {duration: .9, easeLinearity: .2}); setTimeout(() => { if (!foi) E.mapa.fitBounds(alvo, {animate: false}); }, 1400); } }
  setTimeout(() => pane.classList.remove("trocando"), 60);
  $("#legenda").innerHTML = legenda(E.modo, foco ? qc : q);
  $("#mapaTitulo").textContent = foco ? foco.nome : E.nivel === "zona" ? "Mapa · zonas eleitorais" : `Mapa · ${NIVEIS[nivelMapa]}`;
  migalhas();
  const painel = $("#ranking");
  painel.classList.remove("entra"); void painel.offsetWidth; painel.classList.add("entra");
  painel.innerHTML = (foco ? painelFoco(foco, [...dentro.values()]) : "") + ranking(listaRank);
}
// resumo do lugar em foco, ao lado do mapa
function painelFoco(u, cidades) {
  const filho = FILHO[E.foco.nivel], subs = filho ? agrupar(filho).filter(x => cidades.some(c => c.chave === x.mzs[0].split("-")[0])) : [];
  const nLula = cidades.filter(c => familia(c.venc26) === "lula").length, vir = cidades.filter(c => c.virou).length;
  const barra = (a, b) => `<div class="duo"><i style="width:${a * 100}%;background:${COR.lula}"></i><i style="width:${b * 100}%;background:${COR.bolso}"></i></div>`;
  return `<div class="foco-cab"><span class="selo mini">${NIVEL1[E.foco.nivel]}</span><h3>${esc(u.nome)}</h3><p class="nota">${int(cidades.length)} ${cidades.length === 1 ? "cidade" : "cidades"} · ${int(u.aptos)} eleitores</p></div>
    <div class="pop-pres"><div><span>2022</span>${barra(u.lula22, u.bol22)}<small>Lula ${pct(u.lula22)} · Jair ${pct(u.bol22)}</small></div><div><span>2026</span>${barra(u.lula26, u.bol26)}<small>Lula ${pct(u.lula26)} · Flávio ${pct(u.bol26)}</small></div></div>
    <div class="rg-chips"><span class="${u.dLula > 0 ? "pos" : "neg"}">Lula ${pp(u.dLula)}</span><span class="${u.dBol > 0 ? "pos" : "neg"}">Bolsonaro ${pp(u.dBol)}</span><span>${int(nLula)} de ${int(cidades.length)} com Lula</span>${vir ? `<span class="am">${int(vir)} viraram</span>` : ""}</div>
    ${u.f26 ? `<div class="rg-top"><span>Mais votados 2026</span>${celTop(u.f26)}${celTop(u.e26)}</div>` : ""}
    ${E.deps.length ? `<div class="rg-deps">${E.deps.map((s, j) => `<span><i style="background:${s.cor}"></i>${esc(s.d.nome)} ${s.d.ano}: <b>${pct(u["dp" + j], 2)}</b> · ${posTxt(u["rk" + j] ?? 99)}</span>`).join("")}</div>` : ""}
    <div class="foco-bts"><button class="btn prim" data-abrir="${E.foco.nivel}|${esc(E.foco.chave)}">Comparativo completo →</button></div>
    ${subs.length ? `<h4 class="sub">${NIVEIS[filho]} <small>toque para dar zoom</small></h4><ol class="rank">${subs.sort((a, b) => b.aptos - a.aptos).map(x => `<li><button data-focar="${x.nivel}|${esc(x.chave)}"><span><i class="pt" style="background:${corCand(x.venc26)}"></i>${esc(x.nome.replace(/^(Microrregião|Região imediata) de /, ""))}</span><b>${int(x.aptos)}</b></button></li>`).join("")}</ol>` : ""}
    <hr class="div">`;
}
function ranking(lista) {
  const m = E.modo, nome = nomeModo(m);
  const item = (u, v) => `<li><button ${u.nivel === "mun" ? `data-pop="mun|${esc(u.chave)}"` : `data-focar="${u.nivel}|${esc(u.chave)}"`}><span>${esc(u.nome)}</span><b>${v}</b></button></li>`;
  const onde = E.foco ? "cidades daqui" : "lugares";
  let html;
  if (POS(m)) {
    const b = corBasePos(m), l = lista.map(u => [u, posDe(u, m)]), tot = lista.reduce((t, u) => t + u.aptos, 0);
    const prim = l.filter(x => x[1] === 1).sort((a, c) => c[0].aptos - a[0].aptos);
    return `<h3 class="h3c">${esc(nome)}</h3><div class="cont">${FAIXAS_POS.map(([r, t], i) => { const lo = i ? FAIXAS_POS[i - 1][0] : 0, g = l.filter(x => x[1] != null && x[1] > lo && x[1] <= (i === 4 ? 1e9 : r)); return `<div class="cont-l"><i style="background:${corPos(i === 4 ? 99 : r, b)}"></i><b>${t}</b><span>${int(g.length)} ${onde} · ${pct(g.reduce((a, x) => a + x[0].aptos, 0) / tot)} dos eleitores</span></div>`; }).join("")}</div>
      <h4 class="sub">Onde foi o mais votado <small>${int(prim.length)}</small></h4><ol class="rank">${prim.slice(0, 40).map(([u]) => item(u, int(u.aptos) + " el.")).join("") || "<li class='nota'>Em nenhum lugar deste recorte.</li>"}</ol>`;
  }
  if (CATEG(m)) {
    const grupos = new Map();
    for (const u of lista) { const k = m === "venc26" ? NOME_EXIBE(u.venc26) : m === "venc22" ? NOME_EXIBE(u.venc22) : m === "virou" ? (u.virou ? "Mudou de lado" : "Manteve") : (u.melhor >= 0 ? `${E.deps[u.melhor].d.nome} ${E.deps[u.melhor].d.ano}` : "–"); const g = grupos.get(k) || {n: 0, el: 0, cor: corValor(u, m, [])}; g.n++; g.el += u.aptos; grupos.set(k, g); }
    const tot = lista.reduce((t, u) => t + u.aptos, 0);
    html = `<h3 class="h3c">${esc(nome)}</h3><div class="cont">${[...grupos.entries()].sort((a, b) => b[1].n - a[1].n).map(([k, g]) => `<div class="cont-l"><i style="background:${g.cor}"></i><b>${esc(k)}</b><span>${int(g.n)} ${onde} · ${pct(g.el / tot)} dos eleitores</span></div>`).join("")}</div>`;
    if (m === "virou") { const v = lista.filter(u => u.virou).sort((a, b) => b.aptos - a.aptos).slice(0, 12); html += `<h4 class="sub">Maiores que mudaram de lado</h4><ol class="rank">${v.map(u => item(u, `${esc(NOME_EXIBE(u.venc22))} → ${esc(NOME_EXIBE(u.venc26))}`)).join("")}</ol>`; }
    else { const g = lista.slice().sort((a, b) => b.aptos - a.aptos).slice(0, 12); html += `<h4 class="sub">Maiores eleitorados</h4><ol class="rank">${g.map(u => item(u, `<span class="venc"><i style="background:${corValor(u, m, [])}"></i></span>${m === "venc22" ? pct(Math.max(u.lula22, u.bol22)) : pct(Math.max(u.lula26, u.bol26))}`)).join("")}</ol>`; }
    return html;
  }
  const v = lista.filter(u => u[m] != null && isFinite(u[m])), alto = v.slice().sort((a, b) => b[m] - a[m]).slice(0, 10), baixo = v.slice().sort((a, b) => a[m] - b[m]).slice(0, 10);
  return `<h3 class="h3c">${esc(nome)}</h3><h4 class="sub">Maiores</h4><ol class="rank">${alto.map(u => item(u, fmtModo(m, u[m]))).join("")}</ol><h4 class="sub">Menores</h4><ol class="rank">${baixo.map(u => item(u, fmtModo(m, u[m]))).join("")}</ol>`;
}
$("#modoMapa").addEventListener("click", e => { const b = e.target.closest("[data-m]"); if (b) { E.modo = b.dataset.m; desenharMapa(); } });

/* ---------------- quadro flutuante ao clicar num lugar dos mapas */
function popover(nivel, chave, ev) {
  const u = unidade(nivel, chave); if (!u) return;
  const oe = ev?.originalEvent || ev, x = oe?.clientX ?? innerWidth / 2, y = oe?.clientY ?? innerHeight / 2;
  const g = E.top[nivel === "mg" ? "mg" : `${nivel}:${chave}`] || {};
  const lista = (k, n = 3) => (g[k] || []).slice(0, n).map(([i, q]) => { const d = E.B.deputados[i], sel = E.deps.some(s => s.d.id === d.id);
    return `<li><button data-dep="${i}" class="${sel ? "sel" : ""}" title="Adicionar ao comparativo">${avatar(d.foto, d.nome, "#2a333d", "av-m")}<span>${esc(d.nome)} <small>${esc(d.partido)}</small></span><b>${int(q)}</b><i class="mais">${sel ? "✓" : "+"}</i></button></li>`; }).join("") || "<li class='nota'>–</li>";
  const pop = $("#pop");
  pop.innerHTML = `<button class="fechar" aria-label="Fechar">×</button>
    <span class="selo mini">${NIVEL1[nivel]}</span><h3>${esc(u.nome)}</h3>
    <p class="nota">${int(u.aptos)} eleitores${u.virou ? ' · <b style="color:#fab219">mudou de lado</b>' : ""}</p>
    <div class="pop-pres">
      <div><span>2022</span><div class="duo"><i style="width:${u.lula22 * 100}%;background:${COR.lula}"></i><i style="width:${u.bol22 * 100}%;background:${COR.bolso}"></i></div><small>Lula ${pct(u.lula22)} · Jair ${pct(u.bol22)}</small></div>
      <div><span>2026</span><div class="duo"><i style="width:${u.lula26 * 100}%;background:${COR.lula}"></i><i style="width:${u.bol26 * 100}%;background:${COR.bolso}"></i></div><small>Lula ${pct(u.lula26)} · Flávio ${pct(u.bol26)}</small></div>
    </div>
    <div class="rg-chips"><span class="${u.dLula > 0 ? "pos" : "neg"}">Lula ${pp(u.dLula)}</span><span class="${u.dBol > 0 ? "pos" : "neg"}">Bolsonaro ${pp(u.dBol)}</span><span>Abstenção ${pct(u.abst26)}</span></div>
    ${E.deps.length ? `<div class="rg-deps">${E.deps.map((s, j) => `<span><i style="background:${s.cor}"></i>${esc(s.d.nome)} ${s.d.ano}: <b>${int(u["dv" + j])}</b> votos (${pct(u["dp" + j], 2)}) · ${u["rk" + j] === 1 ? "<b>1º, o mais votado</b>" : u["rk" + j] < 99 ? `<b>${u["rk" + j]}º</b>` : "abaixo do 20º"}</span>`).join("")}</div>` : ""}
    <div class="pop-tops">
      <div><h4>Federal 2026</h4><ol class="top">${lista("6-26")}</ol></div><div><h4>Estadual 2026</h4><ol class="top">${lista("7-26")}</ol></div>
      <div><h4>Federal 2022</h4><ol class="top">${lista("6-22")}</ol></div><div><h4>Estadual 2022</h4><ol class="top">${lista("7-22")}</ol></div>
    </div>
    <button class="btn prim" data-abrir="${nivel}|${esc(chave)}">Ver tudo sobre ${esc(u.nome)} →</button>`;
  pop.hidden = false;
  const w = pop.offsetWidth, h = pop.offsetHeight;
  pop.style.left = Math.max(8, Math.min(innerWidth - w - 8, x + 14)) + "px";
  pop.style.top = Math.max(8, Math.min(innerHeight - h - 8, y - 20)) + "px";
  E.popT = Date.now();
}
const fecharPop = () => { $("#pop").hidden = true; };
document.addEventListener("click", e => {
  const p = e.target.closest("[data-pop]");
  if (p) { const [n, ...c] = p.dataset.pop.split("|"); popover(n, c.join("|"), e); return; }
  if (e.target.closest("#pop .fechar")) return fecharPop();
  if (!e.target.closest("#pop") && Date.now() - (E.popT || 0) > 80) fecharPop();
  if (e.target.closest("#pop [data-abrir]")) fecharPop();
}, true);
document.addEventListener("keydown", e => { if (e.key === "Escape") fecharPop(); });

/* ---------------- lugar escolhido: mapa ampliado, comparativo, mais votados */
function tabelaSub(titulo, rot, lista, nivelSub) {
  if (lista.length < 2) return "";
  return `<h4 class="sub">${esc(titulo)} <small>${lista.length} · clique para abrir</small></h4><div class="tab-wrap" style="max-height:420px"><table><thead><tr><th>${rot}</th><th>Eleitores</th><th>Lula 22</th><th>Lula 26</th><th>Δ Lula</th><th>Jair 22</th><th>Flávio 26</th><th>Δ Bolsonaro</th><th>Vencedor 26</th><th>Federal + votado 26</th><th>Estadual + votado 26</th>${E.deps.map(s => `<th style="box-shadow:inset 0 -3px 0 ${s.cor}">${esc(s.d.nome)} ${s.d.ano}</th>`).join("")}</tr></thead>
    <tbody>${lista.sort((a, b) => b.aptos - a.aptos).map(c => `<tr ${nivelSub ? `data-abrir="${nivelSub}|${esc(c.chave)}"` : ""}><td><b>${esc(c.nome)}</b></td><td>${int(c.aptos)}</td><td>${pct(c.lula22)}</td><td>${pct(c.lula26)}</td><td class="${c.dLula > 0 ? "pos" : "neg"}">${pp(c.dLula)}</td><td>${pct(c.bol22)}</td><td>${pct(c.bol26)}</td><td class="${c.dBol > 0 ? "pos" : "neg"}">${pp(c.dBol)}</td><td><span class="venc"><i style="background:${corCand(c.venc26)}"></i>${esc(NOME_EXIBE(c.venc26))}</span>${c.virou ? '<span class="virou">virou</span>' : ""}</td><td>${celTop(c.f26)}</td><td>${celTop(c.e26)}</td>${E.deps.map((s, j) => `<td>${int(c["dv" + j])} <small class="nota">${pct(c["dp" + j], 2)}</small></td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
async function topDeps(id, alvo, titulo) {
  const g = E.top[id]; if (!g) { alvo.innerHTML = ""; return; }
  const ano = E.topAno;
  const col = (cg, t) => `<div class="card"><h4 class="sub" style="margin-top:0">${t} · 20${ano}</h4><ol class="top">${(g[`${cg}-${ano}`] || []).slice(0, 15).map(([i, q]) => {
    const d = E.B.deputados[i], sel = E.deps.some(s => s.d.id === d.id);
    return `<li><button data-dep="${i}" class="${sel ? "sel" : ""}" title="${sel ? "Já está no comparativo" : "Adicionar ao comparativo de deputados"}">${avatar(d.foto, d.nome, "#2a333d", "av-p")}<span>${esc(d.nome)} <small>${logo(d.partido)}${esc(d.partido)}${d.eleito ? " · <em>eleito(a)</em>" : ""}</small></span><b>${int(q)}</b><i class="mais">${sel ? "✓" : "+"}</i></button></li>`;
  }).join("")}</ol></div>`;
  alvo.innerHTML = `<div class="sub-cab"><h4 class="sub">${esc(titulo)} <small>toque no + para comparar</small></h4><div class="seg anoTop" role="group" aria-label="Ano"><button data-ano="26" aria-pressed="${ano === "26"}">2026</button><button data-ano="22" aria-pressed="${ano === "22"}">2022</button></div></div><div class="grid2">${col(6, "Deputado federal")}${col(7, "Deputado estadual")}</div>`;
  alvo.dataset.id = id; alvo.dataset.titulo = titulo;
}
function recarregarTops() { $$("[data-id]").forEach(el => topDeps(el.dataset.id, el, el.dataset.titulo)); }
document.addEventListener("click", e => {
  const a = e.target.closest(".anoTop [data-ano]"); if (a) { E.topAno = a.dataset.ano; recarregarTops(); return; }
  const b = e.target.closest("[data-dep]"); if (b) { const d = E.B.deputados[+b.dataset.dep]; if (!E.deps.some(s => s.d.id === d.id)) escolherDep(d, false); }
});
function abrir(nivel, chave) {
  const u = unidade(nivel, chave); if (!u) return;
  E.sel = {nivel, chave};
  $("#abaLugar").hidden = false; $("#abaLugarNome").textContent = u.nome.length > 26 ? u.nome.slice(0, 25) + "…" : u.nome; $("#abaLugarTipo").textContent = NIVEL1[nivel].toLowerCase();
  $("#detTipo").textContent = NIVEL1[nivel];
  $("#detTitulo").textContent = u.nome;
  const muns = cidadesDe(u), B = E.B;
  const partes = [nivel !== "mun" && nivel !== "mg" ? `${int(muns.length)} ${muns.length === 1 ? "cidade" : "cidades"}` : "", `${int(u.aptos)} eleitores`,
    nivel === "mun" ? `${B.municipios[chave]?.me} · ${B.municipios[chave]?.mi ? "Microrregião de " + B.municipios[chave].mi : ""}` : "",
    nivel === "mun" && u.mzs.length > 1 ? `${u.mzs.length} zonas eleitorais` : ""].filter(Boolean);
  $("#detSub").textContent = partes.join(" · ");
  const box = document.createElement("div"); quadro(u, box);
  let extra = "";
  if (nivel === "mun") extra = tabelaSub("Zonas eleitorais da cidade", "Zona", u.mzs.map(k => Object.assign(somar([k]), {chave: k.split("-")[1], nome: `Zona ${k.split("-")[1]}`}, maisVotados("zona", k.split("-")[1]))), "zona");
  else if (nivel === "zona") extra = tabelaSub("Cidades da zona", "Cidade", u.mzs.map(k => Object.assign(somar([k]), {chave: k.split("-")[0], nome: B.municipios[k.split("-")[0]]?.nome || k}, maisVotados("mun", k.split("-")[0]))), "mun");
  else { const s = new Set(u.mzs); extra = tabelaSub(nivel === "mg" ? "Todas as cidades" : "Cidades", "Cidade", agrupar("mun").filter(c => c.mzs.some(k => s.has(k))), "mun"); }
  if (nivel === "me") { const s = new Set(muns); extra = tabelaSub("Microrregiões", "Microrregião", agrupar("mi").filter(c => s.has(c.mzs[0].split("-")[0])), "mi") + extra; }
  const dep = E.deps.length ? `<h4 class="sub">Deputados escolhidos neste lugar</h4><div class="kpis">${E.deps.map((s, j) => `<div class="card dep-kpi" style="--cor:${s.cor}">${avatar(s.d.foto, s.d.nome, s.cor, "av-p")}<div><b>${int(u["dv" + j])}</b><span>votos de ${esc(s.d.nome)} (${s.d.ano}) · ${pct(u["dp" + j], 2)} dos válidos · ${pct(u["dv" + j] / s.total, 1)} de tudo que teve em MG</span></div></div>`).join("")}</div>` : "";
  $("#detCorpo").innerHTML = ""; $("#detCorpo").append(box); $("#detCorpo").insertAdjacentHTML("beforeend", dep + '<div id="detTop"></div>' + extra);
  topDeps(nivel === "mg" ? "mg" : `${nivel}:${chave}`, $("#detTop"), `Deputados mais votados em ${u.nome}`);
  if (E.detMapa) E.detMapa._limites = null;
  irAba("lugar");
}
function desenharDetMapa() {
  if (!E.sel) return;
  const {nivel, chave} = E.sel, u = unidade(nivel, chave); if (!u) return;
  if (!E.detMapa) E.detMapa = novoMapa("detMapa");
  if (E.detCamada) E.detCamada.remove();
  E.detModo = validaModo(E.detModo); botoesModo("#detModo", E.detModo);
  const B = E.B, muns = new Set(cidadesDe(u));
  // cada cidade do lugar com o próprio resultado; numa zona, a parte da cidade que fica na zona
  const porM = new Map();
  if (nivel === "zona") for (const k of u.mzs) porM.set(k.split("-")[0], Object.assign(somar([k]), {nome: `${B.municipios[k.split("-")[0]]?.nome} (Zona ${chave})`}, maisVotados("mun", k.split("-")[0])));
  else for (const c of agrupar("mun")) if (muns.has(c.chave)) porM.set(c.chave, c);
  const porIbge = new Map([...porM].map(([m, c]) => [ibgeDe(m), c]));
  const lista = [...porM.values()], q = quebras(agrupar("mun").map(c => c[E.detModo]));
  const grupo = L.featureGroup(), foco = L.featureGroup();
  L.geoJSON(E.geo, {style: f => { const c = porIbge.get(f.properties.ibge); return c ? {color: "#0b1015", weight: .8, fillOpacity: .92, fillColor: corValor(c, E.detModo, q)} : {color: "rgba(255,255,255,.08)", weight: .3, fillOpacity: .05, fillColor: "#9aa6b2"}; },
    onEachFeature: (f, l) => { const c = porIbge.get(f.properties.ibge); if (!c) return; l.addTo(foco); l.bindTooltip(dica(c), {sticky: true}); l.on("click", ev => popover("mun", [...porM].find(([m]) => ibgeDe(m) === f.properties.ibge)[0], ev)); }}).addTo(grupo);
  // cidade com várias zonas: um círculo por zona
  if (nivel === "mun" && u.mzs.length > 1) {
    const zs = u.mzs.map(k => Object.assign(somar([k]), {nome: `Zona ${k.split("-")[1]}`, z: k.split("-")[1]})), mx = Math.max(...zs.map(z => z.aptos)), qz = quebras(zs.map(z => z[E.detModo]));
    for (const z of zs) { const p = B.zonas[z.z]; if (!p?.lat) continue; L.circleMarker([p.lat, p.lng], {radius: 7 + 16 * Math.sqrt(z.aptos / mx), color: "#0b1015", weight: 1.2, fillOpacity: .95, fillColor: corValor(z, E.detModo, CATEG(E.detModo) ? q : qz)}).bindTooltip(dica(z), {sticky: true}).on("click", ev => popover("zona", z.z, ev)).addTo(grupo); }
  }
  E.detCamada = grupo.addTo(E.detMapa);
  const lim = foco.getBounds();
  if (lim.isValid() && !E.detMapa._limites) { E.detMapa._limites = lim.pad(.08); if ($("#detMapa").clientWidth) E.detMapa.fitBounds(E.detMapa._limites); }
  $("#detLegenda").innerHTML = legenda(E.detModo, q) + (nivel === "mun" && u.mzs.length > 1 ? `<span class="nota">Círculos: as ${u.mzs.length} zonas eleitorais da cidade.</span>` : "");
}
$("#detModo").addEventListener("click", e => { const b = e.target.closest("[data-m]"); if (b) { E.detModo = b.dataset.m; desenharDetMapa(); } });

/* ---------------- deputados: entre si e com o Presidente */
function correl(xs, ys, ws) {
  let sw = 0, mx = 0, my = 0; for (let i = 0; i < xs.length; i++) { sw += ws[i]; mx += ws[i] * xs[i]; my += ws[i] * ys[i]; }
  mx /= sw; my /= sw; let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += ws[i] * dx * dy; sxx += ws[i] * dx * dx; syy += ws[i] * dy * dy; }
  return sxy / Math.sqrt(sxx * syy);
}
const leituraR = r => Math.abs(r) < .15 ? "quase nenhuma relação" : Math.abs(r) < .4 ? (r > 0 ? "relação positiva fraca" : "relação negativa fraca") : Math.abs(r) < .7 ? (r > 0 ? "relação positiva moderada" : "relação negativa moderada") : (r > 0 ? "relação positiva forte" : "relação negativa forte");
function chips() {
  $("#chips").innerHTML = E.deps.length ? E.deps.map((s, j) => {
    const par = s.d.par && E.B.deputados.find(x => x.id === s.d.par), parSel = par && E.deps.some(t => t.d.id === par.id);
    return `<span class="chip-dep" style="--cor:${s.cor}">${avatar(s.d.foto, s.d.nome, s.cor, "av-c")}<span><b>${esc(s.d.nome)}</b><small>${esc(s.d.partido)} · ${cargoNome(s.d.cargo)} 20${s.d.ano}</small></span>
      ${par && !parSel ? `<button class="par" data-par="${E.B.deputados.indexOf(par)}" title="Adicionar a mesma pessoa em 20${par.ano}">+ 20${par.ano}</button>` : ""}<button class="x" data-tirar="${j}" aria-label="Remover ${esc(s.d.nome)}">×</button></span>`;
  }).join("") : `<span class="nota">Nenhum deputado escolhido. Sugestões: ${sugestoes()}</span>`;
  $("#nDeps").hidden = !E.deps.length; $("#nDeps").textContent = E.deps.length;
}
function sugestoes() {
  const D = E.B.deputados, f26 = D.find(d => d.ano === 26 && d.cargo === 6), e26 = D.find(d => d.ano === 26 && d.cargo === 7), comPar = D.find(d => d.ano === 26 && d.par);
  return [[`${f26.nome} × ${e26.nome}`, [f26, e26]], comPar ? [`${comPar.nome}: 2022 × 2026`, [comPar, D.find(x => x.id === comPar.par)]] : null,
    ["Os 4 federais mais votados de 2026", D.filter(d => d.ano === 26 && d.cargo === 6).slice(0, 4)]].filter(Boolean)
    .map(([t, l]) => `<button class="sug" data-sug="${l.map(d => D.indexOf(d)).join(",")}">${esc(t)}</button>`).join(" ");
}
$("#chips").addEventListener("click", async e => {
  const x = e.target.closest("[data-tirar]"); if (x) { E.deps.splice(+x.dataset.tirar, 1); E.deps.forEach((s, j) => s.cor = CORES_DEP[j]); return atualizarDeps(); }
  const p = e.target.closest("[data-par]"); if (p) return escolherDep(E.B.deputados[+p.dataset.par]);
  const s = e.target.closest("[data-sug]"); if (s) { E.deps = []; for (const i of s.dataset.sug.split(",")) await escolherDep(E.B.deputados[+i], false, true); atualizarDeps(); }
});
async function escolherDep(d, irPara = true, silencioso = false) {
  if (E.deps.some(s => s.d.id === d.id)) return;
  if (E.deps.length >= 4) { toast("Já há 4 deputados no comparativo. Remova um para adicionar outro."); return; }
  const votos = await fetch(`dados/dep/${d.id}.json`).then(r => r.json());
  E.deps.push({d, i: E.B.deputados.indexOf(d), votos, total: Object.values(votos).reduce((t, x) => t + x, 0), cor: CORES_DEP[E.deps.length]});
  if (silencioso) return;
  E.modo = E.galModo = E.detModo = "rk" + (E.deps.length - 1);
  atualizarDeps();
  if (irPara) irAba("deps");
  else toast(`<b>${esc(d.nome)}</b> (${d.ano}) entrou no comparativo · <a href="#deps" data-ir="deps">ver deputados</a> · <a href="#mesc" data-ir="mesc">cruzar com Presidente</a>`);
}
function atualizarDeps() {
  chips(); recalcular(); renderDepsAtual();
  if (E.sel) { const y = scrollY, aba = E.aba; abrir(E.sel.nivel, E.sel.chave); if (aba !== "lugar") irAba(aba, false); scrollTo({top: y}); }
  recarregarTops();
}
const NIV_MV = [["mun", "cidades"], ["zona", "zonas"], ["mi", "microrregiões"], ["me", "macrorregiões"], ["rm", "regiões imediatas"], ["ri", "regiões intermediárias"]];
const posTxt = r => r === 1 ? "1º · mais votado" : r < 99 ? r + "º" : "abaixo do 20º";
function vazioDeps() { return `<div class="vazio card"><b>Escolha um deputado no quadro acima</b><span>Digite o nome ou use uma sugestão. Também dá para tocar no <b>+</b> ao lado de qualquer nome nas listas de mais votados, em qualquer aba.</span></div>`; }
function mapaDep(j, pint, cid, cls = "mini-mapa grande") {
  const s = E.deps[j], mk = pint + j, q = quebras(cid.map(c => c["dp" + j]));
  return {svg: miniSvg(cid.map(c => ({ibge: ibgeDe(c.chave), pop: `mun|${c.chave}`, cor: corValor(c, mk, q), titulo: `${c.nome}: ${int(c["dv" + j])} votos · ${pct(c["dp" + j], 2)} · ${posTxt(c["rk" + j])}`})), cls), leg: legenda(mk, q)};
}
const segPint = id => { const p = E.depPint || "rk"; return `<div class="seg" data-pint role="group" aria-label="Pintar o mapa por"><button data-dp="rk" aria-pressed="${p === "rk"}">Onde foi o mais votado</button><button data-dp="dp" aria-pressed="${p === "dp"}">% dos válidos</button></div>`; };
document.addEventListener("click", e => { const c = e.target.closest("[data-pint] [data-dp], #depPint [data-dp]"); if (c) { E.depPint = c.dataset.dp; renderDepsAtual(); } });

function renderDeps() {
  const n = E.deps.length;
  $("#depTitulo").textContent = n === 1 ? "Perfil do deputado" : n ? `Comparando ${n} deputados` : "Deputados";
  $("#depSub").innerHTML = n === 1 ? "Tudo sobre a votação dele(a) em Minas. Escolha mais um no quadro acima para comparar lado a lado." : n ? "Lado a lado: votos, onde cada um foi o mais votado e onde cada um foi melhor. Veja também a aba <b>Por região</b> e o modo <b>Presidente × Deputados</b>." : "";
  if (!n) { $("#depCorpo").innerHTML = vazioDeps(); return; }
  const cid = agrupar("mun"), pint = E.depPint || "rk";
  if (n === 1) { $("#depCorpo").innerHTML = heroDep(0, cid, pint); return; }
  // vários: cartões compactos, pares e mapas lado a lado
  const cards = E.deps.map((s, j) => {
    const d = s.d, mv = NIV_MV.slice(0, 4).map(([k, nm]) => { const l = agrupar(k); return `<b>${int(l.filter(u => u["rk" + j] === 1).length)}<small> ${nm}</small></b>`; }).join("");
    return `<div class="card dep-card" style="--cor:${s.cor}">
      <div class="dep-top">${avatar(d.foto, d.nome, s.cor, "av-g")}<div><h3>${esc(d.nome)}</h3><p>${logo(d.partido)}${esc(d.partido)} · ${cargoNome(d.cargo)} 20${d.ano}</p><span class="sit ${d.eleito ? "ok" : ""}">${esc(d.situacao || "")}</span></div></div>
      <div class="dep-num"><div><b>${int(d.votos)}</b><span>votos em MG</span></div><div><b>${pct(d.votos / Object.values(validos(d)).reduce((t, x) => t + x, 0), 2)}</b><span>dos válidos</span></div></div>
      <div class="mv"><span>Mais votado em</span>${mv}</div></div>`;
  }).join("");
  const cids = cid.filter(c => c.t26 > 0), ws = cids.map(c => c.aptos), linhas = [];
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    const A = E.deps[a], Bd = E.deps[b], rr = correl(cids.map(c => c["dp" + a] ?? 0), cids.map(c => c["dp" + b] ?? 0), ws);
    const ganhaA = cids.filter(c => (c["dp" + a] ?? 0) > (c["dp" + b] ?? 0)).length, mesma = A.d.par === Bd.d.id;
    linhas.push(`<div class="par-linha"><span class="pts"><i style="background:${A.cor}"></i><i style="background:${Bd.cor}"></i></span><div><b>${esc(A.d.nome)} ${A.d.ano} × ${esc(Bd.d.nome)} ${Bd.d.ano}</b>${mesma ? ' <span class="selo mini">mesma pessoa</span>' : ""}
      <span>correlação <b>${dec(rr)}</b> (${leituraR(rr)}) · ${esc(A.d.nome)} ${A.d.ano} tem % maior em <b>${int(ganhaA)}</b> cidades e ${esc(Bd.d.nome)} ${Bd.d.ano} em <b>${int(cids.length - ganhaA)}</b>${mesma ? ` · votos: ${int(A.d.votos)} → ${int(Bd.d.votos)} (${pct(Bd.d.votos / A.d.votos - 1)})` : ""}</span></div></div>`);
  }
  const mapas = E.deps.map((s, j) => { const m = mapaDep(j, pint, cid); return `<div class="card"><h3 class="h3c"><i class="pt" style="background:${s.cor}"></i>${esc(s.d.nome)} ${s.d.ano}</h3>${m.svg}<div class="legenda">${m.leg}</div></div>`; }).join("")
    + `<div class="card"><h3 class="h3c">Qual foi melhor em cada cidade</h3>${miniSvg(cid.map(c => ({ibge: ibgeDe(c.chave), pop: `mun|${c.chave}`, cor: corValor(c, "melhor", []), titulo: c.nome})), "mini-mapa grande")}<div class="legenda">${legenda("melhor", [])}</div></div>`;
  $("#depCorpo").innerHTML = `<div class="dep-cards n${n}">${cards}</div>
    <div class="card pares"><h3 class="h3c">Deputado × deputado</h3><p class="nota">Correlação perto de +1: são fortes nos mesmos lugares. Perto de −1: onde um é forte, o outro é fraco.</p>${linhas.join("")}</div>
    <div class="linha-ctl" style="margin-top:16px"><span class="rot">Mapas</span>${segPint()}</div>
    <div class="dep-mapas n${n}">${mapas}</div>`;
}
// um deputado só: perfil em tela cheia
function heroDep(j, cid, pint) {
  const s = E.deps[j], d = s.d, par = d.par && E.B.deputados.find(x => x.id === d.par);
  const totVal = Object.values(validos(d)).reduce((t, x) => t + x, 0);
  const mv = NIV_MV.map(([k, nm]) => { const l = agrupar(k), v = l.filter(u => u["rk" + j] === 1).length; return `<div class="hv"><b>${int(v)}</b><span>de ${int(l.length)} ${nm}</span><div class="mini-barra"><i style="width:${v / l.length * 100}%;background:${s.cor}"></i></div></div>`; }).join("");
  const topC = cid.slice().sort((a, b) => b["dv" + j] - a["dv" + j]).slice(0, 12);
  const topR = agrupar("mi").slice().sort((a, b) => (b["dp" + j] ?? 0) - (a["dp" + j] ?? 0)).slice(0, 6);
  const m = mapaDep(j, pint, cid, "mini-mapa hero");
  const mg = agrupar("mg")[0];
  return `<div class="dep-hero card" style="--cor:${s.cor}">
    <div class="hero-esq">
      <div class="hero-id">${avatar(d.foto, d.nome, s.cor, "av-xl")}<div><span class="selo mini">${cargoNome(d.cargo)} · 20${d.ano}</span><h2>${esc(d.nome)}</h2><p>${logo(d.partido)}${esc(d.partido)} · <span class="sit ${d.eleito ? "ok" : ""}">${esc(d.situacao || "")}</span></p></div></div>
      <div class="hero-num"><div><b>${int(d.votos)}</b><span>votos em Minas</span></div><div><b>${pct(d.votos / totVal, 2)}</b><span>dos válidos do cargo</span></div><div><b>${posTxt(mg?.["rk" + j] ?? 99).replace(" · ", "<br><small>") + (mg?.["rk" + j] === 1 ? "</small>" : "")}</b><span>posição em Minas</span></div></div>
      ${par ? `<div class="hero-par"><span>Também concorreu em 20${par.ano} (${cargoNome(par.cargo)}): <b>${int(par.votos)} votos</b> · ${esc(par.situacao || "")} · ${d.ano > par.ano ? (d.votos >= par.votos ? "cresceu " : "caiu ") + pct(Math.abs(d.votos / par.votos - 1)) : ""}</span><button class="btn" data-par="${E.B.deputados.indexOf(par)}">Comparar com 20${par.ano}</button></div>` : ""}
      <h4 class="sub">Onde foi o mais votado</h4><div class="hero-mv">${mv}</div>
      <div class="grid2 hero-listas">
        <div><h4 class="sub">Cidades com mais votos</h4><ol class="rank">${topC.map(c => `<li><button data-pop="mun|${esc(c.chave)}"><span>${esc(c.nome)}</span><b>${int(c["dv" + j])}</b><small class="nota">&nbsp;${pct(c["dp" + j], 1)} · ${c["rk" + j] === 1 ? "1º" : c["rk" + j] < 99 ? c["rk" + j] + "º" : "–"}</small></button></li>`).join("")}</ol></div>
        <div><h4 class="sub">Microrregiões mais fortes</h4><ol class="rank">${topR.map(u => `<li><button data-pop="mi|${esc(u.chave)}"><span>${esc(u.nome.replace("Microrregião de ", ""))}</span><b>${pct(u["dp" + j], 2)}</b><small class="nota">&nbsp;${u["rk" + j] === 1 ? "1º" : u["rk" + j] < 99 ? u["rk" + j] + "º" : "–"}</small></button></li>`).join("")}</ol></div>
      </div>
      <p class="nota" style="margin-top:12px">Para ver como o voto dele(a) se cruza com Lula e Bolsonaro, abra <a href="#mesc" data-ir="mesc">Presidente × Deputados</a>. Para todos os recortes, <a href="#depreg" data-ir="depreg">Por região</a>.</p>
    </div>
    <div class="hero-dir"><div class="linha-ctl"><span class="rot">Mapa</span>${segPint()}</div>${m.svg}<div class="legenda">${m.leg}</div><p class="nota">Toque numa cidade para ver detalhes e os mais votados dela.</p></div>
  </div>`;
}

// Presidente × Deputados: cruzamento com o voto para Presidente do mesmo ano
function renderMesc() {
  E.graficos.forEach(g => g.destroy()); E.graficos = [];
  if (!E.deps.length) { $("#mescCorpo").innerHTML = vazioDeps(); return; }
  const n = E.deps.length, cid = agrupar("mun").filter(c => c.t26 > 0 && c.t22 > 0), ws = cid.map(c => c.aptos), t22 = E.turno === "1" ? "1º turno" : "2º turno";
  const cards = E.deps.map((s, j) => {
    const d = s.d, ys = cid.map(c => c["dp" + j] ?? 0), anoP = d.ano === 26;
    const rL = correl(cid.map(c => anoP ? c.lula26 : c.lula22), ys, ws), rB = correl(cid.map(c => anoP ? c.bol26 : c.bol22), ys, ws), nb = anoP ? "Flávio" : "Jair";
    const lado = Math.abs(rL) < .15 ? "atravessa os dois campos" : rL > 0 ? "é mais forte onde o Lula foi melhor" : `é mais forte onde o ${nb} Bolsonaro foi melhor`;
    // onde foi o mais votado × quem venceu para Presidente ali
    const prim = cid.filter(c => c["rk" + j] === 1), vb = prim.filter(c => familia(anoP ? c.venc26 : c.venc22) === "bolso").length, vl = prim.filter(c => familia(anoP ? c.venc26 : c.venc22) === "lula").length;
    const corX = c => { const f = familia(anoP ? c.venc26 : c.venc22), base = f === "lula" ? COR.lula : f === "bolso" ? COR.bolso : COR.outro; return c["rk" + j] === 1 ? base : mistura(base, .22); };
    const mapa = miniSvg(agrupar("mun").map(c => ({ibge: ibgeDe(c.chave), pop: `mun|${c.chave}`, cor: corX(c), titulo: `${c.nome}: ${d.nome} ${posTxt(c["rk" + j])} · venceu ${NOME_EXIBE(anoP ? c.venc26 : c.venc22)}`})), n === 1 ? "mini-mapa hero" : "mini-mapa grande");
    return `<div class="card mesc-card" style="--cor:${s.cor}">
      <div class="dep-top">${avatar(d.foto, d.nome, s.cor, "av-p")}<div><h3>${esc(d.nome)} <small class="nota">${esc(d.partido)} · ${cargoNome(d.cargo)} 20${d.ano}</small></h3></div></div>
      <div class="dep-num"><div><b>${dec(rL)}</b><span>× Lula ${anoP ? "2026" : "2022 (" + t22 + ")"}</span></div><div><b>${dec(rB)}</b><span>× ${nb} Bolsonaro</span></div><div><b>${int(prim.length)}</b><span>cidades em 1º</span></div></div>
      <p class="leitura">O voto de <b>${esc(d.nome)}</b> ${lado} <span class="nota">(${leituraR(rL)} com o % do Lula)</span>. Nas <b>${int(prim.length)}</b> cidades onde foi o mais votado, o ${nb} Bolsonaro venceu em <b>${int(vb)}</b> e o Lula em <b>${int(vl)}</b>.</p>
      <h4 class="sub" style="margin-top:12px">Onde foi o mais votado × quem venceu para Presidente (20${d.ano})</h4>${mapa}
      <div class="legenda"><span><b style="background:${COR.bolso}"></b>1º lugar e ${nb} venceu</span><span><b style="background:${COR.lula}"></b>1º lugar e Lula venceu</span><span><b style="background:${mistura(COR.bolso, .22)}"></b>não foi 1º · ${nb} venceu</span><span><b style="background:${mistura(COR.lula, .22)}"></b>não foi 1º · Lula venceu</span></div>
    </div>`;
  }).join("");
  const topC = cid.slice().sort((a, b) => E.deps.reduce((t, s, j) => t + (b["dv" + j] || 0), 0) - E.deps.reduce((t, s, j) => t + (a["dv" + j] || 0), 0)).slice(0, 60);
  const tab = `<div class="card" style="margin-top:14px"><h3 class="h3c">Cidades: deputados e Presidente lado a lado <small class="nota">60 com mais votos dos escolhidos · toque para detalhes</small></h3><div class="tab-wrap" style="max-height:480px"><table><thead><tr><th>Cidade</th>${E.deps.map(s => `<th style="box-shadow:inset 0 -3px 0 ${s.cor}">${esc(s.d.nome)} ${s.d.ano}</th><th>%</th><th>Posição</th>`).join("")}<th>Lula 22</th><th>Lula 26</th><th>Jair 22</th><th>Flávio 26</th><th>Vencedor 26</th></tr></thead>
    <tbody>${topC.map(c => `<tr data-pop="mun|${esc(c.chave)}"><td><b>${esc(c.nome)}</b></td>${E.deps.map((s, j) => `<td>${int(c["dv" + j])}</td><td>${pct(c["dp" + j], 2)}</td><td>${c["rk" + j] === 1 ? "<b>1º</b>" : c["rk" + j] < 99 ? c["rk" + j] + "º" : "–"}</td>`).join("")}<td>${pct(c.lula22)}</td><td>${pct(c.lula26)}</td><td>${pct(c.bol22)}</td><td>${pct(c.bol26)}</td><td><span class="venc"><i style="background:${corCand(c.venc26)}"></i>${esc(NOME_EXIBE(c.venc26))}</span></td></tr>`).join("")}</tbody></table></div></div>`;
  $("#mescCorpo").innerHTML = `<div class="mesc-cards n${n}">${cards}</div>
    <div class="grid2" style="margin-top:14px">
      <div class="card"><h3 class="h3c">Do menos ao mais lulista</h3><canvas id="gQuint" height="270"></canvas><p class="nota">Cidades divididas em 5 grupos com o mesmo número de eleitores, pelo % do Lula em 2026. Barra = % dos válidos de cada deputado no grupo.</p></div>
      <div class="card"><h3 class="h3c" id="gDispT"></h3><canvas id="gDisp" height="270"></canvas><p class="nota">Cada bolinha é uma cidade; o tamanho é o número de eleitores.</p></div>
    </div>${tab}`;
  const ordC = cid.slice().sort((a, b) => a.lula26 - b.lula26), totE = ordC.reduce((t, c) => t + c.aptos, 0);
  const quint = [0, 1, 2, 3, 4].map(() => ({lula: 0, t: 0, dv: E.deps.map(() => 0), val: E.deps.map(() => 0)}));
  const vals = E.deps.map(s => validos(s.d));
  let acc = 0;
  for (const c of ordC) {
    const q = quint[Math.min(4, Math.floor(acc / totE * 5))]; acc += c.aptos; q.lula += c.v26[LULA] || 0; q.t += c.t26;
    E.deps.forEach((s, j) => { q.dv[j] += c["dv" + j]; q.val[j] += c.mzs.reduce((t, k) => t + (vals[j][k] || 0), 0); });
  }
  const grid = {color: "rgba(255,255,255,.06)"};
  E.graficos.push(new Chart($("#gQuint"), {type: "bar", data: {labels: quint.map((q, i) => [["Menos", "Pouco", "Médio", "Mais", "Muito mais"][i] + " lulista", `Lula ${dec(q.lula / q.t * 100, 0)}%`]),
    datasets: E.deps.map((s, j) => ({label: `${s.d.nome} ${s.d.ano}`, data: quint.map(q => q.val[j] ? q.dv[j] / q.val[j] * 100 : 0), backgroundColor: s.cor, borderRadius: 4}))},
    options: {plugins: {legend: {display: n > 1}, tooltip: {callbacks: {label: c => `${c.dataset.label}: ${dec(c.raw, 2)}% dos válidos`}}}, scales: {y: {title: {display: true, text: "% dos válidos"}, grid}, x: {grid: {display: false}}}}}));
  const mxA = Math.max(...ws), raio = c => 2 + 12 * Math.sqrt(c.aptos / mxA);
  const datasets = E.deps.map((s, j) => ({label: `${s.d.nome} ${s.d.ano}`, data: cid.map(c => ({x: (s.d.ano === 26 ? c.lula26 : c.lula22) * 100, y: (c["dp" + j] ?? 0) * 100, r: raio(c), nome: c.nome})), backgroundColor: s.cor + "60", borderColor: s.cor}));
  $("#gDispT").textContent = n === 1 ? `% do Lula × % de ${E.deps[0].d.nome}, cidade por cidade` : "% do Lula × % de cada deputado, cidade por cidade";
  E.graficos.push(new Chart($("#gDisp"), {type: "bubble", data: {datasets},
    options: {plugins: {legend: {display: n > 1}, tooltip: {callbacks: {label: c => `${c.raw.nome}: Lula ${dec(c.raw.x, 1)}% · ${c.dataset.label} ${dec(c.raw.y, 2)}%`}}}, scales: {x: {title: {display: true, text: "% do Lula (mesmo ano do deputado)"}, grid}, y: {title: {display: true, text: "% do deputado"}, grid}}}}));
}

/* ---------------- deputados por região: tabela, contagem e mapas em todos os recortes */
const NIV_DEP = [["me", "Macrorregiões"], ["mi", "Microrregiões"], ["ri", "Regiões intermediárias"], ["rm", "Regiões imediatas"], ["zona", "Zonas eleitorais"], ["mun", "Cidades"]];
function depRegioes() {
  const alvo = $("#depReg"); if (!alvo) return;
  if (!E.deps.length) { alvo.innerHTML = vazioDeps(); return; }
  const nv = E.depNivel || "me", lista = agrupar(nv), soma = u => E.deps.reduce((t, s, j) => t + (u["dv" + j] || 0), 0);
  const cid = agrupar("mun"), cidMap = new Map(cid.map(c => [c.chave, c]));
  const modo = (E.depPint || "rk") === "rk" ? "rk0" : E.deps.length > 1 ? "melhor" : "dp0", q = quebras(cid.map(c => c[modo]));
  // em quantos lugares de cada recorte cada deputado foi o melhor
  const cont = E.deps.length > 1 ? `<div class="card" style="margin-bottom:14px"><h3 class="h3c">Onde cada um foi melhor <small class="nota">número de lugares em que teve o maior % dos válidos</small></h3><div class="tab-wrap"><table><thead><tr><th>Recorte</th>${E.deps.map(s => `<th style="box-shadow:inset 0 -3px 0 ${s.cor}">${esc(s.d.nome)} ${s.d.ano}</th>`).join("")}</tr></thead><tbody>${NIV_DEP.map(([k, n]) => { const l = agrupar(k); return `<tr><td><b>${n}</b> <small class="nota">${l.length}</small></td>${E.deps.map((s, j) => { const v = l.filter(u => u.melhor === j).length; return `<td><b>${int(v)}</b> <small class="nota">${pct(v / l.length, 0)}</small></td>`; }).join("")}</tr>`; }).join("")}</tbody></table></div></div>` : "";
  const tabela = `<div class="card"><h3 class="h3c">${esc(NIVEIS[nv])}: votos de cada escolhido <small class="nota">${int(lista.length)} lugares · clique para ver detalhes</small></h3><div class="tab-wrap" style="max-height:520px"><table><thead><tr><th>Lugar</th><th>Eleitores</th>${E.deps.map(s => `<th style="box-shadow:inset 0 -3px 0 ${s.cor}">${esc(s.d.nome)} ${s.d.ano}</th><th>%</th>`).join("")}${E.deps.length > 1 ? "<th>Melhor</th>" : ""}<th>Lula 26</th><th>Flávio 26</th><th>Vencedor 26</th><th>Federal + votado 26</th><th>Estadual + votado 26</th></tr></thead>
    <tbody>${lista.slice().sort((a, b) => soma(b) - soma(a)).map(u => `<tr data-pop="${nv}|${esc(u.chave)}"><td><b>${esc(u.nome)}</b></td><td>${int(u.aptos)}</td>${E.deps.map((s, j) => `<td>${int(u["dv" + j])}</td><td>${pct(u["dp" + j], 2)}</td>`).join("")}${E.deps.length > 1 ? `<td>${u.melhor >= 0 ? `<span class="venc"><i style="background:${E.deps[u.melhor].cor}"></i>${esc(E.deps[u.melhor].d.nome)}</span>` : "–"}</td>` : ""}<td>${pct(u.lula26)}</td><td>${pct(u.bol26)}</td><td>${esc(NOME_EXIBE(u.venc26))}</td><td>${celTop(u.f26)}</td><td>${celTop(u.e26)}</td></tr>`).join("")}</tbody></table></div></div>`;
  // mapas de Minas de cada deputado pintados pelo recorte (cada região com uma cor só)
  const porMun = new Map(); if (nv !== "zona" && nv !== "mun") for (const u of lista) for (const k of u.mzs) porMun.set(k.split("-")[0], u);
  const unidadeDaCidade = m => nv === "mun" || nv === "zona" ? cidMap.get(m) : porMun.get(m);
  const pintM = E.depPint || "rk";
  const mapasMG = `<div class="dep-mapas">${E.deps.map((s, j) => { const mk = pintM + j, qq = quebras((nv === "zona" ? cid : lista).map(u => u["dp" + j])); return `<div class="card"><h3 class="h3c"><i class="pt" style="background:${s.cor}"></i>${esc(s.d.nome)} ${s.d.ano} · ${esc(NIVEIS[nv === "zona" ? "mun" : nv])}${pintM === "rk" ? " · onde foi o mais votado" : ""}</h3>${miniSvg(cid.map(c => { const u = unidadeDaCidade(c.chave); return {ibge: ibgeDe(c.chave), pop: `mun|${c.chave}`, cor: corValor(u, mk, qq), titulo: `${u?.nome}: ${pct(u?.["dp" + j], 2)} · ${u?.["rk" + j] === 1 ? "mais votado" : u?.["rk" + j] < 99 ? u?.["rk" + j] + "º" : "abaixo do 20º"}`}; }), "mini-mapa grande")}<div class="legenda">${legenda(mk, qq)}</div></div>`; }).join("")}
    ${E.deps.length > 1 ? `<div class="card"><h3 class="h3c">Qual foi melhor · ${esc(NIVEIS[nv === "zona" ? "mun" : nv])}</h3>${miniSvg(cid.map(c => { const u = unidadeDaCidade(c.chave); return {ibge: ibgeDe(c.chave), pop: `mun|${c.chave}`, cor: corValor(u, "melhor", []), titulo: u?.nome || ""}; }), "mini-mapa grande")}<div class="legenda">${legenda("melhor", [])}</div></div>` : ""}</div>`;
  const galeriaDep = REGIAO(nv) || nv === "zona" ? `<h3 class="h3c" style="margin-top:18px">Mapa de cada ${nv === "zona" ? "zona" : "região"} <small class="nota">cidades pintadas por ${esc(nomeModo(modo))} · clique numa cidade para ver detalhes</small></h3><div class="legenda">${legenda(modo, q)}</div><div class="galeria">${lista.slice().sort((a, b) => soma(b) - soma(a)).map(u => cartaoRegiao(u, modo, q, cidMap)).join("")}</div>` : "";
  const pint = E.depPint || "rk";
  const contMV = `<div class="card" style="margin-bottom:14px"><h3 class="h3c">Onde cada um foi o mais votado <small class="nota">lugares em que ficou em 1º entre os candidatos do mesmo cargo e ano</small></h3><div class="tab-wrap"><table><thead><tr><th>Recorte</th>${E.deps.map(s => `<th style="box-shadow:inset 0 -3px 0 ${s.cor}">${esc(s.d.nome)} ${s.d.ano}</th>`).join("")}</tr></thead><tbody>${NIV_DEP.map(([k, n]) => { const l = agrupar(k); return `<tr><td><b>${n}</b> <small class="nota">${l.length}</small></td>${E.deps.map((s, j) => { const v = l.filter(u => u["rk" + j] === 1).length; return `<td><b>${int(v)}</b> <small class="nota">${pct(v / l.length, 0)}</small></td>`; }).join("")}</tr>`; }).join("")}</tbody></table></div></div>`;
  alvo.innerHTML = `<div class="sec-cab"><h2>Deputados por região</h2><p>A mesma comparação em todos os recortes de Minas. Escolha o recorte para mudar a tabela, os mapas de Minas e os mapas de cada região.</p></div>
    <div class="linha-ctl"><span class="rot">Recorte</span><div class="seg" id="depNivel" role="group" aria-label="Recorte">${NIV_DEP.map(([k, n]) => `<button data-dn="${k}" aria-pressed="${k === nv}">${n}</button>`).join("")}</div></div>
    <div class="linha-ctl"><span class="rot">Mapas</span><div class="seg" id="depPint" role="group" aria-label="Pintar os mapas por"><button data-dp="rk" aria-pressed="${pint === "rk"}">Onde foi o mais votado</button><button data-dp="dp" aria-pressed="${pint === "dp"}">% dos válidos</button></div></div>
    ${contMV}${cont}${tabela}${mapasMG}${galeriaDep}`;
}
document.addEventListener("click", e => { const b = e.target.closest("#depNivel [data-dn]"); if (b) { E.depNivel = b.dataset.dn; depRegioes(); } const c = e.target.closest("#depPint [data-dp]"); if (c) { E.depPint = c.dataset.dp; depRegioes(); } });

/* ---------------- buscas (lista que abre enquanto digita) */
function preencherBuscas() {
  const B = E.B, opts = [];
  for (const x of Object.values(B.municipios)) opts.push(`Cidade · ${x.nome}`);
  for (const x of Object.values(B.zonas)) opts.push(x.nome);
  const add = (rot, campo) => { for (const r of new Set(Object.values(B.municipios).map(x => x[campo]))) if (r) opts.push(`${rot} · ${r}`); };
  add("Macrorregião", "me"); add("Microrregião", "mi"); add("Região intermediária", "ri"); add("Região imediata", "rm");
  $("#lUnidades").innerHTML = opts.sort((a, b) => a.localeCompare(b)).map(o => `<option value="${esc(o)}">`).join("");
  preencherDeps();
}
// busca de deputados com foto (lista própria, navegável pelo teclado)
function preencherDeps() { if (document.activeElement === $("#qDep")) acDeps(); }
let acSel = 0, acItens = [];
function acDeps() {
  const q = semAc($("#qDep").value.trim()), box = $("#acDeps");
  acItens = E.B.deputados.filter(d => (!E.filtroCargo || d.cargo === E.filtroCargo) && (!E.filtroAno || d.ano === E.filtroAno) && (!q || semAc(d.nome).includes(q) || semAc(d.partido).startsWith(q))).slice(0, 40);
  acSel = Math.min(acSel, Math.max(0, acItens.length - 1));
  box.innerHTML = (q ? "" : `<div class="ac-cab">Mais votados${E.filtroCargo ? (E.filtroCargo === 6 ? " · federais" : " · estaduais") : ""}${E.filtroAno ? " · 20" + E.filtroAno : ""}</div>`)
    + (acItens.map((d, i) => { const sel = E.deps.some(s => s.d.id === d.id);
      return `<button type="button" class="ac-it${i === acSel ? " ativo" : ""}" role="option" aria-selected="${i === acSel}" data-ac="${i}">${avatar(d.foto, d.nome, "#2a333d", "av-c")}<span class="ac-t"><b>${esc(d.nome)}</b><small>${logo(d.partido)}${esc(d.partido)} · ${cargoNome(d.cargo)} 20${d.ano}${d.eleito ? ' · <em>eleito(a)</em>' : ""}</small></span><span class="ac-v"><b>${int(d.votos)}</b><small>votos</small></span>${sel ? '<i class="ac-ok">✓</i>' : ""}</button>`; }).join("")
    || `<div class="ac-cab">Nenhum deputado encontrado${E.filtroCargo || E.filtroAno ? " com esses filtros" : ""}.</div>`);
  box.hidden = false; $("#qDep").setAttribute("aria-expanded", "true");
  box.querySelector(".ativo")?.scrollIntoView({block: "nearest"});
}
const acFechar = () => { $("#acDeps").hidden = true; $("#qDep").setAttribute("aria-expanded", "false"); };
function acEscolher(i) { const d = acItens[i]; if (!d) return; $("#qDep").value = ""; acFechar(); $("#qDep").blur(); escolherDep(d); }
$("#qDep").addEventListener("input", () => { acSel = 0; acDeps(); });
$("#qDep").addEventListener("focus", () => acDeps());
$("#qDep").addEventListener("keydown", e => {
  if (e.key === "ArrowDown") { e.preventDefault(); acSel = Math.min(acItens.length - 1, acSel + 1); acDeps(); }
  else if (e.key === "ArrowUp") { e.preventDefault(); acSel = Math.max(0, acSel - 1); acDeps(); }
  else if (e.key === "Enter") { e.preventDefault(); acEscolher(acSel); }
  else if (e.key === "Escape") acFechar();
});
$("#acDeps").addEventListener("mousedown", e => e.preventDefault());
$("#acDeps").addEventListener("click", e => { e.preventDefault(); const b = e.target.closest("[data-ac]"); if (b) acEscolher(+b.dataset.ac); });
$("#qDep").addEventListener("blur", () => setTimeout(acFechar, 120));
$("#qUnidade").addEventListener("change", e => {
  const v = e.target.value, B = E.B, parte = v.split(" · ").slice(1).join(" · ");
  let nivel, chave;
  if (v.startsWith("Cidade · ")) { nivel = "mun"; chave = Object.keys(B.municipios).find(m => B.municipios[m].nome === parte); }
  else if (v.startsWith("Zona ")) { nivel = "zona"; chave = Object.keys(B.zonas).find(z => B.zonas[z].nome === v); }
  else { nivel = {"Macrorregião": "me", "Microrregião": "mi", "Região intermediária": "ri", "Região imediata": "rm"}[v.split(" · ")[0]]; chave = parte; }
  if (!nivel || !chave) return;
  e.target.value = ""; e.target.blur(); abrir(nivel, chave);
});

$("#filtroCargo").addEventListener("click", e => { const b = e.target.closest("[data-c]"); if (!b) return; E.filtroCargo = +b.dataset.c; $$("#filtroCargo button").forEach(x => x.setAttribute("aria-pressed", x === b)); preencherDeps(); });
$("#filtroAno").addEventListener("click", e => { const b = e.target.closest("[data-a]"); if (!b) return; E.filtroAno = +b.dataset.a; $$("#filtroAno button").forEach(x => x.setAttribute("aria-pressed", x === b)); preencherDeps(); });

/* ---------------- controles */
const BOT_NIVEL = [["mun", "Cidades"], ["zona", "Zonas"], ["me", "Macrorregiões"], ["mi", "Microrregiões"], ["ri", "Regiões intermediárias"], ["rm", "Regiões imediatas"], ["mg", "Minas"]];
function segNivel() { $$(".nivelSeg").forEach(el => el.innerHTML = BOT_NIVEL.map(([k, n]) => `<button data-n="${k}" aria-pressed="${E.nivel === k}">${n}</button>`).join("")); }
document.addEventListener("click", e => { const b = e.target.closest(".nivelSeg [data-n]"); if (!b) return; E.nivel = b.dataset.n; segNivel(); E.unidades = agrupar(E.nivel); if (E.foco) { E.foco = null; E.voar = true; } if (E.aba === "mapa") desenharMapa(); else tabela(); });
$("#turno").addEventListener("click", e => {
  const b = e.target.closest("[data-t]"); if (!b) return; E.turno = b.dataset.t; $$("#turno button").forEach(x => x.setAttribute("aria-pressed", x === b));
  const aba = E.aba; recalcular(); if (E.sel) abrir(E.sel.nivel, E.sel.chave); irAba(aba, false);
});
function recalcular() {
  CACHE = {};
  E.unidades = agrupar(E.nivel);
  quadro(somar(todasMz()), $("#quadro"));
  destaques(); galeriaGeral();
  if (E.aba === "mapa") desenharMapa();
  if (E.aba === "regioes") galeria();
  if (E.aba === "tabela") tabela();
  if (E.aba === "lugar") desenharDetMapa();
}

/* ---------------- início */
(async function () {
  const [B, geo, top] = await Promise.all([fetch("dados/base.json").then(r => r.json()), fetch("dados/mg.geojson").then(r => r.json()), fetch("dados/top.json").then(r => r.json())]);
  E.B = B; E.geo = geo; E.top = top;
  E.partidos = new Map([...B.cand22["1"], ...B.cand22["2"], ...B.cand26].map(c => [c[0], c[1]]));
  E.fotos22 = new Map([...B.cand22["1"], ...B.cand22["2"]].filter(c => c[3]).map(c => [c[0], c[3]]));
  E.fotos26 = new Map(B.cand26.filter(c => c[3]).map(c => [c[0], c[3]]));
  prepararGeo(); segNivel(); preencherBuscas(); recalcular(); chips();
  topDeps("mg", $("#geralTop"), "Deputados mais votados em Minas");
  const n22 = B.deputados.filter(d => d.ano === 22).length, n26 = B.deputados.length - n22;
  $("#fontesTexto").innerHTML = `<p><b>Presidente 2022:</b> TSE, dados abertos (votação por candidato e detalhe da votação por município e zona eleitoral), 1º e 2º turnos, Minas Gerais.</p>
    <p><b>Presidente 2026:</b> boletins de urna publicados pelo TSE, somados por município e zona e conferidos com o arquivo oficial de detalhe por seção. Os totais podem ficar alguns votos abaixo do oficial por causa de poucas seções sem boletim publicado.</p>
    <p><b>Deputados:</b> ${int(n26)} candidatos de 2026 e ${int(n22)} de 2022 com voto em Minas (federais e estaduais). O % é sobre os votos válidos do mesmo cargo e ano. A mesma pessoa nos dois anos é ligada pelo nome completo registrado no TSE.</p>
    <p><b>Fotos:</b> fotos oficiais de candidatura divulgadas pelo TSE (2022: pacote de dados abertos; 2026: site de resultados).</p>
    <p><b>Regiões:</b> macrorregiões e microrregiões = mesorregiões e microrregiões geográficas do IBGE (Triângulo, Zona da Mata, Sul de Minas…); regiões intermediárias e imediatas = divisão regional atual do IBGE. <b>Zonas:</b> zonas eleitorais do TSE, posicionadas no mapa pelo centro dos seus locais de votação; no mapa de uma zona, cada cidade mostra só a parte dela que fica na zona.</p>
    <p><b>Correlação:</b> mede, de −1 a +1, se dois números sobem e descem juntos nas cidades (cada cidade pesa pelo número de eleitores). Mostra coincidência geográfica, não causa.</p>`;
  const h = location.hash.slice(1); irAba(["mapa", "regioes", "tabela", "deps", "depreg", "mesc"].includes(h) ? h : "geral", false);
})();
document.addEventListener("click", e => { const p = e.target.closest(".hero-par [data-par]"); if (p) escolherDep(E.B.deputados[+p.dataset.par]); });
