import React, { useEffect, useMemo, useState } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import Preventivo from './pages/Preventivo.jsx'
import Impostazioni from './pages/Impostazioni.jsx'

import listinoData from './data/listino.json'
import norme from './data/norme.json'

const LOGO_URL = "https://www.glcgrimaldelli.com/wp-content/uploads/2019/06/Logo-Sottopagine.jpg"
const APP_VERSION = "v0.1.1"

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

const Sun = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2m0 16v2M4 12H2m20 0h-2M17 17l1.5 1.5M5.5 5.5L7 7m0 10-1.5 1.5M17 7l1.5-1.5" />
  </svg>
)
const Moon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 1 0 9.79 9.79Z" />
  </svg>
)

export default function App(){
  // THEME with persistence
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  useEffect(() => { localStorage.setItem('theme', theme) }, [theme])
  const isDark = theme === 'dark'

  // Shared econ settings (can be edited in Impostazioni)
  const [economia, setEconomia] = useState(() => {
    const saved = localStorage.getItem('economia')
    return saved ? JSON.parse(saved) : { extraPercent: 5, scontoPercent: 0, ivaPercent: 22, marginePercent: 15 }
  })
  useEffect(() => { localStorage.setItem('economia', JSON.stringify(economia)) }, [economia])

  // Listino (import from JSON, could be replaced by CSV upload later)
  const [listino, setListino] = useState(listinoData)

  const revLabel = useMemo(() => `Rev ${new Date().toLocaleDateString('it-IT')} · ${APP_VERSION}`, [])

  const location = useLocation()
  const onPrint = () => window.print()

  return (
    <div className={isDark ? 'min-h-screen bg-slate-900 text-slate-100' : 'min-h-screen bg-gray-50 text-slate-800'}>
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* HEADER */}
        <header className="mb-6 grid grid-cols-3 items-center">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Grimaldelli" className="h-12 w-auto" />
          </div>
          <div className="text-center">
            <Link to="/" className="text-2xl font-bold text-brand-600">Preventivi Grimaldelli</Link>
          </div>
          <div className="ml-auto flex items-center justify-end gap-2">
            <Badge intent="brand">{revLabel}</Badge>
            <button
              onClick={onPrint}
              className={(isDark ? 'bg-slate-800 text-slate-100' : 'bg-white text-slate-800') + ' no-print inline-flex items-center gap-2 rounded-full border border-brand-300 px-3 py-2 shadow-sm hover:opacity-95'}
              title="Stampa / Esporta PDF"
            >🖨️ <span className="hidden sm:inline">Stampa / PDF</span></button>
            <Link to="/impostazioni" className={(isDark ? 'bg-slate-800 text-slate-100' : 'bg-white text-slate-800') + ' no-print inline-flex items-center gap-2 rounded-full border border-brand-300 px-3 py-2 shadow-sm hover:opacity-95'}>Impostazioni</Link>
            <button
              className={(isDark ? 'bg-slate-800 text-slate-100' : 'bg-white text-slate-800') + ' inline-flex items-center gap-2 rounded-full border border-brand-300 px-3 py-2 shadow-sm hover:opacity-95'}
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              aria-label={isDark ? 'Passa a tema chiaro' : 'Passa a tema scuro'}
              title={isDark ? 'Tema chiaro' : 'Tema scuro'}
            >{isDark ? <Sun /> : <Moon />}</button>
          </div>
        </header>

        {/* ROUTES */}
        <Routes>
          <Route path="/" element={<Preventivo isDark={isDark} economia={economia} setEconomia={setEconomia} listino={listino} norme={norme} />} />
          <Route path="/impostazioni" element={<Impostazioni isDark={isDark} economia={economia} setEconomia={setEconomia} setListino={setListino} />} />
        </Routes>
      </div>
    </div>
  )
}
