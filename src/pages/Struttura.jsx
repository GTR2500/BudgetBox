// src/pages/Struttura.jsx
import React, { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"

/**
 * STRUTTURA — calcolo superfici, neve/vento, Kg, €/kg e servizi tecnici
 * - Riceve l'anagrafica da Anagrafica.jsx via navigate(..., { state }).
 * - Nessun salvataggio automatico: passeremo i dati alla pagina Riepilogo.
 * - Dati NTC neve/vento sono *interni* con fallback da localStorage se
 *   sono stati personalizzati in DatiNeveVento.jsx (chiave: dati_neve_vento_v1).
 * - Tutte le cifre sono IVA *esclusa*; l'IVA verrà aggiunta nel riepilogo finale.
 */

// ——————————————————————————————————————————————————————————————
// Data: tipi struttura (ID stabili)
const STRUCT_TYPES = [
  { id: "tetto_piano", label: "Tetto piano (minima pendenza)" },
  { id: "mono",        label: "Tetto monofalda (shed)" },
  { id: "bifalda",     label: "Tetto bifalda / a capanna" },
  { id: "padiglione",  label: "Tetto a padiglione (4 falde)" },
  { id: "gambrel",     label: "Tetto a padiglione spezzato / gambrel" },
  { id: "mansarda",    label: "Tetto a mansarda (mansardato)" },
  { id: "sawtooth",    label: "Tetto a dente di sega (sawtooth)" },
  { id: "multished",   label: "Multished (serie di monofalde)" },
  { id: "farfalla",    label: "Tetto a farfalla (doppia falda rovesciata)" },
  { id: "botte",       label: "Tetto a botte / volta a botte" },
  { id: "arco",        label: "Tetto ad arco (grandi luci)" },
  { id: "capriate",    label: "Capriate + soffitto \"a cattedrale\"" }
]

// ——————————————————————————————————————————————————————————————
// Dati NTC neve/vento — default interni (uguali a DatiNeveVento.jsx).
const DEFAULT_NEVE_FORMULE = {
  "I-A": { base: 1.50, k: 1.39, den: 728, note: "Zona Alpina" },
  "I-M": { base: 1.50, k: 1.35, den: 602, note: "Zona Mediterranea" },
  "II":  { base: 1.00, k: 0.85, den: 481, note: "Zona II" },
  "III": { base: 0.60, k: 0.51, den: 481, note: "Zona III" }
}
// Mappa prov→zona neve (bozza sensata; può essere personalizzata in DatiNeveVento)
const DEFAULT_NEVE_PROVINCE_ZONA = {
  "AO": "I-A","BI": "I-A","NO": "I-A","VB": "I-A","TO": "I-A","CN": "I-A","VC": "I-A",
  "BG": "I-A","BS": "I-A","CO": "I-A","LC": "I-A","SO": "I-A","TN": "I-A","BZ": "I-A",
  "PN": "I-A","UD": "I-A","BL": "I-A","TV": "I-A","VI": "I-A","VR": "I-A",
  "AL": "I-M","AT": "I-M","MI": "I-M","MB": "I-M","CR": "I-M","LO": "I-M","PV": "I-M",
  "PR": "I-M","PC": "I-M","RE": "I-M","MO": "I-M","BO": "I-M","FE": "I-M","RA": "I-M",
  "RN": "I-M","AN": "I-M","PU": "I-M","PD": "I-M","RO": "I-M","VE": "I-M","GO": "I-M",
  "GE": "I-M","SV": "I-M","SP": "I-M","IM": "I-M","VA": "I-M",
  "FI": "II","PO": "II","PT": "II","LU": "II","MS": "II","AR": "II","SI": "II",
  "PG": "II","TR": "II","RI": "II","VT": "II","FR": "II","AQ": "II","TE": "II",
  "PE": "II","CH": "II","MC": "II","AP": "II","FM": "II","TS": "II",
  "RM": "III","LT": "III","NA": "III","CE": "III","BN": "III","SA": "III","AV": "III",
  "CB": "III","IS": "III","BA": "III","BT": "III","FG": "III","BR": "III","LE": "III",
  "TA": "III","CS": "III","CZ": "III","KR": "III","RC": "III","VV": "III",
  "ME": "III","PA": "III","TP": "III","AG": "III","CL": "III","EN": "III","CT": "III",
  "SR": "III","RG": "III","SS": "III","NU": "III","OR": "III","CA": "III","OT": "III",
  "OG": "III","VS": "III","SU": "III"
}
// Vento — semplificazione iniziale (editabile in DatiNeveVento)
const DEFAULT_VENTO_ZONE_REGIONI = {
  "VALLE D'AOSTA": 4, "PIEMONTE": 4, "LOMBARDIA": 4, "LIGURIA": 6, "TRENTINO-ALTO ADIGE": 4,
  "VENETO": 4, "FRIULI-VENEZIA GIULIA": 5, "EMILIA-ROMAGNA": 4, "TOSCANA": 5,
  "UMBRIA": 4, "MARCHE": 4, "LAZIO": 5, "ABRUZZO": 5, "MOLISE": 5, "CAMPANIA": 5,
  "PUGLIA": 6, "BASILICATA": 5, "CALABRIA": 6, "SICILIA": 6, "SARDEGNA": 7
}
const DEFAULT_VENTO_PARAMETRI = {
  4: { vb0: 26, a0: 200, ks: 0.0007 },
  5: { vb0: 28, a0: 200, ks: 0.0007 },
  6: { vb0: 30, a0: 200, ks: 0.0007 },
  7: { vb0: 32, a0: 200, ks: 0.0007 }
}

// servizi tecnici — default (modificabili in futuro in Impostazioni)
const DEFAULT_SERVIZI = [
  { id: "relazione_calcolo", label: "Relazione di calcolo strutturale firmata (con esecutivi)", stato: "importo", unita: "nr", qta: 1, prezzo: 1950 },
  { id: "dl_carpenteria",    label: "Direzione lavori per la carpenteria metallica",             stato: "inclusa", unita: "serv", qta: 1, prezzo: 0    },
  { id: "calcolo_plinti",    label: "Calcolo plinti di fondazioni e disegni esecutivi",          stato: "importo", unita: "nr", qta: 1, prezzo: 1500  },
  { id: "dl_ca",             label: "Direzione lavori opere in c.a.",                            stato: "inclusa", unita: "serv", qta: 1, prezzo: 0    },
  { id: "prove_materiali",   label: "Prove dei materiali",                                       stato: "esclusa", unita: "serv", qta: 1, prezzo: 0    }
]

// ——————————————————————————————————————————————————————————————
// Utilità matematiche
const clamp = (n, a, b) => Math.max(a, Math.min(b, n))
const toNum = (v) => (isFinite(+v) ? +v : 0)
const deg = (p) => Math.atan(toNum(p) / 100) * 180 / Math.PI
const cosFromPendenza = (p) => Math.cos(Math.atan(toNum(p) / 100))

// €/kg suggerito decrescente con la taglia (calibrato ~4.5€/kg a ~167 m²)
const euroKgSuggerito = (area_pianta) => clamp(2.9 + 20.7/Math.max(1, Math.sqrt(area_pianta||1)), 2.9, 7.5)

// μi suggerito per forma/pendenza (semplice; sempre editabile)
function muSuggerito(tipo, pendenzaPerc) {
  const a = deg(pendenzaPerc) // angolo in gradi
  // valori indicativi, prudenziali
  if (tipo === "tetto_piano") return 1.0
  if (tipo === "mono" || tipo === "bifalda" || tipo === "multished" || tipo === "sawtooth" || tipo === "farfalla") {
    if (a <= 30) return 1.0
    if (a <= 60) return 0.8
    return 0.0 // oltre 60° spesso non si considera accumulo (semplificazione)
  }
  // forme complesse: mantengo 1.0 prudenziale
  return 1.0
}

// fattore base Kg/m² per tipologia (indicativo) — sarà sempre editabile
const KG_BASE_TIPO = {
  tetto_piano: 28, mono: 30, bifalda: 32, padiglione: 36, gambrel: 34,
  mansarda: 34, sawtooth: 35, multished: 33, farfalla: 34, botte: 40, arco: 42, capriate: 36
}

// ——————————————————————————————————————————————————————————————
// Pagina
export default function Struttura() {
  const nav = useNavigate()
  const { state } = useLocation()
  const anagrafica = state?.anagrafica || {
    cliente: "", riferimento: "", data: new Date().toISOString().slice(0,10),
    localita: { comune: "", sigla_prov: "", istat: "", zona_sismica: "", altitudine_m: 0 }
  }

  // carica eventuali personalizzazioni da DatiNeveVento.jsx (localStorage), altrimenti default
  const [ds, setDs] = useState(() => {
    let local = {}
    try { local = JSON.parse(localStorage.getItem("dati_neve_vento_v1") || "{}") } catch {}
    return {
      neveFormule: local.neveFormule || DEFAULT_NEVE_FORMULE,
      neveProvinceZona: local.neveProvinceZona || DEFAULT_NEVE_PROVINCE_ZONA,
      ventoZoneRegioni: local.ventoZoneRegioni || DEFAULT_VENTO_ZONE_REGIONI,
      ventoParametri: local.ventoParametri || DEFAULT_VENTO_PARAMETRI
    }
  })

  // ——— Corpi struttura (possono essere più — es. 2 corpi)
  const [corpi, setCorpi] = useState([
    { id: "A", tipo: "bifalda", L: 20, W: 10, pendenza: 8, overrideFalda: "", note: "" }
  ])

  const addCorpo = () => setCorpi(v => [...v, { id: String.fromCharCode(65+v.length), tipo: "bifalda", L: 10, W: 5, pendenza: 8, overrideFalda: "", note: "" }])
  const updCorpo = (idx, patch) => setCorpi(v => v.map((c,i)=> i===idx ? { ...c, ...patch } : c))
  const delCorpo = (idx) => setCorpi(v => v.filter((_,i)=> i!==idx))

  // ——— Neve/vento (auto da Località, ma editabile)
  const zonaNeve = useMemo(() => ds.neveProvinceZona[anagrafica.localita.sigla_prov?.toUpperCase()] || "II", [ds.neveProvinceZona, anagrafica.localita.sigla_prov])
  const alt = toNum(anagrafica.localita.altitudine_m)
  const neveForm = ds.neveFormule[zonaNeve] || { base: 1, k: 1, den: 1 }
  const qsk = alt <= 200 ? neveForm.base : (neveForm.k * (1 + (alt / neveForm.den) ** 2)) // kN/m²
  // parametri editabili (μi, CE, Ct, carico vento)
  const [pendenzaRef, setPendenzaRef] = useState(8) // % di riferimento per μ (puoi usare media o pendenza del corpo principale)
  const [mu, setMu] = useState(muSuggerito(corpi[0]?.tipo || "bifalda", pendenzaRef))
  const [CE, setCE] = useState(1.0)
  const [Ct, setCt] = useState(1.0)
  const qs = useMemo(() => qsk * mu * CE * Ct, [qsk, mu, CE, Ct]) // kN/m²

  const [caricoVento, setCaricoVento] = useState(50) // kg/m² suggerito
  // ——— Kg/m² e €/kg
  const areaPiantaTot = useMemo(() => corpi.reduce((s,c)=> s + toNum(c.L)*toNum(c.W), 0), [corpi])
  const euroKgSugg = useMemo(() => euroKgSuggerito(areaPiantaTot), [areaPiantaTot])

  // Kg/m² suggeriti: base per tipo + addon da qs/vento (semplice funzione)
  const kgBaseTipo = useMemo(() => KG_BASE_TIPO[corpi[0]?.tipo || "bifalda"] || 32, [corpi])
  const kgSugg = useMemo(() => {
    const addNeve = Math.max(0, (qs - 0.6)) * 5   // +5 kg/m² per kN/m² oltre 0.6 (indicativo)
    const addVento = Math.max(0, (caricoVento - 50)) * 0.05 // +0.05 kg/m² per ogni kg/m² oltre 50 (indicativo)
    return Math.max(20, Math.round((kgBaseTipo + addNeve + addVento) * 10)/10)
  }, [kgBaseTipo, qs, caricoVento])

  const [kgm2, setKgm2] = useState(kgSugg)
  useEffect(()=>{ setKgm2(kgSugg) }, [kgSugg]) // aggiorna suggerimento quando cambiano i fattori

  const [euroKg, setEuroKg] = useState(euroKgSugg)
  useEffect(()=>{ setEuroKg(euroKgSugg) }, [euroKgSugg])

  // ——— superfici in falda per corpo
  function areaFaldaCorpo(c) {
    // default: A_falda = A_pianta / cos(theta) per mono/bifalda; per altri applico stessa logica
    if (String(c.overrideFalda).trim() !== "") return toNum(c.overrideFalda)
    const A_pianta = toNum(c.L) * toNum(c.W)
    const cos = clamp(cosFromPendenza(c.pendenza || 0), 0.01, 1)
    if (c.tipo === "bifalda") return A_pianta / cos
    if (c.tipo === "mono" || c.tipo === "multished" || c.tipo === "sawtooth" || c.tipo === "farfalla") return A_pianta / cos
    // altre forme: uso lo stesso approccio come stima iniziale
    return A_pianta / cos
  }

  const areaFaldaTot = useMemo(()=> corpi.reduce((s,c)=> s + areaFaldaCorpo(c), 0), [corpi])

  // ——— Tot Kg e Totali
  const totKg = useMemo(() => Math.round(areaPiantaTot * toNum(kgm2)), [areaPiantaTot, kgm2])
  const importoStruttura = useMemo(() => Math.round(totKg * toNum(euroKg) * 100)/100, [totKg, euroKg])

  // ——— Servizi tecnici (solo le voci a importo entrano nei totali)
  const [servizi, setServizi] = useState(() => {
    // in futuro leggeremo da localStorage "servizi_tecnici_v1" impostato da Impostazioni
    let local = null
    try { local = JSON.parse(localStorage.getItem("servizi_tecnici_v1") || "null") } catch {}
    return Array.isArray(local) ? local : DEFAULT_SERVIZI
  })
  const subtServizi = useMemo(()=> servizi.reduce((s,x)=> s + (x.stato==="importo" ? toNum(x.qta)*toNum(x.prezzo) : 0), 0), [servizi])
  const subTotale = useMemo(()=> importoStruttura + subtServizi, [importoStruttura, subtServizi])

  // ——— Vai al riepilogo (passo tutto)
  function avantiRiepilogo() {
    const payload = {
      anagrafica,
      struttura: {
        corpi,
        pendenzaRef,
        neve: { zonaNeve, qsk, mu, CE, Ct, qs },       // kN/m²
        vento: { caricoVento },                         // kg/m² (sempl.)
        kgm2, totKg, euroKg,
        superfici: { areaPiantaTot, areaFaldaTot },
        importi: { struttura: importoStruttura, servizi: subtServizi, subTotale }
      },
      serviziTecnici: servizi
    }
    nav("/riepilogo", { state: payload })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-orange-600">Struttura — geometrie, carichi e costo</h1>
      <p className="text-sm opacity-80">
        Le voci sono sempre <b>IVA esclusa</b>. Al termine, l’IVA verrà calcolata nel riepilogo economico.
      </p>

      {/* ANAGRAFICA SNAPSHOT */}
      <section className="rounded-2xl border border-orange-300 bg-white p-4 shadow-sm">
        <div className="mb-2 text-lg font-semibold">Anagrafica (riepilogo)</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4 text-sm">
          <div><div className="opacity-60 text-xs">Cliente</div><div className="font-medium">{anagrafica.cliente || "—"}</div></div>
          <div><div className="opacity-60 text-xs">Località</div><div className="font-medium">{anagrafica.localita.comune || "—"} ({anagrafica.localita.sigla_prov || "—"})</div></div>
          <div><div className="opacity-60 text-xs">ISTAT</div><div className="font-mono">{anagrafica.localita.istat || "—"}</div></div>
          <div><div className="opacity-60 text-xs">Zona sismica</div><div className="font-mono">{anagrafica.localita.zona_sismica || "—"}</div></div>
        </div>
      </section>

      {/* CORPI STRUTTURA */}
      <section className="rounded-2xl border border-orange-300 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-lg font-semibold">Corpi struttura</div>
          <button className="rounded-lg border px-3 py-1 text-sm" onClick={addCorpo}>+ Aggiungi corpo</button>
        </div>

        <div className="space-y-3">
          {corpi.map((c, i) => {
            const A_pianta = toNum(c.L) * toNum(c.W)
            const A_falda = areaFaldaCorpo(c)
            return (
              <div key={c.id} className="rounded-xl border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="font-medium">Corpo {c.id}</div>
                  {corpi.length>1 && <button className="text-rose-600 text-sm underline" onClick={()=>delCorpo(i)}>Elimina</button>}
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs opacity-70">Tipo struttura</span>
                    <select className="rounded-lg border p-2" value={c.tipo} onChange={e=>updCorpo(i,{ tipo: e.target.value })}>
                      {STRUCT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs opacity-70">Lunghezza L (m)</span>
                    <input type="number" className="rounded-lg border p-2" value={c.L} onChange={e=>updCorpo(i,{ L: e.target.value })} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs opacity-70">Larghezza W (m)</span>
                    <input type="number" className="rounded-lg border p-2" value={c.W} onChange={e=>updCorpo(i,{ W: e.target.value })} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs opacity-70">Pendenza (%)</span>
                    <input type="number" className="rounded-lg border p-2" value={c.pendenza} onChange={e=>updCorpo(i,{ pendenza: e.target.value })} />
                  </label>
                  <label className="flex flex-col gap-1 md:col-span-2">
                    <span className="text-xs opacity-70">Override area in falda (m²) — opzionale</span>
                    <input type="number" className="rounded-lg border p-2" placeholder="lascia vuoto per auto" value={c.overrideFalda} onChange={e=>updCorpo(i,{ overrideFalda: e.target.value })} />
                  </label>
                </div>

                <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3 text-sm">
                  <div className="rounded-lg border p-2">A in pianta: <b>{fmt(A_pianta,1)} m²</b></div>
                  <div className="rounded-lg border p-2">A in falda: <b>{fmt(A_falda,1)} m²</b></div>
                  <div className="rounded-lg border p-2">Angolo ≈ <b>{fmt(deg(c.pendenza),1)}°</b></div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3 text-sm">
          <div className="rounded-lg border p-2">Totale copertura in <b>pianta</b>: <b>{fmt(areaPiantaTot,2)} m²</b></div>
          <div className="rounded-lg border p-2">Totale copertura in <b>falda</b>: <b>{fmt(areaFaldaTot,2)} m²</b></div>
          <div className="rounded-lg border p-2">€/kg suggerito: <b>€ {fmt(euroKgSugg,2)}</b> (editabile sotto)</div>
        </div>
      </section>

      {/* CARICHI NEVE/VENTO */}
      <section className="rounded-2xl border border-orange-300 bg-white p-4 shadow-sm">
        <div className="mb-2 text-lg font-semibold">Carichi neve / vento (NTC 2018)</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div className="rounded-lg border p-2 text-sm">
            <div className="opacity-60 text-xs">Zona neve</div>
            <div className="font-mono">{zonaNeve}</div>
            <div className="opacity-60 text-xs mt-1">Altitudine</div>
            <div>{fmt(alt,0)} m</div>
          </div>
          <div className="rounded-lg border p-2 text-sm">
            <div className="opacity-60 text-xs">qsk (carico neve al suolo)</div>
            <div><b>{fmt(qsk,3)}</b> kN/m²</div>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs opacity-70">Pendenza riferimento (%)</span>
            <input type="number" className="rounded-lg border p-2" value={pendenzaRef} onChange={e=>setPendenzaRef(toNum(e.target.value))} />
            <div className="text-xs opacity-60">Usata per μ suggerito</div>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs opacity-70">μ (coeff. forma) — suggerito {fmt(muSuggerito(corpi[0]?.tipo||"bifalda", pendenzaRef),2)}</span>
            <input type="number" step="0.05" className="rounded-lg border p-2" value={mu} onChange={e=>setMu(toNum(e.target.value))} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs opacity-70">CE</span>
              <select className="rounded-lg border p-2" value={CE} onChange={e=>setCE(toNum(e.target.value))}>
                <option value="0.9">0.9 (battuta dai venti)</option>
                <option value="1">1.0 (normale)</option>
                <option value="1.1">1.1 (riparata)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs opacity-70">Ct</span>
              <select className="rounded-lg border p-2" value={Ct} onChange={e=>setCt(toNum(e.target.value))}>
                <option value="1">1.0 (default prudenziale)</option>
                <option value="0.9">0.9</option>
                <option value="0.8">0.8</option>
              </select>
            </label>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4 text-sm">
          <div className="rounded-lg border p-2">qs (copertura) = <b>{fmt(qs,3)} kN/m²</b></div>
          <label className="flex flex-col gap-1">
            <span className="text-xs opacity-70">Carico vento (kg/m²)</span>
            <input type="number" className="rounded-lg border p-2" value={caricoVento} onChange={e=>setCaricoVento(toNum(e.target.value))} />
          </label>
          <div className="rounded-lg border p-2">Zona sismica: <b>{anagrafica.localita.zona_sismica || "—"}</b></div>
          <div className="rounded-lg border p-2">Comune: <b>{anagrafica.localita.comune || "—"}</b></div>
        </div>
      </section>

      {/* KG/m², KG TOTALI, €/KG */}
      <section className="rounded-2xl border border-orange-300 bg-white p-4 shadow-sm">
        <div className="mb-2 text-lg font-semibold">Massa struttura e prezzo (IVA esclusa)</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-lg border p-2 text-sm">
            <div className="opacity-60 text-xs">Kg/m² — suggerito</div>
            <div className="text-xl font-bold">{fmt(kgSugg,1)}</div>
            <div className="opacity-60 text-xs">In base a tipo ({kgBaseTipo} kg/m²), neve/vento</div>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs opacity-70">Kg/m² (editabile)</span>
            <input type="number" className="rounded-lg border p-2" value={kgm2} onChange={e=>setKgm2(toNum(e.target.value))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs opacity-70">€/kg (editabile)</span>
            <input type="number" step="0.01" className="rounded-lg border p-2" value={euroKg} onChange={e=>setEuroKg(toNum(e.target.value))} />
            <div className="text-xs opacity-60">Suggerito {fmt(euroKgSugg,2)} €/kg (decrescente con taglia)</div>
          </label>
          <div className="rounded-lg border p-2 text-sm">
            <div className="opacity-60 text-xs">Kg totali</div>
            <div className="text-xl font-bold">{fmt(totKg,0)} kg</div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 text-sm">
          <div className="rounded-lg border p-2">Importo struttura (IVA esclusa): <b>€ {fmt(importoStruttura,2)}</b></div>
          <div className="rounded-lg border p-2">Subtotale servizi (IVA esclusa): <b>€ {fmt(subtServizi,2)}</b></div>
        </div>
        <div className="mt-2 rounded-lg border p-2 text-base">
          <div>Subtotale <b>Struttura + Servizi</b> (IVA esclusa): <span className="text-xl font-bold">€ {fmt(subTotale,2)}</span></div>
          <div className="text-xs opacity-60">L’IVA verrà calcolata nel riepilogo economico finale.</div>
        </div>
      </section>

      {/* SERVIZI TECNICI — elenco informativo */}
      <section className="rounded-2xl border border-orange-300 bg-white p-4 shadow-sm">
        <div className="mb-2 text-lg font-semibold">Servizi tecnici</div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs opacity-70">
                <th className="p-2">Voce</th>
                <th className="p-2">Stato</th>
                <th className="p-2">UM</th>
                <th className="p-2">Q.tà</th>
                <th className="p-2">Prezzo</th>
                <th className="p-2 text-right">Importo</th>
              </tr>
            </thead>
            <tbody>
              {servizi.map(s => (
                <tr key={s.id} className="border-b">
                  <td className="p-2">{s.label}</td>
                  <td className="p-2 capitalize">{s.stato}</td>
                  <td className="p-2">{s.unita}</td>
                  <td className="p-2">{s.qta}</td>
                  <td className="p-2">€ {fmt(s.prezzo,2)}</td>
                  <td className="p-2 text-right font-medium">
                    {s.stato==="importo" ? <>€ {fmt(toNum(s.qta)*toNum(s.prezzo),2)}</> : <span className="opacity-60">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-xs opacity-70">
          Le impostazioni (importi/stato) saranno modificabili nella pagina <b>Impostazioni</b>.
        </div>
      </section>

      {/* AZIONI */}
      <section className="rounded-2xl border border-orange-300 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button className="rounded-lg border px-3 py-2 text-sm" onClick={()=>nav(-1)}>← Torna all’anagrafica</button>
          <button className="rounded-lg border px-3 py-2 text-sm bg-black text-white" onClick={avantiRiepilogo}>
            Continua → Riepilogo
          </button>
        </div>
      </section>
    </div>
  )
}

// ——————————————————————————————————————————————————————————————
// Helpers
function fmt(n, dec=0){
  const v = isFinite(+n) ? +n : 0
  return v.toLocaleString("it-IT", { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
