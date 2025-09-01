// assets/js/state.js
const STORAGE_KEY = "preventivo_v1";

// Stato iniziale
const defaultState = {
  anagrafica: { cliente: "", localita: "", riferimento: "", data: new Date().toISOString().slice(0,10) },
  capannone: { lunghezza: 60, larghezza: 25, prezzoMq: 180, quotaDecubito: 70, note: "Struttura metallica zincata, copertura sandwich 40 mm" },
  popolazioni: {
    bovineAdulte: { n: 0, stab: "lettiera" },
    manzeBovine: { n: 0, stab: "lettiera" },
    toriRimonta: { n: 0, stab: "libera" },
    bufaleAdulte: { n: 0, stab: "lettiera" },
    bufaleParto: { n: 0, stab: "lettiera" },
    manzeBufaline: { n: 0, stab: "lettiera" },
    ingrasso: { gruppi: 0, capiPerGruppo: 0, peso: 550, livello: "Adeguato" }
  }
};

export async function loadDataset() {
  const res = await fetch("./assets/data/norme.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Impossibile caricare norme.json");
  return res.json();
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaultState, ...JSON.parse(raw) } : structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
}
export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// --- Calcoli ---
export function areaLorda(state) {
  const { lunghezza, larghezza } = state.capannone;
  return num(lunghezza) * num(larghezza);
}
export function areaDecubitoReale(state) {
  return areaLorda(state) * num(state.capannone.quotaDecubito) / 100;
}
export function areaNormativaRichiesta(state, norme) {
  const u = norme.unitari_mq;
  const p = state.popolazioni;

  const base =
    num(p.bovineAdulte.n) * u.bovineAdulte +
    num(p.manzeBovine.n)   * u.manzeBovine +
    num(p.toriRimonta.n)   * u.toriRimonta +
    num(p.bufaleAdulte.n)  * u.bufaleAdulte +
    num(p.bufaleParto.n)   * u.bufaleParto +
    num(p.manzeBufaline.n) * u.manzeBufaline;

  const nIngrasso = num(p.ingrasso.gruppi) * num(p.ingrasso.capiPerGruppo);
  const mqIngrasso = nIngrasso * ingrassoMqPerCapo(num(p.ingrasso.peso), norme);
  return base + mqIngrasso;
}

function ingrassoMqPerCapo(peso, norme) {
  for (const r of norme.ingrasso.mq_per_capo) {
    if (peso <= r.maxPesoKg) return r.mq;
  }
  return norme.ingrasso.mq_per_capo.at(-1).mq;
}

export function costoStruttura(state) {
  return areaLorda(state) * num(state.capannone.prezzoMq);
}

export function conformita(state, norme) {
  const req = areaNormativaRichiesta(state, norme);
  const real = areaDecubitoReale(state);
  if (req === 0 && real === 0) return { stato: "—", ratio: 1 };
  const ratio = req > 0 ? real / req : 0;
  const stato = ratio >= 1.1 ? "Adeguato" : (ratio >= 1.0 ? "Conforme" : "Non conforme");
  return { stato, ratio };
}

export const num = (v) => Number(v || 0);
export const fmt1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
