# ✅ Fix Auto-Avanzamento Step con Trigger - 16 Gennaio 2026

## 🎯 Problema Originale

**Bug**: L'utente poteva cliccare la chiave "apri la porta" PRIMA che il tutorial partisse, causando problemi.

**Causa Root**: I trigger venivano accettati anche quando il tutorial non era ancora avviato (`currentStepIndex < 0`).

## ❌ Tentativo Errato (Regressione)

**Prima soluzione sbagliata**:
- Cambiato default `autoAdvance` da `true` a `false`
- Richiesta dichiarazione esplicita `AutoAdvance=true` per ogni step con trigger

**Problema introdotto**:
- Regressione: Tutorial esistenti senza `AutoAdvance` dichiarato smettevano di funzionare
- Logica errata: `AutoAdvance` NON dovrebbe essere obbligatorio per step con trigger
- Comportamento rotto: Step con trigger non avanzavano più automaticamente

## ✅ Soluzione Corretta

### Logica Corretta

1. **Step CON trigger**: Avanzano SEMPRE automaticamente dopo che il trigger è accettato ed eseguito
   - Non serve dichiarare `AutoAdvance=true`
   - Questo è il comportamento originale
   
2. **Step SENZA trigger** (es. con `AutoExecute`): Usano il flag `AutoAdvance` per decidere
   - `AutoAdvance=true` → avanza automaticamente dopo esecuzione
   - `AutoAdvance=false` (default) → aspetta interazione utente
   
3. **Blocco pre-tutorial**: StepGatingManager blocca TUTTI i pulsanti quando `currentStepIndex < 0`
   - Questo risolve il bug originale
   - I trigger non vengono accettati prima che il tutorial parta

### Implementazione

**File**: `js/core/StepController.js:371-376`

```javascript
// Auto-avanzamento SEMPRE dopo trigger accettato
// (il flag autoAdvance serve solo per step senza trigger, es. con AutoExecute)
console.log('[StepController] ⏭️ Trigger accettato → auto-avanzamento dopo azioni');
this.scheduleAutoAdvance();
```

**PRIMA (❌ sbagliato)**:
```javascript
// Auto-avanzamento se configurato
if (stepConfig.autoAdvance) {
    this.scheduleAutoAdvance();
}
```

**DOPO (✅ corretto)**:
```javascript
// Auto-avanzamento SEMPRE dopo trigger accettato
this.scheduleAutoAdvance();
```

## 📊 Comportamento Corretto

### Esempio 1: Step con Trigger (NO AutoAdvance necessario)

```ini
[Step 1 - Vai alla schermata MDI]
AcceptTrigger_Physical=pulpito.Pulsante_mdi
OnPhysicalTrigger=setVariant:schermo=schermo002
# NO AutoAdvance dichiarato → avanza automaticamente dopo trigger ✅
```

**Comportamento**:
1. Utente clicca pulsante MDI
2. Trigger accettato → esegue `setVariant:schermo=schermo002`
3. **Avanza automaticamente** allo step 2 dopo 500ms ✅

### Esempio 2: Step senza Trigger con AutoExecute

```ini
[Step 5 - Apertura Magazzino]
Elemento=models/a500.glb
TargetChild=Basamento_Portale_MagazzinoInternoX1
Azione1=traslazione:(0.565,0,0,1.0)
AutoExecute=true
AutoAdvance=true  ← NECESSARIO per avanzare automaticamente
```

**Comportamento**:
1. Animazione parte automaticamente (`AutoExecute=true`)
2. Animazione completa dopo 1.0s
3. **Avanza automaticamente** perché `AutoAdvance=true` ✅

### Esempio 3: Step senza Trigger senza AutoAdvance

```ini
[Step 10 - Ispeziona risultato]
Message=Controlla che la macchina sia pronta
# NO AutoExecute, NO AutoAdvance → aspetta utente
```

**Comportamento**:
1. Mostra modal messaggio
2. Utente clicca OK → chiude modal
3. **NON avanza** automaticamente (default `AutoAdvance=false`)
4. Utente clicca freccia → per proseguire ✅

## 🔒 Protezione Pre-Tutorial

**StepGatingManager** blocca tutte le interazioni prima che il tutorial parta:

```javascript
// js/core/InteractiveObject3D.js:406-412
handleClick: function(mesh) {
    // Blocco PRE-TUTORIAL
    if (window.StepGatingManager && window.StepGatingManager.currentStepIndex < 0) {
        console.log(`🚫 [InteractiveObject3D] Interazione bloccata - tutorial non ancora avviato`);
        return false;
    }
    // ... continua normale
}
```

Questo **risolve il bug originale** senza richiedere modifiche ai tutorial esistenti.

## 📝 File Modificati

1. **js/core/StepController.js:371-376**
   - Rimosso check `if (stepConfig.autoAdvance)`
   - Auto-avanzamento SEMPRE dopo trigger accettato

2. **js/core/StepController.js:120, 163**
   - Aggiornati commenti per chiarire logica

3. **js/app.js:267**
   - Versione aggiornata a v1000006

4. **scenes/Manutenzione_Elettromandrino/tutorial.txt**
   - Rimossi `AutoAdvance=true` aggiunti erroneamente (righe 134, 150, 184, 245)
   - Tutorial funziona correttamente senza modifiche

## ✅ Criteri di Accettazione

✅ **Tutorial legacy funzionano senza modifiche**
- Step con trigger avanzano automaticamente senza dichiarare `AutoAdvance=true`

✅ **Sequenze movimento → UI non saltate**
- Step con `AutoExecute=true` + `AutoAdvance=true` → avanza
- Step seguente senza trigger → aspetta utente

✅ **Protezione pre-tutorial**
- Click su pulsanti PRIMA del tutorial → ignorati
- StepGatingManager blocca quando `currentStepIndex < 0`

✅ **Zero regressioni**
- Tutti i tutorial esistenti continuano a funzionare
- Comportamento identico a prima del bug

## 🎯 Quando usare AutoAdvance=true

**✅ USA `AutoAdvance=true` quando**:
- Step SENZA trigger che deve avanzare automaticamente
- Tipicamente con `AutoExecute=true` per animazioni automatiche
- Sequenze di movimenti automatici consecutivi

**❌ NON usare quando**:
- Step ha trigger fisici/schermo (avanza automaticamente SEMPRE)
- Step deve aspettare interazione utente
- Step mostra messaggio/modal da leggere

## 🧪 Test Case

### Test 1: Step con Trigger
**Input**: Click pulsante MDI dopo avvio tutorial
**Output**: Cambia schermo + avanza automaticamente ✅

### Test 2: Step AutoExecute con AutoAdvance
**Input**: Step con movimento automatico + `AutoAdvance=true`
**Output**: Movimento eseguito + avanza automaticamente ✅

### Test 3: Step AutoExecute senza AutoAdvance
**Input**: Step con movimento automatico, NO `AutoAdvance`
**Output**: Movimento eseguito + aspetta click freccia ✅

### Test 4: Click Pre-Tutorial
**Input**: Click chiave PRIMA di avviare tutorial
**Output**: Click ignorato, messaggio console bloccato ✅

---

**Status**: ✅ Completato e testato
**Data**: 16 Gennaio 2026
**Versione**: StepController v1000006
