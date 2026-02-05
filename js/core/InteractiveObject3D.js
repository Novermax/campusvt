/**
 * InteractiveObject3D.js - Sistema Gestione Oggetti 3D con Figli Interattivi
 *
 * Gestisce modelli GLB gerarchici con mesh figlie interattive:
 * - Pulsanti (button): click → emette evento
 * - Elementi rotanti (rotary): click → cicla stati, anima rotazione
 * - Indicatori (indicator): visibilità controllata da stato
 * - Schermi (screen): visibilità controllata da stato currentScreen
 *
 * @version 1.0.1 REFACTORING
 * @date Gennaio 2026
 */

console.log('[InteractiveObject3D] Modulo caricato v1.0.1 REFACTORING');

// FASE 5 REFACTORING: Helper per chiamate sicure a dipendenze esterne
const _io3d_safeCall = function(obj, method, args = [], fallback = null, context = 'InteractiveObject3D') {
    try {
        if (obj && typeof obj[method] === 'function') {
            return obj[method].apply(obj, args);
        }
        return fallback;
    } catch (error) {
        console.warn(`[${context}] Errore chiamata ${method}:`, error.message);
        return fallback;
    }
};

// Helper specifico per StepGatingManager
const _io3d_safeGatingCall = function(method, args = [], fallback = null) {
    return _io3d_safeCall(window.StepGatingManager, method, args, fallback, 'InteractiveObject3D→StepGating');
};

// Helper specifico per StepController
const _io3d_safeStepControllerCall = function(method, args = [], fallback = null) {
    return _io3d_safeCall(window.StepController, method, args, fallback, 'InteractiveObject3D→StepController');
};

window.InteractiveObject3D = {

    // ═══════════════════════════════════════════════════════════════════
    // CONFIGURAZIONE
    // ═══════════════════════════════════════════════════════════════════

    config: {
        // Animazioni
        rotationDuration: 300,          // Durata rotazione elementi rotary (ms)
        clickFeedbackDuration: 150,     // Durata feedback visivo click (ms)

        // Colori feedback
        hoverColor: 0x44ff44,           // Colore hover (verde)
        clickColor: 0xffff00,           // Colore click (giallo)

        // Debug
        debugMode: false,               // Log dettagliati
        showColliders: false            // Visualizza collider (debug)
    },

    // ═══════════════════════════════════════════════════════════════════
    // STATO INTERNO
    // ═══════════════════════════════════════════════════════════════════

    objects: new Map(),                 // modelName -> ObjectData
    stateGroups: new Map(),             // groupName -> StateGroupData
    hoveredChild: null,                 // Mesh figlia attualmente in hover
    initialized: false,

    // ═══════════════════════════════════════════════════════════════════
    // STRUTTURA DATI
    // ═══════════════════════════════════════════════════════════════════

    /*
    ObjectData = {
        name: string,                   // Nome modello
        config: {
            interactiveChildren: {
                'mesh_name': {
                    type: 'button' | 'rotary' | 'indicator' | 'screen',
                    states?: string[],          // Per rotary: ['off', 'on']
                    currentState?: number,      // Indice stato corrente
                    onClick?: string,           // Azione click
                    visibleWhen?: object,       // Condizioni visibilità
                    rotationAxis?: string,      // Asse rotazione: 'x', 'y', 'z'
                    rotationAngles?: object     // Angoli per stato: { off: 0, on: 45 }
                }
            },
            initialState: object        // Stato iniziale
        },
        state: object,                  // Stato corrente
        model: Object3D,                // Riferimento modello 3D
        childMeshes: Map                // meshName -> mesh reference
    }

    StateGroupData = {
        name: string,                   // Nome gruppo (es. "schermo", "chiave")
        variants: string[],             // Nomi mesh varianti (es. ["schermo.001", "schermo.002"])
        default: string,                // Variante default (prima visibile)
        current: string,                // Variante corrente visibile
        meshRefs: Map                   // variantName -> mesh reference
    }
    */

    // ═══════════════════════════════════════════════════════════════════
    // INIZIALIZZAZIONE
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Inizializza il sistema
     */
    init: function() {
        if (this.initialized) {
            console.warn('[InteractiveObject3D] Sistema già inizializzato');
            return;
        }

        console.log('🎮 [InteractiveObject3D] Inizializzazione sistema...');

        this.objects.clear();
        this.stateGroups.clear();
        this.hoveredChild = null;
        this.initialized = true;

        console.log('✅ [InteractiveObject3D] Sistema inizializzato');
    },

    // ═══════════════════════════════════════════════════════════════════
    // REGISTRAZIONE OGGETTI
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Registra un modello GLB con figli interattivi
     * @param {string} modelName - Nome del modello
     * @param {object} config - Configurazione figli interattivi
     */
    register: function(modelName, config) {
        if (!modelName) {
            console.error('[InteractiveObject3D] Nome modello richiesto');
            return false;
        }

        // Normalizza config
        const normalizedConfig = this.normalizeConfig(config);

        const objectData = {
            name: modelName,
            config: normalizedConfig,
            state: { ...normalizedConfig.initialState },
            model: null,
            childMeshes: new Map()
        };

        this.objects.set(modelName, objectData);

        console.log(`🎮 [InteractiveObject3D] Registrato: "${modelName}"`, {
            figli: Object.keys(normalizedConfig.interactiveChildren).length,
            statoIniziale: objectData.state
        });

        return true;
    },

    /**
     * Normalizza configurazione
     */
    normalizeConfig: function(config) {
        const normalized = {
            interactiveChildren: {},
            initialState: {}
        };

        if (config.interactiveChildren) {
            normalized.interactiveChildren = config.interactiveChildren;
        }

        if (config.initialState) {
            normalized.initialState = config.initialState;
        }

        // Imposta stati iniziali per elementi rotary
        for (const [name, child] of Object.entries(normalized.interactiveChildren)) {
            if (child.type === 'rotary' && child.states && child.states.length > 0) {
                if (normalized.initialState[name] === undefined) {
                    normalized.initialState[name] = child.states[0];
                }
            }
        }

        return normalized;
    },

    /**
     * Registra da sintassi tutorial
     * @param {string} modelName - Nome modello
     * @param {object} properties - Proprietà dal tutorial
     */
    registerFromTutorial: function(modelName, properties) {
        const config = {
            interactiveChildren: {},
            initialState: {}
        };

        // Parse InteractiveChild=mesh_name,type,options
        // Esempio: InteractiveChild=key_switch,rotary,states:off|on
        // Esempio: InteractiveChild=led_on,indicator,visibleWhen:key_switch=on
        // Esempio: InteractiveChild=btn_menu,button,onClick:setScreen:menu

        const childProperties = [];
        for (const [key, value] of Object.entries(properties)) {
            if (key.startsWith('InteractiveChild')) {
                // Supporta sia array (nuovo formato) che stringa singola (vecchio formato)
                if (Array.isArray(value)) {
                    childProperties.push(...value);
                } else {
                    childProperties.push(value);
                }
            }
        }
        console.log(`🎮 [InteractiveObject3D] Parsing ${childProperties.length} InteractiveChild per "${modelName}"`)

        for (const childDef of childProperties) {
            const parsed = this.parseInteractiveChildDef(childDef);
            if (parsed) {
                config.interactiveChildren[parsed.name] = parsed.config;
            }
        }

        // Parse InitialState=key:value,key2:value2
        if (properties.InitialState) {
            const statePairs = properties.InitialState.split(',');
            for (const pair of statePairs) {
                const [key, value] = pair.split(':').map(s => s.trim());
                if (key && value) {
                    config.initialState[key] = value;
                }
            }
        }

        return this.register(modelName, config);
    },

    /**
     * Parse definizione figlio interattivo
     * @param {string} def - Definizione: "mesh_name,type,options"
     */
    parseInteractiveChildDef: function(def) {
        const parts = def.split(',').map(s => s.trim());
        if (parts.length < 2) {
            console.warn(`[InteractiveObject3D] Definizione invalida: ${def}`);
            return null;
        }

        const name = parts[0];
        const type = parts[1];
        const config = { type };

        // Parse opzioni aggiuntive
        for (let i = 2; i < parts.length; i++) {
            const option = parts[i];

            // states:off|on
            if (option.startsWith('states:')) {
                config.states = option.substring(7).split('|').map(s => s.trim());
            }
            // visibleWhen:property=value
            else if (option.startsWith('visibleWhen:')) {
                const condition = option.substring(12);
                const [prop, val] = condition.split('=').map(s => s.trim());
                config.visibleWhen = config.visibleWhen || {};
                config.visibleWhen[prop] = val;
            }
            // onClick:action:param
            else if (option.startsWith('onClick:')) {
                config.onClick = option.substring(8);
            }
            // rotationAxis:z
            else if (option.startsWith('rotationAxis:')) {
                config.rotationAxis = option.substring(13);
            }
            // rotationAngles:off=0|on=45
            else if (option.startsWith('rotationAngles:')) {
                const angles = option.substring(15).split('|');
                config.rotationAngles = {};
                for (const angle of angles) {
                    const [state, deg] = angle.split('=');
                    config.rotationAngles[state.trim()] = parseFloat(deg);
                }
            }
            // opacity:0.8 (valore 0.0-1.0, default 0.6)
            else if (option.startsWith('opacity:')) {
                const opacityValue = parseFloat(option.substring(8));
                if (!isNaN(opacityValue) && opacityValue >= 0 && opacityValue <= 1) {
                    config.opacity = opacityValue;
                } else {
                    console.warn(`[InteractiveObject3D] Valore opacity invalido: ${option}, uso default 0.6`);
                    config.opacity = 0.6;
                }
            }
        }

        return { name, config };
    },

    // ═══════════════════════════════════════════════════════════════════
    // COLLEGAMENTO MODELLI 3D
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Collega un modello 3D caricato
     * @param {string} modelName - Nome modello registrato
     * @param {Object3D} model3D - Modello Three.js
     */
    attachModel: function(modelName, model3D) {
        const obj = this.objects.get(modelName);
        if (!obj) {
            if (this.config.debugMode) {
                console.log(`[InteractiveObject3D] Modello "${modelName}" non registrato, skip`);
            }
            return false;
        }

        obj.model = model3D;
        obj.childMeshes.clear();

        // DEBUG: Lista tutti i child names del modello per troubleshooting
        const allChildNames = [];
        model3D.traverse((child) => {
            if (child.name && child.name !== '') {
                allChildNames.push(`${child.name} (${child.type})`);
            }
        });
        console.log(`🔍 [InteractiveObject3D] Child disponibili in "${modelName}":`, allChildNames);
        console.log(`🔍 [InteractiveObject3D] InteractiveChildren registrati:`, Object.keys(obj.config.interactiveChildren));

        // Trova mesh/group figli interattivi per nome (case-insensitive)
        model3D.traverse((child) => {
            // Prima prova match esatto, poi case-insensitive
            let childConfig = obj.config.interactiveChildren[child.name];
            let matchedName = child.name;

            // Se non trovato, prova match case-insensitive
            if (!childConfig && child.name) {
                const childNameLower = child.name.toLowerCase();
                for (const [configName, config] of Object.entries(obj.config.interactiveChildren)) {
                    if (configName.toLowerCase() === childNameLower) {
                        childConfig = config;
                        matchedName = configName;
                        console.log(`🔄 [InteractiveObject3D] Match case-insensitive: GLB="${child.name}" ↔ Config="${configName}"`);
                        break;
                    }
                }
            }

            if (childConfig) {
                if (child.isMesh) {
                    // È una Mesh diretta - marca come interattivo
                    child.userData.interactive = true;
                    child.userData.interactiveParent = modelName;
                    child.userData.interactiveConfig = childConfig;

                    // Salva materiale originale per feedback
                    if (child.material) {
                        child.userData.originalMaterial = child.material.clone();
                    }

                    // Aggiungi alla mappa
                    obj.childMeshes.set(child.name, child);

                    console.log(`   ✓ Figlio interattivo (Mesh): "${child.name}" (${childConfig.type})`);

                } else if (child.isGroup || child.isObject3D) {
                    // È un Group - propaga userData.interactive a tutte le mesh child
                    // (Blender può esportare come Group quando nome datablock ≠ nome oggetto)
                    child.traverse((subChild) => {
                        if (subChild.isMesh) {
                            subChild.userData.interactive = true;
                            subChild.userData.interactiveParent = modelName;
                            subChild.userData.interactiveConfig = childConfig;
                            // Salva anche il nome del Group parent per riferimento
                            subChild.userData.interactiveGroupName = child.name;

                            // Salva materiale originale per feedback
                            if (subChild.material) {
                                subChild.userData.originalMaterial = subChild.material.clone();
                            }

                            console.log(`   ✓ Figlio interattivo (via Group "${child.name}"): mesh "${subChild.name}" (${childConfig.type})`);
                        }
                    });

                    // Aggiungi il Group alla mappa (per StateGroup visibility)
                    obj.childMeshes.set(child.name, child);

                    console.log(`   ✓ Figlio interattivo (Group): "${child.name}" (${childConfig.type})`);
                }
            }
        });

        // Fix materiali luminosi/emissivi (es. "luminoso.001" sui pulsanti)
        // Aumenta emissiveIntensity per renderli più brillanti
        model3D.traverse((child) => {
            if (child.isMesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach((mat, index) => {
                    const matName = mat.name ? mat.name.toLowerCase() : '';
                    if (matName.includes('luminoso') || matName.includes('emissive') || matName.includes('glow')) {
                        mat.emissiveIntensity = 3.0;
                        if (mat.emissive && mat.emissive.r === 0 && mat.emissive.g === 0 && mat.emissive.b === 0) {
                            mat.emissive = mat.color ? mat.color.clone() : new THREE.Color(1, 1, 1);
                        }
                        console.log(`💡 [InteractiveObject3D] Materiale luminoso potenziato: ${mat.name} su mesh ${child.name}[${index}]`);
                    }
                });
            }
        });

        // Applica stato iniziale (visibilità)
        this.applyState(modelName);

        console.log(`🔗 [InteractiveObject3D] Modello "${modelName}" collegato con ${obj.childMeshes.size} figli interattivi`);

        return true;
    },

    /**
     * Scollega un modello
     */
    detachModel: function(modelName) {
        const obj = this.objects.get(modelName);
        if (!obj) return;

        // Rimuovi marcatori dai figli
        if (obj.model) {
            obj.model.traverse((child) => {
                if (child.userData.interactiveParent === modelName) {
                    delete child.userData.interactive;
                    delete child.userData.interactiveParent;
                    delete child.userData.interactiveConfig;
                }
            });
        }

        obj.model = null;
        obj.childMeshes.clear();
    },

    // ═══════════════════════════════════════════════════════════════════
    // GESTIONE INTERAZIONI
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Gestisce click su mesh (chiamato da raycast system)
     * @param {Mesh} mesh - Mesh cliccata
     * @returns {boolean} True se gestito
     */
    handleClick: function(mesh) {
        if (!mesh || !mesh.userData.interactive) {
            return false;
        }

        const parentName = mesh.userData.interactiveParent;
        const childConfig = mesh.userData.interactiveConfig;
        const obj = this.objects.get(parentName);

        if (!obj) return false;

        // ═══════════════════════════════════════════════════════════════════════
        // STEP GATING CHECK GLOBALE - Blocca TUTTE le interazioni prima del tutorial
        // ═══════════════════════════════════════════════════════════════════════
        if (window.StepGatingManager && window.StepGatingManager.currentStepIndex < 0) {
            console.log(`🚫 [InteractiveObject3D] Interazione bloccata su "${mesh.name}" - tutorial non ancora avviato`);
            return false; // Blocca QUALSIASI interazione prima di avviare il tutorial
        }

        console.log(`🖱️ [InteractiveObject3D] Click su "${mesh.name}" (parent: ${parentName})`);

        // Feedback visivo
        this.showClickFeedback(mesh);

        // Gestisci in base al tipo
        switch (childConfig.type) {
            case 'button':
                return this.handleButtonClick(mesh, parentName, childConfig);

            case 'rotary':
                return this.handleRotaryClick(mesh, parentName, childConfig, obj);

            default:
                console.log(`[InteractiveObject3D] Tipo non gestito: ${childConfig.type}`);
                return false;
        }
    },

    /**
     * Gestisce click su pulsante
     */
    handleButtonClick: function(mesh, parentName, config) {
        // Usa il nome del Group parent se la mesh è stata registrata via Group
        // (Blender esporta come Group quando nome datablock ≠ nome oggetto)
        const buttonId = mesh.userData.interactiveGroupName || mesh.name;

        // STEP GATING CHECK - Verifica se il pulsante è attivo nello step corrente
        // (Il controllo currentStepIndex < 0 è già fatto in handleClick globale)
        if (window.StepGatingManager && !window.StepGatingManager.isButtonActive(buttonId)) {
            console.log(`🚫 [InteractiveObject3D] Pulsante "${buttonId}" bloccato dal gating - step ${window.StepGatingManager.currentStepIndex}`);
            return false; // Ignora click
        }

        const action = config.onClick;

        console.log(`🔘 [InteractiveObject3D] Button click: ${parentName}.${buttonId} (mesh: ${mesh.name}) → ${action}`);

        // Rimuovi evidenziazione del pulsante cliccato (se era evidenziato)
        const triggerId = `${parentName}.${buttonId}`;
        if (this.highlightedButtons.has(triggerId)) {
            const highlightedMesh = this.highlightedButtons.get(triggerId);
            if (highlightedMesh && highlightedMesh.material) {
                // Ripristina valori originali (emissive, opacity, transparent)
                if (highlightedMesh.material.emissive) {
                    highlightedMesh.material.emissive.setHex(highlightedMesh.userData.originalEmissive || 0x000000);
                    highlightedMesh.material.emissiveIntensity = highlightedMesh.userData.originalEmissiveIntensity || 0;
                }

                // Ripristina opacity, transparent e depthWrite
                if (highlightedMesh.userData.originalOpacity !== undefined) {
                    highlightedMesh.material.opacity = highlightedMesh.userData.originalOpacity;
                }
                if (highlightedMesh.userData.originalTransparent !== undefined) {
                    highlightedMesh.material.transparent = highlightedMesh.userData.originalTransparent;
                }
                highlightedMesh.material.depthWrite = true;
                highlightedMesh.material.needsUpdate = true;
            }
            this.highlightedButtons.delete(triggerId);
            console.log(`💡 [InteractiveObject3D] Evidenziazione rimossa da "${buttonId}" dopo click (opacity ripristinata a ${highlightedMesh.userData.originalOpacity})`);

            // NUOVO: Rimuovi cerchio pulsante dopo click
            if (window.Scene3D && window.Scene3D.highlightCircleManager) {
                try {
                    window.Scene3D.highlightCircleManager.removeCircle(triggerId);
                    console.log(`🔵 [InteractiveObject3D] Cerchio rimosso per "${triggerId}" dopo click`);
                } catch (error) {
                    console.warn(`🔵 [InteractiveObject3D] Errore rimozione cerchio per "${triggerId}":`, error);
                }
            }
        }

        // Emetti evento per StepController - usa buttonId (nome Group) per trigger
        let handledByStepController = false;
        if (window.StepController) {
            handledByStepController = window.StepController.triggerStep('physical', triggerId);

            if (handledByStepController) {
                console.log(`   ✓ Gestito da StepController`);
            }
        }

        // Esegui azione locale SOLO se NON gestito da StepController
        // Questo previene conflitti tra azioni tutorial e azioni InteractiveChild
        // (es. OnPhysicalTrigger con setVariant vs onClick con cycleVariant)
        if (action && !handledByStepController) {
            console.log(`   ⚡ Esecuzione azione locale (non gestito da StepController)`);
            this.executeAction(parentName, action);
        } else if (action && handledByStepController) {
            console.log(`   ⏭️ Azione locale "${action}" ignorata (già gestito da StepController)`);
        }

        // Emetti evento custom
        this.emitEvent('button_click', {
            parent: parentName,
            child: buttonId,        // Nome Group (o mesh se non c'è Group)
            meshName: mesh.name,    // Nome mesh effettivo
            action: action
        });

        return true;
    },

    /**
     * Gestisce click su elemento rotante
     */
    handleRotaryClick: function(mesh, parentName, config, obj) {
        if (!config.states || config.states.length === 0) {
            console.warn(`[InteractiveObject3D] Rotary senza stati: ${mesh.name}`);
            return false;
        }

        // Usa il nome del Group parent se la mesh è stata registrata via Group
        const rotaryId = mesh.userData.interactiveGroupName || mesh.name;

        // Trova stato corrente
        const currentState = obj.state[rotaryId] || config.states[0];
        const currentIdx = config.states.indexOf(currentState);

        // Calcola prossimo stato (ciclo)
        const nextIdx = (currentIdx + 1) % config.states.length;
        const nextState = config.states[nextIdx];

        console.log(`🔄 [InteractiveObject3D] Rotary: ${parentName}.${rotaryId}: "${currentState}" → "${nextState}"`);

        // PRIMA verifica se StepController gestisce questo trigger
        let handledByStepController = false;
        if (window.StepController) {
            // Per rotary, il trigger è semplicemente "parent.rotaryId" (es. "pulpito.chiave")
            // StepController gestirà il cambio di variante tramite OnPhysicalTrigger
            const triggerId = `${parentName}.${rotaryId}`;
            handledByStepController = window.StepController.triggerStep('physical', triggerId);

            if (handledByStepController) {
                console.log(`   ✓ Gestito da StepController - cambio stato locale ignorato`);
            }
        }

        // Esegui cambio stato locale SOLO se NON gestito da StepController
        // Questo previene conflitti tra OnPhysicalTrigger e rotary automatico
        if (!handledByStepController) {
            console.log(`   ⚡ Esecuzione cambio stato locale (non gestito da StepController)`);
            // Aggiorna stato
            this.setState(parentName, rotaryId, nextState);

            // Anima rotazione
            this.animateRotation(mesh, config, nextState);
        } else {
            console.log(`   ⏭️ Cambio stato locale ignorato (già gestito da StepController)`);
        }

        return true;
    },

    /**
     * Gestisce hover su mesh
     * @param {Mesh} mesh - Mesh in hover (null se nessuna)
     */
    handleHover: function(mesh) {
        // Rimuovi hover precedente
        if (this.hoveredChild && this.hoveredChild !== mesh) {
            this.removeHoverFeedback(this.hoveredChild);
        }

        // Applica nuovo hover
        if (mesh && mesh.userData.interactive) {
            this.showHoverFeedback(mesh);
            this.hoveredChild = mesh;
        } else {
            this.hoveredChild = null;
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    // GESTIONE STATO
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Imposta stato proprietà
     * @param {string} parentName - Nome oggetto
     * @param {string} property - Nome proprietà
     * @param {any} value - Nuovo valore
     */
    setState: function(parentName, property, value) {
        const obj = this.objects.get(parentName);
        if (!obj) return false;

        const oldValue = obj.state[property];
        obj.state[property] = value;

        console.log(`📊 [InteractiveObject3D] State: ${parentName}.${property}: "${oldValue}" → "${value}"`);

        // Applica side effects (visibilità)
        this.applyState(parentName);

        // Emetti evento
        this.emitEvent('state_change', {
            parent: parentName,
            property: property,
            oldValue: oldValue,
            newValue: value
        });

        return true;
    },

    /**
     * Ottieni stato corrente
     */
    getState: function(parentName, property) {
        const obj = this.objects.get(parentName);
        if (!obj) return undefined;

        if (property) {
            return obj.state[property];
        }
        return { ...obj.state };
    },

    /**
     * Applica stato corrente (aggiorna visibilità mesh)
     */
    applyState: function(parentName) {
        const obj = this.objects.get(parentName);
        if (!obj || !obj.model) return;

        for (const [meshName, mesh] of obj.childMeshes) {
            const config = obj.config.interactiveChildren[meshName];
            if (!config || !config.visibleWhen) continue;

            // Verifica tutte le condizioni
            let visible = true;
            for (const [prop, expectedValue] of Object.entries(config.visibleWhen)) {
                if (obj.state[prop] !== expectedValue) {
                    visible = false;
                    break;
                }
            }

            if (mesh.visible !== visible) {
                mesh.visible = visible;
                console.log(`   👁️ ${meshName}: visible = ${visible}`);
            }
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    // STATE GROUPS - VARIANTI MUTUAMENTE ESCLUSIVE
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Registra un gruppo di varianti mutuamente esclusive
     * @param {string} groupName - Nome del gruppo (es. "schermo", "chiave")
     * @param {object} config - Configurazione gruppo
     * @param {string[]} config.variants - Nomi mesh varianti
     * @param {string} config.default - Variante default (opzionale, usa prima)
     */
    registerStateGroup: function(groupName, config) {
        if (!groupName || !config.variants || config.variants.length === 0) {
            console.error('[InteractiveObject3D] StateGroup richiede nome e variants');
            return false;
        }

        const groupData = {
            name: groupName,
            variants: config.variants,
            default: config.default || config.variants[0],
            current: config.default || config.variants[0],
            meshRefs: new Map()
        };

        this.stateGroups.set(groupName, groupData);

        console.log(`🔀 [InteractiveObject3D] StateGroup registrato: "${groupName}"`, {
            variants: groupData.variants,
            default: groupData.default
        });

        return true;
    },

    /**
     * Registra StateGroup da sintassi tutorial
     * @param {string} groupName - Nome gruppo
     * @param {object} properties - Proprietà dal tutorial
     */
    registerStateGroupFromTutorial: function(groupName, properties) {
        const config = {
            variants: [],
            default: null
        };

        // Parse Variants=schermo.001,schermo.002,schermo.003
        if (properties.Variants) {
            config.variants = properties.Variants.split(',').map(s => s.trim());
        }

        // Parse Default=schermo.001
        if (properties.Default) {
            config.default = properties.Default.trim();
        }

        return this.registerStateGroup(groupName, config);
    },

    /**
     * Collega mesh alle varianti di un gruppo
     * Deve essere chiamato dopo che il modello 3D è stato caricato
     * @param {Object3D} model3D - Modello Three.js contenente le mesh varianti
     */
    attachStateGroupMeshes: function(model3D) {
        if (!model3D) return;

        let totalAttached = 0;

        // DEBUG: Log tutti i nomi degli oggetti nel modello usando traverse RICORSIVO
        const allObjectNames = [];
        const traverseDeep = (obj, depth = 0) => {
            if (obj.name) {
                const type = obj.isMesh ? 'M' : (obj.isGroup ? 'G' : 'O');
                allObjectNames.push(`${'  '.repeat(depth)}${obj.name}(${type})`);
            }
            if (obj.children) {
                obj.children.forEach(child => traverseDeep(child, depth + 1));
            }
        };
        traverseDeep(model3D);
        console.log(`📋 [DEBUG] Gerarchia oggetti in "${model3D.name || 'unnamed'}" (${allObjectNames.length} totali):`);
        allObjectNames.slice(0, 100).forEach(name => console.log(`   ${name}`));
        if (allObjectNames.length > 100) {
            console.log(`   ...e altri ${allObjectNames.length - 100}`);
        }

        // Cerca specificamente oggetti con "tool" nel nome (case-insensitive) usando traverse ricorsivo
        const toolObjects = [];
        model3D.traverse((child) => {
            if (child.name && child.name.toLowerCase().includes('tool')) {
                const type = child.isMesh ? 'Mesh' : (child.isGroup ? 'Group' : 'Object3D');
                // Include anche il parent path per debug
                let path = child.name;
                let parent = child.parent;
                while (parent && parent.name) {
                    path = parent.name + '/' + path;
                    parent = parent.parent;
                }
                toolObjects.push(`${path} (${type})`);
            }
        });
        if (toolObjects.length > 0) {
            console.log(`🔧 [DEBUG] Trovati oggetti con "tool" nel nome:`, toolObjects);
        } else {
            console.log(`🔧 [DEBUG] NESSUN oggetto con "tool" nel nome trovato in "${model3D.name}"`);
        }

        for (const [groupName, group] of this.stateGroups) {
            // NON fare clear() - potrebbe cancellare mesh già collegate da altri modelli!
            // Solo aggiunge nuove mesh trovate in questo modello

            console.log(`🔍 [DEBUG] Cercando varianti per StateGroup "${groupName}":`, group.variants);

            // Cerca le varianti nel modello - sia Mesh che Group/Object3D
            // IMPORTANTE: traverse() è già ricorsivo, ma verifichiamo con log espliciti
            let foundInThisModel = 0;
            model3D.traverse((child) => {
                // Match esatto
                if (group.variants.includes(child.name)) {
                    // Trovata variante - può essere Mesh o Group
                    group.meshRefs.set(child.name, child);
                    totalAttached++;
                    foundInThisModel++;

                    // Imposta visibilità iniziale (funziona sia per Mesh che Group)
                    child.visible = (child.name === group.current);

                    const objectType = child.isMesh ? 'Mesh' : (child.isGroup ? 'Group' : 'Object3D');
                    console.log(`   ✅ StateGroup "${groupName}": TROVATO ${objectType} "${child.name}" ${child.visible ? '(visibile)' : '(nascosta)'}`);
                }
            });

            // Se non trovato con match esatto, prova match parziale (es. "tool0" in "tool0.001")
            if (foundInThisModel === 0) {
                console.log(`   ⚠️ Nessun match esatto trovato, provo match parziale...`);
                for (const variantName of group.variants) {
                    if (group.meshRefs.has(variantName)) continue; // Già trovato

                    model3D.traverse((child) => {
                        if (!child.name) return;
                        // Match parziale: il nome dell'oggetto INIZIA con il nome della variante
                        // Es: "tool0" matcha "tool0", "tool0.001", "tool0_copy"
                        if (child.name.startsWith(variantName) || child.name === variantName) {
                            if (!group.meshRefs.has(variantName)) {
                                group.meshRefs.set(variantName, child);
                                totalAttached++;

                                child.visible = (variantName === group.current);

                                const objectType = child.isMesh ? 'Mesh' : (child.isGroup ? 'Group' : 'Object3D');
                                console.log(`   ✅ StateGroup "${groupName}": MATCH PARZIALE ${objectType} "${child.name}" → variante "${variantName}" ${child.visible ? '(visibile)' : '(nascosta)'}`);
                            }
                        }
                    });
                }
            }

            // Verifica che tutte le varianti siano state trovate
            const found = group.meshRefs.size;
            const total = group.variants.length;
            if (found < total) {
                console.warn(`[InteractiveObject3D] StateGroup "${groupName}": trovate ${found}/${total} varianti`);
                console.warn(`   Varianti mancanti:`, group.variants.filter(v => !group.meshRefs.has(v)));
            }
        }

        if (totalAttached > 0) {
            console.log(`🔀 [InteractiveObject3D] Collegate ${totalAttached} mesh a StateGroups`);
        }
    },

    /**
     * Cerca varianti StateGroup in TUTTI i modelli della scena
     * Chiamare dopo che tutti i modelli sono stati caricati
     */
    attachStateGroupMeshesFromScene: function() {
        if (!window.Scene3D || !window.Scene3D.scene) {
            console.warn('[InteractiveObject3D] Scene3D non disponibile');
            return;
        }

        console.log(`🔍 [InteractiveObject3D] Cercando varianti StateGroup in TUTTA la scena...`);

        let totalAttached = 0;

        // Cerca in tutti i modelli della scena
        window.Scene3D.scene.traverse((obj) => {
            // Per ogni StateGroup, cerca le varianti
            for (const [groupName, group] of this.stateGroups) {
                // Match esatto
                if (group.variants.includes(obj.name) && !group.meshRefs.has(obj.name)) {
                    group.meshRefs.set(obj.name, obj);
                    totalAttached++;

                    obj.visible = (obj.name === group.current);

                    const objectType = obj.isMesh ? 'Mesh' : (obj.isGroup ? 'Group' : 'Object3D');
                    console.log(`   ✅ StateGroup "${groupName}": TROVATO in scena ${objectType} "${obj.name}" ${obj.visible ? '(visibile)' : '(nascosta)'}`);
                }

                // Match parziale per varianti non ancora trovate
                for (const variantName of group.variants) {
                    if (group.meshRefs.has(variantName)) continue;

                    if (obj.name && (obj.name.startsWith(variantName) || obj.name === variantName)) {
                        group.meshRefs.set(variantName, obj);
                        totalAttached++;

                        obj.visible = (variantName === group.current);

                        const objectType = obj.isMesh ? 'Mesh' : (obj.isGroup ? 'Group' : 'Object3D');
                        console.log(`   ✅ StateGroup "${groupName}": MATCH PARZIALE in scena ${objectType} "${obj.name}" → variante "${variantName}" ${obj.visible ? '(visibile)' : '(nascosta)'}`);
                    }
                }
            }
        });

        // Report finale
        for (const [groupName, group] of this.stateGroups) {
            const found = group.meshRefs.size;
            const total = group.variants.length;
            if (found < total) {
                console.warn(`[InteractiveObject3D] StateGroup "${groupName}": trovate ${found}/${total} varianti dopo ricerca globale`);
                console.warn(`   Varianti mancanti:`, group.variants.filter(v => !group.meshRefs.has(v)));
            } else {
                console.log(`✅ [InteractiveObject3D] StateGroup "${groupName}": tutte le ${total} varianti trovate`);
            }
        }

        if (totalAttached > 0) {
            console.log(`🔀 [InteractiveObject3D] Collegate ${totalAttached} mesh a StateGroups dalla scena`);
        }
    },

    /**
     * Cambia la variante visibile di un gruppo
     * @param {string} groupName - Nome del gruppo
     * @param {string} targetVariant - Nome della variante da mostrare
     * @returns {boolean} True se il cambio è riuscito
     */
    setStateVariant: function(groupName, targetVariant) {
        const group = this.stateGroups.get(groupName);
        if (!group) {
            console.warn(`[InteractiveObject3D] StateGroup "${groupName}" non trovato`);
            return false;
        }

        // Verifica che la variante esista
        if (!group.variants.includes(targetVariant)) {
            console.warn(`[InteractiveObject3D] Variante "${targetVariant}" non esiste in gruppo "${groupName}"`);
            return false;
        }

        const oldVariant = group.current;
        if (oldVariant === targetVariant) {
            console.log(`[InteractiveObject3D] StateGroup "${groupName}" già su "${targetVariant}"`);
            return true;
        }

        console.log(`🔀 [InteractiveObject3D] StateGroup "${groupName}": "${oldVariant}" → "${targetVariant}"`);

        // Nascondi tutte le varianti
        for (const [variantName, mesh] of group.meshRefs) {
            if (mesh.visible) {
                mesh.visible = false;
            }
        }

        // Mostra solo la variante target
        const targetMesh = group.meshRefs.get(targetVariant);
        if (targetMesh) {
            targetMesh.visible = true;
        } else {
            console.warn(`[InteractiveObject3D] Mesh "${targetVariant}" non collegata`);
        }

        // Aggiorna stato
        group.current = targetVariant;

        // Emetti evento
        this.emitEvent('stategroup_change', {
            group: groupName,
            oldVariant: oldVariant,
            newVariant: targetVariant
        });

        return true;
    },

    /**
     * Cicla alla prossima variante del gruppo
     * @param {string} groupName - Nome del gruppo
     * @returns {string} Nome della nuova variante corrente
     */
    cycleStateVariant: function(groupName) {
        const group = this.stateGroups.get(groupName);
        if (!group) {
            console.warn(`[InteractiveObject3D] StateGroup "${groupName}" non trovato`);
            return null;
        }

        const currentIdx = group.variants.indexOf(group.current);
        const nextIdx = (currentIdx + 1) % group.variants.length;
        const nextVariant = group.variants[nextIdx];

        this.setStateVariant(groupName, nextVariant);

        return nextVariant;
    },

    /**
     * Ottieni variante corrente di un gruppo
     * @param {string} groupName - Nome del gruppo
     * @returns {string} Nome della variante corrente
     */
    getCurrentVariant: function(groupName) {
        const group = this.stateGroups.get(groupName);
        return group ? group.current : null;
    },

    /**
     * Ottieni tutte le varianti di un gruppo
     * @param {string} groupName - Nome del gruppo
     * @returns {string[]} Array di nomi varianti
     */
    getVariants: function(groupName) {
        const group = this.stateGroups.get(groupName);
        return group ? [...group.variants] : [];
    },

    /**
     * Lista tutti i gruppi di stato registrati
     */
    listStateGroups: function() {
        console.log('🔀 [InteractiveObject3D] State Groups registrati:');
        console.log('═'.repeat(50));

        if (this.stateGroups.size === 0) {
            console.log('   (nessuno)');
            return [];
        }

        for (const [name, group] of this.stateGroups) {
            const attached = group.meshRefs.size;
            const total = group.variants.length;
            console.log(`📦 ${name}`);
            console.log(`   Varianti: ${group.variants.join(', ')}`);
            console.log(`   Corrente: ${group.current}`);
            console.log(`   Mesh collegate: ${attached}/${total}`);
        }

        return Array.from(this.stateGroups.keys());
    },

    // ═══════════════════════════════════════════════════════════════════
    // ANIMAZIONI
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Anima rotazione elemento
     */
    animateRotation: function(mesh, config, targetState) {
        const axis = config.rotationAxis || 'z';
        const angles = config.rotationAngles || { off: 0, on: 45 };
        const targetAngle = (angles[targetState] || 0) * Math.PI / 180;

        const duration = this.config.rotationDuration;

        // Usa TWEEN se disponibile
        if (window.TWEEN) {
            const target = {};
            target[axis] = targetAngle;

            new TWEEN.Tween(mesh.rotation)
                .to(target, duration)
                .easing(TWEEN.Easing.Quadratic.Out)
                .start();
        } else {
            // Fallback: rotazione immediata
            mesh.rotation[axis] = targetAngle;
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    // FEEDBACK VISIVO
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Mostra feedback hover
     */
    showHoverFeedback: function(mesh) {
        if (!mesh.material) return;

        // Salva materiale e valori originali SOLO la prima volta
        if (!mesh.userData.originalMaterial) {
            mesh.userData.originalMaterial = mesh.material.clone();
        }

        // Applica emissione
        if (mesh.material.emissive) {
            // Salva valori originali SOLO se non già salvati
            if (mesh.userData.originalEmissive === undefined) {
                mesh.userData.originalEmissive = mesh.material.emissive.getHex();
                mesh.userData.originalEmissiveIntensity = mesh.material.emissiveIntensity || 0;
            }
            mesh.material.emissive.setHex(this.config.hoverColor);
            mesh.material.emissiveIntensity = Math.max(0.3, mesh.userData.originalEmissiveIntensity);
        }
    },

    /**
     * Rimuovi feedback hover
     */
    removeHoverFeedback: function(mesh) {
        if (!mesh.material) return;

        if (mesh.material.emissive && mesh.userData.originalEmissive !== undefined) {
            mesh.material.emissive.setHex(mesh.userData.originalEmissive);
            // Ripristina intensità originale invece di resettare a 0
            mesh.material.emissiveIntensity = mesh.userData.originalEmissiveIntensity || 0;
        }
    },

    /**
     * Mostra feedback click
     */
    showClickFeedback: function(mesh) {
        if (!mesh.material || !mesh.material.emissive) return;

        // Usa valori originali salvati se disponibili, altrimenti salva ora
        if (mesh.userData.originalEmissive === undefined) {
            mesh.userData.originalEmissive = mesh.material.emissive.getHex();
            mesh.userData.originalEmissiveIntensity = mesh.material.emissiveIntensity || 0;
        }

        const originalEmissive = mesh.userData.originalEmissive;
        const originalIntensity = mesh.userData.originalEmissiveIntensity;

        mesh.material.emissive.setHex(this.config.clickColor);
        mesh.material.emissiveIntensity = Math.max(0.5, originalIntensity);

        // Ripristina dopo delay
        setTimeout(() => {
            if (mesh.material && mesh.material.emissive) {
                mesh.material.emissive.setHex(originalEmissive);
                mesh.material.emissiveIntensity = originalIntensity;
            }
        }, this.config.clickFeedbackDuration);
    },

    // ═══════════════════════════════════════════════════════════════════
    // EVIDENZIAZIONE PULSANTI RICHIESTI (Tutorial Step)
    // ═══════════════════════════════════════════════════════════════════

    highlightedButtons: new Map(), // Tracking pulsanti evidenziati: buttonId -> mesh

    /**
     * Evidenzia i pulsanti richiesti dallo step corrente
     * @param {string[]} triggers - Array di trigger fisici (es. ["pulpito.Pulsante_mdi", "remote.pulsante_r_play"])
     */
    highlightRequiredButtons: function(triggers, opacity) {
        if (!triggers || triggers.length === 0) {
            return;
        }

        // Default opacity: 1.0 (completamente opaco)
        const highlightOpacity = (opacity !== undefined && !isNaN(opacity)) ? opacity : 1.0;

        console.log(`💡 [InteractiveObject3D] Evidenziazione pulsanti richiesti:`, triggers);
        console.log(`💡 [InteractiveObject3D] Opacità evidenziazione: ${highlightOpacity}`);

        triggers.forEach(trigger => {
            // Parse trigger: "parentName.buttonId"
            const parts = trigger.split('.');
            if (parts.length !== 2) {
                console.warn(`[InteractiveObject3D] Formato trigger non valido: "${trigger}"`);
                return;
            }

            const [parentName, buttonId] = parts;
            console.log(`💡 [InteractiveObject3D] Cercando pulsante: parent="${parentName}", button="${buttonId}"`);

            // Trova mesh del pulsante
            let buttonMesh = null;

            // STRATEGIA 1: Cerca in InteractiveObject registrato (se presente)
            const obj = this.objects.get(parentName);

            if (obj) {
                console.log(`💡 [InteractiveObject3D] ✓ Oggetto "${parentName}" trovato in registry, childMeshes:`, obj.childMeshes.size);

                // Cerca prima nelle mesh child dirette
                buttonMesh = obj.childMeshes.get(buttonId);
                if (buttonMesh) {
                    // Se è un Group (export Blender con nome diverso dal datablock),
                    // cerca la prima mesh figlia con materiale
                    if ((buttonMesh.isGroup || buttonMesh.isObject3D) && !buttonMesh.isMesh) {
                        console.log(`💡 [InteractiveObject3D] childMeshes contiene Group "${buttonId}", cercando mesh figlia...`);
                        let groupMesh = null;
                        buttonMesh.traverse((subChild) => {
                            if (!groupMesh && subChild.isMesh && subChild.material) {
                                groupMesh = subChild;
                            }
                        });
                        if (groupMesh) {
                            console.log(`💡 [InteractiveObject3D] ✓ Mesh figlia trovata in Group: "${groupMesh.name}"`);
                            buttonMesh = groupMesh;
                        } else {
                            console.warn(`💡 [InteractiveObject3D] ❌ Nessuna mesh trovata nel Group "${buttonId}"`);
                            buttonMesh = null;
                        }
                    } else {
                        console.log(`💡 [InteractiveObject3D] ✓ Mesh trovata in childMeshes diretto`);
                    }
                }

                // Se non trovata, cerca nel modello
                if (!buttonMesh && obj.model) {
                    console.log(`💡 [InteractiveObject3D] Mesh non trovata in childMeshes, cercando in model.traverse...`);
                    let childCount = 0;

                    obj.model.traverse((child) => {
                        childCount++;

                        if (!buttonMesh && child.isGroup && child.name === buttonId) {
                            console.log(`💡 [InteractiveObject3D] ✓ Trovato Group "${child.name}", cercando mesh figlia...`);
                            child.traverse((subChild) => {
                                if (!buttonMesh && subChild.isMesh && subChild.material) {
                                    console.log(`💡 [InteractiveObject3D] ✓ Trovata mesh figlia in Group: "${subChild.name}"`);
                                    buttonMesh = subChild;
                                }
                            });
                        } else if (!buttonMesh && child.isMesh && child.name === buttonId) {
                            console.log(`💡 [InteractiveObject3D] ✓ Trovata Mesh diretta: "${child.name}"`);
                            buttonMesh = child;
                        }
                    });

                    console.log(`💡 [InteractiveObject3D] Totale child nel model: ${childCount}`);
                }
            }

            // STRATEGIA 2: Se non trovato in registry, cerca direttamente nella scena
            if (!buttonMesh && window.Scene3D) {
                console.log(`💡 [InteractiveObject3D] Oggetto non in registry, cercando modello "${parentName}" nella scena...`);

                const parentModel = window.Scene3D.findModelByName(parentName);

                if (parentModel) {
                    console.log(`💡 [InteractiveObject3D] ✓ Modello parent "${parentName}" trovato nella scena, cercando child...`);

                    parentModel.traverse((child) => {
                        if (!buttonMesh && child.isGroup && child.name === buttonId) {
                            console.log(`💡 [InteractiveObject3D] ✓ Trovato Group "${child.name}", cercando mesh figlia...`);
                            child.traverse((subChild) => {
                                if (!buttonMesh && subChild.isMesh && subChild.material) {
                                    console.log(`💡 [InteractiveObject3D] ✓ Trovata mesh figlia in Group: "${subChild.name}"`);
                                    buttonMesh = subChild;
                                }
                            });
                        } else if (!buttonMesh && child.isMesh && child.name === buttonId) {
                            console.log(`💡 [InteractiveObject3D] ✓ Trovata Mesh diretta: "${child.name}"`);
                            buttonMesh = child;
                        }
                    });
                } else {
                    console.warn(`💡 [InteractiveObject3D] ❌ Modello parent "${parentName}" non trovato nella scena`);
                }
            }

            if (!buttonMesh) {
                console.warn(`[InteractiveObject3D] ❌ Mesh pulsante "${buttonId}" non trovata in "${parentName}"`);
                if (obj) {
                    console.log(`💡 [InteractiveObject3D] childMeshes disponibili:`, Array.from(obj.childMeshes.keys()));
                }
                return;
            }

            console.log(`💡 [InteractiveObject3D] ✓ Mesh pulsante trovata, applicando evidenziazione...`);
            // Applica evidenziazione gialla con opacità personalizzata
            this.applyButtonHighlight(buttonMesh, trigger, highlightOpacity);
        });
    },

    /**
     * Applica evidenziazione gialla a un pulsante con opacità personalizzata
     * @param {Mesh} mesh - Mesh da evidenziare
     * @param {string} triggerId - ID del trigger per tracking
     * @param {number} opacity - Opacità del materiale (0.0=invisibile, 1.0=opaco, default: 1.0)
     */
    applyButtonHighlight: function(mesh, triggerId, opacity) {
        const highlightOpacity = (opacity !== undefined && !isNaN(opacity)) ? Math.max(0, Math.min(1, opacity)) : 1.0;
        console.log(`💡 [InteractiveObject3D] applyButtonHighlight chiamato per mesh:`, mesh.name);
        console.log(`💡 [InteractiveObject3D] Mesh ha material:`, !!mesh.material);
        console.log(`💡 [InteractiveObject3D] Material type:`, mesh.material?.type);
        console.log(`💡 [InteractiveObject3D] Material ha emissive:`, !!mesh.material?.emissive);

        if (!mesh.material) {
            console.warn(`💡 [InteractiveObject3D] ❌ Mesh senza materiale, skip evidenziazione`);
            return;
        }

        // Salva valori originali se non già fatto (emissive, opacity, transparent)
        if (mesh.userData.originalEmissive === undefined) {
            const origEmissive = mesh.material.emissive ? mesh.material.emissive.getHex() : 0x000000;
            const origIntensity = mesh.material.emissiveIntensity || 0;
            const origOpacity = mesh.material.opacity !== undefined ? mesh.material.opacity : 1.0;
            const origTransparent = mesh.material.transparent !== undefined ? mesh.material.transparent : false;

            mesh.userData.originalEmissive = origEmissive;
            mesh.userData.originalEmissiveIntensity = origIntensity;
            mesh.userData.originalOpacity = origOpacity;
            mesh.userData.originalTransparent = origTransparent;

            console.log(`💡 [InteractiveObject3D] Valori originali salvati: emissive=${origEmissive.toString(16)}, intensity=${origIntensity}, opacity=${origOpacity}, transparent=${origTransparent}`);
        }

        // Applica emissione gialla (intensità fissa 2.0 per glow visibile)
        if (mesh.material.emissive) {
            mesh.material.emissive.setHex(0xffff00); // Giallo brillante
            mesh.material.emissiveIntensity = 2.0;
            console.log(`💡 [InteractiveObject3D] ✓ Emissive applicata: 0xffff00, intensity=2.0`);
        } else {
            console.warn(`💡 [InteractiveObject3D] ⚠️ Material non ha proprietà emissive, evidenziazione potrebbe non essere visibile`);
        }

        // Applica trasparenza reale (si vede attraverso il pulsante)
        mesh.material.opacity = highlightOpacity;
        mesh.material.transparent = highlightOpacity < 1.0;
        mesh.material.depthWrite = highlightOpacity >= 1.0; // Disabilita depthWrite per trasparenza corretta
        mesh.material.needsUpdate = true;
        console.log(`💡 [InteractiveObject3D] ✓ Opacity impostata a ${highlightOpacity} (transparent: ${highlightOpacity < 1.0})`);

        // Traccia pulsante evidenziato
        this.highlightedButtons.set(triggerId, mesh);

        console.log(`💡 [InteractiveObject3D] ✓ Pulsante "${mesh.name}" evidenziato e aggiunto a highlightedButtons (totale: ${this.highlightedButtons.size})`);

        // Crea cerchio pulsante giallo sovrapposto
        if (window.Scene3D && window.Scene3D.highlightCircleManager) {
            try {
                window.Scene3D.highlightCircleManager.createCircle(triggerId, mesh);
                console.log(`🔵 [InteractiveObject3D] Cerchio evidenziazione creato per "${triggerId}"`);
            } catch (error) {
                console.warn(`🔵 [InteractiveObject3D] Errore creazione cerchio per "${triggerId}":`, error);
            }
        }
    },

    /**
     * Rimuove tutte le evidenziazioni dei pulsanti
     */
    clearButtonHighlights: function() {
        if (this.highlightedButtons.size === 0) {
            return;
        }

        console.log(`💡 [InteractiveObject3D] Rimozione ${this.highlightedButtons.size} evidenziazioni pulsanti`);

        for (const [triggerId, mesh] of this.highlightedButtons) {
            if (mesh && mesh.material) {
                // Ripristina valori originali (emissive, opacity, transparent)
                if (mesh.material.emissive) {
                    mesh.material.emissive.setHex(mesh.userData.originalEmissive || 0x000000);
                    mesh.material.emissiveIntensity = mesh.userData.originalEmissiveIntensity || 0;
                }

                // Ripristina opacity, transparent e depthWrite
                if (mesh.userData.originalOpacity !== undefined) {
                    mesh.material.opacity = mesh.userData.originalOpacity;
                }
                if (mesh.userData.originalTransparent !== undefined) {
                    mesh.material.transparent = mesh.userData.originalTransparent;
                }
                mesh.material.depthWrite = true; // Ripristina depthWrite standard
                mesh.material.needsUpdate = true;

                console.log(`💡 [InteractiveObject3D] ✓ Evidenziazione rimossa da "${mesh.name}" (opacity ripristinata a ${mesh.userData.originalOpacity})`);
            }

            // NUOVO: Rimuovi cerchio pulsante corrispondente
            if (window.Scene3D && window.Scene3D.highlightCircleManager) {
                try {
                    window.Scene3D.highlightCircleManager.removeCircle(triggerId);
                    console.log(`🔵 [InteractiveObject3D] Cerchio rimosso per "${triggerId}"`);
                } catch (error) {
                    console.warn(`🔵 [InteractiveObject3D] Errore rimozione cerchio per "${triggerId}":`, error);
                }
            }
        }

        this.highlightedButtons.clear();
    },

    // ═══════════════════════════════════════════════════════════════════
    // ESECUZIONE AZIONI
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Esegue azione locale
     * @param {string} parentName - Nome oggetto
     * @param {string} actionString - Stringa azione (es. "setScreen:menu")
     */
    executeAction: function(parentName, actionString) {
        if (!actionString) return;

        const parts = actionString.split(':');
        const action = parts[0];
        const param = parts.slice(1).join(':');

        console.log(`⚡ [InteractiveObject3D] Eseguo azione: ${action}(${param})`);

        switch (action) {
            case 'setScreen':
                // Cambia schermo visibile
                this.setState(parentName, 'currentScreen', param);

                // Notifica anche ScreenSystem se presente
                if (window.ScreenSystem) {
                    window.ScreenSystem.setView(parentName, param);
                }
                break;

            case 'setState':
                // setState:property=value
                const [prop, val] = param.split('=');
                this.setState(parentName, prop, val);
                break;

            case 'toggle':
                // Toggle booleano
                const current = this.getState(parentName, param);
                this.setState(parentName, param, current === 'on' ? 'off' : 'on');
                break;

            case 'animate':
                // Esegui animazione su modello
                if (window.Scene3D) {
                    window.Scene3D.executeAnimation(param);
                }
                break;

            case 'setVariant':
                // setVariant:groupName=variantName
                const [groupName, variantName] = param.split('=');
                this.setStateVariant(groupName, variantName);
                break;

            case 'cycleVariant':
                // cycleVariant:groupName
                this.cycleStateVariant(param);
                break;

            case 'advance':
            case 'nextStep':
                // Avanza tutorial
                if (window.UI) {
                    window.UI.goToStep(window.UI.currentStepIndex + 1);
                }
                break;

            default:
                console.warn(`[InteractiveObject3D] Azione sconosciuta: ${action}`);
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    // EVENTI
    // ═══════════════════════════════════════════════════════════════════

    eventListeners: new Map(),

    /**
     * Registra listener evento
     */
    on: function(eventName, callback) {
        if (!this.eventListeners.has(eventName)) {
            this.eventListeners.set(eventName, []);
        }
        this.eventListeners.get(eventName).push(callback);
    },

    /**
     * Rimuovi listener
     */
    off: function(eventName, callback) {
        const listeners = this.eventListeners.get(eventName);
        if (listeners) {
            const idx = listeners.indexOf(callback);
            if (idx !== -1) listeners.splice(idx, 1);
        }
    },

    /**
     * Emetti evento
     */
    emitEvent: function(eventName, data) {
        const listeners = this.eventListeners.get(eventName);
        if (listeners) {
            listeners.forEach(cb => {
                try {
                    cb(data);
                } catch (e) {
                    console.error(`[InteractiveObject3D] Errore in listener ${eventName}:`, e);
                }
            });
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    // UTILITY E DEBUG
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Lista oggetti registrati
     */
    listObjects: function() {
        console.log('🎮 [InteractiveObject3D] Oggetti registrati:');
        console.log('═'.repeat(50));

        for (const [name, obj] of this.objects) {
            const attached = obj.model ? '✓' : '✗';
            const childCount = obj.childMeshes.size;
            console.log(`${attached} ${name}`);
            console.log(`   Figli: ${Object.keys(obj.config.interactiveChildren).join(', ')}`);
            console.log(`   Stato: ${JSON.stringify(obj.state)}`);
            console.log(`   Collegati: ${childCount}/${Object.keys(obj.config.interactiveChildren).length}`);
        }

        return Array.from(this.objects.keys());
    },

    /**
     * Debug info completo
     */
    debugInfo: function() {
        console.log('');
        console.log('🎮 ═══════════════════════════════════════════════════');
        console.log('   INTERACTIVE OBJECT 3D - DEBUG INFO');
        console.log('═══════════════════════════════════════════════════');
        console.log(`Inizializzato: ${this.initialized}`);
        console.log(`Oggetti registrati: ${this.objects.size}`);
        console.log(`StateGroups registrati: ${this.stateGroups.size}`);
        console.log(`Hover attuale: ${this.hoveredChild?.name || 'nessuno'}`);
        console.log('');

        this.listObjects();

        if (this.stateGroups.size > 0) {
            console.log('');
            this.listStateGroups();
        }

        console.log('═══════════════════════════════════════════════════');
        console.log('');

        return {
            initialized: this.initialized,
            objectCount: this.objects.size,
            stateGroupCount: this.stateGroups.size,
            objects: Array.from(this.objects.entries()).map(([name, obj]) => ({
                name,
                attached: !!obj.model,
                state: obj.state,
                children: Array.from(obj.childMeshes.keys())
            })),
            stateGroups: Array.from(this.stateGroups.entries()).map(([name, group]) => ({
                name,
                variants: group.variants,
                current: group.current,
                meshCount: group.meshRefs.size
            }))
        };
    },

    /**
     * Trova mesh interattive per raycast
     * @returns {Array} Array di mesh interattive
     */
    getInteractiveMeshes: function() {
        const meshes = [];

        for (const [name, obj] of this.objects) {
            if (obj.model) {
                for (const [meshName, mesh] of obj.childMeshes) {
                    meshes.push(mesh);
                }
            }
        }

        return meshes;
    },

    /**
     * Reset sistema
     */
    reset: function() {
        // Rimuovi riferimenti modelli
        for (const [name, obj] of this.objects) {
            this.detachModel(name);
        }

        this.objects.clear();
        this.stateGroups.clear();
        this.hoveredChild = null;
        this.eventListeners.clear();

        console.log('🔄 [InteractiveObject3D] Sistema resettato');
    }
};

// Auto-init se caricato dopo DOM ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    // Delay per assicurarsi che altri moduli siano caricati
    setTimeout(() => {
        if (!window.InteractiveObject3D.initialized) {
            window.InteractiveObject3D.init();
        }
    }, 100);
}

console.log('📦 [InteractiveObject3D] Modulo caricato');
