/* BudgetBox – Pagina 1
   Badge "X capi" verdi quando > 0. Altezza colmo calcolata, pendenza da TXT.
   Rev: v0.1.7
*/
(function (global) {
  var APP_VERSION = "v0.1.7";

  // ---------- STATO ----------
  var state = {
    anagrafica: { cliente:"", localitaId:"", localita:"", riferimento:"", data: new Date().toISOString().slice(0,10) },
    cap: {
      tipoId:"acciaio_zincato",
      forma:"bifalda",        // piano | monofalda | bifalda | dente_sega | cattedrale
      prezzoMq:180,
      kgBase:34,
      lunghezza:60,
      larghezza:25,
      campN:0,
      campInt:0,
      hTrave:0,               // quota alla gronda (punto più basso)
      spTest:0,               // sporto testata (fronte+retro)
      spGr:0,                 // sporto gronda (sx+dx)
      quotaDecubito:70,
      note:"Struttura metallica zincata, copertura sandwich 40 mm"
    },
    meteo: { neve_kgm2:0, vento_ms:0, alt_m:0, regione:"", provincia:"", istat:"", zonaSismica:"" },
    popolazioni: {
      bovineAdulte:{ n:0, stab:"lettiera", livello:"Adeguato" },
      manzeBovine:{ n:0, stab:"lettiera", livello:"Adeguato" },
      toriRimonta:{ n:0, stab:"libera",   livello:"Adeguato" },
      bufaleAdulte:{ n:0, stab:"lettiera", livello:"Adeguato" },
      bufaleParto:{ n:0, stab:"lettiera", livello:"Adeguato" },
      manzeBufaline:{ n:0, stab:"lettiera", livello:"Adeguato" },
      ingrasso:{ gruppi:0, capiPerGruppo:0, peso:550, livello:"Adeguato" }
    }
  };

  var norme = null;
  var localitaDB = [];
  var FORME = []; // da TXT

  // ---------- UTILS ----------
  function num(v){ return Number(v||0); }
  function fmt1(v){ return (Math.round(v*10)/10).toFixed(1); }
  function fmt2(v){ return (Math.round(v*100)/100).toFixed(2); }
  function byId(id){ return document.getElementById(id); }
  function repoName(){ var seg=location.pathname.split("/").filter(Boolean); return seg.length>=2?seg[1]:(seg[0]||"BudgetBox"); }

  function fetchFirst(paths, asText){
    var getter = asText ? function(r){ return r.text(); } : function(r){ return r.json(); };
    var chain = Promise.reject();
    paths.forEach(function(path){
      chain = chain.catch(function(){
        return fetch(path, {cache:"no-store"}).then(function(r){
          if(!r.ok) throw new Error("HTTP "+r.status+" @ "+path);
          return getter(r);
        });
      });
    });
    return chain;
  }

  // ---------- PARSER LOCALITÀ ----------
  function parseLocalitaTxt(txt){
    var lines = txt.split(/\r?\n/).map(function(l){return l.trim();})
      .filter(Boolean).filter(function(l){return !/^#|^\/\//.test(l);});
    if (!lines.length) return [];
    var cand = [";","\t",",","|"];
    var delim = cand.find(function(d){ return (lines[0].indexOf(d)!==-1); }) || ";";
    var head = lines[0].split(delim).map(function(s){return s.trim();});
    var H = head.map(function(h){return h.toUpperCase();});
    var start = 1;
    function idx(names, fallback){
      for (var i=0;i<H.length;i++) for (var j=0;j<names.length;j++)
        if (H[i]===names[j] || H[i].indexOf(names[j])>=0) return i;
      return fallback;
    }
    var iReg  = idx(["REGIONE"], 0);
    var iProv = idx(["PROV_CITTA_METROPOLITANA","PROVINCIA","PROV"], 1);
    var iSig  = idx(["SIGLA_PROV","SIGLA PROV"], 2);
    var iCom  = idx(["COMUNE"], 3);
    var iIstat= idx(["COD_ISTAT_COMUNE","ISTAT"], 4);
    var iSism = idx(["ZONA_SISMICA","ZONA SISMICA"], 5);
    var iVento= idx(["VENTO"], 6);
    var iNeve = idx(["CARICO_NEVE","CARICO NEVE","NEVE"], 7);
    var iAlt  = idx(["ALTITUDINE","QUOTA"], 8);

    var out=[];
    for (var r=start;r<lines.length;r++){
      var cols = lines[r].split(delim).map(function(s){return s.trim();});
      if (!cols[iIstat]) continue;
      var rec = {
        regione: cols[iReg]||"",
        provincia: cols[iProv]||"",
        sigla: (cols[iSig]||"").toUpperCase(),
        comune: cols[iCom]||"",
        istat: cols[iIstat]||"",
        zonaSismica: cols[iSism]||"",
        vento_ms: Number((cols[iVento]||"").replace(",",".")) || 0,
        neve_kgm2: Number((cols[iNeve]||"").replace(",",".")) || 0,
        alt_m: Number((cols[iAlt]||"").replace(",",".")) || 0
      };
      rec.nome = rec.comune + (rec.sigla ? (" ("+rec.sigla+")") : "");
      rec.id = rec.istat;
      out.push(rec);
    }
    return out.sort(function(a,b){ return a.nome.localeCompare(b.nome,"it"); });
  }

  // ---------- PARSER FORME (TXT) ----------
  function canonicalId(label){
    var s = (label||"").toLowerCase();
    if (s.indexOf("piano")>=0) return "piano";
    if (s.indexOf("monofalda")>=0 || s.indexOf("shed")>=0) return "monofalda";
    if (s.indexOf("bifalda")>=0 || s.indexOf("capanna")>=0) return "bifalda";
    if (s.indexOf("dente")>=0 || s.indexOf("sawtooth")>=0) return "dente_sega";
    if (s.indexOf("cattedrale")>=0 || s.indexOf("capriate")>=0) return "cattedrale";
    return s.replace(/\s+/g,"_").replace(/[^\w]/g,"");
  }
  function parseFormeTxt(txt){
    var lines = txt.split(/\r?\n/).map(function(l){return l.trim();})
      .filter(Boolean).filter(function(l){return !/^#|^\/\//.test(l);});
    if (!lines.length) return [];
    var delim = ["\t",";","|",","].find(function(d){return lines[0].indexOf(d)!==-1;}) || "\t";
    var head = lines[0].split(delim).map(function(s){return s.trim().toLowerCase();});
    var iType = head.indexOf("roof_type");
    var iMin  = head.indexOf("min_slope");
    var iMax  = head.indexOf("max_slope");
    var iDesc = head.indexOf("descrizione");
    var out=[];
    for (var i=1;i<lines.length;i++){
      var c = lines[i].split(delim);
      var label = (c[iType]||"").trim();
      if (!label) continue;
      out.push({
        id: canonicalId(label),
        label: label,
        minSlopePct: Number(c[iMin]||0),
        maxSlopePct: Number(c[iMax]||0),
        descr: (c[iDesc]||"").trim()
      });
    }
    return out;
  }

  // ---------- GEOMETRIA ----------
  function lengthFromCampate(){
    var n=num(state.cap.campN), p=num(state.cap.campInt);
    if(n>0 && p>0) return n*p; return num(state.cap.lunghezza);
  }
  function covDims(){
    var Lcov = num(state.cap.lunghezza) + 2*num(state.cap.spTest);
    var Wcov = num(state.cap.larghezza) + 2*num(state.cap.spGr);
    return {Lcov:Lcov, Wcov:Wcov};
  }
  function areaLorda(){ return num(state.cap.larghezza) * num(state.cap.lunghezza); }
  function areaCoperta(){ var d=covDims(); return d.Lcov * d.Wcov; }

  function estimatedSlopePct(){
    var f = FORME.find(function(x){return x.id===state.cap.forma;});
    if (!f) f = {minSlopePct:0, maxSlopePct:0};
    var min = num(f.minSlopePct), max = num(f.maxSlopePct);
    if (max < min) max = min;
    var base = (min + max) / 2;
    var sc = norme.neve_vento_percent && norme.neve_vento_percent.scales || {};
    var neveN  = sc.neve  && sc.neve.max  ? Math.max(0, Math.min(1, num(state.meteo.neve_kgm2)/num(sc.neve.max)))   : 0;
    var ventoN = sc.vento && sc.vento.max ? Math.max(0, Math.min(1, num(state.meteo.vento_ms)/num(sc.vento.max))) : 0;
    var adj = (neveN - ventoN) * (max - min) * 0.25;
    return Math.max(min, Math.min(max, base + adj));
  }

  function altezzaColmo(){
    var d = covDims(), W = d.Wcov;
    var slope = estimatedSlopePct(); // %
    var rise;
    if (state.cap.forma === "monofalda" || state.cap.forma === "piano"){
      rise = W * slope / 100;
    } else {
      rise = (W/2) * slope / 100;
    }
    return num(state.cap.hTrave) + rise;
  }

  function areaFalda(){
    var d = covDims();
    var slope = estimatedSlopePct();
    var sec = Math.sqrt(1 + Math.pow(slope/100, 2)); // 1/cos
    return d.Lcov * d.Wcov * sec;
  }

  // ---------- NORME POPOLAZIONI ----------
  function ingrassoMqPerCapo(peso){
    var arr = norme.ingrasso.mq_per_capo;
    for (var i=0;i<arr.length;i++){ if(peso<=arr[i].maxPesoKg) return arr[i].mq; }
    return arr[arr.length-1].mq;
  }
  function areaNormativaRichiesta(){
    var u=norme.unitari_mq, p=state.popolazioni;
    var base = num(p.bovineAdulte.n)*u.bovineAdulte + num(p.manzeBovine.n)*u.manzeBovine +
               num(p.toriRimonta.n)*u.toriRimonta   + num(p.bufaleAdulte.n)*u.bufaleAdulte +
               num(p.bufaleParto.n)*u.bufaleParto   + num(p.manzeBufaline.n)*u.manzebufaline;
    var nIng = num(p.ingrasso.gruppi)*num(p.ingrasso.capiPerGruppo);
    var mqIng = nIng*ingrassoMqPerCapo(num(p.ingrasso.peso));
    return base + mqIng;
  }

  // ---------- COSTI ----------
  function eurPerKgByArea(A){
    var scale = (norme.euro_per_kg_scale||[]).slice().sort(function(a,b){ return a.minArea_m2-b.minArea_m2; });
    var v = 0;
    for (var i=0;i<scale.length;i++){ if (A >= num(scale[i].minArea_m2)) v = num(scale[i].eurPerKg); }
    return v;
  }
  function neveVentoPercent(){
    var cfg = norme.neve_vento_percent || {};
    var w = cfg.weights || {};
    var sc = cfg.scales || {};
    var minP = num(cfg.min_pct||3), maxP = num(cfg.max_pct||15);
    var neveN  = sc.neve  && sc.neve.max  ? Math.max(0, Math.min(1, num(state.meteo.neve_kgm2)/num(sc.neve.max)))   : 0;
    var ventoN = sc.vento && sc.vento.max ? Math.max(0, Math.min(1, num(state.meteo.vento_ms)/num(sc.vento.max))) : 0;
    var altN   = sc.altitudine && sc.altitudine.max ? Math.max(0, Math.min(1, num(state.meteo.alt_m)/num(sc.altitudine.max))) : 0;
    var sisN   = 0;
    if (sc.sismica && sc.sismica.map){
      var z = (state.meteo.zonaSismica||"").toString().trim();
      sisN = num(sc.sismica.map[z] != null ? sc.sismica.map[z] : sc.sismica.map[""]);
      sisN = Math.max(0, Math.min(1, sisN));
    }
    var formaBonus = 0;
    if (cfg.forma_bonus){ var fb = cfg.forma_bonus[state.cap.forma]; if (fb != null) formaBonus = num(fb); }
    var score = neveN*(w.neve||0) + ventoN*(w.vento||0) + altN*(w.altitudine||0) + sisN*(w.sismica||0) + formaBonus*(w.forma_bonus||0);
    score = Math.max(0, Math.min(1, score));
    return minP + (maxP - minP) * score;
  }
  function costoStruttura(){
    var AC = areaCoperta();
    var base = AC * num(state.cap.prezzoMq);
    var eurKg = eurPerKgByArea(AC);
    var costKg = AC * num(state.cap.kgBase) * eurKg;
    var pct = neveVentoPercent();
    var extra = (base + costKg) * pct / 100;
    return { base: base, kg: costKg, extraPct: pct, extraEuro: extra, totale: base + costKg + extra };
  }
  function conformita(){
    var req=areaNormativaRichiesta(), real=areaLorda()*num(state.cap.quotaDecubito)/100;
    if(req===0 && real===0) return {stato:"—", pct:100};
    var ratio = req>0 ? real/req : 0;
    var stato = ratio>=1.1 ? "Adeguato" : (ratio>=1.0 ? "Conforme") : "Non conforme";
    return {stato:stato, pct: Math.round(ratio*100)};
  }

  // ---------- SCHIZZO (compatto) ----------
  function sketch(forma){
    var c = "currentColor";
    if(forma==="piano"){
      return '<svg width="120" height="60" viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="45" width="100" height="6" stroke="'+c+'" stroke-width="2" fill="none"/></svg>';
    }
    if(forma==="monofalda"){
      return '<svg width="120" height="60" viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 48 L100 30 L100 36 L10 54 Z" stroke="'+c+'" stroke-width="2" fill="none"/></svg>';
    }
    if(forma==="dente_sega"){
      return '<svg width="120" height="60" viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 50 L35 35 L60 50 L85 35 L110 50" stroke="'+c+'" stroke-width="2" fill="none"/></svg>';
    }
    if(forma==="cattedrale"){
      return '<svg width="120" height="60" viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 50 L60 28 L110 50" stroke="'+c+'" stroke-width="2" fill="none"/><path d="M35 50 L60 39 L85 50" stroke="'+c+'" stroke-width="2" fill="none"/></svg>';
    }
    return '<svg width="120" height="60" viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 50 L60 28 L110 50" stroke="'+c+'" stroke-width="2" fill="none"/></svg>';
  }

  // ---------- UI ----------
  function updateLocBadge(){
    var badge = byId("badge-meteo"); if(!badge) return;
    var id = state.anagrafica.localitaId;
    var L = localitaDB.find(function(x){return x.id===id;});
    if (!L){ badge.textContent="—"; badge.className="badge meta"; return; }
    var r1 = "ZONA_SISMICA: " + (L.zonaSismica||"—") +
             "; VENTO: " + fmt2(num(L.vento_ms)) + " m/s" +
             "; CARICO_NEVE: " + fmt2(num(L.neve_kgm2)) + " kg/m²" +
             "; ALTITUDINE: " + Math.round(num(L.alt_m)) + " m";
    var r2 = "REGIONE: " + (L.regione||"—") +
             "; PROV_CITTA_METROPOLITANA: " + (L.provincia||"—") +
             "; COD_ISTAT_COMUNE: " + (L.istat||"—");
    badge.innerHTML = '<span class="bline">'+r1+'</span><span class="bline">'+r2+'</span>';
    badge.className = "badge meta";
  }

  // >>> qui la modifica: badge verde se val > 0
  function setCapBadge(id, val){
    var el = byId(id);
    if (!el) return;
    var n = num(val)||0;
    el.textContent = n + " capi";
    el.className = n > 0 ? "badge ok" : "badge";
  }

  function refresh(){
    // lunghezza da campate se presente
    var Lcalc = lengthFromCampate();
    var lenNote = byId("lenNote");
    if(lenNote){ lenNote.textContent = (num(state.cap.campN)>0 && num(state.cap.campInt)>0) ? ("L calcolata: "+fmt2(Lcalc)+" m") : ""; }
    if(num(state.cap.campN)>0 && num(state.cap.campInt)>0){ state.cap.lunghezza = Lcalc; var lenEl=byId("len"); if(lenEl) lenEl.value=fmt2(Lcalc); }

    var AL = areaLorda();
    var AC = areaCoperta();
    var AF = areaFalda();
    var AN = areaNormativaRichiesta();
    var CT = costoStruttura();

    var elAL = byId("areaLorda");      if (elAL) elAL.textContent = fmt1(AL);
    var elAC = byId("areaCoperta");    if (elAC) elAC.textContent = fmt1(AC);
    var elAF = byId("areaFalda");      if (elAF) elAF.textContent = fmt1(AF);
    var elAN = byId("areaNormativa");  if (elAN) elAN.textContent = fmt1(AN);

    var cf = conformita();
    var badge = byId("badge"); if (badge){
      var cls="badge";
      if (cf.stato==="Adeguato") cls+=" ok";
      else if (cf.stato==="Conforme") cls+=" mid";
      else if (cf.stato==="Non conforme") cls+=" ko";
      badge.className=cls; badge.textContent=cf.stato;
    }
    var pct = byId("badgePct"); if (pct) pct.textContent = cf.pct+"%";

    var elCMq = byId("costoMq");  if(elCMq) elCMq.textContent = CT.base.toLocaleString("it-IT",{style:"currency",currency:"EUR"});
    var elCKg = byId("costoKg");  if(elCKg) elCKg.textContent = CT.kg.toLocaleString("it-IT",{style:"currency",currency:"EUR"});
    var elEX  = byId("extraMeteo"); if(elEX) elEX.textContent = fmt2(CT.extraPct) + "% — " + CT.extraEuro.toLocaleString("it-IT",{style:"currency",currency:"EUR"});
    var elCT  = byId("costoStruttura"); if(elCT) elCT.textContent = CT.totale.toLocaleString("it-IT",{style:"currency",currency:"EUR"});

    // campo Altezza colmo
    var hCol = byId("hColmoVal");
    if (hCol) hCol.value = fmt2(altezzaColmo());

    // badge capi per ogni specie
    setCapBadge("cap-bovineAdulte", state.popolazioni.bovineAdulte.n);
    setCapBadge("cap-manzeBovine",  state.popolazioni.manzeBovine.n);
    setCapBadge("cap-toriRimonta",  state.popolazioni.toriRimonta.n);
    setCapBadge("cap-bufaleAdulte", state.popolazioni.bufaleAdulte.n);
    setCapBadge("cap-bufaleParto",  state.popolazioni.bufaleParto.n);
    setCapBadge("cap-manzeBufaline",state.popolazioni.manzeBufaline.n);
    var nIng = num(state.popolazioni.ingrasso.gruppi)*num(state.popolazioni.ingrasso.capiPerGruppo);
    setCapBadge("cap-ingrasso", nIng);

    var ok = (state.anagrafica.cliente||"").trim().length>0 && num(state.cap.lunghezza)>0 && num(state.cap.larghezza)>0;
    var next = byId("btn-next"); if (next) next.disabled = !ok;
  }

  function loadFormeSelect(){
    var sel = byId("formaCopertura");
    var descr = byId("formaDescr");
    if (!sel) return;
    var list = FORME.length ? FORME : (norme.forme_copertura||[]);
    if (!list.length){ sel.innerHTML='<option value="bifalda">bifalda</option>'; }
    else sel.innerHTML = list.map(function(f){ return '<option value="'+f.id+'">'+(f.label||f.id)+'</option>'; }).join("");

    if (!list.find(function(x){return x.id===state.cap.forma;})) state.cap.forma = list[0].id;
    sel.value = state.cap.forma;

    if (descr){
      var cur = list.find(function(x){return x.id===state.cap.forma;});
      descr.textContent = cur && cur.descr ? cur.descr : "";
    }
    var sk  = byId("sketch"); if(sk){ sk.innerHTML = sketch(state.cap.forma); }

    sel.addEventListener("change", function(){
      state.cap.forma = sel.value;
      var cur = list.find(function(x){return x.id===state.cap.forma;});
      if (descr) descr.textContent = cur && cur.descr ? cur.descr : "";
      var sk  = byId("sketch"); if(sk){ sk.innerHTML = sketch(state.cap.forma); }
      refresh();
    });
  }

  // ---------- INIT ----------
  function initPagina1(){
    Promise.all([
      fetchFirst(["./assets/data/norme.json","assets/data/norme.json","/assets/data/norme.json"], false),
      fetchFirst(["public/documenti/C-S-A-maggio-2025.txt","./public/documenti/C-S-A-maggio-2025.txt","/public/documenti/C-S-A-maggio-2025.txt"], true),
      fetchFirst(["public/documenti/forme-coperture.txt","./public/documenti/forme-coperture.txt","/public/documenti/forme-coperture.txt"], true)
    ])
    .then(function(res){
      norme = res[0];
      localitaDB = parseLocalitaTxt(res[1]);
      FORME = parseFormeTxt(res[2]);

      // header
      var titleEl = byId("title"); if (titleEl) titleEl.textContent = repoName();
      var revDate = byId("revDate"); if (revDate) revDate.textContent = new Date().toLocaleDateString("it-IT");
      var revVer  = byId("revVer");  if (revVer)  revVer.textContent  = APP_VERSION;

      // tema & print
      document.documentElement.setAttribute("data-theme","light");
      var themeBtn = byId("themeBtn"); if (themeBtn) themeBtn.addEventListener("click", function(){
        var isLight = document.documentElement.getAttribute("data-theme")==="light";
        document.documentElement.setAttribute("data-theme", isLight ? "dark" : "light");
        themeBtn.textContent = isLight ? "☀️" : "🌙";
      });
      var printBtn = byId("printBtn"); if (printBtn) printBtn.addEventListener("click", function(){ window.print(); });

      // Anagrafica
      var elCli = byId("cli"), elRif=byId("rif"), elDat=byId("dat"), elLoc=byId("fld-localita");
      if (elDat) elDat.value = state.anagrafica.data;
      if (elCli){ elCli.addEventListener("input", function(e){ state.anagrafica.cliente=e.target.value; refresh(); }); }
      if (elRif){ elRif.addEventListener("input", function(e){ state.anagrafica.riferimento=e.target.value; }); }
      if (elDat){ elDat.addEventListener("input", function(e){ state.anagrafica.data=e.target.value; }); }

      if (elLoc){
        elLoc.innerHTML = '<option value="">— Seleziona località —</option>' +
          localitaDB.map(function(L){ return '<option value="'+L.id+'">'+L.nome+'</option>'; }).join("");
        elLoc.addEventListener("change", function(){
          var L = localitaDB.find(function(x){return x.id===elLoc.value;});
          if (!L){
            state.anagrafica.localitaId=""; state.anagrafica.localita="";
            state.meteo={neve_kgm2:0,vento_ms:0,alt_m:0,regione:"",provincia:"",istat:"",zonaSismica:""};
            updateLocBadge(); refresh(); return;
          }
          state.anagrafica.localitaId = L.id;
          state.anagrafica.localita   = L.nome;
          state.meteo.neve_kgm2 = num(L.neve_kgm2);
          state.meteo.vento_ms  = num(L.vento_ms);
          state.meteo.alt_m     = num(L.alt_m);
          state.meteo.regione   = L.regione||"";
          state.meteo.provincia = L.provincia||"";
          state.meteo.istat     = L.istat||"";
          state.meteo.zonaSismica = L.zonaSismica||"";
          updateLocBadge(); refresh();
        });
      }
      updateLocBadge();

      // Forma copertura da TXT
      loadFormeSelect();

      // Tipo struttura (unico per ora)
      var tipoSel = byId("tipoStruttura");
      if (tipoSel){
        tipoSel.innerHTML = '<option value="acciaio_zincato">Struttura metallica zincata</option>';
        tipoSel.value = state.cap.tipoId;
      }

      // Default da norme
      var s0 = (norme.strutture||[])[0];
      if (s0){
        state.cap.prezzoMq = num(s0.prezzoMq||state.cap.prezzoMq);
        state.cap.kgBase   = num(s0.kg_per_mq_base||state.cap.kgBase);
      }
      var prz = byId("prz"); if(prz){ prz.value=state.cap.prezzoMq; prz.addEventListener("input", function(e){ state.cap.prezzoMq=num(e.target.value); refresh(); }); }
      var kgB = byId("kgBase"); if(kgB){ kgB.value=state.cap.kgBase; kgB.addEventListener("input", function(e){ state.cap.kgBase=num(e.target.value); refresh(); }); }

      // input struttura
      ["campN","campInt","len","hTrave"].forEach(function(id){
        var el=byId(id); if(!el) return;
        el.addEventListener("input", function(e){
          var v=num(e.target.value);
          if(id==="campN") state.cap.campN=v;
          if(id==="campInt") state.cap.campInt=v;
          if(id==="len") state.cap.lunghezza=v;
          if(id==="hTrave") state.cap.hTrave=v;
          refresh();
        });
      });
      ["wid","spTest","spGr"].forEach(function(id){
        var el=byId(id); if(!el) return;
        el.addEventListener("input", function(e){ state.cap[id] = num(e.target.value); refresh(); });
      });
      var quo = byId("quo"); if(quo){ quo.value=state.cap.quotaDecubito; quo.addEventListener("input", function(e){ state.cap.quotaDecubito=num(e.target.value); refresh(); }); }
      var not = byId("not"); if(not){ not.value=state.cap.note; not.addEventListener("input", function(e){ state.cap.note=e.target.value; }); }

      // Popolazioni
      ["bovineAdulte","toriRimonta","bufaleParto","manzeBovine","bufaleAdulte","manzeBufaline"].forEach(function(k){
        var n = byId("n-"+k), s = byId("s-"+k), l = byId("l-"+k);
        if(n){ n.addEventListener("input", function(e){ state.popolazioni[k].n=num(e.target.value); refresh(); }); }
        if(s){ s.innerHTML='<option value="lettiera">lettiera</option><option value="libera">libera</option>'; s.value=state.popolazioni[k].stab; s.addEventListener("change", function(e){ state.popolazioni[k].stab=e.target.value; }); }
        if(l){ l.innerHTML='<option>Adeguato</option><option>Modesto</option><option>Ottimo</option>'; l.value=state.popolazioni[k].livello; l.addEventListener("change", function(e){ state.popolazioni[k].livello=e.target.value; }); }
      });
      ["ing-gr","ing-cpg","ing-peso","ing-liv"].forEach(function(id){
        var el=byId(id); if(!el) return;
        if(id==="ing-liv"){ el.addEventListener("change", function(e){ state.popolazioni.ingrasso.livello=e.target.value; }); }
        else { el.addEventListener("input", function(e){
          var v=num(e.target.value);
          if(id==="ing-gr") state.popolazioni.ingrasso.gruppi=v;
          if(id==="ing-cpg") state.popolazioni.ingrasso.capiPerGruppo=v;
          if(id==="ing-peso") state.popolazioni.ingrasso.peso=v;
          refresh();
        });}
      });

      // Valori unitari label
      Object.keys(norme.unitari_mq||{}).forEach(function(k){
        var idLbl = (k==="manzeBufaline") ? "vu-manzebufaline" : ("vu-"+k);
        var el=byId(idLbl); if(el) el.textContent=(norme.unitari_mq[k]||0).toFixed(2);
      });

      // pulsanti
      var checkBtn = byId("checkBtn");
      if (checkBtn) checkBtn.addEventListener("click", function(){
        var cf = conformita();
        checkBtn.textContent = "Check superficie: " + cf.pct + "% — " + cf.stato;
      });
      var next = byId("btn-next");
      if (next) next.addEventListener("click", function(){
        alert("Proseguiamo con Pagina 2 dopo la chiusura definitiva della 1.");
      });

      var tf = byId("titleFooter"); if (tf) tf.textContent = repoName();

      // schizzo iniziale
      var sk  = byId("sketch"); if(sk){ sk.innerHTML = sketch(state.cap.forma); }

      refresh();
    })
    .catch(function(err){ alert("Errore inizializzazione: "+err.message); });
  }

  // ---------- EXPORT ----------
  global.PreventivoApp = { initPagina1:initPagina1 };
})(window);
