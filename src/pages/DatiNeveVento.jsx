// src/pages/DatiNeveVento.jsx
import React, { useEffect, useMemo, useState } from "react"

/**
 * PAGINA DATI — NEVE & VENTO (NTC 2018)
 * - Nessuna dipendenza esterna: formule, mapping e parametri sono qui dentro.
 * - Modificabile dall'utente e persistente via localStorage.
 * - Esporta i dati come JSON (per backup/versioning nel repo).
 *
 * Integrazione futura:
 *   import { neveFormule, neveProvinceZona, ventoParametri } from './DatiNeveVento.jsx'
 *   (Gli export sono in fondo al file.)
 */

// --- Costanti (formule NTC per neve) ----------------------------------------

const DEFAULT_NEVE_FORMULE = {
  /*
    Sk per quota ≤200 m: "base"
    Sk per quota >200 m: k * (1 + (alt/den)^2)
  */
  "I-A": { base: 1.50, k: 1.39, den: 728, note: "Zona Alpina" },
  "I-M": { base: 1.50, k: 1.35, den: 602, note: "Zona Mediterranea" },
  "II":  { base: 1.00, k: 0.85, den: 481, note: "Zona II" },
  "III": { base: 0.60, k: 0.51, den: 481, note: "Zona III" }
}

/* Mapping Province → Zona neve (bozza completa modificabile)
   - Chiavi: sigle provinciali (attuali o storiche) in MAIUSCOLO.
   - Valori: "I-A" | "I-M" | "II" | "III".
   - Puoi integrare/correggere liberamente: la pagina salva su localStorage.
*/
const DEFAULT_NEVE_PROVINCE_ZONA = {
  // NORD-OVEST / ALPI
  "AO": "I-A","BI": "I-A","NO": "I-A","VB": "I-A","TO": "I-A","CN": "I-A","VC": "I-A",
  "BG": "I-A","BS": "I-A","CO": "I-A","LC": "I-A","SO": "I-A","TN": "I-A","BZ": "I-A",
  "PN": "I-A","UD": "I-A","BL": "I-A","TV": "I-A","VI": "I-A","VR": "I-A",

  // PIANURA PADANA / PEDEMONTE (mediterranea NTC)
  "AL": "I-M","AT": "I-M","MI": "I-M","MB": "I-M","CR": "I-M","LO": "I-M","PV": "I-M",
  "PR": "I-M","PC": "I-M","RE": "I-M","MO": "I-M","BO": "I-M","FE": "I-M","RA": "I-M",
  "RN": "I-M","AN": "I-M","PU": "I-M","PD": "I-M","RO": "I-M","VE": "I-M","GO": "I-M",
  "GE": "I-M","SV": "I-M","SP": "I-M","IM": "I-M","VA": "I-M","VE": "I-M",

  // CENTRO-NORD / APPENNINO (stima Zona II)
  "FI": "II","PO": "II","PT": "II","LU": "II","MS": "II","AR": "II","SI": "II",
  "PG": "II","TR": "II","RI": "II","VT": "II","FR": "II","AQ": "II","TE": "II",
  "PE": "II","CH": "II","MC": "II","AP": "II","FM": "II","TS": "II","SV": "I-M",

  // CENTRO-SUD / COSTE TIRRENICHE E ADRIATICHE (stima Zona III)
  "RM": "III","LT": "III","NA": "III","CE": "III","BN": "III","SA": "III","AV": "III",
  "CB": "III","IS": "III","BA": "III","BT": "III","FG": "III","BR": "III","LE": "III",
  "TA": "III","CS": "III","CZ": "III","KR": "III","RC": "III","VV": "III",
  "ME": "III","PA": "III","TP": "III","AG": "III","CL": "III","EN": "III","CT": "III",
  "SR": "III","RG": "III","SS": "III","NU": "III","OR": "III","CA": "III","OT": "III",
  "OG": "III","VS": "III","SU": "III","OLB": "III","MD": "III"
}

/* VENTO — semplificazione per partire
   - zone: 1..9 (NTC mappe). Per ora mappiamo per Regione; gestiremo eccezioni dopo.
   - "vb0" m/s e parametri "a0" e "ks" servono per ricavare il profilo con l'altitudine.
   - Questi valori sono EDITABILI, non “verità assoluta”.
*/
const DEFAULT_VENTO_ZONE_REGIONI = {
  "VALLE D'AOSTA": 4, "PIEMONTE": 4, "LOMBARDIA": 4, "LIGURIA": 6, "TRENTINO-ALTO ADIGE": 4,
  "VENETO": 4, "FRIULI-VENEZIA GIULIA": 5,
  "EMILIA-ROMAGNA": 4, "TOSCANA": 5, "UMBRIA": 4, "MARCHE": 4, "LAZIO": 5,
  "ABRUZZO": 5, "MOLISE": 5, "CAMPANIA": 5, "PUGLIA": 6, "BASILICATA": 5, "CALABRIA": 6,
  "SICILIA": 6, "SARDEGNA": 7
}

const DEFAULT_VENTO_PARAMETRI = {
  /* valori indicativi; personalizzali da UI:
     vb = vb0 * c_a (con c_a funzione di altitudine e parametri a0, ks)
  */
  4: { vb0: 26, a0: 200, ks: 0.0007 },
  5: { vb0: 28, a0: 200, ks: 0.0007 },
  6: { vb0: 30, a0: 200, ks: 0.0007 },
  7: { vb0: 32, a0: 200, ks: 0.0007 }
}

// --- Storage helper ----------------------------------------------------------

const KEY = "dati_neve_vento_v1"
const readStore = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}") } catch { return {} }
}
const writeStore = (obj) => localStorage.setItem(KEY, JSON.stringify(obj))

function useStoredData() {
  const [neveFormule, setNeveFormule] = useState(DEFAULT_NEVE_FORMULE)
  const [neveProvinceZona, setNeveProvinceZona] = useState(DEFAULT_NEVE_PROVINCE_ZONA)
  const [ventoZoneRegioni, setVentoZoneRegioni] = useState(DEFAULT_VENTO_ZONE_REGIONI)
  const [ventoParametri, setVentoParametri] = useState(DEFAULT_VENTO_PARAMETRI)

  useEffect(() => {
    const s = readStore()
    if (s.neveFormule) setNeveFormule(s.neveFormule)
    if (s.neveProvinceZona) setNeveProvinceZona(s.neveProvinceZona)
    if (s.ventoZoneRegioni) setVentoZoneRegioni(s.ventoZoneRegioni)
    if (s.ventoParametri) setVentoParametri(s.ventoParametri)
  }, [])

  useEffect(() => {
    writeStore({ neveFormule, neveProvinceZona, ventoZoneRegioni, ventoParametri })
  }, [neveFormule, neveProvinceZona, ventoZoneRegioni, ventoParametri])

  return { neveFormule, setNeveFormule, neveProvinceZona, setNeveProvinceZona, ventoZoneRegioni, setVentoZoneRegioni, ventoParametri, setVentoParametri }
}

// --- UI components -----------------------------------------------------------

function Card({ title, children }) {
  return (
    <div className="rounded-2xl border border-orange-300 bg-white p-4 shadow-sm">
      <div className="mb-2 text-lg font-semibold">{title}</div>
      {children}
    </div>
  )
}

function TextAreaJson({ value, onChange, rows = 10 }) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2))
  useEffect(() => { setText(JSON.stringify(value, null, 2)) }, [value])
  function apply() {
    try { onChange(JSON.parse(text)) } catch { alert("JSON non valido") }
  }
  function copy() {
    navigator.clipboard.writeText(text)
    alert("Copiato negli appunti")
  }
  function download() {
    const blob = new Blob([text], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = "dati.json"; a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div>
      <textarea className="w-full resize-y rounded-xl border p-2 font-mono text-sm" rows={rows} value={text} onChange={e => setText(e.target.value)} />
      <div className="mt-2 flex gap-2">
        <button className="rounded-lg border px-3 py-1 text-sm" onClick={apply}>Applica</button>
        <button className="rounded-lg border px-3 py-1 text-sm" onClick={copy}>Copia JSON</button>
        <button className="rounded-lg border px-3 py-1 text-sm" onClick={download}>Scarica JSON</button>
      </div>
    </div>
  )
}

// --- Page --------------------------------------------------------------------

export default function DatiNeveVento() {
  const {
    neveFormule, setNeveFormule,
    neveProvinceZona, setNeveProvinceZona,
    ventoZoneRegioni, setVentoZoneRegioni,
    ventoParametri, setVentoParametri
  } = useStoredData()

  const esempio = useMemo(() => {
    // Esempio: Zona I-A, altitudine 578 m
    const z = "I-A"; const alt = 578
    const f = neveFormule[z]
    const sk = alt <= 200 ? f.base : (f.k * (1 + (alt / f.den) ** 2))
    return { zona: z, alt, sk: round(sk, 3) }
  }, [neveFormule])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-orange-600">Dati Neve &amp; Vento (NTC 2018)</h1>
      <p className="text-sm opacity-80">
        Questa pagina contiene <b>formule</b> e <b>dataset interni</b> usati per calcolare i carichi di neve e i parametri vento
        a partire dalla <b>Località</b> in anagrafica. I dati sono modificabili e salvati in locale (localStorage).
        In stampa e in preventivo le voci sono sempre <b>IVA esclusa</b>; l'IVA viene aggiunta solo nel riepilogo finale.
      </p>

      <Card title="Neve — Formule di zona (Sk)">
        <p className="mb-2 text-sm">
          <code>Sk(≤200 m) = base</code> &nbsp; | &nbsp;
          <code>Sk(&gt;200 m) = k · (1 + (alt/den)^2)</code> &nbsp;
          (kN/m², altitudine in metri)
        </p>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs opacity-80">
                <th className="p-2">Zona</th>
                <th className="p-2">Base ≤200 m</th>
                <th className="p-2">k</th>
                <th className="p-2">den</th>
                <th className="p-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(neveFormule).map(([k, v]) => (
                <tr key={k} className="border-b">
                  <td className="p-2 font-medium">{k}</td>
                  <td className="p-2">{v.base}</td>
                  <td className="p-2">{v.k}</td>
                  <td className="p-2">{v.den}</td>
                  <td className="p-2">{v.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3">
          <TextAreaJson value={neveFormule} onChange={setNeveFormule} rows={8} />
        </div>
        <div className="mt-2 text-xs opacity-70">
          Esempio calcolo zona <b>{esempio.zona}</b> a {esempio.alt} m → <b>Sk = {esempio.sk} kN/m²</b>
        </div>
      </Card>

      <Card title="Neve — Mappa Province → Zona (modificabile)">
        <p className="mb-2 text-sm">
          Inserisci la zona neve per ogni provincia (sigla a 2–3 lettere). Esempi: <code>AO, TO, MI, RM, SS, SU…</code>
        </p>
        <TextAreaJson value={neveProvinceZona} onChange={setNeveProvinceZona} rows={12} />
      </Card>

      <Card title="Vento — Zone per Regione (modificabile)">
        <p className="mb-2 text-sm">
          Associa ad ogni regione una <b>zona vento</b> (1–9). Gestiremo le eccezioni locali in una fase successiva.
        </p>
        <TextAreaJson value={ventoZoneRegioni} onChange={setVentoZoneRegioni} rows={8} />
      </Card>

      <Card title="Vento — Parametri per zona (modificabile)">
        <p className="mb-2 text-sm">
          Parametri indicativi per ricavare la velocità di riferimento: <code>vb = vb0 · c_a(altitudine; a0, ks)</code>.
          Personalizzali se usi una diversa correlazione.
        </p>
        <TextAreaJson value={ventoParametri} onChange={setVentoParametri} rows={8} />
      </Card>

      <Card title="Esporta tutti i dati (backup)">
        <button
          className="rounded-lg border px-3 py-1 text-sm"
          onClick={() => {
            const payload = { neveFormule, neveProvinceZona, ventoZoneRegioni, ventoParametri, exportedAt: new Date().toISOString() }
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url; a.download = "dati-neve-vento.json"; a.click()
            URL.revokeObjectURL(url)
          }}
        >
          Scarica JSON
        </button>
      </Card>
    </div>
  )
}

// --- Helpers -----------------------------------------------------------------
function round(n, d=2){ return Math.round(n * 10**d) / 10**d }

// --- Export “dati” (per import programmatico in altre pagine) ---------------
export const neveFormule = DEFAULT_NEVE_FORMULE
export const neveProvinceZona = DEFAULT_NEVE_PROVINCE_ZONA
export const ventoZoneRegioni = DEFAULT_VENTO_ZONE_REGIONI
export const ventoParametri = DEFAULT_VENTO_PARAMETRI
