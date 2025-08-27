/* docs/assets/js/impostazioni.js */
(function(){
  function byId(id){ return document.getElementById(id); }
  function getParam(name){ var m=new RegExp("[?&]"+name+"=([^&]*)").exec(location.search); return m?decodeURIComponent(m[1]):null; }
  function encodeCfg(o){ var json=JSON.stringify(o),b=new TextEncoder().encode(json),s=""; for(var i=0;i<b.length;i++) s+=String.fromCharCode(b[i]); return btoa(s); }
  function decodeCfg(str){ try{ var bin=atob(str),u=new Uint8Array(bin.length); for(var i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i); return JSON.parse(new TextDecoder().decode(u)); }catch(e){ return null; } }

  var cfg = { norme:null };

  Promise.resolve()
    .then(function(){ return fetch("./assets/data/norme.json",{cache:"no-store"}).then(function(r){return r.json();}); })
    .then(function(norme){
      // se arrivo da index con override
      var cur = getParam("cfg"); var curObj = cur?decodeCfg(cur):null;
      if (curObj && curObj.norme) norme = Object.assign({}, norme, curObj.norme);
      cfg.norme = JSON.parse(JSON.stringify(norme));

      // unitari
      var u = cfg.norme.unitari_mq, box = byId("unitari");
      Object.keys(u).forEach(function(k){
        var nice = ({
          bovineAdulte:"Bovine adulte", manzeBovine:"Manze bovine", toriRimonta:"Tori da rimonta",
          bufaleAdulte:"Bufale adulte", bufaleParto:"Bufale al parto", manzeBufaline:"Manze bufaline"
        })[k] || k;
        var id = "u-"+k;
        var html = '<label>'+nice+' (m²/capo)<input id="'+id+'" type="number" step="0.01" value="'+Number(u[k]).toFixed(2)+'"></label>';
        box.insertAdjacentHTML("beforeend", html);
        setTimeout(function(){ byId(id).addEventListener("input", function(e){ cfg.norme.unitari_mq[k]=Number(e.target.value||0); }); },0);
      });

      // ingrasso
      var ig = cfg.norme.ingrasso.mq_per_capo, boxI = byId("ingrasso");
      ig.forEach(function(r, i){
        var h = '<label>maxPesoKg <input id="ig-p-'+i+'" type="number" step="1" value="'+r.maxPesoKg+'"></label>'+
                '<label>mq/capo <input id="ig-m-'+i+'" type="number" step="0.01" value="'+Number(r.mq).toFixed(2)+'"></label>'+
                '<label>label <input id="ig-l-'+i+'" value="'+(r.label||"")+'"></label>';
        var wrap = document.createElement("div"); wrap.className="row4"; wrap.innerHTML=h;
        boxI.appendChild(wrap);
        setTimeout(function(){
          byId("ig-p-"+i).addEventListener("input", function(e){ ig[i].maxPesoKg = Number(e.target.value||0); });
          byId("ig-m-"+i).addEventListener("input", function(e){ ig[i].mq = Number(e.target.value||0); });
          byId("ig-l-"+i).addEventListener("input", function(e){ ig[i].label = e.target.value; });
        },0);
      });

      // pulsanti
      byId("applyBtn").addEventListener("click", function(){
        var url = "index.html?cfg="+encodeURIComponent(encodeCfg(cfg));
        window.location.href = url;
      });
      byId("downloadBtn").addEventListener("click", function(){
        var blob = new Blob([JSON.stringify(cfg.norme,null,2)], {type:"application/json"});
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "norme.json";
        a.click();
        URL.revokeObjectURL(a.href);
      });
      byId("backBtn").addEventListener("click", function(){
        window.location.href = "index.html";
      });
    })
    .catch(function(e){ alert("Errore impostazioni: "+e.message); });
})();
