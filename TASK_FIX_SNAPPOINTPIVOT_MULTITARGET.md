# Task URGENTE: Fix SnapPointPivot Multi-Target in SnapSystem.js

**Data**: 17 Gennaio 2026
**Priorità**: CRITICA
**File da modificare**: `js/core/SnapSystem.js`
**Problema**: Multi-target NON usa `usePivot`, single-target SÌ

---

## 🔴 Problema Critico

Il fix `usePivot` è stato implementato **solo per single-target** (linea 278), ma **NON per multi-target** (linea 182).

Quando il tutorial usa `SnapPointPivot` con formato globale (multipli punti), il sistema crea **multi-target** e quindi usa il codice BUGGATO.

---

## 📍 Dove è il Bug

**File**: `js/core/SnapSystem.js`
**Funzione**: `findSnapTarget`
**Linea**: ~182 (dentro il loop `customTarget.targets.forEach`)

### Codice ATTUALE (BUGGATO)

```javascript
// Linea ~102-190 - Caso Multi-Target
if (customTarget.isMultiTarget && customTarget.targets) {
    console.log(`[SnapSystem] 🔄 Verifica ${customTarget.targets.length} snap targets intercambiabili`);

    let closestTarget = null;
    let closestDistance = Infinity;
    let closestTargetName = null;

    customTarget.targets.forEach((target, index) => {
        let targetPosition = null;

        // ... (calcolo targetPosition) ...

        if (targetPosition) {
            // ❌ BUG: USA SEMPRE currentCenter INVECE DI CONTROLLARE usePivot!
            const distance = currentCenter.distanceTo(targetPosition);  // LINEA 182

            if (distance <= this.snapDistance && distance < closestDistance) {
                closestTarget = targetPosition;
                closestDistance = distance;
                closestTargetName = target.targetName;
            }
        }
    });
}
```

### Codice CORRETTO (Single-Target funzionante)

```javascript
// Linea ~206-284 - Caso Single-Target (GIÀ CORRETTO)
else {
    let usePivotMode = customTarget.usePivot || false;  // ✅ Flag impostato

    // ... (calcolo targetPosition) ...

    if (targetPosition) {
        // ✅ CORRETTO: Controlla usePivotMode!
        const referencePoint = usePivotMode ? currentPos : currentCenter;  // LINEA 278
        const distance = referencePoint.distanceTo(targetPosition);
    }
}
```

---

## ✅ Soluzione

**Applica lo stesso fix del single-target al multi-target.**

### Modifica Richiesta

**Posizione**: Dentro il loop `customTarget.targets.forEach`, prima di calcolare la distanza

**Codice da sostituire** (linea ~182):

```javascript
if (targetPosition) {
    const distance = currentCenter.distanceTo(targetPosition);  // ❌ RIMUOVI QUESTA LINEA
    console.log(`[SnapSystem] 📏 Target ${index + 1}/${customTarget.targets.length}: "${target.targetName}" - Distanza: ${distance.toFixed(3)}`);
```

**Codice NUOVO**:

```javascript
if (targetPosition) {
    // ✅ NUOVO: Determina posizione di riferimento in base a usePivot
    let referencePoint;
    if (customTarget.usePivot) {
        referencePoint = currentPos;  // Usa PIVOT
        console.log(`[SnapSystem] 📍 Multi-target: Usando PIVOT per "${object.name}": (${currentPos.x.toFixed(3)}, ${currentPos.y.toFixed(3)}, ${currentPos.z.toFixed(3)})`);
    } else {
        referencePoint = currentCenter;  // Usa CENTRO BB (default)
    }

    const distance = referencePoint.distanceTo(targetPosition);
    console.log(`[SnapSystem] 📏 Target ${index + 1}/${customTarget.targets.length}: "${target.targetName}" - Distanza: ${distance.toFixed(3)}`);
```

---

## 🔍 Verifica Implementazione

### Prima del Fix

**Log Console**:
```
[SnapSystem] 🔄 Verifica 4 snap targets intercambiabili per "vite_flangia_6"
[SnapSystem] 🔍🔍🔍 findSnapTarget per "vite_flangia_6" - Centro BB: (-0.033, 0.101, 0.181)
[SnapSystem] 📍 Target snap_pivot_3_original (VIRTUALE): posizione=(-0.100,-0.137,0.300)
[SnapSystem] 📏 Target 4/4: "snap_pivot_3_original" - Distanza: 0.274
# ❌ NESSUN LOG "Usando PIVOT" → usa centro BB
```

**Risultato Visivo**: Viti snappano alla posizione finale (Z basso), non sollevate

### Dopo il Fix

**Log Console Atteso**:
```
[SnapSystem] 🔄 Verifica 4 snap targets intercambiabili per "vite_flangia_6"
[SnapSystem] 🔍🔍🔍 findSnapTarget per "vite_flangia_6" - Centro BB: (-0.033, 0.101, 0.181)
[SnapSystem] 📍 Multi-target: Usando PIVOT per "vite_flangia_6": (-0.100, -0.137, 0.100)  # ✅ NUOVO LOG
[SnapSystem] 📍 Target snap_pivot_3_original (VIRTUALE): posizione=(-0.100,-0.137,0.300)
[SnapSystem] 📏 Target 4/4: "snap_pivot_3_original" - Distanza: 0.200
# ✅ Log mostra "Usando PIVOT" e distanza calcolata da pivot (0.200 invece di 0.274)
```

**Risultato Visivo**: Viti snappano alla posizione sollevata (Z=0.300), come richiesto

---

## 🎯 Test Case

**Tutorial**: `scenes/Pompa_Becker/tutorial.txt` - Step "Posiziona Viti Flangia"

**Configurazione**:
```ini
SnapPointPivot=(0.000,-0.267,0.300),(0.000,-0.321,0.300),(-0.100,-0.191,0.300),(-0.100,-0.137,0.300)
```

**Comportamento Atteso Dopo Fix**:
1. Trascina `vite_flangia_1` vicino a un foro
2. Sistema rileva `usePivot=true` per multi-target
3. Calcola distanza da `currentPos` (pivot) invece di `currentCenter` (centro BB)
4. Vite snappa con **pivot** a Z=0.300 (sollevato di 0.2m)
5. Visivamente: vite **sopra** la flangia, non inserita nei fori

**Verifica Console**:
```javascript
// Cerca questo log:
"📍 Multi-target: Usando PIVOT per \"vite_flangia_1\""

// Se presente → fix funziona ✅
// Se assente → fix NON applicato ❌
```

---

## 📊 Confronto Coordinate

**Vite in posizione "smontata"** (partenza):
- Pivot: `(-0.100, -0.137, 0.100)` ← Questo è object.position
- Centro BB: `(-0.033, 0.101, 0.181)` ← Questo è currentCenter

**Target snap**:
- `(-0.100, -0.137, 0.300)` ← Coordinate SnapPointPivot

**Distanze**:
- **Da PIVOT**: `√[(0)² + (0)² + (0.2)²] = 0.200` ← CORRETTO ✅
- **Da CENTRO BB**: `√[(0.067)² + (0.238)² + (0.119)²] = 0.274` ← SBAGLIATO ❌

Con `DragDropDistance=1.5`, entrambe le distanze sono sotto soglia, quindi fa snap in entrambi i casi. Ma:
- Snap da **PIVOT** → vite posizionata **correttamente** a Z=0.300
- Snap da **CENTRO BB** → vite posizionata **scorrettamente** (centro BB a target, pivot spostato)

---

## ⚠️ Note Importanti

1. **Non modificare il caso single-target**: È già corretto (linea 278)

2. **Usa `customTarget.usePivot`**: Il flag è già disponibile nel multi-target (stesso oggetto customTarget)

3. **Mantieni i log esistenti**: Aggiungi solo il log "Usando PIVOT", non rimuovere gli altri

4. **Variable naming**: Usa `referencePoint` (stessa variabile del single-target) per consistenza

5. **Backward compatibility**: Se `usePivot` è `undefined` o `false`, usa `currentCenter` (default)

---

## 📁 File da Modificare

Solo: `js/core/SnapSystem.js`

**NON** modificare:
- DragDropSystem.js (già gestito dal task principale)
- ui.js (parsing già corretto)
- Altri file

---

## 🚀 Priorità

**CRITICA** - Il tutorial NON funziona senza questo fix!

L'utente ha già verificato che le viti snappano alla posizione sbagliata (finale invece di sollevata). Questo blocca completamente la funzionalità richiesta.

---

**Fine del documento**
