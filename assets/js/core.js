/* BudgetBox – Core TXT (safe)
   Legge i .txt da /public/documenti/, popola i menu e fa i calcoli base.
   Versione: v0.3.3
   Nota: niente dipendenze, niente localStorage.
*/
(function (global) {
  "use strict";

  // -------------------- Utils --------------------
  var APP_VERSION = "v0.3.3";

  function byId(id){ return document.getElementById(id); }
  function num(v){ return Number((v??"").toString().replace(",", ".")) || 0; }
  function fmt1(v){ return (Math.round(v*10)/10).toFixed(1); }
  function fmt2(v){ return (Math.round(v*100)/100).toFixed(2); }

  function repoName(){
    var seg = location.pathname.split("/").filter(Boolean);
    return seg.length>=2 ? seg[1] : (seg[0]||"BudgetBox");
  }

  // fetch con fallback percorsi e protezioni
  function fetchTxt(paths){
    var p = Promise.reject();
    paths.forEach(function (path) {
      p = p.catch(function () {
        return fetch(path, {cache:"no-store"}).then(function(r){
          if(!r.ok) throw new Error("HTTP "+r.status+" @ "+path);
          return r.text();
        });
      });
    });
    return p;
  }

  function splitNonEmptyLines(txt){
    return (txt||"").split(/\r?\n/).map(function(l){return l.trim();})
      .filter(Boolean).filter(function(l){ return !/^#|^\/\//.test(l); });
  }
  function detectDelim(line){
    var c=[";","\t",",","|"];
    for(var i=0;i<c.length;i++){ if(line.indexOf(c[i])>=0) return c[i]; }
    return ";";
  }

  // -------------------- Parsers --------------------
  function parseLocalitaTxt(txt){
    var lines=splitNonEmptyLines(txt); if(!lines.length) return [];
    var d=detectDelim(lines[0]);
    var head=lines[0].split(d).map(function(s){return s.trim().toUpperCase();});
    function idx(n){ var i=head.indexOf(n); return i<0?null:i; }
    var iReg=idx("REGIONE"), iProv=idx("PROV_CITTA_METROPOLITANA"),
        iSig=idx("SIGLA_PROV"), iCom=idx("COMUNE"), iIstat=idx("COD_ISTAT_COMUNE"),
        iSis=idx("ZONA_SISMICA"), iV=idx("VENTO"), iN=idx("CARICO_NEVE"), iH=idx("ALTITUDINE");
    var out=[];
    for(var r=1;r<lines.length;r++){
      var c=lines[r].split(d).map(function(s){return s.trim();});
      var ist=(iIstat!=null?c[iIstat]:"")||"";
      if(!ist) continue;
      var sig=(iSig!=null?c[iSig]:"")||"";
      var com=(iCom!=null?c[iCom]:"")||"";
      out.push({
        id: ist,
        nome: com + (sig?(" ("+sig+")"):""),
        regione: iReg!=null?c[iReg]:"",
        provincia: iProv!=null?c[iProv]:"",
        sigla: sig,
        comune: com,
        istat: ist,
        zonaSismica: iSis!=null?c[iSis]:"",
        vento_ms: num(iV!=null?c[iV]:0),
        neve_kgm2: num(iN!=null?c[iN]:0),
        alt_m: num(iH!=null?c[iH]:0)
      });
    }
    return out.sort(function(a,b){return a.nome.localeCompare(b.nome,"it");});
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
    var lines=splitNonEmptyLines(txt); if(!lines.length) return [];
    var d=detectDelim(lines[0]);
    var head=lines[0].split(d).map(function(s){return s.trim().toLowerCase();});
    var iT=head.indexOf("roof_type"), iMin=head.indexOf("min_slope"),
        iMax=head.indexOf("max_slope"), iD=head.indexOf("descrizione");
    var out=[];
    for(var i=1;i<lines.length;i++){
      var c=lines[i].split(d);
      var label=(c[iT]||"").trim(); if(!label) continue;
      out.push({
        id: canonicalId(label),
        label: label,
        minSlopePct: num(c[iMin]),
        maxSlopePct: num(c[iMax]),
        descr: (c[iD]||"").trim()
      });
    }
    return out;
  }

  function parseStrutture(txt){
    var lines=splitNonEmptyLines(txt); if(!lines.length) return [];
    var d=detectDelim(lines[0]);
    var head=lines[0].split(d).map(function(s){return s.trim().toLowerCase();});
    var iId=head.indexOf("id"), iL=head.indexOf("label"),
        iF=head.indexOf("forma"), iP=head.indexOf("prezzomq"), iK=head.indexOf("kg_per_mq_base");
    var out=[];
    for(var i=1;i<lines.length;i++){
      var c=lines[i].split(d);
      var id=(c[iId]||"").trim(); if(!id) continue;
      out.push({
        id:id,
        label:(c[iL]||"").trim(),
        forma:canonicalId(c[iF]||""),
        prezzoMq:num(c[iP]),
        kg_per_mq_base:num(c[iK])
      });
    }
    return out;
  }

  function parseEuroScale(txt){
    var lines=splitNonEmptyLines(txt); if(!lines.length) return [];
    var d=detectDelim(lines[0]);
    var head=lines[0].split(d).map(function(s){return s.trim().toLowerCase();});
    var iA=head.indexOf("minarea_m2"), iE=head.indexOf("eurperkg");
    var out=[];
    for(var i=1;i<lines.length;i++){
      var c=lines[i].split(d);
      out.push({ minArea_m2:num(c[iA]), eurPerKg:num(c[iE]) });
    }
    return out;
  }

  function parseUnitari(txt){
    var lines=splitNonEmptyLines(txt); if(!lines.length) return {};
    var d=detectDelim(lines[0]);
    var head=lines[0].split(d).map(function(s){return s.trim().toLowerCase();});
    var iC=head.indexOf("categoria"), iM=head.indexOf("mq");
    var out={};
    for(var i=1;i<lines.length;i++){
      var c=lines[i].split(d); var cat=(c[iC]||"").trim(); if(!cat) continue;
      out[cat]=num(c[iM]);
    }
    return out;
  }

  function parseOpzioni(txt){
    var lines=splitNonEmptyLines(txt); if(!lines.length) return {};
    var d=detectDelim(lines[0]);
    var head=lines[0].split(d).map(function(s){return s.trim().toLowerCase();});
    var iC=head.indexOf("categoria"), iO=head.indexOf("opzioni");
    var out={};
    for(var i=1;i<lines.length;i++){
      var c=lines[i].split(d); var cat=(c[iC]||"").trim(); if(!cat) continue;
      out[cat]=(c[iO]||"").split(",").map(function(s){return s.trim();}).filter(Boolean);
    }
    return out;
  }

  function parseRange(txt){
    var lines=splitNonEmptyLines(txt); if(!lines.length) return {};
    var d=detectDelim(lines[0]);
    var head=lines[0].split(d).map(function(s){return s.trim().toLowerCase();});
    var iC=head.indexOf("categoria"), iL=head.indexOf("adeguato_min"),
        iH=head.indexOf("adeguato_max"), iO=head.indexOf("ottimale_min");
    var out={};
    for(var i=1;i<lines.length;i++){
      var c=lines[i].split(d); var cat=(c[iC]||"").trim(); if(!cat) continue;
      out[cat]={ adeguato:[num(c[iL]),num(c[iH])], ottimale_min:num(c[iO]) };
    }
    return out;
  }

  function parseIngrassoTab(txt){
    var lines=splitNonEmptyLines(txt); if(!lines.length) return [];
    var d=detectDelim(lines[0]);
    var head=lines[0].split(d).map(function(s){return s.trim().toLowerCase();});
    var iW=head.indexOf("peso"), iM=head.indexOf("min"), iO=head.indexOf("opt");
    var out=[];
    for(var i=1;i<lines.length;i++){
      var c=lines[i].split(d);
      out.push({ peso:num(c[iW]), min:num(c[iM]), opt:num(c[iO]) });
    }
    return out.sort(function(a,b){return a.peso-b.peso;});
  }

  function parseKVTable(txt){
    var lines=splitNonEmptyLines(txt); if(!lines.length) return {
      min_pct:3,max_pct:15,weights:{},scales:{},sismica:{map:{}},forma_bonus:{}
    };
    var d=detectDelim(lines[0]);
    var head=lines[0].split(d).map(function(s){return s.trim().toLowerCase();});
    var iG=head.indexOf("group"), iK=head.indexOf("key"), iS=head.indexOf("subkey"), iV=head.indexOf("value");
    var out={base:{},weights:{},scales:{},sismica:{map:{}},forma_bonus:{}};
    for(var i=1;i<lines.length;i++){
      var c=lines[i].split(d);
      var g=(c[iG]||"").trim(), k=(c[iK]||"").trim(), s=(c[iS]||"").trim(), v=(c[iV]||"").trim();
      if(!g) continue;
      if(g==="base"){ out.base[k]=num(v);}
      else if(g==="weights"){ out.weights[k]=num(v);}
      else if(g==="scales"){ out.scales[k]=out.scales[k]||{}; out.scales[k][s]=num(v);}
      else if(g==="sismica"){ out.sismica.map[k]=num(v);}
      else if(g==="forma_bonus"){ out.forma_bonus[k]=num(v);}
    }
    return {
      min_pct: out.base.min_pct||3,
      max_pct: out.base.max_pct||15,
      weights: out.weights,
      scales: out.scales,
      sismica: out.sismica,
      forma_bonus: out.forma_bonus
    };
  }

  // -------------------- Stato --------------------
  var DATA = {
    unitari_mq:{},
    stabulazioni:{ opzioni:{}, range_mq:{} },
    ingrasso_tabella:[],
    strutture:[],
    euro_per_kg_scale:[],
    forme_copertura:[],
    neve_vento_percent:{ min_pct:3, max_pct:15, weights:{}, scales:{}, sismica:{map:{}}, forma_bonus:{} },
    servizi_fissi:[]
  };

  var state = {
    anagrafica: { cliente:"", riferimento:"", data:new Date().toISOString().slice(0,10), localitaId:"", localita:"" },
    cap: {
      tipoId:"acciaio_zincato", forma:"bifalda", prezzoMq:180, kgBase:34,
      campN:0, campInt:0, lunghezza:60, larghezza:25, hTrave:0, spTest:0, spGr:0, quotaDecubito:70,
      note:"Struttura metallica zincata, copertura sandwich 40 mm"
    },
    meteo: { neve_kgm2:0, vento_ms:0, alt_m:0, zonaSismica:"", regione:"", provincia:"", istat:"" },
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

  // -------------------- Geometria & calcoli --------------------
  function lengthFromCampate(){
    var n=num(state.cap.campN), p=num(state.cap.campInt);
    return (n>0 && p>0) ? n*p : num(state.cap.lunghezza);
  }
  function dimsCopertura(){
    var L = num(state.cap.lunghezza) + 2*num(state.cap.spTest);
    var W = num(state.cap.larghezza) + 2*num(state.cap.spGr);
    return {L:L, W:W};
  }
  function areaLorda(){ return num(state.cap.lunghezza)*num(state.cap.larghezza); }
  function areaCoperta(){ var d=dimsCopertura(); return d.L*d.W; }

  function estimatedSlopePct(){
    var f = DATA.forme_copertura.find(function(x){return x.id===state.cap.forma;}) || {minSlopePct:0,maxSlopePct:0};
    var min=num(f.minSlopePct), max=num(f.maxSlopePct); if(max<min) max=min;
    // media semplice (robusta)
    return (min+max)/2;
  }
  function altezzaColmo(){
    var d=dimsCopertura(), W=d.W, s=estimatedSlopePct();
    var rise = (state.cap.forma==="monofalda"||state.cap.forma==="piano") ? (W*s/100) : ((W/2)*s/100);
    return num(state.cap.hTrave) + rise;
  }
  function areaFalda(){
    var d=dimsCopertura(), s=estimatedSlopePct();
    var sec=Math.sqrt(1+Math.pow(s/100,2));
    return d.L*d.W*sec;
  }

  function eurPerKgByArea(A){
    var scale=DATA.euro_per_kg_scale.slice().sort(function(a,b){return a.minArea_m2-b.minArea_m2;});
    var v=0; for(var i=0;i<scale.length;i++){ if(A>=num(scale[i].minArea_m2)) v=num(scale[i].eurPerKg); }
    return v;
  }
  function areaNormativaRichiesta(){
    var P=state.popolazioni, base=0;
    function pickRange(cat,liv){
      var r=DATA.stabulazioni.range_mq[cat];
      if(!r) return num(DATA.unitari_mq[cat]||0);
      if(liv==="Ottimale"){ return num(r.ottimale_min||((r.adeguato||[])[1]||0)); }
      return (num((r.adeguato||[])[0]) + num((r.adeguato||[])[1]))/2;
    }
    ["bovineAdulte","manzeBovine","toriRimonta","bufaleAdulte","bufaleParto","manzeBufaline"].forEach(function(cat){
      base += num(P[cat].n)*pickRange(cat, P[cat].livello||"Adeguato");
    });
    // ingrasso semplice (peso medio → riga più vicina)
    var tab=DATA.ingrasso_tabella||[], peso=num(P.ingrasso.peso||550);
    if(tab.length){
      var closest=tab.reduce(function(best,row){
        return (Math.abs(row.peso-peso) < Math.abs(best.peso-peso)) ? row : best;
      }, tab[0]);
      var mq = (P.ingrasso.livello==="Ottimale") ? num(closest.opt) : (num(closest.min)+num(closest.opt))/2;
      base += num(P.ingrasso.gruppi)*num(P.ingrasso.capiPerGruppo)*mq;
    }
    return base;
  }
  function conformita(){
    var req=areaNormativaRichiesta(), real=areaLorda()*num(state.cap.quotaDecubito)/100;
    var ratio = req>0 ? real/req : 0;
    var stato = ratio>=1.1 ? "Adeguato" : (ratio>=1.0 ? "Conforme" : "Non conforme");
    return { stato:stato, pct: Math.round((req>0?ratio:1)*100) };
  }

  function neveVentoPercent(){
    var cfg=DATA.neve_vento_percent||{};
    var w=cfg.weights||{}, sc=cfg.scales||{};
    var minP=num(cfg.min_pct||3), maxP=num(cfg.max_pct||15);
    function norm(v,max){ return (max?Math.max(0,Math.min(1,num(v)/num(max))):0); }
    var score = norm(state.meteo.neve_kgm2, sc.neve&&sc.neve.max)   *(w.neve||0)
              + norm(state.meteo.vento_ms,  sc.vento&&sc.vento.max) *(w.vento||0)
              + norm(state.meteo.alt_m,     sc.altitudine&&sc.altitudine.max)*(w.altitudine||0);
    // sismica
    var sis=0; if(cfg.sismica&&cfg.sismica.map){
      var z=(state.meteo.zonaSismica||"").toString().trim();
      sis = cfg.sismica.map[z]!=null ? num(cfg.sismica.map[z]) : num(cfg.sismica.map.default||0);
    }
    score += sis*(w.sismica||0);
    // forma bonus
    var fb=cfg.forma_bonus||{}; score += num(fb[state.cap.forma]||0)*(w.forma_bonus||0);
    score = Math.max(0, Math.min(1, score));
    return minP + (maxP-minP)*score;
  }
  function costoStruttura(){
    var AC=areaCoperta();
    var base = AC * num(state.cap.prezzoMq);
    var costKg = AC * num(state.cap.kgBase) * eurPerKgByArea(AC);
    var pct = neveVentoPercent(), extra = (base+costKg)*pct/100;
    return { base:base, kg:costKg, extraPct:pct, extraEuro:extra, totale:base+costKg+extra };
  }

  // -------------------- UI helpers --------------------
  function setCapBadge(id, n){
    var el=byId(id); if(!el) return;
    var v=num(n)||0; el.textContent=v+" capi"; el.className = v>0 ? "badge ok" : "badge";
  }
  function updateUnitariLabels(){
    function set(cat, id){
      var r=DATA.stabulazioni.range_mq[cat];
      var mq = r ? ((num(r.adeguato[0])+num(r.adeguato[1]))/2) : num(DATA.unitari_mq[cat]||0);
      var el=byId(id); if(el) el.textContent = mq ? (mq.toFixed(2)+" m²/capo") : "—";
    }
    set("bovineAdulte","vu-bovineAdulte");
    set("manzeBovine","vu-manzeBovine");
    set("toriRimonta","vu-toriRimonta");
    set("bufaleAdulte","vu-bufaleAdulte");
    set("bufaleParto","vu-bufaleParto");
    set("manzeBufaline","vu-manzebufaline");
    var t=DATA.ingrasso_tabella[0]; var el=byId("vu-ingrasso");
    if (el) el.textContent = t ? (((t.min+t.opt)/2).toFixed(2)+" m²/capo") : "—";
  }
  function updateLocBadge(){
    var b=byId("badge-meteo"); if(!b) return;
    var L = localitaDB.find(function(x){return x.id===state.anagrafica.localitaId;});
    if(!L){ b.textContent="—"; b.className="badge meta"; return; }
    var r1 = "ZONA_SISMICA: "+(L.zonaSismica||"—")+"; VENTO: "+fmt2(num(L.vento_ms))+" m/s; CARICO_NEVE: "+fmt2(num(L.neve_kgm2))+" kg/m²; ALTITUDINE: "+Math.round(num(L.alt_m))+" m";
    var r2 = "REGIONE: "+(L.regione||"—")+"; PROV_CITTA_METROPOLITANA: "+(L.provincia||"—")+"; COD_ISTAT_COMUNE: "+(L.istat||"—");
    b.innerHTML = '<span class="bline">'+r1+'</span><span class="bline">'+r2+'</span>';
    b.className="badge meta";
  }

  // -------------------- Refresh --------------------
  function refresh(){
    // Lunghezza ricalcolata se campate impostate
    var Lcalc = lengthFromCampate();
    if(num(state.cap.campN)>0 && num(state.cap.campInt)>0){
      state.cap.lunghezza = Lcalc;
      var lenEl=byId("len"); if(lenEl) lenEl.value = fmt2(Lcalc);
      var lenNote=byId("lenNote"); if(lenNote) lenNote.textContent="L calcolata: "+fmt2(Lcalc)+" m";
    }

    // KPI
    var elAL=byId("areaLorda"); if(elAL) elAL.textContent=fmt1(areaLorda());
    var elAC=byId("areaCoperta"); if(elAC) elAC.textContent=fmt1(areaCoperta());
    var elAF=byId("areaFalda"); if(elAF) elAF.textContent=fmt1(areaFalda());
    var elAN=byId("areaNormativa"); if(elAN) elAN.textContent=fmt1(areaNormativaRichiesta());

    var cf=conformita(); var badge=byId("badge"); if(badge){
      var cls="badge"; if(cf.stato==="Adeguato") cls+=" ok"; else if(cf.stato==="Conforme") cls+=" mid"; else if(cf.stato==="Non conforme") cls+=" ko";
      badge.className=cls; badge.textContent=cf.stato;
    }
    var pct=byId("badgePct"); if(pct) pct.textContent=cf.pct+"%";

    var CT=costoStruttura();
    var elCMq=byId("costoMq"); if(elCMq) elCMq.textContent=CT.base.toLocaleString("it-IT",{style:"currency",currency:"EUR"});
    var elCKg=byId("costoKg"); if(elCKg) elCKg.textContent=CT.kg.toLocaleString("it-IT",{style:"currency",currency:"EUR"});
    var elEX=byId("extraMeteo"); if(elEX) elEX.textContent=fmt2(CT.extraPct)+"% — "+CT.extraEuro.toLocaleString("it-IT",{style:"currency","currency":"EUR"});
    var elCT=byId("costoStruttura"); if(elCT) elCT.textContent=CT.totale.toLocaleString("it-IT",{style:"currency",currency:"EUR"});

    var hCol=byId("hColmoVal"); if(hCol) hCol.value=fmt2(altezzaColmo());

    // badge capi
    setCapBadge("cap-bovineAdulte", state.popolazioni.bovineAdulte.n);
    setCapBadge("cap-manzeBovine", state.popolazioni.manzeBovine.n);
    setCapBadge("cap-toriRimonta", state.popolazioni.toriRimonta.n);
    setCapBadge("cap-bufaleAdulte", state.popolazioni.bufaleAdulte.n);
    setCapBadge("cap-bufaleParto", state.popolazioni.bufaleParto.n);
    setCapBadge("cap-manzeBufaline", state.popolazioni.manzeBufaline.n);
    var nIng=num(state.popolazioni.ingrasso.gruppi)*num(state.popolazioni.ingrasso.capiPerGruppo);
    setCapBadge("cap-ingrasso", nIng);

    updateUnitariLabels();

    var next=byId("btn-next");
    if(next){ next.disabled = !((state.anagrafica.cliente||"").trim().length>0 && num(state.cap.lunghezza)>0 && num(state.cap.larghezza)>0); }
  }

  // -------------------- Init pagina --------------------
  function populateStabulazioniSelects(){
    function fill(cat){
      var sel=byId("s-"+cat); if(!sel) return;
      var list=DATA.stabulazioni.opzioni[cat]||["libera_lettiera","libera_cuccette","fissa_posta"];
      sel.innerHTML=list.map(function(v){return '<option value="'+v+'">'+v.replace(/_/g," ")+'</option>';}).join("");
      sel.value = list.indexOf(state.popolazioni[cat].stab)>=0 ? state.popolazioni[cat].stab : list[0];
      state.popolazioni[cat].stab = sel.value;
    }
    ["bovineAdulte","manzeBovine","toriRimonta","bufaleAdulte","bufaleParto","manzeBufaline"].forEach(fill);
    var selIng=byId("ing-stab"); if(selIng){
      var l=DATA.stabulazioni.opzioni.ingrasso||["libera_lettiera","grigliato"];
      selIng.innerHTML=l.map(function(v){return '<option value="'+v+'">'+v.replace(/_/g," ")+'</option>';}).join("");
      selIng.value = l.indexOf(state.popolazioni.ingrasso.stab)>=0 ? state.popolazioni.ingrasso.stab : l[0];
      state.popolazioni.ingrasso.stab = selIng.value;
    }
  }

  function loadFormeSelect(){
    var sel=byId("formaCopertura"), descr=byId("formaDescr"), sk=byId("sketch"); if(!sel) return;
    var list=DATA.forme_copertura.length?DATA.forme_copertura:[{id:"bifalda",label:"Bifalda",minSlopePct:10,maxSlopePct:25,descr:""}];
    sel.innerHTML=list.map(function(f){return '<option value="'+f.id+'">'+(f.label||f.id)+'</option>';}).join("");
    if(!list.find(function(x){return x.id===state.cap.forma;})) state.cap.forma=list[0].id;
    sel.value=state.cap.forma;
    if(descr){ var cur=list.find(function(x){return x.id===state.cap.forma;}); descr.textContent=cur&&cur.descr?cur.descr:""; }
    if(sk){ sk.innerHTML=""; } // (schizzo minimal per evitare SVG issues)
    sel.onchange=function(){ state.cap.forma=sel.value; loadFormeSelect(); refresh(); };
  }

  function initPagina1(){
    // header
    var t=byId("title"); if(t) t.textContent=repoName();
    var revDate=byId("revDate"); if(revDate) revDate.textContent=new Date().toLocaleDateString("it-IT");
    var revVer=byId("revVer"); if(revVer) revVer.textContent=APP_VERSION;
    document.documentElement.setAttribute("data-theme","light");
    var themeBtn=byId("themeBtn"); if(themeBtn) themeBtn.onclick=function(){
      var light=document.documentElement.getAttribute("data-theme")==="light";
      document.documentElement.setAttribute("data-theme", light?"dark":"light");
      themeBtn.textContent = light ? "☀️" : "🌙";
    };
    var printBtn=byId("printBtn"); if(printBtn) printBtn.onclick=function(){ window.print(); };

    // anagrafica
    var elCli=byId("cli"), elRif=byId("rif"), elDat=byId("dat"), elLoc=byId("fld-localita");
    if(elDat) elDat.value=state.anagrafica.data;
    if(elCli) elCli.oninput=function(e){ state.anagrafica.cliente=e.target.value; refresh(); };
    if(elRif) elRif.oninput=function(e){ state.anagrafica.riferimento=e.target.value; };
    if(elDat) elDat.oninput=function(e){ state.anagrafica.data=e.target.value; };

    // carico TXT (robusto: allSettled)
    Promise.allSettled([
      fetchTxt(["public/documenti/C-S-A-maggio-2025.txt","./public/documenti/C-S-A-maggio-2025.txt","/public/documenti/C-S-A-maggio-2025.txt"]),
      fetchTxt(["public/documenti/forme-coperture.txt","./public/documenti/forme-coperture.txt","/public/documenti/forme-coperture.txt"]),
      fetchTxt(["public/documenti/strutture.txt","./public/documenti/strutture.txt","/public/documenti/strutture.txt"]),
      fetchTxt(["public/documenti/euro_per_kg_scale.txt","./public/documenti/euro_per_kg_scale.txt","/public/documenti/euro_per_kg_scale.txt"]),
      fetchTxt(["public/documenti/unitari_mq.txt","./public/documenti/unitari_mq.txt","/public/documenti/unitari_mq.txt"]),
      fetchTxt(["public/documenti/stabulazioni_opzioni.txt","./public/documenti/stabulazioni_opzioni.txt","/public/documenti/stabulazioni_opzioni.txt"]),
      fetchTxt(["public/documenti/stabulazioni_range.txt","./public/documenti/stabulazioni_range.txt","/public/documenti/stabulazioni_range.txt"]),
      fetchTxt(["public/documenti/ingrasso_tabella.txt","./public/documenti/ingrasso_tabella.txt","/public/documenti/ingrasso_tabella.txt"]),
      fetchTxt(["public/documenti/neve_vento_percent.txt","./public/documenti/neve_vento_percent.txt","/public/documenti/neve_vento_percent.txt"])
    ]).then(function(res){
      function ok(i){ return res[i].status==="fulfilled" ? res[i].value : ""; }

      try{ localitaDB = parseLocalitaTxt(ok(0)); }catch(e){ console.error("parse localita",e); localitaDB=[]; }
      try{ DATA.forme_copertura = parseFormeTxt(ok(1)); }catch(e){ console.error("parse forme",e); DATA.forme_copertura=[]; }
      try{ DATA.strutture = parseStrutture(ok(2)); }catch(e){ console.error("parse strutture",e); DATA.strutture=[]; }
      try{ DATA.euro_per_kg_scale = parseEuroScale(ok(3)); }catch(e){ console.error("parse euro_scale",e); DATA.euro_per_kg_scale=[]; }
      try{ DATA.unitari_mq = parseUnitari(ok(4)); }catch(e){ console.error("parse unitari",e); DATA.unitari_mq={}; }
      try{ DATA.stabulazioni.opzioni = parseOpzioni(ok(5)); }catch(e){ console.error("parse stab opt",e); DATA.stabulazioni.opzioni={}; }
      try{ DATA.stabulazioni.range_mq = parseRange(ok(6)); }catch(e){ console.error("parse stab range",e); DATA.stabulazioni.range_mq={}; }
      try{ DATA.ingrasso_tabella = parseIngrassoTab(ok(7)); }catch(e){ console.error("parse ingrasso",e); DATA.ingrasso_tabella=[]; }
      try{ DATA.neve_vento_percent = parseKVTable(ok(8)); }catch(e){ console.error("parse neve_vento",e); }

      // Località select
      if(elLoc){
        elLoc.innerHTML = '<option value="">— Seleziona località —</option>' +
          localitaDB.map(function(L){ return '<option value="'+L.id+'">'+L.nome+'</option>';}).join("");
        elLoc.onchange=function(){
          var L=localitaDB.find(function(x){return x.id===elLoc.value;});
          if(!L){
            state.anagrafica.localitaId=""; state.anagrafica.localita="";
            state.meteo={neve_kgm2:0,vento_ms:0,alt_m:0,zonaSismica:"",regione:"",provincia:"",istat:""}; updateLocBadge(); refresh(); return;
          }
          state.anagrafica.localitaId=L.id; state.anagrafica.localita=L.nome;
          state.meteo.neve_kgm2=num(L.neve_kgm2); state.meteo.vento_ms=num(L.vento_ms); state.meteo.alt_m=num(L.alt_m);
          state.meteo.zonaSismica=L.zonaSismica||""; state.meteo.regione=L.regione||""; state.meteo.provincia=L.provincia||""; state.meteo.istat=L.istat||"";
          updateLocBadge(); refresh();
        };
      }
      updateLocBadge();

      // Tipo struttura
      var tipoSel=byId("tipoStruttura");
      if(tipoSel){
        var list=DATA.strutture.length?DATA.strutture:[{id:"acciaio_zincato",label:"Struttura metallica zincata",forma:"bifalda",prezzoMq:180,kg_per_mq_base:34}];
        tipoSel.innerHTML=list.map(function(s){return '<option value="'+s.id+'">'+s.label+'</option>';}).join("");
        var cur=list.find(function(s){return s.id===state.cap.tipoId;})||list[0];
        state.cap.tipoId=cur.id; state.cap.prezzoMq=num(cur.prezzoMq); state.cap.kgBase=num(cur.kg_per_mq_base); state.cap.forma=cur.forma||state.cap.forma;
        tipoSel.value=state.cap.tipoId;
        tipoSel.onchange=function(){
          var c=list.find(function(s){return s.id===tipoSel.value;}); if(!c) return;
          state.cap.tipoId=c.id; state.cap.prezzoMq=num(c.prezzoMq); state.cap.kgBase=num(c.kg_per_mq_base); state.cap.forma=c.forma||state.cap.forma;
          loadFormeSelect(); refresh();
        };
      }
      var prz=byId("prz"); if(prz){ prz.value=state.cap.prezzoMq; prz.oninput=function(e){ state.cap.prezzoMq=num(e.target.value); refresh(); }; }
      var kgB=byId("kgBase"); if(kgB){ kgB.value=state.cap.kgBase; kgB.oninput=function(e){ state.cap.kgBase=num(e.target.value); refresh(); }; }

      // Forma copertura
      loadFormeSelect();

      // Input struttura
      ["campN","campInt","len","wid","hTrave","spTest","spGr","quo"].forEach(function(id){
        var el=byId(id); if(!el) return;
        el.oninput=function(e){ state.cap[id]=num(e.target.value); refresh(); };
      });
      var not=byId("not"); if(not){ not.value=state.cap.note; not.oninput=function(e){ state.cap.note=e.target.value; }; }

      // Stabulazioni
      populateStabulazioniSelects();

      // Wiring popolazioni
      ["bovineAdulte","manzeBovine","toriRimonta","bufaleAdulte","bufaleParto","manzeBufaline"].forEach(function(cat){
        var n=byId("n-"+cat), s=byId("s-"+cat), l=byId("l-"+cat);
        if(n) n.oninput=function(e){ state.popolazioni[cat].n=num(e.target.value); refresh(); };
        if(s) s.onchange=function(e){ state.popolazioni[cat].stab=e.target.value; refresh(); };
        if(l) l.onchange=function(e){ state.popolazioni[cat].livello=e.target.value; refresh(); };
      });
      var ig=byId("ing-gr"), ic=byId("ing-cpg"), ip=byId("ing-peso"),
          il=byId("ing-liv"), isb=byId("ing-stab");
      if(ig) ig.oninput=function(e){ state.popolazioni.ingrasso.gruppi=num(e.target.value); refresh(); };
      if(ic) ic.oninput=function(e){ state.popolazioni.ingrasso.capiPerGruppo=num(e.target.value); refresh(); };
      if(ip) ip.oninput=function(e){ state.popolazioni.ingrasso.peso=num(e.target.value); refresh(); };
      if(il) il.onchange=function(e){ state.popolazioni.ingrasso.livello=e.target.value; refresh(); };
      if(isb) isb.onchange=function(e){ state.popolazioni.ingrasso.stab=e.target.value; refresh(); };

      // Check superficie
      var checkBtn=byId("checkBtn"); if(checkBtn) checkBtn.onclick=function(){
        var cf=conformita(); checkBtn.textContent="Check superficie: "+cf.pct+"% — "+cf.stato;
      };

      refresh();
    }).catch(function(err){
      console.error("Inizializzazione fallita:", err);
      // Non alziamo alert: la pagina resta utilizzabile
    });

    var tf=byId("titleFooter"); if(tf) tf.textContent=repoName();
  }

  // Export sicuro
  global.PreventivoApp = { initPagina1: initPagina1, refresh: refresh };
})(window);
