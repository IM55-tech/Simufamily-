// Moteur de calcul SimuFamily : fonction pure, sans dépendance à l’interface.
(function (root) {
  'use strict';

  const POSTES = [
    { nom: 'Logement (surcoût)', montant: 15000, freq: 'm', ageMin: 0, ageMax: 17, inflation: null },
    { nom: 'Alimentation', montant: 25000, freq: 'm', ageMin: 0, ageMax: 17, inflation: null },
    { nom: 'Santé', montant: 8000, freq: 'm', ageMin: 0, ageMax: 17, inflation: null },
    { nom: 'Crèche / garde', montant: 30000, freq: 'm', ageMin: 0, ageMax: 2, inflation: null },
    { nom: 'Scolarité (frais, fournitures)', montant: 20000, freq: 'm', ageMin: 3, ageMax: 17, inflation: null },
    { nom: 'Vêtements', montant: 5000, freq: 'm', ageMin: 0, ageMax: 17, inflation: null },
    { nom: 'Loisirs et activités', montant: 5000, freq: 'm', ageMin: 3, ageMax: 17, inflation: null },
    { nom: 'Transport', montant: 6000, freq: 'm', ageMin: 6, ageMax: 17, inflation: null },
    { nom: 'Imprévus', montant: 5000, freq: 'm', ageMin: 0, ageMax: 17, inflation: null },
    { nom: 'Études supérieures', montant: 40000, freq: 'm', ageMin: 18, ageMax: 24, inflation: null }
  ];

  // dep : multiplicateur des dépenses, inf : multiplicateur d’inflation, rev : croissance annuelle du revenu
  const SCENARIOS = {
    base: { nom: 'Base', dep: 1, inf: 1, rev: 0.01 },
    opti: { nom: 'Optimiste', dep: 0.9, inf: 0.8, rev: 0.02 },
    pessi: { nom: 'Pessimiste', dep: 1.2, inf: 1.3, rev: 0 }
  };

  function ageMois(naissance, debut, m) {
    const n = new Date(naissance), d = new Date(debut);
    return (d.getUTCFullYear() - n.getUTCFullYear()) * 12 + (d.getUTCMonth() - n.getUTCMonth()) + m;
  }

  function simuler(e, sc) {
    const N = Math.max(1, Math.round(e.duree)) * 12;
    const mois = [], parPoste = {};
    for (let m = 0; m < N; m++) {
      const an = Math.floor(m / 12);
      let dep = 0, aid = 0; const pm = {};
      for (const c of e.enfants) {
        const am = ageMois(c.naissance, e.debut, m);
        if (am < 0) continue;                       // enfant pas encore né
        const age = Math.floor(am / 12);
        if (age >= c.ageFin) continue;              // fin de prise en charge
        for (const p of e.postes) {
          if (age < p.ageMin || age > p.ageMax) continue;
          const taux = ((p.inflation == null ? e.inflation : p.inflation) / 100) * sc.inf;
          const v = (p.freq === 'a' ? p.montant / 12 : p.montant) * Math.pow(1 + taux, an) * sc.dep;
          dep += v;
          parPoste[p.nom] = (parPoste[p.nom] || 0) + v;
          pm[p.nom] = (pm[p.nom] || 0) + v;
        }
        for (const a of e.aides) if (age >= a.ageMin && age <= a.ageMax) aid += a.montant;
      }
      mois.push({ m, an, pm, dep, aid, net: dep - aid, rev: e.revenu * Math.pow(1 + sc.rev, an) });
    }
    const somme = k => mois.reduce((s, x) => s + x[k], 0);
    const annuel = [];
    mois.forEach(x => { annuel[x.an] = (annuel[x.an] || 0) + x.net; });
    const totalNet = somme('net'), totalRev = somme('rev');
    return {
      mois, annuel, parPoste, totalNet,
      moyenneMensuelle: totalNet / N,
      tauxEffort: totalRev ? totalNet / totalRev : 0,
      resteAVivre: (totalRev - totalNet) / N
    };
  }

  // ---- Suivi réel / courbes : dates AAAA-MM-JJ, montants étalés sur la période couverte (j, s, m, a)
  const DAY = 864e5, dn = s => Math.floor(Date.parse(s) / DAY), iso = d => new Date(d * DAY).toISOString().slice(0, 10);
  function bornes(d, v) {
    const t = new Date(d * DAY), y = t.getUTCFullYear(), m = t.getUTCMonth();
    if (v === 'j') return [d, d];
    if (v === 's') { const s = d - (t.getUTCDay() + 6) % 7; return [s, s + 6]; }
    if (v === 'm') return [Date.UTC(y, m, 1) / DAY, Date.UTC(y, m + 1, 0) / DAY];
    return [Date.UTC(y, 0, 1) / DAY, Date.UTC(y, 11, 31) / DAY];
  }
  // ops : {type:'revenu'|'depense'|'epargne', date, per, montant, cat, membre} ; parts : membre -> % versé à la famille
  function jours(ops, parts) {
    const D = {};
    for (const o of ops) {
      const [a, b] = bornes(dn(o.date), o.per || 'j'), v = o.montant / (b - a + 1);
      for (let d = a; d <= b; d++) {
        const x = D[d] || (D[d] = { rev: 0, priv: 0, dep: 0, epa: 0, cat: {} });
        if (o.type === 'revenu') { const p = (parts && parts[o.membre] != null ? parts[o.membre] : 100) / 100; x.rev += v * p; x.priv += v * (1 - p); }
        else if (o.type === 'epargne') x.epa += v;
        else { x.dep += v; x.cat[o.cat] = (x.cat[o.cat] || 0) + v; }
      }
    }
    return D;
  }
  // n tranches (semaine s / mois m / année a) ; back = finissent à la tranche contenant l'ancre, sinon commencent par elle
  function buckets(v, anchor, n, back) {
    const s0 = bornes(anchor, v)[0], t0 = new Date(s0 * DAY), out = [];
    for (let k = 0; k < n; k++) {
      const i = k + (back ? 1 - n : 0);
      const st = v === 's' ? s0 + 7 * i : v === 'm' ? Date.UTC(t0.getUTCFullYear(), t0.getUTCMonth() + i, 1) / DAY : Date.UTC(t0.getUTCFullYear() + i, 0, 1) / DAY;
      const [a, b] = bornes(st, v), j = iso(a);
      out.push({ a, b, l: v === 's' ? j.slice(8) + '/' + j.slice(5, 7) : v === 'm' ? j.slice(5, 7) + '/' + j.slice(2, 4) : j.slice(0, 4) });
    }
    return out;
  }
  function agg(D, bs) {
    return bs.map(q => {
      const r = { rev: 0, priv: 0, dep: 0, epa: 0, cat: {} };
      for (let d = q.a; d <= q.b; d++) {
        const x = D[d]; if (!x) continue;
        r.rev += x.rev; r.priv += x.priv; r.dep += x.dep; r.epa += x.epa;
        for (const k in x.cat) r.cat[k] = (r.cat[k] || 0) + x.cat[k];
      }
      return r;
    });
  }
  function patrimoine(D, fin, p0) {
    let s = p0 || 0;
    for (const k in D) if (+k <= fin) s += D[k].rev - D[k].dep;
    return s;
  }
  // variation dernière vs avant-dernière valeur + tendance générale (2e moitié vs 1re moitié)
  function analyse(vals) {
    const n = vals.length, l = vals[n - 1], p = vals[n - 2];
    const h = Math.floor(n / 2), m = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
    const m1 = m(vals.slice(0, h)), m2 = m(vals.slice(n - h));
    const t = m1 ? (m2 - m1) / m1 : 0;
    return { v: p ? (l - p) / p : null, tend: t > 0.1 ? 'hausse' : t < -0.1 ? 'baisse' : 'stable' };
  }

  const api = { POSTES, SCENARIOS, simuler, dn, iso, jours, buckets, agg, patrimoine, analyse };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SimuEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
