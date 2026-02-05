/**
 * TouchInteractive3DHandler - Gestione elementi 3D interattivi via touch
 *
 * Responsabilità:
 * - Tap su pulsanti 3D → Attiva InteractiveObject3D.handleClick()
 * - Tap su elementi rotary → Cicla stato
 * - Integrazione con StepController per trigger
 *
 * @version 1.0.0
 * @date Febbraio 2026
 */

window.TouchInteractive3DHandler = {

    // Stato
    initialized: false,
    lastClickedObject: null,
    lastClickTime: 0,

    // Configurazione
    config: {
        debounceTime: 300  // ms - tempo minimo tra click sullo stesso oggetto
    },

    // ═══════════════════════════════════════════════════════════
    // INIZIALIZZAZIONE
    // ═══════════════════════════════════════════════════════════

    init: function() {
        this.initialized = true;
        console.log('[TouchInteractive3DHandler] Inizializzato');
    },

    // ═══════════════════════════════════════════════════════════
    // TAP SU ELEMENTI INTERATTIVI
    // ═══════════════════════════════════════════════════════════

    handleTap: function(event, target, hitPoint) {
        if (!target) return;

        // Debounce - evita click multipli
        const now = Date.now();
        if (target === this.lastClickedObject && now - this.lastClickTime < this.config.debounceTime) {
            console.log('[TouchInteractive3DHandler] Click ignorato (debounce)');
            return;
        }

        this.lastClickedObject = target;
        this.lastClickTime = now;

        console.log('[TouchInteractive3DHandler] TAP su elemento interattivo:', target.name);

        // Trova la configurazione interattiva
        const interactiveConfig = this.getInteractiveConfig(target);

        if (interactiveConfig) {
            this.handleInteractiveClick(target, interactiveConfig, hitPoint);
        } else {
            // Fallback: propaga a InteractiveObject3D generico
            this.handleGenericInteractiveClick(target, hitPoint);
        }
    },

    handleDoubleTap: function(event, target, hitPoint) {
        // Double tap su interattivo - comportamento uguale al tap singolo
        // ma potrebbe essere usato per azioni speciali in futuro
        this.handleTap(event, target, hitPoint);
    },

    // ═══════════════════════════════════════════════════════════
    // GESTIONE CLICK INTERATTIVO
    // ═══════════════════════════════════════════════════════════

    /**
     * Ottiene la configurazione interattiva dell'oggetto
     */
    getInteractiveConfig: function(object) {
        // Controlla userData diretto
        if (object.userData && object.userData.interactiveConfig) {
            return object.userData.interactiveConfig;
        }

        // Controlla se è un Group con config nel parent
        if (object.userData && object.userData.interactiveGroupName) {
            // Il nome del group è salvato, cerca il parent
            let parent = object.parent;
            while (parent) {
                if (parent.name === object.userData.interactiveGroupName &&
                    parent.userData && parent.userData.interactiveConfig) {
                    return parent.userData.interactiveConfig;
                }
                parent = parent.parent;
            }
        }

        // Risali la gerarchia
        let current = object.parent;
        while (current) {
            if (current.userData && current.userData.interactiveConfig) {
                return current.userData.interactiveConfig;
            }
            current = current.parent;
        }

        return null;
    },

    /**
     * Gestisce click su elemento con configurazione interattiva
     */
    handleInteractiveClick: function(object, config, hitPoint) {
        const type = config.type || 'button';

        console.log('[TouchInteractive3DHandler] Tipo interattivo:', type);

        switch (type) {
            case 'button':
                this.handleButtonClick(object, config, hitPoint);
                break;

            case 'rotary':
                this.handleRotaryClick(object, config, hitPoint);
                break;

            case 'indicator':
                // Gli indicatori non sono cliccabili
                console.log('[TouchInteractive3DHandler] Indicatore - non cliccabile');
                break;

            case 'screen':
                // Schermi gestiti da ScreenSystem
                this.handleScreenClick(object, config, hitPoint);
                break;

            default:
                this.handleGenericInteractiveClick(object, hitPoint);
        }
    },

    /**
     * Gestisce click su pulsante 3D
     */
    handleButtonClick: function(object, config, hitPoint) {
        console.log('[TouchInteractive3DHandler] Button click:', object.name);

        // Effetto visivo feedback
        this.showClickFeedback(object);

        // Esegui azione onClick se definita
        if (config.onClick) {
            this.executeOnClickAction(config.onClick, object);
        }

        // Notifica InteractiveObject3D
        if (window.InteractiveObject3D && window.InteractiveObject3D.handleClick) {
            window.InteractiveObject3D.handleClick(object, { isTouch: true, point: hitPoint });
        }

        // Notifica StepController
        this.notifyStepController(object, 'button');
    },

    /**
     * Gestisce click su elemento rotary (chiave)
     */
    handleRotaryClick: function(object, config, hitPoint) {
        console.log('[TouchInteractive3DHandler] Rotary click:', object.name);

        // Effetto visivo feedback
        this.showClickFeedback(object);

        // Notifica InteractiveObject3D per ciclare stato
        if (window.InteractiveObject3D && window.InteractiveObject3D.handleClick) {
            window.InteractiveObject3D.handleClick(object, { isTouch: true, point: hitPoint });
        }

        // Notifica StepController
        this.notifyStepController(object, 'rotary');
    },

    /**
     * Gestisce click su schermo interattivo
     */
    handleScreenClick: function(object, config, hitPoint) {
        console.log('[TouchInteractive3DHandler] Screen click:', object.name);

        // Propaga a ScreenSystem se disponibile
        if (window.ScreenSystem && window.ScreenSystem.handleClick) {
            window.ScreenSystem.handleClick(object, hitPoint, { isTouch: true });
        }
    },

    /**
     * Gestisce click generico su oggetto interattivo
     */
    handleGenericInteractiveClick: function(object, hitPoint) {
        console.log('[TouchInteractive3DHandler] Generic interactive click:', object.name);

        // Prova a usare InteractiveObject3D
        if (window.InteractiveObject3D && window.InteractiveObject3D.handleClick) {
            window.InteractiveObject3D.handleClick(object, { isTouch: true, point: hitPoint });
        }
    },

    // ═══════════════════════════════════════════════════════════
    // FEEDBACK VISIVO
    // ═══════════════════════════════════════════════════════════

    /**
     * Mostra feedback visivo per click
     */
    showClickFeedback: function(object) {
        if (!object.material) return;

        // Salva colore originale se non già salvato
        const materials = Array.isArray(object.material) ? object.material : [object.material];

        materials.forEach(material => {
            if (material.emissive) {
                // Salva originale
                if (material.userData === undefined) material.userData = {};
                if (material.userData.originalEmissive === undefined) {
                    material.userData.originalEmissive = material.emissive.getHex();
                    material.userData.originalEmissiveIntensity = material.emissiveIntensity || 0;
                }

                // Flash giallo
                material.emissive.setHex(0xffff00);
                material.emissiveIntensity = 1.0;

                // Ripristina dopo 200ms
                setTimeout(() => {
                    material.emissive.setHex(material.userData.originalEmissive);
                    material.emissiveIntensity = material.userData.originalEmissiveIntensity || 0;
                }, 200);
            }
        });
    },

    // ═══════════════════════════════════════════════════════════
    // INTEGRAZIONE STEP CONTROLLER
    // ═══════════════════════════════════════════════════════════

    /**
     * Notifica StepController dell'interazione
     */
    notifyStepController: function(object, interactionType) {
        if (!window.StepController) return;

        // Costruisci trigger ID
        const objectName = this.getObjectTriggerName(object);
        const triggerId = objectName;

        console.log('[TouchInteractive3DHandler] Notifica StepController:', triggerId);

        if (window.StepController.triggerStep) {
            window.StepController.triggerStep('physical', triggerId);
        }
    },

    /**
     * Ottiene il nome dell'oggetto per il trigger
     */
    getObjectTriggerName: function(object) {
        // Se ha interactiveGroupName, usa quello
        if (object.userData && object.userData.interactiveGroupName) {
            // Trova il parent model
            let parent = object.parent;
            while (parent && parent.parent) {
                if (parent.parent.type === 'Scene' || !parent.parent.parent) {
                    return parent.name + '.' + object.userData.interactiveGroupName;
                }
                parent = parent.parent;
            }
        }

        // Risali fino al modello principale
        let modelName = '';
        let current = object;

        while (current.parent) {
            if (current.parent.type === 'Scene' || !current.parent.parent) {
                modelName = current.name;
                break;
            }
            current = current.parent;
        }

        return modelName ? modelName + '.' + object.name : object.name;
    },

    // ═══════════════════════════════════════════════════════════
    // ESECUZIONE AZIONI
    // ═══════════════════════════════════════════════════════════

    /**
     * Esegue azione onClick dalla configurazione
     */
    executeOnClickAction: function(action, object) {
        if (!action) return;

        console.log('[TouchInteractive3DHandler] Esecuzione azione:', action);

        // Parse azione
        if (action.startsWith('setScreen:')) {
            const screenId = action.substring('setScreen:'.length);
            if (window.InteractiveObject3D && window.InteractiveObject3D.executeAction) {
                window.InteractiveObject3D.executeAction(object, 'setScreen:' + screenId);
            }
        } else if (action.startsWith('setVariant:')) {
            if (window.InteractiveObject3D && window.InteractiveObject3D.executeSetVariantAction) {
                window.InteractiveObject3D.executeSetVariantAction(action.substring('setVariant:'.length));
            }
        } else if (action.startsWith('cycleVariant:')) {
            if (window.InteractiveObject3D && window.InteractiveObject3D.executeCycleVariantAction) {
                window.InteractiveObject3D.executeCycleVariantAction(action.substring('cycleVariant:'.length));
            }
        } else if (action === 'advance_step') {
            if (window.UI && window.UI.nextStep) {
                window.UI.nextStep();
            }
        }
    },

    // ═══════════════════════════════════════════════════════════
    // DEBUG
    // ═══════════════════════════════════════════════════════════

    debugInfo: function() {
        console.log('═══════════════════════════════════════');
        console.log('🔘 TouchInteractive3DHandler - Debug Info');
        console.log('═══════════════════════════════════════');
        console.log('Initialized:', this.initialized);
        console.log('Last clicked object:', this.lastClickedObject?.name);
        console.log('Last click time:', this.lastClickTime);
        console.log('Config:', this.config);
        console.log('═══════════════════════════════════════');
    }
};
