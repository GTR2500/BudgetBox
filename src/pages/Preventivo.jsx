import React, { useMemo, useState } from 'react'
import { currency } from '../utils/currency.js'
import { interpIngrasso } from '../utils/interpIngrasso.js'

const LOGO_URL = "https://www.glcgrimaldelli.com/wp-content/uploads/2019/06/Logo-Sottopagine.jpg"

function Badge({ intent='info', children }){
  const map = {
    ok: 'bg-green-100 text-green-800 ring-green-200',
    warn: 'bg-amber-100 text-amber-800 ring-amber-200',
    bad: 'bg-rose-100 text-rose-800 ring-rose-200',
    info: 'bg-slate-100 text-slate-800 ring-slate-200',
    brand: 'bg-orange-100 text-orange-800 ring-orange-200',
  }
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${map[intent]}`}>{children}</span>
}

export default function Preventivo({ isDark, economia, setEconomia, listino, norme }){
  const [anagrafica, setAnagrafica] = useState({ cliente: '', localita: '', riferimento: '', data: new Date().toISOString().slice(0,10) })
  const [capannone, setCapannone] = useState({ lunghezza: 60, larghezza: 25, quotaDecubito: 70, prezzoMq: 180, note: 'Struttura metallica zincata, copertura sandwich 40 mm' })

  const categorie = Object.keys(norme)
  const [mandria, setMandria] = useState(() => {
    const init = {}
    for(const cat of categorie){
      const stab = Object.keys(norme[cat].stabulazioni)[0]
      init[cat] = { n: 0, stabulazione: stab, livello: 'adeg' }
    }
    return init
  })
  const [ingrasso, setIngrasso] = useState({ gruppi: 0, capiPerGruppo: 0, pesoMedio: 550, livello: 'adeg' })

  const [righe, setRighe] = useState([])

  const areaLorda = useMemo(() => capannone.lunghezza * capannone.larghezza, [capannone])
  const areaDecubitoReale = useMemo(() => (areaLorda * (capannone.quotaDecubito || 0)) / 100, [areaLorda, capannone.quotaDecubito])

  const areaNormativaMandria = useMemo(() => {
    let tot = 0
    for(const cat of categorie){
      const { n, stabulazione, livello } = mandria[cat]
      if(!n) continue
      const v = norme[cat].stabulazioni[stabulazione][livello]
      tot += n*v
    }
    if (ingrasso.gruppi>0 && ingrasso.capiPerGruppo>0){
      const perCapo = interpIngrasso(ingrasso.pesoMedio)[ingrasso.livello]
      const capiTot = ingrasso.gruppi * ingrasso.capiPerGruppo
      tot += perCapo * capiTot
    }
    return tot
  }, [mandria, categorie, ingrasso, norme])

  const conformita = useMemo(() => {
    if (areaDecubitoReale >= areaNormativaMandria) return { stato: 'ok', msg: 'Conforme / adeguato' }
    if (areaDecubitoReale >= areaNormativaMandria * 0.9) return { stato: 'warn', msg: 'Quasi conforme (–10%). Verifica layout e corridoi.' }
    return { stato: 'bad', msg: 'Non conforme: aumentare superficie di decubito o ridurre capi.' }
  }, [areaDecubitoReale, areaNormativaMandria])

  const costoCapannone = useMemo(() => areaLorda * (capannone.prezzoMq || 0), [areaLorda, capannone.prezzoMq])
  const subtotalAccessori = useMemo(() => righe.reduce((s,r)=> s + (r.qta||0)*(r.prezzo||0), 0), [righe])
  const margine = useMemo(() => (subtotalAccessori * (economia.marginePercent||0))/100, [subtotalAccessori, economia])
  const extra = useMemo(() => ((costoCapannone + subtotalAccessori + margine) * (economia.extraPercent||0))/100, [costoCapannone, subtotalAccessori, margine, economia])
  const imponibile = useMemo(() => costoCapannone + subtotalAccessori + margine + extra, [costoCapannone, subtotalAccessori, margine, extra])
  const sconto = useMemo(() => (imponibile * (economia.scontoPercent||0))/100, [imponibile, economia])
  const imponibileNetto = useMemo(() => Math.max(0, imponibile - sconto), [imponibile, sconto])
  const iva = useMemo(() => (imponibileNetto * (economia.ivaPercent||0))/100, [imponibileNetto, economia])
  const totale = useMemo(() => imponibileNetto + iva, [imponibileNetto, iva])

  function aggiornaRiga(idx, patch){ setRighe(arr => arr.map((r,i)=> i===idx ? {...r, ...patch} : r)) }
  function aggiungiDaCatalogo(item){ setRighe(arr => [...arr, { codice:item.id, descrizione:item.nome, unita:item.unita, qta:1, prezzo:item.prezzo }]) }

  function downloadJSON(){
    const data = { anagrafica, capannone, mandria, ingrasso, righe, economia, totali: { areaLorda, areaDecubitoReale, areaNormativaMandria, costoCapannone, subtotalAccessori, margine, extra, sconto, imponibileNetto, iva, totale } }
    const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `preventivo-stalla-${anagrafica.cliente || 'cliente'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      {/* INTERFACCIA */}
      <section className={(isDark ? 'bg-slate-800' : 'bg-white') + ' mb-6 grid grid-cols-1 gap-4 rounded-2xl border border-brand-300 p-4 shadow-sm md:grid-cols-4'}>
        <div className="col-span-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Anagrafica</h2></div>
        <label className="flex flex-col gap-1"><span className="text-xs opacity-80">Cliente</span><input className={'rounded-xl border px-3 py-2 '+(isDark?'bg-slate-900 border-slate-700':'')} value={anagrafica.cliente} onChange={e=>setAnagrafica({...anagrafica, cliente:e.target.value})}/></label>
        <label className="flex flex-col gap-1"><span className="text-xs opacity-80">Località</span><input className={'rounded-xl border px-3 py-2 '+(isDark?'bg-slate-900 border-slate-700':'')} value={anagrafica.localita} onChange={e=>setAnagrafica({...anagrafica, localita:e.target.value})}/></label>
        <label className="flex flex-col gap-1"><span className="text-xs opacity-80">Riferimento</span><input className={'rounded-xl border px-3 py-2 '+(isDark?'bg-slate-900 border-slate-700':'')} value={anagrafica.riferimento} onChange={e=>setAnagrafica({...anagrafica, riferimento:e.target.value})}/></label>
        <label className="flex flex-col gap-1"><span className="text-xs opacity-80">Data</span><input type="date" className={'rounded-xl border px-3 py-2 '+(isDark?'bg-slate-900 border-slate-700':'')} value={anagrafica.data} onChange={e=>setAnagrafica({...anagrafica, data:e.target.value})}/></label>
      </section>

      <section className={(isDark ? 'bg-slate-800' : 'bg-white') + ' mb-6 grid grid-cols-1 gap-4 rounded-2xl border border-brand-300 p-4 shadow-sm md:grid-cols-3'}>
        <div className="col-span-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Capannone</h2>
          <Badge intent={conformita.stato}>Check superficie: {conformita.msg}</Badge>
        </div>
        <label className="flex flex-col gap-1"><span className="text-xs opacity-80">Lunghezza (m)</span><input type="number" className={'rounded-xl border px-3 py-2 '+(isDark?'bg-slate-900 border-slate-700':'')} value={capannone.lunghezza} onChange={e=>setCapannone({...capannone, lunghezza:Number(e.target.value)})}/></label>
        <label className="flex flex-col gap-1"><span className="text-xs opacity-80">Larghezza (m)</span><input type="number" className={'rounded-xl border px-3 py-2 '+(isDark?'bg-slate-900 border-slate-700':'')} value={capannone.larghezza} onChange={e=>setCapannone({...capannone, larghezza:Number(e.target.value)})}/></label>
        <label className="flex flex-col gap-1"><span className="text-xs opacity-80">Quota area di decubito (%)</span><input type="number" className={'rounded-xl border px-3 py-2 '+(isDark?'bg-slate-900 border-slate-700':'')} value={capannone.quotaDecubito} onChange={e=>setCapannone({...capannone, quotaDecubito:Number(e.target.value)})}/></label>
        <label className="flex flex-col gap-1"><span className="text-xs opacity-80">Prezzo struttura (€/m²)</span><input type="number" className={'rounded-xl border px-3 py-2 '+(isDark?'bg-slate-900 border-slate-700':'')} value={capannone.prezzoMq} onChange={e=>setCapannone({...capannone, prezzoMq:Number(e.target.value)})}/></label>
        <div className={'rounded-xl p-3 text-sm '+(isDark?'bg-slate-900 border border-slate-700':'bg-slate-50')}>
          <div>Area lorda: <b>{areaLorda.toFixed(1)} m²</b></div>
          <div>Area decubito (reale): <b>{areaDecubitoReale.toFixed(1)} m²</b></div>
          <div>Area normativa richiesta: <b>{areaNormativaMandria.toFixed(1)} m²</b></div>
        </div>
        <label className="col-span-3 flex flex-col gap-1"><span className="text-xs opacity-80">Note</span><input className={'rounded-xl border px-3 py-2 '+(isDark?'bg-slate-900 border-slate-700':'')} value={capannone.note} onChange={e=>setCapannone({...capannone, note:e.target.value})}/></label>
      </section>

      <section className={(isDark ? 'bg-slate-800' : 'bg-white') + ' mb-6 rounded-2xl border border-brand-300 p-4 shadow-sm'}>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">Popolazioni & stabulazioni</h2></div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {categorie.map(cat=>{
            const stabs = Object.keys(norme[cat].stabulazioni)
            const { n, stabulazione, livello } = mandria[cat]
            const val = norme[cat].stabulazioni[stabulazione][livello]
            return (
              <div key={cat} className={'rounded-2xl border p-3 '+(isDark?'border-slate-700':'')}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="font-medium">{cat}</div>
                  <Badge intent={n>0 ? 'ok' : 'info'}>{n||0} capi</Badge>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <label className="col-span-1 flex flex-col gap-1 text-sm"><span className="text-xs opacity-80">N. capi</span><input type="number" className={'rounded-lg border px-2 py-1 '+(isDark?'bg-slate-900 border-slate-700':'')} value={n} onChange={e=>setMandria({...mandria, [cat]:{...mandria[cat], n:Number(e.target.value)}})} /></label>
                  <label className="col-span-2 flex flex-col gap-1 text-sm"><span className="text-xs opacity-80">Stabulazione</span><select className={'rounded-lg border px-2 py-1 '+(isDark?'bg-slate-900 border-slate-700':'')} value={stabulazione} onChange={e=>setMandria({...mandria, [cat]:{...mandria[cat], stabulazione:e.target.value}})}>{stabs.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
                  <label className="col-span-1 flex flex-col gap-1 text-sm"><span className="text-xs opacity-80">Livello</span><select className={'rounded-lg border px-2 py-1 '+(isDark?'bg-slate-900 border-slate-700':'')} value={livello} onChange={e=>setMandria({...mandria, [cat]:{...mandria[cat], livello:e.target.value}})}><option value="min">Min</option><option value="adeg">Adeguato</option><option value="opt">Ottimale</option></select></label>
                </div>
                <div className="mt-2 text-xs opacity-80">Valore unitario: <b>{val.toFixed(2)} m²/capo</b></div>
              </div>
            )
          })}
          <div className={'rounded-2xl border p-3 md:col-span-2 '+(isDark?'border-slate-700':'')}>
            <div className="mb-2 flex items-center justify-between"><div className="font-medium">Bovini da ingrasso</div><Badge intent={ingrasso.gruppi*ingrasso.capiPerGruppo>0?'ok':'info'}>{ingrasso.gruppi*ingrasso.capiPerGruppo || 0} capi</Badge></div>
            <div className="grid grid-cols-6 gap-2 text-sm">
              <label className="col-span-2 flex flex-col gap-1"><span className="text-xs opacity-80">N. gruppi</span><input type="number" className={'rounded-lg border px-2 py-1 '+(isDark?'bg-slate-900 border-slate-700':'')} value={ingrasso.gruppi} onChange={e=>setIngrasso({...ingrasso, gruppi:Number(e.target.value)})}/></label>
              <label className="col-span-2 flex flex-col gap-1"><span className="text-xs opacity-80">Capi per gruppo</span><input type="number" className={'rounded-lg border px-2 py-1 '+(isDark?'bg-slate-900 border-slate-700':'')} value={ingrasso.capiPerGruppo} onChange={e=>setIngrasso({...ingrasso, capiPerGruppo:Number(e.target.value)})}/></label>
              <label className="col-span-1 flex flex-col gap-1"><span className="text-xs opacity-80">Peso medio (kg)</span><input type="number" className={'rounded-lg border px-2 py-1 '+(isDark?'bg-slate-900 border-slate-700':'')} value={ingrasso.pesoMedio} onChange={e=>setIngrasso({...ingrasso, pesoMedio:Number(e.target.value)})}/></label>
              <label className="col-span-1 flex flex-col gap-1"><span className="text-xs opacity-80">Livello</span><select className={'rounded-lg border px-2 py-1 '+(isDark?'bg-slate-900 border-slate-700':'')} value={ingrasso.livello} onChange={e=>setIngrasso({...ingrasso, livello:e.target.value})}><option value="min">Min</option><option value="adeg">Adeguato</option><option value="opt">Ottimale</option></select></label>
            </div>
            <div className="mt-2 text-xs opacity-80">Valori unitari (stima): {(()=>{const x = interpIngrasso(ingrasso.pesoMedio); return `min ${x.min.toFixed(2)} · adeg ${x.adeg.toFixed(2)} · opt ${x.opt.toFixed(2)} m²/capo`})()}</div>
          </div>
        </div>
      </section>

      <section className={(isDark ? 'bg-slate-800' : 'bg-white') + ' mb-6 grid grid-cols-1 gap-4 rounded-2xl border border-brand-300 p-4 shadow-sm md:grid-cols-3'}>
        <div className="col-span-1">
          <h2 className="mb-2 text-lg font-semibold">Catalogo</h2>
          <div className="max-h-80 space-y-2 overflow-auto pr-2">
            {listino.map(it=>(
              <div key={it.id} className={'flex items-center justify-between rounded-xl border p-2 text-sm '+(isDark?'border-slate-700':'')}>
                <div className="min-w-0">
                  <div className="truncate font-medium">{it.nome}</div>
                  <div className="text-xs opacity-80">{it.unita} · {currency(it.prezzo)}</div>
                </div>
                <button onClick={()=>aggiungiDaCatalogo(it)} className="rounded-lg bg-slate-900 px-3 py-1 text-xs text-white">Aggiungi</button>
              </div>
            ))}
          </div>
        </div>
        <div className="md:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Cancelli & Accessori</h2>
            <div className="flex gap-2">
              <button className={'rounded-lg border px-3 py-1 text-sm '+(isDark?'border-slate-700':'')} onClick={()=>setRighe(r=>[...r,{codice:'', descrizione:'Riga libera', unita:'pz', qta:1, prezzo:0}])}>+ Riga libera</button>
              <button className={'rounded-lg border px-3 py-1 text-sm '+(isDark?'border-slate-700':'')} onClick={downloadJSON}>Esporta JSON</button>
            </div>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs opacity-80">
                  <th className="p-2">Codice</th>
                  <th className="p-2">Descrizione</th>
                  <th className="p-2">UM</th>
                  <th className="p-2">Q.tà</th>
                  <th className="p-2">Prezzo</th>
                  <th className="p-2 text-right">Totale</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {righe.length===0 && <tr><td colSpan={7} className="p-3 text-center opacity-80">Nessuna riga. Aggiungi dal catalogo o inserisci righe libere.</td></tr>}
                {righe.map((r,i)=>(
                  <tr key={i} className="border-b">
                    <td className="p-2"><input className={'w-28 rounded-lg border px-2 py-1 '+(isDark?'bg-slate-900 border-slate-700':'')} value={r.codice} onChange={e=>aggiornaRiga(i,{codice:e.target.value})}/></td>
                    <td className="p-2"><input className={'w-full rounded-lg border px-2 py-1 '+(isDark?'bg-slate-900 border-slate-700':'')} value={r.descrizione} onChange={e=>aggiornaRiga(i,{descrizione:e.target.value})}/></td>
                    <td className="p-2"><input className={'w-16 rounded-lg border px-2 py-1 '+(isDark?'bg-slate-900 border-slate-700':'')} value={r.unita} onChange={e=>aggiornaRiga(i,{unita:e.target.value})}/></td>
                    <td className="p-2"><input type="number" className={'w-24 rounded-lg border px-2 py-1 '+(isDark?'bg-slate-900 border-slate-700':'')} value={r.qta} onChange={e=>aggiornaRiga(i,{qta:Number(e.target.value)})}/></td>
                    <td className="p-2"><input type="number" className={'w-28 rounded-lg border px-2 py-1 '+(isDark?'bg-slate-900 border-slate-700':'')} value={r.prezzo} onChange={e=>aggiornaRiga(i,{prezzo:Number(e.target.value)})}/></td>
                    <td className="p-2 text-right font-medium">{currency((r.qta||0)*(r.prezzo||0))}</td>
                    <td className="p-2 text-right"><button className="text-rose-600 hover:underline" onClick={()=>setRighe(arr=>arr.filter((_,idx)=>idx!==i))}>Elimina</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={'mt-3 grid grid-cols-2 gap-3 rounded-xl p-3 '+(isDark?'bg-slate-900 border border-slate-700':'bg-slate-50')}>
            <div className="text-sm opacity-80">Subtotale accessori</div>
            <div className="text-right font-semibold">{currency(subtotalAccessori)}</div>
            <div className="text-sm opacity-80">Margine impresa ({economia.marginePercent}%)</div>
            <div className="text-right font-semibold">{currency(margine)}</div>
          </div>
        </div>
      </section>

      <section className={(isDark ? 'bg-slate-800' : 'bg-white') + ' mb-10 rounded-2xl border border-brand-300 p-4 shadow-sm'}>
        <h2 className="mb-3 text-lg font-semibold">Riepilogo economico</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className={'rounded-xl p-3 '+(isDark?'border border-slate-700':'border')}>
            <div className="flex items-center justify-between text-sm"><div>Capannone – struttura ({areaLorda.toFixed(0)} m² × {currency(capannone.prezzoMq)}/m²)</div><div className="font-semibold">{currency(costoCapannone)}</div></div>
            <div className="flex items-center justify-between text-sm"><div>Accessori e cancelli</div><div className="font-semibold">{currency(subtotalAccessori)}</div></div>
            <div className="flex items-center justify-between text-sm"><div>Margine impresa ({economia.marginePercent}%)</div><div className="font-semibold">{currency(margine)}</div></div>
            <div className="flex items-center justify-between text-sm"><div>Extra/Forfettari ({economia.extraPercent}%)</div><div className="font-semibold">{currency(extra)}</div></div>
            <div className="mt-2 border-t pt-2" />
            <div className="flex items-center justify-between text-sm"><div>Imponibile</div><div className="font-semibold">{currency(imponibile)}</div></div>
            <div className="flex items-center justify-between text-sm"><div>Sconto ({economia.scontoPercent}%)</div><div className="font-semibold">−{currency(sconto)}</div></div>
            <div className="flex items-center justify-between text-sm"><div>Imponibile netto</div><div className="font-semibold">{currency(imponibileNetto)}</div></div>
            <div className="flex items-center justify-between text-sm"><div>IVA ({economia.ivaPercent}%)</div><div className="font-semibold">{currency(iva)}</div></div>
            <div className="mt-2 border-t pt-2" />
            <div className="flex items-center justify-between text-base"><div>Totale preventivo</div><div className="text-xl font-bold">{currency(totale)}</div></div>
          </div>
          <div className={'rounded-xl p-3 '+(isDark?'border border-slate-700':'border')}>
            <h3 className="mb-2 font-medium">Impostazioni economiche</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <label className="flex flex-col gap-1"><span className="text-xs opacity-80">Margine impresa (%)</span><input type="number" className={'rounded-lg border px-2 py-1 '+(isDark?'bg-slate-900 border-slate-700':'')} value={economia.marginePercent} onChange={e=>setEconomia({...economia, marginePercent:Number(e.target.value)})}/></label>
              <label className="flex flex-col gap-1"><span className="text-xs opacity-80">Extra/Forfettari (%)</span><input type="number" className={'rounded-lg border px-2 py-1 '+(isDark?'bg-slate-900 border-slate-700':'')} value={economia.extraPercent} onChange={e=>setEconomia({...economia, extraPercent:Number(e.target.value)})}/></label>
              <label className="flex flex-col gap-1"><span className="text-xs opacity-80">Sconto (%)</span><input type="number" className={'rounded-lg border px-2 py-1 '+(isDark?'bg-slate-900 border-slate-700':'')} value={economia.scontoPercent} onChange={e=>setEconomia({...economia, scontoPercent:Number(e.target.value)})}/></label>
              <label className="flex flex-col gap-1"><span className="text-xs opacity-80">IVA (%)</span><input type="number" className={'rounded-lg border px-2 py-1 '+(isDark?'bg-slate-900 border-slate-700':'')} value={economia.ivaPercent} onChange={e=>setEconomia({...economia, ivaPercent:Number(e.target.value)})}/></label>
            </div>
            <div className="mt-3 text-xs opacity-80">Suggerimento: imposta i prezzi unitari del capannone e del catalogo in base al tuo listino.</div>
          </div>
        </div>
      </section>

      {/* PRINT LAYOUT (visibile in stampa) */}
      <div className="print-block hidden">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Grimaldelli" className="h-12 w-auto" />
            <div>
              <div className="text-2xl font-bold text-brand-600">Preventivi Grimaldelli</div>
            </div>
          </div>
          <div className="text-right text-sm">
            <div><b>Data:</b> {anagrafica.data}</div>
            <div><b>Riferimento:</b> {anagrafica.riferimento || '—'}</div>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <div className="rounded border border-brand-300 p-3 text-sm">
            <div className="font-semibold mb-1">Anagrafica cliente</div>
            <div><b>Cliente:</b> {anagrafica.cliente || '—'}</div>
            <div><b>Località:</b> {anagrafica.localita || '—'}</div>
          </div>
          <div className="rounded border border-brand-300 p-3 text-sm">
            <div className="font-semibold mb-1">Quadro tecnico</div>
            <div>Capannone: {capannone.lunghezza}×{capannone.larghezza} m · Area lorda {areaLorda.toFixed(1)} m²</div>
            <div>Decubito: {areaDecubitoReale.toFixed(1)} m² · Richiesto: {areaNormativaMandria.toFixed(1)} m²</div>
            <div>Conformità: {conformita.msg}</div>
          </div>
        </div>

        <table className="table w-full mb-3">
          <thead><tr><th style={{width:'16%'}}>Codice</th><th>Descrizione</th><th style={{width:'8%'}}>UM</th><th style={{width:'10%'}}>Q.tà</th><th style={{width:'14%'}}>Prezzo</th><th style={{width:'14%'}}>Totale</th></tr></thead>
          <tbody>
            <tr><td>CAP-STR</td><td>Struttura capannone {capannone.lunghezza}×{capannone.larghezza} m ({areaLorda.toFixed(0)} m²). {capannone.note}</td><td>m²</td><td>{areaLorda.toFixed(0)}</td><td>{currency(capannone.prezzoMq,2)}</td><td>{currency(costoCapannone,2)}</td></tr>
            {righe.map((r,i)=>(<tr key={i}><td>{r.codice||'—'}</td><td>{r.descrizione||''}</td><td>{r.unita||''}</td><td>{(r.qta||0).toLocaleString('it-IT')}</td><td>{currency(r.prezzo||0,2)}</td><td>{currency((r.qta||0)*(r.prezzo||0),2)}</td></tr>))}
          </tbody>
        </table>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded border border-brand-300 p-3 text-sm">
            <div className="font-semibold mb-1">Condizioni economiche</div>
            <div>Margine impresa: {economia.marginePercent}%</div>
            <div>Extra/Forfettari: {economia.extraPercent}%</div>
            <div>Sconto: {economia.scontoPercent}%</div>
            <div>IVA: {economia.ivaPercent}%</div>
          </div>
          <div className="rounded border border-brand-300 p-3 text-sm">
            <div className="flex items-center justify-between"><div>Capannone – struttura</div><div>{currency(costoCapannone,2)}</div></div>
            <div className="flex items-center justify-between"><div>Accessori e cancelli</div><div>{currency(subtotalAccessori,2)}</div></div>
            <div className="flex items-center justify-between"><div>Margine impresa</div><div>{currency(margine,2)}</div></div>
            <div className="flex items-center justify-between"><div>Extra/Forfettari</div><div>{currency(extra,2)}</div></div>
            <div className="border-t my-2" />
            <div className="flex items-center justify-between"><div>Imponibile</div><div>{currency(imponibile,2)}</div></div>
            <div className="flex items-center justify-between"><div>Sconto</div><div>−{currency(sconto,2)}</div></div>
            <div className="flex items-center justify-between"><div>Imponibile netto</div><div>{currency(imponibileNetto,2)}</div></div>
            <div className="flex items-center justify-between"><div>IVA</div><div>{currency(iva,2)}</div></div>
            <div className="border-t my-2" />
            <div className="flex items-center justify-between text-base"><div><b>TOTALE</b></div><div className="text-xl font-bold">{currency(totale,2)}</div></div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded border border-brand-300 p-3" style={{minHeight:'70px'}}><div className="font-semibold mb-1">Note</div><div>—</div></div>
          <div className="rounded border border-brand-300 p-3"><div className="font-semibold mb-1">Validità & termini</div><ul className="list-disc pl-5"><li>Validità offerta: 30 giorni salvo diversa indicazione.</li><li>Tempi di consegna indicativi: da confermare a ordine.</li><li>Trasporto e posa: se previsti, indicati nel corpo offerta.</li><li>Pagamento: come da accordi commerciali.</li></ul></div>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-8 text-sm">
          <div><div className="mb-12">&nbsp;</div><div className="border-t pt-1">Per accettazione Cliente</div></div>
          <div className="text-right"><div className="mb-12">&nbsp;</div><div className="border-t pt-1">Grimaldelli s.r.l.</div></div>
        </div>
      </div>
    </div>
  )
}
