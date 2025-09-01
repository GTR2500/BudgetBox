/* BudgetBox – Pagina 1 “stamattina”
   - Legge i TXT da /public/documenti/
   - Popola Località e Stabulazioni
   - Calcola: area lorda, area decubito, area normativa, costo struttura
   - Badge capi = verde se > 0
*/
(function (global) {
  "use strict";

  var APP_VERSION = "v1.1.1";

  // ---------- Helpers ----------
  function byId(id){ return document.getElementById(id); }
  function num(v){ return Number((v??"").toString().replace(",", ".")) || 0; }
  function fmt1(n){ return (Math.round(n*10)/10).toFixed(1); }
  function euro(n){ return (n||0).toLocaleString("it-IT",{style:"currency",currency:"EUR"}); }

  function repoName(){
    var seg = location.pathname.split("/").filter(Boolean);
    return seg.length>=2 ? seg[1] : (seg[0]||"BudgetBox");
  }

  // fetch TXT con fallback percorsi
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
  function splitLines(txt){
    return (txt||"").split(/\r?\n/).map(function(l){return l.trim();})
      .filter(Boolean).filter(function(l){return !/^#|^\/\//.test(l);});
  }
  function detectDelim(line){
    var c=[";","\t",",","|"];
    for(var i=0;i<c.length;i++) if(line.indexOf(c[i])>=0) return c[i];
    return ";";
  }

  // ---------- Parsers ----------
  function parseLocalita(txt){
    var lines=splitLines(txt); if(!lines.length) return [];
    var d=detectDelim(lines[0]);
    var H=lines[0].split(d).map(function(s){return s.trim().toUpperCase();});
    function idx(n){ var i=H.indexOf(n); return i<0?null:i; }
    var iReg=idx("REGIONE"), iProv=idx("PROV_CITTA_METROPOLITANA"),
        iSig=idx("SIGLA_PROV"), iCom=idx("COMUNE"), iI=idx("COD_ISTAT_COMUNE"),
        iS=idx("ZONA_SISMICA"), iV=idx("VENTO"), iN=idx("CARICO_NEVE"), iA=idx("ALTITUDINE");
    var out=[];
    for(var r=1;r<lines.length;r++){
      var c=lines[r].split(d).map(function(s){return s.trim();});
      var ist=(iI!=null?c[iI]:"")||""; if(!ist) continue;
      var sig=(iSig!=null?c[iSig]:"")||"", com=(iCom!=null?c[iCom]:"")||"";
      out.push({
        id: ist, nome: com + (sig?(" ("+sig+")"):""),
        regione: iReg!=null?c[iReg]:"", provincia: iProv!=null?c[iProv]:"",
        sigla:sig, comune:com, istat:ist,
        zonaSismica: iS!=null?c[iS]:"", vento_ms: num(iV!=null?c[iV]:0),
        neve_kgm2: num(iN!=null?c[iN]:0), alt_m:num(iA!=null?c[iA]:0)
      });
    }
    return out.sort(function(a,b){return a.nome.localeCompare(b.nome,"it");});
  }

  function parseUnitari(txt){
    // fallback storico: categoria;mq
    var lines=splitLines(txt); if(!lines.length) return {};
    var d=detectDelim(lines[0]);
    var H=lines[0].split(d).map(function(s){return s.trim().toLowerCase();});
    var iC=H.indexOf("categoria"), iM=H.indexOf("mq");
    var out={};
    for(var i=1;i<lines.length;i++){
      var c=lines[i].split(d); var cat=(c[iC]||"").trim(); if(!cat) continue;
      out[cat]=num(c[iM]);
    }
    return out;
  }

  function parseStabOpzioni(txt){
    var lines=splitLines(txt); if(!lines.length) return {};
    var d=detectDelim(lines[0]);
    var H=lines[0].split(d).map(function(s){return s.trim().toLowerCase();});
    var iC=H.indexOf("categoria"), iO=H.indexOf("opzioni");
    var out={};
    for(var i=1;i<lines.length;i++){
      var c=lines[i].split(d); var cat=(c[iC]||"").trim(); if(!cat) continue;
      out[cat]=(c[iO]||"").split(",").map(function(s){return s.trim();}).filter(Boolean);
    }
    return out;
  }

  function parseStabRange(txt){
    var lines=splitLines(txt); if(!lines.length) return {};
    var d=detectDelim(lines[0]);
    var H=lines[0].split(d).map(function(s){return s.trim().toLowerCase();});
    var iC=H.indexOf("categoria"), iL=H.indexOf("adeguato_min"),
        iH=H.indexOf("adeguato_max"), iO=H.indexOf("ottimale_min");
    var out={};
    for(var i=1;i<lines.length;i++){
      var c=lines[i].split(d); var cat=(c[iC]||"").trim(); if(!cat) continue;
      out[cat]={ adeguato:[num(c[iL]),num(c[iH])], ottimale_min:num(c[iO]) };
    }
    return out;
  }

  function parseIngrasso(txt){
    var lines=splitLines(txt); if(!lines.length) return [];
    var d=detectDelim(lines[0]);
    var H=lines[0].split(d).map(function(s){return s.trim().toLowerCase();});
    var iW=H.indexOf("peso"), iM=H.indexOf("min"), iO=H.indexOf("opt");
    var out=[];
    for(var i=1;i<lines.length;i++){
      var c=lines[i].split(d);
      out.push({peso:num(c[iW]), min:num(c[iM]), opt:num(c[iO])});
    }
    return out.sort(function(a,b){return a.peso-b.peso;});
  }

  // ---------- Stato ----------
  var DATA = {
    unitari_mq:{},
    stab_opts:{},
    stab_range:{},
    ingrasso_tab:[]
  };
  var state = {
    anagrafica:{ cliente:"", riferimento:"", data:new Date().toISOString().slice(0,10), localitaId:"" },
    meteo:{ neve_kgm2:0, vento_ms:0, alt_m:0, zonaSismica:"", regione:"", provincia:"", istat:"" },
    struttura:{ len:60, wid:25, quota:70, prezzo:180, note:"Struttura metallica zincata, copertura sandwich 40 mm" },
    pop:{
      bovineAdulte:{ n:0, stab:"lettiera", livello:"Adeguato" },
      manzeBovine:{ n:0, stab:"lettiera", livello:"Adeguato" },
      toriRimonta:{ n:0, stab:"libera", livello:"Adeguato" },
      bufaleParto:{ n:0, stab:"lettiera", livello:"Adeguato" },
      bufaleAdulte:{ n:0, stab:"lettiera", livello:"Adeguato" },
      manzeBufaline:{ n:0, stab:"lettiera", livello:"Adeguato" },
      ingrasso:{ gruppi:0, cpg:0, peso:550, livello:"Adeguato" }
    }
  };
  var localitaDB=[];

  // ---------- Calcoli ----------
  function areaLorda(){ return num(state.struttura.len)*num(state.struttura.wid); }
  function areaDecubito(){ return areaLorda() * (num(state.struttura.quota)/100); }

  function areaNormativa(){
    var P=state.pop, base=0, U=DATA.unitari_mq, R=DATA.stab_range;

    function range(cat, liv){
      var r=R[cat]; if(!r) return num(U[cat]||0);
      if(liv==="Ottimale") return r.ottimale_min || ((r.adeguato||[])[1]||0);
      return (num(r.adeguato[0])+num(r.adeguato[1]))/2;
    }

    base += num(P.bovineAdulte.n)*range("bovineAdulte", P.bovineAdulte.livello);
    base += num(P.manzeBovine.n)*range("manzeBovine", P.manzeBovine.livello);
    base += num(P.toriRimonta.n)*range("toriRimonta", P.toriRimonta.livello);
    base += num(P.bufaleAdulte.n)*range("bufaleAdulte", P.bufaleAdulte.livello);
    base += num(P.bufaleParto.n)*range("bufaleParto", P.bufaleParto.livello);
    base += num(P.manzeBufaline.n)*range("manzeBufaline", P.manzeBufaline.livello);

    // ingrasso: stima semplice da tabella vicina
    var tab=DATA.ingrasso_tab||[], peso=num(P.ingrasso.peso||550), mq=0;
    if(tab.length){
      var close=tab.reduce(function(best,row){
        return (Math.abs(row.peso-peso) < Math.abs(best.peso-peso)) ? row : best;
      }, tab[0]);
      mq = (P.ingrasso.livello==="Ottimale") ? num(close.opt) : (num(close.min)+num(close.opt))/2;
    }
    base += num(P.ingrasso.gruppi)*num(P.ingrasso.cpg)*mq;

    return base;
  }

  function conformita(){
    var req = areaNormativa();
    var real = areaDecubito();
    var ratio = req>0 ? real/req : 0;
    var stato = ratio>=1.1 ? "Adeguato" : (ratio>=1.0 ? "Conforme" : "Non conforme");
    return { stato:stato, pct: Math.round((req>0?ratio:1)*100) };
  }

  // ---------- UI ----------
  function setCapBadge(id, n){
    var el=byId(id); if(!el) return;
    var v=num(n)||0; el.textContent=v+" capi";
    el.classList.toggle("ok", v>0);
  }

  function updateUnitariLabels(){
    function set(cat, id){
      var r=DATA.stab_range[cat];
      var mq = r ? ((num(r.adeguato[0])+num(r.adeguato[1]))/2) : num(DATA.unitari_mq[cat]||0);
      var el=byId(id); if(el) el.textContent = mq ? mq.toFixed(2) : "—";
    }
    set("bovineAdulte","vu-bovineAdulte");
    set("manzeBovine","vu-manzeBovine");
    set("toriRimonta","vu-toriRimonta");
    set("bufaleAdulte","vu-bufaleAdulte");
    set("bufaleParto","vu-bufaleParto");
    set("manzeBufaline","vu-manzebufaline");
  }

  function refresh(){
    // KPI struttura
    byId("areaLorda").textContent    = fmt1(areaLorda());
    byId("areaDecubito").textContent = fmt1(areaDecubito());
    byId("areaNormativa").textContent= fmt1(areaNormativa());
    byId("costoStruttura").textContent = euro(areaLorda()*num(state.struttura.prezzo));

    // Conformità
    var cf=conformita();
    var b=byId("badge"); var cls="badge";
    if(cf.stato==="Adeguato") cls+=" ok";
    else if(cf.stato==="Conforme") cls+=" mid";
    else cls+=" ko";
    b.className=cls; b.textContent=cf.stato;
    byId("badgePct").textContent="("+cf.pct+"%)";

    // badge capi
    setCapBadge("cap-bovineAdulte", state.pop.bovineAdulte.n);
    setCapBadge("cap-manzeBovine", state.pop.manzeBovine.n);
    setCapBadge("cap-toriRimonta", state.pop.toriRimonta.n);
    setCapBadge("cap-bufaleParto", state.pop.bufaleParto.n);
    setCapBadge("cap-bufaleAdulte", state.pop.bufaleAdulte.n);
    setCapBadge("cap-manzeBufaline", state.pop.manzeBufaline.n);
    var nIng=num(state.pop.ingrasso.gruppi)*num(state.pop.ingrasso.cpg);
    setCapBadge("cap-ingrasso", nIng);

    updateUnitariLabels();

    // bottone next abilitato con dati minimi
    var next=byId("btn-next");
    if(next){ next.disabled = !(num(state.struttura.len)>0 && num(state.struttura.wid)>0); }
  }

  function updateMeteoBadge(){
    var b=byId("badge-meteo");
    var L = localitaDB.find(function(x){return x.id===state.anagrafica.localitaId;});
    if(!L){ b.innerHTML="—"; return; }
    var r1 = "Neve "+(L.neve_kgm2.toFixed(2))+" kg/m² · Vento "+(L.vento_ms.toFixed(2))+" m/s · Alt "+Math.round(L.alt_m)+" m";
    var r2 = "Zona "+(L.zonaSismica||"—")+" · "+(L.regione||"—")+" · "+(L.provincia||"—")+" · ISTAT "+(L.istat||"—");
    b.innerHTML = '<span class="bline">'+r1+'</span><span class="bline">'+r2+'</span>';
  }

  // ---------- Init ----------
  function initPagina1(){
    // Header/tema
    var title=byId("title"); if(title) title.textContent=repoName();
    byId("revDate").textContent=new Date().toLocaleDateString("it-IT");
    byId("revVer").textContent=APP_VERSION;
    document.documentElement.setAttribute("data-theme","light");
    var themeBtn=byId("themeBtn");
    if(themeBtn) themeBtn.onclick=function(){
      var light=document.documentElement.getAttribute("data-theme")==="light";
      document.documentElement.setAttribute("data-theme", light?"dark":"light");
      themeBtn.textContent = light ? "☀️" : "🌙";
    };
    var printBtn=byId("printBtn"); if(printBtn) printBtn.onclick=function(){ window.print(); };

    // Inputs base
    var dat=byId("dat"); dat.value=state.anagrafica.data;
    byId("cli").oninput=function(e){ state.anagrafica.cliente=e.target.value; };
    byId("rif").oninput=function(e){ state.anagrafica.riferimento=e.target.value; };
    dat.oninput=function(e){ state.anagrafica.data=e.target.value; };

    ["len","wid","quo","prz_m2"].forEach(function(id){
      var el=byId(id);
      el.addEventListener("input", function(e){
        if(id==="len") state.struttura.len=num(e.target.value);
        if(id==="wid") state.struttura.wid=num(e.target.value);
        if(id==="quo") state.struttura.quota=num(e.target.value);
        if(id==="prz_m2") state.struttura.prezzo=num(e.target.value);
        refresh();
      });
    });
    var nt=byId("not"); nt.oninput=function(e){ state.struttura.note=e.target.value; };

    // Carico TXT
    Promise.allSettled([
      fetchTxt(["public/documenti/C-S-A-maggio-2025.txt","./public/documenti/C-S-A-maggio-2025.txt","/public/documenti/C-S-A-maggio-2025.txt"]),
      fetchTxt(["public/documenti/unitari_mq.txt","./public/documenti/unitari_mq.txt","/public/documenti/unitari_mq.txt"]),
      fetchTxt(["public/documenti/stabulazioni_opzioni.txt","./public/documenti/stabulazioni_opzioni.txt","/public/documenti/stabulazioni_opzioni.txt"]),
      fetchTxt(["public/documenti/stabulazioni_range.txt","./public/documenti/stabulazioni_range.txt","/public/documenti/stabulazioni_range.txt"]),
      fetchTxt(["public/documenti/ingrasso_tabella.txt","./public/documenti/ingrasso_tabella.txt","/public/documenti/ingrasso_tabella.txt"])
    ]).then(function(res){
      function ok(i){ return res[i].status==="fulfilled" ? res[i].value : ""; }

      try{ localitaDB = parseLocalita(ok(0)); }catch(e){ localitaDB=[]; }
      try{ DATA.unitari_mq = parseUnitari(ok(1)); }catch(e){ DATA.unitari_mq={}; }
      try{ DATA.stab_opts = parseStabOpzioni(ok(2)); }catch(e){ DATA.stab_opts={}; }
      try{ DATA.stab_range = parseStabRange(ok(3)); }catch(e){ DATA.stab_range={}; }
      try{ DATA.ingrasso_tab = parseIngrasso(ok(4)); }catch(e){ DATA.ingrasso_tab=[]; }

      // Località
      var loc=byId("fld-localita");
      loc.innerHTML = '<option value="">— Seleziona località —</option>' +
        localitaDB.map(function(L){ return '<option value="'+L.id+'">'+L.nome+'</option>';}).join("");
      loc.onchange=function(){
        var L=localitaDB.find(function(x){return x.id===loc.value;});
        if(!L){
          state.anagrafica.localitaId="";
          state.meteo={neve_kgm2:0, vento_ms:0, alt_m:0, zonaSismica:"", regione:"", provincia:"", istat:""};
        }else{
          state.anagrafica.localitaId=L.id;
          state.meteo.neve_kgm2=num(L.neve_kgm2);
          state.meteo.vento_ms=num(L.vento_ms);
          state.meteo.alt_m=num(L.alt_m);
          state.meteo.zonaSismica=L.zonaSismica||"";
          state.meteo.regione=L.regione||"";
          state.meteo.provincia=L.provincia||"";
          state.meteo.istat=L.istat||"";
        }
        updateMeteoBadge(); refresh();
      };
      updateMeteoBadge();

      // Stabulazioni → select
      function fillStab(cat, def){
        var sel=byId("s-"+cat);
        var opts=DATA.stab_opts[cat]||[def||"lettiera","libera","fissa"];
        sel.innerHTML=opts.map(function(o){return '<option>'+o+'</option>';}).join("");
        sel.value = opts.indexOf(state.pop[cat].stab)>=0 ? state.pop[cat].stab : opts[0];
        state.pop[cat].stab=sel.value;
        sel.onchange=function(e){ state.pop[cat].stab=e.target.value; refresh(); };
      }
      fillStab("bovineAdulte","lettiera");
      fillStab("manzeBovine","lettiera");
      fillStab("toriRimonta","libera");
      fillStab("bufaleParto","lettiera");
      fillStab("bufaleAdulte","lettiera");
      fillStab("manzeBufaline","lettiera");

      // Listener n/livello
      ["bovineAdulte","manzeBovine","toriRimonta","bufaleParto","bufaleAdulte","manzeBufaline"].forEach(function(cat){
        byId("n-"+cat).oninput=function(e){ state.pop[cat].n=num(e.target.value); refresh(); };
        byId("l-"+cat).onchange=function(e){ state.pop[cat].livello=e.target.value; refresh(); };
      });

      // Ingrasso
      byId("ing-gr").oninput=function(e){ state.pop.ingrasso.gruppi=num(e.target.value); refresh(); };
      byId("ing-cpg").oninput=function(e){ state.pop.ingrasso.cpg=num(e.target.value); refresh(); };
      byId("ing-peso").oninput=function(e){ state.pop.ingrasso.peso=num(e.target.value); refresh(); };
      byId("ing-liv").onchange=function(e){ state.pop.ingrasso.livello=e.target.value; refresh(); };

      // Check superficie
      var checkBtn=byId("checkBtn");
      checkBtn.onclick=function(){
        var cf=conformita();
        checkBtn.textContent="Check superficie: "+cf.pct+"% — "+cf.stato;
      };

      refresh();
    }).catch(function(err){
      console.error("Init error:", err);
      refresh(); // almeno KPI base
    });

    byId("titleFooter").textContent=repoName();
  }

  global.PreventivoApp = { initPagina1:initPagina1 };
})(window);
