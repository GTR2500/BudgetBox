// ==== BudgetBox core (logo + meteo su 2 righe, ZONA in riga 2) ====
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  const state = {
    theme: (localStorage.getItem('bb-theme') || 'light'),
    datasetLocalita: [],
    selRec: null,
  };

  // --------- Utils ----------
  const fmt2 = (n) => Number.isFinite(+n) ? (+n).toFixed(2) : '—';
  const fmtMoney = (n) =>
    Number.isFinite(+n) ? (+n).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }) : '—';
  const round0 = (n) => Number.isFinite(+n) ? Math.round(+n) : '—';
  const joinDot = (arr) => arr.filter(Boolean).join(' · ');

  function todayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${da}`;
  }

  // TXT parser robusto
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
      headers.forEach((h, i) => rec[h] = cells[i] ?? '');
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
    throw new Error('Impossibile caricare file dati.');
  }

  // Normalizzazione record Località
  function normLoc(rec) {
    const get = (k) => rec?.[k] ?? rec?.[k.toUpperCase()] ?? rec?.[k.toLowerCase()] ?? '';
    return {
      REGIONE: get('REGIONE'),
      COMUNE: get('COMUNE'),
      SIGLA_PROV: get('SIGLA_PROV') || get('PROV') || '',
      ISTAT: get('ISTAT') || get('CODICE_ISTAT') || '',
      ZONA_SISMICA: get('ZONA_SISMICA') || get('ZONA') || '',
      VENTO: parseFloat(get('VENTO')),
      CARICO_NEVE: parseFloat(get('CARICO_NEVE')),
      ALTITUDINE: parseFloat(get('ALTITUDINE')),
    };
  }

  function optionLabel(rec) {
    const prov = rec.SIGLA_PROV ? ` (${rec.SIGLA_PROV})` : '';
    return `${rec.COMUNE || '—'}${prov}`;
  }

  // ---- Meteo pill formatter (2 righe; ZONA su riga 2) ----
  function meteoLines(rec) {
    if (!rec) return { l1: '—', l2: '—' };
    const neve = fmt2(rec.CARICO_NEVE);
    const vento = fmt2(rec.VENTO);
    const alt = round0(rec.ALTITUDINE);
    const zona = (rec.ZONA_SISMICA || '').toString().trim();

    // Riga 1: senza ZONA
    const l1 = joinDot([
      `Neve ${neve} kg/m²`,
      `Vento ${vento} m/s`,
      `Alt ${alt} m`
    ]);

    // Riga 2: Regione · Comune · Zona SISMICA … · ISTAT …
    const l2 = joinDot([
      rec.REGIONE,
      rec.COMUNE,
      zona ? `Zona SISMICA ${zona}` : '',
      rec.ISTAT ? `ISTAT ${rec.ISTAT}` : ''
    ]) || '—';

    return { l1, l2 };
  }

  function renderMeteo(rec) {
    const { l1, l2 } = meteoLines(rec);
    document.getElementById('meteo-pill-line1').textContent = l1;
    document.getElementById('meteo-pill-line2').textContent = l2;
  }

  function populateLocalita(ds) {
    const sel = document.getElementById('fld-localita');
    sel.innerHTML = '';
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = 'Seleziona una località…';
    sel.appendChild(opt0);

    ds.forEach((raw, i) => {
      const rec = normLoc(raw);
      const o = document.createElement('option');
      o.value = String(i);
      o.textContent = optionLabel(rec);
      sel.appendChild(o);
    });

    sel.disabled = false;
    if (ds.length) {
      sel.value = '0';
      state.selRec = normLoc(ds[0]);
      renderMeteo(state.selRec);
    } else {
      renderMeteo(null);
    }

    sel.addEventListener('change', () => {
      const idx = Number(sel.value);
      if (Number.isFinite(idx) && ds[idx]) {
        state.selRec = normLoc(ds[idx]);
        renderMeteo(state.selRec);
      }
    });
  }

  // ---- Calcoli rapidi sezione Struttura (layout originale) ----
  function recalcKpi() {
    const L = parseFloat(document.getElementById('fld-lung').value);
    const W = parseFloat(document.getElementById('fld-larg').value);
    const q = parseFloat(document.getElementById('fld-quota').value);
    const p = parseFloat(document.getElementById('fld-prezzo').value);

    const areaLorda = (Number.isFinite(L) && Number.isFinite(W)) ? (L * W) : 0;
    const areaDec = (Number.isFinite(areaLorda) && Number.isFinite(q)) ? (areaLorda * (q / 100)) : 0;
    const costo = (Number.isFinite(areaLorda) && Number.isFinite(p)) ? (areaLorda * p) : 0;

    document.getElementById('kpi-area-lorda').textContent = `${fmt2(areaLorda)} m²`;
    document.getElementById('kpi-area-decubito').textContent = `${fmt2(areaDec)} m²`;
    document.getElementById('kpi-area-normativa').textContent = `0.0 m²`;
    document.getElementById('kpi-costo').textContent = fmtMoney(costo);

    document.getElementById('state-pct').textContent = `(0%)`;
    const chip = document.getElementById('state-chip');
    chip.textContent = 'Non conforme';
    chip.className = 'bb-chip bb-chip--red';
  }

  function bindRecalc() {
    ['fld-lung','fld-larg','fld-quota','fld-prezzo'].forEach(id => {
      document.getElementById(id).addEventListener('input', recalcKpi);
    });
    document.getElementById('btn-check').addEventListener('click', recalcKpi);
  }

  function initHeader() {
    const d = new Date();
    const rev = `Rev ${d.toLocaleDateString('it-IT')} · v1.0.1`;
    document.getElementById('bb-rev').textContent = rev;

    document.getElementById('btn-print').addEventListener('click', () => window.print());

    const applyTheme = () => {
      if (state.theme === 'dark') {
        document.documentElement.style.setProperty('--bg', '#0f1115');
        document.documentElement.style.setProperty('--panel', '#151922');
        document.documentElement.style.setProperty('--panel-2', '#10141b');
        document.documentElement.style.setProperty('--text', '#e6e6e6');
        document.documentElement.style.setProperty('--border', '#262b36');
        document.getElementById('btn-theme').textContent = '☀️';
      } else {
        document.documentElement.style.setProperty('--bg', '#f3f5f9');
        document.documentElement.style.setProperty('--panel', '#ffffff');
        document.documentElement.style.setProperty('--panel-2', '#f7f9fc');
        document.documentElement.style.setProperty('--text', '#1a1e27');
        document.documentElement.style.setProperty('--border', '#e5e9f2');
        document.getElementById('btn-theme').textContent = '🌙';
      }
    };
    applyTheme();
    document.getElementById('btn-theme').addEventListener('click', () => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('bb-theme', state.theme);
      applyTheme();
    });

    // Fallback multipli per il logo
    const logo = document.getElementById('company-logo');
    if (logo) {
      const fallbacks = (logo.getAttribute('data-fallback')
