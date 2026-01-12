# Piano Refactoring & Pulizia Progetto
**Data**: 17 Gennaio 2026
**Obiettivo**: Ridurre complessità, migliorare manutenibilità, eliminare file obsoleti

---

## 🎯 PRIORITÀ 1: File da Eliminare IMMEDIATAMENTE

### File Debug/Temporanei (18 file)
```
console.txt
console1.txt
problema.txt
bachi.txt
dafare.txt
test_mesh.txt
step.txt
remote.txt
risultati.txt
nuovarichiesta.txt
nuovatelecamera.txt
nuovefunzioni.txt
oggettinascosti.txt
interazione_pulsante_remote.txt
logicaschermi.txt
scarico_utensile.txt
requisiti_funzionali.txt
```
**Motivo**: File di debug/appunti temporanei, informazioni già integrate in CLAUDE.md

### File Posizioni Modelli Obsoleti (4 file)
```
model_positions unito_20251201_145625.txt
model_positions_20251201_074134.txt
model_positions_aperto_20251201_145715.txt
model_positions_iniziale20251205_075210.txt
```
**Motivo**: Posizioni vecchie, ora gestite in home_config.txt

### File HTML di Test Obsoleti (9 file)
```
debug_original_positions.html
sync_test.html
test_debug_fix.html
test_drag_enable.html
test_interchangeable_snap.html
test_refactoring.html
test_riassemblaggio_fix.html
test_simplified_assembly.html
```
**Motivo**: Test temporanei per feature già implementate e testate

### Documentazione Markdown Obsoleta (7 file)
```
ANALISI_TUTORIAL.md
CRITICITA_VITI.md
FIX_AVVITAMENTO_VITI.md
NUOVE_FUNZIONALITA_SNAPPOINTPIVOT.md
TASK_FIX_SNAPPOINTPIVOT_MULTITARGET.md
TASK_IMPLEMENTA_SNAPPOINTPIVOT.md
TUTORIAL_REVERSE_COMPLETATO.md
TUTORIAL_REVERSE_V2_MODIFICHE.md
```
**Motivo**: Informazioni storiche/task completati, già documentati in CLAUDE.md

### File da MANTENERE (root)
```
✅ index.html                                    # Entry point principale
✅ home_config.txt                               # Configurazione modelli
✅ Users.txt                                     # Utenti (prod)
✅ CLAUDE.md                                     # Documentazione master
✅ GUIDA_COMANDI_TUTORIAL.md                    # Riferimento comandi
✅ CHEAT_SHEET.html                             # Quick reference
✅ MANUALE_COMPLETO_CAMPUS_VIRTUAL_TRAINING.html # Manuale completo
✅ MANUALE_PRESENTAZIONE.html                   # Manuale demo
```

---

## 🔧 PRIORITÀ 2: Refactoring scene3d-modular.js (233KB → ~50KB)

### Problema Attuale
File monolitico con 4600+ righe che gestisce:
- Rendering 3D
- Animazioni
- Parsing movimento
- Camera
- Modelli
- Eventi mouse
- Particelle
- Sistema drag & drop (inline)

### Piano Refactoring

#### Step 1: Estrarre Sistema Parsing Movimento
**Nuovo file**: `js/core/MovementParser.js` (~800 righe)
```javascript
window.MovementParser = {
    parseMovementSteps(tutorialStep, modelFilename),
    parseMovementStepString(stepString, stepIndex, modelFilename),
    parseMovementOperation(operationString, type, modelFilename),
    // ... tutte le funzioni parse*
};
```

**Righe da migrare**: 2244-3050 (~800 righe)

#### Step 2: Estrarre Sistema Animazioni Multi-Step
**Nuovo file**: `js/core/MultiStepAnimationSystem.js` (~600 righe)
```javascript
window.MultiStepAnimationSystem = {
    startMultiStepMovement(model, movementSteps, slaveObjects, drivenObjectsConfig),
    executeCurrentMultiStep(modelUuid),
    onMultiStepCompleted(modelUuid),
    finishMultiStepMovement(modelUuid),
    // ... tutte le funzioni multi-step
};
```

**Righe da migrare**: 2640-3200 (~600 righe)

#### Step 3: Estrarre Sistema Eventi Mouse/Touch
**Nuovo file**: `js/core/InputHandler.js` (~400 righe)
```javascript
window.InputHandler = {
    onMouseDown(event),
    onMouseMove(event),
    onMouseUp(event),
    onTouchStart(event),
    onTouchMove(event),
    onTouchEnd(event),
    handleModelClick(intersectedObject),
    // ... tutte le funzioni input
};
```

**Righe da migrare**: 400-800 (~400 righe)

#### Step 4: Estrarre Calcoli Geometrici
**Nuovo file**: `js/core/GeometryUtils.js` (~300 righe)
```javascript
window.GeometryUtils = {
    calculateBoundingBoxCenter(model),
    calculateModelCenter(model),
    getModelDirection(modelFilename),
    applyRotationBasedOnDirection(targetRotation, direction, rotationAmount),
    calculateRotationCenterForStep(model, currentStep),
    // ... tutte le funzioni geometriche
};
```

**Righe da migrare**: Sparse (~300 righe)

#### Step 5: Scene3D Core Ridotto
**File finale**: `js/scene3d-modular.js` (~50KB, ~1000 righe)
```javascript
window.Scene3D = {
    // SOLO:
    // - init()
    // - render loop
    // - coordinate sistemi (delegazione)
    // - API pubbliche minime
};
```

### Architettura Post-Refactoring
```
scene3d-modular.js (1000 righe)
├── MovementParser.js (800 righe) → parse azioni tutorial
├── MultiStepAnimationSystem.js (600 righe) → gestione multi-step
├── InputHandler.js (400 righe) → mouse/touch events
├── GeometryUtils.js (300 righe) → calcoli geometrici
├── AnimationSystem.js (già esistente)
├── CameraControls.js (già esistente)
├── DragDropSystem.js (già esistente)
├── ModelManager.js (già esistente)
└── ParticleSystem.js (già esistente)
```

---

## 🔧 PRIORITÀ 3: Refactoring ui.js (236KB → ~60KB)

### Problema Attuale
File monolitico con 5000+ righe che gestisce:
- Inizializzazione UI
- Login
- Scenario selection
- Tutorial parsing (ENORME)
- Step execution
- AutoExecute
- Modal
- Feedback
- Navigation

### Piano Refactoring

#### Step 1: Estrarre Tutorial Parser
**Nuovo file**: `js/ui/TutorialParser.js` (~1500 righe)
```javascript
window.TutorialParser = {
    parseTutorialFile(content),
    parseStep(stepLines),
    parseGlobalProperties(lines),
    parseScreenDefinitions(lines),
    parseStateGroups(lines),
    parseInteractiveObjects(lines),
    // ... tutte le funzioni parsing tutorial
};
```

**Righe da migrare**: 1900-3400 (~1500 righe)

#### Step 2: Estrarre Step Executor
**Nuovo file**: `js/ui/StepExecutor.js` (~800 righe)
```javascript
window.StepExecutor = {
    executeStep(step),
    autoExecuteStep(step),
    handleDragDropStep(step),
    handleAssemblyStep(step),
    handleMessageStep(step),
    handleScreenStep(step),
    // ... tutte le funzioni esecuzione step
};
```

**Righe da migrare**: 2700-3500 (~800 righe)

#### Step 3: Estrarre Navigation Manager
**Nuovo file**: `js/ui/NavigationManager.js` (~400 righe)
```javascript
window.NavigationManager = {
    nextStep(),
    previousStep(),
    goToStep(stepIndex),
    jumpToStep(stepNumber, fastForward),
    listTutorialSteps(),
    jumpToStepByName(searchTerm),
    // ... tutte le funzioni navigazione
};
```

**Righe da migrare**: 3400-3800 (~400 righe)

#### Step 4: Estrarre Modal Manager
**Nuovo file**: `js/ui/ModalManager.js` (~300 righe)
```javascript
window.ModalManager = {
    showInfoModal(message, title),
    hideInfoModal(),
    showCongratsModal(userName),
    showErrorModal(message),
    // ... tutte le funzioni modal
};
```

**Righe da migrare**: Sparse (~300 righe)

#### Step 5: UI Core Ridotto
**File finale**: `js/ui.js` (~60KB, ~1200 righe)
```javascript
window.UI = {
    // SOLO:
    // - init()
    // - coordinamento componenti
    // - API pubbliche minime
    // - event binding
};
```

### Architettura Post-Refactoring
```
ui.js (1200 righe) → Coordinator
├── TutorialParser.js (1500 righe) → parse tutorial.txt
├── StepExecutor.js (800 righe) → esegue step
├── NavigationManager.js (400 righe) → navigazione tutorial
├── ModalManager.js (300 righe) → gestione modal
├── TutorialManager.js (già esistente)
├── ScenarioManager.js (già esistente)
├── ToolsManager.js (già esistente)
├── FeedbackManager.js (già esistente)
└── ModelManager.js (già esistente)
```

---

## 📋 PRIORITÀ 4: Documentazione Architettura

### File da Creare
1. **ARCHITECTURE.md** - Diagramma completo architettura modulare
2. **MODULES_GUIDE.md** - Guida riferimento moduli (cosa fa ognuno)
3. **REFACTORING_CHANGELOG.md** - Log modifiche refactoring

---

## 🚀 Piano Esecuzione Refactoring

### Fase 1: Pulizia (5 min)
```bash
# Elimina file obsoleti
rm console.txt console1.txt problema.txt bachi.txt dafare.txt
rm test_mesh.txt step.txt remote.txt risultati.txt
rm nuovarichiesta.txt nuovatelecamera.txt nuovefunzioni.txt
rm oggettinascosti.txt interazione_pulsante_remote.txt
rm logicaschermi.txt scarico_utensile.txt requisiti_funzionali.txt
rm model_positions*.txt
rm debug_original_positions.html sync_test.html test_*.html
rm ANALISI_TUTORIAL.md CRITICITA_VITI.md FIX_AVVITAMENTO_VITI.md
rm NUOVE_FUNZIONALITA_SNAPPOINTPIVOT.md TASK_*.md TUTORIAL_REVERSE*.md
```

### Fase 2: Refactoring scene3d-modular.js (30 min)
1. Crea MovementParser.js
2. Crea MultiStepAnimationSystem.js
3. Crea InputHandler.js
4. Crea GeometryUtils.js
5. Riduci scene3d-modular.js a coordinator
6. Testa funzionalità core

### Fase 3: Refactoring ui.js (30 min)
1. Crea TutorialParser.js
2. Crea StepExecutor.js
3. Crea NavigationManager.js
4. Crea ModalManager.js
5. Riduci ui.js a coordinator
6. Testa tutorial execution

### Fase 4: Documentazione (10 min)
1. Crea ARCHITECTURE.md
2. Crea MODULES_GUIDE.md
3. Aggiorna CLAUDE.md con nuova architettura

---

## 📊 Benefici Attesi

### Metriche Pre-Refactoring
- **scene3d-modular.js**: 233KB (4600 righe)
- **ui.js**: 236KB (5000 righe)
- **File root**: 47 file (troppi)
- **Manutenibilità**: BASSA (monoliti)

### Metriche Post-Refactoring
- **scene3d-modular.js**: ~50KB (1000 righe) → -78% dimensione
- **ui.js**: ~60KB (1200 righe) → -75% dimensione
- **File root**: ~10 file → -79% clutter
- **Manutenibilità**: ALTA (modulare)
- **Nuovi moduli core**: +8 moduli specializzati
- **Test isolation**: FACILE (moduli indipendenti)
- **Performance**: INVARIATA (zero breaking changes)

---

## ⚠️ Rischi & Mitigazione

### Rischi
1. **Breaking changes** durante migrazione codice
2. **Dipendenze circolari** tra moduli
3. **Performance regression** per overhead moduli

### Mitigazione
1. **Test after each extraction** - verifica funzionalità dopo ogni modulo estratto
2. **Dependency injection pattern** - passa dipendenze esplicitamente
3. **Profiling pre/post** - misura performance con DevTools

---

## 🎯 Prossimi Step Immediati

Vuoi che proceda con:
1. **Pulizia file** (5 min) - elimina 38 file obsoleti
2. **Refactoring scene3d-modular.js** (30 min) - estrai 4 moduli
3. **Refactoring ui.js** (30 min) - estrai 4 moduli
4. **Documentazione** (10 min) - ARCHITECTURE.md + MODULES_GUIDE.md

O preferisci un approccio diverso?
