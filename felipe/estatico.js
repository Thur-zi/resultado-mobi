/* Versão final estática (sem servidor): responde as chamadas "api/..." dos painéis a partir dos arquivos gerados
   por scripts/gerar-estatico.mjs. Carregado antes de app.js só nas páginas da versão estática. */
"use strict";
(function () {
  const E = window.ESTATICO;
  const cache = new Map();
  const ler = (arq) => {
    if (!cache.has(arq)) cache.set(arq, fetch(E.base + arq).then((r) => { if (!r.ok) throw new Error(`${r.status} ${arq}`); return r.json(); }));
    const p = cache.get(arq);
    p.catch(() => cache.delete(arq));
    return p;
  };
  const nomesDe = async (cargo) => new Map((await ler("candidatos.json")).filter((c) => c.cargo === cargo).map((c) => [c.numero, c]));
  const pessoa = (nomes) => ([n, v]) => ({numero: n, votos: v, nomeUrna: nomes.get(n)?.nomeUrna || "", partido: nomes.get(n)?.partido || ""});
  const num = (v) => Number(String(v ?? "").replace(",", ".")) || 0;
  // Resultado oficial do TSE da cidade (o próprio TSE libera a leitura pelo navegador)
  async function oficialCidade(uf, mun, cargo) {
    const el = cargo === 1 ? 6257 : 6259;
    const u = `https://resultados.tse.jus.br/oficial/ele2026/${el}/dados/${uf}/${uf}${String(mun).padStart(5, "0")}-c${String(cargo).padStart(4, "0")}-e${String(el).padStart(6, "0")}-u.json`;
    const r = await fetch(u); if (!r.ok) throw new Error(r.status);
    return r.json();
  }

  window.apiEstatica = async function (caminho) {
    const [rota, qs] = caminho.replace(/^\.?\//, "").split("?");
    const q = new URLSearchParams(qs || "");
    const cargo = Number(q.get("cargo")), numero = Number(q.get("numero")), mun = Number(q.get("mun"));
    switch (rota) {
      case "api/status": return ler(`status-${E.slug}.json`);
      case "api/candidatos": return ler("candidatos.json");
      case "api/municipios": return ler("municipios.json");
      case "api/candidato": return ler(`cand/${cargo}-${numero}.json`);
      case "api/cadeiras": return ler(`cad/${cargo}-${numero}.json`);
      case "api/regioes": return (await ler(`reg/${cargo}-${numero}.json`))[q.get("nivel") === "imediata" ? "imediata" : "intermediaria"];
      case "api/historico": return ler(`historico/${q.get("id")}.json`);
      case "api/locais": return (await ler(`mun/${mun}.json`)).locais;
      case "api/limites": {
        try { return await ler(`limites/${mun}.json`); } catch { return {erro: "Limites de bairros não disponíveis para esta cidade na versão final"}; }
      }
      case "api/municipio": {
        const [m, nomes] = await Promise.all([ler(`mun/${mun}.json`), nomesDe(cargo)]);
        const todos = (m.ranking[cargo] || []).map(pessoa(nomes));
        const i = todos.findIndex((t) => t.numero === numero);
        let oficial = null, oficialCand = null;
        try {
          const of = await oficialCidade(E.uf, mun, cargo);
          oficial = {secoes: of.s, validos: num(of.v?.vv)};
          for (const a of of.carg?.[0]?.agr || []) for (const p of a.par || []) for (const c of p.cand || [])
            if (Number(c.n) === numero) oficialCand = {votos: num(c.vap), pct: num(c.pvapn || c.pvap)};
        } catch {}
        return {mun, nome: m.nome, oficial, oficialCand, posicao: i >= 0 ? i + 1 : null, comVoto: todos.length, top: todos.slice(0, 10)};
      }
      case "api/local": {
        const id = q.get("id");
        const mun_ = Number(id.split("-")[0]);
        const [m, sec, nomes] = await Promise.all([ler(`mun/${mun_}.json`), ler(`local/${id}.json`).catch(() => ({})), nomesDe(cargo)]);
        const secoes = (sec[cargo] || []).map(([zona, secao, comp, nominais, legenda, brancos, nulos, aptos, sv]) =>
          ({zona, secao, comp, nominais, legenda, brancos, nulos, aptos, votos: sv?.[numero] || 0}));
        return {local: m.locais.find((l) => l.id === id) || {id}, munNome: m.nome, secoes, top: (m.porLocal[id]?.[cargo] || []).slice(0, 10).map(pessoa(nomes))};
      }
      case "api/area": {
        const [m, nomes] = await Promise.all([ler(`mun/${mun}.json`), nomesDe(cargo)]);
        const soma = new Map();
        for (const par of String(q.get("locais") || "").split(",").filter(Boolean)) {
          for (const [n, v] of m.porLocal[`${mun}-${par}`]?.[cargo] || []) soma.set(n, (soma.get(n) || 0) + v);
        }
        const linhas = [...soma.entries()].sort((a, b) => b[1] - a[1]);
        const i = linhas.findIndex(([n]) => n === numero);
        return {comVoto: linhas.length, posicao: i >= 0 ? i + 1 : null, votos: i >= 0 ? linhas[i][1] : 0, top: linhas.slice(0, 15).map(pessoa(nomes))};
      }
    }
    throw new Error(`indisponível na versão final: ${rota}`);
  };
  // Candidatos com mapas prontos nesta versão (os do cliente e os mais votados de cada cargo)
  window.disponiveisEstatico = ler("disponiveis.json").then((l) => new Set(l.map((x) => `${x.cargo}-${x.numero}`))).catch(() => null);
})();
