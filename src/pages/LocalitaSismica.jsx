// src/pages/LocalitaSismica.jsx
import React, { useEffect, useMemo, useState } from "react"

/**
 * Località & Zone sismiche — dataset completo dal file interno al repo.
 * - Nessuna dipendenza esterna: legge /documenti/classificazione-sismica-aggiornata-maggio-2025.txt (CSV con ;)
 * - Indicizza per Comune (normalizzato), Provincia e COD ISTAT
 * - Salva e ricarica da localStorage per velocizzare gli accessi successivi
 * - Esporta JSON per versioning
 *
 * Metti il file qui nel repo (GitHub Pages / Vite):
 *   public/documenti/classificazione-sismica-aggiornata-maggio-2025.txt
 */

- const FILE_PATH = "/documenti/classificazione-sismica-aggiornata-maggio-2025.txt"
+ const FILE_REL_PATH = "documenti/classificazione-sismica-aggiornata-maggio-2025.txt"
+ const FILE_PATH = `${import.meta.env.BASE_URL || "/"}${FILE_REL_PATH}`.replace(/\/\/+/g, "/")
const LS_KEY = "localita_sismica_v1"

export default function LocalitaSismica() {
  const [rawText, setRawText] = useState("")
  const [rows, setRows] = useState([]) // array di record {regione, provincia, sigla_prov, comune, istat, zona}
  const [loading, setLoading] = useState(false)
  const [qComune, setQComune] = useState("")
  const [qProv, setQProv] = useState("")
  const [qIstat, setQIstat] = useState("")

  // Carica da localStorage se presente
  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(LS_KEY) || "null")
      if (cached?.rows?.length) setRows(cached.rows)
    } catch {}
  }, [])

  // Se non abbiamo righe indicizzate, prova a fetchare il file
  async function fetchFile() {
    setLoading(true)
    try {
      const res = await fetch(FILE_PATH, { cache: "no-store" })
      if (!res.ok) throw new Error("Impossibile leggere il file dal percorso: " + FILE_PATH)
      const txt = await res.text()
      setRawText(txt)
      const parsed = parseCsvSemicolon(txt)
      setRows(parsed)
      localStorage.setItem(LS_KEY, JSON.stringify({ rows: parsed, savedAt: new Date().toISOString() }))
    } catch (e) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Upload manuale alternativo (se vuoi sostituire/aggiornare il file senza commit)
  function onUploadFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      const txt = String(reader.result || "")
      setRawText(txt)
      const parsed = parseCsvSemicolon(txt)
      setRows(parsed)
      localStorage.setItem(LS_KEY, JSON.stringify({ rows: parsed, savedAt: new Date().toISOString() }))
    }
    reader.readAsText(f, "utf-8")
  }

  // Filtri veloci
  const filtered = useMemo(() => {
    const c = norm(qComune)
    const p = qProv.trim().toUpperCase()
    const i = qIstat.trim()
    return rows.filter(r => {
      if (c && !norm(r.comune).includes(c)) return false
      if (p && r.sigla_prov !== p) return false
      if (i && r.istat !== i) return false
      return true
    })
  }, [rows, qComune, qProv, qIstat])

  // Province disponibili (per select)
  const province = useMemo(() => {
    const set = new Set(rows.map(r => r.sigla_prov))
    return Array.from(set).sort()
  }, [rows])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-orange-600">Località &amp; Zone sismiche (dataset completo)</h1>
      <p className="text-sm opacity-80">
        Il dataset è caricato dal file interno al repository e memorizzato in locale per l’uso nei preventivi.
        Tutti i valori sono IVA esclusa nel documento di offerta; l’IVA verrà applicata solo nel riepilogo economico finale.
      </p>

      <div className="rounded-2xl border border-orange-300 bg-white p-4 shadow-sm">
        <div className="mb-2 text-lg font-semibold">Sorgente dati (CSV con “;”)</div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <button className="rounded-lg border px-3 py-2 text-sm" onClick={fetchFile} disabled={loading}>
            {loading ? "Caricamento..." : "Carica dal repository"}
          </button>
          <div className="text-xs opacity-70">Percorso atteso: <code>{FILE_PATH}</code></div>
        </div>
        <div className="mt-3 text-sm">
          Oppure aggiorna manualmente:
          <input type="file" accept=".txt,.csv" onChange={onUploadFile} className="ml-2" />
        </div>
        <div className="mt-3 text-xs opacity-70">
          Campi riconosciuti: REGIONE; PROV_CITTA_METROPOLITANA; SIGLA_PROV; COMUNE; COD_ISTAT_COMUNE; ZONA_SISMICA
        </div>
      </div>

      <div className="rounded-2xl border border-orange-300 bg-white p-4 shadow-sm">
        <div className="mb-2 text-lg font-semibold">Ricerca</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="text-xs opacity-70">Comune</label>
            <input
              value={qComune}
              onChange={e => setQComune(e.target.value)}
              className="mt-1 w-full rounded-lg border p-2"
              placeholder="es. Pinerolo"
            />
          </div>
          <div>
            <label className="text-xs opacity-70">Provincia</label>
            <select value={qProv} onChange={e => setQProv(e.target.value)} className="mt-1 w-full rounded-lg border p-2">
              <option value="">Tutte</option>
              {province.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs opacity-70">Cod. ISTAT</label>
            <input
              value={qIstat}
              onChange={e => setQIstat(e.target.value)}
              className="mt-1 w-full rounded-lg border p-2"
              placeholder="es. 15146"
            />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-sm">
          <div className="opacity-70">Record: <b>{filtered.length}</b> / {rows.length || "0"}</div>
          <div className="flex items-center gap-2">
            <button className="rounded-lg border px-3 py-1 text-sm" onClick={() => exportJson(rows)}>Esporta JSON (tutto)</button>
            <button className="rounded-lg border px-3 py-1 text-sm" onClick={() => exportJson(filtered)}>Esporta JSON (filtrato)</button>
            <button className="rounded-lg border px-3 py-1 text-sm" onClick={() => { localStorage.removeItem(LS_KEY); alert("Cache locale svuotata") }}>
              Svuota cache
            </button>
          </div>
        </div>

        <div className="mt-3 max-h-[60vh] overflow-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b text-left text-xs opacity-80">
                <th className="p-2">Regione</th>
                <th className="p-2">Provincia</th>
                <th className="p-2">Sigla</th>
                <th className="p-2">Comune</th>
                <th className="p-2">ISTAT</th>
                <th className="p-2">Zona sismica</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => (
                <tr key={idx} className="border-b hover:bg-orange-50/40">
                  <td className="p-2">{r.regione}</td>
                  <td className="p-2">{r.provincia}</td>
                  <td className="p-2 font-mono">{r.sigla_prov}</td>
                  <td className="p-2">{r.comune}</td>
                  <td className="p-2 font-mono">{r.istat}</td>
                  <td className="p-2 font-mono">{r.zona}</td>
                  <td className="p-2">
                    <button
                      className="rounded-md border px-2 py-1 text-xs"
                      onClick={() => useInAnagrafica(r)}
                      title="Usa questa località in Anagrafica preventivo"
                    >
                      Usa in Anagrafica
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td className="p-4 text-center text-sm opacity-60" colSpan={7}>Nessun risultato</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SuggerimentiBox />
    </div>
  )
}

// ————— Helpers ——————————————————————————————————————————————————————————————

function SuggerimentiBox() {
  return (
    <div className="rounded-2xl border border-orange-300 bg-white p-4 text-sm opacity-80">
      <div className="mb-1 font-semibold">Suggerimenti</div>
      <ul className="list-disc pl-5">
        <li>Per aggiornare il dataset senza deploy, usa l’upload manuale: i dati restano salvati in locale.</li>
        <li>“Usa in Anagrafica” salva la località corrente in <code>localStorage.anagrafica_localita</code>.</li>
        <li>La pagina Struttura leggerà questa anagrafica per stimare neve/vento/sismica.</li>
      </ul>
    </div>
  )
}

function parseCsvSemicolon(txt) {
  // Gestione robusta: righe, separatore ;, preserva valori con virgole
  const lines = txt.split(/\r?\n/).filter(Boolean)
  if (lines.length === 0) return []
  // Rileva header (case-insensitive, separatore ;)
  const header = lines[0].split(";").map(s => s.trim().toUpperCase())
  const hasHeader = header.includes("REGIONE") && header.includes("COMUNE")
  const startIdx = hasHeader ? 1 : 0

  const out = []
  for (let i = startIdx; i < lines.length; i++) {
    const cells = safeSplitSemicolon(lines[i])
    if (cells.length < 6) continue
    const [regione, provincia, sigla_prov, comune, istat, zona] = cells.map(s => s.trim())
    if (!comune) continue
    out.push({
      regione,
      provincia,
      sigla_prov: sigla_prov.toUpperCase(),
      comune,
      istat,
      zona
    })
  }
  return out
}

function safeSplitSemicolon(line) {
  // Split su ; ignorando ; dentro eventuali doppi apici
  const out = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      // toggle quote (gestione "" come escape)
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; continue }
      inQuotes = !inQuotes
      continue
    }
    if (ch === ";" && !inQuotes) { out.push(cur); cur = ""; continue }
    cur += ch
  }
  out.push(cur)
  return out
}

function norm(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // rimuove accenti
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function exportJson(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "localita_sismica.json"
  a.click()
  URL.revokeObjectURL(url)
}

function useInAnagrafica(r) {
  const payload = {
    comune: r.comune,
    provincia: r.provincia,
    sigla_prov: r.sigla_prov,
    istat: r.istat,
    zona_sismica: r.zona
  }
  localStorage.setItem("anagrafica_localita", JSON.stringify(payload))
  navigator.clipboard?.writeText(`${r.comune} (${r.sigla_prov}) — ISTAT ${r.istat} — Zona ${r.zona}`)
  alert("Località impostata in Anagrafica preventivo.")
}
