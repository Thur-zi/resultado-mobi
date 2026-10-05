/* Versão final estática (sem servidor): responde as chamadas "api/..." dos painéis a partir dos arquivos gerados
   por scripts/gerar-estatico.mjs (dados/<uf>/p/), somando no navegador os votos de qualquer candidato do estado
   seção por seção, como o servidor fazia. Carregado antes de app.js só nas páginas da versão estática. */
"use strict";
(function () {
  const E = window.ESTATICO;
  const cache = new Map();
  const buscar = (arq, tipo) => {
    if (!cache.has(arq)) cache.set(arq, fetch(E.base + arq).then((r) => { if (!r.ok) throw new Error(`${r.status} ${arq}`); return r[tipo](); }));
    const p = cache.get(arq);
    p.catch(() => cache.delete(arq));
    return p;
  };
  const ler = (arq) => buscar(arq, "json");
  const memo = new Map();
  const uma = (k, fn) => { if (!memo.has(k)) { const p = fn(); memo.set(k, p); p.catch(() => memo.delete(k)); } return memo.get(k); };
  const num = (v) => Number(String(v ?? "").replace(",", ".")) || 0;

  // Base do estado: seções com boletim, locais de votação, municípios e eleitorado por município/zona
  const base = () => uma("base", async () => {
    const [sec, locais, muns] = await Promise.all([ler("secoes.json"), ler("locais.json"), ler("municipios.json")]);
    const MUN = new Map(muns.map((m) => [m.mun, m]));
    const idx = new Map(locais.map((l, i) => [l[0], i]));
    const eleZona = new Map();
    for (let i = 0; i < sec.n; i++) eleZona.set(locais[i][8], (eleZona.get(locais[i][8]) || 0) + locais[i][6]);
    const munSec = Int32Array.from(sec.l, (l) => locais[l][9]);
    // seções de cada local (para a gaveta da escola)
    const secLocal = new Map();
    sec.l.forEach((l, i) => { let a = secLocal.get(l); if (!a) secLocal.set(l, (a = [])); a.push(i); });
    return {...sec, locais, MUN, idx, eleZona, munSec, secLocal};
  });
  const totais = (cargo) => ler(`tot-${cargo}.json`);
  // votos de um candidato por seção: texto compacto (pares salto de seção / votos, base 47) -> [índices, votos]
  const votosCand = (cargo, numero) => uma(`v${cargo}-${numero}`, async () => {
    let t = "";
    try { t = await buscar(`c/${cargo}/${numero}.txt`, "text"); } catch {} // sem arquivo = sem votos
    const is = [], qs = [];
    let v = 0, par = 0, ant = 0;
    for (let k = 0; k < t.length; k++) {
      const c = t.charCodeAt(k);
      if (c >= 80) { v = v * 47 + c - 80; continue; }
      v = v * 47 + c - 33;
      if (par === 0) { ant += v; is.push(ant); } else qs.push(v);
      par ^= 1; v = 0;
    }
    return {is, qs};
  });
  const nomesDe = async (cargo) => new Map((await ler("candidatos.json")).filter((c) => c.cargo === cargo).map((c) => [c.numero, c]));
  const pessoa = (nomes) => ([n, v]) => ({numero: n, votos: v, nomeUrna: nomes.get(n)?.nomeUrna || "", partido: nomes.get(n)?.partido || ""});

  // Pacote dos mapas de um candidato (igual a /api/candidato do servidor)
  const candidato = (cargo, numero) => uma(`c${cargo}-${numero}`, async () => {
    const [B, T, V, cands, st] = await Promise.all([base(), totais(cargo), votosCand(cargo, numero), ler("candidatos.json"), ler(`status-${E.slug}.json`)]);
    const votos = new Map(V.is.map((i, k) => [i, V.qs[k]]));
    const mun = new Map(), zon = new Map(), loc = new Map();
    let total = 0, validos = 0, comp = 0, aptos = 0, secoes = 0, comVoto = 0;
    const add = (m, k, ini, i, v, val) => {
      let o = m.get(k);
      if (!o) m.set(k, (o = {...ini, votos: 0, validos: 0, comp: 0, aptos: 0, secoes: 0, partido: 0}));
      o.votos += v; o.validos += val; o.comp += T[0][i]; o.aptos += B.a[i]; o.secoes++;
    };
    for (let i = 0; i < B.z.length; i++) {
      if (T[0][i] < 0) continue;
      const v = votos.get(i) || 0, val = T[1][i] + T[2][i], m = B.munSec[i];
      total += v; validos += val; comp += T[0][i]; aptos += B.a[i]; secoes++;
      if (v) comVoto++;
      add(mun, m, {mun: m}, i, v, val);
      add(zon, B.z[i], {zona: B.z[i], mun: m}, i, v, val);
      add(loc, B.l[i], {id: B.locais[B.l[i]][0]}, i, v, val);
    }
    const municipios = [...mun.values()].map((o) => ({...o, nome: B.MUN.get(o.mun)?.nome, ibge: B.MUN.get(o.mun)?.ibge, eleitores: B.MUN.get(o.mun)?.eleitores || 0}));
    const zonas = [...zon.values()].map((o) => ({...o, munNome: B.MUN.get(o.mun)?.nome, eleitores: B.eleZona.get(o.zona) || 0}));
    const locais = [...loc.entries()].map(([li, o]) => {
      const [, nome, bairro, endereco, lat, lng, eleitores, aprox, , m] = B.locais[li];
      return {...o, eleitores, nome, bairro, endereco, lat, lng, aproximado: !!aprox, mun: m, munNome: B.MUN.get(m)?.nome};
    });
    const {nome: _, ...oficial} = st.cargos?.[cargo] || {};
    return {cand: cands.find((c) => c.cargo === cargo && c.numero === numero) || null, oficial: st.cargos?.[cargo] ? oficial : null,
      apurado: {votos: total, validos, comp, aptos, secoes, secoesComVoto: comVoto, votosPartido: 0}, municipios, zonas, locais};
  });

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
      case "api/candidato": return candidato(cargo, numero);
      case "api/historico": return ler(`historico/${q.get("id")}.json`);
      case "api/cadeiras": {
        // lista completa só da agremiação do candidato; nas outras, eleitos projetados + 3 (como o servidor)
        const r = await ler(`cad-${cargo}.json`);
        const meu = r.agremiacoes.find((a) => a.candidatos.some((x) => x.numero === numero));
        return {...r, agremiacaoCandidato: meu?.id || null, agremiacoes: r.agremiacoes.map((a) => a === meu ? a : {...a, candidatos: a.candidatos.slice(0, a.cadeiras + 3)})};
      }
      case "api/regioes": {
        const [B, R, V, nomes] = await Promise.all([base(), ler(`reg-${cargo}.json`), votosCand(cargo, numero), nomesDe(cargo)]);
        const porMun = new Map();
        V.is.forEach((i, k) => porMun.set(B.munSec[i], (porMun.get(B.munSec[i]) || 0) + V.qs[k]));
        return (R[q.get("nivel") === "imediata" ? "imediata" : "intermediaria"] || []).map((r) => {
          const votos = r.municipios.reduce((t, m) => t + (porMun.get(m) || 0), 0);
          return {id: r.id, nome: r.nome, validos: r.validos, aptos: r.aptos, eleitores: r.eleitores, municipios: r.municipios,
            comVoto: r.votos.length, posicao: votos > 0 ? 1 + r.votos.filter((x) => x > votos).length : null, votos, top: r.top.map(pessoa(nomes))};
        });
      }
      case "api/locais": {
        const B = await base();
        return B.locais.slice(0, B.n).filter((l) => l[9] === mun)
          .map(([id, nome, bairro, , lat, lng, eleitores, aprox, zona]) => ({id, zona, nome, bairro, lat, lng, eleitores, aproximado: !!aprox}));
      }
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
        const [B, T, V, nomes] = await Promise.all([base(), totais(cargo), votosCand(cargo, numero), nomesDe(cargo)]);
        const li = B.idx.get(id), l = B.locais[li];
        const m = await ler(`mun/${l ? l[9] : Number(id.split("-")[0])}.json`).catch(() => ({porLocal: {}}));
        const votos = new Map(V.is.map((i, k) => [i, V.qs[k]]));
        const secoes = (B.secLocal.get(li) || []).filter((i) => T[0][i] >= 0).sort((a, b) => B.s[a] - B.s[b])
          .map((i) => ({zona: B.z[i], secao: B.s[i], comp: T[0][i], nominais: T[1][i], legenda: T[2][i], brancos: T[3][i], nulos: T[4][i], aptos: B.a[i], votos: votos.get(i) || 0}));
        const local = l && li < B.n ? {id, mun: l[9], zona: l[8], local: Number(id.split("-")[2]), nome: l[1], endereco: l[3], bairro: l[2], lat: l[4], lng: l[5],
          eleitores: l[6], ...(l[7] ? {aproximado: true} : {})} : {id};
        return {local, munNome: B.MUN.get(l ? l[9] : Number(id.split("-")[0]))?.nome, secoes, top: (m.porLocal[id]?.[cargo] || []).slice(0, 10).map(pessoa(nomes))};
      }
      case "api/area": {
        // votos do candidato exatos (seção por seção); ranking da área pelos mais votados de cada escola
        const [B, V, m, nomes] = await Promise.all([base(), votosCand(cargo, numero), ler(`mun/${mun}.json`), nomesDe(cargo)]);
        const ids = String(q.get("locais") || "").split(",").filter(Boolean).slice(0, 800).map((p) => `${mun}-${p}`);
        const sel = new Set(ids.map((id) => B.idx.get(id)).filter((x) => x !== undefined));
        let meus = 0;
        V.is.forEach((i, k) => { if (sel.has(B.l[i])) meus += V.qs[k]; });
        const soma = new Map();
        for (const id of ids) for (const [n, v] of m.porLocal[id]?.[cargo] || []) soma.set(n, (soma.get(n) || 0) + v);
        if (meus) soma.set(numero, meus); else soma.delete(numero);
        const linhas = [...soma.entries()].sort((a, b) => b[1] - a[1]);
        const i = linhas.findIndex(([n]) => n === numero);
        return {comVoto: linhas.length, posicao: i >= 0 ? i + 1 : null, votos: meus, top: linhas.slice(0, 15).map(pessoa(nomes))};
      }
    }
    throw new Error(`indisponível na versão final: ${rota}`);
  };
})();
