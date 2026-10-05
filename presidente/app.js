/* Presidente 2022 × 2026 em Minas Gerais — quadro comparativo por macrorregião, região, zona e cidade,
   cruzado com os deputados federais e estaduais de 2022 e 2026 (até 4 ao mesmo tempo).
   Unidade básica dos dados: município + zona eleitoral ("mun-zona"); tudo é somado aqui no navegador. */
"use strict";
const $ = s => document.querySelector(s);
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

const E = {B: null, nivel: "mg", turno: "1", deps: [], filtroCargo: 0, filtroAno: 0, unidades: [], sel: null, modo: "venc26", mapa: null, camada: null, geo: null, graficos: [], topAno: "26"};
const NIVEIS = {mg: "Minas Gerais", me: "Macrorregiões", mi: "Microrregiões", ri: "Regiões intermediárias", rm: "Regiões imediatas", zona: "Zonas eleitorais", mun: "Cidades"};
const REGIAO = n => ["me", "mi", "ri", "rm"].includes(n);

function toast(t) { const el = $("#toast"); el.innerHTML = t; el.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("on"), 3200); }

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
function agrupar(nivel) {
  const B = E.B, grupos = new Map();
  for (const k of new Set([...Object.keys(B.v26), ...Object.keys(B.v22[E.turno])])) {
    const [chave, nome] = chaveDe(nivel, k);
    if (!grupos.has(chave)) grupos.set(chave, {chave, nome, mzs: []});
    grupos.get(chave).mzs.push(k);
  }
  return [...grupos.values()].map(g => Object.assign(g, somar(g.mzs), maisVotados(nivel, g.chave)));
}
// deputado mais votado de cada cargo e ano num lugar: {f26: [deputado, votos], e26, f22, e22}
function maisVotados(nivel, chave) {
  const g = E.top?.[nivel === "mg" ? "mg" : `${nivel}:${chave}`] || {}, o = {};
  for (const [k, cg, ano] of [["f26", 6, 26], ["e26", 7, 26], ["f22", 6, 22], ["e22", 7, 22]]) { const x = g[`${cg}-${ano}`]?.[0]; o[k] = x ? [E.B.deputados[x[0]], x[1]] : null; o[k + "n"] = x ? E.B.deputados[x[0]].nome : ""; }
  return o;
}
const celTop = x => x ? `<span class="topcel">${avatar(x[0].foto, x[0].nome, "#2a333d", "av-m")}<span>${esc(x[0].nome)} <small>${esc(x[0].partido)} · ${int(x[1])}</small></span></span>` : "–";
const todasMz = () => [...new Set([...Object.keys(E.B.v26), ...Object.keys(E.B.v22[E.turno])])];

/* ---------------- destaques (Minas) */
function destaques() {
  const mg = somar(todasMz()), cid = agrupar("mun"), me = agrupar("me");
  const t22 = E.turno === "1" ? "1º turno de 2022" : "2º turno de 2022";
  const l2b = cid.filter(c => familia(c.venc22) === "lula" && familia(c.venc26) === "bolso").length;
  const b2l = cid.filter(c => familia(c.venc22) === "bolso" && familia(c.venc26) === "lula").length;
  const grandes = cid.filter(c => c.aptos >= 50000);
  const maxB = grandes.slice().sort((a, b) => b.dBol - a.dBol)[0];
  const meL = me.slice().sort((a, b) => a.dLula - b.dLula)[0], meM = me.slice().sort((a, b) => b.dLula - a.dLula)[0];
  const margem = mg.bol26 - mg.lula26;
  $("#destGrid").innerHTML = `
    <div class="dest forte"><span class="dl">Quem venceu em Minas em 2026</span><b>${esc(NOME_EXIBE(mg.venc26))}</b><span>${pct(mg.bol26)} contra ${pct(mg.lula26)} do Lula · ${margem > 0 ? "vantagem" : "diferença"} de ${int(Math.abs((mg.v26[FB] || 0) - (mg.v26[LULA] || 0)))} votos</span></div>
    <div class="dest"><span class="dl">Lula em Minas · ${t22} → 2026</span><b class="${mg.dLula > 0 ? "pos" : "neg"}">${pp(mg.dLula)}</b><span>${pct(mg.lula22)} → ${pct(mg.lula26)}</span></div>
    <div class="dest"><span class="dl">Bolsonaro · Jair (2022) → Flávio (2026)</span><b class="${mg.dBol > 0 ? "pos" : "neg"}">${pp(mg.dBol)}</b><span>${pct(mg.bol22)} → ${pct(mg.bol26)}</span></div>
    <div class="dest"><span class="dl">Cidades que mudaram de lado</span><b>${int(l2b + b2l)} <small>de ${int(cid.length)}</small></b><span>${int(l2b)} saíram do Lula para o Flávio · ${int(b2l)} do Bolsonaro para o Lula</span></div>
    <div class="dest"><span class="dl">Onde o Lula mais caiu</span><b>${esc(meL.nome)}</b><span>${pp(meL.dLula)} · onde menos caiu: ${esc(meM.nome)} (${pp(meM.dLula)})</span></div>
    ${maxB ? `<div class="dest"><span class="dl">Maior avanço do Flávio sobre o Jair <small>(cidades com 50 mil+ eleitores)</small></span><b>${esc(maxB.nome)}</b><span>${pp(maxB.dBol)} · ${pct(maxB.bol22)} → ${pct(maxB.bol26)}</span></div>` : ""}`;
}

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
  $("#tabNota").innerHTML = E.nivel === "mg" ? "Escolha um recorte em <b>Ver por</b> para listar cidades, zonas ou regiões." : `<b>${int(viraram)} de ${int(E.unidades.length)}</b> mudaram de lado entre o ${E.turno === "1" ? "1º" : "2º"} turno de 2022 e 2026. Clique numa linha para abrir o comparativo.`;
}
$("#tabela").addEventListener("click", e => {
  const th = e.target.closest("th[data-k]");
  if (th) { if (ord.k === th.dataset.k) ord.dir = -ord.dir; else ord = {k: th.dataset.k, dir: -1}; return tabela(); }
  const tr = e.target.closest("tr[data-ch]"); if (tr) abrir(tr.dataset.ch);
});
$("#qTab").addEventListener("input", e => { filtroTab = semAc(e.target.value); tabela(); });
$("#csv").addEventListener("click", () => {
  const cols = COLS(), txt = c => String(c).replace(/<[^>]+>/g, "").replace(/"/g, '""');
  const linhas = [cols.map(c => `"${txt(c.t)}"`).join(";")].concat(E.unidades.map(u => cols.map(c => `"${txt(c.f(u))}"`).join(";")));
  Object.assign(document.createElement("a"), {href: URL.createObjectURL(new Blob(["﻿" + linhas.join("\n")], {type: "text/csv"})), download: `presidente-mg-${E.nivel}.csv`}).click();
});

/* ---------------- mapa */
const MODOS = () => [["venc26", "Vencedor 2026"], ["venc22", "Vencedor 2022"], ["virou", "Mudou de lado"], ["dLula", "Δ Lula"], ["dBol", "Δ Bolsonaro"], ["lula26", "Lula 2026"], ["bol26", "Flávio 2026"], ["lula22", "Lula 2022"], ["bol22", "Jair 2022"], ["abst26", "Abstenção 2026"]]
  .concat(E.deps.map((s, j) => ["dp" + j, `${s.d.nome} ${s.d.ano}`])).concat(E.deps.length > 1 ? [["melhor", "Qual deputado foi melhor"]] : []);
const mistura = (c, t) => { const a = parseInt(c.slice(1), 16), b = 0x11171d; const r = (x, s) => Math.round(((b >> s) & 255) * (1 - t) + ((x >> s) & 255) * t); return `rgb(${r(a, 16)},${r(a, 8)},${r(a, 0)})`; };
const rampa = c => [.18, .36, .56, .78, 1].map(t => mistura(c, t));
const RAMPAS = {lula: rampa(COR.lula), bolso: rampa(COR.bolso), cinza: rampa("#9aa6b2")};
const DIV = ["#215c8c", "#4f93cc", "#8a96a3", "#e48a76", "#c4503e"];
function quebras(vals) { const v = vals.filter(x => x != null && isFinite(x)).sort((a, b) => a - b); return [0.2, 0.4, 0.6, 0.8].map(q => v[Math.floor(q * (v.length - 1))]); }
const rampaDo = modo => /^dp\d/.test(modo) ? rampa(E.deps[+modo.slice(2)].cor) : /lula/.test(modo) ? RAMPAS.lula : /bol/.test(modo) ? RAMPAS.bolso : RAMPAS.cinza;
function corValor(u, modo, q) {
  if (!u) return "#1a2129";
  if (modo === "venc26") return corCand(u.venc26);
  if (modo === "venc22") return corCand(u.venc22);
  if (modo === "virou") return u.virou ? "#fab219" : "#2a333d";
  if (modo === "melhor") return u.melhor >= 0 ? E.deps[u.melhor].cor : "#1a2129";
  const x = u[modo]; if (x == null || !isFinite(x)) return "#1a2129";
  if (modo === "dLula" || modo === "dBol") { const i = q.filter(t => x > t).length; return modo === "dLula" ? DIV[i] : DIV[4 - i]; }
  return rampaDo(modo)[q.filter(t => x > t).length];
}
function legenda(modo, q) {
  const f = x => pct(x, /^dp/.test(modo) ? 2 : 1);
  if (modo === "venc26" || modo === "venc22") return `<span><b style="background:${COR.lula}"></b>Lula</span><span><b style="background:${COR.bolso}"></b>${modo === "venc22" ? "Jair Bolsonaro" : "Flávio Bolsonaro"}</span><span><b style="background:${COR.outro}"></b>outro</span>`;
  if (modo === "virou") return `<span><b style="background:#fab219"></b>mudou de lado</span><span><b style="background:#2a333d"></b>manteve</span>`;
  if (modo === "melhor") return E.deps.map(s => `<span><b style="background:${s.cor}"></b>${esc(s.d.nome)} ${s.d.ano}</span>`).join("") + `<span class="nota">(maior % dos válidos do próprio cargo)</span>`;
  if (modo === "dLula" || modo === "dBol") { const c = modo === "dLula" ? DIV : DIV.slice().reverse(); return c.map((cor, i) => `<span><b style="background:${cor}"></b>${i === 0 ? "até " + pp(q[0]) : i === 4 ? "acima de " + pp(q[3]) : pp(q[i - 1]) + " a " + pp(q[i])}</span>`).join("") + `<span class="nota">(cinco faixas com o mesmo número de lugares)</span>`; }
  return rampaDo(modo).map((c, i) => `<span><b style="background:${c}"></b>${i === 0 ? "até " + f(q[0]) : i === 4 ? "acima de " + f(q[3]) : f(q[i - 1]) + " – " + f(q[i])}</span>`).join("");
}
function dica(u) {
  return `<b>${esc(u.nome)}</b><br>2022: Lula ${pct(u.lula22)} · Jair ${pct(u.bol22)}<br>2026: Lula ${pct(u.lula26)} · Flávio ${pct(u.bol26)}<br>Δ Lula ${pp(u.dLula)} · Δ Bolsonaro ${pp(u.dBol)}`
    + (u.f26 ? `<br>Mais votados 2026: <b>${esc(u.f26[0].nome)}</b> (federal) · <b>${esc(u.e26?.[0].nome)}</b> (estadual)` : "")
    + (u.f22 ? `<br>Mais votados 2022: ${esc(u.f22[0].nome)} (federal) · ${esc(u.e22?.[0].nome)} (estadual)` : "")
    + E.deps.map((s, j) => `<br><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${s.cor}"></i> ${esc(s.d.nome)} ${s.d.ano}: ${int(u["dv" + j])} votos (${pct(u["dp" + j], 2)})`).join("");
}
function desenharMapa() {
  if (!E.mapa) {
    E.mapa = L.map("mapa", {scrollWheelZoom: false, zoomSnap: .25, preferCanvas: true});
    L.tileLayer("https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {attribution: "Esri · IBGE · TSE", maxZoom: 14}).addTo(E.mapa);
    E.mapa.on("click focus", () => E.mapa.scrollWheelZoom.enable());
    E.mapa.setView([-18.6, -44.6], 6);
    // o mapa pode nascer com largura zero (aba escondida); reenquadra quando ganhar tamanho
    let larg = 0;
    new ResizeObserver(() => { const w = $("#mapa").clientWidth; if (w && Math.abs(w - larg) > 40) { larg = w; E.mapa.invalidateSize(); if (E.limites) E.mapa.fitBounds(E.limites); } }).observe($("#mapa"));
  }
  if (E.camada) E.camada.remove();
  const modos = MODOS(); if (!modos.some(m => m[0] === E.modo)) E.modo = "venc26";
  $("#modoMapa").innerHTML = modos.map(([k, n]) => { const j = /^dp(\d)/.exec(k); return `<button data-m="${k}" aria-pressed="${E.modo === k}">${j ? `<i class="pt" style="background:${E.deps[+j[1]].cor}"></i>` : ""}${esc(n)}</button>`; }).join("");
  // cor de cada município: a da unidade que o contém (região) ou a da própria cidade
  const unidadeDe = new Map();
  const nivelMapa = E.nivel === "mg" || E.nivel === "zona" ? "mun" : E.nivel;
  const lista = nivelMapa === E.nivel ? E.unidades : agrupar(nivelMapa);
  for (const u of lista) for (const k of u.mzs) unidadeDe.set(k.split("-")[0], u);
  const porIbge = new Map(Object.entries(E.B.municipios).map(([m, x]) => [x.ibge, unidadeDe.get(m)]));
  const q = quebras(lista.map(u => u[E.modo]));
  const grupo = L.featureGroup(), regiao = REGIAO(E.nivel);
  L.geoJSON(E.geo, {style: f => ({color: regiao ? "rgba(11,16,21,.35)" : "#0b1015", weight: regiao ? .2 : .4, fillOpacity: E.nivel === "zona" ? .25 : .9, fillColor: corValor(porIbge.get(f.properties.ibge), E.modo, q)}),
    onEachFeature: (f, l) => { const u = porIbge.get(f.properties.ibge); if (!u) return; l.bindTooltip(dica(u), {sticky: true}); l.on("click", () => abrir(u.chave)); }}).addTo(grupo);
  if (E.nivel === "zona") {
    const qz = quebras(E.unidades.map(u => u[E.modo])), mx = Math.max(...E.unidades.map(u => u.aptos));
    for (const u of E.unidades) {
      const z = E.B.zonas[u.chave]; if (!z?.lat) continue;
      L.circleMarker([z.lat, z.lng], {radius: 4 + 14 * Math.sqrt(u.aptos / mx), color: "#0b1015", weight: 1, fillOpacity: .9, fillColor: corValor(u, E.modo, qz)})
        .bindTooltip(dica(u), {sticky: true}).on("click", () => abrir(u.chave)).addTo(grupo);
    }
  }
  E.camada = grupo.addTo(E.mapa);
  if (!E.limites) { E.limites = grupo.getBounds(); if ($("#mapa").clientWidth) E.mapa.fitBounds(E.limites); }
  $("#legenda").innerHTML = legenda(E.modo, q);
  $("#mapaTitulo").textContent = E.nivel === "zona" ? "Mapa · zonas eleitorais (círculos)" : REGIAO(E.nivel) ? `Mapa · ${NIVEIS[E.nivel]}` : "Mapa · cidades";
}
$("#modoMapa").addEventListener("click", e => { const b = e.target.closest("[data-m]"); if (b) { E.modo = b.dataset.m; desenharMapa(); } });

/* ---------------- detalhe de um lugar */
function tabelaSub(titulo, rot, lista) {
  if (lista.length < 2) return "";
  return `<h4 class="sub">${esc(titulo)} <small>${lista.length}</small></h4><div class="tab-wrap" style="max-height:380px"><table><thead><tr><th>${rot}</th><th>Eleitores</th><th>Lula 22</th><th>Lula 26</th><th>Δ Lula</th><th>Jair 22</th><th>Flávio 26</th><th>Δ Bolsonaro</th><th>Abstenção 26</th><th>Vencedor 26</th>${E.deps.map(s => `<th style="box-shadow:inset 0 -3px 0 ${s.cor}">${esc(s.d.nome)} ${s.d.ano}</th>`).join("")}</tr></thead>
    <tbody>${lista.sort((a, b) => b.aptos - a.aptos).map(c => `<tr><td><b>${esc(c.nome)}</b></td><td>${int(c.aptos)}</td><td>${pct(c.lula22)}</td><td>${pct(c.lula26)}</td><td class="${c.dLula > 0 ? "pos" : "neg"}">${pp(c.dLula)}</td><td>${pct(c.bol22)}</td><td>${pct(c.bol26)}</td><td class="${c.dBol > 0 ? "pos" : "neg"}">${pp(c.dBol)}</td><td>${pct(c.abst26)}</td><td><span class="venc"><i style="background:${corCand(c.venc26)}"></i>${esc(NOME_EXIBE(c.venc26))}</span>${c.virou ? '<span class="virou">virou</span>' : ""}</td>${E.deps.map((s, j) => `<td>${int(c["dv" + j])} <small class="nota">${pct(c["dp" + j], 2)}</small></td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
async function topDeps(id, alvo, titulo) {
  if (!E.top) E.top = await fetch("dados/top.json").then(r => r.json());
  const g = E.top[id]; if (!g) { alvo.innerHTML = ""; return; }
  const ano = E.topAno;
  const col = (cg, t) => `<div class="card"><h4 class="sub" style="margin-top:0">${t} · 20${ano}</h4><ol class="top">${(g[`${cg}-${ano}`] || []).slice(0, 15).map(([i, q]) => {
    const d = E.B.deputados[i], sel = E.deps.some(s => s.d.id === d.id);
    return `<li><button data-dep="${i}" class="${sel ? "sel" : ""}" title="${sel ? "Já está no comparativo" : "Adicionar ao comparativo de deputados"}">${avatar(d.foto, d.nome, "#2a333d", "av-p")}<span>${esc(d.nome)} <small>${logo(d.partido)}${esc(d.partido)}${d.eleito ? " · <em>eleito(a)</em>" : ""}</small></span><b>${int(q)}</b><i class="mais">${sel ? "✓" : "+"}</i></button></li>`;
  }).join("")}</ol></div>`;
  alvo.innerHTML = `<div class="sub-cab"><h4 class="sub">${esc(titulo)} <small>toque no + para comparar</small></h4><div class="seg anoTop" role="group" aria-label="Ano"><button data-ano="26" aria-pressed="${ano === "26"}">2026</button><button data-ano="22" aria-pressed="${ano === "22"}">2022</button></div></div><div class="grid2">${col(6, "Deputado federal")}${col(7, "Deputado estadual")}</div>`;
  alvo.dataset.id = id; alvo.dataset.titulo = titulo;
}
function recarregarTops() { document.querySelectorAll("[data-id]").forEach(el => topDeps(el.dataset.id, el, el.dataset.titulo)); }
document.addEventListener("click", e => {
  const a = e.target.closest(".anoTop [data-ano]"); if (a) { E.topAno = a.dataset.ano; recarregarTops(); return; }
  const b = e.target.closest("[data-dep]"); if (b) { const d = E.B.deputados[+b.dataset.dep]; if (!E.deps.some(s => s.d.id === d.id)) escolherDep(d, false); }
});
async function abrir(chave) {
  const u = E.unidades.find(x => x.chave === chave); if (!u) return;
  E.sel = chave;
  $("#detalhe").hidden = false;
  $("#detTitulo").textContent = u.nome;
  const box = document.createElement("div"); quadro(u, box);
  const B = E.B;
  let extra = "";
  if (E.nivel === "mun") extra = tabelaSub("Zonas eleitorais da cidade", "Zona", u.mzs.map(k => Object.assign(somar([k]), {nome: `Zona ${k.split("-")[1]}`})));
  else if (E.nivel === "zona") extra = tabelaSub("Cidades da zona", "Cidade", u.mzs.map(k => Object.assign(somar([k]), {nome: B.municipios[k.split("-")[0]]?.nome || k})));
  else if (REGIAO(E.nivel) || E.nivel === "mg") { const s = new Set(u.mzs); extra = tabelaSub(E.nivel === "mg" ? "Todas as cidades" : "Cidades da região", "Cidade", agrupar("mun").filter(c => c.mzs.some(k => s.has(k)))); }
  const dep = E.deps.length ? `<h4 class="sub">Deputados escolhidos neste lugar</h4><div class="kpis">${E.deps.map((s, j) => `<div class="card dep-kpi" style="--cor:${s.cor}">${avatar(s.d.foto, s.d.nome, s.cor, "av-p")}<div><b>${int(u["dv" + j])}</b><span>votos de ${esc(s.d.nome)} (${s.d.ano}) · ${pct(u["dp" + j], 2)} dos válidos · ${pct(u["dv" + j] / s.total, 1)} de tudo que teve em MG</span></div></div>`).join("")}</div>` : "";
  $("#detCorpo").innerHTML = ""; $("#detCorpo").append(box); $("#detCorpo").insertAdjacentHTML("beforeend", dep + '<div id="detTop"></div>' + extra);
  $("#detalhe").scrollIntoView({behavior: "smooth", block: "start"});
  topDeps(E.nivel === "mg" ? "mg" : `${E.nivel}:${chave}`, $("#detTop"), `Deputados mais votados em ${u.nome}`);
}
$("#fecharDet").addEventListener("click", () => { $("#detalhe").hidden = true; E.sel = null; });

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
  const s = e.target.closest("[data-sug]"); if (s) { E.deps = []; for (const i of s.dataset.sug.split(",")) await escolherDep(E.B.deputados[+i], false, true); atualizarDeps(); $("#depSec").scrollIntoView({behavior: "smooth"}); }
});
async function escolherDep(d, rolar = true, silencioso = false) {
  if (E.deps.some(s => s.d.id === d.id)) return;
  if (E.deps.length >= 4) { toast("Já há 4 deputados no comparativo. Remova um para adicionar outro."); return; }
  const votos = await fetch(`dados/dep/${d.id}.json`).then(r => r.json());
  E.deps.push({d, votos, total: Object.values(votos).reduce((t, x) => t + x, 0), cor: CORES_DEP[E.deps.length]});
  if (silencioso) return;
  E.modo = "dp" + (E.deps.length - 1);
  atualizarDeps();
  if (rolar) $("#depSec").scrollIntoView({behavior: "smooth"});
  else toast(`<b>${esc(d.nome)}</b> (${d.ano}) entrou no comparativo · <a href="#depSec">ver deputados</a>`);
}
function atualizarDeps() { chips(); recalcular(); secaoDeputados(); if (E.sel && !$("#detalhe").hidden) { const y = scrollY; abrir(E.sel).then(() => scrollTo({top: y})); } recarregarTops(); }

function secaoDeputados() {
  E.graficos.forEach(g => g.destroy()); E.graficos = [];
  if (!E.deps.length) { $("#depCorpo").innerHTML = `<div class="vazio card"><b>Escolha um deputado acima</b><span>ou toque no <b>+</b> ao lado de um nome nas listas de mais votados. Dá para misturar federal e estadual, 2022 e 2026, e comparar a mesma pessoa nos dois anos.</span></div>`; return; }
  const cid = agrupar("mun").filter(c => c.t26 > 0 && c.t22 > 0), ws = cid.map(c => c.aptos);
  const t22 = E.turno === "1" ? "1º turno" : "2º turno";
  // cartões: um por deputado, cruzado com o Presidente do mesmo ano
  const cards = E.deps.map((s, j) => {
    const d = s.d, ys = cid.map(c => c["dp" + j] ?? 0);
    const lula = cid.map(c => d.ano === 26 ? c.lula26 : c.lula22), bol = cid.map(c => d.ano === 26 ? c.bol26 : c.bol22);
    const rL = correl(lula, ys, ws), rB = correl(bol, ys, ws), nb = d.ano === 26 ? "Flávio" : "Jair";
    const lado = Math.abs(rL) < .15 ? "atravessa os dois campos: não depende de onde Lula ou Bolsonaro foram melhor" : rL > 0 ? "é mais forte onde o Lula foi melhor" : `é mais forte onde o ${nb} Bolsonaro foi melhor`;
    const topC = cid.slice().sort((a, b) => b["dv" + j] - a["dv" + j]).slice(0, 3).map(c => c.nome).join(", ");
    s.rL = rL; s.rB = rB;
    return `<div class="card dep-card" style="--cor:${s.cor}">
      <div class="dep-top">${avatar(d.foto, d.nome, s.cor, "av-g")}<div><h3>${esc(d.nome)}</h3><p>${logo(d.partido)}${esc(d.partido)} · ${cargoNome(d.cargo)} 20${d.ano}</p><span class="sit ${d.eleito ? "ok" : ""}">${esc(d.situacao || (d.eleito ? "Eleito(a)" : "Não eleito(a)"))}</span></div></div>
      <div class="dep-num"><div><b>${int(d.votos)}</b><span>votos em MG</span></div><div><b>${dec(rL)}</b><span>× Lula ${d.ano === 26 ? "2026" : "2022 (" + t22 + ")"}</span></div><div><b>${dec(rB)}</b><span>× ${nb} Bolsonaro</span></div></div>
      <p class="leitura">O voto de <b>${esc(d.nome)}</b> ${lado} <span class="nota">(${leituraR(rL)} com o % do Lula nas cidades)</span>. Mais votos em: ${esc(topC)}.</p></div>`;
  }).join("");
  // pares: deputado × deputado
  let pares = "";
  if (E.deps.length > 1) {
    const linhas = [];
    for (let a = 0; a < E.deps.length; a++) for (let b = a + 1; b < E.deps.length; b++) {
      const A = E.deps[a], Bd = E.deps[b], r = correl(cid.map(c => c["dp" + a] ?? 0), cid.map(c => c["dp" + b] ?? 0), ws);
      const ganhaA = cid.filter(c => (c["dp" + a] ?? 0) > (c["dp" + b] ?? 0)).length;
      const mesma = A.d.par === Bd.d.id;
      linhas.push(`<div class="par-linha"><span class="pts"><i style="background:${A.cor}"></i><i style="background:${Bd.cor}"></i></span><div><b>${esc(A.d.nome)} ${A.d.ano} × ${esc(Bd.d.nome)} ${Bd.d.ano}</b>${mesma ? ' <span class="selo mini">mesma pessoa</span>' : ""}
        <span>correlação <b>${dec(r)}</b> (${leituraR(r)}) · ${esc(A.d.nome)} ${A.d.ano} tem % maior em <b>${int(ganhaA)}</b> cidades e ${esc(Bd.d.nome)} ${Bd.d.ano} em <b>${int(cid.length - ganhaA)}</b>${mesma ? ` · votos: ${int(A.d.votos)} → ${int(Bd.d.votos)} (${pct(Bd.d.votos / A.d.votos - 1)})` : ""}</span></div></div>`);
    }
    pares = `<div class="card pares"><h3 class="h3c">Deputado × deputado</h3><p class="nota">Correlação perto de +1: são fortes nos mesmos lugares. Perto de −1: onde um é forte, o outro é fraco.</p>${linhas.join("")}</div>`;
  }
  // tabela comparativa das cidades
  const topC = cid.slice().sort((a, b) => E.deps.reduce((t, s, j) => t + (b["dv" + j] || 0), 0) - E.deps.reduce((t, s, j) => t + (a["dv" + j] || 0), 0)).slice(0, 40);
  const tab = `<div class="card" style="margin-top:14px"><h3 class="h3c">Cidades onde os escolhidos tiveram mais votos <small class="nota">40 maiores · clique para abrir o comparativo da cidade</small></h3><div class="tab-wrap" style="max-height:460px"><table><thead><tr><th>Cidade</th>${E.deps.map(s => `<th style="box-shadow:inset 0 -3px 0 ${s.cor}">${esc(s.d.nome)} ${s.d.ano}</th><th>%</th>`).join("")}${E.deps.length > 1 ? "<th>Melhor</th>" : ""}<th>Lula 22</th><th>Lula 26</th><th>Jair 22</th><th>Flávio 26</th><th>Vencedor 26</th></tr></thead>
    <tbody>${topC.map(c => `<tr data-ch="${esc(c.chave)}"><td><b>${esc(c.nome)}</b></td>${E.deps.map((s, j) => `<td>${int(c["dv" + j])}</td><td>${pct(c["dp" + j], 2)}</td>`).join("")}${E.deps.length > 1 ? `<td>${c.melhor >= 0 ? `<span class="venc"><i style="background:${E.deps[c.melhor].cor}"></i>${esc(E.deps[c.melhor].d.nome)}</span>` : "–"}</td>` : ""}<td>${pct(c.lula22)}</td><td>${pct(c.lula26)}</td><td>${pct(c.bol22)}</td><td>${pct(c.bol26)}</td><td>${esc(NOME_EXIBE(c.venc26))}</td></tr>`).join("")}</tbody></table></div></div>`;
  $("#depCorpo").innerHTML = `<div class="dep-cards">${cards}</div>${pares}
    <div class="grid2" style="margin-top:14px">
      <div class="card"><h3 class="h3c">Do menos ao mais lulista</h3><canvas id="gQuint" height="270"></canvas><p class="nota">Cidades divididas em 5 grupos com o mesmo número de eleitores, pelo % do Lula em 2026. Barra = % dos válidos de cada deputado no grupo.</p></div>
      <div class="card"><h3 class="h3c" id="gDispT"></h3><canvas id="gDisp" height="270"></canvas><p class="nota">Cada bolinha é uma cidade; o tamanho é o número de eleitores.</p></div>
    </div>${tab}`;
  // gráfico por grupos lulistas
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
    options: {plugins: {legend: {display: E.deps.length > 1}, tooltip: {callbacks: {label: c => `${c.dataset.label}: ${dec(c.raw, 2)}% dos válidos`}}}, scales: {y: {title: {display: true, text: "% dos válidos"}, grid}, x: {grid: {display: false}}}}}));
  const mxA = Math.max(...ws), raio = c => 2 + 12 * Math.sqrt(c.aptos / mxA);
  if (E.deps.length === 1) {
    const s = E.deps[0], ano = s.d.ano;
    $("#gDispT").textContent = `% do Lula ${ano === 26 ? "2026" : "2022"} × % de ${s.d.nome}`;
    E.graficos.push(new Chart($("#gDisp"), {type: "bubble", data: {datasets: [{data: cid.map(c => ({x: (ano === 26 ? c.lula26 : c.lula22) * 100, y: (c.dp0 ?? 0) * 100, r: raio(c), nome: c.nome})), backgroundColor: s.cor + "70", borderColor: s.cor}]},
      options: {plugins: {legend: {display: false}, tooltip: {callbacks: {label: c => `${c.raw.nome}: Lula ${dec(c.raw.x, 1)}% · ${s.d.nome} ${dec(c.raw.y, 2)}%`}}}, scales: {x: {title: {display: true, text: "% do Lula"}, grid}, y: {title: {display: true, text: `% de ${s.d.nome}`}, grid}}}}));
  } else {
    const A = E.deps[0], Bd = E.deps[1];
    $("#gDispT").textContent = `${A.d.nome} ${A.d.ano} × ${Bd.d.nome} ${Bd.d.ano}, cidade por cidade`;
    E.graficos.push(new Chart($("#gDisp"), {type: "bubble", data: {datasets: [{data: cid.map(c => ({x: (c.dp0 ?? 0) * 100, y: (c.dp1 ?? 0) * 100, r: raio(c), nome: c.nome})), backgroundColor: "rgba(85,184,230,.4)", borderColor: COR.brand}]},
      options: {plugins: {legend: {display: false}, tooltip: {callbacks: {label: c => `${c.raw.nome}: ${A.d.nome} ${dec(c.raw.x, 2)}% · ${Bd.d.nome} ${dec(c.raw.y, 2)}%`}}},
        scales: {x: {title: {display: true, text: `% de ${A.d.nome} ${A.d.ano}`, color: A.cor}, grid}, y: {title: {display: true, text: `% de ${Bd.d.nome} ${Bd.d.ano}`, color: Bd.cor}, grid}}}}));
  }
  $("#depCorpo").querySelector("tbody").addEventListener("click", e => { const tr = e.target.closest("tr[data-ch]"); if (tr) { mudarNivel("mun"); abrir(tr.dataset.ch); } });
}

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
function preencherDeps() {
  const l = E.B.deputados.filter(d => (!E.filtroCargo || d.cargo === E.filtroCargo) && (!E.filtroAno || d.ano === E.filtroAno));
  $("#lDeps").innerHTML = l.map(d => `<option value="${esc(rotDep(d))}">${int(d.votos)} votos</option>`).join("");
}
$("#qUnidade").addEventListener("change", e => {
  const v = e.target.value, B = E.B, parte = v.split(" · ").slice(1).join(" · ");
  let nivel, chave;
  if (v.startsWith("Cidade · ")) { nivel = "mun"; chave = Object.keys(B.municipios).find(m => B.municipios[m].nome === parte); }
  else if (v.startsWith("Zona ")) { nivel = "zona"; chave = Object.keys(B.zonas).find(z => B.zonas[z].nome === v); }
  else nivel = {"Macrorregião": "me", "Microrregião": "mi", "Região intermediária": "ri", "Região imediata": "rm"}[v.split(" · ")[0]], chave = parte;
  if (!nivel || !chave) return;
  mudarNivel(nivel); abrir(chave); e.target.value = ""; e.target.blur();
});
$("#qDep").addEventListener("change", e => {
  const d = E.B.deputados.find(x => rotDep(x) === e.target.value);
  if (d) { e.target.value = ""; e.target.blur(); escolherDep(d); }
});
$("#filtroCargo").addEventListener("click", e => { const b = e.target.closest("[data-c]"); if (!b) return; E.filtroCargo = +b.dataset.c; $("#filtroCargo").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); preencherDeps(); });
$("#filtroAno").addEventListener("click", e => { const b = e.target.closest("[data-a]"); if (!b) return; E.filtroAno = +b.dataset.a; $("#filtroAno").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); preencherDeps(); });

/* ---------------- controles */
function mudarNivel(n) { E.nivel = n; $("#nivel").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x.dataset.n === n)); recalcular(); }
$("#nivel").addEventListener("click", e => { const b = e.target.closest("[data-n]"); if (b) { mudarNivel(b.dataset.n); $("#detalhe").hidden = true; } });
$("#turno").addEventListener("click", e => { const b = e.target.closest("[data-t]"); if (!b) return; E.turno = b.dataset.t; $("#turno").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); destaques(); recalcular(); secaoDeputados(); if (E.sel && !$("#detalhe").hidden) abrir(E.sel); });
function recalcular() {
  E.unidades = agrupar(E.nivel);
  quadro(somar(todasMz()), $("#quadro"));
  tabela(); desenharMapa();
}

/* ---------------- início */
(async function () {
  const [B, geo, top] = await Promise.all([fetch("dados/base.json").then(r => r.json()), fetch("dados/mg.geojson").then(r => r.json()), fetch("dados/top.json").then(r => r.json())]);
  E.B = B; E.geo = geo; E.top = top;
  E.partidos = new Map([...B.cand22["1"], ...B.cand22["2"], ...B.cand26].map(c => [c[0], c[1]]));
  E.fotos22 = new Map([...B.cand22["1"], ...B.cand22["2"]].filter(c => c[3]).map(c => [c[0], c[3]]));
  E.fotos26 = new Map(B.cand26.filter(c => c[3]).map(c => [c[0], c[3]]));
  preencherBuscas(); destaques(); recalcular(); chips(); secaoDeputados();
  topDeps("mg", $("#geralTop"), "Deputados mais votados em Minas");
  const n22 = B.deputados.filter(d => d.ano === 22).length, n26 = B.deputados.length - n22;
  $("#fontesTexto").innerHTML = `<p><b>Presidente 2022:</b> TSE, dados abertos (votação por candidato e detalhe da votação por município e zona eleitoral), 1º e 2º turnos, Minas Gerais.</p>
    <p><b>Presidente 2026:</b> boletins de urna publicados pelo TSE, somados por município e zona e conferidos com o arquivo oficial de detalhe por seção. Os totais podem ficar alguns votos abaixo do oficial por causa de poucas seções sem boletim publicado.</p>
    <p><b>Deputados:</b> ${int(n26)} candidatos de 2026 e ${int(n22)} de 2022 com voto em Minas (federais e estaduais). O % é sobre os votos válidos do mesmo cargo e ano. A mesma pessoa nos dois anos é ligada pelo nome completo registrado no TSE.</p>
    <p><b>Fotos:</b> fotos oficiais de candidatura divulgadas pelo TSE (2022: pacote de dados abertos; 2026: site de resultados).</p>
    <p><b>Regiões:</b> macrorregiões e microrregiões = mesorregiões e microrregiões geográficas do IBGE (Triângulo, Zona da Mata, Sul de Minas…); regiões intermediárias e imediatas = divisão regional atual do IBGE. <b>Zonas:</b> zonas eleitorais do TSE, posicionadas no mapa pelo centro dos seus locais de votação.</p>
    <p><b>Correlação:</b> mede, de −1 a +1, se dois números sobem e descem juntos nas cidades (cada cidade pesa pelo número de eleitores). Mostra coincidência geográfica, não causa.</p>`;
})();
