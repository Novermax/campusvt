 REFACTORING RITUAL: js/ui.js

  1️⃣ COSA FA OGGI IL FILE

  ui.js è il controller principale dell'interfaccia utente del sistema di training 3D. Con ~5528 righe, gestisce:    

  - Navigazione pagine: login, home, scenario selection, tutorial execution
  - Parsing tutorial: lettura e interpretazione di tutorial.txt e home_config.txt
  - Esecuzione step: orchestrazione delle azioni per ogni step del tutorial
  - Gestione strumenti: attivazione/disattivazione tool (brugola, chiave inglese, mani, aria)
  - Controlli mobili: gestione touch controls per dispositivi mobile
  - Modal informativi: sistema di messaggi bloccanti con immagini/video
  - Progress bar: feedback visivo avanzamento tutorial
  - Autenticazione: validazione credenziali da users.txt
  - Caricamento scenari: loading modelli 3D e configurazione scena

  ---
  2️⃣ RESPONSABILITÀ MESCOLATE (Code Smells)

  ┌─────────────────┬────────────────────────────────────────────────────────────────────────┬──────────────────────┐  │      Area       │                             Responsabilità                             │ Linee approssimative │  ├─────────────────┼────────────────────────────────────────────────────────────────────────┼──────────────────────┤  │ Stato globale   │ currentPage, tutorialSteps, currentStepIndex, toolsState, scenarioPath │ sparse               │  ├─────────────────┼────────────────────────────────────────────────────────────────────────┼──────────────────────┤  │ Parsing         │ parseTutorialContent(), parseHomeConfig(), config step                 │ 1800-2200            │  ├─────────────────┼────────────────────────────────────────────────────────────────────────┼──────────────────────┤  │ Esecuzione      │ executeStep(), goToStep(), nextStep(), previousStep()                  │ 2700-3500            │  ├─────────────────┼────────────────────────────────────────────────────────────────────────┼──────────────────────┤  │ UI rendering    │ updateProgressBar(), updateStepCounter(), modal management             │ 3000-3200            │  ├─────────────────┼────────────────────────────────────────────────────────────────────────┼──────────────────────┤  │ Autenticazione  │ login(), validateCredentials(), checkExpiration()                      │ 300-450              │  ├─────────────────┼────────────────────────────────────────────────────────────────────────┼──────────────────────┤  │ Tool management │ toggleTool(), getActiveTool(), setToolCursor()                         │ 1200-1400            │  ├─────────────────┼────────────────────────────────────────────────────────────────────────┼──────────────────────┤  │ Scene loading   │ loadScenario(), applyScenarioConfiguration()                           │ 600-900              │  ├─────────────────┼────────────────────────────────────────────────────────────────────────┼──────────────────────┤  │ Navigation      │ showPage(), goHome(), goBack()                                         │ 200-350              │  ├─────────────────┼────────────────────────────────────────────────────────────────────────┼──────────────────────┤  │ Mobile          │ touch handlers, gesture detection                                      │ 1500-1700            │  └─────────────────┴────────────────────────────────────────────────────────────────────────┴──────────────────────┘  Pattern identificato: God Object con ~15 responsabilità distinte in un unico namespace UI.

  ---
  3️⃣ PUNTI A RISCHIO BUG


  3.1 Race Conditions con setTimeout

  Linee 2706, 2723, 2381, 3046-3094
  - Uso estensivo di setTimeout per sequenziamento azioni
  - Nessuna cancellazione di timeout pendenti in goHome() o cambio tutorial
  - Rischio: Azioni eseguite dopo reset stato, modelli mancanti

  3.2 Stato Inconsistente in goHome()

  Linee ~350-400
  - Reset parziale dello stato durante navigazione
  - currentStepIndex potrebbe non essere sincronizzato con UI visibile
  - Rischio: Step indicator mostra valore errato dopo navigazione

  3.3 Parsing Misto con Esecuzione

  Linee 2700-3000 (executeStep)
  - executeStep() fa sia parsing proprietà step che esecuzione azioni
  - Logica condizionale profondamente annidata (if/else su 15+ proprietà)
  - Rischio: Ordine esecuzione non deterministico, difficile debug

  3.4 Dipendenze Implicite da window.*

  Sparse in tutto il file
  - Chiamate dirette a window.Scene3D, window.DragDropSystem, window.StepController
  - Nessun check esistenza prima dell'uso in alcuni path
  - Rischio: Errori runtime se moduli caricati in ordine diverso

  3.5 Gestione Asincrona Modal

  Linee 3046-3170
  - showInfoModal() ritorna Promise ma alcune chiamate non usano await
  - Video non sempre fermato correttamente alla chiusura
  - Rischio: Memory leak, audio che continua dopo chiusura

  ---
  4️⃣ REFACTORING INTERNI MINIMI PROPOSTI


  4.1 Estrazione Funzioni Pure di Parsing

  Candidati:
  - parseStepProperties(rawText) → oggetto step strutturato
  - parsePositionString("(x,y,z)") → {x, y, z}
  - parseActionString("traslazione:(x,y,z,dur)") → oggetto action
  - parseDrivenObjects(string) → array config

  Beneficio: Parsing testabile indipendentemente, riutilizzabile

  4.2 Isolamento Stato in Oggetto Interno

  // Da variabili sparse a oggetto state
  const state = {
      currentPage: 'login',
      tutorial: {
          steps: [],
          currentIndex: -1,
          isExecuting: false
      },
      scenario: {
          path: null,
          config: null
      },
      tools: {
          active: null,
          available: []
      }
  };

  Beneficio: Accesso esplicito, logging centralizzato, snapshot per debug

  4.3 Separazione executeStep in Fasi

  Attualmente executeStep() è una funzione monolitica di ~300 righe. Proposta:

  1. prepareStepContext(step) - raccoglie dati necessari
  2. applyStepTransforms(step) - posizioni, rotazioni statiche
  3. executeStepActions(step) - animazioni, drag&drop
  4. finalizeStep(step) - cleanup, UI update

  Beneficio: Debug per fase, possibilità di skip fasi specifiche

  4.4 Centralizzazione Timeout Management

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

  Beneficio: Chiamata clearAllPendingTimeouts() in goHome() previene race condition

  4.5 Introduzione Commenti Strutturali

  Aggiungere commenti di sezione per delimitare aree funzionali:

  // ═══════════════════════════════════════════════════════════
  // SEZIONE: PARSING TUTORIAL
  // ═══════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════
  // SEZIONE: ESECUZIONE STEP
  // ═══════════════════════════════════════════════════════════

  Beneficio: Navigazione file più rapida, onboarding sviluppatori

  ---
  5️⃣ PERCHÉ IL COMPORTAMENTO RESTA IDENTICO


  Ogni refactoring proposto è interno e non modifica:
  ┌──────────────┬──────────────────────────────────────────────────────────────────┐
  │   Aspetto    │                             Garanzia                             │
  ├──────────────┼──────────────────────────────────────────────────────────────────┤
  │ API pubblica │ UI.nextStep(), UI.goToStep(), UI.loadScenario() mantengono firme │
  ├──────────────┼──────────────────────────────────────────────────────────────────┤
  │ Eventi       │ Stessi eventi emessi negli stessi momenti                        │
  ├──────────────┼──────────────────────────────────────────────────────────────────┤
  │ Timing       │ Stessi delay tra azioni (configurabili ma non modificati)        │
  ├──────────────┼──────────────────────────────────────────────────────────────────┤
  │ Parsing      │ Output identico per stesso input tutorial.txt                    │
  ├──────────────┼──────────────────────────────────────────────────────────────────┤
  │ Stato finale │ Stesse posizioni modelli, stesso step index dopo ogni azione     │
  └──────────────┴──────────────────────────────────────────────────────────────────┘
  Strategia di validazione:
  1. Eseguire stesso tutorial prima e dopo refactoring
  2. Confrontare log console (sequenza chiamate)
  3. Verificare posizioni modelli a fine tutorial identiche

  ---
  6️⃣ COSA NON STO TOCCANDO

  ┌───────────────────────────────────┬────────────────────────────────────────────────────────┐
  │             Elemento              │                         Motivo                         │
  ├───────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Sintassi tutorial.txt             │ Contratto funzionale bloccante                         │
  ├───────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Sintassi home_config.txt          │ Contratto funzionale bloccante                         │
  ├───────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Ordine esecuzione azioni          │ Potrebbe rompere tutorial esistenti                    │
  ├───────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Nomi funzioni pubbliche           │ API utilizzate da altri moduli                         │
  ├───────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Logica autenticazione             │ Funzionante, basso rischio                             │
  ├───────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Sistema modal                     │ Recentemente implementato, stabile                     │
  ├───────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Integrazione mobile               │ AutoMode e MobileOptimizer dipendono da stato corrente │
  ├───────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Chiamate a Scene3D/DragDropSystem │ Interfacce stabilizzate                                │
  └───────────────────────────────────┴────────────────────────────────────────────────────────┘
  ---
  DICHIARAZIONE DI COMPATIBILITÀ

  Questo refactoring è backward compatible perché:
  1. Estrae solo funzioni pure interne senza modificare firme pubbliche
  2. Raggruppa stato esistente senza cambiare valori o lifecycle
  3. Separa fasi di executeStep mantenendo ordine e output identici
  4. Aggiunge solo meccanismi di protezione (timeout cleanup) senza alterare flusso normale
  5. Non modifica parsing di tutorial.txt né home_config.txt

  ---
  Prossimo file da analizzare: js/scene3d-modular.js (quando richiesto)

 ▐▛███▜▌   Claude Code v2.1.23
▝▜█████▛▘  Opus 4.5 · Claude Pro
  ▘▘ ▝▝    ~\campus_virtual_training

 ⚠Large CLAUDE.md will impact performance (171.6k chars > 40.0k) • /memory to edit

✻ Conversation compacted (ctrl+o for history)

  ⎿  Read refattorizza.txt (195 lines)
  ⎿  Referenced file REFACTORING_ANALYSIS.md
  ⎿  Read refactoring.txt (123 lines)
  ⎿  Referenced file js\ui.js
  ⎿  Referenced file js\core\InteractiveObject3D.js

● Proseguo con l'analisi rituale di js/ui.js secondo le istruzioni di refattorizza.txt.

  ---
  REFACTORING RITUAL: js/ui.js

  1️⃣ COSA FA OGGI IL FILE
 

  ui.js è il controller principale dell'interfaccia utente del sistema di training 3D. Con ~5528 righe, gestisce:    

  - Navigazione pagine: login, home, scenario selection, tutorial execution
  - Parsing tutorial: lettura e interpretazione di tutorial.txt e home_config.txt
  - Esecuzione step: orchestrazione delle azioni per ogni step del tutorial
  - Gestione strumenti: attivazione/disattivazione tool (brugola, chiave inglese, mani, aria)
  - Controlli mobili: gestione touch controls per dispositivi mobile
  - Modal informativi: sistema di messaggi bloccanti con immagini/video
  - Progress bar: feedback visivo avanzamento tutorial
  - Autenticazione: validazione credenziali da users.txt
  - Caricamento scenari: loading modelli 3D e configurazione scena

  ---
  2️⃣ RESPONSABILITÀ MESCOLATE (Code Smells)
 
  ┌─────────────────┬────────────────────────────────────────────────────────────────────────┬──────────────────────┐  │      Area       │                             Responsabilità                             │ Linee approssimative │  ├─────────────────┼────────────────────────────────────────────────────────────────────────┼──────────────────────┤  │ Stato globale   │ currentPage, tutorialSteps, currentStepIndex, toolsState, scenarioPath │ sparse               │  ├─────────────────┼────────────────────────────────────────────────────────────────────────┼──────────────────────┤  │ Parsing         │ parseTutorialContent(), parseHomeConfig(), config step                 │ 1800-2200            │  ├─────────────────┼────────────────────────────────────────────────────────────────────────┼──────────────────────┤  │ Esecuzione      │ executeStep(), goToStep(), nextStep(), previousStep()                  │ 2700-3500            │  ├─────────────────┼────────────────────────────────────────────────────────────────────────┼──────────────────────┤  │ UI rendering    │ updateProgressBar(), updateStepCounter(), modal management             │ 3000-3200            │  ├─────────────────┼────────────────────────────────────────────────────────────────────────┼──────────────────────┤  │ Autenticazione  │ login(), validateCredentials(), checkExpiration()                      │ 300-450              │  ├─────────────────┼────────────────────────────────────────────────────────────────────────┼──────────────────────┤  │ Tool management │ toggleTool(), getActiveTool(), setToolCursor()                         │ 1200-1400            │  ├─────────────────┼────────────────────────────────────────────────────────────────────────┼──────────────────────┤  │ Scene loading   │ loadScenario(), applyScenarioConfiguration()                           │ 600-900              │  ├─────────────────┼────────────────────────────────────────────────────────────────────────┼──────────────────────┤  │ Navigation      │ showPage(), goHome(), goBack()                                         │ 200-350              │  ├─────────────────┼────────────────────────────────────────────────────────────────────────┼──────────────────────┤  │ Mobile          │ touch handlers, gesture detection                                      │ 1500-1700            │  └─────────────────┴────────────────────────────────────────────────────────────────────────┴──────────────────────┘  Pattern identificato: God Object con ~15 responsabilità distinte in un unico namespace UI.

  ---
  3️⃣ PUNTI A RISCHIO BUG


  3.1 Race Conditions con setTimeout

  Linee 2706, 2723, 2381, 3046-3094
  - Uso estensivo di setTimeout per sequenziamento azioni
  - Nessuna cancellazione di timeout pendenti in goHome() o cambio tutorial
  - Rischio: Azioni eseguite dopo reset stato, modelli mancanti

  3.2 Stato Inconsistente in goHome()

  Linee ~350-400
  - Reset parziale dello stato durante navigazione
  - currentStepIndex potrebbe non essere sincronizzato con UI visibile
  - Rischio: Step indicator mostra valore errato dopo navigazione

  3.3 Parsing Misto con Esecuzione

  Linee 2700-3000 (executeStep)
  - executeStep() fa sia parsing proprietà step che esecuzione azioni
  - Logica condizionale profondamente annidata (if/else su 15+ proprietà)
  - Rischio: Ordine esecuzione non deterministico, difficile debug

  3.4 Dipendenze Implicite da window.*

  Sparse in tutto il file
  - Chiamate dirette a window.Scene3D, window.DragDropSystem, window.StepController
  - Nessun check esistenza prima dell'uso in alcuni path
  - Rischio: Errori runtime se moduli caricati in ordine diverso

  3.5 Gestione Asincrona Modal

  Linee 3046-3170
  - showInfoModal() ritorna Promise ma alcune chiamate non usano await
  - Video non sempre fermato correttamente alla chiusura
  - Rischio: Memory leak, audio che continua dopo chiusura

  ---
  4️⃣ REFACTORING INTERNI MINIMI PROPOSTI


  4.1 Estrazione Funzioni Pure di Parsing

  Candidati:
  - parseStepProperties(rawText) → oggetto step strutturato
  - parsePositionString("(x,y,z)") → {x, y, z}
  - parseActionString("traslazione:(x,y,z,dur)") → oggetto action
  - parseDrivenObjects(string) → array config

  Beneficio: Parsing testabile indipendentemente, riutilizzabile

  4.2 Isolamento Stato in Oggetto Interno

  // Da variabili sparse a oggetto state
  const state = {
      currentPage: 'login',
      tutorial: {
          steps: [],
          currentIndex: -1,
          isExecuting: false
      },
      scenario: {
          path: null,
          config: null
      },
      tools: {
          active: null,
          available: []
      }
  };

  Beneficio: Accesso esplicito, logging centralizzato, snapshot per debug

  4.3 Separazione executeStep in Fasi

  Attualmente executeStep() è una funzione monolitica di ~300 righe. Proposta:

  1. prepareStepContext(step) - raccoglie dati necessari
  2. applyStepTransforms(step) - posizioni, rotazioni statiche
  3. executeStepActions(step) - animazioni, drag&drop
  4. finalizeStep(step) - cleanup, UI update

  Beneficio: Debug per fase, possibilità di skip fasi specifiche

  4.4 Centralizzazione Timeout Management

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

  Beneficio: Chiamata clearAllPendingTimeouts() in goHome() previene race condition

  4.5 Introduzione Commenti Strutturali

  Aggiungere commenti di sezione per delimitare aree funzionali:

  // ═══════════════════════════════════════════════════════════
  // SEZIONE: PARSING TUTORIAL
  // ═══════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════
  // SEZIONE: ESECUZIONE STEP
  // ═══════════════════════════════════════════════════════════

  Beneficio: Navigazione file più rapida, onboarding sviluppatori

  ---
  5️⃣ PERCHÉ IL COMPORTAMENTO RESTA IDENTICO


  Ogni refactoring proposto è interno e non modifica:
  ┌──────────────┬──────────────────────────────────────────────────────────────────┐
  │   Aspetto    │                             Garanzia                             │
  ├──────────────┼──────────────────────────────────────────────────────────────────┤
  │ API pubblica │ UI.nextStep(), UI.goToStep(), UI.loadScenario() mantengono firme │
  ├──────────────┼──────────────────────────────────────────────────────────────────┤
  │ Eventi       │ Stessi eventi emessi negli stessi momenti                        │
  ├──────────────┼──────────────────────────────────────────────────────────────────┤
  │ Timing       │ Stessi delay tra azioni (configurabili ma non modificati)        │
  ├──────────────┼──────────────────────────────────────────────────────────────────┤
  │ Parsing      │ Output identico per stesso input tutorial.txt                    │
  ├──────────────┼──────────────────────────────────────────────────────────────────┤
  │ Stato finale │ Stesse posizioni modelli, stesso step index dopo ogni azione     │
  └──────────────┴──────────────────────────────────────────────────────────────────┘
  Strategia di validazione:
  1. Eseguire stesso tutorial prima e dopo refactoring
  2. Confrontare log console (sequenza chiamate)
  3. Verificare posizioni modelli a fine tutorial identiche

  ---
  6️⃣ COSA NON STO TOCCANDO

  ┌───────────────────────────────────┬────────────────────────────────────────────────────────┐
  │             Elemento              │                         Motivo                         │
  ├───────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Sintassi tutorial.txt             │ Contratto funzionale bloccante                         │
  ├───────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Sintassi home_config.txt          │ Contratto funzionale bloccante                         │
  ├───────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Ordine esecuzione azioni          │ Potrebbe rompere tutorial esistenti                    │
  ├───────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Nomi funzioni pubbliche           │ API utilizzate da altri moduli                         │
  ├───────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Logica autenticazione             │ Funzionante, basso rischio                             │
  ├───────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Sistema modal                     │ Recentemente implementato, stabile                     │
  ├───────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Integrazione mobile               │ AutoMode e MobileOptimizer dipendono da stato corrente │
  ├───────────────────────────────────┼────────────────────────────────────────────────────────┤
  │ Chiamate a Scene3D/DragDropSystem │ Interfacce stabilizzate                                │
  └───────────────────────────────────┴────────────────────────────────────────────────────────┘
  ---
  DICHIARAZIONE DI COMPATIBILITÀ

  Questo refactoring è backward compatible perché:
  1. Estrae solo funzioni pure interne senza modificare firme pubbliche
  2. Raggruppa stato esistente senza cambiare valori o lifecycle
  3. Separa fasi di executeStep mantenendo ordine e output identici
  4. Aggiunge solo meccanismi di protezione (timeout cleanup) senza alterare flusso normale
  5. Non modifica parsing di tutorial.txt né home_config.txt

  ---
  Prossimo file da analizzare: js/scene3d-modular.js (quando richiesto)

  Vuoi che proceda con l'analisi del prossimo file o preferisci approfondire qualche aspetto di ui.js?

✻ Cooked for 2m 12s

❯ procedi in sequenza 

● Procedo con il prossimo file: js/scene3d-modular.js

  Prima devo leggere il file completamente per eseguire il rituale di refactoring.

● Read 1 file (ctrl+o to expand)

● File molto grande. Lo leggo in porzioni.

● Read 1 file (ctrl+o to expand)

● Ho letto sufficientemente il file. Ora produco l'analisi rituale.

  ---
  REFACTORING RITUAL: js/scene3d-modular.js

  1️⃣ COSA FA OGGI IL FILE                                                        C

  scene3d-modular.js è il motore 3D principale del sistema. Con ~4600 righe, gestisce:

  - Scena Three.js: Inizializzazione scene, camera, renderer, luci
  - Controlli camera: Rotazione, pan, zoom, pivot dinamico, animazioni fluide
  - Raycasting: Rilevamento click e hover su oggetti 3D
  - Gestione modelli: Caricamento, aggiunta, rimozione, ricerca modelli
  - Sistema animazioni: updateAnimations(), multi-step, svita/avvita, rotazione attorno a centro
  - Highlight/Silhouette: Evidenziazione modelli, materiali originali, feedback visivo
  - Tutorial integration: getCurrentTutorialStep(), advanceToNextTutorialStep()
  - Salvataggio posizioni: initialModelPositions, scenarioOriginalPositions, reset
  - Integrazioni sottosistemi: DragDropSystem, ParticleSystem, ScreenSystem, HoldableSystem
  - Effetti tool: handleAirToolEffect(), handleSprayToolEffect()
  - Debug/Export: exportCurrentModelPositions(), getCameraInfo()

  ---
  2️⃣ RESPONSABILITÀ MESCOLATE (Code Smells)

  ┌───────────────────┬──────────────────────────────────────────────────────────────────────────┬──────────────────┐  │       Area        │                              Responsabilità                              │      Linee       │  │                   │                                                                          │  approssimative  │  ├───────────────────┼──────────────────────────────────────────────────────────────────────────┼──────────────────┤  │ Stato globale     │ scene, camera, renderer, loadedModels, mouseControls, animationSystem,   │ 6-95             │  │                   │ highlightSystem, tutorialTracker                                         │                  │  ├───────────────────┼──────────────────────────────────────────────────────────────────────────┼──────────────────┤  │ Inizializzazione  │ init(), initScene(), initCamera(), initRenderer(), initLights(),         │ 96-670           │  │                   │ initSubsystems()                                                         │                  │  ├───────────────────┼──────────────────────────────────────────────────────────────────────────┼──────────────────┤  │ Camera            │ rotateCamera(), zoomCamera(), panCamera(), applyCameraSettings(),        │ 977-1066,        │  │                   │ updateCameraAnimation(), animateCameraToPivot()                          │ 3682-4102        │  ├───────────────────┼──────────────────────────────────────────────────────────────────────────┼──────────────────┤  │ Input             │ onMouseDown(), onMouseUp(), onMouseMove(), onMouseWheel(),               │ 672-975          │  │                   │ onTouchStart/Move/End(), onKeyDown()                                     │                  │  ├───────────────────┼──────────────────────────────────────────────────────────────────────────┼──────────────────┤  │ Animazioni        │ updateAnimations(), applyRotationAroundCenter(), startModelAnimation(),  │ 2471-2795,       │  │                   │ calculateAnimationTargets()                                              │ 1959-2022        │  ├───────────────────┼──────────────────────────────────────────────────────────────────────────┼──────────────────┤  │ Highlight         │ highlightModel(), removeHighlight(), saveOriginalMaterials(),            │ 1276-1420        │  │                   │ applyHighlightMaterial()                                                 │                  │  ├───────────────────┼──────────────────────────────────────────────────────────────────────────┼──────────────────┤  │ Modelli           │ addModel(), clearAllModels(), findModelByName(), isModelSelectable()     │ 1099-1275,       │  │                   │                                                                          │ 4409-4599        │  ├───────────────────┼──────────────────────────────────────────────────────────────────────────┼──────────────────┤  │ Posizioni         │ saveInitialModelPosition(), resetModelToInitialPosition(),               │ 2855-3040        │  │                   │ resetAllModelsToScenarioPositions()                                      │                  │  ├───────────────────┼──────────────────────────────────────────────────────────────────────────┼──────────────────┤  │ Effetti           │ handleAirToolEffect(), handleSprayToolEffect()                           │ 1512-1658        │  │ particellari      │                                                                          │                  │  ├───────────────────┼──────────────────────────────────────────────────────────────────────────┼──────────────────┤  │ Debug             │ getCameraInfo(), exportCurrentModelPositions(), testCongratulations()    │ 223-278,         │  │                   │                                                                          │ 3391-3496        │  ├───────────────────┼──────────────────────────────────────────────────────────────────────────┼──────────────────┤  │ Congratulazioni   │ showTutorialCompletionCongratulations(), displayCongratulationsModal()   │ 3079-3193        │  ├───────────────────┼──────────────────────────────────────────────────────────────────────────┼──────────────────┤  │ Render loop       │ startRenderLoop(), render()                                              │ 3648-3680        │  └───────────────────┴──────────────────────────────────────────────────────────────────────────┴──────────────────┘  Pattern identificato: Monolite con ~20+ responsabilità, file troppo lungo per manutenzione efficace.

  ---
  3️⃣ PUNTI A RISCHIO BUG


  3.1 Stato Animazioni Condiviso

  Linee 26-31, 2471-2672
  - animationSystem.activeAnimations è un array mutabile globale
  - Iterazione inversa per rimozione (splice(i, 1)) ma iterazione stessa dipende da indice
  - Rischio: Race condition se animazione modificata durante iterazione

  3.2 Dipendenza Circolare con UI.js

  Linee 2797-2804, 3042-3074
  - getCurrentTutorialStep() accede direttamente a window.UI.tutorialSteps
  - advanceToNextTutorialStep() chiama window.UI.goToStep()
  - Rischio: Se UI.js non caricato o stato inconsistente, crash runtime

  3.3 Timeout Non Gestiti in advanceToNextTutorialStep

  Linee 3060-3072
  - setTimeout(() => window.UI.goToStep(...), 100) senza cancellazione
  - Se scenario cambiato durante timeout, step sbagliato potrebbe avanzare
  - Rischio: Avanzamento fantasma dopo cambio tutorial

  3.4 Allocazioni nel Render Loop

  Linee 2507-2511, 2519-2521, 2684-2685
  - new THREE.Quaternion(), new THREE.Vector3() create ad ogni frame
  - lerpVectors() in loop
  - Rischio: Garbage collection frequente, frame rate instabile

  3.5 Gestione Materiali Originali

  Linee 1299-1362
  - highlightSystem.originalMaterials è una Map separata
  - Se modello rimosso durante highlight, Map contiene riferimenti orfani
  - Rischio: Memory leak, materiali non deallocati

  3.6 Posizioni Salvate Non Sincronizzate

  Linee 2855-3040
  - initialModelPositions e scenarioOriginalPositions sono due Map separate
  - resetModelToInitialPosition() e resetModelToScenarioPosition() potrebbero divergere
  - Rischio: Stato inconsistente tra reset tutorial e reset scenario

  ---
  4️⃣ REFACTORING INTERNI MINIMI PROPOSTI


  4.1 Estrazione Object Pool per Animazioni

  Candidati per pooling:
  // Pool riutilizzabile invece di allocazioni in loop
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

  Beneficio: Eliminazione GC spikes nel render loop

  4.2 Isolamento Stato Camera in Oggetto Interno

  // Da mouseControls sparse a cameraState strutturato
  const cameraState = {
      input: {
          isMouseDown: false,
          lastPosition: { x: 0, y: 0 },
          mouseButton: 0
      },
      pivot: new THREE.Vector3(),
      limits: {
          minPhi: 0.2,
          maxPhi: Math.PI * 0.45,
          minY: 0.0,
          minZoom: 0.15,
          maxZoom: 15
      },
      animation: {
          isAnimating: false,
          startTime: 0,
          duration: 1.0,
          // ...
      }
  };

  Beneficio: Accesso esplicito, facile serializzazione per debug

  4.3 Separazione updateAnimations in Fasi

  Attualmente ~200 righe monolitiche. Proposta:

  updateAnimations: function() {
      if (this.animationSystem.activeAnimations.length === 0) return;

      const currentTime = performance.now();

      for (let i = this.animationSystem.activeAnimations.length - 1; i >= 0; i--) {
          const anim = this.animationSystem.activeAnimations[i];

          if (anim.finished) {
              this.animationSystem.activeAnimations.splice(i, 1);
              continue;
          }

          // Fasi separate
          const progress = this.calculateAnimationProgress(anim, currentTime);
          this.applyAnimationTransform(anim, progress);
          this.updateSlaveObjects(anim, progress);
          this.checkAnimationCompletion(anim, progress);
      }
  }

  Beneficio: Debug per fase, possibilità di skip specifiche trasformazioni

  4.4 Estrazione Funzioni Pure per Posizioni

  // Funzioni pure senza side-effects
  calculateBoundingBoxCenterPure: function(model) {
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      return box.getCenter(new THREE.Vector3());
  },

  calculateOffsetToCenter: function(model, targetCenter) {
      const currentCenter = this.calculateBoundingBoxCenterPure(model);
      return targetCenter.clone().sub(currentCenter);
  }

  Beneficio: Funzioni testabili indipendentemente, riutilizzabili

  4.5 Introduzione Commenti Sezione

  // ═══════════════════════════════════════════════════════════
  // SEZIONE: CAMERA CONTROLS
  // ═══════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════
  // SEZIONE: ANIMATION SYSTEM
  // ═══════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════
  // SEZIONE: MODEL MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  Beneficio: Navigazione veloce, onboarding sviluppatori

  4.6 Centralizzazione Timeout

  const sceneTimeouts = new Set();

  scheduleSceneTimeout: function(fn, delay) {
      const id = setTimeout(() => {
          sceneTimeouts.delete(id);
          fn();
      }, delay);
      sceneTimeouts.add(id);
      return id;
  },

  clearAllSceneTimeouts: function() {
      sceneTimeouts.forEach(id => clearTimeout(id));
      sceneTimeouts.clear();
  }

  Beneficio: Chiamata clearAllSceneTimeouts() in clearAllModels() previene race condition

  ---
  5️⃣ PERCHÉ IL COMPORTAMENTO RESTA IDENTICO

  ┌───────────────────┬─────────────────────────────────────────────────────┐
  │      Aspetto      │                      Garanzia                       │
  ├───────────────────┼─────────────────────────────────────────────────────┤
  │ Render loop       │ requestAnimationFrame e ordine operazioni invariato │
  ├───────────────────┼─────────────────────────────────────────────────────┤
  │ Animazioni        │ Output posizione/rotazione per ogni frame identico  │
  ├───────────────────┼─────────────────────────────────────────────────────┤
  │ Camera            │ Stesso movimento per stessi input utente            │
  ├───────────────────┼─────────────────────────────────────────────────────┤
  │ Raycasting        │ Stesso modello selezionato per stesso click         │
  ├───────────────────┼─────────────────────────────────────────────────────┤
  │ Tutorial          │ Stesso avanzamento per stesse azioni                │
  ├───────────────────┼─────────────────────────────────────────────────────┤
  │ Posizioni salvate │ Stessi valori salvati e ripristinati                │
  └───────────────────┴─────────────────────────────────────────────────────┘
  Strategia di validazione:
  1. Registrare posizioni camera a intervalli durante tutorial
  2. Confrontare traiettorie prima/dopo refactoring
  3. Verificare frame rate medio invariato (±5%)
