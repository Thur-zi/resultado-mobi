/* Regiões: mais votados por região do IBGE (intermediárias e imediatas). Usa utilidades globais de app.js. */
"use strict";

const REG = {nivel: (() => { try { return localStorage.getItem("apu.regNivel") || "intermediaria"; } catch { return "intermediaria"; } })(), dados: null};

async function viewRegioes(s, c, d) {
  await carregarMunicipios();
  const main = $("#conteudo");
  main.insertAdjacentHTML("beforeend", `<section class="card vidro">
    <div class="filtros" style="margin:0">
      <div class="grupo-seg" id="regNivel">
        <button data-n="intermediaria" aria-pressed="${REG.nivel === "intermediaria"}">Regiões intermediárias</button>
        <button data-n="imediata" aria-pressed="${REG.nivel === "imediata"}">Regiões imediatas</button>
        <button data-n="capital" aria-pressed="${REG.nivel === "capital"}">Regionais de ${esc(titulo(S.muns.find(m => m.mun === S.status?.capital)?.nome || "da capital"))}</button>
      </div>
      <button class="btn" id="regCsv">Baixar CSV</button>
      <span class="nota">Divisão regional oficial do IBGE. Mais votados de ${esc(NOME_CARGO[s.cargo])} nos boletins já publicados; clique numa região para ver a lista completa.</span>
    </div></section>
    <div class="reg-grid" id="regGrid"><div class="vazio-estado"><b>Calculando…</b>Somando os boletins de cada região.</div></div>`);
  $("#regNivel").addEventListener("click", e => {
    const b = e.target.closest("[data-n]"); if (!b) return;
    REG.nivel = b.dataset.n; try { localStorage.setItem("apu.regNivel", REG.nivel); } catch {}
    render();
  });
  if (REG.nivel === "capital") return viewRegionaisCapital(s, c, d);
  let lista;
  for (let t = 0; t < 6; t++) {
    try { lista = await api(`api/regioes?cargo=${s.cargo}&numero=${s.numero}&nivel=${REG.nivel}`); break; }
    catch { await new Promise(r => setTimeout(r, 3000)); }
  }
  const grid = $("#regGrid"); if (!grid) return;
  if (!lista) { grid.innerHTML = `<div class="vazio-estado"><b>Ainda calculando</b>Tente de novo em alguns segundos.</div>`; return; }
  REG.dados = lista;
  const nome = titulo(c?.nomeUrna || "Candidato");
  grid.innerHTML = lista.map((r, i) => {
    const ap = apurado(r.aptos, r.eleitores);
    return `<button class="vidro reg-card" data-i="${i}">
      <span class="reg-topo"><b>${esc(r.nome)}</b><small>${int(r.municipios.length)} municípios · ${int(r.eleitores)} eleitores</small></span>
      <span class="reg-ap">${progHTML(ap)}</span>
      <span class="reg-eu" style="--c:${corDe(s)}">${esc(nome)}: ${r.posicao ? `<b>${r.posicao}º</b> · ${int(r.votos)} votos · ${pct(div(r.votos, r.validos), 2)}` : "sem votos apurados ainda"}</span>
      <ol class="reg-top">${r.top.slice(0, 5).map(t => `<li class="${t.numero === s.numero ? "eu" : ""}"><span>${esc(titulo(t.nomeUrna))} <small>${esc(t.partido)}</small></span><b>${int(t.votos)}</b></li>`).join("")
        || `<li class="nota">Sem boletins apurados</li>`}</ol>
    </button>`;
  }).join("");
  grid.addEventListener("click", e => { const b = e.target.closest("[data-i]"); if (b) abrirRegiao(lista[b.dataset.i], s, c, d); });
  $("#regCsv").addEventListener("click", () => baixarCSV(`regioes_${REG.nivel}.csv`,
    ["regiao", "municipios", "eleitores", "pct_apurado", "posicao_candidato", "votos_candidato", "1o", "votos_1o", "2o", "votos_2o", "3o", "votos_3o"],
    lista.map(r => [r.nome, r.municipios.length, r.eleitores, ((apurado(r.aptos, r.eleitores) || 0) * 100).toFixed(1), r.posicao || "", r.votos,
      r.top[0]?.nomeUrna || "", r.top[0]?.votos || "", r.top[1]?.nomeUrna || "", r.top[1]?.votos || "", r.top[2]?.nomeUrna || "", r.top[2]?.votos || ""])));
}

function abrirRegiao(r, s, c, d) {
  const porMun = new Map(d.municipios.map(m => [m.mun, m]));
  const muns = r.municipios.map(m => porMun.get(m) || {mun: m, nome: S.muns.find(x => x.mun === m)?.nome || "", votos: 0, validos: 0})
    .sort((a, b) => b.votos - a.votos);
  abrirGaveta(`Região · ${r.nome}`, `
    <span class="kicker">${esc(NOME_CARGO[s.cargo])} · ${REG.nivel === "imediata" ? "Região imediata" : "Região intermediária"} (IBGE)</span>
    <h2>${esc(r.nome)}</h2><div class="sub">${int(r.municipios.length)} municípios · ${int(r.eleitores)} eleitores · ${pct(apurado(r.aptos, r.eleitores), 0)} apurado</div>
    <div class="kpis">
      <div class="kpi vidro destaque"><div class="lbl">${esc(titulo(c?.nomeUrna || "Candidato"))}</div><div class="val">${r.posicao ? r.posicao + "º" : "–"}</div><div class="sub">${int(r.votos)} votos · ${pct(div(r.votos, r.validos), 2)}</div></div>
      <div class="kpi vidro"><div class="lbl">Candidatos com voto</div><div class="val">${int(r.comVoto)}</div><div class="sub">nesta região</div></div>
    </div>
    <h3>Mais votados na região</h3>${topHTML(r.top, s)}
    <h3>Municípios da região</h3>
    <div class="lista-links">${muns.map(m => `<button data-mun="${m.mun}">${esc(titulo(m.nome))}<small>${int(m.votos)} votos${m.validos ? " · " + pct(div(m.votos, m.validos), 1) : ""}</small></button>`).join("")}</div>`, false);
}

// Regionais da capital (ex.: BH): limites do OpenStreetMap, escolas de cada regional e mais votados de cada uma
async function viewRegionaisCapital(s, c, d) {
  const grid = $("#regGrid");
  const mun = S.status?.capital;
  const info = S.muns.find(m => m.mun === mun) || {nome: ""};
  const [lim, todos] = await Promise.all([limitesDaCidade(mun), locaisDaCidade(mun)]);
  if (!$("#regGrid")) return;
  const fc = lim?.regioes?.features || [];
  if (fc.length < 2) { grid.innerHTML = `<div class="vazio-estado"><b>Sem regionais cadastradas</b>O OpenStreetMap não tem as regionais de ${esc(titulo(info.nome))}; veja os bairros na aba Mapas das cidades.</div>`; return; }
  const votosPorId = new Map(d.locais.map(l => [l.id, l]));
  const locais = todos.map(l => ({...l, mun, munNome: info.nome, votos: votosPorId.get(l.id)?.votos || 0, validos: votosPorId.get(l.id)?.validos || 0, aptos: votosPorId.get(l.id)?.aptos || 0}));
  const areas = agregarPorArea(fc, locais).filter(a => a.locais.length).sort((a, b) => b.eleitores - a.eleitores);
  const nome = titulo(c?.nomeUrna || "Candidato");
  const tops = await Promise.all(areas.map(a => api(`api/area?cargo=${s.cargo}&numero=${s.numero}&mun=${mun}&locais=${a.locais.map(l => l.id.split("-").slice(1).join("-")).join(",")}`).catch(() => null)));
  if (!$("#regGrid")) return;
  REG.dados = areas.map((a, i) => ({nome: a.f.properties.nome, area: a, r: tops[i]}));
  grid.innerHTML = REG.dados.map(({nome: rn, area: a, r}, i) => {
    const ap = apurado(a.aptos, a.eleitores);
    return `<button class="vidro reg-card" data-i="${i}">
      <span class="reg-topo"><b>${esc(rn)}</b><small>${int(a.locais.length)} escolas · ${int(a.eleitores)} eleitores</small></span>
      <span class="reg-ap">${progHTML(ap)}</span>
      <span class="reg-eu" style="--c:${corDe(s)}">${esc(nome)}: ${r?.posicao ? `<b>${r.posicao}º</b> · ${int(r.votos)} votos · ${pct(div(a.votos, a.validos), 2)}` : "sem votos apurados ainda"}</span>
      <ol class="reg-top">${(r?.top || []).slice(0, 5).map(t => `<li class="${t.numero === s.numero ? "eu" : ""}"><span>${esc(titulo(t.nomeUrna))} <small>${esc(t.partido)}</small></span><b>${int(t.votos)}</b></li>`).join("")
        || `<li class="nota">Sem boletins apurados</li>`}</ol>
    </button>`;
  }).join("");
  grid.addEventListener("click", e => { const b = e.target.closest("[data-i]"); if (!b) return; const x = REG.dados[b.dataset.i];
    abrirListaEscolas(`Regional · ${titulo(info.nome)}`, x.nome, titulo(info.nome), x.area.locais, s); });
  $("#regCsv").onclick = () => baixarCSV(`regionais_${norm(info.nome).replace(/\W+/g, "-")}.csv`,
    ["regional", "escolas", "eleitores", "pct_apurado", "posicao_candidato", "votos_candidato", "1o", "votos_1o", "2o", "votos_2o", "3o", "votos_3o"],
    REG.dados.map(({nome: rn, area: a, r}) => [rn, a.locais.length, a.eleitores, ((apurado(a.aptos, a.eleitores) || 0) * 100).toFixed(1), r?.posicao || "", r?.votos || 0,
      r?.top?.[0]?.nomeUrna || "", r?.top?.[0]?.votos || "", r?.top?.[1]?.nomeUrna || "", r?.top?.[1]?.votos || "", r?.top?.[2]?.nomeUrna || "", r?.top?.[2]?.votos || ""]));
}
