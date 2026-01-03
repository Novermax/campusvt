/**
 * InteractiveObject3D.js - Sistema Gestione Oggetti 3D con Figli Interattivi
 *
 * Gestisce modelli GLB gerarchici con mesh figlie interattive:
 * - Pulsanti (button): click → emette evento
 * - Elementi rotanti (rotary): click → cicla stati, anima rotazione
 * - Indicatori (indicator): visibilità controllata da stato
 * - Schermi (screen): visibilità controllata da stato currentScreen
 *
 * @version 1.0.0
 * @date Gennaio 2026
 */

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
                childProperties.push(value);
            }
        }

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

        // Trova mesh figlie interattive per nome
        model3D.traverse((child) => {
            if (child.isMesh) {
                const childConfig = obj.config.interactiveChildren[child.name];

                if (childConfig) {
                    // Marca come interattivo
                    child.userData.interactive = true;
                    child.userData.interactiveParent = modelName;
                    child.userData.interactiveConfig = childConfig;

                    // Salva materiale originale per feedback
                    if (child.material) {
                        child.userData.originalMaterial = child.material.clone();
                    }

                    // Aggiungi alla mappa
                    obj.childMeshes.set(child.name, child);

                    console.log(`   ✓ Figlio interattivo trovato: "${child.name}" (${childConfig.type})`);
                }
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
        const action = config.onClick;

        console.log(`🔘 [InteractiveObject3D] Button click: ${parentName}.${mesh.name} → ${action}`);

        // Emetti evento per StepController
        if (window.StepController) {
            const triggerId = `${parentName}.${mesh.name}`;
            const handled = window.StepController.triggerStep('physical', triggerId);

            if (handled) {
                console.log(`   ✓ Gestito da StepController`);
            }
        }

        // Esegui azione locale se definita
        if (action) {
            this.executeAction(parentName, action);
        }

        // Emetti evento custom
        this.emitEvent('button_click', {
            parent: parentName,
            child: mesh.name,
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

        // Trova stato corrente
        const currentState = obj.state[mesh.name] || config.states[0];
        const currentIdx = config.states.indexOf(currentState);

        // Calcola prossimo stato (ciclo)
        const nextIdx = (currentIdx + 1) % config.states.length;
        const nextState = config.states[nextIdx];

        console.log(`🔄 [InteractiveObject3D] Rotary: ${parentName}.${mesh.name}: "${currentState}" → "${nextState}"`);

        // Aggiorna stato
        this.setState(parentName, mesh.name, nextState);

        // Anima rotazione
        this.animateRotation(mesh, config, nextState);

        // Emetti evento per StepController
        if (window.StepController) {
            const triggerId = `${parentName}.${mesh.name}_${nextState}`;
            window.StepController.triggerStep('physical', triggerId);
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

        // DEBUG: Log tutti i nomi delle mesh nel modello
        const allMeshNames = [];
        model3D.traverse((child) => {
            if (child.isMesh && child.name) {
                allMeshNames.push(child.name);
            }
        });
        console.log(`📋 [DEBUG] Mesh nel modello "${model3D.name || 'unnamed'}":`, allMeshNames.slice(0, 30), allMeshNames.length > 30 ? `...e altre ${allMeshNames.length - 30}` : '');

        for (const [groupName, group] of this.stateGroups) {
            group.meshRefs.clear();

            console.log(`🔍 [DEBUG] Cercando varianti per StateGroup "${groupName}":`, group.variants);

            // Cerca le mesh varianti nel modello
            model3D.traverse((child) => {
                if (child.isMesh && group.variants.includes(child.name)) {
                    group.meshRefs.set(child.name, child);
                    totalAttached++;

                    // Imposta visibilità iniziale
                    child.visible = (child.name === group.current);

                    console.log(`   🔗 StateGroup "${groupName}": mesh "${child.name}" ${child.visible ? '(visibile)' : '(nascosta)'}`);
                }
            });

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

        // Salva materiale se non già salvato
        if (!mesh.userData.originalMaterial) {
            mesh.userData.originalMaterial = mesh.material.clone();
        }

        // Applica emissione
        if (mesh.material.emissive) {
            mesh.userData.originalEmissive = mesh.material.emissive.getHex();
            mesh.material.emissive.setHex(this.config.hoverColor);
            mesh.material.emissiveIntensity = 0.3;
        }
    },

    /**
     * Rimuovi feedback hover
     */
    removeHoverFeedback: function(mesh) {
        if (!mesh.material) return;

        if (mesh.material.emissive && mesh.userData.originalEmissive !== undefined) {
            mesh.material.emissive.setHex(mesh.userData.originalEmissive);
            mesh.material.emissiveIntensity = 0;
        }
    },

    /**
     * Mostra feedback click
     */
    showClickFeedback: function(mesh) {
        if (!mesh.material || !mesh.material.emissive) return;

        const originalEmissive = mesh.material.emissive.getHex();
        mesh.material.emissive.setHex(this.config.clickColor);
        mesh.material.emissiveIntensity = 0.5;

        // Ripristina dopo delay
        setTimeout(() => {
            if (mesh.material && mesh.material.emissive) {
                mesh.material.emissive.setHex(originalEmissive);
                mesh.material.emissiveIntensity = 0;
            }
        }, this.config.clickFeedbackDuration);
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
