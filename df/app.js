/* Painel de apuração — MOBI. Dados: API local (src/server.js), que lê o TSE ao vivo. */
"use strict";

/* ------------------------------------------------------------------ utilidades */
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const nf0 = new Intl.NumberFormat("pt-BR", {maximumFractionDigits: 0});
const int = v => v == null ? "–" : nf0.format(v);
const pct = (v, d = 1) => v == null || !isFinite(v) ? "–" : (v * 100).toLocaleString("pt-BR", {minimumFractionDigits: d, maximumFractionDigits: d}) + "%";
const titulo = s => String(s ?? "").toLowerCase().replace(/(^|[\s(/-])\S/g, c => c.toUpperCase())
  .replace(/\b(De|Da|Do|Das|Dos|E)\b/g, m => m.toLowerCase())
  .replace(/\b(Ii|Iii|Iv|Vi|Vii|Viii|Ix|Xi|Xii|Xiii|Xx|Xxi|Xxii|Xxiii)\b/g, m => m.toUpperCase());
const norm = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// Preferências salvas por cliente (vários painéis podem dividir o mesmo endereço em testes)
const lsGet = k => { try { return localStorage.getItem(`${window.CLIENTE?.slug || "padrao"}:${k}`); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(`${window.CLIENTE?.slug || "padrao"}:${k}`, v); } catch {} };
const ICONE_BUSCA = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`;
const div = (a, b) => b > 0 ? a / b : null;
// % apurada pelo eleitorado (seções com boletim publicado ÷ eleitorado total do cadastro do TSE)
const apurado = (aptos, eleitores) => eleitores > 0 ? Math.min(1, (aptos || 0) / eleitores) : null;
const progHTML = f => f == null ? "–" : `<span class="prog" title="${pct(f, 0)} apurado · falta ${pct(1 - f, 0)}"><i style="width:${(f * 100).toFixed(1)}%"></i></span> <b>${pct(f, 0)}</b> <span class="nota">falta ${pct(1 - f, 0)}</span>`;
const hora = iso => iso ? new Date(iso).toLocaleTimeString("pt-BR", {hour: "2-digit", minute: "2-digit"}) : "–";
async function api(path) {
  if (window.apiEstatica) return window.apiEstatica(path); // versão final estática (sem servidor)
  const r = await fetch(path, {cache: "no-store"});
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json();
}

// Cores das séries (validadas para o fundo escuro): cada candidato guarda o seu slot
const CLIENTE = window.CLIENTE || {slug: "padrao", candidatos: []};
const CORES = CLIENTE.tema?.cores?.length ? CLIENTE.tema.cores : ["#3d9fd6", "#c9782a", "#a467e0", "#2f9e6a"];
const BRAND_RGB = CLIENTE.tema?.brandRgb || "85,184,230";
const COR_OUTRO = "#7a7f86";
// Rampa sequencial (um tom, escuro -> claro) para magnitude no mapa
const RAMPA = CLIENTE.tema?.rampa?.length === 5 ? CLIENTE.tema.rampa : ["#16324a", "#1d5578", "#2b7fb0", "#55b8e6", "#a9e0fa"];
const CARGOS_ORDEM = [6, 7, 8, 5, 3, 1];
const NOME_CARGO = {1: "Presidente", 3: "Governador", 5: "Senador", 6: "Dep. Federal", 7: "Dep. Estadual", 8: "Dep. Distrital", 11: "Prefeito", 13: "Vereador"};

/* ------------------------------------------------------------------ estado */
const S = {
  status: null, cands: [], idx: new Map(),
  sel: [], ativo: null, dados: new Map(),
  aba: lsGet("apu.aba") || "geral",
  mapaModo: lsGet("apu.mapa") || "mun",
  tab: {mun: {ord: "votos", dir: -1, q: "", pag: 0}, esc: {ord: "votos", dir: -1, q: "", mun: "", pag: 0}},
  addCargo: 0,
  cmp: [], // candidatos escolhidos na aba Comparar (vazio até o usuário escolher)
  cidade: Number(lsGet("apu.cidade")) || null,
  muns: [], views: {},
};
const chave = c => `${c.cargo}-${c.numero}`;
const corDe = s => s.cor < CORES.length ? CORES[s.cor] : COR_OUTRO;

function salvarSel() { lsSet("apu.sel.v2", JSON.stringify({sel: S.sel, ativo: S.ativo})); lsSet("apu.cmp", JSON.stringify(S.cmp)); }
function carregarSel(padrao) {
  try { S.cmp = JSON.parse(lsGet("apu.cmp")) || []; } catch { S.cmp = []; }
  try {
    const o = JSON.parse(lsGet("apu.sel.v2"));
    if (o?.sel?.length) { S.sel = o.sel; S.ativo = o.ativo; return; }
  } catch {}
  // Painel geral do estado (sem candidatos fixos): começa com o mais votado de cada cargo
  if (!padrao.length) padrao = [3, 5, 1, 6, 7, 8].map(cg => S.cands.filter(c => c.cargo === cg).sort((a, b) => b.votos - a.votos)[0]).filter(Boolean).slice(0, 4);
  S.sel = padrao.map((c, i) => ({cargo: c.cargo, numero: c.numero, cor: i}));
  S.ativo = S.sel[0] ? chave(S.sel[0]) : null;
}
function adicionar(c) {
  const k = chave(c);
  if (!S.sel.some(s => chave(s) === k)) {
    const usadas = new Set(S.sel.map(s => s.cor));
    let cor = 0; while (usadas.has(cor)) cor++;
    S.sel.push({cargo: c.cargo, numero: c.numero, cor});
  }
  S.ativo = k; salvarSel(); atualizarCandidatos().then(render);
}
function remover(k) {
  S.sel = S.sel.filter(s => chave(s) !== k);
  if (!S.cmp.some(s => chave(s) === k)) S.dados.delete(k);
  if (S.ativo === k) S.ativo = S.sel[0] ? chave(S.sel[0]) : null;
  salvarSel(); render();
}

/* ------------------------------------------------------------------ carga de dados */
async function atualizarStatus() {
  S.status = await api("api/status");
  S.cands = await api("api/candidatos");
  S.idx = new Map(S.cands.map(c => [chave(c), c]));
}
async function atualizarCandidatos() {
  const todos = [...new Map([...S.sel, ...S.cmp].map(s => [chave(s), s])).values()];
  await Promise.all(todos.map(async s => {
    try { S.dados.set(chave(s), await api(`api/candidato?cargo=${s.cargo}&numero=${s.numero}`)); } catch (e) { console.warn(e); }
  }));
}
async function ciclo() {
  try {
    await atualizarStatus();
    await atualizarCandidatos();
    render(true);
  } catch (e) {
    console.warn(e);
  }
}

/* ------------------------------------------------------------------ tooltip */
const tip = $("#tip");
document.addEventListener("mousemove", e => {
  const t = e.target.closest?.("[data-tip]");
  if (!t) { tip.style.display = "none"; return; }
  tip.innerHTML = t.dataset.tip;
  tip.style.display = "block";
  const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = Math.min(e.clientX + 14, innerWidth - w - 8) + "px";
  tip.style.top = (e.clientY + 16 + h > innerHeight ? e.clientY - h - 12 : e.clientY + 16) + "px";
});
const tipHTML = (t, linhas) => esc(`<b>${esc(t)}</b>` + linhas.map(([k, v]) => `<div class="row">${esc(k)}<em>${esc(v)}</em></div>`).join(""));

/* ------------------------------------------------------------------ topo: chips e adicionar */
function renderChips() {
  $("#chips").innerHTML = S.sel.map(s => {
    const c = S.idx.get(chave(s));
    const nome = c ? titulo(c.nomeUrna) : "Candidato";
    const sub = `${NOME_CARGO[s.cargo] || ""}${c?.partido ? " · " + c.partido : ""}`;
    return `<div class="chip" role="button" tabindex="0" aria-pressed="${chave(s) === S.ativo}" data-k="${chave(s)}">
      <span class="bola" style="background:${corDe(s)}"></span>
      <span class="txt"><b>${esc(nome)}</b><small>${esc(sub)}</small></span>
      <button class="x" data-rm="${chave(s)}" aria-label="Remover ${esc(nome)}" title="Remover"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    </div>`;
  }).join("") || `<span class="nota">Adicione um candidato para começar →</span>`;
}
$("#chips").addEventListener("click", e => {
  const rm = e.target.closest("[data-rm]");
  if (rm) { e.stopPropagation(); return remover(rm.dataset.rm); }
  const ch = e.target.closest(".chip");
  if (ch) { S.ativo = ch.dataset.k; salvarSel(); render(); }
});
$("#chips").addEventListener("keydown", e => { if (e.key === "Enter" && e.target.classList.contains("chip")) e.target.click(); });

const addPop = $("#addPop"), addInput = $("#addInput");
$("#addBtn").addEventListener("click", e => {
  e.stopPropagation();
  const abrir = !addPop.classList.contains("aberto");
  addPop.classList.toggle("aberto", abrir);
  $("#addBtn").setAttribute("aria-expanded", abrir);
  if (abrir) { renderAdd(); addInput.focus(); }
});
document.addEventListener("click", e => { if (!e.target.closest(".add-wrap")) addPop.classList.remove("aberto"); });
addInput.addEventListener("input", renderAdd);
addInput.addEventListener("keydown", e => {
  if (e.key === "Enter") { const b = $("#addRes button"); if (b) b.click(); }
  if (e.key === "Escape") addPop.classList.remove("aberto");
});
$("#addCargos").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  S.addCargo = Number(b.dataset.c); renderAdd(); addInput.focus();
});
function renderAdd() {
  const cargos = [...new Set(S.cands.map(c => c.cargo))].sort((a, b) => CARGOS_ORDEM.indexOf(a) - CARGOS_ORDEM.indexOf(b));
  $("#addCargos").innerHTML = [`<button data-c="0" aria-pressed="${!S.addCargo}">Todos</button>`]
    .concat(cargos.map(c => `<button data-c="${c}" aria-pressed="${S.addCargo === c}">${esc(NOME_CARGO[c] || c)}</button>`)).join("");
  const q = norm(addInput.value.trim());
  let lista = S.cands.filter(c => !S.addCargo || c.cargo === S.addCargo);
  if (q) lista = lista.filter(c => String(c.numero).startsWith(q) || norm(c.nomeUrna).includes(q) || norm(c.nome).includes(q) || norm(c.partido) === q);
  lista = lista.slice().sort((a, b) => (String(a.numero) === q ? -1 : 0) - (String(b.numero) === q ? -1 : 0) || b.votos - a.votos || a.nomeUrna.localeCompare(b.nomeUrna));
  const sel = new Set(S.sel.map(chave));
  $("#addRes").innerHTML = lista.slice(0, 40).map(c => `<button data-k="${chave(c)}" ${sel.has(chave(c)) ? 'class="ativo"' : ""}>
      <span><b>${esc(titulo(c.nomeUrna))}</b> <span class="nota">${esc(c.partido)}</span></span>
      <small>${esc(NOME_CARGO[c.cargo] || "")}${c.votos ? " · " + int(c.votos) : ""}</small></button>`).join("")
    || `<div class="vazio">${S.cands.length ? "Nenhum candidato encontrado" : "Carregando lista de candidatos do TSE…"}</div>`;
}
$("#addRes").addEventListener("click", e => {
  const b = e.target.closest("button[data-k]"); if (!b) return;
  const [cargo, numero] = b.dataset.k.split("-").map(Number);
  addPop.classList.remove("aberto"); addInput.value = "";
  adicionar({cargo, numero});
});

/* ------------------------------------------------------------------ abas */
const ABAS = [
  ["geral", "Visão geral"], ["cadeiras", "Partidos e cadeiras"], ["cidades", "Mapas das cidades"], ["regioes", "Regiões"], ["mapa", "Mapa do estado"], ["municipios", "Municípios"],
  ["escolas", "Escolas"], ["comparar", "Comparar"], ["relatorio", "Relatório"],
];
// Comparação com eleição anterior (só para clientes que têm, ex.: Felipe × Dalmo 2022)
if (window.CLIENTE?.historico?.length) ABAS.splice(1, 0, ["historico", window.CLIENTE.historico[0].aba || "Comparação histórica"]);
function renderAbas() {
  $("#abas").innerHTML = ABAS.map(([k, n]) => `<button class="aba" role="tab" data-aba="${k}" aria-selected="${S.aba === k}">${n}${k === "comparar" && S.cmp.length ? `<span class="cont">${S.cmp.length}</span>` : ""}</button>`).join("");
}
$("#abas").addEventListener("click", e => {
  const b = e.target.closest("[data-aba]"); if (!b) return;
  S.aba = b.dataset.aba; lsSet("apu.aba", S.aba); render();
});

/* ------------------------------------------------------------------ blocos comuns */
function faixaAoVivo() {
  const st = S.status;
  if (!st) return "";
  const c = st.cargos[S.ativoSel()?.cargo] || Object.values(st.cargos)[0];
  const tot = c?.secoes?.total || 0, ok = c?.secoes?.totalizadas || 0;
  const col = st.coleta;
  const comecou = ok > 0;
  return `<div class="ao-vivo">
    <span class="pulso ${comecou && !c.totalizacaoFinal ? "" : "parado"}"></span>
    <span>${c?.totalizacaoFinal ? "<b>Totalização encerrada</b>" : comecou ? "<b>Apuração em andamento</b>" : "<b>Aguardando o início da apuração</b> (após o fechamento das urnas, 17h)"}</span>
    <span>Seções totalizadas pelo TSE: <b>${pct(div(ok, tot), 2)}</b> <span class="nota">(${int(ok)} de ${int(tot)})</span></span>
    <span class="barra" aria-hidden="true"><i style="width:${(div(ok, tot) || 0) * 100}%"></i></span>
    <span>Boletins mapeados por escola: <b>${int(col.recebidas)}</b> <span class="nota">de ${int(col.total)}</span></span>
    <span class="dir">TSE ${esc(c?.dataHora || "–")} · painel ${hora(st.oficialEm)}</span>
  </div>`;
}
S.ativoSel = () => S.sel.find(s => chave(s) === S.ativo);

function barras(itens, {max, onclick} = {}) {
  const m = max ?? Math.max(1, ...itens.flatMap(i => i.valores.map(v => v.v)));
  return `<div class="barras">${itens.map((it, i) => `<div class="barra-l ${onclick ? "clicavel" : ""} ${it.eu ? "eu" : ""}" ${onclick ? `data-i="${i}"` : ""} ${it.tip ? `data-tip="${it.tip}"` : ""}>
    <span class="rot" title="${esc(it.rot)}">${esc(it.rot)}${it.sub ? `<small>${esc(it.sub)}</small>` : ""}</span>
    <span class="trilhos">${it.valores.map(v => `<span class="trilho"><i style="width:${Math.max(0.3, v.v / m * 100)}%;background:${v.cor}"></i></span>`).join("")}</span>
    <span class="v">${it.valores.map(v => v.txt ?? int(v.v)).join(" · ")}${it.extra ? `<small>${esc(it.extra)}</small>` : ""}</span>
  </div>`).join("")}</div>`;
}

function cabecalho(c, s) {
  if (!c) return `<div class="cabeca"><div><span class="kicker">Candidato</span><h1>Candidato</h1><p>Não encontrado na lista oficial do TSE para este cargo.</p></div></div>`;
  const sit = c.situacao ? `<span class="tag ${c.eleito ? "" : "cinza"}">${esc(c.situacao)}</span>` : "";
  return `<div class="cabeca"><div>
      <span class="kicker">${esc(c.cargoNome)} · ${esc(c.partido)}</span>
      <h1><span class="texto-marca">${esc(titulo(c.nomeUrna))}</span></h1>
      <p>${esc(titulo(c.nome))}${c.agremiacao ? ` · ${esc(titulo(c.agremiacao))}` : ""} ${sit}</p>
    </div></div>`;
}

const vazio = (t, d) => `<section class="card vidro"><div class="vazio-estado"><b>${esc(t)}</b>${esc(d)}</div></section>`;

function rankingCargo(c) {
  const lista = S.cands.filter(x => x.cargo === c.cargo && x.votos > 0);
  return {lista, pos: c.posicao, total: lista.length, vagas: S.status?.cargos?.[c.cargo]?.vagas};
}

/* ------------------------------------------------------------------ Visão geral */
function viewGeral(s, c, d) {
  const of = d.oficial || {};
  const ap = d.apurado;
  const rk = rankingCargo(c || {cargo: s.cargo});
  const pctOf = c?.pct != null ? c.pct / 100 : null;
  const muns = d.municipios.filter(m => m.votos > 0).sort((a, b) => b.votos - a.votos);
  const locais = d.locais.filter(l => l.votos > 0);
  const totMun = muns.reduce((a, m) => a + m.votos, 0);
  const share = n => div(muns.slice(0, n).reduce((a, m) => a + m.votos, 0), totMun);
  const media = div(ap.votos, ap.validos);

  let h = `<div class="kpis">
    <div class="kpi vidro destaque"><div class="lbl">Votos (oficial TSE)</div><div class="val">${int(c?.votos)}</div><div class="sub">${pct(pctOf, 2)} dos válidos</div></div>
    <div class="kpi vidro"><div class="lbl">Posição no cargo</div><div class="val">${rk.pos ? rk.pos + "º" : "–"}</div><div class="sub">${rk.vagas ? rk.vagas + (rk.vagas > 1 ? " vagas · " : " vaga · ") : ""}${int(rk.total)} com voto</div></div>
    <div class="kpi vidro"><div class="lbl">Seções totalizadas</div><div class="val">${pct(div(of.secoes?.totalizadas, of.secoes?.total), 1)}</div><div class="sub">${int(of.secoes?.totalizadas)} de ${int(of.secoes?.total)}</div></div>
    <div class="kpi vidro"><div class="lbl">Mapeado por boletim</div><div class="val">${int(ap.votos)}</div><div class="sub">${int(ap.secoes)} seções · ${int(locais.length)} escolas com voto</div></div>
    <div class="kpi vidro"><div class="lbl">Municípios com voto</div><div class="val">${int(muns.length)}</div><div class="sub">top 10 = ${pct(share(10), 0)} dos votos</div></div>
  </div>`;

  if (!ap.secoes) h += `<div class="aviso"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg><span>Os mapas e gráficos por município, zona e escola são montados a partir dos <b>boletins de urna</b> de cada seção, que o TSE publica conforme as urnas são transmitidas. Assim que a apuração começar, eles aparecem aqui sozinhos.</span></div>`;

  const top = muns.slice(0, 15).map(m => ({rot: titulo(m.nome), valores: [{v: m.votos, cor: corDe(s)}], extra: pct(div(m.votos, m.validos)),
    tip: tipHTML(titulo(m.nome), [["Votos", int(m.votos)], ["% dos válidos", pct(div(m.votos, m.validos), 2)], ["Seções apuradas", int(m.secoes)]]), mun: m.mun}));
  const redutos = d.municipios.filter(m => m.validos >= 300 && m.votos > 0).map(m => ({...m, p: m.votos / m.validos})).sort((a, b) => b.p - a.p).slice(0, 10);

  // Ranking: vizinhos de posição
  let rkHtml = "";
  if (rk.pos) {
    const i = rk.pos - 1, ini = Math.max(0, i - 4), fim = Math.min(rk.lista.length, i + 5);
    const linhas = rk.lista.slice(ini, fim).map(x => ({rot: `${x.posicao}º ${titulo(x.nomeUrna)}`, sub: x.partido, eu: x.numero === c.numero,
      valores: [{v: x.votos, cor: x.numero === c.numero ? corDe(s) : COR_OUTRO}], extra: pct(x.pct / 100, 2)}));
    rkHtml = barras(linhas, {max: rk.lista[ini].votos});
    if (rk.vagas && [6, 7, 8, 13].includes(c.cargo)) rkHtml += `<p class="nota" style="margin-top:12px">${rk.vagas} vagas em disputa. A eleição de deputado é proporcional: quem entra depende também do quociente partidário da federação/partido, não só da posição.</p>`;
  } else rkHtml = `<div class="vazio-estado"><b>Sem votos totalizados ainda</b>O ranking aparece com as primeiras seções totalizadas.</div>`;

  h += `<div class="grid-2">
    <section class="card vidro"><h2>Municípios com mais votos</h2><p class="desc">Soma dos boletins de urna já publicados. Clique para ver escolas e quem lidera no município.</p>
      <div id="gTopMun">${top.length ? barras(top, {onclick: true}) : `<div class="vazio-estado"><b>Ainda sem boletins</b>Aguardando a publicação das primeiras seções.</div>`}</div></section>
    <section class="card vidro"><h2>Posição no ranking</h2><p class="desc">Candidatos vizinhos de ${esc(titulo(c?.nomeUrna || ""))} no total oficial do estado.</p>${rkHtml}</section>
  </div>`;

  if (redutos.length) {
    h += `<div class="grid-2">
      <section class="card vidro"><h2>Redutos: maior % dos válidos</h2><p class="desc">Municípios com ao menos 300 votos válidos apurados, ordenados pela fatia do candidato. Média no estado (apurado): ${pct(media, 2)}.</p>
        <div id="gRedutos">${barras(redutos.map(m => ({rot: titulo(m.nome), valores: [{v: m.p, cor: corDe(s), txt: pct(m.p, 1)}], extra: `${int(m.votos)} votos · ${(m.p / media).toLocaleString("pt-BR", {maximumFractionDigits: 1})}× a média`, mun: m.mun})), {onclick: true})}</div></section>
      <section class="card vidro"><h2>Concentração do voto</h2><p class="desc">Quanto do total vem dos maiores municípios.</p>
        ${barras([1, 5, 10, 20, 50].map(n => ({rot: `Top ${n} município${n > 1 ? "s" : ""}`, valores: [{v: share(n) || 0, cor: corDe(s), txt: pct(share(n), 0)}]})), {max: 1})}
        <p class="nota" style="margin-top:12px">${int(locais.length)} escolas e ${int(muns.length)} municípios com pelo menos um voto.</p></section>
    </div>`;
  }
  $("#conteudo").insertAdjacentHTML("beforeend", h);
  const liga = (id, lista) => $(id)?.addEventListener("click", e => { const r = e.target.closest("[data-i]"); if (r) abrirMunicipio(lista[r.dataset.i].mun); });
  liga("#gTopMun", top); liga("#gRedutos", redutos);
}

/* ------------------------------------------------------------------ Mapa */
let MAPA = null, CAMADA = null, GEO = null;
function quebras(vals) {
  const v = vals.filter(x => x > 0).sort((a, b) => a - b);
  if (!v.length) return [];
  return [0.2, 0.4, 0.6, 0.8].map(q => v[Math.min(v.length - 1, Math.floor(q * v.length))]);
}
const classe = (x, q) => { let i = 0; while (i < q.length && x > q[i]) i++; return i; };

async function viewMapa(s, c, d) {
  $("#conteudo").insertAdjacentHTML("beforeend", `<section class="card vidro">
    <div class="filtros">
      <div class="grupo-seg" id="mapaModo">
        <button data-m="mun" aria-pressed="${S.mapaModo === "mun"}">Municípios · % dos válidos</button>
        <button data-m="esc" aria-pressed="${S.mapaModo === "esc"}">Escolas · votos</button>
      </div>
      <div class="escala" id="mapaEscala"></div>
    </div>
    <div class="mapa-l" id="mapaL"></div>
    <p class="nota" style="margin-top:10px">Clique num município ou escola para ver o detalhe. Fonte: boletins de urna publicados pelo TSE; localização das escolas: cadastro de locais de votação do TSE.</p>
  </section>`);
  $("#mapaModo").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    S.mapaModo = b.dataset.m; lsSet("apu.mapa", S.mapaModo); render();
  });
  if (typeof L === "undefined") { $("#mapaL").innerHTML = `<div class="vazio-estado"><b>Mapa indisponível</b>Não foi possível carregar a biblioteca de mapas.</div>`; return; }
  const el = $("#mapaL");
  const token = (viewMapa.token = (viewMapa.token || 0) + 1);
  if (!GEO) GEO = await fetch(`geo/${S.status?.uf || "mg"}.geojson`).then(r => r.json());
  if (token !== viewMapa.token || !el.isConnected) return; // outra renderização começou nesse meio-tempo
  const visao = S.mapaVisao; // só existe depois que o usuário mexeu no mapa
  if (MAPA) MAPA.remove();
  // Roda do mouse só dá zoom depois de clicar no mapa (não sequestra a rolagem da página)
  MAPA = L.map(el, {preferCanvas: true, zoomSnap: 0.25, scrollWheelZoom: false});
  MAPA.on("click focus", () => MAPA.scrollWheelZoom.enable());
  MAPA.on("mouseout", () => MAPA.scrollWheelZoom.disable());
  // Primeira abertura: enquadra os pontos com voto (ou o estado); depois preserva a visão do usuário
  const pontos = d.locais.filter(l => l.lat != null && l.votos > 0).map(l => [l.lat, l.lng]);
  if (visao) MAPA.setView(visao.c, visao.z);
  else MAPA.fitBounds(pontos.length ? pontos : caixaEstado(), {padding: [20, 20]});
  MAPA.on("dragend zoomend", e => { if (e.hard !== true && MAPA._loaded) S.mapaVisao = {c: MAPA.getCenter(), z: MAPA.getZoom()}; });
  setTimeout(() => MAPA?.invalidateSize(), 50);
  const ESRI = "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/";
  L.tileLayer(ESRI + "World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {maxZoom: 16, attribution: "Esri · IBGE · TSE"}).addTo(MAPA);
  const rotulos = L.tileLayer(ESRI + "World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}", {maxZoom: 16, pane: "shadowPane", opacity: 0.8});

  const cor = corDe(s);
  if (S.mapaModo === "mun") {
    const porIbge = new Map(d.municipios.map(m => [String(m.ibge), m]));
    const q = quebras(d.municipios.map(m => div(m.votos, m.validos) || 0));
    CAMADA = L.geoJSON(GEO, {
      style: f => {
        const m = porIbge.get(String(f.properties.codarea));
        const p = m ? div(m.votos, m.validos) : null;
        return {weight: 0.6, color: `rgba(${BRAND_RGB},0.35)`, fillOpacity: p ? 0.85 : 0.15,
          fillColor: p ? RAMPA[classe(p, q)] : "#1d252e"};
      },
      onEachFeature: (f, lyr) => {
        const m = porIbge.get(String(f.properties.codarea));
        lyr.bindTooltip(m ? `<b>${esc(titulo(m.nome))}</b><br>${int(m.votos)} votos · ${pct(div(m.votos, m.validos), 2)}<br><span style="opacity:.7">${int(m.secoes)} seções · ${pct(apurado(m.aptos, m.eleitores), 0)} apurado</span>` : "Sem seções apuradas", {sticky: true, className: "tip-l"});
        if (m) lyr.on("click", () => abrirMunicipio(m.mun));
        lyr.on("mouseover", () => lyr.setStyle({weight: 2, color: "#fff"}));
        lyr.on("mouseout", () => CAMADA.resetStyle(lyr));
      },
    }).addTo(MAPA);
    rotulos.addTo(MAPA);
    $("#mapaEscala").innerHTML = escalaHTML(q, "% dos válidos");
  } else {
    rotulos.addTo(MAPA);
    const pts = d.locais.filter(l => l.lat != null && l.votos > 0);
    const max = Math.max(1, ...pts.map(l => l.votos));
    const q = quebras(pts.map(l => div(l.votos, l.validos) || 0));
    CAMADA = L.layerGroup(pts.sort((a, b) => b.votos - a.votos).reverse().map(l => {
      const p = div(l.votos, l.validos);
      const mk = L.circleMarker([l.lat, l.lng], {radius: 3 + 15 * Math.sqrt(l.votos / max), weight: 1, color: "#090d11",
        fillColor: RAMPA[classe(p, q)], fillOpacity: 0.9});
      mk.bindTooltip(`<b>${esc(titulo(l.nome))}</b><br>${esc(titulo(l.munNome))}${l.bairro ? " · " + esc(titulo(l.bairro)) : ""}<br>${int(l.votos)} votos · ${pct(p, 2)} dos válidos${l.aproximado ? `<br><span style="opacity:.7">posição aproximada (centro do município)</span>` : ""}`, {className: "tip-l"});
      mk.on("click", () => abrirLocal(l.id));
      return mk;
    })).addTo(MAPA);
    $("#mapaEscala").innerHTML = escalaHTML(q, "% dos válidos (cor) · tamanho = votos") +
      (pts.length ? "" : `<span class="nota">Nenhuma escola com voto apurado ainda.</span>`);
  }
}
function escalaHTML(q, rot) {
  if (!q.length) return `<span class="nota">${esc(rot)}: sem dados ainda</span>`;
  const lim = [0, ...q];
  return `<span>${esc(rot)}</span><span class="rampa">${RAMPA.map((c, i) => `<i style="background:${c}" data-tip="${esc(`${i === 0 ? "até" : "acima de"} ${pct(i === 0 ? q[0] : lim[i], 2)}`)}"></i>`).join("")}</span><span class="nota">${pct(q[0], 1)} → ${pct(q[q.length - 1], 1)}+</span>`;
}

/* ------------------------------------------------------------------ tabelas */
function tabela({cols, linhas, est, porPag = 50, onRow}) {
  const ord = cols.find(c => c.k === est.ord) || cols[0];
  const ordenadas = linhas.slice().sort((a, b) => {
    const va = ord.val ? ord.val(a) : a[ord.k], vb = ord.val ? ord.val(b) : b[ord.k];
    return (typeof va === "string" ? va.localeCompare(vb) : (va ?? -1) - (vb ?? -1)) * est.dir;
  });
  const pags = Math.max(1, Math.ceil(ordenadas.length / porPag));
  est.pag = Math.min(est.pag, pags - 1);
  const vis = ordenadas.slice(est.pag * porPag, (est.pag + 1) * porPag);
  const html = `<div class="tbl-wrap"><table><thead><tr>${cols.map(c => `<th class="ord ${c.n ? "n" : ""}" data-k="${c.k}">${esc(c.t)}<span class="seta">${est.ord === c.k ? (est.dir < 0 ? "↓" : "↑") : ""}</span></th>`).join("")}</tr></thead>
    <tbody>${vis.map((l, i) => `<tr class="${onRow ? "clicavel" : ""}" data-i="${est.pag * porPag + i}">${cols.map(c => `<td class="${c.n ? "n" : ""} ${c.cls || ""}">${c.f ? c.f(l) : esc(l[c.k])}</td>`).join("")}</tr>`).join("")
      || `<tr><td colspan="${cols.length}"><div class="vazio-estado"><b>Nada por aqui ainda</b>Os dados aparecem conforme os boletins de urna são publicados.</div></td></tr>`}</tbody></table></div>
    <div class="paginacao"><span>${int(ordenadas.length)} linhas · página ${est.pag + 1} de ${pags}</span>
      <button data-p="-1" ${est.pag === 0 ? "disabled" : ""} aria-label="Anterior">‹</button><button data-p="1" ${est.pag >= pags - 1 ? "disabled" : ""} aria-label="Próxima">›</button></div>`;
  return {html, ligar(el, rerender) {
    el.querySelectorAll("th[data-k]").forEach(th => th.addEventListener("click", () => {
      if (est.ord === th.dataset.k) est.dir *= -1; else { est.ord = th.dataset.k; est.dir = -1; }
      rerender();
    }));
    el.querySelectorAll("[data-p]").forEach(b => b.addEventListener("click", () => { est.pag += Number(b.dataset.p); rerender(); }));
    if (onRow) el.querySelectorAll("tbody tr[data-i]").forEach(tr => tr.addEventListener("click", () => onRow(ordenadas[tr.dataset.i])));
  }};
}

function viewMunicipios(s, c, d) {
  const est = S.tab.mun;
  const total = d.apurado.votos;
  $("#conteudo").insertAdjacentHTML("beforeend", `<section class="card vidro"><h2>Votação por município</h2>
    <p class="desc">Somatório dos boletins de urna publicados. "% do total" é quanto daquele município representa no total do candidato.</p>
    <div class="filtros"><div class="campo"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input id="qMun" type="search" placeholder="Filtrar município" value="${esc(est.q)}"></div>
      <button class="btn" id="csvMun">Baixar CSV</button></div>
    <div id="tMun"></div></section>`);
  const desenhar = () => {
    const q = norm(est.q);
    const linhas = d.municipios.filter(m => !q || norm(m.nome).includes(q)).map(m => ({...m, p: div(m.votos, m.validos), share: div(m.votos, total), ap: apurado(m.aptos, m.eleitores)}));
    const t = tabela({est, linhas, onRow: m => abrirMunicipio(m.mun), cols: [
      {k: "nome", t: "Município", f: m => `<span class="forte">${esc(titulo(m.nome))}</span>`},
      {k: "votos", t: "Votos", n: 1, f: m => int(m.votos)},
      {k: "p", t: "% válidos", n: 1, f: m => pct(m.p, 2)},
      {k: "share", t: "% do total", n: 1, f: m => pct(m.share, 1)},
      {k: "partido", t: "Votos do partido", n: 1, f: m => int(m.partido)},
      {k: "secoes", t: "Seções", n: 1, f: m => int(m.secoes)},
      {k: "ap", t: "Apurado", f: m => progHTML(m.ap)},
    ]});
    $("#tMun").innerHTML = t.html; t.ligar($("#tMun"), desenhar);
  };
  desenhar();
  $("#qMun").addEventListener("input", e => { est.q = e.target.value; est.pag = 0; desenhar(); });
  $("#csvMun").addEventListener("click", () => baixarCSV(`municipios_${norm(S.idx.get(chave(s))?.nomeUrna || "candidato").replace(/\W+/g, "-")}.csv`,
    ["municipio", "votos", "validos", "pct_validos", "votos_partido", "secoes"],
    d.municipios.map(m => [m.nome, m.votos, m.validos, (div(m.votos, m.validos) * 100 || 0).toFixed(3), m.partido, m.secoes])));
}

function viewEscolas(s, c, d) {
  const est = S.tab.esc;
  const muns = [...new Map(d.locais.map(l => [l.mun, l.munNome])).entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  $("#conteudo").insertAdjacentHTML("beforeend", `<section class="card vidro"><h2>Votação por escola (local de votação)</h2>
    <p class="desc">Cada local reúne as seções que votam ali. Clique para ver seção por seção e quem mais teve voto na escola.</p>
    <div class="filtros"><div class="campo"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input id="qEsc" type="search" placeholder="Filtrar escola ou bairro" value="${esc(est.q)}"></div>
      <label class="sel"><select id="munEsc"><option value="">Todos os municípios</option>${muns.map(([k, n]) => `<option value="${k}" ${String(est.mun) === String(k) ? "selected" : ""}>${esc(titulo(n))}</option>`).join("")}</select></label>
      <button class="btn" id="csvEsc">Baixar CSV</button></div>
    <div id="tEsc"></div></section>`);
  const desenhar = () => {
    const q = norm(est.q);
    const linhas = d.locais.filter(l => (!est.mun || String(l.mun) === String(est.mun)) && (!q || norm(l.nome).includes(q) || norm(l.bairro).includes(q)))
      .map(l => ({...l, p: div(l.votos, l.validos), ap: apurado(l.aptos, l.eleitores)}));
    const t = tabela({est, linhas, onRow: l => abrirLocal(l.id), cols: [
      {k: "nome", t: "Escola", f: l => `<span class="forte">${esc(titulo(l.nome))}</span>`},
      {k: "bairro", t: "Bairro", f: l => esc(titulo(l.bairro))},
      {k: "munNome", t: "Município", f: l => esc(titulo(l.munNome))},
      {k: "votos", t: "Votos", n: 1, f: l => int(l.votos)},
      {k: "p", t: "% válidos", n: 1, f: l => pct(l.p, 2)},
      {k: "secoes", t: "Seções", n: 1, f: l => int(l.secoes)},
      {k: "ap", t: "Apurado", f: l => progHTML(l.ap)},
    ]});
    $("#tEsc").innerHTML = t.html; t.ligar($("#tEsc"), desenhar);
  };
  desenhar();
  $("#qEsc").addEventListener("input", e => { est.q = e.target.value; est.pag = 0; desenhar(); });
  $("#munEsc").addEventListener("change", e => { est.mun = e.target.value; est.pag = 0; desenhar(); });
  $("#csvEsc").addEventListener("click", () => baixarCSV(`escolas_${norm(S.idx.get(chave(s))?.nomeUrna || "candidato").replace(/\W+/g, "-")}.csv`,
    ["municipio", "zona", "escola", "bairro", "endereco", "lat", "lng", "votos", "validos", "pct_validos", "secoes"],
    d.locais.map(l => [l.munNome, l.id.split("-")[1], l.nome, l.bairro, l.endereco, l.lat, l.lng, l.votos, l.validos, (div(l.votos, l.validos) * 100 || 0).toFixed(3), l.secoes])));
}

/* ------------------------------------------------------------------ Comparar */
function seletorComparacao() {
  const nomeDe = x => titulo(S.idx.get(chave(x))?.nomeUrna || "Candidato");
  const fora = S.sel.filter(x => !S.cmp.some(y => chave(y) === chave(x)));
  return `<section class="card vidro"><h2>Quem comparar</h2>
    <p class="desc">Escolha de 2 a 4 candidatos, de qualquer cargo. Nada vem pré-selecionado; a escolha fica salva neste navegador.</p>
    <div class="filtros" id="cmpSel">
      ${S.cmp.map(x => `<span class="chip" aria-pressed="true"><span class="bola" style="background:${corDe(x)}"></span>
        <span class="txt"><b>${esc(nomeDe(x))}</b><small>${esc(NOME_CARGO[x.cargo] || "")}</small></span>
        <button class="x" data-cmp-rm="${chave(x)}" aria-label="Tirar da comparação"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6 6 18M6 6l12 12"/></svg></button></span>`).join("")}
      ${S.cmp.length < 4 ? fora.map(x => `<button class="btn" data-cmp-add="${chave(x)}">+ ${esc(nomeDe(x))}</button>`).join("") : ""}
    </div>
    ${S.cmp.length < 4 ? `<div class="busca-global" style="margin:0;width:min(420px,100%)"><div class="campo">${ICONE_BUSCA}
      <input id="cmpBusca" type="search" placeholder="Buscar outro candidato pelo nome" autocomplete="off"></div>
      <div class="resultados" id="cmpRes" role="listbox"></div></div>` : ""}
    ${S.cmp.length ? `<p style="margin:12px 0 0"><button class="btn" id="cmpLimpar">Limpar comparação</button></p>` : ""}
  </section>`;
}
function ligarSeletorComparacao() {
  const mudar = () => { salvarSel(); atualizarCandidatos().then(render); render(); };
  $("#cmpSel")?.addEventListener("click", e => {
    const rm = e.target.closest("[data-cmp-rm]");
    if (rm) { S.cmp = S.cmp.filter(x => chave(x) !== rm.dataset.cmpRm); return mudar(); }
    const ad = e.target.closest("[data-cmp-add]");
    if (ad) { const [cargo, numero] = ad.dataset.cmpAdd.split("-").map(Number); incluirComparacao({cargo, numero}); mudar(); }
  });
  $("#cmpLimpar")?.addEventListener("click", () => { S.cmp = []; mudar(); });
  const inp = $("#cmpBusca"), res = $("#cmpRes");
  if (!inp) return;
  inp.addEventListener("input", () => {
    const q = norm(inp.value.trim());
    if (!q) { res.classList.remove("aberto"); return; }
    const lista = S.cands.filter(c => String(c.numero).startsWith(q) || norm(c.nomeUrna).includes(q) || norm(c.nome).includes(q))
      .sort((a, b) => b.votos - a.votos).slice(0, 30);
    res.innerHTML = lista.map(c => `<button data-k="${chave(c)}"><span><b>${esc(titulo(c.nomeUrna))}</b> <span class="nota">${esc(c.partido)}</span></span><small>${esc(NOME_CARGO[c.cargo] || "")}</small></button>`).join("")
      || `<div class="vazio">Nenhum candidato encontrado</div>`;
    res.classList.add("aberto");
  });
  res.addEventListener("click", e => {
    const b = e.target.closest("button[data-k]"); if (!b) return;
    const [cargo, numero] = b.dataset.k.split("-").map(Number);
    incluirComparacao({cargo, numero}); mudar();
  });
}
function incluirComparacao(c) {
  if (S.cmp.some(x => chave(x) === chave(c)) || S.cmp.length >= 4) return;
  const usadas = new Set(S.cmp.map(x => x.cor));
  let cor = 0; while (usadas.has(cor)) cor++;
  S.cmp.push({cargo: c.cargo, numero: c.numero, cor});
}

function viewComparar() {
  $("#conteudo").insertAdjacentHTML("beforeend", seletorComparacao());
  ligarSeletorComparacao();
  const itens = S.cmp.map(s => ({s, c: S.idx.get(chave(s)), d: S.dados.get(chave(s))})).filter(x => x.d);
  if (S.cmp.length < 2) return;
  if (itens.length < S.cmp.length) { $("#conteudo").insertAdjacentHTML("beforeend", vazio("Carregando…", "Buscando os dados dos candidatos escolhidos.")); return; }
  let h = `<div class="cabeca"><div><span class="kicker">Comparação</span><h1>${itens.map(x => esc(titulo(x.c?.nomeUrna || "Candidato"))).join(" × ")}</h1>
    <p>Mesmo território, cargos ${[...new Set(itens.map(x => NOME_CARGO[x.s.cargo]))].join(" e ")}.</p></div></div><div class="cmp-grid">`;
  for (const {s, c, d} of itens) {
    const muns = d.municipios.filter(m => m.votos > 0).sort((a, b) => b.votos - a.votos);
    h += `<section class="vidro cmp-card" style="--c:${corDe(s)}"><h3>${esc(titulo(c?.nomeUrna || "Candidato"))}</h3><div class="sub">${esc(NOME_CARGO[s.cargo])} · ${esc(c?.partido || "")}</div>
      <div class="linha"><span>Votos (oficial)</span><b>${int(c?.votos)}</b></div>
      <div class="linha"><span>% dos válidos</span><b>${pct(c?.pct / 100, 2)}</b></div>
      <div class="linha"><span>Posição</span><b>${c?.posicao ? c.posicao + "º" : "–"}</b></div>
      <div class="linha"><span>Municípios com voto</span><b>${int(muns.length)}</b></div>
      <div class="linha"><span>Maior município</span><b>${muns[0] ? esc(titulo(muns[0].nome)) : "–"}</b></div></section>`;
  }
  h += `</div>`;
  // Municípios: top 15 pela soma dos votos
  const soma = new Map();
  for (const {d} of itens) for (const m of d.municipios) soma.set(m.mun, (soma.get(m.mun) || 0) + m.votos);
  const topMun = [...soma.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k]) => k);
  const porMun = itens.map(x => new Map(x.d.municipios.map(m => [m.mun, m])));
  const legenda = `<div class="legend">${itens.map(({s, c}) => `<span><i style="width:10px;height:10px;border-radius:3px;background:${corDe(s)};display:inline-block"></i>${esc(titulo(c?.nomeUrna || "Candidato"))}</span>`).join("")}</div>`;
  const nomeMun = k => titulo(porMun.find(m => m.get(k))?.get(k)?.nome || k);
  h += `<section class="card vidro"><h2>Votos nos principais municípios</h2><p class="desc">Os 15 municípios com mais votos somando os candidatos selecionados.</p>${legenda}
    <div id="gCmp">${topMun.length ? barras(topMun.map(k => ({rot: nomeMun(k), mun: k, valores: itens.map(({s}, i) => ({v: porMun[i].get(k)?.votos || 0, cor: corDe(s)}))})), {onclick: true}) : `<div class="vazio-estado"><b>Ainda sem boletins</b>Aparece com as primeiras seções.</div>`}</div></section>`;

  // Dobradinha por escola
  if (itens.length >= 2) {
    const [A, B] = itens;
    const mA = new Map(A.d.locais.map(l => [l.id, l])), mB = new Map(B.d.locais.map(l => [l.id, l]));
    const mediaA = div(A.d.apurado.votos, A.d.apurado.validos), mediaB = div(B.d.apurado.votos, B.d.apurado.validos);
    let ambos = 0, soA = 0, soB = 0, nenhum = 0;
    const fortes = [];
    for (const [id, la] of mA) {
      const lb = mB.get(id); if (!lb || la.validos < 50) continue;
      const fa = div(la.votos, la.validos) > mediaA, fb = div(lb.votos, lb.validos) > mediaB;
      if (fa && fb) { ambos++; fortes.push({...la, va: la.votos, vb: lb.votos}); } else if (fa) soA++; else if (fb) soB++; else nenhum++;
    }
    const nA = titulo(A.c?.nomeUrna || "Candidato"), nB = titulo(B.c?.nomeUrna || "Candidato");
    const tot = ambos + soA + soB + nenhum;
    h += `<div class="grid-2"><section class="card vidro"><h2>Dobradinha por escola</h2><p class="desc">Escolas onde cada um tem fatia dos válidos acima da própria média no estado (só escolas com 50+ válidos apurados).</p>
      ${tot ? barras([
        {rot: "Os dois acima da média", valores: [{v: ambos, cor: "#cfd8e0", txt: `${int(ambos)} · ${pct(div(ambos, tot), 0)}`}]},
        {rot: `Só ${nA}`, valores: [{v: soA, cor: corDe(A.s), txt: `${int(soA)} · ${pct(div(soA, tot), 0)}`}]},
        {rot: `Só ${nB}`, valores: [{v: soB, cor: corDe(B.s), txt: `${int(soB)} · ${pct(div(soB, tot), 0)}`}]},
        {rot: "Nenhum dos dois", valores: [{v: nenhum, cor: COR_OUTRO, txt: `${int(nenhum)} · ${pct(div(nenhum, tot), 0)}`}]},
      ], {max: tot}) : `<div class="vazio-estado"><b>Ainda sem boletins</b></div>`}</section>
      <section class="card vidro"><h2>Escolas fortes para os dois</h2><p class="desc">Maior soma de votos entre as escolas onde ambos ficam acima da média.</p>
        <div id="gFortes">${fortes.length ? barras(fortes.sort((a, b) => (b.va + b.vb) - (a.va + a.vb)).slice(0, 10).map(l => ({rot: titulo(l.nome), sub: titulo(l.munNome), id: l.id,
          valores: [{v: l.va, cor: corDe(A.s)}, {v: l.vb, cor: corDe(B.s)}]})), {onclick: true}) : `<div class="vazio-estado"><b>Sem escolas em comum ainda</b></div>`}</div></section></div>`;
    S._fortes = fortes;
  }
  $("#conteudo").insertAdjacentHTML("beforeend", h);
  $("#gCmp")?.addEventListener("click", e => { const r = e.target.closest("[data-i]"); if (r) abrirMunicipio(topMun[r.dataset.i]); });
  $("#gFortes")?.addEventListener("click", e => { const r = e.target.closest("[data-i]"); if (r) abrirLocal(S._fortes[r.dataset.i].id); });
}

/* ------------------------------------------------------------------ Relatório */
function textoCandidato(s, c, d) {
  const ap = d.apurado;
  const nome = titulo(c?.nomeUrna || "Candidato");
  const media = div(ap.votos, ap.validos);
  const muns = d.municipios.filter(m => m.votos > 0).sort((a, b) => b.votos - a.votos);
  const tot = muns.reduce((a, m) => a + m.votos, 0);
  const top5 = muns.slice(0, 5);
  const share5 = div(top5.reduce((a, m) => a + m.votos, 0), tot);
  const redutos = d.municipios.filter(m => m.validos >= 300 && div(m.votos, m.validos) > 3 * media).sort((a, b) => b.votos / b.validos - a.votos / a.validos).slice(0, 6);
  // Oportunidades: municípios grandes (top 30 em válidos) com fatia abaixo de metade da média
  const grandes = d.municipios.slice().sort((a, b) => b.validos - a.validos).slice(0, 30);
  const fracos = grandes.filter(m => div(m.votos, m.validos) < media / 2).slice(0, 6);
  const escolas = d.locais.filter(l => l.votos > 0).sort((a, b) => b.votos - a.votos).slice(0, 5);
  const rk = rankingCargo(c || {cargo: s.cargo});
  const of = d.oficial || {};
  const andamento = of.secoes?.total ? div(of.secoes.totalizadas, of.secoes.total) : null;
  const L = [];
  L.push(`<h3>${esc(nome)} · ${esc(NOME_CARGO[s.cargo])}</h3>`);
  if (!c?.votos && !ap.votos) return L.concat(`<p>Ainda não há votos totalizados para ${esc(nome)}. O relatório se preenche sozinho conforme a apuração avança.</p>`).join("");
  L.push(`<p>Com <b>${pct(andamento, 1)}</b> das seções totalizadas pelo TSE, ${esc(nome)} tem <b>${int(c?.votos)} votos</b> (${pct(c?.pct / 100, 2)} dos válidos) e ocupa a <b>${rk.pos ?? "–"}ª posição</b> entre ${int(rk.total)} candidatos a ${esc(NOME_CARGO[s.cargo])} com voto${rk.vagas ? `, numa disputa por ${rk.vagas} ${rk.vagas > 1 ? "vagas" : "vaga"}` : ""}.${andamento != null && andamento < 0.99 ? " Os números ainda vão mudar: a ordem de chegada das urnas não é aleatória (capitais e cidades grandes costumam demorar mais)." : ""}</p>`);
  if (tot) {
    if (muns.length > 1) L.push(`<p><b>Concentração.</b> O voto aparece em ${int(muns.length)} municípios. Os cinco maiores (${top5.map(m => esc(titulo(m.nome))).join(", ")}) somam <b>${pct(share5, 0)}</b> do total mapeado por boletim${share5 > 0.6 ? ", o que indica uma votação concentrada, de base regional" : share5 < 0.3 ? ", o que indica uma votação espalhada pelo estado" : ""}.</p>`);
    if (redutos.length) L.push(`<p><b>Redutos</b> (mais de 3× a média estadual de ${pct(media, 2)}):</p><ul>${redutos.map(m => `<li>${esc(titulo(m.nome))}: ${pct(div(m.votos, m.validos), 1)} dos válidos (${int(m.votos)} votos)</li>`).join("")}</ul>`);
    if (escolas.length) L.push(`<p><b>Escolas com mais votos:</b></p><ul>${escolas.map(l => `<li>${esc(titulo(l.nome))} (${esc(titulo(l.munNome))}${l.bairro ? ", " + esc(titulo(l.bairro)) : ""}): ${int(l.votos)} votos, ${pct(div(l.votos, l.validos), 1)} dos válidos</li>`).join("")}</ul>`);
    if (fracos.length) L.push(`<p><b>Onde o voto é fraco nos grandes colégios</b> (abaixo da metade da média, entre os 30 maiores municípios): ${fracos.map(m => `${esc(titulo(m.nome))} (${pct(div(m.votos, m.validos), 2)})`).join(", ")}.</p>`);
    if (ap.votosPartido) L.push(`<p><b>Peso no partido.</b> Nas seções apuradas, ${esc(nome)} responde por <b>${pct(div(ap.votos, ap.votosPartido), 1)}</b> dos votos do ${esc(c?.partido || "partido")} para ${esc(NOME_CARGO[s.cargo])} (nominais + legenda).</p>`);
  }
  return L.join("");
}
function viewRelatorio() {
  // Relatório do candidato ativo; a dobradinha só entra se o usuário montou uma comparação
  const ativo = S.ativoSel();
  const itens = ativo ? [{s: ativo, c: S.idx.get(chave(ativo)), d: S.dados.get(chave(ativo))}].filter(x => x.d) : [];
  const cmp = S.cmp.map(s => ({s, c: S.idx.get(chave(s)), d: S.dados.get(chave(s))})).filter(x => x.d);
  const st = S.status;
  let h = `<div class="cabeca"><div><span class="kicker">Relatório automático</span><h1>Leitura da apuração</h1>
    <p>Gerado às ${new Date().toLocaleTimeString("pt-BR", {hour: "2-digit", minute: "2-digit"})} com os dados do TSE de ${esc(Object.values(st?.cargos || {})[0]?.dataHora || "–")}.</p></div>
    <button class="btn" onclick="print()">Imprimir / salvar PDF</button></div>
    <section class="card vidro relatorio">${itens.map(x => textoCandidato(x.s, x.c, x.d)).join("") || "<p>Adicione um candidato.</p>"}`;
  if (cmp.length >= 2) {
    const [A, B] = cmp;
    const pa = new Map(A.d.municipios.map(m => [m.mun, div(m.votos, m.validos) || 0]));
    const pares = B.d.municipios.filter(m => pa.has(m.mun) && m.validos >= 300).map(m => [pa.get(m.mun), div(m.votos, m.validos) || 0]);
    const r = correlacao(pares);
    if (r != null) h += `<h3>Dobradinha ${esc(titulo(A.c?.nomeUrna))} × ${esc(titulo(B.c?.nomeUrna))}</h3>
      <p>A correlação entre as fatias de voto dos dois por município é <b>${r.toLocaleString("pt-BR", {maximumFractionDigits: 2})}</b> (${int(pares.length)} municípios com 300+ válidos).
      ${r > 0.6 ? "Os dois crescem juntos nos mesmos lugares: a dobradinha está funcionando como base comum." : r > 0.3 ? "Há sobreposição parcial: parte da base é comum, parte é própria de cada um." : "As bases são pouco sobrepostas: cada um vota bem em lugares diferentes, o que abre espaço para transferir apoio onde só um é forte."}
      Veja a aba <b>Comparar</b> para as escolas onde os dois estão acima da média.</p>`;
  }
  h += `<p class="nota" style="margin-top:22px">Votos oficiais: arquivo consolidado do TSE. Detalhe por município/escola: soma dos boletins de urna publicados, que podem estar um pouco atrás do total oficial durante a apuração.</p></section>`;
  $("#conteudo").insertAdjacentHTML("beforeend", h);
}
function correlacao(p) {
  if (p.length < 5) return null;
  const n = p.length, mx = p.reduce((a, x) => a + x[0], 0) / n, my = p.reduce((a, x) => a + x[1], 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of p) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}

function baixarCSV(nome, cab, linhas) {
  const csv = [cab, ...linhas].map(l => l.map(v => { const s = String(v ?? ""); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(";")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + csv], {type: "text/csv;charset=utf-8"}));
  a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ------------------------------------------------------------------ gaveta de detalhe */
const gav = {el: $("#gaveta"), veu: $("#veu"), pilha: []};
function abrirGaveta(trilha, html, empilhar = true) {
  if (empilhar) gav.pilha.push({trilha, html}); else gav.pilha = [{trilha, html}];
  $("#gavetaTrilha").textContent = trilha;
  $("#gavetaCorpo").innerHTML = html;
  $("#gavetaVoltar").hidden = gav.pilha.length < 2;
  gav.el.classList.add("aberta"); gav.veu.classList.add("aberto"); gav.el.setAttribute("aria-hidden", "false");
  gav.el.scrollTop = 0;
}
function fecharGaveta() { gav.el.classList.remove("aberta"); gav.veu.classList.remove("aberto"); gav.el.setAttribute("aria-hidden", "true"); gav.pilha = []; }
$("#gavetaFechar").addEventListener("click", fecharGaveta);
gav.veu.addEventListener("click", fecharGaveta);
document.addEventListener("keydown", e => { if (e.key === "Escape") fecharGaveta(); });
$("#gavetaVoltar").addEventListener("click", () => {
  gav.pilha.pop(); const t = gav.pilha[gav.pilha.length - 1];
  if (t) { $("#gavetaTrilha").textContent = t.trilha; $("#gavetaCorpo").innerHTML = t.html; $("#gavetaVoltar").hidden = gav.pilha.length < 2; }
});
$("#gavetaCorpo").addEventListener("click", e => {
  const l = e.target.closest("[data-local]"); if (l) return abrirLocal(l.dataset.local);
  const m = e.target.closest("[data-mun]"); if (m) { e.preventDefault(); return abrirMunicipio(Number(m.dataset.mun)); }
});

function topHTML(top, s) {
  if (!top?.length) return `<p class="nota">Sem votos apurados ainda.</p>`;
  return barras(top.map((t, i) => ({rot: `${i + 1}º ${titulo(t.nomeUrna || "Candidato")}`, sub: t.partido, eu: t.numero === s.numero,
    valores: [{v: t.votos, cor: t.numero === s.numero ? corDe(s) : COR_OUTRO}]})));
}

async function abrirMunicipio(mun) {
  const s = S.ativoSel(), d = S.dados.get(S.ativo); if (!s || !d) return;
  const m = d.municipios.find(x => x.mun === Number(mun)) || {mun, nome: "", votos: 0, validos: 0, secoes: 0};
  const r = await api(`api/municipio?mun=${mun}&cargo=${s.cargo}&numero=${s.numero}`).catch(() => ({}));
  const nome = titulo(r.nome || m.nome);
  const locais = d.locais.filter(l => l.mun === Number(mun)).sort((a, b) => b.votos - a.votos);
  const zonas = d.zonas.filter(z => z.mun === Number(mun)).sort((a, b) => b.votos - a.votos);
  const oficialSec = r.oficial?.secoes;
  abrirGaveta(`Município · ${nome}`, `
    <span class="kicker">${esc(NOME_CARGO[s.cargo])} · ${esc(titulo(S.idx.get(S.ativo)?.nomeUrna || "Candidato"))}</span>
    <h2>${esc(nome)}</h2>
    <div class="sub">${oficialSec ? `${esc(oficialSec.pst)}% das seções totalizadas no município` : ""}</div>
    <div class="kpis">
      <div class="kpi vidro destaque"><div class="lbl">Votos (oficial)</div><div class="val">${int(r.oficialCand?.votos ?? m.votos)}</div><div class="sub">${r.oficialCand ? pct(r.oficialCand.pct / 100, 2) + " dos válidos" : ""}</div></div>
      <div class="kpi vidro"><div class="lbl">Mapeado por boletim</div><div class="val">${int(m.votos)}</div><div class="sub">${pct(div(m.votos, m.validos), 2)} · ${int(m.secoes)} seções</div></div>
      <div class="kpi vidro"><div class="lbl">Escolas com voto</div><div class="val">${int(locais.filter(l => l.votos).length)}</div><div class="sub">de ${int(locais.length)} apuradas</div></div>
    </div>
    <h3>Mais votados no município (${esc(NOME_CARGO[s.cargo])})</h3>${topHTML(r.top, s)}
    ${zonas.length > 1 ? `<h3>Zonas eleitorais</h3>${barras(zonas.map(z => ({rot: `Zona ${z.zona}`, valores: [{v: z.votos, cor: corDe(s)}], extra: pct(div(z.votos, z.validos), 2)})))}` : ""}
    <h3>Escolas</h3>
    <div class="lista-links">${locais.slice(0, 60).map(l => `<button data-local="${l.id}">${esc(titulo(l.nome))}<small>${int(l.votos)} votos · ${pct(div(l.votos, l.validos), 1)}${l.bairro ? " · " + esc(titulo(l.bairro)) : ""}</small></button>`).join("") || `<p class="nota">Nenhuma escola apurada ainda.</p>`}</div>
  `, false);
}

async function abrirLocal(id) {
  const s = S.ativoSel(); if (!s) return;
  const r = await api(`api/local?id=${encodeURIComponent(id)}&cargo=${s.cargo}&numero=${s.numero}`).catch(() => null);
  if (!r) return;
  const l = r.local || {};
  const tot = r.secoes.reduce((a, x) => ({v: a.v + x.votos, val: a.val + x.nominais + x.legenda, comp: a.comp + x.comp, aptos: a.aptos + (x.aptos || 0)}), {v: 0, val: 0, comp: 0, aptos: 0});
  abrirGaveta(`Escola · ${titulo(l.nome || id)}`, `
    <span class="kicker">${esc(titulo(r.munNome))} · Zona ${esc(l.zona ?? id.split("-")[1])}</span>
    <h2>${esc(titulo(l.nome || "Local " + id))}</h2>
    <div class="sub">${esc(titulo(l.endereco || ""))}${l.bairro ? " · " + esc(titulo(l.bairro)) : ""} ${l.mun ? `· <a href="#" data-mun="${l.mun}" style="color:var(--kicker)">ver município</a>` : ""}</div>
    <div class="kpis">
      <div class="kpi vidro destaque"><div class="lbl">Votos</div><div class="val">${int(tot.v)}</div><div class="sub">${pct(div(tot.v, tot.val), 2)} dos válidos</div></div>
      <div class="kpi vidro"><div class="lbl">Comparecimento</div><div class="val">${pct(div(tot.comp, tot.aptos), 1)}</div><div class="sub">${int(tot.comp)} de ${int(tot.aptos)} aptos</div></div>
      <div class="kpi vidro"><div class="lbl">Apurado na escola</div><div class="val">${pct(apurado(tot.aptos, l.eleitores), 0)}</div><div class="sub">${int(r.secoes.length)} seções · falta ${pct(1 - (apurado(tot.aptos, l.eleitores) || 0), 0)}</div></div>
    </div>
    <h3>Seção por seção</h3>
    <div class="tbl-wrap"><table><thead><tr><th>Seção</th><th class="n">Aptos</th><th class="n">Compar.</th><th class="n">Votos</th><th class="n">% válidos</th></tr></thead><tbody>
      ${r.secoes.map(x => `<tr><td>${x.secao}</td><td class="n">${int(x.aptos)}</td><td class="n">${int(x.comp)}</td><td class="n forte">${int(x.votos)}</td><td class="n">${pct(div(x.votos, x.nominais + x.legenda), 1)}</td></tr>`).join("") || `<tr><td colspan="5" class="nota">Nenhuma seção apurada ainda.</td></tr>`}
    </tbody></table></div>
    <h3>Mais votados na escola (${esc(NOME_CARGO[s.cargo])})</h3>${topHTML(r.top, s)}
  `);
}

/* ------------------------------------------------------------------ render */
function render(auto = false) {
  renderChips(); renderAbas();
  // Atualização automática no meio de uma interação com tabela/mapa: só redesenha se a aba não for o mapa
  if (auto && S.aba === "mapa" && MAPA) { atualizarMapaSilencioso(); return; }
  const main = $("#conteudo");
  limparMapas();
  main.innerHTML = faixaAoVivo();
  if (!S.status) { main.innerHTML = vazio("Carregando…", "Conectando ao TSE."); return; }
  if (S.aba === "comparar") return viewComparar();
  if (S.aba === "relatorio") return viewRelatorio();
  if (S.aba === "historico") return viewHistorico();
  const s = S.ativoSel();
  if (!s) { main.insertAdjacentHTML("beforeend", vazio("Nenhum candidato selecionado", "Use “+ Candidato” para escolher quem acompanhar.")); return; }
  const c = S.idx.get(S.ativo), d = S.dados.get(S.ativo);
  main.insertAdjacentHTML("beforeend", cabecalho(c, s));
  if (!d) { main.insertAdjacentHTML("beforeend", vazio("Carregando dados do candidato…", "")); return; }
  ({geral: viewGeral, cadeiras: viewCadeiras, cidades: viewCidades, regioes: viewRegioes, mapa: viewMapa, municipios: viewMunicipios, escolas: viewEscolas}[S.aba] || viewGeral)(s, c, d);
}
function atualizarMapaSilencioso() {
  const faixa = $(".ao-vivo"); if (faixa) faixa.outerHTML = faixaAoVivo();
  const s = S.ativoSel(), c = S.idx.get(S.ativo), d = S.dados.get(S.ativo);
  if (!s || !d) return;
  const conteudo = $("#conteudo");
  [...conteudo.children].slice(1).forEach(n => n.remove());
  conteudo.insertAdjacentHTML("beforeend", cabecalho(c, s));
  viewMapa(s, c, d);
}

// Painel geral: seletor de estado (todos os estados do Brasil) e link para a página nacional
const UFS = {ac: "Acre", al: "Alagoas", ap: "Amapá", am: "Amazonas", ba: "Bahia", ce: "Ceará", df: "Distrito Federal", es: "Espírito Santo",
  go: "Goiás", ma: "Maranhão", mt: "Mato Grosso", ms: "Mato Grosso do Sul", mg: "Minas Gerais", pa: "Pará", pb: "Paraíba", pr: "Paraná",
  pe: "Pernambuco", pi: "Piauí", rj: "Rio de Janeiro", rn: "Rio Grande do Norte", rs: "Rio Grande do Sul", ro: "Rondônia", rr: "Roraima",
  sc: "Santa Catarina", sp: "São Paulo", se: "Sergipe", to: "Tocantins"};
(function seletorEstado() {
  if (!CLIENTE.geral) return;
  $("#marca").href = "../";
  $("#marca").insertAdjacentHTML("afterend", `<label class="sel-uf"><span class="sr">Estado</span>
    <select id="selUf" aria-label="Estado">${Object.entries(UFS).sort((a, b) => a[1].localeCompare(b[1])).map(([u, n]) => `<option value="${u}" ${u === CLIENTE.uf ? "selected" : ""}>${n}</option>`).join("")}</select></label>`);
  $("#selUf").addEventListener("change", e => { location.href = `../${e.target.value}/`; });
})();

// Topo: logo do cliente + selo "por MOBI"
(function marcaCliente() {
  if (!CLIENTE.logo) return;
  $("#marca").innerHTML = `<img class="logo-cli ${CLIENTE.logoClaro ? "claro" : ""}" src="${esc(CLIENTE.logo)}" alt="${esc(CLIENTE.titulo)}">
    <span class="por">por <img src="marca/mobi-logo-light.png" alt="MOBI — Mobilização Inteligente"></span>`;
})();

(async function iniciar() {
  render();
  try {
    await atualizarStatus();
    carregarSel(S.status.candidatosPadrao || []);
    render();
    await atualizarCandidatos();
    render();
  } catch (e) {
    $("#conteudo").innerHTML = vazio("Não foi possível falar com o servidor", String(e.message || e));
  }
  // Enquanto o servidor ainda não leu o TSE, tenta de novo em poucos segundos
  (async function espera() {
    while (!Object.keys(S.status?.cargos || {}).length) { await new Promise(r => setTimeout(r, 4000)); await ciclo(); }
  })();
  setInterval(ciclo, 30000);
})();
