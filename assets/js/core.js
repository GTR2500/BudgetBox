/* BudgetBox – Core TXT
   Tutti i dati da /public/documenti/*.txt
   Rev: v0.3.2
*/
(function (global) {
  var APP_VERSION = "v0.3.2";

  // ------------------------ Helpers ------------------------
  function num(v){ return Number((v||"").toString().replace(",", ".")) || 0; }
  function fmt1(v){ return (Math.round(v*10)/10).toFixed(1); }
  function fmt2(v){ return (Math.round(v*100)/100).toFixed(2); }
  function byId(id){ return document.getElementById(id); }
  function repoName(){ var seg=location.pathname.split("/").filter(Boolean); return seg.length>=2?seg[1]:(seg[0]||"BudgetBox"); }

  function fetchTxt(paths){
    var chain = Promise.reject();
    paths.forEach(function(p){
      chain = chain.catch(function(){
        return fetch(p, {cache:"no-store"}).then(function(r){
          if(!r.ok) throw new Error("HTTP "+r.status+" @ "+p);
          return r.text();
        });
      });
    });
    return chain;
  }
  function splitNonEmptyLines(txt){
    return txt.split(/\r?\n/).map(function(l){return l.trim();})
      .filter(Boolean).filter(function(l){return !/^#|^\/\//.test(l);});
  }
  function detectDelim(headerLine){
    var c=[";","\t",",","|"]; for (var i=0;i<c.length;i++) if (headerLine.indexOf(c[i])!==-1) return c[i];
    return ";";
  }

  // ------------------------ Parsers ------------------------
  function parseLocalitaTxt(txt){
    var lines = splitNonEmptyLines(txt); if(!lines.length) return [];
    var delim = detectDelim(lines[0]);
    var head = lines[0].split(delim).map(function(s){return s.trim().toUpperCase();});
    function idx(name){ var i=head.indexOf(name); return i<0?null:i; }
    var iReg=idx("REGIONE"), iProv=idx("PROV_CITTA_METROPOLITANA"), iSig=idx("SIGLA_PROV"),
        iCom=idx("COMUNE"), iIstat=idx("COD_ISTAT_COMUNE"), iSism=idx("ZONA_SISMICA"),
        iV=idx("VENTO"), iN=idx("CARICO_NEVE"), iQ=idx("ALTITUDINE");
    var out=[];
    for (var r=1;r<lines.length;r++){
      var c=lines[r].split(delim).map(function(s){return s.trim();});
      var istat = iIstat!=null ? c[iIstat] : "";
      if(!istat) continue;
      var sig = iSig!=null ? c[iSig] : "";
      var comune = iCom!=null ? c[iCom] : "";
      var rec = {
        regione: iReg!=null ? c[iReg] : "",
        provincia: iProv!=null ? c[iProv] : "",
        sigla: (sig||"").toUpperCase(),
        comune: comune,
        istat: istat,
        zonaSismica: iSism!=null ? c[iSism] : "",
        vento_ms: num(iV!=null ? c[iV] : 0),
        neve_kgm2: num(iN!=null ? c[iN] : 0),
        alt_m: num(iQ!=null ? c[iQ] : 0)
      };
      rec.nome = rec.comune + (rec.sigla?(" ("+rec.sigla+")"):"");
      rec.id = rec.istat;
      out.push(rec);
    }
    return out.sort(function(a,b){ return a.nome.localeCompare(b.nome,"it"); });
  }

  function canonicalId(label){
    var s=(label||"").toLowerCase();
    if(s.indexOf("piano")>=0) return "piano";
    if(s.indexOf("monofalda")>=0 || s.indexOf("shed")>=0) return "monofalda";
    if(s.indexOf("bifalda")>=0 || s.indexOf("capanna")>=0) return "bifalda";
    if(s.indexOf("dente")>=0 || s.indexOf("sawtooth")>=0) return "dente_sega";
    if(s.indexOf("cattedrale")>=0 || s.indexOf("capriate")>=0) return "cattedrale";
    return s.replace(/\s+/g,"_").replace(/[^\w]/g,"");
  }
  function parseFormeTxt(txt){
    var lines = splitNonEmptyLines(txt); if(!lines.length) return [];
    var delim = detectDelim(lines[0]);
    var head = lines[0].split(delim).map(function(s){return s.trim().toLowerCase();});
    var iType=head.indexOf("roof_type"), iMin=head.indexOf("min_slope"), iMax=head.indexOf("max_slope"), iDesc=head.indexOf("descrizione");
    var out=[];
    for (var i=1;i<lines.length;i++){
      var c=lines[i].split(delim);
      var label=(c[iType]||"").trim(); if(!label) continue;
      out.push({ id:canonicalId(label), label:label, minSlopePct:num(c[iMin]), maxSlopePct:num(c[iMax]), descr:(c[iDesc]||"").trim() });
    }
    return out;
  }

  function parseKVTable(txt){
    var lines = splitNonEmptyLines(txt); if(!lines.length) return {};
    var delim = detectDelim(lines[0]);
    var head = lines[0].split(delim).map(function(s){return s.trim().toLowerCase();});
    var iG=head.indexOf("group"), iK=head.indexOf("key"), iS=head.indexOf("subkey"), iV=head.indexOf("value");
    var out = { base:{}, weights:{}, scales:{}, sismica:{map:{}}, forma_bonus:{} };
    for (var i=1;i<lines.length;i++){
      var c=lines[i].split(delim);
      var g=(c[iG]||"").trim(), k=(c[iK]||"").trim(), s=(c[iS]||"").trim(), v=(c[iV]||"").trim();
      if (!g) continue;
      if (g==="base"){ out.base[k]=num(v); }
      else if (g==="weights"){ out.weights[k]=num(v); }
      else if (g==="scales"){ out.scales[k] = out.scales[k]||{}; out.scales[k][s]=num(v); }
      else if (g==="sismica"){ out.sismica.map[k]=num(v); }
      else if (g==="forma_bonus"){ out.forma_bonus[k]=num(v); }
    }
    return {
      min_pct: out.base.min_pct||3,
      max_pct: out.base.max_pct||15,
      weights: out.weights,
      scales: out.scales,
      forma_bonus: out.forma_bonus,
      sismica: out.sismica
    };
  }

  function parseUnitari(txt){
    var lines=splitNonEmptyLines(txt); if(!lines.length) return {};
    var delim=detectDelim(lines[0]);
    var head=lines[0].split(delim).map(function(s){return s.trim().toLowerCase();});
    var iC=head.indexOf("categoria"), iM=head.indexOf("mq");
    var out={};
    for (var i=1;i<lines.length;i++){
      var c=lines[i].split(delim);
      var cat=(c[iC]||"").trim(); if(!cat) continue;
      out[cat]=num(c[iM]);
    }
    return out;
  }
  function parseOpzioni(txt){
    var lines=splitNonEmptyLines(txt); if(!lines.length) return {};
    var delim=detectDelim(lines[0]);
    var head=lines[0].split(delim).map(function(s){return s.trim().toLowerCase();});
    var iC=head.indexOf("categoria"), iO=head.indexOf("opzioni");
    var out={};
    for (var i=1;i<lines.length;i++){
      var c=lines[i].split(delim); var cat=(c[iC]||"").trim(); if(!cat) continue;
      out[cat]=(c[iO]||"").split(",").map(function(s){return s.trim();}).filter(Boolean);
    }
    return out;
  }
  function parseRange(txt){
    var lines=splitNonEmptyLines(txt); if(!lines.length) return {};
    var delim=detectDelim(lines[0]);
    var head=lines[0].split(delim).map(function(s){return s.trim().toLowerCase();});
    var iC=head.indexOf("categoria"), iL=head.indexOf("adeguato_min"), iH=head.indexOf("adeguato_max"), iO=head.indexOf("ottimale_min");
    var out={};
    for (var i=1;i<lines.length;i++){
      var c=lines[i].split(delim); var cat=(c[iC]||"").trim(); if(!cat) continue;
      out[cat]={ adeguato:[num(c[iL]), num(c[iH])], ottimale_min:num(c[iO]) };
    }
    return out;
  }
  function parseStrutture(txt){
    var lines=splitNonEmptyLines(txt); if(!lines.length) return [];
    var delim=detectDelim(lines[0]);
    var head=lines[0].split(delim).map(function(s){return s.trim().toLowerCase();});
    var iId=head.indexOf("id"), iL=head.indexOf("label"), iF=head.indexOf("forma"), iP=head.indexOf("prezzomq"), iK=head.indexOf("kg_per_mq_base");
    var out=[];
    for (var i=1;i<lines.length;i++){
      var c=lines[i].split(delim);
      out.push({ id:(c[iId]||"").trim(), label:(c[iL]||"").trim(), forma:canonicalId(c[iF]||""), prezzoMq:num(c[iP]), kg_per_mq_base:num(c[iK]) });
    }
    return out;
  }
  function parseEuroScale(txt){
    var lines=splitNonEmptyLines(txt); if(!lines.length) return [];
    var delim=detectDelim(lines[0]);
    var head=lines[0].split(delim).map(function(s){return s.trim().toLowerCase();});
    var iA=head.indexOf("minarea_m2"), iE=head.indexOf("eurperkg");
    var out=[];
    for (var i=1;i<lines.length;i++){
      var c=lines[i].split(delim);
      out.push({ minArea_m2:num(c[iA]), eurPerKg:num(c[iE]) });
    }
    return out;
  }
  function parseIngrassoTab(txt){
    var lines=splitNonEmptyLines(txt); if(!lines.length) return [];
    var delim=detectDelim(lines[0]);
    var head=lines[0].split(delim).map(function(s){return s.trim().toLowerCase();});
    var iW=head.indexOf("peso"), iM=head.indexOf("min"), iO=head.indexOf("opt");
    var out=[];
    for (var i=1;i<lines.length;i++){
      var c=lines[i].split(delim);
      out.push({ peso:num(c[iW]), min:num(c[iM]), opt:num(c[iO]) });
    }
    return out.sort(function(a,b){return a.peso-b.peso;});
  }
  function parseServizi(txt){
    var lines=splitNonEmptyLines(txt); if(!lines.length) return [];
    var delim=detectDelim(lines[0]);
    var head=lines[0].split(delim).map(function(s){return s.trim().toLowerCase();});
    var iD=head.indexOf("descrizione"), iU=head.indexOf("um"), iQ=head.indexOf("qta"), iP=head.indexOf("prezzo"), iS=head.indexOf("stato"), iC=head.indexOf("conteggia");
    var out=[];
    for (var i=1;i<lines.length;i++){
      var c=lines[i].split(delim);
      out.push({
        descrizione:(c[iD]||"").trim(),
        um:(c[iU]||"").trim(),
        qta:num(c[iQ]),
        prezzo:num(c[iP]),
        stato:(c[iS]||"").trim(),
        conteggia: ((c[iC]||"").trim().toLowerCase()==="true")
      });
    }
    return out;
  }

  // ------------------------ Stato ------------------------
  var DATA = {
    unitari_mq:{},
    stabulazioni:{ opzioni:{}, range_mq:{} },
    ingrasso_tabella:[],
    strutture:[],
    euro_per_kg_scale:[],
    forme_copertura:[],
    neve_vento_percent:{ min_pct:3, max_pct:15, weights:{}, scales:{}, forma_bonus:{}, sismica:{map:{}} },
    servizi_fissi:[]
  };

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
      spTest:0,
      spGr:0,
      quotaDecubito:70,
      note:"Struttura metallica zincata, copertura sandwich 40 mm"
    },
    meteo: { neve_kgm2:0, vento_ms:0, alt_m:0, regione:"", provincia:"", istat:"", zonaSismica:"" },
    popolazioni: {
      bovineAdulte:{ n:0, stab:"libera_lettiera", livello:"Adeguato" },
      manzeBovine:{ n:0, stab:"libera_lettiera", livello:"Adeguato" },
      toriRimonta:{ n:0, stab:"libera_lettiera", livello:"Adeguato" },
      bufaleAdulte:{ n:0, stab:"libera_lettiera", livello:"Adeguato" },
      bufaleParto:{ n:0, stab:"libera_lettiera", livello:"Adeguato" },
      manzeBufaline:{ n:0, stab:"libera_lettiera", livello:"Adeguato" },
      ingrasso:{ gruppi:0, capiPerGruppo:0, peso:550, livello:"Adeguato", stab:"libera_lettiera" }
    }
  };
  global.__bbState = state;

  var localitaDB = [];

  // ------------------------ Geometria & aree ------------------------
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
    var f = DATA.forme_copertura.find(function(x){return x.id===state.cap.forma;}) || {minSlopePct:0, maxSlopePct:0};
    var min = num(f.minSlopePct), max = num(f.maxSlopePct); if (max<min) max=min;
    var base = (min+max)/2;
    var sc = DATA.neve_vento_percent.scales||{};
    var neveN  = sc.neve && sc.neve.max ? Math.max(0, Math.min(1, num(state.meteo.neve_kgm2)/num(sc.neve.max))) : 0;
    var ventoN = sc.vento&& sc.vento.max? Math.max(0, Math.min(1, num(state.meteo.vento_ms)/num(sc.vento.max))) : 0;
    var adj = (neveN - ventoN) * (max - min) * 0.25;
    return Math.max(min, Math.min(max, base + adj));
  }
  function altezzaColmo(){
    var d = covDims(), W = d.Wcov;
    var slope = estimatedSlopePct();
    var rise = (state.cap.forma==="monofalda" || state.cap.forma==="piano") ? (W * slope / 100) : ((W/2)*slope/100);
    return num(state.cap.hTrave) + rise;
  }
  function areaFalda(){
    var d=covDims(), slope=estimatedSlopePct();
    var sec=Math.sqrt(1+Math.pow(slope/100,2));
    return d.Lcov * d.Wcov * sec;
  }

  // ------------------------ Stabulazione & unitari ------------------------
  function interpIngrassoMq(tab, pesoKg, livello) {
    if (!tab || !tab.length) return 0;
    var byW = tab.slice().sort(function(a,b){return a.peso-b.peso;});
    var w = num(pesoKg||0);
    if (w <= byW[0].peso){ var t0=byW[0]; return livello==="Ottimale" ? t0.opt : (t0.min+t0.opt)/2; }
    if (w >= byW[byW.length-1].peso){ var t1=byW[byW.length-1]; return livello==="Ottimale" ? t1.opt : (t1.min+t1.opt)/2; }
    for (var i=0;i<byW.length-1;i++){
      var a=byW[i], b=byW[i+1];
      if (w>=a.peso && w<=b.peso){
        var t=(w-a.peso)/(b.peso-a.peso);
        var min=a.min+t*(b.min-a.min), opt=a.opt+t*(b.opt-a.opt);
        return livello==="Ottimale" ? opt : (min+opt)/2;
      }
    }
    return 0;
  }
  function mqPerCapoCategoria(cat, livello){
    if (cat==="ingrasso") return interpIngrassoMq(DATA.ingrasso_tabella, state.popolazioni.ingrasso.peso, livello);
    var r = DATA.stabulazioni.range_mq[cat];
    if (r){
      if (livello==="Ottimale"){ if (num(r.ottimale_min)>0) return num(r.ottimale_min)+0.5; return num((r.adeguato||[])[1]); }
      return (num((r.adeguato||[])[0]) + num((r.adeguato||[])[1]))/2;
    }
    return num(DATA.unitari_mq[cat]); // fallback
  }
  function labelIdFor(cat){ return (cat==="manzeBufaline") ? "vu-manzebufaline" : ("vu-"+cat); }
  function updateUnitariLabels(){
    ["bovineAdulte","manzeBovine","toriRimonta","bufaleAdulte","bufaleParto","manzeBufaline"].forEach(function(cat){
      var liv = state.popolazioni[cat].livello || "Adeguato";
      var mq = mqPerCapoCategoria(cat, liv);
      var el = byId(labelIdFor(cat)); if (el) el.textContent = isFinite(mq)&&mq>0 ? (mq.toFixed(2)+" m²/capo") : "—";
    });
    var lblIng = byId("vu-ingrasso"); if (lblIng){
      var mqIng = mqPerCapoCategoria("ingrasso", state.popolazioni.ingrasso.livello||"Adeguato");
      lblIng.textContent = isFinite(mqIng)&&mqIng>0 ? (mqIng.toFixed(2)+" m²/capo") : "—";
    }
  }
  function areaNormativaRichiesta(){
    var p=state.popolazioni, base=0;
    ["bovineAdulte","manzeBovine","toriRimonta","bufaleAdulte","bufaleParto","manzeBufaline"].forEach(function(cat){
      base += num(p[cat].n) * mqPerCapoCategoria(cat, p[cat].livello||"Adeguato");
    });
    var nIng = num(p.ingrasso.gruppi)*num(p.ingrasso.capiPerGruppo);
    if (nIng>0) base += nIng * mqPerCapoCategoria("ingrasso", p.ingrasso.livello||"Adeguato");
    return base;
  }

  // ------------------------ Costi ------------------------
  function eurPerKgByArea(A){
    var scale = DATA.euro_per_kg_scale.slice().sort(function(a,b){return a.minArea_m2-b.minArea_m2;});
    var v=0; for (var i=0;i<scale.length;i++){ if (A>=num(scale[i].minArea_m2)) v=num(scale[i].eurPerKg); }
    return v;
  }
  function neveVentoPercent(){
    var cfg = DATA.neve_vento_percent||{};
    var w = cfg.weights||{}, sc = cfg.scales||{};
    var minP=num(cfg.min_pct||3), maxP=num(cfg.max_pct||15);
    var neveN  = sc.neve  && sc.neve.max  ? Math.max(0, Math.min(1, num(state.meteo.neve_kgm2)/num(sc.neve.max)))   : 0;
    var ventoN = sc.vento && sc.vento.max ? Math.max(0, Math.min(1, num(state.meteo.vento_ms)/num(sc.vento.max))) : 0;
    var altN   = sc.altitudine && sc.altitudine.max ? Math.max(0, Math.min(1, num(state.meteo.alt_m)/num(sc.altitudine.max))) : 0;
    var sisN   = 0;
    if (cfg.sismica && cfg.sismica.map){
      var z=(state.meteo.zonaSismica||"").toString().trim();
      sisN = (cfg.sismica.map[z]!=null) ? num(cfg.sismica.map[z]) : num(cfg.sismica.map.default||0);
      sisN = Math.max(0, Math.min(1, sisN));
    }
    var formaBonus = 0; if (cfg.forma_bonus){ var fb = cfg.forma_bonus[state.cap.forma]; if (fb!=null) formaBonus=num(fb); }
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

  // ------------------------ Conformità ------------------------
  function conformita(){
    var req=areaNormativaRichiesta(), real=areaLorda()*num(state.cap.quotaDecubito)/100;
    if(req===0 && real===0) return {stato:"—", pct:100};
    var ratio = req>0 ? real/req : 0;
    var stato = ratio>=1.1 ? "Adeguato" : (ratio>=1.0 ? "Conforme") : "Non conforme";
    return {stato:stato, pct: Math.round(ratio*100)};
  }

  // ------------------------ Sketch ------------------------
  function sketch(forma){
    var c="currentColor";
    if(forma==="piano"){ return '<svg width="120" height="60" viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="45" width="100" height="6" stroke="'+c+'" stroke-width="2" fill="none"/></svg>'; }
    if(forma==="monofalda"){ return '<svg width="120" height="60" viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 48 L100 30 L100 36 L10 54 Z" stroke="'+c+'" stroke-width="2" fill="none"/></svg>'; }
    if(forma==="dente_sega"){ return '<svg width="120" height="60" viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 50 L35 35 L60 50 L85 35 L110 50" stroke="'+c+'" stroke-width="2" fill="none"/></svg>'; }
    if(forma==="cattedrale"){ return '<svg width="120" height="60" viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 50 L60 28 L110 50" stroke="'+c+'" stroke-width="2" fill="none"/><path d="M35 50 L60 39 L85 50" stroke="'+c+'" stroke-width="2" fill="none"/></svg>'; }
    return '<svg width="120" height="60" viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 50 L60 28 L110 50" stroke="'+c+'" stroke-width="2" fill="none"/></svg>';
  }

  // ------------------------ UI ------------------------
  function updateLocBadge(){
    var badge=byId("badge-meteo"); if(!badge) return;
    var L=localitaDB.find(function(x){return x.id===state.anagrafica.localitaId;});
    if(!L){ badge.textContent="—"; badge.className="badge meta"; return; }
    var r1="ZONA_SISMICA: "+(L.zonaSismica||"—")+"; VENTO: "+fmt2(num(L.vento_ms))+" m/s; CARICO_NEVE: "+fmt2(num(L.neve_kgm2))+" kg/m²; ALTITUDINE: "+Math.round(num(L.alt_m))+" m";
    var r2="REGIONE: "+(L.regione||"—")+"; PROV_CITTA_METROPOLITANA: "+(L.provincia||"—")+"; COD_ISTAT_COMUNE: "+(L.istat||"—");
    badge.innerHTML='<span class="bline">'+r1+'</span><span class="bline">'+r2+'</span>'; badge.className="badge meta";
  }
  function setCapBadge(id, val){
    var el=byId(id); if(!el) return; var n=num(val)||0;
    el.textContent=n+" capi"; el.className = n>0 ? "badge ok" : "badge";
  }

  function populateStabulazioniSelects(){
    function fill(cat){
      var sel=byId("s-"+cat); if(!sel) return;
      var list=DATA.stabulazioni.opzioni[cat]||["libera_lettiera","libera_cuccette","fissa_posta"];
      sel.innerHTML=list.map(function(v){return '<option value="'+v+'">'+v.replace(/_/g," ")+'</option>';}).join("");
      if (list.indexOf(state.popolazioni[cat].stab)>=0) sel.value=state.popolazioni[cat].stab; else { state.popolazioni[cat].stab=list[0]; sel.value=list[0]; }
    }
    ["bovineAdulte","manzeBovine","toriRimonta","bufaleAdulte","bufaleParto","manzeBufaline"].forEach(fill);
    var selIng=byId("ing-stab");
    if(selIng){
      var L=DATA.stabulazioni.opzioni.ingrasso||["libera_lettiera","grigliato"];
      selIng.innerHTML=L.map(function(v){return '<option value="'+v+'">'+v.replace(/_/g," ")+'</option>';}).join("");
      if(L.indexOf(state.popolazioni.ingrasso.stab)>=0) selIng.value=state.popolazioni.ingrasso.stab; else {state.popolazioni.ingrasso.stab=L[0]; selIng.value=L[0];}
    }
  }

  function refresh(){
    // Lunghezza da campate
    var Lcalc=lengthFromCampate();
    var lenNote=byId("lenNote");
    if(lenNote){ lenNote.textContent=(num(state.cap.campN)>0 && num(state.cap.campInt)>0)?("L calcolata: "+fmt2(Lcalc)+" m"):""; }
    if(num(state.cap.campN)>0 && num(state.cap.campInt)>0){ state.cap.lunghezza=Lcalc; var lenEl=byId("len"); if(lenEl) lenEl.value=fmt2(Lcalc); }

    var AL=areaLorda(), AC=areaCoperta(), AF=areaFalda(), AN=areaNormativaRichiesta(), CT=costoStruttura();
    var elAL=byId("areaLorda"); if(elAL) elAL.textContent=fmt1(AL);
    var elAC=byId("areaCoperta"); if(elAC) elAC.textContent=fmt1(AC);
    var elAF=byId("areaFalda"); if(elAF) elAF.textContent=fmt1(AF);
    var elAN=byId("areaNormativa"); if(elAN) elAN.textContent=fmt1(AN);

    var cf=conformita();
    var badge=byId("badge"); if(badge){ var cls="badge"; if(cf.stato==="Adeguato") cls+=" ok"; else if(cf.stato==="Conforme") cls+=" mid"; else if(cf.stato==="Non conforme") cls+=" ko"; badge.className=cls; badge.textContent=cf.stato; }
    var pct=byId("badgePct"); if(pct) pct.textContent=cf.pct+"%";

    var elCMq=byId("costoMq"); if(elCMq) elCMq.textContent=CT.base.toLocaleString("it-IT",{style:"currency",currency:"EUR"});
    var elCKg=byId("costoKg"); if(elCKg) elCKg.textContent=CT.kg.toLocaleString("it-IT",{style:"currency",currency:"EUR"});
    var elEX=byId("extraMeteo"); if(elEX) elEX.textContent=fmt2(CT.extraPct)+"% — "+CT.extraEuro.toLocaleString("it-IT",{style:"currency",currency:"EUR"});
    var elCT=byId("costoStruttura"); if(elCT) elCT.textContent=CT.totale.toLocaleString("it-IT",{style:"currency",currency:"EUR"});

    var hCol=byId("hColmoVal"); if(hCol) hCol.value=fmt2(altezzaColmo());

    // Badge capi
    setCapBadge("cap-bovineAdulte", state.popolazioni.bovineAdulte.n);
    setCapBadge("cap-manzeBovine",  state.popolazioni.manzeBovine.n);
    setCapBadge("cap-toriRimonta",  state.popolazioni.toriRimonta.n);
    setCapBadge("cap-bufaleAdulte", state.popolazioni.bufaleAdulte.n);
    setCapBadge("cap-bufaleParto",  state.popolazioni.bufaleParto.n);
    setCapBadge("cap-manzeBufaline", state.popolazioni.manzeBufaline.n);
    var nIng=num(state.popolazioni.ingrasso.gruppi)*num(state.popolazioni.ingrasso.capiPerGruppo);
    setCapBadge("cap-ingrasso", nIng);

    updateUnitariLabels();

    // bottone avanti
    var ok=(state.anagrafica.cliente||"").trim().length>0 && num(state.cap.lunghezza)>0 && num(state.cap.larghezza)>0;
    var next=byId("btn-next"); if(next) next.disabled=!ok;
  }

  // ------------------------ Init pagina ------------------------
  function loadFormeSelect(){
    var sel=byId("formaCopertura"), descr=byId("formaDescr"); if(!sel) return;
    var list=DATA.forme_copertura.length?DATA.forme_copertura:[{id:"bifalda",label:"Bifalda",minSlopePct:10,maxSlopePct:25,descr:""}];
    sel.innerHTML=list.map(function(f){return '<option value="'+f.id+'">'+(f.label||f.id)+'</option>';}).join("");
    if(!list.find(function(x){return x.id===state.cap.forma;})) state.cap.forma=list[0].id;
    sel.value=state.cap.forma;
    if(descr){ var cur=list.find(function(x){return x.id===state.cap.forma;}); descr.textContent=cur && cur.descr?cur.descr:""; }
    var sk=byId("sketch"); if(sk){ sk.innerHTML=sketch(state.cap.forma); }
    sel.addEventListener("change",function(){
      state.cap.forma=sel.value;
      var cur=list.find(function(x){return x.id===state.cap.forma;});
      if(descr) descr.textContent=cur && cur.descr?cur.descr:"";
      var sk=byId("sketch"); if(sk){ sk.innerHTML=sketch(state.cap.forma); }
      refresh();
    });
  }

  function initPagina1(){
    Promise.all([
      fetchTxt(["public/documenti/C-S-A-maggio-2025.txt","./public/documenti/C-S-A-maggio-2025.txt","/public/documenti/C-S-A-maggio-2025.txt"]),
      fetchTxt(["public/documenti/forme-coperture.txt","./public/documenti/forme-coperture.txt","/public/documenti/forme-coperture.txt"]),
      fetchTxt(["public/documenti/strutture.txt","./public/documenti/strutture.txt","/public/documenti/strutture.txt"]),
      fetchTxt(["public/documenti/euro_per_kg_scale.txt","./public/documenti/euro_per_kg_scale.txt","/public/documenti/euro_per_kg_scale.txt"]),
      fetchTxt(["public/documenti/unitari_mq.txt","./public/documenti/unitari_mq.txt","/public/documenti/unitari_mq.txt"]),
      fetchTxt(["public/documenti/stabulazioni_opzioni.txt","./public/documenti/stabulazioni_opzioni.txt","/public/documenti/stabulazioni_opzioni.txt"]),
      fetchTxt(["public/documenti/stabulazioni_range.txt","./public/documenti/stabulazioni_range.txt","/public/documenti/stabulazioni_range.txt"]),
      fetchTxt(["public/documenti/ingrasso_tabella.txt","./public/documenti/ingrasso_tabella.txt","/public/documenti/ingrasso_tabella.txt"]),
      fetchTxt(["public/documenti/servizi_fissi.txt","./public/documenti/servizi_fissi.txt","/public/documenti/servizi_fissi.txt"]),
      fetchTxt(["public/documenti/neve_vento_percent.txt","./public/documenti/neve_vento_percent.txt","/public/documenti/neve_vento_percent.txt"])
    ])
    .then(function(txts){
      // parse
      var localitaTxt   = txts[0];
      var formeTxt      = txts[1];
      var struttureTxt  = txts[2];
      var euroScaleTxt  = txts[3];
      var unitariTxt    = txts[4];
      var stabOptTxt    = txts[5];
      var stabRangeTxt  = txts[6];
      var ingrassoTxt   = txts[7];
      var serviziTxt    = txts[8];
      var neveVentoTxt  = txts[9];

      localitaDB                 = parseLocalitaTxt(localitaTxt);
      DATA.forme_copertura       = parseFormeTxt(formeTxt);
      DATA.strutture             = parseStrutture(struttureTxt);
      DATA.euro_per_kg_scale     = parseEuroScale(euroScaleTxt);
      DATA.unitari_mq            = parseUnitari(unitariTxt);
      DATA.stabulazioni.opzioni  = parseOpzioni(stabOptTxt);
      DATA.stabulazioni.range_mq = parseRange(stabRangeTxt);
      DATA.ingrasso_tabella      = parseIngrassoTab(ingrassoTxt);
      DATA.servizi_fissi         = parseServizi(serviziTxt);
      DATA.neve_vento_percent    = parseKVTable(neveVentoTxt);

      // Header
      var titleEl=byId("title"); if(titleEl) titleEl.textContent=repoName();
      var revDate=byId("revDate"); if(revDate) revDate.textContent=new Date().toLocaleDateString("it-IT");
      var revVer=byId("revVer"); if(revVer) revVer.textContent=APP_VERSION;

      document.documentElement.setAttribute("data-theme","light");
      var themeBtn=byId("themeBtn"); if(themeBtn) themeBtn.addEventListener("click",function(){
        var isLight=document.documentElement.getAttribute("data-theme")==="light";
        document.documentElement.setAttribute("data-theme", isLight ? "dark" : "light");
        themeBtn.textContent = isLight ? "☀️" : "🌙";
      });
      var printBtn=byId("printBtn"); if(printBtn) printBtn.addEventListener("click", function(){ window.print(); });

      // Anagrafica
      var elCli=byId("cli"), elRif=byId("rif"), elDat=byId("dat"), elLoc=byId("fld-localita");
      if (elDat) elDat.value=state.anagrafica.data;
      if (elCli){ elCli.addEventListener("input", function(e){ state.anagrafica.cliente=e.target.value; refresh(); }); }
      if (elRif){ elRif.addEventListener("input", function(e){ state.anagrafica.riferimento=e.target.value; }); }
      if (elDat){ elDat.addEventListener("input", function(e){ state.anagrafica.data=e.target.value; }); }

      if (elLoc){
        elLoc.innerHTML = '<option value="">— Seleziona località —</option>' + localitaDB.map(function(L){ return '<option value="'+L.id+'">'+L.nome+'</option>'; }).join("");
        elLoc.addEventListener("change", function(){
          var L = localitaDB.find(function(x){return x.id===elLoc.value;});
          if (!L){
            state.anagrafica.localitaId=""; state.anagrafica.localita="";
            state.meteo={neve_kgm2:0,vento_ms:0,alt_m:0,regione:"",provincia:"",istat:"",zonaSismica:""}; updateLocBadge(); refresh(); return;
          }
          state.anagrafica.localitaId=L.id; state.anagrafica.localita=L.nome;
          state.meteo.neve_kgm2=num(L.neve_kgm2); state.meteo.vento_ms=num(L.vento_ms); state.meteo.alt_m=num(L.alt_m);
          state.meteo.regione=L.regione||""; state.meteo.provincia=L.provincia||""; state.meteo.istat=L.istat||""; state.meteo.zonaSismica=L.zonaSismica||"";
          updateLocBadge(); refresh();
        });
      }
      updateLocBadge();

      // Strutture
      var tipoSel=byId("tipoStruttura");
      if (tipoSel){
        var list=DATA.strutture.length?DATA.strutture:[{id:"acciaio_zincato",label:"Struttura metallica zincata",forma:"bifalda",prezzoMq:180,kg_per_mq_base:34}];
        tipoSel.innerHTML = list.map(function(s){return '<option value="'+s.id+'">'+s.label+'</option>';}).join("");
        if (!list.find(function(s){return s.id===state.cap.tipoId;})) state.cap.tipoId=list[0].id;
        tipoSel.value=state.cap.tipoId;
        tipoSel.addEventListener("change", function(){
          state.cap.tipoId=tipoSel.value;
          var cur=list.find(function(s){return s.id===state.cap.tipoId;});
          if (cur){ state.cap.prezzoMq=num(cur.prezzoMq); state.cap.kgBase=num(cur.kg_per_mq_base); state.cap.forma=cur.forma||state.cap.forma; loadFormeSelect(); refresh(); }
        });
        var s0=list.find(function(s){return s.id===state.cap.tipoId;}) || list[0];
        state.cap.prezzoMq = num(s0.prezzoMq||state.cap.prezzoMq);
        state.cap.kgBase   = num(s0.kg_per_mq_base||state.cap.kgBase);
        if (s0.forma) state.cap.forma=s0.forma;
      }
      var prz=byId("prz"); if(prz){ prz.value=state.cap.prezzoMq; prz.addEventListener("input", function(e){ state.cap.prezzoMq=num(e.target.value); refresh(); }); }
      var kgB=byId("kgBase"); if(kgB){ kgB.value=state.cap.kgBase; kgB.addEventListener("input", function(e){ state.cap.kgBase=num(e.target.value); refresh(); }); }

      // Forma copertura
      loadFormeSelect();

      // Input struttura
      ["campN","campInt","len","hTrave"].forEach(function(id){
        var el=byId(id); if(!el) return; el.addEventListener("input", function(e){
          var v=num(e.target.value);
          if(id==="campN") state.cap.campN=v;
          if(id==="campInt") state.cap.campInt=v;
          if(id==="len") state.cap.lunghezza=v;
          if(id==="hTrave") state.cap.hTrave=v;
          refresh();
        });
      });
      ["wid","spTest","spGr"].forEach(function(id){
        var el=byId(id); if(!el) return; el.addEventListener("input", function(e){ state.cap[id]=num(e.target.value); refresh(); });
      });
      var quo=byId("quo"); if(quo){ quo.value=state.cap.quotaDecubito; quo.addEventListener("input", function(e){ state.cap.quotaDecubito=num(e.target.value); refresh(); }); }
      var not=byId("not"); if(not){ not.value=state.cap.note; not.addEventListener("input", function(e){ state.cap.note=e.target.value; }); }

      // Stabulazioni – popola menu
      populateStabulazioniSelects();

      // Wiring Popolazioni
      ["bovineAdulte","toriRimonta","bufaleParto","manzeBovine","bufaleAdulte","manzeBufaline"].forEach(function(k){
        var n=byId("n-"+k), s=byId("s-"+k), l=byId("l-"+k);
        if(n){ n.addEventListener("input", function(e){ state.popolazioni[k].n=num(e.target.value); refresh(); }); }
        if(s){ s.addEventListener("change", function(e){ state.popolazioni[k].stab=e.target.value; refresh(); }); }
        if(l){ l.addEventListener("change", function(e){ state.popolazioni[k].livello=e.target.value; refresh(); }); }
      });
      var ingGr=byId("ing-gr"), ingCpg=byId("ing-cpg"), ingPeso=byId("ing-peso"), ingLiv=byId("ing-liv"), ingStab=byId("ing-stab");
      if(ingGr) ingGr.addEventListener("input", function(e){ state.popolazioni.ingrasso.gruppi=num(e.target.value); refresh(); });
      if(ingCpg) ingCpg.addEventListener("input", function(e){ state.popolazioni.ingrasso.capiPerGruppo=num(e.target.value); refresh(); });
      if(ingPeso) ingPeso.addEventListener("input", function(e){ state.popolazioni.ingrasso.peso=num(e.target.value); refresh(); });
      if(ingLiv) ingLiv.addEventListener("change", function(e){ state.popolazioni.ingrasso.livello=e.target.value; refresh(); });
      if(ingStab) ingStab.addEventListener("change", function(e){ state.popolazioni.ingrasso.stab=e.target.value; refresh(); });

      // Pulsanti
      var checkBtn=byId("checkBtn"); if(checkBtn) checkBtn.addEventListener("click", function(){ var cf=conformita(); checkBtn.textContent="Check superficie: "+cf.pct+"% — "+cf.stato; });
      var next=byId("btn-next"); if(next) next.addEventListener("click", function(){ alert("Proseguiamo con Pagina 2 dopo la chiusura definitiva della 1."); });

      var tf=byId("titleFooter"); if(tf) tf.textContent=repoName();
      var sk=byId("sketch"); if(sk){ sk.innerHTML=sketch(state.cap.forma); }

      // prime label & refresh
      updateUnitariLabels();
      refresh();
    })
    .catch(function(err){
      alert("Errore inizializzazione (TXT): "+err.message);
      console.error("[BudgetBox] Bootstrap error:", err);
    });
  }

  // ------------------------ Export ------------------------
  global.PreventivoApp = { initPagina1:initPagina1, refresh:refresh };
})(window);
