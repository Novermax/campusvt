# Architettura Modulare Campus Virtual Training
**Versione**: 2.0 (Post-Refactoring)
**Data**: 17 Gennaio 2026

---

## 🏗️ Panoramica Architettura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CAMPUS VIRTUAL TRAINING                          │
│                      Architettura Modulare v2.0                          │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐         ┌──────────────────────┐
│   index.html         │─────────│   app.js             │
│   (Entry Point)      │         │   (Loader)           │
└──────────────────────┘         └──────────┬───────────┘
                                            │
                    ┌───────────────────────┴───────────────────────┐
                    │                                               │
        ┌───────────▼────────────┐                    ┌────────────▼─────────┐
        │  SCENE3D LAYER         │                    │  UI LAYER            │
        │  (3D Rendering)        │                    │  (User Interface)    │
        └────────────────────────┘                    └──────────────────────┘
```

---

## 📦 Layer 1: Scene3D (3D Rendering & Interaction)

### Core Coordinator
```
scene3d-modular.js (1000 righe) ← Coordinator minimo
├── init()
├── render()
├── delegazione a moduli core
└── API pubbliche minimali
```

### Moduli Core Scene3D
```
js/core/
├── Scene3DCore.js              (15KB)  ← Setup scena Three.js
├── CameraControls.js           (20KB)  ← Controlli camera (orbit, pan, zoom)
├── ModelManager.js             (15KB)  ← Caricamento e gestione modelli
│
├── MovementParser.js           (NEW)   ← Parse comandi movimento tutorial
│   ├── parseMovementSteps()
│   ├── parseMovementStepString()
│   └── parseMovementOperation()
│
├── MultiStepAnimationSystem.js (NEW)   ← Gestione animazioni multi-step
│   ├── startMultiStepMovement()
│   ├── executeCurrentMultiStep()
│   └── onMultiStepCompleted()
│
├── AnimationSystem.js          (48KB)  ← Sistema animazioni base
│   ├── updateAnimations()
│   ├── smoothStep()
│   └── applyRotationAroundCenter()
│
├── InputHandler.js             (NEW)   ← Gestione mouse/touch events
│   ├── onMouseDown/Move/Up()
│   ├── onTouchStart/Move/End()
│   └── handleModelClick()
│
├── GeometryUtils.js            (NEW)   ← Calcoli geometrici
│   ├── calculateBoundingBoxCenter()
│   ├── getModelDirection()
│   └── calculateRotationCenter()
│
├── DragDropSystem.js           (153KB) ← Drag & drop objects
├── SnapSystem.js               (35KB)  ← Sistema snap targets
├── HighlightSystem.js          (11KB)  ← Evidenziazione oggetti
├── ParticleSystem.js           (14KB)  ← Effetti particelle (aria, etc)
│
├── ScreenSystem.js             (55KB)  ← Schermi interattivi HMI
├── HoldableSystem.js           (30KB)  ← Oggetti impugnabili
├── InteractiveObject3D.js      (52KB)  ← Pulsanti 3D, state variants
├── StepController.js           (32KB)  ← Controller step centralizzato
└── StepGatingManager.js        (14KB)  ← Gating attivazione pulsanti
```

### Moduli Assembly (Opzionali)
```
js/core/
├── AssemblySystem.js           (24KB)  ← Sistema assemblaggio complesso
├── AssemblySystemSimplified.js (20KB)  ← Sistema assemblaggio semplificato
└── AssemblyConfigParser.js     (17KB)  ← Parser configurazioni assembly
```

---

## 📦 Layer 2: UI (User Interface & Tutorial)

### Core Coordinator
```
ui.js (1200 righe) ← Coordinator minimo
├── init()
├── event binding
├── coordinamento componenti
└── API pubbliche minimali
```

### Moduli Core UI
```
js/ui/
├── UICore.js                   (14KB)  ← Setup base UI
├── PageManager.js              (11KB)  ← Gestione pagine (login, home, viewer)
├── FeedbackManager.js          (14KB)  ← Toast, feedback utente
│
├── TutorialParser.js           (NEW)   ← Parse tutorial.txt
│   ├── parseTutorialFile()
│   ├── parseStep()
│   ├── parseGlobalProperties()
│   ├── parseScreenDefinitions()
│   └── parseInteractiveObjects()
│
├── StepExecutor.js             (NEW)   ← Esecuzione step tutorial
│   ├── executeStep()
│   ├── autoExecuteStep()
│   ├── handleDragDropStep()
│   ├── handleAssemblyStep()
│   └── handleScreenStep()
│
├── NavigationManager.js        (NEW)   ← Navigazione tutorial
│   ├── nextStep()
│   ├── previousStep()
│   ├── goToStep()
│   ├── jumpToStep()
│   └── jumpToStepByName()
│
├── ModalManager.js             (NEW)   ← Gestione modal (info, congrats)
│   ├── showInfoModal()
│   ├── hideInfoModal()
│   └── showCongratsModal()
│
├── TutorialManager.js          (22KB)  ← Gestione stato tutorial
├── ScenarioManager.js          (22KB)  ← Selezione e caricamento scenari
├── ToolsManager.js             (16KB)  ← Gestione utensili (brugola, aria, etc)
├── ModelManager.js             (25KB)  ← UI caricamento modelli
└── MobileControlsManager.js    (19KB)  ← Controlli touch mobile
```

---

## 📦 Layer 3: Platform Services

### Mobile Optimization
```
js/
├── MobileOptimizer.js          (17KB)  ← Ottimizzazioni performance mobile
│   ├── detectDeviceCapabilities()
│   ├── loadModelsForStep()
│   └── cleanupUnusedModels()
│
└── AutoMode.js                 (18KB)  ← Esecuzione automatica per mobile
    ├── executeCurrentStep()
    ├── autoExecuteToolActions()
    └── autoExecuteDragDrop()
```

### Configuration & Loaders
```
js/
├── config.js                   (8.5KB) ← Configurazione globale
└── modelloader.js              (39KB)  ← Caricamento multi-formato (GLB, OBJ, STL)
```

---

## 🔄 Flusso Esecuzione Tipico

### 1. Avvio Applicazione
```
index.html
    │
    ├──> app.js (loadModules)
    │       │
    │       ├──> Scene3D Core Modules
    │       └──> UI Core Modules
    │
    ├──> UI.init()
    │       │
    │       └──> PageManager.showLoginPage()
    │
    └──> Scene3D.init()
            │
            └──> Setup Three.js scene
```

### 2. Caricamento Scenario
```
User selects scenario
    │
    ├──> ScenarioManager.loadScenario()
    │       │
    │       ├──> ModelLoader.loadModels()
    │       │       │
    │       │       └──> Scene3D.scene.add(models)
    │       │
    │       └──> TutorialParser.parseTutorialFile()
    │               │
    │               └──> TutorialManager.setSteps(parsedSteps)
    │
    └──> UI.goToStep(0)
```

### 3. Esecuzione Step Tutorial
```
User clicks "Next" button
    │
    ├──> NavigationManager.nextStep()
    │       │
    │       └──> StepExecutor.executeStep(step)
    │               │
    │               ├──> Parse step properties
    │               ├──> Show modal if Message
    │               ├──> Enable DragDrop if needed
    │               ├──> Setup screen interaction if ScreenMode
    │               │
    │               └──> if AutoExecute:
    │                       │
    │                       ├──> MovementParser.parseMovementSteps()
    │                       ├──> MultiStepAnimationSystem.startMultiStepMovement()
    │                       └──> AnimationSystem.updateAnimations()
    │
    └──> Wait for action completion → advance step
```

### 4. Animazione Modello
```
Scene3D.render() loop (60 FPS)
    │
    ├──> AnimationSystem.updateAnimations()
    │       │
    │       ├──> if pure translation:
    │       │       │
    │       │       ├──> lerp position
    │       │       ├──> updateMatrix()
    │       │       └──> updateMatrixWorld(true)
    │       │
    │       └──> if rotation + translation:
    │               │
    │               ├──> applyRotationAroundCenter()
    │               └──> update matrices
    │
    └──> if animation complete:
            │
            └──> MultiStepAnimationSystem.onMultiStepCompleted()
                    │
                    └──> StepExecutor advances to next step
```

---

## 📊 Metriche Qualità

### Before Refactoring
| File | Righe | KB | Complessità |
|------|-------|-----|-------------|
| scene3d-modular.js | 4600 | 233 | ⚠️ ALTA |
| ui.js | 5000 | 236 | ⚠️ ALTA |
| **TOTALE** | **9600** | **469** | **CRITICA** |

### After Refactoring
| Layer | File | Righe | KB | Complessità |
|-------|------|-------|-----|-------------|
| Scene3D | scene3d-modular.js | 1000 | 50 | ✅ BASSA |
| Scene3D | 8 moduli core | 3600 | 183 | ✅ BASSA |
| UI | ui.js | 1200 | 60 | ✅ BASSA |
| UI | 4 moduli core | 3000 | 126 | ✅ BASSA |
| **TOTALE** | **14 file** | **8800** | **419** | **OTTIMALE** |

### Benefici
- ✅ **-78% dimensione file monolitici**
- ✅ **+14 moduli specializzati** (facili da testare)
- ✅ **-10% dimensione totale** (-50KB)
- ✅ **Complessità ciclomatica ridotta** (da 500+ a <100 per file)
- ✅ **Manutenibilità ALTA** (modifiche isolate)
- ✅ **Testabilità ALTA** (unit test per modulo)

---

## 🧪 Testing Strategy

### Unit Tests (per modulo)
```javascript
// Test MovementParser
describe('MovementParser', () => {
    test('parseMovementSteps - traslazione semplice', () => {
        const step = {properties: {Azione1: 'traslazione:(0,0,1,1.0)'}};
        const result = MovementParser.parseMovementSteps(step, 'model');
        expect(result[0].traslazione).toEqual({x:0, y:0, z:1, durata:1.0});
    });
});

// Test NavigationManager
describe('NavigationManager', () => {
    test('jumpToStep - avanza a step specifico', () => {
        NavigationManager.init([step1, step2, step3]);
        NavigationManager.jumpToStep(3);
        expect(NavigationManager.currentStepIndex).toBe(2);
    });
});
```

### Integration Tests
```javascript
// Test flusso completo tutorial
describe('Tutorial Flow', () => {
    test('carica scenario → esegue step → completa', async () => {
        await ScenarioManager.loadScenario('Test');
        await StepExecutor.executeStep(step1);
        // ... verifica risultati
    });
});
```

---

## 🔧 Convenzioni Sviluppo

### Naming Conventions
- **Moduli**: PascalCase (es. `MovementParser.js`)
- **Funzioni**: camelCase (es. `parseMovementSteps()`)
- **Costanti**: UPPER_SNAKE_CASE (es. `MAX_ANIMATIONS`)
- **Privati**: prefisso `_` (es. `_internalHelper()`)

### API Pattern
```javascript
// Export namespace globale
window.ModuleName = {
    // Metodi pubblici
    publicMethod() { ... },

    // Metodi privati (underscore prefix)
    _privateHelper() { ... }
};
```

### Dependency Injection
```javascript
// NO dipendenze hardcoded
// SI dipendenze iniettate
function processStep(step, scene3D, ui) {
    // usa scene3D e ui passati come parametri
}
```

---

## 📚 Documentazione Moduli

Ogni modulo deve avere JSDoc completo:

```javascript
/**
 * MovementParser - Parser comandi movimento tutorial
 * @module core/MovementParser
 * @version 1.0.0
 *
 * @description
 * Parse comandi movimento da tutorial.txt in oggetti strutturati
 * per il sistema di animazione.
 *
 * @example
 * const steps = MovementParser.parseMovementSteps(tutorialStep, 'model.glb');
 * // Ritorna array di step parsati con traslazione, rotazione, etc.
 */
window.MovementParser = {
    /**
     * Parse tutte le azioni (Azione1, Azione2, ...) da uno step
     * @param {Object} tutorialStep - Step tutorial con properties
     * @param {string} modelFilename - Nome file modello per home_config
     * @returns {Array} Array di step parsati
     */
    parseMovementSteps(tutorialStep, modelFilename) {
        // ...
    }
};
```

---

## 🎯 Roadmap Future

### Fase 2 (Febbraio 2026)
- [ ] Implementare unit tests per tutti i moduli
- [ ] Aggiungere TypeScript definitions (.d.ts)
- [ ] Performance profiling con Chrome DevTools

### Fase 3 (Marzo 2026)
- [ ] Migrazione a ES6 modules (import/export)
- [ ] Tree-shaking per produzione
- [ ] Bundle splitting per lazy loading

### Fase 4 (Aprile 2026)
- [ ] Microservices per backend (caricamento scenari remoti)
- [ ] WebWorkers per parsing pesante
- [ ] Service Worker per offline support

---

**Ultimo aggiornamento**: 17 Gennaio 2026
