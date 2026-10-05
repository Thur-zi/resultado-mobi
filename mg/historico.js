/* Comparação com uma votação de eleição anterior (ex.: Felipe Ribeiro 2026 × Dalmo Ribeiro 2022).
   Usa utilidades e estado globais de app.js / cidades.js. */
"use strict";

const HIST = {dados: new Map(), est: {ord: "ant", dir: -1, q: "", pag: 0}, mapa: null};

async function viewHistorico() {
  const h = CLIENTE.historico?.[0];
  if (!h) return;
  const s = {...h.compara, cor: 0};
  const k = chave(s);
  const c = S.idx.get(k);
  let d = S.dados.get(k);
  if (!d) { try { d = await api(`api/candidato?cargo=${s.cargo}&numero=${s.numero}`); S.dados.set(k, d); } catch {} }
  if (!HIST.dados.has(h.id)) HIST.dados.set(h.id, await api(`api/historico?id=${h.id}`));
  const ant = HIST.dados.get(h.id);
  if (!d || !ant) { $("#conteudo").insertAdjacentHTML("beforeend", vazio("Carregando…", "")); return; }

  await malhaMunicipios();
  await carregarMunicipios();
  const nomeMun = m => titulo(S.muns.find(x => x.mun === Number(m))?.nome || m);
  const atual = new Map(d.municipios.map(m => [m.mun, m]));
  const linhas = Object.entries(ant.municipios).map(([m, [va, vala]]) => {
    const x = atual.get(Number(m)) || {votos: 0, validos: 0};
    return {mun: Number(m), nome: nomeMun(m), ant: va, antPct: div(va, vala), novo: x.votos, novoPct: div(x.votos, x.validos),
      ret: div(x.votos, va), apurado: x.validos > 0};
  });
  // Municípios onde o atual tem voto e o anterior não
  for (const x of d.municipios) if (x.votos > 0 && !ant.municipios[x.mun])
    linhas.push({mun: x.mun, nome: nomeMun(x.mun), ant: 0, antPct: 0, novo: x.votos, novoPct: div(x.votos, x.validos), ret: null, apurado: true});

  const nomeAnt = ant.candidato.nome, nomeNovo = titulo(c?.nomeUrna || "Felipe Ribeiro");
  const corAnt = COR_OUTRO, corNovo = CORES[0];
  const comparaveis = linhas.filter(l => l.apurado && l.ant > 0);
  const antComp = comparaveis.reduce((t, l) => t + l.ant, 0), novoComp = comparaveis.reduce((t, l) => t + l.novo, 0);

  let html = `<div class="cabeca"><div><span class="kicker">Comparação com ${ant.candidato.ano}</span>
      <h1><span class="texto-marca">${esc(nomeNovo)}</span> × ${esc(nomeAnt)}</h1>
      <p>${esc(nomeNovo)} (${esc(NOME_CARGO[s.cargo])}, 2026) comparado com ${esc(ant.candidato.nomeCompleto)} (${esc(ant.candidato.cargo)}, ${ant.candidato.ano}, ${esc(ant.candidato.partido)}). Fonte: TSE, votação por seção.</p></div></div>
    <div class="kpis">
      <div class="kpi vidro"><div class="lbl">${esc(nomeAnt)} em ${ant.candidato.ano}</div><div class="val">${int(ant.total)}</div><div class="sub">${pct(div(ant.total, ant.validos), 2)} dos válidos · ${int(Object.keys(ant.municipios).length)} municípios</div></div>
      <div class="kpi vidro destaque"><div class="lbl">${esc(nomeNovo)} agora (oficial)</div><div class="val">${int(c?.votos)}</div><div class="sub">${pct(c?.pct / 100, 2)} dos válidos</div></div>
      <div class="kpi vidro"><div class="lbl">Retenção nas cidades já apuradas</div><div class="val">${pct(div(novoComp, antComp), 0)}</div><div class="sub">${int(novoComp)} de ${int(antComp)} votos de ${ant.candidato.ano} · ${int(comparaveis.length)} cidades</div></div>
      <div class="kpi vidro"><div class="lbl">Cidades novas</div><div class="val">${int(linhas.filter(l => !l.ant && l.novo).length)}</div><div class="sub">com voto agora e sem voto em ${ant.candidato.ano}</div></div>
    </div>
    <div class="aviso"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>
      <span>Os cargos são diferentes (${esc(ant.candidato.cargo)} em ${ant.candidato.ano}, ${esc(NOME_CARGO[s.cargo])} agora). "Retenção" é quanto dos votos de ${ant.candidato.ano} reaparecem nas mesmas cidades; durante a apuração ela só considera as cidades com seções já apuradas.</span></div>`;

  const top = linhas.filter(l => l.ant > 0).sort((a, b) => b.ant - a.ant).slice(0, 15);
  html += `<div class="grid-2">
    <section class="card vidro"><h2>Principais redutos de ${ant.candidato.ano}</h2><p class="desc">As 15 cidades onde ${esc(nomeAnt)} teve mais votos, com a votação atual de ${esc(nomeNovo)}.</p>
      <div class="legend"><span><i style="width:10px;height:10px;border-radius:3px;background:${corAnt};display:inline-block"></i>${esc(nomeAnt)} ${ant.candidato.ano}</span><span><i style="width:10px;height:10px;border-radius:3px;background:${corNovo};display:inline-block"></i>${esc(nomeNovo)} 2026</span></div>
      <div id="hTop">${barras(top.map(l => ({rot: l.nome, mun: l.mun, valores: [{v: l.ant, cor: corAnt}, {v: l.novo, cor: corNovo}],
        extra: l.apurado ? `retenção ${pct(l.ret, 0)}` : "aguardando"})), {onclick: true})}</div></section>
    <section class="card vidro"><h2>Mapa da retenção</h2><p class="desc">Quanto dos votos de ${ant.candidato.ano} ${esc(nomeNovo)} já tem em cada cidade (só cidades apuradas).</p>
      <div class="escala" id="hEsc"></div><div class="mapa-c" id="hMapa" style="height:520px"></div></section>
  </div>
  <section class="card vidro"><h2>Cidade por cidade</h2>
    <div class="filtros"><div class="campo">${ICONE_BUSCA}<input id="hQ" type="search" placeholder="Filtrar cidade" value="${esc(HIST.est.q)}"></div>
      <button class="btn" id="hCsv">Baixar CSV</button></div>
    <div id="hTab"></div></section>`;
  $("#conteudo").insertAdjacentHTML("beforeend", html);
  $("#hTop").addEventListener("click", e => { const r = e.target.closest("[data-i]"); if (r) abrirMunicipio(top[r.dataset.i].mun); });

  const desenhar = () => {
    const q = norm(HIST.est.q);
    const t = tabela({est: HIST.est, linhas: linhas.filter(l => !q || norm(l.nome).includes(q)), onRow: l => abrirMunicipio(l.mun), cols: [
      {k: "nome", t: "Cidade", f: l => `<span class="forte">${esc(l.nome)}</span>`},
      {k: "ant", t: `${nomeAnt} ${ant.candidato.ano}`, n: 1, f: l => int(l.ant)},
      {k: "antPct", t: "% válidos", n: 1, f: l => pct(l.antPct, 2)},
      {k: "novo", t: `${nomeNovo} 2026`, n: 1, f: l => l.apurado ? int(l.novo) : "–"},
      {k: "novoPct", t: "% válidos", n: 1, f: l => l.apurado ? pct(l.novoPct, 2) : "–"},
      {k: "ret", t: "Retenção", n: 1, f: l => l.ret == null ? (l.ant ? "–" : "nova") : pct(l.ret, 0)},
    ]});
    $("#hTab").innerHTML = t.html; t.ligar($("#hTab"), desenhar);
  };
  desenhar();
  $("#hQ").addEventListener("input", e => { HIST.est.q = e.target.value; HIST.est.pag = 0; desenhar(); });
  $("#hCsv").addEventListener("click", () => baixarCSV(`comparacao_${ant.candidato.ano}.csv`,
    ["cidade", `${nomeAnt}_${ant.candidato.ano}`, "pct_validos_ant", `${nomeNovo}_2026`, "pct_validos_2026", "retencao"],
    linhas.map(l => [l.nome, l.ant, ((l.antPct || 0) * 100).toFixed(3), l.novo, ((l.novoPct || 0) * 100).toFixed(3), l.ret == null ? "" : (l.ret * 100).toFixed(1)])));

  // Mapa da retenção por município
  if (typeof L === "undefined") return;
  HIST.mapa?.remove();
  const m = HIST.mapa = L.map("hMapa", {preferCanvas: true, zoomSnap: 0.25, scrollWheelZoom: false});
  m.on("click", () => m.scrollWheelZoom.enable());
  m.fitBounds(caixaEstado(), {padding: [10, 10]});
  L.tileLayer(ESRI_CANVAS + "World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {maxZoom: 16, attribution: "Esri · TSE · IBGE"}).addTo(m);
  const porIbge = new Map(linhas.map(l => [String(S.muns.find(x => x.mun === l.mun)?.ibge), l]));
  const vals = linhas.filter(l => l.ret != null).map(l => Math.min(l.ret, 2));
  const q = quebras(vals);
  L.geoJSON(GEO, {
    style: f => {
      const l = porIbge.get(String(f.properties.codarea));
      const ok = l && l.ret != null;
      return {weight: 0.5, color: `rgba(${BRAND_RGB},0.3)`, fillOpacity: ok ? 0.85 : (l?.ant ? 0.3 : 0.06), fillColor: ok ? RAMPA[classe(Math.min(l.ret, 2), q)] : "#1d252e"};
    },
    onEachFeature: (f, lyr) => {
      const l = porIbge.get(String(f.properties.codarea));
      if (!l) return;
      lyr.bindTooltip(`<b>${esc(l.nome)}</b><br>${esc(nomeAnt)} ${ant.candidato.ano}: ${int(l.ant)}<br>${esc(nomeNovo)} 2026: ${l.apurado ? int(l.novo) : "aguardando"}${l.ret != null ? `<br>Retenção: ${pct(l.ret, 0)}` : ""}`, {sticky: true, className: "tip-l"});
      lyr.on("click", () => abrirMunicipio(l.mun));
    },
  }).addTo(m);
  $("#hEsc").innerHTML = escalaHTML(q, "Retenção (votos 2026 ÷ votos 2022)");
  setTimeout(() => m.invalidateSize(), 60);
}
