import React, { useRef, useState } from 'react'

export default function Impostazioni({ isDark, economia, setEconomia, setListino }){
  const fileRef = useRef(null)
  const [msg, setMsg] = useState('')

  async function onCSV(e){
    const file = e.target.files?.[0]
    if(!file) return
    const text = await file.text()
    // semplice parser CSV (virgola o punto e virgola)
    const lines = text.split(/\r?\n/).filter(Boolean)
    const sep = text.includes(';') ? ';' : ','
    const [h, ...rows] = lines
    const headers = h.split(sep).map(s=>s.trim().toLowerCase())
    const idx = { id: headers.indexOf('codice'), nome: headers.indexOf('descrizione'), unita: headers.indexOf('um'), prezzo: headers.indexOf('prezzo') }
    const list = rows.map(line => {
      const cols = line.split(sep)
      return { id: cols[idx.id]?.trim(), nome: cols[idx.nome]?.trim(), unita: cols[idx.unita]?.trim(), prezzo: Number(cols[idx.prezzo])||0 }
    }).filter(x=>x.id && x.nome)
    setListino(list)
    setMsg(`Importati ${list.length} articoli dal CSV`)
  }

  return (
    <div className={(isDark ? 'bg-slate-800' : 'bg-white') + ' rounded-2xl border border-brand-300 p-4 shadow-sm'}>
      <h2 className="text-lg font-semibold mb-4">Impostazioni</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border p-3">
          <div className="font-medium mb-2">Economia (default)</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <label className="flex flex-col gap-1"><span className="text-xs opacity-80">Margine impresa (%)</span><input type="number" className={'rounded-lg border px-2 py-1 '+(isDark?'bg-slate-900 border-slate-700':'')} value={economia.marginePercent} onChange={e=>setEconomia({...economia, marginePercent:Number(e.target.value)})} /></label>
            <label className="flex flex-col gap-1"><span className="text-xs opacity-80">Extra/Forfettari (%)</span><input type="number" className={'rounded-lg border px-2 py-1 '+(isDark?'bg-slate-900 border-slate-700':'')} value={economia.extraPercent} onChange={e=>setEconomia({...economia, extraPercent:Number(e.target.value)})} /></label>
            <label className="flex flex-col gap-1"><span className="text-xs opacity-80">Sconto (%)</span><input type="number" className={'rounded-lg border px-2 py-1 '+(isDark?'bg-slate-900 border-slate-700':'')} value={economia.scontoPercent} onChange={e=>setEconomia({...economia, scontoPercent:Number(e.target.value)})} /></label>
            <label className="flex flex-col gap-1"><span className="text-xs opacity-80">IVA (%)</span><input type="number" className={'rounded-lg border px-2 py-1 '+(isDark?'bg-slate-900 border-slate-700':'')} value={economia.ivaPercent} onChange={e=>setEconomia({...economia, ivaPercent:Number(e.target.value)})} /></label>
          </div>
        </div>
        <div className="rounded-xl border p-3">
          <div className="font-medium mb-2">Listino</div>
          <p className="text-sm opacity-80 mb-2">Carica un CSV con intestazioni: <code>codice, descrizione, um, prezzo</code> (accetta anche <code>;</code> come separatore).</p>
          <input type="file" accept=".csv" ref={fileRef} onChange={onCSV} className="text-sm" />
          {msg && <div className="mt-2 text-sm">{msg}</div>}
        </div>
      </div>
    </div>
  )
}
