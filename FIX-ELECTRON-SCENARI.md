# Fix Electron - Caricamento Scenari Non Funzionante

**Data**: 16 Febbraio 2026
**Problema**: La versione Electron standalone non caricava gli scenari
**Causa Root**: `fetch()` non funziona con protocollo `file://` in Electron per motivi di sicurezza

---

## ✅ Modifiche Implementate

### 1. Creato Helper Compatibile `fetchFile.js`

**File**: `js/fetchFile.js` (NUOVO)
- Funzione `window.fetchFile()` che funziona sia su browser che Electron
- Usa `fetch()` su browser normale (http/https)
- Usa `XMLHttpRequest` su Electron (file://)
- API compatibile con fetch standard

### 2. Aggiunto Script in `index.html`

**Riga 700**: Caricato `fetchFile.js` PRIMA di tutti gli altri script
```html
<!-- FetchFile Helper - Compatibilità Browser e Electron -->
<script src="js/fetchFile.js?v=1000001"></script>
```

### 3. Sostituito `fetch()` con `fetchFile()` in 7 File

| File | Righe Modificate | Tipo Caricamento |
|------|------------------|------------------|
| `index.html` | 615 | Login (users.txt) |
| `js/ui.js` | 593, 1255, 2259, 4966 | home_config.txt, modelli, tutorial, assembly |
| `js/ui/TutorialManager.js` | 68 | Tutorial |
| `js/core/ToolRegistry.js` | 124 | Tool config |
| `js/ui/ScenarioManager.js` | 65 | Home config |
| `js/core/AssemblyConfigParser.js` | 47 | Assembly config JSON |
| `js/ui/ModelManager.js` | 159 | Modelli 3D |

---

## 🔧 Rebuild Necessario

### Passi per Ricreare l'Eseguibile

1. **Apri Prompt dei Comandi** nella cartella progetto:
   ```
   cd C:\Users\mloffredo\campus_virtual_training
   ```

2. **Esegui Build**:
   ```
   npm run build
   ```
   Oppure doppio click su `build-electron.bat`

3. **Trova Eseguibile**:
   - **Portable**: `dist\Campus Virtual Training-1.0.0-Portable.exe`
   - **Installer**: `dist\Campus Virtual Training Setup 1.0.0.exe`

4. **Testa su PC Pulito**:
   - Copia il file Portable su chiavetta USB
   - Esegui su PC senza Node.js/npm installati
   - Verifica che gli scenari vengano caricati correttamente

---

## 🧪 Test Verifica Fix

### Scenario di Test

1. **Avvia l'applicazione Electron**
2. **Login** con credenziali valide
3. **Verifica Home Page**:
   - ✅ Dovrebbero apparire le card degli scenari
   - ✅ "Manutenzione Elettromandrino"
   - ✅ "Manutenzione pompa del vuoto"
   - ✅ Altri scenari configurati
4. **Seleziona uno scenario** (es. "Manutenzione pompa del vuoto")
5. **Verifica caricamento**:
   - ✅ Modelli 3D caricati
   - ✅ Tutorial caricato
   - ✅ Tool configurati correttamente

### Console DevTools (F12)

Se apri DevTools (F12) dovresti vedere:
```
✅ fetchFile helper caricato (compatibilità Electron)
✅ Campus Virtual Training avviato correttamente
✅ Pagina caricata completamente
[UI] home_config.txt caricato con successo dal server
[ModelManager] Caricamento modelli...
```

**NO errori come**:
- ❌ `Failed to fetch`
- ❌ `NetworkError`
- ❌ `CORS policy`

---

## 🔍 Debugging

Se gli scenari ancora non caricano dopo il rebuild:

### 1. Verifica File Inclusi nel Build

Apri `dist` dopo il build e verifica che esistano:
- `home_config.txt` (nella root)
- `scenes/` (cartella completa con tutti gli scenari)
- `models/` (cartella completa)
- `js/fetchFile.js` (il nuovo helper)

### 2. Controllo Package.json

Verifica che `package.json` includa tutto:
```json
"files": [
  "**/*",
  "!node_modules/**/*",
  "!dist/**/*",
  "!build/**/*"
]
```

### 3. Console Log Elettron

Apri l'app e premi **F12** per aprire DevTools. Nella console cerca:
- Messaggi di errore durante caricamento scenari
- Warning su file non trovati
- Errori XMLHttpRequest

### 4. Test Locale Prima del Build

Prima di rifare il build, testa in modalità dev:
```
npm start
```

Verifica che funzioni correttamente, poi fai il build finale.

---

## 📝 Note Tecniche

### Perché fetch() Non Funziona in Electron?

Electron usa il protocollo `file://` per caricare `index.html` e le risorse locali. Per motivi di sicurezza, `fetch()` ha limitazioni quando usa `file://`:

1. **CORS Policy**: Browser blocca fetch su file:// per prevenire accesso non autorizzato a file locali
2. **Security Sandbox**: Electron isola renderer process, `fetch()` non può accedere a filesystem direttamente
3. **XMLHttpRequest Legacy**: XMLHttpRequest ha meno restrizioni per motivi di backward compatibility

### Perché Non Usare Node.js fs?

Alternative considerate ma scartate:
- **nodeIntegration: true**: Rischio sicurezza, espone Node.js API al renderer
- **Preload Script**: Richiede architettura complessa, overkill per il problema
- **webSecurity: false**: MOLTO rischioso, apre vulnerabilità

**Soluzione scelta**: XMLHttpRequest fallback è il giusto bilanciamento tra compatibilità e sicurezza.

---

## ✅ Checklist Completamento

- [x] Creato `js/fetchFile.js`
- [x] Aggiunto script in `index.html`
- [x] Sostituito fetch in `index.html` (login)
- [x] Sostituito fetch in `js/ui.js` (4 occorrenze)
- [x] Sostituito fetch in `js/ui/TutorialManager.js`
- [x] Sostituito fetch in `js/core/ToolRegistry.js`
- [x] Sostituito fetch in `js/ui/ScenarioManager.js`
- [x] Sostituito fetch in `js/core/AssemblyConfigParser.js`
- [x] Sostituito fetch in `js/ui/ModelManager.js`
- [x] Scaricato `BufferGeometryUtils.js` da Three.js CDN
- [x] Fix Request objects (Three.js passa Request invece di stringa)
- [x] Fix binary file detection con query parameters (`?v=timestamp`)
- [x] Fix blob URL detection (`blob:file:///uuid`)
- [x] Fix logging per evitare crash su file binari
- [ ] **TODO: Rifare build Electron** ⬅️ Prossimo step
- [ ] **TODO: Testare su PC pulito**

---

**Prossimo Step**: Esegui `npm run build` o `build-electron.bat` per ricreare l'eseguibile con il fix applicato.
