/**
 * ScreenSystem.js - Sistema Schermi Interattivi 3D
 *
 * Gestisce schermi touch simulati in ambiente 3D:
 * - Contenitori fisici (pulpito, telecomando) con schermi multipli
 * - Viste come modelli GLB separati (gestione visibilità)
 * - Hotspot interattivi con highlight
 * - Navigazione tra viste con hide/show automatico
 * - Esecuzione azioni su macchinari
 * - State machine per stati schermo
 *
 * Versione: 2.0.0
 * Data: Gennaio 2026
 *
 * ARCHITETTURA:
 * - [Screen:id] definisce un CONTENITORE (Container=) con vista default
 * - [ScreenView:screen.view] definisce un MODELLO GLB (Model=) per ogni stato schermo
 * - Solo la vista default è visibile all'avvio, le altre sono nascoste
 * - Navigazione: hide modello corrente → show modello target
 */

console.log('[ScreenSystem] Modulo caricato v2.0.0');

window.ScreenSystem = {
    // ═══════════════════════════════════════════════════════════════════
    // STATO SISTEMA
    // ═══════════════════════════════════════════════════════════════════

    enabled: false,
    initialized: false,

    // Stati possibili: 'idle', 'focused', 'interacting'
    currentState: 'idle',

    // Schermo attualmente in focus
    focusedScreen: null,

    // Vista corrente per ogni schermo
    currentViews: new Map(), // screenId -> viewId

    // ═══════════════════════════════════════════════════════════════════
    // REGISTRI DEFINIZIONI
    // ═══════════════════════════════════════════════════════════════════

    // Definizioni schermi [Screen:id] - CONTENITORI
    // screenId -> { container, defaultView, cameraDistance, cameraAngle, holdable, holdPosition, holdRotation }
    screens: new Map(),

    // Definizioni viste [ScreenView:screen.view] - MODELLI GLB SEPARATI
    // "screenId.viewId" -> { screenId, viewId, model, hotspots: [] }
    views: new Map(),

    // Definizioni hotspot [Hotspot:id]
    hotspots: new Map(), // hotspotId -> { position, size, label, highlightColor, onClick, nextView }

    // Definizioni azioni [ScreenAction:id]
    actions: new Map(), // actionId -> { target, targets, animation, drivenObjects, sound, resetPositions }

    // Flag per tracciare se la visibilità è stata inizializzata
    visibilityInitialized: false,

    // ═══════════════════════════════════════════════════════════════════
    // OGGETTI 3D RUNTIME
    // ═══════════════════════════════════════════════════════════════════

    // Mesh hotspot attivi nella scena
    activeHotspotMeshes: new Map(), // hotspotId -> THREE.Mesh

    // Gruppo contenitore hotspot per ogni schermo
    hotspotGroups: new Map(), // screenId -> THREE.Group

    // Materiali riutilizzabili
    materials: {
        hotspotDefault: null,
        hotspotHover: null,
        hotspotActive: null
    },

    // ═══════════════════════════════════════════════════════════════════
    // TRACKING TUTORIAL
    // ═══════════════════════════════════════════════════════════════════

    // Hotspot richiesti per completare step corrente
    requiredHotspot: null,
    requiredSequence: [],
    sequenceProgress: 0,

    // Callback per notifica completamento
    onStepComplete: null,

    // ═══════════════════════════════════════════════════════════════════
    // RIFERIMENTI SISTEMI ESTERNI
    // ═══════════════════════════════════════════════════════════════════

    scene: null,
    camera: null,
    renderer: null,
    raycaster: null,
    mouse: null,
    canvas: null,

    // Camera state salvato prima del focus
    savedCameraState: null,

    // ═══════════════════════════════════════════════════════════════════
    // CONFIGURAZIONE
    // ═══════════════════════════════════════════════════════════════════

    config: {
        defaultCameraDistance: 0.8,
        defaultHighlightColor: 'rgba(255,255,0,0.4)',
        hotspotDepthOffset: 0.002, // Offset Z per evitare z-fighting
        focusTransitionDuration: 800, // ms
        hoverScale: 1.1, // Scala hotspot su hover
        clickFeedbackDuration: 200 // ms
    },

    // ═══════════════════════════════════════════════════════════════════
    // INIZIALIZZAZIONE
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Inizializza il sistema schermi
     * @param {Object} scene3D - Riferimento a Scene3D
     * @returns {boolean} true se inizializzazione riuscita
     */
    init: function(scene3D) {
        console.log('[ScreenSystem] Inizializzazione sistema schermi...');

        if (typeof THREE === 'undefined') {
            console.error('[ScreenSystem] Errore: Three.js non disponibile');
            return false;
        }

        // Riferimenti ai sistemi Three.js
        this.scene = scene3D.scene;
        this.camera = scene3D.camera;
        this.renderer = scene3D.renderer;
        this.raycaster = scene3D.raycaster || new THREE.Raycaster();
        this.mouse = scene3D.mouse || new THREE.Vector2();
        this.canvas = scene3D.canvas;

        if (!this.scene || !this.camera || !this.canvas) {
            console.error('[ScreenSystem] Errore: riferimenti Three.js mancanti');
            return false;
        }

        // Inizializza materiali
        this.initMaterials();

        // Setup event listeners
        this.setupEventListeners();

        this.initialized = true;
        console.log('[ScreenSystem] ✅ Sistema inizializzato correttamente');
        return true;
    },

    /**
     * Inizializza materiali per hotspot
     */
    initMaterials: function() {
        // Materiale hotspot default (giallo trasparente)
        this.materials.hotspotDefault = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        // Materiale hotspot hover (più opaco)
        this.materials.hotspotHover = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        // Materiale hotspot attivo/click (verde)
        this.materials.hotspotActive = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        console.log('[ScreenSystem] Materiali hotspot inizializzati');
    },

    /**
     * Setup event listeners per interazione
     */
    setupEventListeners: function() {
        if (!this.canvas) return;

        // Click per selezione hotspot
        this.canvas.addEventListener('click', this.onCanvasClick.bind(this));

        // Mousemove per hover hotspot
        this.canvas.addEventListener('mousemove', this.onCanvasMouseMove.bind(this));

        // ESC per uscire da focus schermo
        document.addEventListener('keydown', this.onKeyDown.bind(this));

        console.log('[ScreenSystem] Event listeners configurati');
    },

    // ═══════════════════════════════════════════════════════════════════
    // GESTIONE VISIBILITÀ VISTE
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Inizializza la visibilità dei modelli vista
     * Chiamato DOPO che tutti i modelli sono stati caricati
     * Nasconde tutte le viste tranne quella di default per ogni schermo
     */
    initializeVisibility: function() {
        if (this.visibilityInitialized) {
            console.log('[ScreenSystem] ⚠️ Visibilità già inizializzata');
            return;
        }

        console.log('[ScreenSystem] 👁️ Inizializzazione visibilità viste...');

        let hiddenCount = 0;
        let visibleCount = 0;

        // Per ogni schermo registrato
        this.screens.forEach((screenConfig, screenId) => {
            const defaultViewId = screenConfig.defaultView;

            console.log(`[ScreenSystem] 📺 Schermo "${screenId}" - DefaultView: "${defaultViewId}"`);

            // Per ogni vista di questo schermo
            this.views.forEach((viewConfig, viewKey) => {
                // Verifica che la vista appartenga a questo schermo
                if (!viewKey.startsWith(screenId + '.')) return;

                const viewId = viewConfig.viewId;
                const modelPath = viewConfig.model;

                if (!modelPath) {
                    console.log(`     └─ Vista "${viewId}": nessun modello specificato`);
                    return;
                }

                // Trova il modello nella scena
                const model = window.Scene3D ? window.Scene3D.findModelByName(modelPath) : null;

                if (!model) {
                    console.warn(`[ScreenSystem] ⚠️ Modello "${modelPath}" non trovato per vista "${viewKey}"`);
                    return;
                }

                // Solo la vista default è visibile
                const shouldBeVisible = (viewId === defaultViewId);
                model.visible = shouldBeVisible;

                if (shouldBeVisible) {
                    visibleCount++;
                    console.log(`     └─ Vista "${viewId}" (${modelPath}): ✅ VISIBILE (default)`);
                } else {
                    hiddenCount++;
                    console.log(`     └─ Vista "${viewId}" (${modelPath}): 🔒 NASCOSTA`);
                }
            });
        });

        this.visibilityInitialized = true;
        console.log(`[ScreenSystem] ✅ Visibilità inizializzata: ${visibleCount} visibili, ${hiddenCount} nascoste`);
    },

    /**
     * Mostra un modello vista specifico
     * @param {string} modelPath - Percorso modello
     */
    showViewModel: function(modelPath) {
        if (!modelPath) return false;

        const model = window.Scene3D ? window.Scene3D.findModelByName(modelPath) : null;
        if (model) {
            model.visible = true;
            console.log(`[ScreenSystem] 👁️ Modello "${modelPath}" → VISIBILE`);
            return true;
        }
        return false;
    },

    /**
     * Nasconde un modello vista specifico
     * @param {string} modelPath - Percorso modello
     */
    hideViewModel: function(modelPath) {
        if (!modelPath) return false;

        const model = window.Scene3D ? window.Scene3D.findModelByName(modelPath) : null;
        if (model) {
            model.visible = false;
            console.log(`[ScreenSystem] 🔒 Modello "${modelPath}" → NASCOSTO`);
            return true;
        }
        return false;
    },

    // ═══════════════════════════════════════════════════════════════════
    // REGISTRAZIONE DEFINIZIONI
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Registra uno schermo (contenitore)
     * @param {string} screenId - ID univoco schermo
     * @param {Object} config - Configurazione schermo
     *
     * Sintassi:
     * [Screen:pulpito]
     * Container=models/pulpito.glb          # Contenitore fisico
     * DefaultView=home                      # Vista iniziale
     * CameraDistance=0.6
     * Holdable=true                         # Per telecomandi
     * HoldPosition=(-0.25,-0.15,0.4)
     */
    registerScreen: function(screenId, config) {
        const screenConfig = {
            container: config.Container || config.Model || null, // Container o Model per backward compatibility
            defaultView: config.DefaultView || 'default',
            cameraDistance: parseFloat(config.CameraDistance) || this.config.defaultCameraDistance,
            cameraAngle: config.CameraAngle || 'perpendicular',
            holdable: config.Holdable === 'true',
            holdPosition: this.parseVector3(config.HoldPosition),
            holdRotation: this.parseVector3(config.HoldRotation)
        };

        this.screens.set(screenId, screenConfig);
        this.currentViews.set(screenId, screenConfig.defaultView);

        // Se lo schermo è holdable, registra automaticamente in HoldableSystem
        if (screenConfig.holdable && window.HoldableSystem) {
            window.HoldableSystem.registerHoldable(screenConfig.container || screenId, {
                HoldPosition: config.HoldPosition,
                HoldRotation: config.HoldRotation,
                Model: config.Container || config.Model
            });
            console.log(`[ScreenSystem] 🤚 Schermo "${screenId}" registrato anche come holdable`);
        }

        console.log(`[ScreenSystem] 📺 Schermo (contenitore) registrato: "${screenId}"`, screenConfig);
    },

    /**
     * Registra una vista/schermata (modello GLB separato)
     * @param {string} screenId - ID schermo
     * @param {string} viewId - ID vista
     * @param {Object} config - Configurazione vista con Model e Hotspots
     *
     * Sintassi:
     * [ScreenView:pulpito.home]
     * Model=models/pulpito_screen_home.glb   # Modello GLB per questa vista
     * Hotspots=btn_menu,btn_settings
     */
    registerView: function(screenId, viewId, config) {
        const viewKey = `${screenId}.${viewId}`;

        // Supporta sia vecchia sintassi (hotspotIds stringa) che nuova (config object)
        let hotspotIds, modelPath;

        if (typeof config === 'string') {
            // Backward compatibility: config è stringa hotspotIds
            hotspotIds = config;
            modelPath = null;
        } else if (typeof config === 'object') {
            // Nuova sintassi: config è oggetto con Model e Hotspots
            hotspotIds = config.Hotspots || '';
            modelPath = config.Model || null;
        } else {
            hotspotIds = '';
            modelPath = null;
        }

        const viewConfig = {
            screenId: screenId,
            viewId: viewId,
            model: modelPath, // Modello GLB per questa vista
            hotspots: typeof hotspotIds === 'string'
                ? hotspotIds.split(',').map(h => h.trim()).filter(h => h)
                : (Array.isArray(hotspotIds) ? hotspotIds : [])
        };

        this.views.set(viewKey, viewConfig);
        console.log(`[ScreenSystem] 📄 Vista registrata: "${viewKey}"`);
        console.log(`     └─ Model: ${viewConfig.model || '(nessuno)'}`);
        console.log(`     └─ Hotspots: ${viewConfig.hotspots.length > 0 ? viewConfig.hotspots.join(', ') : '(nessuno)'}`);
    },

    /**
     * Registra un hotspot
     * @param {string} hotspotId - ID univoco hotspot
     * @param {Object} config - Configurazione hotspot
     */
    registerHotspot: function(hotspotId, config) {
        const hotspotConfig = {
            id: hotspotId,
            position: this.parseVector3(config.Position) || new THREE.Vector3(0, 0, 0.002),
            size: this.parseVector2(config.Size) || new THREE.Vector2(0.05, 0.03),
            label: config.Label || '',
            highlightColor: this.parseColor(config.HighlightColor) || this.config.defaultHighlightColor,
            onClick: config.OnClick || null, // Formato: "Action:actionId"
            nextView: config.NextView || null // Formato: "screenId.viewId"
        };

        this.hotspots.set(hotspotId, hotspotConfig);
        console.log(`[ScreenSystem] 🔘 Hotspot registrato: "${hotspotId}"`, hotspotConfig);
    },

    /**
     * Registra un'azione
     * @param {string} actionId - ID univoco azione
     * @param {Object} config - Configurazione azione
     */
    registerAction: function(actionId, config) {
        const actionConfig = {
            id: actionId,
            target: config.Target || null,
            targets: config.Targets ? config.Targets.split(',').map(t => t.trim()) : [],
            animation: config.Animation || null,
            drivenObjects: config.DrivenObjects || null,
            sound: config.Sound || null,
            resetPositions: config.ResetPositions === 'true'
        };

        // Se c'è target singolo, aggiungilo a targets
        if (actionConfig.target && !actionConfig.targets.includes(actionConfig.target)) {
            actionConfig.targets.push(actionConfig.target);
        }

        this.actions.set(actionId, actionConfig);
        console.log(`[ScreenSystem] ⚡ Azione registrata: "${actionId}"`, actionConfig);
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
     * Parse stringa "(w,h)" in Vector2
     */
    parseVector2: function(str) {
        if (!str) return null;
        const match = str.match(/\(([^,]+),([^)]+)\)/);
        if (match) {
            return new THREE.Vector2(
                parseFloat(match[1]),
                parseFloat(match[2])
            );
        }
        return null;
    },

    /**
     * Parse colore RGBA o hex
     */
    parseColor: function(str) {
        if (!str) return null;
        // Formato rgba(r,g,b,a)
        const rgbaMatch = str.match(/rgba?\((\d+),(\d+),(\d+),?([\d.]+)?\)/);
        if (rgbaMatch) {
            return {
                r: parseInt(rgbaMatch[1]) / 255,
                g: parseInt(rgbaMatch[2]) / 255,
                b: parseInt(rgbaMatch[3]) / 255,
                a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1
            };
        }
        // Formato hex
        if (str.startsWith('#')) {
            const color = new THREE.Color(str);
            return { r: color.r, g: color.g, b: color.b, a: 1 };
        }
        return null;
    },

    // ═══════════════════════════════════════════════════════════════════
    // STATE MACHINE SCHERMI
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Entra in modalità focus su uno schermo
     * @param {string} screenId - ID schermo
     * @param {string} viewId - Vista iniziale (opzionale)
     */
    focusScreen: function(screenId, viewId) {
        const screen = this.screens.get(screenId);
        if (!screen) {
            console.error(`[ScreenSystem] Schermo "${screenId}" non trovato`);
            return false;
        }

        console.log(`[ScreenSystem] 🎯 Focus su schermo: "${screenId}"`);

        // Salva stato camera corrente
        this.savedCameraState = {
            position: this.camera.position.clone(),
            target: Scene3D.mouseControls.pivotPoint.clone()
        };

        // Determina la vista target
        const targetView = viewId || screen.defaultView;
        const targetViewKey = `${screenId}.${targetView}`;
        const targetViewConfig = this.views.get(targetViewKey);

        // Trova modello da usare per allineamento camera:
        // 1. Modello della vista target (se specificato)
        // 2. Oppure il container
        let targetModel = null;

        if (targetViewConfig && targetViewConfig.model) {
            targetModel = window.Scene3D.findModelByName(targetViewConfig.model);
            console.log(`[ScreenSystem] 📐 Allineamento camera su modello vista: "${targetViewConfig.model}"`);
        }

        if (!targetModel && screen.container) {
            targetModel = window.Scene3D.findModelByName(screen.container);
            console.log(`[ScreenSystem] 📐 Allineamento camera su container: "${screen.container}"`);
        }

        if (!targetModel) {
            console.error(`[ScreenSystem] Nessun modello trovato per schermo "${screenId}"`);
            return false;
        }

        // Calcola posizione camera perpendicolare allo schermo/vista
        this.alignCameraToScreen(targetModel, screen.cameraDistance, screen.cameraAngle);

        // Imposta vista (gestisce anche la visibilità dei modelli)
        this.setView(screenId, targetView);

        // Aggiorna stato
        this.focusedScreen = screenId;
        this.currentState = 'focused';
        this.enabled = true;

        // Disabilita controlli camera normali
        if (window.Scene3D) {
            Scene3D.mouseControls.isMouseDown = false;
        }

        console.log(`[ScreenSystem] ✅ Schermo "${screenId}" in focus, vista: "${targetView}"`);
        return true;
    },

    /**
     * Esci da modalità focus
     */
    unfocusScreen: function() {
        if (!this.focusedScreen) return;

        console.log(`[ScreenSystem] 🔙 Uscita da focus schermo: "${this.focusedScreen}"`);

        // Rimuovi hotspot dalla scena
        this.removeActiveHotspots();

        // Ripristina camera
        if (this.savedCameraState) {
            this.animateCameraTo(
                this.savedCameraState.position,
                this.savedCameraState.target,
                this.config.focusTransitionDuration
            );
        }

        // Reset stato
        this.focusedScreen = null;
        this.currentState = 'idle';
        this.enabled = false;
        this.requiredHotspot = null;
        this.requiredSequence = [];
        this.sequenceProgress = 0;

        console.log('[ScreenSystem] ✅ Focus schermo rilasciato');
    },

    /**
     * Cambia vista su uno schermo
     * @param {string} screenId - ID schermo
     * @param {string} viewId - ID nuova vista
     */
    setView: function(screenId, viewId) {
        const viewKey = `${screenId}.${viewId}`;
        const view = this.views.get(viewKey);

        if (!view) {
            console.warn(`[ScreenSystem] Vista "${viewKey}" non trovata`);
            return false;
        }

        console.log(`[ScreenSystem] 📄 Cambio vista: "${viewKey}"`);

        // ═══════════════════════════════════════════════════════════════
        // GESTIONE VISIBILITÀ MODELLI
        // ═══════════════════════════════════════════════════════════════

        // 1. Nascondi il modello della vista corrente (se diversa)
        const currentViewId = this.currentViews.get(screenId);
        if (currentViewId && currentViewId !== viewId) {
            const currentViewKey = `${screenId}.${currentViewId}`;
            const currentView = this.views.get(currentViewKey);

            if (currentView && currentView.model) {
                this.hideViewModel(currentView.model);
            }
        }

        // 2. Mostra il modello della nuova vista
        if (view.model) {
            this.showViewModel(view.model);
        }

        // ═══════════════════════════════════════════════════════════════
        // GESTIONE HOTSPOT
        // ═══════════════════════════════════════════════════════════════

        // Rimuovi hotspot precedenti
        this.removeActiveHotspots();

        // Crea nuovi hotspot per questa vista
        this.createHotspotsForView(screenId, view);

        // Aggiorna registro vista corrente
        this.currentViews.set(screenId, viewId);

        // Aggiorna stato a interacting
        if (this.currentState === 'focused') {
            this.currentState = 'interacting';
        }

        console.log(`[ScreenSystem] ✅ Vista "${viewId}" attiva con ${view.hotspots.length} hotspot`);
        return true;
    },

    /**
     * Ottiene vista corrente di uno schermo
     */
    getCurrentView: function(screenId) {
        return this.currentViews.get(screenId) || null;
    },

    // ═══════════════════════════════════════════════════════════════════
    // CAMERA MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Allinea camera perpendicolare allo schermo
     */
    alignCameraToScreen: function(screenModel, distance, angleMode) {
        // Calcola centro e normale dello schermo
        const boundingBox = new THREE.Box3().setFromObject(screenModel);
        const center = boundingBox.getCenter(new THREE.Vector3());

        // Ottieni normale dello schermo (assumiamo +Z locale)
        const normal = new THREE.Vector3(0, 0, 1);
        screenModel.updateMatrixWorld(true);
        normal.applyQuaternion(screenModel.quaternion);

        // Posizione camera = centro + normale * distanza
        const cameraPosition = center.clone().add(normal.clone().multiplyScalar(distance));

        // Anima camera verso nuova posizione
        this.animateCameraTo(cameraPosition, center, this.config.focusTransitionDuration);
    },

    /**
     * Anima camera verso posizione target
     */
    animateCameraTo: function(targetPosition, targetLookAt, duration) {
        const startPosition = this.camera.position.clone();
        const startLookAt = Scene3D.mouseControls.pivotPoint.clone();

        const startTime = performance.now();

        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing ease-out-cubic
            const eased = 1 - Math.pow(1 - progress, 3);

            // Interpola posizione
            this.camera.position.lerpVectors(startPosition, targetPosition, eased);

            // Interpola lookAt
            const currentLookAt = new THREE.Vector3().lerpVectors(startLookAt, targetLookAt, eased);
            this.camera.lookAt(currentLookAt);

            // Aggiorna pivot point di Scene3D
            Scene3D.mouseControls.pivotPoint.copy(currentLookAt);

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    },

    // ═══════════════════════════════════════════════════════════════════
    // HOTSPOT RENDERING
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Crea mesh hotspot per una vista
     */
    createHotspotsForView: function(screenId, view) {
        const screen = this.screens.get(screenId);
        if (!screen) return;

        // Trova il modello della VISTA (non del container)
        // Gli hotspot devono essere attaccati al modello della vista specifica
        let parentModel = null;

        if (view.model) {
            parentModel = window.Scene3D.findModelByName(view.model);
            console.log(`[ScreenSystem] 📌 Hotspot attaccati a modello vista: "${view.model}"`);
        }

        // Fallback al container se la vista non ha un modello proprio
        if (!parentModel && screen.container) {
            parentModel = window.Scene3D.findModelByName(screen.container);
            console.log(`[ScreenSystem] 📌 Hotspot attaccati a container: "${screen.container}"`);
        }

        if (!parentModel) {
            console.warn(`[ScreenSystem] ⚠️ Nessun modello trovato per attaccare hotspot`);
            return;
        }

        // Crea gruppo per contenere hotspot
        // Nota: se il gruppo esiste già ma è attaccato a un altro modello (vista precedente),
        // rimuovilo e ricrealo per il nuovo modello
        let group = this.hotspotGroups.get(screenId);
        if (group && group.parent !== parentModel) {
            // Rimuovi dal genitore precedente
            if (group.parent) {
                group.parent.remove(group);
            }
            group = null;
        }

        if (!group) {
            group = new THREE.Group();
            group.name = `hotspots_${screenId}`;
            parentModel.add(group);
            this.hotspotGroups.set(screenId, group);
        }

        // Crea mesh per ogni hotspot della vista
        view.hotspots.forEach(hotspotId => {
            const hotspot = this.hotspots.get(hotspotId);
            if (!hotspot) {
                console.warn(`[ScreenSystem] Hotspot "${hotspotId}" non trovato`);
                return;
            }

            // Crea geometria plane
            const geometry = new THREE.PlaneGeometry(hotspot.size.x, hotspot.size.y);

            // Crea materiale con colore personalizzato
            const material = this.createHotspotMaterial(hotspot.highlightColor);

            // Crea mesh
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(hotspot.position);
            mesh.name = `hotspot_${hotspotId}`;
            mesh.userData.hotspotId = hotspotId;
            mesh.userData.isHotspot = true;

            // Aggiungi al gruppo
            group.add(mesh);
            this.activeHotspotMeshes.set(hotspotId, mesh);

            console.log(`[ScreenSystem] 🔘 Hotspot "${hotspotId}" creato in posizione`, hotspot.position);
        });
    },

    /**
     * Crea materiale per hotspot con colore personalizzato
     */
    createHotspotMaterial: function(colorConfig) {
        if (!colorConfig) {
            return this.materials.hotspotDefault.clone();
        }

        return new THREE.MeshBasicMaterial({
            color: new THREE.Color(colorConfig.r, colorConfig.g, colorConfig.b),
            transparent: true,
            opacity: colorConfig.a || 0.4,
            side: THREE.DoubleSide,
            depthWrite: false
        });
    },

    /**
     * Rimuovi tutti gli hotspot attivi dalla scena
     */
    removeActiveHotspots: function() {
        this.activeHotspotMeshes.forEach((mesh, hotspotId) => {
            if (mesh.parent) {
                mesh.parent.remove(mesh);
            }
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
        });

        this.activeHotspotMeshes.clear();
        console.log('[ScreenSystem] 🗑️ Hotspot attivi rimossi');
    },

    /**
     * Evidenzia/de-evidenzia un hotspot
     */
    highlightHotspot: function(hotspotId, show) {
        const mesh = this.activeHotspotMeshes.get(hotspotId);
        if (!mesh) return;

        if (show) {
            mesh.material = this.materials.hotspotHover.clone();
            mesh.scale.setScalar(this.config.hoverScale);
        } else {
            const hotspot = this.hotspots.get(hotspotId);
            mesh.material = this.createHotspotMaterial(hotspot?.highlightColor);
            mesh.scale.setScalar(1);
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    // EVENT HANDLERS
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Handler click su canvas
     */
    onCanvasClick: function(event) {
        if (!this.enabled || this.currentState === 'idle') return;

        // Calcola coordinate mouse normalizzate
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Raycast verso hotspot
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const hotspotMeshes = Array.from(this.activeHotspotMeshes.values());
        const intersects = this.raycaster.intersectObjects(hotspotMeshes, true);

        if (intersects.length > 0) {
            const hitMesh = intersects[0].object;
            const hotspotId = hitMesh.userData.hotspotId;

            if (hotspotId) {
                this.handleHotspotClick(hotspotId);
            }
        }
    },

    /**
     * Handler mousemove per hover
     */
    onCanvasMouseMove: function(event) {
        if (!this.enabled || this.currentState === 'idle') return;

        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        const hotspotMeshes = Array.from(this.activeHotspotMeshes.values());
        const intersects = this.raycaster.intersectObjects(hotspotMeshes, true);

        // Reset tutti gli hotspot
        this.activeHotspotMeshes.forEach((mesh, id) => {
            if (!mesh.userData.isHovered) return;
            mesh.userData.isHovered = false;
            this.highlightHotspot(id, false);
        });

        // Highlight hotspot sotto il mouse
        if (intersects.length > 0) {
            const hotspotId = intersects[0].object.userData.hotspotId;
            if (hotspotId) {
                const mesh = this.activeHotspotMeshes.get(hotspotId);
                if (mesh) {
                    mesh.userData.isHovered = true;
                    this.highlightHotspot(hotspotId, true);
                    this.canvas.style.cursor = 'pointer';
                }
            }
        } else {
            this.canvas.style.cursor = 'default';
        }
    },

    /**
     * Handler tastiera
     */
    onKeyDown: function(event) {
        if (event.key === 'Escape' && this.focusedScreen) {
            this.unfocusScreen();
        }
    },

    /**
     * Gestisci click su hotspot
     */
    handleHotspotClick: function(hotspotId) {
        const hotspot = this.hotspots.get(hotspotId);
        if (!hotspot) return;

        console.log(`[ScreenSystem] 👆 Click su hotspot: "${hotspotId}"`);

        // Feedback visivo click
        const mesh = this.activeHotspotMeshes.get(hotspotId);
        if (mesh) {
            const originalMaterial = mesh.material;
            mesh.material = this.materials.hotspotActive;
            setTimeout(() => {
                mesh.material = originalMaterial;
            }, this.config.clickFeedbackDuration);
        }

        // ═══════════════════════════════════════════════════════════════
        // STEP CONTROLLER: Notifica click hotspot (sorgente: screen)
        // ═══════════════════════════════════════════════════════════════
        let handledByStepController = false;
        if (window.StepController) {
            // Costruisce triggerId nel formato "screenId.hotspotId"
            const triggerId = this.focusedScreen ? `${this.focusedScreen}.${hotspotId}` : hotspotId;
            handledByStepController = window.StepController.triggerStep('screen', triggerId);
        }

        // Esegui azione hotspot se configurata (sempre, indipendente da StepController)
        if (hotspot.onClick) {
            const actionMatch = hotspot.onClick.match(/^Action:(.+)$/);
            if (actionMatch) {
                this.executeAction(actionMatch[1]);
            }
        }

        // Cambia vista se configurata (sempre, indipendente da StepController)
        if (hotspot.nextView) {
            const [screenId, viewId] = hotspot.nextView.split('.');
            if (screenId && viewId) {
                this.setView(screenId, viewId);
            }
        }

        // Verifica completamento step tutorial (solo se StepController non ha gestito)
        if (!handledByStepController) {
            this.checkStepCompletion(hotspotId);
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    // ESECUZIONE AZIONI
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Esegue un'azione registrata
     * @param {string} actionId - ID azione da eseguire
     */
    executeAction: function(actionId) {
        const action = this.actions.get(actionId);
        if (!action) {
            console.warn(`[ScreenSystem] Azione "${actionId}" non trovata`);
            return false;
        }

        console.log(`[ScreenSystem] ⚡ Esecuzione azione: "${actionId}"`);

        // Reset posizioni se richiesto
        if (action.resetPositions && window.Scene3D) {
            action.targets.forEach(targetName => {
                Scene3D.resetModelToInitialPosition(targetName);
            });
            return true;
        }

        // Esegui animazione su ogni target
        action.targets.forEach(targetName => {
            const model = window.Scene3D.findModelByName(targetName);
            if (!model) {
                console.warn(`[ScreenSystem] Modello target "${targetName}" non trovato`);
                return;
            }

            // Parse e esegui animazione
            if (action.animation) {
                this.executeAnimation(model, action.animation, action.drivenObjects);
            }
        });

        // Riproduci suono se configurato
        if (action.sound) {
            this.playSound(action.sound);
        }

        return true;
    },

    /**
     * Esegue animazione su modello
     */
    executeAnimation: function(model, animationStr, drivenObjectsStr) {
        if (!window.Scene3D || !window.Scene3D.animationSystem) {
            console.warn('[ScreenSystem] AnimationSystem non disponibile');
            return;
        }

        // Parse tipo animazione
        const rotationMatch = animationStr.match(/rotazione:\(([^,]+),([^,]+),([^,]+),([^)]+)\)/);
        const translationMatch = animationStr.match(/traslazione:\(([^,]+),([^,]+),([^,]+),([^)]+)\)/);

        if (rotationMatch) {
            const rotation = {
                x: parseFloat(rotationMatch[1]) * Math.PI / 180,
                y: parseFloat(rotationMatch[2]) * Math.PI / 180,
                z: parseFloat(rotationMatch[3]) * Math.PI / 180
            };
            const duration = parseFloat(rotationMatch[4]);

            Scene3D.animateModelRotation(model, rotation, duration);
        }

        if (translationMatch) {
            const translation = new THREE.Vector3(
                parseFloat(translationMatch[1]),
                parseFloat(translationMatch[2]),
                parseFloat(translationMatch[3])
            );
            const duration = parseFloat(translationMatch[4]);

            Scene3D.animateModelTranslation(model, translation, duration);
        }

        // Gestisci stop_all
        if (animationStr === 'stop_all' || animationStr === 'stop') {
            Scene3D.stopAllAnimations();
        }
    },

    /**
     * Riproduce file audio
     */
    playSound: function(soundPath) {
        try {
            const audio = new Audio(soundPath);
            audio.volume = 0.5;
            audio.play().catch(e => {
                console.warn(`[ScreenSystem] Errore riproduzione audio: ${e.message}`);
            });
        } catch (e) {
            console.warn(`[ScreenSystem] Errore caricamento audio "${soundPath}": ${e.message}`);
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    // TUTORIAL INTEGRATION
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Configura step tutorial con requisiti hotspot
     */
    configureStepRequirements: function(requiredHotspot, requiredSequence) {
        this.requiredHotspot = requiredHotspot || null;
        this.requiredSequence = requiredSequence ? requiredSequence.split(',').map(h => h.trim()) : [];
        this.sequenceProgress = 0;

        console.log(`[ScreenSystem] 📋 Requisiti step configurati:`,
            this.requiredHotspot ? `hotspot="${this.requiredHotspot}"` : '',
            this.requiredSequence.length ? `sequenza=[${this.requiredSequence.join(',')}]` : ''
        );
    },

    /**
     * Verifica se step completato
     */
    checkStepCompletion: function(clickedHotspotId) {
        // Verifica singolo hotspot richiesto
        if (this.requiredHotspot && clickedHotspotId === this.requiredHotspot) {
            console.log(`[ScreenSystem] ✅ Hotspot richiesto "${this.requiredHotspot}" premuto`);
            this.notifyStepComplete();
            return true;
        }

        // Verifica sequenza
        if (this.requiredSequence.length > 0) {
            const expectedHotspot = this.requiredSequence[this.sequenceProgress];

            if (clickedHotspotId === expectedHotspot) {
                this.sequenceProgress++;
                console.log(`[ScreenSystem] 📊 Sequenza progress: ${this.sequenceProgress}/${this.requiredSequence.length}`);

                if (this.sequenceProgress >= this.requiredSequence.length) {
                    console.log(`[ScreenSystem] ✅ Sequenza completata!`);
                    this.notifyStepComplete();
                    return true;
                }
            } else {
                // Reset sequenza su errore
                console.log(`[ScreenSystem] ❌ Sequenza errata, reset. Atteso: "${expectedHotspot}", premuto: "${clickedHotspotId}"`);
                this.sequenceProgress = 0;
            }
        }

        return false;
    },

    /**
     * Notifica completamento step al sistema tutorial
     */
    notifyStepComplete: function() {
        if (this.onStepComplete && typeof this.onStepComplete === 'function') {
            this.onStepComplete();
        }

        // Notifica a UI se disponibile
        if (window.UI && typeof window.UI.goToNextStep === 'function') {
            setTimeout(() => {
                window.UI.goToNextStep();
            }, 500);
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    // CLEANUP E RESET
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Reset completo sistema
     */
    reset: function() {
        console.log('[ScreenSystem] 🔄 Reset sistema...');

        this.unfocusScreen();
        this.removeActiveHotspots();

        // Rimuovi gruppi hotspot
        this.hotspotGroups.forEach((group, screenId) => {
            if (group.parent) {
                group.parent.remove(group);
            }
        });
        this.hotspotGroups.clear();

        // Reset stato
        this.currentState = 'idle';
        this.focusedScreen = null;
        this.enabled = false;
        this.requiredHotspot = null;
        this.requiredSequence = [];
        this.sequenceProgress = 0;

        console.log('[ScreenSystem] ✅ Reset completato');
    },

    /**
     * Pulisci tutte le definizioni
     */
    clearDefinitions: function() {
        this.screens.clear();
        this.views.clear();
        this.hotspots.clear();
        this.actions.clear();
        this.currentViews.clear();

        // Reset flag visibilità per permettere re-inizializzazione
        this.visibilityInitialized = false;

        console.log('[ScreenSystem] 🗑️ Definizioni cancellate');
    },

    // ═══════════════════════════════════════════════════════════════════
    // DEBUG API
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Lista tutti gli schermi registrati
     */
    listScreens: function() {
        console.log('═══════════════════════════════════════════════════════════');
        console.log('📺 SCHERMI REGISTRATI:');
        console.log('═══════════════════════════════════════════════════════════');

        if (this.screens.size === 0) {
            console.log('   (nessuno schermo registrato)');
            return [];
        }

        const result = [];
        this.screens.forEach((config, id) => {
            console.log(`   ${id}:`);
            console.log(`     └─ Container: ${config.container || '(nessuno)'}`);
            console.log(`     └─ DefaultView: ${config.defaultView}`);
            console.log(`     └─ CameraDistance: ${config.cameraDistance}`);
            console.log(`     └─ Holdable: ${config.holdable}`);

            // Mostra anche le viste registrate per questo schermo
            const screenViews = [];
            this.views.forEach((viewConfig, viewKey) => {
                if (viewKey.startsWith(id + '.')) {
                    screenViews.push({
                        viewId: viewConfig.viewId,
                        model: viewConfig.model,
                        hotspots: viewConfig.hotspots.length
                    });
                }
            });
            if (screenViews.length > 0) {
                console.log(`     └─ Viste (${screenViews.length}):`);
                screenViews.forEach(v => {
                    console.log(`        └─ ${v.viewId}: Model="${v.model || '(nessuno)'}", Hotspots=${v.hotspots}`);
                });
            }

            result.push({ id, ...config, views: screenViews });
        });

        return result;
    },

    /**
     * Lista hotspot per uno schermo/vista
     */
    listHotspots: function(screenId) {
        const currentView = this.currentViews.get(screenId);
        const viewKey = `${screenId}.${currentView}`;
        const view = this.views.get(viewKey);

        console.log('═══════════════════════════════════════════════════════════');
        console.log(`🔘 HOTSPOT per "${viewKey}":`);
        console.log('═══════════════════════════════════════════════════════════');

        if (!view) {
            console.log('   (vista non trovata)');
            return [];
        }

        const result = [];
        view.hotspots.forEach(hotspotId => {
            const hotspot = this.hotspots.get(hotspotId);
            if (hotspot) {
                console.log(`   ${hotspotId}:`);
                console.log(`     └─ Label: "${hotspot.label}"`);
                console.log(`     └─ Position: (${hotspot.position.x}, ${hotspot.position.y}, ${hotspot.position.z})`);
                console.log(`     └─ OnClick: ${hotspot.onClick || '(nessuna)'}`);
                console.log(`     └─ NextView: ${hotspot.nextView || '(nessuna)'}`);
                result.push({ id: hotspotId, ...hotspot });
            }
        });

        return result;
    },

    /**
     * Ottieni stato corrente sistema
     */
    getScreenState: function(screenId) {
        const screen = this.screens.get(screenId);
        const currentView = this.currentViews.get(screenId);

        return {
            exists: !!screen,
            config: screen || null,
            currentView: currentView || null,
            isFocused: this.focusedScreen === screenId,
            systemState: this.currentState,
            activeHotspots: Array.from(this.activeHotspotMeshes.keys())
        };
    },

    /**
     * Debug completo stato sistema
     */
    debugInfo: function() {
        console.log('═══════════════════════════════════════════════════════════');
        console.log('🔍 SCREEN SYSTEM DEBUG INFO');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`Initialized: ${this.initialized}`);
        console.log(`Enabled: ${this.enabled}`);
        console.log(`Current State: ${this.currentState}`);
        console.log(`Focused Screen: ${this.focusedScreen || '(nessuno)'}`);
        console.log(`Screens Registered: ${this.screens.size}`);
        console.log(`Views Registered: ${this.views.size}`);
        console.log(`Hotspots Registered: ${this.hotspots.size}`);
        console.log(`Actions Registered: ${this.actions.size}`);
        console.log(`Active Hotspot Meshes: ${this.activeHotspotMeshes.size}`);
        console.log(`Required Hotspot: ${this.requiredHotspot || '(nessuno)'}`);
        console.log(`Required Sequence: [${this.requiredSequence.join(', ')}]`);
        console.log(`Sequence Progress: ${this.sequenceProgress}/${this.requiredSequence.length}`);
        console.log('═══════════════════════════════════════════════════════════');

        return {
            initialized: this.initialized,
            enabled: this.enabled,
            currentState: this.currentState,
            focusedScreen: this.focusedScreen,
            screensCount: this.screens.size,
            viewsCount: this.views.size,
            hotspotsCount: this.hotspots.size,
            actionsCount: this.actions.size
        };
    }
};

// Esporta per debug console
window.ScreenSystem = window.ScreenSystem;

console.log('[ScreenSystem] ✅ Modulo ScreenSystem pronto');
