/**
 * ui-coordinator.js - Coordinatore UI Refactorizzato
 *
 * Questo file mantiene tutte le API pubbliche del sistema UI originale
 * ma delega le responsabilità ai moduli specializzati:
 * - UICore: Inizializzazione, navigazione, feedback utente
 * - ScenarioManager: Gestione scenari, configurazioni, caricamento modelli
 * - TutorialManager: Sistema tutorial, steps, fumetti
 * - ToolsManager: Gestione strumenti, cursori, legenda
 *
 * COMPATIBILITÀ: 100% backward compatible con il codice esistente
 *
 * Versione: 2.0 Refactored
 * Data: Dicembre 2025
 */

// Import dei moduli refactorizzati (quando saranno disponibili come ES modules)
// import UICore from './UICore.js';
// import ScenarioManager from './ScenarioManager.js';
// import TutorialManager from './TutorialManager.js';
// import ToolsManager from './ToolsManager.js';

const UI = {
    // === CORE COMPONENTS ===
    core: null,
    _scenarioManager: null,
    _tutorialManager: null,
    _toolsManager: null,

    // Camera reset state
    stepCameraState: null,

    // === LEGACY PROPERTIES FOR COMPATIBILITY ===
    // These properties delegate to the appropriate managers
    get currentPage() { return this.core?.currentPage || 'home'; },
    get scenariosConfig() { return this._scenarioManager?.scenariosConfig || null; },
    get currentScenario() { return this._scenarioManager?.currentScenario || null; },
    get homeConfig() { return this._scenarioManager?.homeConfig || null; },
    get elements() { return this.core?.elements || {}; },

    // Manager instances (CRITICAL: Needed for DragDropSystem integration)
    get tutorialManager() { return this._tutorialManager; },
    get scenarioManager() { return this._scenarioManager; },
    get toolsManager() { return this._toolsManager; },

    // Tutorial system properties
    get tutorialSteps() { return this._tutorialManager?.tutorialSteps || []; },
    get availableTutorials() { return this._tutorialManager?.availableTutorials || []; },
    get currentTutorial() { return this._tutorialManager?.currentTutorial || null; },
    get currentStepIndex() { return this._tutorialManager?.currentStepIndex || 0; },

    // Tools system properties
    get toolsState() { return this._toolsManager?.toolsState || {}; },

    // === INITIALIZATION ===

    /**
     * Inizializza il sistema UI refactorizzato
     */
    init: function() {
        try {
            console.log('[UI] 🚀 Inizializzazione sistema UI refactorizzato...');

            // Initialize core components
            this.initializeModules();

            // Initialize systems in order
            if (!this.core.init()) {
                throw new Error('UICore initialization failed');
            }

            if (!this._scenarioManager.init()) {
                throw new Error('ScenarioManager initialization failed');
            }

            if (!this._tutorialManager.init()) {
                throw new Error('TutorialManager initialization failed');
            }

            if (!this._toolsManager.init()) {
                throw new Error('ToolsManager initialization failed');
            }

            // Set up cross-references and dependencies
            this.setupCrossReferences();

            // Load initial configuration
            this._scenarioManager.loadHomeConfigFromServer();
            this.loadInterfaceConfig();

            console.log('[UI] ✅ Sistema UI refactorizzato inizializzato con successo');
            return true;

        } catch (error) {
            console.error('[UI] ❌ Errore inizializzazione sistema UI refactorizzato:', error.message);
            return false;
        }
    },

    /**
     * Initialize the specialized modules
     */
    initializeModules: function() {
        // Create instances of the specialized managers
        if (window.UICore) {
            this.core = new window.UICore();
        } else {
            throw new Error('UICore not available');
        }

        if (window.ScenarioManager) {
            this._scenarioManager = new window.ScenarioManager();
        } else {
            throw new Error('ScenarioManager not available');
        }

        if (window.TutorialManager) {
            this._tutorialManager = new window.TutorialManager();
        } else {
            throw new Error('TutorialManager not available');
        }

        if (window.ToolsManager) {
            this._toolsManager = new window.ToolsManager();
        } else {
            throw new Error('ToolsManager not available');
        }

        console.log('[UI] 📦 Moduli UI specializzati inizializzati');
    },

    /**
     * Setup cross-references between modules
     */
    setupCrossReferences: function() {
        // Cross-reference managers for inter-module communication
        this._scenarioManager.core = this.core;
        this._scenarioManager.tutorialManager = this._tutorialManager;

        this._tutorialManager.core = this.core;
        this._tutorialManager.scenarioManager = this._scenarioManager;
        this._tutorialManager.toolsManager = this._toolsManager;

        this._toolsManager.core = this.core;

        console.log('[UI] 🔗 Cross-references configurate tra moduli');
    },

    // === CORE API METHODS (DELEGATED) ===

    /**
     * Log sicuro che funziona anche se AppConfig non è caricato
     */
    safeLog: function(level, message, ...args) {
        return this.core.safeLog(level, message, ...args);
    },

    /**
     * Cachea i riferimenti agli elementi DOM
     */
    cacheElements: function() {
        return this.core.cacheElements();
    },

    /**
     * Configura tutti gli event listeners
     */
    setupEventListeners: function() {
        return this.core.setupEventListeners();
    },

    /**
     * Mostra una pagina specifica
     */
    showPage: function(page) {
        if (this.core && this.core.showPage) {
            return this.core.showPage(page);
        } else {
            // FALLBACK: Implementazione diretta
            console.log(`🏠 UI-COORDINATOR: Fallback showPage('${page}')`);

            // Nascondi tutte le pagine
            const homePage = document.getElementById('homePage');
            const scenarioPage = document.getElementById('scenarioPage');

            if (homePage) homePage.classList.add('hidden');
            if (scenarioPage) scenarioPage.classList.add('hidden');

            // Mostra la pagina richiesta
            if (page === 'home' && homePage) {
                homePage.classList.remove('hidden');
                this.currentPage = 'home';
            } else if (page === 'scenario' && scenarioPage) {
                scenarioPage.classList.remove('hidden');
                this.currentPage = 'scenario';
            }
        }
    },

    /**
     * Torna alla home page
     */
    goHome: function() {
        if (this.core && this.core.goHome) {
            return this.core.goHome();
        } else {
            // FALLBACK: RESET COMPLETO prima di tornare alla home
            console.log('🏠 UI-COORDINATOR: Fallback goHome() - reset completo');

            // === RESET CURSORI E TOOL ===
            if (window.UI && window.UI.toolsManager) {
                window.UI.toolsManager.deactivateAllTools();
            }

            // Ferma animazioni cursore
            if (window.Scene3D && window.Scene3D.stopCursorAnimation) {
                window.Scene3D.stopCursorAnimation();
            }

            // Rimuovi TUTTE le classi cursori
            document.body.classList.remove(
                'tool-aria-active',
                'tool-chiave_inglese-active',
                'tool-brugola-active',
                'tool-mano-active',
                'cursor-frame-1',
                'cursor-frame-2',
                'mouse-pressed'
            );
            document.body.style.cursor = '';

            const canvas = document.querySelector('#canvas3d, canvas');
            if (canvas) {
                canvas.classList.remove('cursor-default', 'cursor-mano', 'cursor-brugola', 'cursor-chiave', 'cursor-aria');
                canvas.style.cursor = '';
            }

            // === RESET SISTEMI ===
            if (window.DragDropSystem) {
                if (window.DragDropSystem.disable) window.DragDropSystem.disable();
                if (window.DragDropSystem.resetSnapTracking) window.DragDropSystem.resetSnapTracking();
            }

            if (window.AssemblySystem && window.AssemblySystem.disableAssemblyMode) {
                window.AssemblySystem.disableAssemblyMode();
            }

            if (window.Scene3D && window.Scene3D.clearAllModels) {
                window.Scene3D.clearAllModels();
            }

            if (window.ParticleSystem && window.ParticleSystem.clearAllEffects) {
                window.ParticleSystem.clearAllEffects();
            }

            if (window.AutoMode && window.AutoMode.enabled) {
                window.AutoMode.enabled = false;
                window.AutoMode.isExecuting = false;
            }

            // Nascondi modali
            const congratsModal = document.querySelector('.congratulations-modal');
            if (congratsModal) congratsModal.classList.remove('show');

            const infoModal = document.getElementById('infoModal');
            if (infoModal) infoModal.style.display = 'none';

            console.log('🏠 UI-COORDINATOR: Reset completo terminato');

            this.showPage('home');
            this.updateStatus('Torna alla pagina principale');
        }
    },

    /**
     * Aggiorna messaggio di stato
     */
    updateStatus: function(message) {
        if (this.core && this.core.updateStatus) {
            return this.core.updateStatus(message);
        } else {
            // FALLBACK: Implementazione diretta
            console.log(`ℹ️ UI-COORDINATOR: Fallback updateStatus('${message}')`);
            const statusElement = document.getElementById('statusMessage');
            if (statusElement) {
                statusElement.textContent = message;
            }
        }
    },

    /**
     * Mostra loader
     */
    showLoader: function(message = 'Caricamento...') {
        return this.core.showLoader(message);
    },

    /**
     * Nasconde loader
     */
    hideLoader: function() {
        return this.core.hideLoader();
    },

    /**
     * Mostra messaggio di errore
     */
    showError: function(message) {
        return this.core.showError(message);
    },

    /**
     * Nasconde messaggio di errore
     */
    hideError: function() {
        return this.core.hideError();
    },

    // === SCENARIO MANAGEMENT API (DELEGATED) ===

    /**
     * Callback selezione scenario da home config
     */
    onHomeConfigSelected: function(event) {
        return this._scenarioManager.onHomeConfigSelected(event);
    },

    /**
     * Carica configurazione home dal server
     */
    loadHomeConfigFromServer: function() {
        return this._scenarioManager.loadHomeConfigFromServer();
    },

    /**
     * Parsa configurazione home
     */
    parseHomeConfig: function(content) {
        return this._scenarioManager.parseHomeConfig(content);
    },

    /**
     * Carica e applica InterfaceConfig.cvtscript.
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
                        console.log('[UI] ✅ InterfaceConfig.cvtscript caricato via IPC (Electron)');
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
                console.log('[UI] ✅ InterfaceConfig.cvtscript caricato');
                this.parseInterfaceConfig(content);
            })
            .catch(() => {
                // File opzionale - nessun errore se assente
            });
    },

    /**
     * Parsa il contenuto di InterfaceConfig.txt e applica le impostazioni
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
                    console.log(`📷 [UI] InterfaceConfig: ResetCameraButton.Position = ${value}`);
                }
            }

            if (currentSection === 'CameraControls' && line.includes('=')) {
                const [key, value] = line.split('=', 2).map(s => s.trim());
                window.InterfaceConfig = window.InterfaceConfig || {};
                window.InterfaceConfig.camera = window.InterfaceConfig.camera || {};
                if (key === 'InvertVertical') {
                    window.InterfaceConfig.camera.invertVertical = (value === 'true');
                    console.log(`🎥 [UI] InterfaceConfig: CameraControls.InvertVertical = ${value}`);
                } else if (key === 'InvertHorizontal') {
                    window.InterfaceConfig.camera.invertHorizontal = (value === 'true');
                    console.log(`🎥 [UI] InterfaceConfig: CameraControls.InvertHorizontal = ${value}`);
                } else if (key === 'PinchSensitivity') {
                    const v = parseFloat(value);
                    if (!isNaN(v) && v > 0) window.InterfaceConfig.camera.pinchSensitivity = v;
                    console.log(`🎥 [UI] InterfaceConfig: CameraControls.PinchSensitivity = ${value}`);
                } else if (key === 'InvertPinchZoom') {
                    window.InterfaceConfig.camera.invertPinchZoom = (value === 'true');
                    console.log(`🎥 [UI] InterfaceConfig: CameraControls.InvertPinchZoom = ${value}`);
                } else if (key === 'ScrollSensitivity') {
                    const v = parseFloat(value);
                    if (!isNaN(v) && v > 0) window.InterfaceConfig.camera.scrollSensitivity = v;
                    console.log(`🎥 [UI] InterfaceConfig: CameraControls.ScrollSensitivity = ${value}`);
                } else if (key === 'InvertScrollZoom') {
                    window.InterfaceConfig.camera.invertScrollZoom = (value === 'true');
                    console.log(`🎥 [UI] InterfaceConfig: CameraControls.InvertScrollZoom = ${value}`);
                } else if (key === 'ZoomMin') {
                    const v = parseFloat(value);
                    if (!isNaN(v) && v > 0) window.InterfaceConfig.camera.zoomMin = v;
                    console.log(`🎥 [UI] InterfaceConfig: CameraControls.ZoomMin = ${value}`);
                } else if (key === 'ZoomMax') {
                    const v = parseFloat(value);
                    if (!isNaN(v) && v > 0) window.InterfaceConfig.camera.zoomMax = v;
                    console.log(`🎥 [UI] InterfaceConfig: CameraControls.ZoomMax = ${value}`);
                }
            }
        }
    },

    /**
     * Renderizza le carte degli scenari
     */
    renderScenarioCards: function() {
        return this._scenarioManager.renderScenarioCards();
    },

    /**
     * Crea una carta scenario
     */
    createScenarioCard: function(scenario, index) {
        return this._scenarioManager.createScenarioCard(scenario, index);
    },

    /**
     * Crea carta modalità manuale
     */
    createManualModeCard: function() {
        return this._scenarioManager.createManualModeCard();
    },

    /**
     * Gestisce click su carta scenario
     */
    onScenarioCardClick: function(event) {
        return this._scenarioManager.onScenarioCardClick(event);
    },

    /**
     * Carica uno scenario
     */
    loadScenario: function(scenario) {
        return this._scenarioManager.loadScenario(scenario);
    },

    /**
     * Applica configurazione scenario
     */
    applyScenarioConfiguration: function(scenario) {
        return this._scenarioManager.applyScenarioConfiguration(scenario);
    },

    /**
     * Applica luci scenario
     */
    applyScenarioLights: function(scenario) {
        return this._scenarioManager.applyScenarioLights(scenario);
    },

    /**
     * Carica modelli scenario
     */
    loadScenarioModels: function(scenario) {
        return this._scenarioManager.loadScenarioModels(scenario);
    },

    /**
     * Carica modelli da URL
     */
    loadModelsFromUrls: function(modelUrls) {
        return this._scenarioManager.loadModelsFromUrls(modelUrls);
    },

    /**
     * Callback selezione modelli
     */
    onModelsSelected: function(event) {
        return this._scenarioManager.onModelsSelected(event);
    },

    /**
     * Callback progresso caricamento modelli
     */
    onModelLoadProgress: function(message, progress) {
        return this._scenarioManager.onModelLoadProgress(message, progress);
    },

    /**
     * Callback completamento caricamento modelli
     */
    onModelLoadComplete: function(models) {
        return this._scenarioManager.onModelLoadComplete(models);
    },

    /**
     * Callback errore caricamento modelli
     */
    onModelLoadError: function(error) {
        return this._scenarioManager.onModelLoadError(error);
    },

    /**
     * Callback selezione animazione
     */
    onAnimationSelected: function(event) {
        return this._scenarioManager.onAnimationSelected(event);
    },

    /**
     * Mostra progress bar modelli
     */
    showModelProgressBar: function(totalFiles = 0) {
        return this._scenarioManager.showModelProgressBar(totalFiles);
    },

    /**
     * Aggiorna progresso modelli
     */
    updateModelProgress: function(currentFile, totalFiles, fileName = '', percentage = null) {
        return this._scenarioManager.updateModelProgress(currentFile, totalFiles, fileName, percentage);
    },

    /**
     * Nasconde progress bar modelli
     */
    hideModelProgressBar: function() {
        return this._scenarioManager.hideModelProgressBar();
    },

    /**
     * Esegue scenario
     */
    executeScenario: function() {
        return this._scenarioManager.executeScenario();
    },

    /**
     * Pulisce tutto
     */
    clearAll: function() {
        return this._scenarioManager.clearAll();
    },

    /**
     * Crea controlli visibilità modelli
     */
    createModelVisibilityControls: function() {
        return this._scenarioManager.createModelVisibilityControls();
    },

    /**
     * Nasconde controlli visibilità modelli
     */
    hideModelVisibilityControls: function() {
        return this._scenarioManager.hideModelVisibilityControls();
    },

    // === TUTORIAL MANAGEMENT API (DELEGATED) ===

    /**
     * Carica tutorial
     */
    loadTutorial: function(tutorialPath) {
        return this._tutorialManager.loadTutorial(tutorialPath);
    },

    /**
     * Parsa contenuto tutorial
     */
    parseTutorialContent: function(content) {
        return this._tutorialManager.parseTutorialContent(content);
    },

    /**
     * Seleziona tutorial
     */
    selectTutorial: function(tutorialIndex) {
        return this._tutorialManager.selectTutorial(tutorialIndex);
    },

    /**
     * Crea barra steps tutorial
     */
    createTutorialStepsBar: function() {
        return this._tutorialManager.createTutorialStepsBar();
    },

    /**
     * Mostra barra steps tutorial
     */
    showTutorialStepsBar: function() {
        return this._tutorialManager.showTutorialStepsBar();
    },

    /**
     * Nasconde barra steps tutorial
     */
    hideTutorialStepsBar: function() {
        return this._tutorialManager.hideTutorialStepsBar();
    },

    /**
     * Va a uno step specifico
     */
    goToStep: function(stepIndex) {
        return this._tutorialManager.goToStep(stepIndex);
    },

    /**
     * Esegue uno step del tutorial
     */
    executeStep: function(step) {
        return this._tutorialManager.executeStep(step);
    },

    /**
     * Mostra fumetto step
     */
    showStepSpeechBubble: function() {
        return this._tutorialManager.showStepSpeechBubble();
    },

    /**
     * Nasconde fumetto step
     */
    hideStepSpeechBubble: function() {
        return this._tutorialManager.hideStepSpeechBubble();
    },

    /**
     * Aggiorna fumetto step
     */
    updateStepSpeechBubble: function() {
        return this._tutorialManager.updateStepSpeechBubble();
    },

    /**
     * Effetto flash fumetto
     */
    flashStepBubble: function() {
        return this._tutorialManager.flashStepBubble();
    },

    /**
     * Effetto pulse fumetto
     */
    pulseStepBubble: function() {
        return this._tutorialManager.pulseStepBubble();
    },

    // === RESET CAMERA BUTTON API ===

    /**
     * Posizione corrente del pulsante reset camera.
     * Valori: 'top-right' | 'top-left' | 'top-center' | 'bottom-right' | 'bottom-left' | 'bottom-center'
     */
    resetCameraPosition: 'bottom-right',

    /**
     * Imposta la posizione del pulsante reset camera.
     * @param {string} position
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
     * Mostra il pulsante reset camera.
     */
    showResetCameraButton: function() {
        if (this.currentPage === 'home') return;
        const btn = document.getElementById('resetCameraBtn');
        if (btn) {
            btn.removeAttribute('style');
            btn.classList.remove('hidden');
            // Applica SEMPRE la posizione corrente (resetCameraPosition è source of truth)
            const valid = ['top-right', 'top-left', 'top-center', 'bottom-right', 'bottom-left', 'bottom-center'];
            valid.forEach(p => btn.classList.remove('pos-' + p));
            btn.classList.add('pos-' + (this.resetCameraPosition || 'bottom-right'));
            console.log(`📷 [UI] Pulsante reset camera mostrato in posizione: ${this.resetCameraPosition || 'bottom-right'}`);
        }
    },

    /**
     * Nasconde il pulsante reset camera.
     */
    hideResetCameraButton: function() {
        const btn = document.getElementById('resetCameraBtn');
        if (btn) {
            btn.classList.remove('pulse', 'animating');
            btn.classList.add('hidden');
            btn.style.display = 'none';
            console.log('📷 [UI] Pulsante reset camera nascosto');
        }
    },

    /**
     * Ripristina la camera alla posizione iniziale dello step corrente.
     */
    resetCameraToStepPosition: function() {
        const state = this.stepCameraState;
        if (!state) {
            console.warn('⚠️ [UI] Nessuna posizione camera salvata per questo step');
            return false;
        }
        if (window.Scene3D && typeof window.Scene3D.setCameraFromInfo === 'function') {
            window.Scene3D.setCameraFromInfo({ ...state, animate: true, duration: 0.8 });
            const btn = document.getElementById('resetCameraBtn');
            if (btn) {
                btn.classList.add('animating');
                setTimeout(() => btn.classList.remove('animating'), 700);
            }
            console.log('📷 [UI] Camera ripristinata alla posizione dello step');
            return true;
        }
        return false;
    },

    // === TOOLS MANAGEMENT API (DELEGATED) ===

    /**
     * Inizializza legenda strumenti
     */
    initToolsLegend: function() {
        return this._toolsManager.initToolsLegend();
    },

    /**
     * Attiva/disattiva strumento
     */
    toggleTool: function(toolName) {
        return this._toolsManager.toggleTool(toolName);
    },

    /**
     * Disattiva strumento
     */
    deactivateTool: function(toolName) {
        return this._toolsManager.deactivateTool(toolName);
    },

    /**
     * Disattiva tutti gli strumenti
     */
    deactivateAllTools: function() {
        return this._toolsManager.deactivateAllTools();
    },

    /**
     * Ottiene stato strumento
     */
    getToolState: function(toolName) {
        return this._toolsManager.getToolState(toolName);
    },

    /**
     * Ottiene strumento attivo
     */
    getActiveTool: function() {
        return this._toolsManager.getActiveTool();
    },

    /**
     * Callback cambio stato strumento
     */
    onToolStateChanged: function(toolName, isActive) {
        return this._toolsManager.onToolStateChanged(toolName, isActive);
    },

    /**
     * Aggiorna cursore canvas
     */
    updateCanvasCursor: function() {
        return this._toolsManager.updateCanvasCursor();
    },

    /**
     * Mappa nome strumento tutorial
     */
    mapToolName: function(tutorialToolName) {
        return this._toolsManager.mapToolName(tutorialToolName);
    },

    /**
     * Evidenzia strumento richiesto
     */
    highlightRequiredTool: function(toolName) {
        return this._toolsManager.highlightRequiredTool(toolName);
    },

    // === UTILITY METHODS ===

    /**
     * Callback mostrata pagina scenario
     */
    onScenarioPageShown: function() {
        return this.core.onScenarioPageShown();
    },

    /**
     * Parsa Vector3
     */
    parseVector3: function(vectorString) {
        return this._scenarioManager.parseVector3(vectorString);
    },

    /**
     * Parsa configurazione luce
     */
    parseLightConfig: function(lightString) {
        return this._scenarioManager.parseLightConfig(lightString);
    },

    /**
     * Parsa configurazione luce direzionale
     */
    parseDirectionalLightConfig: function(lightString) {
        return this._scenarioManager.parseDirectionalLightConfig(lightString);
    },

    // === DEBUGGING AND STATS ===

    /**
     * Ottiene informazioni sistema
     */
    getSystemInfo: function() {
        return {
            core: !!this.core,
            scenarioManager: !!this._scenarioManager,
            tutorialManager: !!this._tutorialManager,
            toolsManager: !!this._toolsManager,
            coreState: this.core ? this.core.getState() : null,
            scenarioState: this._scenarioManager ? this._scenarioManager.getState() : null,
            tutorialState: this._tutorialManager ? this._tutorialManager.getState() : null,
            toolsState: this._toolsManager ? this._toolsManager.getState() : null
        };
    },

    /**
     * Cleanup risorse
     */
    dispose: function() {
        if (this._toolsManager) {
            this._toolsManager.dispose();
        }
        if (this._tutorialManager) {
            this._tutorialManager.dispose();
        }
        if (this._scenarioManager) {
            this._scenarioManager.dispose();
        }
        if (this.core) {
            this.core.dispose();
        }

        console.log('[UI] 🧹 Cleanup sistema UI refactorizzato completato');
    }
};

// Backup reference to original UI if it exists
if (window.UI && window.UI !== UI) {
    window.UI_Original = window.UI;
    console.log('[UI] 💾 Original UI backed up to UI_Original');
}

// Export the refactored UI
window.UI = UI;

console.log('[UI] 🏗️ Sistema UI refactorizzato caricato - API backward compatible mantenute');
console.log('[ui-coordinator] ✅ Modulo caricato e window.UI sostituito con sistema refactorizzato');