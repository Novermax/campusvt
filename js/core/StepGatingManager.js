/**
 * STEP GATING MANAGER - Sistema centralizzato per gating basato su step
 *
 * Gestisce:
 * - Attivazione/disattivazione pulsanti 3D per step specifici
 * - Limiti camera dinamici per step
 * - Tool abilitati per step
 * - Notifiche ai sottosistemi quando lo step cambia
 *
 * Versione: 1.0.0
 * Data: Gennaio 2026
 */

window.StepGatingManager = {

    // ===== STATO =====
    currentStep: null,
    currentStepIndex: -1,

    // Configurazioni per ogni step (stepIndex -> config)
    stepConfigs: new Map(),

    // Listeners che vengono notificati al cambio step
    listeners: [],

    // Configurazione camera di default (salvata all'init)
    defaultCameraLimits: null,

    // Flag inizializzazione
    initialized: false,

    // ===== INIZIALIZZAZIONE =====

    /**
     * Inizializza il sistema di gating
     */
    init: function() {
        if (this.initialized) {
            console.log('[StepGating] Già inizializzato');
            return;
        }

        console.log('[StepGating] 🚦 Inizializzazione sistema Step Gating...');

        // Salva limiti camera di default
        if (window.Scene3D && window.Scene3D.mouseControls) {
            this.defaultCameraLimits = {
                minPhi: window.Scene3D.mouseControls.minPhi || 0.1,
                maxPhi: window.Scene3D.mouseControls.maxPhi || Math.PI * 0.85,
                minTheta: window.Scene3D.mouseControls.minTheta || -Infinity,
                maxTheta: window.Scene3D.mouseControls.maxTheta || Infinity
            };
            console.log('[StepGating] 📷 Limiti camera default salvati:', this.defaultCameraLimits);
        }

        this.initialized = true;
        console.log('[StepGating] ✅ Sistema inizializzato');
    },

    /**
     * Reset completo (chiamato quando si cambia scenario)
     */
    reset: function() {
        console.log('[StepGating] 🔄 Reset sistema...');
        this.currentStep = null;
        this.currentStepIndex = -1;
        this.stepConfigs.clear();
        // NON resettare listeners - sono registrati dai sottosistemi una volta sola
        console.log('[StepGating] ✅ Reset completato');
    },

    // ===== CONFIGURAZIONE STEP =====

    /**
     * Registra configurazione per uno step
     * Chiamato dal parser tutorial.txt durante il caricamento
     *
     * @param {number} stepIndex - Indice dello step (0-based)
     * @param {Object} config - Configurazione gating
     * @param {Array<string>} config.activeButtons - Pulsanti attivi in questo step
     * @param {Array<string>} config.enabledTools - Tool abilitati in questo step
     * @param {boolean} config.cameraUnlocked - Se true, camera senza limiti
     * @param {Object} config.cameraLimits - Limiti camera specifici {minPhi, maxPhi, minTheta, maxTheta}
     */
    registerStepConfig: function(stepIndex, config) {
        // Normalizza config
        const normalizedConfig = {
            activeButtons: config.activeButtons || [],
            enabledTools: config.enabledTools || [],
            cameraUnlocked: config.cameraUnlocked || false,
            cameraLimits: config.cameraLimits || null,
            // Metadata
            stepTitle: config.stepTitle || `Step ${stepIndex + 1}`
        };

        this.stepConfigs.set(stepIndex, normalizedConfig);

        if (normalizedConfig.activeButtons.length > 0 || normalizedConfig.cameraUnlocked) {
            console.log(`[StepGating] 📝 Config registrata per step ${stepIndex}:`, normalizedConfig);
        }
    },

    /**
     * Ottiene configurazione per uno step specifico
     * @param {number} stepIndex
     * @returns {Object|null}
     */
    getStepConfig: function(stepIndex) {
        return this.stepConfigs.get(stepIndex) || null;
    },

    // ===== CAMBIO STEP =====

    /**
     * Cambia lo step corrente e notifica tutti i listeners
     * Chiamato da UI.goToStep()
     *
     * @param {number} stepIndex - Indice dello step (0-based)
     * @param {string} stepTitle - Titolo dello step (opzionale)
     */
    setStep: function(stepIndex, stepTitle = null) {
        const previousStep = this.currentStepIndex;
        this.currentStepIndex = stepIndex;
        this.currentStep = stepTitle || `Step ${stepIndex + 1}`;

        // Ottieni config per questo step (o config vuota)
        const config = this.stepConfigs.get(stepIndex) || {
            activeButtons: [],
            enabledTools: [],
            cameraUnlocked: false,
            cameraLimits: null
        };

        console.log(`🚦 [StepGating] Step ${previousStep} → ${stepIndex} ("${this.currentStep}")`);

        if (config.activeButtons.length > 0) {
            console.log(`🚦 [StepGating] Pulsanti attivi: [${config.activeButtons.join(', ')}]`);
        }

        if (config.cameraUnlocked) {
            console.log(`🚦 [StepGating] 📷 Camera SBLOCCATA per questo step`);
        }

        // Applica configurazione camera
        this.applyCameraConfig(config);

        // Notifica tutti i listeners registrati
        this.listeners.forEach(listener => {
            try {
                listener(stepIndex, config, previousStep);
            } catch (e) {
                console.error('[StepGating] Errore in listener:', e);
            }
        });
    },

    // ===== GATING CHECKS =====

    /**
     * Verifica se un pulsante è attivo nello step corrente
     *
     * @param {string} buttonId - ID/nome del pulsante
     * @returns {boolean} - true se il pulsante può rispondere
     */
    isButtonActive: function(buttonId) {
        if (this.currentStepIndex < 0) {
            // Nessuno step attivo - permetti tutto (modalità libera)
            return true;
        }

        const config = this.stepConfigs.get(this.currentStepIndex);

        // Se non c'è config per questo step, o activeButtons è vuoto, permetti tutto
        if (!config || !config.activeButtons || config.activeButtons.length === 0) {
            return true;
        }

        // Verifica se il pulsante è nella lista degli attivi
        const isActive = config.activeButtons.some(btn => {
            // Match esatto o parziale (per gestire varianti come btn_start vs pulsante_start)
            const btnLower = btn.toLowerCase();
            const buttonIdLower = buttonId.toLowerCase();
            return buttonIdLower === btnLower ||
                   buttonIdLower.includes(btnLower) ||
                   btnLower.includes(buttonIdLower);
        });

        if (!isActive) {
            console.log(`🚫 [StepGating] Pulsante "${buttonId}" NON attivo nello step ${this.currentStepIndex}`);
        }

        return isActive;
    },

    /**
     * Verifica se un tool è abilitato nello step corrente
     *
     * @param {string} toolId - ID/nome del tool
     * @returns {boolean}
     */
    isToolEnabled: function(toolId) {
        if (this.currentStepIndex < 0) {
            return true;
        }

        const config = this.stepConfigs.get(this.currentStepIndex);

        // Se non c'è config o enabledTools vuoto, permetti tutto
        if (!config || !config.enabledTools || config.enabledTools.length === 0) {
            return true;
        }

        return config.enabledTools.some(tool =>
            tool.toLowerCase() === toolId.toLowerCase()
        );
    },

    /**
     * Verifica se la camera è sbloccata nello step corrente
     * @returns {boolean}
     */
    isCameraUnlocked: function() {
        if (this.currentStepIndex < 0) {
            return false;
        }

        const config = this.stepConfigs.get(this.currentStepIndex);
        return config?.cameraUnlocked || false;
    },

    // ===== CAMERA CONTROL =====

    /**
     * Applica configurazione camera per lo step corrente
     * @param {Object} config
     */
    applyCameraConfig: function(config) {
        if (!window.Scene3D || !window.Scene3D.mouseControls) {
            console.warn('[StepGating] Scene3D non disponibile per config camera');
            return;
        }

        const controls = window.Scene3D.mouseControls;

        if (config.cameraUnlocked) {
            // Sblocca rotazione completa
            controls.minPhi = 0;
            controls.maxPhi = Math.PI;
            controls.minTheta = -Infinity;
            controls.maxTheta = Infinity;
            console.log('📷 [StepGating] Camera SBLOCCATA - rotazione libera');

        } else if (config.cameraLimits) {
            // Applica limiti specifici dello step
            controls.minPhi = config.cameraLimits.minPhi ?? this.defaultCameraLimits.minPhi;
            controls.maxPhi = config.cameraLimits.maxPhi ?? this.defaultCameraLimits.maxPhi;
            controls.minTheta = config.cameraLimits.minTheta ?? this.defaultCameraLimits.minTheta;
            controls.maxTheta = config.cameraLimits.maxTheta ?? this.defaultCameraLimits.maxTheta;
            console.log('📷 [StepGating] Camera con limiti specifici:', config.cameraLimits);

        } else {
            // Ripristina limiti default
            if (this.defaultCameraLimits) {
                controls.minPhi = this.defaultCameraLimits.minPhi;
                controls.maxPhi = this.defaultCameraLimits.maxPhi;
                controls.minTheta = this.defaultCameraLimits.minTheta;
                controls.maxTheta = this.defaultCameraLimits.maxTheta;
            }
            // Non logga per evitare spam - è il caso normale
        }
    },

    // ===== LISTENERS =====

    /**
     * Registra un callback da chiamare quando lo step cambia
     *
     * @param {Function} callback - function(stepIndex, config, previousStep)
     * @returns {Function} - Funzione per rimuovere il listener
     */
    onStepChange: function(callback) {
        this.listeners.push(callback);
        console.log(`[StepGating] 👂 Listener registrato (totale: ${this.listeners.length})`);

        // Ritorna funzione per rimuovere listener
        return () => {
            const index = this.listeners.indexOf(callback);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        };
    },

    /**
     * Rimuove tutti i listeners (usare con cautela)
     */
    clearListeners: function() {
        this.listeners = [];
        console.log('[StepGating] 🧹 Tutti i listeners rimossi');
    },

    // ===== DEBUG =====

    /**
     * Mostra stato corrente del sistema
     */
    debugInfo: function() {
        console.log('═══════════════════════════════════════════════════════');
        console.log('🚦 STEP GATING MANAGER - DEBUG INFO');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`Step corrente: ${this.currentStepIndex} ("${this.currentStep}")`);
        console.log(`Configurazioni registrate: ${this.stepConfigs.size}`);
        console.log(`Listeners attivi: ${this.listeners.length}`);
        console.log('');

        if (this.currentStepIndex >= 0) {
            const config = this.stepConfigs.get(this.currentStepIndex);
            if (config) {
                console.log('Config step corrente:');
                console.log('  - Pulsanti attivi:', config.activeButtons);
                console.log('  - Tools abilitati:', config.enabledTools);
                console.log('  - Camera sbloccata:', config.cameraUnlocked);
                console.log('  - Limiti camera:', config.cameraLimits);
            } else {
                console.log('Nessuna config specifica per questo step (tutto permesso)');
            }
        }

        console.log('');
        console.log('Limiti camera default:', this.defaultCameraLimits);
        console.log('═══════════════════════════════════════════════════════');

        return {
            currentStep: this.currentStepIndex,
            stepTitle: this.currentStep,
            configsCount: this.stepConfigs.size,
            listenersCount: this.listeners.length
        };
    },

    /**
     * Lista tutte le configurazioni registrate
     */
    listConfigs: function() {
        console.log('🚦 Configurazioni Step Gating registrate:');
        this.stepConfigs.forEach((config, stepIndex) => {
            console.log(`  Step ${stepIndex}: buttons=[${config.activeButtons.join(',')}], camera=${config.cameraUnlocked ? 'UNLOCKED' : 'limited'}`);
        });
    }
};

// Auto-init quando il documento è pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Delay init per permettere a Scene3D di inizializzarsi prima
        setTimeout(() => window.StepGatingManager.init(), 100);
    });
} else {
    setTimeout(() => window.StepGatingManager.init(), 100);
}

console.log('[StepGatingManager] 📦 Modulo caricato');
