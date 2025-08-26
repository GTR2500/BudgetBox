// src/pages/Impostazioni.jsx
import React, { useEffect, useState } from "react"

/**
 * IMPOSTAZIONI — Servizi tecnici
 * - Edita le 5 voci (o più) dei servizi tecnici.
 * - Tutti gli importi sono IVA ESCLUSA (l’IVA si applica solo nel riepilogo finale).
 * - Puoi:
 *    • Scaricare un JSON da mettere nel repo (persistenza "per sempre");
 *    • Caricare un JSON salvato in precedenza;
 *    • Applicare alla sessione corrente (scrive su localStorage.servizi_tecnici_v1),
 *      così la pagina Struttura li userà subito.
 */

const DEFAULT_SERVIZI = [
  { id: "relazione_calcolo", label: "Relazione di calcolo strutturale firmata (con esecutivi)", stato: "importo", unita: "nr", qta: 1, prezzo: 1950 },
  { id: "dl_carpenteria",    label: "Direzione lavori per la carpenteria metallica",             stato: "inclusa", unita: "serv", qta: 1, prezzo: 0    },
  { id: "calcolo_plinti",    label: "Calcolo plinti di fondazioni e disegni esecutivi",          stato: "importo", unita: "nr", qta: 1, prezzo: 1500  },
  { id: "dl_ca",             label: "Direzione lavori opere in c.a.",                            stato: "inclusa", unita: "serv", qta: 1, prezzo: 0    },
  { id: "prove_materiali",   label: "Prove dei materiali",                                       stato: "esclusa", unita: "serv", qta: 1, prezzo: 0    }
]

export default function Impostazioni() {
  // prova a caricare eventuali impostazioni già applicate alla sessione
  const [righe, setRighe] = useState(() => {
    try {
      const cache = JSON.parse(localStorage.getItem("servizi_tecnici_v1") || "null")
      return Array.isArray(cache) && cache.length ? cache : DEFAULT_SERVIZI
    } catch { return DEFAULT_SERVIZI }
  })

  // contatore per ID nuove righe
  const [counter, setCounter] = useState(1)

  function addRiga() {
    const id = `custom_${counter}`
    setCounter(c => c + 1)
    setRighe(v => [...v, { id, label: "Nuovo servizio", stato: "importo", unita: "nr", qta: 1, prezzo: 0 }])
  }
  function delRiga(idx) {
    setRighe(v => v.filter((_, i) => i !== idx))
  }
  function upd(idx, patch) {
    setRighe(v => v.map((r, i) => i === idx ? { ...r, ...patch } : r))
  }

  // totale “a importo” (IVA esclusa) per feedback
  const totale = righe.reduce((s, r) => s + (r.stato === "importo" ? toNum(r.qta) * toNum(r.prezzo) : 0), 0)

  // scarica JSON per persistenza “vera”
  function downloadJson() {
    const blob = new Blob([JSON.stringify(righe, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "servizi_tecnici.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  // carica JSON
  async function uploadJson(e) {
    const f = e.target.files?.[0]
    if (!f) return
    try {
      const txt = await f.text()
      const arr = JSON.parse(txt)
      if (!Array.isArray(arr)) throw new Error("JSON non valido: atteso un array di voci")
      setRighe(arr)
      alert("Impostazioni caricate ✔️")
    } catch (err) {
      alert("File non valido: " + (err?.message || "errore di parsing"))
    } finally {
      e.target.value = ""
    }
  }

  // applica alla sessione (Struttura li leggerà da localStorage)
  function applyToSession() {
    localStorage.setItem("servizi_tecnici_v1", JSON.stringify(righe))
    alert("Impostazioni applicate alla sessione ✔️")
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-orange-600">Impostazioni</h1>
      <p className="text-sm opacity-80">
        Gestisci le voci <b>Servizi tecnici</b>. Gli importi sono <b>IVA esclusa</b>. Per conservarle “per sempre” scarica il JSON e inseriscilo nel repository.
      </p>

      {/* EDITOR SERVIZI */}
      <section className="rounded-2xl border border-orange-300 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-lg font-semibold">Servizi tecnici</div>
          <div className="flex items-center gap-2">
            <button className="rounded-lg border px-3 py-1 text-sm" onClick={addRiga}>+ Aggiungi voce</button>
            <button className="rounded-lg border px-3 py-1 text-sm" onClick={()=>setRighe(DEFAULT_SERVIZI)}>Ripristina default</button>
          </div>
        </div>

        <div className="overflow-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b text-left text-xs opacity-70">
                <th className="p-2">ID</th>
                <th className="p-2">Descrizione</th>
                <th className="p-2">Stato</th>
                <th className="p-2">UM</th>
                <th className="p-2">Q.tà</th>
                <th className="p-2">Prezzo (IVA escl.)</th>
                <th className="p-2 text-right">Importo</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {righe.map((r, i) => (
                <tr key={r.id || i} className="border-b align-top">
                  <td className="p-2">
                    <input
                      className="w-36 rounded border p-1 font-mono"
                      value={r.id || ""}
                      onChange={e => upd(i, { id: e.target.value })}
                    />
                  </td>
                  <td className="p-2">
                    <textarea
                      className="min-h-[40px] w-full rounded border p-1"
                      value={r.label || ""}
                      onChange={e => upd(i, { label: e.target.value })}
                    />
                  </td>
                  <td className="p-2">
                    <select
                      className="rounded border p-1"
                      value={r.stato || "importo"}
                      onChange={e => upd(i, { stato: e.target.value })}
                    >
                      <option value="importo">importo</option>
                      <option value="inclusa">inclusa</option>
                      <option value="esclusa">esclusa</option>
                    </select>
                  </td>
                  <td className="p-2">
                    <input
                      className="w-20 rounded border p-1"
                      value={r.unita || ""}
                      onChange={e => upd(i, { unita: e.target.value })}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      className="w-24 rounded border p-1"
                      value={r.qta}
                      onChange={e => upd(i, { qta: toNum(e.target.value) })}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      step="0.01"
                      className="w-28 rounded border p-1"
                      value={r.prezzo}
                      onChange={e => upd(i, { prezzo: toNum(e.target.value) })}
                    />
                  </td>
                  <td className="p-2 text-right font-medium">
                    {r.stato === "importo" ? `€ ${fmt(toNum(r.qta) * toNum(r.prezzo), 2)}` : <span className="opacity-60">—</span>}
                  </td>
                  <td className="p-2">
                    <button className="text-rose-600 underline" onClick={() => delRiga(i)}>Elimina</button>
                  </td>
                </tr>
              ))}
              {righe.length === 0 && (
                <tr><td className="p-3 text-center opacity-60" colSpan={8}>Nessuna voce</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3 text-sm">
          <div className="rounded-lg border p-2">
            <div className="opacity-60 text-xs">Subtotale “a importo”</div>
            <div className="text-xl font-bold">€ {fmt(totale, 2)}</div>
            <div className="opacity-60 text-xs">IVA esclusa</div>
          </div>
          <div className="rounded-lg border p-2">
            <div className="opacity-60 text-xs">Azioni</div>
            <div className="mt-1 flex flex-wrap gap-2">
              <button className="rounded-lg border px-3 py-1 text-sm" onClick={downloadJson}>Scarica JSON</button>
              <label className="rounded-lg border px-3 py-1 text-sm cursor-pointer">
                Carica JSON
                <input type="file" accept=".json" onChange={uploadJson} className="hidden" />
              </label>
              <button className="rounded-lg border px-3 py-1 text-sm" onClick={applyToSession}>Applica alla sessione</button>
            </div>
            <div className="mt-2 text-xs opacity-60">
              “Applica alla sessione” rende attive le voci subito nella pagina <b>Struttura</b>.
              Per conservarle nel tempo, usa “Scarica JSON” e aggiungilo al repository.
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function toNum(v){ return isFinite(+v) ? +v : 0 }
function fmt(n, dec=0){
  const v = isFinite(+n) ? +n : 0
  return v.toLocaleString("it-IT", { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
