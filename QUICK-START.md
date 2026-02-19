# 🚀 Quick Start - Electron Build

## Setup Iniziale (Una Volta Sola)

### 1️⃣ Installa Node.js
- Scarica: https://nodejs.org/ (versione LTS)
- Installa con opzione "Add to PATH"
- Riavvia il PC

### 2️⃣ Verifica Setup
```bash
# Doppio click su:
check-setup.bat
```

---

## Build Applicazione

### 🎯 Metodo Più Semplice
```bash
# Doppio click su:
build-electron.bat
```

### ⏱️ Tempo Stimato
- Prima volta: ~5-7 minuti (download dipendenze)
- Build successivi: ~2-3 minuti

### 📦 Risultato
```
dist\Campus Virtual Training-1.0.0-Portable.exe  ← QUESTO È IL FILE DA DISTRIBUIRE
```

---

## Test Prima del Build

```bash
# Doppio click su:
run-electron-dev.bat
```

---

## 📂 File da Distribuire

**Copia sul PC target:**
```
Campus Virtual Training-1.0.0-Portable.exe
```

**Uso sul PC target:**
1. Doppio click
2. App parte in fullscreen
3. Touch funziona nativamente
4. Tutto offline ✅

---

## 🎨 Personalizza Icona (Opzionale)

1. Crea `build\icon.ico` (256x256 o maggiore)
2. Rilancia build
3. Fatto!

**Tool online:** https://icoconvert.com/

---

## ⚡ Comandi Rapidi

```bash
# Test sviluppo
npm start

# Build completo
npm run build

# Solo portable
npm run build-portable

# Verifica setup
check-setup.bat
```

---

## ❓ Problemi Comuni

| Problema | Soluzione |
|----------|-----------|
| Node.js non trovato | Installa da nodejs.org e riavvia |
| npm install fallisce | Verifica connessione internet |
| Build fallisce | Controlla spazio disco (serve ~500MB) |
| App non parte su PC target | Windows 10/11 richiesto |
| Icona non appare | Verifica che icon.ico sia valido |

---

## 📞 Link Utili

- **Node.js**: https://nodejs.org/
- **Electron Docs**: https://www.electronjs.org/docs/latest
- **electron-builder**: https://www.electron.build/
- **Icone gratis**: https://icoconvert.com/

---

**That's it! 🎉**

Leggi `README-ELECTRON.md` per documentazione completa.
