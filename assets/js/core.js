/* BudgetBox – Pagina 1: Anagrafica + Struttura evoluta
   - Extra meteo raffinato (neve con mu(slope), vento con sovrapprezzo %)
   - Copertura in pianta e in falda
   - €/kg variabile in base all’area
*/
(function (global) {
  var APP_VERSION = "v0.1.2";

  // ---------- STATO ----------
  var state = {
    anagrafica: { cliente:"", localitaId:"", localita:"", riferimento:"", data: new Date().toISOString().slice(0,10) },
    cap: {
      tipoId:"acciaio_zincato",
      forma:"bifalda",
      prezzoMq:180,
      kgBase:34,
      lunghezza:60,
      larghezza:25,
      campN:0,
      campInt:0,
      hTrave:0,
      spTSx:0, spTDx:0, spGSx:0, spGDx:0,
      slopeA:0, slopeB:0, splitA:50, // % larghezza A (B = 100-splitA)
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

  // ---------- UTILS ----------
  function num(v){ return Number(v||0); }
  function fmt1(v){ return (Math.round(v*10)/10).toFixed(1); }
  function fmt2(v){ return (Math.round(v*100)/100).toFixed(2); }
  function byId(id){ return document.getElementById(id); }
  function repoName(){ var seg=location.pathname.split("/").filter(Boolean); return seg.length>=2?seg[1]:(seg[0]||"Preventivi"); }
  function getParam(name){ var m=new RegExp("[?&]"+name+"=([^&]*)").exec(location.search); return m?decodeURIComponent(m[1]):null; }

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

  // ---------- GEOMETRIA ----------
  function lengthFromCampate(){
    var n=num(state.cap.campN), p=num(state.cap.campInt);
    if(n>0 && p>0) return n*p; return num(state.cap.lunghezza);
  }
  function areaLorda(){ return num(state.cap.larghezza) * num(state.cap.lunghezza); }
  function areaCoperta(){
    var Lcov = num(state.cap.lunghezza) + num(state.cap.spTSx) + num(state.cap.spTDx);
    var Wcov = num(state.cap.larghezza) + num(state.cap.spGSx) + num(state.cap.spGDx);
    return Lcov * Wcov;
  }
  function secFromSlopePct(pct){ var t = pct/100; return Math.sqrt(1 + t*t); } // 1/cos
  function areaFalda(){
    var Lcov = num(state.cap.lunghezza) + num(state.cap.spTSx) + num(state.cap.spTDx);
    var Wcov = num(state.cap.larghezza) + num(state.cap.spGSx) + num(state.cap.spGDx);
    var forma = state.cap.forma;
    if(forma==="piano") return Lcov * Wcov;
    if(forma==="monofalda"){
      return Lcov * ( Wcov * secFromSlopePct(num(state.cap.slopeA)) );
    }
    // bifalda
    var splitA = Math.max(0, Math.min(100, num(state.cap.splitA))) / 100;
    var WA = Wcov * splitA, WB = Wcov * (1-splitA);
    return Lcov * ( WA * secFromSlopePct(num(state.cap.slopeA)) + WB * secFromSlopePct(num(state.cap.slopeB)) );
  }

  // ---------- NORMATIVA POPOLAZIONI ----------
  function ingrassoMqPerCapo(peso){
    var arr = norme.ingrasso.mq_per_capo;
    for (var i=0;i<arr.length;i++){ if(peso<=arr[i].maxPesoKg) return arr[i].mq; }
    return arr[arr.length-1].mq;
  }
  function areaNormativaRichiesta(){
    var u=norme.unitari_mq, p=state.popolazioni;
    var base = num(p.bovineAdulte.n)*u.bovineAdulte + num(p.manzeBovine.n)*u.manzeBovine +
               num(p.toriRimonta.n)*u.toriRimonta   + num(p.bufaleAdulte.n)*u.bufaleAdulte +
               num(p.bufaleParto.n)*u.bufaleParto   + num(p.manzeBufaline.n)*u.manzeBufaline;
    var nIng = num(p.ingrasso.gruppi)*num(p.ingrasso.capiPerGruppo);
    var mqIng = nIng*ingrassoMqPerCapo(num(p.ingrasso.peso));
    return base + mqIng;
  }

  // ---------- COSTI ----------
  function eurPerKgByArea(A){
    var scale = (norme.euro_per_kg_scale||[]).slice().sort(function(a,b){ return a.minArea_m2-b.minArea_m2; });
    var v = 0;
    for (var i=0;i<scale.length;i++){
      if (A >= num(scale[i].minArea_m2)) v = num(scale[i].eurPerKg);
    }
    return v;
  }
  function ventoSovrapprezzoPct(){
    var b = norme.vento && norme.vento.buckets ? norme.vento.buckets : {altezza_m:[3,6], passo_m:[4.5]};
    var H = num(state.cap.hTrave);
    var P = num(state.cap.campInt);
    var hKey = H < b.altezza_m[0] ? "H1" : (H < b.altezza_m[1] ? "H2" : "H3");
    var pKey = P <= b.passo_m[0] ? "P1" : "P2";
    var key = (state.cap.forma||"bifalda") + "_" + hKey + "_" + pKey;
    var tab = (norme.vento && norme.vento.sovrapprezzo) || {};
    return num(tab[key] != null ? tab[key] : tab["default"] || 0);
  }
  function snowMuFromSlope(pct){
    var r = num(norme.meteo && norme.meteo.snow_mu_reduction_per_slope_pct);
    var muMax = num(norme.meteo && norme.meteo.snow_mu_max); if(!isFinite(muMax)||muMax<=0) muMax=1;
    var muMin = num(norme.meteo && norme.meteo.snow_mu_min); if(!isFinite(muMin)||muMin<0) muMin=0;
    var mu = muMax - r * Math.max(0,pct);
    return Math.max(muMin, Math.min(muMax, mu));
  }

  function extraMeteo(Acov, Afalda){
    // Neve: A_falda × carico_neve × €/kg × mu(slope)
    var neveKg = num(state.meteo.neve_kgm2);
    var kN = num(norme.meteo && norme.meteo.neve_eur_per_kgm2);
    var mu = 1;
    if(state.cap.forma==="monofalda"){
      mu = snowMuFromSlope(num(state.cap.slopeA));
    }else if(state.cap.forma==="bifalda"){
      var a = num(state.cap.slopeA), b = num(state.cap.slopeB);
      var split = Math.max(0, Math.min(100, num(state.cap.splitA))) / 100;
      mu = split * snowMuFromSlope(a) + (1-split) * snowMuFromSlope(b);
    }
    var extraNeve = Afalda * neveKg * kN * mu;

    // Vento: A_coperta × vento_ms × €/m/s × (1 + sovrapprezzo%)
    var vento = num(state.meteo.vento_ms);
    var kV = num(norme.meteo && norme.meteo.vento_eur_per_ms);
    var sPct = ventoSovrapprezzoPct(); // %
    var extraVento = Acov * vento * kV * (1 + sPct/100);

    return { neve: extraNeve, vento: extraVento, totale: extraNeve + extraVento };
  }

  function costoStruttura(){
    var Acov = areaCoperta();
    var Afalda = areaFalda();

    // Base €/m² (tipo)
    var base = Acov * num(state.cap.prezzoMq);

    // Acciaio €/kg variabile
    var eurKg = eurPerKgByArea(Acov);
    var costKg = Acov * num(state.cap.kgBase) * eurKg;

    // Extra meteo
    var ex = extraMeteo(Acov, Afalda);

    return { base: base, kg: costKg, extra: ex, totale: base + costKg + ex.totale };
  }

  function conformita(){
    var req=areaNormativaRichiesta(), real=areaLorda()*num(state.cap.quotaDecubito)/100;
    if(req===0 && real===0) return {stato:"—", pct:100};
    var ratio = req>0 ? real/req : 0;
    var stato = ratio>=1.1 ? "Adeguato" : (ratio>=1.0 ? "Conforme" : "Non conforme");
    return {stato:stato, pct: Math.round(ratio*100)};
  }

  // ---------- SKETCH ----------
  function sketch(forma){
    var color = "currentColor";
    if(forma==="piano"){
      return '<svg width="120" height="60" viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="25" width="100" height="8" stroke="'+color+'" stroke-width="2" fill="none"/></svg>';
    }
    if(forma==="monofalda"){
      return '<svg width="120" height="60" viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 40 L100 25 L100 33 L10 48 Z" stroke="'+color+'" stroke-width="2" fill="none"/></svg>';
    }
    // bifalda
    return '<svg width="120" height="60" viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 40 L60 25 L110 40 L110 48 L10 48 Z" stroke="'+color+'" stroke-width="2" fill="none"/></svg>';
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

  function refresh(){
    // sincronia lunghezza da campate (nota informativa)
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
    var elEX  = byId("extraMeteo"); if(elEX) elEX.textContent = CT.extra.totale.toLocaleString("it-IT",{style:"currency",currency:"EUR"});
    var elCT  = byId("costoStruttura"); if(elCT) elCT.textContent = CT.totale.toLocaleString("it-IT",{style:"currency",currency:"EUR"});

    var ok = (state.anagrafica.cliente||"").trim().length>0 && num(state.cap.lunghezza)>0 && num(state.cap.larghezza)>0;
    var next = byId("btn-next"); if (next) next.disabled = !ok;
  }

  function showSlopeInputs(){
    var f = state.cap.forma;
    var boxA = byId("slopeBoxA"), boxB = byId("slopeBoxB");
    if(!boxA || !boxB) return;
    if(f==="piano"){
      boxA.style.display="none";
      boxB.style.display="none";
    } else if(f==="monofalda"){
      boxA.style.display="";
      boxB.style.display="none";
    } else {
      boxA.style.display="";
      boxB.style.display="";
    }
  }

  // ---------- INIT ----------
  function initPagina1(){
    Promise.all([
      fetchFirst(["./assets/data/norme.json","assets/data/norme.json","/assets/data/norme.json"], false),
      fetchFirst(["public/documenti/C-S-A-maggio-2025.txt","./public/documenti/C-S-A-maggio-2025.txt","/public/documenti/C-S-A-maggio-2025.txt"], true)
    ])
    .then(function(res){
      norme = res[0];
      localitaDB = parseLocalitaTxt(res[1]);

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

      // Strutture
      var tipoSel = byId("tipoStruttura");
      if (tipoSel){
        tipoSel.innerHTML = (norme.strutture||[]).map(function(s){
          return '<option value="'+s.id+'">'+s.label+'</option>';
        }).join("");
        tipoSel.value = state.cap.tipoId;
        tipoSel.addEventListener("change", function(){
          state.cap.tipoId = tipoSel.value;
          var S = (norme.strutture||[]).find(function(x){return x.id===state.cap.tipoId;});
          if(S){
            state.cap.forma = S.forma || state.cap.forma;
            state.cap.prezzoMq = num(S.prezzoMq||0);
            state.cap.kgBase   = num(S.kg_per_mq_base||0);
            var fSel = byId("formaCopertura"); if(fSel){ fSel.value = state.cap.forma; }
            var prz = byId("prz"); if(prz){ prz.value = state.cap.prezzoMq; }
            var kgb = byId("kgBase"); if(kgb){ kgb.value = state.cap.kgBase; }
            var sk  = byId("sketch"); if(sk){ sk.innerHTML = sketch(state.cap.forma); }
            showSlopeInputs();
            refresh();
          }
        });
      }

      // Forma copertura
      var formaSel = byId("formaCopertura");
      if (formaSel){
        formaSel.value = state.cap.forma;
        formaSel.addEventListener("change", function(){
          state.cap.forma = formaSel.value;
          var sk  = byId("sketch"); if(sk){ sk.innerHTML = sketch(state.cap.forma); }
          showSlopeInputs();
          refresh();
        });
        var sk  = byId("sketch"); if(sk){ sk.innerHTML = sketch(state.cap.forma); }
      }

      // Input prezzo/ kg base
      var prz = byId("prz"); if(prz){ prz.value=state.cap.prezzoMq; prz.addEventListener("input", function(e){ state.cap.prezzoMq=num(e.target.value); refresh(); }); }
      var kgB = byId("kgBase"); if(kgB){ kgB.value=state.cap.kgBase; kgB.addEventListener("input", function(e){ state.cap.kgBase=num(e.target.value); refresh(); }); }

      // Campate/interasse/lunghezza/altezza
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

      // Larghezze e sporti
      ["wid","spTSx","spTDx","spGSx","spGDx"].forEach(function(id){
        var el=byId(id); if(!el) return;
        el.addEventListener("input", function(e){
          state.cap[id] = num(e.target.value);
          refresh();
        });
      });

      // Pendenze / split
      ["slopeA","slopeB"].forEach(function(id){
        var el=byId(id); if(!el) return;
        el.addEventListener("input", function(e){ state.cap[id]=num(e.target.value); refresh(); });
      });
      var spA = byId("splitA"); if (spA){
        spA.addEventListener("input", function(e){
          var val=num(e.target.value); if(!isFinite(val)) val=50;
          state.cap.splitA = Math.max(0, Math.min(100, val));
          var spB=byId("splitB"); if(spB) spB.textContent = fmt1(100 - state.cap.splitA);
          refresh();
        });
      }
      var spB=byId("splitB"); if(spB) spB.textContent = fmt1(100 - state.cap.splitA);
      showSlopeInputs();

      // Quota decubito
      var quo = byId("quo"); if(quo){ quo.value=state.cap.quotaDecubito; quo.addEventListener("input", function(e){ state.cap.quotaDecubito=num(e.target.value); refresh(); }); }
      var not = byId("not"); if(not){ not.value=state.cap.note; not.addEventListener("input", function(e){ state.cap.note=e.target.value; }); }

      // Popolazioni select/inputs (invariato)
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
      var mapVU = { bovineAdulte:"vu-bovineAdulte", manzeBovine:"vu-manzeBovine", toriRimonta:"vu-toriRimonta",
                    bufaleAdulte:"vu-bufaleAdulte", bufaleParto:"vu-bufaleParto", manzeBufaline:"vu-manzeBufaline" };
      Object.keys(mapVU).forEach(function(k){ var el=byId(mapVU[k]); if(el) el.textContent=(norme.unitari_mq[k]||0).toFixed(2); });

      // Check superficie
      var checkBtn = byId("checkBtn");
      if (checkBtn) checkBtn.addEventListener("click", function(){
        var cf = conformita();
        checkBtn.textContent = "Check superficie: " + cf.pct + "% — " + cf.stato;
      });

      // Prosegui
      var next = byId("btn-next");
      if (next) next.addEventListener("click", function(){
        var enc = (function encodeState(o){ var json=JSON.stringify(o),b=new TextEncoder().encode(json),s=""; for(var i=0;i<b.length;i++) s+=String.fromCharCode(b[i]); return btoa(s); })(state);
        var href = "impianti.html?s="+encodeURIComponent(enc);
        var cfg = getParam("cfg"); if (cfg) href += "&cfg="+encodeURIComponent(cfg);
        location.href = href;
      });

      refresh();
      var tf = byId("titleFooter"); if (tf) tf.textContent = repoName();
    })
    .catch(function(err){ alert("Errore inizializzazione: "+err.message); });
  }

  // ---------- EXPORT ----------
  global.PreventivoApp = { initPagina1:initPagina1 };
})(window);
