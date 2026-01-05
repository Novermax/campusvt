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
     * Anima il pick di un oggetto con transizione smooth TWEEN
     * APPROCCIO: NON spostiamo il modello nella gerarchia camera,
     * ma lo lasciamo nella scena e aggiorniamo la sua posizione world ogni frame
     */
    animatePick: function(model, config, onComplete) {
        // Salva l'offset locale desiderato (relativo alla camera)
        const holdOffset = config.holdPosition.clone();
        holdOffset.z = -Math.abs(holdOffset.z); // Z negativo = davanti alla camera

        const holdRotation = config.holdRotation.clone();

        // Salva posizione/rotazione di partenza
        const startPosition = model.position.clone();
        const startQuaternion = model.quaternion.clone();

        // Salviamo i parametri per l'update loop
        model.userData.holdOffset = holdOffset;
        model.userData.holdRotation = holdRotation;
        model.userData.isBeingHeld = true;
        model.userData.pickAnimationProgress = 0; // 0 = inizio, 1 = fine

        // Disabilita frustum culling
        model.traverse((child) => {
            child.frustumCulled = false;
        });

        console.log(`[HoldableSystem] 🎬 Animazione PICK avviata per "${model.name}"`);

        // Animazione con TWEEN
        const duration = this.config.pickDuration;
        const tweenData = { progress: 0 };

        if (typeof TWEEN !== 'undefined') {
            new TWEEN.Tween(tweenData)
                .to({ progress: 1 }, duration)
                .easing(TWEEN.Easing.Quadratic.Out)
                .onUpdate(() => {
                    model.userData.pickAnimationProgress = tweenData.progress;

                    // Calcola posizione target (relativa alla camera)
                    const targetPosition = new THREE.Vector3();
                    targetPosition.copy(holdOffset);
                    targetPosition.applyQuaternion(this.camera.quaternion);
                    targetPosition.add(this.camera.position);

                    // Calcola rotazione target
                    const cameraQuat = this.camera.quaternion.clone();
                    const localQuat = new THREE.Quaternion();
                    localQuat.setFromEuler(holdRotation);
                    const targetQuat = new THREE.Quaternion();
                    targetQuat.multiplyQuaternions(cameraQuat, localQuat);

                    // Interpola posizione
                    model.position.lerpVectors(startPosition, targetPosition, tweenData.progress);

                    // Interpola rotazione (slerp per quaternioni)
                    model.quaternion.slerpQuaternions(startQuaternion, targetQuat, tweenData.progress);
                })
                .onComplete(() => {
                    model.userData.pickAnimationProgress = 1;
                    console.log(`[HoldableSystem] ✅ Animazione PICK completata per "${model.name}"`);
                    if (onComplete) onComplete();
                })
                .start();
        } else {
            // Fallback senza TWEEN - posizionamento immediato
            this.updateHeldObjectPosition(model);
            console.log(`[HoldableSystem] ⚠️ TWEEN non disponibile - posizionamento immediato`);
            if (onComplete) onComplete();
        }
    },

    /**
     * Aggiorna la posizione di un oggetto held per seguire la camera
     */
    updateHeldObjectPosition: function(model) {
        if (!model || !model.userData.isBeingHeld || !this.camera) return;

        const offset = model.userData.holdOffset;
        const localRotation = model.userData.holdRotation;

        // Calcola la posizione world: camera position + offset ruotato secondo la rotazione camera
        const worldPosition = new THREE.Vector3();
        worldPosition.copy(offset);
        worldPosition.applyQuaternion(this.camera.quaternion);
        worldPosition.add(this.camera.position);

        // Applica posizione
        model.position.copy(worldPosition);

        // Calcola rotazione usando QUATERNIONI (non Euler additivi)
        // 1. Quaternione della camera
        const cameraQuat = this.camera.quaternion.clone();

        // 2. Quaternione della rotazione locale desiderata
        const localQuat = new THREE.Quaternion();
        localQuat.setFromEuler(localRotation);

        // 3. Combinazione: prima applica rotazione camera, poi rotazione locale
        const finalQuat = new THREE.Quaternion();
        finalQuat.multiplyQuaternions(cameraQuat, localQuat);

        // Applica rotazione finale
        model.quaternion.copy(finalQuat);
    },

    /**
     * Anima il release di un oggetto con transizione smooth TWEEN
     */
    animateRelease: function(model, state, onComplete) {
        // Rimuovi flag di hold PRIMA dell'animazione (così update() non interferisce)
        model.userData.isBeingHeld = false;
        model.userData.holdOffset = null;
        model.userData.holdRotation = null;

        // Salva posizione/rotazione di partenza (corrente)
        const startPosition = model.position.clone();
        const startQuaternion = model.quaternion.clone();

        // Target: posizione/rotazione originale
        const targetPosition = state.originalPosition.clone();
        const targetQuaternion = new THREE.Quaternion();
        targetQuaternion.setFromEuler(state.originalRotation);

        console.log(`[HoldableSystem] 🎬 Animazione RELEASE avviata per "${model.name}"`);

        // Animazione con TWEEN
        const duration = this.config.releaseDuration;
        const tweenData = { progress: 0 };

        if (typeof TWEEN !== 'undefined') {
            new TWEEN.Tween(tweenData)
                .to({ progress: 1 }, duration)
                .easing(TWEEN.Easing.Quadratic.InOut)
                .onUpdate(() => {
                    // Interpola posizione
                    model.position.lerpVectors(startPosition, targetPosition, tweenData.progress);

                    // Interpola rotazione (slerp per quaternioni)
                    model.quaternion.slerpQuaternions(startQuaternion, targetQuaternion, tweenData.progress);
                })
                .onComplete(() => {
                    // Assicura posizione/rotazione finale esatte
                    model.position.copy(state.originalPosition);
                    model.rotation.copy(state.originalRotation);
                    model.scale.copy(state.originalScale);

                    console.log(`[HoldableSystem] ✅ Animazione RELEASE completata per "${model.name}"`);
                    if (onComplete) onComplete();
                })
                .start();
        } else {
            // Fallback senza TWEEN - posizionamento immediato
            model.position.copy(state.originalPosition);
            model.rotation.copy(state.originalRotation);
            model.scale.copy(state.originalScale);

            console.log(`[HoldableSystem] ⚠️ TWEEN non disponibile - rilascio immediato`);
            if (onComplete) onComplete();
        }
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

        // Aggiorna la posizione di tutti gli oggetti held per seguire la camera
        this.currentlyHeldList.forEach(objectName => {
            const model = window.Scene3D ? window.Scene3D.findModelByName(objectName) : null;
            if (model && model.userData.isBeingHeld) {
                // NON aggiornare durante l'animazione pick (TWEEN gestisce l'interpolazione)
                if (model.userData.pickAnimationProgress < 1) {
                    return; // Lascia che TWEEN gestisca
                }
                this.updateHeldObjectPosition(model);
            }
        });
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
