```markdown
# BudgetBox

Preventivatore **100% statico** per strutture zootecniche.  
Niente salvataggi locali, niente dipendenze esterne: gira con **HTML/CSS/JS** e legge i dati da semplici **file `.txt`** in `public/documenti/`.

- **Pagina 1 (completata)**: Anagrafica · Struttura · Popolazioni & Stabulazioni  
- **Prossime pagine**: Impianti · Cancelli/Accessori/Catalogo · Riepilogo/Export PDF  
- **UI**: tema chiaro/scuro, badge revisioni (versione+data), logo aziendale, footer brandizzato

---

## 🚀 Pubblicazione con GitHub Pages

1. **Settings → Pages**
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` (o branch corrente), **/ (root)**
2. Apri l’URL pubblico del sito → viene servito **`index.html`** dalla root.

> Repo privata? Apri direttamente `index.html` nel browser (doppio click).

---

## 📁 Struttura cartelle

```

.
├─ assets
│  ├─ css
│  │  └─ app.css                 # Stili (tema chiaro/scuro, layout, badge)
│  └─ js
│     └─ core.js                 # Logica Pagina 1 (carica TXT + calcoli)
├─ public
│  ├─ 404.html
│  └─ documenti                  # <<< TUTTI i DATI stanno qui, in TXT
│     ├─ C-S-A-maggio-2025.txt
│     ├─ euro\_per\_kg\_scale.txt
│     ├─ forme-coperture.txt
│     ├─ ingrasso\_tabella.txt
│     ├─ neve\_vento\_percent.txt
│     ├─ servizi\_fissi.txt
│     ├─ stabulazioni\_opzioni.txt
│     ├─ stabulazioni\_range.txt
│     └─ unitari\_mq.txt
├─ index.html                    # Pagina 1
└─ README.md

```

---

## 🧠 Funzionamento (riassunto)

- `assets/js/core.js` carica **solo** TXT da `public/documenti/` (con fallback a `./public/documenti/` e `/public/documenti/`).
- I menu (Località, Tipo struttura, Forma copertura, Stabulazioni) sono **popolati dai TXT**, non dal codice.
- Calcoli **Struttura**:
  - **Area lorda**, **Copertura in pianta**, **Copertura in falda** (pendenza stimata in base alla *forma* e ai range min/max).
  - **Costo base €/m²** + **Costo acciaio kg/m²** con **€/kg** variabile in base all’**area coperta**.
  - **Extra “Neve & vento”**: percentuale (3–15%) da **carico neve, vento, altitudine, zona sismica** + *bonus/malus* di **forma**.
- **Popolazioni & Stabulazioni**:
  - m²/capo per categorie fisse da **range** (Adeguato/Ottimale).
  - **Ingrasso**: m²/capo tramite **interpolazione** in base al **peso**.

---

## 🗂️ Formati TXT (header obbligatori)

Delimitatore consigliato `;` (sono accettati anche `,` `|` `TAB`). La **prima riga è l’header**.

### 1) `C-S-A-maggio-2025.txt` (località + meteo/sismica)
```

REGIONE;PROV\_CITTA\_METROPOLITANA;SIGLA\_PROV;COMUNE;COD\_ISTAT\_COMUNE;ZONA\_SISMICA;VENTO;CARICO\_NEVE;ALTITUDINE
Veneto;Venezia;VE;Mira;027023;3;25;80;3
...

```
- **Select** mostra: `COMUNE (SIGLA_PROV)`
- **Usati nei calcoli**: `ZONA_SISMICA` (mappa 1–4), `VENTO` (m/s), `CARICO_NEVE` (kg/m²), `ALTITUDINE` (m)
- **Badge meteo** (sopra Località) su **due righe**:
  - `ZONA_SISMICA; VENTO; CARICO_NEVE; ALTITUDINE`
  - `REGIONE; PROV_CITTA_METROPOLITANA; COD_ISTAT_COMUNE`

### 2) `forme-coperture.txt`
```

roof\_type;min\_slope;max\_slope;descrizione
Bifalda / a capanna;10;25;Due falde simmetriche verso il colmo.
Monofalda (shed);8;15;Falda unica inclinata.
Tetto piano;1;3;Quasi orizzontale (drenaggio minimo).
...

```
- ID interni: `bifalda`, `monofalda`, `piano`, `dente_sega`, `cattedrale`.

### 3) `strutture.txt`
```

id;label;forma;prezzoMq;kg\_per\_mq\_base
acciaio\_zincato;Struttura metallica zincata;bifalda;180;34

```

### 4) `euro_per_kg_scale.txt`
```

minArea\_m2;eurPerKg
0;8.0
100;7.0
200;6.5
400;6.0
600;5.5
800;5.0
1000;4.5
1500;3.5
2000;2.9

```

### 5) `unitari_mq.txt` (fallback storici)
```

categoria;mq
bovineAdulte;6.5
manzeBovine;3.8
toriRimonta;9.5
bufaleAdulte;6.0
bufaleParto;7.5
manzeBufaline;3.5

```

### 6) `stabulazioni_opzioni.txt`
```

categoria;opzioni
bovineAdulte;libera\_lettiera,libera\_cuccette,fissa\_posta
manzeBovine;libera\_lettiera,libera\_cuccette,fissa\_posta
toriRimonta;libera\_lettiera,libera\_cuccette,fissa\_posta
bufaleAdulte;libera\_lettiera,libera\_cuccette,fissa\_posta
bufaleParto;libera\_lettiera,libera\_cuccette,fossa\_parto
manzeBufaline;libera\_lettiera,libera\_cuccette,fissa\_posta
ingrasso;libera\_lettiera,grigliato

```

### 7) `stabulazioni_range.txt`
```

categoria;adeguato\_min;adeguato\_max;ottimale\_min
bovineAdulte;6.0;7.0;7.0
manzeBovine;3.5;4.0;4.0
toriRimonta;9.0;10.0;10.0
bufaleAdulte;5.5;6.5;6.5
bufaleParto;7.0;8.0;8.0
manzeBufaline;3.2;3.8;3.8

```

### 8) `ingrasso_tabella.txt` (interpolazione per peso)
```

peso;min;opt
400;3.25;4.25
550;4.25;5.25
700;5.25;6.00

```

### 9) `servizi_fissi.txt`
```

descrizione;um;qta;prezzo;stato;conteggia
Relazione di calcolo strutturale firmata da un tecnico abilitato comprensiva di disegni esecutivi;Nr;1;1950.00;a\_prezzo;true
Direzione lavori per la carpenteria metallica.;—;1;0;inclusa;false
Calcolo plinti di fondazioni e disegni esecutivi;Nr;1;1500.00;a\_prezzo;true
Direzione lavori opere in c.a.;—;1;0;inclusa;false
Prove dei materiali;—;1;0;escluse;false

```

### 10) `neve_vento_percent.txt` (schema % “Neve & vento” = 3–15%)
```

group;key;subkey;value
base;min\_pct;;3
base;max\_pct;;15
weights;neve;;0.34
weights;vento;;0.34
weights;altitudine;;0.20
weights;sismica;;0.10
weights;forma\_bonus;;0.02
scales;neve;max;500
scales;vento;max;50
scales;altitudine;max;2500
sismica;1;;1.0
sismica;2;;0.7
sismica;3;;0.4
sismica;4;;0.2
sismica;default;;0.0
forma\_bonus;bifalda;;0.05
forma\_bonus;monofalda;;0.00
forma\_bonus;piano;;-0.03
forma\_bonus;dente\_sega;;0.04
forma\_bonus;cattedrale;;0.05

```

---

## ✏️ Aggiornare i dati (senza toccare il codice)

1. Vai in `public/documenti/`.
2. **Add file → Create new file** (o modifica i file esistenti).
3. Incolla i contenuti (rispetta **header** e **separatore** `;`).
4. **Commit changes**.
5. **Hard Refresh** in pagina (Ctrl/Cmd + Shift + R).

> Aggiungi nuovi tipi di struttura, stabulazioni, forme o scale **aggiungendo righe** ai TXT.

---

## 🧩 Note UI

- **Header**: logo Grimaldelli (in alto a sinistra), titolo = **nome repository**, badge **Rev** (versione+data), tema 🌙/☀️, Stampa/PDF.
- **Anagrafica**: badge meteo (2 righe) sopra la Località; “Check superficie” mostra stato + percentuale.
- **Struttura**: Tipo, Forma (con **descrizione** e **schizzo**), €/m², kg/m², **Altezza colmo (calcolata)**, campate/passo/lunghezza/larghezza, sporti, quota decubito, note. KPI: aree, costi, **Neve & vento** e **Totale struttura**.
- **Popolazioni**: badge capi diventa **verde** quando `N > 0`.

---

## 🛠️ Troubleshooting

- **Menu a tendina vuoti** → Un TXT non si carica (404 o header errato). L’app mostra un **alert** col **percorso** del file mancante.
- **Stili non aggiornati** → Cache: fai **Hard Refresh** (Ctrl/Cmd + Shift + R).
- **Decimali** → Nei TXT usa il **punto** (`3.5`), non la virgola (`3,5`).
- **Località scartate** → Se manca `COD_ISTAT_COMUNE`, la riga viene ignorata.

---

## ✅ Stato progetto

- [x] Pagina 1 completa (Anagrafica · Struttura · Popolazioni & Stabulazioni)  
- [ ] Pagina 2: Impianti  
- [ ] Pagina 3: Cancelli, Accessori, Catalogo  
- [ ] Pagina 4: Riepilogo + Stampa/Export PDF  
- [ ] Pagina **Impostazioni** (GUI per modificare i TXT)

---

## © Crediti

© **“nome repository”** per **Grimaldelli s.r.l. — Manuel Zago**  
Tema: `assets/css/app.css` · Logica Pagina 1: `assets/js/core.js` (versione visibile nel badge Rev).
```
