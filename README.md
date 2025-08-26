# Preventivi Grimaldelli

Web app React (Vite + Tailwind) per la preventivazione di stalle (capannoni, cancelli, accessori) con check normativi, stampa/PDF e listino separato.

## Requisiti
- Node 18+
- npm

## Avvio
```bash
npm install
npm run dev
```

## Struttura
```
src/
  pages/
    Preventivo.jsx      # pagina principale (calcoli, tabelle, stampa)
    Impostazioni.jsx    # modifica parametri economici + import CSV listino
  data/
    listino.json        # listino (puoi sostituire via CSV da Impostazioni)
    norme.json          # tabelle normative m²/capo
  utils/
    currency.js         # formattazione EUR
    interpIngrasso.js   # interpolazione m²/capo per peso
  App.jsx               # router + header + tema
  main.jsx              # bootstrap React
  index.css             # Tailwind + regole di stampa
tailwind.config.js
postcss.config.js
vite.config.js
package.json
```

## CSV listino (esempio)
```csv
codice,descrizione,um,prezzo
GATE-STD,Cancello zincato standard,pz,320
AUTOCAT,Autocattura,ml,120
LATTONERIA,Lattoneria,m²,18
```

## Stampa / PDF
Usa il pulsante **Stampa / PDF** in header. Il layout è ottimizzato A4 con intestazione logo e riepilogo economico.

## Tema
Toggle chiaro/scuro in header, memorizzato in `localStorage`.

---
*Versione:* v0.1.1
