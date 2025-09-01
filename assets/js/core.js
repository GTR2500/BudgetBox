// ==== BudgetBox core — Struttura aggiornata (senza toccare le altre sezioni) ====
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);

  const state = {
    theme: (localStorage.getItem('bb-theme') || 'light'),
    datasetLocalita: [],
    selRec: null,
    forme: [],            // forme-coperture.txt
    euroKgScale: [],      // euro_per_kg_scale.txt
    kgmqScale: [],        // kgmq_scale.txt
    meteoCfg: null        // neve_vento_ricarico.txt
  };

  // ---------- Utils ----------
  const toNum = (v) => {
    if (v === null || v === undefined) return NaN;
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  };
  const fmt2 = (n) => Number.isFinite(+n) ? (+n).toFixed(2) : '—';
  const fmt0 = (n) => Number.isFinite(+n) ? Math.round(+n).toString() : '—';
  const money = (n) => Number.isFinite(+n) ? (+n).toLocaleString('it-IT',{style:'currency',currency:'EUR'}) : '0,00 €';
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

  function parseTableTxt(txt) {
    if (!txt) return [];
    const lines = txt.split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('#'));
    if (!lines.length) return [];
    const sep = [';','\t',',','|'].sort((a,b)=> (txt.split(a).length>txt.split(b).length?-1:1))[0];
    const headers = lines[0].split(sep).map(x=>x.trim());
    return lines.slice(1).map(line=>{
      const cells = line.split(sep).map(c=>c.trim());
      const o = {}; headers.forEach((h,i)=>o[h]=cells[i]??''); return o;
    });
  }
  async function fetchTxt(paths) {
    for (const p of paths) {
      try { const r = await fetch(p,{cache:'no-store'}); if (r.ok) return await r.text(); } catch(_) {}
    } return '';
  }

  // ---------- Header / Tema ----------
  function initHeader(){
    const d=new Date(); $('#bb-rev').textContent=`Rev ${d.toLocaleDateString('it-IT')} · v1.0.1`;
    $('#btn-print').addEventListener('click',()=>window.print());
    const apply=()=>{
      if(state.theme==='dark'){
        document.documentElement.style.setProperty('--bg','#0f1115');
        document.documentElement.style.setProperty('--panel','#151922');
        document.documentElement.style.setProperty('--panel-2','#10141b');
        document.documentElement.style.setProperty('--text','#e6e6e6');
        document.documentElement.style.setProperty('--border','#262b36');
        $('#btn-theme').textContent='☀️';
      }else{
        document.documentElement.style.setProperty('--bg','#f3f5f9');
        document.documentElement.style.setProperty('--panel','#ffffff');
        document.documentElement.style.setProperty('--panel-2','#f7f9fc');
        document.documentElement.style.setProperty('--text','#1a1e27');
        document.documentElement.style.setProperty('--border','#e5e9f2');
        $('#btn-theme').textContent='🌙';
      }
    };
    apply();
    $('#btn-theme').addEventListener('click',()=>{state.theme=state.theme==='light'?'dark':'light';localStorage.setItem('bb-theme',state.theme);apply();});
    const logo=$('#company-logo'); if(logo){ const fb=(logo.getAttribute('data-fallback')||'').split(',').map(s=>s.trim()).filter(Boolean); let i=0;
      const onErr=()=>{ if(i<fb.length) logo.src=fb[i++]; else logo.removeEventListener('error',onErr); };
      logo.addEventListener('error',onErr);
    }
  }

  // ---------- Località ----------
  function normLoc(rec){
    const g = (k)=> rec?.[k] ?? rec?.[k.toUpperCase()] ?? rec?.[k.toLowerCase()] ?? '';
    return {
      REGIONE: g('REGIONE'), COMUNE: g('COMUNE'), SIGLA_PROV: g('SIGLA_PROV')||g('PROV')||'',
      ISTAT: g('ISTAT')||g('CODICE_ISTAT')||'',
      ZONA_SISMICA: g('ZONA_SISMICA')||g('ZONA')||'',
      VENTO: toNum(g('VENTO')), CARICO_NEVE: toNum(g('CARICO_NEVE')), ALTITUDINE: toNum(g('ALTITUDINE')),
    };
  }
  function optionLabel(rec){ return `${rec.COMUNE||'—'}${rec.SIGLA_PROV?` (${rec.SIGLA_PROV})`:''}`;}
  function renderMeteo(rec){
    const neve = rec?fmt2(rec.CARICO_NEVE):'—';
    const vento = rec?fmt2(rec.VENTO):'—';
    const alt   = rec?fmt0(rec.ALTITUDINE):'—';
    $('#meteo-pill-line1').textContent = `Neve ${neve} kg/m² · Vento ${vento} m/s · Alt ${alt} m`;
    const zona = rec?.ZONA_SISMICA?`Zona SISMICA ${rec.ZONA_SISMICA}`:'';
    const ist  = rec?.ISTAT?`ISTAT ${rec.ISTAT}`:'';
    $('#meteo-pill-line2').textContent = [rec?.REGIONE, rec?.COMUNE, zona, ist].filter(Boolean).join(' · ') || '—';
  }

  // ---------- Forme copertura ----------
  function parseForme(txtRows){
    // file schema: id, roof_type, min_slope, max_slope, descrizione
    return txtRows.map(r=>{
      const U = (k)=> r[k] ?? r[k?.toUpperCase?.()] ?? r[k?.toLowerCase?.()];
      return {
        id: U('id'),
        roof_type: U('roof_type') || U('nome') || U('forma'),
        min: toNum(U('min_slope')),
        max: toNum(U('max_slope')),
        descr: U('descrizione') || ''
      };
    }).filter(f=>f.roof_type);
  }
  function setFormeSelect(){
    const sel=$('#fld-forma'); sel.innerHTML='<option value="">Seleziona…</option>';
    state.forme.forEach((f,i)=>{ const o=document.createElement('option'); o.value=String(i); o.textContent=f.roof_type; sel.appendChild(o); });
  }
  function currentForma(){
    const i=Number($('#fld-forma').value); if(Number.isFinite(i)&&state.forme[i]) return state.forme[i]; return null;
  }
  function slopeDeg(){
    const f=currentForma(); if(!f) return NaN;
    const hasMin=Number.isFinite(f.min), hasMax=Number.isFinite(f.max);
    if(hasMin && hasMax) return (f.min+f.max)/2;
    if(hasMin) return f.min;
    if(hasMax) return f.max;
    return 0;
  }
  function updateFormaHints(){
    const f=currentForma();
    const theta=slopeDeg();
    $('#hint-forma').textContent = Number.isFinite(theta) ? `Pendenza rif.: ${fmt2(theta)}°` : 'Pendenza rif.: —';
    $('#hint-forma-desc').textContent = f?.descr || '';
  }

  // ---------- Scale €/kg ----------
  function euroKgFromScale({areaPianta, kgTot, kgmq}){
    // accetta formati: AREA_MIN/AREA_MAX, KG_TOT_MIN/MAX, KGMQ_MIN/MAX
    let chosen = NaN;
    state.euroKgScale.forEach(r=>{
      const U=(k)=> r[k] ?? r[k?.toUpperCase?.()] ?? r[k?.toLowerCase?.()];
      const euro = toNum(U('EURO_KG')) ?? toNum(U('EURO'));
      if(!Number.isFinite(euro)) return;
      const aMin=toNum(U('AREA_MIN')), aMax=toNum(U('AREA_MAX'));
      const tMin=toNum(U('KG_TOT_MIN')), tMax=toNum(U('KG_TOT_MAX'));
      const qMin=toNum(U('KGMQ_MIN')), qMax=toNum(U('KGMQ_MAX'));
      let ok=false;
      if(Number.isFinite(aMin)||Number.isFinite(aMax)){
        ok = (!Number.isFinite(aMin)||areaPianta>=aMin) && (!Number.isFinite(aMax)||areaPianta<=aMax);
      } else if(Number.isFinite(tMin)||Number.isFinite(tMax)){
        ok = (!Number.isFinite(tMin)||kgTot>=tMin) && (!Number.isFinite(tMax)||kgTot<=tMax);
      } else if(Number.isFinite(qMin)||Number.isFinite(qMax)){
        ok = (!Number.isFinite(qMin)||kgmq>=qMin) && (!Number.isFinite(qMax)||kgmq<=qMax);
      }
      if(ok){ chosen = euro; }
    });
    return Number.isFinite(chosen) ? chosen : NaN;
  }

  // ---------- KGMQ scale ----------
  function kgmqFromScale({larghezza, colonne, hTrave}){
    // campata trasversale efficace
    const campata = Number.isFinite(larghezza) && Number.isFinite(colonne) ? (larghezza / (colonne + 1)) : NaN;
    let base = NaN;
    if(state.kgmqScale.length){
      // Trova coeff riga se presente
      let ALFA_H=0, H0=0, BETA_L=0, L0=0;
      state.kgmqScale.forEach(r=>{
        const h=Object.keys(r)[0];
        if(String(h).toLowerCase()==='coeff'){
          ALFA_H = toNum(r['ALFA_H']); H0 = toNum(r['H0']);
          BETA_L = toNum(r['BETA_L']); L0 = toNum(r['L0']);
        }
      });
      // righe campata
      let chosen=null;
      state.kgmqScale.forEach(r=>{
        if(String(Object.keys(r)[0]).toLowerCase()==='coeff') return;
        const U=(k)=> r[k] ?? r[k?.toUpperCase?.()] ?? r[k?.toLowerCase?.()];
        const cMax = toNum(U('CAMPATA_MAX_M'));
        const val  = toNum(U('KGMQ'));
        if(Number.isFinite(campata) && Number.isFinite(cMax) && campata<=cMax && chosen===null){
          chosen = {cMax,val};
        }
      });
      if(chosen){ base = chosen.val; }
      // aggiustamenti morbidi
      const extraH = (Number.isFinite(hTrave) && Number.isFinite(ALFA_H) && Number.isFinite(H0)) ? ALFA_H * Math.max(0, hTrave - H0) : 0;
      const extraL = (Number.isFinite(larghezza) && Number.isFinite(BETA_L) && Number.isFinite(L0)) ? BETA_L * Math.max(0, larghezza - L0) : 0;
      base = (Number.isFinite(base)?base:35) + (extraH||0) + (extraL||0);
    } else {
      // Fallback prudente se il TXT non è presente: mappa lineare su campata
      const c = campata;
      if(Number.isFinite(c)){
        if(c<=6) base=25; else if(c<=8) base=28; else if(c<=10) base=32; else if(c<=12) base=36; else if(c<=14) base=40; else base=45;
      } else base=35;
    }
    return clamp(base, 25, 45);
  }

  // ---------- Neve & vento percentuale ----------
  function ricaricoMeteoPct(neveKg, ventoMs){
    const cfg = state.meteoCfg || {BASE_NEVE:100,BASE_VENTO:25,PESO_NEVE:0.5,PESO_VENTO:0.5,MIN_PERC:0.05,MAX_PERC:0.25};
    const bn=toNum(cfg.BASE_NEVE), bv=toNum(cfg.BASE_VENTO), pn=toNum(cfg.PESO_NEVE), pv=toNum(cfg.PESO_VENTO),
          lo=toNum(cfg.MIN_PERC), hi=toNum(cfg.MAX_PERC);
    if(!Number.isFinite(neveKg) || !Number.isFinite(ventoMs)) return 0;
    const I_neve  = neveKg / (Number.isFinite(bn)?bn:100);
    const I_vento = Math.pow( ventoMs / (Number.isFinite(bv)?bv:25), 2 );
    const I = (Number.isFinite(pn)?pn:0.5)*I_neve + (Number.isFinite(pv)?pv:0.5)*I_vento;
    const min = Number.isFinite(lo)?lo:0.05, max=Number.isFinite(hi)?hi:0.25;
    return clamp( min + (max-min)*(I - 1), min, max );
  }

  // ---------- Calcoli struttura ----------
  function calc(){
    const L = toNum($('#fld-lung').value);
    const W = toNum($('#fld-larg').value);
    const passo = toNum($('#fld-passo').value);
    const nCampIn = toNum($('#fld-campate').value);
    const colonne = Math.max(0, toNum($('#fld-colonne').value));
    const hTrave = toNum($('#fld-htrave').value);
    const sfTest = Math.max(0, toNum($('#fld-sforo-testata').value));
    const sfGron = Math.max(0, toNum($('#fld-sforo-gronda').value));
    const quota  = toNum($('#fld-quota').value);

    // Campate (calcolo se non impostato)
    if(Number.isFinite(L) && Number.isFinite(passo) && passo>0 && !Number.isFinite(nCampIn)){
      $('#fld-campate').value = Math.max(1, Math.round(L / passo));
    }

    // Aree
    const areaLorda  = (Number.isFinite(L)&&Number.isFinite(W)) ? (L*W) : 0;
    const copPianta  = areaLorda; // sporti esclusi
    // Falda (include sporti + inclinazione)
    const thetaDeg = slopeDeg(); const theta = (Number.isFinite(thetaDeg)?(thetaDeg*Math.PI/180):0);
    const L_eff = (Number.isFinite(L)?L:0) + 2*(Number.isFinite(sfTest)?sfTest:0);
    const W_eff = (Number.isFinite(W)?W:0) + 2*(Number.isFinite(sfGron)?sfGron:0);
    const copFalda = (L_eff*W_eff) / (Math.cos(theta)||1);

    // Altezza colmo
    const fName = (currentForma()?.roof_type || '').toLowerCase();
    let hColmo = Number.isFinite(hTrave) ? hTrave : NaN;
    if(Number.isFinite(hTrave) && Number.isFinite(W)){
      if(fName.includes('mono')) hColmo = hTrave + W*Math.tan(theta);
      else if(fName.includes('bi')) hColmo = hTrave + (W/2)*Math.tan(theta);
      else hColmo = hTrave;
    }
    $('#fld-hcolmo').value = Number.isFinite(hColmo)?fmt2(hColmo):'';

    // kg/m²
    let kgmq = toNum($('#fld-kgmq').value);
    if(!Number.isFinite(kgmq) || kgmq<=0){
      kgmq = kgmqFromScale({larghezza:W, colonne, hTrave});
      $('#fld-kgmq').value = fmt2(kgmq);
      $('#hint-kgmq').textContent = `campata=${Number.isFinite(W)?fmt2(W/(colonne+1)):'—'} m · colonne=${Number.isFinite(colonne)?colonne:0}`;
    }

    // Tot kg & €/kg & Prezzo €/m²
    const totKg = copPianta * (Number.isFinite(kgmq)?kgmq:0);
    const euroKg = euroKgFromScale({areaPianta:copPianta, kgTot:totKg, kgmq});
    $('#fld-eurokg').value = Number.isFinite(euroKg)?fmt2(euroKg):'';
    const prezzoMq = (Number.isFinite(euroKg)?euroKg:0) * (Number.isFinite(kgmq)?kgmq:0);
    $('#fld-prezzo').value = fmt2(prezzoMq);
    $('#hint-prezzo').textContent = `${Number.isFinite(euroKg)?fmt2(euroKg):'—'} €/kg × ${Number.isFinite(kgmq)?fmt2(kgmq):'—'} kg/m²`;

    // Costi
    // Costo base = Totale kg × €/kg  (come da tua specifica)
    const costoBase = (Number.isFinite(totKg)?totKg:0) * (Number.isFinite(euroKg)?euroKg:0);

    // Neve & vento
    const neve = state.selRec?.CARICO_NEVE, vento = state.selRec?.VENTO;
    const perc = ricaricoMeteoPct(neve, vento);
    $('#hint-meteo').textContent = Number.isFinite(perc)?`(${fmt2(perc*100)}%)`:'(—)';
    const costoMeteo = (costoBase) * (Number.isFinite(perc)?perc:0);

    // Totale
    const totale = costoBase + costoMeteo;

    // Render KPI
    $('#kpi-area-lorda').textContent = `${fmt2(areaLorda)} m²`;
    $('#kpi-cop-pianta').textContent = `${fmt2(copPianta)} m²`;
    $('#kpi-cop-falda').textContent = `${fmt2(copFalda)} m²`;
    $('#kpi-area-normativa').textContent = `0.00 m²`; // invariato, si aggancerà ai box popolazioni
    $('#kpi-totkg').textContent = `${Math.round(totKg)} kg`;
    $('#kpi-costo-base').textContent = money(costoBase);
    $('#kpi-costo-meteo').textContent = money(costoMeteo);
    $('#kpi-totale').textContent = money(totale);

    // forma hint
    updateFormaHints();
  }

  function bindStruttura(){
    [
      '#fld-tipo','#fld-forma','#fld-passo','#fld-lung','#fld-larg','#fld-colonne',
      '#fld-htrave','#fld-sforo-testata','#fld-sforo-gronda','#fld-kgmq','#fld-campate','#fld-quota'
    ].forEach(sel=>{
      $(sel).addEventListener('input', calc);
      $(sel).addEventListener('change', calc);
    });
  }

  // ---------- Boot ----------
  async function boot(){
    initHeader();

    // Data & Località
    const d=new Date(), y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
    $('#fld-data').value = `${y}-${m}-${day}`;

    const txtLoc = await fetchTxt([
      'public/documenti/C-S-A-maggio-2025.txt',
      './public/documenti/C-S-A-maggio-2025.txt',
      '/public/documenti/C-S-A-maggio-2025.txt'
    ]);
    const ds=parseTableTxt(txtLoc); state.datasetLocalita=ds;
    const sel=$('#fld-localita');
    sel.innerHTML='<option value="">Seleziona una località…</option>';
    ds.forEach((raw,i)=>{ const rec=normLoc(raw); const o=document.createElement('option'); o.value=String(i); o.textContent=optionLabel(rec); sel.appendChild(o); });
    sel.addEventListener('change',()=>{ const i=Number(sel.value); state.selRec=(Number.isFinite(i)&&ds[i])?normLoc(ds[i]):null; renderMeteo(state.selRec); calc(); });

    // Forme
    const txtForme = await fetchTxt([
      'public/documenti/forme-coperture.txt',
      './public/documenti/forme-coperture.txt',
      '/public/documenti/forme-coperture.txt'
    ]);
    state.forme = parseForme(parseTableTxt(txtForme)); setFormeSelect();

    // Scale
    const txtEuro = await fetchTxt([
      'public/documenti/euro_per_kg_scale.txt',
      './public/documenti/euro_per_kg_scale.txt',
      '/public/documenti/euro_per_kg_scale.txt'
    ]);
    state.euroKgScale = parseTableTxt(txtEuro);

    const txtKgmq = await fetchTxt([
      'public/documenti/kgmq_scale.txt',
      './public/documenti/kgmq_scale.txt',
      '/public/documenti/kgmq_scale.txt'
    ]);
    state.kgmqScale = parseTableTxt(txtKgmq);

    const txtMet = await fetchTxt([
      'public/documenti/neve_vento_ricarico.txt',
      './public/documenti/neve_vento_ricarico.txt',
      '/public/documenti/neve_vento_ricarico.txt'
    ]);
    if(txtMet){
      state.meteoCfg = {};
      txtMet.split(/\r?\n/).forEach(line=>{
        const s=line.trim(); if(!s || s.startsWith('#') || !s.includes('=')) return;
        const [k,v]=s.split('=');
        state.meteoCfg[k.trim()] = v.trim();
      });
    }

    bindStruttura();
    renderMeteo(null);
    calc();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
