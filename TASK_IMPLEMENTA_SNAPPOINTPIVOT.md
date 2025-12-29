# Task: Implementazione Supporto SnapPointPivot in DragDropSystem.js

**Data**: 17 Gennaio 2026
**Priorità**: Alta
**Complessità**: Media
**File da modificare**: `js/core/DragDropSystem.js`

---

## 📋 Contesto del Problema

Il sistema `SnapPointPivot` è **parzialmente implementato**:

✅ **Funziona il parsing** (ui.js):
- Il parametro `SnapPointPivot=(x,y,z)` viene letto correttamente dal tutorial
- Il flag `usePivot: true` viene impostato nella configurazione
- Il metodo `setCustomSnapPositionPivot(objectName, x, y, z)` salva correttamente la config

❌ **NON funziona lo snap effettivo** (DragDropSystem.js):
- Il flag `usePivot` viene **completamente ignorato** durante lo snap
- Il sistema usa sempre **centro bounding box** invece del **pivot + offset**
- File: `DragDropSystem.js` linee **1330-1520** (funzioni `isNearAnySnapZone` e `findSnapTarget`)

---

## 🤔 Perché Serve Questa Modifica?

### Problema Visivo: Centro BB vs Pivot

I modelli 3D in Three.js hanno **due riferimenti spaziali diversi**:

1. **`object.position`** (PIVOT) = Punto di origine del modello, definito in Blender/3D software
2. **Centro Bounding Box** (CENTRO BB) = Centro geometrico della mesh calcolato da Three.js

**Questi NON coincidono quasi mai!** Ecco perché:

#### Esempio Pratico: Vite Flangia

```
Modello: vite_flangia_1.glb

┌─────────────────────────────────┐
│                                 │
│         Centro BB (calcolato)   │  ← Three.js calcola centro geometrico
│              ↓                  │
│         ┌────●────┐             │
│         │ Geometria│             │
│         │   Vite   │             │
│         └─────────┘              │
│              ●                   │  ← object.position (pivot) = origine in Blender
│           (pivot)                │
│                                 │
│  Offset = Centro BB - Pivot     │
│         = (0, 0.05, 0)          │  ← Distanza tra i due punti!
└─────────────────────────────────┘
```

**Offset tipico**:
- Viti: pivot alla base, centro BB a metà altezza (offset Y ~0.05m)
- Coperchi: pivot al bordo, centro BB al centro (offset X,Y ~0.02-0.1m)
- Filtri: pivot alla flangia, centro BB dentro il cilindro (offset variabile)

### Cosa Succede SENZA il Fix

**Scenario**: Vuoi che il **pivot** della vite vada a (0, 0.5, 0.3)

```ini
SnapPointPivot=(0.0, 0.5, 0.3)  # Coordinate target
```

**Comportamento ATTUALE (BUG)**:

1. Sistema calcola distanza dal **centro BB** (non pivot!)
2. Centro BB vite: `(0.1, 0.55, 0.3)` (pivot + offset)
3. Target: `(0.0, 0.5, 0.3)`
4. Distanza calcolata: `√[(0.1-0)² + (0.55-0.5)² + 0²] = 0.112m`
5. Se `DragDropDistance=0.1`, **NON FA SNAP** (0.112 > 0.1) ❌
6. Anche se fa snap, il **pivot finisce spostato** di `(0.1, 0.05, 0)` ❌

**Risultato visivo**: La vite **NON si posiziona dove richiesto** - è sempre spostata dell'offset!

### Cosa Succede CON il Fix

**Comportamento CORRETTO (FIX)**:

1. Sistema rileva `usePivot=true`
2. Calcola distanza dal **pivot** (non centro BB!)
3. Pivot vite: `(0.0, 0.5, 0.3)`
4. Target: `(0.0, 0.5, 0.3)`
5. Distanza calcolata: `0.000m` ✅
6. FA SNAP e il **pivot finisce esattamente** a `(0.0, 0.5, 0.3)` ✅

**Risultato visivo**: La vite si posiziona **esattamente dove richiesto**, rispettando il punto di ancoraggio del modello 3D!

### Caso d'Uso Reale: Tutorial Pompa Becker

**Problema dell'utente**:
> "Vorrei che le viti nello step [Next Step - Posiziona Viti Flangia] non snappassero alla loro posizione originale ma a quella originale + offset in z di 0.2 m"

**Perché serve**:
- Le viti devono essere posizionate **sopra la flangia** (sollevate di 0.2m)
- Poi verranno abbassate durante l'avvitamento
- Questo simula il montaggio reale: prima inserisci la vite (sollevata), poi la avviti (scende)

**Con SnapTargets (sistema attuale)**:
```ini
SnapTargets=vite_flangia_1_original
# Snap al centro BB della posizione originale
# ❌ Non puoi aggiungere offset perché il sistema non lo supporta
```

**Con SnapPointPivot (dopo il fix)**:
```ini
SnapPointPivot=(0.0, 0.5, 0.3)
# Snap al PIVOT, coordinate dirette con offset
# ✅ Controllo preciso della posizione di ancoraggio
```

### Differenza Visiva Finale

**SnapPoint (usa centro BB)**:
```
  Target (0,0.5,0.3)
       ↓
   ┌───●───┐         ← Centro geometrico della vite qui
   │ Vite  │
   └───────┘
       ●               ← Pivot (base vite) finisce SOTTO target
```

**SnapPointPivot (usa pivot)**:
```
   ┌───────┐         ← Centro geometrico della vite SOPRA
   │ Vite  │
   └───────┘
       ●               ← Pivot (base vite) ESATTAMENTE al target
       ↑
  Target (0,0.5,0.3)
```

### Perché il Fix è Necessario

1. **Controllo Preciso**: Tutorial richiedono posizionamento esatto del punto di ancoraggio (es. base vite, bordo coperchio)
2. **Offset Geometrici**: Modelli 3D hanno pivot non centrati per design (definiti in Blender)
3. **Simulazione Realistica**: Montaggio meccanico richiede allineamento al pivot, non al centro massa
4. **Compatibilità Blender**: Artisti 3D definiscono pivot logici (base, flangia, centro rotazione), non centri geometrici
5. **Feature Documentata**: `SnapPointPivot` è già documentato e promesso agli utenti, deve funzionare!

### Impatto Performance

✅ **Zero overhead**: `object.position` è già disponibile, nessun calcolo aggiuntivo
✅ **Backward compatible**: SnapPoint normale (centro BB) continua a funzionare
✅ **Opt-in**: Solo chi usa SnapPointPivot attiva il nuovo comportamento

---

## 🎯 Obiettivo

Implementare la logica che **usa effettivamente il flag `usePivot`** per calcolare lo snap usando il **pivot dell'oggetto** invece del **centro del bounding box**.

### Differenza Comportamento

| Parametro | Comportamento Attuale (BUG) | Comportamento Desiderato (FIX) |
|-----------|----------------------------|-------------------------------|
| `SnapPoint=(x,y,z)` | Centro BB → coordinate | Centro BB → coordinate ✅ |
| `SnapPointPivot=(x,y,z)` | Centro BB → coordinate ❌ | **Pivot** → coordinate ✅ |

---

## 🔍 Analisi Codice Attuale

### Dove viene salvato il flag `usePivot`

**File**: `DragDropSystem.js` linea **2545**

```javascript
setCustomSnapPositionPivot: function(objectName, x, y, z) {
    const object = window.Scene3D.findModelByName(objectName);
    if (!object) {
        console.warn(`[DragDropSystem] 🔴 Oggetto "${objectName}" NON TROVATO`);
        return;
    }

    const config = {
        directPosition: new THREE.Vector3(x, y, z),
        isDirectPosition: true,
        usePivot: true  // ← FLAG IMPOSTATO MA MAI USATO!
    };

    this.customSnapTargets.set(object.uuid, config);
    console.log(`[DragDropSystem] 📍✅ Snap PIVOT configurato per "${objectName}"`);
}
```

### Dove il flag viene IGNORATO

**File**: `DragDropSystem.js` linee **1330-1520**

#### Funzione 1: `isNearAnySnapZone` (linea 1322-1367)

```javascript
isNearAnySnapZone: function(object) {
    const currentBoundingBox = new THREE.Box3().setFromObject(object);
    const currentCenter = currentBoundingBox.getCenter(new THREE.Vector3()); // ← USA SEMPRE CENTRO BB

    const customTarget = this.customSnapTargets.get(object.uuid);
    if (customTarget) {
        let targetPosition = null;

        // Coordinate dirette (x,y,z)
        if (customTarget.isDirectPosition && customTarget.directPosition) {
            targetPosition = customTarget.directPosition.clone();

            // ❌ QUI MANCA IL CHECK: if (customTarget.usePivot) { usa object.position invece di currentCenter }
        }

        if (targetPosition) {
            const distance = currentCenter.distanceTo(targetPosition); // ← SEMPRE CENTRO BB, MAI PIVOT
            return distance <= this.snapDistance * 1.5;
        }
    }
    // ...
}
```

#### Funzione 2: `findSnapTarget` (linea 1374-1543)

Stesso problema - usa sempre `currentCenter` (centro BB) invece di controllare `customTarget.usePivot`.

**Linee critiche**:
- **1378**: `const currentCenter = currentBoundingBox.getCenter(new THREE.Vector3());` ← calcola centro BB
- **1449**: `const distance = currentCenter.distanceTo(targetPosition);` ← usa centro BB per multi-target
- **1526-1530**: `const distance = currentCenter.distanceTo(targetPosition);` ← usa centro BB per single-target

---

## ✅ Soluzione da Implementare

### Modifica 1: Calcola `currentPosition` dinamicamente

Invece di usare **sempre** `currentCenter`, calcola `currentPosition` in base al flag `usePivot`:

```javascript
// PRIMA (attuale - sbagliato)
const currentBoundingBox = new THREE.Box3().setFromObject(object);
const currentCenter = currentBoundingBox.getCenter(new THREE.Vector3());
const distance = currentCenter.distanceTo(targetPosition);

// DOPO (fix)
const currentBoundingBox = new THREE.Box3().setFromObject(object);
const currentCenter = currentBoundingBox.getCenter(new THREE.Vector3());

// Determina quale posizione usare in base al flag usePivot
let currentPosition;
if (customTarget && customTarget.usePivot) {
    currentPosition = object.position.clone(); // Usa PIVOT
    console.log(`[DragDropSystem] 📍 Usando PIVOT per "${object.name}": (${currentPosition.x.toFixed(3)}, ${currentPosition.y.toFixed(3)}, ${currentPosition.z.toFixed(3)})`);
} else {
    currentPosition = currentCenter; // Usa CENTRO BB (default)
}

const distance = currentPosition.distanceTo(targetPosition);
```

### Modifica 2: Funzione `isNearAnySnapZone` (linea ~1322)

**Dove**: Dopo linea 1328, prima di calcolare distanza

**Codice da aggiungere**:

```javascript
isNearAnySnapZone: function(object) {
    if (!object) return false;

    // Calcola centro bounding box
    const currentBoundingBox = new THREE.Box3().setFromObject(object);
    const currentCenter = currentBoundingBox.getCenter(new THREE.Vector3());

    // 1. Controlla target personalizzati
    const customTarget = this.customSnapTargets.get(object.uuid);
    if (customTarget) {
        let targetPosition = null;

        // Coordinate dirette (x,y,z)
        if (customTarget.isDirectPosition && customTarget.directPosition) {
            targetPosition = customTarget.directPosition.clone();
        }
        // ... (altri casi)

        if (targetPosition) {
            // ✅ NUOVO: Determina posizione in base a usePivot
            let currentPosition;
            if (customTarget.usePivot) {
                currentPosition = object.position.clone(); // Usa PIVOT
                console.log(`[DragDropSystem] 📍 isNearAnySnapZone: Usando PIVOT per "${object.name}"`);
            } else {
                currentPosition = currentCenter; // Usa CENTRO BB (default)
            }

            const distance = currentPosition.distanceTo(targetPosition);
            return distance <= this.snapDistance * 1.5;
        }
    }

    // 2. Controlla posizione originale salvata
    const originalPos = this.originalPositions.get(object.uuid);
    if (originalPos) {
        // Nota: per originalPos usa sempre centro BB (non ha flag usePivot)
        const distance = currentCenter.distanceTo(originalPos);
        return distance <= this.snapDistance * 1.5;
    }

    return false;
}
```

### Modifica 3: Funzione `findSnapTarget` - Multi-Target (linea ~1385)

**Dove**: Dopo linea 1392, all'interno del loop `forEach`

**Codice da modificare**:

```javascript
// Multi-target intercambiabili
if (customTarget.isMultiTarget && customTarget.targets) {
    customTarget.targets.forEach((target, index) => {
        let targetPosition = null;

        // ... (calcolo targetPosition)

        if (targetPosition) {
            // ✅ NUOVO: Determina posizione in base a usePivot
            let currentPosition;
            if (customTarget.usePivot) {
                currentPosition = object.position.clone(); // Usa PIVOT
                console.log(`[DragDropSystem] 📍 findSnapTarget (multi): Usando PIVOT per "${object.name}": (${currentPosition.x.toFixed(3)}, ${currentPosition.y.toFixed(3)}, ${currentPosition.z.toFixed(3)})`);
            } else {
                currentPosition = currentCenter; // Usa CENTRO BB (default)
            }

            const distance = currentPosition.distanceTo(targetPosition);
            console.log(`[DragDropSystem] 📏 Target ${index + 1}: distanza=${distance.toFixed(3)}`);

            if (distance <= this.snapDistance && distance < closestDistance) {
                closestTarget = targetPosition;
                closestDistance = distance;
                closestTargetName = target.targetName;
            }
        }
    });
    // ...
}
```

### Modifica 4: Funzione `findSnapTarget` - Single Target (linea ~1472)

**Dove**: Dopo linea 1519, prima di calcolare distanza

**Codice da modificare**:

```javascript
// Single target
else {
    let targetPosition = null;
    let positionKey = null;

    // Coordinate dirette (x,y,z)
    if (customTarget.isDirectPosition && customTarget.directPosition) {
        targetPosition = customTarget.directPosition.clone();
        positionKey = this.createSnapPositionKey(null, targetPosition);
    }
    // ... (altri casi)

    if (targetPosition) {
        // Verifica occupazione
        if (positionKey && this.isSnapPositionOccupied(positionKey, object)) {
            console.log(`[DragDropSystem] 🚫 Snap position già occupata`);
            return null;
        }

        // ✅ NUOVO: Determina posizione in base a usePivot
        let currentPosition;
        if (customTarget.usePivot) {
            currentPosition = object.position.clone(); // Usa PIVOT
            console.log(`[DragDropSystem] 📍 findSnapTarget (single): Usando PIVOT per "${object.name}": (${currentPosition.x.toFixed(3)}, ${currentPosition.y.toFixed(3)}, ${currentPosition.z.toFixed(3)})`);
        } else {
            currentPosition = currentCenter; // Usa CENTRO BB (default)
        }

        const distance = currentPosition.distanceTo(targetPosition);

        if (distance <= this.snapDistance) {
            console.log(`[DragDropSystem] 🧲 Snap disponibile: distanza=${distance.toFixed(2)}`);
            if (positionKey) {
                this.snapPositionKeys.set(targetPosition, positionKey);
            }
            return targetPosition;
        }
    }
}
```

---

## 🧪 Testing

### Test Case 1: SnapPointPivot con Coordinate Dirette

**Tutorial**:
```ini
[Step Test - Posiziona Viti]
DragDrop=true
DragDropObjects=vite_flangia_1,vite_flangia_2
SnapPointPivot=(0.0, 0.5, 0.3)
DragDropDistance=1.5
```

**Comportamento Atteso**:
1. Sistema calcola distanza da `object.position` (pivot) invece di centro BB
2. Quando trascini vite vicino a (0.0, 0.5, 0.3), fa snap
3. Il **pivot** della vite si posiziona esattamente a (0.0, 0.5, 0.3)
4. Console mostra: `📍 Usando PIVOT per "vite_flangia_1": (0.000, 0.500, 0.300)`

### Test Case 2: SnapPoint vs SnapPointPivot

**Tutorial**:
```ini
[Step A - Con SnapPoint]
SnapPoint=(0.0, 0.5, 0.3)
# Risultato: CENTRO BB → (0.0, 0.5, 0.3)

[Step B - Con SnapPointPivot]
SnapPointPivot=(0.0, 0.5, 0.3)
# Risultato: PIVOT → (0.0, 0.5, 0.3)
```

**Verifica Visiva**:
- Se il modello ha pivot offset rispetto al centro geometrico, i due step posizionano l'oggetto in punti **diversi**
- SnapPoint: centro geometrico a (0, 0.5, 0.3)
- SnapPointPivot: origine del modello (pivot point) a (0, 0.5, 0.3)

### Test Case 3: Backward Compatibility

**Tutorial con SnapPoint normale**:
```ini
SnapPoint=(1.0, 0.0, 0.0)
```

**Verifica**:
- Sistema NON deve usare pivot (customTarget.usePivot è undefined/false)
- Usa centro BB come sempre
- Zero breaking changes

---

## 📊 Log Console Debug Attesi

**Prima (BUG)**:
```
[DragDropSystem] 📦 Custom snap target (coordinate dirette): (0.000, 0.500, 0.300)
📏 DISTANZA: centro BB → target = 0.234 unità
```

**Dopo (FIX)**:
```
[DragDropSystem] 📦 Custom snap target (coordinate dirette): (0.000, 0.500, 0.300)
[DragDropSystem] 📍 Usando PIVOT per "vite_flangia_1": (0.123, 0.456, 0.289)
📏 DISTANZA: PIVOT → target = 0.234 unità
```

---

## ⚠️ Note Importanti

1. **Non modificare il calcolo del centro BB**: Serve ancora per casi normali (SnapPoint senza Pivot)

2. **Usa `object.position.clone()`**: Non modificare direttamente `object.position`

3. **Mantieni backward compatibility**: Se `usePivot` è `undefined` o `false`, usa centro BB

4. **Log chiari**: Aggiungi log che mostrano quando usa PIVOT vs CENTRO BB per debug

5. **Performance**: Il calcolo del pivot è già disponibile (`object.position`), zero overhead

6. **Multi-target**: Anche i target multipli devono supportare usePivot

---

## 📁 File Allegati Necessari

Per completare il task, allega a Opus:
1. ✅ Questo file `TASK_IMPLEMENTA_SNAPPOINTPIVOT.md`
2. ✅ `js/core/DragDropSystem.js` (file da modificare)
3. ⚠️ Opzionale: `NUOVE_FUNZIONALITA_SNAPPOINTPIVOT.md` (documentazione funzionalità)

---

## 🎯 Deliverable Finale

Dopo le modifiche, il file `DragDropSystem.js` deve:

✅ Supportare flag `usePivot` in tutte le funzioni di snap detection
✅ Usare `object.position` quando `usePivot=true`
✅ Usare `currentCenter` (centro BB) quando `usePivot=false` o `undefined`
✅ Log console chiari che mostrano quale metodo viene usato
✅ Zero breaking changes per tutorial esistenti
✅ Test superati per tutti e 3 i test case sopra

---

## 📝 Checklist Implementazione

- [ ] Modifica `isNearAnySnapZone` (linea ~1322)
- [ ] Modifica `findSnapTarget` - caso multi-target (linea ~1385)
- [ ] Modifica `findSnapTarget` - caso single-target (linea ~1472)
- [ ] Aggiungi log debug "Usando PIVOT" vs "Usando CENTRO BB"
- [ ] Testa con SnapPointPivot=(0,0,0.3)
- [ ] Testa backward compatibility con SnapPoint normale
- [ ] Verifica che offset pivot funzioni correttamente

---

**Fine del documento**
