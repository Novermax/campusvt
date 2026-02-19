# Campus Virtual Training - Distribuzione Electron

## 🎯 Obiettivo

Creare un pacchetto standalone `.exe` dell'applicazione che funzioni offline su qualsiasi PC Windows **senza installare dipendenze**.

---

## 📋 Prerequisiti (SOLO su PC di sviluppo)

Sul PC dove fai il build serve:

1. **Node.js** (versione 18 o superiore)
   - Scarica da: https://nodejs.org/
   - Durante installazione, seleziona "Add to PATH"
   - Verifica con: `node --version`

**IMPORTANTE**: Node.js serve SOLO per creare il pacchetto. Sul PC target (con schermo touch) NON serve installare nulla!

---

## 🚀 Procedura Completa

### Metodo Semplice (Raccomandato)

1. **Doppio click** su `build-electron.bat`
2. Attendi il completamento (3-5 minuti la prima volta)
3. Trova il file `.exe` nella cartella `dist\`

### Metodo Manuale (da terminale)

```bash
# 1. Installa dipendenze (solo la prima volta)
npm install

# 2. Build (genera pacchetto)
npm run build

# 3. Trova il file in dist\
```

---

## 📦 Tipi di Pacchetto Generati

Il build crea DUE versioni:

### 1️⃣ **Portable (Raccomandato per te)** ⭐
```
Campus Virtual Training-1.0.0-Portable.exe
```
- ✅ **Singolo file .exe** (~150-180 MB)
- ✅ **Zero installazione** richiesta
- ✅ **Doppio click** → parte subito
- ✅ **Perfetto per PC touch offline**

### 2️⃣ Installer NSIS
```
Campus Virtual Training-1.0.0.exe
```
- Installer classico Windows
- Richiede installazione guidata
- Crea shortcut desktop/menu start

---

## 🖥️ Distribuzione sul PC Target (Touch)

1. **Copia** il file `Campus Virtual Training-X.X.X-Portable.exe` su chiavetta USB
2. **Trasferisci** sul PC target
3. **Doppio click** → app parte in fullscreen
4. **Enjoy!** 🎉

### Shortcut Tastiera Utili

- **F11** - Toggle fullscreen
- **ESC** - Esci da fullscreen
- **F12** - Apri DevTools (debug)

---

## 🧪 Test Prima del Build

Vuoi testare l'app in Electron prima di creare il pacchetto?

1. **Doppio click** su `run-electron-dev.bat`
2. L'app si apre in modalità sviluppo
3. Testa tutte le funzionalità
4. Chiudi finestra quando finito

Oppure da terminale:
```bash
npm start
```

---

## 🎨 Personalizzare l'Icona

L'icona di default è quella di Electron. Per personalizzarla:

1. Crea un'icona **icon.ico** (256x256 o maggiore)
2. Metti il file in `build\icon.ico`
3. Ri-lancia il build

**Tool per creare .ico:**
- https://icoconvert.com/ (online)
- GIMP (desktop)
- IcoFX (desktop)

---

## 📁 Struttura File Aggiunti

```
campus_virtual_training/
├── package.json              ← Config npm/Electron
├── electron-main.js          ← Entry point Electron
├── build-electron.bat        ← Script build (doppio click)
├── run-electron-dev.bat      ← Script test sviluppo
├── .gitignore                ← Ignora node_modules/dist
├── build/
│   ├── icon.ico              ← Icona app (da creare)
│   └── README.md             ← Istruzioni icona
└── dist/                     ← Output build (creata automaticamente)
    ├── Campus Virtual Training-1.0.0-Portable.exe  ← FILE DA DISTRIBUIRE ⭐
    └── Campus Virtual Training-1.0.0.exe           ← Installer alternativo
```

---

## 🔧 Comandi npm Disponibili

```bash
npm start                # Avvia in modalità sviluppo
npm run build            # Build NSIS + Portable (x64)
npm run build-portable   # Build solo Portable
npm run build-all        # Build x64 + x86 (32-bit)
```

---

## ❓ Troubleshooting

### ❌ "Node.js non trovato"
- Installa Node.js da https://nodejs.org/
- Riavvia il terminale/PC
- Verifica con `node --version`

### ❌ "npm install fallito"
- Controlla connessione internet
- Prova con diritti amministratore
- Cancella `node_modules\` e riprova

### ❌ "Build fallito"
- Controlla che tutti i file sorgenti siano presenti
- Verifica spazio disco (serve ~500MB liberi)
- Controlla log per errori specifici

### ❌ App non parte sul PC target
- Verifica che sia Windows 10/11
- Controlla antivirus (potrebbe bloccare .exe non firmato)
- Prova a eseguire come amministratore

### ⚠️ Icona non appare
- Verifica che `build\icon.ico` esista
- Controlla che il file sia un .ico valido
- Ri-lancia il build dopo aver aggiunto l'icona

---

## 🌟 Vantaggi Electron per il Tuo Caso

✅ **Offline totale** - Nessuna connessione internet richiesta
✅ **Zero installazioni** - Portable .exe autocontenuto
✅ **Touch nativo** - Chromium supporta perfettamente il TouchSystem
✅ **WebGL performante** - Three.js funziona perfettamente
✅ **Facile aggiornamento** - Sostituisci .exe con nuova versione
✅ **Cross-platform** - Stesso codice funziona su Windows/Mac/Linux

---

## 🔄 Processo Completo Riepilogato

```
1. SVILUPPO (questo PC)
   └─ Doppio click: build-electron.bat

2. BUILD (~5 min)
   └─ Genera: dist\Campus Virtual Training-1.0.0-Portable.exe

3. DISTRIBUZIONE (USB)
   └─ Copia .exe su chiavetta

4. INSTALLAZIONE (PC target)
   └─ Incolla .exe sul desktop
   └─ Doppio click → app parte!
```

---

## 📞 Supporto

Per problemi con Electron o il processo di build:
- Documentazione Electron: https://www.electronjs.org/docs/latest
- electron-builder: https://www.electron.build/

---

**Buon build! 🚀**
