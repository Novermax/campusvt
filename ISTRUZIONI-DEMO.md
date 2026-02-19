# 🎯 Istruzioni per Demo su PC Touch

## ⚠️ PROBLEMA ATTUALE
Se stai aprendo `index.html` direttamente da chiavetta, l'app si blocca su "Caricamento scenari" a causa delle restrizioni CORS del browser.

## ✅ SOLUZIONE: Usa Electron Portable

---

## 🚀 Procedura Rapida (5 minuti)

### STEP 1: Build Electron (sul tuo PC)

1. **Doppio click** su: `check-setup.bat`
   - Verifica che Node.js sia installato
   - Se manca, installa da: https://nodejs.org/

2. **Doppio click** su: `build-electron.bat`
   - Attendi 3-5 minuti
   - Il build crea il file `.exe` portatile

3. **Trova il file** in:
   ```
   dist\Campus Virtual Training-1.0.0-Portable.exe
   ```
   Dimensione: ~150-180 MB

### STEP 2: Distribuzione su Chiavetta USB

1. **Copia sulla chiavetta**:
   - `Campus Virtual Training-1.0.0-Portable.exe` ⭐
   - Cartella `scenes\` (con tutti gli scenari)
   - Cartella `models\` (con tutti i modelli 3D)
   - Cartella `menuimages\` (con le immagini card)
   - Cartella `media\` (se presente, con video)
   - File `home_config.txt`

2. **Struttura chiavetta**:
   ```
   USB:\
   ├── Campus Virtual Training-1.0.0-Portable.exe  ⭐
   ├── home_config.txt
   ├── scenes\
   │   ├── Manutenzione_Elettromandrino\
   │   └── Pompa_Becker\
   ├── models\
   │   ├── pulpito.glb
   │   ├── a500.glb
   │   └── ...
   ├── menuimages\
   │   ├── 1.png
   │   └── pompavuoto.png
   └── media\
       └── (video tutorial)
   ```

### STEP 3: Demo sul PC Touch

1. **Inserisci chiavetta** sul PC demo
2. **Doppio click** su: `Campus Virtual Training-1.0.0-Portable.exe`
3. **L'app parte in fullscreen** 🎉
4. **Login** e seleziona scenario

### 🎮 Shortcut Tastiera

- **F11** - Toggle fullscreen
- **ESC** - Esci da fullscreen
- **F12** - DevTools (solo se necessario debug)

---

## 🔧 Opzione Alternativa: Server HTTP Portatile

Se non puoi usare Electron, usa un server HTTP portatile.

### Metodo Python (se già installato)

Crea file `START-SERVER.bat` nella root della chiavetta:

```batch
@echo off
echo ========================================
echo  CAMPUS VIRTUAL TRAINING - SERVER
echo ========================================
echo.
echo Server in avvio su http://localhost:8000
echo.
echo Premi CTRL+C per fermare il server
echo ========================================
echo.

start http://localhost:8000
python -m http.server 8000
pause
```

Poi:
1. Doppio click su `START-SERVER.bat`
2. Il browser si apre automaticamente su `localhost:8000`

### Metodo Node.js (se già installato)

Crea file `START-SERVER.bat`:

```batch
@echo off
echo ========================================
echo  CAMPUS VIRTUAL TRAINING - SERVER
echo ========================================
echo.
echo Server in avvio su http://localhost:8000
echo.
echo Premi CTRL+C per fermare il server
echo ========================================
echo.

start http://localhost:8000
npx http-server -p 8000 -c-1
pause
```

---

## ❌ NON Raccomandato: Browser con Flag CORS

**Solo per test rapidi**, mai per produzione:

**Chrome**:
```batch
chrome.exe --allow-file-access-from-files --disable-web-security --user-data-dir="%TEMP%\chrome-temp"
```

**Edge**:
```batch
msedge.exe --allow-file-access-from-files --disable-web-security --user-data-dir="%TEMP%\edge-temp"
```

⚠️ **IMPORTANTE**: Questo è **insicuro** e va usato solo per test locali.

---

## 🐛 Troubleshooting

### ❌ "Node.js non trovato"
- Installa Node.js da: https://nodejs.org/
- Riavvia PC
- Rilancia `check-setup.bat`

### ❌ "Build fallito"
- Controlla spazio disco (serve ~500MB)
- Verifica connessione internet (serve per scaricare dipendenze)
- Controlla log errori nel terminale

### ❌ ".exe non parte sul PC demo"
- Verifica Windows 10/11
- Esegui come amministratore
- Disabilita temporaneamente antivirus (potrebbe bloccare .exe non firmato)

### ❌ "Modelli 3D non si caricano"
- Verifica che cartelle `scenes\` e `models\` siano sulla chiavetta
- Controlla che i percorsi in `home_config.txt` siano relativi (es. `models/pulpito.glb`)

---

## 📊 Confronto Soluzioni

| Metodo | Facilità | Velocità | Sicurezza | Touch |
|--------|----------|----------|-----------|-------|
| **Electron Portable** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Server HTTP | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Browser Flags | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐ |

---

## 🌟 Vantaggi Electron Portable

✅ **Zero installazioni** - PC demo non serve nulla installato
✅ **Offline totale** - nessuna connessione internet richiesta
✅ **Touch nativo** - supporto perfetto per schermi touch
✅ **WebGL performante** - Three.js funziona perfettamente
✅ **Sicuro** - nessun flag pericoloso del browser
✅ **Professionale** - app autonoma, non "pagina web"

---

**Buona demo! 🚀**
