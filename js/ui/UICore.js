/**
 * UICore.js - Modulo principale coordinatore UI
 * 
 * Gestisce l'inizializzazione e coordinamento di tutti i moduli UI.
 * Fornisce un'interfaccia unificata e logging sicuro.
 */

window.UICore = {
    
    // Moduli gestiti
    modules: {},
    
    // Stato di inizializzazione
    initialized: false,
    
    /**
     * Log sicuro che funziona anche se AppConfig non è caricato
     */
    safeLog: function(level, message, ...args) {
        if (window.AppConfig && AppConfig.log) {
            AppConfig.log(level, message, ...args);
        } else {
            const levelNames = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
            const levelName = levelNames[level] || 'LOG';
            console.log(`[${levelName}] UICore: ${message}`, ...args);
        }
    },
    
    /**
     * Inizializza tutti i moduli UI
     */
    init: function() {
        this.safeLog(2, 'Inizializzazione UICore...');
        
        try {
            // Inizializza moduli in ordine di dipendenza
            this.initFeedbackManager();
            this.initPageManager();
            this.initScenarioManager();
            this.initModelManager();
            this.initTutorialManager();
            this.initToolsManager();
            this.initMobileControlsManager();
            
            // Setup event listeners globali
            this.setupGlobalEventListeners();
            
            // Inizializzazione completata
            this.initialized = true;
            this.safeLog(2, 'UICore inizializzato con successo');
            
            // Mostra pagina iniziale
            this.modules.pageManager.showPage('home');
            
        } catch (error) {
            this.safeLog(0, 'Errore inizializzazione UICore:', error);
            if (this.modules.feedbackManager) {
                this.modules.feedbackManager.showError('Errore inizializzazione interfaccia');
            }
        }
    },
    
    /**
     * Inizializza il modulo FeedbackManager
     */
    initFeedbackManager: function() {
        if (window.FeedbackManager) {
            this.modules.feedbackManager = window.FeedbackManager;
            this.modules.feedbackManager.init();
            this.safeLog(3, 'FeedbackManager inizializzato');
        } else {
            this.safeLog(1, 'FeedbackManager non disponibile');
        }
    },
    
    /**
     * Inizializza il modulo PageManager
     */
    initPageManager: function() {
        if (window.PageManager) {
            this.modules.pageManager = window.PageManager;
            this.modules.pageManager.init(this.modules.feedbackManager);
            this.safeLog(3, 'PageManager inizializzato');
        } else {
            this.safeLog(0, 'PageManager non disponibile - richiesto per il funzionamento');
            throw new Error('PageManager è richiesto');
        }
    },
    
    /**
     * Inizializza il modulo ScenarioManager
     */
    initScenarioManager: function() {
        if (window.ScenarioManager) {
            this.modules.scenarioManager = window.ScenarioManager;
            this.modules.scenarioManager.init(
                this.modules.feedbackManager,
                this.modules.pageManager
            );
            this.safeLog(3, 'ScenarioManager inizializzato');
        } else {
            this.safeLog(1, 'ScenarioManager non disponibile');
        }
    },
    
    /**
     * Inizializza il modulo ModelManager
     */
    initModelManager: function() {
        if (window.ModelManager) {
            this.modules.modelManager = window.ModelManager;
            this.modules.modelManager.init(this.modules.feedbackManager);
            this.safeLog(3, 'ModelManager inizializzato');
        } else {
            this.safeLog(1, 'ModelManager non disponibile');
        }
    },
    
    /**
     * Inizializza il modulo TutorialManager
     */
    initTutorialManager: function() {
        if (window.TutorialManager) {
            this.modules.tutorialManager = window.TutorialManager;
            this.modules.tutorialManager.init(
                this.modules.feedbackManager,
                this.modules.toolsManager
            );
            this.safeLog(3, 'TutorialManager inizializzato');
        } else {
            this.safeLog(1, 'TutorialManager non disponibile');
        }
    },
    
    /**
     * Inizializza il modulo ToolsManager
     */
    initToolsManager: function() {
        if (window.ToolsManager) {
            this.modules.toolsManager = window.ToolsManager;
            this.modules.toolsManager.init(this.modules.feedbackManager);
            this.safeLog(3, 'ToolsManager inizializzato');
        } else {
            this.safeLog(1, 'ToolsManager non disponibile');
        }
    },
    
    /**
     * Inizializza il modulo MobileControlsManager
     */
    initMobileControlsManager: function() {
        if (window.MobileControlsManager) {
            this.modules.mobileControlsManager = window.MobileControlsManager;
            this.modules.mobileControlsManager.init();
            this.safeLog(3, 'MobileControlsManager inizializzato');
        } else {
            this.safeLog(1, 'MobileControlsManager non disponibile');
        }
    },
    
    /**
     * Setup event listeners globali
     */
    setupGlobalEventListeners: function() {
        // Event listener per rotazione schermo mobile
        window.addEventListener('orientationchange', this.onOrientationChange.bind(this));
        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        // Event listeners per comunicazione inter-modulo
        document.addEventListener('scenarioChanged', this.onScenarioChanged.bind(this));
        document.addEventListener('tutorialStepChanged', this.onTutorialStepChanged.bind(this));
        document.addEventListener('toolStateChanged', this.onToolStateChanged.bind(this));
        
        this.safeLog(3, 'Event listeners globali configurati');
    },
    
    /**
     * Gestisce cambio orientamento
     */
    onOrientationChange: function() {
        this.safeLog(3, 'Orientamento schermo cambiato');
        if (this.modules.mobileControlsManager) {
            this.modules.mobileControlsManager.onOrientationChange();
        }
    },
    
    /**
     * Gestisce ridimensionamento finestra
     */
    onWindowResize: function() {
        this.safeLog(3, 'Finestra ridimensionata');
        if (this.modules.mobileControlsManager) {
            this.modules.mobileControlsManager.onWindowResize();
        }
    },
    
    /**
     * Gestisce cambio scenario
     */
    onScenarioChanged: function(event) {
        const scenario = event.detail.scenario;
        this.safeLog(2, `Scenario cambiato: ${scenario.name}`);
        
        // Notifica altri moduli del cambio scenario
        if (this.modules.tutorialManager && scenario.tutorial) {
            this.modules.tutorialManager.loadTutorial(scenario.tutorial);
        }
        
        if (this.modules.modelManager && scenario.files) {
            this.modules.modelManager.loadScenarioModels(scenario);
        }
    },
    
    /**
     * Gestisce cambio step tutorial
     */
    onTutorialStepChanged: function(event) {
        const { step, index } = event.detail;
        this.safeLog(3, `Tutorial step cambiato: ${index + 1} - ${step.title}`);
        
        // NON evidenziare strumento automaticamente - lascia che l'utente impari
        if (step.properties.Utensile && this.modules.toolsManager) {
            const toolName = this.mapToolName(step.properties.Utensile);
            if (toolName) {
                // Solo log del tool richiesto, senza evidenziazione automatica
                this.safeLog(2, `Strumento richiesto per step: ${toolName} (senza evidenziazione automatica)`);
                // NON chiamare highlightRequiredTool - l'utente deve scegliere il tool da solo
                // if (this.modules.toolsManager.highlightRequiredTool) {
                //     this.modules.toolsManager.highlightRequiredTool(toolName);
                // }
            }
        }
    },
    
    /**
     * Gestisce cambio stato strumenti
     */
    onToolStateChanged: function(event) {
        const { toolName, isActive } = event.detail;
        this.safeLog(3, `Strumento ${toolName}: ${isActive ? 'attivato' : 'disattivato'}`);
    },
    
    /**
     * Mappa i nomi degli strumenti dal tutorial ai nomi interni
     */
    mapToolName: function(tutorialToolName) {
        const mapping = {
            'ChiaveBrugola': 'brugola',
            'ChiaveInglese': 'chiave_inglese',
            'Mani': 'mano',
            'Martello': 'martello'
        };
        
        return mapping[tutorialToolName] || null;
    },
    
    /**
     * Ottiene un modulo specifico
     */
    getModule: function(moduleName) {
        return this.modules[moduleName] || null;
    },
    
    /**
     * Verifica se tutti i moduli essenziali sono disponibili
     */
    checkModules: function() {
        const requiredModules = ['feedbackManager', 'pageManager'];
        const optionalModules = ['scenarioManager', 'modelManager', 'tutorialManager', 'toolsManager', 'mobileControlsManager'];
        
        let allRequired = true;
        let availableOptional = 0;
        
        // Controlla moduli richiesti
        for (const moduleName of requiredModules) {
            if (!this.modules[moduleName]) {
                this.safeLog(0, `Modulo richiesto mancante: ${moduleName}`);
                allRequired = false;
            }
        }
        
        // Conta moduli opzionali disponibili
        for (const moduleName of optionalModules) {
            if (this.modules[moduleName]) {
                availableOptional++;
            }
        }
        
        this.safeLog(2, `Status moduli: Richiesti ${allRequired ? 'OK' : 'MANCANTI'}, Opzionali ${availableOptional}/${optionalModules.length}`);
        
        return {
            allRequiredAvailable: allRequired,
            availableOptionalCount: availableOptional,
            totalOptionalCount: optionalModules.length
        };
    },
    
    /**
     * Cleanup completo di tutti i moduli
     */
    cleanup: function() {
        this.safeLog(2, 'Cleanup UICore...');
        
        // Cleanup moduli nell'ordine inverso di inizializzazione
        Object.keys(this.modules).reverse().forEach(moduleName => {
            const module = this.modules[moduleName];
            if (module && typeof module.cleanup === 'function') {
                try {
                    module.cleanup();
                    this.safeLog(3, `${moduleName} cleanup completato`);
                } catch (error) {
                    this.safeLog(1, `Errore cleanup ${moduleName}:`, error);
                }
            }
        });
        
        // Reset stato
        this.modules = {};
        this.initialized = false;
        
        this.safeLog(2, 'UICore cleanup completato');
    }
};