// src/pages/Anagrafica.jsx
import React, { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

/**
 * Anagrafica + Località (menu a tendina da file completo sismica)
 * - Legge: public/documenti/classificazione-sismica-aggiornata-maggio-2025.txt (CSV ';')
 * - Nessun salvataggio su localStorage: salvi/apri su FILE (.preventivo.json)
 * - Passa i dati alla pagina successiva con navigate(..., { state }) (niente storage persistente automatico)
 *
 * Percorso file (con base Vite/GitHub Pages):
 *   ${import.meta.env.BASE_URL}documenti/classificazione-sismica-aggiornata-maggio-2025.txt
 */

const FILE_REL_PATH = "documenti/classificazione-sismica-aggiornata-maggio-2025.txt"
const FILE_PATH = `${import.meta.env.BASE_URL || "/"}${FILE_REL_PATH}`.replace(/\/\/+/g, "/")

export default function Anagrafica() {
  const nav = useNavigate()

  // --- stato anagrafica ---
  const [cliente, setCliente] = useState("")
  const [riferimento, setRiferimento] = useState("")
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10))
  const [altitudine, setAltitudine] = useState("") // m s.l.m. (editabile)
  const [provSel, setProvSel] = useState("")       // sigla provincia
  const [comuneSel, setComuneSel] = useState("")   // nome comune (visual)
  const [istatSel, setIstatSel] = useState("")     // cod ISTAT
  const [zonaSismica, setZonaSismica] = useState("") // zona sismica letta dal file

  // --- dataset località (dal file del repo) ---
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([]) // {regione, provincia, sigla_prov, comune, istat, zona}

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const res = await fetch(FILE_PATH, { cache: "no-store" })
        if (!res.ok) throw new Error(`Impossibile leggere il file: ${FILE_PATH}`)
        const txt = await res.text()
        const parsed = parseCsvSemicolon(txt)
        if (alive) setRows(parsed)
      } catch (e) {
        alert(e.message)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  // elenco province e comuni filtrati
  const province = useMemo(() => {
    const s = new Set(rows.map(r => r.sigla_prov))
    return Array.from(s).sort()
  }, [rows])

  const comuniFiltrati = useMemo(() => {
    const base = provSel ? rows.filter(r => r.sigla_prov === provSel) : rows
    return base.sort((a, b) => a.comune.localeCompare(b.comune, "it"))
  }, [rows, provSel])

  // quando scelgo un comune, imposto istat e zona
  function onSelectComune(istat) {
    const rec = rows.find(r => r.istat === istat)
    if (!rec) return
    setComuneSel(rec.comune)
    setIstatSel(rec.istat)
    setProvSel(rec.sigla_prov)
    setZonaSismica(rec.zona)
  }

  // --- NAV: avanti (passa lo state alla pagina Struttura) ---
  function avanti() {
    if (!cliente.trim()) return alert("Inserisci il Cliente")
    if (!comuneSel) return alert("Seleziona la Località (Comune)")
    const anagrafica = {
      cliente, riferimento, data,
      localita: {
        comune: comuneSel,
        sigla_prov: provSel,
        istat: istatSel,
        zona_sismica: zonaSismica,
        altitudine_m: Number(altitudine || 0)
      }
    }
    // passa lo stato alla pagina successiva (senza storage)
    nav("/struttura", { state: { anagrafica } })
  }

  // --- SALVA/APRI su FILE (senza localStorage) ---
  async function salvaSuFile() {
    const payload = buildPreventivoSnapshot({
      cliente, riferimento, data, comuneSel, provSel, istatSel, zonaSismica, altitudine
    })
    try {
      if ("showSaveFilePicker" in window) {
        const handle = await window.showSaveFilePicker({
          suggestedName: suggerisciNomeFile(cliente),
          types: [{ description: "Preventivo", accept: { "application/json": [".preventivo.json"] } }]
        })
        const writable = await handle.createWritable()
        await writable.write(JSON.stringify(payload, null, 2))
        await writable.close()
        alert("Salvato su file ✔️")
      } else {
        // fallback: download
        downloadJson(payload, suggerisciNomeFile(cliente))
      }
    } catch (e) {
      if (e?.name !== "AbortError") alert("Salvataggio annullato o non riuscito")
    }
  }

  async function apriDaFile(e) {
    try {
      const file = e.target.files?.[0]
      if (!file) return
      const text = await file.text()
      const data = JSON.parse(text)
      // applica
      setCliente(data?.anagrafica?.cliente || "")
      setRiferimento(data?.anagrafica?.riferimento || "")
      setData(data?.anagrafica?.data || new Date().toISOString().slice(0, 10))
      const loc = data?.anagrafica?.localita || {}
      setComuneSel(loc.comune || "")
      setProvSel(loc.sigla_prov || "")
      setIstatSel(loc.istat || "")
      setZonaSismica(loc.zona_sismica || "")
      setAltitudine(loc.altitudine_m ?? "")
      alert("Preventivo caricato ✔️")
      e.target.value = ""
    } catch {
      alert("File non valido")
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-orange-600">Anagrafica &amp; Località</h1>
      <p className="text-sm opacity-80">
        Compila i dati del cliente e seleziona la <b>Località</b> dal dataset interno. Tutte le voci sono <b>IVA esclusa</b>;
        l’IVA sarà applicata solo nel riepilogo economico finale.
      </p>

      {/* ANAGRAFICA */}
      <section className="rounded-2xl border border-orange-300 bg-white p-4 shadow-sm">
        <div className="mb-3 text-lg font-semibold">Anagrafica</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs opacity-70">Cliente</span>
            <input className="rounded-xl border p-2" value={cliente} onChange={e => setCliente(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs opacity-70">Riferimento</span>
            <input className="rounded-xl border p-2" value={riferimento} onChange={e => setRiferimento(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs opacity-70">Data</span>
            <input type="date" className="rounded-xl border p-2" value={data} onChange={e => setData(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs opacity-70">Altitudine (m s.l.m.)</span>
            <input type="number" className="rounded-xl border p-2" value={altitudine} onChange={e => setAltitudine(e.target.value)} placeholder="es. 120" />
          </label>
        </div>
      </section>

      {/* LOCALITÀ */}
      <section className="rounded-2xl border border-orange-300 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-semibold">Località (da elenco completo)</div>
          <div className="text-xs opacity-70">
            Sorgente: <code>{FILE_REL_PATH}</code> {loading ? " — Caricamento…" : ""}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs opacity-70">Provincia (sigla)</span>
            <select className="rounded-xl border p-2" value={provSel} onChange={e => setProvSel(e.target.value)}>
              <option value="">Tutte</option>
              {province.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-xs opacity-70">Comune</span>
            <select
              className="rounded-xl border p-2"
              value={istatSel}
              onChange={e => onSelectComune(e.target.value)}
            >
              <option value="">{provSel ? `Seleziona un comune (${provSel})` : "Seleziona un comune"}</option>
              {comuniFiltrati.map(r => (
                <option key={r.istat} value={r.istat}>
                  {r.comune} ({r.sigla_prov}) — ISTAT {r.istat}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3 text-sm">
          <div className="rounded-lg border p-2">
            <div className="opacity-70 text-xs">Comune</div>
            <div className="font-medium">{comuneSel || "—"}</div>
          </div>
          <div className="rounded-lg border p-2">
            <div className="opacity-70 text-xs">ISTAT</div>
            <div className="font-mono">{istatSel || "—"}</div>
          </div>
          <div className="rounded-lg border p-2">
            <div className="opacity-70 text-xs">Zona sismica</div>
            <div className="font-mono">{zonaSismica || "—"}</div>
          </div>
        </div>
      </section>

      {/* AZIONI */}
      <section className="rounded-2xl border border-orange-300 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm opacity-80">Puoi salvare/aprire un file locale del preventivo (niente localStorage).</div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-lg border px-3 py-2 text-sm" onClick={salvaSuFile}>Salva su file</button>
            <label className="rounded-lg border px-3 py-2 text-sm cursor-pointer">
              Apri da file
              <input type="file" accept=".json" onChange={apriDaFile} className="hidden" />
            </label>
            <button className="rounded-lg border px-3 py-2 text-sm bg-black text-white" onClick={avanti}>Continua → Struttura</button>
          </div>
        </div>
      </section>
    </div>
  )
}

// ——— helper parsing CSV ; ————————————————————————————————————————

function parseCsvSemicolon(txt) {
  const lines = txt.split(/\r?\n/).filter(Boolean)
  if (!lines.length) return []
  const header = lines[0].split(";").map(s => s.trim().toUpperCase())
  const startIdx = (header.includes("REGIONE") && header.includes("COMUNE")) ? 1 : 0
  const out = []
  for (let i = startIdx; i < lines.length; i++) {
    const cells = safeSplitSemicolon(lines[i]).map(s => s.trim())
    if (cells.length < 6) continue
    const [regione, provincia, sigla_prov, comune, istat, zona] = cells
    if (!comune) continue
    out.push({
      regione,
      provincia,
      sigla_prov: (sigla_prov || "").toUpperCase(),
      comune,
      istat,
      zona
    })
  }
  return out
}

function safeSplitSemicolon(line) {
  const out = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
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

// ——— helper salvataggio file ——————————————————————————————————————

function buildPreventivoSnapshot({ cliente, riferimento, data, comuneSel, provSel, istatSel, zonaSismica, altitudine }) {
  return {
    versione: 1,
    anagrafica: {
      cliente: cliente || "",
      riferimento: riferimento || "",
      data: data || new Date().toISOString().slice(0, 10),
      localita: {
        comune: comuneSel || "",
        sigla_prov: provSel || "",
        istat: istatSel || "",
        zona_sismica: zonaSismica || "",
        altitudine_m: Number(altitudine || 0)
      }
    }
  }
}

function suggerisciNomeFile(cliente) {
  const clean = (cliente || "preventivo").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
  return `${clean || "preventivo"}.preventivo.json`
}

function downloadJson(obj, name = "preventivo.json") {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url; a.download = name; a.click()
  URL.revokeObjectURL(url)
}
