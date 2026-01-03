/**
 * HoldableSystem.js - Sistema Oggetti Prendibili in Mano
 *
 * Gestisce oggetti 3D che possono essere presi e tenuti davanti alla camera:
 * - Tracking stato held/released per ogni oggetto
 * - Posizionamento relativo alla camera (segue movimento utente)
 * - Salvataggio/ripristino posizione originale
 * - Integrazione con ScreenSystem per schermi su oggetti tenuti
 *
 * Versione: 1.0.0
 * Data: Gennaio 2026
 */

console.log('[HoldableSystem] Modulo caricato v1.0.0');

window.HoldableSystem = {
    // ═══════════════════════════════════════════════════════════════════
    // STATO SISTEMA
    // ═══════════════════════════════════════════════════════════════════

    initialized: false,
    enabled: true,

    // ═══════════════════════════════════════════════════════════════════
    // REGISTRI E TRACKING
    // ═══════════════════════════════════════════════════════════════════

    // Configurazioni oggetti prendibili
    // holdableConfigs: Map<objectName, { holdPosition, holdRotation, model }>
    holdableConfigs: new Map(),

    // Stato runtime oggetti
    // heldObjects: Map<objectName, { isHeld, originalPosition, originalRotation, originalParent }>
    heldObjects: new Map(),

    // Lista oggetti attualmente tenuti (per update loop)
    currentlyHeldList: [],

    // ═══════════════════════════════════════════════════════════════════
    // CONFIGURAZIONE DEFAULT
    // ═══════════════════════════════════════════════════════════════════

    config: {
        // Offset default rispetto alla camera (mano sinistra)
        defaultHoldPosition: new THREE.Vector3(0.25, -0.15, 0.4),
        defaultHoldRotation: new THREE.Euler(-10 * Math.PI / 180, 15 * Math.PI / 180, 5 * Math.PI / 180),

        // Animazione pick/release
        pickDuration: 300, // ms
        releaseDuration: 400, // ms

        // Smoothing per movimento camera
        followSmoothing: 0.15, // 0-1, più alto = più reattivo

        // Scala oggetto quando tenuto (opzionale)
        heldScale: 1.0
    },

    // ═══════════════════════════════════════════════════════════════════
    // RIFERIMENTI SISTEMI ESTERNI
    // ═══════════════════════════════════════════════════════════════════

    scene: null,
    camera: null,
    scene3D: null,

    // Gruppo contenitore per oggetti held (child della camera)
    holdContainer: null,

    // ═══════════════════════════════════════════════════════════════════
    // INIZIALIZZAZIONE
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Inizializza il sistema holdable
     * @param {Object} scene3D - Riferimento a Scene3D
     * @returns {boolean} true se inizializzazione riuscita
     */
    init: function(scene3D) {
        console.log('[HoldableSystem] Inizializzazione sistema oggetti prendibili...');

        if (typeof THREE === 'undefined') {
            console.error('[HoldableSystem] Errore: Three.js non disponibile');
            return false;
        }

        this.scene3D = scene3D;
        this.scene = scene3D.scene;
        this.camera = scene3D.camera;

        if (!this.scene || !this.camera) {
            console.error('[HoldableSystem] Errore: Scene o Camera non disponibili');
            return false;
        }

        // Crea gruppo contenitore attaccato alla camera
        this.holdContainer = new THREE.Group();
        this.holdContainer.name = 'holdContainer';
        this.camera.add(this.holdContainer);

        // Inizializza config default con oggetti THREE
        this.config.defaultHoldPosition = new THREE.Vector3(0.25, -0.15, 0.4);
        this.config.defaultHoldRotation = new THREE.Euler(
            -10 * Math.PI / 180,
            15 * Math.PI / 180,
            5 * Math.PI / 180
        );

        this.initialized = true;
        console.log('[HoldableSystem] ✅ Sistema inizializzato correttamente');
        return true;
    },

    // ═══════════════════════════════════════════════════════════════════
    // REGISTRAZIONE OGGETTI PRENDIBILI
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Registra un oggetto come prendibile
     * @param {string} objectName - Nome modello (con o senza estensione)
     * @param {Object} config - Configurazione { HoldPosition, HoldRotation }
     */
    registerHoldable: function(objectName, config = {}) {
        const cleanName = objectName.replace(/\.(glb|gltf|obj|stl)$/i, '');

        const holdableConfig = {
            name: cleanName,
            holdPosition: this.parseVector3(config.HoldPosition) || this.config.defaultHoldPosition.clone(),
            holdRotation: this.parseEuler(config.HoldRotation) || this.config.defaultHoldRotation.clone(),
            model: config.Model || objectName
        };

        this.holdableConfigs.set(cleanName, holdableConfig);

        // Inizializza stato
        if (!this.heldObjects.has(cleanName)) {
            this.heldObjects.set(cleanName, {
                isHeld: false,
                originalPosition: null,
                originalRotation: null,
                originalScale: null,
                originalParent: null
            });
        }

        console.log(`[HoldableSystem] 🤚 Oggetto registrato come prendibile: "${cleanName}"`, holdableConfig);
    },

    /**
     * Registra holdable da definizione Screen
     * @param {string} screenId - ID schermo
     * @param {Object} screenConfig - Configurazione schermo
     */
    registerFromScreen: function(screenId, screenConfig) {
        if (screenConfig.Holdable === 'true' || screenConfig.Holdable === true) {
            const modelName = screenConfig.Model ?
                screenConfig.Model.replace(/^models\//, '').replace(/\.(glb|gltf|obj|stl)$/i, '') :
                screenId;

            this.registerHoldable(modelName, {
                HoldPosition: screenConfig.HoldPosition,
                HoldRotation: screenConfig.HoldRotation,
                Model: screenConfig.Model
            });
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    // OPERAZIONI PICK / RELEASE
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Prendi un oggetto in mano
     * @param {string} objectName - Nome oggetto da prendere
     * @returns {boolean} true se operazione riuscita
     */
    pickObject: function(objectName) {
        const cleanName = objectName.replace(/\.(glb|gltf|obj|stl)$/i, '');

        // Verifica che l'oggetto sia registrato come prendibile
        if (!this.holdableConfigs.has(cleanName)) {
            console.warn(`[HoldableSystem] ⚠️ Oggetto "${cleanName}" non registrato come prendibile`);
            return false;
        }

        // Verifica che non sia già tenuto
        const state = this.heldObjects.get(cleanName);
        if (state && state.isHeld) {
            console.log(`[HoldableSystem] Oggetto "${cleanName}" già tenuto in mano`);
            return true;
        }

        // Trova il modello nella scena
        const model = window.Scene3D ? window.Scene3D.findModelByName(cleanName) : null;
        if (!model) {
            console.error(`[HoldableSystem] ❌ Modello "${cleanName}" non trovato in scena`);
            return false;
        }

        const config = this.holdableConfigs.get(cleanName);

        // Salva stato originale
        const originalState = {
            isHeld: true,
            originalPosition: model.position.clone(),
            originalRotation: model.rotation.clone(),
            originalScale: model.scale.clone(),
            originalParent: model.parent
        };

        this.heldObjects.set(cleanName, originalState);

        // Anima il pick
        this.animatePick(model, config, () => {
            // Aggiungi alla lista held per update loop
            if (!this.currentlyHeldList.includes(cleanName)) {
                this.currentlyHeldList.push(cleanName);
            }

            console.log(`[HoldableSystem] 🤚 Oggetto "${cleanName}" preso in mano`);

            // Notifica ScreenSystem se disponibile
            if (window.ScreenSystem && window.ScreenSystem.screens.has(cleanName)) {
                console.log(`[HoldableSystem] 📺 Oggetto held ha schermo - ScreenSystem notificato`);
            }
        });

        return true;
    },

    /**
     * Rilascia un oggetto
     * @param {string} objectName - Nome oggetto da rilasciare
     * @returns {boolean} true se operazione riuscita
     */
    releaseObject: function(objectName) {
        const cleanName = objectName.replace(/\.(glb|gltf|obj|stl)$/i, '');

        const state = this.heldObjects.get(cleanName);
        if (!state || !state.isHeld) {
            console.log(`[HoldableSystem] Oggetto "${cleanName}" non è tenuto in mano`);
            return false;
        }

        // Trova il modello
        const model = window.Scene3D ? window.Scene3D.findModelByName(cleanName) : null;
        if (!model) {
            console.error(`[HoldableSystem] ❌ Modello "${cleanName}" non trovato`);
            return false;
        }

        // Rimuovi dalla lista held
        const index = this.currentlyHeldList.indexOf(cleanName);
        if (index > -1) {
            this.currentlyHeldList.splice(index, 1);
        }

        // Anima il release
        this.animateRelease(model, state, () => {
            // Aggiorna stato
            state.isHeld = false;

            console.log(`[HoldableSystem] ✋ Oggetto "${cleanName}" rilasciato`);

            // Notifica ScreenSystem per unfocus se necessario
            if (window.ScreenSystem && window.ScreenSystem.focusedScreen === cleanName) {
                window.ScreenSystem.unfocusScreen();
            }
        });

        return true;
    },

    // ═══════════════════════════════════════════════════════════════════
    // ANIMAZIONI PICK / RELEASE
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Anima il pick di un oggetto
     */
    animatePick: function(model, config, onComplete) {
        const startPosition = model.position.clone();
        const startRotation = model.rotation.clone();

        // Calcola posizione world target (camera + offset)
        const targetLocalPos = config.holdPosition.clone();
        const targetLocalRot = config.holdRotation.clone();

        // Rimuovi dal parent originale e aggiungi al container della camera
        const originalParent = model.parent;
        if (originalParent) {
            originalParent.remove(model);
        }

        // Converti posizione world in posizione locale rispetto alla camera
        model.position.copy(targetLocalPos);
        model.rotation.copy(targetLocalRot);

        // Aggiungi al container della camera
        this.holdContainer.add(model);

        // Per ora, nessuna animazione - posizionamento immediato
        // TODO: Aggiungere animazione smooth con TWEEN
        if (onComplete) onComplete();
    },

    /**
     * Anima il release di un oggetto
     */
    animateRelease: function(model, state, onComplete) {
        // Rimuovi dal container camera
        this.holdContainer.remove(model);

        // Ripristina nel parent originale
        if (state.originalParent) {
            state.originalParent.add(model);
        } else {
            this.scene.add(model);
        }

        // Ripristina posizione/rotazione originale
        model.position.copy(state.originalPosition);
        model.rotation.copy(state.originalRotation);
        model.scale.copy(state.originalScale);

        // Per ora, nessuna animazione - posizionamento immediato
        // TODO: Aggiungere animazione smooth con TWEEN
        if (onComplete) onComplete();
    },

    // ═══════════════════════════════════════════════════════════════════
    // UPDATE LOOP
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Update chiamato ogni frame dal render loop
     * Aggiorna posizione oggetti held relativamente alla camera
     */
    update: function() {
        if (!this.enabled || this.currentlyHeldList.length === 0) return;

        // Gli oggetti sono già nel holdContainer che è child della camera,
        // quindi seguono automaticamente il movimento della camera.
        // Questo metodo può essere usato per effetti aggiuntivi come:
        // - Oscillazione leggera (breathing)
        // - Smoothing del movimento
        // - Effetti di inerzia
    },

    // ═══════════════════════════════════════════════════════════════════
    // QUERY STATE
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Verifica se un oggetto è attualmente tenuto
     * @param {string} objectName - Nome oggetto
     * @returns {boolean}
     */
    isHeld: function(objectName) {
        const cleanName = objectName.replace(/\.(glb|gltf|obj|stl)$/i, '');
        const state = this.heldObjects.get(cleanName);
        return state ? state.isHeld : false;
    },

    /**
     * Ottieni lista oggetti attualmente tenuti
     * @returns {Array<string>}
     */
    getHeldObjects: function() {
        return [...this.currentlyHeldList];
    },

    /**
     * Verifica se un oggetto è registrato come prendibile
     * @param {string} objectName - Nome oggetto
     * @returns {boolean}
     */
    isHoldable: function(objectName) {
        const cleanName = objectName.replace(/\.(glb|gltf|obj|stl)$/i, '');
        return this.holdableConfigs.has(cleanName);
    },

    // ═══════════════════════════════════════════════════════════════════
    // CONFIGURAZIONE RUNTIME
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Imposta offset di hold per un oggetto specifico
     */
    setHoldOffset: function(objectName, position, rotation) {
        const cleanName = objectName.replace(/\.(glb|gltf|obj|stl)$/i, '');
        const config = this.holdableConfigs.get(cleanName);

        if (config) {
            if (position) {
                config.holdPosition = position instanceof THREE.Vector3 ?
                    position : new THREE.Vector3(position.x, position.y, position.z);
            }
            if (rotation) {
                config.holdRotation = rotation instanceof THREE.Euler ?
                    rotation : new THREE.Euler(
                        rotation.x * Math.PI / 180,
                        rotation.y * Math.PI / 180,
                        rotation.z * Math.PI / 180
                    );
            }
            console.log(`[HoldableSystem] 📐 Offset aggiornato per "${cleanName}"`);
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    // PARSING UTILITIES
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Parse stringa "(x,y,z)" in Vector3
     */
    parseVector3: function(str) {
        if (!str) return null;
        const match = str.match(/\(([^,]+),([^,]+),([^)]+)\)/);
        if (match) {
            return new THREE.Vector3(
                parseFloat(match[1]),
                parseFloat(match[2]),
                parseFloat(match[3])
            );
        }
        return null;
    },

    /**
     * Parse stringa "(rx,ry,rz)" in Euler (gradi → radianti)
     */
    parseEuler: function(str) {
        if (!str) return null;
        const match = str.match(/\(([^,]+),([^,]+),([^)]+)\)/);
        if (match) {
            return new THREE.Euler(
                parseFloat(match[1]) * Math.PI / 180,
                parseFloat(match[2]) * Math.PI / 180,
                parseFloat(match[3]) * Math.PI / 180
            );
        }
        return null;
    },

    // ═══════════════════════════════════════════════════════════════════
    // CLEANUP E RESET
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Rilascia tutti gli oggetti tenuti
     */
    releaseAll: function() {
        const heldList = [...this.currentlyHeldList];
        heldList.forEach(name => {
            this.releaseObject(name);
        });
        console.log('[HoldableSystem] ✋ Tutti gli oggetti rilasciati');
    },

    /**
     * Reset completo del sistema
     */
    reset: function() {
        this.releaseAll();
        this.holdableConfigs.clear();
        this.heldObjects.clear();
        this.currentlyHeldList = [];
        console.log('[HoldableSystem] 🔄 Sistema resettato');
    },

    /**
     * Pulisci solo le registrazioni (non rilascia oggetti)
     */
    clearRegistrations: function() {
        this.holdableConfigs.clear();
        console.log('[HoldableSystem] 🗑️ Registrazioni cancellate');
    },

    // ═══════════════════════════════════════════════════════════════════
    // DEBUG API
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Lista tutti gli oggetti prendibili registrati
     */
    listHoldables: function() {
        console.log('═══════════════════════════════════════════════════════════');
        console.log('🤚 OGGETTI PRENDIBILI REGISTRATI:');
        console.log('═══════════════════════════════════════════════════════════');

        if (this.holdableConfigs.size === 0) {
            console.log('   (nessun oggetto registrato)');
            return [];
        }

        const result = [];
        this.holdableConfigs.forEach((config, name) => {
            const state = this.heldObjects.get(name);
            const isHeld = state ? state.isHeld : false;
            const marker = isHeld ? '🤚' : '  ';

            console.log(`${marker} ${name}:`);
            console.log(`     └─ HoldPosition: (${config.holdPosition.x.toFixed(2)}, ${config.holdPosition.y.toFixed(2)}, ${config.holdPosition.z.toFixed(2)})`);
            console.log(`     └─ IsHeld: ${isHeld}`);

            result.push({ name, isHeld, config });
        });

        return result;
    },

    /**
     * Ottieni stato completo di un oggetto
     */
    getHoldableState: function(objectName) {
        const cleanName = objectName.replace(/\.(glb|gltf|obj|stl)$/i, '');

        const config = this.holdableConfigs.get(cleanName);
        const state = this.heldObjects.get(cleanName);

        return {
            isRegistered: !!config,
            isHeld: state ? state.isHeld : false,
            config: config || null,
            originalPosition: state ? state.originalPosition : null,
            originalRotation: state ? state.originalRotation : null
        };
    },

    /**
     * Debug completo stato sistema
     */
    debugInfo: function() {
        console.log('═══════════════════════════════════════════════════════════');
        console.log('🔍 HOLDABLE SYSTEM DEBUG INFO');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`Initialized: ${this.initialized}`);
        console.log(`Enabled: ${this.enabled}`);
        console.log(`Holdables Registered: ${this.holdableConfigs.size}`);
        console.log(`Currently Held: ${this.currentlyHeldList.length}`);
        console.log(`Held Objects: [${this.currentlyHeldList.join(', ')}]`);
        console.log(`Hold Container Children: ${this.holdContainer ? this.holdContainer.children.length : 0}`);
        console.log('═══════════════════════════════════════════════════════════');

        return {
            initialized: this.initialized,
            enabled: this.enabled,
            holdablesCount: this.holdableConfigs.size,
            currentlyHeld: this.currentlyHeldList.length,
            heldList: [...this.currentlyHeldList]
        };
    }
};

// Esporta per debug console
window.HoldableSystem = window.HoldableSystem;

console.log('[HoldableSystem] ✅ Modulo HoldableSystem pronto');
