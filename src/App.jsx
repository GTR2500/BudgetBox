// src/App.jsx
import React, { useEffect, useState } from "react"
import { NavLink, Routes, Route, useLocation, Navigate } from "react-router-dom"

import Anagrafica from "./pages/Anagrafica.jsx"
import Struttura from "./pages/Struttura.jsx"
import Riepilogo from "./pages/Riepilogo.jsx"
import DatiNeveVento from "./pages/DatiNeveVento.jsx"
import LocalitaSismica from "./pages/LocalitaSismica.jsx"
import Impostazioni from "./pages/Impostazioni.jsx"   // 👈 NEW

export default function App() {
  const [theme, setTheme] = useState(getInitialTheme())
  const location = useLocation()

  useEffect(() => {
    const root = document.documentElement
    if (theme === "dark") root.classList.add("dark")
    else root.classList.remove("dark")
    localStorage.setItem("theme", theme)
  }, [theme])

  useEffect(() => {}, [location.pathname])

  const REV = "v0.3"
  const DATA_REV = "26/08/2025"

  return (
    <div className="min-h-screen bg-gray-50 text-slate-800 dark:bg-slate-900 dark:text-slate-100">
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-orange-300 bg-white/80 backdrop-blur print:hidden dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-2">
          {/* logo + home */}
          <div className="flex items-center gap-2">
            <a href="#" className="inline-flex items-center">
              <img
                src="https://www.glcgrimaldelli.com/wp-content/uploads/2019/06/Logo-Sottopagine.jpg"
                alt="GLC Grimaldelli"
                style={{ height: 48 }}
                className="select-none"
              />
            </a>
          </div>

          {/* titolo centrale */}
          <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 text-lg font-bold text-orange-600 md:text-xl">
            Preventivi Grimaldelli
          </div>

          {/* badge revisione + toggle tema */}
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-orange-300 px-2 py-1 text-xs text-orange-700 dark:text-orange-300">
              Ultima revisione {DATA_REV} — {REV}
            </span>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={theme === "dark" ? "Tema chiaro" : "Tema scuro"}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-orange-300 hover:bg-orange-50 dark:hover:bg-slate-800"
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>

        {/* NAV */}
        <nav className="mx-auto max-w-6xl px-3 pb-2">
          <ul className="flex flex-wrap gap-2">
            <Item to="/">Anagrafica</Item>
            <Item to="/struttura">Struttura</Item>
            <Item to="/riepilogo">Riepilogo / Stampa</Item>
            <Item to="/impostazioni">Impostazioni</Item>            {/* 👈 NEW */}
            <Item to="/dati/localita">Dati Località (sismica)</Item>
            <Item to="/dati/neve-vento">Dati Neve &amp; Vento</Item>
          </ul>
        </nav>
      </header>

      {/* CONTENUTO */}
      <main className="mx-auto max-w-6xl px-3 py-4 print:px-0">
        <Routes>
          <Route path="/" element={<Anagrafica />} />
          <Route path="/struttura" element={<Struttura />} />
          <Route path="/riepilogo" element={<Riepilogo />} />
          <Route path="/impostazioni" element={<Impostazioni />} />  {/* 👈 NEW */}
          <Route path="/dati/localita" element={<LocalitaSismica />} />
          <Route path="/dati/neve-vento" element={<DatiNeveVento />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

/* ———— componenti UI ———— */

function Item({ to, children }) {
  return (
    <li>
      <NavLink
        to={to}
        className={({ isActive }) =>
          `inline-flex items-center rounded-full border px-3 py-1 text-sm transition ${
            isActive
              ? "border-orange-500 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-200"
              : "border-orange-300 hover:bg-orange-50 dark:hover:bg-slate-800"
          }`
        }
      >
        {children}
      </NavLink>
    </li>
  )
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4M17.6 17.6 19 19M5 19l1.4-1.4M17.6 6.4 19 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
        stroke="currentColor" strokeWidth="2" fill="none"
      />
    </svg>
  )
}

/* ———— helpers ———— */

function getInitialTheme() {
  const saved = localStorage.getItem("theme")
  if (saved === "dark" || saved === "light") return saved
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches
  return prefersDark ? "dark" : "light"
}
