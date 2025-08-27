/* assets/js/core.js */
(function (global) {
  var APP_VERSION = "v0.1.1";

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
    }
  };

  var norme = null;
  var localitaDB = [];

  // ---------- Utils ----------
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
  function encodeState(o){ var json=JSON.stringify(o),b=new TextEncoder().encode(json),s=""; for(var i=0;i<b.length;i++) s+=String.fromCharCode(b[i]); return btoa(s); }
  function decodeState(str){ try{ var bin=atob(str),u=new Uint8Array(bin.length); for(var i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i); return JSON.parse(new TextDecoder().decode(u)); }catch(e){ return null; } }

  // ---------- Calcoli ----------
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
  function costoStruttura(){ return areaLorda()*num(state.capannone.prezzoMq); } // hook meteo pronto (vedi note)
  function conformita(){
    var req=areaNormativaRichiesta(), real=areaDecubitoReale();
    if(req===0 && real===0) return {stato:"—", pct:100};
    var ratio = req>0 ? real/req : 0;
    var stato = ratio>=1.1 ? "Adeguato" : (ratio>=1.0 ? "Conforme" : "Non conforme");
    return {stato:stato, pct: Math.round(ratio*100)};
  }

  // ---------- Parser Località
  // Supporta:
  // A) REGIONE;PROV_CITTA_METROPOLITANA;SIGLA_PROV;COMUNE;COD_ISTAT_COMUNE;ZONA_SISMICA
  // B) Versioni con colonne NEVE/VENTO (NEVE, NEVE_KN_M2, VENTO, VENTO_M_S, ZONA NEVE, ZONA VENTO)
  function parseLocalitaTxt(txt){
    var lines = txt.split(/\r?\n/).map(function(l){return l.trim();})
      .filter(Boolean).filter(function(l){return !/^#|^\/\//.test(l);});
    if (!lines.length) return [];
    var cand = [";","\t",",","|"];
    var delim = cand.find(function(d){ return (lines[0].indexOf(d)!==-1); }) || ";";

    var head = lines[0].split(delim).map(function(s){return s.trim();});
    var H = head.map(function(h){return h.toUpperCase();});
    var hasHeader = H.some(function(h){ return /COMUNE|SIGLA_PROV|NEVE|VENTO|ZONA/.test(h); });
    var start = hasHeader ? 1 : 0;

    function findIdx(names, fallback){
      for (var i=0;i<H.length;i++) for (var j=0;j<names.length;j++)
        if (H[i]===names[j] || H[i].indexOf(names[j])>=0) return i;
      return fallback;
    }

    var iComune = findIdx(["COMUNE"], 3);
    var iSigla  = findIdx(["SIGLA_PROV","SIGLA PROV","PROVINCIA","PROV"], 2);
    var iZn     = findIdx(["ZONA NEVE","ZONA_NEVE","ZN"], -1);
    var iZv     = findIdx(["ZONA VENTO","ZONA_VENTO","ZV"], -1);
    var iNeve   = findIdx(["NEVE","NEVE_KN_M2","NEVE (KN/M2)","KN/M2"], -1);
    var iVento  = findIdx(["VENTO","VENTO_M_S","VENTO (M/S)","M/S"], -1);

    var out=[];
    for (var r=start;r<lines.length;r++){
      var cols = lines[r].split(delim).map(function(s){return s.trim();});
      var comune = cols[iComune] || "";
      var sigla  = (cols[iSigla]||"").toUpperCase();
      if (!comune) continue;

      var nome = comune + (sigla?(" ("+sigla+")"):"");
      var id = (comune + " " + sigla).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,"-").replace(/(^-|-$)/g,"");

      var neve = iNeve>=0 ? Number((cols[iNeve]||"").replace(",","."))||0 : 0;
      var vento= iVento>=0 ? Number((cols[iVento]||"").replace(",","."))||0 : 0;

      out.push({
        id:id, nome:nome, provincia:sigla||"",
        zonaNeve: iZn>=0 ? (cols[iZn]||"") : "",
        zonaVento:iZv>=0 ? (cols[iZv]||"") : "",
        neve_kN_m2: neve,
        vento_m_s: vento
      });
    }
    return out.sort(function(a,b){ return a.nome.localeCompare(b.nome,"it"); });
  }

  // ---------- UI helpers ----------
  function byId(id){ return document.getElementById(id); }
  function repoName(){ var seg=location.pathname.split("/").filter(Boolean); return seg.length>=2?seg[1]:(seg[0]||"Preventivi"); }
  function setBadge(el, stato){
    var cls="badge";
    if (stato==="Adeguato") cls+=" ok"; else if (stato==="Conforme") cls+=" mid"; else if (stato==="Non conforme") cls+=" ko";
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

  // ---------- Bootstrap Pagina 1 ----------
  function initPagina1(){
    Promise.all([
      fetchFirst(["./assets/data/norme.json","assets/data/norme.json","/assets/data/norme.json"], false),
      fetchFirst(["public/documenti/C-S-A-maggio-2025.txt","./public/documenti/C-S-A-maggio-2025.txt","/public/documenti/C-S-A-maggio-2025.txt"], true)
    ])
    .then(function(res){
      norme = res[0];
      localitaDB = parseLocalitaTxt(res[1]);

      var cfg = getParam("cfg"); var cfgObj = cfg ? decodeState(cfg) : null;
      if (cfgObj && cfgObj.norme) deepMerge(norme, cfgObj.norme);

      var enc = getParam("s"); var incoming = enc ? decodeState(enc) : null;
      if (incoming) deepMerge(state, incoming);

      byId("title").textContent = repoName();
      byId("revDate").textContent = new Date().toLocaleDateString("it-IT");
      byId("revVer").textContent = APP_VERSION;

      var root = document.documentElement;
      root.setAttribute("data-theme","light");
      byId("themeBtn").addEventListener("click", function(){
        var isLight = root.getAttribute("data-theme")==="light";
        root.setAttribute("data-theme", isLight ? "dark" : "light");
        byId("themeBtn").textContent = isLight ? "☀️" : "🌙";
      });

      byId("printBtn").addEventListener("click", function(){ window.print(); });

      // Località (solo COMUNE (SIGLA_PROV))
      var selLoc = byId("loc");
      selLoc.innerHTML = '<option value="">— Seleziona località —</option>' +
        localitaDB.map(function(L){ return '<option value="'+L.id+'">'+L.nome+'</option>'; }).join("");
      if (state.anagrafica.localitaId) selLoc.value = state.anagrafica.localitaId;

      function updateLocBadge(){
        var id = selLoc.value;
        var L = localitaDB.find(function(x){return x.id===id;});
        var badge = byId("locBadge");
        if (!L){ badge.textContent="—"; badge.className="badge"; state.anagrafica.localita=""; return; }
        state.anagrafica.localitaId = id;
        state.anagrafica.localita = L.nome;

        // Mostra neve/vento se presenti in file, altrimenti "—"
        var parts = [];
        if (L.neve_kN_m2) parts.push("Neve "+L.neve_kN_m2.toFixed(2)+" kN/m²");
        if (L.vento_m_s)  parts.push("Vento "+L.vento_m_s+" m/s");
        if (L.zonaNeve || L.zonaVento) parts.push("(ZN "+(L.zonaNeve||"—")+" / ZV "+(L.zonaVento||"—")+")");
        badge.textContent = parts.length ? parts.join(" · ") : "—";
        badge.className = parts.length ? "badge mid" : "badge";
      }
      selLoc.addEventListener("change", updateLocBadge);
      updateLocBadge();

      // Anagrafica
      byId("cli").value = state.anagrafica.cliente;
      byId("rif").value = state.anagrafica.riferimento;
      byId("dat").value = state.anagrafica.data;
      byId("cli").addEventListener("input", function(e){ state.anagrafica.cliente=e.target.value; refresh(); });
      byId("rif").addEventListener("input", function(e){ state.anagrafica.riferimento=e.target.value; });
      byId("dat").addEventListener("input", function(e){ state.anagrafica.data=e.target.value; });

      // Struttura
      byId("len").value = state.capannone.lunghezza;
      byId("wid").value = state.capannone.larghezza;
      byId("quo").value = state.capannone.quotaDecubito;
      byId("prz").value = state.capannone.prezzoMq;
      byId("not").value = state.capannone.note;

      ["len","wid","quo","prz"].forEach(function(id){
        byId(id).addEventListener("input", function(e){
          var v=num(e.target.value);
          if(id==="len") state.capannone.lunghezza=v;
          if(id==="wid") state.capannone.larghezza=v;
          if(id==="quo") state.capannone.quotaDecubito=v;
          if(id==="prz") state.capannone.prezzoMq=v;
          refresh();
        });
      });
      byId("not").addEventListener("input", function(e){ state.capannone.note=e.target.value; });

      // Popolazioni
      var specie=["bovineAdulte","toriRimonta","bufaleParto","manzeBovine","bufaleAdulte","manzeBufaline"];
      specie.forEach(function(k){
        byId("n-"+k).value = state.popolazioni[k].n;
        byId("s-"+k).innerHTML = '<option value="lettiera">lettiera</option><option value="libera">libera</option>';
        byId("s-"+k).value = state.popolazioni[k].stab;
        byId("l-"+k).innerHTML = '<option>Adeguato</option><option>Modesto</option><option>Ottimo</option>';
        byId("l-"+k).value = state.popolazioni[k].livello;
        byId("n-"+k).addEventListener("input", function(e){ state.popolazioni[k].n=num(e.target.value); refresh(); });
        byId("s-"+k).addEventListener("change", function(e){ state.popolazioni[k].stab=e.target.value; });
        byId("l-"+k).addEventListener("change", function(e){ state.popolazioni[k].livello=e.target.value; });
      });
      byId("ing-gr").value   = state.popolazioni.ingrasso.gruppi;
      byId("ing-cpg").value  = state.popolazioni.ingrasso.capiPerGruppo;
      byId("ing-peso").value = state.popolazioni.ingrasso.peso;
      byId("ing-liv").value  = state.popolazioni.ingrasso.livello;
      byId("ing-gr").addEventListener("input",function(e){ state.popolazioni.ingrasso.gruppi=num(e.target.value); refresh(); });
      byId("ing-cpg").addEventListener("input",function(e){ state.popolazioni.ingrasso.capiPerGruppo=num(e.target.value); refresh(); });
      byId("ing-peso").addEventListener("input",function(e){ state.popolazioni.ingrasso.peso=num(e.target.value); refresh(); });
      byId("ing-liv").addEventListener("change",function(e){ state.popolazioni.ingrasso.livello=e.target.value; });

      // Valori unitari testuali
      var mapVU = {
        bovineAdulte:"vu-bovineAdulte",
        manzeBovine:"vu-manzeBovine",
        toriRimonta:"vu-toriRimonta",
        bufaleAdulte:"vu-bufaleAdulte",
        bufaleParto:"vu-bufaleParto",
        manzeBufaline:"vu-manzeBufaline"
      };
      Object.keys(mapVU).forEach(function(k){
        var el = byId(mapVU[k]); if (el) el.textContent = (norme.unitari_mq[k]||0).toFixed(2);
      });

      // Check superficie
      byId("checkBtn").addEventListener("click", function(){
        var cf = conformita();
        var btn = byId("checkBtn");
        btn.textContent = "Check superficie: " + cf.pct + "% — " + cf.stato;
      });

      // Prosegui
      var next = byId("btn-next");
      next.addEventListener("click", function(){
        var href = "impianti.html?s="+encodeURIComponent(encodeState(state));
        var cfg = getParam("cfg"); if (cfg) href += "&cfg="+encodeURIComponent(cfg);
        location.href = href;
      });

      // Refresh derivati
      function refresh(){
        byId("areaLorda").textContent     = fmt1(areaLorda());
        byId("areaDecubito").textContent  = fmt1(areaDecubitoReale());
        byId("areaNormativa").textContent = fmt1(areaNormativaRichiesta());
        byId("costoStruttura").textContent= costoStruttura().toLocaleString("it-IT",{style:"currency",currency:"EUR"});

        var cf = conformita();
        setBadge(byId("badge"), cf.stato);
        byId("badgePct").textContent = cf.pct+"%";

        var ok = state.anagrafica.cliente.trim().length>0 &&
                 num(state.capannone.lunghezza)>0 &&
                 num(state.capannone.larghezza)>0;
        next.disabled = !ok;
      }
      refresh();

      // Firma
      var tf = byId("titleFooter"); if (tf) tf.textContent = repoName();
    })
    .catch(function(err){
      alert("Errore inizializzazione: "+err.message);
    });
  }

  global.PreventivoApp = { initPagina1:initPagina1 };
})(window);
