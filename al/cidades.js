/* Mapas das cidades — vários mapas por município (BH em destaque) a partir das escolas apuradas.
   Usa as utilidades e o estado globais de app.js. */
"use strict";

const BH = 41238; // atalho fixo só faz sentido em MG; nos outros estados usa a capital
const ESRI_CANVAS = "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/";
const CID = {locais: new Map(), limites: new Map(), ter: new Map(), mapas: [], lista: []};

/* ---------- dados auxiliares (com cache) */
async function carregarMunicipios() { if (!S.muns.length) S.muns = await api("api/municipios"); }
async function locaisDaCidade(mun) {
  if (!CID.locais.has(mun)) CID.locais.set(mun, await api(`api/locais?mun=${mun}`));
  return CID.locais.get(mun);
}
async function limitesDaCidade(mun) {
  if (!CID.limites.has(mun)) {
    const r = await (window.apiEstatica ? window.apiEstatica(`api/limites?mun=${mun}`) : fetch(`api/limites?mun=${mun}`).then(r => r.json())).catch(e => ({erro: String(e)}));
    if (r.erro) return r; // não guarda erro: tenta de novo na próxima vez
    CID.limites.set(mun, r);
  }
  return CID.limites.get(mun);
}
async function malhaMunicipios() { if (!GEO) GEO = await fetch(`geo/${S.status?.uf || "mg"}.geojson`).then(r => r.json()); return GEO; }
const geomMunicipio = ibge => GEO?.features.find(f => String(f.properties.codarea) === String(ibge))?.geometry || null;

/* ---------- geometria */
// Limites do estado inteiro ([[lat, lng], [lat, lng]]) a partir da malha do IBGE
function caixaEstado() {
  if (!GEO) return [[-33.8, -73.9], [5.3, -34.8]];
  let b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const f of GEO.features) { const c = caixa(f.geometry); b = [Math.min(b[0], c[0]), Math.min(b[1], c[1]), Math.max(b[2], c[2]), Math.max(b[3], c[3])]; }
  return [[b[1], b[0]], [b[3], b[2]]];
}
function caixa(geom) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  for (const p of polys) for (const [x, y] of p[0]) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
}
function noAnel(x, y, anel) {
  let d = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const [xi, yi] = anel[i], [xj, yj] = anel[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}
function noPoligono(x, y, geom) {
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  return polys.some(p => noAnel(x, y, p[0]) && !p.slice(1).some(h => noAnel(x, y, h)));
}
// Soma votos/válidos dos locais dentro de cada área (bairro, regional)
function agregarPorArea(features, locais) {
  const areas = features.map(f => ({f, bb: caixa(f.geometry), votos: 0, validos: 0, eleitores: 0, locais: []}));
  for (const l of locais) {
    if (l.lat == null || l.aproximado) continue;
    const a = areas.find(a => l.lng >= a.bb[0] && l.lng <= a.bb[2] && l.lat >= a.bb[1] && l.lat <= a.bb[3] && noPoligono(l.lng, l.lat, a.f.geometry));
    if (!a) continue;
    a.votos += l.votos; a.validos += l.validos; a.eleitores += l.eleitores; a.aptos = (a.aptos || 0) + (l.aptos || 0); a.locais.push(l);
  }
  return areas;
}
// Território de cada escola: diagrama de Voronoi recortado pelo limite do município
function territorio(mun, locais, geomMun) {
  if (CID.ter.has(mun)) return CID.ter.get(mun);
  if (typeof d3 === "undefined" || typeof polygonClipping === "undefined" || !geomMun) return null;
  const grupos = new Map();
  for (const l of locais) {
    if (l.lat == null || l.aproximado) continue;
    const k = `${l.lat.toFixed(5)},${l.lng.toFixed(5)}`;
    if (!grupos.has(k)) grupos.set(k, {lat: l.lat, lng: l.lng, ids: []});
    grupos.get(k).ids.push(l.id);
  }
  const pts = [...grupos.values()];
  if (pts.length < 2) return null;
  const [x0, y0, x1, y1] = caixa(geomMun);
  const vor = d3.Delaunay.from(pts, p => p.lng, p => p.lat).voronoi([x0 - 0.05, y0 - 0.05, x1 + 0.05, y1 + 0.05]);
  const cells = pts.map((p, i) => {
    const anel = vor.cellPolygon(i);
    if (!anel) return null;
    try {
      const g = polygonClipping.intersection([anel], geomMun.coordinates);
      return g.length ? {...p, geom: g} : null;
    } catch { return null; }
  }).filter(Boolean);
  CID.ter.set(mun, cells);
  return cells;
}
function zonasDoTerritorio(mun, cells, porId) {
  const k = `z${mun}`;
  if (CID.ter.has(k)) return CID.ter.get(k);
  const grupos = new Map();
  for (const c of cells) {
    // célula com locais de mais de uma zona: fica com a zona de maior eleitorado
    const z = c.ids.map(id => porId.get(id)).sort((a, b) => b.eleitores - a.eleitores)[0]?.zona;
    if (!grupos.has(z)) grupos.set(z, []);
    grupos.get(z).push(c.geom);
  }
  const out = [...grupos.entries()].map(([zona, geoms]) => {
    try { return {zona, geom: polygonClipping.union(...geoms)}; } catch { return {zona, geom: geoms.flat()}; }
  });
  CID.ter.set(k, out);
  return out;
}

/* ---------- mapas Leaflet */
function limparMapas() { for (const m of CID.mapas) m.remove(); CID.mapas = []; }
function criarMapa(id, bounds) {
  const el = document.getElementById(id);
  if (!el || typeof L === "undefined") return null;
  const m = L.map(el, {preferCanvas: true, zoomSnap: 0.25, scrollWheelZoom: false});
  m.on("click", () => m.scrollWheelZoom.enable());
  m.on("mouseout", () => m.scrollWheelZoom.disable());
  const v = S.views[`cid${S.cidade}`];
  if (v) m.setView(v.c, v.z); else m.fitBounds(bounds, {padding: [8, 8]});
  const ESRI = "https://services.arcgisonline.com/ArcGIS/rest/services/";
  const escuro = L.layerGroup([
    L.tileLayer(ESRI_CANVAS + "World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {maxZoom: 19, maxNativeZoom: 16, attribution: "Esri · TSE · IBGE · OSM"}),
    L.tileLayer(ESRI_CANVAS + "World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}", {maxZoom: 19, maxNativeZoom: 16, pane: "shadowPane", opacity: 0.75}),
  ]).addTo(m);
  const ruas = L.tileLayer(ESRI + "World_Street_Map/MapServer/tile/{z}/{y}/{x}", {maxZoom: 19, attribution: "Esri · TSE · IBGE · OSM"});
  const satelite = L.layerGroup([
    L.tileLayer(ESRI + "World_Imagery/MapServer/tile/{z}/{y}/{x}", {maxZoom: 19, attribution: "Esri · Maxar · TSE · IBGE"}),
    L.tileLayer(ESRI + "Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {maxZoom: 19, pane: "shadowPane"}),
  ]);
  L.control.layers({"Escuro": escuro, "Ruas": ruas, "Satélite": satelite}, null, {position: "topright"}).addTo(m);
  // Tela cheia (o cartão do mapa ocupa a tela toda)
  const TelaCheia = L.Control.extend({onAdd() {
    const b = L.DomUtil.create("a", "leaflet-bar tela-cheia-btn");
    b.href = "#"; b.title = "Tela cheia"; b.setAttribute("role", "button");
    b.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>`;
    L.DomEvent.on(b, "click", e => {
      L.DomEvent.stop(e);
      const card = el.closest(".card");
      const ligado = card.classList.toggle("tela-cheia");
      document.body.classList.toggle("sem-rolagem", ligado);
      setTimeout(() => m.invalidateSize(), 80);
    });
    return b;
  }});
  new TelaCheia({position: "topleft"}).addTo(m);
  // Sincroniza: mexer num mapa da cidade move todos os outros
  const marcar = () => (m._usuario = true);
  ["mousedown", "wheel", "touchstart", "dblclick"].forEach(ev => el.addEventListener(ev, marcar, {passive: true}));
  m.on("moveend", () => {
    if (!m._usuario) return;
    m._usuario = false;
    const c = m.getCenter(), z = m.getZoom();
    S.views[`cid${S.cidade}`] = {c, z};
    for (const o of CID.mapas) if (o !== m) o.setView(c, z, {animate: false});
  });
  CID.mapas.push(m);
  setTimeout(() => m.invalidateSize(), 60);
  return m;
}
const corArea = (a, q) => a.validos > 0 ? RAMPA[classe(div(a.votos, a.validos), q)] : "#1d252e";
function estiloArea(a, q, borda = "rgba(207,230,243,0.35)") {
  return {weight: 0.8, color: borda, fillColor: corArea(a, q), fillOpacity: a.validos > 0 ? 0.82 : (a.locais?.length ? 0.35 : 0.08)};
}
function tipArea(nome, a, extra = "") {
  const f = apurado(a.aptos, a.eleitores);
  if (f != null) extra = `<br>${pct(f, 0)} apurado · falta ${pct(1 - f, 0)}` + extra;
  if (!a.validos) return `<b>${esc(nome)}</b><br><span style="opacity:.7">${a.locais?.length ? `${a.locais.length} escola(s), ainda sem boletim` : "Sem local de votação aqui"}</span>${extra}`;
  return `<b>${esc(nome)}</b><br>${int(a.votos)} votos · ${pct(div(a.votos, a.validos), 2)} dos válidos<br><span style="opacity:.7">${a.locais?.length || 0} escola(s)${extra}</span>`;
}
function camadaAreas(m, itens, q, onClick) {
  for (const it of itens) {
    const lyr = L.geoJSON({type: "Feature", geometry: it.geometry, properties: {}}, {style: () => estiloArea(it.a, q, it.borda)}).addTo(m);
    lyr.bindTooltip(tipArea(it.nome, it.a, it.extra || ""), {sticky: true, className: "tip-l"});
    lyr.on("mouseover", () => lyr.setStyle({weight: 2, color: "#fff"}));
    lyr.on("mouseout", () => lyr.setStyle(estiloArea(it.a, q, it.borda)));
    if (onClick) lyr.on("click", () => onClick(it));
  }
}
function contornoMunicipio(m, geom) {
  if (geom) L.geoJSON(geom, {style: {fill: false, weight: 1.6, color: `rgba(${BRAND_RGB},0.85)`}, interactive: false}).addTo(m);
}

/* ---------- gaveta: lista de escolas de uma área */
function abrirListaEscolas(trilha, titulo_, sub, locais, s) {
  const ord = locais.slice().sort((a, b) => b.votos - a.votos);
  const tot = ord.reduce((t, l) => ({v: t.v + l.votos, val: t.val + l.validos}), {v: 0, val: 0});
  abrirGaveta(trilha, `
    <span class="kicker">${esc(NOME_CARGO[s.cargo])} · ${esc(titulo(S.idx.get(chave(s))?.nomeUrna || "Candidato"))}</span>
    <h2>${esc(titulo_)}</h2><div class="sub">${esc(sub)}</div>
    <div class="kpis">
      <div class="kpi vidro destaque"><div class="lbl">Votos</div><div class="val">${int(tot.v)}</div><div class="sub">${pct(div(tot.v, tot.val), 2)} dos válidos</div></div>
      <div class="kpi vidro"><div class="lbl">Escolas</div><div class="val">${int(ord.length)}</div><div class="sub">${int(ord.filter(l => l.validos).length)} já apuradas</div></div>
      <div class="kpi vidro"><div class="lbl">Apurado</div><div class="val">${pct(apurado(ord.reduce((t, l) => t + (l.aptos || 0), 0), ord.reduce((t, l) => t + (l.eleitores || 0), 0)), 0)}</div><div class="sub">do eleitorado da área</div></div>
    </div>
    <h3>Mais votados nesta área (${esc(NOME_CARGO[s.cargo])})</h3><div id="areaTop"><p class="nota">Calculando…</p></div>
    <h3>Escolas</h3>
    <div class="lista-links">${ord.map(l => `<button data-local="${l.id}">${esc(titulo(l.nome))}<small>${l.validos ? `${int(l.votos)} votos · ${pct(div(l.votos, l.validos), 1)}` : "sem boletim ainda"}${l.bairro ? " · " + esc(titulo(l.bairro)) : ""}</small></button>`).join("") || `<p class="nota">Nenhuma escola.</p>`}</div>`, false);
  // ranking da área calculado no servidor (tarefa paralela)
  const mun = ord[0]?.mun, pares = ord.map(l => l.id.split("-").slice(1).join("-")).join(",");
  if (mun && pares) api(`api/area?cargo=${s.cargo}&numero=${s.numero}&mun=${mun}&locais=${pares}`)
    .then(r => { const el = document.getElementById("areaTop"); if (!el) return;
      el.innerHTML = r.top?.length ? `${r.posicao && r.posicao > r.top.length ? `<p class="nota">${esc(titulo(S.idx.get(chave(s))?.nomeUrna || "Candidato"))}: ${r.posicao}º, ${int(r.votos)} votos</p>` : ""}${topHTML(r.top, s)}`
        : `<p class="nota">Sem boletins apurados nesta área ainda.</p>`; })
    .catch(() => { const el = document.getElementById("areaTop"); if (el) el.innerHTML = `<p class="nota">Não foi possível calcular agora.</p>`; });
}

/* ---------- mini-mapas (galeria) */
function miniMapa(geom, pontos, cor) {
  if (!geom) return "";
  const [x0, y0, x1, y1] = caixa(geom);
  const kx = Math.cos(((y0 + y1) / 2) * Math.PI / 180);
  const W = 220, H = 150, pad = 6;
  const esc_ = Math.min((W - 2 * pad) / ((x1 - x0) * kx || 1), (H - 2 * pad) / ((y1 - y0) || 1));
  const ox = (W - (x1 - x0) * kx * esc_) / 2, oy = (H - (y1 - y0) * esc_) / 2;
  const P = (x, y) => [ox + (x - x0) * kx * esc_, oy + (y1 - y) * esc_];
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  const d = polys.map(p => p.map(r => "M" + r.map(([x, y]) => P(x, y).map(v => v.toFixed(1)).join(",")).join("L") + "Z").join("")).join("");
  const max = Math.max(1, ...pontos.map(p => p.votos));
  const pts = pontos.filter(p => p.lat != null && !p.aproximado).map(p => {
    const [x, y] = P(p.lng, p.lat);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(1.2 + 5 * Math.sqrt(p.votos / max)).toFixed(1)}" fill="${cor}" fill-opacity="0.8" stroke="#090d11" stroke-width="0.6"/>`;
  }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-hidden="true"><path d="${d}" fill="rgba(${BRAND_RGB},0.05)" stroke="rgba(${BRAND_RGB},0.55)" stroke-width="1" fill-rule="evenodd"/>${pts}</svg>`;
}

/* ---------- a aba */
async function viewCidades(s, c, d) {
  const token = (viewCidades.token = (viewCidades.token || 0) + 1);
  const atual = () => token === viewCidades.token;
  limparMapas();
  await Promise.all([carregarMunicipios(), malhaMunicipios()]);
  if (!atual()) return;
  // Cidade base: a definida para o cliente ou a capital (BH em MG)
  if (!S.cidade || !S.muns.some(m => m.mun === S.cidade)) {
    S.cidade = S.status?.cidadePadrao || S.status?.capital || S.muns.slice().sort((a, b) => b.eleitores - a.eleitores)[0].mun;
  }
  const mun = S.cidade;
  const info = S.muns.find(m => m.mun === mun) || {nome: String(mun)};
  const mv = d.municipios.find(x => x.mun === mun) || {votos: 0, validos: 0, secoes: 0};
  const porVoto = d.municipios.filter(x => x.votos > 0).sort((a, b) => b.votos - a.votos).map(x => x.mun);
  const porEleit = S.muns.slice().sort((a, b) => b.eleitores - a.eleitores).map(x => x.mun);
  const capital = S.status?.uf === "mg" ? BH : S.status?.capital;
  const atalhos = [...new Set([capital, ...(porVoto.length ? porVoto : porEleit)].filter(Boolean))].filter(k => S.muns.some(m => m.mun === k)).slice(0, 10);
  const nomeMun = k => titulo(S.muns.find(m => m.mun === k)?.nome || k);
  const ehBH = mun === BH;

  const cardMapa = (id, t, desc, cls = "") => `<section class="card vidro ${cls}" id="${id}-card"><h2>${t}</h2><p class="desc">${desc}</p>
    <div class="escala" id="${id}-esc"></div><div class="mapa-c" id="${id}"></div><p class="nota" id="${id}-nota" style="margin-top:8px"></p></section>`;

  $("#conteudo").insertAdjacentHTML("beforeend", `
    <section class="card vidro"><div class="filtros" style="margin:0">
      <div class="busca-global cid-busca"><div class="campo">${ICONE_BUSCA}
        <input id="cidBusca" type="search" placeholder="Digite a cidade…" value="${esc(titulo(info.nome))}" autocomplete="off" aria-label="Cidade"></div>
        <div class="resultados" id="cidRes" role="listbox"></div></div>
      <div class="grupo-seg" id="cidAtalhos">${atalhos.map(k => `<button data-mun="${k}" aria-pressed="${k === mun}">${esc(nomeMun(k))}</button>`).join("")}</div>
    </div></section>
    <div class="cabeca"><div><span class="kicker">Mapas da cidade</span><h1>${esc(titulo(info.nome))}</h1>
      <p>${int(info.eleitores)} eleitores · todos os mapas abaixo andam juntos: arraste ou dê zoom em um e os outros acompanham.
      Em cada mapa dá para trocar o fundo (escuro, ruas ou satélite) e abrir em tela cheia.</p></div></div>
    <div class="kpis" id="cidKpis">
      <div class="kpi vidro destaque"><div class="lbl">Votos na cidade</div><div class="val">${int(mv.votos)}</div><div class="sub">${pct(div(mv.votos, mv.validos), 2)} dos válidos</div></div>
      <div class="kpi vidro"><div class="lbl">Posição na cidade</div><div class="val" id="cidPos">–</div><div class="sub" id="cidPosSub">${esc(NOME_CARGO[s.cargo])}</div></div>
      <div class="kpi vidro"><div class="lbl">Apurado na cidade</div><div class="val" id="cidAp">–</div><div class="sub" id="cidApSub"></div><div class="sub" id="cidSecSub"></div></div>
      <div class="kpi vidro"><div class="lbl">Escolas com voto</div><div class="val" id="cidEsc">–</div><div class="sub" id="cidEscSub"></div></div>
    </div>
    <section class="card vidro"><div class="filtros" style="margin:0">
      <div class="campo" style="width:min(520px,100%)">${ICONE_BUSCA}<input id="endBusca" type="search" placeholder="Buscar escola, bairro ou endereço nesta cidade" autocomplete="off"></div>
      <span class="nota" id="endNota"></span></div></section>
    <div class="grid-mapas">
      ${cardMapa("mBai", "Bairros", "% dos válidos por bairro, somando as escolas que ficam em cada bairro. Clique para ver as escolas.", "largo")}
      ${cardMapa("mReg", ehBH ? "Regionais" : "Regiões", "% dos válidos por regional administrativa.")}
      ${cardMapa("mEsc", "Escolas", "Cada círculo é um local de votação: tamanho = votos, cor = % dos válidos.")}
      ${cardMapa("mCal", "Mancha de calor", "Concentração dos votos do candidato: quanto mais quente, mais votos na região.")}
      ${cardMapa("mTer", "Território de cada escola", "A cidade dividida pela escola mais próxima: mostra a mancha de voto contínua.")}
      ${cardMapa("mZon", "Zonas eleitorais", "Área aproximada de cada zona (união dos territórios das suas escolas).")}
    </div>
    <div class="grid-2">
      <section class="card vidro"><h2>Bairros com mais votos</h2><p class="desc">Pelo bairro cadastrado de cada escola no TSE.</p><div id="cidBaiTop"></div></section>
      <section class="card vidro"><h2>Zonas eleitorais</h2><p class="desc">Votos, % dos válidos e quanto da zona já foi apurado.</p><div id="cidZonTop"></div></section>
    </div>
    <section class="card vidro"><h2>Andamento da apuração por bairro</h2>
      <p class="desc">Quanto do eleitorado de cada bairro já está em boletins publicados pelo TSE (bairro cadastrado das escolas; maiores bairros primeiro).</p>
      <div id="cidAnd"></div></section>
    <section class="card vidro"><h2>Mapas das maiores cidades</h2><p class="desc">${porVoto.length ? "As 24 cidades onde o candidato tem mais votos." : "As 24 maiores cidades por eleitorado."} Clique para abrir os mapas da cidade.</p>
      <div class="galeria" id="cidGaleria"></div></section>`);

  ligarBuscaCidade();
  $("#cidAtalhos").addEventListener("click", e => { const b = e.target.closest("[data-mun]"); if (b) trocarCidade(Number(b.dataset.mun)); });

  // Galeria
  const galeria = (porVoto.length ? porVoto : porEleit).slice(0, 24);
  const porMunVoto = new Map(d.municipios.map(m => [m.mun, m]));
  $("#cidGaleria").innerHTML = galeria.map(k => {
    const info_ = S.muns.find(m => m.mun === k), m = porMunVoto.get(k);
    return `<button class="mini vidro" data-mun="${k}" aria-pressed="${k === mun}">
      ${miniMapa(geomMunicipio(info_?.ibge), d.locais.filter(l => l.mun === k && l.votos > 0), corDe(s))}
      <b>${esc(titulo(info_?.nome))}</b><small>${m?.votos ? `${int(m.votos)} votos · ${pct(div(m.votos, m.validos), 1)}` : `${int(info_?.eleitores)} eleitores`}</small></button>`;
  }).join("");
  $("#cidGaleria").addEventListener("click", e => { const b = e.target.closest("[data-mun]"); if (b) { trocarCidade(Number(b.dataset.mun)); scrollTo({top: 0, behavior: "smooth"}); } });

  // Posição na cidade (assíncrono)
  api(`api/municipio?mun=${mun}&cargo=${s.cargo}&numero=${s.numero}`).then(r => {
    if (!atual()) return;
    $("#cidPos").textContent = r.posicao ? `${r.posicao}º` : "–";
    $("#cidPosSub").textContent = r.posicao ? `de ${int(r.comVoto)} com voto · ${NOME_CARGO[s.cargo]}` : NOME_CARGO[s.cargo];
    if (r.oficial?.secoes) $("#cidSecSub").textContent = `TSE: ${r.oficial.secoes.pst}% totalizadas`;
  }).catch(() => {});

  // Escolas da cidade (todas) + votos do candidato
  const todos = await locaisDaCidade(mun);
  if (!atual()) return;
  const votosPorId = new Map(d.locais.map(l => [l.id, l]));
  const locais = todos.map(l => ({...l, mun, munNome: info.nome, votos: votosPorId.get(l.id)?.votos || 0, validos: votosPorId.get(l.id)?.validos || 0,
    secoesAp: votosPorId.get(l.id)?.secoes || 0, aptos: votosPorId.get(l.id)?.aptos || 0}));
  // % apurada da cidade (eleitorado das seções com boletim ÷ eleitorado total)
  const apCid = apurado(locais.reduce((t, l) => t + l.aptos, 0), locais.reduce((t, l) => t + l.eleitores, 0));
  $("#cidAp").textContent = apCid == null ? "–" : pct(apCid, 0);
  $("#cidApSub").textContent = apCid == null ? "" : `falta ${pct(1 - apCid, 0)} · ${int(mv.secoes)} seções`;
  const porId = new Map(locais.map(l => [l.id, l]));
  $("#cidEsc").textContent = int(locais.filter(l => l.votos > 0).length);
  $("#cidEscSub").textContent = `de ${int(locais.length)} locais de votação`;

  const geomMun = geomMunicipio(info.ibge);
  const comPos = locais.filter(l => l.lat != null);
  const bounds = geomMun ? (() => { const [x0, y0, x1, y1] = caixa(geomMun); return [[y0, x0], [y1, x1]]; })()
    : comPos.length ? comPos.map(l => [l.lat, l.lng]) : caixaEstado();
  const aprox = locais.filter(l => l.aproximado).length;

  // 1) Escolas
  {
    const m = criarMapa("mEsc", bounds);
    if (m) {
      contornoMunicipio(m, geomMun);
      const max = Math.max(1, ...locais.map(l => l.votos));
      const q = quebras(locais.filter(l => l.validos).map(l => div(l.votos, l.validos)));
      for (const l of comPos.slice().sort((a, b) => a.votos - b.votos)) {
        const p = div(l.votos, l.validos);
        const mk = L.circleMarker([l.lat, l.lng], {radius: l.votos ? 2.5 + 9 * Math.sqrt(l.votos / max) : 2.5, weight: 1, color: "#090d11",
          fillColor: l.validos ? RAMPA[classe(p, q)] : "#4a525b", fillOpacity: l.validos ? 0.92 : 0.6}).addTo(m);
        mk.bindTooltip(`<b>${esc(titulo(l.nome))}</b>${l.bairro ? "<br>" + esc(titulo(l.bairro)) : ""}<br>${l.validos ? `${int(l.votos)} votos · ${pct(p, 2)} dos válidos` : "sem boletim ainda"}<br><span style="opacity:.7">Zona ${l.zona} · ${pct(apurado(l.aptos, l.eleitores), 0)} apurado${l.aproximado ? " · posição aproximada" : ""}</span>`, {className: "tip-l"});
        mk.on("click", () => abrirLocal(l.id));
      }
      $("#mEsc-esc").innerHTML = escalaHTML(q, "% dos válidos");
      if (aprox) $("#mEsc-nota").textContent = `${aprox} local(is) sem coordenada confiável no cadastro do TSE aparecem no centro da cidade.`;
    }
  }

  // Mancha de calor (votos por escola)
  {
    const pts = comPos.filter(l => l.votos > 0 && !l.aproximado);
    const m = criarMapa("mCal", bounds);
    if (m) {
      contornoMunicipio(m, geomMun);
      if (typeof L.heatLayer === "function" && pts.length) {
        const max = Math.max(...pts.map(l => l.votos));
        L.heatLayer(pts.map(l => [l.lat, l.lng, l.votos / max]), {radius: 28, blur: 22, maxZoom: 15, minOpacity: 0.25,
          gradient: {0.2: RAMPA[1], 0.45: RAMPA[2], 0.7: RAMPA[3], 1: RAMPA[4]}}).addTo(m);
      } else $("#mCal-nota").textContent = "A mancha aparece quando chegarem os primeiros boletins desta cidade.";
    }
  }
  ligarBuscaEndereco(info, locais);

  // 2) Território + 5) Zonas
  const cells = territorio(mun, locais, geomMun);
  if (cells) {
    const itens = cells.map(cel => {
      const ls = cel.ids.map(id => porId.get(id));
      const a = {votos: ls.reduce((t, l) => t + l.votos, 0), validos: ls.reduce((t, l) => t + l.validos, 0), locais: ls,
        aptos: ls.reduce((t, l) => t + l.aptos, 0), eleitores: ls.reduce((t, l) => t + l.eleitores, 0)};
      return {geometry: {type: "MultiPolygon", coordinates: cel.geom}, a, nome: ls.map(l => titulo(l.nome)).join(" / "), borda: "rgba(207,230,243,0.18)"};
    });
    const q = quebras(itens.filter(i => i.a.validos).map(i => div(i.a.votos, i.a.validos)));
    const m = criarMapa("mTer", bounds);
    if (m) {
      camadaAreas(m, itens, q, it => it.a.locais.length === 1 ? abrirLocal(it.a.locais[0].id)
        : abrirListaEscolas(`Território · ${titulo(info.nome)}`, it.nome, "Locais no mesmo endereço", it.a.locais, s));
      contornoMunicipio(m, geomMun);
      $("#mTer-esc").innerHTML = escalaHTML(q, "% dos válidos");
    }
    const zonas = zonasDoTerritorio(mun, cells, porId);
    const zItens = zonas.map(z => {
      const ls = locais.filter(l => l.zona === z.zona);
      return {geometry: {type: "MultiPolygon", coordinates: z.geom}, nome: `Zona ${z.zona}`,
        a: {votos: ls.reduce((t, l) => t + l.votos, 0), validos: ls.reduce((t, l) => t + l.validos, 0), locais: ls,
          aptos: ls.reduce((t, l) => t + l.aptos, 0), eleitores: ls.reduce((t, l) => t + l.eleitores, 0)}, zona: z.zona};
    });
    const qz = quebras(zItens.filter(i => i.a.validos).map(i => div(i.a.votos, i.a.validos)));
    const mz = criarMapa("mZon", bounds);
    if (mz) {
      camadaAreas(mz, zItens, qz, it => abrirListaEscolas(`Zona · ${titulo(info.nome)}`, it.nome, titulo(info.nome), it.a.locais, s));
      contornoMunicipio(mz, geomMun);
      for (const it of zItens) {
        const c_ = L.geoJSON(it.geometry).getBounds().getCenter();
        L.marker(c_, {interactive: false, icon: L.divIcon({className: "rot-zona", html: `${it.zona}`, iconSize: null})}).addTo(mz);
      }
      $("#mZon-esc").innerHTML = escalaHTML(qz, "% dos válidos");
      if (zItens.length < 2) $("#mZon-nota").textContent = "A cidade tem uma só zona eleitoral.";
    }
  } else {
    for (const id of ["mTer", "mZon"]) { $(`#${id}`).remove(); $(`#${id}-nota`).textContent = "Sem escolas suficientes com localização para desenhar este mapa."; }
  }

  // Barras: bairros (cadastro do TSE) e zonas
  const porBairro = new Map();
  for (const l of locais) {
    const k = titulo(String(l.bairro || "Sem bairro").trim());
    const o = porBairro.get(k) || porBairro.set(k, {rot: k, votos: 0, validos: 0, aptos: 0, eleitores: 0, locais: []}).get(k);
    o.votos += l.votos; o.validos += l.validos; o.aptos += l.aptos; o.eleitores += l.eleitores; o.locais.push(l);
  }
  const bTop = [...porBairro.values()].filter(b => b.votos > 0).sort((a, b) => b.votos - a.votos).slice(0, 15);
  $("#cidBaiTop").innerHTML = bTop.length ? barras(bTop.map(b => ({rot: b.rot, valores: [{v: b.votos, cor: corDe(s)}], extra: pct(div(b.votos, b.validos), 1)})), {onclick: true})
    : `<div class="vazio-estado"><b>Ainda sem boletins</b>Aparece com as primeiras seções da cidade.</div>`;
  // Andamento da apuração por bairro (maiores bairros em eleitorado primeiro)
  const andamento = [...porBairro.values()].filter(b => b.eleitores > 0).sort((a, b) => b.eleitores - a.eleitores).slice(0, 30);
  $("#cidAnd").innerHTML = barras(andamento.map(b => { const f = apurado(b.aptos, b.eleitores) || 0;
    return {rot: b.rot, valores: [{v: f, cor: CORES[0], txt: pct(f, 0)}], extra: `falta ${pct(1 - f, 0)} · ${int(b.eleitores)} eleitores`}; }), {max: 1, onclick: true});
  $("#cidAnd").addEventListener("click", e => { const r = e.target.closest("[data-i]"); if (r) { const b = andamento[r.dataset.i]; abrirListaEscolas(`Bairro · ${titulo(info.nome)}`, b.rot, titulo(info.nome), b.locais, s); } });
  $("#cidBaiTop").addEventListener("click", e => { const r = e.target.closest("[data-i]"); if (r) { const b = bTop[r.dataset.i]; abrirListaEscolas(`Bairro · ${titulo(info.nome)}`, b.rot, titulo(info.nome), b.locais, s); } });
  const zMap = new Map();
  for (const l of locais) { const o = zMap.get(l.zona) || zMap.set(l.zona, {zona: l.zona, votos: 0, validos: 0, aptos: 0, eleitores: 0, locais: []}).get(l.zona); o.votos += l.votos; o.validos += l.validos; o.aptos += l.aptos; o.eleitores += l.eleitores; o.locais.push(l); }
  const zTop = [...zMap.values()].sort((a, b) => b.votos - a.votos || a.zona - b.zona);
  $("#cidZonTop").innerHTML = barras(zTop.map(z => ({rot: `Zona ${z.zona}`, sub: `${z.locais.length} escolas`, valores: [{v: z.votos, cor: corDe(s)}], extra: `${z.validos ? pct(div(z.votos, z.validos), 1) : "–"} · ${pct(apurado(z.aptos, z.eleitores), 0)} apurado`})), {onclick: true});
  $("#cidZonTop").addEventListener("click", e => { const r = e.target.closest("[data-i]"); if (r) { const z = zTop[r.dataset.i]; abrirListaEscolas(`Zona · ${titulo(info.nome)}`, `Zona ${z.zona}`, titulo(info.nome), z.locais, s); } });

  // 3) Bairros e 4) Regionais (OpenStreetMap; pode demorar na primeira vez de uma cidade)
  for (const id of ["mBai", "mReg"]) $(`#${id}-nota`).textContent = "Carregando limites do OpenStreetMap…";
  const lim = await limitesDaCidade(mun);
  if (!atual()) return;
  const desenharAreas = (id, fc, rotulo) => {
    if (!fc?.features?.length) {
      $(`#${id}`)?.remove();
      $(`#${id}-nota`).textContent = lim.erro ? `Não deu para carregar agora (${lim.erro}). Tente de novo em instantes.`
        : `O OpenStreetMap não tem os limites de ${rotulo} desta cidade.`;
      if (id === "mReg" && !lim.erro) $(`#${id}-card`).classList.add("oculto");
      return;
    }
    const areas = agregarPorArea(fc.features, locais);
    const q = quebras(areas.filter(a => a.validos).map(a => div(a.votos, a.validos)));
    const m = criarMapa(id, bounds);
    if (!m) return;
    camadaAreas(m, areas.map(a => ({geometry: a.f.geometry, nome: a.f.properties.nome, a})), q,
      it => abrirListaEscolas(`${rotulo === "bairros" ? "Bairro" : "Regional"} · ${titulo(info.nome)}`, it.nome, titulo(info.nome), it.a.locais, s));
    contornoMunicipio(m, geomMun);
    $(`#${id}-esc`).innerHTML = escalaHTML(q, "% dos válidos");
    const semEscola = areas.filter(a => !a.locais.length).length;
    $(`#${id}-nota`).textContent = `${fc.features.length} ${rotulo} (limites: OpenStreetMap).` +
      (semEscola ? ` ${semEscola} sem local de votação ficam quase transparentes: quem mora ali vota em escola de bairro vizinho.` : "");
  };
  // Cidades sem bairros no OSM (ex.: São Paulo) mas com distritos: usa os distritos no mapa principal
  let bai = lim.bairros, reg = lim.regioes;
  if ((bai?.features?.length || 0) < 20 && (reg?.features?.length || 0) > (bai?.features?.length || 0)) {
    bai = reg; reg = null;
    const h2 = $("#mBai-card h2"); if (h2) h2.textContent = "Distritos";
    desenharAreas("mBai", bai, "distritos");
    $("#mReg-card")?.classList.add("oculto");
  } else {
    desenharAreas("mBai", bai, "bairros");
    desenharAreas("mReg", reg, ehBH ? "regionais" : "regiões");
  }
}

function trocarCidade(mun) {
  S.cidade = mun; lsSet("apu.cidade", String(mun));
  render();
}

/* ---------- campo de cidade com digitação */
function ligarBuscaCidade() {
  const inp = $("#cidBusca"), res = $("#cidRes");
  const lista = () => {
    const q = norm(inp.value.trim());
    const base = S.muns.slice().sort((a, b) => b.eleitores - a.eleitores);
    const achados = (q ? base.filter(m => norm(m.nome).includes(q)).sort((a, b) => norm(a.nome).indexOf(q) - norm(b.nome).indexOf(q) || b.eleitores - a.eleitores) : base).slice(0, 40);
    res.innerHTML = achados.map(m => `<button data-mun="${m.mun}"><span>${esc(titulo(m.nome))}</span><small>${int(m.eleitores)} eleitores</small></button>`).join("")
      || `<div class="vazio">Nenhuma cidade encontrada</div>`;
    res.classList.add("aberto");
  };
  inp.addEventListener("focus", () => { inp.select(); lista(); });
  inp.addEventListener("input", lista);
  inp.addEventListener("keydown", e => {
    if (e.key === "Enter") { const b = res.querySelector("button[data-mun]"); if (b) trocarCidade(Number(b.dataset.mun)); }
    if (e.key === "Escape") { res.classList.remove("aberto"); inp.blur(); }
  });
  res.addEventListener("mousedown", e => { const b = e.target.closest("button[data-mun]"); if (b) { e.preventDefault(); trocarCidade(Number(b.dataset.mun)); } });
  document.addEventListener("click", e => { if (!e.target.closest(".cid-busca")) res.classList.remove("aberto"); });
}

/* ---------- busca de escola / bairro / endereço (escolas do TSE primeiro; depois OpenStreetMap/Nominatim) */
let marcadorBusca = null;
function irPara(lat, lng, z, rotulo) {
  S.views[`cid${S.cidade}`] = {c: L.latLng(lat, lng), z};
  for (const m of CID.mapas) m.setView([lat, lng], z, {animate: false});
  const m0 = CID.mapas[0];
  if (m0) { marcadorBusca?.remove(); marcadorBusca = L.marker([lat, lng]).addTo(m0).bindTooltip(esc(rotulo), {className: "tip-l"}); }
  $("#mBai-card")?.scrollIntoView({behavior: "smooth", block: "start"});
}
function ligarBuscaEndereco(info, locais) {
  const inp = $("#endBusca"), nota = $("#endNota");
  if (!inp) return;
  inp.addEventListener("keydown", async e => {
    if (e.key !== "Enter") return;
    const q = inp.value.trim(); if (!q) return;
    const nq = norm(q);
    const esc_ = locais.find(l => l.lat != null && norm(l.nome).includes(nq));
    if (esc_) { nota.textContent = `Escola: ${titulo(esc_.nome)}`; return irPara(esc_.lat, esc_.lng, 17, titulo(esc_.nome)); }
    const bai = locais.filter(l => l.lat != null && !l.aproximado && norm(l.bairro) === nq);
    if (bai.length) {
      const lat = bai.reduce((t, l) => t + l.lat, 0) / bai.length, lng = bai.reduce((t, l) => t + l.lng, 0) / bai.length;
      nota.textContent = `Bairro ${titulo(q)}: ${bai.length} escola(s)`; return irPara(lat, lng, 15, titulo(q));
    }
    nota.textContent = "Buscando endereço…";
    try {
      const uf = (S.status?.uf || "").toUpperCase();
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(`${q}, ${titulo(info.nome)}, ${uf}`)}`, {headers: {"Accept-Language": "pt-BR"}}).then(r => r.json());
      if (!r[0]) { nota.textContent = "Não encontrado. Tente o nome da rua ou do bairro."; return; }
      nota.textContent = r[0].display_name.split(",").slice(0, 3).join(",");
      irPara(Number(r[0].lat), Number(r[0].lon), 16, q);
    } catch { nota.textContent = "Busca de endereço indisponível agora."; }
  });
}
