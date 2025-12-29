# 🔴 CRITICITÀ: Viti Culatta Riassemblaggio - Saltano a Posizione Finale

**Data**: 5 Dicembre 2025
**Priorità**: ALTA
**Sistema Coinvolto**: DragDrop + Snap + Animazioni Multi-Step (Step riassemblaggio viti culatta)

---

## 📋 Descrizione Problema

Le **4 viti della culatta** (vite_culatta_1, vite_culatta_2, vite_culatta_3, vite_culatta_4) durante il **riassemblaggio** **NON si posizionano con offset** come dovrebbero. Invece di posizionarsi sporgenti (estratte) e poi avvitarsi negli step successivi, **saltano direttamente alla posizione finale completamente avvitate**.

### Sintomi Osservati
- ❌ **Step Drag&Drop**: Viti dovrebbero posizionarsi con offset Z (sporgenti ~0.3 unità) → Vanno direttamente a posizione finale avvitata
- ❌ **Step Avvita successivi**: Viti dovrebbero avvitarsi di 0.1 unità → Rimangono ferme (già in posizione finale)
- ⚠️ **Comportamento Inconsistente**: Durante smontaggio le viti si comportano correttamente
- 🎯 **Solo Riassemblaggio**: Il problema si verifica solo nella fase di rimontaggio

---

## 🔍 Analisi Tecnica

### Workflow Atteso (Riassemblaggio)

#### Step 1: Drag & Drop Intercambiabile
```ini
[Step - Riposiziona viti culatta]
Utensile=Mani
DragDrop=true
AssemblyMode=true
AllowedComponents=vite_culatta_1,vite_culatta_2,vite_culatta_3,vite_culatta_4
SnapTargets=vite_culatta_1_original,vite_culatta_2_original,vite_culatta_3_original,vite_culatta_4_original
DragDropDistance=1.5
ShowSnapIndicators=false
```

**Comportamento Atteso**:
- Utente trascina vite_culatta_1 → Snap a vite_culatta_1_original (o qualsiasi altro target libero)
- Vite si posiziona **con offset Z = +0.3 unità** (sporgente, non avvitata)
- Ripeti per tutte e 4 le viti
- Posizioni finali step: `Z_original + 0.3` (viti sporgenti)

#### Step 2-5: Avvitamento Sequenziale
```ini
[Next Step - Avvita vite culatta 1]
Elemento=models/vite_culatta_1.glb
Utensile=ChiaveBrugola
Azione1=avvita(0.1)
```

**Comportamento Atteso**:
- Vite già posizionata a `Z_original + 0.3`
- `avvita(0.1)` → Traslazione Z -0.1 + rotazione -1800°
- Posizione finale: `Z_original + 0.2` (ancora leggermente sporgente)

**Step 3-5**: Stesso processo per le altre 3 viti

---

## ❌ Comportamento Reale Osservato

### Step Drag & Drop
```javascript
// Posizioni ATTESE dopo drag&drop
vite_culatta_1.position.z: Z_original + 0.3  (es. 0.300 + 0.3 = 0.600)
vite_culatta_2.position.z: Z_original + 0.3
vite_culatta_3.position.z: Z_original + 0.3
vite_culatta_4.position.z: Z_original + 0.3

// Posizioni REALI dopo drag&drop
vite_culatta_1.position.z: Z_original        (es. 0.300 ← POSIZIONE FINALE!)
vite_culatta_2.position.z: Z_original
vite_culatta_3.position.z: Z_original
vite_culatta_4.position.z: Z_original
```

### Step Avvita Successivi
```javascript
// Viti già alla posizione finale, avvita(0.1) non ha effetto visibile
// O peggio, le viti si muovono di -0.1 dalla posizione finale andando "dentro"
```

---

## 🔍 Causa Ipotizzata

### Ipotesi 1: Snap Target _original Non Include Offset

Il sistema di riferimenti `_original` potrebbe puntare alla **posizione finale avvitata** invece che alla **posizione iniziale con offset**.

**File**: `js/scene3d-modular.js:2285-2290`
```javascript
// Sistema virtualSnapTargets per riferimenti _original
if (targetName.endsWith('_original')) {
    const originalModelName = targetName.replace('_original', '');
    const originalModel = this.findModelByName(originalModelName);

    // Problema: Usa posizione CORRENTE, non posizione con offset
    const boundingBox = new THREE.Box3().setFromObject(originalModel);
    virtualSnapTargets.set(targetName, boundingBox.getCenter(new THREE.Vector3()));
}
```

**Problema**:
- Se le viti durante smontaggio vengono posizionate alla loro posizione finale (avvitate) dal sistema di posizionamento globale
- I riferimenti `_original` puntano a quella posizione finale
- Durante drag&drop, le viti snappano alla posizione finale invece che a posizione + offset

### Ipotesi 2: Posizionamento Globale Tutorial Sovrascrive Offset

**File**: `scenes/Pompa_Becker/tutorial.txt:586-604`
```ini
# Modello 9: vite_culatta_3
Posizione=vite_culatta_3:(-0.100,-0.116,0.300)
Rotazione=vite_culatta_3:(0.0,0.0,1800.0)

# Modello 11: vite_culatta_4
Posizione=vite_culatta_4:(-0.100,-0.116,0.300)
Rotazione=vite_culatta_4:(0.0,0.0,1800.0)

# Modello 12: vite_culatta_1
Posizione=vite_culatta_1:(0.000,-0.378,0.091)
Rotazione=vite_culatta_1:(0.0,0.0,0.0)

# Modello 13: vite_culatta_2
Posizione=vite_culatta_2:(0.000,-0.378,0.091)
Rotazione=vite_culatta_2:(0.0,0.0,0.0)
```

**Problema**:
- Queste dichiarazioni globali posizionano le viti alla loro **posizione finale avvitata**
- I riferimenti `_original` salvano queste posizioni
- Durante drag&drop, le viti snappano a queste posizioni finali
- Non c'è meccanismo per aggiungere offset +0.3 per posizione sporgente

### Ipotesi 3: AssemblyMode Non Gestisce Offset Iniziale

Il sistema `AssemblyMode` potrebbe non avere supporto per posizionare componenti con un offset iniziale prima dell'avvitamento.

**File**: `js/core/AssemblySystem.js` + `DragDropSystem.js`

**Problema**:
- Sistema snap porta viti a posizione target esatta
- Non c'è parametro `SnapOffset=0.3` o simile
- Non c'è logica per applicare offset Z dopo snap completato

---

## 🧪 Test Diagnostici Richiesti

### 1. Verifica Posizioni Riferimenti _original
```javascript
// Prima di iniziare step drag&drop riassemblaggio
const vite1 = Scene3D.findModelByName('vite_culatta_1');
console.log('=== POSIZIONI RIFERIMENTI _original ===');
console.log('vite_culatta_1 position:', vite1.position);
console.log('vite_culatta_1_original dovrebbe puntare a:', vite1.position.clone());

// Verifica se sistema crea riferimento virtuale
const snapSystem = window.DragDropSystem || window.SnapSystem;
console.log('Virtual targets:', Scene3D.virtualSnapTargets);
```

### 2. Verifica Posizione Dopo Snap
```javascript
// Dopo aver fatto drag&drop di vite_culatta_1
const vite1 = Scene3D.findModelByName('vite_culatta_1');
console.log('=== POSIZIONE DOPO SNAP ===');
console.log('vite_culatta_1.position.z:', vite1.position.z);
console.log('Atteso: Z_original + 0.3 =', 'valore con offset');
console.log('Reale: Z_original =', vite1.position.z, '← PROBLEMA!');
```

### 3. Test Posizionamento Manuale con Offset
```javascript
// Test manuale: posiziona vite con offset
const vite1 = Scene3D.findModelByName('vite_culatta_1');
const originalZ = 0.300; // Posizione finale avvitata
vite1.position.z = originalZ + 0.3; // Posizione sporgente
console.log('Vite posizionata manualmente con offset:', vite1.position.z);

// Poi esegui avvita(0.1) e verifica che si muova correttamente
```

### 4. Debug Sistema Snap Target Resolution
```javascript
// Aggiungi log in DragDropSystem.js durante snap
console.log('🎯 SNAP TARGET RESOLUTION:');
console.log('  Target name:', targetName);
console.log('  Target position:', targetPosition);
console.log('  Object current position:', object.position);
console.log('  Distance to target:', currentCenter.distanceTo(targetPosition));
console.log('  Snap distance threshold:', this.snapDistance);
```

---

## 💡 Possibili Soluzioni

### Soluzione 1: Parametro SnapOffset in Tutorial

Aggiungere parametro `SnapOffset=(0,0,0.3)` per applicare offset dopo snap:

```ini
[Step - Riposiziona viti culatta]
Utensile=Mani
DragDrop=true
AssemblyMode=true
AllowedComponents=vite_culatta_1,vite_culatta_2,vite_culatta_3,vite_culatta_4
SnapTargets=vite_culatta_1_original,vite_culatta_2_original,vite_culatta_3_original,vite_culatta_4_original
SnapOffset=(0,0,0.3)  # NUOVO: Applica offset Z +0.3 dopo snap
DragDropDistance=1.5
ShowSnapIndicators=false
```

**Implementazione**:
- `DragDropSystem.js` applica offset dopo posizionamento snap
- Log: `✅ Snap completato con offset: Z +0.3`

### Soluzione 2: Dichiarazioni Posizione Pre-Avvitate

Modificare dichiarazioni globali per posizionare viti in posizione sporgente:

```ini
# Modello 12: vite_culatta_1 (posizione PRE-avvitata)
Posizione=vite_culatta_1:(0.000,-0.378,0.391)  # Z = 0.091 + 0.3 offset
Rotazione=vite_culatta_1:(0.0,0.0,0.0)

# Modello 13: vite_culatta_2 (posizione PRE-avvitata)
Posizione=vite_culatta_2:(0.000,-0.378,0.391)
Rotazione=vite_culatta_2:(0.0,0.0,0.0)
```

**Problema**: Questo cambierebbe le posizioni durante lo smontaggio (step 1-4)

### Soluzione 3: Posizioni Esplicite Step Riassemblaggio

Aggiungere dichiarazioni `Posizione=` nello step drag&drop:

```ini
[Step - Riposiziona viti culatta]
Utensile=Mani
DragDrop=true
AssemblyMode=true
AllowedComponents=vite_culatta_1,vite_culatta_2,vite_culatta_3,vite_culatta_4
SnapTargets=vite_culatta_1_original,vite_culatta_2_original,vite_culatta_3_original,vite_culatta_4_original
DragDropDistance=1.5
ShowSnapIndicators=false

# Override posizioni per questo step (con offset)
Posizione=vite_culatta_1:(0.000,-0.378,0.391)  # Z + 0.3
Posizione=vite_culatta_2:(0.000,-0.378,0.391)
Posizione=vite_culatta_3:(-0.100,-0.116,0.600)
Posizione=vite_culatta_4:(-0.100,-0.116,0.600)
```

**Problema**: Questo posiziona le viti prima del drag&drop, non dopo lo snap

### Soluzione 4: Hook Post-Snap per Applicare Offset

Implementare callback post-snap in `DragDropSystem.js`:

```javascript
// DragDropSystem.js
handleSnapComplete: function(objectName) {
    // ... snap esistente ...

    // NUOVO: Applica offset post-snap se configurato
    if (this.snapOffset) {
        const model = Scene3D.findModelByName(objectName);
        model.position.add(this.snapOffset);
        console.log(`✅ Applicato offset post-snap: ${this.snapOffset.toArray()}`);
    }
}
```

**Parsing**:
```javascript
// ui.js - parsing SnapOffset
if (step.properties.SnapOffset) {
    const match = step.properties.SnapOffset.match(/\(([^,]+),([^,]+),([^)]+)\)/);
    const offset = new THREE.Vector3(
        parseFloat(match[1]),
        parseFloat(match[2]),
        parseFloat(match[3])
    );
    window.DragDropSystem.setSnapOffset(offset);
}
```

---

## 🎯 Workflow Corretto Desiderato

### Stato Iniziale (Prima Riassemblaggio)
```javascript
// Viti posizionate "da parte" dopo smontaggio
vite_culatta_1.position: (0.0, 0.0, -0.5)  // Sul pavimento
vite_culatta_2.position: (0.0, 0.0, -0.5)
vite_culatta_3.position: (-0.1, 0.0, -0.5)
vite_culatta_4.position: (-0.1, 0.0, -0.5)
```

### Dopo Step Drag & Drop (Posizionamento Intercambiabile)
```javascript
// Viti posizionate con OFFSET +0.3 rispetto a posizione finale
vite_culatta_1.position.z: 0.391 (= 0.091 + 0.3)  ← SPORGENTE
vite_culatta_2.position.z: 0.391 (= 0.091 + 0.3)  ← SPORGENTE
vite_culatta_3.position.z: 0.600 (= 0.300 + 0.3)  ← SPORGENTE
vite_culatta_4.position.z: 0.600 (= 0.300 + 0.3)  ← SPORGENTE
```

### Dopo Step Avvita 1
```javascript
vite_culatta_1.position.z: 0.291 (= 0.391 - 0.1)  ← Avvitata parzialmente
vite_culatta_2.position.z: 0.391 (INVARIATA)
vite_culatta_3.position.z: 0.600 (INVARIATA)
vite_culatta_4.position.z: 0.600 (INVARIATA)
```

### Dopo Step Avvita 2-4 (Sequenza Completa)
```javascript
vite_culatta_1.position.z: 0.291 (avvitata -0.1)
vite_culatta_2.position.z: 0.291 (avvitata -0.1)
vite_culatta_3.position.z: 0.500 (avvitata -0.1)
vite_culatta_4.position.z: 0.500 (avvitata -0.1)
```

**Nota**: Per avvitare completamente servirebbero 3 step `avvita(0.1)` per ogni vite (totale -0.3), ma tutorial usa solo 1 step per semplicità.

---

## 📁 File Coinvolti

### Codice JavaScript
- `js/core/DragDropSystem.js:600-740` - Sistema snap e handleSnapComplete
- `js/core/SnapSystem.js:102-184` - Ricerca snap targets
- `js/scene3d-modular.js:2285-2290` - Sistema virtual snap targets _original
- `js/scene3d-modular.js:1774-1792` - Parsing comando `avvita(distanza)`
- `js/ui.js:2686-2770` - Parsing parametri DragDrop tutorial

### Configurazioni Tutorial
- `scenes/Pompa_Becker/tutorial.txt:586-604` - Posizionamento globale viti culatta (finale avvitato)
- `scenes/Pompa_Becker/tutorial.txt:856-891` - Step riassemblaggio viti culatta
- `scenes/Pompa_Becker/home_config.txt` - Configurazione `direction` viti

### Modelli 3D
- `models/vite_culatta_1.glb`
- `models/vite_culatta_2.glb`
- `models/vite_culatta_3.glb`
- `models/vite_culatta_4.glb`

---

## 🎯 Obiettivo Fix

**Requisiti**:
1. ✅ **Step Drag&Drop**: Viti si posizionano con offset Z +0.3 (sporgenti)
2. ✅ **Step Avvita 1-4**: Ogni vite si avvita di -0.1 quando selezionata
3. ✅ **Movimento Visibile**: Utente vede chiaramente le viti avvitarsi gradualmente
4. ✅ **Intercambiabilità**: Viti possono essere posizionate in ordine libero (AssemblyMode)
5. ✅ **Zero Breaking Changes**: Smontaggio (step 1-4) continua a funzionare normalmente

**Successo**:
- Dopo drag&drop: vite_culatta_1 a Z=0.391 (sporgente)
- Dopo avvita(0.1): vite_culatta_1 a Z=0.291 (avvitata parzialmente)
- Movimento fluido e realistico dell'avvitamento

---

## 📊 Log Console Attesi vs Reali

### Log Attesi (Comportamento Corretto)
```javascript
// Step Drag & Drop
[DragDropSystem] Utente trascina "vite_culatta_1"
[DragDropSystem] 🎯 Target snap trovato: "vite_culatta_1_original" → (0.000, -0.378, 0.091)
[DragDropSystem] ✅ Snap completato
[DragDropSystem] ✅ Applicato offset post-snap: (0, 0, 0.3)
[DragDropSystem] Posizione finale: (0.000, -0.378, 0.391) ← SPORGENTE
✅ vite_culatta_1 posizionata con offset

// Step Avvita 1
[UI] Esecuzione step: "Avvita vite culatta 1"
[Scene3D] Animazione avvita: traslazione Z -0.1
✅ vite_culatta_1.position.z: 0.391 → 0.291 (avvitata)
```

### Log Reali (Comportamento Errato)
```javascript
// Step Drag & Drop
[DragDropSystem] Utente trascina "vite_culatta_1"
[DragDropSystem] 🎯 Target snap trovato: "vite_culatta_1_original" → (0.000, -0.378, 0.091)
[DragDropSystem] ✅ Snap completato
❌ Posizione finale: (0.000, -0.378, 0.091) ← POSIZIONE FINALE (senza offset!)

// Step Avvita 1
[UI] Esecuzione step: "Avvita vite culatta 1"
[Scene3D] Animazione avvita: traslazione Z -0.1
❌ vite_culatta_1.position.z: 0.091 → -0.009 (va DENTRO invece di avvitarsi!)
```

---

## 📞 Informazioni Aggiuntive

Per ulteriori dettagli vedere:
- `CLAUDE.md:1122-1250` - Sistema Snap a Coordinate Arbitrarie
- `CLAUDE.md:1251-1356` - Sistema Snap Targets Multipli Intercambiabili
- `CLAUDE.md:1357-1428` - Sintassi Semplificata SnapTargets/SnapPoint Globale
- `CLAUDE.md:686-838` - Sistema Assemblaggio Sequenziale
- `console.txt` - Log debug completi step riassemblaggio

---

**Status**: 🔴 **BLOCCANTE** - Il riassemblaggio viti culatta è l'ultima fase critica del tutorial. Senza posizionamento corretto con offset, l'utente non può completare l'esperienza di training in modo realistico.

**Priorità Investigazione**:
1. ⭐⭐⭐ Implementare parametro `SnapOffset` in DragDropSystem (soluzione più pulita)
2. ⭐⭐ Verificare logica riferimenti `_original` durante riassemblaggio
3. ⭐ Considerare dichiarazioni posizione esplicite per step specifico (workaround temporaneo)

**Soluzione Raccomandata**: **Soluzione 4** (Hook Post-Snap) - Più flessibile, compatibile con sistema esistente, zero breaking changes.
