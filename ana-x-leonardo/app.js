/* Comparação de dois candidatos (um estadual "a" e um federal "b") nas Eleições 2026 em Minas Gerais.
   Página genérica: nomes, cargos, cores e textos vêm de dados/base.json → cfg.
   Unidade básica: local de votação (escola); a página soma para bairro, regional, cidade, zona e regiões.
   Convergência: em cada seção eleitoral (urna), "votos casados" = o menor dos dois (o máximo de eleitores daquela urna
   que podem ter votado nos dois, já que o voto é secreto), somado por escola, bairro, cidade e região;
   "sintonia" = casados ÷ o maior dos dois (100% = mesma votação no mesmo lugar). As seções de cada escola: dados/secoes.json. */
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
const BH = "41238";
const E = {aba: "bh", graficos: {}, mapas: {}, osm: {}, cidade: null, nivelMG: "mun", modo: {}, camada: {}, ordem: {}, filtro: {}};

/* ---------------- configuração (preenchida a partir de base.json → cfg) */
let CF, CA, CB, NA, NB, K22, PART, COR, DIVREL, MODOS, COLS, BGHEX = 0x0a1620;
const DIVD = ["#e0574d", "#f2a197", "#7d8b96", "#a6e07a", "#88cc00"];
const FUNDO = "#0a1620", BORDA_MAPA = "#0a1620", VAZIO = "#1a2c3a", FAINT = "#7b8b97", FG = "#f3f5f6";
const C = k => k === "a" ? CA : CB;
const nm = k => C(k).curto;
const do_ = k => (C(k).art === "a" ? "da " : "do ") + nm(k);          // "do Juliano" / "da Nely"
const o_ = k => C(k).art + " " + nm(k);                                // "o Juliano" / "a Nely"
const dele = k => C(k).art === "a" ? "dela" : "dele";
const ele = k => C(k).pron;
const razaoTxt = () => `${NA} a cada 100 ${do_("b")}`;
function configurar(cfg) {
  CF = cfg; CA = cfg.cand.a; CB = cfg.cand.b; NA = CA.curto; NB = CB.curto; K22 = cfg.ano22; PART = cfg.partido;
  BGHEX = parseInt(cfg.paleta.bg.slice(1), 16);
  COR = {a: CA.cor, b: CB.cor, neutro: cfg.paleta.neutro, ok: "#88cc00", neg: "#ff7a6b", c: "#88cc00"};
  DIVREL = cfg.paleta.escala;
  const r = document.documentElement.style;
  r.setProperty("--a", CA.cor); r.setProperty("--a2", CA.cor2); r.setProperty("--b", CB.cor); r.setProperty("--b2", CB.cor2);
  MODOS = [["cas", "Votos casados"], ["sint", "Sintonia"], ["mais", "Quem teve mais votos"], ["rel", "Peso no total de cada um"], ["ap", NA + " %"], ["bp", NB + " %"], ["a", NA + " votos"], ["b", NB + " votos"], ["razao", razaoTxt()]];
  if (K22) MODOS.push(["d22", `${nm(K22)} 2022 → 2026`]);
  COLS = [["el", "Eleitores", int], ["a", NA, int, "ta"], ["ap", "% válidos", x => pct(x, 2), "ta"], ["sa", "% do total " + dele("a"), x => pct(x, 2), "ta"], ["b", NB, int, "tb"], ["bp", "% válidos", x => pct(x, 2), "tb"], ["sb", "% do total " + dele("b"), x => pct(x, 2), "tb"],
    ["cas", "Casados", int, "tc"], ["sint", "Sintonia", x => pct(x, 0), "tc"], ["razao", `${CA.ini} a cada 100 ${CB.ini}`, x => dec(x, 0)], ["apt", `% do ${PART} (est.)`, x => pct(x, 0), "ta"], ["bpt", `% do ${PART} (fed.)`, x => pct(x, 0), "tb"]];
  if (K22) COLS.push(["x22", nm(K22) + " 2022", int, "t" + K22], ["d22", "Δ " + nm(K22), x => `<span class="${x > 0 ? "pos" : "neg"}">${pp(x, 2)}</span>`, "t" + K22]);
  Chart.defaults.color = "#a9b8c4"; Chart.defaults.font.family = "Inter Tight, system-ui, sans-serif"; Chart.defaults.borderColor = "rgba(223,233,239,.08)";
}

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
let ESC = [], TA = 1, TB = 1;
const CAMPOS = ["el", "comp", "a", "b", "va", "vb", "pa", "pb", "x22", "vx22", "cas"];
function soma(lista) {
  const o = {n: lista.length}; for (const k of CAMPOS) o[k] = 0;
  for (const e of lista) for (const k of CAMPOS) o[k] += e[k];
  return derivar(o);
}
function derivar(o) {
  o.ap = o.va ? o.a / o.va : null; o.bp = o.vb ? o.b / o.vb : null;
  o.sa = o.a / TA; o.sb = o.b / TB;
  o.rel = (o.a + o.b) ? Math.log2((o.sa + 1e-5) / (o.sb + 1e-5)) : null;
  o.razao = o.b ? o.a / o.b * 100 : null;
  o.mais = (o.a + o.b) ? Math.log2((o.a + 1) / (o.b + 1)) : null;   // >0: o candidato "a" teve mais votos que o "b" no lugar
  if (K22) { const agora = o[K22 + "p"]; o.x22p = o.vx22 ? o.x22 / o.vx22 : null; o.d22 = agora != null && o.x22p != null ? agora - o.x22p : null; o.d22v = o[K22] - o.x22; }
  o.apt = o.pa ? o.a / o.pa : null; o.bpt = o.pb ? o.b / o.pb : null;
  o.sint = (o.a + o.b) ? o.cas / Math.max(o.a, o.b) : null;   // sintonia: 1 = os dois com a mesma votação em cada escola
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
const mistura = (c, t) => { const a = parseInt(c.slice(1), 16), b = BGHEX; const r = s => Math.round(((b >> s) & 255) * (1 - t) + ((a >> s) & 255) * t); return `rgb(${r(16)},${r(8)},${r(0)})`; };
const rampa = c => [.2, .38, .58, .8, 1].map(t => mistura(c, t));
function quebras(v) { v = v.filter(x => x != null && isFinite(x)).sort((a, b) => a - b); return [.2, .4, .6, .8].map(q => v[Math.floor(q * (v.length - 1))]); }
const rampaDe = modo => modo === "cas" || modo === "sint" ? rampa(COR.c) : /^a/.test(modo) ? rampa(COR.a) : /^b/.test(modo) ? rampa(COR.b) : rampa(COR.neutro);
function cor(u, modo, q) {
  if (!u || !(u.a + u.b + u.va)) return VAZIO;
  const x = u[modo]; if (x == null || !isFinite(x)) return VAZIO;
  if (modo === "rel") return DIVREL[[-1, -.35, .35, 1].filter(t => x > t).length];
  if (modo === "mais") return DIVREL[[-1, -.14, .14, 1].filter(t => x > t).length];
  if (modo === "d22") return DIVD[[-.01, -.002, .002, .01].filter(t => x > t).length];
  return rampaDe(modo)[q.filter(t => x > t).length];
}
const fmt = (modo, x) => modo === "sint" ? pct(x, 0) : modo === "ap" || modo === "bp" ? pct(x, 2) : modo === "d22" ? pp(x, 2) : modo === "razao" ? dec(x, 0) : int(x);
function legenda(modo, q) {
  if (modo === "mais") return [`${NB} com o dobro ou mais`, `${NB} teve mais votos`, "praticamente empatados", `${NA} teve mais votos`, `${NA} com o dobro ou mais`].map((t, i) => `<span><b style="background:${DIVREL[i]}"></b>${t}</span>`).join("") + `<span class="nota">(votos ${do_("a")} para ${CA.cargoNome.toLowerCase().replace(/^deputad[oa] /, "")} × votos ${do_("b")} para ${CB.cargoNome.toLowerCase().replace(/^deputad[oa] /, "")} no mesmo lugar)</span>`;
  if (modo === "rel") return [`${NB} bem mais forte`, `${NB} mais forte`, "equilibrado", `${NA} mais forte`, `${NA} bem mais forte`].map((t, i) => `<span><b style="background:${DIVREL[i]}"></b>${t}</span>`).join("") + `<span class="nota">(comparando o peso de cada lugar no total de cada um)</span>`;
  if (modo === "cas" || modo === "sint") return rampaDe(modo).map((c, i) => `<span><b style="background:${c}"></b>${i === 0 ? "até " + fmt(modo, q[0]) : i === 4 ? "acima de " + fmt(modo, q[3]) : fmt(modo, q[i - 1]) + " a " + fmt(modo, q[i])}</span>`).join("") + `<span class="nota">${modo === "cas" ? "(votos casados: em cada urna, o menor dos dois, somado no lugar)" : "(sintonia: 100% = os dois com a mesma votação no mesmo lugar)"}</span>`;
  if (modo === "d22") return ["caiu mais de 1 p.p.", "caiu", "estável", "subiu", "subiu mais de 1 p.p."].map((t, i) => `<span><b style="background:${DIVD[i]}"></b>${t}</span>`).join("");
  return rampaDe(modo).map((c, i) => `<span><b style="background:${c}"></b>${i === 0 ? "até " + fmt(modo, q[0]) : i === 4 ? "acima de " + fmt(modo, q[3]) : fmt(modo, q[i - 1]) + " a " + fmt(modo, q[i])}</span>`).join("");
}
const duas = u => `<span class="duas"><i class="ba" style="width:${Math.min(100, (u.ap || 0) / E.maxAp * 100)}%"></i><i class="bb" style="width:${Math.min(100, (u.bp || 0) / E.maxBp * 100)}%"></i></span>`;
function dica(u, tipo) {
  return `<b>${esc(u.nome)}</b>${tipo ? ` <small style="color:${FAINT}">${tipo}</small>` : ""}<br><span style="color:${COR.a}">■</span> ${NA}: <b>${int(u.a)}</b> votos · ${pct(u.ap, 2)}<br><span style="color:${COR.b}">■</span> ${NB}: <b>${int(u.b)}</b> votos · ${pct(u.bp, 2)}<br><b>${u.a === u.b ? "Empate" : u.a > u.b ? `<span style="color:${COR.a}">${NA}</span> teve mais votos` : `<span style="color:${COR.b}">${NB}</span> teve mais votos`}</b> · ${razaoTxt()}: <b>${dec(u.razao, 0)}</b><br><span style="color:${COR.c}">■</span> Votos casados: <b>${int(u.cas)}</b> · sintonia ${pct(u.sint, 0)}${K22 && u.x22 ? `<br>${nm(K22)} em 2022: ${int(u.x22)} votos (${pp(u.d22, 2)})` : ""}`;
}

/* ---------------- abertura: duelo e destaques */
function duelo() {
  const mg = soma(ESC), bh = soma(ESC.filter(e => e.mun === BH));
  const lado = k => { const x = C(k); return `<div class="lado ${k}">
    <div class="topo-l"><img class="foto" src="fotos/${x.foto}" alt="Foto de ${esc(x.nome)}"><div>${x.selo ? `<img class="selo" src="marca/${x.selo}" alt="${esc(x.nome)}">` : `<div class="selo-txt"><b>${esc(x.nome)}</b></div>`}
      <div class="cargo-l">${esc(x.cargoNome)} · ${esc(x.partido)}</div></div></div>
    <div class="nums"><div><b>${int(x.votos)}</b><span>votos em Minas</span></div><div><b>${pct(mg[k + "p"], 2)}</b><span>dos válidos do cargo</span></div><div><b>${pct(bh[k] / mg[k], 0)}</b><span>dos votos vieram de BH</span></div></div>
  </div>`; };
  $("#duelo").innerHTML = lado("a") +
    `<div class="meio"><span class="xx">×</span><span class="mt">A dobradinha</span>
      <p class="mq">A cada <b class="cb">100 votos ${do_("b")}</b>, quantos ${C("a").art} <b class="ca">${NA}</b> teve?</p>
      ${[["Em Minas", mg.razao], ["Em BH", bh.razao]].map(([n, r]) => { const mx = Math.max(100, r || 0); return `<div class="mr"><span class="mn">${n}</span>
        <div class="mbs"><div class="mbl"><i class="bb" style="width:${100 / mx * 100}%"></i><em>${NB} 100</em></div><div class="mbl"><i class="ba" style="width:${(r || 0) / mx * 100}%"></i><em>${NA} ${dec(r, 0)}</em></div></div></div>`; }).join("")}
      <p class="mq casou">Votos casados nas escolas de Minas: <b class="cc">${int(mg.cas)}</b><small>${pct(mg.cas / Math.min(mg.a, mg.b), 0)} dos votos ${do_(mg.a <= mg.b ? "a" : "b")} tiveram par ${do_(mg.a <= mg.b ? "b" : "a")} na mesma escola</small></p>
    </div>` +
    lado("b");
  animar($("#duelo"));
}
function destaques() {
  const mg = soma(ESC), bh = soma(ESC.filter(e => e.mun === BH)), cid = nivelMG("mun");
  const ambos = cid.filter(c => c.a > 0 && c.b > 0).length, soA = cid.filter(c => c.a > 0).length, soB = cid.filter(c => c.b > 0).length;
  const regs = agrupar(ESC.filter(e => e.mun === BH), e => e.regional, null, "regional");
  const ra = regs.slice().sort((a, b) => b.ap - a.ap)[0], rb = regs.slice().sort((a, b) => b.bp - a.bp)[0];
  const c22 = K22 ? C(K22) : null;
  const menor = mg.a <= mg.b ? "a" : "b", maior = menor === "a" ? "b" : "a";
  const escsMG = ESC.filter(e => e.cas > 0), juntas = escsMG.filter(e => e.cas >= 10).length;
  $("#destaques").innerHTML = `
    <div class="dest conv"><span class="dl">A dobradinha junta · Minas</span><b class="cc">${int(mg.cas)} votos casados</b><span>${pct(mg.cas / mg[menor], 0)} dos votos ${do_(menor)} tiveram par ${do_(maior)} na mesma escola · os dois votados em ${int(escsMG.length)} escolas (${int(juntas)} com 10+ casados)</span></div>
    <div class="dest conv"><span class="dl">A dobradinha junta · BH</span><b class="cc">${int(bh.cas)} votos casados</b><span>sintonia de ${pct(bh.sint, 0)} nas escolas de BH · ${pct(bh.cas / bh[menor], 0)} dos votos ${do_(menor)} em BH tiveram par</span></div>
    <div class="dest"><span class="dl">Belo Horizonte · ${NA}</span><b class="ca">${int(bh.a)} votos</b><span>${pct(bh.ap, 2)} dos válidos para ${CA.cargoNome.toLowerCase().replace(/^deputad[oa] /, "")} · ${pct(bh.a / mg.a, 0)} de tudo que ${ele("a")} teve</span></div>
    <div class="dest"><span class="dl">Belo Horizonte · ${NB}</span><b class="cb">${int(bh.b)} votos</b><span>${pct(bh.bp, 2)} dos válidos para ${CB.cargoNome.toLowerCase().replace(/^deputad[oa] /, "")} · ${pct(bh.b / mg.b, 0)} de tudo que ${ele("b")} teve</span></div>
    <div class="dest"><span class="dl">Regional mais forte em BH</span><b><span class="ca">${esc(ra.nome)}</span> · <span class="cb">${esc(rb.nome)}</span></b><span>${NA} ${pct(ra.ap, 2)} · ${NB} ${pct(rb.bp, 2)}</span></div>
    <div class="dest"><span class="dl">Cidades com voto</span><b><span class="ca">${int(soA)}</span> · <span class="cb">${int(soB)}</span></b><span>${NA} · ${NB} · os dois juntos em ${int(ambos)} cidades</span></div>
    ${c22 ? `<div class="dest"><span class="dl">${nm(K22)} · 2022 → 2026</span><b class="${c22.votos >= c22.votos22 ? "pos" : "neg"}">${int(c22.votos22)} → ${int(c22.votos)}</b><span>${c22.votos >= c22.votos22 ? "+" : ""}${pct(c22.votos / c22.votos22 - 1)} · em 2022 pelo ${esc(c22.partido22)}</span></div>` : ""}
    <div class="dest"><span class="dl">Peso no partido (${esc(PART)})</span><b><span class="ca">${pct(mg.apt, 0)}</span> · <span class="cb">${pct(mg.bpt, 0)}</span></b><span>dos votos do ${esc(PART)} para estadual · para federal, em Minas</span></div>`;
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
  if (a === "secoes") secoesZonas();
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
const grade = {color: "rgba(223,233,239,.07)"};
const dsAB = (f, raio = 4) => [{label: NA, data: f("a"), backgroundColor: COR.a, borderRadius: raio}, {label: NB, data: f("b"), backgroundColor: COR.b, borderRadius: raio}];

/* ---------------- uma cidade (BH e as cidades com regionais) */
function chipsCidades() {
  const l = E.B.cidadesOSM.filter(m => m !== BH).map(m => [m, soma(ESC.filter(e => e.mun === m))]).sort((a, b) => b[1].el - a[1].el);
  if (!E.cidade) E.cidade = l[0][0];
  $("#chipsCid").innerHTML = l.map(([m, u]) => `<button data-cid="${m}" aria-pressed="${m === E.cidade}">${esc(MUN(m).nome)}<small>${int(u.a)} · ${int(u.b)}</small></button>`).join("");
}
$("#chipsCid").addEventListener("click", e => { const b = e.target.closest("[data-cid]"); if (!b) return; E.cidade = b.dataset.cid; chipsCidades(); cidade(E.cidade, $("#cidadeCorpo")); });

function cidade(m, alvo) { E.desenhando = cidade_(m, alvo); return E.desenhando; }
function cidade_(m, alvo) {
  const lista = ESC.filter(e => e.mun === m), u = soma(lista), nome = MUN(m).nome, osm = E.B.cidadesOSM.includes(m), id = "c" + m;
  const regs = osm ? agrupar(lista, e => e.regional, null, "regional").sort((a, b) => b.el - a.el) : [];
  const bairros = agrupar(lista, e => e.bairro, null, "bairro");
  const escs = lista.map(e => Object.assign(derivar({...e, n: 1}), {nome: e.nome, tipo: "escola", chave: e.id, escolas: [e]}));
  const zonasC = agrupar(lista, e => String(e.zona), k => "Zona " + k, "zona").sort((a, b) => +a.chave - +b.chave);
  E.ctx = E.ctx || {}; E.ctx[m] = {regs, bairros, escs, u, zonas: zonasC};
  const ws = escs.filter(e => e.va && e.vb), r = correl(ws.map(e => e.ap), ws.map(e => e.bp), ws.map(e => e.el));
  const topA = escs.slice().sort((a, b) => b.a - a.a)[0], topB = escs.slice().sort((a, b) => b.b - a.b)[0];
  const regA = regs.slice().sort((a, b) => b.ap - a.ap)[0], regB = regs.slice().sort((a, b) => b.bp - a.bp)[0];
  const bairA = bairros.filter(b => b.va > 2000).sort((a, b) => b.ap - a.ap)[0], bairB = bairros.filter(b => b.vb > 2000).sort((a, b) => b.bp - a.bp)[0];
  alvo.innerHTML = `
    <div class="cab"><h2>${esc(nome)}</h2><p>${int(lista.length)} locais de votação · ${int(u.el)} eleitores${osm ? ` · ${regs.length} regionais e ${int(bairros.length)} bairros com voto` : ""}. Toque em qualquer regional, bairro ou escola para ver os detalhes.</p></div>
    <div class="kpis">
      <div class="kpi"><b class="ca">${int(u.a)}</b><span>votos ${do_("a")} · ${pct(u.ap, 2)} dos válidos · ${pct(u.sa, 1)} do total ${dele("a")}</span></div>
      <div class="kpi"><b class="cb">${int(u.b)}</b><span>votos ${do_("b")} · ${pct(u.bp, 2)} dos válidos · ${pct(u.sb, 1)} do total ${dele("b")}</span></div>
      <div class="kpi"><b>${dec(u.razao, 0)}</b><span>votos ${do_("a")} a cada 100 ${do_("b")}</span></div>
      ${K22 ? `<div class="kpi"><b class="${u.d22v >= 0 ? "pos" : "neg"}">${int(u.x22)} → ${int(u[K22])}</b><span>${nm(K22)} em 2022 → 2026 (${pp(u.d22, 2)})</span></div>` : ""}
      <div class="kpi"><b class="cc">${int(u.cas)}</b><span>votos casados nas escolas · sintonia de ${pct(u.sint, 0)}</span></div>
      <div class="kpi"><b>${dec(r, 2)}</b><span>correlação entre os dois nas escolas (−1 a +1)</span></div>
    </div>
    <p class="insight">${osm && regA ? `Regional mais forte: <b class="ca">${esc(regA.nome)}</b> para ${o_("a")} (${pct(regA.ap, 2)}) e <b class="cb">${esc(regB.nome)}</b> para ${o_("b")} (${pct(regB.bp, 2)}). ` : ""}${bairA ? `Bairro mais forte: <b class="ca">${esc(bairA.nome)}</b> (${pct(bairA.ap, 2)}) e <b class="cb">${esc(bairB?.nome)}</b> (${pct(bairB?.bp, 2)}). ` : ""}Escola com mais votos: <b class="ca">${esc(topA.nome)}</b> (${int(topA.a)}) e <b class="cb">${esc(topB.nome)}</b> (${int(topB.b)}). ${Math.abs(r) < .2 ? "Os dois votam em lugares diferentes da cidade: a força de um quase não acompanha a do outro." : r > 0 ? "Onde um é forte, o outro tende a ser forte também: a dobradinha anda junta." : "Onde um é forte, o outro tende a ser mais fraco."}</p>
    <div class="cab"><h3>Onde a dobradinha casou</h3><p>Escola por escola, quantos votos cada um teve e quanto casou, contado urna por urna: em cada seção eleitoral, o menor dos dois é o máximo de eleitores que podem ter votado nos dois juntos. Toque numa escola para ver seção por seção. Quanto maior, mais o trabalho em equipe rendeu no mesmo lugar.</p></div>
    <div class="grid2"><div class="card"><h4>Escolas com mais votos casados <small>${NA} · ${NB} · casados</small></h4>${rankC(escs, 15)}</div>
      <div class="card"><h4>Bairros com mais votos casados <small>soma das escolas</small></h4>${rankC(bairros, 15)}</div></div>
    ${osm ? `<div class="card" style="margin-top:14px"><h4>Regionais · votos casados e sintonia</h4><canvas id="g-cas-${id}" height="260"></canvas></div>` : ""}
    <div class="cab"><h3>Mapa${osm ? " de bairros, regionais e escolas" : " das escolas"}</h3></div>
    <div class="linha"><span class="rot">Mostrar</span><div class="seg" data-camada="${m}">${(osm ? [["bairro", "Bairros"], ["regional", "Regionais"], ["escola", "Escolas"], ["zona", "Zonas"], ["secao", "Seções"]] : [["escola", "Escolas"], ["zona", "Zonas"], ["secao", "Seções"]]).map(([k, n]) => `<button data-v="${k}" aria-pressed="${(E.camada[m] || (osm ? "bairro" : "escola")) === k}">${n}</button>`).join("")}</div></div>
    <div class="linha"><span class="rot">Pintar por</span><div class="seg" data-modo="${m}">${MODOS.map(([k, n]) => `<button data-v="${k}" aria-pressed="${(E.modo[m] || "cas") === k}">${esc(n)}</button>`).join("")}</div></div>
    <div class="mapa-wrap"><div><div class="mapa" id="mapa-${id}"></div><div class="legenda" id="leg-${id}"></div></div><aside class="card lateral" id="lat-${id}"></aside></div>
    ${osm ? `<div class="cab"><h3>Por regional</h3></div>
    <div class="grid2"><div class="card"><h4>% dos válidos por regional <small>toque numa barra para ver no mapa</small></h4><canvas id="g-reg-${id}" height="300"></canvas></div><div class="card"><h4>De onde vieram os votos <small>parte do total da cidade em cada regional</small></h4><canvas id="g-regs-${id}" height="300"></canvas></div></div>
    <div class="card" style="margin-top:14px">${tabela(regs, "Regional", "reg-" + id)}</div>` : ""}
    <div class="cab"><h3>Bairros</h3></div>
    <div class="grid2"><div class="card"><h4><span class="ca">${NA}</span> · bairros com mais votos</h4>${rank(bairros, "a", 15)}</div><div class="card"><h4><span class="cb">${NB}</span> · bairros com mais votos</h4>${rank(bairros, "b", 15)}</div></div>
    <div class="card" style="margin-top:14px">${tabela(bairros, "Bairro", "bai-" + id)}</div>
    <div class="cab"><h3>Escolas</h3></div>
    <div class="grid2"><div class="card"><h4>Cada escola: % ${do_("b")} × % ${do_("a")} <small>tamanho = eleitores · toque para ver no mapa</small></h4><canvas id="g-disp-${id}" height="320"></canvas></div>
      <div class="card"><h4>As 15 escolas com mais votos dos dois juntos</h4><canvas id="g-esc-${id}" height="320"></canvas></div></div>
    <div class="grid2" style="margin-top:14px"><div class="card"><h4><span class="ca">${NA}</span> · escolas com mais votos</h4>${rank(escs, "a", 15)}</div><div class="card"><h4><span class="cb">${NB}</span> · escolas com mais votos</h4>${rank(escs, "b", 15)}</div></div>
    <div class="card" style="margin-top:14px">${tabela(escs, "Escola", "esc-" + id, true)}</div>`;
  // gráficos
  if (osm) {
    grafico(`g-reg-${id}`, {type: "bar", data: {labels: regs.map(r => r.nome), datasets: dsAB(k => regs.map(r => r[k + "p"] * 100), 5)},
      options: {indexAxis: "y", plugins: {tooltip: {callbacks: {label: c => `${c.dataset.label}: ${dec(c.raw, 2)}%`}}}, scales: {x: {grid: grade, title: {display: true, text: "% dos válidos"}}, y: {grid: {display: false}}}}}, i => verNoMapa("regional", regs[i].chave, m));
    grafico(`g-regs-${id}`, {type: "bar", data: {labels: regs.map(r => r.nome), datasets: [...dsAB(k => regs.map(r => r[k] / u[k] * 100), 5), {label: "Eleitores", data: regs.map(r => r.el / u.el * 100), backgroundColor: "rgba(223,233,239,.3)", borderRadius: 5}]},
      options: {indexAxis: "y", plugins: {tooltip: {callbacks: {label: c => `${c.dataset.label}: ${dec(c.raw, 1)}% do total da cidade`}}}, scales: {x: {grid: grade, title: {display: true, text: "% do total na cidade"}}, y: {grid: {display: false}}}}}, i => verNoMapa("regional", regs[i].chave, m));
  }
  if (osm) grafico(`g-cas-${id}`, {type: "bar", data: {labels: regs.map(r => r.nome), datasets: [...dsAB(k => regs.map(r => r[k]), 4), {label: "Votos casados", data: regs.map(r => r.cas), backgroundColor: COR.c, borderRadius: 4}]},
    options: {plugins: {tooltip: {callbacks: {label: c => `${c.dataset.label}: ${int(c.raw)} votos`, afterBody: it => `Sintonia: ${pct(regs[it[0].dataIndex].sint, 0)}`}}}, scales: {y: {grid: grade}, x: {grid: {display: false}}}}}, i => verNoMapa("regional", regs[i].chave, m));
  const mxE = Math.max(...escs.map(e => e.el));
  grafico(`g-disp-${id}`, {type: "bubble", data: {datasets: [{data: ws.map(e => ({x: e.bp * 100, y: e.ap * 100, r: 2 + 10 * Math.sqrt(e.el / mxE), nome: e.nome, bairro: e.bairro})), backgroundColor: ws.map(e => (e.rel > 0 ? hexA(COR.a, .6) : hexA(COR.b, .6))), borderColor: "rgba(223,233,239,.3)"}]},
    options: {plugins: {legend: {display: false}, tooltip: {callbacks: {label: c => `${c.raw.nome} (${c.raw.bairro}): ${NB} ${dec(c.raw.x, 2)}% · ${NA} ${dec(c.raw.y, 2)}%`}}}, scales: {x: {grid: grade, title: {display: true, text: `% ${do_("b")} (${CB.cargoNome.toLowerCase().replace(/^deputad[oa] /, "")})`}}, y: {grid: grade, title: {display: true, text: `% ${do_("a")} (${CA.cargoNome.toLowerCase().replace(/^deputad[oa] /, "")})`}}}}}, i => verNoMapa("escola", ws[i].chave, m));
  const top15 = escs.slice().sort((a, b) => (b.a + b.b) - (a.a + a.b)).slice(0, 15);
  grafico(`g-esc-${id}`, {type: "bar", data: {labels: top15.map(e => e.nome.length > 30 ? e.nome.slice(0, 29) + "…" : e.nome), datasets: dsAB(k => top15.map(e => e[k]))},
    options: {indexAxis: "y", plugins: {tooltip: {callbacks: {label: c => `${c.dataset.label}: ${int(c.raw)} votos`}}}, scales: {x: {stacked: true, grid: grade}, y: {stacked: true, grid: {display: false}, ticks: {font: {size: 11}}}}}}, i => verNoMapa("escola", top15[i].chave, m));
  animar(alvo);
  return mapaCidade(m);
}
const hexA = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };

/* ranking e tabela genéricos */
const rank = (l, k, n) => `<ol class="rank">${l.slice().sort((a, b) => b[k] - a[k]).slice(0, n).map(u => `<li><button data-pop="${u.tipo}|${esc(u.chave)}|${u.escolas[0].mun}"><span>${esc(u.nome)}</span>${duas(u)}<b class="${k === "a" ? "ca" : "cb"}">${int(u[k])}</b></button></li>`).join("")}</ol>`;
const rankC = (l, n) => `<ol class="rank">${l.filter(u => u.cas > 0).sort((a, b) => b.cas - a.cas || b.sint - a.sint).slice(0, n).map(u => `<li><button data-pop="${u.tipo}|${esc(u.chave)}|${u.escolas[0].mun}"><span>${esc(u.nome)}<i class="sint" style="--s:${Math.round((u.sint || 0) * 100)}%" title="sintonia ${pct(u.sint, 0)}"></i></span><b><span class="ca">${int(u.a)}</span> · <span class="cb">${int(u.b)}</span> · <span class="cc">${int(u.cas)}</span></b></button></li>`).join("") || "<li class='nota'>nenhum lugar com voto dos dois</li>"}</ol>`;
function tabela(l, rot, id, comBairro) {
  E.tabs = E.tabs || {}; E.tabs[id] = {l, rot, comBairro};
  const o = E.ordem[id] || {k: "a", dir: -1}, filtro = semAc(E.filtro[id] || "");
  const linhas = l.filter(u => !filtro || semAc(u.nome + " " + (u.escolas[0].bairro || "")).includes(filtro)).sort((a, b) => o.k === "nome" ? a.nome.localeCompare(b.nome) * o.dir : ((a[o.k] ?? -1e9) - (b[o.k] ?? -1e9)) * o.dir);
  return `<div class="ferr" data-tab="${id}"><h4 style="margin:0;flex:1">${rot === "Escola" ? "Todas as escolas" : rot === "Bairro" ? "Todos os bairros" : rot + "s"} <small>${int(l.length)} · toque no título da coluna para ordenar</small></h4><input type="search" placeholder="Filtrar…" value="${esc(E.filtro[id] || "")}" data-filtro="${id}"><button class="btn" data-csv="${id}">Baixar CSV</button></div>
    <div class="tab-wrap" id="tw-${id}"><table><thead><tr><th data-ord="${id}|nome">${rot}</th>${comBairro ? "<th>Bairro</th>" : ""}${COLS.map(([k, t, , c]) => `<th class="${c || ""}" data-ord="${id}|${k}">${esc(t)}${o.k === k ? (o.dir < 0 ? " ↓" : " ↑") : ""}</th>`).join("")}</tr></thead>
    <tbody>${linhas.map(u => `<tr data-pop="${u.tipo}|${esc(u.chave)}|${u.escolas[0].mun}"><td><b>${esc(u.nome)}</b></td>${comBairro ? `<td style="text-align:left">${esc(u.escolas[0].bairro)}</td>` : ""}${COLS.map(([k, , f]) => `<td>${f(u[k])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function retabela(id) { const t = E.tabs[id]; const box = $(`[data-tab="${id}"]`).parentElement; const foco = document.activeElement?.dataset?.filtro === id; box.innerHTML = tabela(t.l, t.rot, id, t.comBairro); if (foco) { const i = box.querySelector("[data-filtro]"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
document.addEventListener("click", e => {
  const th = e.target.closest("[data-ord]"); if (th) { const [id, k] = th.dataset.ord.split("|"); const o = E.ordem[id] || {k: "a", dir: -1}; E.ordem[id] = o.k === k ? {k, dir: -o.dir} : {k, dir: -1}; retabela(id); return; }
  const c = e.target.closest("[data-csv]"); if (c) { const t = E.tabs[c.dataset.csv];
    const cab = [t.rot, ...(t.comBairro ? ["Bairro"] : []), "Eleitores", NA, NA + " % válidos", NB, NB + " % válidos", "Votos casados", "Sintonia %", razaoTxt(), ...(K22 ? [nm(K22) + " 2022"] : [])];
    const linhas = [cab.join(";")].concat(t.l.map(u => [u.nome, ...(t.comBairro ? [u.escolas[0].bairro] : []), u.el, u.a, dec(u.ap * 100, 3), u.b, dec(u.bp * 100, 3), u.cas, dec((u.sint || 0) * 100, 1), dec(u.razao, 1), ...(K22 ? [u.x22] : [])].map(x => `"${String(x).replace(/"/g, '""')}"`).join(";")));
    Object.assign(document.createElement("a"), {href: URL.createObjectURL(new Blob(["﻿" + linhas.join("\n")], {type: "text/csv"})), download: `${CF.slug}-${c.dataset.csv}.csv`}).click(); }
});
document.addEventListener("input", e => { const f = e.target.closest("[data-filtro]"); if (f) { E.filtro[f.dataset.filtro] = f.value; retabela(f.dataset.filtro); } });

/* mapa da cidade: bairros, regionais (contornos oficiais) e escolas */
const TILES = "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";
async function mapaCidade(m) {
  const id = "c" + m, el = $("#mapa-" + id); if (!el) return;
  const ibge = MUN(m).ibge, osm = E.B.cidadesOSM.includes(m);
  if (osm && !E.osm[ibge]) E.osm[ibge] = await fetch(`dados/osm/${ibge}.json`).then(r => r.json());
  if (!document.body.contains(el)) return;
  if (E.mapas[id]) { E.mapas[id].remove(); }
  E.reg[id] = new Map();
  const mapa = L.map(el, {scrollWheelZoom: false, preferCanvas: true, zoomSnap: .25});
  L.tileLayer(TILES, {attribution: "Esri · OpenStreetMap · TSE", maxZoom: 17}).addTo(mapa);
  mapa.on("click focus", () => mapa.scrollWheelZoom.enable());
  E.mapas[id] = mapa;
  const ctx = E.ctx[m], camada = E.camada[m] || (osm ? "bairro" : "escola"), modo = E.modo[m] || "cas";
  // seções: cada urna em volta da sua escola; os modos que dependem dos válidos usam os votos casados
  const MS = ["cas", "sint", "mais", "a", "b", "razao"], modoS = MS.includes(modo) ? modo : "cas";
  let secs = [];
  if (camada === "secao") { await carregarSecoes(); if (!document.body.contains(el)) return; const ids = new Set(ctx.escs.map(x => +x.chave)); secs = E.SEC.filter(x => ids.has(x.i)).map(x => Object.assign(x, {mais: Math.log2((x.a + 1) / (x.b + 1)), razao: x.b ? x.a / x.b * 100 : null})); }
  const lista = camada === "regional" ? ctx.regs : camada === "bairro" ? ctx.bairros : camada === "zona" ? ctx.zonas : camada === "secao" ? secs : ctx.escs, mq = camada === "secao" ? modoS : modo, q = camada === "secao" && modoS === "cas" ? [2, 5, 10, 20] : camada === "secao" && modoS === "sint" ? [.25, .5, .75, .9] : quebras(lista.map(u => u[mq]));
  const porNome = new Map(lista.map(u => [u.nome, u])), grupo = L.featureGroup().addTo(mapa);
  if (osm && (camada === "bairro" || camada === "regional")) {
    const fc = camada === "regional" ? E.osm[ibge].regionais : E.osm[ibge].bairros;
    L.geoJSON(fc, {style: f => { const u = porNome.get(f.properties.nome); return {color: BORDA_MAPA, weight: camada === "regional" ? 1.6 : .7, fillOpacity: u ? .9 : .25, fillColor: cor(u, modo, q)}; },
      onEachFeature: (f, l) => { const u = porNome.get(f.properties.nome); l.bindTooltip(u ? dica(u, camada === "regional" ? "regional" : "bairro") : `<b>${esc(f.properties.nome)}</b><br><small>sem local de votação</small>`, {sticky: true}); if (u) { l.on("click", ev => popover(u, ev.originalEvent)); registrar(id, `${camada}|${u.chave}`, l); } }}).addTo(grupo);
  }
  if (osm && camada !== "escola") L.geoJSON(E.osm[ibge].regionais, {style: {color: "rgba(223,233,239,.6)", weight: 1.4, fill: false}, interactive: false}).addTo(grupo);
  if (camada === "zona") {
    const mx = Math.max(...ctx.zonas.map(z => z.el));
    for (const z of ctx.zonas) { const c = centro(z.escolas); if (!c) continue;
      const mk = L.circleMarker(c, {radius: 7 + 16 * Math.sqrt(z.el / mx), color: "#ffffff", weight: 1.4, opacity: .8, fillOpacity: .88, fillColor: cor(z, modo, q)}).bindTooltip(dica(z, `zona · ${int(z.n)} locais`), {sticky: true}).on("click", ev => popover(z, ev.originalEvent)).addTo(grupo); registrar(id, `zona|${z.chave}`, mk);
      L.tooltip({permanent: true, direction: "center", className: "rot-mapa", interactive: false}).setLatLng(c).setContent(z.chave).addTo(grupo); }
  }
  if (camada === "secao") {
    E.secPal = modoS === "cas" || modoS === "sint";
    const porEsc = new Map(); for (const x of secs) { if (!porEsc.has(x.i)) porEsc.set(x.i, []); porEsc.get(x.i).push(x); }
    for (const [i, ls] of porEsc) { const e = ESC[i]; if (e.lat == null) continue; const k = ls.length, raio = .00022 * (1 + k / 10);
      ls.sort((p, q2) => p.n - q2.n).forEach((x, j) => { const ang = 2 * Math.PI * j / k, lat = e.lat + raio * Math.sin(ang), lng = e.lng + raio * Math.cos(ang) / Math.cos(e.lat * Math.PI / 180);
        L.circleMarker([lat, lng], {radius: 4.6, color: "rgba(255,255,255,.55)", weight: .7, fillOpacity: .95, fillColor: corSec(x, modoS, q)}).bindTooltip(`<b>Seção ${x.n} · Zona ${x.zona}</b><br><small style="color:${FAINT}">${esc(e.nome)}</small><br><span style="color:${COR.a}">■</span> ${NA}: <b>${int(x.a)}</b> · <span style="color:${COR.b}">■</span> ${NB}: <b>${int(x.b)}</b><br><span style="color:${COR.c}">■</span> Casados: <b>${int(x.cas)}</b> · sintonia ${pct(x.sint, 0)}`, {sticky: true})
          .on("click", ev => popover(acharUnidade("escola", String(i), e.mun), ev.originalEvent)).addTo(grupo); }); }
  }
  if (camada === "escola") {
    const mx = Math.max(...ctx.escs.map(e => e.el));
    for (const u of ctx.escs) { const e = u.escolas[0]; if (e.lat == null) continue;
      const mk = L.circleMarker([e.lat, e.lng], {radius: 3 + 9 * Math.sqrt(e.el / mx), color: BORDA_MAPA, weight: .8, fillOpacity: .92, fillColor: cor(u, modo, q)}).bindTooltip(dica(u, "escola · " + e.bairro), {sticky: true}).on("click", ev => popover(u, ev.originalEvent)).addTo(grupo); registrar(id, `escola|${u.chave}`, mk); }
  }
  const b = grupo.getBounds(); if (b.isValid()) mapa.fitBounds(b, {padding: [10, 10]});
  new ResizeObserver(() => { mapa.invalidateSize(); }).observe(el);
  $("#leg-" + id).innerHTML = (camada === "secao" && (modoS === "cas" || modoS === "sint") ? [["#5b6b78", "nenhum casado"], ...SECPAL.map((c, i) => [c, modoS === "cas" ? ["1 a 2", "3 a 5", "6 a 10", "11 a 20", "mais de 20"][i] : ["até 25%", "25 a 50%", "50 a 75%", "75 a 90%", "acima de 90%"][i]])].map(([c, t]) => `<span><b style="background:${c}"></b>${t}</span>`).join("") : legenda(mq, q)) + (camada === "secao" ? `<span class="nota">(cada bolinha é uma seção, em volta da sua escola · aproxime o mapa${modoS !== modo ? " · nas seções este modo usa os votos casados" : ""})</span>` : camada === "zona" ? `<span class="nota">(cada círculo é uma zona eleitoral, no centro das suas escolas)</span>` : "");
  if (camada === "secao") { const k = ["a", "b"].includes(modoS) ? modoS : "cas"; $("#lat-" + id).innerHTML = `<h4>Seções ${k === "cas" ? "com mais votos casados" : "com mais votos " + do_(k)} <small>${int(secs.length)} seções</small></h4><p class="nota">${NA} · ${NB} · <span class="cc">casados</span></p>${rankS(secs, k, 14)}`; return; }
  const nomeC = {regional: "regionais", bairro: "bairros", escola: "escolas", zona: "zonas"}[camada], mn = MODOS.find(x => x[0] === modo)[1];
  const ordenada = lista.filter(u => u[modo] != null && isFinite(u[modo])).sort((a, b) => b[modo] - a[modo]);
  const maisA = lista.filter(u => u.a > u.b).sort((a, b) => (b.a - b.b) - (a.a - a.b)), maisB = lista.filter(u => u.b > u.a).sort((a, b) => (b.b - b.a) - (a.b - a.a));
  const itemD = u => `<li><button data-pop="${u.tipo}|${esc(u.chave)}|${m}"><span>${esc(u.nome)}</span><b><span class="ca">${int(u.a)}</span> · <span class="cb">${int(u.b)}</span></b></button></li>`;
  if (modo === "cas" || modo === "sint") { const lc = lista.filter(u => u.cas > 0 && (modo === "cas" || u.cas >= 10)).sort((a, b) => b[modo] - a[modo]);
    $("#lat-" + id).innerHTML = `<h4>${modo === "cas" ? "Mais votos casados" : "Mais sintonia"} <small>${nomeC}${modo === "sint" ? " com 10+ casados" : ""}</small></h4><p class="nota">${NA} · ${NB} · <span class="cc">casados</span></p>${rankC(lc, 14)}`; return; }
  if (modo === "mais") { $("#lat-" + id).innerHTML = `<h4>Quem teve mais votos <small>${nomeC}</small></h4><p class="nota"><b class="ca">${int(maisA.length)}</b> ${nomeC} com mais ${NA} · <b class="cb">${int(maisB.length)}</b> com mais ${NB}</p><h4 class="ca" style="margin-top:12px">${NA} na frente</h4><ol class="rank">${maisA.slice(0, 10).map(itemD).join("") || "<li class='nota'>nenhum</li>"}</ol><h4 class="cb" style="margin-top:12px">${NB} na frente</h4><ol class="rank">${maisB.slice(0, 10).map(itemD).join("") || "<li class='nota'>nenhum</li>"}</ol>`; return; }
  $("#lat-" + id).innerHTML = modo === "rel"
    ? `<h4>Onde cada um pesa mais <small>${nomeC}</small></h4><p class="nota">Compara o peso de cada lugar no total de votos de cada candidato.</p><h4 class="ca" style="margin-top:12px">Mais ${NA}</h4><ol class="rank">${ordenada.filter(u => u.a + u.b > 20).slice(0, 10).map(itemD).join("")}</ol><h4 class="cb" style="margin-top:12px">Mais ${NB}</h4><ol class="rank">${ordenada.filter(u => u.a + u.b > 20).reverse().slice(0, 10).map(itemD).join("")}</ol>`
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
function piscar(lys) { let n = 0; const t = setInterval(() => { lys.forEach(l => l.setStyle({color: n % 2 ? "#ffffff" : COR.neutro, weight: n % 2 ? 4 : 2})); if (++n > 7) clearInterval(t); }, 220); }
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
    L.circleMarker([e0.lat, e0.lng], {radius: 9, color: "#fff", weight: 3, fillColor: COR.a, fillOpacity: 1}).bindTooltip(dica(acharUnidade("escola", chave, mun), "escola"), {permanent: true, direction: "top"}).addTo(mapa);
    mapa.flyTo([e0.lat, e0.lng], 14, {duration: 1}); return;
  }
  if (!lys.length) return;
  if (lys[0].getLatLng && lys.length === 1) mapa.flyTo(lys[0].getLatLng(), Math.max(mapa.getZoom(), 15), {duration: 1}); else mapa.flyToBounds(L.featureGroup(lys).getBounds().pad(.4), {duration: 1, maxZoom: 15});
  setTimeout(() => { lys.forEach(l => l.bringToFront?.()); lys[0].openTooltip?.(); piscar(lys); }, 1050);
}
document.addEventListener("click", e => { const v = e.target.closest("[data-ver]"); if (v) { e.preventDefault(); const [t, c, m] = v.dataset.ver.split("|"); verNoMapa(t, c, m); } });

/* ---------------- Minas Gerais */
function minas() {
  const nv = E.nivelMG, l = nivelMG(nv === "secao" ? "mun" : nv), mg = soma(ESC);
  const fora = soma(ESC.filter(e => e.mun !== BH)), ri = soma(ESC.filter(e => MUN(e.mun)?.ri === "Belo Horizonte" && e.mun !== BH));
  const top = nivelMG("mun").slice().sort((a, b) => (b.a + b.b) - (a.a + a.b)).slice(0, 20);
  $("#p-minas").innerHTML = `<div class="cab"><h2>Minas Gerais</h2><p>Os dois em todo o estado: cidades, zonas eleitorais, macrorregiões, microrregiões e regiões do IBGE. Toque num lugar para ver os detalhes.</p></div>
    <div class="kpis"><div class="kpi"><b class="ca">${int(fora.a)}</b><span>votos ${do_("a")} fora de BH (${pct(fora.a / mg.a, 0)})</span></div><div class="kpi"><b class="cb">${int(fora.b)}</b><span>votos ${do_("b")} fora de BH (${pct(fora.b / mg.b, 0)})</span></div>
      <div class="kpi"><b>${int(ri.a)} · ${int(ri.b)}</b><span>no resto da região de BH (${NA} · ${NB})</span></div><div class="kpi"><b>${int(nivelMG("mun").filter(c => c.a > 0).length)} · ${int(nivelMG("mun").filter(c => c.b > 0).length)}</b><span>cidades com voto (${NA} · ${NB})</span></div>
      <div class="kpi"><b class="cc">${int(mg.cas)}</b><span>votos casados nas escolas de Minas · sintonia de ${pct(mg.sint, 0)}</span></div></div>
    <div class="card" style="margin-bottom:14px"><h4>Cidades com mais votos casados <small>${NA} · ${NB} · casados · a bolinha mostra a sintonia</small></h4>${rankC(nivelMG("mun"), 20)}</div>
    <div class="linha"><span class="rot">Ver por</span><div class="seg" id="nivelMG">${Object.entries(NIV).map(([k, v]) => `<button data-n="${k}" aria-pressed="${k === nv}">${v[0]}</button>`).join("")}<button data-n="secao" aria-pressed="${nv === "secao"}">Seções (urnas)</button></div></div>
    <div class="linha"><span class="rot">Pintar por</span><div class="seg" data-modo="mg">${MODOS.map(([k, n]) => `<button data-v="${k}" aria-pressed="${(E.modo.mg || "cas") === k}">${esc(n)}</button>`).join("")}</div></div>
    <div class="mapa-wrap"><div><div class="mapa" id="mapa-mg"></div><div class="legenda" id="leg-mg"></div></div><aside class="card lateral" id="lat-mg"></aside></div>
    <div class="grid2" style="margin-top:14px"><div class="card"><h4>As 20 cidades com mais votos dos dois</h4><canvas id="g-topcid" height="420"></canvas></div><div class="card"><h4>Macrorregiões: % dos válidos</h4><canvas id="g-macro" height="420"></canvas></div></div>
    <div class="card" style="margin-top:14px">${nv === "secao" ? `<div id="mgSecTab"><p class="nota">Carregando as seções…</p></div>` : tabela(l, NIV[nv][1], "mg-" + nv)}</div>`;
  if (nv === "secao") carregarSecoes().then(S => { const b = $("#mgSecTab"); if (b) b.innerHTML = secTabela("mg-sec", S, "Todas as seções de Minas"); });
  grafico("g-topcid", {type: "bar", data: {labels: top.map(c => c.nome), datasets: dsAB(k => top.map(c => c[k]))},
    options: {indexAxis: "y", plugins: {tooltip: {callbacks: {label: c => `${c.dataset.label}: ${int(c.raw)} votos`}}}, scales: {x: {grid: grade, type: "logarithmic", title: {display: true, text: "votos (escala log)"}}, y: {grid: {display: false}}}}}, i => verNoMapa("mun", top[i].chave, top[i].chave));
  const me = nivelMG("me").slice().sort((a, b) => b.bp - a.bp);
  grafico("g-macro", {type: "bar", data: {labels: me.map(c => c.nome), datasets: dsAB(k => me.map(c => c[k + "p"] * 100))},
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
  L.tileLayer(TILES, {attribution: "Esri · IBGE · TSE", maxZoom: 14}).addTo(mapa);
  mapa.on("click focus", () => mapa.scrollWheelZoom.enable());
  if (E.nivelMG === "secao") return mapaMGSecoes(mapa, el);
  const nv = E.nivelMG, modo = E.modo.mg || "cas", l = nivelMG(nv), nvMapa = nv === "zona" ? "mun" : nv, lm = nivelMG(nvMapa);
  const unidadeDe = new Map(); for (const u of lm) for (const e of u.escolas) unidadeDe.set(e.mun, u);
  const ibgeMun = new Map(Object.entries(E.B.municipios).map(([m, x]) => [x.ibge, m])), q = quebras(lm.map(u => u[modo]));
  const grupo = L.featureGroup().addTo(mapa);
  L.geoJSON(E.geo, {style: f => { const u = unidadeDe.get(ibgeMun.get(f.properties.ibge)); return {color: nvMapa === "mun" ? BORDA_MAPA : "rgba(10,22,32,.4)", weight: nvMapa === "mun" ? .4 : .2, fillOpacity: nv === "zona" ? .25 : .9, fillColor: cor(u, modo, q)}; },
    onEachFeature: (f, ly) => { const u = unidadeDe.get(ibgeMun.get(f.properties.ibge)); if (!u) return; ly.bindTooltip(dica(u, NIV[nvMapa][1].toLowerCase()), {sticky: true}); ly.on("click", ev => popover(u, ev.originalEvent)); registrar("mg", `${u.tipo}|${u.chave}`, ly); }}).addTo(grupo);
  if (nvMapa !== "mun") L.polyline(bordasRegiao(nvMapa, ib => NIV[nvMapa][2]({mun: ibgeMun.get(ib)})), {color: COR.neutro, weight: 1.4, opacity: .85, interactive: false}).addTo(grupo);
  if (nv === "zona") {
    const qz = quebras(l.map(u => u[modo])), mx = Math.max(...l.map(u => u.el));
    for (const u of l) { const c = u.escolas.filter(e => e.lat != null); if (!c.length) continue; const t = c.reduce((a, e) => a + e.el, 0), lat = c.reduce((a, e) => a + e.lat * e.el, 0) / t, lng = c.reduce((a, e) => a + e.lng * e.el, 0) / t;
      const mk = L.circleMarker([lat, lng], {radius: 4 + 12 * Math.sqrt(u.el / mx), color: BORDA_MAPA, weight: 1, fillOpacity: .92, fillColor: cor(u, modo, qz)}).bindTooltip(dica(u, "zona"), {sticky: true}).on("click", ev => popover(u, ev.originalEvent)).addTo(grupo); registrar("mg", `zona|${u.chave}`, mk); }
  }
  mapa.fitBounds(grupo.getBounds()); new ResizeObserver(() => mapa.invalidateSize()).observe(el);
  $("#leg-mg").innerHTML = legenda(modo, nv === "zona" ? quebras(l.map(u => u[modo])) : q);
  const ord = l.filter(u => u[modo] != null && isFinite(u[modo]) && u.a + u.b > 30).sort((a, b) => b[modo] - a[modo]), mn = MODOS.find(x => x[0] === modo)[1];
  const item = u => `<li><button data-pop="${u.tipo}|${esc(u.chave)}|"><span>${esc(u.nome)}</span><b>${modo === "rel" ? int(u.a) + " · " + int(u.b) : fmt(modo, u[modo])}</b></button></li>`;
  if (modo === "cas" || modo === "sint") { const lc = l.filter(u => u.cas > 0 && (modo === "cas" || u.cas >= 30)).sort((a, b) => b[modo] - a[modo]);
    $("#lat-mg").innerHTML = `<h4>${modo === "cas" ? "Mais votos casados" : "Mais sintonia"} <small>${NIV[nv][0].toLowerCase()}${modo === "sint" ? " com 30+ casados" : ""}</small></h4><p class="nota">${NA} · ${NB} · <span class="cc">casados</span></p>${rankC(lc, 16)}`; return; }
  if (modo === "mais") { const ma = l.filter(u => u.a > u.b).sort((a, b) => (b.a - b.b) - (a.a - a.b)), mb = l.filter(u => u.b > u.a).sort((a, b) => (b.b - b.a) - (a.b - a.a)), it = u => `<li><button data-pop="${u.tipo}|${esc(u.chave)}|"><span>${esc(u.nome)}</span><b><span class="ca">${int(u.a)}</span> · <span class="cb">${int(u.b)}</span></b></button></li>`;
    $("#lat-mg").innerHTML = `<h4>Quem teve mais votos <small>${NIV[nv][0].toLowerCase()}</small></h4><p class="nota"><b class="ca">${int(ma.length)}</b> com mais ${NA} · <b class="cb">${int(mb.length)}</b> com mais ${NB}</p><h4 class="ca" style="margin-top:12px">${NA} na frente</h4><ol class="rank">${ma.slice(0, 12).map(it).join("") || "<li class='nota'>nenhum</li>"}</ol><h4 class="cb" style="margin-top:12px">${NB} na frente</h4><ol class="rank">${mb.slice(0, 12).map(it).join("") || "<li class='nota'>nenhum</li>"}</ol>`; return; }
  $("#lat-mg").innerHTML = modo === "rel" ? `<h4>Onde cada um pesa mais <small>${NIV[nv][0].toLowerCase()} com 30+ votos</small></h4><h4 class="ca" style="margin-top:10px">Mais ${NA}</h4><ol class="rank">${ord.slice(0, 12).map(item).join("")}</ol><h4 class="cb" style="margin-top:12px">Mais ${NB}</h4><ol class="rank">${ord.slice().reverse().slice(0, 12).map(item).join("")}</ol>`
    : `<h4>${esc(mn)} <small>${NIV[nv][0].toLowerCase()}</small></h4><ol class="rank">${ord.slice(0, 25).map(item).join("")}</ol>`;
}

async function mapaMGSecoes(mapa, el) {
  const SEC = await carregarSecoes(); if (!document.body.contains(el)) return;
  const modo = E.modo.mg || "cas", MS = ["cas", "sint", "mais", "a", "b", "razao"], modoS = MS.includes(modo) ? modo : "cas";
  for (const x of SEC) { x.mais = Math.log2((x.a + 1) / (x.b + 1)); x.razao = x.b ? x.a / x.b * 100 : null; }
  const q = modoS === "cas" ? [2, 5, 10, 20] : modoS === "sint" ? [.25, .5, .75, .9] : quebras(SEC.map(x => x[modoS])), grupo = L.featureGroup().addTo(mapa);
  L.geoJSON(E.geo, {style: {color: "rgba(223,233,239,.16)", weight: .4, fillColor: "#132636", fillOpacity: .5}, interactive: false}).addTo(grupo);
  const porEsc = new Map(); for (const x of SEC) { if (!porEsc.has(x.i)) porEsc.set(x.i, []); porEsc.get(x.i).push(x); }
  for (const [i, ls] of porEsc) { const e = ESC[i]; if (e.lat == null) continue; const k = ls.length, raio = .00022 * (1 + k / 10);
    ls.forEach((x, j) => { const ang = 2 * Math.PI * j / k;
      L.circleMarker([e.lat + raio * Math.sin(ang), e.lng + raio * Math.cos(ang) / Math.cos(e.lat * Math.PI / 180)], {radius: 2.6, color: "rgba(255,255,255,.35)", weight: .4, fillOpacity: .95, fillColor: corSec(x, modoS, q)})
        .bindTooltip(`<b>Seção ${x.n} · Zona ${x.zona}</b><br><small style="color:${FAINT}">${esc(e.nome)} · ${esc(MUN(e.mun).nome)}</small><br><span style="color:${COR.a}">■</span> ${NA}: <b>${int(x.a)}</b> · <span style="color:${COR.b}">■</span> ${NB}: <b>${int(x.b)}</b><br><span style="color:${COR.c}">■</span> Casados: <b>${int(x.cas)}</b> · sintonia ${pct(x.sint, 0)}`, {sticky: true})
        .on("click", ev => popover(acharUnidade("escola", String(i), e.mun), ev.originalEvent)).addTo(grupo); }); }
  mapa.fitBounds(grupo.getBounds()); new ResizeObserver(() => mapa.invalidateSize()).observe(el);
  $("#leg-mg").innerHTML = (modoS === "cas" || modoS === "sint" ? [["#5b6b78", "nenhum casado"], ...SECPAL.map((c, i) => [c, modoS === "cas" ? ["1 a 2", "3 a 5", "6 a 10", "11 a 20", "mais de 20"][i] : ["até 25%", "25 a 50%", "50 a 75%", "75 a 90%", "acima de 90%"][i]])].map(([c, t]) => `<span><b style="background:${c}"></b>${t}</span>`).join("") : legenda(modoS, q)) + `<span class="nota">(cada bolinha é uma seção, em volta da sua escola · aproxime o mapa${modoS !== modo ? " · nas seções este modo usa os votos casados" : ""})</span>`;
  const k = ["a", "b"].includes(modoS) ? modoS : "cas";
  $("#lat-mg").innerHTML = `<h4>Seções ${k === "cas" ? "com mais votos casados" : "com mais votos " + do_(k)} <small>${int(SEC.length)} seções</small></h4><p class="nota">${NA} · ${NB} · <span class="cc">casados</span></p>${rankS(SEC, k, 16)}`;
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
  const todas = ESC.map(e => Object.assign(derivar({...e, n: 1}), {nome: `${e.nome}`, tipo: "escola", chave: e.id, escolas: [e]})).filter(u => u.a + u.b > 0);
  todas.forEach(u => { u.nome = `${u.nome} — ${u.escolas[0].bairro} · ${MUN(u.escolas[0].mun).nome}`; });
  const ambos = todas.filter(u => u.a >= 20 && u.b >= 20).sort((a, b) => (b.ap + b.bp) - (a.ap + a.bp)).slice(0, 15);
  $("#p-escolas").innerHTML = `<div class="cab"><h2>Escolas de Minas</h2><p>Todos os ${int(todas.length)} locais de votação onde pelo menos um dos dois teve voto, com quantos votos cada um teve e quanto casou. Use o filtro para achar uma escola, bairro ou cidade.</p></div>
    <div class="grid3"><div class="card"><h4><span class="ca">${NA}</span> · mais votos</h4>${rank(todas, "a", 12)}</div><div class="card"><h4><span class="cb">${NB}</span> · mais votos</h4>${rank(todas, "b", 12)}</div>
      <div class="card"><h4><span class="cc">Mais votos casados</span> <small>${NA} · ${NB} · casados</small></h4>${rankC(todas, 12)}</div></div>
    <div class="card" style="margin-top:14px"><h4>Onde a dobradinha foi forte em % <small>os dois com 20+ votos, maior % somado</small></h4><ol class="rank">${ambos.map(u => `<li><button data-pop="escola|${u.chave}|${u.escolas[0].mun}"><span>${esc(u.nome)}</span><b><span class="ca">${pct(u.ap, 1)}</span> · <span class="cb">${pct(u.bp, 1)}</span></b></button></li>`).join("")}</ol></div>
    <div class="card" style="margin-top:14px">${tabela(todas, "Escola", "todas")}</div>`;
  animar($("#p-escolas"));
}

/* ---------------- seções (urnas) e zonas eleitorais */
async function carregarSecoes() {
  if (!E.secoes) E.secoes = fetch("dados/secoes.json").then(r => r.json());
  const S = await E.secoes;
  if (!E.SEC) { E.SEC = []; S.forEach((l, i) => { const e = ESC[i]; for (const [n, a, b] of l) E.SEC.push({i, n, a, b, cas: Math.min(a, b), sint: Math.max(a, b) ? Math.min(a, b) / Math.max(a, b) : null, zona: String(e.zona), mun: e.mun, escola: e.nome, bairro: e.bairro}); }); }
  return E.SEC;
}
const nomeZona = z => (E.B.zonas[z]?.nome || "").replace(/^Zona \d+\s*·\s*/, "") || "Minas Gerais";   // o cadastro já vem como "Zona 28 · Belo Horizonte"
const rotSec = x => `Seção ${x.n} · Zona ${x.zona}`;
const rankS = (l, k, n) => `<ol class="rank">${l.filter(x => x[k] > 0).sort((p, q) => q[k] - p[k] || q.cas - p.cas).slice(0, n).map(x => `<li><button data-pop="escola|${x.i}|${x.mun}"><span>${esc(rotSec(x))}<small class="sub">${esc(x.escola)} · ${esc(MUN(x.mun).nome)}</small>${k === "cas" ? `<i class="sint" style="--s:${Math.round((x.sint || 0) * 100)}%"></i>` : ""}</span><b>${k === "cas" ? `<span class="ca">${int(x.a)}</span> · <span class="cb">${int(x.b)}</span> · <span class="cc">${int(x.cas)}</span>` : `<span class="${k === "a" ? "ca" : "cb"}">${int(x[k])}</span>`}</b></button></li>`).join("") || "<li class='nota'>nenhuma</li>"}</ol>`;
const SCOLS = [["n", "Seção", x => x.n], ["zona", "Zona", x => x.zona], ["escola", "Local de votação", x => esc(x.escola)], ["bairro", "Bairro", x => esc(x.bairro)], ["cid", "Cidade", x => esc(MUN(x.mun).nome)], ["a", () => NA, x => int(x.a), "ta"], ["b", () => NB, x => int(x.b), "tb"], ["cas", "Casados", x => int(x.cas), "tc"], ["sint", "Sintonia", x => pct(x.sint, 0), "tc"]];
function secTabela(id, l, titulo) {
  E.stabs = E.stabs || {}; E.stabs[id] = {l, titulo};
  const o = E.ordem[id] || {k: "cas", dir: -1}, f = semAc(E.filtro[id] || "");
  const val = (x, k) => k === "cid" ? MUN(x.mun).nome : x[k];
  const ls = l.filter(x => !f || semAc(`secao ${x.n} zona ${x.zona} ${x.escola} ${x.bairro} ${MUN(x.mun).nome}`).includes(f))
    .sort((p, q) => { const a = val(p, o.k), b = val(q, o.k); return (typeof a === "string" ? a.localeCompare(b) : (a ?? -1) - (b ?? -1)) * o.dir; });
  const LIM = 400, mostra = ls.slice(0, LIM);
  return `<div class="ferr" data-stab="${id}"><h4 style="margin:0;flex:1">${esc(titulo)} <small>${int(ls.length)} seções${ls.length > LIM ? ` · mostrando ${LIM}, use o filtro ou a ordem` : ""} · toque no título da coluna para ordenar</small></h4><input type="search" placeholder="Filtrar seção, zona, escola, bairro ou cidade…" value="${esc(E.filtro[id] || "")}" data-sfiltro="${id}"><button class="btn" data-scsv="${id}">Baixar CSV</button></div>
    <div class="tab-wrap"><table><thead><tr>${SCOLS.map(([k, t, , c]) => `<th class="${c || ""}" data-sord="${id}|${k}">${esc(typeof t === "function" ? t() : t)}${o.k === k ? (o.dir < 0 ? " ↓" : " ↑") : ""}</th>`).join("")}</tr></thead>
    <tbody>${mostra.map(x => `<tr data-pop="escola|${x.i}|${x.mun}">${SCOLS.map(([k, , g], j) => `<td${j > 1 && j < 5 ? ' style="text-align:left"' : ""}>${j === 0 ? `<b>${g(x)}</b>` : g(x)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function reSecTabela(id) { const t = E.stabs[id], box = $(`[data-stab="${id}"]`).parentElement, foco = document.activeElement?.dataset?.sfiltro === id; box.innerHTML = secTabela(id, t.l, t.titulo); if (foco) { const i = box.querySelector("[data-sfiltro]"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
document.addEventListener("click", e => {
  const th = e.target.closest("[data-sord]"); if (th) { const [id, k] = th.dataset.sord.split("|"); const o = E.ordem[id] || {k: "cas", dir: -1}; E.ordem[id] = o.k === k ? {k, dir: -o.dir} : {k, dir: ["n", "zona", "escola", "bairro", "cid"].includes(k) ? 1 : -1}; reSecTabela(id); return; }
  const c = e.target.closest("[data-scsv]"); if (c) { const t = E.stabs[c.dataset.scsv];
    const linhas = [["Seção", "Zona", "Local de votação", "Bairro", "Cidade", NA, NB, "Votos casados", "Sintonia %"].join(";")].concat(t.l.map(x => [x.n, x.zona, x.escola, x.bairro, MUN(x.mun).nome, x.a, x.b, x.cas, dec((x.sint || 0) * 100, 1)].map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")));
    Object.assign(document.createElement("a"), {href: URL.createObjectURL(new Blob(["\ufeff" + linhas.join("\n")], {type: "text/csv"})), download: `${CF.slug}-${c.dataset.scsv}.csv`}).click(); return; }
  const z = e.target.closest("[data-zona]"); if (z) abrirZona(z.dataset.zona);
});
document.addEventListener("input", e => { const f = e.target.closest("[data-sfiltro]"); if (f) { E.filtro[f.dataset.sfiltro] = f.value; reSecTabela(f.dataset.sfiltro); } });
document.addEventListener("change", e => { if (e.target.id === "zonaSel") { E.zona = e.target.value; zonaDetalhe(false); } });
function abrirZona(z) { E.zona = z; E.sub = "juntas"; subSZ(); setTimeout(() => rolarAte($("#subSZ")), 60); }

const SUBS = [["zonas", "Zonas eleitorais"], ["secoes", "Seções (urnas)"], ["juntas", "Zona e suas seções"]];
const opt = (v, t, sel) => `<option value="${esc(v)}"${v === sel ? " selected" : ""}>${esc(t)}</option>`;
async function secoesZonas() {
  const p = $("#p-secoes");
  if (!E.SEC) p.innerHTML = `<div class="cab"><h2>Seções e zonas</h2><p>Carregando as seções eleitorais…</p></div>`;
  const SEC = await carregarSecoes(), zonas = nivelMG("zona").filter(z => z.a + z.b > 0);
  for (const z of zonas) z.cids = z.cids || [...new Set(z.escolas.map(e => MUN(e.mun).nome))];
  const dois = SEC.filter(x => x.a > 0 && x.b > 0).length, cas = SEC.reduce((t, x) => t + x.cas, 0);
  E.sub = E.sub || "zonas";
  if (!E.zona || !zonas.some(z => z.chave === E.zona)) E.zona = zonas.slice().sort((a, b) => b.cas - a.cas)[0].chave;
  p.innerHTML = `<div class="cab"><h2>Seções e zonas</h2><p>A zona eleitoral reúne várias escolas; cada escola tem várias seções (urnas), o menor pedaço que o TSE publica. Veja as zonas, as seções ou uma zona com todas as suas seções.</p></div>
    <div class="kpis"><div class="kpi"><b>${int(zonas.length)}</b><span>zonas eleitorais com voto</span></div><div class="kpi"><b>${int(SEC.length)}</b><span>seções com voto de pelo menos um dos dois</span></div>
      <div class="kpi"><b>${int(dois)}</b><span>seções com voto dos dois (${pct(dois / SEC.length, 0)})</span></div><div class="kpi"><b class="cc">${int(cas)}</b><span>votos casados somando todas as urnas</span></div></div>
    <div class="sub-abas" id="subSZ" role="tablist">${SUBS.map(([k, n]) => `<button data-sub="${k}" aria-pressed="${k === E.sub}">${n}</button>`).join("")}</div>
    <div id="sz-corpo"></div>`;
  animar(p);
  return subSZ();
}
function subSZ() {
  $$("#subSZ [data-sub]").forEach(b => b.setAttribute("aria-pressed", b.dataset.sub === E.sub));
  return E.sub === "zonas" ? vistaZonas() : E.sub === "secoes" ? vistaSecoes() : vistaJuntas();
}
const rolarAte = el => { const ctl = $("#controles"), fixa = getComputedStyle(ctl).position === "sticky" ? ctl.offsetHeight : 0; scrollTo({top: el.getBoundingClientRect().top + scrollY - fixa - 12, behavior: "smooth"}); };

/* vista 1: zonas eleitorais */
function vistaZonas() {
  const f = E.zf = E.zf || {ri: "", mun: "", q: ""}, todas = nivelMG("zona").filter(z => z.a + z.b > 0);
  const ris = [...new Set(Object.values(E.B.municipios).map(m => m.ri).filter(Boolean))].sort();
  const cids = [...new Set(todas.flatMap(z => z.escolas.map(e => e.mun)))].sort((a, b) => MUN(a).nome.localeCompare(MUN(b).nome));
  $("#sz-corpo").innerHTML = `<div class="filtros"><label><span>Região</span><select data-zf="ri">${opt("", "Todas as regiões", f.ri)}${ris.map(x => opt(x, "Região de " + x, f.ri)).join("")}</select></label>
      <label><span>Cidade</span><select data-zf="mun">${opt("", "Todas as cidades", f.mun)}${cids.map(m => opt(m, MUN(m).nome, f.mun)).join("")}</select></label>
      <label class="q"><span>Buscar</span><input type="search" data-zf="q" value="${esc(f.q)}" placeholder="Número da zona ou cidade…"></label>
      <button class="btn" data-zlimpar>Limpar filtros</button></div>
    <div id="zf-corpo"></div>`;
  return zonasCorpo();
}
function zonasCorpo() {
  const f = E.zf, q = semAc(f.q), todas = nivelMG("zona").filter(z => z.a + z.b > 0);
  const l = todas.filter(z => (!f.ri || z.escolas.some(e => MUN(e.mun)?.ri === f.ri)) && (!f.mun || z.escolas.some(e => e.mun === f.mun)) && (!q || semAc(`zona ${z.chave} ${z.chave} ${z.cids.join(" ")}`).includes(q)));
  const u = soma(l.flatMap(z => z.escolas));
  $("#zf-corpo").innerHTML = !l.length ? `<p class="nota" style="margin:18px 0">Nenhuma zona com esse filtro.</p>` : `
    <p class="resumo-f"><b>${int(l.length)}</b> ${l.length === 1 ? "zona" : "zonas"}${l.length < todas.length ? ` de ${int(todas.length)}` : ""} · <span class="ca">${NA} ${int(u.a)}</span> · <span class="cb">${NB} ${int(u.b)}</span> · <span class="cc">${int(u.cas)} casados</span> · sintonia de ${pct(u.sint, 0)}</p>
    <div class="mapa-wrap"><div><div class="mapa" id="mapa-zonas"></div><div class="legenda" id="leg-zonas"></div></div><aside class="card lateral"><h4>Mais votos casados <small>toque para abrir a zona com as seções</small></h4><ol class="rank">${l.slice().sort((a, b) => b.cas - a.cas).slice(0, 12).map(z => `<li><button data-zona="${esc(z.chave)}"><span>Zona ${esc(z.chave)}<small class="sub">${esc(z.cids.slice(0, 3).join(", "))}${z.cids.length > 3 ? ` e mais ${z.cids.length - 3}` : ""}</small><i class="sint" style="--s:${Math.round((z.sint || 0) * 100)}%"></i></span><b><span class="ca">${int(z.a)}</span> · <span class="cb">${int(z.b)}</span> · <span class="cc">${int(z.cas)}</span></b></button></li>`).join("")}</ol></aside></div>
    <div class="grid3" style="margin-top:14px"><div class="card"><h4><span class="ca">${NA}</span> · zonas com mais votos</h4>${rank(l, "a", 10)}</div><div class="card"><h4><span class="cb">${NB}</span> · zonas com mais votos</h4>${rank(l, "b", 10)}</div>
      <div class="card"><h4><span class="cc">Zonas com mais votos casados</span></h4>${rankC(l, 10)}</div></div>
    <div class="card" style="margin-top:14px">${tabela(l, "Zona", "zonas-t")}</div>`;
  animar($("#zf-corpo"));
  return l.length ? mapaZonas(l) : null;
}

/* vista 2: seções (urnas) */
function vistaSecoes() {
  const f = E.sf = E.sf || {zona: "", mun: "", tipo: "todas", min: 0}, zonas = nivelMG("zona").filter(z => z.a + z.b > 0).sort((a, b) => +a.chave - +b.chave);
  const cids = [...new Set(E.SEC.map(x => x.mun))].sort((a, b) => MUN(a).nome.localeCompare(MUN(b).nome));
  $("#sz-corpo").innerHTML = `<div class="filtros"><label><span>Zona</span><select data-sf="zona">${opt("", "Todas as zonas", f.zona)}${zonas.map(z => opt(z.chave, `Zona ${z.chave} · ${z.cids.slice(0, 2).join(", ")}${z.cids.length > 2 ? "…" : ""}`, f.zona)).join("")}</select></label>
      <label><span>Cidade</span><select data-sf="mun">${opt("", "Todas as cidades", f.mun)}${cids.map(m => opt(m, MUN(m).nome, f.mun)).join("")}</select></label>
      <label><span>Mostrar</span><span class="seg mini">${[["todas", "Todas"], ["dois", "Os dois votados"], ["a", "Só " + NA], ["b", "Só " + NB]].map(([k, n]) => `<button data-stipo="${k}" aria-pressed="${f.tipo === k}">${esc(n)}</button>`).join("")}</span></label>
      <label class="num"><span>Casados no mínimo</span><input type="number" min="0" step="1" data-sf="min" value="${f.min || 0}"></label>
      <button class="btn" data-slimpar>Limpar filtros</button></div>
    <div id="sf-corpo"></div>`;
  return secoesCorpo();
}
function secoesFiltradas() {
  const f = E.sf;
  return E.SEC.filter(x => (!f.zona || x.zona === f.zona) && (!f.mun || x.mun === f.mun) && (f.tipo === "todas" || (f.tipo === "dois" ? x.a > 0 && x.b > 0 : f.tipo === "a" ? x.a > 0 && !x.b : x.b > 0 && !x.a)) && x.cas >= (+f.min || 0));
}
function secoesCorpo() {
  const l = secoesFiltradas(), dois = l.filter(x => x.a > 0 && x.b > 0), soma3 = k => l.reduce((t, x) => t + x[k], 0), A = soma3("a"), Bv = soma3("b"), cas = soma3("cas");
  const faixas = [["até 25%", 0, .25], ["25 a 50%", .25, .5], ["50 a 75%", .5, .75], ["75 a 100%", .75, 1.01]].map(([n, a, b]) => [n, dois.filter(x => x.sint >= a && x.sint < b).length]);
  $("#sf-corpo").innerHTML = !l.length ? `<p class="nota" style="margin:18px 0">Nenhuma seção com esse filtro.</p>` : `
    <p class="resumo-f"><b>${int(l.length)}</b> seções · <span class="ca">${NA} ${int(A)}</span> · <span class="cb">${NB} ${int(Bv)}</span> · <span class="cc">${int(cas)} casados</span> · ${int(dois.length)} com voto dos dois</p>
    <div class="grid3"><div class="card"><h4><span class="ca">${NA}</span> · seções com mais votos</h4>${rankS(l, "a", 10)}</div><div class="card"><h4><span class="cb">${NB}</span> · seções com mais votos</h4>${rankS(l, "b", 10)}</div>
      <div class="card"><h4><span class="cc">Seções com mais votos casados</span></h4>${rankS(l, "cas", 10)}</div></div>
    <div class="grid2" style="margin-top:14px"><div class="card"><h4>Seções com voto dos dois, por sintonia <small>quanto a votação dos dois se parece em cada urna</small></h4><canvas id="g-sint" height="220"></canvas></div>
      <div class="card"><h4>Como ler</h4><p class="nota" style="font-size:13.5px;line-height:1.5">Cada linha é uma urna. <b class="cc">Casados</b> é o menor dos dois votos naquela urna: o máximo de eleitores que podem ter votado ${do_("a")} e ${do_("b")} juntos. <b>Sintonia</b> é casados ÷ o maior dos dois: 100% quando os dois tiveram a mesma votação na urna. Toque numa linha para abrir a escola com todas as suas seções.</p></div></div>
    <div class="card" style="margin-top:14px">${secTabela("sec-todas", l, "Seções")}</div>`;
  grafico("g-sint", {type: "bar", data: {labels: faixas.map(x => x[0]), datasets: [{label: "Seções", data: faixas.map(x => x[1]), backgroundColor: rampa(COR.c).slice(1), borderRadius: 6}]},
    options: {plugins: {legend: {display: false}, tooltip: {callbacks: {label: c => `${int(c.raw)} seções`}}}, scales: {y: {grid: grade, title: {display: true, text: "seções"}}, x: {grid: {display: false}, title: {display: true, text: "sintonia na urna"}}}}});
  animar($("#sf-corpo"));
}

/* vista 3: uma zona com as escolas e as seções de cada escola */
function vistaJuntas() {
  const zonas = nivelMG("zona").filter(z => z.a + z.b > 0).sort((a, b) => +a.chave - +b.chave);
  $("#sz-corpo").innerHTML = `<div class="filtros"><label class="q"><span>Zona</span><select id="zonaSel">${zonas.map(z => opt(z.chave, `Zona ${z.chave} · ${z.cids.slice(0, 3).join(", ")}${z.cids.length > 3 ? ` e mais ${z.cids.length - 3}` : ""} · ${int(z.cas)} casados`, E.zona)).join("")}</select></label>
      <button class="btn" data-zprox="-1">← Zona anterior</button><button class="btn" data-zprox="1">Próxima zona →</button></div>
    <div id="zonaCorpo"></div>`;
  return zonaDetalhe(false);
}
document.addEventListener("click", e => {
  const sb = e.target.closest("[data-sub]"); if (sb) { E.sub = sb.dataset.sub; subSZ(); return; }
  const st = e.target.closest("[data-stipo]"); if (st) { E.sf.tipo = st.dataset.stipo; $$("[data-stipo]").forEach(b => b.setAttribute("aria-pressed", b === st)); secoesCorpo(); return; }
  if (e.target.closest("[data-zlimpar]")) { E.zf = null; vistaZonas(); return; }
  if (e.target.closest("[data-slimpar]")) { E.sf = null; vistaSecoes(); return; }
  const zp = e.target.closest("[data-zprox]"); if (zp) { const l = nivelMG("zona").filter(z => z.a + z.b > 0).sort((a, b) => +a.chave - +b.chave), i = l.findIndex(z => z.chave === E.zona); E.zona = l[(i + +zp.dataset.zprox + l.length) % l.length].chave; zonaDetalhe(false); }
});
const aoFiltrar = e => {
  const z = e.target.closest("[data-zf]"); if (z) { E.zf[z.dataset.zf] = z.value; if (z.dataset.zf === "q" && e.type === "change") return; zonasCorpo(); return; }
  const sf = e.target.closest("[data-sf]"); if (sf) { E.sf[sf.dataset.sf] = sf.value; if (sf.dataset.sf === "zona" && sf.value) { const z = E.SEC.find(x => x.zona === sf.value); } secoesCorpo(); }
};
document.addEventListener("input", e => { if (e.target.matches("input[data-zf], input[data-sf]")) aoFiltrar(e); });
document.addEventListener("change", e => { if (e.target.matches("select[data-zf], select[data-sf]")) aoFiltrar(e); });
// seções no mapa: paleta clara (as bolinhas são pequenas e os valores por urna são baixos)
const SECPAL = ["#3f7d1c", "#62a815", "#88cc00", "#b8ec3a", "#e6ff8a"];
const corSec = (x, modo, q) => (modo === "cas" || modo === "sint") ? (!x.cas ? "#5b6b78" : SECPAL[q.filter(t => x[modo] > t).length]) : cor(x, modo, q);
const centro = l => { const c = l.filter(e => e.lat != null); if (!c.length) return null; const t = c.reduce((a, e) => a + (e.el || 1), 0); return [c.reduce((a, e) => a + e.lat * (e.el || 1), 0) / t, c.reduce((a, e) => a + e.lng * (e.el || 1), 0) / t]; };
async function mapaZonas(zonas) {
  const todas = nivelMG("zona").filter(z => z.a + z.b > 0), dentro = new Set(zonas.map(z => z.chave));
  if (!E.geo) E.geo = await fetch("dados/mg.geojson").then(r => r.json());
  const el = $("#mapa-zonas"); if (!el) return;
  if (E.mapas.zonas) E.mapas.zonas.remove();
  E.reg.zonas = new Map();
  const mapa = L.map(el, {scrollWheelZoom: false, preferCanvas: true, zoomSnap: .25}); E.mapas.zonas = mapa;
  L.tileLayer(TILES, {attribution: "Esri · IBGE · TSE", maxZoom: 14}).addTo(mapa);
  mapa.on("click focus", () => mapa.scrollWheelZoom.enable());
  const g = L.featureGroup().addTo(mapa);
  L.geoJSON(E.geo, {style: {color: "rgba(223,233,239,.18)", weight: .5, fillColor: "#132636", fillOpacity: .55}, interactive: false}).addTo(g);
  const q = quebras(zonas.map(z => z.cas)), mx = Math.max(...todas.map(z => z.el)), gf = L.featureGroup().addTo(mapa); E.zonaMk = {};
  if (zonas.length < todas.length) for (const z of todas) { if (dentro.has(z.chave)) continue; const c = centro(z.escolas); if (c) L.circleMarker(c, {radius: 2 + 6 * Math.sqrt(z.el / mx), color: "rgba(223,233,239,.25)", weight: .6, fillColor: "#24384a", fillOpacity: .6, interactive: false}).addTo(g); }
  for (const z of zonas.slice().sort((a, b) => b.el - a.el)) { const c = centro(z.escolas); if (!c) continue;
    const mk = L.circleMarker(c, {radius: 3 + 11 * Math.sqrt(z.el / mx), color: z.chave === E.zona ? "#ffffff" : "rgba(10,22,32,.9)", weight: z.chave === E.zona ? 2.5 : .8, fillOpacity: .9, fillColor: cor(z, "cas", q)})
      .bindTooltip(`<b>Zona ${esc(z.chave)}</b> · ${esc(nomeZona(z.chave))}<br><span style="color:${COR.a}">■</span> ${NA}: <b>${int(z.a)}</b> · <span style="color:${COR.b}">■</span> ${NB}: <b>${int(z.b)}</b><br><span style="color:${COR.c}">■</span> Votos casados: <b>${int(z.cas)}</b> · sintonia ${pct(z.sint, 0)}`, {sticky: true})
      .on("click", () => abrirZona(z.chave)).addTo(gf);
    registrar("zonas", `zona|${z.chave}`, mk); E.zonaMk = E.zonaMk || {}; E.zonaMk[z.chave] = mk; }
  mapa.fitBounds((zonas.length < todas.length ? gf : g).getBounds().pad(zonas.length < todas.length ? .25 : 0), {padding: [6, 6], maxZoom: 12}); new ResizeObserver(() => mapa.invalidateSize()).observe(el);
  $("#leg-zonas").innerHTML = legenda("cas", q) + `<span class="nota">(cada bolinha é uma zona · toque para abrir com as seções)</span>`;
}
async function desenharZona(z, u, escs) {
  if (!E.geo) E.geo = await fetch("dados/mg.geojson").then(r => r.json());
  const muns = [...new Set(u.escolas.map(e => e.mun))], ibges = new Set(muns.map(m => MUN(m).ibge));
  const osm = muns.filter(m => E.B.cidadesOSM.includes(m));
  for (const m of osm) { const ib = MUN(m).ibge; if (!E.osm[ib]) E.osm[ib] = await fetch(`dados/osm/${ib}.json`).then(r => r.json()); }
  const el = $("#mapa-zona"); if (!el || E.zona !== z) return;
  if (E.mapas.zona) E.mapas.zona.remove();
  E.reg.zona = new Map();
  const mapa = L.map(el, {scrollWheelZoom: false, preferCanvas: true, zoomSnap: .25}); E.mapas.zona = mapa;
  L.tileLayer(TILES, {attribution: "Esri · OpenStreetMap · IBGE · TSE", maxZoom: 17}).addTo(mapa);
  mapa.on("click focus", () => mapa.scrollWheelZoom.enable());
  const q = quebras(escs.map(x => x.cas)), mx = Math.max(...escs.map(x => x.el)), area = L.featureGroup().addTo(mapa), pts = L.featureGroup().addTo(mapa);
  // municípios da zona (as cidades grandes têm várias zonas: aí entram os bairros da zona)
  const soCidade = muns.length === 1 && osm.length === 1;
  if (!soCidade) {
    const munU = new Map(agrupar(u.escolas, e => e.mun, k => MUN(k).nome, "mun").map(x => [MUN(x.chave).ibge, x])), qm = quebras([...munU.values()].map(x => x.cas));
    L.geoJSON({type: "FeatureCollection", features: E.geo.features.filter(f => ibges.has(f.properties.ibge))}, {style: f => ({color: "rgba(223,233,239,.85)", weight: 1.6, fillColor: cor(munU.get(f.properties.ibge), "cas", qm), fillOpacity: .45}),
      onEachFeature: (f, ly) => { const x = munU.get(f.properties.ibge); if (!x) return; ly.bindTooltip(dica(x, "cidade · parte na zona"), {sticky: true}); if (muns.length <= 14) L.tooltip({permanent: true, direction: "center", className: "rot-mapa"}).setLatLng(ly.getBounds().getCenter()).setContent(esc(x.nome)).addTo(mapa); ly.on("click", ev => popover(x, ev.originalEvent)); }}).addTo(area);
  }
  for (const m of osm) {
    const lm = u.escolas.filter(e => e.mun === m), bairros = agrupar(lm, e => e.bairro, null, "bairro"), pb = new Map(bairros.map(x => [x.nome, x])), qb = quebras(bairros.map(x => x.cas)), ib = MUN(m).ibge;
    L.geoJSON({type: "FeatureCollection", features: E.osm[ib].bairros.features.filter(f => pb.has(f.properties.nome))}, {style: f => ({color: "rgba(223,233,239,.55)", weight: .8, fillColor: cor(pb.get(f.properties.nome), "cas", qb), fillOpacity: .55}),
      onEachFeature: (f, ly) => { const x = pb.get(f.properties.nome); ly.bindTooltip(dica(x, "bairro"), {sticky: true}); ly.on("click", ev => popover(x, ev.originalEvent)); }}).addTo(area);
    L.geoJSON(E.osm[ib].regionais, {style: {color: "rgba(223,233,239,.35)", weight: 1.2, fill: false}, interactive: false}).addTo(mapa);
  }
  for (const x of escs) { const e = x.escolas[0]; if (e.lat == null) continue;
    const mk = L.circleMarker([e.lat, e.lng], {radius: 4 + 9 * Math.sqrt(e.el / mx), color: "#ffffff", weight: 1.2, opacity: .85, fillOpacity: .95, fillColor: cor(x, "cas", q)}).bindTooltip(dica(x, "escola · " + e.bairro), {sticky: true}).on("click", ev => popover(x, ev.originalEvent)).addTo(pts); registrar("zona", `escola|${x.chave}`, mk); }
  const b = (soCidade ? pts : area.getLayers().length ? area : pts).getBounds(); if (b.isValid()) mapa.fitBounds(b, {padding: [16, 16], maxZoom: 15});
  new ResizeObserver(() => mapa.invalidateSize()).observe(el);
  $("#leg-zona").innerHTML = legenda("cas", q) + `<span class="nota">(${soCidade || osm.length ? "bairros e escolas da zona" : "municípios e escolas da zona"}, pelos votos casados · borda branca = escola)</span>`;
}
function zonaDetalhe(rolar) {
  const z = E.zona, u = nivelMG("zona").find(x => x.chave === z), l = E.SEC.filter(x => x.zona === z), box = $("#zonaCorpo"); if (!box || !u) return;
  const sel = $("#zonaSel"); if (sel) sel.value = z;
  const escs = u.escolas.map(e => Object.assign(derivar({...e, n: 1}), {nome: e.nome, tipo: "escola", chave: e.id, escolas: [e]}));
  const cids = [...new Set(u.escolas.map(e => MUN(e.mun).nome))];
  box.innerHTML = `<div class="kpis"><div class="kpi"><b>${int(u.escolas.length)} · ${int(l.length)}</b><span>locais de votação · seções com voto · ${esc(cids.slice(0, 4).join(", "))}${cids.length > 4 ? ` e mais ${cids.length - 4}` : ""}</span></div>
      <div class="kpi"><b class="ca">${int(u.a)}</b><span>votos ${do_("a")} · ${pct(u.ap, 2)} dos válidos</span></div><div class="kpi"><b class="cb">${int(u.b)}</b><span>votos ${do_("b")} · ${pct(u.bp, 2)} dos válidos</span></div>
      <div class="kpi"><b class="cc">${int(u.cas)}</b><span>votos casados · sintonia de ${pct(u.sint, 0)}</span></div></div>
    <div class="mapa-wrap"><div><div class="mapa" id="mapa-zona"></div><div class="legenda" id="leg-zona"></div></div><aside class="card lateral"><h4>Escolas da zona com mais votos casados</h4>${rankC(escs, 12)}</aside></div>
    <div class="cab"><h3>Escolas e suas seções</h3><p>Cada escola da zona com as urnas dela. Toque na escola para abrir ou fechar a lista.</p></div>
    <div class="esc-secoes">${escs.slice().sort((p, q) => q.cas - p.cas || (q.a + q.b) - (p.a + p.b)).map((x, k) => { const ls = l.filter(s => s.i === +x.chave).sort((p, q) => p.n - q.n), mxs = Math.max(1, ...ls.map(s => Math.max(s.a, s.b)));
      return `<details${k < 3 ? " open" : ""}><summary><span><b>${esc(x.nome)}</b><small class="sub">${esc(x.escolas[0].bairro)} · ${esc(MUN(x.escolas[0].mun).nome)} · ${int(ls.length)} seções</small></span><b><span class="ca">${int(x.a)}</span> · <span class="cb">${int(x.b)}</span> · <span class="cc">${int(x.cas)}</span></b></summary>
        <div class="sec-lista">${ls.map(s => `<div class="sec"><span class="sn">Seção ${s.n}</span><span class="sb"><i class="ba" style="width:${s.a / mxs * 100}%"></i><i class="bb" style="width:${s.b / mxs * 100}%"></i></span><b><span class="ca">${int(s.a)}</span> · <span class="cb">${int(s.b)}</span> · <span class="cc">${int(s.cas)}</span></b></div>`).join("") || "<p class='nota'>sem votos dos dois</p>"}</div></details>`; }).join("")}</div>
    <div class="card" style="margin-top:14px">${secTabela("sec-zona", l, `Todas as seções da zona ${z}`)}</div>`;
  animar(box);
  for (const [k, mk] of Object.entries(E.zonaMk || {})) mk.setStyle(k === z ? {color: "#ffffff", weight: 2.5} : {color: "rgba(10,22,32,.9)", weight: .8});
  E.zonaMk?.[z]?.bringToFront();
  desenharZona(z, u, escs);
  if (rolar) rolarAte(box);
}

/* ---------------- análises */
function correl(xs, ys, ws) {
  let sw = 0, mx = 0, my = 0; for (let i = 0; i < xs.length; i++) { sw += ws[i]; mx += ws[i] * xs[i]; my += ws[i] * ys[i]; }
  mx /= sw; my /= sw; let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += ws[i] * dx * dy; sxx += ws[i] * dx * dx; syy += ws[i] * dy * dy; }
  return sxy / Math.sqrt(sxx * syy);
}
function analises() {
  const mg = soma(ESC), curva = k => { const v = ESC.map(e => e[k]).filter(x => x > 0).sort((a, b) => b - a), t = v.reduce((a, x) => a + x, 0); let ac = 0, meio = 0; const pts = [{x: 0, y: 0}]; v.forEach((x, i) => { ac += x; if (!meio && ac >= t / 2) meio = i + 1; if (i % 5 === 0 || i === v.length - 1) pts.push({x: i + 1, y: ac / t * 100}); }); return {pts, n: v.length, meio}; };
  const cA = curva("a"), cB = curva("b");
  const grupos = [["Belo Horizonte", e => e.mun === BH], ["Resto da região de BH", e => e.mun !== BH && MUN(e.mun)?.ri === "Belo Horizonte"], ["Interior", e => MUN(e.mun)?.ri !== "Belo Horizonte"]];
  const gs = grupos.map(([n, f]) => [n, soma(ESC.filter(f))]);
  const cid = nivelMG("mun"), faixas = [["até 10 mil", 0, 1e4], ["10 a 50 mil", 1e4, 5e4], ["50 a 200 mil", 5e4, 2e5], ["200 mil+", 2e5, 1.5e6], ["Belo Horizonte", 1.5e6, 1e9]];
  const fx = faixas.map(([n, a, b]) => [n, soma(cid.filter(c => c.el >= a && c.el < b).flatMap(c => c.escolas))]);
  const me = nivelMG("me").slice().sort((a, b) => b.x22 - a.x22);
  const bhE = ESC.filter(e => e.mun === BH && e.va && e.vb).map(e => derivar({...e})), ma = med(bhE.map(e => e.ap)), mb = med(bhE.map(e => e.bp));
  const quad = [bhE.filter(e => e.ap >= ma && e.bp >= mb).length, bhE.filter(e => e.ap >= ma && e.bp < mb).length, bhE.filter(e => e.ap < ma && e.bp >= mb).length, bhE.filter(e => e.ap < ma && e.bp < mb).length];
  const regs = agrupar(ESC.filter(e => e.mun === BH), e => e.regional, null, "regional").sort((a, b) => b.razao - a.razao);
  $("#p-analises").innerHTML = `<div class="cab"><h2>Análises</h2><p>Como o voto de cada um se distribui e onde a dobradinha se encontra.</p></div>
    <p class="insight">Metade dos votos ${do_("a").replace(/^(do|da) /, "$1 ").replace(NA, `<b class="ca">${NA}</b>`)} veio de <b>${int(cA.meio)}</b> escolas (de ${int(cA.n)} com voto); metade dos ${do_("b").replace(NB, `<b class="cb">${NB}</b>`)} veio de <b>${int(cB.meio)}</b> escolas (de ${int(cB.n)}). ${cA.meio / cA.n < cB.meio / cB.n ? `O voto ${do_("a")} é mais concentrado.` : `O voto ${do_("b")} é mais concentrado.`}</p>
    <div class="grid2"><div class="card"><h4>Concentração do voto <small>% acumulado dos votos × número de escolas (das que mais deram votos para as que menos)</small></h4><canvas id="g-lorenz" height="300"></canvas></div>
      <div class="card"><h4>De onde vêm os votos</h4><canvas id="g-dep" height="300"></canvas></div></div>
    <div class="grid2" style="margin-top:14px"><div class="card"><h4>Por tamanho da cidade <small>% dos válidos</small></h4><canvas id="g-fx" height="300"></canvas></div>
      ${K22 ? `<div class="card"><h4>${nm(K22)} · 2022 × 2026 por macrorregião <small>votos</small></h4><canvas id="g-x22" height="300"></canvas></div>` : `<div class="card"><h4>Peso no ${esc(PART)} por macrorregião <small>% dos votos do partido em cada cargo</small></h4><canvas id="g-x22" height="300"></canvas></div>`}</div>
    <div class="grid2" style="margin-top:14px"><div class="card"><h4>BH · votos ${do_("a")} a cada 100 ${do_("b")}, por regional</h4><canvas id="g-raz" height="300"></canvas></div>
      <div class="card"><h4>BH · as escolas em 4 grupos <small>acima ou abaixo da mediana de cada um</small></h4><canvas id="g-quad" height="300"></canvas>
      <p class="nota">${int(quad[0])} escolas fortes para os dois · ${int(quad[1])} só ${NA} · ${int(quad[2])} só ${NB} · ${int(quad[3])} fracas para os dois.</p></div></div>`;
  animar($("#p-analises"));
  grafico("g-lorenz", {type: "line", data: {datasets: [{label: NA, data: cA.pts, borderColor: COR.a, pointRadius: 0, borderWidth: 3}, {label: NB, data: cB.pts, borderColor: COR.b, pointRadius: 0, borderWidth: 3}]},
    options: {parsing: false, scales: {x: {type: "logarithmic", grid: grade, title: {display: true, text: "número de escolas (escala log)"}}, y: {grid: grade, max: 100, title: {display: true, text: "% acumulado dos votos"}}}, plugins: {tooltip: {callbacks: {label: c => `${c.dataset.label}: ${dec(c.raw.y, 0)}% dos votos em ${int(c.raw.x)} escolas`}}}}});
  grafico("g-dep", {type: "bar", data: {labels: [NA, NB], datasets: gs.map(([n, u], i) => ({label: n, data: [u.a / mg.a * 100, u.b / mg.b * 100], backgroundColor: ["#dfe9ef", "#8fa3b1", "#3e5466"][i], borderRadius: 4}))},
    options: {indexAxis: "y", plugins: {tooltip: {callbacks: {label: c => `${c.dataset.label}: ${dec(c.raw, 1)}%`}}}, scales: {x: {stacked: true, max: 100, grid: grade, title: {display: true, text: "% dos votos de cada um"}}, y: {stacked: true, grid: {display: false}}}}});
  grafico("g-fx", {type: "bar", data: {labels: fx.map(x => x[0]), datasets: dsAB(k => fx.map(x => x[1][k + "p"] * 100))},
    options: {plugins: {tooltip: {callbacks: {label: c => `${c.dataset.label}: ${dec(c.raw, 2)}%`}}}, scales: {y: {grid: grade, title: {display: true, text: "% dos válidos"}}, x: {grid: {display: false}, title: {display: true, text: "eleitores da cidade"}}}}});
  if (K22) grafico("g-x22", {type: "bar", data: {labels: me.map(c => c.nome), datasets: [{label: nm(K22) + " 2022", data: me.map(c => c.x22), backgroundColor: hexA(COR[K22], .35), borderRadius: 4}, {label: nm(K22) + " 2026", data: me.map(c => c[K22]), backgroundColor: COR[K22], borderRadius: 4}]},
    options: {indexAxis: "y", plugins: {tooltip: {callbacks: {label: c => `${c.dataset.label}: ${int(c.raw)} votos`}}}, scales: {x: {grid: grade}, y: {grid: {display: false}}}}}, i => verNoMapa("me", me[i].chave, ""));
  else grafico("g-x22", {type: "bar", data: {labels: me.map(c => c.nome), datasets: dsAB(k => me.map(c => c[k + "pt"] * 100))},
    options: {indexAxis: "y", plugins: {tooltip: {callbacks: {label: c => `${c.dataset.label}: ${dec(c.raw, 1)}% do ${PART}`}}}, scales: {x: {grid: grade}, y: {grid: {display: false}}}}}, i => verNoMapa("me", me[i].chave, ""));
  grafico("g-raz", {type: "bar", data: {labels: regs.map(r => r.nome), datasets: [{label: razaoTxt(), data: regs.map(r => r.razao), backgroundColor: regs.map(r => r.razao >= 100 ? COR.a : COR.b), borderRadius: 4}]},
    options: {indexAxis: "y", plugins: {legend: {display: false}, tooltip: {callbacks: {label: c => `${dec(c.raw, 0)} votos ${do_("a")} a cada 100 ${do_("b")}`}}}, scales: {x: {grid: grade}, y: {grid: {display: false}}}}}, i => verNoMapa("regional", regs[i].chave, BH));
  grafico("g-quad", {type: "doughnut", data: {labels: ["Fortes para os dois", "Só " + NA, "Só " + NB, "Fracas para os dois"], datasets: [{data: quad, backgroundColor: [COR.neutro, COR.a, COR.b, "#2c4152"], borderColor: "#112331", borderWidth: 3}]}, options: {plugins: {legend: {position: "right"}}}});
}
const med = v => { v = v.slice().sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };

/* ---------------- seção por seção (urna) de uma escola */
async function secoesDaEscola(i) {
  if (!E.secoes) E.secoes = fetch("dados/secoes.json").then(r => r.json());
  const l = (await E.secoes)[i] || []; if (!l.length) return "";
  const mx = Math.max(...l.map(s => Math.max(s[1], s[2])), 1);
  return `<h4>Seção por seção <small>${int(l.length)} urnas · ${NA} · ${NB} · <span class="cc">casados</span></small></h4>
    <div class="sec-lista">${l.map(([n, a, b]) => `<div class="sec"><span class="sn">Seção ${n}</span><span class="sb"><i class="ba" style="width:${a / mx * 100}%"></i><i class="bb" style="width:${b / mx * 100}%"></i></span><b><span class="ca">${int(a)}</span> · <span class="cb">${int(b)}</span> · <span class="cc">${int(Math.min(a, b))}</span></b></div>`).join("")}</div>`;
}

/* ---------------- quadro flutuante */
function acharUnidade(tipo, chave, mun) {
  if (tipo === "escola") { const e = ESC[+chave]; return Object.assign(derivar({...e, n: 1}), {nome: e.nome, tipo, chave, escolas: [e]}); }
  if (tipo === "bairro" || tipo === "regional") { const l = ESC.filter(e => e.mun === mun && (tipo === "bairro" ? e.bairro : e.regional) === chave); return Object.assign(soma(l), {nome: chave, tipo, chave, escolas: l}); }
  return nivelMG(tipo).find(u => u.chave === chave);
}
function popover(u, ev) {
  const e0 = u.escolas[0], tipoN = {escola: "Escola", bairro: "Bairro", regional: "Regional"}[u.tipo] || NIV[u.tipo]?.[1] || "";
  const onde = u.tipo === "escola" ? `${e0.bairro} · ${MUN(e0.mun).nome}` : u.tipo === "bairro" || u.tipo === "regional" ? MUN(e0.mun).nome : "";
  const top = u.escolas.length > 1 ? u.escolas.slice().sort((a, b) => b.cas - a.cas || (b.a + b.b) - (a.a + a.b)).slice(0, 6) : [];
  const pop = $("#pop");
  const verK = `${u.tipo}|${u.chave}|${e0.mun}`;
  pop.innerHTML = `<button class="fechar" aria-label="Fechar">×</button><span class="selo-t">${tipoN}</span><h3>${esc(u.nome)}</h3><p class="nota">${esc(onde)}${onde ? " · " : ""}${int(u.el)} eleitores${u.n > 1 ? ` · ${int(u.n)} locais de votação` : ""}</p>
    <div class="pp"><div class="a"><small>${NA}</small><b class="ca">${int(u.a)}</b><small>${pct(u.ap, 2)} dos válidos · ${pct(u.sa, 2)} do total ${dele("a")}</small></div><div class="b"><small>${NB}</small><b class="cb">${int(u.b)}</b><small>${pct(u.bp, 2)} dos válidos · ${pct(u.sb, 2)} do total ${dele("b")}</small></div></div>
    <div class="casou-pop"><b class="cc">${int(u.cas)}</b><span>votos casados${u.n > 1 ? " (soma das escolas)" : ""} · sintonia de <b>${pct(u.sint, 0)}</b><i class="sint" style="--s:${Math.round((u.sint || 0) * 100)}%"></i></span></div>
    <p class="nota">${razaoTxt()}: <b style="color:${FG}">${dec(u.razao, 0)}</b>${K22 ? ` · ${nm(K22)} em 2022: <b style="color:${FG}">${int(u.x22)}</b> (${pp(u.d22, 2)})` : ""} · ${esc(PART)} estadual: ${pct(u.apt, 0)} ${do_("a")} · ${esc(PART)} federal: ${pct(u.bpt, 0)} ${do_("b")}</p>
    ${u.tipo === "escola" ? `<div class="secoes" id="secoesPop"><p class="nota">Carregando as seções…</p></div>` : ""}
    <button class="btn prim ver" data-ver="${esc(verK)}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg> Ver no mapa</button>
    ${top.length ? `<h4 style="margin-top:10px">Escolas com mais votos casados</h4><ol class="rank">${top.map(e => `<li><button data-pop="escola|${e.id}|${e.mun}"><span>${esc(e.nome)}</span><b><span class="ca">${int(e.a)}</span> · <span class="cb">${int(e.b)}</span> · <span class="cc">${int(e.cas)}</span></b></button></li>`).join("")}</ol>` : ""}`;
  pop.hidden = false;
  pop.dataset.chave = u.tipo + "|" + u.chave;
  if (u.tipo === "escola") secoesDaEscola(+u.chave).then(h => { const b = $("#secoesPop"); if (b && pop.dataset.chave === "escola|" + u.chave) { b.innerHTML = h; posicionar(); } });
  const posicionar = () => { const x = ev?.clientX ?? innerWidth / 2, y = ev?.clientY ?? innerHeight / 3, w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = Math.max(8, Math.min(innerWidth - w - 8, x + 14)) + "px"; pop.style.top = Math.max(8, Math.min(innerHeight - h - 8, y - 20)) + "px"; };
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
  const cid = nivelMG("mun").filter(c => semAc(c.nome).includes(q)).slice(0, 5).map(u => ({u, t: "Cidade"}));
  const bai = []; const vistos = new Set();
  for (const e of ESC) { const k = e.mun + "|" + e.bairro; if (!vistos.has(k) && semAc(e.bairro).includes(q)) { vistos.add(k); bai.push(e); } if (bai.length >= 6) break; }
  const bs = bai.map(e => ({u: acharUnidade("bairro", e.bairro, e.mun), t: "Bairro · " + MUN(e.mun).nome}));
  const es = ESC.filter(e => semAc(e.nome).includes(q)).sort((a, b) => (b.a + b.b) - (a.a + a.b)).slice(0, 10).map(e => ({u: acharUnidade("escola", e.id, e.mun), t: "Escola · " + e.bairro + " · " + MUN(e.mun).nome}));
  acL = [...cid, ...bs, ...es]; acI = 0;
  box.innerHTML = acL.map((x, i) => `<button data-ac="${i}" class="${i === 0 ? "ativo" : ""}"><span>${esc(x.u.nome)}<br><small>${esc(x.t)}</small></span><small><span class="ca">${int(x.u.a)}</span> · <span class="cb">${int(x.u.b)}</span><br><span class="vermapa">Ver no mapa</span></small></button>`).join("") || `<p class="nota" style="padding:8px">Nada encontrado.</p>`;
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
  configurar(B.cfg);
  const ix = Object.fromEntries(B.campos.map((c, i) => [c, i]));
  ESC = B.escolas.map(r => ({id: r[ix.id], nome: r[ix.nome], mun: r[ix.mun], zona: r[ix.zona], bairro: r[ix.bairro] || "(sem bairro)", regional: r[ix.regional], lat: r[ix.lat], lng: r[ix.lng], el: r[ix.eleitores], comp: r[ix.comp],
    a: r[ix.a], b: r[ix.b], va: r[ix.va], vb: r[ix.vb], pa: r[ix.pa], pb: r[ix.pb], x22: r[ix.x22] || 0, vx22: r[ix.vx22] || 0}));
  B.escolas.forEach((r, i) => { ESC[i].cas = ix.cs != null ? r[ix.cs] : Math.min(ESC[i].a, ESC[i].b); });   // casados contados urna por urna
  TA = ESC.reduce((s, e) => s + e.a, 0); TB = ESC.reduce((s, e) => s + e.b, 0);
  const cidades = nivelMG("mun"); E.maxAp = Math.max(...cidades.filter(c => c.va > 5000).map(c => c.ap)); E.maxBp = Math.max(...cidades.filter(c => c.vb > 5000).map(c => c.bp));
  // título e textos da abertura vindos da configuração
  $("#kicker").textContent = CF.kicker;
  $("#titulo").innerHTML = `<span class="na">${esc(CA.nome)}</span> <span class="x">×</span> <span class="nb">${esc(CB.nome)}</span>`;
  $("#lead").textContent = `A comparação completa entre o voto ${do_("a").replace(NA, CA.nome)} (${CA.cargoNome}) e ${do_("b").replace(NB, CB.nome)} (${CB.cargoNome}) em 2026: Belo Horizonte regional por regional, bairro por bairro e escola por escola, as cidades com regionais e todo o estado.`;
  duelo(); destaques();
  const ok = CA.conferido && CB.conferido;
  $("#fontesTexto").innerHTML = `<p><b>2026:</b> arquivos oficiais do TSE de votação e de detalhe por seção (dados abertos), somados por local de votação (escola). ${ok ? `Os totais batem com o resultado oficial: ${NA} ${int(TA)} e ${NB} ${int(TB)} votos.` : `Totais somados: ${NA} ${int(TA)} e ${NB} ${int(TB)} votos.`}</p>
    <p><b>% dos válidos:</b> ${NA} sobre os votos válidos para ${CA.cargoNome.toLowerCase()}; ${NB} sobre os válidos para ${CB.cargoNome.toLowerCase()}. <b>${razaoTxt()}</b> compara os votos dos dois no mesmo lugar (cada eleitor vota nos dois cargos).</p>
    <p><b>Votos casados e sintonia:</b> contados em cada seção eleitoral (urna), o menor nível que o TSE publica: se numa seção ${NA} teve 40 votos e ${NB} 25, casaram 25. Como o voto é secreto, é o máximo de eleitores daquela urna que podem ter votado nos dois; na escola, no bairro, na cidade e na região, é a soma das seções. A sintonia é casados ÷ o maior dos dois: 100% quando os dois têm a mesma votação em cada escola.</p>
    <p><b>Peso no total de cada um:</b> compara o peso do lugar no total de cada um (a parte dos votos ${do_("a")} que veio dali contra a parte dos votos ${do_("b")}). Não depende do tamanho de cada votação.</p>
    <p><b>Peso no partido:</b> votos de cada um sobre todos os votos do ${esc(PART)} no mesmo cargo (nominais e de legenda).</p>
    ${K22 ? `<p><b>${nm(K22)} em 2022:</b> dados abertos do TSE por seção, ligados às escolas de 2026 pela zona e seção; em 2022 ${ele(K22)} concorreu pelo ${esc(C(K22).partido22)} e teve ${int(C(K22).votos22)} votos. ${nm(K22 === "a" ? "b" : "a")} não concorreu em 2022.</p>` : ""}
    <p><b>Bairros e regionais:</b> contornos oficiais do OpenStreetMap nas cidades onde estão mapeados (${B.cidadesOSM.map(m => MUN(m).nome).join(", ")}). Nas outras cidades, o bairro é o do cadastro do TSE.</p>`;
  const h = location.hash.slice(1); irAba(["bh", "cidades", "minas", "escolas", "secoes", "analises"].includes(h) ? h : "bh", false);
})();
