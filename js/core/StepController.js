/**
 * StepController.js - Controller Centralizzato Progressione Step
 *
 * Gestisce la logica di progressione del tutorial con supporto per:
 * - Trigger multipli per lo stesso step (schermo, pulsante fisico, ecc.)
 * - Azioni diverse in base alla sorgente del trigger
 * - Disaccoppiamento input/esecuzione
 *
 * Versione: 1.0.0
 * Data: Gennaio 2026
 *
 * ARCHITETTURA:
 * - StepController riceve eventi da ScreenSystem, HoldableSystem, ecc.
 * - Ogni step può definire trigger accettati e azioni per sorgente
 * - triggerStep(stepId, source) esegue azioni appropriate
 *
 * SORGENTI TRIGGER:
 * - 'screen'   : Hotspot su schermo (ScreenSystem)
 * - 'physical' : Pulsante fisico 3D (click su modello)
 * - 'holdable' : Azione su oggetto impugnato (HoldableSystem)
 * - 'tutorial' : Avanzamento manuale tutorial (freccia, click elemento)
 * - 'auto'     : AutoMode mobile
 */

console.log('[StepController] Modulo caricato v1.0.0');

window.StepController = {
    // ═══════════════════════════════════════════════════════════════════
    // STATO SISTEMA
    // ═══════════════════════════════════════════════════════════════════

    initialized: false,
    enabled: true,

    // Step corrente
    currentStepIndex: -1,
    currentStep: null,

    // Configurazione step con trigger e azioni
    stepConfigs: new Map(), // stepIndex -> { triggers, actions }

    // Registro pulsanti fisici 3D
    // modelName -> { buttonId, onClick }
    physicalButtons: new Map(),

    // ═══════════════════════════════════════════════════════════════════
    // SORGENTI TRIGGER SUPPORTATE
    // ═══════════════════════════════════════════════════════════════════

    TRIGGER_SOURCES: {
        SCREEN: 'screen',       // Hotspot su schermo UI
        PHYSICAL: 'physical',   // Pulsante fisico 3D (modello cliccabile)
        HOLDABLE: 'holdable',   // Azione su oggetto in mano
        TUTORIAL: 'tutorial',   // Avanzamento manuale tutorial
        AUTO: 'auto'            // AutoMode mobile
    },

    // ═══════════════════════════════════════════════════════════════════
    // INIZIALIZZAZIONE
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Inizializza il controller
     */
    init: function() {
        console.log('[StepController] Inizializzazione...');

        // Registra listener per eventi da altri sistemi
        this.setupEventListeners();

        this.initialized = true;
        console.log('[StepController] ✅ Inizializzato');
        return true;
    },

    /**
     * Setup listener per ricevere eventi da altri sistemi
     */
    setupEventListeners: function() {
        // Listener globale per eventi custom
        window.addEventListener('stepTrigger', this.onStepTriggerEvent.bind(this));

        console.log('[StepController] Event listeners configurati');
    },

    // ═══════════════════════════════════════════════════════════════════
    // CONFIGURAZIONE STEP
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Configura un step con trigger e azioni
     * @param {number} stepIndex - Indice dello step
     * @param {Object} config - Configurazione trigger/azioni
     *
     * Formato config:
     * {
     *   triggers: {
     *     screen: ['pulpito.btn_start', 'remote.btn_ok'],
     *     physical: ['remote.btn_power']
     *   },
     *   actions: {
     *     screen: [
     *       { type: 'animation', target: 'pompa', animation: 'rotazione:(0,0,360,1)' }
     *     ],
     *     physical: [
     *       { type: 'animation', target: 'pompa', animation: 'rotazione:(0,0,360,1)' },
     *       { type: 'setView', screen: 'pulpito', view: 'running' }
     *     ],
     *     any: [
     *       { type: 'sound', path: 'sounds/pump_start.mp3' }
     *     ]
     *   },
     *   autoAdvance: true  // Avanza automaticamente dopo azioni
     * }
     */
    configureStep: function(stepIndex, config) {
        const stepConfig = {
            triggers: config.triggers || {},
            actions: config.actions || {},
            autoAdvance: config.autoAdvance === true // Default FALSE - step NON avanzano automaticamente dopo trigger a meno di AutoAdvance=true esplicito
        };

        this.stepConfigs.set(stepIndex, stepConfig);
        console.log(`[StepController] 📋 Step ${stepIndex} configurato:`, stepConfig);
    },

    /**
     * Imposta lo step corrente
     * @param {number} stepIndex - Indice dello step
     * @param {Object} step - Dati dello step dal tutorial
     */
    setCurrentStep: function(stepIndex, step) {
        this.currentStepIndex = stepIndex;
        this.currentStep = step;

        console.log(`[StepController] 📍 Step corrente: ${stepIndex}`, step?.title || '');

        // Parsing automatico delle proprietà step per configurare trigger/azioni
        if (step && step.properties) {
            this.parseStepProperties(stepIndex, step.properties);
        }
    },

    /**
     * Parse proprietà step per estrarre configurazione trigger/azioni
     * @param {number} stepIndex - Indice step
     * @param {Object} props - Proprietà dello step
     */
    parseStepProperties: function(stepIndex, props) {
        const config = {
            triggers: {
                screen: [],
                physical: [],
                holdable: [],
                any: []
            },
            actions: {
                screen: [],
                physical: [],
                holdable: [],
                any: []
            },
            autoAdvance: false // Default FALSE - uno step con trigger SI FERMA fino al trigger, poi aspetta click utente sulla freccia (a meno che non abbia AutoAdvance=true esplicito)
        };

        // Parse AcceptTrigger_Screen
        if (props.AcceptTrigger_Screen) {
            config.triggers.screen = props.AcceptTrigger_Screen.split(',').map(t => t.trim());
        }

        // Parse AcceptTrigger_Physical
        if (props.AcceptTrigger_Physical) {
            config.triggers.physical = props.AcceptTrigger_Physical.split(',').map(t => t.trim());
        }

        // Parse AcceptTrigger_Holdable
        if (props.AcceptTrigger_Holdable) {
            config.triggers.holdable = props.AcceptTrigger_Holdable.split(',').map(t => t.trim());
        }

        // Parse OnScreenTrigger (azioni per trigger schermo)
        if (props.OnScreenTrigger) {
            config.actions.screen.push(...this.parseActionString(props.OnScreenTrigger));
        }
        if (props.OnScreenTrigger_SetView) {
            const [screen, view] = props.OnScreenTrigger_SetView.split('.');
            config.actions.screen.push({ type: 'setView', screen, view });
        }

        // Parse OnPhysicalTrigger (azioni per trigger fisico)
        if (props.OnPhysicalTrigger) {
            config.actions.physical.push(...this.parseActionString(props.OnPhysicalTrigger));
        }
        if (props.OnPhysicalTrigger_SetView) {
            const [screen, view] = props.OnPhysicalTrigger_SetView.split('.');
            config.actions.physical.push({ type: 'setView', screen, view });
        }

        // Parse OnHoldableTrigger (azioni per trigger holdable)
        if (props.OnHoldableTrigger) {
            config.actions.holdable.push(...this.parseActionString(props.OnHoldableTrigger));
        }

        // Parse OnAnyTrigger (azioni per qualsiasi trigger)
        if (props.OnAnyTrigger) {
            config.actions.any.push(...this.parseActionString(props.OnAnyTrigger));
        }
        if (props.OnAnyTrigger_SetView) {
            const [screen, view] = props.OnAnyTrigger_SetView.split('.');
            config.actions.any.push({ type: 'setView', screen, view });
        }

        // AutoAdvance - legge esplicitamente true/false dal tutorial
        if (props.AutoAdvance === 'true') {
            config.autoAdvance = true;
        } else if (props.AutoAdvance === 'false') {
            config.autoAdvance = false;
        }
        // altrimenti rimane il default (false)

        // Salva configurazione solo se ci sono trigger definiti
        const hasTriggers = config.triggers.screen.length > 0 ||
                           config.triggers.physical.length > 0 ||
                           config.triggers.holdable.length > 0;

        if (hasTriggers) {
            this.stepConfigs.set(stepIndex, config);
            console.log(`[StepController] 📋 Step ${stepIndex} auto-configurato da proprietà:`);
            console.log(`[StepController]    Triggers Physical: [${config.triggers.physical.join(', ')}]`);
            console.log(`[StepController]    Actions Physical: ${config.actions.physical.length} azioni`);
            if (config.actions.physical.length > 0) {
                config.actions.physical.forEach((action, i) => {
                    console.log(`[StepController]      ${i+1}. ${action.type}: ${action.group}=${action.variant || 'N/A'}`);
                });
            }
        } else {
            console.log(`[StepController] ⏭️ Step ${stepIndex} skippato (nessun trigger definito)`);
        }
    },

    /**
     * Parse stringa azione in oggetti azione
     * @param {string} actionStr - Es: "Animation:pompa,rotazione:(0,0,360,1)"
     * @returns {Array} Array di oggetti azione
     */
    parseActionString: function(actionStr) {
        const actions = [];

        // Supporta azioni multiple separate da ";"
        const actionParts = actionStr.split(';').map(a => a.trim());

        actionParts.forEach(part => {
            // Formato: "Animation:target,animazione"
            const animMatch = part.match(/^Animation:([^,]+),(.+)$/i);
            if (animMatch) {
                actions.push({
                    type: 'animation',
                    target: animMatch[1].trim(),
                    animation: animMatch[2].trim()
                });
                return;
            }

            // Formato: "Sound:path"
            const soundMatch = part.match(/^Sound:(.+)$/i);
            if (soundMatch) {
                actions.push({
                    type: 'sound',
                    path: soundMatch[1].trim()
                });
                return;
            }

            // Formato: "SetView:screen.view"
            const viewMatch = part.match(/^SetView:([^.]+)\.(.+)$/i);
            if (viewMatch) {
                actions.push({
                    type: 'setView',
                    screen: viewMatch[1].trim(),
                    view: viewMatch[2].trim()
                });
                return;
            }

            // Formato: "HoldAction:pick|release"
            const holdMatch = part.match(/^HoldAction:(pick|release)$/i);
            if (holdMatch) {
                actions.push({
                    type: 'holdAction',
                    action: holdMatch[1].toLowerCase()
                });
                return;
            }

            // Formato: "setVariant:gruppo=variante"
            const variantMatch = part.match(/^setVariant:([^=]+)=(.+)$/i);
            if (variantMatch) {
                actions.push({
                    type: 'setVariant',
                    group: variantMatch[1].trim(),
                    variant: variantMatch[2].trim()
                });
                return;
            }

            // Formato: "cycleVariant:gruppo"
            const cycleMatch = part.match(/^cycleVariant:(.+)$/i);
            if (cycleMatch) {
                actions.push({
                    type: 'cycleVariant',
                    group: cycleMatch[1].trim()
                });
                return;
            }

            console.warn(`[StepController] ⚠️ Azione non riconosciuta: "${part}"`);
        });

        return actions;
    },

    // ═══════════════════════════════════════════════════════════════════
    // TRIGGER STEP
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Triggera lo step corrente da una sorgente specifica
     * @param {string} source - Sorgente del trigger ('screen', 'physical', ecc.)
     * @param {string} triggerId - ID del trigger (es: 'pulpito.btn_start')
     * @returns {boolean} true se trigger accettato ed eseguito
     */
    triggerStep: function(source, triggerId) {
        if (!this.enabled) {
            console.log('[StepController] ⚠️ Controller disabilitato');
            return false;
        }

        console.log(`[StepController] 🎯 Trigger ricevuto: source="${source}", id="${triggerId}"`);
        console.log(`[StepController] 🔍 currentStepIndex=${this.currentStepIndex}`);
        console.log(`[StepController] 🔍 stepConfigs.size=${this.stepConfigs.size}`);
        console.log(`[StepController] 🔍 stepConfigs.keys=[${Array.from(this.stepConfigs.keys()).join(', ')}]`);

        const stepConfig = this.stepConfigs.get(this.currentStepIndex);

        // Se non c'è configurazione specifica, lascia gestire al sistema tradizionale
        if (!stepConfig) {
            console.log('[StepController] ℹ️ Nessuna configurazione specifica, delegando a sistema tradizionale');
            console.log(`[StepController] 🔍 Configurazione per step ${this.currentStepIndex} NON TROVATA`);
            return false;
        }

        console.log(`[StepController] 🔍 Configurazione trovata:`, stepConfig);

        // Verifica se il trigger è accettato per questa sorgente
        const acceptedTriggers = stepConfig.triggers[source] || [];
        const isAccepted = acceptedTriggers.length === 0 || // Nessun filtro = accetta tutti
                          acceptedTriggers.includes(triggerId) ||
                          acceptedTriggers.includes('*'); // Wildcard

        if (!isAccepted) {
            console.log(`[StepController] ❌ Trigger "${triggerId}" non accettato per sorgente "${source}"`);
            console.log(`[StepController]    Trigger accettati: [${acceptedTriggers.join(', ')}]`);
            return false;
        }

        console.log(`[StepController] ✅ Trigger "${triggerId}" accettato da sorgente "${source}"`);

        // Esegui azioni per questa sorgente
        this.executeActionsForSource(source, stepConfig);

        // Auto-avanzamento SEMPRE dopo trigger accettato
        // (Il flag AutoAdvance serve solo per step con AutoExecute, non per trigger manuali)
        // Comportamento: trigger accettato → azioni eseguite → avanza automaticamente
        console.log('[StepController] ⏭️ Trigger accettato → auto-avanzamento dopo azioni');
        this.scheduleAutoAdvance();

        return true;
    },

    /**
     * Esegue le azioni configurate per una sorgente
     * @param {string} source - Sorgente del trigger
     * @param {Object} stepConfig - Configurazione dello step
     */
    executeActionsForSource: function(source, stepConfig) {
        // Esegui azioni specifiche per la sorgente
        const sourceActions = stepConfig.actions[source] || [];
        console.log(`[StepController] ⚡ Esecuzione ${sourceActions.length} azioni per sorgente "${source}"`);

        sourceActions.forEach((action, index) => {
            console.log(`[StepController]    ${index + 1}. ${action.type}:`, action);
            this.executeAction(action);
        });

        // Esegui azioni "any" (per qualsiasi sorgente)
        const anyActions = stepConfig.actions.any || [];
        if (anyActions.length > 0) {
            console.log(`[StepController] ⚡ Esecuzione ${anyActions.length} azioni "any"`);
            anyActions.forEach((action, index) => {
                console.log(`[StepController]    ${index + 1}. ${action.type}:`, action);
                this.executeAction(action);
            });
        }
    },

    /**
     * Esegue una singola azione
     * @param {Object} action - Oggetto azione
     */
    executeAction: function(action) {
        switch (action.type) {
            case 'animation':
                this.executeAnimationAction(action);
                break;

            case 'setView':
                this.executeSetViewAction(action);
                break;

            case 'sound':
                this.executeSoundAction(action);
                break;

            case 'holdAction':
                this.executeHoldAction(action);
                break;

            case 'setVariant':
                this.executeSetVariantAction(action);
                break;

            case 'cycleVariant':
                this.executeCycleVariantAction(action);
                break;

            default:
                console.warn(`[StepController] ⚠️ Tipo azione sconosciuto: "${action.type}"`);
        }
    },

    /**
     * Esegue azione setVariant
     */
    executeSetVariantAction: function(action) {
        if (!window.InteractiveObject3D) {
            console.warn('[StepController] InteractiveObject3D non disponibile');
            return;
        }

        console.log(`[StepController] 🔀 setVariant: ${action.group}=${action.variant}`);
        window.InteractiveObject3D.setStateVariant(action.group, action.variant);
    },

    /**
     * Esegue azione cycleVariant
     */
    executeCycleVariantAction: function(action) {
        if (!window.InteractiveObject3D) {
            console.warn('[StepController] InteractiveObject3D non disponibile');
            return;
        }

        console.log(`[StepController] 🔄 cycleVariant: ${action.group}`);
        window.InteractiveObject3D.cycleStateVariant(action.group);
    },

    /**
     * Esegue azione animazione
     */
    executeAnimationAction: function(action) {
        if (!window.Scene3D) {
            console.warn('[StepController] Scene3D non disponibile');
            return;
        }

        const model = window.Scene3D.findModelByName(action.target);
        if (!model) {
            console.warn(`[StepController] Modello "${action.target}" non trovato`);
            return;
        }

        // Delega a Scene3D per esecuzione animazione
        // Parse tipo animazione dalla stringa
        const rotMatch = action.animation.match(/rotazione:\(([^)]+)\)/);
        const transMatch = action.animation.match(/traslazione:\(([^)]+)\)/);

        if (rotMatch) {
            const [rx, ry, rz, dur] = rotMatch[1].split(',').map(v => parseFloat(v.trim()));
            console.log(`[StepController] 🔄 Rotazione "${action.target}": (${rx}, ${ry}, ${rz}) in ${dur}s`);

            if (window.Scene3D.animateModelRotation) {
                window.Scene3D.animateModelRotation(model, {
                    x: rx * Math.PI / 180,
                    y: ry * Math.PI / 180,
                    z: rz * Math.PI / 180
                }, dur);
            }
        }

        if (transMatch) {
            const [tx, ty, tz, dur] = transMatch[1].split(',').map(v => parseFloat(v.trim()));
            console.log(`[StepController] 📍 Traslazione "${action.target}": (${tx}, ${ty}, ${tz}) in ${dur}s`);

            if (window.Scene3D.animateModelTranslation) {
                const translation = new THREE.Vector3(tx, ty, tz);
                window.Scene3D.animateModelTranslation(model, translation, dur);
            }
        }
    },

    /**
     * Esegue azione cambio vista schermo
     */
    executeSetViewAction: function(action) {
        if (!window.ScreenSystem) {
            console.warn('[StepController] ScreenSystem non disponibile');
            return;
        }

        console.log(`[StepController] 📺 SetView: "${action.screen}" → "${action.view}"`);
        window.ScreenSystem.setView(action.screen, action.view);
    },

    /**
     * Esegue azione suono
     */
    executeSoundAction: function(action) {
        console.log(`[StepController] 🔊 Sound: "${action.path}"`);

        try {
            const audio = new Audio(action.path);
            audio.volume = 0.5;
            audio.play().catch(e => {
                console.warn(`[StepController] Errore riproduzione audio: ${e.message}`);
            });
        } catch (e) {
            console.warn(`[StepController] Errore caricamento audio: ${e.message}`);
        }
    },

    /**
     * Esegue azione hold (prendi/rilascia oggetto)
     */
    executeHoldAction: function(action) {
        if (!window.HoldableSystem) {
            console.warn('[StepController] HoldableSystem non disponibile');
            return;
        }

        const target = this.currentStep?.properties?.Elemento;
        if (!target) {
            console.warn('[StepController] Nessun elemento target per HoldAction');
            return;
        }

        console.log(`[StepController] 🤚 HoldAction: "${action.action}" su "${target}"`);

        if (action.action === 'pick') {
            window.HoldableSystem.pickObject(target);
        } else if (action.action === 'release') {
            window.HoldableSystem.releaseObject(target);
        }
    },

    /**
     * Schedula auto-avanzamento allo step successivo
     */
    scheduleAutoAdvance: function() {
        console.log('[StepController] ⏭️ Auto-avanzamento schedulato...');

        // Salva ID timeout in UI per permettere cancellazione se step cambia
        if (window.UI) {
            window.UI.autoAdvanceTimeoutId = setTimeout(() => {
                if (window.UI && typeof window.UI.nextStep === 'function') {
                    console.log('[StepController] ⏭️ Avanzamento allo step successivo');
                    window.UI.nextStep();
                } else {
                    console.error('[StepController] ❌ UI.nextStep non disponibile!');
                }
            }, 500);
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    // EVENT HANDLERS
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Handler per eventi stepTrigger custom
     */
    onStepTriggerEvent: function(event) {
        const { source, triggerId } = event.detail || {};

        if (source && triggerId) {
            this.triggerStep(source, triggerId);
        }
    },

    /**
     * Metodo di convenienza per trigger da ScreenSystem
     * @param {string} hotspotId - ID hotspot premuto
     * @param {string} screenId - ID schermo
     */
    onScreenHotspotClick: function(screenId, hotspotId) {
        const triggerId = `${screenId}.${hotspotId}`;
        return this.triggerStep(this.TRIGGER_SOURCES.SCREEN, triggerId);
    },

    /**
     * Metodo di convenienza per trigger da pulsante fisico
     * @param {string} modelName - Nome modello pulsante
     * @param {string} buttonId - ID pulsante (opzionale)
     */
    onPhysicalButtonClick: function(modelName, buttonId) {
        const triggerId = buttonId ? `${modelName}.${buttonId}` : modelName;
        return this.triggerStep(this.TRIGGER_SOURCES.PHYSICAL, triggerId);
    },

    /**
     * Metodo di convenienza per trigger da HoldableSystem
     * @param {string} objectName - Nome oggetto
     * @param {string} action - Azione ('pick', 'release', 'use')
     */
    onHoldableAction: function(objectName, action) {
        const triggerId = `${objectName}.${action}`;
        return this.triggerStep(this.TRIGGER_SOURCES.HOLDABLE, triggerId);
    },

    // ═══════════════════════════════════════════════════════════════════
    // PULSANTI FISICI 3D
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Registra un pulsante fisico 3D
     * @param {string} modelName - Nome del modello 3D (es: "remote_btn_power")
     * @param {Object} config - Configurazione pulsante
     *
     * config: {
     *   buttonId: 'btn_power',        // ID logico del pulsante
     *   parentModel: 'remote',        // Modello genitore (opzionale)
     *   onClick: 'Action:attiva_pompa' // Azione da eseguire (opzionale)
     * }
     */
    registerPhysicalButton: function(modelName, config) {
        const buttonConfig = {
            modelName: modelName,
            buttonId: config.buttonId || modelName,
            parentModel: config.parentModel || null,
            onClick: config.onClick || null
        };

        this.physicalButtons.set(modelName, buttonConfig);
        console.log(`[StepController] 🔘 Pulsante fisico registrato: "${modelName}"`, buttonConfig);
    },

    /**
     * Verifica se un modello è un pulsante fisico registrato
     * @param {string} modelName - Nome del modello
     * @returns {Object|null} Configurazione pulsante o null
     */
    getPhysicalButton: function(modelName) {
        // Cerca corrispondenza esatta
        if (this.physicalButtons.has(modelName)) {
            return this.physicalButtons.get(modelName);
        }

        // Cerca corrispondenza parziale (senza estensione .glb)
        const cleanName = modelName.replace('.glb', '');
        for (const [key, value] of this.physicalButtons) {
            if (key.replace('.glb', '') === cleanName) {
                return value;
            }
        }

        return null;
    },

    /**
     * Gestisce click su un modello 3D (chiamato da Scene3D)
     * @param {string} modelName - Nome del modello cliccato
     * @returns {boolean} true se era un pulsante fisico e è stato gestito
     */
    handleModel3DClick: function(modelName) {
        const button = this.getPhysicalButton(modelName);

        if (!button) {
            return false; // Non è un pulsante fisico registrato
        }

        console.log(`[StepController] 🔘 Click su pulsante fisico: "${modelName}"`);

        // Costruisci triggerId
        const triggerId = button.parentModel
            ? `${button.parentModel}.${button.buttonId}`
            : button.buttonId;

        // Notifica trigger fisico
        const handled = this.triggerStep(this.TRIGGER_SOURCES.PHYSICAL, triggerId);

        // Esegui anche onClick locale del pulsante se configurato
        if (button.onClick) {
            const actionMatch = button.onClick.match(/^Action:(.+)$/);
            if (actionMatch && window.ScreenSystem) {
                window.ScreenSystem.executeAction(actionMatch[1]);
            }
        }

        return handled || !!button.onClick;
    },

    /**
     * Pulisce registro pulsanti fisici
     */
    clearPhysicalButtons: function() {
        this.physicalButtons.clear();
        console.log('[StepController] 🗑️ Pulsanti fisici cancellati');
    },

    // ═══════════════════════════════════════════════════════════════════
    // UTILITY E CLEANUP
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Reset sistema
     */
    reset: function() {
        this.currentStepIndex = -1;
        this.currentStep = null;
        this.stepConfigs.clear();
        this.physicalButtons.clear();

        console.log('[StepController] 🔄 Reset completato');
    },

    /**
     * Abilita/disabilita controller
     */
    setEnabled: function(enabled) {
        this.enabled = enabled;
        console.log(`[StepController] ${enabled ? '✅ Abilitato' : '❌ Disabilitato'}`);
    },

    // ═══════════════════════════════════════════════════════════════════
    // DEBUG API
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Debug info completo
     */
    debugInfo: function() {
        console.log('═══════════════════════════════════════════════════════════');
        console.log('🎮 STEP CONTROLLER DEBUG INFO');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`Initialized: ${this.initialized}`);
        console.log(`Enabled: ${this.enabled}`);
        console.log(`Current Step Index: ${this.currentStepIndex}`);
        console.log(`Current Step: ${this.currentStep?.title || '(nessuno)'}`);
        console.log(`Step Configs Registrati: ${this.stepConfigs.size}`);

        if (this.stepConfigs.size > 0) {
            console.log('Configurazioni:');
            this.stepConfigs.forEach((config, index) => {
                console.log(`  Step ${index}:`);
                console.log(`    Triggers Screen: [${config.triggers.screen?.join(', ') || '-'}]`);
                console.log(`    Triggers Physical: [${config.triggers.physical?.join(', ') || '-'}]`);
                console.log(`    Actions Screen: ${config.actions.screen?.length || 0}`);
                console.log(`    Actions Physical: ${config.actions.physical?.length || 0}`);
                console.log(`    Actions Any: ${config.actions.any?.length || 0}`);
                console.log(`    Auto-Advance: ${config.autoAdvance}`);
            });
        }

        console.log('═══════════════════════════════════════════════════════════');

        return {
            initialized: this.initialized,
            enabled: this.enabled,
            currentStepIndex: this.currentStepIndex,
            stepConfigsCount: this.stepConfigs.size
        };
    },

    /**
     * Simula un trigger per testing
     */
    simulateTrigger: function(source, triggerId) {
        console.log(`[StepController] 🧪 SIMULAZIONE trigger: source="${source}", id="${triggerId}"`);
        return this.triggerStep(source, triggerId);
    },

    /**
     * Lista trigger accettati per step corrente
     */
    listAcceptedTriggers: function() {
        const config = this.stepConfigs.get(this.currentStepIndex);

        if (!config) {
            console.log('[StepController] Nessuna configurazione per step corrente');
            return null;
        }

        console.log('═══════════════════════════════════════════════════════════');
        console.log(`🎯 TRIGGER ACCETTATI per Step ${this.currentStepIndex}`);
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`Screen: [${config.triggers.screen?.join(', ') || '*'}]`);
        console.log(`Physical: [${config.triggers.physical?.join(', ') || '*'}]`);
        console.log(`Holdable: [${config.triggers.holdable?.join(', ') || '*'}]`);
        console.log('═══════════════════════════════════════════════════════════');

        return config.triggers;
    }
};

// Esporta per debug console
window.StepController = window.StepController;

console.log('[StepController] ✅ Modulo StepController pronto');
