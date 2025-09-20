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
        return this.core.showPage(page);
    },

    /**
     * Torna alla home page
     */
    goHome: function() {
        return this.core.goHome();
    },

    /**
     * Aggiorna messaggio di stato
     */
    updateStatus: function(message) {
        return this.core.updateStatus(message);
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