// ==== BudgetBox core — Struttura: campi + calcoli legati ai TXT, senza default ====
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  const state = {
    theme: (localStorage.getItem('bb-theme') || 'light'),
    datasetLocalita: [],
    selRec: null,
    forme: [],              // da TXT forme-coperture.txt
    euroKgScale: [],        // da TXT euro_per_kg_scale.txt
    meteoCoeffScale: [],    // da TXT meteo_coeff_scale.txt
  };

  // ---------- Utils ----------
  const toNum = (v) => {
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  };
  const fmt2 = (n) => Number.isFinite(+n) ? (+n).toFixed(2) : '—';
  const fmt0 = (n) => Number.isFinite(+n) ? Math.round(+n).toString() : '—';
  const fmtMoney = (n) => Number.isFinite(+n)
    ? (+n).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
    : '0,00 €';
  const joinDot = (arr) => arr.filter(Boolean).join(' · ');

  // somma "a+b" (ritorna {sum:number, hadPlus:boolean})
  const sumPlusExpr = (s) => {
    if (!s) return { sum: 0, hadPlus: false };
    const parts = String(s).split('+').map(p => toNum(p.trim())).filter(n => Number.isFinite(n));
    if (!parts.length) return { sum: 0, hadPlus: false };
    if (parts.length === 1) return { sum: parts[0], hadPlus: false };
    return { sum: parts.reduce((a, b) => a + b, 0), hadPlus: true };
  };

  // TXT parser con autodetect delimitatore, ignora # e vuote
  function parseTableTxt(txt) {
    if (!txt) return [];
    const lines = txt.split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('#'));
    if (!lines.length) return [];
    const head = lines[0];
    const delimiter = [';', ',', '\t', '|'].reduce((best, d) => {
      const count = (head.match(new RegExp(`\\${d}`, 'g')) || []).length;
      return count > (best.count || -1) ? { d, count } : best;
    }, {}).d || ';';
    const headers = head.split(delimiter).map(s => s.trim());
    return lines.slice(1).map(line => {
      const cells = line.split(delimiter).map(c => c.trim());
      const rec = {};
      headers.forEach((h, i) => rec[h] = (cells[i] ?? ''));
      return rec;
    });
  }

  async function fetchWithFallback(paths) {
    for (const p of paths) {
      try {
        const res = await fetch(p, { cache: 'no-store' });
        if (res.ok) return await res.text();
      } catch (_) { /* ignore */ }
    }
    // niente default: semplicemente ritorna stringa vuota
    return '';
  }

  // --------- Località (già esistente) ----------
  function normLoc(rec) {
    const get = (k) => rec?.[k] ?? rec?.[k.toUpperCase()] ?? rec?.[k.toLowerCase()] ?? '';
    return {
      REGIONE: get('REGIONE'),
      COMUNE: get('COMUNE'),
      SIGLA_PROV: get('SIGLA_PROV') || get('PROV') || '',
      ISTAT: get('ISTAT') || get('CODICE_ISTAT') || '',
      ZONA_SISMICA: get('ZONA_SISMICA') || get('ZONA') || '',
      VENTO: toNum(get('VENTO')),
      CARICO_NEVE: toNum(get('CARICO_NEVE')),
      ALTITUDINE: toNum(get('ALTITUDINE')),
    };
  }
  function optionLabel(rec) {
    const prov = rec.SIGLA_PROV ? ` (${rec.SIGLA_PROV})` : '';
    return `${rec.COMUNE || '—'}${prov}`;
  }
  function meteoLines(rec) {
    if (!rec) return { l1: '—', l2: '—' };
    const neve = fmt2(rec.CARICO_NEVE);
    const vento = fmt2(rec.VENTO);
    const alt = fmt0(rec.ALTITUDINE);
    const zona = (rec.ZONA_SISMICA || '').toString().trim();
    const l1 = joinDot([`Neve ${neve} kg/m²`, `Vento ${vento} m/s`, `Alt ${alt} m`]);
    const l2 = joinDot([rec.REGIONE, rec.COMUNE, zona ? `Zona SISMICA ${zona}` : '', rec.ISTAT ? `ISTAT ${rec.ISTAT}` : '']);
    return { l1, l2: l2 || '—' };
  }
  function renderMeteo(rec) {
    const { l1, l2 } = meteoLines(rec);
    $('#meteo-pill-line1').textContent = l1;
    $('#meteo-pill-line2').textContent = l2;
  }

  // --------- Forme coperture (da TXT) ----------
  function loadFormeOptions() {
    const sel = $('#fld-forma');
    sel.innerHTML = '<option value="">Seleziona forma copertura…</option>';
    state.forme.forEach((f, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = f.label || f.forma || f.codice || `Forma #${idx+1}`;
      sel.appendChild(opt);
    });
  }
  function parseFormeRows(rows) {
    // compat: accetta intestazioni varie
    return rows.map(r => {
      const key = (k) => r[k] ?? r[k?.toUpperCase?.()] ?? r[k?.toLowerCase?.()];
      const label = key('LABEL') || key('NOME') || key('FORMA') || key('CODICE') || '';
      const forma = key('FORMA') || key('CODICE') || key('NOME') || '';
      // pendenza può essere "12" o "12%"
      let pend = key('PENDENZA_%') ?? key('PENDENZA') ?? key('SLOPE') ?? '';
      pend = String(pend).replace('%','').trim();
      const pendenza = toNum(pend);
      return { label, forma, pendenza }; // pendenza in %
    }).filter(x => (x.label || x.forma));
  }

  // --------- Scala €/kg (da TXT) ----------
  // supporta: (KGMQ_MIN,KGMQ_MAX,EURO_KG) oppure (SOGLIA_KGMQ,EURO_KG) oppure (KG_TOT_MIN,KG_TOT_MAX,EURO_KG)
  function euroKgFor(kgmq, kgTot) {
    if (!state.euroKgScale.length) return { euroKg: NaN, rule: '' };
    let best = null;
    state.euroKgScale.forEach(r => {
      const norm = {};
      Object.keys(r).forEach(k => norm[k.toUpperCase()] = r[k]);

      const euro = toNum(norm['EURO_KG']) ?? toNum(norm['EUROPERKG']) ?? toNum(norm['EURO']);
      if (!Number.isFinite(euro)) return;

      const kmin = toNum(norm['KGMQ_MIN']);
      const kmax = toNum(norm['KGMQ_MAX']);
      const soglia = toNum(norm['SOGLIA_KGMQ']) ?? toNum(norm['KGMQ']);
      const tmin = toNum(norm['KG_TOT_MIN']);
      const tmax = toNum(norm['KG_TOT_MAX']);

      let match = false;
      if (Number.isFinite(kmin) || Number.isFinite(kmax)) {
        match = ( (!Number.isFinite(kmin) || kgmq >= kmin) && (!Number.isFinite(kmax) || kgmq <= kmax) );
      } else if (Number.isFinite(soglia)) {
        match = (kgmq >= soglia);
      } else if (Number.isFinite(tmin) || Number.isFinite(tmax)) {
        match = ( (!Number.isFinite(tmin) || kgTot >= tmin) && (!Number.isFinite(tmax) || kgTot <= tmax) );
      }
      if (match) {
        // preferisci la regola più "specifica": range più stretto o soglia più alta
        const score =
          (Number.isFinite(kmin) || Number.isFinite(kmax)) ? ((kmax - kmin) || 0) * -1 :
          (Number.isFinite(soglia) ? soglia : 0) +
          (Number.isFinite(tmin) || Number.isFinite(tmax) ? ((tmax - tmin) || 0) * -0.1 : 0);
          if (!best || score > best.score) best = { euroKg: euro, rule: JSON.stringify(r), score };
      }
    });
    return best || { euroKg: NaN, rule: '' };
  }

  // --------- Scala Meteo % (da TXT nuovo) ----------
  // header consigliata: ALT_MIN;ALT_MAX;NEVE_MIN;NEVE_MAX;VENTO_MIN;VENTO_MAX;PERC
  // Si considerano TUTTE le righe che matchano (campi non presenti = wildcard) e si prende la PERC più alta.
  function meteoPercFor(alt, neve, vento) {
    if (!state.meteoCoeffScale.length) return { perc: 0, src: '—' };
    let bestPerc = 0, src = [];
    state.meteoCoeffScale.forEach(r => {
      const n = {};
      Object.keys(r).forEach(k => n[k.toUpperCase()] = r[k]);
      const p = toNum(n['PERC']) ?? toNum(n['PERCENTUALE']) ?? toNum(n['COEFF']);
      if (!Number.isFinite(p)) return;

      const altMin = toNum(n['ALT_MIN']), altMax = toNum(n['ALT_MAX']);
      const nvMin = toNum(n['NEVE_MIN']), nvMax = toNum(n['NEVE_MAX']);
      const veMin = toNum(n['VENTO_MIN']), veMax = toNum(n['VENTO_MAX']);

      const okAlt  = (!Number.isFinite(altMin) || alt >= altMin) && (!Number.isFinite(altMax) || alt <= altMax);
      const okNeve = (!Number.isFinite(nvMin)  || neve >= nvMin) && (!Number.isFinite(nvMax) || neve <= nvMax);
      const okVento= (!Number.isFinite(veMin)  || vento >= veMin) && (!Number.isFinite(veMax) || vento <= veMax);

      if (okAlt && okNeve && okVento) {
        if (p > bestPerc) { bestPerc = p; src = [JSON.stringify(r)]; }
      }
    });
    return { perc: bestPerc, src: src.join('') || '—' };
  }

  // ---------- Calcoli Struttura ----------
  function currentForma() {
    const sel = $('#fld-forma');
    const i = Number(sel.value);
    if (Number.isFinite(i) && state.forme[i]) return state.forme[i];
    return null;
  }
  function calc() {
    // lettura input (nessun default: NaN => 0 nei prodotti)
    const prezzo = toNum($('#fld-prezzo').value);
    const kgmq = toNum($('#fld-kgmq').value);
    const passo = toNum($('#fld-passo').value);
    const L = toNum($('#fld-lung').value);
    const W = toNum($('#fld-larg').value);
    const hTrave = toNum($('#fld-htrave').value);
    const sTestTxt = $('#fld-sforo-testata').value;
    const sGronTxt = $('#fld-sforo-gronda').value;

    // sfori: se scrivi "a+b" = somma (lati già esplicitati); se numero singolo = per lato (moltiplico ×2)
    const sT = sumPlusExpr(sTestTxt); const addL = sT.hadPlus ? sT.sum : (sT.sum * 2);
    const sG = sumPlusExpr(sGronTxt); const addW = sG.hadPlus ? sG.sum : (sG.sum * 2);

    const L_eff = Number.isFinite(L) ? (L + (Number.isFinite(addL) ? addL : 0)) : 0;
    const W_eff = Number.isFinite(W) ? (W + (Number.isFinite(addW) ? addW : 0)) : 0;

    // area lorda (L×W puro) e pianta (con sfori)
    const areaLorda = (Number.isFinite(L) && Number.isFinite(W)) ? (L * W) : 0;
    const copPianta = (Number.isFinite(L_eff) && Number.isFinite(W_eff)) ? (L_eff * W_eff) : 0;

    // pendenza dalla forma
    const forma = currentForma();
    const pend = forma && Number.isFinite(toNum(forma.pendenza)) ? toNum(forma.pendenza) : 0; // se manca, assumo 0% per falda (= pianta)
    const theta = Math.atan(pend / 100);
    const cosT = Math.cos(theta) || 1;
    const tanT = Math.tan(theta) || 0;

    const copFalda = copPianta / cosT;

    // altezza colmo
    const fName = (forma?.forma || forma?.label || '').toLowerCase();
    let hColmo = Number.isFinite(hTrave) ? hTrave : NaN;
    if (Number.isFinite(hTrave) && Number.isFinite(W)) {
      if (fName.includes('mono')) hColmo = hTrave + (W * tanT);
      else if (fName.includes('bi') || fName.includes('doppia')) hColmo = hTrave + ((W / 2) * tanT);
      else hColmo = hTrave; // piana o non determinata
    }
    $('#fld-hcolmo').value = Number.isFinite(hColmo) ? fmt2(hColmo) : '';

    // costi
    const costoBase = (Number.isFinite(prezzo) ? prezzo : 0) * copPianta;

    // Tot kg acciaio = copertura in pianta × kg/m²
    const totKg = (Number.isFinite(kgmq) ? kgmq : 0) * copPianta;

    // €/kg da scala
    const { euroKg, rule } = euroKgFor(kgmq, totKg);
    $('#hint-eurokg').textContent = Number.isFinite(euroKg) ? `(${fmt2(euroKg)} €/kg)` : '(€/kg non determinato)';
    const costoAcciaio = (Number.isFinite(euroKg) ? euroKg : 0) * totKg;

    // coeff meteo da scala (in %), basato su località selezionata
    const alt = state.selRec?.ALTITUDINE, neve = state.selRec?.CARICO_NEVE, vento = state.selRec?.VENTO;
    const { perc } = meteoPercFor(alt, neve, vento);  // es. 0.05..0.25
    $('#hint-meteo').textContent = Number.isFinite(perc) && perc>0
      ? `(${fmt2(perc*100)}%)`
      : '(0%)';
    const costoMeteo = (costoBase + costoAcciaio) * (Number.isFinite(perc) ? perc : 0);

    // totale
    const totale = costoBase + costoAcciaio + costoMeteo;

    // render KPI
    $('#kpi-area-lorda').textContent    = `${fmt2(areaLorda)} m²`;
    $('#kpi-cop-pianta').textContent    = `${fmt2(copPianta)} m²`;
    $('#kpi-cop-falda').textContent     = `${fmt2(copFalda)} m²`;
    $('#kpi-area-normativa').textContent= `0.00 m²`; // resta separata dai popolamenti
    $('#kpi-costo-base').textContent    = fmtMoney(costoBase);
    $('#kpi-costo-acciaio').textContent = fmtMoney(costoAcciaio);
    $('#kpi-costo-meteo').textContent   = fmtMoney(costoMeteo);
    $('#kpi-totale').textContent        = fmtMoney(totale);
  }

  function bindStruttura() {
    ['#fld-prezzo','#fld-kgmq','#fld-tipo','#fld-forma','#fld-passo','#fld-lung','#fld-larg',
     '#fld-htrave','#fld-sforo-testata','#fld-sforo-gronda','#fld-quota'].forEach(sel => {
      $(sel).addEventListener('input', calc);
      $(sel).addEventListener('change', calc);
    });
  }

  // ---------- Header / Tema ----------
  function initHeader() {
    const d = new Date();
    const rev = `Rev ${d.toLocaleDateString('it-IT')} · v1.0.1`;
    $('#bb-rev').textContent = rev;
    $('#btn-print').addEventListener('click', () => window.print());
    const applyTheme = () => {
      if (state.theme === 'dark') {
        document.documentElement.style.setProperty('--bg', '#0f1115');
        document.documentElement.style.setProperty('--panel', '#151922');
        document.documentElement.style.setProperty('--panel-2', '#10141b');
        document.documentElement.style.setProperty('--text', '#e6e6e6');
        document.documentElement.style.setProperty('--border', '#262b36');
        $('#btn-theme').textContent = '☀️';
      } else {
        document.documentElement.style.setProperty('--bg', '#f3f5f9');
        document.documentElement.style.setProperty('--panel', '#ffffff');
        document.documentElement.style.setProperty('--panel-2', '#f7f9fc');
        document.documentElement.style.setProperty('--text', '#1a1e27');
        document.documentElement.style.setProperty('--border', '#e5e9f2');
        $('#btn-theme').textContent = '🌙';
      }
    };
    applyTheme();
    $('#btn-theme').addEventListener('click', () => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('bb-theme', state.theme);
      applyTheme();
    });

    // Fallback logo
    const logo = $('#company-logo');
    if (logo) {
      const fallbacks = (logo.getAttribute('data-fallback') || '')
        .split(',').map(s => s.trim()).filter(Boolean);
      let idx = 0;
      const onErr = () => { if (idx < fallbacks.length) logo.src = fallbacks[idx++]; else logo.removeEventListener('error', onErr); };
      logo.addEventListener('error', onErr);
    }
  }

  // ---------- Boot ----------
  async function boot() {
    initHeader();

    // Data
    const d = new Date(), y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
    $('#fld-data').value = `${y}-${m}-${day}`;

    // Località (già esistente)
    try {
      const txt = await fetchWithFallback([
        'public/documenti/C-S-A-maggio-2025.txt',
        './public/documenti/C-S-A-maggio-2025.txt',
        '/public/documenti/C-S-A-maggio-2025.txt',
        'documenti/C-S-A-maggio-2025.txt'
      ]);
      const ds = parseTableTxt(txt);
      state.datasetLocalita = ds;
      const sel = $('#fld-localita');
      sel.innerHTML = '<option value="">Seleziona una località…</option>';
      ds.forEach((raw, i) => {
        const rec = normLoc(raw);
        const o = document.createElement('option');
        o.value = String(i);
        o.textContent = optionLabel(rec);
        sel.appendChild(o);
      });
      sel.disabled = false;
      sel.addEventListener('change', () => {
        const idx = Number(sel.value);
        state.selRec = (Number.isFinite(idx) && ds[idx]) ? normLoc(ds[idx]) : null;
        renderMeteo(state.selRec);
        calc();
      });
    } catch (_) {
      const sel = $('#fld-localita');
      sel.innerHTML = '<option value="">Dati località non disponibili</option>';
      sel.disabled = true;
      renderMeteo(null);
    }

    // Forme coperture
    const txtForme = await fetchWithFallback([
      'public/documenti/forme-coperture.txt',
      './public/documenti/forme-coperture.txt',
      '/public/documenti/forme-coperture.txt'
    ]);
    state.forme = parseFormeRows(parseTableTxt(txtForme));
    loadFormeOptions();

    // Scala €/kg
    const txtEuro = await fetchWithFallback([
      'public/documenti/euro_per_kg_scale.txt',
      './public/documenti/euro_per_kg_scale.txt',
      '/public/documenti/euro_per_kg_scale.txt'
    ]);
    state.euroKgScale = parseTableTxt(txtEuro);

    // Scala Meteo %
    const txtMeteo = await fetchWithFallback([
      'public/documenti/meteo_coeff_scale.txt',
      './public/documenti/meteo_coeff_scale.txt',
      '/public/documenti/meteo_coeff_scale.txt'
    ]);
    state.meteoCoeffScale = parseTableTxt(txtMeteo);

    bindStruttura();
    calc();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
