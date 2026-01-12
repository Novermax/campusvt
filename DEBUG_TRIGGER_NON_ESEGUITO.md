# 🔍 Debug: Trigger Accettato ma Azioni Non Eseguite

**Data**: 18 Gennaio 2026
**Problema**: Step "apri la porta" non viene più saltato, ma quando si clicca sulla chiave, le azioni `OnPhysicalTrigger` non vengono eseguite

---

## 📊 Log Diagnostici Aggiunti

Ho aggiunto log dettagliati in **StepController.js (v1000003)** per diagnosticare il problema.

### Quando lo Step Viene Caricato

Quando `executeStep()` viene chiamato per lo step "apri la porta", vedrai:

```
[StepController] 📍 Step corrente: 11 "Next Step - apri la porta"
[StepController] 📋 Step 11 auto-configurato da proprietà:
[StepController]    Triggers Physical: [pulpito.chiave0, pulpito.chiave1]
[StepController]    Actions Physical: 3 azioni
[StepController]      1. setVariant: chiave=chiave1
[StepController]      2. setVariant: schermo=schermo005
[StepController]      3. setVariant: start=pstart0
```

**✅ Questo conferma che:**
- Il parsing funziona correttamente
- Le 3 azioni vengono parsate correttamente
- La configurazione viene salvata per lo step 11

### Quando Clicchi sulla Chiave

Quando clicchi sulla chiave, vedrai:

```
🖱️ [InteractiveObject3D] Click su "chiave0" (parent: pulpito)
🔘 [InteractiveObject3D] Button click: pulpito.chiave0 (mesh: chiave0) → cycleVariant:chiave
[StepController] 🎯 Trigger ricevuto: source="physical", id="pulpito.chiave0"
[StepController] 🔍 currentStepIndex=11
[StepController] 🔍 stepConfigs.size=5
[StepController] 🔍 stepConfigs.keys=[0, 1, 2, 3, 11]
[StepController] 🔍 Configurazione trovata: {...}
[StepController] ✅ Trigger "pulpito.chiave0" accettato da sorgente "physical"
[StepController] ⚡ Esecuzione 3 azioni per sorgente "physical"
[StepController]    1. setVariant: {type: 'setVariant', group: 'chiave', variant: 'chiave1'}
[StepController]    2. setVariant: {type: 'setVariant', group: 'schermo', variant: 'schermo005'}
[StepController]    3. setVariant: {type: 'setVariant', group: 'start', variant: 'pstart0'}
[StepController] 🔀 setVariant: chiave=chiave1
[StepController] 🔀 setVariant: schermo=schermo005
[StepController] 🔀 setVariant: start=pstart0
   ✓ Gestito da StepController
   ⏭️ Azione locale "cycleVariant:chiave" ignorata (già gestito da StepController)
[StepController] ⏭️ Auto-avanzamento schedulato...
[StepController] ⏭️ Avanzamento allo step successivo
```

**✅ Questo conferma che:**
- Il trigger viene accettato
- Le 3 azioni vengono eseguite
- `InteractiveObject3D.setStateVariant()` viene chiamato 3 volte

---

## 🔍 Cosa Cercare nei Log

### Scenario 1: Configurazione Non Salvata

**Log atteso (PROBLEMA):**
```
[StepController] ⏭️ Step 11 skippato (nessun trigger definito)
```

**Causa**: Il parsing di `AcceptTrigger_Physical` o `OnPhysicalTrigger` fallisce.

**Fix**: Controlla sintassi nel tutorial.txt (nomi corretti, separatori, ecc.)

### Scenario 2: Configurazione Non Trovata al Trigger

**Log atteso (PROBLEMA):**
```
[StepController] 🔍 currentStepIndex=11
[StepController] 🔍 stepConfigs.keys=[0, 1, 2, 3]  ← Manca 11!
[StepController] ℹ️ Nessuna configurazione specifica, delegando a sistema tradizionale
[StepController] 🔍 Configurazione per step 11 NON TROVATA
```

**Causa**: Mismatch tra indice salvato e indice corrente.

**Fix**: Bug nel sistema di indicizzazione step.

### Scenario 3: Trigger Non Accettato

**Log atteso (PROBLEMA):**
```
[StepController] ❌ Trigger "pulpito.chiave0" non accettato per sorgente "physical"
[StepController]    Trigger accettati: [pulpito.chiave]  ← Mismatch!
```

**Causa**: Nome trigger inviato ≠ nome trigger accettato.

**Fix**: Correggere `AcceptTrigger_Physical` nel tutorial.txt (già fixato).

### Scenario 4: Azioni Non Eseguite

**Log atteso (PROBLEMA):**
```
[StepController] ⚡ Esecuzione 0 azioni per sorgente "physical"  ← Nessuna azione!
```

**Causa**: Parsing `OnPhysicalTrigger` fallisce.

**Fix**: Controlla sintassi azioni (formato `setVariant:gruppo=variante;...`).

### Scenario 5: setStateVariant Fallisce

**Log atteso (PROBLEMA):**
```
[StepController] 🔀 setVariant: chiave=chiave1
[InteractiveObject3D] ⚠️ StateGroup "chiave" non trovato
```

**Causa**: StateGroup non registrato correttamente.

**Fix**: Verifica `[StateGroup:chiave]` nel tutorial.txt.

---

## 🧪 Test da Eseguire

### 1. Ricarica Pagina

```
F5 o Ctrl+R
```

Assicurati che la versione aggiornata venga caricata:
```
✅ Controller step centralizzato caricato  (deve essere v1000003)
```

### 2. Avvia Tutorial

```
Login → Scenario "Manutenzione Elettromandrino" → Avvia tutorial
```

### 3. Vai allo Step "apri la porta"

Completa gli step 1-11 fino ad arrivare a:
```
[Next Step - apri la porta]
```

### 4. Verifica Log Configurazione

**Apri Console** (F12 → Console)

Dovresti vedere:
```
[StepController] 📋 Step X auto-configurato da proprietà:
[StepController]    Triggers Physical: [pulpito.chiave0, pulpito.chiave1]
[StepController]    Actions Physical: 3 azioni
[StepController]      1. setVariant: chiave=chiave1
[StepController]      2. setVariant: schermo=schermo005
[StepController]      3. setVariant: start=pstart0
```

**✅ Se vedi questo**: La configurazione è stata salvata correttamente.
**❌ Se NON vedi questo**: Problema nel parsing step.

### 5. Clicca sulla Chiave

Clicca sulla chiave (chiave0 o chiave1).

**Console dovrebbe mostrare:**
```
[StepController] 🎯 Trigger ricevuto: source="physical", id="pulpito.chiave0"
[StepController] 🔍 currentStepIndex=X
[StepController] 🔍 Configurazione trovata: {...}
[StepController] ✅ Trigger "pulpito.chiave0" accettato
[StepController] ⚡ Esecuzione 3 azioni per sorgente "physical"
[StepController] 🔀 setVariant: chiave=chiave1
[StepController] 🔀 setVariant: schermo=schermo005
[StepController] 🔀 setVariant: start=pstart0
```

**✅ Se vedi questo**: Le azioni vengono eseguite correttamente.
**❌ Se NON vedi questo**: Invia screenshot console completo.

### 6. Verifica Visivamente

Dopo il click sulla chiave, dovresti vedere:

- ✅ **Chiave** cambia stato (chiave0 → chiave1)
- ✅ **Schermo** cambia vista (schermo004 → schermo005)
- ✅ **Pulsante Start** cambia stato (pstart1 → pstart0)

**❌ Se NON vedi cambiamenti visivi** ma i log dicono che `setVariant` è stato chiamato:
- Problema nell'implementazione `InteractiveObject3D.setStateVariant()`
- O nei modelli GLB (nomi mesh non corrispondono)

---

## 📋 Checklist Troubleshooting

### Prima di Testare

- [ ] Ricaricato pagina (F5)
- [ ] Console aperta (F12 → Console)
- [ ] Filtro console su "StepController" o "InteractiveObject"

### Durante Test

- [ ] Log "📋 Step X auto-configurato" appare
- [ ] Log mostra "3 azioni" per step "apri la porta"
- [ ] Log "🎯 Trigger ricevuto" appare al click
- [ ] Log "✅ Trigger accettato" appare
- [ ] Log "⚡ Esecuzione 3 azioni" appare
- [ ] Log "🔀 setVariant" appare 3 volte

### Risultati Visivi

- [ ] Chiave cambia stato visivamente
- [ ] Schermo cambia vista visivamente
- [ ] Pulsante Start cambia stato visivamente
- [ ] Step avanza automaticamente dopo 500ms

---

## 🚨 Problemi Noti Possibili

### Problema A: StateGroup Non Registrato

**Sintomo**: Log mostra `setVariant` chiamato ma nessun cambio visivo.

**Log**:
```
[InteractiveObject3D] ⚠️ StateGroup "schermo" non trovato
```

**Causa**: `[StateGroup:schermo]` non parsato o non trovato.

**Fix**: Verifica che `InteractiveObject3D.registerStateGroupFromTutorial()` sia stato chiamato per ogni `[StateGroup:...]`.

### Problema B: Mesh Varianti Non Trovate

**Sintomo**: Log mostra `setVariant` chiamato ma nessun cambio visivo.

**Log**:
```
[InteractiveObject3D] ⚠️ Variante "schermo005" non trovata in StateGroup "schermo"
```

**Causa**: Mesh "schermo005" non esiste nel modello GLB.

**Fix**: Verifica nomi mesh nel GLB corrispondono ai nomi in `Variants=`.

### Problema C: Modello Non Ancora Caricato

**Sintomo**: Azioni eseguite ma modello non aggiornato.

**Causa**: `setStateVariant()` chiamato prima che il modello sia completamente caricato.

**Fix**: Aggiungi delay o verifica `model.visible` prima di applicare variante.

---

## 📤 Cosa Inviare se il Problema Persiste

Se dopo il test il problema persiste, invia:

1. **Screenshot Console Completo** (dal caricamento pagina fino al click chiave)
2. **Log Filtrato** (solo righe con "[StepController]" o "[InteractiveObject3D]")
3. **Descrizione Comportamento**:
   - Lo step viene saltato? (No/Sì)
   - Il trigger viene rilevato? (Console mostra "Trigger ricevuto"?)
   - Le azioni vengono eseguite? (Console mostra "setVariant"?)
   - Ci sono cambiamenti visivi? (Chiave/Schermo/Start cambiano?)

---

**File Modificati per Debug**:
- `js/core/StepController.js` (v1000003) - Log diagnostici estesi
- `js/app.js` - Versione modulo aggiornata

**Come Testare**:
1. Ricarica pagina (F5)
2. Avvia tutorial
3. Vai allo step "apri la porta"
4. Apri console (F12)
5. Clicca chiave
6. Copia log console e invia screenshot

