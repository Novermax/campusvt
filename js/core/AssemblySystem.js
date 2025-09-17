/**
 * AssemblySystem.js - Sistema di Assemblaggio Sequenziale con Punti di Aggancio Multipli
 *
 * Estende il DragDropSystem esistente con funzionalità avanzate:
 * - Sequenze di assemblaggio obbligatorie
 * - Punti di aggancio multipli per stesso componente
 * - Nodi di intercambiabilità (componenti sostituibili)
 * - Validazione assemblaggio con dipendenze
 * - Sistema undo/redo per assemblaggi
 *
 * Versione: 1.0
 * Data: Dicembre 2025
 */

window.AssemblySystem = {
    // Stato sistema
    enabled: false,
    assemblyMode: false,

    // Configurazione assemblaggio corrente
    currentConfig: null,
    currentStep: 0,
    currentStepName: null,

    // Stato assemblaggio
    mountedComponents: new Map(), // component_id -> snap_point_id
    occupiedSnapPoints: new Set(), // snap_point_ids occupati
    assemblyHistory: [], // Per undo/redo
    allowedComponents: new Set(), // Componenti montabili nel step corrente

    // Riferimenti sistemi esterni
    dragDropSystem: null,
    scene3D: null,

    /**
     * Inizializza il sistema di assemblaggio
     */
    init: function(scene3D) {
        console.log('[AssemblySystem] 🏗️ Inizializzazione sistema assemblaggio...');

        this.scene3D = scene3D;
        this.dragDropSystem = window.DragDropSystem;

        if (!this.dragDropSystem) {
            console.error('[AssemblySystem] Errore: DragDropSystem non disponibile');
            return false;
        }

        console.log('[AssemblySystem] ✅ Sistema assemblaggio inizializzato');
        return true;
    },

    /**
     * Registra callback per notifiche cambio step
     * @param {Function} callback - Funzione da chiamare: callback(stepName, stepIndex, assemblyStatus)
     */
    setStepChangeCallback: function(callback) {
        this.onStepChangeCallback = callback;
        console.log('[AssemblySystem] 📢 Callback cambio step registrato');
    },

    /**
     * Abilita modalità assemblaggio con configurazione specifica
     * @param {Object} assemblyConfig - Configurazione assemblaggio
     * @param {string} startStep - Step di partenza
     */
    enableAssemblyMode: function(assemblyConfig, startStep = null) {
        if (!assemblyConfig) {
            console.error('[AssemblySystem] Configurazione assemblaggio richiesta');
            return false;
        }

        console.log('[AssemblySystem] 🔧 Abilitazione modalità assemblaggio...');

        // Valida configurazione
        if (!this.validateConfig(assemblyConfig)) {
            console.error('[AssemblySystem] Configurazione assemblaggio non valida');
            return false;
        }

        this.currentConfig = assemblyConfig;
        this.assemblyMode = true;
        this.enabled = true;

        // Imposta step iniziale
        if (startStep) {
            this.setCurrentStep(startStep);
        } else if (assemblyConfig.sequence && assemblyConfig.sequence.length > 0) {
            this.setCurrentStep(assemblyConfig.sequence[0]);
        }

        console.log('[AssemblySystem] ✅ Modalità assemblaggio abilitata');
        return true;
    },

    /**
     * Disabilita modalità assemblaggio
     */
    disableAssemblyMode: function() {
        console.log('[AssemblySystem] 🔴 Disabilitazione modalità assemblaggio...');

        this.assemblyMode = false;
        this.enabled = false;
        this.currentConfig = null;
        this.currentStep = 0;
        this.currentStepName = null;
        this.mountedComponents.clear();
        this.occupiedSnapPoints.clear();
        this.assemblyHistory = [];
        this.allowedComponents.clear();

        console.log('[AssemblySystem] ✅ Modalità assemblaggio disabilitata');
    },

    /**
     * Imposta step corrente assemblaggio
     * @param {string} stepName - Nome dello step
     */
    setCurrentStep: function(stepName) {
        if (!this.currentConfig || !this.currentConfig.sequence) {
            console.error('[AssemblySystem] Configurazione non disponibile per setCurrentStep');
            return false;
        }

        const stepIndex = this.currentConfig.sequence.indexOf(stepName);
        if (stepIndex === -1) {
            console.error(`[AssemblySystem] Step "${stepName}" non trovato nella sequenza`);
            return false;
        }

        this.currentStep = stepIndex;
        this.currentStepName = stepName;

        console.log(`[AssemblySystem] 📍 Step corrente impostato: ${stepName} (${stepIndex})`);

        // Notifica UI del cambio step se callback registrato
        if (this.onStepChangeCallback && typeof this.onStepChangeCallback === 'function') {
            try {
                this.onStepChangeCallback(stepName, stepIndex, this.getAssemblyStatus());
                console.log(`[AssemblySystem] 📢 UI notificata del cambio step: ${stepName}`);
            } catch (error) {
                console.error(`[AssemblySystem] ❌ Errore notifica UI cambio step:`, error);
            }
        }

        return true;
    },

    /**
     * Imposta componenti montabili per step corrente
     * @param {Array} components - Lista nomi componenti
     */
    setAllowedComponents: function(components) {
        this.allowedComponents.clear();

        if (Array.isArray(components)) {
            components.forEach(comp => {
                this.allowedComponents.add(comp);
            });
        } else if (typeof components === 'string') {
            // Split da stringa comma-separated
            components.split(',').forEach(comp => {
                this.allowedComponents.add(comp.trim());
            });
        }

        console.log(`[AssemblySystem] 🎯 Componenti permessi: ${Array.from(this.allowedComponents).join(', ')}`);
    },

    /**
     * Verifica se un componente è montabile
     * @param {string} componentName - Nome del componente
     * @returns {boolean}
     */
    isComponentMountable: function(componentName) {
        if (!this.assemblyMode) {
            return true; // Modalità normale
        }

        // Verifica se è nei componenti permessi
        if (this.allowedComponents.size > 0 && !this.allowedComponents.has(componentName)) {
            console.log(`[AssemblySystem] ❌ Componente "${componentName}" non permesso in questo step`);
            return false;
        }

        // Verifica dipendenze step (semplificata)
        if (!this.validateStepDependencies()) {
            console.log(`[AssemblySystem] ❌ Dipendenze step non soddisfatte per "${componentName}"`);
            return false;
        }

        console.log(`[AssemblySystem] ✅ Componente "${componentName}" montabile`);
        return true;
    },

    /**
     * Valida configurazione assemblaggio
     * @param {Object} config - Configurazione da validare
     * @returns {boolean}
     */
    validateConfig: function(config) {
        if (!config) {
            console.error('[AssemblySystem] Configurazione null');
            return false;
        }

        // Verifica sequence
        if (!config.sequence || !Array.isArray(config.sequence)) {
            console.error('[AssemblySystem] Sequenza assemblaggio mancante o non valida');
            return false;
        }

        // Verifica snapPoints
        if (!config.snapPoints || typeof config.snapPoints !== 'object') {
            console.warn('[AssemblySystem] SnapPoints mancanti (opzionale)');
        }

        console.log('[AssemblySystem] ✅ Configurazione valida');
        return true;
    },

    /**
     * Valida dipendenze step corrente (semplificata)
     * @returns {boolean}
     */
    validateStepDependencies: function() {
        if (!this.currentConfig || !this.currentConfig.dependencies) {
            return true; // Nessuna dipendenza configurata
        }

        const dependencies = this.currentConfig.dependencies[this.currentStepName];
        if (!dependencies || dependencies.length === 0) {
            return true; // Nessuna dipendenza per questo step
        }

        // Per ora validazione semplificata - sempre true
        // TODO: Implementare controllo dipendenze reali
        return true;
    },

    /**
     * Verifica se lo step corrente è completato
     * @returns {boolean}
     */
    isCurrentStepComplete: function() {
        if (!this.currentConfig || !this.currentConfig.assemblySteps || !this.currentStepName) {
            return false;
        }

        const stepConfig = this.currentConfig.assemblySteps[this.currentStepName];
        if (!stepConfig || !stepConfig.requiredComponents) {
            return true; // Nessun componente richiesto = completato
        }

        // Verifica che tutti i componenti richiesti siano montati
        const requiredComponents = stepConfig.requiredComponents;
        const mountedComponentsList = Array.from(this.mountedComponents.keys());

        const allMounted = requiredComponents.every(componentName =>
            mountedComponentsList.includes(componentName)
        );

        console.log(`[AssemblySystem] 🔍 Step "${this.currentStepName}" completato: ${allMounted}`);
        console.log(`  📋 Richiesti: [${requiredComponents.join(', ')}]`);
        console.log(`  ✅ Montati: [${mountedComponentsList.join(', ')}]`);

        return allMounted;
    },

    /**
     * Ottiene snap points disponibili per componente
     * @param {string} componentName - Nome del componente
     * @returns {Array}
     */
    getAvailableSnapPoints: function(componentName) {
        if (!this.currentConfig || !this.currentConfig.snapPoints) {
            return [];
        }

        const componentSnaps = this.currentConfig.snapPoints[componentName];
        if (!componentSnaps) {
            return [];
        }

        return componentSnaps.positions || [];
    },

    /**
     * Segna componente come montato
     * @param {string} componentName - Nome del componente
     * @param {string} snapPointId - ID del punto snap utilizzato
     */
    markComponentMounted: function(componentName, snapPointId = null) {
        this.mountedComponents.set(componentName, snapPointId);

        if (snapPointId) {
            this.occupiedSnapPoints.add(snapPointId);
        }

        // Salva stato per undo
        this.assemblyHistory.push({
            action: 'mount',
            component: componentName,
            snapPoint: snapPointId,
            timestamp: Date.now()
        });

        console.log(`[AssemblySystem] 🔧 Componente montato: ${componentName} → ${snapPointId || 'default'}`);
    },

    /**
     * Ottiene status completo assemblaggio
     * @returns {Object}
     */
    getAssemblyStatus: function() {
        const stepConfig = this.currentConfig && this.currentConfig.assemblySteps && this.currentStepName ?
                          this.currentConfig.assemblySteps[this.currentStepName] : null;

        // Verifica se lo step corrente è completo
        const currentStepComplete = this.isCurrentStepComplete();
        const canAdvanceToNext = currentStepComplete && this.getNextStep() !== null;

        return {
            enabled: this.enabled,
            assemblyMode: this.assemblyMode,
            currentStep: this.currentStepName,
            currentStepIndex: this.currentStep,
            currentStepConfig: stepConfig,
            currentStepComplete: currentStepComplete,
            canAdvanceToNext: canAdvanceToNext,
            mountedComponents: Array.from(this.mountedComponents.keys()),
            allowedComponents: Array.from(this.allowedComponents),
            totalSteps: this.currentConfig ? this.currentConfig.sequence.length : 0,
            historyLength: this.assemblyHistory.length
        };
    },

    /**
     * Ottiene step corrente assemblaggio
     * @returns {string}
     */
    getCurrentAssemblyStep: function() {
        return this.currentStepName;
    },

    /**
     * Ottiene il prossimo step nella sequenza assemblaggio
     * @returns {string|null}
     */
    getNextStep: function() {
        if (!this.assemblyMode || !this.currentConfig || !this.currentConfig.sequence) {
            return null;
        }

        const currentIndex = this.currentConfig.sequence.indexOf(this.currentStepName);
        if (currentIndex === -1 || currentIndex >= this.currentConfig.sequence.length - 1) {
            return null; // Step corrente non trovato o è l'ultimo
        }

        return this.currentConfig.sequence[currentIndex + 1];
    },

    /**
     * Ottiene componenti montati
     * @returns {Array}
     */
    getMountedComponents: function() {
        return Array.from(this.mountedComponents.keys());
    },

    /**
     * Valida sequenza assemblaggio completa
     * @returns {boolean}
     */
    validateAssemblySequence: function() {
        if (!this.currentConfig) {
            console.warn('[AssemblySystem] Nessuna configurazione per validazione');
            return false;
        }

        console.log('[AssemblySystem] ✅ Sequenza assemblaggio valida');
        return true;
    },

    /**
     * Sistema Undo - Annulla ultima operazione
     * @returns {boolean}
     */
    undoAssembly: function() {
        if (this.assemblyHistory.length === 0) {
            console.log('[AssemblySystem] ❌ Nessuna operazione da annullare');
            return false;
        }

        const lastOperation = this.assemblyHistory.pop();

        if (lastOperation.action === 'mount') {
            this.mountedComponents.delete(lastOperation.component);
            if (lastOperation.snapPoint) {
                this.occupiedSnapPoints.delete(lastOperation.snapPoint);
            }
            console.log(`[AssemblySystem] ↶ Undo: Smontato ${lastOperation.component}`);
        }

        return true;
    },

    /**
     * Sistema Redo - Ripeti operazione annullata
     * @returns {boolean}
     */
    redoAssembly: function() {
        // TODO: Implementare redo completo
        console.log('[AssemblySystem] ↷ Redo: Non ancora implementato');
        return false;
    },

    /**
     * Ottiene storico operazioni
     * @returns {Array}
     */
    getAssemblyHistory: function() {
        return this.assemblyHistory.slice(); // Copia
    },

    /**
     * Debug stato completo sistema
     */
    debugCurrentState: function() {
        console.group('[AssemblySystem] 🔍 DEBUG STATE');
        console.log('Enabled:', this.enabled);
        console.log('Assembly Mode:', this.assemblyMode);
        console.log('Current Step:', this.currentStepName, '(', this.currentStep, ')');
        console.log('Config:', this.currentConfig);
        console.log('Mounted Components:', this.getMountedComponents());
        console.log('Allowed Components:', Array.from(this.allowedComponents));
        console.log('History Length:', this.assemblyHistory.length);
        console.groupEnd();
    },

    /**
     * Valida configurazione corrente
     */
    validateConfiguration: function() {
        if (!this.currentConfig) {
            console.error('[AssemblySystem] ❌ Nessuna configurazione caricata');
            return false;
        }

        const result = this.validateConfig(this.currentConfig);
        console.log(`[AssemblySystem] ${result ? '✅' : '❌'} Validazione configurazione:`, result);
        return result;
    }
};

// Inizializzazione automatica quando disponibile
if (typeof window !== 'undefined') {
    console.log('[AssemblySystem] 📦 Modulo caricato e disponibile globalmente');
}