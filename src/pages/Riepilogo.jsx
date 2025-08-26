// src/pages/Riepilogo.jsx
import React, { useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"

/**
 * RIEPILOGO & STAMPA
 * - Riceve dallo state: { anagrafica, struttura, serviziTecnici }
 * - Tutte le voci sono IVA ESCLUSA; IVA applicata solo nel riepilogo finale.
 * - Pulsante Stampa: usa la stampa del browser (PDF).
 * - Puoi esportare il preventivo in JSON (file .preventivo.json).
 */

export default function Riepilogo() {
  const nav = useNavigate()
  const { state } = useLocation()

  if (!state?.anagrafica || !state?.struttura) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-orange-600">Riepilogo</h1>
        <div className="rounded-xl border p-4 bg-white">
          <div className="mb-2">Non ci sono dati di preventivo in questa pagina.</div>
          <button className="rounded-lg border px-3 py-2 text-sm" onClick={()=>nav("/")}>Vai all’Anagrafica</button>
        </div>
      </div>
    )
  }

  const { anagrafica, struttura, serviziTecnici } = state
  const corpi = struttura.corpi || []
  const superfici = struttura.superfici || { areaPiantaTot: 0, areaFaldaTot: 0 }
  const importi = struttura.importi || { struttura: 0, servizi: 0, subTotale: 0 }

  // Parametri economici finali (solo qui si applica l'IVA)
  const [extraPct, setExtraPct] = useState(0)   // extra/forfetari su imponibile
  const [scontoPct, setScontoPct] = useState(0) // sconto su imponibile+extra
  const [ivaPct, setIvaPct] = useState(22)

  const imponibileBase = useMemo(() => round2(importi.subTotale), [importi])
  const extraVal = useMemo(() => round2(imponibileBase * (toNum(extraPct)/100)), [imponibileBase, extraPct])
  const imponibile = useMemo(() => round2(imponibileBase + extraVal), [imponibileBase, extraVal])
  const scontoVal = useMemo(() => round2(imponibile * (toNum(scontoPct)/100)), [imponibile, scontoPct])
  const imponibileNetto = useMemo(() => round2(imponibile - scontoVal), [imponibile, scontoVal])
  const ivaVal = useMemo(() => round2(imponibileNetto * (toNum(ivaPct)/100)), [imponibileNetto, ivaPct])
  const totale = useMemo(() => round2(imponibileNetto + ivaVal), [imponibileNetto, ivaVal])

  const [note, setNote] = useState("")

  function stampa() {
    window.print()
  }

  function exportJson() {
    const payload = {
      versione: 1,
      anagrafica,
      struttura,
      serviziTecnici,
      riepilogo: {
        extraPct: toNum(extraPct),
        scontoPct: toNum(scontoPct),
        ivaPct: toNum(ivaPct),
        imponibileBase,
        extraVal,
        imponibile,
        scontoVal,
        imponibileNetto,
        ivaVal,
        totale,
        note
      },
      esportato: new Date().toISOString()
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = suggerisciNomeFile(anagrafica?.cliente || "preventivo") + ".preventivo.json"; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Intestazione di stampa */}
      <div className="rounded-2xl border border-orange-300 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="https://www.glcgrimaldelli.com/wp-content/uploads/2019/06/Logo-Sottopagine.jpg" alt="logo" style={{height: 48}} />
            <div className="text-xl font-bold text-orange-600">Preventivi Grimaldelli</div>
          </div>
          <div className="print:hidden flex items-center gap-2">
            <button className="rounded-lg border px-3 py-2 text-sm" onClick={()=>nav(-1)}>← Torna</button>
            <button className="rounded-lg border px-3 py-2 text-sm" onClick={exportJson}>Esporta JSON</button>
            <button className="rounded-lg border px-3 py-2 text-sm bg-black text-white" onClick={stampa}>Stampa / PDF</button>
          </div>
        </div>
      </div>

      {/* Anagrafica */}
      <section className="rounded-2xl border border-orange-300 bg-white p-4 shadow-sm print:break-inside-avoid">
        <div className="mb-2 text-lg font-semibold">Anagrafica</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4 text-sm">
          <Info label="Cliente" value={anagrafica.cliente} />
          <Info label="Riferimento" value={anagrafica.riferimento || "—"} />
          <Info label="Data" value={anagrafica.data} />
          <Info label="Località" value={`${anagrafica.localita.comune || "—"} (${anagrafica.localita.sigla_prov || "—"})`} />
          <Info label="ISTAT" value={anagrafica.localita.istat || "—"} mono />
          <Info label="Zona sismica" value={anagrafica.localita.zona_sismica || "—"} mono />
          <Info label="Altitudine (m s.l.m.)" value={fmt(anagrafica.localita.altitudine_m || 0, 0)} />
        </div>
      </section>

      {/* Struttura — corpi e superfici */}
      <section className="rounded-2xl border border-orange-300 bg-white p-4 shadow-sm print:break-inside-avoid">
        <div className="mb-2 text-lg font-semibold">Struttura — Corpi e superfici</div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs opacity-70">
                <th className="p-2">Corpo</th>
                <th className="p-2">Tipo</th>
                <th className="p-2">L (m)</th>
                <th className="p-2">W (m)</th>
                <th className="p-2">Pendenza (%)</th>
                <th className="p-2">A pianta (m²)</th>
                <th className="p-2">A falda (m²)</th>
                <th className="p-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {corpi.map((c, i) => (
                <tr key={i} className="border-b">
                  <td className="p-2">{c.id}</td>
                  <td className="p-2">{labelTipo(c.tipo)}</td>
                  <td className="p-2">{fmt(c.L,2)}</td>
                  <td className="p-2">{fmt(c.W,2)}</td>
                  <td className="p-2">{fmt(c.pendenza,1)}</td>
                  <td className="p-2">{fmt(toNum(c.L)*toNum(c.W),2)}</td>
                  <td className="p-2">{fmt(areaFaldaCorpo(c),2)}</td>
                  <td className="p-2">{c.note || "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-medium">
                <td className="p-2" colSpan={5}>Totali</td>
                <td className="p-2">{fmt(superfici.areaPiantaTot,2)}</td>
                <td className="p-2">{fmt(superfici.areaFaldaTot,2)}</td>
                <td className="p-2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Carichi e massa */}
      <section className="rounded-2xl border border-orange-300 bg-white p-4 shadow-sm print:break-inside-avoid">
        <div className="mb-2 text-lg font-semibold">Carichi neve/vento e massa</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4 text-sm">
          <Info label="Zona neve" value={struttura.neve?.zonaNeve || "—"} mono />
          <Info label="qsk (kN/m²)" value={fmt(struttura.neve?.qsk || 0, 3)} />
          <Info label="μ · CE · Ct" value={`${fmt(struttura.neve?.mu || 0,2)} · ${fmt(struttura.neve?.CE || 0,2)} · ${fmt(struttura.neve?.Ct || 0,2)}`} />
          <Info label="qs (kN/m²)" value={fmt(struttura.neve?.qs || 0, 3)} />
          <Info label="Carico vento (kg/m²)" value={fmt(struttura.vento?.caricoVento || 0, 0)} />
          <Info label="Kg/m²" value={fmt(struttura.kgm2 || 0, 1)} />
          <Info label="Kg totali" value={fmt(struttura.totKg || 0, 0)} />
          <Info label="€/kg" value={`€ ${fmt(struttura.euroKg || 0, 2)}`} />
        </div>
      </section>

      {/* Economico — voci IVA ESCLUSA */}
      <section className="rounded-2xl border border-orange-300 bg-white p-4 shadow-sm print:break-inside-avoid">
        <div className="mb-2 text-lg font-semibold">Economico (voci IVA esclusa)</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 text-sm">
          <Info label="Importo struttura (IVA esclusa)" value={`€ ${fmt(importi.struttura || 0, 2)}`} />
          <Info label="Subtotale servizi (IVA esclusa)" value={`€ ${fmt(importi.servizi || 0, 2)}`} />
        </div>

        <div className="mt-3 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs opacity-70">
                <th className="p-2">Servizio tecnico</th>
                <th className="p-2">Stato</th>
                <th className="p-2">UM</th>
                <th className="p-2">Q.tà</th>
                <th className="p-2">Prezzo (IVA escl.)</th>
                <th className="p-2 text-right">Importo</th>
              </tr>
            </thead>
            <tbody>
              {(serviziTecnici || []).map((s, i) => (
                <tr key={i} className="border-b">
                  <td className="p-2">{s.label}</td>
                  <td className="p-2 capitalize">{s.stato}</td>
                  <td className="p-2">{s.unita}</td>
                  <td className="p-2">{fmt(s.qta, 2)}</td>
                  <td className="p-2">€ {fmt(s.prezzo, 2)}</td>
                  <td className="p-2 text-right font-medium">
                    {s.stato === "importo" ? <>€ {fmt(toNum(s.qta) * toNum(s.prezzo), 2)}</> : <span className="opacity-60">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-medium">
                <td className="p-2" colSpan={5}>Subtotale servizi</td>
                <td className="p-2 text-right">€ {fmt(importi.servizi || 0, 2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Riepilogo finale con IVA */}
      <section className="rounded-2xl border border-orange-300 bg-white p-4 shadow-sm print:break-inside-avoid">
        <div className="mb-2 text-lg font-semibold">Riepilogo economico (IVA applicata qui)</div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border p-3 text-sm">
            <div className="mb-2 font-medium">Parametri</div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <LabeledNumber label="Extra (%)" value={extraPct} onChange={setExtraPct} />
              <LabeledNumber label="Sconto (%)" value={scontoPct} onChange={setScontoPct} />
              <LabeledNumber label="IVA (%)" value={ivaPct} onChange={setIvaPct} />
            </div>
            <div className="mt-3 text-xs opacity-60">
              L’IVA è calcolata solo qui. Tutte le voci sopra sono IVA esclusa.
            </div>
          </div>

          <div className="rounded-xl border p-3 text-sm">
            <div className="mb-2 font-medium">Totali</div>
            <Line label="Imponibile base (Struttura + Servizi)" value={imponibileBase} bold />
            <Line label={`Extra ${fmt(extraPct,0)}%`} value={extraVal} />
            <Line label="Imponibile" value={imponibile} />
            <Line label={`Sconto ${fmt(scontoPct,0)}%`} value={-scontoVal} />
            <Line label="Imponibile netto" value={imponibileNetto} bold />
            <Line label={`IVA ${fmt(ivaPct,0)}%`} value={ivaVal} />
            <Line label="TOTALE" value={totale} bold big />
          </div>
        </div>
      </section>

      {/* Note per stampa */}
      <section className="rounded-2xl border border-orange-300 bg-white p-4 shadow-sm print:break-inside-avoid">
        <div className="mb-2 text-lg font-semibold">Note</div>
        <textarea
          className="w-full rounded-xl border p-2"
          rows={4}
          placeholder="Condizioni, tempi di consegna, esclusioni, validità offerta..."
          value={note}
          onChange={e=>setNote(e.target.value)}
        />
        <div className="mt-2 text-xs opacity-60">
          Le “Prove dei materiali” sono indicate come <b>escluse</b> se non valorizzate; “Direzione lavori” può risultare <b>inclusa</b> con importo €0.
        </div>
      </section>

      {/* Footer azioni */}
      <section className="rounded-2xl border border-orange-300 bg-white p-4 shadow-sm print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button className="rounded-lg border px-3 py-2 text-sm" onClick={()=>nav(-1)}>← Torna</button>
          <div className="flex gap-2">
            <button className="rounded-lg border px-3 py-2 text-sm" onClick={exportJson}>Esporta JSON</button>
            <button className="rounded-lg border px-3 py-2 text-sm bg-black text-white" onClick={stampa}>Stampa / PDF</button>
          </div>
        </div>
      </section>
    </div>
  )
}

// ———— COMPONENTI PICCOLI ————————————————————————————————————————

function Info({ label, value, mono }) {
  return (
    <div className="rounded-lg border p-2">
      <div className="opacity-60 text-xs">{label}</div>
      <div className={mono ? "font-mono" : "font-medium"}>{value || "—"}</div>
    </div>
  )
}

function LabeledNumber({ label, value, onChange }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs opacity-70">{label}</span>
      <input
        type="number"
        className="rounded-lg border p-2"
        value={value}
        onChange={e => onChange(toNum(e.target.value))}
      />
    </label>
  )
}

function Line({ label, value, bold=false, big=false }) {
  return (
    <div className={`flex items-center justify-between border-b py-1 ${big ? "text-lg" : "text-sm"} ${bold ? "font-semibold" : ""}`}>
      <div>{label}</div>
      <div>€ {fmt(value, 2)}</div>
    </div>
  )
}

// ———— HELPERS ————————————————————————————————————————————————

function toNum(v){ return isFinite(+v) ? +v : 0 }
function round2(n){ return Math.round((isFinite(+n)?+n:0) * 100) / 100 }
function fmt(n, dec=0){ const v = isFinite(+n)?+n:0; return v.toLocaleString("it-IT",{minimumFractionDigits:dec, maximumFractionDigits:dec}) }

function labelTipo(id) {
  const map = {
    tetto_piano: "Tetto piano", mono: "Monofalda (shed)", bifalda: "Bifalda / a capanna",
    padiglione: "Padiglione (4 falde)", gambrel: "Gambrel", mansarda: "Mansarda",
    sawtooth: "Dente di sega", multished: "Multished", farfalla: "Farfalla",
    botte: "Botte/volta", arco: "Arco", capriate: "Capriate"
  }
  return map[id] || id
}

function areaFaldaCorpo(c) {
  const L = toNum(c.L), W = toNum(c.W)
  const A_pianta = L * W
  if (String(c.overrideFalda || "").trim() !== "") return toNum(c.overrideFalda)
  const p = toNum(c.pendenza || 0)
  const cos = Math.cos(Math.atan(p/100)) || 1
  return A_pianta / Math.max(cos, 0.01)
}

function suggerisciNomeFile(cliente) {
  const clean = (cliente || "preventivo").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
  return `${clean || "preventivo"}-${new Date().toISOString().slice(0,10)}`
}
