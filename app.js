(function () {
  'use strict';
  const E = window.SimuEngine, KEY = 'simufamily.v2', today = new Date().toISOString().slice(0, 10);
  const copy = o => JSON.parse(JSON.stringify(o));
  const defaut = () => ({
    foyer: { parents: 2, revenu: 300000, duree: 18, inflation: 2, debut: today, autres: 100000 },
    enfants: [{ prenom: 'Enfant 1', naissance: today, ageFin: 18 }],
    postes: copy(E.POSTES), aides: [],
    membres: [{ nom: 'Parent 1', apport: 200000, part: 100 }, { nom: 'Parent 2', apport: 100000, part: 100 }],
    cats: E.POSTES.map(p => ({ nom: p.nom, g: /Loisirs|Vêtements|Imprévus/.test(p.nom) ? 'e' : 'b' }))
      .concat([{ nom: 'Dépenses courantes du foyer', g: 'b' }, { nom: 'Sorties', g: 'e' }, { nom: 'Autre', g: 'e' }]),
    budget: { b: 50, p: 20, e: 30 }, patrimoine0: 0, objectif: 0, reel: [], mode: 'sim', vue: 'm'
  });
  function load() {
    const d = defaut();
    try { const r = localStorage.getItem(KEY); if (r) { const o = JSON.parse(r); o.foyer = Object.assign(d.foyer, o.foyer); return Object.assign(d, o); } } catch (e) {}
    return d;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  let S = load(), tab = S.mode === 'reel' ? 'bilan' : 'foyer', scen = 'base', lastIn = null;

  const $ = id => document.getElementById(id);
  const fcfa = n => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n || 0);
  const pct = n => (n * 100).toFixed(1).replace('.', ',') + ' %';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const inp = (l, p, v, t = 'num', x = '') =>
    `<label>${l}<input data-s="${p}" data-t="${t}" type="${t === 'text' || t === 'date' ? t : 'number'}" step="any" value="${esc(v)}" ${x}></label>`;

  const V = {
    foyer() {
      const f = S.foyer;
      return `<section class="card"><h2>Foyer</h2>
<label>Parents dans le foyer<select data-s="foyer.parents" data-t="num">${[1, 2].map(n => `<option ${f.parents === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
${inp('Revenu net mensuel du foyer (FCFA, recalculé depuis l’onglet Famille)', 'foyer.revenu', f.revenu)}
<div class="row">${inp('Durée de simulation (ans)', 'foyer.duree', f.duree)}${inp('Inflation annuelle (%)', 'foyer.inflation', f.inflation)}</div>
${inp('Début de la simulation', 'foyer.debut', f.debut, 'date')}
${inp('Autres dépenses mensuelles du foyer, hors enfants (FCFA)', 'foyer.autres', f.autres)}
<p class="note">Les montants par défaut sont des valeurs indicatives en FCFA, à adapter à votre situation dans l’onglet Dépenses.</p></section>
<button class="btn x" data-a="reset">Réinitialiser les données</button>`;
    },
    enfants() {
      return S.enfants.map((c, i) => { const k = 'enfants.' + i + '.'; return `<section class="card"><h2>Enfant ${i + 1}</h2>
${inp('Prénom', k + 'prenom', c.prenom, 'text')}
<div class="row">${inp('Date de naissance', k + 'naissance', c.naissance, 'date')}${inp('Pris en charge jusqu’à (ans)', k + 'ageFin', c.ageFin)}</div>
<button class="btn x" data-a="delEnfant" data-i="${i}">Supprimer</button></section>`; }).join('')
        + `<button class="btn" data-a="addEnfant">+ Ajouter un enfant</button>`;
    },
    depenses() {
      const postes = S.postes.map((p, i) => { const k = 'postes.' + i + '.'; return `<section class="card">${inp('Nom', k + 'nom', p.nom, 'text')}
<div class="row3">${inp('Montant (FCFA)', k + 'montant', p.montant)}
<label>Fréquence<select data-s="${k}freq" data-t="text"><option value="m" ${p.freq === 'm' ? 'selected' : ''}>Mensuel</option><option value="a" ${p.freq === 'a' ? 'selected' : ''}>Annuel</option></select></label>
${inp('Inflation %', k + 'inflation', p.inflation == null ? '' : p.inflation, 'nul', 'placeholder="global"')}</div>
<div class="row">${inp('Âge min', k + 'ageMin', p.ageMin)}${inp('Âge max', k + 'ageMax', p.ageMax)}</div>
<button class="btn x" data-a="delPoste" data-i="${i}">Supprimer</button></section>`; }).join('');
      const aides = S.aides.map((a, i) => { const k = 'aides.' + i + '.'; return `<section class="card">${inp('Nom', k + 'nom', a.nom, 'text')}
<div class="row3">${inp('FCFA / mois', k + 'montant', a.montant)}${inp('Âge min', k + 'ageMin', a.ageMin)}${inp('Âge max', k + 'ageMax', a.ageMax)}</div>
<button class="btn x" data-a="delAide" data-i="${i}">Supprimer</button></section>`; }).join('');
      return `<h2>Postes de dépenses (par enfant)</h2>${postes}<button class="btn" data-a="addPoste">+ Ajouter un poste</button>
<h2 style="margin-top:20px">Aides (par enfant, par mois)</h2>${aides}<button class="btn o" data-a="addAide">+ Ajouter une aide</button>`;
    },
    resultats() {
      if (!S.enfants.length) return `<p class="card">Ajoutez au moins un enfant pour lancer la simulation.</p>`;
      const etat = Object.assign({}, S.foyer, { enfants: S.enfants, postes: S.postes, aides: S.aides });
      const r = E.simuler(etat, E.SCENARIOS[scen]);
      const chips = Object.keys(E.SCENARIOS).map(k => `<button class="chip ${k === scen ? 'on' : ''}" data-a="scen" data-k="${k}">${E.SCENARIOS[k].nom}</button>`).join('');
      const kpi = (v, l) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`;
      const max = Math.max(1, ...r.annuel), w = 300 / r.annuel.length;
      const bars = r.annuel.map((v, i) => {
        const h = Math.max(0, v) / max * 110;
        return `<rect x="${i * w + 1}" y="${125 - h}" width="${Math.max(1, w - 2)}" height="${h}" rx="2" fill="var(--g)"/>`
          + (r.annuel.length <= 12 || i % 2 === 0 ? `<text x="${i * w + w / 2}" y="138" text-anchor="middle">${i + 1}</text>` : '');
      }).join('');
      const rows = Object.keys(E.SCENARIOS).map(k => {
        const q = E.simuler(etat, E.SCENARIOS[k]);
        const f = n => fcfa(n).replace(/\u00a0/g, ' ');
        return `<tr><td>${E.SCENARIOS[k].nom}</td><td>${f(q.moyenneMensuelle)}</td><td>${f(q.totalNet)}</td><td>${pct(q.tauxEffort)}</td></tr>`;
      }).join('');
      const postes = Object.entries(r.parPoste).sort((a, b) => b[1] - a[1]);
      const tot = postes.reduce((s, x) => s + x[1], 0) || 1;
      const detail = postes.map(([n, v]) => `<div>${esc(n)} — <b>${fcfa(v)}</b><div class="bar"><i style="width:${v / tot * 100}%"></i></div></div>`).join('');
      return `<div class="chips">${chips}</div>
<div class="kpis">${kpi(fcfa(r.moyenneMensuelle), 'Coût net moyen / mois')}${kpi(fcfa(r.totalNet), 'Coût total cumulé')}${kpi(pct(r.tauxEffort), 'Taux d’effort moyen')}${kpi(fcfa(r.resteAVivre), 'Reste à vivre moyen / mois')}</div>
<section class="card"><h2>Coût net par année</h2><svg viewBox="0 0 300 145" width="100%">${bars}</svg><p class="note">Année de simulation (maximum : ${fcfa(max)})</p></section>
<section class="card"><h2>Comparaison des scénarios</h2><table><tr><th></th><th>/ mois</th><th>Total</th><th>Effort</th></tr>${rows}</table></section>
<section class="card"><h2>Répartition par poste</h2>${detail || '<p class="note">Aucune dépense sur la période.</p>'}</section>
<p class="note">Estimations indicatives, non contractuelles.</p>`;
    }
  };

  // ---------- Nouveaux modules : Réel, Famille, Budget 50/20/30, Courbes, Bilan, Calculatrice ----------
  const GN = { b: 'Besoins', e: 'Envies', p: 'Épargne' }, GC = { b: '#17508A', e: '#F49434', p: '#14A48C' };
  const PAL = ['#17508A', '#14A48C', '#F49434', '#8E5BD8', '#D8517A', '#5BA7D8', '#A4B814', '#8A6B4E', '#4E8A6B', '#C0392B', '#667585', '#2E7D32'];
  const VN = { s: 'Semaine', m: 'Mois', a: 'Année' }, PREV = { s: 'la semaine passée', m: 'le mois passé', a: 'l’année passée' };
  const grp = n => (S.cats.find(c => c.nom === n) || { g: 'b' }).g;
  const epargne = (a, reel) => reel ? a.epa : Math.max(0, a.rev - a.dep);
  const pc = x => (x * 100).toFixed(0) + ' %', sg = v => (v > 0 ? '+' : '') + (v * 100).toFixed(0) + ' %';

  function simOps() {
    const sc = E.SCENARIOS[scen], d0 = new Date(S.foyer.debut), ops = [];
    const r = E.simuler(Object.assign({}, S.foyer, { enfants: S.enfants, postes: S.postes, aides: S.aides }), sc);
    r.mois.forEach(x => {
      const date = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + x.m, 1)).toISOString().slice(0, 10);
      const add = o => ops.push(Object.assign({ date, per: 'm' }, o));
      S.membres.forEach(m => add({ type: 'revenu', montant: m.apport * Math.pow(1 + sc.rev, x.an), membre: m.nom }));
      if (x.aid) add({ type: 'revenu', montant: x.aid, membre: 'Aides' });
      for (const k in x.pm) add({ type: 'depense', montant: x.pm[k], cat: k });
      add({ type: 'depense', montant: S.foyer.autres * Math.pow(1 + S.foyer.inflation / 100 * sc.inf, x.an), cat: 'Dépenses courantes du foyer' });
    });
    return ops;
  }
  // Source unique des courbes : opérations saisies (Réel) ou projection du moteur (Simulation)
  function ctx() {
    const reel = S.mode === 'reel', parts = {};
    S.membres.forEach(m => parts[m.nom] = m.part);
    const ops = reel ? S.reel : simOps(), D = E.jours(ops, parts);
    const n = S.vue === 'a' ? (reel ? 5 : Math.max(2, Math.min(18, Math.round(S.foyer.duree) || 2))) : 12;
    const bs = E.buckets(S.vue, E.dn(reel ? today : S.foyer.debut), n, reel), A = E.agg(D, bs);
    return { reel, ops, D, bs, A, parts, cur: reel ? n - 1 : 1, pat: bs.map(q => E.patrimoine(D, q.b, S.patrimoine0)) };
  }
  const chipsV = () => `<div class="chips">${['s', 'm', 'a'].map(k => `<button class="chip ${S.vue === k ? 'on' : ''}" data-a="vue" data-k="${k}">${VN[k]}</button>`).join('')}</div>`;
  const kp = (v, l, s = '') => `<div class="kpi"><b>${v}</b><span>${l}</span>${s ? `<em>${s}</em>` : ''}</div>`;
  const carte = (t, h, svg, txt = '') => `<section class="card"><h2>${t}${h ? ` <small>${h}</small>` : ''}</h2>${svg}${txt}</section>`;
  const vsPrev = (v) => v == null ? '' : `${v > 0.005 ? '▲' : v < -0.005 ? '▼' : '●'} ${sg(v)} vs ${PREV[S.vue]}`;

  function ligne(lab, ser) {
    const n = lab.length, all = ser.flatMap(s => s.vals), mx = Math.max(1, ...all), mn = Math.min(0, ...all);
    const X = i => 8 + i * 284 / Math.max(1, n - 1), Y = v => 112 - (v - mn) / ((mx - mn) || 1) * 100;
    return `<svg viewBox="0 0 300 130" width="100%"><line x1="0" x2="300" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--bd)"/>`
      + ser.map(s => `<polyline fill="none" stroke="${s.c}" stroke-width="2.2" points="${s.vals.map((v, i) => X(i) + ',' + Y(v)).join(' ')}"/><circle cx="${X(n - 1)}" cy="${Y(s.vals[n - 1])}" r="3.2" fill="${s.c}"/>`).join('')
      + lab.map((l, i) => n <= 7 || i % 2 === 0 ? `<text x="${X(i)}" y="126" text-anchor="middle">${l}</text>` : '').join('') + '</svg>';
  }
  function donut(parts) {
    const p0 = parts.filter(x => x.v > 0), t = p0.reduce((s, x) => s + x.v, 0) || 1;
    let o = 0;
    const arcs = p0.map(x => { const p = x.v / t * 100, r = `<circle r="15.9" cx="21" cy="21" fill="none" stroke="${x.c}" stroke-width="7" stroke-dasharray="${p} ${100 - p}" stroke-dashoffset="${25 - o}"/>`; o += p; return r; }).join('');
    const leg = p0.map(x => `<div class="lg"><i style="background:${x.c}"></i>${esc(x.n)}<b>${(x.v / t * 100).toFixed(0)} %</b></div>`).join('');
    return `<div class="dn"><svg viewBox="0 0 42 42" width="120" height="120"><circle r="15.9" cx="21" cy="21" fill="none" stroke="var(--bd)" stroke-width="7"/>${arcs}</svg><div>${leg || '<p class="note">Aucune donnée.</p>'}</div></div>`;
  }
  // lecture simple d’une courbe : variation vs période précédente + tendance générale
  function lecture(vals, c, bon) {
    const v = E.analyse(vals.slice(0, c.cur + 1)).v, t = E.analyse(vals).tend;
    const m = bon ? { hausse: 'La courbe monte : le patrimoine grandit, très bien.', baisse: 'La courbe descend : on dépense plus qu’on ne reçoit.', stable: 'La courbe est plate : le patrimoine ne bouge presque pas.' }
      : { hausse: 'La courbe monte : ce poste prend de plus en plus de place, à surveiller.', baisse: 'La courbe descend : bon signe, ce poste est mieux maîtrisé.', stable: 'La courbe est plate : rythme régulier, rien d’alarmant.' };
    return `<p class="note"><b>${v == null ? 'Pas assez de données pour comparer.' : vsPrev(v)}</b> ${m[t]}</p>`;
  }

  Object.assign(V, {
    bilan() {
      const c = ctx(), k = c.cur, a = c.A[k], pa = c.A[k - 1], reel = c.reel, ep = epargne(a, reel), B = S.budget;
      const per = reel ? { s: 'cette semaine', m: 'ce mois', a: 'cette année' }[S.vue] : { s: 'la 2e semaine', m: 'le 2e mois', a: 'la 2e année' }[S.vue];
      const dv = pa && pa.dep ? (a.dep - pa.dep) / pa.dep : null, pv = c.pat[k - 1] ? (c.pat[k] - c.pat[k - 1]) / Math.abs(c.pat[k - 1]) : null;
      const cats = Object.keys(a.cat).map(n => ({ n, v: a.cat[n], d: E.analyse(c.A.slice(0, k + 1).map(x => x.cat[n] || 0)).v })).sort((x, y) => y.v - x.v);
      const up = cats.filter(x => x.d != null && x.d > 0.1).sort((x, y) => y.d - x.d).slice(0, 3);
      const gs = { b: 0, e: 0 }; cats.forEach(x => gs[grp(x.n)] += x.v);
      const rv = a.rev || 1, L = [];
      L.push(`Sur ${per}, la famille a reçu <b>${fcfa(a.rev)}</b> et dépensé <b>${fcfa(a.dep)}</b> (${pc(a.dep / rv)} des revenus).`);
      L.push(a.rev >= a.dep ? `Il reste ${fcfa(a.rev - a.dep)} : le patrimoine progresse.` : `Les dépenses dépassent les revenus de ${fcfa(a.dep - a.rev)} : le patrimoine recule.`);
      ['b', 'e'].forEach(g => L.push(`${GN[g]} : ${pc(gs[g] / rv)} des revenus (objectif ${B[g]} %) — ${gs[g] / rv * 100 > B[g] ? 'à réduire' : 'dans l’objectif'}.`));
      L.push(`Épargne : ${pc(ep / rv)} des revenus (objectif ${B.p} %) — ${ep / rv * 100 < B.p ? 'à renforcer' : 'dans l’objectif'}.`);
      L.push(up.length ? `Où s’améliorer : ${up.map(x => `${esc(x.n)} (${sg(x.d)})`).join(', ')}.` : 'Aucun poste ne dérape fortement.');
      const ob = S.objectif > 0 ? Math.max(0, Math.min(1, c.pat[k] / S.objectif)) : 0;
      return chipsV() + `<div class="kpis">${kp(fcfa(c.pat[k]), 'Patrimoine familial', vsPrev(pv))}${kp(fcfa(a.rev), 'Revenus de la famille')}${kp(fcfa(a.dep), 'Dépenses', vsPrev(dv))}${kp(fcfa(ep), 'Épargne', pc(ep / rv) + ' des revenus')}</div>`
        + `<section class="card"><h2>Briefing</h2>${L.map(x => `<p class="br">${x}</p>`).join('')}<p class="note">Part gardée en privé (non détaillée) : ${fcfa(a.priv)}</p></section>`
        + `<section class="card"><h2>Jauge du patrimoine</h2><div class="bar big"><i style="width:${ob * 100}%;background:var(--g)"></i></div>${S.objectif > 0 ? `<p class="note">${fcfa(c.pat[k])} sur ${fcfa(S.objectif)} visés (${pc(ob)})</p>` : '<p class="note">Fixez un objectif pour voir la jauge se remplir.</p>'}${inp('Objectif de patrimoine (FCFA)', 'objectif', S.objectif)}</section>`
        + carte('Répartition des dépenses', '', donut(cats.map((x, i) => ({ n: x.n, v: x.v, c: PAL[i % PAL.length] }))));
    },
    ajout() {
      const o = (v, l) => `<option value="${esc(v)}">${esc(l)}</option>`, T = { revenu: 'Revenu', depense: 'Dépense', epargne: 'Épargne' }, P = { j: 'le jour', s: 'la semaine', m: 'le mois', a: 'l’année' };
      const rows = S.reel.map((x, i) => ({ x, i })).reverse().slice(0, 40).map(({ x, i }) => `<div class="op"><span>${x.date} • ${T[x.type]}${x.type === 'depense' ? ' • ' + esc(x.cat) : ''}${x.membre ? ' • ' + esc(x.membre) : ''} • pour ${P[x.per]}</span><b>${fcfa(x.montant)}</b><button data-a="delOp" data-i="${i}" aria-label="Supprimer">✕</button></div>`).join('');
      return `<section class="card"><h2>Ajouter une opération</h2>
<label>Type<select id="f-t">${o('depense', 'Dépense')}${o('revenu', 'Revenu (apport d’un membre)')}${o('epargne', 'Épargne')}</select></label>
<label>Montant (FCFA)<input id="f-m" type="number" inputmode="decimal" step="any"></label>
<div class="row"><label>Catégorie (dépenses)<select id="f-c">${S.cats.map(x => o(x.nom, x.nom)).join('')}</select></label><label>Membre<select id="f-mb">${o('', 'Commun / famille')}${S.membres.map(m => o(m.nom, m.nom)).join('')}</select></label></div>
<div class="row"><label>Date<input id="f-d" type="date" value="${today}"></label><label>Pour<select id="f-p">${o('j', 'Ce jour')}${o('s', 'La semaine')}${o('m', 'Le mois')}${o('a', 'L’année')}</select></label></div>
<label>Note<input id="f-n" type="text"></label>
<button class="btn" data-a="addOp">Enregistrer</button><p class="note">Un montant « pour le mois » ou « pour l’année » est réparti sur toute la période dans les courbes.</p></section>
<h2>Dernières opérations</h2><section class="card">${rows || '<p class="note">Rien pour l’instant.</p>'}</section>`;
    },
    famille() {
      const c = ctx(), q = c.bs[c.cur], names = S.membres.map(m => m.nom);
      const rows = S.membres.map(m => ({ m, r: E.agg(E.jours(c.ops.filter(x => x.membre === m.nom), c.parts), [q])[0] }));
      const tot = rows.reduce((s, x) => s + x.r.rev, 0) || 1;
      const com = E.agg(E.jours(c.ops.filter(x => x.type === 'depense' && !names.includes(x.membre)), c.parts), [q])[0].dep;
      const cards = rows.map(({ m, r }, i) => {
        const k = 'membres.' + i + '.', sh = r.rev / tot;
        const cats = Object.entries(r.cat).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([n, v]) => `<div>${esc(n)} — <b>${fcfa(v)}</b></div>`).join('');
        return `<section class="card" style="border-left:6px solid ${PAL[i % PAL.length]}">${inp('Nom', k + 'nom', m.nom, 'text')}
<div class="row">${inp('Apport mensuel (FCFA)', k + 'apport', m.apport)}${inp('% versé à la famille', k + 'part', m.part)}</div>
<p>Apporte à la famille : <b>${fcfa(r.rev)}</b> (${pc(sh)} du total)<br>Gardé en privé, non détaillé : <b>${fcfa(r.priv)}</b></p>
${r.dep ? `<p class="note">Dépenses familiales payées par ${esc(m.nom)} :</p>${cats}<p>Total payé : <b>${fcfa(r.dep)}</b></p>` : ''}${com && r.rev ? `<p class="note">Part estimée des dépenses communes (${fcfa(com)}) : ≈ ${fcfa(com * sh)}</p>` : ''}
<button class="btn x" data-a="delMembre" data-i="${i}">Supprimer</button></section>`;
      }).join('');
      const stack = rows.map(({ m, r }, i) => `<i style="width:${r.rev / tot * 100}%;background:${PAL[i % PAL.length]}" title="${esc(m.nom)}"></i>`).join('');
      const leg = rows.map(({ m, r }, i) => `<div class="lg"><i style="background:${PAL[i % PAL.length]}"></i>${esc(m.nom)}<b>${pc(r.rev / tot)}</b></div>`).join('');
      return chipsV() + `<section class="card"><h2>Qui apporte quoi</h2><div class="stack">${stack}</div>${leg}<p class="note">La part privée n’entre ni dans les dépenses ni dans le patrimoine familial.</p></section>${cards}<button class="btn" data-a="addMembre">+ Ajouter un membre</button>`
        + `<section class="card">${inp('Patrimoine de départ de la famille (FCFA)', 'patrimoine0', S.patrimoine0)}</section>`;
    },
    budget() {
      const c = ctx(), a = c.A[c.cur], B = S.budget, R = a.rev || 0, gs = { b: 0, e: 0, p: epargne(a, c.reel) };
      Object.keys(a.cat).forEach(n => gs[grp(n)] += a.cat[n]);
      const tot = B.b + B.p + B.e;
      const ln = g => {
        const p = R ? gs[g] / R : 0, over = g === 'p' ? p * 100 < B[g] : p * 100 > B[g];
        return `<div class="gg"><b>${GN[g]}</b> — ${fcfa(gs[g])}<div class="bar big"><i style="width:${Math.min(100, p * 100)}%;background:${over ? '#C0392B' : GC[g]}"></i><u style="left:${Math.min(100, B[g])}%"></u></div><span class="note">Réel ${pc(p)} • objectif ${B[g]} % (${fcfa(R * B[g] / 100)}) — ${over ? (g === 'p' ? 'sous l’objectif' : 'objectif dépassé') : 'objectif respecté'}</span></div>`;
      };
      const cats = S.cats.map((x, i) => `<div class="row3c">${inp('Catégorie', 'cats.' + i + '.nom', x.nom, 'text')}<label>Type<select data-s="cats.${i}.g" data-t="text"><option value="b" ${x.g === 'b' ? 'selected' : ''}>Besoin</option><option value="e" ${x.g === 'e' ? 'selected' : ''}>Envie</option></select></label><button class="btn x" data-a="delCat" data-i="${i}" aria-label="Supprimer">✕</button></div>`).join('');
      return chipsV() + `<section class="card"><h2>Modèle ${B.b} / ${B.p} / ${B.e}</h2><div class="row3">${inp('Besoins %', 'budget.b', B.b)}${inp('Épargne %', 'budget.p', B.p)}${inp('Envies %', 'budget.e', B.e)}</div>${tot !== 100 ? `<p class="note" style="color:#C0392B">Total : ${tot} % — il doit faire 100 %.</p>` : ''}</section>`
        + `<section class="card"><h2>Jauges (part des revenus)</h2>${ln('b')}${ln('e')}${ln('p')}</section>`
        + carte('Répartition réelle', '', donut(['b', 'e', 'p'].map(g => ({ n: GN[g], v: gs[g], c: GC[g] }))))
        + `<section class="card"><h2>Catégories</h2>${cats}<button class="btn" data-a="addCat">+ Ajouter une catégorie</button></section>`;
    },
    courbes() {
      const c = ctx(), L = c.bs.map(q => q.l), dep = c.A.map(a => a.dep), nz = v => { const m = Math.max(1, ...v.map(Math.abs)); return v.map(x => x / m); };
      const cats = [...new Set(c.A.flatMap(a => Object.keys(a.cat)))];
      const per = cats.map((k, i) => { const v = c.A.map(a => a.cat[k] || 0); return carte(esc(k), `<b>${fcfa(v[c.cur])}</b>`, ligne(L, [{ vals: v, c: PAL[i % PAL.length] }]), lecture(v, c)); }).join('');
      return chipsV() + carte('Évolution du patrimoine', `<b>${fcfa(c.pat[c.cur])}</b>`, ligne(L, [{ vals: c.pat, c: GC.p }]), lecture(c.pat, c, true))
        + carte('Évolution de la consommation', `<b>${fcfa(dep[c.cur])}</b>`, ligne(L, [{ vals: dep, c: GC.e }]), lecture(dep, c))
        + carte('Patrimoine + consommation', '', ligne(L, [{ vals: nz(c.pat), c: GC.p }, { vals: nz(dep), c: GC.e }]),
          `<p class="note"><span class="dot" style="background:${GC.p}"></span>Patrimoine • <span class="dot" style="background:${GC.e}"></span>Consommation (échelles séparées pour comparer les formes). Si l’orange monte plus vite que le vert, on consomme plus qu’on ne construit.</p>`)
        + '<h2>Courbe de chaque dépense</h2>' + (per || '<p class="note">Aucune dépense sur la période.</p>');
    }
  });

  // Calculatrice (un bouton 🧮 dans chaque module) : calcul libre, somme cumulée, insertion dans le champ touché
  const calcEl = document.createElement('div'); calcEl.id = 'calc'; calcEl.hidden = true;
  calcEl.innerHTML = `<div class="cb"><div class="ct" id="ctape"></div><input id="cx" inputmode="decimal" placeholder="0" aria-label="Calcul"><div class="ck">${['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '(', ')', 'C', '⌫', '=', '+'].map(k => `<button data-a="ck" data-k="${k}">${{ '/': '÷', '*': '×', '-': '−' }[k] || k}</button>`).join('')}</div>`
    + `<div class="row"><button class="btn o" data-a="ck" data-k="sum">Ajouter à la somme</button><button class="btn" data-a="ck" data-k="dep">Dépenses de la période</button></div><div class="row"><button class="btn" data-a="ck" data-k="use">Utiliser dans le champ</button><button class="btn x" data-a="ck" data-k="close">Fermer</button></div></div>`;
  document.body.appendChild(calcEl);
  let tape = [];
  function ev(s) {
    s = String(s).replace(/,/g, '.').replace(/\s/g, '');
    if (!s || !/^[0-9+\-*/().]+$/.test(s)) return NaN;
    try { const r = Function('"use strict";return (' + s + ')')(); return isFinite(r) ? r : NaN; } catch (e) { return NaN; }
  }
  function calcClick(b) {
    const a = b.dataset.a;
    if (a !== 'calc' && a !== 'ck') return false;
    const cx = $('cx'), k = b.dataset.k, r = ev(cx.value), r2 = n => Math.round(n * 100) / 100;
    if (a === 'calc') calcEl.hidden = false;
    else if (k === 'close') calcEl.hidden = true;
    else if (k === 'C') { cx.value = ''; tape = []; }
    else if (k === '⌫') cx.value = cx.value.slice(0, -1);
    else if (k === '=') cx.value = isNaN(r) ? '' : String(r2(r));
    else if (k === 'sum') { if (!isNaN(r)) { tape.push(r); cx.value = ''; } }
    else if (k === 'dep') { const c = ctx(); cx.value = Math.round(c.A[c.cur].dep); }
    else if (k === 'use') {
      const v = cx.value ? r : tape.reduce((s, x) => s + x, 0);
      if (lastIn && lastIn.type === 'number' && !isNaN(v)) { lastIn.value = r2(v); lastIn.dispatchEvent(new Event('change', { bubbles: true })); calcEl.hidden = true; }
      else alert('Touchez d’abord un champ de montant, puis rouvrez la calculatrice.');
    } else cx.value += k;
    $('ctape').innerHTML = tape.length ? `Somme : <b>${fcfa(tape.reduce((s, x) => s + x, 0))}</b> (${tape.length} ligne${tape.length > 1 ? 's' : ''})` : 'Somme : touchez « Ajouter à la somme »';
    return true;
  }
  document.addEventListener('focusin', e => { if (e.target.matches('input,select') && !e.target.closest('#calc')) lastIn = e.target; });

  function render() {
    const T = S.mode === 'reel' ? [['bilan', 'Bilan'], ['ajout', 'Ajouter'], ['famille', 'Famille'], ['budget', 'Budget'], ['courbes', 'Courbes']]
      : [['foyer', 'Foyer'], ['enfants', 'Enfants'], ['depenses', 'Dépenses'], ['resultats', 'Résultats'], ['famille', 'Famille'], ['budget', 'Budget'], ['courbes', 'Courbes'], ['bilan', 'Bilan']];
    if (!T.some(t => t[0] === tab)) tab = T[0][0];
    const top = `<div class="top"><div class="chips">${[['sim', 'Simulation'], ['reel', 'Réel']].map(([k, l]) => `<button class="chip ${S.mode === k ? 'on' : ''}" data-a="mode" data-k="${k}">${l}</button>`).join('')}</div><button class="calc" data-a="calc" aria-label="Calculatrice">🧮</button></div>`;
    $('app').innerHTML = top + V[tab]();
    $('nav').innerHTML = T.map(([k, l]) => `<button class="${k === tab ? 'on' : ''}" data-a="tab" data-k="${k}">${l}</button>`).join('');
  }

  document.addEventListener('change', e => {
    const t = e.target, p = t.dataset.s;
    if (!p) return;
    let v = t.value;
    if (t.dataset.t === 'num') v = parseFloat(v) || 0;
    else if (t.dataset.t === 'nul') v = v === '' ? null : parseFloat(v);
    const ks = p.split('.');
    let o = S;
    for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
    if (/\.part$/.test(p)) v = Math.min(100, Math.max(0, v));
    if ((ks[0] === 'membres' || ks[0] === 'cats') && ks[2] === 'nom') {
      const old = S[ks[0]][ks[1]].nom, f = ks[0] === 'cats' ? 'cat' : 'membre';
      S.reel.forEach(x => { if (x[f] === old) x[f] = v; });
    }
    o[ks[ks.length - 1]] = v;
    if (ks[0] === 'membres') S.foyer.revenu = Math.round(S.membres.reduce((t, m) => t + m.apport * m.part / 100, 0));
    save();
    if (['budget', 'famille', 'bilan'].includes(tab)) setTimeout(() => {
      const fp = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.s;
      render();
      const n = fp && document.querySelector('[data-s="' + fp + '"]'); if (n) n.focus();
    }, 450);
  });

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    if (calcClick(b)) return;
    const a = b.dataset.a, i = +b.dataset.i;
    if (a === 'tab') { tab = b.dataset.k; window.scrollTo(0, 0); }
    else if (a === 'scen') scen = b.dataset.k;
    else if (a === 'addEnfant') S.enfants.push({ prenom: 'Enfant ' + (S.enfants.length + 1), naissance: today, ageFin: 18 });
    else if (a === 'delEnfant') S.enfants.splice(i, 1);
    else if (a === 'addPoste') S.postes.push({ nom: 'Nouveau poste', montant: 0, freq: 'm', ageMin: 0, ageMax: 17, inflation: null });
    else if (a === 'delPoste') S.postes.splice(i, 1);
    else if (a === 'addAide') S.aides.push({ nom: 'Nouvelle aide', montant: 0, ageMin: 0, ageMax: 17 });
    else if (a === 'delAide') S.aides.splice(i, 1);
    else if (a === 'reset') { if (!confirm('Effacer toutes les données ?')) return; S = defaut(); tab = 'foyer'; }
    else if (a === 'mode') { S.mode = b.dataset.k; tab = S.mode === 'reel' ? 'bilan' : 'foyer'; window.scrollTo(0, 0); }
    else if (a === 'vue') S.vue = b.dataset.k;
    else if (a === 'addMembre') S.membres.push({ nom: 'Membre ' + (S.membres.length + 1), apport: 0, part: 100 });
    else if (a === 'delMembre') S.membres.splice(i, 1);
    else if (a === 'addCat') { const n = (prompt('Nom de la catégorie ?') || '').trim(); if (!n) return; S.cats.push({ nom: n, g: confirm('Est-ce un besoin ?\nOK = besoin, Annuler = envie') ? 'b' : 'e' }); }
    else if (a === 'delCat') S.cats.splice(i, 1);
    else if (a === 'delOp') S.reel.splice(i, 1);
    else if (a === 'addOp') {
      const g = id => $(id).value, m = parseFloat(g('f-m'));
      if (!(m > 0)) { alert('Entrez un montant.'); return; }
      S.reel.push({ type: g('f-t'), date: g('f-d') || today, per: g('f-p'), montant: m, cat: g('f-c'), membre: g('f-mb'), note: g('f-n') });
    }
    save(); render();
  });

  render();
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
