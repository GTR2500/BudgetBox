/* docs/assets/js/impostazioni.js */
(function () {
  // ---------- Helpers ----------
  function byId(id){ return document.getElementById(id); }
  function getParam(name){ var m=new RegExp("[?&]"+name+"=([^&]*)").exec(location.search); return m?decodeURIComponent(m[1]):null; }
  function encodeCfg(o){
    var json=JSON.stringify(o), b=new TextEncoder().encode(json), s="";
    for(var i=0;i<b.length;i++) s+=String.fromCharCode(b[i]);
    return btoa(s);
  }
  function decodeCfg(str){
    try{
      var bin=atob(str), u=new Uint8Array(bin.length);
      for(var i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i);
      return JSON.parse(new TextDecoder().decode(u));
    }catch(e){ return null; }
  }
  function fetchFirst(paths, asText){
    var getter = asText ? function(r){return r.text();} : function(r){return r.json();};
    var chain = Promise.reject();
    paths.forEach(function(p){
      chain = chain.catch(function(){
        return fetch(p, {cache:"no-store"}).then(function(r){
          if(!r.ok) throw new Error("HTTP "+r.status+" @ "+p);
          return getter(r);
        });
      });
    });
    return chain;
  }
  function currency(v){ return Number(v||0).toLocaleString("it-IT"); }

  // ---------- Stato locale pagina ----------
  var cfg = { norme:null };     // { norme: { unitari_mq:{...}, ingrasso:{ mq_per_capo:[...] } } }

  // ---------- UI builders ----------
  function renderUnitari(container, unitari){
    container.innerHTML = "";
    var labels = {
      bovineAdulte:"Bovine adulte",
      manzeBovine:"Manze bovine",
      toriRimonta:"Tori da rimonta",
      bufaleAdulte:"Bufale adulte",
      bufaleParto:"Bufale al parto",
      manzeBufaline:"Manze bufaline"
    };
    Object.keys(unitari).forEach(function(k){
      var id = "u-"+k;
      var wrap = document.createElement("label");
      wrap.innerHTML = labels[k]+' (m²/capo)<input id="'+id+'" type="number" step="0.01" value="'+Number(unitari[k]).toFixed(2)+'">';
      container.appendChild(wrap);
      setTimeout(function(){
        byId(id).addEventListener("input", function(e){
          cfg.norme.unitari_mq[k] = Number(e.target.value || 0);
        });
      },0);
    });
  }

  function renderIngrasso(container, arr){
    container.innerHTML = "";

    arr.forEach(function(row, i){
      container.appendChild(makeIngrassoRow(i, row));
    });

    // Pulsante aggiungi
    var addWrap = document.createElement("div");
    addWrap.style.marginTop = "8px";
    var addBtn = document.createElement("button");
    addBtn.className = "btn btn-ghost";
    addBtn.textContent = "➕ Aggiungi soglia";
    addBtn.addEventListener("click", function(){
      cfg.norme.ingrasso.mq_per_capo.push({ maxPesoKg: 600, mq: 6.00, label: "new" });
      renderIngrasso(container, cfg.norme.ingrasso.mq_per_capo);
    });
    addWrap.appendChild(addBtn);
    container.parentElement.appendChild(addWrap);
  }

  function makeIngrassoRow(i, r){
    var row = document.createElement("div");
    row.className = "row4";
    row.style.alignItems = "end";
    row.style.gap = "12px";
    row.style.marginBottom = "8px";

    row.innerHTML =
      '<label>maxPesoKg <input id="ig-p-'+i+'" type="number" step="1" value="'+(r.maxPesoKg||0)+'"></label>'+
      '<label>mq/capo <input id="ig-m-'+i+'" type="number" step="0.01" value="'+Number(r.mq||0).toFixed(2)+'"></label>'+
      '<label>label <input id="ig-l-'+i+'" value="'+(r.label||"")+'"></label>'+
      '<div><button id="ig-x-'+i+'" class="btn btn-ghost" title="Rimuovi">🗑️</button></div>';

    setTimeout(function(){
      byId("ig-p-"+i).addEventListener("input", function(e){
        cfg.norme.ingrasso.mq_per_capo[i].maxPesoKg = Number(e.target.value||0);
      });
      byId("ig-m-"+i).addEventListener("input", function(e){
        cfg.norme.ingrasso.mq_per_capo[i].mq = Number(e.target.value||0);
      });
      byId("ig-l-"+i).addEventListener("input", function(e){
        cfg.norme.ingrasso.mq_per_capo[i].label = e.target.value;
      });
      byId("ig-x-"+i).addEventListener("click", function(){
        cfg.norme.ingrasso.mq_per_capo.splice(i,1);
        renderIngrasso(byId("ingrasso"), cfg.norme.ingrasso.mq_per_capo);
      });
    },0);

    return row;
  }

  // ---------- Applica / Download ----------
  function normalizeAndSort(){
    // Ordina le soglie per maxPesoKg asc e rimuovi eventuali NaN
    cfg.norme.ingrasso.mq_per_capo = (cfg.norme.ingrasso.mq_per_capo||[])
      .filter(function(r){ return isFinite(r.maxPesoKg) && isFinite(r.mq); })
      .sort(function(a,b){ return Number(a.maxPesoKg)-Number(b.maxPesoKg); });
  }

  function applyAndGoBack(){
    normalizeAndSort();
    var back = "index.html?cfg="+encodeURIComponent(encodeCfg(cfg));
    window.location.href = back;
  }

  function downloadNorme(){
    normalizeAndSort();
    var blob = new Blob([JSON.stringify(cfg.norme, null, 2)], {type:"application/json"});
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "norme.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ---------- Bootstrap ----------
  Promise.all([
    fetchFirst([
      "./assets/data/norme.json",
      "assets/data/norme.json",
      "/assets/data/norme.json"
    ], false)
  ])
  .then(function(res){
    var norme = res[0];

    // Merge con eventuale override arrivato da index (?cfg=)
    var cur = getParam("cfg");
    var curObj = cur ? decodeCfg(cur) : null;
    if (curObj && curObj.norme) {
      // deep merge minimale
      if (curObj.norme.unitari_mq) Object.assign(norme.unitari_mq, curObj.norme.unitari_mq);
      if (curObj.norme.ingrasso && Array.isArray(curObj.norme.ingrasso.mq_per_capo))
        norme.ingrasso.mq_per_capo = curObj.norme.ingrasso.mq_per_capo;
    }
    cfg.norme = JSON.parse(JSON.stringify(norme));

    // Popola UI
    renderUnitari(byId("unitari"), cfg.norme.unitari_mq);
    renderIngrasso(byId("ingrasso"), cfg.norme.ingrasso.mq_per_capo);

    // Bottoni
    byId("applyBtn").addEventListener("click", applyAndGoBack);
    byId("downloadBtn").addEventListener("click", downloadNorme);
    byId("backBtn").addEventListener("click", function(){
      // Torna conservando l’override corrente
      applyAndGoBack();
    });
  })
  .catch(function(e){
    alert("Errore impostazioni: "+e.message);
  });
})();
