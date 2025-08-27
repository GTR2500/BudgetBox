/* docs/assets/js/core.js */
(function (global) {
  // ---------------------------
  // Stato (in memoria) + dataset
  // ---------------------------
  var state = {
    anagrafica: { cliente: "", localita: "", riferimento: "", data: new Date().toISOString().slice(0,10) },
    capannone: { lunghezza: 60, larghezza: 25, prezzoMq: 180, quotaDecubito: 70, note: "Struttura metallica zincata, copertura sandwich 40 mm" },
    popolazioni: {
      bovineAdulte:  { n: 0, stab: "lettiera" },
      manzeBovine:   { n: 0, stab: "lettiera" },
      toriRimonta:   { n: 0, stab: "libera"   },
      bufaleAdulte:  { n: 0, stab: "lettiera" },
      bufaleParto:   { n: 0, stab: "lettiera" },
      manzeBufaline: { n: 0, stab: "lettiera" },
      ingrasso: { gruppi: 0, capiPerGruppo: 0, peso: 550, livello: "Adeguato" }
    }
  };
  var norme = null;

  // ---------------------------
  // Utilità
  // ---------------------------
  function num(v){ return Number(v || 0); }
  function fmt1(v){ return (Math.round(v*10)/10).toFixed(1); }
  function deepMerge(target, source){
    if (!source || typeof source !== "object") return target;
    Object.keys(source).forEach(function(k){
      if (source[k] && typeof source[k] === "object" && !Array.isArray(source[k])) {
        target[k] = deepMerge(target[k] || {}, source[k]);
      } else {
        target[k] = source[k];
      }
    });
    return target;
  }

  // Stato in URL (no storage locale)
  function encodeState(obj){
    var json = JSON.stringify(obj);
    var bytes = new TextEncoder().encode(json);
    var bin = "";
    for (var i=0;i<bytes.length;i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function decodeState(str){
    try{
      var bin = atob(str);
      var bytes = new Uint8Array(bin.length);
      for (var i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
      var json = new TextDecoder().decode(bytes);
      return JSON.parse(json);
    } catch(e){ return null; }
  }
  function getParam(name){
    var m = new RegExp("[?&]"+name+"=([^&]*)").exec(location.search);
    return m ? decodeURIComponent(m[1]) : null;
  }

  // ---------------------------
  // Calcoli
  // ---------------------------
  function areaLorda(){ return num(state.capannone.lunghezza) * num(state.capannone.larghezza); }
  function areaDecubitoReale(){ return areaLorda() * num(state.capannone.quotaDecubito) / 100; }
  function ingrassoMqPerCapo(peso){
    var arr = norme.ingrasso.mq_per_capo;
    for (var i=0;i<arr.length;i++){ if (peso <= arr[i].maxPesoKg) return arr[i].mq; }
    return arr[arr.length-1].mq;
  }
  function areaNormativaRichiesta(){
    var u = norme.unitari_mq, p = state.popolazioni;
    var base =
      num(p.bovineAdulte.n)  * u.bovineAdulte  +
      num(p.manzeBovine.n)   * u.manzeBovine   +
      num(p.toriRimonta.n)   * u.toriRimonta   +
      num(p.bufaleAdulte.n)  * u.bufaleAdulte  +
      num(p.bufaleParto.n)   * u.bufaleParto   +
      num(p.manzeBufaline.n) * u.manzeBufaline;
    var nIngrasso = num(p.ingrasso.gruppi) * num(p.ingrasso.capiPerGruppo);
    var mqIngrasso = nIngrasso * ingrassoMqPerCapo(num(p.ingrasso.peso));
    return base + mqIngrasso;
  }
  function costoStruttura(){ return areaLorda() * num(state.capannone.prezzoMq); }
  function conformita(){
    var req = areaNormativaRichiesta();
    var real = areaDecubitoReale();
    if (req === 0 && real === 0) return { stato:"—", ratio:1 };
    var ratio = req>0 ? real/req : 0;
    var stato = ratio>=1.1 ? "Adeguato" : (ratio>=1.0 ? "Conforme" : "Non conforme");
    return { stato:stato, ratio:ratio };
  }

  // ---------------------------
  // UI helpers
  // ---------------------------
  function byId(id){ return document.getElementById(id); }
  function setBadge(el, stato){
    var cls = "badge";
    if (stato==="Adeguato") cls += " ok";
    else if (stato==="Conforme") cls += " mid";
    else if (stato==="Non conforme") cls += " ko";
    el.className = cls; el.textContent = stato;
  }

  // ---------------------------
  // Bootstrap pagina 1
  // ---------------------------
  function initPagina1(){
    // dataset da repo
    fetch("./assets/data/norme.json", { cache:"no-store" })
      .then(function(r){ if(!r.ok) throw new Error("norme.json"); return r.json(); })
      .then(function(json){
        norme = json;

        // se arriva stato da URL, merge
        var enc = getParam("s");
        var incoming = enc ? decodeState(enc) : null;
        if (incoming) deepMerge(state, incoming);

        // DOM refs
        var el = {
          cli: byId("cli"), loc: byId("loc"), rif: byId("rif"), dat: byId("dat"),
          len: byId("len"), wid: byId("wid"), quo: byId("quo"), prz: byId("prz"), not: byId("not"),
          badge: byId("badge"),
          areaLorda: byId("areaLorda"), areaDecubito: byId("areaDecubito"), areaNormativa: byId("areaNormativa"),
          n: {
            bovineAdulte: byId("n-bovineAdulte"),
            manzeBovine: byId("n-manzeBovine"),
            toriRimonta: byId("n-toriRimonta"),
            bufaleAdulte: byId("n-bufaleAdulte"),
            bufaleParto: byId("n-bufaleParto"),
            manzeBufaline: byId("n-manzeBufaline")
          },
          s: {
            bovineAdulte: byId("s-bovineAdulte"),
            manzeBovine: byId("s-manzeBovine"),
            toriRimonta: byId("s-toriRimonta"),
            bufaleAdulte: byId("s-bufaleAdulte"),
            bufaleParto: byId("s-bufaleParto"),
            manzeBufaline: byId("s-manzeBufaline")
          },
          ing: { gr: byId("ing-gr"), cpg: byId("ing-cpg"), peso: byId("ing-peso"), liv: byId("ing-liv") },
          next: byId("btn-next")
        };

        // popola select stabulazioni da dataset
        ["bovineAdulte","manzeBovine","toriRimonta","bufaleAdulte","bufaleParto","manzeBufaline"].forEach(function(k){
          var html = norme.stabulazioni.map(function(v){ return '<option value="'+v+'">'+v+'</option>'; }).join("");
          el.s[k].innerHTML = html;
        });

        // inizializza UI
        el.cli.value = state.anagrafica.cliente;
        el.loc.value = state.anagrafica.localita;
        el.rif.value = state.anagrafica.riferimento;
        el.dat.value = state.anagrafica.data;

        el.len.value = state.capannone.lunghezza;
        el.wid.value = state.capannone.larghezza;
        el.quo.value = state.capannone.quotaDecubito;
        el.prz.value = state.capannone.prezzoMq;
        el.not.value = state.capannone.note;

        Object.keys(el.n).forEach(function(k){
          el.n[k].value = state.popolazioni[k].n;
          el.s[k].value = state.popolazioni[k].stab;
        });
        el.ing.gr.value = state.popolazioni.ingrasso.gruppi;
        el.ing.cpg.value = state.popolazioni.ingrasso.capiPerGruppo;
        el.ing.peso.value = state.popolazioni.ingrasso.peso;
        el.ing.liv.value = state.popolazioni.ingrasso.livello;

        // listeners
        function bind(idPath, setter){
          setter(); // initial
        }
        el.cli.addEventListener("input", function(e){ state.anagrafica.cliente = e.target.value; refresh(); });
        el.loc.addEventListener("input", function(e){ state.anagrafica.localita = e.target.value; refresh(); });
        el.rif.addEventListener("input", function(e){ state.anagrafica.riferimento = e.target.value; refresh(); });
        el.dat.addEventListener("input", function(e){ state.anagrafica.data = e.target.value; refresh(); });

        el.len.addEventListener("input", function(e){ state.capannone.lunghezza = num(e.target.value); refresh(); });
        el.wid.addEventListener("input", function(e){ state.capannone.larghezza = num(e.target.value); refresh(); });
        el.quo.addEventListener("input", function(e){ state.capannone.quotaDecubito = num(e.target.value); refresh(); });
        el.prz.addEventListener("input", function(e){ state.capannone.prezzoMq = num(e.target.value); refresh(); });
        el.not.addEventListener("input", function(e){ state.capannone.note = e.target.value; });

        Object.keys(el.n).forEach(function(k){
          el.n[k].addEventListener("input", function(e){ state.popolazioni[k].n = num(e.target.value); refresh(); });
          el.s[k].addEventListener("change", function(e){ state.popolazioni[k].stab = e.target.value; });
        });
        el.ing.gr.addEventListener("input", function(e){ state.popolazioni.ingrasso.gruppi = num(e.target.value); refresh(); });
        el.ing.cpg.addEventListener("input", function(e){ state.popolazioni.ingrasso.capiPerGruppo = num(e.target.value); refresh(); });
        el.ing.peso.addEventListener("input", function(e){ state.popolazioni.ingrasso.peso = num(e.target.value); refresh(); });
        el.ing.liv .addEventListener("change", function(e){ state.popolazioni.ingrasso.livello = e.target.value; });

        // refresh derivati + abilita/URL "Prosegui"
        function refresh(){
          el.areaLorda.textContent    = fmt1(areaLorda());
          el.areaDecubito.textContent = fmt1(areaDecubitoReale());
          el.areaNormativa.textContent= fmt1(areaNormativaRichiesta());

          var cf = conformita();
          setBadge(el.badge, cf.stato);

          var okBase = state.anagrafica.cliente.trim().length>0 &&
                       num(state.capannone.lunghezza)>0 &&
                       num(state.capannone.larghezza)>0;
          if (okBase){
            var url = "impianti.html?s=" + encodeURIComponent(encodeState(state));
            el.next.removeAttribute("disabled");
            el.next.dataset.href = url; // lo useremo al click
          } else {
            el.next.setAttribute("disabled","");
            el.next.dataset.href = "";
          }
        }
        refresh();

        // Click su "Prosegui": naviga solo se abilitato
        el.next.addEventListener("click", function(){
          var href = el.next.dataset.href || "";
          if (href) location.href = href;
        });
      })
      .catch(function(err){
        alert("Errore nel caricamento del dataset: " + err.message);
      });
  }

  // Espone init per index.html
  global.PreventivoApp = { initPagina1: initPagina1 };
})(window);
