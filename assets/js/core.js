// assets/js/core.js

(function () {
  'use strict';

  // --- Stato semplice ---
  const state = {
    localitaDataset: [],
    selected: null,
    theme: (localStorage.getItem('theme') || 'dark'),
  };

  // --- Utils ---
  const $ = (sel) => document.querySelector(sel);

  const formatNumber = (v, decimals = 2) =>
    (Number.isFinite(+v) ? (+v).toFixed(decimals) : '—');

  const roundInt = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : '—';
  };

  // Unisce segmenti evitando separatori "appesi"
  const joinDot = (segments) => segments.filter(Boolean).join(' · ');

  // Parsing TXT con autodetect delimitatore, ignora # e righe vuote
  function parseTableTxt(txt) {
    if (!txt) return [];
    const lines = txt.split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('#'));
    if (lines.length === 0) return [];
    const headLine = lines[0];
    const delimiter = [ ';', ',', '\t', '|' ].reduce((best, d) => {
      const count = (headLine.match(new RegExp(`\\${d}`, 'g')) || []).length;
      return count > (best.count || -1) ? { d, count } : best;
    }, {}).d || ';';

    const headers = headLine.split(delimiter).map(h => h.trim());
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
      } catch (e) {
        console.warn('Fetch fallita per', p, e);
      }
    }
    throw new Error('Impossibile caricare il file di dati (tutti i fallback falliti).');
  }

  function normalizeRecord(rec) {
    // Normalizza keys attese
    const get = (k) => rec?.[k] ?? rec?.[k.toUpperCase()] ?? rec?.[k.toLowerCase()] ?? '';
    return {
      REGIONE: get('REGIONE'),
      COMUNE: get('COMUNE'),
      SIGLA_PROV: get('SIGLA_PROV') || get('PROV') || '',
      ISTAT: get('ISTAT') || get('CODICE_ISTAT') || get('COD_ISTAT') || '',
      ZONA_SISMICA: get('ZONA_SISMICA') || get('ZONA') || '',
      VENTO: parseFloat(get('VENTO')) || NaN,
      CARICO_NEVE: parseFloat(get('CARICO_NEVE')) || NaN,
      ALTITUDINE: parseFloat(get('ALTITUDINE')) || NaN,
    };
  }

  function optionLabel(rec) {
    const prov = rec.SIGLA_PROV ? ` (${rec.SIGLA_PROV})` : '';
    return `${rec.COMUNE || '—'}${prov}`;
  }

  // === Badge Meteo formatter (richiesta) ===
  function formatBadgeMeteo(rec) {
    if (!rec) return { line1: 'Dati meteo non disponibili', line2: '' };

    const neve = formatNumber(rec.CARICO_NEVE, 2);
    const vento = formatNumber(rec.VENTO, 2);
    const alt = roundInt(rec.ALTITUDINE);
    const zona = (rec.ZONA_SISMICA || '').toString().trim();

    // Linea 1: Neve … · Vento … · Alt … m [spazio se zona] Zona SISMICA <zona>
    const altZona = zona ? `Alt ${alt} m Zona SISMICA ${zona}` : `Alt ${alt} m`;
    const line1 = joinDot([
      `Neve ${neve} kg/m²`,
      `Vento ${vento} m/s`,
      altZona
    ]);

    // Linea 2: Regione · Comune · ISTAT n
    const linea2Segments = [
      rec.REGIONE,
      rec.COMUNE,
      rec.ISTAT ? `ISTAT ${rec.ISTAT}` : ''
    ];
    const line2 = joinDot(linea2Segments);

    return { line1, line2 };
  }

  function renderBadgeMeteo(rec) {
    const badge = $('#badge-meteo');
    const l1 = $('#badge-meteo-line1');
    const l2 = $('#badge-meteo-line2');
    if (!badge || !l1 || !l2) return;

    const { line1, line2 } = formatBadgeMeteo(rec);
    l1.textContent = line1;
    l2.textContent = line2;
  }

  function populateSelectLocalita(data) {
    const sel = $('#fld-localita');
    if (!sel) return;

    // Pulisce e popola
    sel.innerHTML = '';
    const frag = document.createDocumentFragment();

    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = 'Seleziona una località…';
    frag.appendChild(opt0);

    data.forEach((raw, idx) => {
      const rec = normalizeRecord(raw);
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = optionLabel(rec);
      opt.dataset.idx = idx;
      frag.appendChild(opt);
    });

    sel.appendChild(frag);
    sel.disabled = false;

    // Selezione iniziale (prima riga utile se esiste)
    const firstIdx = data.length > 0 ? 0 : -1;
    if (firstIdx >= 0) {
      sel.value = String(firstIdx);
      state.selected = normalizeRecord(data[firstIdx]);
      renderBadgeMeteo(state.selected);
    } else {
      renderBadgeMeteo(null);
    }

    sel.addEventListener('change', () => {
      const i = Number(sel.value);
      if (Number.isFinite(i) && data[i]) {
        state.selected = normalizeRecord(data[i]);
        renderBadgeMeteo(state.selected);
      }
    });
  }

  function initHeader() {
    const today = new Date();
    $('#rev-date').textContent = today.toLocaleDateString('it-IT');

    $('#btn-print')?.addEventListener('click', () => window.print());

    // Tema
    const applyTheme = () => {
      if (state.theme === 'light') {
        document.documentElement.style.setProperty('--bg', '#f6f7fb');
        document.documentElement.style.setProperty('--panel', '#ffffff');
        document.documentElement.style.setProperty('--panel-2', '#f3f5f9');
        document.documentElement.style.setProperty('--text', '#1a1d26');
        document.documentElement.style.setProperty('--border', '#e6e8ee');
        document.querySelector('#btn-theme').textContent = '☀️';
      } else {
        // ripristina dark
        document.documentElement.style.setProperty('--bg', '#0f1115');
        document.documentElement.style.setProperty('--panel', '#151922');
        document.documentElement.style.setProperty('--panel-2', '#10141b');
        document.documentElement.style.setProperty('--text', '#e6e6e6');
        document.documentElement.style.setProperty('--border', '#262b36');
        document.querySelector('#btn-theme').textContent = '🌙';
      }
    };
    applyTheme();

    $('#btn-theme')?.addEventListener('click', () => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', state.theme);
      applyTheme();
    });
  }

  async function boot() {
    initHeader();

    // Carica dataset Località (TXT nel repository) con fallback
    const paths = [
      'public/documenti/C-S-A-maggio-2025.txt',
      './public/documenti/C-S-A-maggio-2025.txt',
      '/public/documenti/C-S-A-maggio-2025.txt',
    ];

    try {
      const txt = await fetchWithFallback(paths);
      const dataset = parseTableTxt(txt);
      state.localitaDataset = dataset;
      populateSelectLocalita(dataset);
    } catch (err) {
      console.warn(err);
      // Fallback UI
      $('#fld-localita').innerHTML = '<option value="">Dati località non disponibili</option>';
      $('#fld-localita').disabled = true;
      renderBadgeMeteo(null);
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
