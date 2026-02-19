# 🚀 Guida: Versione Offline per PC Demo Senza Internet

## 🎯 Problema Identificato

L'app si blocca su "Caricamento scenari" perché carica librerie JavaScript da internet:
- **Three.js** da `unpkg.com`
- **Tween.js** da `cdnjs.cloudflare.com`

**Soluzione**: Scaricare le librerie localmente e modificare l'app per usarle offline.

---

## ✅ Procedura Completa (5 minuti)

### STEP 1: Converti a Versione Offline (sul tuo PC CON internet)

1. **Doppio click** su: `CONVERTI-OFFLINE-FACILE.bat`

2. Lo script farà automaticamente:
   - ✅ Scarica Three.js (~2 MB)
   - ✅ Scarica Tween.js (~50 KB)
   - ✅ Scarica 4 loaders Three.js (OBJ, MTL, STL, GLTF)
   - ✅ Crea cartella `libs\` con tutti i file
   - ✅ Modifica `index.html` per usare file locali
   - ✅ Crea backup `index.html.backup`

3. Attendi completamento (1-2 minuti)

### STEP 2: Rebuild Electron Portable

1. **Doppio click** su: `build-electron.bat`

2. Attendi completamento (~3-5 minuti)

3. Trova il nuovo `.exe` in: `dist\Campus Virtual Training-1.0.0-Portable.exe`

### STEP 3: Prepara Chiavetta USB

**Copia sulla chiavetta**:

```
USB:\CampusVirtual\
├── Campus Virtual Training-1.0.0-Portable.exe  ⭐ (nuovo, offline)
├── libs\                                        ⭐ (NUOVA cartella - CRITICA!)
│   ├── three.module.js
│   ├── tween.umd.js
│   └── three-addons\
│       └── loaders\
│           ├── OBJLoader.js
│           ├── MTLLoader.js
│           ├── STLLoader.js
│           └── GLTFLoader.js
├── home_config.txt
├── index.html                                   (modificato)
├── js\
├── css\
├── scenes\
├── models\
└── menuimages\
```

**⚠️ IMPORTANTE**: La cartella `libs\` è **OBBLIGATORIA**! Senza quella l'app non funziona.

### STEP 4: Test sul PC Demo (SENZA internet)

1. Inserisci chiavetta sul PC demo
2. **Doppio click** su: `Campus Virtual Training-1.0.0-Portable.exe`
3. L'app dovrebbe partire normalmente ✅
4. Login e seleziona scenario

---

## 🔍 Verifica Rapida File Necessari

Prima di copiare su chiavetta, verifica con:

```batch
doppio click: CHECK-CHIAVETTA.bat
```

Deve mostrare:
- ✅ `libs\three.module.js` presente
- ✅ `libs\tween.umd.js` presente
- ✅ `libs\three-addons\loaders\` presente
- ✅ Tutti gli altri file standard

---

## 📊 Confronto Versioni

| Caratteristica | Versione Online (PRIMA) | Versione Offline (DOPO) |
|----------------|------------------------|-------------------------|
| **Internet richiesto** | ✅ Sì | ❌ No |
| **Dimensione** | ~180 MB | ~182 MB (+2 MB libs) |
| **Velocità caricamento** | Lenta (dipende da rete) | Veloce (locale) |
| **Affidabilità** | Dipende da CDN | 100% affidabile |
| **Cartelle richieste** | 8 | 9 (+libs/) |

---

## 🐛 Troubleshooting

### ❌ "Script PowerShell bloccato"

**Soluzione**: Usa `CONVERTI-OFFLINE-FACILE.bat` invece di eseguire `.ps1` direttamente.

### ❌ "Download fallito"

**Causa**: Nessuna connessione internet sul PC di sviluppo.

**Soluzione**:
1. Connetti il PC di sviluppo a internet
2. Rilancia lo script
3. Dopo download, non serve più internet

### ❌ "App si blocca ancora su caricamento"

**Verifica**:
1. Premi **F12** nell'app
2. Guarda la Console
3. Se vedi errori tipo `Failed to load module`, la cartella `libs\` non è stata copiata

**Soluzione**: Copia TUTTA la cartella `libs\` sulla chiavetta.

### ❌ "404 Not Found libs/three.module.js"

**Causa**: Cartella `libs\` mancante o non nella stessa directory dell'exe.

**Soluzione**: Assicurati che la struttura sia:
```
[Directory con exe]\
├── Campus Virtual Training.exe
└── libs\  ← DEVE stare QUI
```

---

## 📦 File Scaricati (per riferimento)

Dopo lo script, dovresti avere:

```
libs\
├── three.module.js           (~2.0 MB)  - Libreria 3D
├── tween.umd.js              (~50 KB)   - Libreria animazioni
└── three-addons\
    └── loaders\
        ├── OBJLoader.js      (~10 KB)   - Caricamento .obj
        ├── MTLLoader.js      (~8 KB)    - Caricamento .mtl
        ├── STLLoader.js      (~5 KB)    - Caricamento .stl
        └── GLTFLoader.js     (~50 KB)   - Caricamento .glb/.gltf
```

**Totale**: ~2.1 MB aggiuntivi

---

## ✅ Checklist Finale

Prima di andare alla demo:

- [ ] Eseguito `CONVERTI-OFFLINE-FACILE.bat` con successo
- [ ] Eseguito `build-electron.bat` con successo
- [ ] Cartella `libs\` presente e completa
- [ ] File `.exe` nuovo in `dist\`
- [ ] Eseguito `CHECK-CHIAVETTA.bat` senza errori
- [ ] Copiato TUTTO (exe + libs + scenes + models + ...) su chiavetta
- [ ] Testato l'app sul tuo PC offline (opzionale ma consigliato)

---

## 🎉 Risultato Finale

Ora hai una **versione completamente offline** che:
- ✅ Funziona senza internet
- ✅ Carica più velocemente (risorse locali)
- ✅ È 100% affidabile (nessuna dipendenza CDN)
- ✅ Può essere distribuita su qualsiasi PC Windows

---

**Buona demo! 🚀**

Se hai problemi, apri l'app e premi F12 per vedere gli errori nella console.
