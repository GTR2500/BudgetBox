/* BudgetBox – Pagina 1
   - Località dal TXT: REGIONE;PROV_CITTA_METROPOLITANA;SIGLA_PROV;COMUNE;COD_ISTAT_COMUNE;ZONA_SISMICA;VENTO;CARICO_NEVE;ALTITUDINE
   - Costo Struttura = area*m2*prezzo + area*(neve*€/kgm2 + vento*€/m/s)  [coeff in norme.json]
*/

(function (global) {
  var APP_VERSION = "v0.1.1";

  // Stato
  var state = {
    anagrafica: { cliente:"", localitaId:"", localita:"", riferimento:"", data: new Date().toISOString().slice(0,10) },
    capannone: { lunghezza:60, larghezza:25, prezzoMq:180, quotaDecubito:70, note:"Struttura metallica zincata, copertura sandwich 40 mm" },
    popolazioni: {
      bovineAdulte:{ n:0, stab:"lettiera", livello:"Adeguato" },
      manzeBovine:{ n:0, stab:"lettiera", livello:"Adeguato" },
      toriRimonta:{ n:0, stab:"libera",   livello:"Adeguato" },
      bufaleAdulte:{ n:0, stab:"lettiera", livello:"Adeguato" },
      bufaleParto:{ n:0, stab:"lettiera", livello:"Adeguato" },
      manzeBufaline:{ n:0, stab:"lettiera", livello:"Adeguato" },
      ingrasso:{ gruppi:0, capiPerGruppo:0, peso:550, livello:"Adeguato" }
    },
    meteo: { neve_kgm2: 0, vento_ms: 0, alt_m: 0 }
  };

  var norme = null;     // assets/data/norme.json (+ override via ?cfg=)
  var localitaDB = [];  // dal TXT

  // Utils
  function num(v){ return Number(v||0); }
  function fmt1(v){ return (Math.round(v*10)/10).toFixed(1); }
  function deepMerge(t,s){
    if(!s || typeof s!=="object") return t;
    Object.keys(s).forEach(function(k){
      if(s[k] && typeof s[k]==="object" && !Array.isArray(s[k])) t[k]=deepMerge(t[k]||{},s[k]);
      else t[k]=s[k];
    });
    return t;
  }
  function getParam(name){ var m=new RegExp("[?&]"+name+"=([^&]*)").exec(location.search); return m?decodeURIComponent(m[1]):null; }

  // Area / normative
  function areaLorda(){ return num(state.capannone.lunghezza)*num(state.capannone.larghezza); }
  function areaDecubitoReale(){ return areaLorda()*num(state.capannone.quotaDecubito)/100; }
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

  // ---- Costo Struttura con fattori meteo ----
  function costoStruttura(){
    var A = areaLorda();
    var base = A * num(state.capannone.prezzoMq);
    var cn = ((norme.meteo && norme.meteo.neve_eur_per_kgm2) ? Number(norme.meteo.neve_eur_per_kgm2) : 0);
    var cv = ((norme.meteo && norme.meteo.vento_eur_per_ms) ? Number(norme.meteo.vento_eur_per_ms) : 0);
    var extra = A * ( num(state.meteo.neve_kgm2) * cn + num(state.meteo.vento_ms) * cv );
    return base + extra;
  }

  function conformita(){
    var req=areaNormativaRichiesta(), real=areaDecubitoReale();
    if(req===0 && real===0) return {stato:"—", pct:100};
    var ratio = req>0 ? real/req : 0;
    var stato = ratio>=1.1 ? "Adeguato" : (ratio>=1.0 ? "Conforme" : "Non conforme");
    return {stato:stato, pct: Math.round(ratio*100)};
  }

  // ----- Parser Località (nuovo schema con VENTO / CARICO_NEVE / ALTITUDINE)
  function parseLocalitaTxt(txt){
    var lines = txt.split(/\r?\n/).map(function(l){return l.trim();})
      .filter(Boolean).filter(function(l){return !/^#|^\/\//.test(l);});
    if (!lines.length) return [];
    var cand = [";","\t",",","|"];
    var delim = cand.find(function(d){ return (lines[0].indexOf(d)!==-1); }) || ";";

    var head = lines[0].split(delim).map(function(s){return s.trim();});
    var H = head.map(function(h){return h.toUpperCase();});
    var hasHeader = true;
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
      // label selettore: COMUNE (SIGLA)
      rec.nome = rec.comune + (rec.sigla ? (" ("+rec.sigla+")") : "");
      rec.id = rec.istat;
      out.push(rec);
    }
    return out.sort(function(a,b){ return a.nome.localeCompare(b.nome,"it"); });
  }

  // UI helpers
  function byId(id){ return document.getElementById(id); }
  function pickId(ids){ for(var i=0;i<ids.length;i++){ var el=byId(ids[i]); if(el) return el; } return null; }
  function repoName(){ var seg=location.pathname.split("/").filter(Boolean); return seg.length>=2?seg[1]:(seg[0]||"Preventivi"); }
  function setBadge(el, stato){
    var cls="badge";
    if (stato==="Adeguato") cls+=" ok";
    else if (stato==="Conforme") cls+=" mid";
    else if (stato==="Non conforme") cls+=" ko";
    el.className=cls; el.textContent=stato;
  }
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

  // Bootstrap
  function initPagina1(){
    Promise.all([
      fetchFirst(["./assets/data/norme.json","assets/data/norme.json","/assets/data/norme.json"], false),
      fetchFirst(["public/documenti/C-S-A-maggio-2025.txt","./public/documenti/C-S-A-maggio-2025.txt","/public/documenti/C-S-A-maggio-2025.txt"], true)
    ])
    .then(function(res){
      norme = res[0];
      localitaDB = parseLocalitaTxt(res[1]);

      // override norme da ?cfg=
      var cfg = getParam("cfg"); 
      var cfgObj = cfg ? (function decodeState(str){
        try{ var bin=atob(str),u=new Uint8Array(bin.length); for(var i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i); return JSON.parse(new TextDecoder().decode(u)); }catch(e){ return null; }
      })(cfg) : null;
      if (cfgObj && cfgObj.norme) deepMerge(norme, cfgObj.norme);

      // header
      var titleEl = byId("title"); if (titleEl) titleEl.textContent = repoName();
      var revDate = byId("revDate"); if (revDate) revDate.textContent = new Date().toLocaleDateString("it-IT");
      var revVer  = byId("revVer");  if (revVer)  revVer.textContent  = APP_VERSION;
      var root = document.documentElement; root.setAttribute("data-theme","light");
      var themeBtn = byId("themeBtn"); if (themeBtn) themeBtn.addEventListener("click", function(){
        var isLight = root.getAttribute("data-theme")==="light";
        root.setAttribute("data-theme", isLight ? "dark" : "light");
        themeBtn.textContent = isLight ? "☀️" : "🌙";
      });
      var printBtn = byId("printBtn"); if (printBtn) printBtn.addEventListener("click", function(){ window.print(); });

      // campi anagrafica (supporto ids vecchi/nuovi)
      var elCli = pickId(["cli","fld-cliente"]);
      var elRif = pickId(["rif","fld-rif"]);
      var elDat = pickId(["dat","fld-data"]);
      var elLoc = pickId(["loc","fld-localita"]);
      if (elDat) elDat.value = state.anagrafica.data;

      // popola località
      if (elLoc){
        elLoc.innerHTML = '<option value="">— Seleziona località —</option>' +
          localitaDB.map(function(L){ return '<option value="'+L.id+'">'+L.nome+'</option>'; }).join("");
        elLoc.addEventListener("change", function(){
          var L = localitaDB.find(function(x){return x.id===elLoc.value;});
          if (!L){ state.anagrafica.localitaId=""; state.anagrafica.localita=""; state.meteo={neve_kgm2:0,vento_ms:0,alt_m:0}; updateLocBadge(); refresh(); return; }
          state.anagrafica.localitaId = L.id;
          state.anagrafica.localita   = L.nome;
          state.meteo.neve_kgm2 = num(L.neve_kgm2);
          state.meteo.vento_ms  = num(L.vento_ms);
          state.meteo.alt_m     = num(L.alt_m);
          updateLocBadge();
          refresh();
        });
      }
      updateLocBadge();

      if (elCli){ elCli.addEventListener("input", function(e){ state.anagrafica.cliente=e.target.value; refresh(); }); }
      if (elRif){ elRif.addEventListener("input", function(e){ state.anagrafica.riferimento=e.target.value; }); }
      if (elDat){ elDat.addEventListener("input", function(e){ state.anagrafica.data=e.target.value; }); }

      // Struttura
      ["len","wid","quo","prz"].forEach(function(id){
        var el=byId(id);
        if(el){ el.value = state.capannone[{len:"lunghezza",wid:"larghezza",quo:"quotaDecubito",prz:"prezzoMq"}[id]];
          el.addEventListener("input", function(e){
            var v=num(e.target.value);
            if(id==="len") state.capannone.lunghezza=v;
            if(id==="wid") state.capannone.larghezza=v;
            if(id==="quo") state.capannone.quotaDecubito=v;
            if(id==="prz") state.capannone.prezzoMq=v;
            refresh();
          });
        }
      });
      var elNot = byId("not"); if (elNot) elNot.addEventListener("input", function(e){ state.capannone.note=e.target.value; });

      // Popolazioni
      var specie=["bovineAdulte","toriRimonta","bufaleParto","manzeBovine","bufaleAdulte","manzeBufaline"];
      specie.forEach(function(k){
        var n = byId("n-"+k), s = byId("s-"+k), l = byId("l-"+k);
        if(n){ n.addEventListener("input", function(e){ state.popolazioni[k].n=num(e.target.value); refresh(); }); }
        if(s){ s.innerHTML='<option value="lettiera">lettiera</option><option value="libera">libera</option>'; s.value=state.popolazioni[k].stab; s.addEventListener("change", function(e){ state.popolazioni[k].stab=e.target.value; }); }
        if(l){ l.innerHTML='<option>Adeguato</option><option>Modesto</option><option>Ottimo</option>'; l.value=state.popolazioni[k].livello; l.addEventListener("change", function(e){ state.popolazioni[k].livello=e.target.value; }); }
      });
      ["ing-gr","ing-cpg","ing-peso","ing-liv"].forEach(function(id){
        var el=byId(id);
        if(!el) return;
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
      var mapVU = {
        bovineAdulte:"vu-bovineAdulte",
        manzeBovine:"vu-manzeBovine",
        toriRimonta:"vu-toriRimonta",
        bufaleAdulte:"vu-bufaleAdulte",
        bufaleParto:"vu-bufaleParto",
        manzeBufaline:"vu-manzeBufaline"
      };
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

  function updateLocBadge(){
    var badge = byId("badge-meteo") || byId("locBadge");
    if(!badge) return;
    var id = state.anagrafica.localitaId;
    var L = localitaDB.find(function(x){return x.id===id;});
    if (!L){ badge.textContent="—"; badge.className="badge"; return; }
    var parts=[];
    if (num(L.neve_kgm2)) parts.push("Neve "+num(L.neve_kgm2).toFixed(2)+" kg/m²");
    if (num(L.vento_ms))  parts.push("Vento "+num(L.vento_ms).toFixed(2)+" m/s");
    if (num(L.alt_m))     parts.push("Alt "+num(L.alt_m).toFixed(0)+" m");
    badge.textContent = parts.length? parts.join(" · ") : "—";
    badge.className = parts.length ? "badge mid" : "badge";
  }

  function refresh(){
    var AL = areaLorda(), AD = areaDecubitoReale(), AN = areaNormativaRichiesta();
    var costo = costoStruttura();

    var elAL = byId("areaLorda");      if (elAL) elAL.textContent = fmt1(AL);
    var elAD = byId("areaDecubito");   if (elAD) elAD.textContent = fmt1(AD);
    var elAN = byId("areaNormativa");  if (elAN) elAN.textContent = fmt1(AN);
    var elCS = byId("costoStruttura"); if (elCS) elCS.textContent = costo.toLocaleString("it-IT",{style:"currency",currency:"EUR"});

    var cf = conformita();
    var badge = byId("badge"); if (badge) setBadge(badge, cf.stato);
    var pct = byId("badgePct"); if (pct) pct.textContent = cf.pct+"%";

    var ok = (state.anagrafica.cliente||"").trim().length>0 && num(state.capannone.lunghezza)>0 && num(state.capannone.larghezza)>0;
    var next = byId("btn-next"); if (next) next.disabled = !ok;
  }

  // Export
  global.PreventivoApp = { initPagina1:initPagina1 };
})(window);
