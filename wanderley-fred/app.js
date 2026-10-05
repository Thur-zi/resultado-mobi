/* Wanderley Porto (Dep. Estadual) × Fred Costa (Dep. Federal) — Eleições 2026 em Minas Gerais.
   Unidade básica: local de votação (escola); a página soma para bairro, regional, cidade, zona e regiões. */
"use strict";
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const nf = new Intl.NumberFormat("pt-BR");
const int = v => v == null || !isFinite(v) ? "–" : nf.format(Math.round(v));
const pct = (v, d = 1) => v == null || !isFinite(v) ? "–" : (v * 100).toLocaleString("pt-BR", {minimumFractionDigits: d, maximumFractionDigits: d}) + "%";
const pp = (v, d = 1) => v == null || !isFinite(v) ? "–" : (v > 0 ? "+" : "") + (v * 100).toLocaleString("pt-BR", {minimumFractionDigits: d, maximumFractionDigits: d}) + " p.p.";
const dec = (v, d = 1) => v == null || !isFinite(v) ? "–" : v.toLocaleString("pt-BR", {minimumFractionDigits: d, maximumFractionDigits: d});
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const semAc = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const COR = {w: "#ea5b22", f: "#55b8e6", creme: "#f8e9ca", ok: "#4fd18b", neg: "#ff7a6b"};
Chart.defaults.color = "#b8c3c8"; Chart.defaults.font.family = "Inter Tight, system-ui, sans-serif"; Chart.defaults.borderColor = "rgba(248,233,202,.08)";
const BH = "41238";
const E = {aba: "bh", graficos: {}, mapas: {}, osm: {}, cidade: null, nivelMG: "mun", modo: {}, camada: {}, ordem: {}, filtro: {}};

/* ---------------- animações: números contando, entrada ao rolar e gráficos que começam ao aparecer */
const calmo = matchMedia("(prefers-reduced-motion: reduce)").matches;
const NUM = /\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g;
function contar(el) {
  if (calmo || el.dataset.contou) return; el.dataset.contou = 1;
  const nos = []; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); while (w.nextNode()) { NUM.lastIndex = 0; if (NUM.test(w.currentNode.nodeValue)) nos.push([w.currentNode, w.currentNode.nodeValue]); }
  NUM.lastIndex = 0; if (!nos.length) return;
  const t0 = performance.now(), dur = 1100, ease = x => 1 - Math.pow(1 - x, 3);
  const passo = agora => {
    const k = ease(Math.min(1, (agora - t0) / dur));
    for (const [n, orig] of nos) n.nodeValue = orig.replace(NUM, m => { const casas = (m.split(",")[1] || "").length, v = parseFloat(m.replace(/\./g, "").replace(",", ".")) * k; return v.toLocaleString("pt-BR", {minimumFractionDigits: casas, maximumFractionDigits: casas, useGrouping: m.includes(".") || v >= 10000}); });
    if (k < 1) requestAnimationFrame(passo); else for (const [n, orig] of nos) n.nodeValue = orig;
  };
  requestAnimationFrame(passo);
}
const obsEntrada = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; const el = e.target; el.classList.add("visto"); el.querySelectorAll("[data-conta]").forEach(contar); if (el.matches("[data-conta]")) contar(el); obsEntrada.unobserve(el); }), {threshold: .12}) : null;
function animar(raiz) {
  const els = raiz.querySelectorAll(".card,.kpi,.dest,.lado,.meio,.insight,.cab,.mapa-wrap,.linha");
  els.forEach((el, i) => { el.classList.add("anim"); el.style.setProperty("--atraso", (i % 6) * 60 + "ms"); if (obsEntrada) obsEntrada.observe(el); else el.classList.add("visto"); });
  raiz.querySelectorAll(".nums b,.dest b,.kpi b,.meio .mbl em,.pp b").forEach(b => b.setAttribute("data-conta", ""));
}
const obsGraf = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; const f = E.pendentes?.get(e.target.id); if (f) { E.pendentes.delete(e.target.id); f(); } obsGraf.unobserve(e.target); }), {threshold: .15}) : null;

/* ---------------- agregação */
let ESC = [], TW = 1, TF = 1, TF22 = 1;
function soma(lista) {
  const o = {n: lista.length, el: 0, comp: 0, w: 0, f: 0, v7: 0, v6: 0, p7: 0, p6: 0, f22: 0, v6_22: 0};
  for (const e of lista) for (const k of ["el", "comp", "w", "f", "v7", "v6", "p7", "p6", "f22", "v6_22"]) o[k] += e[k];
  return derivar(o);
}
function derivar(o) {
  o.wp = o.v7 ? o.w / o.v7 : null; o.fp = o.v6 ? o.f / o.v6 : null;
  o.ws = o.w / TW; o.fs = o.f / TF;
  o.rel = (o.w + o.f) ? Math.log2((o.ws + 1e-5) / (o.fs + 1e-5)) : null;
  o.razao = o.f ? o.w / o.f * 100 : null;
  o.mais = (o.w + o.f) ? Math.log2((o.w + 1) / (o.f + 1)) : null;   // >0: Wanderley teve mais votos que o Fred no lugar
  o.f22p = o.v6_22 ? o.f22 / o.v6_22 : null; o.dF = o.fp != null && o.f22p != null ? o.fp - o.f22p : null; o.dFv = o.f - o.f22;
  o.wprd = o.p7 ? o.w / o.p7 : null; o.fprd = o.p6 ? o.f / o.p6 : null;
  return o;
}
function agrupar(lista, chave, nome, tipo) {
  const g = new Map();
  for (const e of lista) { const k = chave(e); if (k == null || k === "") continue; if (!g.has(k)) g.set(k, []); g.get(k).push(e); }
  return [...g].map(([k, l]) => Object.assign(soma(l), {chave: k, nome: nome ? nome(k, l) : k, tipo, escolas: l}));
}
const MUN = m => E.B.municipios[m];
const NIV = {mun: ["Cidades", "Cidade", e => e.mun, k => MUN(k)?.nome], zona: ["Zonas eleitorais", "Zona", e => String(e.zona), k => E.B.zonas[k]?.nome || "Zona " + k],
  me: ["Macrorregiões", "Macrorregião", e => MUN(e.mun)?.me, k => k], mi: ["Microrregiões", "Microrregião", e => MUN(e.mun)?.mi, k => "Microrregião de " + k],
  ri: ["Regiões intermediárias", "Região intermediária", e => MUN(e.mun)?.ri, k => "Região de " + k], rm: ["Regiões imediatas", "Região imediata", e => MUN(e.mun)?.rm, k => "Região de " + k]};
const CACHE = {};
const nivelMG = n => CACHE[n] || (CACHE[n] = agrupar(ESC, NIV[n][2], NIV[n][3], n));

/* ---------------- cores e modos */
const mistura = (c, t) => { const a = parseInt(c.slice(1), 16), b = 0x1a2329; const r = s => Math.round(((b >> s) & 255) * (1 - t) + ((a >> s) & 255) * t); return `rgb(${r(16)},${r(8)},${r(0)})`; };
const rampa = c => [.2, .38, .58, .8, 1].map(t => mistura(c, t));
const MODOS = [["mais", "Quem teve mais votos"], ["rel", "Peso no total de cada um"], ["wp", "Wanderley %"], ["fp", "Fred %"], ["w", "Wanderley votos"], ["f", "Fred votos"], ["razao", "Wanderley a cada 100 do Fred"], ["dF", "Fred 2022 → 2026"]];
const DIVREL = ["#2a8fc4", "#7cc4e8", "#8e979c", "#f2955f", "#ea5b22"];
const DIVD = ["#d9534a", "#f09a8f", "#8e979c", "#8fe0b2", "#3fbf7a"];
function quebras(v) { v = v.filter(x => x != null && isFinite(x)).sort((a, b) => a - b); return [.2, .4, .6, .8].map(q => v[Math.floor(q * (v.length - 1))]); }
function cor(u, modo, q) {
  if (!u || !(u.w + u.f + u.v7)) return "#26323a";
  const x = u[modo]; if (x == null || !isFinite(x)) return "#26323a";
  if (modo === "rel") return DIVREL[[-1, -.35, .35, 1].filter(t => x > t).length];
  if (modo === "mais") return DIVREL[[-1, -.14, .14, 1].filter(t => x > t).length];
  if (modo === "dF") return DIVD[[-.01, -.002, .002, .01].filter(t => x > t).length];
  const r = /^w/.test(modo) ? rampa(COR.w) : /^f/.test(modo) ? rampa(COR.f) : rampa(COR.creme);
  return r[q.filter(t => x > t).length];
}
const fmt = (modo, x) => modo === "wp" || modo === "fp" ? pct(x, 2) : modo === "dF" ? pp(x, 2) : modo === "razao" ? dec(x, 0) : int(x);
function legenda(modo, q) {
  if (modo === "mais") return ["Fred com o dobro ou mais", "Fred teve mais votos", "praticamente empatados", "Wanderley teve mais votos", "Wanderley com o dobro ou mais"].map((t, i) => `<span><b style="background:${DIVREL[i]}"></b>${t}</span>`).join("") + `<span class="nota">(votos do Wanderley para estadual × votos do Fred para federal no mesmo lugar)</span>`;
  if (modo === "rel") return ["Fred bem mais forte", "Fred mais forte", "equilibrado", "Wanderley mais forte", "Wanderley bem mais forte"].map((t, i) => `<span><b style="background:${DIVREL[i]}"></b>${t}</span>`).join("") + `<span class="nota">(comparando o peso de cada lugar no total de cada um)</span>`;
  if (modo === "dF") return ["caiu mais de 1 p.p.", "caiu", "estável", "subiu", "subiu mais de 1 p.p."].map((t, i) => `<span><b style="background:${DIVD[i]}"></b>${t}</span>`).join("");
  const r = /^w/.test(modo) ? rampa(COR.w) : /^f/.test(modo) ? rampa(COR.f) : rampa(COR.creme);
  return r.map((c, i) => `<span><b style="background:${c}"></b>${i === 0 ? "até " + fmt(modo, q[0]) : i === 4 ? "acima de " + fmt(modo, q[3]) : fmt(modo, q[i - 1]) + " a " + fmt(modo, q[i])}</span>`).join("");
}
const duas = u => `<span class="duas"><i class="bw" style="width:${Math.min(100, (u.wp || 0) / E.maxWp * 100)}%"></i><i class="bf" style="width:${Math.min(100, (u.fp || 0) / E.maxFp * 100)}%"></i></span>`;
function dica(u, tipo) {
  return `<b>${esc(u.nome)}</b>${tipo ? ` <small style="color:#8796a0">${tipo}</small>` : ""}<br><span style="color:${COR.w}">■</span> Wanderley: <b>${int(u.w)}</b> votos · ${pct(u.wp, 2)}<br><span style="color:${COR.f}">■</span> Fred: <b>${int(u.f)}</b> votos · ${pct(u.fp, 2)}<br><b>${u.w === u.f ? "Empate" : u.w > u.f ? `<span style="color:${COR.w}">Wanderley</span> teve mais votos` : `<span style="color:${COR.f}">Fred</span> teve mais votos`}</b> · Wanderley a cada 100 do Fred: <b>${dec(u.razao, 0)}</b>${u.f22 ? `<br>Fred em 2022: ${int(u.f22)} votos (${pp(u.dF, 2)})` : ""}`;
}

/* ---------------- abertura: duelo e destaques */
function duelo() {
  const c = E.B.cand, mg = soma(ESC), bh = soma(ESC.filter(e => e.mun === BH));
  const lado = (k, x, foto, selo, u) => `<div class="lado ${k}">
    <div class="topo-l"><img class="foto" src="fotos/${foto}" alt="Foto de ${esc(x.nome)}"><div><img class="selo" src="marca/${selo}" alt="${esc(x.nome)}"></div></div>
    <div class="nums"><div><b>${int(x.votos)}</b><span>votos em Minas</span></div><div><b>${pct(k === "w" ? mg.wp : mg.fp, 2)}</b><span>dos válidos do cargo</span></div><div><b>${pct(k === "w" ? bh.w / mg.w : bh.f / mg.f, 0)}</b><span>dos votos vieram de BH</span></div></div>
  </div>`;
  $("#duelo").innerHTML = lado("w", c.w, "wanderley.jpg", "selo-wanderley.png") +
    `<div class="meio"><span class="xx">×</span><span class="mt">A dobradinha</span>
      <p class="mq">A cada <b class="cf">100 votos do Fred</b>, quantos o <b class="cw">Wanderley</b> teve?</p>
      ${[["Em Minas", mg.razao], ["Em BH", bh.razao]].map(([n, r]) => `<div class="mr"><span class="mn">${n}</span>
        <div class="mbs"><div class="mbl"><i class="bf" style="width:100%"></i><em>Fred 100</em></div><div class="mbl"><i class="bw" style="width:${Math.min(100, r)}%"></i><em>Wanderley ${dec(r, 0)}</em></div></div></div>`).join("")}
    </div>` +
    lado("f", c.f, "fred.jpg", "selo-fred.png");
  animar($("#duelo"));
}
function destaques() {
  const mg = soma(ESC), bh = soma(ESC.filter(e => e.mun === BH)), cid = nivelMG("mun");
  const ambos = cid.filter(c => c.w > 0 && c.f > 0).length, soW = cid.filter(c => c.w > 0).length, soF = cid.filter(c => c.f > 0).length;
  const regs = agrupar(ESC.filter(e => e.mun === BH), e => e.regional, null, "regional");
  const rw = regs.slice().sort((a, b) => b.wp - a.wp)[0], rf = regs.slice().sort((a, b) => b.fp - a.fp)[0];
  const c = E.B.cand;
  $("#destaques").innerHTML = `
    <div class="dest"><span class="dl">Belo Horizonte · Wanderley</span><b class="cw">${int(bh.w)} votos</b><span>${pct(bh.wp, 2)} dos válidos para estadual · ${pct(bh.w / mg.w, 0)} de tudo que ele teve</span></div>
    <div class="dest"><span class="dl">Belo Horizonte · Fred</span><b class="cf">${int(bh.f)} votos</b><span>${pct(bh.fp, 2)} dos válidos para federal · ${pct(bh.f / mg.f, 0)} de tudo que ele teve</span></div>
    <div class="dest"><span class="dl">Regional mais forte em BH</span><b><span class="cw">${esc(rw.nome)}</span> · <span class="cf">${esc(rf.nome)}</span></b><span>Wanderley ${pct(rw.wp, 2)} · Fred ${pct(rf.fp, 2)}</span></div>
    <div class="dest"><span class="dl">Cidades com voto</span><b><span class="cw">${int(soW)}</span> · <span class="cf">${int(soF)}</span></b><span>Wanderley · Fred · os dois juntos em ${int(ambos)} cidades</span></div>
    <div class="dest"><span class="dl">Fred · 2022 → 2026</span><b class="${c.f.votos >= c.f.votos22 ? "pos" : "neg"}">${int(c.f.votos22)} → ${int(c.f.votos)}</b><span>${pct(c.f.votos / c.f.votos22 - 1)} · em 2022 pelo ${esc(c.f.partido22)}</span></div>
    <div class="dest"><span class="dl">Peso no partido (PRD)</span><b><span class="cw">${pct(mg.wprd, 0)}</span> · <span class="cf">${pct(mg.fprd, 0)}</span></b><span>dos votos do PRD para estadual · para federal, em Minas</span></div>`;
  animar($("#destaques"));
}

/* ---------------- abas */
function irAba(a, rolar = true) {
  E.aba = a;
  $$("#abas [data-aba]").forEach(b => b.setAttribute("aria-selected", b.dataset.aba === a));
  $$(".painel").forEach(p => p.hidden = p.id !== "p-" + a);
  if (history.replaceState) history.replaceState(null, "", "#" + a);
  if (a === "bh") cidade(BH, $("#p-bh"));
  if (a === "cidades") { chipsCidades(); cidade(E.cidade || E.B.cidadesOSM.find(m => m !== BH), $("#cidadeCorpo")); }
  if (a === "minas") minas();
  if (a === "escolas") escolas();
  if (a === "analises") analises();
  if (rolar) { const ctl = $("#controles"), fixa = getComputedStyle(ctl).position === "sticky" ? ctl.offsetHeight : 0; scrollTo({top: $("#p-" + a).getBoundingClientRect().top + scrollY - fixa - 10, behavior: "smooth"}); }
}
$("#abas").addEventListener("click", e => { const b = e.target.closest("[data-aba]"); if (b) irAba(b.dataset.aba); });
// clique numa barra/bolinha leva ao lugar no mapa
const aoClicar = f => ({onClick: (ev, els) => { if (els[0]) f(els[0].index); }, onHover: (ev, els) => { ev.native.target.style.cursor = els.length ? "pointer" : "default"; }});
function grafico(id, cfg, clique) {
  E.graficos[id]?.destroy(); const el = document.getElementById(id); if (!el) return;
  if (clique) Object.assign(cfg.options = cfg.options || {}, aoClicar(clique));
  cfg.options = Object.assign({animation: {duration: calmo ? 0 : 1100, easing: "easeOutQuart"}}, cfg.options);
  const criar = () => { E.graficos[id] = new Chart(el, cfg); };
  if (!obsGraf) return criar();
  (E.pendentes = E.pendentes || new Map()).set(id, criar); obsGraf.observe(el);
}
const grade = {color: "rgba(248,233,202,.07)"};

/* ---------------- uma cidade (BH e as cidades com regionais) */
function chipsCidades() {
  const l = E.B.cidadesOSM.filter(m => m !== BH).map(m => [m, soma(ESC.filter(e => e.mun === m))]).sort((a, b) => b[1].el - a[1].el);
  if (!E.cidade) E.cidade = l[0][0];
  $("#chipsCid").innerHTML = l.map(([m, u]) => `<button data-cid="${m}" aria-pressed="${m === E.cidade}">${esc(MUN(m).nome)}<small>${int(u.w)} · ${int(u.f)}</small></button>`).join("");
}
$("#chipsCid").addEventListener("click", e => { const b = e.target.closest("[data-cid]"); if (!b) return; E.cidade = b.dataset.cid; chipsCidades(); cidade(E.cidade, $("#cidadeCorpo")); });

function cidade(m, alvo) { E.desenhando = cidade_(m, alvo); return E.desenhando; }
function cidade_(m, alvo) {
  const lista = ESC.filter(e => e.mun === m), u = soma(lista), nome = MUN(m).nome, osm = E.B.cidadesOSM.includes(m), id = "c" + m;
  const regs = osm ? agrupar(lista, e => e.regional, null, "regional").sort((a, b) => b.el - a.el) : [];
  const bairros = agrupar(lista, e => e.bairro, null, "bairro");
  const escs = lista.map(e => Object.assign(derivar({...e, n: 1}), {nome: e.nome, tipo: "escola", chave: e.id, escolas: [e]}));
  E.ctx = E.ctx || {}; E.ctx[m] = {regs, bairros, escs, u};
  const ws = escs.filter(e => e.v7 && e.v6), r = correl(ws.map(e => e.wp), ws.map(e => e.fp), ws.map(e => e.el));
  const topW = escs.slice().sort((a, b) => b.w - a.w)[0], topF = escs.slice().sort((a, b) => b.f - a.f)[0];
  const regW = regs.slice().sort((a, b) => b.wp - a.wp)[0], regF = regs.slice().sort((a, b) => b.fp - a.fp)[0];
  const bairW = bairros.filter(b => b.v7 > 2000).sort((a, b) => b.wp - a.wp)[0], bairF = bairros.filter(b => b.v6 > 2000).sort((a, b) => b.fp - a.fp)[0];
  alvo.innerHTML = `
    <div class="cab"><h2>${esc(nome)}</h2><p>${int(lista.length)} locais de votação · ${int(u.el)} eleitores${osm ? ` · ${regs.length} regionais e ${int(bairros.length)} bairros com voto` : ""}. Toque em qualquer regional, bairro ou escola para ver os detalhes.</p></div>
    <div class="kpis">
      <div class="kpi"><b class="cw">${int(u.w)}</b><span>votos do Wanderley · ${pct(u.wp, 2)} dos válidos · ${pct(u.ws, 1)} do total dele</span></div>
      <div class="kpi"><b class="cf">${int(u.f)}</b><span>votos do Fred · ${pct(u.fp, 2)} dos válidos · ${pct(u.fs, 1)} do total dele</span></div>
      <div class="kpi"><b>${dec(u.razao, 0)}</b><span>votos do Wanderley a cada 100 do Fred</span></div>
      <div class="kpi"><b class="${u.dFv >= 0 ? "pos" : "neg"}">${int(u.f22)} → ${int(u.f)}</b><span>Fred em 2022 → 2026 (${pp(u.dF, 2)})</span></div>
      <div class="kpi"><b>${dec(r, 2)}</b><span>correlação entre os dois nas escolas (−1 a +1)</span></div>
    </div>
    <p class="insight">${osm ? `Regional mais forte: <b class="cw">${esc(regW.nome)}</b> para o Wanderley (${pct(regW.wp, 2)}) e <b class="cf">${esc(regF.nome)}</b> para o Fred (${pct(regF.fp, 2)}). ` : ""}${bairW ? `Bairro mais forte: <b class="cw">${esc(bairW.nome)}</b> (${pct(bairW.wp, 2)}) e <b class="cf">${esc(bairF?.nome)}</b> (${pct(bairF?.fp, 2)}). ` : ""}Escola com mais votos: <b class="cw">${esc(topW.nome)}</b> (${int(topW.w)}) e <b class="cf">${esc(topF.nome)}</b> (${int(topF.f)}). ${Math.abs(r) < .2 ? "Os dois votam em lugares diferentes da cidade: a força de um quase não acompanha a do outro." : r > 0 ? "Onde um é forte, o outro tende a ser forte também: a dobradinha anda junta." : "Onde um é forte, o outro tende a ser mais fraco."}</p>
    <div class="cab"><h3>Mapa${osm ? " de bairros, regionais e escolas" : " das escolas"}</h3></div>
    <div class="linha"><span class="rot">Mostrar</span><div class="seg" data-camada="${m}">${(osm ? [["bairro", "Bairros"], ["regional", "Regionais"], ["escola", "Escolas"]] : [["escola", "Escolas"]]).map(([k, n]) => `<button data-v="${k}" aria-pressed="${(E.camada[m] || (osm ? "bairro" : "escola")) === k}">${n}</button>`).join("")}</div></div>
    <div class="linha"><span class="rot">Pintar por</span><div class="seg" data-modo="${m}">${MODOS.map(([k, n]) => `<button data-v="${k}" aria-pressed="${(E.modo[m] || "mais") === k}">${n}</button>`).join("")}</div></div>
    <div class="mapa-wrap"><div><div class="mapa" id="mapa-${id}"></div><div class="legenda" id="leg-${id}"></div></div><aside class="card lateral" id="lat-${id}"></aside></div>
    ${osm ? `<div class="cab"><h3>Por regional</h3></div>
    <div class="grid2"><div class="card"><h4>% dos válidos por regional <small>toque numa barra para ver no mapa</small></h4><canvas id="g-reg-${id}" height="300"></canvas></div><div class="card"><h4>De onde vieram os votos <small>parte do total da cidade em cada regional</small></h4><canvas id="g-regs-${id}" height="300"></canvas></div></div>
    <div class="card" style="margin-top:14px">${tabela(regs, "Regional", "reg-" + id)}</div>` : ""}
    <div class="cab"><h3>Bairros</h3></div>
    <div class="grid2"><div class="card"><h4><span class="cw">Wanderley</span> · bairros com mais votos</h4>${rank(bairros, "w", 15)}</div><div class="card"><h4><span class="cf">Fred</span> · bairros com mais votos</h4>${rank(bairros, "f", 15)}</div></div>
    <div class="card" style="margin-top:14px">${tabela(bairros, "Bairro", "bai-" + id)}</div>
    <div class="cab"><h3>Escolas</h3></div>
    <div class="grid2"><div class="card"><h4>Cada escola: % do Fred × % do Wanderley <small>tamanho = eleitores · toque para ver no mapa</small></h4><canvas id="g-disp-${id}" height="320"></canvas></div>
      <div class="card"><h4>As 15 escolas com mais votos dos dois juntos</h4><canvas id="g-esc-${id}" height="320"></canvas></div></div>
    <div class="grid2" style="margin-top:14px"><div class="card"><h4><span class="cw">Wanderley</span> · escolas com mais votos</h4>${rank(escs, "w", 15)}</div><div class="card"><h4><span class="cf">Fred</span> · escolas com mais votos</h4>${rank(escs, "f", 15)}</div></div>
    <div class="card" style="margin-top:14px">${tabela(escs, "Escola", "esc-" + id, true)}</div>`;
  // gráficos
  if (osm) {
    grafico(`g-reg-${id}`, {type: "bar", data: {labels: regs.map(r => r.nome), datasets: [{label: "Wanderley", data: regs.map(r => r.wp * 100), backgroundColor: COR.w, borderRadius: 5}, {label: "Fred", data: regs.map(r => r.fp * 100), backgroundColor: COR.f, borderRadius: 5}]},
      options: {indexAxis: "y", plugins: {tooltip: {callbacks: {label: c => `${c.dataset.label}: ${dec(c.raw, 2)}%`}}}, scales: {x: {grid: grade, title: {display: true, text: "% dos válidos"}}, y: {grid: {display: false}}}}}, i => verNoMapa("regional", regs[i].chave, m));
    grafico(`g-regs-${id}`, {type: "bar", data: {labels: regs.map(r => r.nome), datasets: [{label: "Wanderley", data: regs.map(r => r.w / u.w * 100), backgroundColor: COR.w, borderRadius: 5}, {label: "Fred", data: regs.map(r => r.f / u.f * 100), backgroundColor: COR.f, borderRadius: 5}, {label: "Eleitores", data: regs.map(r => r.el / u.el * 100), backgroundColor: "rgba(248,233,202,.35)", borderRadius: 5}]},
      options: {indexAxis: "y", plugins: {tooltip: {callbacks: {label: c => `${c.dataset.label}: ${dec(c.raw, 1)}% do total da cidade`}}}, scales: {x: {grid: grade, title: {display: true, text: "% do total na cidade"}}, y: {grid: {display: false}}}}}, i => verNoMapa("regional", regs[i].chave, m));
  }
  const mxE = Math.max(...escs.map(e => e.el));
  grafico(`g-disp-${id}`, {type: "bubble", data: {datasets: [{data: ws.map(e => ({x: e.fp * 100, y: e.wp * 100, r: 2 + 10 * Math.sqrt(e.el / mxE), nome: e.nome, b: e.bairro})), backgroundColor: ws.map(e => (e.rel > 0 ? "rgba(234,91,34,.55)" : "rgba(85,184,230,.55)")), borderColor: "rgba(248,233,202,.35)"}]},
    options: {plugins: {legend: {display: false}, tooltip: {callbacks: {label: c => `${c.raw.nome} (${c.raw.b}): Fred ${dec(c.raw.x, 2)}% · Wanderley ${dec(c.raw.y, 2)}%`}}}, scales: {x: {grid: grade, title: {display: true, text: "% do Fred (federal)"}}, y: {grid: grade, title: {display: true, text: "% do Wanderley (estadual)"}}}}}, i => verNoMapa("escola", ws[i].chave, m));
  const top15 = escs.slice().sort((a, b) => (b.w + b.f) - (a.w + a.f)).slice(0, 15);
  grafico(`g-esc-${id}`, {type: "bar", data: {labels: top15.map(e => e.nome.length > 30 ? e.nome.slice(0, 29) + "…" : e.nome), datasets: [{label: "Wanderley", data: top15.map(e => e.w), backgroundColor: COR.w, borderRadius: 4}, {label: "Fred", data: top15.map(e => e.f), backgroundColor: COR.f, borderRadius: 4}]},
    options: {indexAxis: "y", plugins: {tooltip: {callbacks: {label: c => `${c.dataset.label}: ${int(c.raw)} votos`}}}, scales: {x: {stacked: true, grid: grade}, y: {stacked: true, grid: {display: false}, ticks: {font: {size: 11}}}}}}, i => verNoMapa("escola", top15[i].chave, m));
  animar(alvo);
  return mapaCidade(m);
}

/* ranking e tabela genéricos */
const rank = (l, k, n) => `<ol class="rank">${l.slice().sort((a, b) => b[k] - a[k]).slice(0, n).map(u => `<li><button data-pop="${u.tipo}|${esc(u.chave)}|${u.escolas[0].mun}"><span>${esc(u.nome)}</span>${duas(u)}<b class="${k === "w" ? "cw" : "cf"}">${int(u[k])}</b></button></li>`).join("")}</ol>`;
const COLS = [["el", "Eleitores", int], ["w", "Wanderley", int, "tw"], ["wp", "% válidos", x => pct(x, 2), "tw"], ["ws", "% do total dele", x => pct(x, 2), "tw"], ["f", "Fred", int, "tf"], ["fp", "% válidos", x => pct(x, 2), "tf"], ["fs", "% do total dele", x => pct(x, 2), "tf"],
  ["razao", "W a cada 100 F", x => dec(x, 0)], ["f22", "Fred 2022", int, "tf"], ["dF", "Δ Fred", x => `<span class="${x > 0 ? "pos" : "neg"}">${pp(x, 2)}</span>`, "tf"]];
function tabela(l, rot, id, comBairro) {
  E.tabs = E.tabs || {}; E.tabs[id] = {l, rot, comBairro};
  const o = E.ordem[id] || {k: "w", dir: -1}, filtro = semAc(E.filtro[id] || "");
  const linhas = l.filter(u => !filtro || semAc(u.nome + " " + (u.escolas[0].bairro || "")).includes(filtro)).sort((a, b) => o.k === "nome" ? a.nome.localeCompare(b.nome) * o.dir : ((a[o.k] ?? -1e9) - (b[o.k] ?? -1e9)) * o.dir);
  return `<div class="ferr" data-tab="${id}"><h4 style="margin:0;flex:1">${rot === "Escola" ? "Todas as escolas" : rot === "Bairro" ? "Todos os bairros" : rot + "s"} <small>${int(l.length)} · toque no título da coluna para ordenar</small></h4><input type="search" placeholder="Filtrar…" value="${esc(E.filtro[id] || "")}" data-filtro="${id}"><button class="btn" data-csv="${id}">Baixar CSV</button></div>
    <div class="tab-wrap" id="tw-${id}"><table><thead><tr><th data-ord="${id}|nome">${rot}</th>${comBairro ? "<th>Bairro</th>" : ""}${COLS.map(([k, t, , c]) => `<th class="${c || ""}" data-ord="${id}|${k}">${t}${o.k === k ? (o.dir < 0 ? " ↓" : " ↑") : ""}</th>`).join("")}</tr></thead>
    <tbody>${linhas.map(u => `<tr data-pop="${u.tipo}|${esc(u.chave)}|${u.escolas[0].mun}"><td><b>${esc(u.nome)}</b></td>${comBairro ? `<td style="text-align:left">${esc(u.escolas[0].bairro)}</td>` : ""}${COLS.map(([k, , f]) => `<td>${f(u[k])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function retabela(id) { const t = E.tabs[id]; const box = $(`[data-tab="${id}"]`).parentElement; const foco = document.activeElement?.dataset?.filtro === id; box.innerHTML = tabela(t.l, t.rot, id, t.comBairro); if (foco) { const i = box.querySelector("[data-filtro]"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
document.addEventListener("click", e => {
  const th = e.target.closest("[data-ord]"); if (th) { const [id, k] = th.dataset.ord.split("|"); const o = E.ordem[id] || {k: "w", dir: -1}; E.ordem[id] = o.k === k ? {k, dir: -o.dir} : {k, dir: -1}; retabela(id); return; }
  const c = e.target.closest("[data-csv]"); if (c) { const t = E.tabs[c.dataset.csv]; const linhas = [[t.rot, ...(t.comBairro ? ["Bairro"] : []), "Eleitores", "Wanderley", "Wanderley % válidos", "Fred", "Fred % válidos", "W a cada 100 F", "Fred 2022"].join(";")].concat(t.l.map(u => [u.nome, ...(t.comBairro ? [u.escolas[0].bairro] : []), u.el, u.w, dec(u.wp * 100, 3), u.f, dec(u.fp * 100, 3), dec(u.razao, 1), u.f22].map(x => `"${String(x).replace(/"/g, '""')}"`).join(";")));
    Object.assign(document.createElement("a"), {href: URL.createObjectURL(new Blob(["﻿" + linhas.join("\n")], {type: "text/csv"})), download: `wanderley-fred-${c.dataset.csv}.csv`}).click(); }
});
document.addEventListener("input", e => { const f = e.target.closest("[data-filtro]"); if (f) { E.filtro[f.dataset.filtro] = f.value; retabela(f.dataset.filtro); } });

/* mapa da cidade: bairros, regionais (contornos oficiais) e escolas */
async function mapaCidade(m) {
  const id = "c" + m, el = $("#mapa-" + id); if (!el) return;
  const ibge = MUN(m).ibge, osm = E.B.cidadesOSM.includes(m);
  if (osm && !E.osm[ibge]) E.osm[ibge] = await fetch(`dados/osm/${ibge}.json`).then(r => r.json());
  if (E.mapas[id]) { E.mapas[id].remove(); }
  E.reg[id] = new Map();
  const mapa = L.map(el, {scrollWheelZoom: false, preferCanvas: true, zoomSnap: .25});
  L.tileLayer("https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {attribution: "Esri · OpenStreetMap · TSE", maxZoom: 17}).addTo(mapa);
  mapa.on("click focus", () => mapa.scrollWheelZoom.enable());
  E.mapas[id] = mapa;
  const ctx = E.ctx[m], camada = E.camada[m] || (osm ? "bairro" : "escola"), modo = E.modo[m] || "mais";
  const lista = camada === "regional" ? ctx.regs : camada === "bairro" ? ctx.bairros : ctx.escs, q = quebras(lista.map(u => u[modo]));
  const porNome = new Map(lista.map(u => [u.nome, u])), grupo = L.featureGroup().addTo(mapa);
  if (osm && camada !== "escola") {
    const fc = camada === "regional" ? E.osm[ibge].regionais : E.osm[ibge].bairros;
    L.geoJSON(fc, {style: f => { const u = porNome.get(f.properties.nome); return {color: "#141c21", weight: camada === "regional" ? 1.6 : .7, fillOpacity: u ? .9 : .25, fillColor: cor(u, modo, q)}; },
      onEachFeature: (f, l) => { const u = porNome.get(f.properties.nome); l.bindTooltip(u ? dica(u, camada === "regional" ? "regional" : "bairro") : `<b>${esc(f.properties.nome)}</b><br><small>sem local de votação</small>`, {sticky: true}); if (u) { l.on("click", ev => popover(u, ev.originalEvent)); registrar(id, `${camada}|${u.chave}`, l); } }}).addTo(grupo);
  }
  if (osm && camada !== "escola") L.geoJSON(E.osm[ibge].regionais, {style: {color: "rgba(248,233,202,.55)", weight: 1.4, fill: false}, interactive: false}).addTo(grupo);
  if (camada === "escola" || !osm) {
    const mx = Math.max(...ctx.escs.map(e => e.el));
    for (const u of ctx.escs) { const e = u.escolas[0]; if (e.lat == null) continue;
      const mk = L.circleMarker([e.lat, e.lng], {radius: 3 + 9 * Math.sqrt(e.el / mx), color: "#141c21", weight: .8, fillOpacity: .92, fillColor: cor(u, modo, q)}).bindTooltip(dica(u, "escola · " + e.bairro), {sticky: true}).on("click", ev => popover(u, ev.originalEvent)).addTo(grupo); registrar(id, `escola|${u.chave}`, mk); }
  }
  const b = grupo.getBounds(); if (b.isValid()) mapa.fitBounds(b, {padding: [10, 10]});
  new ResizeObserver(() => { mapa.invalidateSize(); }).observe(el);
  $("#leg-" + id).innerHTML = legenda(modo, q);
  const nomeC = {regional: "regionais", bairro: "bairros", escola: "escolas"}[camada], mn = MODOS.find(x => x[0] === modo)[1];
  const ordenada = lista.filter(u => u[modo] != null && isFinite(u[modo])).sort((a, b) => b[modo] - a[modo]);
  const maisW = lista.filter(u => u.w > u.f).sort((a, b) => (b.w - b.f) - (a.w - a.f)), maisF = lista.filter(u => u.f > u.w).sort((a, b) => (b.f - b.w) - (a.f - a.w));
  const itemD = u => `<li><button data-pop="${u.tipo}|${esc(u.chave)}|${m}"><span>${esc(u.nome)}</span><b><span class="cw">${int(u.w)}</span> · <span class="cf">${int(u.f)}</span></b></button></li>`;
  if (modo === "mais") { $("#lat-" + id).innerHTML = `<h4>Quem teve mais votos <small>${nomeC}</small></h4><p class="nota"><b class="cw">${int(maisW.length)}</b> ${nomeC} com mais Wanderley · <b class="cf">${int(maisF.length)}</b> com mais Fred</p><h4 class="cw" style="margin-top:12px">Wanderley na frente</h4><ol class="rank">${maisW.slice(0, 10).map(itemD).join("") || "<li class='nota'>nenhum</li>"}</ol><h4 class="cf" style="margin-top:12px">Fred na frente</h4><ol class="rank">${maisF.slice(0, 10).map(itemD).join("") || "<li class='nota'>nenhum</li>"}</ol>`; return; }
  $("#lat-" + id).innerHTML = modo === "rel"
    ? `<h4>Onde cada um pesa mais <small>${nomeC}</small></h4><p class="nota">Compara o peso de cada lugar no total de votos de cada candidato.</p><h4 class="cw" style="margin-top:12px">Mais Wanderley</h4><ol class="rank">${ordenada.filter(u => u.w + u.f > 20).slice(0, 10).map(u => `<li><button data-pop="${u.tipo}|${esc(u.chave)}|${m}"><span>${esc(u.nome)}</span><b>${int(u.w)} · ${int(u.f)}</b></button></li>`).join("")}</ol><h4 class="cf" style="margin-top:12px">Mais Fred</h4><ol class="rank">${ordenada.filter(u => u.w + u.f > 20).reverse().slice(0, 10).map(u => `<li><button data-pop="${u.tipo}|${esc(u.chave)}|${m}"><span>${esc(u.nome)}</span><b>${int(u.w)} · ${int(u.f)}</b></button></li>`).join("")}</ol>`
    : `<h4>${esc(mn)} <small>${nomeC}</small></h4><h4 style="margin-top:10px">Maiores</h4><ol class="rank">${ordenada.slice(0, 12).map(u => `<li><button data-pop="${u.tipo}|${esc(u.chave)}|${m}"><span>${esc(u.nome)}</span><b>${fmt(modo, u[modo])}</b></button></li>`).join("")}</ol><h4 style="margin-top:12px">Menores</h4><ol class="rank">${ordenada.slice(-8).reverse().map(u => `<li><button data-pop="${u.tipo}|${esc(u.chave)}|${m}"><span>${esc(u.nome)}</span><b>${fmt(modo, u[modo])}</b></button></li>`).join("")}</ol>`;
}
document.addEventListener("click", e => {
  const c = e.target.closest("[data-camada] [data-v]"); if (c) { const m = c.parentElement.dataset.camada; E.camada[m] = c.dataset.v; $$(`[data-camada="${m}"] button`).forEach(b => b.setAttribute("aria-pressed", b === c)); mapaCidade(m); return; }
  const d = e.target.closest("[data-modo] [data-v]"); if (d) { const m = d.parentElement.dataset.modo; E.modo[m] = d.dataset.v; $$(`[data-modo="${m}"] button`).forEach(b => b.setAttribute("aria-pressed", b === d)); if (m === "mg") mapaMG(); else mapaCidade(m); }
});

/* ---------------- destaque no mapa e "ver no mapa" */
E.reg = {};   // mapa -> chave "tipo|chave" -> camadas
function registrar(mapaId, chave, camada) { const m = E.reg[mapaId] || (E.reg[mapaId] = new Map()); if (!m.has(chave)) m.set(chave, []); m.get(chave).push(camada); }
function destacar(chave, liga) {
  for (const m of Object.values(E.reg)) for (const ly of m.get(chave) || []) {
    if (liga) { if (!ly._orig) ly._orig = {color: ly.options.color, weight: ly.options.weight, fillOpacity: ly.options.fillOpacity, raio: ly.getRadius?.()}; ly.setStyle({color: "#ffffff", weight: ly.getRadius ? 3 : 3.2, fillOpacity: 1}); if (ly.getRadius) ly.setRadius(ly._orig.raio * 1.7); ly.bringToFront?.(); }
    else if (ly._orig) { ly.setStyle({color: ly._orig.color, weight: ly._orig.weight, fillOpacity: ly._orig.fillOpacity}); if (ly.getRadius) ly.setRadius(ly._orig.raio); }
  }
}
let hoverAtual = null;
document.addEventListener("mouseover", e => { const p = e.target.closest("[data-pop]"); const k = p ? p.dataset.pop.split("|").slice(0, 2).join("|") : null; if (k === hoverAtual) return; if (hoverAtual) destacar(hoverAtual, false); hoverAtual = k; if (k) destacar(k, true); });
function piscar(lys) { let n = 0; const t = setInterval(() => { lys.forEach(l => l.setStyle({color: n % 2 ? "#ffffff" : COR.creme, weight: n % 2 ? 4 : 2})); if (++n > 7) clearInterval(t); }, 220); }
async function verNoMapa(tipo, chave, mun) {
  $("#pop").hidden = true;
  const chaveR = `${tipo}|${chave}`, osm = E.B.cidadesOSM.includes(mun);
  let mapaId;
  if (["bairro", "regional", "escola"].includes(tipo) && osm) {
    E.camada[mun] = tipo; mapaId = "c" + mun;
    if (mun === BH) { if (E.aba !== "bh") irAba("bh", false); else await mapaCidade(mun); } else { E.cidade = mun; irAba("cidades", false); }
    await new Promise(r => setTimeout(r, 50)); await E.desenhando;
    $$(`[data-camada="${mun}"] button`).forEach(b => b.setAttribute("aria-pressed", b.dataset.v === tipo));
  } else {
    const nv = NIV[tipo] ? tipo : "mun";
    if (E.aba !== "minas" || E.nivelMG !== nv) { E.nivelMG = nv; irAba("minas", false); }
    await new Promise(r => setTimeout(r, 50)); await E.desenhando; mapaId = "mg";
  }
  const mapa = E.mapas[mapaId], el = $("#mapa-" + mapaId); if (!mapa || !el) return;
  const ctl = $("#controles"), fixa = getComputedStyle(ctl).position === "sticky" ? ctl.offsetHeight : 0;
  scrollTo({top: el.getBoundingClientRect().top + scrollY - fixa - 16, behavior: "smooth"});
  const lys = E.reg[mapaId]?.get(chaveR) || [];
  if (!lys.length && tipo === "escola") {   // escola de cidade sem contornos: marca no mapa de Minas
    const e0 = ESC[+chave]; if (e0?.lat == null) return;
    L.circleMarker([e0.lat, e0.lng], {radius: 9, color: "#fff", weight: 3, fillColor: COR.w, fillOpacity: 1}).bindTooltip(dica(acharUnidade("escola", chave, mun), "escola"), {permanent: true, direction: "top"}).addTo(mapa);
    mapa.flyTo([e0.lat, e0.lng], 14, {duration: 1}); return;
  }
  if (!lys.length) return;
  if (lys[0].getLatLng && lys.length === 1) mapa.flyTo(lys[0].getLatLng(), Math.max(mapa.getZoom(), 15), {duration: 1}); else mapa.flyToBounds(L.featureGroup(lys).getBounds().pad(.4), {duration: 1, maxZoom: 15});
  setTimeout(() => { lys.forEach(l => l.bringToFront?.()); lys[0].openTooltip?.(); piscar(lys); }, 1050);
}
document.addEventListener("click", e => { const v = e.target.closest("[data-ver]"); if (v) { e.preventDefault(); const [t, c, m] = v.dataset.ver.split("|"); verNoMapa(t, c, m); } });

/* ---------------- Minas Gerais */
function minas() {
  const nv = E.nivelMG, l = nivelMG(nv), mg = soma(ESC);
  const fora = soma(ESC.filter(e => e.mun !== BH)), ri = soma(ESC.filter(e => MUN(e.mun)?.ri === "Belo Horizonte" && e.mun !== BH));
  const top = nivelMG("mun").slice().sort((a, b) => (b.w + b.f) - (a.w + a.f)).slice(0, 20);
  $("#p-minas").innerHTML = `<div class="cab"><h2>Minas Gerais</h2><p>Os dois em todo o estado: cidades, zonas eleitorais, macrorregiões, microrregiões e regiões do IBGE. Toque num lugar para ver os detalhes.</p></div>
    <div class="kpis"><div class="kpi"><b class="cw">${int(fora.w)}</b><span>votos do Wanderley fora de BH (${pct(fora.w / mg.w, 0)})</span></div><div class="kpi"><b class="cf">${int(fora.f)}</b><span>votos do Fred fora de BH (${pct(fora.f / mg.f, 0)})</span></div>
      <div class="kpi"><b>${int(ri.w)} · ${int(ri.f)}</b><span>no resto da região de BH (Wanderley · Fred)</span></div><div class="kpi"><b>${int(nivelMG("mun").filter(c => c.w > 0).length)} · ${int(nivelMG("mun").filter(c => c.f > 0).length)}</b><span>cidades com voto (Wanderley · Fred)</span></div></div>
    <div class="linha"><span class="rot">Ver por</span><div class="seg" id="nivelMG">${Object.entries(NIV).map(([k, v]) => `<button data-n="${k}" aria-pressed="${k === nv}">${v[0]}</button>`).join("")}</div></div>
    <div class="linha"><span class="rot">Pintar por</span><div class="seg" data-modo="mg">${MODOS.map(([k, n]) => `<button data-v="${k}" aria-pressed="${(E.modo.mg || "mais") === k}">${n}</button>`).join("")}</div></div>
    <div class="mapa-wrap"><div><div class="mapa" id="mapa-mg"></div><div class="legenda" id="leg-mg"></div></div><aside class="card lateral" id="lat-mg"></aside></div>
    <div class="grid2" style="margin-top:14px"><div class="card"><h4>As 20 cidades com mais votos dos dois</h4><canvas id="g-topcid" height="420"></canvas></div><div class="card"><h4>Macrorregiões: % dos válidos</h4><canvas id="g-macro" height="420"></canvas></div></div>
    <div class="card" style="margin-top:14px">${tabela(l, NIV[nv][1], "mg-" + nv)}</div>`;
  grafico("g-topcid", {type: "bar", data: {labels: top.map(c => c.nome), datasets: [{label: "Wanderley", data: top.map(c => c.w), backgroundColor: COR.w, borderRadius: 4}, {label: "Fred", data: top.map(c => c.f), backgroundColor: COR.f, borderRadius: 4}]},
    options: {indexAxis: "y", plugins: {tooltip: {callbacks: {label: c => `${c.dataset.label}: ${int(c.raw)} votos`}}}, scales: {x: {grid: grade, type: "logarithmic", title: {display: true, text: "votos (escala log)"}}, y: {grid: {display: false}}}}}, i => verNoMapa("mun", top[i].chave, top[i].chave));
  const me = nivelMG("me").slice().sort((a, b) => b.fp - a.fp);
  grafico("g-macro", {type: "bar", data: {labels: me.map(c => c.nome), datasets: [{label: "Wanderley", data: me.map(c => c.wp * 100), backgroundColor: COR.w, borderRadius: 4}, {label: "Fred", data: me.map(c => c.fp * 100), backgroundColor: COR.f, borderRadius: 4}]},
    options: {indexAxis: "y", plugins: {tooltip: {callbacks: {label: c => `${c.dataset.label}: ${dec(c.raw, 2)}%`}}}, scales: {x: {grid: grade, title: {display: true, text: "% dos válidos"}}, y: {grid: {display: false}}}}}, i => verNoMapa("me", me[i].chave, ""));
  animar($("#p-minas"));
  E.desenhando = mapaMG(); return E.desenhando;
}
document.addEventListener("click", e => { const b = e.target.closest("#nivelMG [data-n]"); if (b) { E.nivelMG = b.dataset.n; minas(); } });
async function mapaMG() {
  if (!E.geo) E.geo = await fetch("dados/mg.geojson").then(r => r.json());
  const el = $("#mapa-mg"); if (!el) return;
  if (E.mapas.mg) E.mapas.mg.remove();
  E.reg.mg = new Map();
  const mapa = L.map(el, {scrollWheelZoom: false, preferCanvas: true, zoomSnap: .25}); E.mapas.mg = mapa;
  L.tileLayer("https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {attribution: "Esri · IBGE · TSE", maxZoom: 14}).addTo(mapa);
  mapa.on("click focus", () => mapa.scrollWheelZoom.enable());
  const nv = E.nivelMG, modo = E.modo.mg || "mais", l = nivelMG(nv), nvMapa = nv === "zona" ? "mun" : nv, lm = nivelMG(nvMapa);
  const unidadeDe = new Map(); for (const u of lm) for (const e of u.escolas) unidadeDe.set(e.mun, u);
  const ibgeMun = new Map(Object.entries(E.B.municipios).map(([m, x]) => [x.ibge, m])), q = quebras(lm.map(u => u[modo]));
  const grupo = L.featureGroup().addTo(mapa);
  L.geoJSON(E.geo, {style: f => { const u = unidadeDe.get(ibgeMun.get(f.properties.ibge)); return {color: nvMapa === "mun" ? "#141c21" : "rgba(20,28,33,.4)", weight: nvMapa === "mun" ? .4 : .2, fillOpacity: nv === "zona" ? .25 : .9, fillColor: cor(u, modo, q)}; },
    onEachFeature: (f, ly) => { const u = unidadeDe.get(ibgeMun.get(f.properties.ibge)); if (!u) return; ly.bindTooltip(dica(u, NIV[nvMapa][1].toLowerCase()), {sticky: true}); ly.on("click", ev => popover(u, ev.originalEvent)); registrar("mg", `${u.tipo}|${u.chave}`, ly); }}).addTo(grupo);
  if (nvMapa !== "mun") L.polyline(bordasRegiao(nvMapa, ib => NIV[nvMapa][2]({mun: ibgeMun.get(ib)})), {color: "#f8e9ca", weight: 1.4, opacity: .85, interactive: false}).addTo(grupo);
  if (nv === "zona") {
    const qz = quebras(l.map(u => u[modo])), mx = Math.max(...l.map(u => u.el));
    for (const u of l) { const c = u.escolas.filter(e => e.lat != null); if (!c.length) continue; const t = c.reduce((a, e) => a + e.el, 0), lat = c.reduce((a, e) => a + e.lat * e.el, 0) / t, lng = c.reduce((a, e) => a + e.lng * e.el, 0) / t;
      const mk = L.circleMarker([lat, lng], {radius: 4 + 12 * Math.sqrt(u.el / mx), color: "#141c21", weight: 1, fillOpacity: .92, fillColor: cor(u, modo, qz)}).bindTooltip(dica(u, "zona"), {sticky: true}).on("click", ev => popover(u, ev.originalEvent)).addTo(grupo); registrar("mg", `zona|${u.chave}`, mk); }
  }
  mapa.fitBounds(grupo.getBounds()); new ResizeObserver(() => mapa.invalidateSize()).observe(el);
  $("#leg-mg").innerHTML = legenda(modo, nv === "zona" ? quebras(l.map(u => u[modo])) : q);
  const ord = l.filter(u => u[modo] != null && isFinite(u[modo]) && u.w + u.f > 30).sort((a, b) => b[modo] - a[modo]), mn = MODOS.find(x => x[0] === modo)[1];
  const item = u => `<li><button data-pop="${u.tipo}|${esc(u.chave)}|"><span>${esc(u.nome)}</span><b>${modo === "rel" ? int(u.w) + " · " + int(u.f) : fmt(modo, u[modo])}</b></button></li>`;
  if (modo === "mais") { const mw = l.filter(u => u.w > u.f).sort((a, b) => (b.w - b.f) - (a.w - a.f)), mf = l.filter(u => u.f > u.w).sort((a, b) => (b.f - b.w) - (a.f - a.w)), it = u => `<li><button data-pop="${u.tipo}|${esc(u.chave)}|"><span>${esc(u.nome)}</span><b><span class="cw">${int(u.w)}</span> · <span class="cf">${int(u.f)}</span></b></button></li>`;
    $("#lat-mg").innerHTML = `<h4>Quem teve mais votos <small>${NIV[nv][0].toLowerCase()}</small></h4><p class="nota"><b class="cw">${int(mw.length)}</b> com mais Wanderley · <b class="cf">${int(mf.length)}</b> com mais Fred</p><h4 class="cw" style="margin-top:12px">Wanderley na frente</h4><ol class="rank">${mw.slice(0, 12).map(it).join("") || "<li class='nota'>nenhum</li>"}</ol><h4 class="cf" style="margin-top:12px">Fred na frente</h4><ol class="rank">${mf.slice(0, 12).map(it).join("")}</ol>`; return; }
  $("#lat-mg").innerHTML = modo === "rel" ? `<h4>Onde cada um pesa mais <small>${NIV[nv][0].toLowerCase()} com 30+ votos</small></h4><h4 class="cw" style="margin-top:10px">Mais Wanderley</h4><ol class="rank">${ord.slice(0, 12).map(item).join("")}</ol><h4 class="cf" style="margin-top:12px">Mais Fred</h4><ol class="rank">${ord.slice().reverse().slice(0, 12).map(item).join("")}</ol>`
    : `<h4>${esc(mn)} <small>${NIV[nv][0].toLowerCase()}</small></h4><ol class="rank">${ord.slice(0, 25).map(item).join("")}</ol>`;
}


// contornos das regiões: trechos de divisa entre cidades de regiões diferentes (e a divisa do estado)
const BORDAS = {};
function bordasRegiao(nivel, chaveDoIbge) {
  if (BORDAS[nivel]) return BORDAS[nivel];
  const cont = new Map();
  for (const f of E.geo.features) {
    const r = chaveDoIbge(f.properties.ibge), polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const p of polys) for (const anel of p) for (let i = 0; i < anel.length - 1; i++) {
      const a = anel[i], b = anel[i + 1], k = (a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])) ? a + "|" + b : b + "|" + a, e = cont.get(k);
      if (e) { e.n++; if (e.r !== r) e.dif = true; } else cont.set(k, {r, n: 1, a, b});
    }
  }
  const seg = []; for (const e of cont.values()) if (e.dif || e.n === 1) seg.push([[e.a[1], e.a[0]], [e.b[1], e.b[0]]]);
  return BORDAS[nivel] = seg;
}
/* ---------------- escolas de todo o estado */
function escolas() {
  const todas = ESC.map(e => Object.assign(derivar({...e, n: 1}), {nome: `${e.nome}`, tipo: "escola", chave: e.id, escolas: [e]})).filter(u => u.w + u.f > 0);
  const nomes = new Map(todas.map(u => [u, `${u.escolas[0].bairro} · ${MUN(u.escolas[0].mun).nome}`]));
  todas.forEach(u => { u.nome = `${u.nome} — ${nomes.get(u)}`; });
  const ambos = todas.filter(u => u.w >= 20 && u.f >= 20).sort((a, b) => (b.wp + b.fp) - (a.wp + a.fp)).slice(0, 15);
  $("#p-escolas").innerHTML = `<div class="cab"><h2>Escolas de Minas</h2><p>Todos os ${int(todas.length)} locais de votação onde pelo menos um dos dois teve voto. Use o filtro para achar uma escola, bairro ou cidade.</p></div>
    <div class="grid3"><div class="card"><h4><span class="cw">Wanderley</span> · mais votos</h4>${rank(todas, "w", 12)}</div><div class="card"><h4><span class="cf">Fred</span> · mais votos</h4>${rank(todas, "f", 12)}</div>
      <div class="card"><h4>Onde a dobradinha foi forte <small>os dois com 20+ votos, maior % somado</small></h4><ol class="rank">${ambos.map(u => `<li><button data-pop="escola|${u.chave}|${u.escolas[0].mun}"><span>${esc(u.nome)}</span><b>${pct(u.wp, 1)} · ${pct(u.fp, 1)}</b></button></li>`).join("")}</ol></div></div>
    <div class="card" style="margin-top:14px">${tabela(todas, "Escola", "todas")}</div>`;
  animar($("#p-escolas"));
}

/* ---------------- análises */
function correl(xs, ys, ws) {
  let sw = 0, mx = 0, my = 0; for (let i = 0; i < xs.length; i++) { sw += ws[i]; mx += ws[i] * xs[i]; my += ws[i] * ys[i]; }
  mx /= sw; my /= sw; let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += ws[i] * dx * dy; sxx += ws[i] * dx * dx; syy += ws[i] * dy * dy; }
  return sxy / Math.sqrt(sxx * syy);
}
function analises() {
  const mg = soma(ESC), curva = k => { const v = ESC.map(e => e[k]).filter(x => x > 0).sort((a, b) => b - a), t = v.reduce((a, x) => a + x, 0); let ac = 0; const pts = [{x: 0, y: 0}]; v.forEach((x, i) => { ac += x; if (i % 5 === 0 || i === v.length - 1) pts.push({x: i + 1, y: ac / t * 100}); }); const meio = v.findIndex((x, i) => v.slice(0, i + 1).reduce((a, y) => a + y, 0) >= t / 2) + 1; return {pts, n: v.length, meio}; };
  const cw = curva("w"), cf = curva("f");
  const grupos = [["Belo Horizonte", e => e.mun === BH], ["Resto da região de BH", e => e.mun !== BH && MUN(e.mun)?.ri === "Belo Horizonte"], ["Interior", e => MUN(e.mun)?.ri !== "Belo Horizonte"]];
  const gs = grupos.map(([n, f]) => [n, soma(ESC.filter(f))]);
  const cid = nivelMG("mun"), faixas = [["até 10 mil", 0, 1e4], ["10 a 50 mil", 1e4, 5e4], ["50 a 200 mil", 5e4, 2e5], ["200 mil+", 2e5, 1.5e6], ["Belo Horizonte", 1.5e6, 1e9]];
  const fx = faixas.map(([n, a, b]) => [n, soma(cid.filter(c => c.el >= a && c.el < b).flatMap(c => c.escolas))]);
  const me = nivelMG("me").slice().sort((a, b) => b.f22 - a.f22);
  const bhE = ESC.filter(e => e.mun === BH && e.v7 && e.v6).map(e => derivar({...e})), mw = med(bhE.map(e => e.wp)), mf = med(bhE.map(e => e.fp));
  const quad = [bhE.filter(e => e.wp >= mw && e.fp >= mf).length, bhE.filter(e => e.wp >= mw && e.fp < mf).length, bhE.filter(e => e.wp < mw && e.fp >= mf).length, bhE.filter(e => e.wp < mw && e.fp < mf).length];
  const regs = agrupar(ESC.filter(e => e.mun === BH), e => e.regional, null, "regional").sort((a, b) => b.razao - a.razao);
  $("#p-analises").innerHTML = `<div class="cab"><h2>Análises</h2><p>Como o voto de cada um se distribui e onde a dobradinha se encontra.</p></div>
    <p class="insight">Metade dos votos do <b class="cw">Wanderley</b> veio de <b>${int(cw.meio)}</b> escolas (de ${int(cw.n)} com voto); metade dos do <b class="cf">Fred</b> veio de <b>${int(cf.meio)}</b> escolas (de ${int(cf.n)}). ${cw.meio / cw.n < cf.meio / cf.n ? "O voto do Wanderley é bem mais concentrado." : "O voto do Fred é mais concentrado."}</p>
    <div class="grid2"><div class="card"><h4>Concentração do voto <small>% acumulado dos votos × número de escolas (das que mais deram votos para as que menos)</small></h4><canvas id="g-lorenz" height="300"></canvas></div>
      <div class="card"><h4>De onde vêm os votos</h4><canvas id="g-dep" height="300"></canvas></div></div>
    <div class="grid2" style="margin-top:14px"><div class="card"><h4>Por tamanho da cidade <small>% dos válidos</small></h4><canvas id="g-fx" height="300"></canvas></div>
      <div class="card"><h4>Fred · 2022 × 2026 por macrorregião <small>votos</small></h4><canvas id="g-f22" height="300"></canvas></div></div>
    <div class="grid2" style="margin-top:14px"><div class="card"><h4>BH · votos do Wanderley a cada 100 do Fred, por regional</h4><canvas id="g-raz" height="300"></canvas></div>
      <div class="card"><h4>BH · as escolas em 4 grupos <small>acima ou abaixo da mediana de cada um</small></h4><canvas id="g-quad" height="300"></canvas>
      <p class="nota">${int(quad[0])} escolas fortes para os dois · ${int(quad[1])} só Wanderley · ${int(quad[2])} só Fred · ${int(quad[3])} fracas para os dois.</p></div></div>`;
  animar($("#p-analises"));
  grafico("g-lorenz", {type: "line", data: {datasets: [{label: "Wanderley", data: cw.pts, borderColor: COR.w, pointRadius: 0, borderWidth: 3}, {label: "Fred", data: cf.pts, borderColor: COR.f, pointRadius: 0, borderWidth: 3}]},
    options: {parsing: false, scales: {x: {type: "logarithmic", grid: grade, title: {display: true, text: "número de escolas (escala log)"}}, y: {grid: grade, max: 100, title: {display: true, text: "% acumulado dos votos"}}}, plugins: {tooltip: {callbacks: {label: c => `${c.dataset.label}: ${dec(c.raw.y, 0)}% dos votos em ${int(c.raw.x)} escolas`}}}}});
  grafico("g-dep", {type: "bar", data: {labels: ["Wanderley", "Fred"], datasets: gs.map(([n, u], i) => ({label: n, data: [u.w / mg.w * 100, u.f / mg.f * 100], backgroundColor: ["#f8e9ca", "#b9a98a", "#5d6b73"][i], borderRadius: 4}))},
    options: {indexAxis: "y", plugins: {tooltip: {callbacks: {label: c => `${c.dataset.label}: ${dec(c.raw, 1)}%`}}}, scales: {x: {stacked: true, max: 100, grid: grade, title: {display: true, text: "% dos votos de cada um"}}, y: {stacked: true, grid: {display: false}}}}});
  grafico("g-fx", {type: "bar", data: {labels: fx.map(x => x[0]), datasets: [{label: "Wanderley", data: fx.map(x => x[1].wp * 100), backgroundColor: COR.w, borderRadius: 4}, {label: "Fred", data: fx.map(x => x[1].fp * 100), backgroundColor: COR.f, borderRadius: 4}]},
    options: {plugins: {tooltip: {callbacks: {label: c => `${c.dataset.label}: ${dec(c.raw, 2)}%`}}}, scales: {y: {grid: grade, title: {display: true, text: "% dos válidos"}}, x: {grid: {display: false}, title: {display: true, text: "eleitores da cidade"}}}}});
  grafico("g-f22", {type: "bar", data: {labels: me.map(c => c.nome), datasets: [{label: "Fred 2022", data: me.map(c => c.f22), backgroundColor: "rgba(85,184,230,.4)", borderRadius: 4}, {label: "Fred 2026", data: me.map(c => c.f), backgroundColor: COR.f, borderRadius: 4}]},
    options: {indexAxis: "y", plugins: {tooltip: {callbacks: {label: c => `${c.dataset.label}: ${int(c.raw)} votos`}}}, scales: {x: {grid: grade}, y: {grid: {display: false}}}}});
  grafico("g-raz", {type: "bar", data: {labels: regs.map(r => r.nome), datasets: [{label: "Wanderley a cada 100 do Fred", data: regs.map(r => r.razao), backgroundColor: COR.creme, borderRadius: 4}]},
    options: {indexAxis: "y", plugins: {legend: {display: false}, tooltip: {callbacks: {label: c => `${dec(c.raw, 0)} votos do Wanderley a cada 100 do Fred`}}}, scales: {x: {grid: grade}, y: {grid: {display: false}}}}});
  grafico("g-quad", {type: "doughnut", data: {labels: ["Fortes para os dois", "Só Wanderley", "Só Fred", "Fracas para os dois"], datasets: [{data: quad, backgroundColor: ["#f8e9ca", COR.w, COR.f, "#3c4c55"], borderColor: "#25333b", borderWidth: 3}]}, options: {plugins: {legend: {position: "right"}}}});
}
const med = v => { v = v.slice().sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };

/* ---------------- quadro flutuante */
function acharUnidade(tipo, chave, mun) {
  if (tipo === "escola") { const e = ESC[+chave]; return Object.assign(derivar({...e, n: 1}), {nome: e.nome, tipo, chave, escolas: [e]}); }
  if (tipo === "bairro" || tipo === "regional") { const l = ESC.filter(e => e.mun === mun && (tipo === "bairro" ? e.bairro : e.regional) === chave); return Object.assign(soma(l), {nome: chave, tipo, chave, escolas: l}); }
  return nivelMG(tipo).find(u => u.chave === chave);
}
function popover(u, ev) {
  const e0 = u.escolas[0], tipoN = {escola: "Escola", bairro: "Bairro", regional: "Regional"}[u.tipo] || NIV[u.tipo]?.[1] || "";
  const onde = u.tipo === "escola" ? `${e0.bairro} · ${MUN(e0.mun).nome}` : u.tipo === "bairro" || u.tipo === "regional" ? MUN(e0.mun).nome : "";
  const top = u.escolas.length > 1 ? u.escolas.slice().sort((a, b) => (b.w + b.f) - (a.w + a.f)).slice(0, 6) : [];
  const pop = $("#pop");
  const verK = `${u.tipo}|${u.chave}|${e0.mun}`;
  pop.innerHTML = `<button class="fechar" aria-label="Fechar">×</button><span class="selo-t">${tipoN}</span><h3>${esc(u.nome)}</h3><p class="nota">${esc(onde)}${onde ? " · " : ""}${int(u.el)} eleitores${u.n > 1 ? ` · ${int(u.n)} locais de votação` : ""}</p>
    <div class="pp"><div class="w"><small>Wanderley</small><b class="cw">${int(u.w)}</b><small>${pct(u.wp, 2)} dos válidos · ${pct(u.ws, 2)} do total dele</small></div><div class="f"><small>Fred</small><b class="cf">${int(u.f)}</b><small>${pct(u.fp, 2)} dos válidos · ${pct(u.fs, 2)} do total dele</small></div></div>
    <p class="nota">Wanderley a cada 100 do Fred: <b style="color:#f7f2e8">${dec(u.razao, 0)}</b> · Fred em 2022: <b style="color:#f7f2e8">${int(u.f22)}</b> (${pp(u.dF, 2)}) · PRD estadual: ${pct(u.wprd, 0)} do Wanderley · PRD federal: ${pct(u.fprd, 0)} do Fred</p>
    <button class="btn prim ver" data-ver="${esc(verK)}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg> Ver no mapa</button>
    ${top.length ? `<h4 style="margin-top:10px">Escolas com mais votos dos dois</h4><ol class="rank">${top.map(e => `<li><button data-pop="escola|${e.id}|${e.mun}"><span>${esc(e.nome)}</span><b><span class="cw">${int(e.w)}</span> · <span class="cf">${int(e.f)}</span></b></button></li>`).join("")}</ol>` : ""}`;
  pop.hidden = false;
  const x = ev?.clientX ?? innerWidth / 2, y = ev?.clientY ?? innerHeight / 3, w = pop.offsetWidth, h = pop.offsetHeight;
  pop.style.left = Math.max(8, Math.min(innerWidth - w - 8, x + 14)) + "px"; pop.style.top = Math.max(8, Math.min(innerHeight - h - 8, y - 20)) + "px";
  E.popT = Date.now();
}
document.addEventListener("click", e => {
  const p = e.target.closest("[data-pop]");
  if (p) { const [t, c, m] = p.dataset.pop.split("|"); const u = acharUnidade(t, c, m); if (u) popover(u, e); return; }
  if (e.target.closest("#pop .fechar") || (!e.target.closest("#pop") && Date.now() - (E.popT || 0) > 80)) $("#pop").hidden = true;
}, true);
document.addEventListener("keydown", e => { if (e.key === "Escape") $("#pop").hidden = true; });

/* ---------------- busca */
let acL = [], acI = 0;
function busca() {
  const q = semAc($("#qBusca").value.trim()), box = $("#acBusca"); if (q.length < 2) { box.hidden = true; return; }
  const cid = nivelMG("mun").filter(c => semAc(c.nome).includes(q)).slice(0, 5).map(u => ({u, t: "Cidade", s: `${int(u.w)} · ${int(u.f)}`}));
  const bai = []; const vistos = new Set();
  for (const e of ESC) { const k = e.mun + "|" + e.bairro; if (!vistos.has(k) && semAc(e.bairro).includes(q)) { vistos.add(k); bai.push(e); } if (bai.length >= 6) break; }
  const bs = bai.map(e => ({u: acharUnidade("bairro", e.bairro, e.mun), t: "Bairro · " + MUN(e.mun).nome}));
  const es = ESC.filter(e => semAc(e.nome).includes(q)).sort((a, b) => (b.w + b.f) - (a.w + a.f)).slice(0, 10).map(e => ({u: acharUnidade("escola", e.id, e.mun), t: "Escola · " + e.bairro + " · " + MUN(e.mun).nome}));
  acL = [...cid, ...bs, ...es]; acI = 0;
  box.innerHTML = acL.map((x, i) => `<button data-ac="${i}" class="${i === 0 ? "ativo" : ""}"><span>${esc(x.u.nome)}<br><small>${esc(x.t)}</small></span><small><span class="cw">${int(x.u.w)}</span> · <span class="cf">${int(x.u.f)}</span></small></button>`).join("") || `<p class="nota" style="padding:8px">Nada encontrado.</p>`;
  box.hidden = false;
}
$("#qBusca").addEventListener("input", busca);
$("#qBusca").addEventListener("keydown", e => { if (e.key === "Enter" && acL[acI]) { e.preventDefault(); escolher(acL[acI]); } if (e.key === "Escape") $("#acBusca").hidden = true; });
$("#acBusca").addEventListener("mousedown", e => e.preventDefault());
$("#acBusca").addEventListener("click", e => { const b = e.target.closest("[data-ac]"); if (b) escolher(acL[+b.dataset.ac]); });
$("#qBusca").addEventListener("blur", () => setTimeout(() => $("#acBusca").hidden = true, 150));
function escolher(x) {
  $("#acBusca").hidden = true; $("#qBusca").value = ""; $("#qBusca").blur();
  const m = x.u.escolas[0].mun;
  if (x.t === "Cidade" && E.B.cidadesOSM.includes(m)) { if (m === BH) irAba("bh"); else { E.cidade = m; irAba("cidades"); } return; }
  verNoMapa(x.u.tipo, x.u.chave, m);
}

/* ---------------- início */
(async function () {
  const B = await fetch("dados/base.json").then(r => r.json()); E.B = B;
  const ix = Object.fromEntries(B.campos.map((c, i) => [c, i]));
  ESC = B.escolas.map(r => ({id: r[ix.id], nome: r[ix.nome], mun: r[ix.mun], zona: r[ix.zona], bairro: r[ix.bairro] || "(sem bairro)", regional: r[ix.regional], lat: r[ix.lat], lng: r[ix.lng], el: r[ix.eleitores], comp: r[ix.comp], w: r[ix.w], f: r[ix.f], v7: r[ix.v7], v6: r[ix.v6], p7: r[ix.p7], p6: r[ix.p6], f22: r[ix.f22], v6_22: r[ix.v6_22]}));
  TW = ESC.reduce((a, e) => a + e.w, 0); TF = ESC.reduce((a, e) => a + e.f, 0);
  const cidades = nivelMG("mun"); E.maxWp = Math.max(...cidades.filter(c => c.v7 > 5000).map(c => c.wp)); E.maxFp = Math.max(...cidades.filter(c => c.v6 > 5000).map(c => c.fp));
  duelo(); destaques();
  $("#fontesTexto").innerHTML = `<p><b>2026:</b> arquivos oficiais do TSE de votação e de detalhe por seção (dados abertos), somados por local de votação (escola). Os totais batem com o resultado oficial: Wanderley 17.015 e Fred 100.082 votos.</p>
    <p><b>% dos válidos:</b> Wanderley sobre os votos válidos para deputado estadual; Fred sobre os válidos para deputado federal. <b>Wanderley a cada 100 do Fred</b> compara os votos dos dois no mesmo lugar (cada eleitor vota nos dois cargos).</p>
    <p><b>Quem é mais forte aqui:</b> compara o peso do lugar no total de cada um (a parte dos votos do Wanderley que veio dali contra a parte dos votos do Fred). Não depende do tamanho de cada votação.</p>
    <p><b>Fred em 2022:</b> dados abertos do TSE por seção, ligados às escolas de 2026 pela zona e seção; em 2022 ele concorreu pelo ${esc(B.cand.f.partido22)}.</p>
    <p><b>Bairros e regionais:</b> contornos oficiais do OpenStreetMap nas cidades onde estão mapeados (${B.cidadesOSM.map(m => MUN(m).nome).join(", ")}). Nas outras cidades, o bairro é o do cadastro do TSE.</p>`;
  const h = location.hash.slice(1); irAba(["bh", "cidades", "minas", "escolas", "analises"].includes(h) ? h : "bh", false);
})();
