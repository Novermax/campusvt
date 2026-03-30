/**
 * UI.JS - Gestione interfaccia utente
 * 
 * Questo modulo gestisce:
 * - Navigazione tra pagine (Home/Scenario)
 * - Gestione scenari e configurazioni
 * - Messaggi di stato e feedback utente
 * - Eventi input file e pulsanti
 * - Animazioni UI e transizioni
 */

// Backup del sistema UI refactorizzato se presente
const UI_Refactored = window.UI;

// Verifica se il sistema refactorizzato è già presente
if (window.UI && typeof window.UI.init === 'function' && window.UI._tutorialManager) {
    console.log('[ui.js] ✅ Sistema UI refactorizzato rilevato - mantengo quello esistente');
    // Non sovrascrivere il sistema refactorizzato
} else {
    console.log('[ui.js] 📦 Caricamento sistema UI legacy');

window.UI = {
    
    /* ===== HELPER FUNCTIONS ===== */
    
    /**
     * Log sicuro che funziona anche se AppConfig non è caricato
     */
    safeLog: function(level, message, ...args) {
        if (window.AppConfig && AppConfig.log) {
            AppConfig.log(level, message, ...args);
        } else {
            const levelNames = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
            const levelName = levelNames[level] || 'LOG';
            console.log(`[${levelName}] ${message}`, ...args);
        }
    },
    
    /* ===== STATO UI ===== */
    currentPage: 'home',           // Pagina corrente ('home' o 'scenario')
    scenariosConfig: null,         // Configurazione scenari caricata
    currentScenario: null,         // Scenario attivo
    homeConfig: null,              // Configurazione home page
    autoAdvanceTimeoutId: null,    // ID timeout auto-avanzamento (per cancellazione)
    autoExecuteIntervalId: null,   // ID interval polling AutoExecute (per cancellazione)
    isNavigating: false,           // Guard contro chiamate concorrenti goToStep()

    /* ===== ELEMENTI DOM ===== */
    elements: {},                  // Cache elementi DOM
    
    /**
     * Inizializza l'interfaccia utente
     */
    init: function() {
        this.safeLog(2, 'Inizializzazione UI...');
        
        try {
            // Caching elementi DOM
            this.cacheElements();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Mostra pagina iniziale
            this.showPage('home');
            
            // Aggiorna stato iniziale
            this.updateStatus('Pronto');
            
            // Carica automaticamente la configurazione home se disponibile
            this.loadHomeConfigFromServer();

            // Carica configurazione interfaccia (InterfaceConfig.txt)
            this.loadInterfaceConfig();

            // Inizializza ToolRegistry prima di ToolsManager
            if (window.ToolRegistry && typeof window.ToolRegistry.init === 'function') {
                window.ToolRegistry.init();
                this.safeLog(2, 'ToolRegistry inizializzato');
            }

            // Genera CSS dinamico per tool default all'inizializzazione
            if (window.DynamicToolStyles && typeof window.DynamicToolStyles.generateToolStyles === 'function') {
                window.DynamicToolStyles.generateToolStyles();
                this.safeLog(2, 'CSS dinamico tool generato all\'inizializzazione');
            }

            // Inizializza ToolsManager
            this.initToolsManager();

            AppConfig.log(2, 'UI inizializzata con successo');
            
        } catch (error) {
            AppConfig.log(0, 'Errore inizializzazione UI:', error);
            this.showError('Errore inizializzazione interfaccia');
        }
    },
    
    /**
     * Cachea i riferimenti agli elementi DOM per performance migliori
     */
    cacheElements: function() {
        // Elementi principali
        this.elements.homePage = document.getElementById('homePage');
        this.elements.scenarioPage = document.getElementById('scenarioPage');
        this.elements.scenariosList = document.getElementById('scenariosList');
        
        // Controlli
        this.elements.fileInput = document.getElementById('fileInput');
        this.elements.animationInput = document.getElementById('animationInput');
        this.elements.scenarioBtn = document.getElementById('scenarioBtn');
        this.elements.animationBtn = document.getElementById('animationBtn');
        
        // Feedback elements
        this.elements.status = document.getElementById('status');
        this.elements.loader = document.getElementById('loader');
        this.elements.error = document.getElementById('error');
        this.elements.errorMessage = document.getElementById('errorMessage');
        this.elements.scenarioTitle = document.getElementById('scenarioTitle');
        
        AppConfig.log(3, 'Elementi DOM cachati');
    },
    
    /**
     * Configura tutti gli event listeners
     */
    setupEventListeners: function() {
        // Input file home rimosso - caricamento automatico dal server
        
        // Input file modelli
        if (this.elements.fileInput) {
            this.elements.fileInput.addEventListener('change', 
                this.onModelsSelected.bind(this));
        }
        
        // Input file animazioni
        if (this.elements.animationInput) {
            this.elements.animationInput.addEventListener('change', 
                this.onAnimationSelected.bind(this));
        }
        
        // Click sulle card scenario
        if (this.elements.scenariosList) {
            this.elements.scenariosList.addEventListener('click', 
                this.onScenarioCardClick.bind(this));
            
            // Gestione navigazione da tastiera
            this.elements.scenariosList.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    this.onScenarioCardClick(event);
                }
            });
        }
        
        // Event listener per rotazione schermo mobile
        window.addEventListener('orientationchange', this.onOrientationChange.bind(this));
        window.addEventListener('resize', this.onWindowResize.bind(this));

        // Controlla orientamento iniziale
        this.checkOrientation();

        // Event listener per click sul fumetto descrizione (disabilitato - no click-to-advance)
        const stepSpeechBubble = document.getElementById('stepSpeechBubble');
        if (stepSpeechBubble) {
            stepSpeechBubble.addEventListener('click', () => {
                this.onSpeechBubbleClick();
            });
            // Nota: cursor gestito da CSS - pointer su mobile, default su desktop
            AppConfig.log(3, 'Event listener click fumetto configurato (solo mobile)');
        }

        // Event listener per pulsante reset camera step
        const resetCameraBtn = document.getElementById('resetCameraBtn');
        if (resetCameraBtn) {
            resetCameraBtn.addEventListener('click', () => {
                this.resetCameraToStepPosition();
            });
            AppConfig.log(3, 'Event listener pulsante reset camera configurato');
        }

        // Event listener per pulsante Home
        const homeButton = document.getElementById('homeButton');
        if (homeButton) {
            homeButton.addEventListener('click', () => {
                console.log('🏠🏠🏠 [HOME BUTTON] Click rilevato, chiamando goHome()...');
                this.goHome();
            });
            AppConfig.log(3, 'Event listener pulsante Home configurato');
        } else {
            console.error('❌ [setupEventListeners] Pulsante Home NON trovato!');
        }

        AppConfig.log(3, 'Event listeners configurati');
    },
    
    /* ===== NAVIGAZIONE PAGINE ===== */
    
    /**
     * Mostra una specifica pagina
     * @param {string} page - Nome della pagina ('home' o 'scenario')
     */
    showPage: function(page) {
        AppConfig.log(3, `Navigazione verso pagina: ${page}`);
        
        // Nascondi tutte le pagine
        if (this.elements.homePage) {
            this.elements.homePage.classList.add('hidden');
        }
        if (this.elements.scenarioPage) {
            this.elements.scenarioPage.classList.add('hidden');
        }
        
        // Mostra la pagina richiesta
        if (page === 'home' && this.elements.homePage) {
            this.elements.homePage.classList.remove('hidden');
            this.currentPage = 'home';
            // Pulisce controlli mobile
            this.cleanupMobileControls();
        } else if (page === 'scenario' && this.elements.scenarioPage) {
            this.elements.scenarioPage.classList.remove('hidden');
            this.currentPage = 'scenario';
            // Inizializza controlli mobile
            this.initMobileControls();
        }
        
        // Callback per pagina specifica
        if (page === 'scenario') {
            this.onScenarioPageShown();
            // Inizializza il cursore del canvas quando si entra nella pagina scenario
            setTimeout(() => this.updateCanvasCursor(), 100);
        }
    },
    
    /**
     * Torna alla home page
     * RESET COMPLETO: Ripristina tutti gli stati come se l'app fosse appena caricata
     */
    goHome: function() {
        console.log('🏠🏠🏠 [goHome] CHIAMATO - INIZIO FUNZIONE');
        console.log('🏠🏠🏠 [goHome] currentPage:', this.currentPage);
        AppConfig.log(2, '[goHome] 🏠 Avvio reset completo per ritorno alla home...');

        // === FASE 1: RESET CURSORI E TOOL ===
        // Disattiva tutti i tool
        this.deactivateAllTools();

        // Ferma eventuali animazioni cursore in corso
        if (window.Scene3D && window.Scene3D.stopCursorAnimation) {
            window.Scene3D.stopCursorAnimation();
        }

        // Rimuovi TUTTE le classi cursori personalizzati dal body
        document.body.classList.remove(
            'tool-aria-active',
            'tool-chiave_inglese-active',
            'tool-brugola-active',
            'tool-mano-active',
            'cursor-frame-1',
            'cursor-frame-2',
            'mouse-pressed'
        );

        // Rimuovi anche classi cursore dal canvas
        const canvas = document.querySelector('#canvas3d, canvas');
        if (canvas) {
            canvas.classList.remove('cursor-default', 'cursor-mano', 'cursor-brugola', 'cursor-chiave', 'cursor-aria');
            canvas.style.cursor = ''; // Reset inline style se presente
        }

        // Reset inline style cursor su body
        document.body.style.cursor = '';

        AppConfig.log(3, '[goHome] Tool e cursori resettati');

        // === FASE 2: RESET DRAG & DROP ===
        if (window.DragDropSystem) {
            // Reset completo del sistema drag & drop
            if (window.DragDropSystem.reset) {
                window.DragDropSystem.reset();
            } else if (window.DragDropSystem.disable) {
                window.DragDropSystem.disable();
            }
            // Reset tracking snap
            if (window.DragDropSystem.resetSnapTracking) {
                window.DragDropSystem.resetSnapTracking();
            }
            // Reset posizioni occupate
            if (window.DragDropSystem.resetOccupiedPositions) {
                window.DragDropSystem.resetOccupiedPositions();
            }
            AppConfig.log(3, '[goHome] DragDropSystem resettato');
        }

        // === FASE 3: RESET ASSEMBLY SYSTEM ===
        if (window.AssemblySystem && window.AssemblySystem.disableAssemblyMode) {
            window.AssemblySystem.disableAssemblyMode();
            AppConfig.log(3, '[goHome] AssemblySystem disabilitato');
        }

        // === FASE 4: RESET SCENE 3D ===
        if (window.Scene3D) {
            // Reset tutorial tracker
            if (window.Scene3D.resetTutorialTracker) {
                window.Scene3D.resetTutorialTracker();
            }

            // Ferma tutte le animazioni attive
            if (window.Scene3D.animationSystem) {
                window.Scene3D.animationSystem.activeAnimations = [];
                window.Scene3D.animationSystem.clickEnabled = true;
                if (window.Scene3D.animationSystem.multiStepAnimations) {
                    window.Scene3D.animationSystem.multiStepAnimations.clear();
                }
            }

            // Rimuovi highlight attivi
            if (window.Scene3D.removeHighlight) {
                window.Scene3D.removeHighlight();
            }

            // Reset posizioni iniziali salvate
            if (window.Scene3D.initialModelPositions) {
                window.Scene3D.initialModelPositions.clear();
            }
            if (window.Scene3D.scenarioOriginalPositions) {
                window.Scene3D.scenarioOriginalPositions.clear();
            }

            // Pulisci la scena 3D (rimuove tutti i modelli)
            if (window.Scene3D.clearAllModels) {
                window.Scene3D.clearAllModels();
            }

            AppConfig.log(3, '[goHome] Scene3D resettata');
        }

        // === FASE 5: RESET PARTICLE SYSTEM ===
        if (window.ParticleSystem && window.ParticleSystem.clearAllEffects) {
            window.ParticleSystem.clearAllEffects();
            AppConfig.log(3, '[goHome] ParticleSystem pulito');
        }

        // === FASE 6: RESET HOLDABLE SYSTEM ===
        if (window.HoldableSystem && window.HoldableSystem.reset) {
            window.HoldableSystem.reset();
            AppConfig.log(3, '[goHome] HoldableSystem resettato');
        }

        // === FASE 7: RESET EVIDENZIAZIONI PULSANTI ===
        // Rimuovi cerchi gialli lampeggianti dai pulsanti evidenziati
        if (window.InteractiveObject3D && window.InteractiveObject3D.clearButtonHighlights) {
            window.InteractiveObject3D.clearButtonHighlights();
            AppConfig.log(3, '[goHome] Evidenziazioni pulsanti rimosse');
        }

        // Rimuovi cerchi evidenziazione DragDrop
        if (window.Scene3D && window.Scene3D.highlightCircleManager) {
            window.Scene3D.highlightCircleManager.clearAllCircles();
            AppConfig.log(3, '[goHome] Cerchi evidenziazione DragDrop rimossi');
        }

        // === CLEANUP FORZATO CERCHI GIALLI ===
        // Rimuovi tutti i cerchi gialli (indicatori highlight) dalla scena
        if (window.Scene3D && window.Scene3D.scene) {
            const objectsToRemove = [];
            window.Scene3D.scene.traverse((object) => {
                // Trova oggetti con nome che indica cerchi di highlight
                if (object.name && (object.name.includes('highlightCircle') || object.name.includes('highlight_circle'))) {
                    objectsToRemove.push(object);
                }
            });

            objectsToRemove.forEach(obj => {
                if (obj.parent) {
                    obj.parent.remove(obj);
                    if (obj.geometry) obj.geometry.dispose();
                    if (obj.material) obj.material.dispose();
                }
            });

            if (objectsToRemove.length > 0) {
                console.log(`🟡 [goHome] Rimossi ${objectsToRemove.length} cerchi highlight dalla scena`);
            }
        }

        // === FASE 8: RESET STATO TUTORIAL ===
        this.tutorialSteps = [];
        this.availableTutorials = [];
        this.currentTutorial = null;
        this.currentStepIndex = 0;
        this.stepCameraState = null; // Posizione camera dello step corrente
        this.resetCameraPosition = 'bottom-right'; // Posizione pulsante reset camera (top-right/top-left/top-center/bottom-right/bottom-left/bottom-center)

        // Reset stato scenario
        this.currentScenario = null;

        // Nasconde la barra tutorial e il fumetto
        this.hideTutorialStepsBar();
        this.hideStepSpeechBubble();

        // Nasconde pulsante reset camera
        this.hideResetCameraButton();

        // === CLEANUP FORZATO ELEMENTI UI ===
        // Force nascondimento fumetto (backup)
        const bubble = document.getElementById('stepSpeechBubble');
        if (bubble) {
            bubble.classList.remove('flash', 'pulse', 'dramatic-intro');
            bubble.classList.add('hidden');
            bubble.style.display = 'none';
            bubble.style.visibility = 'hidden';
            console.log('💬 [goHome] Fumetto forzatamente nascosto');
        }

        // Force nascondimento pulsante reset (backup)
        const resetBtn = document.getElementById('resetCameraBtn');
        if (resetBtn) {
            resetBtn.classList.remove('pulse', 'animating');
            resetBtn.classList.add('hidden');
            resetBtn.style.display = 'none';
            resetBtn.style.visibility = 'hidden';
            console.log('📷 [goHome] Pulsante reset forzatamente nascosto');
        }

        // Nascondi modal congratulazioni se presente
        const congratsModal = document.querySelector('.congratulations-modal');
        if (congratsModal) {
            congratsModal.classList.remove('show');
        }

        // Nascondi modal info se presente
        const infoModal = document.getElementById('infoModal');
        if (infoModal) {
            infoModal.style.display = 'none';
        }

        AppConfig.log(3, '[goHome] Stato tutorial resettato');

        // === FASE 9: MOSTRA HOME PAGE ===
        this.updateStatus('Home');
        this.showPage('home');

        // === CLEANUP AGGRESSIVO CON MULTIPLI TENTATIVI ===
        const forceHideElements = () => {
            // Guard: esegui solo se siamo ancora sulla home page
            if (this.currentPage !== 'home') {
                console.log('🧹 [goHome] Cleanup saltato - utente già nello scenario');
                return;
            }
            console.log('🧹 [goHome] Esecuzione cleanup UI...');

            // Fumetto: inline style con !important per override totale
            const bubble = document.getElementById('stepSpeechBubble');
            if (bubble) {
                console.log('💬 [goHome] Trovato fumetto, nascondendolo...');
                // Rimuovi classi animazione
                bubble.classList.remove('flash', 'pulse', 'dramatic-intro');
                bubble.classList.add('hidden');
                // Inline style che override qualsiasi altro CSS
                bubble.setAttribute('style', 'display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important;');
                console.log('💬 [goHome] ✅ Fumetto nascosto con inline style !important');
            } else {
                console.log('💬 [goHome] ⚠️ Fumetto NON trovato nel DOM');
            }

            // Pulsante reset: inline style con !important per override totale
            const resetBtn = document.getElementById('resetCameraBtn');
            if (resetBtn) {
                console.log('📷 [goHome] Trovato pulsante reset, nascondendolo...');
                // Rimuovi classi animazione
                resetBtn.classList.remove('pulse', 'animating');
                resetBtn.classList.add('hidden');
                // Inline style che override qualsiasi altro CSS
                resetBtn.setAttribute('style', 'display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important;');
                console.log('📷 [goHome] ✅ Pulsante reset nascosto con inline style !important');
            } else {
                console.log('📷 [goHome] ⚠️ Pulsante reset NON trovato nel DOM');
            }

            // Rimuovi tutti i cerchi gialli dalla scena 3D
            if (window.Scene3D && window.Scene3D.scene) {
                const toRemove = [];
                window.Scene3D.scene.traverse((obj) => {
                    if (obj.name && (obj.name.includes('highlightCircle') || obj.name.includes('highlight_circle') || obj.name.includes('highlight'))) {
                        toRemove.push(obj);
                    }
                });

                toRemove.forEach(obj => {
                    if (obj.parent) {
                        obj.parent.remove(obj);
                        if (obj.geometry) obj.geometry.dispose();
                        if (obj.material) {
                            if (Array.isArray(obj.material)) {
                                obj.material.forEach(m => m.dispose());
                            } else {
                                obj.material.dispose();
                            }
                        }
                    }
                });

                if (toRemove.length > 0) {
                    console.log(`🟡 [goHome] Rimossi ${toRemove.length} cerchi highlight dalla scena`);
                }
            }
        };

        // Esegui cleanup IMMEDIATAMENTE
        forceHideElements();

        // Esegui cleanup RITARDATO (backup) - multipli tentativi
        setTimeout(forceHideElements, 0);
        setTimeout(forceHideElements, 50);
        setTimeout(forceHideElements, 100);
        setTimeout(forceHideElements, 200);
        setTimeout(forceHideElements, 500);

        console.log('🧹 [goHome] Cleanup UI schedulato: immediato + 5 tentativi ritardati');

        AppConfig.log(2, '[goHome] ✅ Reset completo terminato - ritorno alla home');
    },
    
    /**
     * Callback quando viene mostrata la pagina scenario
     */
    onScenarioPageShown: function() {
        // Inizializza la scena 3D se non già fatto
        if (window.Scene3D && !window.Scene3D.scene) {
            try {
                window.Scene3D.init();

                // Inizializza TouchSystem dopo Scene3D
                this.initTouchSystem();
            } catch (error) {
                this.showError('Errore inizializzazione scena 3D: ' + error.message);
            }
        }
    },

    /**
     * Inizializza il sistema touch gesture
     * Chiamato dopo Scene3D.init() per garantire che il canvas sia disponibile
     */
    initTouchSystem: function() {
        if (window.TouchSystem && !window.TouchSystem.initialized) {
            const canvas = document.getElementById('canvas3d');
            if (canvas) {
                try {
                    window.TouchSystem.init(canvas);
                    console.log('[UI] 📱 TouchSystem inizializzato');
                } catch (error) {
                    console.warn('[UI] ⚠️ Errore inizializzazione TouchSystem:', error.message);
                }
            }
        }
    },
    
    /* ===== GESTIONE SCENARI ===== */
    
    /**
     * Gestisce la selezione del file di configurazione home
     */
    onHomeConfigSelected: function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        if (window.AppConfig) {
            AppConfig.log(2, `Caricamento configurazione home: ${file.name}`);
        } else {
            console.log(`Caricamento configurazione home: ${file.name}`);
        }
        
        this.updateStatus('Caricamento configurazione...');
        
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                this.parseHomeConfig(e.target.result);
                this.updateStatus('Configurazione caricata');
            } catch (error) {
                if (window.AppConfig) {
                    AppConfig.log(0, 'Errore parsing configurazione:', error);
                } else {
                    console.error('Errore parsing configurazione:', error);
                }
                this.showError('Errore nel file di configurazione: ' + error.message);
                this.updateStatus('Errore configurazione');
            }
        };
        
        reader.onerror = () => {
            this.showError('Errore lettura file di configurazione');
            this.updateStatus('Errore lettura file');
        };
        
        reader.readAsText(file);
    },
    
    /**
     * Carica automaticamente il file home_config.txt dal server
     */
    loadHomeConfigFromServer: function() {
        this.safeLog(2, 'Tentativo caricamento home_config dal server...');
        this.updateStatus('Caricamento configurazione...');

        const lang = window.currentUser && window.currentUser.language
            ? window.currentUser.language.toLowerCase()
            : null;

        console.log(`🌍 [loadHomeConfig] currentUser:`, JSON.stringify(window.currentUser));
        console.log(`🌍 [loadHomeConfig] lang rilevata: "${lang}"`);

        const localizedConfig = lang ? `./home_config_${lang}.cvtscript` : null;
        const fallbackConfig = `./home_config.cvtscript`;

        console.log(`🌍 [loadHomeConfig] Tentativo: ${localizedConfig || '(nessuno, diretto fallback)'} → fallback: ${fallbackConfig}`);

        const loadConfig = (path) => {
            return fetchFile(`${path}?v=${Date.now()}`)
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.text();
                })
                .then(content => {
                    this.safeLog(2, `home_config caricato: ${path}`);
                    this.parseHomeConfig(content);
                    this.updateStatus('Configurazione caricata automaticamente');
                });
        };

        const tryLoad = localizedConfig
            ? loadConfig(localizedConfig).catch((err) => {
                console.warn(`🌍 [loadHomeConfig] ❌ Config localizzata FALLITA: ${localizedConfig}`, err.message);
                return loadConfig(fallbackConfig);
            })
            : loadConfig(fallbackConfig);

        tryLoad.catch(error => {
            this.safeLog(1, 'Impossibile caricare home_config dal server:', error.message);
            this.updateStatus('Nessuna configurazione - usa caricamento manuale');
        });
    },
    
    /**
     * Carica e applica InterfaceConfig.cvtscript (opzionale).
     * In Electron usa IPC per leggere il file dalla directory dell'exe (fuori ASAR),
     * così l'utente può modificarlo e rilancire il programma per applicare le modifiche.
     * In browser usa fetch standard.
     */
    loadInterfaceConfig: function() {
        // In Electron (preload caricato): usa IPC per leggere fuori dall'ASAR
        if (window.electronAPI && window.electronAPI.readConfigFile) {
            window.electronAPI.readConfigFile('InterfaceConfig.cvtscript')
                .then(content => {
                    if (content) {
                        this.safeLog(2, 'InterfaceConfig.cvtscript caricato via IPC (Electron)');
                        this.parseInterfaceConfig(content);
                    } else {
                        // File non trovato via IPC, prova con fetch (fallback)
                        this._loadInterfaceConfigViaFetch();
                    }
                })
                .catch(() => this._loadInterfaceConfigViaFetch());
            return;
        }
        // Browser / web server: usa fetch standard
        this._loadInterfaceConfigViaFetch();
    },

    _loadInterfaceConfigViaFetch: function() {
        fetchFile(`./InterfaceConfig.cvtscript?v=${Date.now()}`)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.text();
            })
            .then(content => {
                this.safeLog(2, 'InterfaceConfig.cvtscript caricato con successo');
                this.parseInterfaceConfig(content);
            })
            .catch(() => {
                // File opzionale - silenzioso se assente
            });
    },

    /**
     * Parsa InterfaceConfig.txt e applica le impostazioni UI
     */
    parseInterfaceConfig: function(content) {
        const validPositions = ['top-right', 'top-left', 'top-center', 'bottom-right', 'bottom-left', 'bottom-center'];
        const lines = content.split('\n');
        let currentSection = null;

        for (let line of lines) {
            line = line.trim();
            if (!line || line.startsWith('#')) continue;

            if (line.startsWith('[') && line.endsWith(']')) {
                currentSection = line.slice(1, -1);
                continue;
            }

            if (currentSection === 'ResetCameraButton' && line.includes('=')) {
                const [key, value] = line.split('=', 2).map(s => s.trim());
                if (key === 'Position' && validPositions.includes(value)) {
                    this.resetCameraPosition = value;
                    this.safeLog(2, `InterfaceConfig: ResetCameraButton.Position = ${value}`);
                }
            }

            if (currentSection === 'SpeechBubble' && line.includes('=')) {
                const [key, value] = line.split('=', 2).map(s => s.trim());
                if (key === 'DramaticAnimationDuration') {
                    const v = parseInt(value, 10);
                    if (!isNaN(v) && v > 0) this.dramaticAnimationDuration = v;
                    this.safeLog(2, `InterfaceConfig: SpeechBubble.DramaticAnimationDuration = ${value}`);
                }
            }

            if (currentSection === 'CameraControls' && line.includes('=')) {
                const [key, value] = line.split('=', 2).map(s => s.trim());
                window.InterfaceConfig = window.InterfaceConfig || {};
                window.InterfaceConfig.camera = window.InterfaceConfig.camera || {};
                if (key === 'InvertVertical') {
                    window.InterfaceConfig.camera.invertVertical = (value === 'true');
                    this.safeLog(2, `InterfaceConfig: CameraControls.InvertVertical = ${value}`);
                } else if (key === 'InvertHorizontal') {
                    window.InterfaceConfig.camera.invertHorizontal = (value === 'true');
                    this.safeLog(2, `InterfaceConfig: CameraControls.InvertHorizontal = ${value}`);
                } else if (key === 'PinchSensitivity') {
                    const v = parseFloat(value);
                    if (!isNaN(v) && v > 0) window.InterfaceConfig.camera.pinchSensitivity = v;
                    this.safeLog(2, `InterfaceConfig: CameraControls.PinchSensitivity = ${value}`);
                } else if (key === 'InvertPinchZoom') {
                    window.InterfaceConfig.camera.invertPinchZoom = (value === 'true');
                    this.safeLog(2, `InterfaceConfig: CameraControls.InvertPinchZoom = ${value}`);
                } else if (key === 'ScrollSensitivity') {
                    const v = parseFloat(value);
                    if (!isNaN(v) && v > 0) window.InterfaceConfig.camera.scrollSensitivity = v;
                    this.safeLog(2, `InterfaceConfig: CameraControls.ScrollSensitivity = ${value}`);
                } else if (key === 'InvertScrollZoom') {
                    window.InterfaceConfig.camera.invertScrollZoom = (value === 'true');
                    this.safeLog(2, `InterfaceConfig: CameraControls.InvertScrollZoom = ${value}`);
                } else if (key === 'ZoomMin') {
                    const v = parseFloat(value);
                    if (!isNaN(v) && v > 0) window.InterfaceConfig.camera.zoomMin = v;
                    this.safeLog(2, `InterfaceConfig: CameraControls.ZoomMin = ${value}`);
                } else if (key === 'ZoomMax') {
                    const v = parseFloat(value);
                    if (!isNaN(v) && v > 0) window.InterfaceConfig.camera.zoomMax = v;
                    this.safeLog(2, `InterfaceConfig: CameraControls.ZoomMax = ${value}`);
                }
            }
        }
    },

    /**
     * Analizza il file di configurazione home e genera le card scenari
     */
    parseHomeConfig: function(content) {
        const lines = content.split('\n');
        const scenarios = [];
        let currentScenario = null;
        
        lines.forEach(line => {
            line = line.trim();
            if (!line || line.startsWith('#') || line.startsWith('//')) return; // Ignora commenti e righe vuote
            
            // Rimuovi commenti inline (dopo //)
            const commentIndex = line.indexOf('//');
            if (commentIndex !== -1) {
                line = line.substring(0, commentIndex).trim();
                if (!line) return; // Se dopo aver rimosso il commento la riga è vuota, ignorala
            }
            
            if (line.startsWith('[') && line.endsWith(']')) {
                // Nuovo scenario
                if (currentScenario) {
                    scenarios.push(currentScenario);
                }
                
                const scenarioName = line.slice(1, -1);
                currentScenario = {
                    name: scenarioName,
                    description: '',
                    image: '',
                    files: [],
                    positions: []
                };
                
                if (window.AppConfig) {
                    AppConfig.log(3, `📋 Scenario trovato: ${scenarioName}`);
                } else {
                    console.log(`📋 Scenario trovato: ${scenarioName}`);
                }
                
            } else if (currentScenario) {
                // Proprietà dello scenario
                if (line.startsWith('description=')) {
                    currentScenario.description = line.substring(12);
                    AppConfig.log(3, `  📝 Descrizione: ${currentScenario.description}`);
                    
                } else if (line.startsWith('image=')) {
                    currentScenario.image = line.substring(6);
                    AppConfig.log(3, `  🖼️ Immagine: ${currentScenario.image}`);
                    
                } else if (line.startsWith('tutorial=')) {
                    currentScenario.tutorial = line.substring(9);
                    AppConfig.log(3, `  📚 Tutorial: ${currentScenario.tutorial}`);
                    
                } else if (line.startsWith('CameraPos=')) {
                    currentScenario.cameraPos = line.substring(10);
                    AppConfig.log(3, `  📷 Camera Position: ${currentScenario.cameraPos}`);
                    
                } else if (line.startsWith('CameraTarget=')) {
                    currentScenario.cameraTarget = line.substring(13);
                    AppConfig.log(3, `  🎯 Camera Target: ${currentScenario.cameraTarget}`);
                    
                } else if (line.startsWith('AmbientLight=')) {
                    currentScenario.ambientLight = line.substring(13);
                    AppConfig.log(3, `  💡 Ambient Light: ${currentScenario.ambientLight}`);
                    
                } else if (line.startsWith('DirectionalLight=')) {
                    currentScenario.directionalLight = line.substring(17);
                    AppConfig.log(3, `  🔆 Directional Light: ${currentScenario.directionalLight}`);
                    
                } else if (line.startsWith('BackLight=')) {
                    currentScenario.backLight = line.substring(10);
                    AppConfig.log(3, `  🔅 Back Light: ${currentScenario.backLight}`);

                } else if (line.startsWith('Configuration=')) {
                    currentScenario.configuration = line.substring(14).trim();
                    AppConfig.log(3, `  ⚙️ Configuration: ${currentScenario.configuration}`);

                } else if (line.startsWith('position=')) {
                    // Posizione modello (formato: position=x,y,z)
                    const positionStr = line.substring(9);
                    const coords = positionStr.split(',').map(n => parseFloat(n.trim()));
                    if (coords.length === 3) {
                        currentScenario.positions.push({ x: coords[0], y: coords[1], z: coords[2] });
                        AppConfig.log(3, `  📍 Posizione: (${coords[0]}, ${coords[1]}, ${coords[2]})`);
                    } else {
                        AppConfig.log(1, `  ❌ Posizione non valida: ${positionStr}`);
                    }
                    
                } else if (line.includes('=')) {
                    // File da caricare (formato: label=path) o direzione (formato: direzione = x,y,z)
                    const [label, path] = line.split('=', 2).map(s => s.trim());
                    
                    if (label === 'direzione' || label === 'direction') {
                        // Parsing direzione per l'ultimo file aggiunto
                        const coords = path.split(',').map(n => parseFloat(n.trim()));
                        if (coords.length === 3 && currentScenario.files.length > 0) {
                            const lastFileIndex = currentScenario.files.length - 1;
                            const direction = { x: coords[0], y: coords[1], z: coords[2] };
                            currentScenario.files[lastFileIndex].direction = direction;
                            AppConfig.log(3, `  🧭 Direzione: (${coords[0]}, ${coords[1]}, ${coords[2]}) per ${currentScenario.files[lastFileIndex].path}`);
                        } else {
                            AppConfig.log(1, `  ❌ Direzione non valida o nessun file precedente: ${path}`);
                        }
                    } else {
                        // File da caricare
                        currentScenario.files.push({ label, path, direction: null });
                        AppConfig.log(3, `  📁 File: ${label} -> ${path}`);
                    }
                }
            }
        });
        
        // Aggiungi ultimo scenario
        if (currentScenario) {
            // DEBUG: Stampa tutte le direzioni per questo scenario
            console.log(`🧭 RIEPILOGO DIREZIONI per scenario "${currentScenario.name}":`);
            currentScenario.files.forEach((file, index) => {
                console.log(`  ${index}: ${file.path} -> direzione:`, file.direction);
            });
            
            scenarios.push(currentScenario);
        }
        
        this.scenariosConfig = scenarios;
        this.renderScenarioCards();
        
        AppConfig.log(2, `Configurazione home caricata: ${scenarios.length} scenari`);
    },
    
    /**
     * Renderizza le card degli scenari nella home page
     */
    renderScenarioCards: function() {
        if (!this.elements.scenariosList || !this.scenariosConfig) return;
        
        // Pulisci lista esistente
        this.elements.scenariosList.innerHTML = '';
        
        // Crea card per ogni scenario
        this.scenariosConfig.forEach((scenario, index) => {
            const card = this.createScenarioCard(scenario, index);
            this.elements.scenariosList.appendChild(card);
        });

        // RIMOSSO: Card "Modalità Manuale" non più necessaria
        // const manualCard = this.createManualModeCard();
        // this.elements.scenariosList.appendChild(manualCard);

        AppConfig.log(3, `Renderizzate ${this.scenariosConfig.length} card scenario`);
    },
    
    /**
     * Crea una singola card scenario
     */
    createScenarioCard: function(scenario, index) {
        const card = document.createElement('div');
        card.className = 'scenario-card';
        card.dataset.scenarioIndex = index;
        
        // Sezione immagine
        const imageSection = document.createElement('div');
        imageSection.className = 'scenario-image';
        
        if (scenario.image) {
            const img = document.createElement('img');
            img.src = scenario.image;
            img.alt = scenario.name;
            img.onerror = () => {
                // Fallback se l'immagine non carica
                imageSection.innerHTML = '<div class="placeholder-image">🎯</div>';
            };
            imageSection.appendChild(img);
        } else {
            imageSection.innerHTML = '<div class="placeholder-image">🎯</div>';
        }
        
        // Sezione info
        const infoSection = document.createElement('div');
        infoSection.className = 'scenario-info';
        
        const title = document.createElement('h3');
        title.textContent = scenario.name;
        
        const description = document.createElement('p');
        description.textContent = scenario.description || 'Nessuna descrizione disponibile';
        
        infoSection.appendChild(title);
        infoSection.appendChild(description);
        
        // Assembla card
        card.appendChild(imageSection);
        card.appendChild(infoSection);
        
        return card;
    },
    
    /**
     * DEPRECATO: Crea la card "Modalità Manuale" (non più utilizzata)
     */
    // createManualModeCard: function() {
    //     const card = document.createElement('div');
    //     card.className = 'scenario-card manual-mode';
    //     card.setAttribute('role', 'button');
    //     card.setAttribute('tabindex', '0');
    //     card.dataset.manual = 'true';
    //
    //     // Sezione immagine
    //     const imageSection = document.createElement('div');
    //     imageSection.className = 'scenario-image';
    //
    //     const placeholderImage = document.createElement('div');
    //     placeholderImage.className = 'placeholder-image';
    //     placeholderImage.setAttribute('aria-hidden', 'true');
    //     placeholderImage.textContent = '🔧';
    //
    //     imageSection.appendChild(placeholderImage);
    //
    //     // Sezione info
    //     const infoSection = document.createElement('div');
    //     infoSection.className = 'scenario-info';
    //
    //     const title = document.createElement('h3');
    //     title.textContent = 'Modalità Manuale';
    //
    //     const description = document.createElement('p');
    //     description.textContent = 'Carica direttamente i tuoi modelli 3D senza utilizzare scenari predefiniti. Supporta OBJ, STL, GLTF/GLB con materiali e texture.';
    //
    //     infoSection.appendChild(title);
    //     infoSection.appendChild(description);
    //
    //     // Assembla card
    //     card.appendChild(imageSection);
    //     card.appendChild(infoSection);
    //
    //     return card;
    // },
    
    /**
     * Gestisce il click su una card scenario
     */
    onScenarioCardClick: function(event) {
        const card = event.target.closest('.scenario-card');
        if (!card) return;
        
        // Se è la card placeholder, non fare nulla (è solo informativa)
        if (card.classList.contains('placeholder')) {
            return;
        }
        
        // RIMOSSO: Gestione card "Modalità Manuale" non più necessaria
        // if (card.dataset.manual === 'true') {
        //     AppConfig.log(2, 'Modalità manuale selezionata');
        //     this.showPage('scenario');
        //     return;
        // }


        // Controlla se esiste scenarioIndex nel dataset
        const scenarioIndexStr = card.dataset.scenarioIndex;
        if (!scenarioIndexStr) {
            AppConfig.log(1, 'Card scenario senza indice trovata');
            return;
        }
        
        const scenarioIndex = parseInt(scenarioIndexStr);
        if (isNaN(scenarioIndex) || !this.scenariosConfig) {
            this.showError('Dati scenario non validi');
            return;
        }
        
        const scenario = this.scenariosConfig[scenarioIndex];
        if (!scenario) {
            this.showError('Scenario non trovato');
            return;
        }
        
        AppConfig.log(2, `Scenario selezionato: ${scenario.name}`);
        this.loadScenario(scenario);
    },
    
    /**
     * Carica uno scenario specifico
     */
    loadScenario: function(scenario) {
        this.currentScenario = scenario;

        // Reset HoldableSystem per nuovo scenario
        if (window.HoldableSystem && window.HoldableSystem.reset) {
            window.HoldableSystem.reset();
            AppConfig.log(3, '[loadScenario] HoldableSystem resettato per nuovo scenario');
        }

        // Aggiorna titolo scenario
        if (this.elements.scenarioTitle) {
            this.elements.scenarioTitle.textContent = scenario.name;
        }
        
        // Passa alla pagina scenario
        this.showPage('scenario');
        
        // Aggiorna stato
        this.updateStatus(`Caricamento scenario: ${scenario.name}`);
        
        // Applica le configurazioni camera e luci dello scenario
        this.applyScenarioConfiguration(scenario);

        // Carica configurazione tool per scenario se specificata
        if (scenario.configuration && window.ToolRegistry) {
            // Determina il path corretto del config
            // Se inizia con '/' o 'scenes/' è già un path completo, altrimenti è relativo allo scenario
            let configPath;
            if (scenario.configuration.startsWith('/') || scenario.configuration.startsWith('scenes/')) {
                configPath = scenario.configuration;
            } else {
                // Path relativo allo scenario (es. "config.txt" → "scenes/NomeScenario/config.txt")
                configPath = `scenes/${scenario.name}/${scenario.configuration}`;
            }

            AppConfig.log(2, `⚙️ Caricamento configurazione tool da: ${configPath}`);

            window.ToolRegistry.loadConfig(configPath, `scenes/${scenario.name}/`)
                .then(() => {
                    AppConfig.log(2, `✅ Tool configurati da: ${configPath}`);

                    // Genera CSS dinamico per tool custom
                    if (window.DynamicToolStyles) {
                        window.DynamicToolStyles.generateToolStyles();
                    }

                    // Aggiorna UI con nuovi tool
                    if (window.ToolsManager) {
                        window.ToolsManager.refreshToolsUI();
                    }
                })
                .catch(error => {
                    AppConfig.log(1, `⚠️ Errore caricamento configuration, uso default: ${error.message}`);
                    // Fallback: genera CSS per tool default
                    if (window.DynamicToolStyles) {
                        window.DynamicToolStyles.generateToolStyles();
                    }
                });
        } else {
            // Nessuna configurazione custom: RESET a tool default
            AppConfig.log(2, `🔧 Uso tool di default (nessuna Configuration= specificata)`);

            // Resetta ToolRegistry ai default
            if (window.ToolRegistry) {
                window.ToolRegistry.reset();
            }

            if (window.DynamicToolStyles) {
                window.DynamicToolStyles.generateToolStyles();
            }

            if (window.ToolsManager && window.ToolsManager.refreshToolsUI) {
                window.ToolsManager.refreshToolsUI();
            }
        }

        // Carica automaticamente tutti i modelli OBJ/MTL dello scenario
        this.loadScenarioModels(scenario);
        
        // Carica il tutorial se specificato nel file di configurazione
        if (scenario.tutorial) {
            AppConfig.log(2, `🎓 Caricamento tutorial per scenario: ${scenario.tutorial}`);
            this.loadTutorial(scenario.tutorial);
        } else {
            AppConfig.log(2, `❌ Nessun tutorial specificato per scenario: ${scenario.name}`);
            // Nasconde la barra tutorial se non c'è tutorial
            this.hideTutorialStepsBar();
        }
    },
    
    /**
     * Applica le configurazioni di camera e luci specifiche dello scenario
     */
    applyScenarioConfiguration: function(scenario) {
        if (!window.Scene3D) {
            AppConfig.log(1, '⚠️ Scene3D non disponibile per configurazione scenario');
            // Ritenta dopo un delay
            setTimeout(() => {
                this.applyScenarioConfiguration(scenario);
            }, 500);
            return;
        }
        
        AppConfig.log(2, `🎭 Applicazione configurazione per scenario: ${scenario.name}`);
        
        // Applica posizione camera se specificata
        if (scenario.cameraPos) {
            const pos = this.parseVector3(scenario.cameraPos);
            if (pos) {
                window.Scene3D.camera.position.set(pos.x, pos.y, pos.z);
                // IMPORTANTE: Imposta flag per disabilitare auto-fitting
                window.Scene3D.manualCameraSet = true;
                AppConfig.log(2, `📷 Camera position applicata: (${pos.x}, ${pos.y}, ${pos.z}) - Auto-fitting disabilitato`);
            }
        }
        
        // Applica target camera se specificato
        if (scenario.cameraTarget) {
            const target = this.parseVector3(scenario.cameraTarget);
            if (target) {
                window.Scene3D.camera.lookAt(target.x, target.y, target.z);
                // IMPORTANTE: aggiorna anche il pivotPoint usato da zoom e orbita
                // Senza questo, zoom e rotazione continuano ad usare il pivot del vecchio scenario
                if (window.Scene3D.mouseControls) {
                    window.Scene3D.mouseControls.pivotPoint = new THREE.Vector3(target.x, target.y, target.z);
                }
                AppConfig.log(2, `🎯 Camera target applicato: (${target.x}, ${target.y}, ${target.z}) - Pivot aggiornato`);
            }
        }
        
        // Applica configurazioni luci dopo un breve delay per assicurarsi che THREE sia disponibile
        setTimeout(() => {
            this.applyScenarioLights(scenario);
        }, 100);
        
        AppConfig.log(2, `✅ Configurazione scenario applicata per: ${scenario.name}`);
    },
    
    /**
     * Applica le configurazioni delle luci dello scenario
     */
    applyScenarioLights: function(scenario) {
        if (!window.Scene3D || !window.Scene3D.scene) {
            AppConfig.log(1, '⚠️ Scene3D non disponibile per applicazione luci');
            return;
        }
        
        if (!window.THREE) {
            AppConfig.log(1, '⚠️ THREE.js non disponibile per applicazione luci');
            return;
        }
        
        AppConfig.log(2, '🔄 Rimozione luci esistenti...');
        
        // Rimuovi le luci esistenti
        const lightsToRemove = [];
        window.Scene3D.scene.traverse(function(child) {
            if (child.isLight) {
                lightsToRemove.push(child);
            }
        });
        lightsToRemove.forEach(light => window.Scene3D.scene.remove(light));
        AppConfig.log(2, `🗑️ Rimosse ${lightsToRemove.length} luci esistenti`);
        
        // Aggiungi luce ambientale se specificata
        if (scenario.ambientLight) {
            const ambient = this.parseLightConfig(scenario.ambientLight);
            if (ambient) {
                try {
                    const ambientLight = new THREE.AmbientLight(ambient.color, ambient.intensity);
                    window.Scene3D.scene.add(ambientLight);
                    AppConfig.log(2, `💡 Luce ambientale applicata: colore=${ambient.color.toString(16)}, intensità=${ambient.intensity}`);
                } catch (error) {
                    AppConfig.log(1, '❌ Errore creazione luce ambientale:', error);
                }
            }
        }
        
        // Aggiungi luce direzionale se specificata
        if (scenario.directionalLight) {
            const directional = this.parseDirectionalLightConfig(scenario.directionalLight);
            if (directional) {
                try {
                    const directionalLight = new THREE.DirectionalLight(directional.color, directional.intensity);
                    directionalLight.position.set(directional.position.x, directional.position.y, directional.position.z);
                    directionalLight.castShadow = true;
                    directionalLight.shadow.mapSize.width = 2048;
                    directionalLight.shadow.mapSize.height = 2048;
                    directionalLight.shadow.camera.near = 0.5;
                    directionalLight.shadow.camera.far = 500;
                    window.Scene3D.scene.add(directionalLight);
                    AppConfig.log(2, `🔆 Luce direzionale applicata: pos=(${directional.position.x}, ${directional.position.y}, ${directional.position.z}), intensità=${directional.intensity}`);
                } catch (error) {
                    AppConfig.log(1, '❌ Errore creazione luce direzionale:', error);
                }
            }
        }
        
        // Aggiungi luce posteriore se specificata
        if (scenario.backLight) {
            const back = this.parseDirectionalLightConfig(scenario.backLight);
            if (back) {
                try {
                    const backLight = new THREE.DirectionalLight(back.color, back.intensity);
                    backLight.position.set(back.position.x, back.position.y, back.position.z);
                    backLight.castShadow = false;
                    window.Scene3D.scene.add(backLight);
                    AppConfig.log(2, `🔅 Luce posteriore applicata: pos=(${back.position.x}, ${back.position.y}, ${back.position.z}), intensità=${back.intensity}`);
                } catch (error) {
                    AppConfig.log(1, '❌ Errore creazione luce posteriore:', error);
                }
            }
        }
        
        // Forza il re-rendering
        if (window.Scene3D.renderer) {
            window.Scene3D.renderer.render(window.Scene3D.scene, window.Scene3D.camera);
        }
        
        AppConfig.log(2, '✅ Applicazione luci scenario completata');
    },
    
    /**
     * Parsing di una stringa vector3 "(x, y, z)" in oggetto
     */
    parseVector3: function(vectorString) {
        try {
            const cleanString = vectorString.replace(/[()]/g, '').trim();
            const parts = cleanString.split(',').map(n => parseFloat(n.trim()));
            if (parts.length === 3 && parts.every(n => !isNaN(n))) {
                return { x: parts[0], y: parts[1], z: parts[2] };
            }
        } catch (error) {
            AppConfig.log(1, `⚠️ Errore parsing vector3: ${vectorString}`, error);
        }
        return null;
    },
    
    /**
     * Parsing configurazione luce ambientale "0x606060,2.0"
     */
    parseLightConfig: function(lightString) {
        try {
            const parts = lightString.split(',');
            if (parts.length === 2) {
                const color = parseInt(parts[0].trim(), 16);
                const intensity = parseFloat(parts[1].trim());
                if (!isNaN(color) && !isNaN(intensity)) {
                    return { color: color, intensity: intensity };
                }
            }
        } catch (error) {
            AppConfig.log(1, `⚠️ Errore parsing light config: ${lightString}`, error);
        }
        return null;
    },
    
    /**
     * Parsing configurazione luce direzionale "0xffffff,3.3,(1, 1, 1)"
     */
    parseDirectionalLightConfig: function(lightString) {
        try {
            const parts = lightString.split(',');
            if (parts.length >= 5) {
                const color = parseInt(parts[0].trim(), 16);
                const intensity = parseFloat(parts[1].trim());
                const x = parseFloat(parts[2].replace(/[()]/g, '').trim());
                const y = parseFloat(parts[3].trim());
                const z = parseFloat(parts[4].replace(/[()]/g, '').trim());
                
                if (!isNaN(color) && !isNaN(intensity) && !isNaN(x) && !isNaN(y) && !isNaN(z)) {
                    return {
                        color: color,
                        intensity: intensity,
                        position: { x: x, y: y, z: z }
                    };
                }
            }
        } catch (error) {
            AppConfig.log(1, `⚠️ Errore parsing directional light config: ${lightString}`, error);
        }
        return null;
    },
    
    /**
     * Carica automaticamente tutti i modelli OBJ/MTL di uno scenario
     */
    loadScenarioModels: function(scenario) {
        console.log('🔄 loadScenarioModels chiamata per:', scenario.name);
        console.log('🔄 Files nello scenario:', scenario.files);
        
        if (!scenario.files || scenario.files.length === 0) {
            console.log('❌ Nessun file nello scenario');
            this.updateStatus(`Scenario ${scenario.name} - Nessun modello da caricare`);
            return;
        }
        
        // Filtra solo i file modello (OBJ, MTL, GLTF, GLB, STL)
        const modelFiles = scenario.files.filter(file => {
            const extension = file.path.toLowerCase().split('.').pop();
            return ['obj', 'mtl', 'gltf', 'glb', 'stl'].includes(extension);
        });
        
        console.log('🔄 File modello filtrati:', modelFiles);
        
        if (modelFiles.length === 0) {
            console.log('❌ Nessun modello compatibile trovato');
            this.updateStatus(`Scenario ${scenario.name} - Nessun modello compatibile`);
            return;
        }
        
        AppConfig.log(2, `Caricamento ${modelFiles.length} modelli per scenario: ${scenario.name}`);
        
        // Mostra progress bar
        this.showModelProgressBar(modelFiles.length);
        this.updateStatus(`Caricamento ${modelFiles.length} modelli...`);
        
        // Converte i path in URL per il fetch
        const modelUrls = modelFiles.map(file => ({
            name: file.path.split('/').pop(), // Nome del file
            path: file.path,
            type: file.path.toLowerCase().split('.').pop()
        }));
        
        // Log dei modelli che verranno caricati per debug
        AppConfig.log(3, 'Modelli da caricare:', modelUrls.map(m => `${m.name} (${m.type})`).join(', '));
        
        // Avvia il caricamento tramite ModelLoader
        if (window.ModelLoader) {
            this.loadModelsFromUrls(modelUrls);
        } else {
            this.showError('ModelLoader non disponibile');
        }
    },
    
    /**
     * Carica modelli da URL utilizzando il ModelLoader
     */
    loadModelsFromUrls: function(modelUrls) {
        console.log('🌐 Avvio fetch per:', modelUrls);

        let completedFiles = 0;
        const totalFiles = modelUrls.length;

        // Conta file grandi
        const largeFiles = modelUrls.filter(m => /culatta|corpo|coperchio/i.test(m.name));
        if (largeFiles.length > 0) {
            console.log(`⏳ Rilevati ${largeFiles.length} file di grandi dimensioni (${largeFiles.map(f => f.name).join(', ')}). Il caricamento potrebbe richiedere fino a 2 minuti.`);
            this.updateStatus(`Caricamento ${totalFiles} modelli (${largeFiles.length} file grandi)... potrebbe richiedere fino a 2 minuti`);
        }

        // Helper function per fetch con timeout e retry
        const fetchWithTimeoutAndRetry = (url, filename, maxRetries = 2) => {
            // Timeout dinamico basato su dimensione stimata del file
            // Aggiunti a500, remote, pulpito che sono file grandi (>10MB)
            const isLargeFile = /culatta|corpo|coperchio|pavimento|filtro|a500|remote|pulpito/i.test(filename);
            const timeout = isLargeFile ? 120000 : 60000; // 120s per file grandi, 60s per altri

            console.log(`🌐 Timeout per ${filename}: ${timeout/1000}s (isLarge: ${isLargeFile})`);

            const attemptFetch = (retriesLeft) => {
                return Promise.race([
                    // IMPORTANTE: cache: 'no-store' forza il browser a bypassare la cache HTTP
                    // Risolve il problema "Modelli mancanti" causato da risposte corrotte/parziali in cache
                    fetchFile(url, { cache: 'no-store' }),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error(`Timeout dopo ${timeout/1000}s`)), timeout)
                    )
                ]).catch(error => {
                    if (retriesLeft > 0) {
                        console.warn(`⚠️ Retry ${maxRetries - retriesLeft + 1}/${maxRetries} per ${filename}:`, error.message);
                        return new Promise(resolve => setTimeout(resolve, 2000))
                            .then(() => attemptFetch(retriesLeft - 1));
                    }
                    throw error;
                });
            };

            return attemptFetch(maxRetries);
        };

        const loadPromises = modelUrls.map(model => {
            console.log(`🌐 Fetching: ${model.path}`);

            // Aggiungi cache-busting parameter per evitare problemi di cache
            const cacheBuster = `?v=${Date.now()}`;
            const urlWithCacheBuster = model.path + cacheBuster;

            return fetchWithTimeoutAndRetry(urlWithCacheBuster, model.name)
                .then(response => {
                    console.log(`🌐 Response per ${model.path}:`, response.status, response.statusText);
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    return response.blob();
                })
                .then(blob => {
                    console.log(`🌐 Blob creato per ${model.name}:`, blob.size, 'bytes');

                    // Incrementa counter (solo per statistiche, non per UI)
                    completedFiles++;

                    // Crea un File object dal blob
                    const file = new File([blob], model.name, { type: blob.type });
                    return { file, model };
                })
                .catch(error => {
                    console.error(`❌ ERRORE FETCH ${model.name}:`, error);
                    AppConfig.log(0, `⚠️ FILE MANCANTE: ${model.name} - ${error.message}`);
                    return null;
                });
        });
        
        Promise.allSettled(loadPromises)
            .then(results => {
                console.log('🌐 Risultati fetch:', results);

                const validFiles = results
                    .filter(result => result.status === 'fulfilled' && result.value !== null)
                    .map(result => result.value.file);

                const failedCount = results.filter(result =>
                    result.status === 'rejected' ||
                    (result.status === 'fulfilled' && result.value === null)
                ).length;

                const failedNames = results
                    .map((result, index) => ({result, model: modelUrls[index]}))
                    .filter(({result}) => result.status === 'rejected' || (result.status === 'fulfilled' && result.value === null))
                    .map(({model}) => model.name);

                console.log('🌐 File validi:', validFiles.length, 'File falliti:', failedCount);
                console.log('🌐 ValidFiles dettaglio:', validFiles);
                if (failedCount > 0) {
                    console.error('❌ File falliti:', failedNames);
                }

                if (validFiles.length > 0) {
                    AppConfig.log(2, `✅ ${validFiles.length}/${totalFiles} modelli caricati con successo`);
                    if (failedCount > 0) {
                        AppConfig.log(0, `⚠️ ATTENZIONE: ${failedCount} file mancanti: ${failedNames.join(', ')}`);
                        this.showError(`Caricati ${validFiles.length}/${totalFiles} modelli. Mancanti: ${failedNames.join(', ')}`);
                    }
                    
                    this.updateStatus(`Rendering ${validFiles.length} modelli...`);
                    
                    // Usa ModelLoader per caricare i file
                    console.log('🌐 Chiamando ModelLoader.loadFiles con:', validFiles);
                    console.log('🌐 ModelLoader disponibile?', !!window.ModelLoader);
                    console.log('🌐 loadFiles function?', typeof window.ModelLoader.loadFiles);
                    
                    if (window.ModelLoader && typeof window.ModelLoader.loadFiles === 'function') {
                        console.log('🌐 Avvio ModelLoader.loadFiles...');
                        window.ModelLoader.loadFiles(
                            validFiles,
                            (progress, info) => {
                                // Callback progress con info dettagliate
                                if (info && info.current && info.total) {
                                    console.log(`🌐 Progress: ${info.current}/${info.total} - ${info.fileName}`);
                                    // Usa updateModelProgress per aggiornare la progress bar
                                    this.updateModelProgress(info.current, info.total, info.fileName, Math.round(progress * 100));
                                    // Aggiorna anche lo status
                                    this.updateStatus(info.message || `Caricamento ${info.current}/${info.total}...`);
                                } else {
                                    // Fallback se info non disponibile (backward compatibility)
                                    console.log('🌐 Progress:', progress);
                                    this.updateStatus(`Caricamento modelli: ${Math.round(progress * 100)}%`);
                                }
                            },
                            (models) => {
                                console.log('🌐 Modelli caricati, chiamando onModelLoadComplete:', models);
                                this.onModelLoadComplete(models);
                                AppConfig.log(2, `Scenario ${this.currentScenario.name} caricato completamente`);
                            },
                            (error) => {
                                console.error('🌐 Errore ModelLoader:', error);
                                this.showError(`Errore caricamento modelli: ${error}`);
                            }
                        );
                    } else {
                        this.showError('ModelLoader non disponibile o non ha la funzione loadFiles');
                    }
                    
                } else {
                    this.showError('Nessun modello caricato con successo');
                }
            });
    },
    
    /* ===== GESTIONE FILE MODELLI ===== */
    
    /**
     * Gestisce la selezione di file modelli dall'utente
     */
    onModelsSelected: function(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        
        AppConfig.log(2, `File modelli selezionati: ${files.length}`);
        
        this.updateStatus('Caricamento modelli...');
        this.showLoader('Caricamento modelli in corso...');
        
        // Usa ModelLoader per caricare i file
        if (window.ModelLoader) {
            window.ModelLoader.loadFiles(
                files,
                this.onModelLoadProgress.bind(this),
                this.onModelLoadComplete.bind(this),
                this.onModelLoadError.bind(this)
            );
        } else {
            this.showError('ModelLoader non disponibile');
        }
    },
    
    /**
     * Callback progresso caricamento modelli
     */
    onModelLoadProgress: function(message, progress) {
        this.updateStatus(message);
        
        // Aggiorna anche la progress bar se visibile
        const progressBar = document.getElementById('modelProgressBar');
        if (progressBar && !progressBar.classList.contains('hidden')) {
            // Estrai informazioni dal messaggio se possibile
            const currentFile = message.includes('Caricamento ') ? message.replace('Caricamento ', '').replace('...', '') : message;
            const percentage = Math.round(progress * 100);
            this.updateModelProgress(null, null, currentFile, percentage);
        }
        
        AppConfig.log(3, `Progresso caricamento: ${message} (${Math.round(progress * 100)}%)`);
    },
    
    /**
     * Callback completamento caricamento modelli
     */
    onModelLoadComplete: function(models) {
        this.hideLoader();
        
        if (models.length === 0) {
            this.showError('Nessun modello caricato');
            this.updateStatus('Errore caricamento');
            return;
        }
        
        AppConfig.log(2, `Modelli caricati con successo: ${models.length}`);
        
        // Aggiungi modelli alla scena con posizioni e direzioni configurate
        models.forEach((model, index) => {
            if (window.Scene3D) {
                // Applica posizione se configurata
                if (this.currentScenario && this.currentScenario.positions && this.currentScenario.positions[index]) {
                    const pos = this.currentScenario.positions[index];
                    model.position.set(pos.x, pos.y, pos.z);
                    console.log(`📍 Applicata posizione configurata al modello ${index + 1}: (${pos.x}, ${pos.y}, ${pos.z})`);
                }
                
                // Trova la configurazione del modello (inclusa la direzione)
                let modelConfig = null;
                const modelFilename = model.userData?.originalFilename || model.name;
                
                console.log(`🔍 Ricerca config per modello: "${modelFilename}"`);
                console.log(`🔍 Files scenario disponibili:`, this.currentScenario?.files?.map(f => ({ path: f.path, direction: f.direction })));
                
                if (this.currentScenario && this.currentScenario.files) {
                    modelConfig = this.currentScenario.files.find(file => {
                        const modelNameClean = modelFilename.replace('.glb', '');
                        const fileNameClean = file.path.split('/').pop().replace('.glb', '');
                        
                        // Match esatto del nome file (più preciso)
                        const exactMatch = modelNameClean === fileNameClean;
                        
                        console.log(`🔍 Test file "${file.path}": modelName="${modelNameClean}", fileName="${fileNameClean}", exactMatch=${exactMatch}, direction=`, file.direction);
                        
                        if (exactMatch) {
                            console.log(`✅ EXACT MATCH FOUND for "${modelFilename}": ${file.path} with direction:`, file.direction);
                        }
                        
                        return exactMatch;
                    });
                    
                    if (modelConfig) {
                        console.log(`🔍✅ Config trovato per "${modelFilename}":`, modelConfig);
                    } else {
                        console.log(`🔍❌ Nessun config trovato per "${modelFilename}"`);
                    }
                }
                
                // Aggiungi modello con configurazione
                window.Scene3D.addModel(model, modelConfig);
                
            }
        });
        
        this.updateStatus(`${models.length} modello(i) caricato(i)`);
        
        // Crea controlli visibilità per modelli multipli
        if (models.length > 1) {
            this.createModelVisibilityControls();
        }
        
        // Nascondi progress bar al completamento
        this.hideModelProgressBar();
        
        // Reset input file
        if (this.elements.fileInput) {
            this.elements.fileInput.value = '';
        }
        
        // NON evidenziare automaticamente il primo elemento - solo quando l'utente preme il pulsante tutorial
        // Il tutorial rimane in standby (currentStepIndex = -1) fino all'attivazione manuale

        // IMPORTANTE: Salva le posizioni originali PRIMA di applicare qualsiasi impostazione tutorial
        if (window.DragDropSystem && typeof window.DragDropSystem.storeOriginalPositions === 'function') {
            console.log(`🔧 DRAG&DROP: Salvataggio posizioni originali post-caricamento modelli`);
            window.DragDropSystem.storeOriginalPositions();
        }

        // Ora che i modelli sono caricati, riapplica le impostazioni modelli del tutorial iniziale
        if (this.availableTutorials.length > 0) {
            const firstTutorial = this.availableTutorials[0];
            if (firstTutorial && firstTutorial.properties && window.Scene3D && window.Scene3D.applyModelSettings) {
                // Crea oggetto tutorial fake per riusare la funzione esistente di Scene3D
                const fakeTutorialStep = {
                    properties: {}
                };
                
                // Copia le proprietà modelli se presenti
                let hasModelSettings = false;
                
                if (firstTutorial.properties.Posizione) {
                    fakeTutorialStep.properties.Posizione = firstTutorial.properties.Posizione;
                    hasModelSettings = true;
                    const posizioniCount = Array.isArray(firstTutorial.properties.Posizione) ? firstTutorial.properties.Posizione.length : 1;
                    console.log(`🔧 MODELLI POST-LOAD: Posizione (${posizioniCount} modelli)`);
                }

                if (firstTutorial.properties.Rotazione) {
                    fakeTutorialStep.properties.Rotazione = firstTutorial.properties.Rotazione;
                    hasModelSettings = true;
                    const rotazioniCount = Array.isArray(firstTutorial.properties.Rotazione) ? firstTutorial.properties.Rotazione.length : 1;
                    console.log(`🔧 MODELLI POST-LOAD: Rotazione (${rotazioniCount} modelli)`);
                }
                
                if (hasModelSettings) {
                    console.log(`🔧 MODELLI POST-LOAD: Applicazione impostazioni modelli post-caricamento per "${firstTutorial.name}"`);
                    window.Scene3D.applyModelSettings(fakeTutorialStep);
                }
            }
        }

        // RIMOSSO: nascondimento planaxis ora avviene immediatamente durante il caricamento in Scene3D.addModel()

        // ═══════════════════════════════════════════════════════════════
        // SCREEN SYSTEM: Inizializza visibilità viste dopo caricamento modelli
        // ═══════════════════════════════════════════════════════════════
        if (window.ScreenSystem && window.ScreenSystem.screens.size > 0) {
            console.log('📺 [UI] Inizializzazione visibilità viste ScreenSystem...');
            window.ScreenSystem.initializeVisibility();
        }

        // ═══════════════════════════════════════════════════════════════
        // STEP CONTROLLER: Inizializza controller step centralizzato
        // ═══════════════════════════════════════════════════════════════
        if (window.StepController && !window.StepController.initialized) {
            console.log('🎮 [UI] Inizializzazione StepController...');
            window.StepController.init();
        }

        // ═══════════════════════════════════════════════════════════════
        // INTERACTIVE OBJECT 3D: Cerca varianti StateGroup in TUTTA la scena
        // Questo è necessario perché alcune varianti potrebbero essere:
        // - In modelli caricati separatamente (non come child)
        // - Con nomi che necessitano match parziale
        // ═══════════════════════════════════════════════════════════════
        if (window.InteractiveObject3D && window.InteractiveObject3D.stateGroups.size > 0) {
            console.log('🔀 [UI] Ricerca varianti StateGroup in tutta la scena...');
            window.InteractiveObject3D.attachStateGroupMeshesFromScene();
        }

    },
    
    /**
     * Callback errore caricamento modelli
     */
    onModelLoadError: function(error) {
        this.hideLoader();
        this.hideModelProgressBar(); // Nascondi progress bar anche in caso di errore
        this.showError('Errore caricamento modelli: ' + error);
        this.updateStatus('Errore caricamento');
        
        AppConfig.log(0, 'Errore caricamento modelli:', error);
    },
    
    /* ===== GESTIONE ANIMAZIONI ===== */
    
    /**
     * Gestisce la selezione di file animazione
     */
    onAnimationSelected: function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        AppConfig.log(2, `File animazione selezionato: ${file.name}`);
        // TODO: Implementare caricamento animazioni
        
        this.updateStatus('File animazione caricato');
        if (this.elements.animationBtn) {
            this.elements.animationBtn.disabled = false;
        }
    },
    
    /* ===== FEEDBACK UTENTE ===== */
    
    /**
     * Aggiorna il messaggio di stato
     */
    updateStatus: function(message) {
        if (this.elements.status) {
            this.elements.status.textContent = message;
        }
        AppConfig.log(3, `Status: ${message}`);
    },
    
    /**
     * Mostra il loader con messaggio
     */
    showLoader: function(message = 'Caricamento...') {
        if (this.elements.loader) {
            const loaderText = this.elements.loader.querySelector('p');
            if (loaderText) {
                loaderText.textContent = message;
            }
            this.elements.loader.classList.remove('hidden');
        }
    },
    
    /**
     * Nasconde il loader
     */
    hideLoader: function() {
        if (this.elements.loader) {
            this.elements.loader.classList.add('hidden');
        }
    },
    
    /**
     * Mostra messaggio di errore
     */
    showError: function(message) {
        if (this.elements.error && this.elements.errorMessage) {
            this.elements.errorMessage.textContent = message;
            this.elements.error.classList.remove('hidden');
        }
        AppConfig.log(0, `Errore UI: ${message}`);
    },
    
    /**
     * Nasconde messaggio di errore
     */
    hideError: function() {
        if (this.elements.error) {
            this.elements.error.classList.add('hidden');
        }
    },
    
    /* ===== PROGRESS BAR MODELLI ===== */
    
    /**
     * Mostra la progress bar per il caricamento modelli
     */
    showModelProgressBar: function(totalFiles = 0) {
        const progressBar = document.getElementById('modelProgressBar');
        if (progressBar) {
            // Reset elementi
            this.updateModelProgress(0, totalFiles, 'Preparazione...');

            // Mostra la progress bar
            progressBar.classList.remove('hidden');

            console.log('📊 Progress bar modelli mostrata');
        }

        // Disabilita pulsanti tutorial durante caricamento 3D
        document.querySelectorAll('.tutorial-arrow-btn').forEach(btn => {
            btn.classList.add('loading-disabled');
        });
        console.log('🔒 Pulsanti tutorial disabilitati durante caricamento 3D');
    },
    
    /**
     * Aggiorna la progress bar
     */
    updateModelProgress: function(currentFile, totalFiles, fileName = '', percentage = null) {
        const progressBarFill = document.getElementById('progress-bar-fill');
        const progressCurrentFile = document.getElementById('progress-current-file');
        const progressPercentage = document.getElementById('progress-percentage');
        const progressFilesCount = document.getElementById('progress-files-count');
        
        // Calcola percentuale se non fornita
        if (percentage === null) {
            percentage = totalFiles > 0 ? Math.round((currentFile / totalFiles) * 100) : 0;
        }
        
        // Aggiorna elementi
        if (progressBarFill) {
            progressBarFill.style.width = `${percentage}%`;
        }
        
        if (progressCurrentFile) {
            if (fileName) {
                // Estrai solo il nome del file senza percorso
                const cleanFileName = fileName.split('/').pop() || fileName;
                progressCurrentFile.textContent = cleanFileName;
            }
        }
        
        if (progressPercentage) {
            progressPercentage.textContent = `${percentage}%`;
        }
        
        if (progressFilesCount) {
            progressFilesCount.textContent = `${currentFile} / ${totalFiles} file`;
        }
        
        console.log(`📊 Progress aggiornato: ${percentage}% - ${fileName}`);
    },
    
    /**
     * Nasconde la progress bar
     */
    hideModelProgressBar: function() {
        const progressBar = document.getElementById('modelProgressBar');
        if (progressBar) {
            progressBar.classList.add('hidden');
            console.log('📊 Progress bar modelli nascosta');
        }

        // Riabilita pulsanti tutorial al termine del caricamento 3D
        document.querySelectorAll('.tutorial-arrow-btn').forEach(btn => {
            btn.classList.remove('loading-disabled');
        });
        console.log('🔓 Pulsanti tutorial riabilitati dopo caricamento 3D');
    },
    
    /* ===== AZIONI PULSANTI ===== */
    
    /**
     * Esegue lo scenario corrente
     */
    executeScenario: function() {
        if (!this.currentScenario) {
            this.showError('Nessuno scenario selezionato');
            return;
        }
        
        AppConfig.log(2, `Esecuzione scenario: ${this.currentScenario.name}`);
        // TODO: Implementare esecuzione scenario
        
        this.updateStatus('Scenario in esecuzione...');
    },
    
    /**
     * Pulisce tutti i modelli dalla scena
     */
    clearAll: function() {
        if (window.Scene3D) {
            window.Scene3D.clearAllModels();
        }
        
        // Reset input files
        if (this.elements.fileInput) this.elements.fileInput.value = '';
        if (this.elements.animationInput) this.elements.animationInput.value = '';
        
        // Disabilita pulsanti
        if (this.elements.animationBtn) this.elements.animationBtn.disabled = true;
        
        this.updateStatus('Scena pulita');
        AppConfig.log(2, 'Scena pulita dall\'utente');
        
        // Nasconde i controlli di visibilità
        this.hideModelVisibilityControls();
    },
    
    /**
     * Crea i controlli per la visibilità dei modelli
     */
    createModelVisibilityControls: function() {
        const panel = document.getElementById('modelsVisibilityPanel');
        if (!panel) {
            console.warn('Pannello controlli visibilità modelli non trovato');
            return;
        }
        
        // Ottieni informazioni sui modelli dalla scena
        const modelsInfo = window.Scene3D ? window.Scene3D.getModelsInfo() : [];
        
        // Pulisci pannello esistente
        panel.innerHTML = '';
        
        if (modelsInfo.length > 1) {
            // Aggiungi titolo
            const title = document.createElement('span');
            title.textContent = '👁️ Visibilità:';
            title.style.cssText = 'color: white; font-size: 12px; margin-right: 5px; align-self: center;';
            panel.appendChild(title);
            
            // Crea pulsante per ogni modello
            modelsInfo.forEach((info, index) => {
                const button = document.createElement('button');
                button.className = 'btn-blue';
                button.style.cssText = 'padding: 4px 8px; font-size: 11px; min-width: auto;';
                button.textContent = `📦 ${info.name === `Modello ${index + 1}` ? `M${index + 1}` : info.name.substring(0, 8)}`;
                button.title = `Mostra/Nascondi ${info.name}`;
                
                // Aggiorna stile in base alla visibilità
                this.updateVisibilityButtonStyle(button, info.visible);
                
                // Aggiungi click handler
                button.onclick = () => this.toggleModelVisibility(index);
                
                panel.appendChild(button);
            });
            
            // Mostra il pannello
            panel.classList.remove('hidden');
            panel.style.display = 'flex';
        }
    },
    
    /**
     * Nasconde i controlli di visibilità modelli
     */
    hideModelVisibilityControls: function() {
        const panel = document.getElementById('modelsVisibilityPanel');
        if (panel) {
            panel.classList.add('hidden');
            panel.style.display = 'none';
            panel.innerHTML = '';
        }
    },
    
    /**
     * Alterna la visibilità di un modello
     */
    toggleModelVisibility: function(modelIndex) {
        if (!window.Scene3D) {
            console.warn('Scene3D non disponibile');
            return;
        }
        
        const visible = window.Scene3D.toggleModelVisibility(modelIndex);
        
        // Aggiorna il pulsante corrispondente
        const panel = document.getElementById('modelsVisibilityPanel');
        if (panel) {
            const buttons = panel.querySelectorAll('button');
            if (buttons[modelIndex + 1]) { // +1 per saltare il titolo
                this.updateVisibilityButtonStyle(buttons[modelIndex + 1], visible);
            }
        }
    },
    
    /**
     * Aggiorna lo stile del pulsante in base alla visibilità
     */
    updateVisibilityButtonStyle: function(button, visible) {
        if (visible) {
            button.style.opacity = '1';
            button.style.backgroundColor = 'var(--primary-blue)';
            button.title = button.title.replace('Mostra/', 'Nascondi ');
        } else {
            button.style.opacity = '0.5';
            button.style.backgroundColor = '#666';
            button.title = button.title.replace('Nascondi ', 'Mostra/');
        }
    },
    
    /**
     * Gestisce il toggle dei controlli su dispositivi mobili
     */
    toggleMobileControls: function() {
        const body = document.body;
        const toggleBtn = document.getElementById('toggleControlsBtn');
        
        if (body.classList.contains('mobile-controls-hidden')) {
            // Mostra controlli
            body.classList.remove('mobile-controls-hidden');
            if (toggleBtn) {
                toggleBtn.innerHTML = '⚙️';
                toggleBtn.title = 'Nascondi controlli avanzati';
            }
            console.log('📱 Controlli mobile mostrati');
        } else {
            // Nascondi controlli
            body.classList.add('mobile-controls-hidden');
            if (toggleBtn) {
                toggleBtn.innerHTML = '⚙️';
                toggleBtn.title = 'Mostra controlli avanzati';
            }
            console.log('📱 Controlli mobile nascosti');
        }
    },
    
    initMobileControls: function() {},
    setupMobileTouchListeners: function() {},
    cleanupMobileControls: function() {
        document.body.classList.remove('mobile-controls-hidden');
    },
    forceShowTouchControls: function() {},
    debugTouchControlsState: function() {},
    
    /**
     * Gestisce il cambio di orientamento dello schermo mobile
     */
    /**
     * Controlla orientamento mobile e mostra/nasconde overlay portrait
     */
    checkOrientation: function() {
        const isMobile = window.isMobileDevice ? window.isMobileDevice() : false;
        const overlay = document.getElementById('orientationOverlay');
        if (!isMobile || !overlay) return;

        const isPortrait = window.innerWidth < window.innerHeight;
        overlay.style.display = isPortrait ? 'flex' : 'none';

        if (isPortrait) {
            console.log('📱 [UI] Orientamento portrait rilevato - overlay bloccante mostrato');
        } else {
            console.log('📱 [UI] Orientamento landscape - overlay rimosso');
        }
    },

    onOrientationChange: function() {
        // Controlla orientamento portrait/landscape
        this.checkOrientation();

        setTimeout(() => {
            console.log('📱 Orientamento cambiato');
            this.handleMobileControlsRefresh();
        }, 300);
    },
    
    startTouchControlsWatchdog: function() {},
    
    /**
     * Gestisce il resize della finestra
     */
    onWindowResize: function() {
        // Controlla orientamento portrait/landscape
        this.checkOrientation();

        // Debounce per evitare troppi eventi durante resize
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            console.log('📱 Finestra ridimensionata, controllo mobile...');
            this.handleMobileControlsRefresh();
        }, 200);
    },
    
    handleMobileControlsRefresh: function() {},
    
    /**
     * Reset vista camera
     */
    resetView: function() {
        if (window.Scene3D && window.Scene3D.resetView) {
            window.Scene3D.resetView();
            this.updateStatus('Vista reimpostata');
            AppConfig.log(2, 'Vista camera reimpostata');
        }
    },
    
    /**
     * Avvia animazione
     */
    startAnimation: function() {
        AppConfig.log(2, 'Avvio animazione richiesto');
        // TODO: Implementare sistema animazioni
        this.updateStatus('Animazione avviata');
    },
    
    /* ===== GESTIONE STRUMENTI TUTORIAL ===== */
    
    /**
     * Stato corrente degli strumenti
     */
    toolsState: {},

    /**
     * Inizializza ToolsManager globale
     */
    initToolsManager: function() {
        // Verifica che ToolsManager sia disponibile
        if (typeof window.ToolsManager !== 'function') {
            this.safeLog(1, 'ToolsManager class non disponibile - fallback su implementazione locale');
            this.initToolsLegend();
            return;
        }

        // Istanzia ToolsManager globalmente
        if (!window.toolsManager) {
            window.toolsManager = new window.ToolsManager();
            this.safeLog(2, 'ToolsManager istanziato globalmente');
        }

        // Inizializza ToolsManager
        const success = window.toolsManager.init();
        if (success) {
            this.safeLog(2, 'ToolsManager inizializzato con successo');

            // Esponi anche come window.ToolsManager per compatibilità
            window.ToolsManager = window.toolsManager;
        } else {
            this.safeLog(1, 'Errore inizializzazione ToolsManager - fallback su implementazione locale');
            this.initToolsLegend();
        }
    },

    /**
     * Ottiene lo step corrente del tutorial
     * @returns {Object|null} Step corrente o null
     */
    getCurrentStep: function() {
        if (!this.tutorialSteps || this.tutorialSteps.length === 0) {
            return null;
        }

        if (this.currentStepIndex < 0 || this.currentStepIndex >= this.tutorialSteps.length) {
            return null;
        }

        return this.tutorialSteps[this.currentStepIndex];
    },

    /**
     * Inizializza la legenda strumenti (FALLBACK)
     */
    initToolsLegend: function() {
        const toolsContainer = document.getElementById('toolsContainer');
        if (!toolsContainer) return;
        
        const tools = [
            { name: 'brugola', icon: 'utilimages/brugola.png' },
            { name: 'chiave_inglese', icon: 'utilimages/chiave_inglese.png' },
            { name: 'mano', icon: 'utilimages/mano.png' },
            { name: 'aria', icon: 'utilimages/air.png' }
        ];
        
        // Pulisce il container
        toolsContainer.innerHTML = '';
        
        // Crea le icone degli strumenti
        tools.forEach(tool => {
            const toolElement = document.createElement('div');
            toolElement.className = 'tool-icon';
            toolElement.dataset.tool = tool.name;
            toolElement.title = tool.name.replace('_', ' ');
            
            const img = document.createElement('img');
            img.src = tool.icon;
            img.alt = tool.name;
            img.onerror = function() {
                console.warn(`Icona non trovata: ${tool.icon}`);
                this.style.display = 'none';
            };
            
            toolElement.appendChild(img);
            toolElement.addEventListener('click', () => this.toggleTool(tool.name));
            
            toolsContainer.appendChild(toolElement);
            
            // Inizializza lo stato dello strumento
            this.toolsState[tool.name] = false;
        });
        
        AppConfig.log(2, 'Legenda strumenti inizializzata');
    },
    
    /**
     * Attiva/disattiva uno strumento
     */
    toggleTool: function(toolName) {
        // Se lo strumento è già attivo, non fare nulla (rimane attivo)
        if (this.toolsState[toolName]) {
            AppConfig.log(2, `Strumento già attivo: ${toolName}`);
            return;
        }
        
        // Disattiva tutti gli altri strumenti (modalità esclusiva)
        Object.keys(this.toolsState).forEach(tool => {
            if (tool !== toolName) {
                this.toolsState[tool] = false;
                const element = document.querySelector(`[data-tool="${tool}"]`);
                if (element) element.classList.remove('active');
            }
        });
        
        // Attiva lo strumento corrente (non più toggle, solo attivazione)
        this.toolsState[toolName] = true;
        const element = document.querySelector(`[data-tool="${toolName}"]`);
        
        element.classList.add('active');
        this.updateStatus(`Strumento attivo: ${toolName.replace('_', ' ')}`);
        AppConfig.log(2, `Strumento attivato: ${toolName}`);
        
        // Notifica il cambio di stato agli altri moduli
        this.onToolStateChanged(toolName, this.toolsState[toolName]);
    },
    
    /**
     * Disattiva manualmente uno strumento specifico
     */
    deactivateTool: function(toolName) {
        if (!this.toolsState[toolName]) return; // Già disattivato
        
        this.toolsState[toolName] = false;
        const element = document.querySelector(`[data-tool="${toolName}"]`);
        if (element) element.classList.remove('active');
        
        this.updateStatus('Nessuno strumento attivo');
        AppConfig.log(2, `Strumento disattivato: ${toolName}`);
        
        // Notifica il cambio di stato
        this.onToolStateChanged(toolName, false);
    },
    
    /**
     * Disattiva tutti gli strumenti
     */
    deactivateAllTools: function() {
        Object.keys(this.toolsState).forEach(toolName => {
            this.deactivateTool(toolName);
        });
    },
    
    /**
     * Ottiene lo stato di uno strumento
     */
    getToolState: function(toolName) {
        return this.toolsState[toolName] || false;
    },
    
    /**
     * Ottiene lo strumento attualmente attivo
     */
    getActiveTool: function() {
        console.log(`[DEBUG] 🔍 getActiveTool() - toolsState:`, this.toolsState);
        for (const [toolName, isActive] of Object.entries(this.toolsState)) {
            if (isActive) {
                console.log(`[DEBUG] ✅ getActiveTool() found: "${toolName}"`);
                return toolName;
            }
        }
        console.log(`[DEBUG] ❌ getActiveTool() returning null - no active tools`);
        return null;
    },
    
    /**
     * Callback chiamata quando cambia lo stato di uno strumento
     * Può essere sovrascritta per implementare logica specifica
     */
    onToolStateChanged: function(toolName, isActive) {
        // Aggiorna cursore del canvas 3D
        this.updateCanvasCursor();
        
        // Evento personalizzabile per altri moduli
        const event = new CustomEvent('toolStateChanged', {
            detail: { toolName, isActive, allStates: this.toolsState }
        });
        document.dispatchEvent(event);
    },

    /**
     * Aggiorna il cursore del canvas 3D basato sullo strumento attivo
     */
    updateCanvasCursor: function() {
        const canvas = document.querySelector('#canvas3d, canvas');
        if (!canvas) return;

        const activeTool = this.getActiveTool();

        // Rimuovi tutte le classi body tool prima di applicare la nuova
        document.body.classList.remove('tool-aria-active', 'tool-chiave_inglese-active', 'tool-brugola-active', 'tool-mano-active', 'cursor-frame-1', 'cursor-frame-2');

        // Gestione cursori personalizzati via body class per tool specifici
        if (activeTool === 'aria' || activeTool === 'Aria') {
            // Rimuovi classi cursore canvas
            canvas.classList.remove('cursor-default', 'cursor-mano', 'cursor-brugola', 'cursor-chiave', 'cursor-aria');
            // Applica cursore aria direttamente al body
            document.body.classList.add('tool-aria-active');
            console.log(`🖱️ Cursore aria applicato direttamente al body`);
            return;
        }

        if (activeTool === 'chiave_inglese' || activeTool === 'ChiaveInglese') {
            // Rimuovi classi cursore canvas
            canvas.classList.remove('cursor-default', 'cursor-mano', 'cursor-brugola', 'cursor-chiave', 'cursor-aria');
            // Applica cursore chiave inglese direttamente al body
            document.body.classList.add('tool-chiave_inglese-active');
            console.log(`🖱️ Cursore chiave inglese applicato direttamente al body`);
            return;
        }

        if (activeTool === 'brugola' || activeTool === 'ChiaveBrugola') {
            // Rimuovi classi cursore canvas
            canvas.classList.remove('cursor-default', 'cursor-mano', 'cursor-brugola', 'cursor-chiave', 'cursor-aria');
            // Applica cursore brugola direttamente al body
            document.body.classList.add('tool-brugola-active');
            console.log(`🖱️ Cursore brugola applicato direttamente al body`);
            return;
        }

        // Per tool rimanenti (mano), usa il sistema canvas
        canvas.classList.remove('cursor-default', 'cursor-mano', 'cursor-brugola', 'cursor-chiave', 'cursor-aria');

        // Mappa dei tool ai cursori (solo per tool senza cursore personalizzato)
        const toolCursorMap = {
            'mano': 'cursor-mano',
            'Mani': 'cursor-mano'
        };

        // Applica il cursore appropriato
        const cursorClass = toolCursorMap[activeTool] || 'cursor-default';
        canvas.classList.add(cursorClass);

        console.log(`🖱️ Cursore aggiornato: ${activeTool || 'default'} → ${cursorClass}`);

        // Opzione avanzata: cursore canvas animato (decommentare se desiderato)
        // this.initAnimatedCursor(activeTool);
    },

    /**
     * OPZIONALE: Inizializza cursore canvas animato per tool complessi
     * Offre animazioni fluide a 60fps invece dei limiti CSS
     */
    initAnimatedCursor: function(toolName) {
        // Solo per tool che beneficiano di animazioni avanzate
        const animatedTools = ['brugola', 'ChiaveBrugola', 'aria', 'Aria'];
        
        if (!animatedTools.includes(toolName)) {
            this.removeAnimatedCursor();
            return;
        }
        
        // Implementazione cursore canvas (da attivare se necessario)
        console.log(`🎯 Cursore animato disponibile per: ${toolName}`);
    },

    removeAnimatedCursor: function() {
        // Cleanup cursore canvas se presente
        const animatedCursor = document.getElementById('animatedCursor');
        if (animatedCursor) {
            animatedCursor.remove();
        }
    },
    
    /* ===== GESTIONE TUTORIAL STEPS ===== */
    
    /**
     * Configurazione tutorial corrente
     */
    tutorialSteps: [],         // Steps di un tutorial specifico
    availableTutorials: [],     // Lista dei tutorial disponibili
    currentTutorial: null,      // Tutorial attualmente attivo
    currentStepIndex: 0,
    
    /**
     * Carica e parsa il file tutorial.txt
     */
    loadTutorial: async function(tutorialPath) {
        if (!tutorialPath) {
            console.log('❌ Nessun path tutorial specificato');
            return;
        }
        
        try {
            AppConfig.log(2, `Caricamento tutorial: ${tutorialPath}`);

            const response = await fetchFile(tutorialPath);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const content = await response.text();
            this.availableTutorials = this.parseTutorialContent(content);
            
            if (this.availableTutorials.length > 0) {
                // Applica automaticamente le impostazioni camera del primo tutorial disponibile
                const firstTutorial = this.availableTutorials[0];
                if (firstTutorial && firstTutorial.properties) {
                    this.applyInitialCameraSettings(firstTutorial);
                }
                
                // NON selezionare automaticamente nessun tutorial - lascia che l'utente scelga
                this.currentTutorial = null;
                this.tutorialSteps = [];
                this.currentStepIndex = -1; // -1 indica "nessun tutorial attivo"

                // Reset silhouette da tutorial precedente
                this.resetAllHighlights();

                this.createTutorialStepsBar();
                this.showTutorialStepsBar();
                // NON chiamare updateStepSpeechBubble() - il fumetto rimane nascosto

                // ✨ Mostra overlay selezione tutorial con pulsanti pulsanti
                setTimeout(() => {
                    this.showTutorialSelectionOverlay();
                }, 500); // Delay 500ms per permettere animazione barra tutorial

                AppConfig.log(2, `Tutorial disponibili: ${this.availableTutorials.length} - Camera impostata dal primo tutorial`);
            } else {
                this.hideStepSpeechBubble(); // Nasconde il fumetto se non ci sono tutorial
                AppConfig.log(1, 'Nessun tutorial trovato nel file');
            }
            
        } catch (error) {
            AppConfig.log(0, `Errore caricamento tutorial: ${error.message}`);
            this.showError(`Errore caricamento tutorial: ${error.message}`);
        }
    },
    
    /**
     * Parsa il contenuto del file tutorial.txt
     * Ora distingue tra tutorial principali e steps
     */
    parseTutorialContent: function(content) {
        const tutorials = [];
        const lines = content.split('\n');
        let currentTutorial = null;
        let currentStep = null;
        let globalProperties = {}; // Raccoglie proprietà globali prima del primo tutorial

        // ═══════════════════════════════════════════════════════════════
        // SCREEN SYSTEM: Variabili per parsing definizioni schermi
        // ═══════════════════════════════════════════════════════════════
        let currentScreenSection = null;  // { type: 'screen'|'screenview'|'hotspot'|'action', id: string, properties: {} }
        const screenDefinitions = {
            screens: new Map(),
            views: new Map(),
            hotspots: new Map(),
            actions: new Map(),
            interactiveObjects: new Map(),  // InteractiveObject3D
            stateGroups: new Map()          // StateGroup per varianti mutuamente esclusive
        };
        
        for (let line of lines) {
            line = line.trim();
            
            // Ignora righe vuote e commenti
            if (!line || line.startsWith('#') || line.startsWith('//')) continue;
            
            // Rimuovi commenti inline (dopo //)
            const commentIndex = line.indexOf('//');
            if (commentIndex !== -1) {
                line = line.substring(0, commentIndex).trim();
                if (!line) continue; // Se dopo aver rimosso il commento la riga è vuota, ignorala
            }
            
            // Rileva inizio sezione [Nome]
            if (line.startsWith('[') && line.endsWith(']')) {
                const sectionName = line.slice(1, -1);

                // ═══════════════════════════════════════════════════════════════
                // SCREEN SYSTEM: Rileva sezioni speciali per schermi interattivi
                // ═══════════════════════════════════════════════════════════════

                // [Screen:id] - Definizione schermo
                if (sectionName.startsWith('Screen:')) {
                    // Salva sezione precedente se era una sezione screen
                    if (currentScreenSection) {
                        this.saveScreenSection(currentScreenSection, screenDefinitions);
                    }

                    const screenId = sectionName.substring(7).trim(); // Rimuovi "Screen:"
                    currentScreenSection = { type: 'screen', id: screenId, properties: {} };
                    console.log(`📺 [PARSER] Sezione Screen rilevata: "${screenId}"`);
                    continue;
                }

                // [ScreenView:screen.view] - Definizione vista
                if (sectionName.startsWith('ScreenView:')) {
                    if (currentScreenSection) {
                        this.saveScreenSection(currentScreenSection, screenDefinitions);
                    }

                    const viewId = sectionName.substring(11).trim(); // Rimuovi "ScreenView:"
                    currentScreenSection = { type: 'screenview', id: viewId, properties: {} };
                    console.log(`📄 [PARSER] Sezione ScreenView rilevata: "${viewId}"`);
                    continue;
                }

                // [Hotspot:id] - Definizione hotspot
                if (sectionName.startsWith('Hotspot:')) {
                    if (currentScreenSection) {
                        this.saveScreenSection(currentScreenSection, screenDefinitions);
                    }

                    const hotspotId = sectionName.substring(8).trim(); // Rimuovi "Hotspot:"
                    currentScreenSection = { type: 'hotspot', id: hotspotId, properties: {} };
                    console.log(`🔘 [PARSER] Sezione Hotspot rilevata: "${hotspotId}"`);
                    continue;
                }

                // [ScreenAction:id] - Definizione azione
                if (sectionName.startsWith('ScreenAction:')) {
                    if (currentScreenSection) {
                        this.saveScreenSection(currentScreenSection, screenDefinitions);
                    }

                    const actionId = sectionName.substring(13).trim(); // Rimuovi "ScreenAction:"
                    currentScreenSection = { type: 'action', id: actionId, properties: {} };
                    console.log(`⚡ [PARSER] Sezione ScreenAction rilevata: "${actionId}"`);
                    continue;
                }

                // ═══════════════════════════════════════════════════════════════
                // INTERACTIVE OBJECT 3D: Rileva sezioni per oggetti interattivi
                // ═══════════════════════════════════════════════════════════════

                // [InteractiveObject:id] - Definizione oggetto 3D interattivo
                if (sectionName.startsWith('InteractiveObject:')) {
                    if (currentScreenSection) {
                        this.saveScreenSection(currentScreenSection, screenDefinitions);
                    }

                    const objectId = sectionName.substring(18).trim(); // Rimuovi "InteractiveObject:"
                    currentScreenSection = { type: 'interactiveObject', id: objectId, properties: {} };
                    console.log(`🎮 [PARSER] Sezione InteractiveObject rilevata: "${objectId}"`);
                    continue;
                }

                // [StateGroup:name] - Definizione gruppo varianti mutuamente esclusive
                if (sectionName.startsWith('StateGroup:')) {
                    if (currentScreenSection) {
                        this.saveScreenSection(currentScreenSection, screenDefinitions);
                    }

                    const groupName = sectionName.substring(11).trim(); // Rimuovi "StateGroup:"
                    currentScreenSection = { type: 'stateGroup', id: groupName, properties: {} };
                    console.log(`🔀 [PARSER] Sezione StateGroup rilevata: "${groupName}"`);
                    continue;
                }

                // Se arriviamo qui, non è una sezione screen - salva eventuale sezione screen precedente
                if (currentScreenSection) {
                    this.saveScreenSection(currentScreenSection, screenDefinitions);
                    currentScreenSection = null;
                }

                // Determina se è un tutorial principale o uno step
                const isStep = sectionName.toLowerCase().startsWith('step ') ||
                               sectionName.toLowerCase().startsWith('next step');

                if (isStep) {
                    // È uno step interno al tutorial corrente
                    if (currentStep && Object.keys(currentStep.properties).length > 0) {
                        if (currentTutorial) {
                            currentTutorial.steps.push(currentStep);
                        }
                    }

                    // Calcola numero step automaticamente se è [Next Step] o [Next Step - Descrizione]
                    let stepName = sectionName;
                    let stepTitle = sectionName;

                    if (sectionName.toLowerCase().startsWith('next step')) {
                        // Calcola il numero dello step automaticamente
                        const stepNumber = currentTutorial ? currentTutorial.steps.length + 1 : 1;

                        // Controlla se c'è una descrizione dopo "Next Step"
                        const dashIndex = sectionName.indexOf('-');
                        if (dashIndex !== -1) {
                            // Formato: [Next Step - Descrizione]
                            const description = sectionName.substring(dashIndex).trim(); // Include il "-"
                            stepName = `Step ${stepNumber} ${description}`;
                            stepTitle = `Step ${stepNumber} ${description}`;
                        } else {
                            // Formato: [Next Step]
                            stepName = `Step ${stepNumber}`;
                            stepTitle = `Step ${stepNumber}`;
                        }

                        AppConfig.log(3, `📝 PARSER: [${sectionName}] → automaticamente rinumerato come [${stepTitle}]`);
                    }

                    // Crea nuovo step
                    currentStep = {
                        name: stepName,
                        title: stepTitle,
                        properties: {}
                    };
                } else {
                    // È un tutorial principale
                    // Salva step precedente se esiste
                    if (currentStep && Object.keys(currentStep.properties).length > 0) {
                        if (currentTutorial) {
                            currentTutorial.steps.push(currentStep);
                        }
                    }
                    
                    // Salva tutorial precedente se esiste
                    if (currentTutorial && currentTutorial.steps.length > 0) {
                        tutorials.push(currentTutorial);
                    }
                    
                    // Crea nuovo tutorial
                    currentTutorial = {
                        name: sectionName,
                        title: sectionName,
                        steps: [],
                        properties: {}  // NUOVO: proprietà globali del tutorial
                    };
                    
                    // Se è il primo tutorial e abbiamo proprietà globali, applicale
                    if (tutorials.length === 0 && Object.keys(globalProperties).length > 0) {
                        console.log(`📝 PARSER: Applicazione ${Object.keys(globalProperties).length} proprietà globali al primo tutorial "${sectionName}"`);
                        Object.assign(currentTutorial.properties, globalProperties);
                        globalProperties = {}; // Svuota dopo aver applicato
                    }
                    
                    currentStep = null;
                }
            }
            // Parsa proprietà (chiave=valore)
            else if (line && line.includes('=')) {
                // Dividi solo sul PRIMO '=' per preservare '=' nei valori
                const eqIndex = line.indexOf('=');
                const key = line.substring(0, eqIndex).trim();
                const value = line.substring(eqIndex + 1).trim();

                // ═══════════════════════════════════════════════════════════════
                // SCREEN SYSTEM: Se siamo in una sezione screen, salva proprietà lì
                // ═══════════════════════════════════════════════════════════════
                if (currentScreenSection) {
                    // Gestione speciale per InteractiveChild multipli
                    if (key === 'InteractiveChild') {
                        if (!currentScreenSection.properties[key]) {
                            currentScreenSection.properties[key] = [];
                        } else if (!Array.isArray(currentScreenSection.properties[key])) {
                            currentScreenSection.properties[key] = [currentScreenSection.properties[key]];
                        }
                        currentScreenSection.properties[key].push(value);
                        console.log(`🎮 [PARSER] InteractiveChild aggiunto: ${value} (totale: ${currentScreenSection.properties[key].length})`);
                    } else {
                        currentScreenSection.properties[key] = value;
                    }
                    continue; // Salta il resto del parsing proprietà
                }

                if (!currentTutorial) {
                    // Proprietà globali prima del primo tutorial - raccogliamo in globalProperties
                    globalProperties[key] = value;
                    console.log(`📝 PARSER: Proprietà globale pre-tutorial: ${key} = ${value}`);
                } else if (currentTutorial && !currentStep) {
                    // Se siamo in un tutorial ma non in uno step, sono proprietà globali del tutorial

                    // Gestione speciale per Posizione e Rotazione multiple
                    if (key === 'Posizione' || key === 'Rotazione') {
                        // Se la proprietà non esiste, crea un array
                        if (!currentTutorial.properties[key]) {
                            currentTutorial.properties[key] = [];
                        }
                        // Se esiste ma non è un array, convertila in array
                        else if (!Array.isArray(currentTutorial.properties[key])) {
                            currentTutorial.properties[key] = [currentTutorial.properties[key]];
                        }
                        // Aggiungi la nuova direttiva all'array
                        currentTutorial.properties[key].push(value);
                        console.log(`📝 PARSER: ${key} multipla aggiunta: ${value} (totale: ${currentTutorial.properties[key].length})`);
                    } else {
                        // Per tutte le altre proprietà, comportamento normale
                        currentTutorial.properties[key] = value;
                    }
                    
                    // Parsing specifico per proprietà camera globali  
                    if (key === 'CameraPos') {
                        // NUOVO: Supporta sia coordinate assolute che relative a elementi
                        if (value.includes(':')) {
                            // Formato elemento:offset -> lasciamo parsing a Scene3D
                            // Es: "coperchio.glb:(0, 2, 5)"
                            currentTutorial.properties[key + '_relative'] = value.trim();
                        } else {
                            // Formato coordinate assolute (x, y, z)
                            const coords = value.replace(/[()]/g, '').split(',').map(n => parseFloat(n.trim()));
                            if (coords.length === 3) {
                                currentTutorial.properties[key + '_parsed'] = { x: coords[0], y: coords[1], z: coords[2] };
                            }
                        }
                    } else if (key === 'CameraTarget') {
                        // NUOVO: Supporta sia coordinate che nomi elementi
                        if (value.includes('(') && value.includes(')')) {
                            // Formato coordinate (x, y, z)
                            const coords = value.replace(/[()]/g, '').split(',').map(n => parseFloat(n.trim()));
                            if (coords.length === 3) {
                                currentTutorial.properties[key + '_parsed'] = { x: coords[0], y: coords[1], z: coords[2] };
                            }
                        } else {
                            // Formato nome elemento
                            currentTutorial.properties[key + '_element'] = value.trim();
                        }
                    } else if (key === 'CameraZoom' || key === 'CameraTransitionTime') {
                        currentTutorial.properties[key + '_parsed'] = parseFloat(value);
                    }
                }
                // Se siamo in uno step, sono proprietà dello step
                else if (currentStep) {
                    currentStep.properties[key] = value;
                    
                    // Parsing specifico per proprietà speciali
                    if (key === 'CameraPos') {
                        // NUOVO: Supporta sia coordinate assolute che relative a elementi
                        if (value.includes(':')) {
                            // Formato elemento:offset -> lasciamo parsing a Scene3D
                            currentStep.properties[key + '_relative'] = value.trim();
                        } else {
                            // Formato coordinate assolute (x, y, z)
                            const coords = value.replace(/[()]/g, '').split(',').map(n => parseFloat(n.trim()));
                            if (coords.length === 3) {
                                currentStep.properties[key + '_parsed'] = { x: coords[0], y: coords[1], z: coords[2] };
                            }
                        }
                    } else if (key === 'CameraTarget') {
                        // NUOVO: Supporta sia coordinate che nomi elementi
                        if (value.includes('(') && value.includes(')')) {
                            // Formato coordinate (x, y, z)
                            const coords = value.replace(/[()]/g, '').split(',').map(n => parseFloat(n.trim()));
                            if (coords.length === 3) {
                                currentStep.properties[key + '_parsed'] = { x: coords[0], y: coords[1], z: coords[2] };
                            }
                        } else {
                            // Formato nome elemento
                            currentStep.properties[key + '_element'] = value.trim();
                        }
                    } else if (key === 'CameraZoom' || key === 'CameraTransitionTime') {
                        currentStep.properties[key + '_parsed'] = parseFloat(value);
                    }
                }
            }
            // Parsa proprietà tutorial (per tutorial senza steps espliciti)
            else if (line && line.includes('=') && currentTutorial && !currentStep) {
                // Crea uno step implicito per tutorial semplici
                if (!currentStep) {
                    currentStep = {
                        name: currentTutorial.name,
                        title: currentTutorial.name,
                        properties: {}
                    };
                }
                
                const [key, value] = line.split('=').map(s => s.trim());
                currentStep.properties[key] = value;
            }
        }
        
        // Salva l'ultimo step se esiste
        if (currentStep && Object.keys(currentStep.properties).length > 0) {
            if (currentTutorial) {
                currentTutorial.steps.push(currentStep);
            }
        }

        // Salva l'ultimo tutorial se esiste
        if (currentTutorial && currentTutorial.steps.length > 0) {
            tutorials.push(currentTutorial);
        }

        // ═══════════════════════════════════════════════════════════════
        // SCREEN SYSTEM: Salva ultima sezione e registra in ScreenSystem
        // ═══════════════════════════════════════════════════════════════
        if (currentScreenSection) {
            this.saveScreenSection(currentScreenSection, screenDefinitions);
        }

        // Registra tutte le definizioni in ScreenSystem
        this.registerScreenDefinitions(screenDefinitions);

        AppConfig.log(3, 'Tutorials parsed:', tutorials);
        
        // Memorizza i tutorial disponibili
        this.availableTutorials = tutorials;
        
        // Se c'è almeno un tutorial, seleziona il primo come default
        if (tutorials.length > 0) {
            // NUOVO: Resetta il tracker del tutorial per nuovo scenario
            if (window.Scene3D && window.Scene3D.resetTutorialTracker) {
                window.Scene3D.resetTutorialTracker();
            }
            
            this.selectTutorial(0);
            // L'evidenziazione del primo elemento ora avviene dopo il caricamento dei modelli
            // in onModelLoadComplete() per garantire che i modelli siano disponibili
        }
        
        return tutorials;
    },

    // ═══════════════════════════════════════════════════════════════════════
    // SCREEN SYSTEM: Metodi helper per parsing definizioni
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Salva una sezione screen nel registro temporaneo
     */
    saveScreenSection: function(section, definitions) {
        if (!section || !section.type || !section.id) return;

        switch (section.type) {
            case 'screen':
                definitions.screens.set(section.id, section.properties);
                break;
            case 'screenview':
                definitions.views.set(section.id, section.properties);
                break;
            case 'hotspot':
                definitions.hotspots.set(section.id, section.properties);
                break;
            case 'action':
                definitions.actions.set(section.id, section.properties);
                break;
            case 'interactiveObject':
                definitions.interactiveObjects.set(section.id, section.properties);
                break;
            case 'stateGroup':
                definitions.stateGroups.set(section.id, section.properties);
                break;
        }
    },

    /**
     * Registra tutte le definizioni screen in ScreenSystem
     */
    registerScreenDefinitions: function(definitions) {
        if (!window.ScreenSystem) {
            if (definitions.screens.size > 0 || definitions.views.size > 0 ||
                definitions.hotspots.size > 0 || definitions.actions.size > 0) {
                console.warn('[UI] ⚠️ ScreenSystem non disponibile, definizioni schermi ignorate');
            }
            return;
        }

        // Pulisci definizioni precedenti
        window.ScreenSystem.clearDefinitions();

        // Registra schermi
        definitions.screens.forEach((props, id) => {
            window.ScreenSystem.registerScreen(id, props);
        });

        // Registra viste (con supporto per Model e Hotspots)
        definitions.views.forEach((props, viewKey) => {
            // viewKey è nel formato "screenId.viewId"
            const [screenId, viewId] = viewKey.split('.');

            // Passa l'oggetto config completo con Model e Hotspots
            const viewConfig = {
                Model: props.Model || null,
                Hotspots: props.Hotspots || ''
            };

            window.ScreenSystem.registerView(screenId, viewId, viewConfig);
            console.log(`📄 [UI] Vista "${viewKey}": Model=${viewConfig.Model || '(nessuno)'}, Hotspots=${viewConfig.Hotspots || '(nessuno)'}`);
        });

        // Registra hotspot
        definitions.hotspots.forEach((props, id) => {
            window.ScreenSystem.registerHotspot(id, props);
        });

        // Registra azioni
        definitions.actions.forEach((props, id) => {
            window.ScreenSystem.registerAction(id, props);
        });

        const totalDefs = definitions.screens.size + definitions.views.size +
                          definitions.hotspots.size + definitions.actions.size;
        if (totalDefs > 0) {
            console.log(`📺 [UI] ScreenSystem: Registrate ${definitions.screens.size} schermi, ` +
                        `${definitions.views.size} viste, ${definitions.hotspots.size} hotspot, ` +
                        `${definitions.actions.size} azioni`);
        }

        // ═══════════════════════════════════════════════════════════════
        // INTERACTIVE OBJECT 3D: Registra oggetti interattivi
        // ═══════════════════════════════════════════════════════════════
        if (window.InteractiveObject3D && definitions.interactiveObjects.size > 0) {
            definitions.interactiveObjects.forEach((props, id) => {
                console.log(`🎮 [UI] Registrazione InteractiveObject: "${id}"`);
                window.InteractiveObject3D.registerFromTutorial(id, props);
            });
            console.log(`🎮 [UI] InteractiveObject3D: Registrati ${definitions.interactiveObjects.size} oggetti interattivi`);
        }

        // ═══════════════════════════════════════════════════════════════
        // STATE GROUPS: Registra gruppi varianti mutuamente esclusive
        // ═══════════════════════════════════════════════════════════════
        if (window.InteractiveObject3D && definitions.stateGroups.size > 0) {
            definitions.stateGroups.forEach((props, id) => {
                console.log(`🔀 [UI] Registrazione StateGroup: "${id}"`);
                window.InteractiveObject3D.registerStateGroupFromTutorial(id, props);
            });
            console.log(`🔀 [UI] StateGroups: Registrati ${definitions.stateGroups.size} gruppi di varianti`);
        }
    },

    /**
     * Seleziona un tutorial specifico
     */
    selectTutorial: function(tutorialIndex) {
        if (tutorialIndex < 0 || tutorialIndex >= this.availableTutorials.length) {
            AppConfig.log(1, `Indice tutorial non valido: ${tutorialIndex}`);
            return;
        }

        // IMPORTANTE: Reset silhouette da tutorial precedente
        this.resetAllHighlights();

        // RESET: Sblocca interazioni e ripristina posizioni quando si seleziona un nuovo tutorial
        if (window.Scene3D) {
            window.Scene3D.resetTutorialTracker();

            // OPZIONE 1: Reset alle posizioni originali dello scenario (senza impostazioni tutorial)
            window.Scene3D.resetAllModelsToScenarioPositions();

            // OPZIONE 2: Applica le impostazioni del nuovo tutorial sopra le posizioni scenario
            const tutorialWithSettings = this.availableTutorials[tutorialIndex];
            if (tutorialWithSettings.properties) {
                console.log('🔧 Applicazione impostazioni tutorial sopra posizioni scenario...');
                window.Scene3D.applyModelSettings({ properties: tutorialWithSettings.properties });
            }
        }

        // RESET: Disabilita sistema drag & drop quando si cambia tutorial
        if (window.DragDropSystem && window.DragDropSystem.isEnabled()) {
            window.DragDropSystem.disable();
            AppConfig.log(2, `🚫 DRAG & DROP: Sistema disabilitato per nuovo tutorial "${this.availableTutorials[tutorialIndex].name}"`);
        }

        // RESET: StepController - pulisci configurazioni trigger da tutorial precedente
        // Previene che stepConfigs stantie interferiscano con trigger del nuovo tutorial
        if (window.StepController && window.StepController.reset) {
            window.StepController.reset();
            AppConfig.log(2, `🎮 STEP CONTROLLER: Reset per nuovo tutorial`);
        }

        // RESET: Disabilita AssemblySystem da tutorial precedente
        // Previene che AssemblySystem.enabled=true interferisca con isDraggableObject() nel nuovo tutorial
        if (window.AssemblySystem && window.AssemblySystem.disableAssemblyMode) {
            window.AssemblySystem.disableAssemblyMode();
            AppConfig.log(2, `🚫 ASSEMBLY: Sistema disabilitato per nuovo tutorial`);
        }
        if (window.AssemblySystemSimplified && window.AssemblySystemSimplified.disableAssemblyMode) {
            window.AssemblySystemSimplified.disableAssemblyMode();
        }

        // RESET: Disattiva tutti i tool e ripristina cursore di default
        if (window.ToolsManager && window.ToolsManager.deactivateAllTools) {
            window.ToolsManager.deactivateAllTools();
            AppConfig.log(2, `🔧 TOOLS: Tutti i tool disattivati per nuovo tutorial`);
        }

        // RESET: Ferma eventuali animazioni cursore in corso
        if (window.Scene3D && window.Scene3D.stopCursorAnimation) {
            window.Scene3D.stopCursorAnimation();
        }

        // RESET: Rimuovi classi cursori personalizzati dal body
        document.body.classList.remove(
            'tool-aria-active',
            'tool-chiave_inglese-active',
            'tool-brugola-active',
            'tool-mano-active',
            'cursor-frame-1',
            'cursor-frame-2'
        );
        AppConfig.log(3, `🖱️ CURSOR: Ripristinato cursore di default`);

        this.currentTutorial = this.availableTutorials[tutorialIndex];
        this.tutorialSteps = this.currentTutorial.steps;
        this.currentStepIndex = 0;

        AppConfig.log(2, `Tutorial selezionato: ${this.currentTutorial.name} (${this.tutorialSteps.length} step)`);

        // ═══════════════════════════════════════════════════════════════
        // STEP GATING: Registra configurazioni gating per ogni step
        // ═══════════════════════════════════════════════════════════════
        if (window.StepGatingManager) {
            window.StepGatingManager.reset(); // Reset configurazioni precedenti

            this.tutorialSteps.forEach((step, index) => {
                const props = step.properties || {};
                const gatingConfig = {
                    stepTitle: step.title,
                    activeButtons: [],
                    enabledTools: [],
                    cameraUnlocked: false,
                    cameraLimits: null
                };

                // Parse ActiveButtons (comma-separated list)
                if (props.ActiveButtons) {
                    const cleanValue = props.ActiveButtons.split('#')[0].trim();
                    gatingConfig.activeButtons = cleanValue.split(',').map(b => b.trim()).filter(b => b);
                }

                // Parse EnabledTools (comma-separated list)
                if (props.EnabledTools) {
                    const cleanValue = props.EnabledTools.split('#')[0].trim();
                    gatingConfig.enabledTools = cleanValue.split(',').map(t => t.trim()).filter(t => t);
                }

                // Parse CameraUnlocked (boolean)
                if (props.CameraUnlocked) {
                    // Rimuovi commenti inline con # (come per CameraLimits)
                    const cleanValue = props.CameraUnlocked.split('#')[0].trim().toLowerCase();
                    gatingConfig.cameraUnlocked = cleanValue === 'true';
                    console.log(`📷 [Gating] Step ${index} CameraUnlocked raw="${props.CameraUnlocked}" clean="${cleanValue}" → ${gatingConfig.cameraUnlocked}`);
                }

                // Parse CameraLimits (minPhi,maxPhi) o (minPhi,maxPhi,minTheta,maxTheta)
                if (props.CameraLimits) {
                    const cleanValue = props.CameraLimits.split('#')[0].trim();
                    // Rimuovi parentesi se presenti
                    const valuesStr = cleanValue.replace(/[()]/g, '');
                    const values = valuesStr.split(',').map(v => parseFloat(v.trim()));

                    if (values.length >= 2) {
                        gatingConfig.cameraLimits = {
                            minPhi: values[0],
                            maxPhi: values[1],
                            minTheta: values[2] !== undefined ? values[2] : -Infinity,
                            maxTheta: values[3] !== undefined ? values[3] : Infinity
                        };
                    }
                }

                // Registra solo se ci sono configurazioni specifiche
                if (gatingConfig.activeButtons.length > 0 ||
                    gatingConfig.enabledTools.length > 0 ||
                    gatingConfig.cameraUnlocked ||
                    gatingConfig.cameraLimits) {
                    window.StepGatingManager.registerStepConfig(index, gatingConfig);
                }
            });

            AppConfig.log(2, `🚦 Step Gating: ${window.StepGatingManager.stepConfigs.size} configurazioni registrate`);
        }
        
        // NON applicare le impostazioni camera del tutorial qui - rimani sulla posizione dello scenario
        // Le impostazioni camera del tutorial verranno applicate quando parte il primo step
        
        // Aggiorna la UI - ora che il tutorial è attivato, mostra il primo step
        this.updateTutorialButtonsState(tutorialIndex);
        this.updateStepSpeechBubble();
        
        // Evidenzia il primo elemento del tutorial appena selezionato
        setTimeout(async () => {
            console.log('🚀 Tutorial avviato dall\'utente - evidenzio primo elemento');

            // ADESSO applica le impostazioni camera del tutorial (quando parte il primo step)
            this.applyTutorialCameraSettings();

            // Applica anche le impostazioni modelli del tutorial
            this.applyTutorialModelSettings();

            if (window.Scene3D && window.Scene3D.highlightCurrentTutorialElement) {
                window.Scene3D.highlightCurrentTutorialElement();
            }

            // NUOVO: Esegui automaticamente il primo step per attivare le sue direttive
            if (this.tutorialSteps && this.tutorialSteps.length > 0) {
                AppConfig.log(2, `🎯 AUTO-EXEC: Esecuzione automatica Step 1`);
                await this.executeStep(this.tutorialSteps[0]);
            }
        }, 200); // Piccolo delay per assicurarsi che la scena sia pronta
    },
    
    /**
     * Applica impostazioni camera iniziali dal primo tutorial disponibile
     */
    applyInitialCameraSettings: function(tutorial) {
        if (!tutorial || !tutorial.properties) {
            return;
        }
        
        const props = tutorial.properties;
        let hasCameraSettings = false;
        
        // Crea oggetto tutorial fake per riusare la funzione esistente di Scene3D
        const fakeTutorialStep = {
            properties: {}
        };
        
        // Copia le proprietà camera se presenti
        if (props.CameraPos) {
            fakeTutorialStep.properties.CameraPos = props.CameraPos;
            hasCameraSettings = true;
            AppConfig.log(2, `📹 CAMERA INIZIALE: CameraPos = ${props.CameraPos}`);
        }
        
        if (props.CameraTarget) {
            fakeTutorialStep.properties.CameraTarget = props.CameraTarget;
            hasCameraSettings = true;
            AppConfig.log(2, `📹 CAMERA INIZIALE: CameraTarget = ${props.CameraTarget}`);
        }
        
        if (props.CameraZoom) {
            fakeTutorialStep.properties.CameraZoom = props.CameraZoom;
            hasCameraSettings = true;
            AppConfig.log(2, `📹 CAMERA INIZIALE: CameraZoom = ${props.CameraZoom}`);
        }
        
        if (props.CameraTransitionTime) {
            fakeTutorialStep.properties.CameraTransitionTime = props.CameraTransitionTime;
            hasCameraSettings = true;
        } else {
            fakeTutorialStep.properties.CameraTransitionTime = '2.0';
        }
        
        // Applica impostazioni tramite Scene3D
        if (hasCameraSettings && window.Scene3D && window.Scene3D.applyCameraSettings) {
            AppConfig.log(2, `📹 CAMERA INIZIALE: Applicazione impostazioni camera da "${tutorial.name}"`);
            window.Scene3D.applyCameraSettings(fakeTutorialStep);
        } else if (hasCameraSettings) {
            AppConfig.log(1, `⚠️ CAMERA INIZIALE: Scene3D non disponibile per applicare impostazioni camera`);
        }
        
        // Copia le proprietà modelli se presenti per applicarle insieme alle camera settings
        let hasModelSettings = false;
        
        if (props.Posizione) {
            fakeTutorialStep.properties.Posizione = props.Posizione;
            hasModelSettings = true;
            AppConfig.log(2, `🔧 MODELLI INIZIALI: Posizione = ${props.Posizione}`);
        }
        
        if (props.Rotazione) {
            fakeTutorialStep.properties.Rotazione = props.Rotazione;
            hasModelSettings = true;
            AppConfig.log(2, `🔧 MODELLI INIZIALI: Rotazione = ${props.Rotazione}`);
        }
        
        // Supporto per sintassi legacy Modello1/Posizione1
        if (props.Modello1) {
            fakeTutorialStep.properties.Modello1 = props.Modello1;
            hasModelSettings = true;
            AppConfig.log(2, `🔧 MODELLI INIZIALI: Modello1 = ${props.Modello1}`);
        }
        
        if (props.Posizione1) {
            fakeTutorialStep.properties.Posizione1 = props.Posizione1;
            hasModelSettings = true;
            AppConfig.log(2, `🔧 MODELLI INIZIALI: Posizione1 = ${props.Posizione1}`);
        }
        
        // Applica impostazioni modelli se presenti
        if (hasModelSettings && window.Scene3D && window.Scene3D.applyModelSettings) {
            AppConfig.log(2, `🔧 MODELLI INIZIALI: Applicazione impostazioni modelli da "${tutorial.name}"`);
            window.Scene3D.applyModelSettings(fakeTutorialStep);
        } else if (hasModelSettings) {
            AppConfig.log(1, `⚠️ MODELLI INIZIALI: Scene3D non disponibile per applicare impostazioni modelli`);
        }
    },

    /**
     * Applica impostazioni camera globali del tutorial corrente
     */
    applyTutorialCameraSettings: function() {
        if (!this.currentTutorial || !this.currentTutorial.properties) {
            return;
        }
        
        const props = this.currentTutorial.properties;
        let hasCameraSettings = false;
        
        // Crea oggetto tutorial fake per riusare la funzione esistente di Scene3D
        const fakeTutorialStep = {
            properties: {}
        };
        
        // Copia le proprietà camera se presenti
        if (props.CameraPos) {
            fakeTutorialStep.properties.CameraPos = props.CameraPos;
            hasCameraSettings = true;
            console.log(`📹 TUTORIAL: CameraPos globale = ${props.CameraPos}`);
        }
        
        if (props.CameraTarget) {
            fakeTutorialStep.properties.CameraTarget = props.CameraTarget;
            hasCameraSettings = true;
            console.log(`📹 TUTORIAL: CameraTarget globale = ${props.CameraTarget}`);
        }
        
        if (props.CameraZoom) {
            fakeTutorialStep.properties.CameraZoom = props.CameraZoom;
            hasCameraSettings = true;
            console.log(`📹 TUTORIAL: CameraZoom globale = ${props.CameraZoom}`);
        }
        
        if (props.CameraTransitionTime) {
            fakeTutorialStep.properties.CameraTransitionTime = props.CameraTransitionTime;
            hasCameraSettings = true;
        } else {
            // Default più veloce per impostazione iniziale
            fakeTutorialStep.properties.CameraTransitionTime = '2.0';
        }
        
        // Se ci sono impostazioni camera, applicale tramite Scene3D
        if (hasCameraSettings && window.Scene3D && window.Scene3D.applyCameraSettings) {
            console.log(`📹 TUTORIAL: Applicazione impostazioni camera globali per "${this.currentTutorial.name}"`);
            window.Scene3D.applyCameraSettings(fakeTutorialStep);
        }
        
        // Applica impostazioni modelli se presenti
        if (window.Scene3D && window.Scene3D.applyModelSettings) {
            window.Scene3D.applyModelSettings(fakeTutorialStep);
        }
    },
    
    /**
     * Applica impostazioni modelli dal tutorial corrente
     */
    applyTutorialModelSettings: function() {
        if (!this.currentTutorial || !this.currentTutorial.properties) {
            return;
        }
        
        const props = this.currentTutorial.properties;
        let hasModelSettings = false;
        
        // Crea oggetto tutorial fake per riusare la funzione esistente di Scene3D
        const fakeTutorialStep = {
            properties: {}
        };
        
        // Copia le proprietà modelli se presenti
        if (props.Posizione) {
            fakeTutorialStep.properties.Posizione = props.Posizione;
            hasModelSettings = true;
            console.log(`🔧 TUTORIAL: Posizione globale = ${props.Posizione}`);
        }
        
        if (props.Rotazione) {
            fakeTutorialStep.properties.Rotazione = props.Rotazione;
            hasModelSettings = true;
            console.log(`🔧 TUTORIAL: Rotazione globale = ${props.Rotazione}`);
        }
        
        // Supporto per sintassi legacy Modello1/Posizione1
        if (props.Modello1) {
            fakeTutorialStep.properties.Modello1 = props.Modello1;
            hasModelSettings = true;
            console.log(`🔧 TUTORIAL: Modello1 = ${props.Modello1}`);
        }
        
        if (props.Posizione1) {
            fakeTutorialStep.properties.Posizione1 = props.Posizione1;
            hasModelSettings = true;
            console.log(`🔧 TUTORIAL: Posizione1 = ${props.Posizione1}`);
        }
        
        // Se ci sono impostazioni modelli, applicale tramite Scene3D
        if (hasModelSettings && window.Scene3D && window.Scene3D.applyModelSettings) {
            console.log(`🔧 TUTORIAL: Applicazione impostazioni modelli globali per "${this.currentTutorial.name}"`);
            window.Scene3D.applyModelSettings(fakeTutorialStep);
        }
    },
    
    /**
     * Crea i pulsanti della barra tutorial (ora per tutorial principali)
     */
    createTutorialStepsBar: function() {
        const container = document.getElementById('tutorialStepsContainer');
        if (!container) return;
        
        container.innerHTML = '';
        
        // Ora creiamo pulsanti per i tutorial principali, non per gli step individuali
        this.availableTutorials.forEach((tutorial, index) => {
            // Contenitore tutorial
            const tutorialDiv = document.createElement('div');
            tutorialDiv.className = 'tutorial-step';
            
            // Pulsante del tutorial
            const tutorialBtn = document.createElement('div');
            tutorialBtn.className = 'tutorial-arrow-btn';
            tutorialBtn.onclick = () => {
                console.log(`🔥 CLICK TUTORIAL BUTTON: index=${index}, name="${tutorial.name}"`);

                // ⚠️ NON riselezionare se è già il tutorial attivo (evita di farlo ripartire)
                if (this.currentTutorial && this.currentTutorial.name === tutorial.name) {
                    console.log(`⚠️ Tutorial "${tutorial.name}" già attivo - click ignorato`);
                    return;
                }

                this.selectTutorial(index);
                this.updateTutorialButtonsState(index);
                console.log(`🔥 Tutorial button state updated for index: ${index}`);
            };
            
            // Applica classi speciali per forma
            if (this.availableTutorials.length === 1) {
                tutorialBtn.classList.add('single');
            } else {
                if (index === 0) {
                    tutorialBtn.classList.add('first');
                }
                if (index === this.availableTutorials.length - 1) {
                    tutorialBtn.classList.add('last');
                }
            }
            
            // Se è il tutorial attualmente selezionato, evidenzialo
            if (this.currentTutorial && this.currentTutorial.name === tutorial.name) {
                tutorialBtn.classList.add('active');
            }
            
            // Testo del pulsante (nome del tutorial)
            const tutorialText = document.createElement('div');
            tutorialText.className = 'tutorial-arrow-text';
            tutorialText.textContent = tutorial.name;
            
            // Assembla elementi (nessun numero step)
            tutorialBtn.appendChild(tutorialText);
            tutorialDiv.appendChild(tutorialBtn);
            container.appendChild(tutorialDiv);
            
            // Aggiunge separatore se non è l'ultimo
            if (index < this.availableTutorials.length - 1) {
                const separator = document.createElement('div');
                separator.className = 'tutorial-separator';
                container.appendChild(separator);
            }
        });
        
        // Aggiorna il fumetto se già creato
        this.updateStepSpeechBubble();

        // Aggiusta posizionamento barra su mobile in base al numero di righe
        this.adjustTutorialBarPositionMobile();
    },

    /**
     * Aggiusta posizionamento barra tutorial su mobile
     * Calcola dinamicamente la posizione in base al numero di righe
     * La barra viene spostata più in alto se ha più righe
     */
    adjustTutorialBarPositionMobile: function() {
        // Solo su mobile (max-width: 768px)
        if (window.innerWidth > 768) return;

        const bar = document.getElementById('tutorialStepsBar');
        const container = document.getElementById('tutorialStepsContainer');

        if (!bar || !container) return;

        // Attendi che il layout sia completato
        setTimeout(() => {
            // Calcola l'altezza effettiva del container (che contiene i pulsanti su più righe)
            const containerHeight = container.offsetHeight;
            const barPadding = 10; // padding della barra (da CSS)

            // Calcola quante righe ci sono approssimativamente
            // Assumiamo altezza riga circa 40px (pulsante + gap)
            const estimatedRowHeight = 40;
            const numberOfRows = Math.ceil(containerHeight / estimatedRowHeight);

            // Più righe = barra più in alto
            // Riga singola: bottom = 10px
            // 2 righe: bottom = 10 + 50 = 60px
            // 3 righe: bottom = 10 + 100 = 110px
            const baseBottom = 10;
            const additionalBottomPerRow = 50; // Sposta 50px in alto per ogni riga extra oltre la prima
            const bottomPosition = baseBottom + ((numberOfRows - 1) * additionalBottomPerRow);

            // Applica il nuovo bottom
            bar.style.bottom = `${bottomPosition}px`;

            AppConfig.log(2, `[UI] 📱 Barra tutorial mobile: ${numberOfRows} righe, altezza=${containerHeight}px, bottom=${bottomPosition}px`);
        }, 100); // Piccolo delay per assicurarsi che il render sia completo
    },

    /**
     * Mostra la barra tutorial
     */
    showTutorialStepsBar: function() {
        const bar = document.getElementById('tutorialStepsBar');
        if (bar) {
            bar.classList.remove('hidden');
        }
    },
    
    /**
     * Nasconde la barra tutorial
     */
    hideTutorialStepsBar: function() {
        const bar = document.getElementById('tutorialStepsBar');
        if (bar) {
            bar.classList.add('hidden');
        }
    },
    
    /**
     * Aggiorna lo stato dei pulsanti tutorial (logica radio button)
     * Solo il pulsante selezionato è attivo (verde), gli altri sono inattivi (azzurro)
     */
    updateTutorialButtonsState: function(activeIndex) {
        // Trova tutti i pulsanti tutorial
        const allButtons = document.querySelectorAll('.tutorial-arrow-btn');

        console.log(`🔥 updateTutorialButtonsState: activeIndex=${activeIndex}, totalButtons=${allButtons.length}`);

        allButtons.forEach((button, index) => {
            // Rimuovi tutti gli stati
            button.classList.remove('active');

            // Aggiungi 'active' solo al pulsante selezionato
            if (index === activeIndex) {
                button.classList.add('active');
                console.log(`🔥 Button ${index} set to ACTIVE (green)`);
            } else {
                console.log(`🔥 Button ${index} set to INACTIVE (blue)`);
            }
        });

        AppConfig.log(2, `Tutorial ${activeIndex + 1} attivato (comportamento radio button)`);
    },
    
    /**
     * Va a uno step specifico
     */
    goToStep: async function(stepIndex) {
        console.log(`[DEBUG] ⏭️ GOTO STEP chiamata con index: ${stepIndex}`);
        if (stepIndex < 0 || stepIndex >= this.tutorialSteps.length) {
            AppConfig.log(1, `Step index non valido: ${stepIndex}`);
            return;
        }

        // Guard contro chiamate concorrenti: se stiamo già navigando,
        // cancella la navigazione precedente e procedi con la nuova
        if (this.isNavigating) {
            console.log(`[UI] ⚠️ goToStep(${stepIndex}) interrompe navigazione precedente in corso (currentStep=${this.currentStepIndex})`);
            // Chiudi modal se aperto (potrebbe bloccare la navigazione precedente)
            this.hideInfoModal();
        }
        this.isNavigating = true;

        // IMPORTANTE: Cancella timeout auto-avanzamento pendente dallo step precedente
        // Questo previene il bug dove step vengono saltati quando:
        // 1. Step N con AutoAdvance schedula nextStep() con 200ms delay
        // 2. Un trigger/azione fa avanzare a Step N+1 prima che scadano i 200ms
        // 3. Quando scade il timeout, nextStep() salta a N+2 (saltando N+1)
        if (this.autoAdvanceTimeoutId) {
            console.log(`[UI] 🚫 Cancellato timeout auto-avanzamento pendente`);
            clearTimeout(this.autoAdvanceTimeoutId);
            this.autoAdvanceTimeoutId = null;
        }

        // IMPORTANTE: Cancella anche l'interval di polling AutoExecute
        // Questo previene che il polling del vecchio step scheduli un nextStep()
        if (this.autoExecuteIntervalId) {
            console.log(`[UI] 🚫 Cancellato polling AutoExecute dello step precedente`);
            clearInterval(this.autoExecuteIntervalId);
            this.autoExecuteIntervalId = null;
        }

        this.currentStepIndex = stepIndex;
        const step = this.tutorialSteps[stepIndex];

        console.log(`[DEBUG] ⏭️ Navigazione a step: "${step.title}"`);
        AppConfig.log(2, `Navigazione a step ${stepIndex + 1}: ${step.title}`);

        // IMPORTANTE: Reset silhouette/highlight da step precedente
        this.resetAllHighlights();

        // IMPORTANTE: Reset stato touch drag (cancella selezione + rimuovi ghost)
        // Previene ghost mesh residue che intercettano raycast nello step successivo
        if (window.TouchDragHandler && window.TouchDragHandler.interactionState.mode !== 'idle') {
            console.log('[UI] 🔄 Reset TouchDragHandler al cambio step');
            window.TouchDragHandler.cancelSelection();
        }

        // Mobile Optimizer: Lazy loading modelli per step corrente
        if (window.MobileOptimizer && window.MobileOptimizer.enabled) {
            window.MobileOptimizer.loadModelsForStep(stepIndex, this.tutorialSteps);
        }

        // Aggiorna fumetto PRIMA di eseguire lo step (così è visibile durante modal)
        this.updateStepSpeechBubble();

        // I pulsanti tutorial mantengono il loro stato radio button
        // Non c'è bisogno di aggiornarli per ogni step

        // Esegue l'azione del tutorial step (ora async per gestire modal)
        try {
            await this.executeStep(step);
        } catch (error) {
            console.error(`[UI] ❌ Errore durante esecuzione step "${step.title}":`, error);
        }

        // Aggiorna status
        this.updateStatus(`Step ${stepIndex + 1}/${this.tutorialSteps.length}: ${step.title}`);
        this.isNavigating = false;
    },

    /**
     * Reset di tutte le silhouette/highlight applicati agli oggetti
     * Chiamato quando si cambia step o tutorial
     */
    resetAllHighlights: function() {
        if (!window.Scene3D || !window.Scene3D.scene) return;

        console.log('[UI] 🧹 Reset silhouette/highlight da tutti gli oggetti');

        // 1. Rimuovi evidenziazione modello corrente (Scene3D)
        if (window.Scene3D.removeHighlight) {
            window.Scene3D.removeHighlight();
            console.log('[UI] 🧹 Rimossa evidenziazione modello corrente');
        }

        // 2. Rimuovi evidenziazioni pulsanti (InteractiveObject3D)
        if (window.InteractiveObject3D && window.InteractiveObject3D.clearButtonHighlights) {
            window.InteractiveObject3D.clearButtonHighlights();
            console.log('[UI] 🧹 Rimosse evidenziazioni pulsanti');
        }

        // 2b. Rimuovi cerchi evidenziazione DragDrop
        if (window.Scene3D && window.Scene3D.highlightCircleManager) {
            window.Scene3D.highlightCircleManager.clearAllCircles();
            console.log('[UI] 🧹 Rimossi cerchi evidenziazione DragDrop');
        }

        // 3. Ripristina materiali DragDropSystem
        window.Scene3D.scene.traverse((object) => {
            if (object.isMesh) {
                // Ripristina materiale originale se salvato in DragDropSystem
                if (window.DragDropSystem && window.DragDropSystem.originalMaterialsMap) {
                    // Trova il modello root (parent con userData.originalFilename)
                    let rootModel = object;
                    while (rootModel.parent && !rootModel.userData.originalFilename) {
                        rootModel = rootModel.parent;
                    }

                    if (rootModel && window.DragDropSystem.originalMaterialsMap.has(rootModel.uuid)) {
                        const originalMaterials = window.DragDropSystem.originalMaterialsMap.get(rootModel.uuid);
                        if (originalMaterials.has(object.uuid)) {
                            object.material = originalMaterials.get(object.uuid);
                            object.renderOrder = 0;
                        }
                    }
                }
            }
        });

        // Pulisci la mappa dei materiali originali per evitare leak di memoria
        if (window.DragDropSystem && window.DragDropSystem.originalMaterialsMap) {
            window.DragDropSystem.originalMaterialsMap.clear();
        }

        AppConfig.log(3, '🧹 Reset highlight completato - tutti i sistemi puliti');
    },

    /* La funzione updateStepStates è stata rimossa perché ora i pulsanti
     * rappresentano tutorial (non step) e usano logica radio button */

    /**
     * Esegue un step del tutorial
     */
    executeStep: async function(step) {
        console.log(`[DEBUG] 🚀 EXECUTE STEP chiamata per: "${step.title}"`);
        console.log(`[DEBUG] 🚀 Step properties:`, step.properties);
        AppConfig.log(2, `Esecuzione step: ${step.title}`, step.properties);

        // Cattura l'indice corrente per rilevare navigazione concorrente durante await
        const expectedStepIndex = this.currentStepIndex;

        // ═══════════════════════════════════════════════════════════════
        // AUTOACTION: Flag locale per esecuzione automatica completa
        // NOTA: NON mutare step.properties per evitare effetti collaterali
        // su re-esecuzione o jumpToStep. Usa variabili locali.
        // ═══════════════════════════════════════════════════════════════
        const isAutoactionStep = step.properties.Autoaction === 'true';
        // Determina se AutoExecute/AutoAdvance sono attivi (da proprietà o da Autoaction)
        const effectiveAutoExecute = step.properties.AutoExecute === 'true' || isAutoactionStep;
        const effectiveAutoAdvance = step.properties.AutoAdvance === 'true' || isAutoactionStep;

        if (isAutoactionStep) {
            console.log(`[UI] 🤖 Autoaction attivo per step: "${step.title}" — esecuzione completamente automatica`);

            // Equipaggia automaticamente l'utensile richiesto
            if (step.properties.Utensile) {
                if (window.ToolsManager && typeof window.ToolsManager.activateToolFromTutorial === 'function') {
                    window.ToolsManager.activateToolFromTutorial(step.properties.Utensile);
                    console.log(`[UI] 🔧 Autoaction: Utensile "${step.properties.Utensile}" equipaggiato automaticamente`);
                }
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // RESET: Pulisci posizione camera precedente
        // ═══════════════════════════════════════════════════════════════
        this.stepCameraState = null;
        this.hideResetCameraButton();
        console.log('📷 [UI] Reset stepCameraState per nuovo step');

        // ═══════════════════════════════════════════════════════════════
        // STEP CONTROLLER: Notifica cambio step corrente
        // ═══════════════════════════════════════════════════════════════
        if (window.StepController) {
            window.StepController.setCurrentStep(this.currentStepIndex, step);
        }

        // ═══════════════════════════════════════════════════════════════
        // STEP GATING MANAGER: Notifica cambio step per gating pulsanti/camera
        // ═══════════════════════════════════════════════════════════════
        if (window.StepGatingManager) {
            window.StepGatingManager.setStep(this.currentStepIndex, step.title);
        }

        // ═══════════════════════════════════════════════════════════════
        // INTERACTIVE OBJECT 3D: Evidenziazione pulsanti richiesti
        // ═══════════════════════════════════════════════════════════════
        if (window.InteractiveObject3D) {
            // Pulisci evidenziazioni precedenti
            window.InteractiveObject3D.clearButtonHighlights();

            // Evidenzia pulsanti richiesti da questo step (se presenti)
            if (step.properties.AcceptTrigger_Physical) {
                const triggers = step.properties.AcceptTrigger_Physical.split(',').map(t => t.trim());

                // Parsing HighlightOpacity (default: 0.5 = semitrasparente bilanciato)
                let highlightOpacity = 0.5;
                if (step.properties.HighlightOpacity) {
                    const parsed = parseFloat(step.properties.HighlightOpacity);
                    if (!isNaN(parsed) && parsed >= 0 && parsed <= 1.0) {
                        highlightOpacity = parsed;
                        console.log(`💡 [UI] HighlightOpacity personalizzata: ${highlightOpacity}`);
                    } else {
                        console.warn(`⚠️ [UI] HighlightOpacity non valida (${step.properties.HighlightOpacity}), uso default 0.5`);
                    }
                }

                window.InteractiveObject3D.highlightRequiredButtons(triggers, highlightOpacity);
                console.log(`💡 [UI] Evidenziati ${triggers.length} pulsanti richiesti per step "${step.title}" con opacità ${highlightOpacity}`);
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // TOOLS MANAGER: Pulizia + evidenziazione tool richiesto
        // IMPORTANTE: Fatto PRIMA del modal per garantire visibilità immediata
        // ═══════════════════════════════════════════════════════════════
        if (window.ToolsManager && typeof window.ToolsManager.clearToolHighlights === 'function') {
            window.ToolsManager.clearToolHighlights();
        }

        if (step.properties.Utensile) {
            // Evidenzia automaticamente il tool richiesto nella legenda
            const toolName = this.mapToolName(step.properties.Utensile);
            if (toolName) {
                AppConfig.log(3, `Strumento richiesto per step: ${toolName} - evidenziazione attiva`);

                // Evidenzia tool nella legenda con animazione pulse
                if (window.ToolsManager && typeof window.ToolsManager.highlightRequiredTool === 'function') {
                    window.ToolsManager.highlightRequiredTool(toolName);
                } else {
                    this.highlightRequiredTool(toolName); // Fallback a metodo UI locale
                }
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // CAMERA SETTINGS: Applicazione PRIMA del modal per posizionamento immediato
        // ═══════════════════════════════════════════════════════════════
        if (window.Scene3D && window.Scene3D.applyCameraSettings) {
            window.Scene3D.applyCameraSettings(step);
        }

        // Mostra modal informativo se presente parametro Message
        if (step.properties.Message) {
            const messageTitle = step.properties.MessageTitle || step.title || 'Informazione';
            AppConfig.log(2, `[UI] Mostrando modal informativo per step: ${step.title}`);

            // Prepara opzioni media (immagine o video)
            const mediaOptions = {};
            if (step.properties.MessageImage) {
                mediaOptions.image = step.properties.MessageImage;
                AppConfig.log(3, `[UI] Modal con immagine: ${mediaOptions.image}`);
            }
            if (step.properties.MessageVideo) {
                mediaOptions.video = step.properties.MessageVideo;
                AppConfig.log(3, `[UI] Modal con video: ${mediaOptions.video}`);
            }

            // Attendi che l'utente chiuda il modal prima di continuare
            console.log(`[DEBUG] 📋 MODAL: Attendo chiusura modal per step "${step.title}" (DragDrop=${step.properties.DragDrop}, isNavigating=${this.isNavigating}, _infoModalResolve=${!!this._infoModalResolve})`);
            await this.showInfoModal(step.properties.Message, messageTitle, mediaOptions);
            console.log(`[DEBUG] ✅ MODAL: Modal chiuso per step "${step.title}" - proseguo con esecuzione`);
            AppConfig.log(2, `[UI] Modal informativo chiuso`);

            // GUARD: controlla se la navigazione è cambiata mentre il modal era aperto
            // (es. l'utente ha cliccato → durante la visualizzazione del video)
            if (this.currentStepIndex !== expectedStepIndex) {
                console.warn(`[UI] ⚠️ Step cambiato durante modal (era ${expectedStepIndex}, ora ${this.currentStepIndex}) - interruzione executeStep per "${step.title}"`);
                return;
            }

            // Controlla se questo step ha SOLO il messaggio (nessuna altra azione)
            const hasOnlyMessage = !step.properties.Elemento &&
                                   !step.properties.AssemblyMode &&
                                   !step.properties.DragDrop;

            console.log(`[DEBUG] 📋 hasOnlyMessage=${hasOnlyMessage} (Elemento=${!!step.properties.Elemento}, AssemblyMode=${!!step.properties.AssemblyMode}, DragDrop=${step.properties.DragDrop})`);

            if (hasOnlyMessage) {
                AppConfig.log(2, `[UI] Step puramente informativo (solo Message) - nessuna azione successiva`);

                // Se AutoExecute=true, avanza automaticamente dopo chiusura modal
                if (effectiveAutoExecute) {
                    console.log(`[UI] ⏭️ Message-only + AutoExecute → avanzo automaticamente`);
                    setTimeout(() => this.nextStep(), 300);
                }

                return; // Esci dalla funzione, non eseguire altre azioni
            }

            // Se arriviamo qui, lo step ha Message + altre azioni (DragDrop, Elemento, AssemblyMode)
            // Continuiamo l'esecuzione per abilitare queste funzionalità
            AppConfig.log(2, `[UI] Modal chiuso - continuo esecuzione step con azioni aggiuntive`);
        }

        // IMPORTANTE: Questo codice viene eseguito anche per step con Message + DragDrop/Elemento/AssemblyMode
        // NOTA: Camera settings e tool highlight sono già stati applicati PRIMA del modal (vedi sopra)
        
        // Applica impostazioni modelli se presenti
        if (window.Scene3D && window.Scene3D.applyModelSettings) {
            window.Scene3D.applyModelSettings(step);
        }

        // ═══════════════════════════════════════════════════════════════════════
        // SCREEN SYSTEM: Gestione modalità schermo interattivo
        // ═══════════════════════════════════════════════════════════════════════
        if (step.properties.ScreenMode === 'true' && window.ScreenSystem) {
            console.log(`📺 [UI] ScreenMode attivato per step: "${step.title}"`);

            // Determina quale schermo attivare
            let screenId = null;
            if (step.properties.Elemento) {
                // Estrai ID schermo dal nome modello
                const modelName = step.properties.Elemento.replace(/^models\//, '').replace(/\.(glb|obj|stl)$/, '');
                // Cerca schermo registrato che ha questo modello
                window.ScreenSystem.screens.forEach((config, id) => {
                    if (config.model && config.model.includes(modelName)) {
                        screenId = id;
                    }
                });

                // Se non trovato per modello, usa il nome del modello come ID
                if (!screenId) {
                    screenId = modelName;
                }
            }

            if (screenId) {
                // Attiva focus sullo schermo
                const viewId = step.properties.ScreenView || null;
                window.ScreenSystem.focusScreen(screenId, viewId);

                // Configura requisiti per completamento step
                const requiredHotspot = step.properties.RequiredHotspot || null;
                const requiredSequence = step.properties.RequiredSequence || null;
                window.ScreenSystem.configureStepRequirements(requiredHotspot, requiredSequence);

                AppConfig.log(2, `📺 SCREEN MODE: Schermo "${screenId}" in focus`);
            } else {
                console.warn(`[UI] ⚠️ ScreenMode attivo ma nessuno schermo trovato per step`);
            }
        } else if (window.ScreenSystem && window.ScreenSystem.enabled) {
            // Se ScreenMode non attivo in questo step ma era attivo prima, disattiva
            window.ScreenSystem.unfocusScreen();
        }

        // ═══════════════════════════════════════════════════════════════════════
        // HOLDABLE SYSTEM: Gestione oggetti prendibili in mano
        // ═══════════════════════════════════════════════════════════════════════
        if (window.HoldableSystem) {
            // PRIMA: Registra oggetto come holdable se Holdable=true
            if (step.properties.Holdable === 'true' || step.properties.Holdable === true) {
                let objectName = null;
                if (step.properties.Elemento) {
                    objectName = step.properties.Elemento.replace(/^models\//, '').replace(/\.(glb|obj|stl)$/, '');
                }

                if (objectName && !window.HoldableSystem.isHoldable(objectName)) {
                    console.log(`[UI] 📝 Registrazione oggetto "${objectName}" come holdable`);
                    window.HoldableSystem.registerHoldable(objectName, {
                        HoldPosition: step.properties.HoldPosition,
                        HoldRotation: step.properties.HoldRotation,
                        Model: step.properties.Elemento
                    });
                }
            }

            // Gestione azione pick/release
            // NOTA: HoldAction=pick NON viene eseguito automaticamente qui!
            // L'utente deve CLICCARE sull'oggetto evidenziato per prenderlo.
            // La logica del pick al click è in scene3d-modular.js handleModelAction
            if (step.properties.HoldAction) {
                const action = step.properties.HoldAction.toLowerCase();

                // Solo release viene eseguito automaticamente (per rilasciare oggetto)
                if (action === 'release') {
                    let objectName = null;
                    if (step.properties.Elemento) {
                        objectName = step.properties.Elemento.replace(/^models\//, '').replace(/\.(glb|obj|stl)$/, '');
                    }
                    if (objectName) {
                        console.log(`[UI] ✋ HoldAction=release per oggetto: "${objectName}"`);
                        window.HoldableSystem.releaseObject(objectName);
                    }
                } else if (action === 'pick') {
                    // pick NON automatico - aspetta click utente
                    console.log(`[UI] 🤚 HoldAction=pick configurato - in attesa click utente su elemento`);
                }
            }

            // Verifica stato richiesto (HoldState)
            if (step.properties.HoldState) {
                const requiredState = step.properties.HoldState.toLowerCase();
                let objectName = null;

                if (step.properties.Elemento) {
                    objectName = step.properties.Elemento.replace(/^models\//, '').replace(/\.(glb|obj|stl)$/, '');
                }

                if (objectName) {
                    const isCurrentlyHeld = window.HoldableSystem.isHeld(objectName);

                    if (requiredState === 'held' && !isCurrentlyHeld) {
                        console.warn(`[UI] ⚠️ HoldState=held richiesto ma "${objectName}" non è tenuto in mano`);
                    } else if (requiredState === 'released' && isCurrentlyHeld) {
                        console.warn(`[UI] ⚠️ HoldState=released richiesto ma "${objectName}" è ancora tenuto`);
                    } else {
                        AppConfig.log(3, `🤚 HoldState="${requiredState}" verificato per "${objectName}"`);
                    }
                }
            }
        }

        // NOTA: Tool highlighting per Utensile già applicato PRIMA del modal (vedi sopra)

        // NUOVO: Parsing slave objects (oggetti che seguono il master durante animazioni)
        // IMPORTANTE: Questo deve essere FUORI dal blocco DragDrop per funzionare anche con step normali
        if (step.properties.SlaveObjects) {
            // Rimuovi commenti prima del parsing
            const slaveObjectsClean = step.properties.SlaveObjects.split('#')[0].trim();
            const slaveObjectNames = slaveObjectsClean.split(',').map(s => s.trim()).filter(s => s.length > 0);

            if (slaveObjectNames.length > 0) {
                // Salva nella proprietà dello step per accesso successivo
                step.properties.SlaveObjectsList = slaveObjectNames;
                AppConfig.log(3, `🔗 SLAVE OBJECTS: Configurati ${slaveObjectNames.length} oggetti slave: [${slaveObjectNames.join(', ')}]`);
            } else {
                AppConfig.log(1, `⚠️ SLAVE OBJECTS: Nessun oggetto specificato in SlaveObjects`);
            }
        }

        // NUOVO: Parsing driven objects (oggetti con movimento indipendente sincronizzato)
        // Sintassi: DrivenObjects=oggetto1.glb,traslazione:(x,y,z,durata);oggetto2.glb,traslazione:(x,y,z,durata)
        // Backward compatible: DrivenObject=oggetto.glb,traslazione:(x,y,z,durata)
        if (step.properties.DrivenObjects || step.properties.DrivenObject) {
            const drivenObjectsArray = [];

            // Supporta sia DrivenObjects (multipli) che DrivenObject (singolo) per backward compatibility
            const drivenProperty = step.properties.DrivenObjects || step.properties.DrivenObject;
            const drivenObjectsClean = drivenProperty.split('#')[0].trim();

            console.log(`[UI] 🚗 Parsing DrivenObjects: "${drivenObjectsClean}"`);

            // Split per multipli oggetti separati da `;`
            const drivenEntries = drivenObjectsClean.split(';').map(entry => entry.trim()).filter(entry => entry.length > 0);

            drivenEntries.forEach(entry => {
                // Supporto "follow": oggetto.glb,follow (segue il master 1:1, equivale a SlaveObjects)
                const followMatch = entry.match(/^([^,]+),\s*follow\s*$/);
                if (followMatch) {
                    const objectName = followMatch[1].trim();
                    // Aggiungi come slave object (segue il master rigidamente)
                    if (!step.properties.SlaveObjectsList) {
                        step.properties.SlaveObjectsList = [];
                    }
                    step.properties.SlaveObjectsList.push(objectName);
                    console.log(`[UI] 🚗 DRIVEN OBJECT (follow/slave): "${objectName}" → segue il master 1:1`);
                    return;
                }

                // Parsing formato: oggetto.glb,traslazione:(x,y,z,durata)
                const match = entry.match(/^([^,]+),traslazione:\(([^,]+),([^,]+),([^,]+),([^)]+)\)$/);

                if (match) {
                    const objectName = match[1].trim();
                    const x = parseFloat(match[2].trim());
                    const y = parseFloat(match[3].trim());
                    const z = parseFloat(match[4].trim());
                    const duration = parseFloat(match[5].trim());

                    if (!isNaN(x) && !isNaN(y) && !isNaN(z) && !isNaN(duration)) {
                        drivenObjectsArray.push({
                            objectName: objectName,
                            translation: { x, y, z },
                            duration: duration
                        });

                        console.log(`[UI] 🚗 DRIVEN OBJECT ${drivenObjectsArray.length}: "${objectName}" → traslazione (${x}, ${y}, ${z}) in ${duration}s`);
                    } else {
                        AppConfig.log(1, `⚠️ DRIVEN OBJECT: Coordinate o durata non valide: ${entry}`);
                    }
                } else {
                    AppConfig.log(1, `⚠️ DRIVEN OBJECT: Formato non valido: ${entry} (usare formato: oggetto.glb,traslazione:(x,y,z,durata) oppure oggetto.glb,follow)`);
                }
            });

            // Salva array di driven objects (anche se singolo per backward compatibility)
            if (drivenObjectsArray.length > 0) {
                step.properties.DrivenObjectsConfig = drivenObjectsArray;
                AppConfig.log(3, `🚗 DRIVEN OBJECTS: Configurati ${drivenObjectsArray.length} oggetti con movimento indipendente`);
            }
        }

        // NUOVO: Gestione sistema Drag & Drop se abilitato nello step
        console.log(`[DEBUG] 🎯 DRAG & DROP CHECK: DragDrop="${step.properties.DragDrop}", DragDropSystem=${!!window.DragDropSystem}, AssemblySystem.enabled=${window.AssemblySystem?.enabled}`);
        if (step.properties.DragDrop === 'true' && window.DragDropSystem) {
            console.log(`[DEBUG] 🎯 DRAG & DROP: Processo abilitazione per step "${step.title}"`);
            AppConfig.log(2, `🎯 DRAG & DROP: Abilitato per step "${step.title}"`);

            // Auto-attiva lo strumento "Mano" per step DragDrop
            // Il DragDropSystem richiede che il tool "mano" sia attivo per permettere il drag
            if (window.ToolsManager && typeof window.ToolsManager.activateToolFromTutorial === 'function') {
                const requiredTool = step.properties.Utensile || 'Mani';
                window.ToolsManager.activateToolFromTutorial(requiredTool);
                AppConfig.log(3, `🎯 DRAG & DROP: Auto-attivato strumento "${requiredTool}" per drag & drop`);
            }

            // Configura oggetti draggabili se specificati
            const draggableObjects = [];
            if (step.properties.DragDropObjects) {
                // Rimuovi commenti prima del parsing
                const cleanValue = step.properties.DragDropObjects.split('#')[0].trim();
                const objects = cleanValue.split(',').map(obj => obj.trim()).filter(obj => obj.length > 0);
                draggableObjects.push(...objects);
                AppConfig.log(3, `🎯 DRAG & DROP: Oggetti draggabili: ${objects.join(', ')}`);
            } else if (step.properties.AllowedComponents) {
                // FALLBACK: Se non specificato DragDropObjects, usa AllowedComponents
                const cleanValue = step.properties.AllowedComponents.split('#')[0].trim();
                const objects = cleanValue.split(',').map(obj => obj.trim()).filter(obj => obj.length > 0);
                draggableObjects.push(...objects);
                AppConfig.log(3, `🎯 DRAG & DROP: Oggetti draggabili da AllowedComponents: ${objects.join(', ')}`);
            } else if (step.properties.Elemento) {
                // Se non specificato né DragDropObjects né AllowedComponents, usa l'elemento del tutorial
                const elementName = step.properties.Elemento.replace(/^models\//, '').replace(/\.(glb|obj|stl)$/, '');
                draggableObjects.push(elementName);
                AppConfig.log(3, `🎯 DRAG & DROP: Oggetto draggabile automatico: ${elementName}`);
            }

            // Configura distanza di snap se specificata
            if (step.properties.DragDropDistance) {
                const distance = parseFloat(step.properties.DragDropDistance);
                if (!isNaN(distance)) {
                    window.DragDropSystem.setSnapDistance(distance);
                    AppConfig.log(3, `🎯 DRAG & DROP: Distanza snap impostata: ${distance}`);
                }
            }

            // Pre-redirect: se SnapPoint usa sintassi unificata offset:/pivot:, popola le proprietà
            // legacy PRIMA che vengano processate nei blocchi successivi
            if (step.properties.SnapPoint && !step.properties.SnapOffset && !step.properties.SnapPointPivot) {
                const spClean = step.properties.SnapPoint.split('#')[0].trim();
                if (spClean.startsWith('offset:')) {
                    step.properties.SnapOffset = spClean.substring(7).trim();
                    console.log(`[UI] 📍 SnapPoint→SnapOffset pre-redirect: "${step.properties.SnapOffset}"`);
                } else if (spClean.startsWith('pivot:')) {
                    step.properties.SnapPointPivot = spClean.substring(6).trim();
                    console.log(`[UI] 📍 SnapPoint→SnapPointPivot pre-redirect: "${step.properties.SnapPointPivot}"`);
                }
            }

            // NUOVO: SnapOffset - calcola automaticamente posizione snap come "posizione originale + offset"
            // Sintassi: SnapOffset=(x,y,z) - applica offset a TUTTI gli oggetti draggabili
            if (step.properties.SnapOffset && draggableObjects.length > 0) {
                const offsetClean = step.properties.SnapOffset.split('#')[0].trim();
                const offsetMatch = offsetClean.match(/\(([^,]+),([^,]+),([^)]+)\)/);
                
                if (offsetMatch) {
                    const offsetX = parseFloat(offsetMatch[1].trim());
                    const offsetY = parseFloat(offsetMatch[2].trim());
                    const offsetZ = parseFloat(offsetMatch[3].trim());
                    
                    if (!isNaN(offsetX) && !isNaN(offsetY) && !isNaN(offsetZ)) {
                        console.log(`[UI] 📐 SnapOffset rilevato: (${offsetX}, ${offsetY}, ${offsetZ})`);
                        
                        // Per ogni oggetto draggabile, calcola snap point = posizione originale + offset
                        draggableObjects.forEach(objectName => {
                            const obj = window.Scene3D ? window.Scene3D.findModelByName(objectName) : null;
                            if (obj) {
                                // Ottieni posizione originale (centro bounding box)
                                let originalPos = null;
                                
                                // Prima controlla se già salvata in DragDropSystem
                                if (window.DragDropSystem && window.DragDropSystem.originalPositions.has(obj.uuid)) {
                                    originalPos = window.DragDropSystem.originalPositions.get(obj.uuid).clone();
                                } else {
                                    // Calcola dal bounding box corrente
                                    const boundingBox = new THREE.Box3().setFromObject(obj);
                                    originalPos = boundingBox.getCenter(new THREE.Vector3());
                                }
                                
                                if (originalPos) {
                                    // Calcola posizione snap = originale + offset
                                    const snapX = originalPos.x + offsetX;
                                    const snapY = originalPos.y + offsetY;
                                    const snapZ = originalPos.z + offsetZ;
                                    
                                    // Imposta come custom snap position (BB center) per questo oggetto
                                    // NOTA: usa setCustomSnapPosition (non Pivot) perché il target è calcolato
                                    // dal centro BB originale + offset, quindi la distanza va misurata dal centro BB
                                    window.DragDropSystem.setCustomSnapPosition(objectName, snapX, snapY, snapZ);
                                    
                                    console.log(`[UI] 📐 SnapOffset per "${objectName}": originale (${originalPos.x.toFixed(3)}, ${originalPos.y.toFixed(3)}, ${originalPos.z.toFixed(3)}) + offset → snap (${snapX.toFixed(3)}, ${snapY.toFixed(3)}, ${snapZ.toFixed(3)})`);
                                }
                            } else {
                                console.warn(`[UI] ⚠️ SnapOffset: Oggetto "${objectName}" non trovato nella scena`);
                            }
                        });
                        
                        AppConfig.log(2, `📐 DRAG & DROP: SnapOffset (${offsetX}, ${offsetY}, ${offsetZ}) applicato a ${draggableObjects.length} oggetti`);
                    } else {
                        AppConfig.log(1, `⚠️ DRAG & DROP: Coordinate SnapOffset non valide: ${offsetClean}`);
                    }
                } else {
                    AppConfig.log(1, `⚠️ DRAG & DROP: Formato SnapOffset non valido: ${offsetClean} (usare formato: (x,y,z))`);
                }
            }

            // NUOVO: Applica InitialOffset agli oggetti draggabili
            // Questo sposta le viti/componenti in una posizione iniziale offset
            // così l'utente deve trascinarle verso la posizione finale
            if (step.properties.InitialOffset && draggableObjects.length > 0) {
                const offsetClean = step.properties.InitialOffset.split('#')[0].trim();
                const offsetMatch = offsetClean.match(/\(([^,]+),([^,]+),([^)]+)\)/);
                
                if (offsetMatch) {
                    const offsetX = parseFloat(offsetMatch[1].trim());
                    const offsetY = parseFloat(offsetMatch[2].trim());
                    const offsetZ = parseFloat(offsetMatch[3].trim());
                    
                    if (!isNaN(offsetX) && !isNaN(offsetY) && !isNaN(offsetZ)) {
                        console.log(`[UI] 📐 InitialOffset rilevato: (${offsetX}, ${offsetY}, ${offsetZ})`);
                        
                        // Applica offset a tutti gli oggetti draggabili
                        draggableObjects.forEach(objectName => {
                            const obj = window.Scene3D ? window.Scene3D.findModelByName(objectName) : null;
                            if (obj) {
                                // Salva posizione originale PRIMA di applicare offset
                                // (se non già salvata)
                                if (window.DragDropSystem && !window.DragDropSystem.originalPositions.has(obj.uuid)) {
                                    const boundingBox = new THREE.Box3().setFromObject(obj);
                                    const originalCenter = boundingBox.getCenter(new THREE.Vector3());
                                    window.DragDropSystem.originalPositions.set(obj.uuid, originalCenter.clone());
                                    console.log(`[UI] 💾 Salvata posizione originale per "${objectName}": (${originalCenter.x.toFixed(3)}, ${originalCenter.y.toFixed(3)}, ${originalCenter.z.toFixed(3)})`);
                                }
                                
                                // Applica offset alla posizione corrente
                                obj.position.x += offsetX;
                                obj.position.y += offsetY;
                                obj.position.z += offsetZ;
                                
                                console.log(`[UI] 📐 Applicato InitialOffset a "${objectName}": nuova posizione (${obj.position.x.toFixed(3)}, ${obj.position.y.toFixed(3)}, ${obj.position.z.toFixed(3)})`);
                            } else {
                                console.warn(`[UI] ⚠️ InitialOffset: Oggetto "${objectName}" non trovato nella scena`);
                            }
                        });
                        
                        AppConfig.log(2, `📐 DRAG & DROP: InitialOffset (${offsetX}, ${offsetY}, ${offsetZ}) applicato a ${draggableObjects.length} oggetti`);
                    } else {
                        AppConfig.log(1, `⚠️ DRAG & DROP: Coordinate InitialOffset non valide: ${offsetClean}`);
                    }
                } else {
                    AppConfig.log(1, `⚠️ DRAG & DROP: Formato InitialOffset non valido: ${offsetClean} (usare formato: (x,y,z))`);
                }
            }

            // NUOVO: Configura punti di snap a coordinate arbitrarie
            // Supporta anche sintassi unificata:
            //   SnapPoint=pivot:(x,y,z)    → equivale a SnapPointPivot=(x,y,z)
            //   SnapPoint=offset:(x,y,z)   → equivale a SnapOffset=(x,y,z)
            if (step.properties.SnapPoint) {
                const snapPointClean = step.properties.SnapPoint.split('#')[0].trim();
                console.log(`[UI] 📍 Parsing SnapPoint: "${snapPointClean}"`);

                // Rileva sintassi unificata: pivot:(...) o offset:(...)
                if (snapPointClean.startsWith('pivot:')) {
                    // Redireziona a SnapPointPivot
                    const pivotValue = snapPointClean.substring(6).trim();
                    step.properties.SnapPointPivot = pivotValue;
                    console.log(`[UI] 📍 SnapPoint→SnapPointPivot redirect: "${pivotValue}"`);
                } else if (snapPointClean.startsWith('offset:')) {
                    // Redireziona a SnapOffset
                    const offsetValue = snapPointClean.substring(7).trim();
                    step.properties.SnapOffset = offsetValue;
                    console.log(`[UI] 📍 SnapPoint→SnapOffset redirect: "${offsetValue}"`);
                }

                // RILEVA FORMATO: se contiene ":" → formato vecchio (per-oggetto) O redirect già gestito, altrimenti formato nuovo (globale)
                // Escludi i redirect pivot:/offset: che sono già stati gestiti
                const isRedirected = snapPointClean.startsWith('pivot:') || snapPointClean.startsWith('offset:');
                const isGlobalFormat = !snapPointClean.includes(':');

                if (isRedirected) {
                    // Il valore è stato spostato in SnapPointPivot o SnapOffset, verranno processati sotto
                    console.log(`[UI] 📍 SnapPoint redirect completato, skip processing diretto`);
                } else if (isGlobalFormat) {
                    // FORMATO NUOVO (GLOBALE): (x,y,z),(x2,y2,z2),(x3,y3,z3)
                    // Applica questi punti a TUTTI gli oggetti in DragDropObjects
                    const globalPoints = [];

                    // Parsing coordinate multiple separate da virgola
                    const coordMatches = snapPointClean.matchAll(/\(([^,]+),([^,]+),([^)]+)\)/g);
                    for (const match of coordMatches) {
                        const x = parseFloat(match[1].trim());
                        const y = parseFloat(match[2].trim());
                        const z = parseFloat(match[3].trim());

                        if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                            globalPoints.push({ x, y, z });
                        }
                    }

                    if (globalPoints.length > 0 && draggableObjects.length > 0) {
                        console.log(`[UI] 📍 FORMATO GLOBALE: ${globalPoints.length} punti per ${draggableObjects.length} oggetti`);

                        // Crea nomi fittizi per i punti globali (snap_point_0, snap_point_1, etc)
                        const globalTargetNames = globalPoints.map((point, idx) => `snap_point_${idx}_original`);

                        // Applica gli stessi punti snap a tutti gli oggetti draggabili
                        draggableObjects.forEach(objectName => {
                            // Configura snap multipli usando target names fittizi
                            window.DragDropSystem.setMultipleSnapTargets(objectName, globalTargetNames);

                            // Crea riferimenti virtuali per ogni punto
                            globalPoints.forEach((point, idx) => {
                                const targetName = globalTargetNames[idx];
                                // Crea oggetto virtuale con posizione fissa
                                const virtualTarget = {
                                    isOriginalReference: true,
                                    originalModelName: targetName,
                                    position: new THREE.Vector3(point.x, point.y, point.z)
                                };

                                // Registra nel sistema come riferimento _original virtuale
                                if (!window.Scene3D.virtualSnapTargets) {
                                    window.Scene3D.virtualSnapTargets = new Map();
                                }
                                window.Scene3D.virtualSnapTargets.set(targetName, virtualTarget);
                            });

                            AppConfig.log(3, `🎯 DRAG & DROP: Snap points globali per "${objectName}" -> ${globalPoints.length} coordinate`);
                        });

                        console.log(`[UI] ✅ Punti snap globali applicati: ${globalPoints.map(p => `(${p.x},${p.y},${p.z})`).join(', ')}`);
                    } else {
                        AppConfig.log(1, `⚠️ DRAG & DROP: SnapPoint globali specificati ma nessun oggetto draggabile o coordinate valide`);
                    }
                } else {
                    // FORMATO VECCHIO (PER-OGGETTO): oggetto1:(x,y,z);oggetto2:(x2,y2,z2)
                    const snapDeclarations = snapPointClean.split(';').map(s => s.trim()).filter(s => s.length > 0);
                    console.log(`[UI] 📍 FORMATO PER-OGGETTO: ${snapDeclarations.length} dichiarazioni`);

                    snapDeclarations.forEach(declaration => {
                        const match = declaration.match(/^([^:]+):\(([^,]+),([^,]+),([^)]+)\)$/);
                        if (match) {
                            const objectName = match[1].trim();
                            const x = parseFloat(match[2].trim());
                            const y = parseFloat(match[3].trim());
                            const z = parseFloat(match[4].trim());

                            if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                                window.DragDropSystem.setCustomSnapPosition(objectName, x, y, z);
                                AppConfig.log(3, `🎯 DRAG & DROP: Snap point per "${objectName}" a (${x}, ${y}, ${z})`);
                            } else {
                                AppConfig.log(1, `⚠️ DRAG & DROP: Coordinate non valide in SnapPoint: ${declaration}`);
                            }
                        } else {
                            AppConfig.log(1, `⚠️ DRAG & DROP: Formato SnapPoint non valido: ${declaration}`);
                        }
                    });
                }
            }

            // NUOVO: Configura punti di snap a coordinate arbitrarie usando PIVOT (invece del centro BB)
            if (step.properties.SnapPointPivot) {
                const snapPointPivotClean = step.properties.SnapPointPivot.split('#')[0].trim();
                console.log(`[UI] 📍 Parsing SnapPointPivot: "${snapPointPivotClean}"`);

                // RILEVA FORMATO: se contiene ":" → formato vecchio (per-oggetto), altrimenti formato nuovo (globale)
                const isGlobalFormat = !snapPointPivotClean.includes(':');

                if (isGlobalFormat) {
                    // FORMATO NUOVO (GLOBALE): (x,y,z),(x2,y2,z2),(x3,y3,z3)
                    // Applica questi punti a TUTTI gli oggetti in DragDropObjects
                    const globalPoints = [];

                    // Parsing coordinate multiple separate da virgola
                    const coordMatches = snapPointPivotClean.matchAll(/\(([^,]+),([^,]+),([^)]+)\)/g);
                    for (const match of coordMatches) {
                        const x = parseFloat(match[1].trim());
                        const y = parseFloat(match[2].trim());
                        const z = parseFloat(match[3].trim());

                        if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                            globalPoints.push({ x, y, z });
                        }
                    }

                    if (globalPoints.length > 0 && draggableObjects.length > 0) {
                        console.log(`[UI] 📍 FORMATO GLOBALE PIVOT: ${globalPoints.length} punti per ${draggableObjects.length} oggetti`);

                        // Per SnapPointPivot globale, usa coordinate dirette con flag usePivot
                        // Applica il PRIMO punto come snap pivot per tutti gli oggetti
                        draggableObjects.forEach(objectName => {
                            // Se c'è un solo punto, usalo direttamente
                            if (globalPoints.length === 1) {
                                const point = globalPoints[0];
                                window.DragDropSystem.setCustomSnapPositionPivot(objectName, point.x, point.y, point.z);
                            } else {
                                // Se ci sono più punti, crea target virtuali con flag pivot
                                const globalTargetNames = globalPoints.map((point, idx) => `snap_pivot_${idx}_original`);
                                
                                // Crea riferimenti virtuali per ogni punto con flag pivot
                                globalPoints.forEach((point, idx) => {
                                    const targetName = globalTargetNames[idx];
                                    const virtualTarget = {
                                        isOriginalReference: true,
                                        originalModelName: targetName,
                                        position: new THREE.Vector3(point.x, point.y, point.z),
                                        usePivot: true  // FLAG per modalità pivot
                                    };

                                    if (!window.Scene3D.virtualSnapTargets) {
                                        window.Scene3D.virtualSnapTargets = new Map();
                                    }
                                    window.Scene3D.virtualSnapTargets.set(targetName, virtualTarget);
                                });

                                // Configura snap multipli
                                window.DragDropSystem.setMultipleSnapTargets(objectName, globalTargetNames);
                                
                                // Imposta flag usePivot per l'oggetto
                                const obj = window.Scene3D.findModelByName(objectName);
                                if (obj) {
                                    const existingConfig = window.DragDropSystem.customSnapTargets.get(obj.uuid);
                                    if (existingConfig) {
                                        existingConfig.usePivot = true;
                                    }
                                }
                            }
                            AppConfig.log(3, `📍 DRAG & DROP: Snap points PIVOT globali per "${objectName}" -> ${globalPoints.length} coordinate`);
                        });

                        console.log(`[UI] ✅ Punti snap PIVOT globali applicati: ${globalPoints.map(p => `(${p.x},${p.y},${p.z})`).join(', ')}`);
                    } else {
                        AppConfig.log(1, `⚠️ DRAG & DROP: SnapPointPivot globali specificati ma nessun oggetto draggabile o coordinate valide`);
                    }
                } else {
                    // FORMATO VECCHIO (PER-OGGETTO): oggetto1:(x,y,z);oggetto2:(x2,y2,z2)
                    const snapDeclarations = snapPointPivotClean.split(';').map(s => s.trim()).filter(s => s.length > 0);
                    console.log(`[UI] 📍 FORMATO PER-OGGETTO PIVOT: ${snapDeclarations.length} dichiarazioni`);

                    snapDeclarations.forEach((declaration, index) => {
                        console.log(`[UI] 📍 Parsing dichiarazione ${index + 1}/${snapDeclarations.length}: "${declaration}"`);
                        const match = declaration.match(/^([^:]+):\(([^,]+),([^,]+),([^)]+)\)$/);
                        if (match) {
                            const objectName = match[1].trim();
                            const x = parseFloat(match[2].trim());
                            const y = parseFloat(match[3].trim());
                            const z = parseFloat(match[4].trim());

                            console.log(`[UI] 📍 Match trovato: oggetto="${objectName}", x=${x}, y=${y}, z=${z}`);

                            if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                                console.log(`[UI] 📍✅ Chiamata setCustomSnapPositionPivot per "${objectName}"...`);
                                window.DragDropSystem.setCustomSnapPositionPivot(objectName, x, y, z);
                                AppConfig.log(3, `📍 DRAG & DROP: Snap point PIVOT per "${objectName}" a (${x}, ${y}, ${z})`);
                            } else {
                                console.error(`[UI] 📍❌ Coordinate non valide: x=${x}, y=${y}, z=${z}`);
                                AppConfig.log(1, `⚠️ DRAG & DROP: Coordinate non valide in SnapPointPivot: ${declaration}`);
                            }
                        } else {
                            console.error(`[UI] 📍❌ Regex match fallito per: "${declaration}"`);
                            AppConfig.log(1, `⚠️ DRAG & DROP: Formato SnapPointPivot non valido: ${declaration}`);
                        }
                    });
                }
            }

            // NUOVO: Configura snap targets multipli intercambiabili
            if (step.properties.SnapTargets) {
                // Rimuovi commenti (tutto dopo #) prima del parsing
                const snapTargetsClean = step.properties.SnapTargets.split('#')[0].trim();
                console.log(`[UI] 🎯 Parsing SnapTargets: "${snapTargetsClean}"`);

                // RILEVA FORMATO: se contiene ":" → formato vecchio (per-oggetto), altrimenti formato nuovo (globale)
                const isGlobalFormat = !snapTargetsClean.includes(':');

                if (isGlobalFormat) {
                    // FORMATO NUOVO (GLOBALE): target1,target2,target3
                    // Applica questi target a TUTTI gli oggetti in DragDropObjects
                    const globalTargets = snapTargetsClean.split(',').map(t => t.trim()).filter(t => t.length > 0);

                    if (globalTargets.length > 0 && draggableObjects.length > 0) {
                        console.log(`[UI] 🎯 FORMATO GLOBALE: ${globalTargets.length} target per ${draggableObjects.length} oggetti`);

                        // Applica gli stessi target a tutti gli oggetti draggabili
                        draggableObjects.forEach(objectName => {
                            window.DragDropSystem.setMultipleSnapTargets(objectName, globalTargets);
                            AppConfig.log(3, `🎯 DRAG & DROP: Snap targets globali per "${objectName}" -> [${globalTargets.join(', ')}]`);
                        });

                        console.log(`[UI] ✅ Target globali applicati a tutti gli oggetti: [${globalTargets.join(', ')}]`);
                    } else {
                        AppConfig.log(1, `⚠️ DRAG & DROP: SnapTargets globali specificati ma nessun oggetto draggabile o target valido`);
                    }
                } else {
                    // FORMATO VECCHIO (PER-OGGETTO): oggetto1:target1,target2;oggetto2:target3,target4
                    const snapDeclarations = snapTargetsClean.split(';').map(s => s.trim()).filter(s => s.length > 0);
                    console.log(`[UI] 🎯 FORMATO PER-OGGETTO: ${snapDeclarations.length} dichiarazioni`);

                    snapDeclarations.forEach((declaration, idx) => {
                        console.log(`[UI] 🎯 Parsing dichiarazione ${idx + 1}: "${declaration}"`);
                        const colonIndex = declaration.indexOf(':');
                        if (colonIndex > 0) {
                            const objectName = declaration.substring(0, colonIndex).trim();
                            const targetsString = declaration.substring(colonIndex + 1).trim();
                            const targetNames = targetsString.split(',').map(t => t.trim()).filter(t => t.length > 0);

                            console.log(`[UI] 🎯 Oggetto: "${objectName}", Targets: [${targetNames.join(', ')}]`);

                            if (targetNames.length > 0) {
                                window.DragDropSystem.setMultipleSnapTargets(objectName, targetNames);
                                AppConfig.log(3, `🎯 DRAG & DROP: Snap targets per "${objectName}" -> [${targetNames.join(', ')}]`);
                            } else {
                                AppConfig.log(1, `⚠️ DRAG & DROP: Nessun target specificato in SnapTargets: ${declaration}`);
                            }
                        } else {
                            AppConfig.log(1, `⚠️ DRAG & DROP: Formato SnapTargets non valido: ${declaration}`);
                        }
                    });
                }
            }

            // Configura visibilità indicatori snap (sfere verdi)
            if (step.properties.ShowSnapIndicators !== undefined) {
                window.DragDropSystem.showSnapIndicators = (step.properties.ShowSnapIndicators === 'true');
                AppConfig.log(3, `🎯 DRAG & DROP: Indicatori snap ${window.DragDropSystem.showSnapIndicators ? 'visibili' : 'nascosti'}`);
            } else {
                // Default: nascosti
                window.DragDropSystem.showSnapIndicators = false;
            }

            // Rimuovi eventuali indicatori esistenti se disabilitati
            if (!window.DragDropSystem.showSnapIndicators && window.DragDropSystem.removeAllSnapIndicators) {
                window.DragDropSystem.removeAllSnapIndicators();
            }

            // Abilita il sistema con oggetti specificati
            try {
                console.log(`[DEBUG] 🎯 DRAG & DROP: Chiamata enable con oggetti:`, draggableObjects);
                window.DragDropSystem.enable(draggableObjects);
                console.log(`[DEBUG] ✅ DRAG & DROP: Sistema abilitato - status:`, window.DragDropSystem.enabled);
                AppConfig.log(2, `✅ DRAG & DROP: Sistema abilitato con ${draggableObjects.length} oggetti`);

                // NUOVO: Evidenzia automaticamente tutti gli oggetti draggabili con silhouette gialla
                // IMPORTANTE: Usa applicazione diretta materiale per supportare multipli oggetti simultanei
                if (window.Scene3D && window.Scene3D.highlightSystem && window.DragDropSystem) {
                    const highlightMaterial = window.Scene3D.highlightSystem.highlightMaterial;

                    draggableObjects.forEach(objName => {
                        const model = window.Scene3D.findModelByName(objName);
                        if (model) {
                            // Salva materiali originali per questo oggetto
                            // IMPORTANTE: Non salvare highlightMaterial come "originale"
                            const originalMaterials = new Map();
                            model.traverse((child) => {
                                if (child.isMesh && child.material) {
                                    // Skip se il materiale è già highlightMaterial (evita loop silhouette)
                                    const isHighlightMaterial = Array.isArray(child.material)
                                        ? child.material[0] === highlightMaterial
                                        : child.material === highlightMaterial;

                                    if (!isHighlightMaterial) {
                                        if (Array.isArray(child.material)) {
                                            originalMaterials.set(child.uuid, child.material.slice());
                                        } else {
                                            originalMaterials.set(child.uuid, child.material);
                                        }
                                    }
                                }
                            });
                            // Salva solo se ci sono materiali originali da salvare
                            if (originalMaterials.size > 0) {
                                window.DragDropSystem.originalMaterialsMap.set(model.uuid, originalMaterials);
                            }

                            // Applica materiale highlight direttamente (bypass highlightModel per multipli oggetti)
                            model.traverse((child) => {
                                if (child.isMesh) {
                                    if (Array.isArray(child.material)) {
                                        child.material = child.material.map(() => highlightMaterial);
                                    } else {
                                        child.material = highlightMaterial;
                                    }
                                    child.renderOrder = 999;
                                }
                            });
                            console.log(`[UI] 🟡 Highlight applicato a oggetto draggabile: "${objName}"`);
                        } else {
                            console.warn(`[UI] ⚠️ Modello non trovato per highlight: "${objName}"`);
                        }
                    });
                    AppConfig.log(2, `🟡 Evidenziati ${draggableObjects.length} oggetti draggabili`);
                }

                // NUOVO: Configura auto-avanzamento per step DragDrop puri (senza Elemento)
                // oppure per step con Autoaction=true (auto-advance forzato)
                // AssemblyMode è OK per auto-avanzamento se non c'è Elemento
                const isPureDragDropStep = !step.properties.Elemento;
                const isAutoaction = step.properties.Autoaction === 'true';
                if ((isPureDragDropStep || isAutoaction) && draggableObjects.length > 0) {
                    console.log(`[UI] 🎯 Step DragDrop ${isAutoaction ? 'Autoaction' : 'puro'} rilevato - configurazione auto-avanzamento`);
                    window.DragDropSystem.resetSnapTracking();
                    window.DragDropSystem.setRequiredSnapObjects(draggableObjects);
                    window.DragDropSystem.enableAutoAdvance();
                    AppConfig.log(2, `⏭️ Auto-avanzamento abilitato - richiesti ${draggableObjects.length} snap`);
                } else {
                    // Step con Elemento - reset tracking ma NO auto-advance
                    window.DragDropSystem.resetSnapTracking();
                    console.log(`[UI] 🎯 Step DragDrop con Elemento - auto-avanzamento disabilitato`);
                }
                // EVIDENZIAZIONE CERCHI: Aggiungi cerchi gialli pulsanti sugli oggetti draggabili
                // Aiuta l'utente a identificare le viti/componenti piccoli da trascinare
                if (draggableObjects.length > 0 && window.Scene3D && window.Scene3D.highlightCircleManager) {
                    // Pulisci cerchi precedenti
                    window.Scene3D.highlightCircleManager.clearAllCircles();

                    draggableObjects.forEach(objectName => {
                        const obj = window.Scene3D.findModelByName(objectName);
                        if (obj) {
                            // Trova la mesh principale dell'oggetto per posizionare il cerchio
                            let targetMesh = null;
                            obj.traverse(child => {
                                if (child.isMesh && !targetMesh) {
                                    targetMesh = child;
                                }
                            });
                            if (targetMesh) {
                                const circleId = `dragdrop_${objectName}`;
                                window.Scene3D.highlightCircleManager.createCircle(circleId, targetMesh, 60, 0.7);
                                AppConfig.log(3, `🔵 DRAG & DROP: Cerchio evidenziazione per "${objectName}"`);
                            }
                        }
                    });
                }

            } catch (error) {
                console.error(`❌ DRAG & DROP: Errore abilitazione sistema:`, error);
            }
        } else if (step.properties.DragDrop !== 'true' && window.DragDropSystem && window.DragDropSystem.isEnabled()) {
            // Disabilita sistema se DragDrop non è esplicitamente 'true' (include 'false', undefined, null, ecc.)
            window.DragDropSystem.disable();
            AppConfig.log(2, `🚫 DRAG & DROP: Sistema disabilitato per step "${step.title}" (DragDrop=${step.properties.DragDrop})`);
        }

        // ═══════════════════════════════════════════════════════════════════════
        // AUTOACTION + DRAGDROP: Snap automatico degli oggetti alla posizione finale
        // Quando Autoaction=true e DragDrop=true, esegui auto-snap di tutti gli
        // oggetti draggabili senza attendere interazione utente
        // ═══════════════════════════════════════════════════════════════════════
        if (step.properties.Autoaction === 'true' && step.properties.DragDrop === 'true' && window.DragDropSystem) {
            console.log(`[UI] 🤖 Autoaction + DragDrop: avvio auto-snap oggetti per step "${step.title}"`);

            // Raccogli la lista degli oggetti draggabili (stessa logica del blocco DragDrop sopra)
            const autoSnapObjects = [];
            if (step.properties.DragDropObjects) {
                const cleanValue = step.properties.DragDropObjects.split('#')[0].trim();
                autoSnapObjects.push(...cleanValue.split(',').map(obj => obj.trim()).filter(obj => obj.length > 0));
            } else if (step.properties.AllowedComponents) {
                const cleanValue = step.properties.AllowedComponents.split('#')[0].trim();
                autoSnapObjects.push(...cleanValue.split(',').map(obj => obj.trim()).filter(obj => obj.length > 0));
            } else if (step.properties.Elemento) {
                const elementName = step.properties.Elemento.replace(/^models\//, '').replace(/\.(glb|obj|stl)$/, '');
                autoSnapObjects.push(elementName);
            }

            if (autoSnapObjects.length > 0) {
                // Delay per permettere al sistema DragDrop di configurare snap targets
                const autoSnapDelay = 300;
                setTimeout(() => {
                    console.log(`[UI] 🤖 Autoaction: esecuzione auto-snap per ${autoSnapObjects.length} oggetti`);
                    let snapIndex = 0;

                    const snapNext = () => {
                        if (snapIndex >= autoSnapObjects.length) return;

                        const objName = autoSnapObjects[snapIndex];
                        console.log(`[UI] 🤖 Autoaction: auto-snap oggetto ${snapIndex + 1}/${autoSnapObjects.length}: "${objName}"`);
                        const result = window.DragDropSystem.autoSnapToClosestTarget(objName);

                        if (!result) {
                            console.warn(`[UI] ⚠️ Autoaction: auto-snap fallito per "${objName}"`);
                        }

                        snapIndex++;
                        // Snap il prossimo oggetto con un piccolo delay per evitare conflitti
                        if (snapIndex < autoSnapObjects.length) {
                            setTimeout(snapNext, 200);
                        }
                    };

                    snapNext();
                }, autoSnapDelay);
            }
        }

        // NUOVO: Gestione sistema Assemblaggio Semplificato
        if (step.properties.AssemblyMode === 'true') {
            AppConfig.log(2, `🏗️ ASSEMBLY: Modalità assemblaggio semplificata abilitata per step "${step.title}"`);

            // Usa il nuovo AssemblySystemSimplified se disponibile, altrimenti fallback a AssemblySystem
            const assemblySystem = window.AssemblySystemSimplified || window.AssemblySystem;

            if (assemblySystem) {
                // Abilita modalità assemblaggio con AllowedComponents
                if (step.properties.AllowedComponents) {
                    console.log(`🔥 ASSEMBLY DEBUG: step.title="${step.title}", AllowedComponents="${step.properties.AllowedComponents}"`);

                    const result = assemblySystem.enableAssemblyMode(step.properties.AllowedComponents, step.title);
                    console.log(`🔥 ASSEMBLY DEBUG: enableAssemblyMode result=${result}`);

                    AppConfig.log(3, `🏗️ ASSEMBLY: Componenti permessi: ${step.properties.AllowedComponents}`);
                } else {
                    console.log(`🔥 ASSEMBLY DEBUG: step.title="${step.title}", NO AllowedComponents - base mode`);

                    // Modalità assemblaggio senza componenti specifici
                    const result = assemblySystem.enableAssemblyMode(null, step.title);
                    console.log(`🔥 ASSEMBLY DEBUG: enableAssemblyMode base result=${result}`);

                    AppConfig.log(3, `🏗️ ASSEMBLY: Modalità assemblaggio base abilitata`);
                }

                AppConfig.log(2, `✅ ASSEMBLY: Sistema assemblaggio semplificato configurato`);
            } else {
                console.warn('⚠️ ASSEMBLY: Nessun sistema di assemblaggio disponibile');
            }
        } else if (step.properties.AssemblyMode === 'false') {
            // Disabilita esplicitamente il sistema se richiesto
            const assemblySystem = window.AssemblySystemSimplified || window.AssemblySystem;
            if (assemblySystem && assemblySystem.disableAssemblyMode) {
                assemblySystem.disableAssemblyMode();
                AppConfig.log(2, `🚫 ASSEMBLY: Sistema assemblaggio disabilitato per step "${step.title}"`);
            }
        }

        // ═══════════════════════════════════════════════════════════════════════
        // ANIMATED WINDOW SYSTEM: Finestra 2D con animazione a trigger alternato
        // ═══════════════════════════════════════════════════════════════════════
        // Supporta sia AnimatedImages (lista) che AnimatedImagesFolder (cartella)
        if ((step.properties.AnimatedImages || step.properties.AnimatedImagesFolder) && window.AnimatedWindowSystem) {
            const sourceType = step.properties.AnimatedImagesFolder ? 'AnimatedImagesFolder' : 'AnimatedImages';
            console.log(`[UI] 🖼️ ${sourceType} rilevato per step: "${step.title}"`);

            // Configura e mostra la finestra animata (async per supporto cartella)
            const success = await window.AnimatedWindowSystem.showFromStepConfig(step.properties);

            if (success) {
                AppConfig.log(2, `✅ ANIMATED WINDOW: Finestra animata avviata per step "${step.title}"`);

                // Lo step è bloccante - la finestra gestisce il proprio avanzamento
                // tramite il callback onComplete che chiama UI.nextStep()
                return; // Esci da executeStep - il flusso continua quando finestra chiude
            } else {
                console.error(`[UI] ❌ AnimatedWindow: Errore configurazione finestra`);
            }
        }

        // ═══════════════════════════════════════════════════════════
        // CAMERA: Calcola delay dinamico basato su CameraTransitionTime
        // ═══════════════════════════════════════════════════════════
        const cameraTransitionTime = step.properties.CameraTransitionTime_parsed ||
                                    parseFloat(step.properties.CameraTransitionTime) ||
                                    0.8; // Default 0.8s se non specificato
        const transitionMs = cameraTransitionTime * 1000;

        // NUOVO: Evidenzia automaticamente l'elemento del tutorial corrente
        // NOTA: Non evidenziare se AutoExecute=true (l'utente non deve interagire)
        if (step.properties.Elemento && window.Scene3D && window.Scene3D.highlightCurrentTutorialElement) {
            if (!effectiveAutoExecute) {
                console.log('📷 [UI] CameraTransitionTime:', cameraTransitionTime + 's (' + transitionMs + 'ms)');

                // Piccolo delay per permettere che il modello sia caricato e visibile
                setTimeout(() => {
                    window.Scene3D.highlightCurrentTutorialElement();

                    // CERCHIO SELEZIONE GIALLO per Elemento azionabile (convergere.txt)
                    // Il cerchio definisce l'area di interazione valida: il touch/click è
                    // accettato se cade dentro il cerchio, anche se il raycast manca la mesh.
                    if (window.Scene3D.highlightCircleManager && step.properties.DragDrop !== 'true') {
                        const cleanName = step.properties.Elemento.split('/').pop().replace(/\.(glb|gltf|obj|stl)$/i, '');
                        const obj = window.Scene3D.findModelByName(cleanName);
                        if (obj) {
                            let targetMesh = null;
                            const targetChild = step.properties.TargetChild;
                            if (targetChild) {
                                // Se TargetChild specificato, usa quella mesh specifica
                                obj.traverse(child => {
                                    if (!targetMesh && child.name === targetChild && child.isMesh) targetMesh = child;
                                });
                                // Fallback: prima mesh figlia del child trovato (anche se non è Mesh diretta)
                                if (!targetMesh) {
                                    let childNode = null;
                                    obj.traverse(child => { if (!childNode && child.name === targetChild) childNode = child; });
                                    if (childNode) childNode.traverse(child => { if (!targetMesh && child.isMesh) targetMesh = child; });
                                }
                            }
                            if (!targetMesh) {
                                // Nessun TargetChild o non trovato: usa prima mesh del modello
                                obj.traverse(child => { if (child.isMesh && !targetMesh) targetMesh = child; });
                            }
                            if (targetMesh) {
                                window.Scene3D.highlightCircleManager.createCircle(`elemento_${cleanName}`, targetMesh, 60, 0.7);
                                console.log(`[UI] 🟡 Cerchio selezione creato per Elemento "${cleanName}"${targetChild ? ` (TargetChild: ${targetChild})` : ''}`);
                            }
                        }
                    }

                    // ═══════════════════════════════════════════════════════════
                    // CAMERA: Memorizza posizione camera DOPO che è stata impostata
                    // ═══════════════════════════════════════════════════════════
                    // Delay = transitionMs + 300ms (margine sicurezza)
                    const cameraDelay = transitionMs + 300;
                    console.log('📷 [UI] Attesa completamento transizione camera:', cameraDelay + 'ms');

                    setTimeout(() => {
                        if (window.Scene3D && typeof window.Scene3D.getCameraInfo === 'function') {
                            this.stepCameraState = window.Scene3D.getCameraInfo();
                            console.log('📷 [UI] Posizione camera memorizzata per step:', step.title);
                            console.log('📷 [UI] Camera state:', this.stepCameraState);

                            // Mostra pulsante reset camera
                            this.showResetCameraButton();
                        }
                    }, cameraDelay);
                }, 200);
            } else {
                console.log(`[UI] 🤖 AutoExecute attivo - skip evidenziazione elemento`);
                console.log('📷 [UI] CameraTransitionTime:', cameraTransitionTime + 's (' + transitionMs + 'ms)');

                // Anche con AutoExecute, memorizza camera dopo transizione completa
                const cameraDelay = transitionMs + 500;
                console.log('📷 [UI] Attesa completamento transizione camera (AutoExecute):', cameraDelay + 'ms');

                setTimeout(() => {
                    if (window.Scene3D && typeof window.Scene3D.getCameraInfo === 'function') {
                        this.stepCameraState = window.Scene3D.getCameraInfo();
                        console.log('📷 [UI] Posizione camera memorizzata per step (AutoExecute):', step.title);
                        this.showResetCameraButton();
                    }
                }, cameraDelay);
            }
        } else {
            // Nessun elemento da evidenziare, ma potrebbe esserci cambio camera configurato
            const cameraDelayNoElement = transitionMs + 300;
            console.log('📷 [UI] Nessun elemento, CameraTransitionTime:', cameraTransitionTime + 's (' + cameraDelayNoElement + 'ms)');

            setTimeout(() => {
                if (window.Scene3D && typeof window.Scene3D.getCameraInfo === 'function') {
                    this.stepCameraState = window.Scene3D.getCameraInfo();
                    console.log('📷 [UI] Posizione camera memorizzata per step (nessun elemento):', step.title);
                    this.showResetCameraButton();
                }
            }, cameraDelayNoElement);
        }

        // NOTA: updateStepSpeechBubble() NON chiamato qui - già chiamato da goToStep()
        // Chiamarlo due volte causava doppia animazione (flickering "gonfiaggio")

        // Evento personalizzabile per altri moduli
        const event = new CustomEvent('tutorialStepChanged', {
            detail: { step, index: this.currentStepIndex, allSteps: this.tutorialSteps }
        });
        document.dispatchEvent(event);

        // ═══════════════════════════════════════════════════════════════════════
        // AUTO EXECUTE: Esecuzione automatica azione senza click utente
        // ═══════════════════════════════════════════════════════════════════════
        // IMPORTANTE: Salta questo blocco se step ha AutoSetVariant senza Elemento
        // (verrà gestito dal blocco AUTO-SET VARIANT più sotto)
        // IMPORTANTE: Salta anche se Autoaction + DragDrop (avanzamento gestito dal DragDrop auto-snap)
        const hasAutoSetVariant = !!step.properties.AutoSetVariant;
        const hasElemento = !!step.properties.Elemento;
        const skipAutoExecute = (hasAutoSetVariant && !hasElemento) ||
                                (step.properties.Autoaction === 'true' && step.properties.DragDrop === 'true');

        if (effectiveAutoExecute && skipAutoExecute) {
            if (step.properties.Autoaction === 'true' && step.properties.DragDrop === 'true') {
                console.log(`[UI] ⏭️ AutoExecute skippato (Autoaction + DragDrop) - avanzamento gestito da auto-snap`);
            } else {
                console.log(`[UI] ⏭️ AutoExecute skippato (ha AutoSetVariant senza Elemento) - verrà gestito da blocco SET VARIANT`);
            }
        }

        if (effectiveAutoExecute && window.Scene3D && !skipAutoExecute) {
            console.log(`[UI] 🤖 AutoExecute attivo per step: "${step.title}"`);

            // Determina il target dell'animazione
            let targetModel = null;
            let targetChild = null;

            if (step.properties.Elemento) {
                const elementName = step.properties.Elemento.replace(/^models\//, '').replace(/\.(glb|obj|stl)$/i, '');
                targetModel = window.Scene3D.findModelByName(elementName);

                if (targetModel) {
                    console.log(`[UI] 🤖 AutoExecute: Trovato modello "${elementName}"`);

                    // Se specificato TargetChild, cerca il figlio all'interno del modello
                    if (step.properties.TargetChild) {
                        const childName = step.properties.TargetChild.trim();
                        let found = false;

                        // DEBUG: Mostra tutti i child disponibili nel modello
                        console.log(`[UI] 🔍 DEBUG: Cercando child "${childName}" in "${elementName}"`);
                        console.log(`[UI] 🔍 DEBUG: Children disponibili nel modello:`);
                        let childCount = 0;
                        targetModel.traverse((child) => {
                            if (child.name) {
                                childCount++;
                                if (childCount <= 20) { // Limita output
                                    console.log(`   [${childCount}] "${child.name}" (type: ${child.type})`);
                                }
                            }
                            // Usa SOLO exact match e fermati al primo risultato
                            if (!found && child.name === childName) {
                                targetChild = child;
                                found = true;
                                // IMPORTANTE: Imposta riferimento al parent per il fix matrixAutoUpdate in scene3d
                                targetChild.userData.parentModel = targetModel;
                                targetChild.userData.parentModelName = elementName;
                                console.log(`[UI] ✅ AutoExecute: TROVATO child "${childName}" in "${elementName}" (parentModel impostato)`);
                            }
                        });
                        console.log(`[UI] 🔍 DEBUG: Totale ${childCount} child nel modello`);

                        if (!targetChild) {
                            console.warn(`[UI] ⚠️ AutoExecute: TargetChild "${childName}" NON TROVATO in "${elementName}"`);
                            console.warn(`[UI] 💡 Suggerimento: verifica che il nome esatto sia presente nell'elenco sopra`);
                        }
                    }
                } else {
                    console.warn(`[UI] ⚠️ AutoExecute: Modello "${elementName}" non trovato`);
                }
            }

            // Esegui animazione automaticamente con piccolo delay
            const self = this; // Riferimento per closure in tutti i path
            setTimeout(() => {
                const animTarget = targetChild || targetModel;
                if (animTarget && window.Scene3D.autoExecuteAnimation) {
                    // Passa sia il target che il modello root per home_config
                    const rootModel = targetModel || animTarget;
                    const animationStarted = window.Scene3D.autoExecuteAnimation(animTarget, step, rootModel);

                    if (animationStarted) {
                        // Aspetta che l'animazione multi-step sia completamente terminata
                        let pollAttempts = 0;
                        const maxPollAttempts = 100; // Max 5 secondi (animazioni possono essere lunghe)
                        let animationWasFound = false; // Flag per sapere se l'animazione è stata trovata almeno una volta

                        // Salva l'interval ID per poterlo cancellare in goToStep
                        this.autoExecuteIntervalId = setInterval(function() {
                            const activeAnims = window.Scene3D.animationSystem?.activeAnimations || [];
                            const multiStepAnims = window.Scene3D.animationSystem?.multiStepAnimations || new Map();

                            // Per animazioni multi-step, controlla se la sequenza è ancora in corso
                            const modelUuid = animTarget.uuid;
                            const isMultiStepInProgress = multiStepAnims.has(modelUuid);

                            // Cerca l'animazione corrente per questo modello
                            const myAnimation = activeAnims.find(anim => anim.model === animTarget);

                            if (myAnimation) {
                                animationWasFound = true;
                                // Animazione trovata! Per multi-step, non controllare finished qui
                                // perché ogni sub-step ha il suo ciclo
                                if (!myAnimation.isMultiStep && myAnimation.finished) {
                                    // Animazione semplice completata
                                    clearInterval(self.autoExecuteIntervalId);
                                    self.autoExecuteIntervalId = null;
                                    console.log(`[UI] 🤖 AutoExecute: Animazione semplice completata`);

                                    if (effectiveAutoAdvance) {
                                        console.log(`[UI] ⏭️ AutoAdvance=true → avanzo allo step successivo`);
                                        self.autoAdvanceTimeoutId = setTimeout(() => self.nextStep(), 50);
                                    } else {
                                        console.log(`[UI] ⏸️ AutoAdvance non impostato → aspetto interazione utente`);
                                    }
                                }
                                // Per multi-step, continua il polling
                            } else if (animationWasFound && !isMultiStepInProgress) {
                                // L'animazione era in corso ma ora non c'è più E la sequenza multi-step è terminata
                                // Questo significa che TUTTA la sequenza è completata!
                                clearInterval(self.autoExecuteIntervalId);
                                self.autoExecuteIntervalId = null;
                                console.log(`[UI] 🤖 AutoExecute: Sequenza multi-step completata`);

                                if (effectiveAutoAdvance) {
                                    console.log(`[UI] ⏭️ AutoAdvance=true → avanzo allo step successivo`);
                                    self.autoAdvanceTimeoutId = setTimeout(() => self.nextStep(), 50);
                                } else {
                                    console.log(`[UI] ⏸️ AutoAdvance non impostato → aspetto interazione utente`);
                                }
                            } else {
                                // Animazione non ancora trovata o ancora in corso
                                pollAttempts++;
                                if (pollAttempts >= maxPollAttempts) {
                                    // Timeout
                                    clearInterval(self.autoExecuteIntervalId);
                                    self.autoExecuteIntervalId = null;
                                    console.warn(`[UI] ⚠️ AutoExecute: Timeout attesa animazione (${maxPollAttempts * 50}ms)`);

                                    if (effectiveAutoAdvance) {
                                        console.log(`[UI] ⏭️ AutoAdvance=true → avanzo comunque`);
                                        self.autoAdvanceTimeoutId = setTimeout(() => self.nextStep(), 50);
                                    } else {
                                        console.log(`[UI] ⏸️ AutoAdvance non impostato → aspetto interazione utente`);
                                    }
                                }
                            }
                        }, 50); // Polling ogni 50ms
                    } else {
                        // Nessuna animazione avviata
                        console.log(`[UI] 🤖 AutoExecute: Nessuna animazione da attendere`);

                        // Controlla AutoAdvance prima di avanzare
                        if (effectiveAutoAdvance) {
                            console.log(`[UI] ⏭️ AutoAdvance=true → avanzo subito`);
                            this.autoAdvanceTimeoutId = setTimeout(() => this.nextStep(), 50);
                        } else {
                            console.log(`[UI] ⏸️ AutoAdvance non impostato → aspetto interazione utente`);
                        }
                    }
                } else if (animTarget && window.Scene3D.startModelAnimation) {
                    // Fallback al metodo esistente
                    window.Scene3D.startModelAnimation(animTarget, step);

                    // Ascolta completamento animazione (usa stesso sistema del path principale)
                    self.autoExecuteIntervalId = setInterval(function() {
                        const stillAnimating = window.Scene3D.animationSystem?.activeAnimations?.some(
                            anim => anim.model === animTarget && !anim.finished
                        );
                        if (!stillAnimating) {
                            clearInterval(self.autoExecuteIntervalId);
                            self.autoExecuteIntervalId = null;
                            console.log(`[UI] 🤖 AutoExecute: Animazione completata (fallback)`);

                            // Controlla AutoAdvance prima di avanzare
                            if (effectiveAutoAdvance) {
                                console.log(`[UI] ⏭️ AutoAdvance=true → avanzo allo step successivo`);
                                self.autoAdvanceTimeoutId = setTimeout(() => self.nextStep(), 50);
                            } else {
                                console.log(`[UI] ⏸️ AutoAdvance non impostato → aspetto interazione utente`);
                            }
                        }
                    }, 50);
                } else {
                    console.warn(`[UI] ⚠️ AutoExecute: Nessun target valido per animazione`);

                    // Controlla AutoAdvance prima di avanzare
                    if (effectiveAutoAdvance) {
                        console.log(`[UI] ⏭️ AutoAdvance=true → avanzo comunque`);
                        this.autoAdvanceTimeoutId = setTimeout(() => this.nextStep(), 50);
                    } else {
                        console.log(`[UI] ⏸️ AutoAdvance non impostato → aspetto interazione utente`);
                    }
                }
            }, 20); // Delay ridotto per transizioni più veloci
        }

        // ═══════════════════════════════════════════════════════════════════════
        // SET VARIANT: Esecuzione automatica setVariant senza click
        // ═══════════════════════════════════════════════════════════════════════
        if (step.properties.AutoSetVariant && window.InteractiveObject3D) {
            const variants = step.properties.AutoSetVariant.split(';');
            variants.forEach(variantDecl => {
                const match = variantDecl.trim().match(/^(\w+)=(\w+)$/);
                if (match) {
                    const [, groupName, variantName] = match;
                    console.log(`[UI] 🔀 AutoSetVariant: ${groupName}=${variantName}`);
                    window.InteractiveObject3D.setStateVariant(groupName, variantName);
                }
            });

            // ═══════════════════════════════════════════════════════════════════
            // AUTO-AVANZAMENTO: Se AutoSetVariant con AutoExecute e AutoAdvance
            // ═══════════════════════════════════════════════════════════════════
            // Condizione: AutoExecute=true E AutoAdvance=true MA senza Elemento (quindi nessuna animazione da attendere)
            const hasAutoExecute = effectiveAutoExecute;
            const hasAutoAdvance = effectiveAutoAdvance;
            const hasElemento = !!step.properties.Elemento;

            if (hasAutoExecute && hasAutoAdvance && !hasElemento) {
                console.log(`[UI] 🔀 AutoSetVariant: AutoExecute + AutoAdvance senza animazioni`);
                // Breve delay per permettere al cambio variante di renderizzarsi
                this.autoAdvanceTimeoutId = setTimeout(() => {
                    console.log(`[UI] ⏭️ AutoAdvance=true → avanzo allo step successivo`);
                    this.nextStep();
                }, 300);
            } else if (hasAutoExecute && !hasAutoAdvance && !hasElemento) {
                console.log(`[UI] 🔀 AutoSetVariant: AutoExecute senza AutoAdvance → aspetto interazione utente`);
            }
        }
    },

    /**
     * Mappa i nomi degli strumenti dal tutorial ai nomi interni
     */
    mapToolName: function(tutorialToolName) {
        // Delega a ToolsManager se disponibile (supporta ToolRegistry dinamico)
        if (window.ToolsManager && typeof window.ToolsManager.mapToolName === 'function') {
            return window.ToolsManager.mapToolName(tutorialToolName);
        }

        // Fallback a mapping hardcoded
        const mapping = {
            'ChiaveBrugola': 'brugola',
            'ChiaveInglese': 'chiave_inglese',
            'Mani': 'mano',
            'Aria': 'aria',
            'Spray': 'spray',
            'Straccio': 'straccio'
        };

        return mapping[tutorialToolName] || null;
    },
    
    /**
     * Evidenzia lo strumento richiesto senza attivarlo
     */
    highlightRequiredTool: function(toolName) {
        if (!toolName) return;
        
        // Trova elemento DOM del tool
        const toolElement = document.querySelector(`[data-tool="${toolName}"]`);
        if (!toolElement) {
            AppConfig.log(1, `Elemento tool non trovato: ${toolName}`);
            return;
        }
        
        // Rimuovi evidenziazione precedente da tutti i tool
        document.querySelectorAll('.tool-icon').forEach(icon => {
            icon.classList.remove('required', 'tool-highlight');
        });
        
        // Aggiungi evidenziazione al tool richiesto
        toolElement.classList.add('required', 'tool-highlight');
        
        AppConfig.log(3, `Tool evidenziato come richiesto: ${toolName}`);
        
        // Rimuovi evidenziazione dopo un certo tempo (se non viene cliccato)
        setTimeout(() => {
            if (toolElement && !this.toolsState[toolName]) {
                toolElement.classList.remove('required', 'tool-highlight');
                AppConfig.log(3, `Evidenziazione tool rimossa: ${toolName}`);
            }
        }, 10000); // 10 secondi
    },
    
    /**
     * Avanza allo step successivo del tutorial
     */
    nextStep: async function() {
        if (this.currentStepIndex < this.tutorialSteps.length - 1) {
            await this.goToStep(this.currentStepIndex + 1);
        } else {
            AppConfig.log(2, `[UI] Ultimo step del tutorial raggiunto`);
            // Mostra congratulazioni per completamento tutorial
            if (window.Scene3D && window.Scene3D.showTutorialCompletionCongratulations) {
                if (window.Scene3D.tutorialTracker) {
                    window.Scene3D.tutorialTracker.interactionsBlocked = true;
                }
                console.log('🎉 [UI] Tutorial completato! Mostrando congratulazioni...');
                setTimeout(() => {
                    window.Scene3D.showTutorialCompletionCongratulations();
                }, 500);
            }
        }
    },

    /**
     * Torna allo step precedente del tutorial
     */
    prevStep: function() {
        if (this.currentStepIndex > 0) {
            this.goToStep(this.currentStepIndex - 1);
        } else {
            AppConfig.log(2, `[UI] Primo step del tutorial raggiunto`);
        }
    },

    /**
     * Gestisce il click sul fumetto descrizione
     * Disabilitato - l'utente avanza tramite interazione manuale o frecce navigazione
     */
    onSpeechBubbleClick: async function() {
        // Click sul fumetto non avanza lo step - interazione manuale richiesta
        return;
    },

    /* ===== GESTIONE FUMETTO STEP TUTORIAL ===== */
    
    /**
     * Mostra il fumetto per la descrizione step
     */
    showStepSpeechBubble: function() {
        // GUARD: Non mostrare se siamo sulla home page
        if (this.currentPage === 'home') {
            console.log('💬 [UI] showStepSpeechBubble BLOCCATO - siamo sulla home page');
            return;
        }

        const bubble = document.getElementById('stepSpeechBubble');
        if (bubble) {
            bubble.classList.remove('hidden');
            // Rimuovi TUTTI gli inline style (inclusi !important impostati da goHome)
            bubble.removeAttribute('style');
        }
    },
    
    /**
     * Nasconde il fumetto per la descrizione step
     */
    hideStepSpeechBubble: function() {
        const bubble = document.getElementById('stepSpeechBubble');
        if (bubble) {
            // Rimuovi tutte le classi di animazione che potrebbero interferire
            bubble.classList.remove('flash', 'pulse', 'dramatic-intro');

            // Aggiungi classe hidden
            bubble.classList.add('hidden');

            // Force inline style per extra sicurezza
            bubble.style.display = 'none';

            console.log('💬 [UI] Fumetto step nascosto');
        }
    },
    
    /**
     * Attiva l'effetto flash sul fumetto per attirare l'attenzione
     */
    flashStepBubble: function() {
        const bubble = document.getElementById('stepSpeechBubble');
        if (!bubble || bubble.classList.contains('hidden')) {
            return;
        }

        // Rimuovi eventuali classi di animazione precedenti
        bubble.classList.remove('flash', 'pulse');

        // Usa requestAnimationFrame per riavviare l'animazione senza reflow forzato
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                bubble.classList.add('flash');
            });
        });

        // Rimuovi la classe dopo l'animazione per permettere flash futuri
        setTimeout(() => {
            bubble.classList.remove('flash');
        }, 2000); // Durata aggiornata (2s per glowPulse più lungo)
    },
    
    /**
     * Attiva un effetto pulse più sottile sul fumetto
     */
    pulseStepBubble: function() {
        const bubble = document.getElementById('stepSpeechBubble');
        if (!bubble || bubble.classList.contains('hidden')) {
            return;
        }
        
        // Rimuovi eventuali classi di animazione precedenti
        bubble.classList.remove('flash', 'pulse');
        
        // Forza un reflow
        bubble.offsetHeight;
        
        // Aggiungi la classe pulse
        bubble.classList.add('pulse');
        
        // Rimuovi la classe dopo l'animazione
        setTimeout(() => {
            bubble.classList.remove('pulse');
        }, 800); // Durata dell'animazione pulse (0.8s)
    },
    
    /**
     * Aggiorna il contenuto del fumetto con lo step corrente
     */
    updateStepSpeechBubble: function() {
        if (!this.tutorialSteps || this.tutorialSteps.length === 0 || this.currentStepIndex < 0) {
            this.hideStepSpeechBubble();
            return;
        }

        const bubble = document.getElementById('stepSpeechBubble');
        const stepCurrentNumber = document.getElementById('stepCurrentNumber');
        const stepTotalNumber = document.getElementById('stepTotalNumber');
        const stepDescription = document.getElementById('stepDescription');
        const content = bubble ? bubble.querySelector('.speech-bubble-content') : null;

        if (!bubble || !stepCurrentNumber || !stepTotalNumber || !stepDescription || !content) {
            return;
        }

        const currentStep = this.tutorialSteps[this.currentStepIndex];
        const isFirstAppearance = bubble.classList.contains('hidden');

        // Aggiungi/rimuovi classe per ultimo step
        if (this.currentStepIndex === this.tutorialSteps.length - 1) {
            bubble.classList.add('last-step');
        } else {
            bubble.classList.remove('last-step');
        }

        // ═══════════════════════════════════════════════════════════════
        // ANIMAZIONE DRAMMATICA: Parametro HighlightDescription=true
        // ═══════════════════════════════════════════════════════════════
        if (currentStep && currentStep.properties && currentStep.properties.HighlightDescription === 'true') {
            // Per dramatic-intro: aggiorna contenuto direttamente e avvia animazione
            stepCurrentNumber.textContent = this.currentStepIndex + 1;
            stepTotalNumber.textContent = this.tutorialSteps.length;
            if (currentStep.properties.Descrizione) {
                stepDescription.textContent = currentStep.properties.Descrizione;
            } else {
                stepDescription.textContent = currentStep?.name || `Step ${this.currentStepIndex + 1}`;
            }

            content.classList.remove('entering');
            this.showStepSpeechBubble();

            console.log('🎬 [UI] HighlightDescription=true → Animazione drammatica fumetto');
            bubble.classList.remove('dramatic-intro', 'flash', 'pulse');
            requestAnimationFrame(() => {
                bubble.classList.add('dramatic-intro');
            });
            const dramaticDuration = this.dramaticAnimationDuration || 1000;
            bubble.style.animationDuration = dramaticDuration + 'ms';
            setTimeout(() => {
                bubble.classList.remove('dramatic-intro');
                bubble.style.animationDuration = '';
                console.log('🎬 [UI] Animazione drammatica completata');
            }, dramaticDuration);
            return;
        }

        // ═══════════════════════════════════════════════════════════════
        // TRANSIZIONE SMOOTH: fade-out → aggiorna testo → fade-in
        // ═══════════════════════════════════════════════════════════════
        if (isFirstAppearance) {
            // Prima apparizione: parte nascosto, poi entra smooth
            content.classList.add('entering');
            stepCurrentNumber.textContent = this.currentStepIndex + 1;
            stepTotalNumber.textContent = this.tutorialSteps.length;
            if (currentStep && currentStep.properties && currentStep.properties.Descrizione) {
                stepDescription.textContent = currentStep.properties.Descrizione;
            } else {
                stepDescription.textContent = currentStep?.name || `Step ${this.currentStepIndex + 1}`;
            }
            this.showStepSpeechBubble();
            // Attende un frame per applicare lo stato "entering", poi rimuove per animare l'ingresso
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    content.classList.remove('entering');
                    // Flash glow dopo che il contenuto è apparso
                    setTimeout(() => this.flashStepBubble(), 400);
                });
            });
        } else {
            // Step successivi: fade-out → aggiorna → fade-in
            content.classList.add('entering');
            setTimeout(() => {
                // Aggiorna contenuto mentre è nascosto
                stepCurrentNumber.textContent = this.currentStepIndex + 1;
                stepTotalNumber.textContent = this.tutorialSteps.length;
                if (currentStep && currentStep.properties && currentStep.properties.Descrizione) {
                    stepDescription.textContent = currentStep.properties.Descrizione;
                } else {
                    stepDescription.textContent = currentStep?.name || `Step ${this.currentStepIndex + 1}`;
                }
                // Fade-in con nuovo contenuto
                requestAnimationFrame(() => {
                    content.classList.remove('entering');
                    // Flash glow dopo che il contenuto è apparso
                    setTimeout(() => this.flashStepBubble(), 400);
                });
            }, 350); // Durata fade-out prima di aggiornare
        }
    },

    /**
     * Mostra modal informativo con messaggio e media opzionali
     * @param {string} message - Messaggio da mostrare
     * @param {string} title - Titolo del modal (opzionale)
     * @param {Object} options - Opzioni aggiuntive { image: 'path/to/image.jpg', video: 'path/to/video.mp4' }
     * @returns {Promise} - Promessa risolta quando l'utente clicca OK
     */
    showInfoModal: function(message, title = 'Informazione', options = {}) {
        return new Promise((resolve) => {
            const modal = document.getElementById('infoModal');
            const titleElement = document.getElementById('infoModalTitle');
            const messageElement = document.getElementById('infoModalMessage');
            const mediaContainer = document.getElementById('infoModalMedia');
            const okButton = document.getElementById('infoModalOkBtn');

            if (!modal || !titleElement || !messageElement || !okButton || !mediaContainer) {
                AppConfig.log(0, '[UI] Elementi modal informativo non trovati');
                resolve();
                return;
            }

            // Salva callback resolve per poterla chiamare da hideInfoModal
            this._infoModalResolve = resolve;
            this._infoModalCloseHandler = null;

            // Resetta inline style eventualmente impostato da goHome()
            modal.style.display = '';

            // Imposta contenuto testuale
            titleElement.textContent = title;
            // Supporta \n come a capo nel messaggio
            messageElement.innerHTML = message.replace(/\\n/g, '<br>').replace(/\n/g, '<br>');

            // Pulisci e nascondi contenitore media
            mediaContainer.innerHTML = '';
            mediaContainer.classList.add('hidden');

            // Gestione immagine
            if (options.image) {
                const img = document.createElement('img');
                img.src = options.image;
                img.alt = 'Immagine informativa';
                img.onerror = () => {
                    AppConfig.log(1, `[UI] Errore caricamento immagine: ${options.image}`);
                    mediaContainer.classList.add('hidden');
                };
                img.onload = () => {
                    mediaContainer.classList.remove('hidden');
                    AppConfig.log(2, `[UI] Immagine caricata: ${options.image}`);
                };
                mediaContainer.appendChild(img);
            }

            // Gestione video
            if (options.video) {
                const video = document.createElement('video');
                video.src = options.video;
                video.controls = true;
                video.autoplay = true;
                video.preload = 'auto';
                video.onerror = () => {
                    AppConfig.log(1, `[UI] Errore caricamento video: ${options.video}`);
                    mediaContainer.classList.add('hidden');
                };
                mediaContainer.appendChild(video);
                mediaContainer.classList.remove('hidden');
                AppConfig.log(2, `[UI] Video aggiunto: ${options.video}`);
            }

            // Handler per chiusura
            const self = this;
            const closeModal = () => {
                modal.classList.remove('show');
                okButton.removeEventListener('click', closeModal);
                self._infoModalCloseHandler = null;

                // Ferma video se presente
                const videoElement = mediaContainer.querySelector('video');
                if (videoElement) {
                    videoElement.pause();
                    videoElement.currentTime = 0;
                }

                // Risolvi la promessa dopo l'animazione
                setTimeout(() => {
                    // Pulisci contenitore media
                    mediaContainer.innerHTML = '';
                    mediaContainer.classList.add('hidden');
                    // Risolvi solo se questa è ancora la promise attiva
                    if (self._infoModalResolve === resolve) {
                        self._infoModalResolve = null;
                        resolve();
                    }
                }, 300);
            };

            // Salva handler per poterlo rimuovere da hideInfoModal
            this._infoModalCloseHandler = closeModal;

            // Aggiungi listener al pulsante OK
            okButton.addEventListener('click', closeModal);

            // Mostra modal
            setTimeout(() => {
                modal.classList.add('show');
            }, 100);

            AppConfig.log(2, `[UI] Modal informativo mostrato: "${message.substring(0, 50)}..."`);
        });
    },

    /**
     * Nasconde modal informativo e risolve la promise pendente
     */
    hideInfoModal: function() {
        const modal = document.getElementById('infoModal');
        if (modal) {
            modal.classList.remove('show');
        }

        // Rimuovi handler click dal pulsante OK per evitare listener orfani
        if (this._infoModalCloseHandler) {
            const okButton = document.getElementById('infoModalOkBtn');
            if (okButton) {
                okButton.removeEventListener('click', this._infoModalCloseHandler);
            }
            this._infoModalCloseHandler = null;
        }

        // Ferma video e pulisci media
        const mediaContainer = document.getElementById('infoModalMedia');
        if (mediaContainer) {
            const videoElement = mediaContainer.querySelector('video');
            if (videoElement) {
                videoElement.pause();
                videoElement.currentTime = 0;
            }
            mediaContainer.innerHTML = '';
            mediaContainer.classList.add('hidden');
        }

        // CRITICO: Risolvi la promise pendente per sbloccare executeStep
        if (this._infoModalResolve) {
            console.log('[UI] ⚠️ hideInfoModal: Risoluzione forzata promise modal pendente');
            const pendingResolve = this._infoModalResolve;
            this._infoModalResolve = null;
            pendingResolve();
        }
    },

    /**
     * Carica configurazione assemblaggio da file JSON
     * @param {string} configPath - Percorso file configurazione
     * @returns {Promise<Object>} - Configurazione caricata
     */
    loadAssemblyConfig: async function(configPath) {
        try {
            AppConfig.log(3, `🏗️ ASSEMBLY CONFIG: Caricamento da ${configPath}`);

            const response = await fetchFile(configPath);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const config = await response.json();
            AppConfig.log(3, `✅ ASSEMBLY CONFIG: Configurazione caricata`, config);

            return config;
        } catch (error) {
            console.error(`❌ ASSEMBLY CONFIG: Errore caricamento ${configPath}:`, error);
            throw error;
        }
    },

    /**
     * Aggiorna UI per riflettere cambio step assemblaggio
     * @param {string} stepName - Nome del nuovo step
     * @param {Object} assemblyStatus - Stato assemblaggio
     */
    updateAssemblyStepUI: function(stepName, assemblyStatus) {
        try {
            AppConfig.log(3, `🏗️ UI UPDATE: Aggiornamento per step "${stepName}"`);

            // Aggiorna descrizione/titolo del tutorial step se presente
            const stepElement = document.querySelector('.tutorial-step-title');
            if (stepElement) {
                stepElement.textContent = `Assemblaggio: ${stepName}`;
                AppConfig.log(3, `🏗️ UI UPDATE: Titolo aggiornato`);
            }

            // Aggiorna descrizione se presente
            const descElement = document.querySelector('.tutorial-step-description');
            if (descElement) {
                const stepConfig = assemblyStatus.currentStepConfig;
                if (stepConfig && stepConfig.description) {
                    descElement.textContent = stepConfig.description;
                    AppConfig.log(3, `🏗️ UI UPDATE: Descrizione aggiornata`);
                }
            }

            // Mostra notifica di progresso (opzionale)
            const progressElement = document.querySelector('.assembly-progress');
            if (progressElement) {
                const currentIndex = assemblyStatus.currentStepIndex || 0;
                const totalSteps = assemblyStatus.totalSteps || 1;
                progressElement.textContent = `Step ${currentIndex + 1} di ${totalSteps}`;
                AppConfig.log(3, `🏗️ UI UPDATE: Progresso aggiornato: ${currentIndex + 1}/${totalSteps}`);
            }

            // IMPORTANTE: Aggiorna anche il fumetto tutorial per mostrare nuove istruzioni
            if (assemblyStatus.currentStepConfig && assemblyStatus.currentStepConfig.description) {
                try {
                    // Simula un cambio step tradizionale per aggiornare il fumetto
                    const bubbleElement = document.getElementById('stepSpeechBubble');
                    if (bubbleElement) {
                        const descriptionElement = bubbleElement.querySelector('.bubble-description');
                        if (descriptionElement) {
                            descriptionElement.textContent = assemblyStatus.currentStepConfig.description;
                            console.log(`[UI] 💬 Fumetto aggiornato con nuova descrizione step assemblaggio`);
                        }
                    }
                } catch (bubbleError) {
                    console.warn(`[UI] ⚠️ Errore aggiornamento fumetto:`, bubbleError);
                }
            }

            console.log(`[UI] ✅ UI aggiornata per step assemblaggio: ${stepName}`);
        } catch (error) {
            console.error(`[UI] ❌ Errore aggiornamento UI step assemblaggio:`, error);
        }
    },

    /**
     * Sincronizza avanzamento AssemblySystem con sistema tutorial normale
     * @param {string} stepName - Nome step AssemblySystem
     * @param {number} stepIndex - Indice step AssemblySystem
     * @param {Object} assemblyStatus - Stato assemblaggio
     */
    syncAssemblyStepWithTutorial: function(stepName, stepIndex, assemblyStatus) {
        try {
            AppConfig.log(3, `🔄 SYNC: Tentativo sincronizzazione "${stepName}" con tutorial normale`);

            // Mappa step AssemblySystem a step tutorial normale
            const assemblyToTutorialMap = {
                'filtro_assembly': 1,      // Step 1 - Assemblaggio Sequenziale Guidato
                'coperchio_assembly': 2,   // Step 2 - Coperchio
                'viti_assembly': 3,        // Step 3 - Gruppo Viti Coperchio
                'tappini_assembly': 4,     // Step 4 - Tappini e Ingrassaggio
                'ingrassatori_assembly': 5 // Step 5 - Ingrassatore Finale
            };

            const tutorialStepNumber = assemblyToTutorialMap[stepName];
            if (tutorialStepNumber) {
                AppConfig.log(2, `🔄 SYNC: Avanzamento tutorial normale da AssemblySystem: Step ${tutorialStepNumber}`);

                // Simula click su pulsante Next del tutorial per avanzare l'UI
                const nextButton = document.getElementById('nextStepBtn');
                if (nextButton && !nextButton.disabled) {
                    // Avanza manualmente lo step counter se esiste una funzione globale
                    if (window.Scene3D && typeof window.Scene3D.goToTutorialStep === 'function') {
                        window.Scene3D.goToTutorialStep(tutorialStepNumber);
                        AppConfig.log(2, `🔄 SYNC: Tutorial avanzato a step ${tutorialStepNumber} via Scene3D`);
                    } else if (typeof this.goToTutorialStep === 'function') {
                        this.goToTutorialStep(tutorialStepNumber);
                        AppConfig.log(2, `🔄 SYNC: Tutorial avanzato a step ${tutorialStepNumber} via UI`);
                    } else {
                        // Fallback: click manuale su Next button
                        nextButton.click();
                        AppConfig.log(2, `🔄 SYNC: Tutorial avanzato via click Next button`);
                    }
                } else {
                    AppConfig.log(1, `🔄 SYNC: Next button non disponibile o disabilitato`);
                }
            } else {
                AppConfig.log(3, `🔄 SYNC: Step AssemblySystem "${stepName}" non mappato a tutorial normale`);
            }
        } catch (error) {
            console.error(`[UI] ❌ Errore sincronizzazione AssemblySystem-Tutorial:`, error);
        }
    },

    /* ===== METODI HELPER PER NAVIGAZIONE RAPIDA TUTORIAL ===== */

    /**
     * Salta direttamente a uno step specifico del tutorial (numerazione umana 1-based)
     * IMPORTANTE: Applica automaticamente le trasformazioni di tutti gli step precedenti
     * @param {number} stepNumber - Numero step (1 = primo step, 2 = secondo step, etc.)
     * @param {boolean} applyPreviousSteps - Se true, applica trasformazioni step precedenti (default: true)
     * @example UI.jumpToStep(5) // Salta al 5° step applicando trasformazioni step 1-4
     */
    jumpToStep: function(stepNumber, applyPreviousSteps = true) {
        if (!this.tutorialSteps || this.tutorialSteps.length === 0) {
            console.error('❌ Nessun tutorial caricato. Carica prima uno scenario con tutorial.');
            return false;
        }

        // Converti da 1-based (umano) a 0-based (array)
        const stepIndex = stepNumber - 1;

        if (stepIndex < 0 || stepIndex >= this.tutorialSteps.length) {
            console.error(`❌ Step ${stepNumber} non valido. Step disponibili: 1-${this.tutorialSteps.length}`);
            console.log('💡 Usa UI.listTutorialSteps() per vedere tutti gli step disponibili');
            return false;
        }

        const step = this.tutorialSteps[stepIndex];
        console.log(`⏭️ Saltando allo step ${stepNumber}/${this.tutorialSteps.length}: "${step.title}"`);

        // Se richiesto, applica le trasformazioni degli step precedenti per avere lo stato corretto
        if (applyPreviousSteps && stepIndex > 0) {
            console.log(`⚡ Fast-forward: Applicazione trasformazioni step 1-${stepNumber - 1}...`);
            this.applyPreviousStepsTransformations(stepIndex);
        }

        // Chiama il metodo goToStep esistente (che usa 0-based)
        this.goToStep(stepIndex);
        return true;
    },

    /**
     * Applica tutte le trasformazioni degli step precedenti al target step
     * Questo permette di saltare a uno step con lo stato corretto della scena
     * Esegue istantaneamente sia trasformazioni statiche che animazioni
     * @param {number} targetStepIndex - Indice target step (0-based)
     */
    applyPreviousStepsTransformations: function(targetStepIndex) {
        if (!window.Scene3D) {
            console.warn('⚠️ Scene3D non disponibile per applicare trasformazioni');
            return;
        }

        let transformationsApplied = 0;
        let animationsApplied = 0;

        console.log(`⚡ Fast-forward: Applicazione stato step 1-${targetStepIndex}...`);

        // Itera tutti gli step precedenti al target
        for (let i = 0; i < targetStepIndex; i++) {
            const step = this.tutorialSteps[i];

            // 1. Applica prima le trasformazioni statiche (Posizione/Rotazione)
            if (window.Scene3D.applyModelSettings && step.properties) {
                window.Scene3D.applyModelSettings(step);

                const hasTransformations = Object.keys(step.properties).some(key =>
                    key.startsWith('Posizione') || key.startsWith('Rotazione')
                );

                if (hasTransformations) {
                    transformationsApplied++;
                }
            }

            // 2. Esegui istantaneamente le animazioni (Azione1, Azione2, ...)
            const actionsApplied = this.applyStepActionsInstantly(step, i);
            if (actionsApplied > 0) {
                animationsApplied += actionsApplied;
                console.log(`  ✓ Step ${i + 1}: "${step.title}" - ${actionsApplied} azioni eseguite`);
            }
        }

        const totalChanges = transformationsApplied + animationsApplied;
        if (totalChanges > 0) {
            console.log(`✅ Fast-forward completato: ${transformationsApplied} trasformazioni + ${animationsApplied} animazioni applicate`);
        } else {
            console.log(`ℹ️ Nessuna trasformazione da applicare negli step 1-${targetStepIndex}`);
        }
    },

    /**
     * Applica istantaneamente tutte le azioni di uno step (Azione1, Azione2, ...)
     * Calcola ed esegue le trasformazioni finali senza animazione
     * @param {Object} step - Step del tutorial
     * @param {number} stepIndex - Indice dello step (per log)
     * @returns {number} Numero di azioni applicate
     */
    applyStepActionsInstantly: function(step, stepIndex) {
        // Verifica se lo step ha un elemento da animare
        const elementoPath = step.properties.Elemento;
        if (!elementoPath) {
            return 0; // Nessuna azione da applicare se non c'è elemento
        }

        // Trova il modello nella scena
        const modelFilename = elementoPath.split('/').pop();
        const model = window.Scene3D.findModelByName(modelFilename);
        if (!model) {
            console.warn(`⚠️ Modello "${modelFilename}" non trovato per step ${stepIndex + 1}`);
            return 0;
        }

        let actionsCount = 0;

        // Cerca tutte le azioni (Azione1, Azione2, ..., Azione50)
        for (let actionNum = 1; actionNum <= 50; actionNum++) {
            const actionKey = `Azione${actionNum}`;
            const actionValue = step.properties[actionKey];

            if (!actionValue) {
                break; // Nessuna azione successiva, stop
            }

            // Applica l'azione istantaneamente
            try {
                this.applyActionInstantly(model, actionValue, modelFilename);
                actionsCount++;
            } catch (error) {
                console.error(`❌ Errore applicazione ${actionKey} step ${stepIndex + 1}:`, error);
            }
        }

        return actionsCount;
    },

    /**
     * Applica istantaneamente una singola azione a un modello
     * Supporta: traslazione, rotazione, svita, avvita, estrai, inserisci, appoggia
     * @param {THREE.Object3D} model - Modello Three.js
     * @param {string} actionString - Stringa azione (es. "traslazione:(0,0.1,0,1)")
     * @param {string} modelFilename - Nome file modello (per direzioni)
     */
    applyActionInstantly: function(model, actionString, modelFilename) {
        // Determina il tipo di azione
        const actionType = actionString.split(/[(:]/)[0];

        if (actionType === 'traslazione') {
            // Parse: traslazione:(x,y,z,durata) o traslazione:target_original,(x,y,z,durata)
            const parsed = window.Scene3D.parseMovementOperation(actionString, 'traslazione', modelFilename);

            if (parsed.targetName && parsed.targetName.endsWith('_original')) {
                // Traslazione relativa a target originale
                const targetModelName = parsed.targetName.replace('_original', '');
                const targetModel = window.Scene3D.findModelByName(targetModelName);
                if (targetModel) {
                    const targetBB = new THREE.Box3().setFromObject(targetModel);
                    const targetCenter = targetBB.getCenter(new THREE.Vector3());
                    model.position.set(
                        targetCenter.x + parsed.x,
                        targetCenter.y + parsed.y,
                        targetCenter.z + parsed.z
                    );
                }
            } else {
                // Traslazione normale
                model.position.x += parsed.x;
                model.position.y += parsed.y;
                model.position.z += parsed.z;
            }

        } else if (actionType === 'rotazione') {
            // Parse: rotazione:(rx,ry,rz,durata)
            const parsed = window.Scene3D.parseMovementOperation(actionString, 'rotazione', modelFilename);
            model.rotation.x += parsed.x * Math.PI / 180; // Converti gradi → radianti
            model.rotation.y += parsed.y * Math.PI / 180;
            model.rotation.z += parsed.z * Math.PI / 180;

        } else if (actionType === 'svita') {
            // Parse: svita o svita(distanza)
            const parsed = window.Scene3D.parseMovementOperation(actionString, 'svita', modelFilename);
            // Applica traslazione
            model.position.x += parsed.traslazione.x;
            model.position.y += parsed.traslazione.y;
            model.position.z += parsed.traslazione.z;
            // Applica rotazione
            model.rotation.x += parsed.rotazione.x * Math.PI / 180;
            model.rotation.y += parsed.rotazione.y * Math.PI / 180;
            model.rotation.z += parsed.rotazione.z * Math.PI / 180;

        } else if (actionType === 'avvita') {
            // Parse: avvita o avvita(distanza)
            const parsed = window.Scene3D.parseMovementOperation(actionString, 'avvita', modelFilename);
            // Applica traslazione
            model.position.x += parsed.traslazione.x;
            model.position.y += parsed.traslazione.y;
            model.position.z += parsed.traslazione.z;
            // Applica rotazione
            model.rotation.x += parsed.rotazione.x * Math.PI / 180;
            model.rotation.y += parsed.rotazione.y * Math.PI / 180;
            model.rotation.z += parsed.rotazione.z * Math.PI / 180;

        } else if (actionType === 'estrai') {
            // Parse: estrai o estrai(distanza)
            const parsed = window.Scene3D.parseMovementOperation(actionString, 'estrai', modelFilename);
            model.position.x += parsed.traslazione.x;
            model.position.y += parsed.traslazione.y;
            model.position.z += parsed.traslazione.z;

        } else if (actionType === 'inserisci') {
            // Parse: inserisci o inserisci(distanza)
            const parsed = window.Scene3D.parseMovementOperation(actionString, 'inserisci', modelFilename);
            model.position.x += parsed.traslazione.x;
            model.position.y += parsed.traslazione.y;
            model.position.z += parsed.traslazione.z;

        } else if (actionType === 'appoggia') {
            // Calcola bounding box e metti punto più basso a Y=0
            const boundingBox = new THREE.Box3().setFromObject(model);
            const minY = boundingBox.min.y;
            const offsetY = model.position.y - minY;
            model.position.y = offsetY;

        } else if (actionType === 'centro') {
            // Gestisce centro:(x,y,z);rotazione:(rx,ry,rz,durata)
            // Per semplicità ora ignoriamo centro (richiede cambio pivot)
            // TODO: Implementare se necessario
            console.warn(`⚠️ Azione "centro" non ancora supportata in fast-forward`);

        } else {
            console.warn(`⚠️ Tipo azione "${actionType}" non supportato in fast-forward`);
        }
    },

    /**
     * Lista tutti gli step del tutorial corrente
     * @returns {Array} Array degli step con informazioni dettagliate
     */
    listTutorialSteps: function() {
        if (!this.tutorialSteps || this.tutorialSteps.length === 0) {
            console.warn('⚠️ Nessun tutorial caricato');
            return [];
        }

        console.log(`\n📋 Tutorial caricato: ${this.tutorialSteps.length} step disponibili\n`);
        console.log('═'.repeat(80));

        this.tutorialSteps.forEach((step, index) => {
            const stepNumber = index + 1;
            const isCurrent = (index === this.currentStepIndex);
            const marker = isCurrent ? '👉' : '  ';
            const title = step.title || 'Senza titolo';
            const description = step.properties.Descrizione || '';

            console.log(`${marker} Step ${stepNumber}: ${title}`);
            if (description) {
                console.log(`     └─ ${description}`);
            }

            // Mostra proprietà chiave dello step
            const keyProps = [];
            if (step.properties.Elemento) keyProps.push(`Elemento: ${step.properties.Elemento}`);
            if (step.properties.Utensile) keyProps.push(`Utensile: ${step.properties.Utensile}`);
            if (step.properties.DragDrop) keyProps.push('DragDrop attivo');
            if (step.properties.AssemblyMode) keyProps.push('Assembly attivo');

            if (keyProps.length > 0) {
                console.log(`     └─ ${keyProps.join(' | ')}`);
            }
        });

        console.log('═'.repeat(80));
        console.log(`\n💡 Usa UI.jumpToStep(N) per saltare a uno step specifico`);
        console.log(`💡 Step corrente: ${this.currentStepIndex + 1}\n`);

        return this.tutorialSteps.map((step, index) => ({
            number: index + 1,
            title: step.title,
            description: step.properties.Descrizione,
            isCurrent: (index === this.currentStepIndex)
        }));
    },

    /**
     * Cerca e salta a uno step per nome/titolo (ricerca parziale case-insensitive)
     * @param {string} searchTerm - Termine di ricerca nel titolo dello step
     * @example UI.jumpToStepByName("rimuovi vite") // Cerca step con "rimuovi vite" nel titolo
     */
    jumpToStepByName: function(searchTerm) {
        if (!this.tutorialSteps || this.tutorialSteps.length === 0) {
            console.error('❌ Nessun tutorial caricato. Carica prima uno scenario con tutorial.');
            return false;
        }

        const search = searchTerm.toLowerCase();
        const matches = [];

        this.tutorialSteps.forEach((step, index) => {
            const title = (step.title || '').toLowerCase();
            const description = (step.properties.Descrizione || '').toLowerCase();

            if (title.includes(search) || description.includes(search)) {
                matches.push({
                    number: index + 1,
                    index: index,
                    title: step.title,
                    description: step.properties.Descrizione
                });
            }
        });

        if (matches.length === 0) {
            console.error(`❌ Nessuno step trovato con "${searchTerm}"`);
            console.log('💡 Usa UI.listTutorialSteps() per vedere tutti gli step disponibili');
            return false;
        }

        if (matches.length === 1) {
            const match = matches[0];
            console.log(`✅ Trovato: Step ${match.number} - ${match.title}`);
            this.goToStep(match.index);
            return true;
        }

        // Multiple matches - mostra lista
        console.log(`🔍 Trovati ${matches.length} step che contengono "${searchTerm}":\n`);
        matches.forEach(match => {
            console.log(`   ${match.number}. ${match.title}`);
            if (match.description) {
                console.log(`      └─ ${match.description}`);
            }
        });
        console.log(`\n💡 Usa UI.jumpToStep(N) per saltare a uno specifico step`);

        return matches;
    },

    /* ═══════════════════════════════════════════════════════════════
     * GESTIONE PULSANTE RESET CAMERA STEP
     * ═══════════════════════════════════════════════════════════════ */

    /**
     * Imposta la posizione del pulsante reset camera.
     * @param {string} position - 'top-right'|'top-left'|'top-center'|'bottom-right'|'bottom-left'|'bottom-center'
     */
    setResetCameraPosition: function(position) {
        const valid = ['top-right', 'top-left', 'top-center', 'bottom-right', 'bottom-left', 'bottom-center'];
        if (!valid.includes(position)) {
            console.warn(`⚠️ [UI] Posizione non valida: "${position}". Valori validi: ${valid.join(', ')}`);
            return;
        }
        this.resetCameraPosition = position;
        const btn = document.getElementById('resetCameraBtn');
        if (btn) {
            valid.forEach(p => btn.classList.remove('pos-' + p));
            btn.classList.add('pos-' + position);
            // Preview temporaneo: mostra il pulsante brevemente per confermare la posizione
            const wasHidden = btn.classList.contains('hidden');
            if (wasHidden && this.currentPage !== 'home') {
                btn.removeAttribute('style');
                btn.classList.remove('hidden');
                setTimeout(() => {
                    if (!this.stepCameraState) { // Risconde solo se non c'è uno step attivo
                        btn.classList.add('hidden');
                    }
                }, 1500);
            }
        }
        console.log(`📷 [UI] Posizione pulsante reset camera impostata: ${position}`);
    },

    /**
     * Mostra il pulsante reset camera
     */
    showResetCameraButton: function() {
        // GUARD: Non mostrare se siamo sulla home page
        if (this.currentPage === 'home') {
            console.log('📷 [UI] showResetCameraButton BLOCCATO - siamo sulla home page');
            return;
        }

        const btn = document.getElementById('resetCameraBtn');
        if (btn) {
            // Rimuovi TUTTO l'inline style (inclusi visibility:hidden !important impostati da goHome)
            btn.removeAttribute('style');
            btn.classList.remove('hidden');
            // Applica SEMPRE la posizione corrente (resetCameraPosition è source of truth)
            const valid = ['top-right', 'top-left', 'top-center', 'bottom-right', 'bottom-left', 'bottom-center'];
            valid.forEach(p => btn.classList.remove('pos-' + p));
            btn.classList.add('pos-' + (this.resetCameraPosition || 'bottom-left'));
            console.log(`📷 [UI] Pulsante reset camera mostrato in posizione: ${this.resetCameraPosition || 'bottom-left'}`);
        }
    },

    /**
     * Nasconde il pulsante reset camera
     */
    hideResetCameraButton: function() {
        const btn = document.getElementById('resetCameraBtn');
        if (btn) {
            // Rimuovi eventuali classi di animazione
            btn.classList.remove('pulse');

            // Aggiungi classe hidden
            btn.classList.add('hidden');

            // Force inline style per extra sicurezza
            btn.style.display = 'none';

            console.log('📷 [UI] Pulsante reset camera nascosto');
        }
    },

    /**
     * Ripristina la camera alla posizione iniziale dello step corrente
     */
    resetCameraToStepPosition: function() {
        if (!this.stepCameraState) {
            console.warn('⚠️ [UI] Nessuna posizione camera salvata per questo step');
            return false;
        }

        if (!window.Scene3D || typeof window.Scene3D.setCameraFromInfo !== 'function') {
            console.error('❌ [UI] Scene3D.setCameraFromInfo non disponibile');
            return false;
        }

        // Ripristina camera alla posizione memorizzata
        window.Scene3D.setCameraFromInfo({
            position: this.stepCameraState.position,
            rotation: this.stepCameraState.rotation,
            pivot: this.stepCameraState.pivot,
            distance: this.stepCameraState.distance,
            fov: this.stepCameraState.fov,
            animate: true,
            duration: 0.8
        });

        console.log('📷 [UI] Camera ripristinata alla posizione iniziale dello step');

        // Animazione pulsante per feedback visivo
        const btn = document.getElementById('resetCameraBtn');
        if (btn) {
            btn.classList.add('animating');
            setTimeout(() => {
                btn.classList.remove('animating');
            }, 600);
        }

        return true;
    },

    // ═══════════════════════════════════════════════════════════
    // OVERLAY SELEZIONE TUTORIAL
    // ═══════════════════════════════════════════════════════════

    /**
     * Mostra overlay "Seleziona un Tutorial" con pulsanti pulsanti
     */
    showTutorialSelectionOverlay: function() {
        const overlay = document.getElementById('tutorialSelectionOverlay');
        if (!overlay) {
            console.warn('⚠️ Overlay selezione tutorial non trovato');
            return;
        }

        // Mostra overlay
        overlay.classList.add('show');
        console.log('📚 [UI] Overlay selezione tutorial mostrato');

        // Alza z-index della barra tutorial sopra l'overlay
        const stepsBar = document.getElementById('tutorialStepsBar');
        if (stepsBar) stepsBar.classList.add('tutorial-above-overlay');

        // Aggiungi animazione pulse ai pulsanti tutorial (step-indicator blu)
        const tutorialButtons = document.querySelectorAll('.step-indicator');
        tutorialButtons.forEach(btn => {
            btn.classList.add('pulse-tutorial', 'tutorial-above-overlay');
        });

        // Rimuovi solo animazione pulse dopo 2 secondi (2 cicli completi)
        // tutorial-above-overlay rimane fino a hideTutorialSelectionOverlay()
        setTimeout(() => {
            tutorialButtons.forEach(btn => {
                btn.classList.remove('pulse-tutorial');
            });
            console.log('✅ [UI] Animazione pulse pulsanti completata');
        }, 2000);

        // Nascondi overlay automaticamente dopo 5 secondi
        setTimeout(() => {
            this.hideTutorialSelectionOverlay();
        }, 2000);

        // Nascondi overlay al click su qualsiasi pulsante tutorial
        tutorialButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.hideTutorialSelectionOverlay();
            }, { once: true }); // Solo una volta
        });

        // Nascondi overlay al click sull'overlay stesso
        overlay.addEventListener('click', () => {
            this.hideTutorialSelectionOverlay();
        }, { once: true });
    },

    /**
     * Nasconde overlay selezione tutorial
     */
    hideTutorialSelectionOverlay: function() {
        const overlay = document.getElementById('tutorialSelectionOverlay');
        if (!overlay) return;

        overlay.classList.remove('show');

        // Rimuovi z-index elevato dalla barra e dai pulsanti
        const stepsBar = document.getElementById('tutorialStepsBar');
        if (stepsBar) stepsBar.classList.remove('tutorial-above-overlay');
        document.querySelectorAll('.step-indicator').forEach(btn => {
            btn.classList.remove('tutorial-above-overlay', 'pulse-tutorial');
        });

        console.log('❌ [UI] Overlay selezione tutorial nascosto');
    }
};

/* ===== FUNZIONI GLOBALI PER COMPATIBILITÀ ===== */
// Queste funzioni vengono chiamate dagli onclick nell'HTML

window.goHome = function() {
    if (window.UI) window.UI.goHome();
};

window.executeScenario = function() {
    if (window.UI) window.UI.executeScenario();
};

window.clearAll = function() {
    if (window.UI) window.UI.clearAll();
};

window.resetView = function() {
    if (window.UI) window.UI.resetView();
};

window.startAnimation = function() {
    if (window.UI) window.UI.startAnimation();
};

window.hideError = function() {
    if (window.UI) window.UI.hideError();
};

/* ===== FUNZIONI GLOBALI PER NAVIGAZIONE TUTORIAL ===== */
// Shortcuts per accesso rapido dalla console durante sviluppo/testing

/**
 * Salta a uno step specifico del tutorial
 * @param {number} stepNumber - Numero step (1-based)
 * @example jumpToStep(5) // Salta al 5° step
 */
window.jumpToStep = function(stepNumber) {
    if (window.UI && typeof window.UI.jumpToStep === 'function') {
        return window.UI.jumpToStep(stepNumber);
    }
    console.error('❌ UI.jumpToStep non disponibile');
    return false;
};

/**
 * Lista tutti gli step del tutorial corrente
 * @example listSteps() // Mostra tutti gli step disponibili
 */
window.listSteps = function() {
    if (window.UI && typeof window.UI.listTutorialSteps === 'function') {
        return window.UI.listTutorialSteps();
    }
    console.error('❌ UI.listTutorialSteps non disponibile');
    return [];
};

/**
 * Cerca e salta a uno step per nome
 * @param {string} searchTerm - Termine di ricerca
 * @example findStep("vite") // Cerca step con "vite" nel nome
 */
window.findStep = function(searchTerm) {
    if (window.UI && typeof window.UI.jumpToStepByName === 'function') {
        return window.UI.jumpToStepByName(searchTerm);
    }
    console.error('❌ UI.jumpToStepByName non disponibile');
    return false;
};

} // Fine if statement del sistema legacy