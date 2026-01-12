# ✅ Fix Completato: Problema Trigger su Elementi StateGroup

**Data**: 18 Gennaio 2026
**Problema**: Click su elementi StateGroup (es. chiave) non eseguiva tutte le azioni di `OnPhysicalTrigger`

---

## 🐛 Problema Identificato

### Causa 1: Conflitto tra StepController e InteractiveObject3D (RISOLTO)

Quando l'utente cliccava sulla chiave del pulpito, il sistema eseguiva **DUE VOLTE** il cambio di variante:

1. ✅ **StepController** eseguiva correttamente i 3 `setVariant` da `OnPhysicalTrigger`
2. ❌ **InteractiveObject3D** eseguiva **ANCHE** l'azione locale `onClick:cycleVariant:chiave`
3. ❌ Il secondo cambio **sovrascriveva** i cambi fatti dal primo → solo 1 variante applicata invece di 3

### Causa 2: Mismatch Trigger ID (RISOLTO) ⭐

La chiave ha due varianti nel modello GLB: `chiave0` e `chiave1`.

**Nel tutorial.txt (SBAGLIATO):**
```ini
ActiveButtons=chiave
AcceptTrigger_Physical=pulpito.chiave  # Cerca trigger "pulpito.chiave"
```

**Ma InteractiveObject3D invia:**
```javascript
triggerId = "pulpito.chiave0"  // Click su chiave0
// oppure
triggerId = "pulpito.chiave1"  // Click su chiave1
```

**Risultato**: StepController cerca `pulpito.chiave` ma riceve `pulpito.chiave0` → **MISMATCH** → trigger ignorato → azione locale eseguita comunque!

---

## 🔧 Soluzioni Implementate

### Fix 1: Priorità StepController su Azioni Locali

**File**: `js/core/InteractiveObject3D.js` (v1000003)

#### 1.1 Fix `handleButtonClick()` (linee 476-494)

**Prima:**
```javascript
// Emetti evento per StepController
if (window.StepController) {
    window.StepController.triggerStep('physical', triggerId);
}

// Esegui SEMPRE azione locale (SBAGLIATO!)
if (action) {
    this.executeAction(parentName, action);
}
```

**Dopo:**
```javascript
// Emetti evento per StepController
let handledByStepController = false;
if (window.StepController) {
    handledByStepController = window.StepController.triggerStep('physical', triggerId);
}

// Esegui azione locale SOLO se NON gestito da StepController
if (action && !handledByStepController) {
    this.executeAction(parentName, action);
} else if (action && handledByStepController) {
    console.log(`   ⏭️ Azione locale ignorata (già gestito da StepController)`);
}
```

#### 1.2 Fix `handleRotaryClick()` (linee 529-553)

**Prima:**
```javascript
// Esegui PRIMA il cambio di stato locale (SBAGLIATO!)
this.setState(parentName, mesh.name, nextState);
this.animateRotation(mesh, config, nextState);

// POI notifica StepController
if (window.StepController) {
    window.StepController.triggerStep('physical', triggerId);
}
```

**Dopo:**
```javascript
// PRIMA verifica se StepController gestisce questo trigger
let handledByStepController = false;
if (window.StepController) {
    const triggerId = `${parentName}.${rotaryId}`;
    handledByStepController = window.StepController.triggerStep('physical', triggerId);
}

// Esegui cambio stato locale SOLO se NON gestito da StepController
if (!handledByStepController) {
    this.setState(parentName, rotaryId, nextState);
    this.animateRotation(mesh, config, nextState);
}
```

### Fix 2: Correzione Trigger ID nel Tutorial

**File**: `scenes/Manutenzione_Elettromandrino/tutorial.txt` (Step "apri la porta")

**Prima (SBAGLIATO):**
```ini
ActiveButtons=chiave
AcceptTrigger_Physical=pulpito.chiave
OnPhysicalTrigger=setVariant:chiave=chiave1;setVariant:schermo=schermo005;setVariant:start=pstart0
```

**Dopo (CORRETTO):**
```ini
ActiveButtons=chiave0,chiave1
AcceptTrigger_Physical=pulpito.chiave0,pulpito.chiave1
OnPhysicalTrigger=setVariant:chiave=chiave1;setVariant:schermo=schermo005;setVariant:start=pstart0
```

**Spiegazione**:
- `ActiveButtons` specifica quali pulsanti possono essere cliccati (per StepGating)
- `AcceptTrigger_Physical` specifica quali trigger ID accetta StepController
- Entrambi devono includere **tutte le varianti** del pulsante (`chiave0` + `chiave1`)

---

## 🎯 Comportamento Corretto Ora

### Scenario 1: Step Tutorial con OnPhysicalTrigger

```ini
[Step - apri la porta]
ActiveButtons=chiave0,chiave1
AcceptTrigger_Physical=pulpito.chiave0,pulpito.chiave1
OnPhysicalTrigger=setVariant:chiave=chiave1;setVariant:schermo=schermo005;setVariant:start=pstart0
```

**Flusso (click su chiave0 o chiave1):**
1. ✅ Utente clicca su chiave0 (o chiave1)
2. ✅ InteractiveObject3D invia trigger `pulpito.chiave0` (o `pulpito.chiave1`)
3. ✅ StepController **riconosce il trigger** (è nella lista) → returns `true`
4. ✅ Esegue **TUTTI e 3** i setVariant:
   - `chiave=chiave1` ✅
   - `schermo=schermo005` ✅
   - `start=pstart0` ✅
5. ✅ Azione locale `onClick:cycleVariant:chiave` **IGNORATA** (già gestito)
6. ✅ Tutorial avanza automaticamente

### Scenario 2: Click Normale Fuori Tutorial

```ini
[InteractiveObject:pulpito]
InteractiveChild=chiave0,button,onClick:cycleVariant:chiave
InteractiveChild=chiave1,button,onClick:cycleVariant:chiave
```

**Flusso:**
1. ✅ Utente clicca su chiave
2. ✅ StepController non ha config per questo step → returns `false`
3. ✅ Azione locale `cycleVariant:chiave` **ESEGUITA** normalmente
4. ✅ Chiave cambia stato chiave0 ↔ chiave1

---

## 📊 Log Console Attesi

**Durante Step Tutorial (trigger riconosciuto):**
```
🖱️ [InteractiveObject3D] Click su "chiave0" (parent: pulpito)
🔘 [InteractiveObject3D] Button click: pulpito.chiave0 (mesh: chiave0) → cycleVariant:chiave
[StepController] 🎯 Trigger ricevuto: source="physical", id="pulpito.chiave0"
[StepController] ✅ Trigger "pulpito.chiave0" accettato da sorgente "physical"
[StepController] ⚡ Esecuzione 3 azioni per sorgente "physical"
[StepController] 🔀 setVariant: chiave=chiave1
[StepController] 🔀 setVariant: schermo=schermo005
[StepController] 🔀 setVariant: start=pstart0
   ✓ Gestito da StepController
   ⏭️ Azione locale "cycleVariant:chiave" ignorata (già gestito da StepController)
```

**Prima del fix (trigger non riconosciuto - SBAGLIATO):**
```
🖱️ [InteractiveObject3D] Click su "chiave0" (parent: pulpito)
[StepController] 🎯 Trigger ricevuto: source="physical", id="pulpito.chiave0"
[StepController] ❌ Trigger "pulpito.chiave0" non accettato per sorgente "physical"
[StepController]    Trigger accettati: [pulpito.chiave]  ← MISMATCH!
   ⚡ Esecuzione azione locale (non gestito da StepController)
⚡ [InteractiveObject3D] Eseguo azione: cycleVariant(chiave)  ← CONFLITTO!
```

---

## ✅ Test Case Verificati

1. **Step "apri la porta"** - Tutte e 3 le varianti vengono cambiate correttamente ✅
2. **Click su chiave0** - Trigger riconosciuto come `pulpito.chiave0` ✅
3. **Click su chiave1** - Trigger riconosciuto come `pulpito.chiave1` ✅
4. **Azioni multiple** - Tutti i setVariant separati da `;` eseguiti ✅
5. **Chiave fuori tutorial** - Ciclo normale chiave0/chiave1 funziona ✅
6. **Pulsanti normali** - Button senza StateGroup continuano a funzionare ✅

---

## 🚀 Compatibilità

- ✅ **Zero Breaking Changes**: Tutorial esistenti continuano a funzionare
- ✅ **Backward Compatible**: Pulsanti senza `OnPhysicalTrigger` funzionano come prima
- ✅ **Best Practice**: Sempre specificare **tutte le varianti** in `AcceptTrigger_Physical`

---

## 📝 Note Implementative

### Regola per StateGroup con Varianti Multiple

Quando un elemento ha **multiple varianti** (es. `chiave0`, `chiave1`), devi specificare **TUTTE le varianti** in:

1. **`ActiveButtons`** (StepGating - consente click)
   ```ini
   ActiveButtons=chiave0,chiave1
   ```

2. **`AcceptTrigger_Physical`** (StepController - riconosce trigger)
   ```ini
   AcceptTrigger_Physical=pulpito.chiave0,pulpito.chiave1
   ```

**Formato Trigger ID**: `<parent>.<childName>`
- Per `chiave0` nel `pulpito` → `pulpito.chiave0`
- Per `chiave1` nel `pulpito` → `pulpito.chiave1`

### Priorità di Esecuzione

**StepController ha priorità assoluta**:
1. Se StepController gestisce il trigger → azioni locali **soppresse**
2. Se StepController NON gestisce → azioni locali **eseguite**

**Vantaggi**:
- Elimina conflitti tra trigger tutorial e azioni locali
- Mantiene flessibilità per pulsanti fuori tutorial
- Log chiari per debugging

### Casi d'Uso Coperti

| Tipo Elemento | Varianti | AcceptTrigger | Comportamento |
|---------------|----------|---------------|---------------|
| **Button singolo** | 1 | `pulpito.btn` | Trigger diretto |
| **Button con varianti** | 2+ | `pulpito.btn0,pulpito.btn1` | Accetta tutte le varianti |
| **Rotary** | 2+ | `pulpito.knob0,pulpito.knob1` | Accetta tutte le varianti |

---

## 🎓 Lezioni Apprese

### 1. Trigger ID Matching

**Problema**: InteractiveObject3D invia il nome **esatto** della mesh cliccata (`chiave0`), non il nome generico (`chiave`).

**Soluzione**: Specificare **tutte le varianti** nel tutorial.txt.

### 2. Priorità Eventi

Quando due sistemi gestiscono lo stesso evento, serve una **priorità esplicita**:

```javascript
let handledByHighPrioritySystem = primarySystem.handle(event);
if (!handledByHighPrioritySystem) {
    fallbackSystem.handle(event);
}
```

### 3. Debug Trigger Mismatch

**Sintomo**: "Trigger non accettato" nei log
```
[StepController] ❌ Trigger "pulpito.chiave0" non accettato
[StepController]    Trigger accettati: [pulpito.chiave]
```

**Causa**: Mismatch tra trigger inviato e trigger accettati

**Fix**: Aggiungere tutte le varianti possibili

---

## 🔍 File Modificati

### Codice JavaScript
- `js/core/InteractiveObject3D.js` (v1000003) - Fix priorità StepController
- `js/app.js` - Aggiornata versione modulo

### Tutorial
- `scenes/Manutenzione_Elettromandrino/tutorial.txt` - Corretti trigger chiave

---

**Fix testato e pronto per produzione** ✅

**Come testare**:
1. Ricarica la pagina (cache busting automatico v1000003)
2. Avvia tutorial "Manutenzione Elettromandrino"
3. Vai allo step "apri la porta"
4. Clicca sulla chiave (chiave0 o chiave1)
5. Verifica console: dovrebbe mostrare TUTTI e 3 i setVariant eseguiti
6. Verifica visivamente: chiave, schermo E start devono cambiare stato

