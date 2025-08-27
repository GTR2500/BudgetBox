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
      var cols = lines
