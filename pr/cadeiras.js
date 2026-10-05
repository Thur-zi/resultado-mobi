/* Partidos e cadeiras: votação por partido/federação e projeção de cadeiras durante a apuração.
   Usa utilidades e estado globais de app.js. */
"use strict";

const CAD = {est: {ord: "cadeiras", dir: -1, q: "", pag: 0}};
const PROPORCIONAL = new Set([6, 7, 8, 13]);

async function viewCadeiras(s, c, d) {
  const main = $("#conteudo");
  if (!PROPORCIONAL.has(s.cargo)) return viewMajoritario(s, c);
  let r;
  try { r = await api(`api/cadeiras?cargo=${s.cargo}&numero=${s.numero}`); } catch { r = null; }
  if (!r?.agremiacoes?.length) { main.insertAdjacentHTML("beforeend", vazio("Projeção indisponível", "Aguardando o arquivo oficial do TSE.")); return; }
  const and = r.andamento || {};
  const pctAp = div(and.secoes?.totalizadas, and.secoes?.total);
  const comecou = (and.secoes?.totalizadas || 0) > 0;
  const minha = r.agremiacoes.find(a => a.id === r.agremiacaoCandidato);
  const eu = minha?.candidatos.find(x => x.numero === s.numero);
  const nome = titulo(c?.nomeUrna || "Candidato");
  const cor = corDe(s);

  // Margem: dentro → votos sobre o 1º suplente; fora → votos que faltam para o último eleito projetado
  let margem = "–", margemSub = "";
  if (minha && eu && comecou) {
    if (eu.projetado && minha.primeiroSuplente) {
      margem = `+${int(eu.votos - minha.primeiroSuplente.votos)}`;
      margemSub = `votos à frente do 1º suplente (${titulo(minha.primeiroSuplente.nome)})`;
    } else if (!eu.projetado && minha.ultimoEleito) {
      margem = `−${int(minha.ultimoEleito.votos - eu.votos + 1)}`;
      margemSub = `votos para passar ${titulo(minha.ultimoEleito.nome)}, último eleito projetado`;
    } else if (!eu.projetado) {
      margemSub = `${esc(minha.sigla)} ainda sem cadeira projetada`;
    }
  }
  const situacao = !comecou ? "Aguardando apuração" : eu?.projetado ? "Dentro da projeção" : "Fora da projeção";

  let h = `<div class="kpis">
    <div class="kpi vidro destaque"><div class="lbl">${esc(minha?.sigla || "Agremiação")}: cadeiras projetadas</div><div class="val">${comecou ? int(minha?.cadeiras) : "–"}</div>
      <div class="sub">${minha ? `${int(minha.qp)} pelo quociente + ${int(minha.sobras)} nas sobras` : ""}</div></div>
    <div class="kpi vidro"><div class="lbl">${esc(nome)} na lista</div><div class="val">${eu && comecou ? eu.posicao + "º" : "–"}</div>
      <div class="sub">${esc(situacao)}${minha ? ` · ${int(minha.candidatos.length)} candidatos` : ""}</div></div>
    <div class="kpi vidro"><div class="lbl">Margem</div><div class="val">${margem}</div><div class="sub">${esc(margemSub)}</div></div>
    <div class="kpi vidro"><div class="lbl">Quociente eleitoral</div><div class="val">${comecou ? int(r.qe) : "–"}</div>
      <div class="sub">${int(r.validos)} válidos ÷ ${int(r.vagas)} vagas</div></div>
    <div class="kpi vidro"><div class="lbl">Seções totalizadas</div><div class="val">${pct(pctAp, 1)}</div><div class="sub">${int(and.secoes?.totalizadas)} de ${int(and.secoes?.total)}</div></div>
  </div>
  <div class="aviso"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>
    <span>${r.fonte === "tse"
      ? `<b>Cadeiras conforme o cálculo do TSE</b> com os votos já totalizados (o arquivo oficial traz as vagas de cada agremiação). Quem entra: os mais votados de cada lista.`
      : `<b>Projeção</b> com os votos já totalizados pelo TSE, pelas regras atuais: quociente eleitoral e partidário, votação mínima de 10% do quociente, sobras para quem tem 80% do quociente (candidatos com 20%) e, por fim, maiores médias entre todos.`}
    Muda conforme a apuração avança; o resultado final é o do TSE ao fim da totalização. Federação conta como uma agremiação só.</span></div>`;

  // Cadeiras por agremiação
  const comCad = r.agremiacoes.filter(a => a.cadeiras > 0 || a.votos >= 0.5 * r.qe).slice(0, 20);
  h += `<div class="grid-2">
    <section class="card vidro"><h2>Cadeiras por partido / federação</h2><p class="desc">Votos (nominais + legenda) e cadeiras projetadas de cada agremiação.</p>
      <div id="cadBarras">${comecou ? barras(comCad.map(a => ({rot: a.sigla, sub: a.tipo === "Federação" ? "fed." : "", eu: a.id === r.agremiacaoCandidato,
        valores: [{v: a.votos, cor: a.id === r.agremiacaoCandidato ? cor : COR_OUTRO}],
        extra: `${a.cadeiras} ${a.cadeiras === 1 ? "cadeira" : "cadeiras"}`,
        tip: tipHTML(a.nome, [["Votos", int(a.votos)], ["% dos válidos", pct(div(a.votos, r.validos), 2)], ["Quociente partidário", int(a.qp)], ["Sobras", int(a.sobras)], ["Cadeiras", int(a.cadeiras)]])})))
        : `<div class="vazio-estado"><b>Aguardando a apuração</b>A projeção começa com as primeiras seções totalizadas.</div>`}</div></section>
    <section class="card vidro"><h2>Lista: ${esc(minha?.nome || "")}</h2><p class="desc">Candidatos ${minha?.tipo === "Federação" ? "da federação" : "do partido"} por votos. Em destaque, os que entram na projeção atual.</p>
      <div class="tbl-wrap"><table><thead><tr><th class="n">#</th><th>Candidato</th><th>Partido</th><th class="n">Votos</th><th>Projeção</th></tr></thead><tbody>
      ${(minha?.candidatos || []).slice(0, Math.max(12, (minha?.cadeiras || 0) + 5)).map(x => `<tr${x.numero === s.numero ? ` style="background:rgba(var(--cli-rgb,85,184,230),0.14)"` : ""}>
        <td class="n">${x.posicao}</td><td class="${x.numero === s.numero ? "forte" : ""}">${esc(titulo(x.nome))}</td><td>${esc(x.partido)}</td>
        <td class="n">${int(x.votos)}</td><td>${!comecou ? "" : x.projetado ? `<span class="tag">eleito</span>` : `<span class="tag cinza">suplente</span>`}</td></tr>`).join("")}
      </tbody></table></div>
      ${eu && eu.posicao > Math.max(12, (minha?.cadeiras || 0) + 5) ? `<p class="nota" style="margin-top:8px">${esc(nome)}: ${eu.posicao}º da lista, ${int(eu.votos)} votos.</p>` : ""}</section>
  </div>
  <section class="card vidro"><h2>Todas as agremiações</h2>
    <div class="filtros"><div class="campo">${ICONE_BUSCA}<input id="cadQ" type="search" placeholder="Filtrar partido ou federação" value="${esc(CAD.est.q)}"></div>
      <button class="btn" id="cadCsv">Baixar CSV</button></div><div id="cadTab"></div></section>`;
  main.insertAdjacentHTML("beforeend", h);

  const desenhar = () => {
    const q = norm(CAD.est.q);
    const linhas = r.agremiacoes.filter(a => !q || norm(a.nome).includes(q) || norm(a.sigla).includes(q)).map(a => ({...a, pctv: div(a.votos, r.validos)}));
    const t = tabela({est: CAD.est, linhas, cols: [
      {k: "sigla", t: "Agremiação", f: a => `<span class="forte"${a.id === r.agremiacaoCandidato ? ` style="color:var(--cli-texto,var(--brand))"` : ""}>${esc(a.sigla)}</span> <span class="nota">${esc(a.tipo)}</span>`},
      {k: "votos", t: "Votos", n: 1, f: a => int(a.votos)},
      {k: "pctv", t: "% válidos", n: 1, f: a => pct(a.pctv, 2)},
      {k: "legenda", t: "Legenda", n: 1, f: a => int(a.legenda)},
      {k: "qp", t: "Quociente", n: 1, f: a => int(a.qp)},
      {k: "sobras", t: "Sobras", n: 1, f: a => int(a.sobras)},
      {k: "cadeiras", t: "Cadeiras", n: 1, f: a => `<b>${int(a.cadeiras)}</b>`},
      {k: "ultimo", t: "Último eleito projetado", val: a => a.ultimoEleito?.votos || 0, f: a => a.ultimoEleito ? `${esc(titulo(a.ultimoEleito.nome))} <span class="nota">${int(a.ultimoEleito.votos)}</span>` : "–"},
    ]});
    $("#cadTab").innerHTML = t.html; t.ligar($("#cadTab"), desenhar);
  };
  desenhar();
  $("#cadQ").addEventListener("input", e => { CAD.est.q = e.target.value; CAD.est.pag = 0; desenhar(); });
  $("#cadCsv").addEventListener("click", () => baixarCSV(`cadeiras_${NOME_CARGO[s.cargo]}.csv`,
    ["agremiacao", "tipo", "votos", "pct_validos", "nominais", "legenda", "quociente_partidario", "sobras", "cadeiras_projetadas", "ultimo_eleito", "votos_ultimo"],
    r.agremiacoes.map(a => [a.nome, a.tipo, a.votos, ((div(a.votos, r.validos) || 0) * 100).toFixed(3), a.nominais, a.legenda, a.qp, a.sobras, a.cadeiras, a.ultimoEleito?.nome || "", a.ultimoEleito?.votos || ""])));
}

// Senado/Governo/Presidente: mais votados × vagas
function viewMajoritario(s, c) {
  const vagas = S.status?.cargos?.[s.cargo]?.vagas || 1;
  const lista = S.cands.filter(x => x.cargo === s.cargo).sort((a, b) => b.votos - a.votos).slice(0, 10);
  const comecou = lista.some(x => x.votos > 0);
  $("#conteudo").insertAdjacentHTML("beforeend", `<section class="card vidro"><h2>${esc(NOME_CARGO[s.cargo])}: ${vagas} ${vagas > 1 ? "vagas" : "vaga"}</h2>
    <p class="desc">Eleição majoritária: ${vagas > 1 ? `os ${vagas} mais votados são eleitos` : "o mais votado é eleito"} (o voto de partido não define cadeiras).</p>
    ${comecou ? barras(lista.map((x, i) => ({rot: `${i + 1}º ${titulo(x.nomeUrna)}`, sub: x.partido, eu: x.numero === s.numero,
      valores: [{v: x.votos, cor: x.numero === s.numero ? corDe(s) : COR_OUTRO}], extra: `${pct(x.pct / 100, 2)}${i < vagas ? " · dentro" : ""}`})))
      : `<div class="vazio-estado"><b>Aguardando a apuração</b></div>`}</section>`);
}
