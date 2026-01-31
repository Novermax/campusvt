# ANALISI REFACTORING COMPLETA - Campus Virtual Training

**Data Analisi**: Gennaio 2026
**Versione**: 1.0
**Obiettivo**: Refactoring interno backward-compatible per migliorare manutenibilità

---

## INDICE FILE ANALIZZATI

1. [js/ui.js](#1-jsuijs) - ~5528 righe - God Object UI
2. [js/scene3d-modular.js](#2-jsscene3d-modularjs) - ~4600 righe - Motore 3D
3. [js/core/DragDropSystem.js](#3-jscoredragdropsystemjs) - ~2800 righe - Drag & Drop
4. [js/core/ScreenSystem.js](#4-jscoreScreenSystemjs) - ~1337 righe - Schermi interattivi
5. [js/core/StepController.js](#5-jscorestepcontrollerjs) - ~845 righe - Controller step
6. [js/core/InteractiveObject3D.js](#6-jscoreinteractiveobject3djs) - ~1597 righe - Oggetti interattivi

**Totale righe analizzate**: ~16.707

---

## 1. js/ui.js

### COSA FA OGGI
Controller principale UI del sistema di training 3D (~5528 righe):
- Navigazione pagine: login, home, scenario selection, tutorial execution
- Parsing tutorial: lettura e interpretazione di tutorial.txt e home_config.txt
- Esecuzione step: orchestrazione delle azioni per ogni step del tutorial
- Gestione strumenti: attivazione/disattivazione tool
- Controlli mobili: gestione touch controls
- Modal informativi: sistema di messaggi bloccanti
- Progress bar: feedback visivo avanzamento
- Autenticazione: validazione credenziali
- Caricamento scenari: loading modelli 3D

### RESPONSABILITÀ MESCOLATE
| Area | Responsabilità | Linee approx |
|------|----------------|--------------|
| Stato globale | currentPage, tutorialSteps, currentStepIndex, toolsState, scenarioPath | sparse |
| Parsing | parseTutorialContent(), parseHomeConfig() | 1800-2200 |
| Esecuzione | executeStep(), goToStep(), nextStep() | 2700-3500 |
| UI rendering | updateProgressBar(), modal management | 3000-3200 |
| Autenticazione | login(), validateCredentials() | 300-450 |
| Tool management | toggleTool(), getActiveTool() | 1200-1400 |
| Scene loading | loadScenario() | 600-900 |
| Navigation | showPage(), goHome() | 200-350 |
| Mobile | touch handlers | 1500-1700 |

**Pattern**: God Object con ~15 responsabilità distinte.

### PUNTI A RISCHIO BUG
1. **Race Conditions con setTimeout** (linee 2706, 2723, 2381, 3046-3094)
   - Nessuna cancellazione timeout in goHome()
   - Rischio: Azioni eseguite dopo reset stato

2. **Stato Inconsistente in goHome()** (linee ~350-400)
   - Reset parziale dello stato
   - Rischio: Step indicator mostra valore errato

3. **Parsing Misto con Esecuzione** (linee 2700-3000)
   - executeStep() fa parsing + esecuzione
   - Rischio: Ordine non deterministico

4. **Dipendenze Implicite da window.*** (sparse)
   - Nessun check esistenza consistente
   - Rischio: Errori runtime

5. **Gestione Asincrona Modal** (linee 3046-3170)
   - Promise non sempre awaited
   - Rischio: Memory leak, audio che continua

### REFACTORING PROPOSTI

#### 4.1 Estrazione Funzioni Pure di Parsing
```javascript
parseStepProperties(rawText) → oggetto step strutturato
parsePositionString("(x,y,z)") → {x, y, z}
parseActionString("traslazione:(x,y,z,dur)") → oggetto action
parseDrivenObjects(string) → array config
```
**Beneficio**: Parsing testabile, riutilizzabile

#### 4.2 Isolamento Stato in Oggetto Interno
```javascript
const state = {
    currentPage: 'login',
    tutorial: { steps: [], currentIndex: -1, isExecuting: false },
    scenario: { path: null, config: null },
    tools: { active: null, available: [] }
};
```
**Beneficio**: Accesso esplicito, logging centralizzato

#### 4.3 Separazione executeStep in Fasi
```javascript
1. prepareStepContext(step) - raccoglie dati
2. applyStepTransforms(step) - posizioni, rotazioni
3. executeStepActions(step) - animazioni, drag&drop
4. finalizeStep(step) - cleanup, UI update
```
**Beneficio**: Debug per fase

#### 4.4 Centralizzazione Timeout Management
```javascript
const pendingTimeouts = new Set();

function safeTimeout(fn, delay) {
    const id = setTimeout(() => {
        pendingTimeouts.delete(id);
        fn();
    }, delay);
    pendingTimeouts.add(id);
    return id;
}

function clearAllPendingTimeouts() {
    pendingTimeouts.forEach(id => clearTimeout(id));
    pendingTimeouts.clear();
}
```
**Beneficio**: Chiamata clearAllPendingTimeouts() in goHome()

#### 4.5 Commenti Strutturali
```javascript
// ═══════════════════════════════════════════════════════════
// SEZIONE: PARSING TUTORIAL
// ═══════════════════════════════════════════════════════════
```
**Beneficio**: Navigazione file più rapida

### COSA NON TOCCARE
- Sintassi tutorial.txt e home_config.txt (contratto funzionale)
- Ordine esecuzione azioni
- Nomi funzioni pubbliche
- Logica autenticazione
- Sistema modal
- Integrazione mobile

---

## 2. js/scene3d-modular.js

### COSA FA OGGI
Motore 3D principale (~4600 righe):
- Scena Three.js: Inizializzazione scene, camera, renderer, luci
- Controlli camera: Rotazione, pan, zoom, pivot dinamico
- Raycasting: Rilevamento click e hover
- Gestione modelli: Caricamento, aggiunta, rimozione, ricerca
- Sistema animazioni: updateAnimations(), multi-step, svita/avvita
- Highlight/Silhouette: Evidenziazione modelli
- Tutorial integration: getCurrentTutorialStep()
- Salvataggio posizioni: initialModelPositions, reset
- Integrazioni sottosistemi: DragDropSystem, ParticleSystem, etc.
- Effetti tool: handleAirToolEffect(), handleSprayToolEffect()
- Debug/Export: exportCurrentModelPositions(), getCameraInfo()

### RESPONSABILITÀ MESCOLATE
| Area | Responsabilità | Linee approx |
|------|----------------|--------------|
| Stato globale | scene, camera, renderer, loadedModels, mouseControls, animationSystem | 6-95 |
| Inizializzazione | init(), initScene(), initCamera(), initRenderer(), initLights() | 96-670 |
| Camera | rotateCamera(), zoomCamera(), panCamera(), updateCameraAnimation() | 977-1066, 3682-4102 |
| Input | onMouseDown(), onMouseUp(), onMouseMove(), onMouseWheel(), onKeyDown() | 672-975 |
| Animazioni | updateAnimations(), applyRotationAroundCenter(), startModelAnimation() | 2471-2795, 1959-2022 |
| Highlight | highlightModel(), removeHighlight(), saveOriginalMaterials() | 1276-1420 |
| Modelli | addModel(), clearAllModels(), findModelByName() | 1099-1275, 4409-4599 |
| Posizioni | saveInitialModelPosition(), resetModelToInitialPosition() | 2855-3040 |
| Effetti particellari | handleAirToolEffect(), handleSprayToolEffect() | 1512-1658 |
| Debug | getCameraInfo(), exportCurrentModelPositions() | 223-278, 3391-3496 |
| Congratulazioni | showTutorialCompletionCongratulations() | 3079-3193 |
| Render loop | startRenderLoop(), render() | 3648-3680 |

**Pattern**: Monolite con ~20+ responsabilità.

### PUNTI A RISCHIO BUG
1. **Stato Animazioni Condiviso** (linee 26-31, 2471-2672)
   - animationSystem.activeAnimations array mutabile
   - Rischio: Race condition durante iterazione

2. **Dipendenza Circolare con UI.js** (linee 2797-2804, 3042-3074)
   - getCurrentTutorialStep() accede a window.UI
   - Rischio: Crash se UI non caricato

3. **Timeout Non Gestiti in advanceToNextTutorialStep** (linee 3060-3072)
   - setTimeout senza cancellazione
   - Rischio: Avanzamento fantasma

4. **Allocazioni nel Render Loop** (linee 2507-2511, 2519-2521, 2684-2685)
   - new THREE.Quaternion(), new THREE.Vector3() ogni frame
   - Rischio: GC frequente, frame rate instabile

5. **Gestione Materiali Originali** (linee 1299-1362)
   - Map con riferimenti che possono diventare orfani
   - Rischio: Memory leak

6. **Posizioni Salvate Non Sincronizzate** (linee 2855-3040)
   - Due Map separate (initial, scenario)
   - Rischio: Stato inconsistente tra reset

### REFACTORING PROPOSTI

#### 4.1 Object Pool per Animazioni
```javascript
const animationPool = {
    vectors: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()],
    quaternions: [new THREE.Quaternion(), new THREE.Quaternion()],
    matrices: [new THREE.Matrix4()],
    currentVectorIndex: 0,
    getVector() {
        const v = this.vectors[this.currentVectorIndex];
        this.currentVectorIndex = (this.currentVectorIndex + 1) % this.vectors.length;
        return v;
    }
};
```
**Beneficio**: Eliminazione GC spikes

#### 4.2 Isolamento Stato Camera
```javascript
const cameraState = {
    input: { isMouseDown: false, lastPosition: { x: 0, y: 0 }, mouseButton: 0 },
    pivot: new THREE.Vector3(),
    limits: { minPhi: 0.2, maxPhi: Math.PI * 0.45, minY: 0.0 },
    animation: { isAnimating: false, startTime: 0, duration: 1.0 }
};
```
**Beneficio**: Accesso esplicito, serializzazione per debug

#### 4.3 Separazione updateAnimations in Fasi
```javascript
updateAnimations: function() {
    for (let i = this.animationSystem.activeAnimations.length - 1; i >= 0; i--) {
        const anim = this.animationSystem.activeAnimations[i];
        if (anim.finished) { splice(i, 1); continue; }

        const progress = this.calculateAnimationProgress(anim, currentTime);
        this.applyAnimationTransform(anim, progress);
        this.updateSlaveObjects(anim, progress);
        this.checkAnimationCompletion(anim, progress);
    }
}
```
**Beneficio**: Debug per fase

#### 4.4 Centralizzazione Timeout
```javascript
const sceneTimeouts = new Set();

scheduleSceneTimeout: function(fn, delay) {
    const id = setTimeout(() => { sceneTimeouts.delete(id); fn(); }, delay);
    sceneTimeouts.add(id);
    return id;
},

clearAllSceneTimeouts: function() {
    sceneTimeouts.forEach(id => clearTimeout(id));
    sceneTimeouts.clear();
}
```
**Beneficio**: clearAllSceneTimeouts() in clearAllModels()

### COSA NON TOCCARE
- Ordine operazioni render loop
- Formule matematiche camera
- API publiche (findModelByName, etc.)
- Integrazione sottosistemi
- Ordine inizializzazione

---

## 3. js/core/DragDropSystem.js

### COSA FA OGGI
Sistema drag & drop 3D (~2800+ righe):
- Drag & Drop 3D: Raycasting, movimento oggetti, piano di drag dinamico
- Sistema Snap: Rilevamento zone snap, animazione snap, feedback visivo
- Posizioni Originali: Salvataggio/ripristino posizioni iniziali
- Multi-Target Intercambiabili: Supporto snap su target multipli
- Tracking Occupazioni: Gestione posizioni già occupate
- Integrazione AssemblySystem: Coordinamento assemblaggio
- Auto-Avanzamento Tutorial: Trigger avanzamento step dopo snap
- Gestione Utensili: Verifica strumento "Mano" attivo
- Indicatori Visivi: Sfere verdi per punti snap

### RESPONSABILITÀ MESCOLATE
| Area | Responsabilità | Linee approx |
|------|----------------|--------------|
| Stato globale | enabled, isDragging, originalPositions, customSnapTargets, occupiedSnapPositions | 18-91 |
| Inizializzazione | init(), initMaterials(), initDragPlane(), setupEventListeners() | 96-232 |
| Enable/Disable | enable(), disable(), setDraggableObjects(), detectDraggableObjects() | 238-467 |
| Posizioni originali | storeOriginalPositions() | 473-505 |
| Indicatori snap | createSnapIndicators(), updateSnapIndicators(), removeAllSnapIndicators() | 510-645 |
| Event handlers | onMouseDown(), onMouseMove(), onMouseUp(), onKeyDown() | 652-771 |
| Drag logic | startDrag(), updateDragPosition(), endDrag(), forceResetDragState() | 780-1199 |
| Snap finding | findSnapTarget() - 250+ righe con 4 strategie | 1390-1640 |
| Snap execution | performSnap() - 250+ righe con duplicazione TWEEN/non-TWEEN | 1669-2007 |
| Avanzamento tutorial | tryAdvanceTutorialStep(), advanceTutorialStep() | 2112-2257 |
| Utilità | findRootModel(), isDescendantOf(), isCorrectToolActive() | 2047-2344 |
| Occupazioni snap | createSnapPositionKey(), occupySnapPosition(), releaseSnapPosition() | 2347-2398 |

**Pattern**: God Object massivo con ~20+ responsabilità.

### PUNTI A RISCHIO BUG
1. **Duplicazione Massiva in performSnap()** (linee 1669-2007, ~340 righe)
   - Logica quasi identica tra path TWEEN e non-TWEEN
   - Rischio: Bug fixati in un path ma non nell'altro

2. **findSnapTarget() Troppo Complesso** (linee 1390-1640, ~250 righe)
   - 4 strategie diverse, logica annidata 5+ livelli
   - Rischio: Difficile debug

3. **Dipendenze Implicite da window.*** (sparse)
   - window.Scene3D, window.AssemblySystem, window.UI, window.ToolsManager, window.TWEEN
   - Check esistenza inconsistenti
   - Rischio: Errori runtime

4. **Debug Log Eccessivi** (ovunque)
   - Console.log con emoji in produzione
   - Rischio: Console inquinata, performance

5. **Stato Non Pulito in forceResetDragState()** (linee 1168-1199)
   - Non resetta customSnapTargets, occupiedSnapPositions
   - Rischio: Stato stale dopo ESC

6. **Race Condition in tryAdvanceTutorialStep()** (linee 2121-2257)
   - Retry con setTimeout senza cancellazione
   - Rischio: Avanzamenti multipli

### REFACTORING PROPOSTI

#### 4.1 Estrazione performSnapAnimation()
```javascript
performSnapAnimation: function(object, targetPosition, onComplete) {
    const startPosition = object.position.clone();
    const correctedTargetPosition = this.calculateCorrectedTargetPosition(object, targetPosition);

    if (window.TWEEN) {
        new TWEEN.Tween({...})
            .onComplete(() => {
                this.verifySnapResult(object, targetPosition);
                if (onComplete) onComplete();
            })
            .start();
    } else {
        object.position.copy(correctedTargetPosition);
        this.verifySnapResult(object, targetPosition);
        if (onComplete) onComplete();
    }
},

handlePostSnapIntegration: function(object, targetPosition, snapContext) {
    // Logica AssemblySystem (una sola volta)
    // Logica reset tutorial tracker (una sola volta)
}
```
**Beneficio**: Eliminazione 150+ righe duplicate

#### 4.2 Separazione findSnapTarget() in Strategie
```javascript
findMultiTargetSnap: function(object, currentCenter) { ... },
findSingleTargetSnap: function(object, currentCenter) { ... },
findOriginalPositionSnap: function(object, currentCenter) { ... },
findAssemblyInterchangeableSnap: function(object, currentCenter) { ... },

// Orchestratore
findSnapTarget: function(object) {
    const center = this.getBoundingBoxCenter(object);

    return this.findMultiTargetSnap(object, center)
        || this.findSingleTargetSnap(object, center)
        || this.findOriginalPositionSnap(object, center)
        || this.findAssemblyInterchangeableSnap(object, center);
}
```
**Beneficio**: Logica testabile per strategia

#### 4.3 Centralizzazione Debug Logging
```javascript
log: function(level, message, data) {
    if (!this.debugMode && level === 'debug') return;
    const prefix = `[DragDropSystem]`;
    if (data) {
        console.log(`${prefix} ${message}`, data);
    } else {
        console.log(`${prefix} ${message}`);
    }
}
```
**Beneficio**: Log controllabili, zero overhead in produzione

#### 4.4 Cleanup Completo in forceResetDragState()
```javascript
forceResetDragState: function() {
    // NUOVO: Reset tracking occupazioni
    this.occupiedSnapPositions.clear();
    this.objectSnapPosition.clear();

    // NUOVO: Cancella retry pendenti
    if (this.advanceRetryTimeout) {
        clearTimeout(this.advanceRetryTimeout);
        this.advanceRetryTimeout = null;
    }

    // Esistente...
}
```
**Beneficio**: Stato sempre consistente dopo ESC

#### 4.5 Gestione Retry con Cancellazione
```javascript
advanceRetryTimeout: null,

tryAdvanceTutorialStep: function(context, attempt) {
    if (this.advanceRetryTimeout) {
        clearTimeout(this.advanceRetryTimeout);
    }

    // ... logica esistente ...

    this.advanceRetryTimeout = setTimeout(() => {
        this.advanceRetryTimeout = null;
        this.tryAdvanceTutorialStep(context, attempt + 1);
    }, retryDelay);
}
```
**Beneficio**: Zero race condition su retry

### COSA NON TOCCARE
- Formato customSnapTargets (API usata da UI.js)
- Logica updateDragPlaneToCamera
- Integrazione AssemblySystem API
- Formato originalPositions/Rotations
- Ordine strategie findSnapTarget
- Event listener setup

---

## 4. js/core/ScreenSystem.js

### COSA FA OGGI
Sistema schermi touch simulati (~1337 righe):
- Contenitori e Viste: Registrazione schermi con viste GLB separate
- Gestione Visibilità: Hide/show automatico modelli al cambio vista
- Hotspot Interattivi: Creazione mesh hotspot, highlight hover/click
- Navigazione Viste: Transizione fluida tra schermate
- Esecuzione Azioni: Animazioni su macchinari da hotspot
- State Machine: Stati idle → focused → interacting
- Camera Management: Allineamento camera perpendicolare
- Tutorial Integration: Requisiti hotspot/sequenze per completare step

### RESPONSABILITÀ MESCOLATE
| Area | Responsabilità | Linee approx |
|------|----------------|--------------|
| Stato globale | enabled, currentState, focusedScreen, currentViews, Maps | 29-104 |
| Inizializzazione | init(), initMaterials(), setupEventListeners() | 122-209 |
| Visibilità modelli | initializeVisibility(), showViewModel(), hideViewModel() | 215-306 |
| Registrazione | registerScreen(), registerView(), registerHotspot(), registerAction() | 312-440 |
| Parsing utilities | parseVector3(), parseVector2(), parseColor() | 446-498 |
| State machine | focusScreen(), unfocusScreen(), setView() | 504-663 |
| Camera management | alignCameraToScreen(), animateCameraTo() | 665-721 |
| Hotspot rendering | createHotspotsForView(), createHotspotMaterial(), removeActiveHotspots() | 723-850 |
| Event handlers | onCanvasClick(), onCanvasMouseMove(), onKeyDown(), handleHotspotClick() | 852-979 |
| Esecuzione azioni | executeAction(), executeAnimation(), playSound() | 981-1082 |
| Tutorial integration | configureStepRequirements(), checkStepCompletion() | 1084-1150 |
| Cleanup/Reset | reset(), clearDefinitions() | 1152-1198 |
| Debug API | listScreens(), listHotspots(), getScreenState(), debugInfo() | 1200-1330 |

**Pattern**: Modulo medio-grande con 13 aree.

### PUNTI A RISCHIO BUG
1. **Dipendenze Implicite da window.*** (sparse)
   - window.Scene3D, window.HoldableSystem, window.StepController, window.UI
   - Check inconsistenti
   - Rischio: Crash se moduli non caricati

2. **Materiale Hotspot Clonato Ogni Hover** (linee 843-847)
   - clone() ogni hover, nessun dispose
   - Rischio: Memory leak

3. **notifyStepComplete() Chiama goToNextStep()** (linea 1147)
   - **BUG**: goToNextStep() non esiste, dovrebbe essere nextStep()
   - Rischio: Avanzamento step non funziona

4. **animateCameraTo() Senza Cancellazione** (linee 692-720)
   - requestAnimationFrame senza ID
   - Rischio: Animazioni sovrapposte

5. **Hotspot Group Ricreazione Incompleta** (linee 757-771)
   - Non fa dispose delle mesh nel gruppo
   - Rischio: Memory leak

### REFACTORING PROPOSTI

#### 4.1 Fix goToNextStep → nextStep
```javascript
// PRIMA (linea 1147) - BUG!
if (window.UI && typeof window.UI.goToNextStep === 'function') {
    window.UI.goToNextStep();
}

// DOPO - CORRETTO
if (window.UI && typeof window.UI.nextStep === 'function') {
    window.UI.nextStep();
}
```
**Beneficio**: Avanzamento step funziona

#### 4.2 Evitare Clone Materiale su Ogni Hover
```javascript
highlightHotspot: function(hotspotId, show) {
    const mesh = this.activeHotspotMeshes.get(hotspotId);
    if (!mesh) return;

    if (show) {
        if (!mesh.userData.originalMaterial) {
            mesh.userData.originalMaterial = mesh.material;
        }
        mesh.material = this.materials.hotspotHover; // Riusa, non clone
        mesh.scale.setScalar(this.config.hoverScale);
    } else {
        if (mesh.userData.originalMaterial) {
            mesh.material = mesh.userData.originalMaterial;
        }
        mesh.scale.setScalar(1);
    }
}
```
**Beneficio**: Zero memory leak

#### 4.3 Protezione Dipendenze window.*
```javascript
safeCall: function(systemName, methodName, ...args) {
    const system = window[systemName];
    if (system && typeof system[methodName] === 'function') {
        return system[methodName](...args);
    }
    console.warn(`[ScreenSystem] ${systemName}.${methodName} non disponibile`);
    return null;
}
```
**Beneficio**: Zero crash per dipendenze non caricate

#### 4.4 Cancellazione Animazione Camera
```javascript
cameraAnimationId: null,

animateCameraTo: function(targetPosition, targetLookAt, duration) {
    if (this.cameraAnimationId) {
        cancelAnimationFrame(this.cameraAnimationId);
        this.cameraAnimationId = null;
    }

    const animate = () => {
        // ... logica esistente ...
        if (progress < 1) {
            this.cameraAnimationId = requestAnimationFrame(animate);
        } else {
            this.cameraAnimationId = null;
        }
    };

    this.cameraAnimationId = requestAnimationFrame(animate);
}
```
**Beneficio**: Zero animazioni sovrapposte

#### 4.5 Cleanup Hotspot Group Completo
```javascript
if (group && group.parent !== parentModel) {
    group.children.forEach(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
    });
    group.clear();

    if (group.parent) {
        group.parent.remove(group);
    }
    group = null;
}
```
**Beneficio**: Memory clean

### COSA NON TOCCARE
- Formato config screens/views
- Logica State Machine
- Integrazione StepController
- Formato hotspot position/size
- Debug API

---

## 5. js/core/StepController.js

### COSA FA OGGI
Controller centralizzato progressione step (~845 righe):
- Trigger multipli: Supporto per sorgenti diverse (screen, physical, holdable, tutorial, auto)
- Azioni per sorgente: Esecuzione azioni differenziate
- Parsing configurazione: Auto-configurazione da proprietà step
- Esecuzione azioni: Animation, setView, sound, holdAction, setVariant, cycleVariant
- Pulsanti fisici 3D: Registro e gestione click su modelli cliccabili
- Integrazione sistemi: ScreenSystem, HoldableSystem, AnimatedWindowSystem
- Auto-avanzamento: Schedulazione avanzamento dopo trigger

### RESPONSABILITÀ MESCOLATE
| Area | Responsabilità | Linee approx |
|------|----------------|--------------|
| Stato globale | enabled, currentStepIndex, currentStep, stepConfigs, physicalButtons | 32-44 |
| Costanti | TRIGGER_SOURCES | 50-56 |
| Inizializzazione | init(), setupEventListeners() | 62-84 |
| Configurazione step | configureStep(), setCurrentStep(), parseStepProperties() | 90-239 |
| Parsing azioni | parseActionString() | 241-320 |
| Trigger logic | triggerStep(), executeActionsForSource() | 326-431 |
| Esecuzione azioni | executeAction() e metodi specifici | 433-590 |
| Auto-avanzamento | scheduleAutoAdvance() | 592-609 |
| Event handlers | onStepTriggerEvent(), convenience methods | 614-654 |
| Pulsanti fisici | registerPhysicalButton(), getPhysicalButton(), handleModel3DClick() | 656-744 |
| Utility/Reset | reset(), setEnabled() | 746-768 |
| Debug API | debugInfo(), simulateTrigger(), listAcceptedTriggers() | 770-838 |

**Pattern**: Modulo medio con 12 aree ben delimitate.

### PUNTI A RISCHIO BUG
1. **Timeout Non Cancellabile in scheduleAutoAdvance()** (linee 595-609)
   - Timeout salvato ma nessun check se step cambiato
   - Rischio: Avanzamento fantasma

2. **Dipendenze Implicite da window.*** (sparse)
   - window.UI, window.Scene3D, window.ScreenSystem, etc.
   - Check inconsistenti
   - Rischio: Crash se moduli non caricati

3. **parseActionString() Non Gestisce Errori** (linee 246-320)
   - Warning ma continua su formato errato
   - Rischio: Azioni ignorate silenziosamente

4. **triggerStep() Logica AnimatedWindow** (linee 376-396)
   - Race condition possibile
   - Rischio: Click persi

### REFACTORING PROPOSTI

#### 4.1 Protezione Timeout con Verifica Step
```javascript
scheduleAutoAdvance: function() {
    const expectedStepIndex = this.currentStepIndex;

    if (window.UI && window.UI.autoAdvanceTimeoutId) {
        clearTimeout(window.UI.autoAdvanceTimeoutId);
    }

    if (window.UI) {
        window.UI.autoAdvanceTimeoutId = setTimeout(() => {
            if (this.currentStepIndex !== expectedStepIndex) {
                console.log('[StepController] Step cambiato, auto-advance annullato');
                return;
            }

            if (typeof window.UI.nextStep === 'function') {
                window.UI.nextStep();
            }
        }, 100);
    }
}
```
**Beneficio**: Zero avanzamenti fantasma

#### 4.2 Helper per Check Dipendenze
```javascript
requireSystem: function(systemName) {
    const system = window[systemName];
    if (!system) {
        console.warn(`[StepController] ${systemName} non disponibile`);
        return null;
    }
    return system;
}
```
**Beneficio**: Check uniformi

#### 4.3 Validazione parseActionString()
```javascript
parseActionString: function(actionStr) {
    if (!actionStr || typeof actionStr !== 'string') {
        console.warn('[StepController] actionStr non valida:', actionStr);
        return [];
    }

    const actions = [];
    const actionParts = actionStr.split(';').map(a => a.trim()).filter(a => a);
    // ... parsing esistente ...
    return actions;
}
```
**Beneficio**: Protezione input

#### 4.4 Estrazione Logica AnimatedWindow
```javascript
handleAnimatedWindowTrigger: function() {
    if (!window.AnimatedWindowSystem) return false;

    const stepProperties = this.currentStep?.properties || {};
    const hasAnimatedWindow = stepProperties.AnimatedImages || stepProperties.AnimatedImagesFolder;

    if (!hasAnimatedWindow) return false;

    if (window.AnimatedWindowSystem.isVisible) {
        window.AnimatedWindowSystem.handleTrigger();
        return true;
    }

    return true; // Gestito ma non inoltrato
}
```
**Beneficio**: Logica isolata, testabile

### COSA NON TOCCARE
- Formato trigger
- Formato azioni
- Costanti TRIGGER_SOURCES
- Debug API

---

## 6. js/core/InteractiveObject3D.js

### COSA FA OGGI
Sistema gestione modelli GLB con figli interattivi (~1597 righe):
- Registrazione oggetti: Register, normalizeConfig, registerFromTutorial
- Parsing configurazione: parseInteractiveChildDef (button, rotary, indicator, screen)
- Collegamento modelli: attachModel con traverse ricorsivo, supporto Group e Mesh
- Gestione interazioni: handleClick, handleButtonClick, handleRotaryClick, handleHover
- Stato interno: setState, getState, applyState per visibilità condizionale
- StateGroups: Varianti mutuamente esclusive
- Evidenziazione pulsanti: highlightRequiredButtons, applyButtonHighlight, clearButtonHighlights
- Feedback visivo: showHoverFeedback, removeHoverFeedback, showClickFeedback
- Eventi custom: Emissione eventi button_click, state_change, stategroup_change

### RESPONSABILITÀ MESCOLATE
| Area | Responsabilità | Linee approx |
|------|----------------|--------------|
| Configurazione | config object | 20-32 |
| Stato interno | objects Map, stateGroups Map, hoveredChild | 38-41 |
| Inizializzazione | init() | 82-99 |
| Registrazione | register(), normalizeConfig(), registerFromTutorial(), parseInteractiveChildDef() | 105-276 |
| Collegamento modelli | attachModel(), detachModel() | 282-419 |
| Gestione interazioni | handleClick(), handleButtonClick(), handleRotaryClick(), handleHover() | 421-620 |
| Gestione stato | setState(), getState(), applyState() | 622-693 |
| StateGroups | registerStateGroup(), setStateVariant(), cycleStateVariant(), etc. | 695-1048 |
| Animazioni | animateRotation() | 1050-1077 |
| Feedback visivo | showHoverFeedback(), removeHoverFeedback(), showClickFeedback() | 1079-1144 |
| Evidenziazione pulsanti | highlightRequiredButtons(), applyButtonHighlight(), clearButtonHighlights() | 1146-1367 |
| Esecuzione azioni | executeAction() | 1369-1439 |
| Eventi | on(), off(), emitEvent() | 1441-1482 |
| Debug/Utility | listObjects(), debugInfo(), getInteractiveMeshes(), reset() | 1484-1583 |

**Pattern**: Modulo grande con 16 aree. Candidato per estrazione moduli.

### PUNTI A RISCHIO BUG
1. **attachModel() Traverse Multipli** (linee 300-371)
   - Tre traverse separati
   - Rischio: Performance degradata

2. **highlightRequiredButtons() Logica Complessa** (linee 1156-1254)
   - Due strategie di ricerca
   - Rischio: Mesh non trovate silenziosamente

3. **Materiali Clonati in showHoverFeedback()** (linee 1086-1103)
   - Clone ogni hover se check fallisce
   - Rischio: Memory leak

4. **StateGroup Clear Non Sicuro** (linea 804)
   - Più modelli contribuiscono a stesso gruppo
   - Rischio: Mesh perse

5. **Dipendenze Circolari** (linee 478, 511-518, 523-528)
   - StepController, Scene3D.highlightCircleManager
   - Rischio: Ordine caricamento critico

### REFACTORING PROPOSTI

#### 4.1 Unificazione Traverse in attachModel()
```javascript
attachModel: function(modelName, model3D) {
    const obj = this.objects.get(modelName);
    if (!obj) return false;

    obj.model = model3D;
    obj.childMeshes.clear();

    const allChildNames = [];
    const interactiveChildren = obj.config.interactiveChildren;

    // UNICO traverse
    model3D.traverse((child) => {
        if (child.name) allChildNames.push(`${child.name} (${child.type})`);
        this.configureInteractiveChild(child, obj, interactiveChildren);
        this.fixLuminousMaterial(child);
    });

    console.log(`🔍 [InteractiveObject3D] Child in "${modelName}":`, allChildNames);
    this.applyState(modelName);
    return true;
}
```
**Beneficio**: Single pass, performance migliorate

#### 4.2 Estrazione configureInteractiveChild()
```javascript
configureInteractiveChild: function(child, obj, interactiveChildren) {
    let childConfig = interactiveChildren[child.name];

    // Case-insensitive fallback
    if (!childConfig && child.name) {
        const childNameLower = child.name.toLowerCase();
        for (const [configName, config] of Object.entries(interactiveChildren)) {
            if (configName.toLowerCase() === childNameLower) {
                childConfig = config;
                break;
            }
        }
    }

    if (!childConfig) return;

    if (child.isMesh) {
        this.markMeshAsInteractive(child, obj.name, childConfig);
        obj.childMeshes.set(child.name, child);
    } else if (child.isGroup || child.isObject3D) {
        this.markGroupAsInteractive(child, obj.name, childConfig);
        obj.childMeshes.set(child.name, child);
    }
}
```
**Beneficio**: Logica isolata, testabile

#### 4.3 Protezione Clone Materiale
```javascript
showHoverFeedback: function(mesh) {
    if (!mesh.material) return;

    // hasOwnProperty per protezione doppia
    if (!mesh.userData.hasOwnProperty('originalMaterial')) {
        mesh.userData.originalMaterial = mesh.material.clone();
    }

    if (mesh.material.emissive && !mesh.userData.hasOwnProperty('originalEmissive')) {
        mesh.userData.originalEmissive = mesh.material.emissive.getHex();
        mesh.userData.originalEmissiveIntensity = mesh.material.emissiveIntensity || 0;
    }

    if (mesh.material.emissive) {
        mesh.material.emissive.setHex(this.config.hoverColor);
        mesh.material.emissiveIntensity = Math.max(0.3, mesh.userData.originalEmissiveIntensity || 0);
    }
}
```
**Beneficio**: Zero memory leak

#### 4.4 Helper per Check Dipendenze
```javascript
safeCall: function(systemName, methodName, ...args) {
    const system = window[systemName];
    if (system && typeof system[methodName] === 'function') {
        return system[methodName](...args);
    }
    return null;
}
```
**Beneficio**: Check uniformi

### COSA NON TOCCARE
- Formato InteractiveChild
- Formato StateGroup
- Ordine ricerca mesh
- Event system
- Integrazione StepController

---

## PRIORITÀ IMPLEMENTAZIONE

### FASE 1 - BUG FIX CRITICI
1. **ScreenSystem.js:1147** - goToNextStep → nextStep
2. **StepController.js:595-609** - Protezione timeout con verifica step
3. **DragDropSystem.js:2121-2257** - Cancellazione retry timeout

### FASE 2 - MEMORY LEAK
1. **ScreenSystem.js:843-847** - Evitare clone materiale ogni hover
2. **InteractiveObject3D.js:1086-1103** - Protezione clone materiale
3. **ScreenSystem.js:757-771** - Cleanup hotspot group completo

### FASE 3 - PERFORMANCE
1. **scene3d-modular.js:2507-2521** - Object pool per animazioni
2. **InteractiveObject3D.js:300-371** - Unificazione traverse

### FASE 4 - MANUTENIBILITÀ
1. **ui.js** - Separazione executeStep in fasi
2. **DragDropSystem.js** - Separazione findSnapTarget in strategie
3. **DragDropSystem.js** - Estrazione performSnapAnimation

### FASE 5 - LOGGING
1. **DragDropSystem.js** - Centralizzazione debug logging
2. Tutti i file - Helper safeCall per dipendenze

---

## STRATEGIA DI VALIDAZIONE

Per ogni refactoring:
1. **Test funzionale**: Stesso output per stesso input
2. **Test memoria**: Monitor DevTools durante operazioni ripetute
3. **Test performance**: Frame rate stabile (±5%)
4. **Test regressione**: Tutorial esistenti funzionano

---

## NOTE IMPLEMENTAZIONE

- **Backward compatible**: Nessuna modifica API pubbliche
- **Incrementale**: Un refactoring alla volta
- **Testabile**: Ogni modifica verificabile isolatamente
- **Documentato**: Commenti su ogni modifica

---

**Documento generato automaticamente - Gennaio 2026**
