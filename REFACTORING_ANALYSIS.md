# ANALISI REFACTORING - Campus Virtual Training

**Data Analisi**: 30 Gennaio 2026
**Versione Progetto**: 1.0 Ottimizzata
**Analista**: Claude Opus 4.5 (LLM coder senior specializzato in Three.js)

---

## Vincoli Funzionali (NON NEGOZIABILI)

- **Fonti di verita**: `home_config.txt`, `scenes/*/tutorial.txt`
- NON modificare codice
- NON proporre nuove API
- NON alterare comportamento runtime
- NON cambiare l'uso delle API descritto nei tutorial

---

# PASS 1 - SCAN (Mappatura Oggettiva)

## [FILE] js/ui.js
- **Ruolo principale**: Controller principale UI, esecuzione tutorial, parsing proprieta
- **Componenti Three.js coinvolti**: Nessuno diretto (delega a Scene3D)
- **Dipendenze critiche**: Scene3D, DragDropSystem, ToolsManager, StepController, tutti i core modules
- **Note di complessita iniziale**:
  - 5,528 righe in un singolo file
  - Stato condiviso: `currentPage`, `tutorialSteps`, `currentStepIndex`, `homeConfig`
  - Side-effects: manipolazione DOM diretta, fetch asincroni, timeout multipli
  - Listener: orientationchange, resize, click su fumetto
  - Allocazioni runtime: parsing dinamico proprieta ad ogni step

## [FILE] js/scene3d-modular.js
- **Ruolo principale**: Engine 3D principale, camera, animazioni, interazioni mouse
- **Componenti Three.js coinvolti**: Scene, Camera, Renderer, Raycaster, WebGLRenderer, Vector3, Euler, Box3, DirectionalLight, AmbientLight
- **Dipendenze critiche**: THREE, TWEEN, AppConfig, DragDropSystem, InteractiveObject3D, ParticleSystem
- **Note di complessita iniziale**:
  - 4,923 righe
  - Stato condiviso massiccio: `mouseControls`, `animationSystem`, `highlightSystem`, `tutorialTracker`
  - Logica dentro render loop: `updateActiveAnimations()`, `TWEEN.update()`
  - Allocazioni runtime: new Vector3 in mouse handlers, Box3 in traversal
  - Listener: mousedown, mousemove, mouseup, wheel, keydown, touchstart, touchmove, touchend, resize

## [FILE] js/core/DragDropSystem.js
- **Ruolo principale**: Drag and drop 3D con snap automatico
- **Componenti Three.js coinvolti**: Raycaster, Plane, Vector3, Box3, MeshBasicMaterial
- **Dipendenze critiche**: Scene3D, SnapSystem, InterchangeableTracker, AssemblySystem
- **Note di complessita iniziale**:
  - 3,252 righe
  - Stato condiviso: `enabled`, `isDragging`, `draggedObject`, `originalPositions`, `customSnapTargets`
  - Allocazioni runtime: new Vector3 in onMouseMove (chiamato continuamente)
  - Listener: mousedown, mousemove, mouseup (con capture), keydown

## [FILE] js/core/InteractiveObject3D.js
- **Ruolo principale**: Gestione oggetti 3D con figli interattivi (pulsanti, rotary, LED)
- **Componenti Three.js coinvolti**: Mesh, Group, Material, Color
- **Dipendenze critiche**: Scene3D, StepController, StepGatingManager, TWEEN
- **Note di complessita iniziale**:
  - 1,596 righe
  - Stato condiviso: `objects` (Map), `stateGroups` (Map), `hoveredChild`
  - userData usato come stato applicativo per config interattivi
  - Traversal multipli del scene graph in `attachModel()`

## [FILE] js/core/ScreenSystem.js
- **Ruolo principale**: Sistema schermi interattivi touchscreen simulati
- **Componenti Three.js coinvolti**: Raycaster, MeshBasicMaterial, PlaneGeometry
- **Dipendenze critiche**: Scene3D, HoldableSystem, StepController
- **Note di complessita iniziale**:
  - 1,336 righe
  - Stato condiviso: `screens`, `views`, `hotspots`, `currentViews`, `focusedScreen`
  - State machine: idle -> focused -> interacting
  - Listener: click, mousemove, keydown

## [FILE] js/core/AnimationSystem.js
- **Ruolo principale**: Gestione animazioni modelli, multi-step sequences, camera
- **Componenti Three.js coinvolti**: Vector3, Euler, Box3, Quaternion
- **Dipendenze critiche**: ModelManager, HighlightSystem, UI
- **Note di complessita iniziale**:
  - 1,136 righe (ES Module class)
  - `activeAnimations` array modificato in-place
  - Logica frame-dependent in `updateActiveAnimations()`

## [FILE] js/modelloader.js
- **Ruolo principale**: Caricamento modelli OBJ/STL/GLTF/GLB con batch processing
- **Componenti Three.js coinvolti**: GLTFLoader, OBJLoader, MTLLoader, STLLoader, TextureLoader
- **Dipendenze critiche**: THREE loaders, AppConfig, MobileOptimizer, Scene3D
- **Note di complessita iniziale**:
  - 937 righe
  - Caricamento asincrono non centralizzato
  - Concurrency dinamica basata su device

## [FILE] js/app.js
- **Ruolo principale**: Orchestratore inizializzazione, caricamento moduli dinamico
- **Componenti Three.js coinvolti**: Import ES Module THREE + loaders
- **Dipendenze critiche**: Tutti i moduli (caricamento sequenziale)
- **Note di complessita iniziale**:
  - 669 righe
  - Promise chain per caricamento moduli
  - Try/catch multipli per moduli opzionali

## [FILE] js/core/StepController.js
- **Ruolo principale**: Gestione centralizzata progressione step, trigger multipli
- **Componenti Three.js coinvolti**: Nessuno diretto
- **Dipendenze critiche**: UI, ScreenSystem, InteractiveObject3D
- **Note di complessita iniziale**:
  - 844 righe
  - Coupling con UI per `nextStep()`
  - Parsing azioni in stringhe

## [FILE] js/core/HoldableSystem.js
- **Ruolo principale**: Gestione oggetti prendibili in mano, posizionamento camera-relative
- **Componenti Three.js coinvolti**: Vector3, Euler, Group
- **Dipendenze critiche**: Scene3D, ScreenSystem
- **Note di complessita iniziale**:
  - 716 righe
  - Aggiornamento posizione in render loop
  - Salvataggio/ripristino posizioni originali

## [FILE] js/AutoMode.js
- **Ruolo principale**: Esecuzione automatica tutorial per mobile
- **Componenti Three.js coinvolti**: Raycaster (per simulazione click)
- **Dipendenze critiche**: UI, Scene3D, DragDropSystem
- **Note di complessita iniziale**:
  - 457 righe
  - Polling e setTimeout multipli
  - Simulazione eventi mouse

---

# PASS 2 - RANK (Prioritizzazione Refactoring)

| File | Risk Score | Fattori Principali |
|------|:----------:|-------------------|
| js/ui.js | 5 / 5 | Dimensioni (5528 righe), responsabilita multiple, accoppiamento implicito con 15+ moduli |
| js/scene3d-modular.js | 5 / 5 | Dimensioni (4923 righe), logica in render loop, allocazioni runtime, coupling input-animazione-stato |
| js/core/DragDropSystem.js | 4 / 5 | Dimensioni (3252 righe), stato mutable complesso, allocazioni Vector3, listener non gestiti |
| js/core/InteractiveObject3D.js | 4 / 5 | userData come stato applicativo, traversal multipli, state management disperso |
| js/core/ScreenSystem.js | 3 / 5 | State machine implicita, visibilita con side-effects, coupling con Scene3D |
| js/core/AnimationSystem.js | 3 / 5 | Logica frame-dependent, activeAnimations modificato in-place, calcoli ripetuti |
| js/core/StepController.js | 3 / 5 | Parsing stringhe per azioni, coupling con UI.nextStep(), auto-advance con setTimeout |
| js/modelloader.js | 2 / 5 | Logica asincrona ben isolata, callback nesting |
| js/app.js | 2 / 5 | Promise chain lineare, buona separazione responsabilita |
| js/core/HoldableSystem.js | 2 / 5 | Logica chiara, aggiornamento in render loop |
| js/AutoMode.js | 2 / 5 | Polling-based, ben incapsulato |

---

# PASS 3 - EXPLAIN (Motivazione Tecnica)

Solo per file con Risk Score >= 3

---

## [FILE] js/ui.js - Risk Score: 5/5

### Contesto Three.js coinvolto
Nessuno diretto (delega a Scene3D), ma coordina tutti i sistemi 3D tramite chiamate indirette.

### Code Smell Principali

1. **God Object**: 5500+ righe con responsabilita multiple:
   - Navigazione pagine
   - Parsing home_config.txt
   - Parsing tutorial.txt
   - Esecuzione step tutorial
   - Gestione modals (info, congratulazioni)
   - Gestione tool e cursori
   - Caricamento scenari
   - Controlli mobile

2. **Stato condiviso non incapsulato**: `currentStepIndex`, `tutorialSteps`, `currentScenario` accessibili globalmente

3. **Parsing imperativo disperso**: Logic di parsing proprieta tutorial (3000+ righe) mischiato con esecuzione

4. **Side-effects non tracciabili**: `executeStep()` modifica stato di 10+ sistemi esterni

### Rischi Concreti
- **Race condition**: `autoAdvanceTimeoutId` e `autoExecuteIntervalId` possono sovrapporsi
- **Leak memoria**: timeout non cancellati in tutti i path di uscita
- **Inconsistenza stato**: `goHome()` tenta reset di tutti i sistemi ma puo fallire silenziosamente

### Beneficio Atteso dal Refactoring
- Separazione in: `TutorialParser`, `StepExecutor`, `ModalManager`, `ScenarioLoader`
- Stato tutorial isolato e testabile
- Side-effects centralizzati e tracciabili

### Vincoli da Rispettare
- API tutorial.txt invariata (Posizione=, Rotazione=, Azione1=, etc.)
- Comportamento `goToStep()`, `nextStep()`, `jumpToStep()` identico
- Compatibilita con home_config.txt esistenti

---

## [FILE] js/scene3d-modular.js - Risk Score: 5/5

### Contesto Three.js coinvolto
Scene, Camera, Renderer, Raycaster, WebGLRenderer, lights, mouse controls, animations (TWEEN).

### Code Smell Principali

1. **Oggetto monolitico**: 4900+ righe con:
   - Inizializzazione scena
   - Controlli camera
   - Mouse/touch handlers
   - Animazioni
   - Highlight system
   - Tutorial tracker
   - Export posizioni

2. **Allocazioni in hot path**: In onMouseMove (chiamato 60+ volte/secondo) vengono creati nuovi Vector3

3. **Stato interpolazione complesso**: `mouseControls.interpolation` con 8 campi interdipendenti

4. **Logica animazione in render loop**: `updateActiveAnimations()` modifica stato modelli durante frame

### Rischi Concreti
- **Garbage collection spikes**: allocazioni Vector3/Box3 ogni frame
- **Frame drops**: traversal scene graph in mouse handlers
- **State leak**: `highlightSystem.originalMaterials` puo crescere indefinitamente

### Beneficio Atteso dal Refactoring
- Separazione: `CameraController`, `MouseInputHandler`, `AnimationExecutor`, `HighlightManager`
- Pool di Vector3/Box3 per hot path
- Stato animazioni in struttura dati immutabile

### Vincoli da Rispettare
- API `Scene3D.findModelByName()` invariata
- `getCameraInfo()`, `setCameraFromInfo()` compatibili
- Comportamento mouse (rotazione, pan, zoom) identico

---

## [FILE] js/core/DragDropSystem.js - Risk Score: 4/5

### Contesto Three.js coinvolto
Raycaster, Plane, Vector3, Box3, materiali per feedback visivo.

### Code Smell Principali

1. **Stato mutable complesso**: occupiedSnapPositions, objectSnapPosition, snapPositionKeys, customSnapTargets (tutte Map)

2. **Allocazioni in onMouseMove**: new Box3 e new Vector3 ad ogni movimento mouse

3. **Listener lifecycle non gestito**: `document.addEventListener` senza corrispondente cleanup in alcuni path

4. **Raycasting duplicato**: calcoli simili in `onMouseDown`, `onMouseMove`, `onMouseUp`

### Rischi Concreti
- **Memory leak**: listener su document non rimossi se `disable()` non chiamato
- **GC pressure**: allocazioni continue durante drag
- **State inconsistente**: `originalPositions` puo divergere dalla realta se errori

### Beneficio Atteso dal Refactoring
- Separazione: `DragEngine`, `SnapEngine`, `PositionTracker`
- Object pool per Vector3/Box3
- Lifecycle listener esplicito con auto-cleanup

### Vincoli da Rispettare
- Sintassi tutorial: `DragDrop=true`, `DragDropObjects=`, `SnapTargets=`, `SnapPoint=`
- Comportamento snap identico (distanza, indicatori)
- Compatibilita con AssemblySystem

---

## [FILE] js/core/InteractiveObject3D.js - Risk Score: 4/5

### Contesto Three.js coinvolto
Mesh traversal, userData, Material cloning, emissive properties.

### Code Smell Principali

1. **userData come stato applicativo**: child.userData.interactive, interactiveConfig, originalEmissive

2. **Traversal multipli**: model3D.traverse() chiamato 2 volte in attachModel()

3. **Coupling implicito**: dipende da naming convention mesh in GLB (`chiave0`, `pstart0`)

4. **State management disperso**: `objects` Map + `stateGroups` Map + `highlightedButtons` Map

### Rischi Concreti
- **Inconsistenza stato**: `applyState()` puo lasciare mesh in stato intermedio se errori
- **Materiale non ripristinato**: `originalEmissive` sovrascritto se hover multipli rapidi
- **Performance**: traversal O(n) su ogni `attachModel()`

### Beneficio Atteso dal Refactoring
- Separazione: `ButtonSystem`, `RotarySystem`, `IndicatorSystem`, `StateMachine`
- Stato centralizzato invece che disperso in userData
- Traversal singolo con caching struttura

### Vincoli da Rispettare
- Sintassi tutorial: `InteractiveChild=`, `InitialState=`, `StateGroup=`
- Comportamento click/hover identico
- Compatibilita con naming convention Blender export

---

## [FILE] js/core/ScreenSystem.js - Risk Score: 3/5

### Contesto Three.js coinvolto
Raycaster per hotspot detection, MeshBasicMaterial, visibilita modelli.

### Code Smell Principali

1. **State machine implicita**: transizioni `idle -> focused -> interacting` non formalizzate

2. **Visibilita con side-effects**: `initializeVisibility()` modifica `model.visible` direttamente

3. **Coupling con Scene3D**: `Scene3D.findModelByName()` chiamato ripetutamente

### Rischi Concreti
- **Stato incoerente**: `currentViews` Map puo divergere da visibilita effettiva modelli
- **Transizioni non valide**: possibile passare da `idle` a `interacting` senza `focused`

### Beneficio Atteso dal Refactoring
- State machine esplicita con transizioni validate
- Visibilita gestita da observer pattern
- Caching riferimenti modelli invece di lookup ripetuti

### Vincoli da Rispettare
- Sintassi: `[Screen:]`, `[ScreenView:]`, `[Hotspot:]`, `[ScreenAction:]`
- Comportamento navigazione viste identico
- Compatibilita con HoldableSystem

---

## [FILE] js/core/AnimationSystem.js - Risk Score: 3/5

### Contesto Three.js coinvolto
Vector3, Euler, Box3, Quaternion per calcoli trasformazione.

### Code Smell Principali

1. **Logica frame-dependent**: `updateActiveAnimations()` assume chiamata ogni frame

2. **Mutazione in-place**: `activeAnimations.push()` e `splice()` durante iterazione

3. **Calcoli ripetuti**: `calculateModelCenter()` puo essere chiamato multiple volte per stesso modello

### Rischi Concreti
- **Skip frame**: se frame mancati, animazioni non interpolate correttamente
- **Index shift**: rimozione elementi durante iterazione puo saltare animazioni

### Beneficio Atteso dal Refactoring
- Animazioni basate su tempo delta invece che frame count
- Struttura dati immutabile per active animations
- Caching center modelli

### Vincoli da Rispettare
- Sintassi: `Azione1=svita`, `Azione2=traslazione:(x,y,z,t)`
- Durata e easing identici
- Compatibilita con DrivenObjects

---

## [FILE] js/core/StepController.js - Risk Score: 3/5

### Contesto Three.js coinvolto
Nessuno diretto.

### Code Smell Principali

1. **Parsing stringhe per azioni**: if (action.startsWith('setVariant:')) ...

2. **Coupling con UI**: chiama direttamente `UI.nextStep()`

3. **Auto-advance con setTimeout**: puo causare race condition con input utente

### Rischi Concreti
- **Parsing fragile**: errori sintassi azioni non gestiti gracefully
- **Race condition**: auto-advance mentre utente clicca manualmente

### Beneficio Atteso dal Refactoring
- Action parser con validazione formale
- Event emitter invece di chiamate dirette a UI
- Auto-advance cancellabile e debounced

### Vincoli da Rispettare
- Sintassi: `AcceptTrigger_Physical=`, `OnPhysicalTrigger=`, `AutoAdvance=`
- Comportamento trigger identico
- Compatibilita con InteractiveObject3D

---

# RIEPILOGO PRIORITA
| Priorita | File | Score | Azione Suggerita |
|----------|------|:-----:|-----------------|
| ALTA | js/ui.js | 5/5 | Separazione responsabilita urgente |
| ALTA | js/scene3d-modular.js | 5/5 | Eliminare allocazioni hot path |
| MEDIA | js/core/DragDropSystem.js | 4/5 | Lifecycle listener + object pool |
| MEDIA | js/core/InteractiveObject3D.js | 4/5 | Centralizzare stato, ridurre traversal |
| BASSA | js/core/ScreenSystem.js | 3/5 | Formalizzare state machine |
| BASSA | js/core/AnimationSystem.js | 3/5 | Time-based animation |
| BASSA | js/core/StepController.js | 3/5 | Parser formale azioni |

---

# STATISTICHE PROGETTO

| Metrica | Valore |
|---------|--------|
| File JavaScript attivi | 40 |
| Linee totali codice | ~33,700 |
| File con Risk >= 4 | 4 |
| File con Risk >= 3 | 7 |
| Moduli core | 32 |
| Moduli UI | 10 |

---

# DISCLAIMER

Questa analisi e puramente diagnostica.

- Nessuna modifica al codice e stata proposta ne eseguita
- Nessuna nuova API e stata suggerita
- Il contratto funzionale definito in home_config.txt e nei file tutorial.txt rimane INVARIATO
- L'analisi rispetta il principio guida: "In un sistema Three.js il refactoring serve a rendere deterministico cio che oggi e implicito"

---

Generato da: Claude Opus 4.5
Data: 30 Gennaio 2026
