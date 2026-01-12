# Fix AutoAdvance Default - Step con Trigger Non Avanzano Automaticamente

**Data**: 11 Gennaio 2026
**Versione**: StepController v1000007
**Problema**: Bug critico - step con trigger avanzavano sempre automaticamente ignorando AutoAdvance

---

## 🐛 Problema Identificato

### Sintomo
Step con solo trigger (es. AcceptTrigger_Physical) venivano **saltati automaticamente** anche senza `AutoAdvance=true`, comportamento errato soprattutto dopo una sequenza di step con `AutoExecute/AutoAdvance=true`.

### Caso Riproducibile

**Tutorial**: `scenes/Manutenzione_Elettromandrino/tutorial.txt`

```ini
[Step - apri la porta]
Descrizione=Gira la chiave per aprire la porta di accesso all'elettromandrino.
AcceptTrigger_Physical=pulpito.chiave0,pulpito.chiave1
OnPhysicalTrigger=setVariant:chiave=chiave1;setVariant:schermo=schermo005
```

**Comportamento Errato**:
- Utente clicca chiave (trigger eseguito)
- Azioni OnPhysicalTrigger eseguite
- **BUG**: Step avanza automaticamente senza aspettare click freccia

**Comportamento Atteso**:
- Utente clicca chiave (trigger eseguito)
- Azioni OnPhysicalTrigger eseguite
- **CORRETTO**: Step rimane attivo, aspetta click freccia manuale

---

## 🔍 Causa Root

**File**: `js/core/StepController.js:371-374`

```javascript
// BUG: Auto-avanzamento SEMPRE dopo trigger accettato
this.scheduleAutoAdvance();  // ← chiamato SEMPRE senza controllo flag
```

Il sistema chiamava `scheduleAutoAdvance()` incondizionatamente ogni volta che un trigger veniva accettato, ignorando il flag `autoAdvance` dello step.

---

## ✅ Soluzione Implementata

### Fix: Controllo AutoAdvance Prima di Avanzare

**File**: `js/core/StepController.js:371-378`

```javascript
// DOPO (CORRETTO)
if (stepConfig.autoAdvance === true) {
    console.log('[StepController] ⏭️ AutoAdvance=true → auto-avanzamento dopo trigger');
    this.scheduleAutoAdvance();
} else {
    console.log('[StepController] ⏸️ AutoAdvance non impostato → aspetto click utente sulla freccia');
}
```

---

## 📋 Comportamento Corretto

### Default (AutoAdvance NON specificato)

```ini
[Step - Premi pulsante]
AcceptTrigger_Physical=pulpito.btn_start
OnPhysicalTrigger=setVariant:schermo=menu

# Comportamento:
# 1. Utente clicca pulsante → trigger eseguito
# 2. Azioni OnPhysicalTrigger eseguite
# 3. Step RIMANE ATTIVO
# 4. Utente deve cliccare freccia → per avanzare ✅
```

### Con AutoAdvance=true Esplicito

```ini
[Step - Movimento automatico]
Elemento=models/a500.glb
TargetChild=CarroY
Azione1=traslazione:(0,0,2.623,1.5)
AutoExecute=true
AutoAdvance=true

# Comportamento:
# 1. Step attivato
# 2. Animazione eseguita automaticamente
# 3. Dopo completamento → avanza automaticamente ✅
```

---

## 🔧 File Modificati

| File | Linee | Descrizione |
|------|-------|-------------|
| `js/core/StepController.js` | 120, 163 | Commenti corretti |
| `js/core/StepController.js` | 371-378 | Check condizionale AutoAdvance |
| `js/app.js` | 267-268 | Versione v1000007 |

---

## ✅ Conclusione

**Status**: ✅ FIX COMPLETATO E TESTATO

**Risultato**:
- Step con trigger ora si comportano correttamente (aspettano click manuale)
- AutoAdvance funziona come documentato
- Nessun breaking change
- Versione: StepController v1000007
