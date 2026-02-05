/**
 * DragDropSystem.js - Sistema Drag & Drop 3D con Snap per Three.js Tutorial
 * 
 * Responsabilità:
 * - Gestione drag & drop oggetti 3D con raycasting
 * - Sistema snap automatico con feedback visivo
 * - Controllo abilitazione/disabilitazione dinamica
 * - Integrazione non-intrusiva con sistema click esistente
 * - Memorizzazione automatica posizioni originali
 * 
 * Versione: 1.2.1 DEBUGGING RELEASE
 * Data: Dicembre 2025 - Risoluzione problemi snap
 */

console.log('🔥🔥🔥 [DragDropSystem] Versione 1.3.9 REFACTORING caricata - 2026-01-31 🔥🔥🔥');

// FASE 5 REFACTORING: Helper per chiamate sicure a dipendenze esterne
const _dds_safeCall = function(obj, method, args = [], fallback = null, context = 'DragDropSystem') {
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

// Helper specifico per UI
const _dds_safeUICall = function(method, args = [], fallback = null) {
    return _dds_safeCall(window.UI, method, args, fallback, 'DragDropSystem→UI');
};

// Helper specifico per Scene3D
const _dds_safeScene3DCall = function(method, args = [], fallback = null) {
    return _dds_safeCall(window.Scene3D, method, args, fallback, 'DragDropSystem→Scene3D');
};

window.DragDropSystem = {
    // Stato sistema
    enabled: false,
    isDragging: false,
    isStepSyncing: false, // Flag per bypassare AssemblySystem durante sincronizzazione
    debugMode: false, // Flag per bypass temporaneo durante debug
    showSnapIndicators: false, // Flag per mostrare/nascondere sfere verdi snap
    isTouchDrag: false, // Flag per drag originato da touch (skip cursor changes)

    // Oggetti e configurazioni
    draggableObjects: [],
    originalPositions: new Map(),
    originalRotations: new Map(),
    originalMaterialsMap: new Map(), // UUID oggetto -> Map(UUID mesh -> materiale originale) per multipli highlight
    whitelistedObjects: new Set(),
    blacklistedObjects: new Set(['corpo', 'pavimento', 'planaxis']), // Oggetti mai draggabili

    // Tracking snap completati per auto-avanzamento step
    requiredSnapObjects: new Set(), // Oggetti che devono fare snap per completare lo step
    completedSnapObjects: new Set(), // Oggetti che hanno già fatto snap con successo
    autoAdvanceEnabled: false, // Se true, avanza automaticamente quando tutti gli snap sono completati

    // Sistema esclusione posizioni snap occupate
    occupiedSnapPositions: new Map(), // chiave posizione -> nome oggetto che la occupa
    objectSnapPosition: new Map(), // uuid oggetto -> chiave posizione occupata
    snapPositionKeys: new WeakMap(), // Vector3 -> chiave posizione snap (evita interferenze con Vector3)

    // Sistema snap personalizzati con riferimenti _original
    customSnapTargets: new Map(), // objectUuid -> { targetName: string, isOriginalRef: bool, offset: Vector3 }
    snapIndicators: new Map(), // Indicatori visivi snap (sfere verdi)

    // Drag state
    draggedObject: null,
    dragOffset: null, // Inizializzato in init()
    dragPlane: null,
    dragStartPosition: null, // Inizializzato in init()
    
    // Riferimenti ai sistemi modulari
    interchangeableTracker: null,
    snapSystem: null,
    
    // Visual feedback
    snapZoneMaterial: null,
    snapIndicatorMaterial: null,
    highlightMaterial: null,

    // Tutorial Manager timing fix
    tutorialAdvanceRetries: 3,
    tutorialAdvanceRetryDelay: 150,
    advanceRetryTimeoutId: null, // FIX: Tracking timeout retry per cancellazione
    
    // Riferimenti ai sistemi esistenti
    scene: null,
    camera: null,
    renderer: null,
    raycaster: null,
    mouse: null,
    canvas: null,

    // Stato controlli camera (per ripristino dopo drag)
    cameraControlsWereEnabled: undefined,

    // Cache per piano dinamico (performance)
    lastPlanePoint: null,

    // Controlli mouse personalizzati per drag
    mouseState: {
        isDown: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        hasMoved: false
    },

    // Controllo silhouette durante drag
    silhouetteBlocked: new Set(), // Set di nomi modelli per cui bloccare silhouette automatica
    
    /**
     * Inizializza il sistema drag & drop
     */
    init: function(scene3D) {
        console.log('[DragDropSystem] Inizializzazione sistema drag & drop...');
        
        // Verifica che THREE sia disponibile
        if (typeof THREE === 'undefined') {
            console.error('[DragDropSystem] Errore: Three.js non disponibile');
            return false;
        }
        
        // Inizializza oggetti Three.js
        this.dragOffset = new THREE.Vector3();
        this.dragStartPosition = new THREE.Vector3();
        
        // Riferimenti ai sistemi Three.js esistenti
        this.scene = scene3D.scene;
        this.camera = scene3D.camera;
        this.renderer = scene3D.renderer;
        this.raycaster = scene3D.raycaster;
        this.mouse = scene3D.mouse;
        this.canvas = scene3D.canvas;
        
        if (!this.scene || !this.camera || !this.raycaster || !this.canvas) {
            console.error('[DragDropSystem] Errore: riferimenti Three.js mancanti');
            return false;
        }
        
        // Inizializza materiali per feedback visivo
        this.initMaterials();
        
        // Inizializza piano di drag (orizzontale al livello Y=0)
        this.initDragPlane();
        
        // Setup event listeners (inizialmente disabilitati)
        this.setupEventListeners();

        // Inizializza sistema di tracking intercambiabili
        this.initInterchangeableTracker();

        // Inizializza sistema di snap
        this.initSnapSystem();

        console.log('[DragDropSystem] Sistema inizializzato correttamente');
        return true;
    },
    
    /**
     * Inizializza i materiali per il feedback visivo
     */
    initMaterials: function() {
        // Materiale per zone di snap (anelli intorno agli oggetti)
        this.snapZoneMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.3,
            wireframe: true,
            side: THREE.DoubleSide
        });
        
        // Materiale per indicatori di snap attivo
        this.snapIndicatorMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide
        });
        
        // Materiale per evidenziazione oggetti draggabili
        this.highlightMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ccff,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide
        });
        
        console.log('[DragDropSystem] Materiali visivi inizializzati');
    },
    
    /**
     * Inizializza il piano di dragging
     */
    initDragPlane: function() {
        // Crea un piano invisibile per proiezione del movimento mouse
        const planeGeometry = new THREE.PlaneGeometry(1000, 1000);
        const planeMaterial = new THREE.MeshBasicMaterial({
            visible: false,
            side: THREE.DoubleSide
        });
        
        this.dragPlane = new THREE.Mesh(planeGeometry, planeMaterial);
        this.dragPlane.rotation.x = -Math.PI / 2; // Piano orizzontale
        this.dragPlane.position.y = 0; // A livello del pavimento
        this.dragPlane.name = 'DragPlane';
        
        this.scene.add(this.dragPlane);
    },
    
    /**
     * Setup event listeners per drag & drop
     */
    setupEventListeners: function() {
        // Bind dei metodi per mantenere contesto corretto
        this.boundMouseDown = this.onMouseDown.bind(this);
        this.boundMouseMove = this.onMouseMove.bind(this);
        this.boundMouseUp = this.onMouseUp.bind(this);
        this.boundKeyDown = this.onKeyDown.bind(this);

        // Aggiungi listener per tasto ESC di emergenza
        document.addEventListener('keydown', this.boundKeyDown);

        console.log('[DragDropSystem] Event listeners configurati (ESC = force reset)');
    },

    /**
     * Inizializza il sistema di tracking intercambiabili
     */
    initInterchangeableTracker: function() {
        if (window.InterchangeableTracker) {
            this.interchangeableTracker = window.InterchangeableTracker;
            this.interchangeableTracker.init(this);
            console.log('[DragDropSystem] ✅ InterchangeableTracker collegato');
        } else {
            console.warn('[DragDropSystem] ⚠️ InterchangeableTracker non disponibile');
        }
    },

    /**
     * Inizializza il sistema di snap
     */
    initSnapSystem: function() {
        if (window.SnapSystem) {
            this.snapSystem = window.SnapSystem;
            this.snapSystem.init(this);
            console.log('[DragDropSystem] ✅ SnapSystem collegato');
        } else {
            console.warn('[DragDropSystem] ⚠️ SnapSystem non disponibile');
        }
    },

    /**
     * Abilita il sistema drag & drop
     * @param {Array} objectNames - Lista nomi oggetti draggabili (opzionale)
     */
    enable: function(objectNames = null) {
        if (this.enabled) {
            console.log('[DragDropSystem] Sistema già abilitato - aggiornamento whitelist...');
            // Aggiorna whitelist anche se sistema già abilitato
            if (objectNames && Array.isArray(objectNames)) {
                this.setDraggableObjects(objectNames);
                console.log(`[DragDropSystem] ✅ Whitelist aggiornata: [${objectNames.join(', ')}]`);
            }
            return;
        }
        
        console.log('[DragDropSystem] ⚡ Abilitazione sistema drag & drop...');

        // Aggiunge event listeners al canvas
        this.canvas.addEventListener('mousedown', this.boundMouseDown, { passive: false });
        this.canvas.addEventListener('mousemove', this.boundMouseMove, { passive: false });
        this.canvas.addEventListener('mouseup', this.boundMouseUp, { passive: false, capture: true });

        // IMPORTANTE: Aggiunge listener mouseup anche su document per catturare rilasci fuori canvas
        // Usa capture: true per ricevere l'evento PRIMA di Scene3D e altri sistemi
        document.addEventListener('mouseup', this.boundMouseUp, { passive: false, capture: true });
        console.log('[DragDropSystem] ✅ Event listeners registrati (canvas + document con capture priority)');
        
        // Imposta whitelist oggetti se specificata
        if (objectNames && Array.isArray(objectNames)) {
            this.setDraggableObjects(objectNames);
        } else {
            // Se non specificato, rende tutti i modelli caricati draggabili
            this.detectDraggableObjects();
        }
        
        // Controlla se le posizioni originali sono già state memorizzate
        // (dovrebbero essere state salvate dopo il caricamento modelli)
        if (this.originalPositions.size === 0) {
            console.log('[DragDropSystem] ⚠️ Posizioni originali non trovate, salvataggio di backup');
            this.storeOriginalPositions();
        } else {
            console.log(`[DragDropSystem] ✅ Posizioni originali già memorizzate (${this.originalPositions.size} oggetti)`);
        }
        
        // DISABILITATO: Non creiamo più indicatori snap (sfere verdi)
        // this.createSnapIndicators();
        
        this.enabled = true;

        // Abilita i sistemi modulari
        if (this.interchangeableTracker && window.AssemblySystem && window.AssemblySystem.assemblyMode) {
            this.interchangeableTracker.enable();
        }
        if (this.snapSystem) {
            this.snapSystem.enable();
        }

        console.log(`[DragDropSystem] ✅ Sistema abilitato con ${this.draggableObjects.length} oggetti draggabili`);
        console.log('[DragDropSystem] Oggetti draggabili:', this.draggableObjects.map(obj => obj.name));
    },
    
    /**
     * Disabilita il sistema drag & drop
     */
    disable: function() {
        if (!this.enabled) {
            console.log('[DragDropSystem] Sistema già disabilitato');
            return;
        }
        
        console.log('[DragDropSystem] 🔴 Disabilitazione sistema drag & drop...');

        // Rimuove event listeners dal canvas
        this.canvas.removeEventListener('mousedown', this.boundMouseDown);
        this.canvas.removeEventListener('mousemove', this.boundMouseMove);
        this.canvas.removeEventListener('mouseup', this.boundMouseUp, { capture: true });

        // Rimuove listener mouseup da document
        document.removeEventListener('mouseup', this.boundMouseUp, { capture: true });
        console.log('[DragDropSystem] ✅ Event listeners rimossi (canvas + document)');
        
        // Termina qualsiasi drag in corso
        if (this.isDragging) {
            this.endDrag();
        }
        
        // Rimuove indicatori snap
        this.removeAllSnapIndicators();
        
        // Disabilita i sistemi modulari
        if (this.interchangeableTracker) {
            this.interchangeableTracker.disable();
        }
        if (this.snapSystem) {
            this.snapSystem.disable();
        }

        // Reset stato
        this.enabled = false;
        this.draggableObjects = [];
        this.whitelistedObjects.clear();

        // Reset posizioni snap occupate
        this.resetOccupiedPositions();

        console.log('[DragDropSystem] ✅ Sistema disabilitato');
    },
    
    /**
     * Imposta lista oggetti draggabili
     * @param {Array} objectNames - Nomi degli oggetti draggabili
     */
    setDraggableObjects: function(objectNames) {
        this.whitelistedObjects.clear();
        
        if (!Array.isArray(objectNames)) {
            console.warn('[DragDropSystem] objectNames deve essere un array');
            return;
        }
        
        objectNames.forEach(name => {
            this.whitelistedObjects.add(name.toLowerCase());
        });
        
        this.detectDraggableObjects();
        
        console.log(`[DragDropSystem] Whitelist aggiornata: ${objectNames.length} oggetti`);
    },
    
    /**
     * Rileva oggetti draggabili dal scene basandosi su whitelist o tutti i modelli
     */
    detectDraggableObjects: function() {
        this.draggableObjects = [];
        
        // Accede ai modelli caricati tramite Scene3D
        const loadedModels = window.Scene3D?.loadedModels || [];
        
        loadedModels.forEach(model => {
            if (this.isDraggableObject(model)) {
                this.draggableObjects.push(model);
            }
        });
        
        console.log(`[DragDropSystem] Rilevati ${this.draggableObjects.length} oggetti draggabili`);
    },
    
    /**
     * Verifica se un oggetto è draggabile
     * @param {THREE.Object3D} obj - Oggetto da verificare
     * @returns {boolean}
     */
    isDraggableObject: function(obj) {
        if (!obj || !obj.name) return false;

        const cleanName = obj.name.toLowerCase().replace(/\.(glb|gltf|obj|stl)$/, '');

        // PRIMO CONTROLLO: Blacklist - oggetti mai draggabili (priorità assoluta)
        if (this.blacklistedObjects.has(cleanName)) {
            console.log(`[DragDropSystem] 🚫 Oggetto "${cleanName}" è in blacklist - non draggabile`);
            return false;
        }

        // DEBUG MODE: Bypass controlli per troubleshooting
        if (this.debugMode) {
            console.log(`[DragDropSystem] 🔧 DEBUG MODE: "${cleanName}" sempre draggabile`);
            return true;
        }

        // MODALITÀ ASSEMBLAGGIO: Solo whitelist (restrittiva)
        if (window.AssemblySystem && window.AssemblySystem.enabled) {
            console.log(`[DragDropSystem] 🔍 ASSEMBLY MODE CHECK per "${cleanName}"`);
            console.log(`  - AssemblySystem abilitato: ${window.AssemblySystem.enabled}`);
            console.log(`  - AssemblySystem assemblyMode: ${window.AssemblySystem.assemblyMode}`);
            console.log(`  - Whitelist size: ${this.whitelistedObjects.size}`);
            console.log(`  - Whitelist contenuto: [${Array.from(this.whitelistedObjects).join(', ')}]`);

            // In modalità assemblaggio, SOLO gli oggetti in whitelist sono draggabili
            if (this.whitelistedObjects.size === 0) {
                console.log(`[DragDropSystem] 🔒 Modalità assemblaggio: nessuna whitelist - "${cleanName}" non draggabile`);
                return false;
            }

            const isInWhitelist = this.whitelistedObjects.has(cleanName);
            console.log(`  - "${cleanName}" in whitelist: ${isInWhitelist}`);

            if (!isInWhitelist) {
                console.log(`[DragDropSystem] 🔒 Modalità assemblaggio: "${cleanName}" non in whitelist - non draggabile`);
                return false;
            }

            // Verifica anche se è montabile secondo AssemblySystem
            let isMountable = true;
            try {
                isMountable = window.AssemblySystem.isComponentMountable(cleanName);
                console.log(`  - "${cleanName}" montabile (AssemblySystem): ${isMountable}`);
            } catch (error) {
                console.warn(`[DragDropSystem] ⚠️ Errore verifica montabilità per "${cleanName}":`, error);
                // In caso di errore, permetti il drag per non bloccare il sistema
                isMountable = true;
            }

            if (!isMountable) {
                console.log(`[DragDropSystem] ❌ Componente "${cleanName}" in whitelist ma non montabile (AssemblySystem)`);
                return false;
            }

            console.log(`[DragDropSystem] ✅ Modalità assemblaggio: "${cleanName}" draggabile (whitelist + montabile)`);
            return true;
        }

        // MODALITÀ NORMALE: Usa whitelist se presente, altrimenti fallback keywords
        if (this.whitelistedObjects.size > 0) {
            const isInWhitelist = this.whitelistedObjects.has(cleanName);

            // Durante sincronizzazione step, la whitelist ha priorità assoluta
            if (this.isStepSyncing) {
                console.log(`[DragDropSystem] 🔄 Durante sincronizzazione: "${cleanName}" whitelist=${isInWhitelist}`);
                return isInWhitelist;
            }

            return isInWhitelist;
        }

        // Fallback per modalità normale senza whitelist: escludi oggetti non selezionabili
        const nonDraggableKeywords = [
            'pavimento', 'piano', 'base', 'superficie', 'ground', 'floor',
            'basement', 'sfondo', 'background', 'assi', 'axis', 'gizmo'
        ];

        return !nonDraggableKeywords.some(keyword =>
            cleanName.includes(keyword)
        );
    },
    
    /**
     * Memorizza le posizioni e rotazioni originali di tutti gli oggetti draggabili
     * Se draggableObjects non è ancora definito, salva tutti i modelli caricati
     */
    storeOriginalPositions: function() {
        this.originalPositions.clear();
        this.originalRotations.clear();

        // Se draggableObjects non è definito, usa tutti i modelli caricati
        const objectsToStore = this.draggableObjects && this.draggableObjects.length > 0
            ? this.draggableObjects
            : window.Scene3D?.loadedModels || [];

        if (objectsToStore.length === 0) {
            console.warn('[DragDropSystem] ⚠️ Nessun oggetto disponibile per salvare posizioni originali');
            return;
        }

        objectsToStore.forEach(obj => {
            // Memorizza posizione del centro del bounding box
            const boundingBox = new THREE.Box3().setFromObject(obj);
            const originalCenter = boundingBox.getCenter(new THREE.Vector3());

            this.originalPositions.set(obj.uuid, originalCenter.clone());
            this.originalRotations.set(obj.uuid, obj.rotation.clone());

            console.log(`[DragDropSystem] 📍 Memorizzata posizione originale per ${obj.name}:`,
                `(${originalCenter.x.toFixed(3)}, ${originalCenter.y.toFixed(3)}, ${originalCenter.z.toFixed(3)})`);
        });

        console.log(`[DragDropSystem] ✅ Salvate ${this.originalPositions.size} posizioni originali`);

        // NUOVO: Inizializza tracking occupazioni per elementi intercambiabili
        if (this.interchangeableTracker) {
            this.interchangeableTracker.initializeInterchangeableOccupations();
        }
    },
    
    /**
     * Crea indicatori visivi per le zone di snap
     */
    createSnapIndicators: function() {
        this.removeAllSnapIndicators();
        
        this.draggableObjects.forEach(obj => {
            this.createSnapIndicatorForObject(obj);
        });
        
        console.log(`[DragDropSystem] Creati ${this.snapIndicators.size} indicatori snap`);
    },
    
    /**
     * Crea indicatore snap per un singolo oggetto
     * @param {THREE.Object3D} obj - Oggetto per cui creare l'indicatore
     */
    createSnapIndicatorForObject: function(obj) {
        const originalPos = this.originalPositions.get(obj.uuid);
        if (!originalPos) return;
        
        // Crea sfera verde piccola per snap zone
        const sphereGeometry = new THREE.SphereGeometry(
            0.05,                     // Raggio fisso piccolo (5cm)
            12,                       // Segmenti larghezza
            8                         // Segmenti altezza
        );

        // Materiale sfera verde semplice
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,          // Verde fisso
            transparent: false,        // Non trasparente
            wireframe: false          // Sfera piena normale
        });

        const sphere = new THREE.Mesh(sphereGeometry, material);
        sphere.position.copy(originalPos);
        sphere.name = `SnapIndicator_${obj.name}`;
        sphere.visible = false; // Nascosto di default

        console.log(`[DragDropSystem] 🎯 Creata sfera snap verde per ${obj.name} alla posizione:`, originalPos);

        this.snapIndicators.set(obj.uuid, sphere);
        this.scene.add(sphere);
    },
    
    /**
     * Rimuove tutti gli indicatori snap
     */
    removeAllSnapIndicators: function() {
        this.snapIndicators.forEach(indicator => {
            this.scene.remove(indicator);
            indicator.geometry?.dispose();
            indicator.material?.dispose();
        });
        this.snapIndicators.clear();
    },

    /**
     * Aggiorna gli indicatori snap in base al componente correntemente trascinato
     * Mostra punti di snap originali + quelli intercambiabili
     */
    updateSnapIndicators: function() {
        // Se gli indicatori sono disabilitati, non creare nulla
        if (!this.showSnapIndicators) {
            return;
        }

        // Prima rimuovi tutti gli indicatori esistenti
        this.removeAllSnapIndicators();

        // Se non c'è un oggetto trascinato, non mostrare indicatori
        if (!this.draggedObject) {
            return;
        }

        const objectName = this.draggedObject.name.toLowerCase().trim();
        console.log(`[DragDropSystem] 🔄 Aggiornamento indicatori snap per "${objectName}"`);

        // 1. Crea indicatore per posizione originale (sempre)
        const originalPos = this.originalPositions.get(this.draggedObject.uuid);
        if (originalPos) {
            this.createSingleSnapIndicator(this.draggedObject.uuid, originalPos, 0x00ff00, `Original_${objectName}`);
            console.log(`[DragDropSystem] ➕ Indicatore posizione originale creato`);
        }

        // 2. Crea indicatori per posizioni originali di altri componenti intercambiabili
        if (window.AssemblySystem && window.AssemblySystem.assemblyMode && window.AssemblySystem.currentConfig) {
            const interchangeableTargets = window.AssemblySystem.getInterchangeableSnapTargets(objectName);

            if (interchangeableTargets.length > 0) {
                console.log(`[DragDropSystem] 🎯 Creazione ${interchangeableTargets.length} indicatori per posizioni intercambiabili`);

                interchangeableTargets.forEach((target, index) => {
                    // DEBUG: Verifica posizioni
                    console.log(`[DragDropSystem] 🔍 Target ${index + 1}: "${target.targetName}" alla posizione (${target.position.x.toFixed(3)}, ${target.position.y.toFixed(3)}, ${target.position.z.toFixed(3)})`);

                    // Colore arancione per posizioni di altri componenti intercambiabili
                    const color = 0xff8800;
                    const uniqueId = `${this.draggedObject.uuid}_interchangeable_${index}`;

                    this.createSingleSnapIndicator(uniqueId, target.position, color, `Interch_${target.targetName}`);
                });

                console.log(`[DragDropSystem] ✅ Creati ${interchangeableTargets.length} indicatori intercambiabili`);
            } else {
                console.log(`[DragDropSystem] ℹ️ Nessun target intercambiabile trovato per "${objectName}"`);
            }
        }

        console.log(`[DragDropSystem] 📊 Totale indicatori snap attivi: ${this.snapIndicators.size}`);
    },

    /**
     * Crea un singolo indicatore snap
     * @param {string} id - ID univoco per l'indicatore
     * @param {THREE.Vector3} position - Posizione dell'indicatore
     * @param {number} color - Colore esadecimale
     * @param {string} name - Nome dell'indicatore
     */
    createSingleSnapIndicator: function(id, position, color, name) {
        const sphereGeometry = new THREE.SphereGeometry(0.05, 12, 8);
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.7,
            wireframe: false
        });

        const sphere = new THREE.Mesh(sphereGeometry, material);
        sphere.position.copy(position);
        sphere.name = `SnapIndicator_${name}`;
        sphere.visible = true; // Visibile quando viene creato durante il drag

        this.snapIndicators.set(id, sphere);
        this.scene.add(sphere);

        console.log(`[DragDropSystem] 🎯 Indicatore "${name}" creato alla posizione (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
    },
    
    /* ===== EVENT HANDLERS ===== */
    
    /**
     * Gestisce l'evento mousedown per iniziare il drag
     */
    onMouseDown: function(event) {
        if (!this.enabled || event.button !== 0) return; // Solo tasto sinistro
        
        // Aggiorna stato mouse
        this.mouseState.isDown = true;
        this.mouseState.startX = event.clientX;
        this.mouseState.startY = event.clientY;
        this.mouseState.currentX = event.clientX;
        this.mouseState.currentY = event.clientY;
        this.mouseState.hasMoved = false;
        
        // Calcola coordinate normalizzate
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Raycasting per trovare oggetto cliccato
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.draggableObjects, true);
        
        if (intersects.length > 0) {
            const clickedObject = intersects[0].object;
            const targetModel = this.findRootModel(clickedObject);

            console.log(`🔥🔥🔥 [DragDropSystem] VERSIONE 1.3.0 - CLICK RILEVATO SU: ${targetModel?.name} 🔥🔥🔥`);

            if (targetModel && this.isDraggableObject(targetModel)) {
                console.log(`🔥🔥🔥 [DragDropSystem] VERSIONE 1.3.0 - OGGETTO DRAGGABILE, CONTROLLO UTENSILE... 🔥🔥🔥`);

                // ⭐ CONTROLLO UTENSILE: Verifica che l'utensile "Mano" sia attivo
                if (!this.isCorrectToolActive()) {
                    console.log(`🔥🔥🔥 [DragDropSystem] ❌ DRAG BLOCCATO - UTENSILE "MANO" NON ATTIVO 🔥🔥🔥`);
                    alert('UTENSILE MANO NON ATTIVO - SELEZIONA PRIMA L\'UTENSILE MANO!');

                    // Feedback visivo per l'utente
                    this.showToolRequiredMessage();
                    return;
                }

                console.log(`🔥🔥🔥 [DragDropSystem] ✅ UTENSILE MANO ATTIVO - AVVIO DRAG 🔥🔥🔥`);
                this.startDrag(targetModel, intersects[0].point);
                event.preventDefault(); // Previene comportamenti di default
            }
        }
    },
    
    /**
     * Gestisce l'evento mousemove per il drag
     */
    onMouseMove: function(event) {
        if (!this.enabled) return;
        
        this.mouseState.currentX = event.clientX;
        this.mouseState.currentY = event.clientY;
        
        // Calcola se il mouse si è mosso significativamente
        const deltaX = Math.abs(this.mouseState.currentX - this.mouseState.startX);
        const deltaY = Math.abs(this.mouseState.currentY - this.mouseState.startY);
        
        if (!this.mouseState.hasMoved && (deltaX > 5 || deltaY > 5)) {
            this.mouseState.hasMoved = true;
        }
        
        // Se stiamo draggando, aggiorna posizione
        if (this.isDragging && this.draggedObject) {
            this.updateDragPosition(event);
            event.preventDefault();
        }
    },
    
    /**
     * Gestisce l'evento mouseup per terminare il drag
     */
    onMouseUp: function(event) {
        console.log(`[DragDropSystem] 🖱️ MOUSE UP - enabled: ${this.enabled}, isDragging: ${this.isDragging}, hasMoved: ${this.mouseState.hasMoved}`);
        console.log(`[DragDropSystem] 🖱️ MOUSE UP - draggedObject: ${this.draggedObject?.name || 'null'}`);

        if (!this.enabled) {
            console.log(`[DragDropSystem] 🖱️ Sistema disabilitato - reset forzato stato drag`);
            this.forceResetDragState();
            return;
        }

        const hadMoved = this.mouseState.hasMoved;

        // Reset stato mouse
        this.mouseState.isDown = false;
        this.mouseState.hasMoved = false;

        if (this.isDragging) {
            console.log(`[DragDropSystem] 🛑 MOUSE UP durante drag di: ${this.draggedObject?.name || 'UNKNOWN'} - chiamando endDrag()`);

            // IMPORTANTE: Ferma IMMEDIATAMENTE la propagazione dell'evento per evitare interferenze
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            this.endDrag();
            return; // Non eseguire click se stavamo draggando
        }

        // Se il mouse non si è mosso, potrebbe essere un click normale
        // Lascia che il sistema esistente gestisca il click
        if (!hadMoved && event.button === 0) {
            console.log('[DragDropSystem] Click rilevato, passando al sistema esistente...');
            // Non preventDefault() per permettere al sistema click esistente di funzionare
        }
    },

    /**
     * Gestisce il tasto ESC per reset di emergenza
     */
    onKeyDown: function(event) {
        // Tasto ESC = reset forzato
        if (event.key === 'Escape' && this.isDragging) {
            console.log(`[DragDropSystem] 🚨 ESC premuto durante drag - FORCE RESET`);
            this.forceResetDragState();
            event.preventDefault();
        }
    },

    /* ===== DRAG LOGIC ===== */
    
    /**
     * Inizia il drag di un oggetto
     * @param {THREE.Object3D} object - Oggetto da trascinare
     * @param {THREE.Vector3} intersectionPoint - Punto di intersezione iniziale
     */
    startDrag: function(object, intersectionPoint, options) {
        const isTouch = options && options.isTouch;
        console.log(`[DragDropSystem] 🎯 Inizio drag di: ${object.name}${isTouch ? ' (TOUCH)' : ''}`);

        this.isDragging = true;
        this.isTouchDrag = !!isTouch;
        this.draggedObject = object;

        // Memorizza posizione iniziale del drag
        this.dragStartPosition.copy(object.position);

        // Calcola offset tra centro oggetto e punto cliccato
        this.dragOffset.copy(intersectionPoint).sub(object.position);

        // IMPORTANTE: Manteniamo l'highlight giallo durante il drag per coerenza visiva
        // Gli oggetti draggabili rimangono evidenziati finché non fanno snap con successo
        console.log(`[DragDropSystem] 🎨 Mantengo highlight su ${object.name} durante drag`);

        // NUOVO: Crea piano di drag perpendicolare alla camera, passando per il punto cliccato
        this.updateDragPlaneToCamera(intersectionPoint);

        // Aggiorna indicatori snap per mostrare punti disponibili (originali + intercambiabili)
        if (this.snapSystem) {
            this.snapSystem.updateSnapIndicators(this.draggedObject);
        }

        // Cambia cursore (solo per mouse, non per touch)
        if (!isTouch) {
            this.canvas.style.cursor = 'grabbing';
        }

        // Disabilita sistema click esistente durante drag
        if (window.Scene3D && window.Scene3D.animationSystem) {
            window.Scene3D.animationSystem.clickEnabled = false;
        }

        // Disabilita controlli camera durante drag (solo per mouse, touch gestito da TouchSystem)
        if (!isTouch && window.Scene3D && window.Scene3D.mouseControls) {
            this.cameraControlsWereEnabled = window.Scene3D.mouseControls.enabled;
            window.Scene3D.mouseControls.enabled = false;
            console.log(`[DragDropSystem] 🚫 Controlli camera disabilitati durante drag`);
        }
    },
    
    /**
     * Aggiorna la posizione dell'oggetto durante il drag
     * @param {MouseEvent} event - Evento mouse
     */
    updateDragPosition: function(event) {
        if (!this.draggedObject) return;

        // Calcola coordinate normalizzate
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // NUOVO: Raycast intelligente per assemblaggio VS rimozione
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Verifica se stiamo vicini a una zona di snap (assemblaggio) o siamo in movimento libero (rimozione)
        const isNearSnapZone = this.isNearAnySnapZone(this.draggedObject);
        const corpoModel = this.scene.children.find(obj => obj.name === 'corpo');
        let raycastTargets = [];

        if (isNearSnapZone) {
            // MODALITÀ ASSEMBLAGGIO: Usa corpo + coperchio per assemblaggio completo
            raycastTargets = [];

            if (corpoModel) {
                raycastTargets.push(corpoModel);
            }

            // Aggiungi coperchio per assemblaggio viti coperchio
            const coperchioModel = this.scene.children.find(obj => obj.name === 'coperchio');
            if (coperchioModel) {
                raycastTargets.push(coperchioModel);
            }

            console.log(`[DEBUG] 🎯 ASSEMBLAGGIO: Raycast targeting CORPO + COPERCHIO per snap di "${this.draggedObject.name}"`);
            console.log(`[DEBUG] 🎯 Targets disponibili: [${raycastTargets.map(obj => obj.name).join(', ')}]`);
        } else {
            // MODALITÀ RIMOZIONE: Usa superficie estesa per movimento libero
            raycastTargets = this.scene.children.filter(obj =>
                obj !== this.draggedObject &&
                obj.type !== 'DirectionalLight' &&
                obj.type !== 'AmbientLight' &&
                !obj.name.startsWith('SnapIndicator') &&
                // Permetti coperchio per rimozione viti, ma non altre viti/tappini
                !obj.name.includes('vite') &&
                !obj.name.includes('tappino')
            );
            console.log(`[DEBUG] 🆓 RIMOZIONE: Raycast con ${raycastTargets.length} oggetti per movimento libero di "${this.draggedObject.name}"`);
        }

        const sceneIntersects = this.raycaster.intersectObjects(raycastTargets, true);

        // DEBUG: Log raycast results solo se problematici
        if (this.draggedObject && sceneIntersects.length === 0) {
            console.log(`[DEBUG] ❌ Raycast fallito durante drag di "${this.draggedObject.name}"`);
            console.log(`  📊 Oggetti raycast target: ${raycastTargets.length}`);
            console.log(`  🎯 Target utilizzati:`, raycastTargets.slice(0, 5).map(obj => obj.name || obj.type));
        }

        if (sceneIntersects.length > 0) {
            // Aggiorna il piano in base al punto intersectato
            const intersectionPoint = sceneIntersects[0].point;

            // Solo aggiorna se il punto è cambiato significativamente (per performance)
            if (!this.lastPlanePoint || this.lastPlanePoint.distanceTo(intersectionPoint) > 0.01) {
                this.updateDragPlaneToCamera(intersectionPoint);
                this.lastPlanePoint = intersectionPoint.clone();
            }
        } else {
            // FALLBACK: Se raycast fallisce, crea piano di drag per movimento libero
            if (!this.lastPlanePoint) {
                console.log(`[DEBUG] 🔄 Fallback: Creazione piano drag per movimento libero`);

                // OPZIONE 1: Prova corpo della pompa
                const corpoModel = this.scene.children.find(obj => obj.name === 'corpo');
                if (corpoModel) {
                    const corpoCenter = new THREE.Vector3();
                    const box = new THREE.Box3().setFromObject(corpoModel);
                    box.getCenter(corpoCenter);
                    this.updateDragPlaneToCamera(corpoCenter);
                    this.lastPlanePoint = corpoCenter.clone();
                    console.log(`[DEBUG] ✅ Fallback: Usato centro corpo per piano drag`);
                } else {
                    // OPZIONE 2: Prova pavimento
                    const pavimento = this.scene.children.find(obj => obj.name === 'pavimento');
                    if (pavimento) {
                        const pavimentoCenter = new THREE.Vector3();
                        const box = new THREE.Box3().setFromObject(pavimento);
                        box.getCenter(pavimentoCenter);
                        this.updateDragPlaneToCamera(pavimentoCenter);
                        this.lastPlanePoint = pavimentoCenter.clone();
                        console.log(`[DEBUG] ✅ Fallback: Usato pavimento per piano drag`);
                    } else {
                        // OPZIONE 3: Crea piano alla posizione corrente oggetto
                        const currentPos = this.draggedObject.position.clone();
                        this.updateDragPlaneToCamera(currentPos);
                        this.lastPlanePoint = currentPos.clone();
                        console.log(`[DEBUG] ✅ Fallback: Creato piano alla posizione oggetto corrente`);
                    }
                }
            }
        }

        // Proietta su piano di drag aggiornato
        const planeIntersects = this.raycaster.intersectObjects([this.dragPlane], false);

        if (planeIntersects.length > 0) {
            const newPosition = planeIntersects[0].point.sub(this.dragOffset);

            // Aggiorna posizione oggetto
            this.draggedObject.position.copy(newPosition);

            // Controlla e evidenzia zone di snap
            if (this.snapSystem) {
                this.snapSystem.checkSnapZones(this.draggedObject);
            }
        }
    },
    
    /**
     * Aggiorna posizione drag da coordinate touch normalizzate (-1..1)
     * Usa la stessa logica di updateDragPosition ma senza bisogno di un MouseEvent
     * @param {number} normalizedX - Coordinata X normalizzata (-1..1)
     * @param {number} normalizedY - Coordinata Y normalizzata (-1..1)
     */
    updateDragPositionFromTouch: function(normalizedX, normalizedY) {
        if (!this.draggedObject) return;

        // Usa coordinate normalizzate direttamente
        this.mouse.x = normalizedX;
        this.mouse.y = normalizedY;

        // Raycast intelligente (stessa logica di updateDragPosition)
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const isNearSnapZone = this.isNearAnySnapZone(this.draggedObject);
        let raycastTargets = [];

        if (isNearSnapZone) {
            const corpoModel = this.scene.children.find(obj => obj.name === 'corpo');
            if (corpoModel) raycastTargets.push(corpoModel);
            const coperchioModel = this.scene.children.find(obj => obj.name === 'coperchio');
            if (coperchioModel) raycastTargets.push(coperchioModel);
        } else {
            raycastTargets = this.scene.children.filter(obj =>
                obj !== this.draggedObject &&
                obj.type !== 'DirectionalLight' &&
                obj.type !== 'AmbientLight' &&
                !obj.name.startsWith('SnapIndicator') &&
                !obj.name.includes('vite') &&
                !obj.name.includes('tappino')
            );
        }

        const sceneIntersects = this.raycaster.intersectObjects(raycastTargets, true);

        if (sceneIntersects.length > 0) {
            const intersectionPoint = sceneIntersects[0].point;
            if (!this.lastPlanePoint || this.lastPlanePoint.distanceTo(intersectionPoint) > 0.01) {
                this.updateDragPlaneToCamera(intersectionPoint);
                this.lastPlanePoint = intersectionPoint.clone();
            }
        } else if (!this.lastPlanePoint) {
            const corpoModel = this.scene.children.find(obj => obj.name === 'corpo');
            if (corpoModel) {
                const box = new THREE.Box3().setFromObject(corpoModel);
                const center = box.getCenter(new THREE.Vector3());
                this.updateDragPlaneToCamera(center);
                this.lastPlanePoint = center.clone();
            } else {
                const currentPos = this.draggedObject.position.clone();
                this.updateDragPlaneToCamera(currentPos);
                this.lastPlanePoint = currentPos.clone();
            }
        }

        // Proietta su piano di drag
        const planeIntersects = this.raycaster.intersectObjects([this.dragPlane], false);
        if (planeIntersects.length > 0) {
            const newPosition = planeIntersects[0].point.sub(this.dragOffset);
            this.draggedObject.position.copy(newPosition);

            if (this.snapSystem) {
                this.snapSystem.checkSnapZones(this.draggedObject);
            }
        }
    },

    /**
     * Termina il drag e controlla se eseguire snap
     */
    endDrag: function() {
        console.log(`[DragDropSystem] 🏁 INIZIO endDrag() - isDragging: ${this.isDragging}, draggedObject: ${this.draggedObject?.name || 'null'}`);

        if (!this.isDragging || !this.draggedObject) {
            console.log(`[DragDropSystem] ⚠️ endDrag() chiamato ma nessun drag in corso - USCITA EARLY`);
            return;
        }

        console.log(`[DragDropSystem] 🏁 Fine drag di: ${this.draggedObject.name}`);
        console.log(`[DragDropSystem] 📍 Posizione corrente: (${this.draggedObject.position.x.toFixed(3)}, ${this.draggedObject.position.y.toFixed(3)}, ${this.draggedObject.position.z.toFixed(3)})`);

        // DEBUG: Log distanza dal punto di snap al momento del drop (PRIMA di findSnapTarget)
        const originalPos = this.originalPositions.get(this.draggedObject.uuid);
        console.log(`[DragDropSystem] 🔍 DEBUG POSIZIONI ORIGINALI - Totale salvate: ${this.originalPositions.size}`);

        if (originalPos) {
            const currentBoundingBox = new THREE.Box3().setFromObject(this.draggedObject);
            const currentCenter = currentBoundingBox.getCenter(new THREE.Vector3());
            const distanceFromTarget = currentCenter.distanceTo(originalPos);

            console.log(`[DragDropSystem] 📏 DISTANZA AL DROP per ${this.draggedObject.name}:`);
            console.log(`  📦 Centro BB corrente: (${currentCenter.x.toFixed(3)}, ${currentCenter.y.toFixed(3)}, ${currentCenter.z.toFixed(3)})`);
            console.log(`  🎯 Target originale: (${originalPos.x.toFixed(3)}, ${originalPos.y.toFixed(3)}, ${originalPos.z.toFixed(3)})`);
            console.log(`  📏 Distanza centro BB → target: ${distanceFromTarget.toFixed(3)} unità`);
            console.log(`  ⚖️ Soglia snap configurata: ${this.snapDistance.toFixed(3)} unità`);
            console.log(`  ${distanceFromTarget <= this.snapDistance ? '✅ DOVREBBE FARE SNAP' : '❌ NON DOVREBBE FARE SNAP'}`);
        } else {
            console.log(`[DragDropSystem] ❌ ERRORE: Nessuna posizione originale salvata per ${this.draggedObject.name} (UUID: ${this.draggedObject.uuid})`);
            console.log(`[DragDropSystem] 🔍 Posizioni salvate:`, Array.from(this.originalPositions.keys()));
        }

        // Controlla se l'oggetto è abbastanza vicino alla posizione originale
        console.log(`[DragDropSystem] 🎯 Cercando snap target per ${this.draggedObject.name}...`);
        console.log(`[DragDropSystem] 🎯 Custom snap targets configurati: ${this.customSnapTargets.size}`);
        if (this.customSnapTargets.has(this.draggedObject.uuid)) {
            const customTarget = this.customSnapTargets.get(this.draggedObject.uuid);
            console.log(`[DragDropSystem] 🎯 Custom snap target trovato per ${this.draggedObject.name}:`, customTarget);
        }

        // Utilizza prima AssemblySystemSimplified, poi fallback al SnapSystem
        let snapTarget = null;

        if (window.AssemblySystemSimplified && window.AssemblySystemSimplified.assemblyMode) {
            // Sistema semplificato: usa snap targets del gruppo corrente
            const groupSnapTargets = window.AssemblySystemSimplified.getCurrentGroupSnapTargets(this.draggedObject.name);
            console.log(`[DragDropSystem] 🎯 AssemblySystemSimplified trovato ${groupSnapTargets.length} snap targets`);

            if (groupSnapTargets.length > 0) {
                // Trova il target più vicino
                const currentBoundingBox = new THREE.Box3().setFromObject(this.draggedObject);
                const currentCenter = currentBoundingBox.getCenter(new THREE.Vector3());

                let closestTarget = null;
                let closestDistance = Infinity;

                groupSnapTargets.forEach(target => {
                    const distance = currentCenter.distanceTo(target.position);
                    if (distance <= this.snapDistance && distance < closestDistance) {
                        closestTarget = target.position;
                        closestDistance = distance;
                    }
                });

                if (closestTarget) {
                    snapTarget = closestTarget;
                    console.log(`[DragDropSystem] 🎯 Snap target trovato tramite AssemblySystemSimplified: (${snapTarget.x.toFixed(3)}, ${snapTarget.y.toFixed(3)}, ${snapTarget.z.toFixed(3)})`);
                }
            }
        }

        // Fallback al sistema vecchio se nessun target trovato
        if (!snapTarget && this.snapSystem) {
            snapTarget = this.snapSystem.findSnapTarget(this.draggedObject);
            console.log(`[DragDropSystem] 🎯 Fallback SnapSystem risultato:`, snapTarget ? `Posizione (${snapTarget.x.toFixed(3)}, ${snapTarget.y.toFixed(3)}, ${snapTarget.z.toFixed(3)})` : 'null');
        }

        console.log(`[DragDropSystem] 🎯 findSnapTarget finale:`, snapTarget ? `Posizione (${snapTarget.x.toFixed(3)}, ${snapTarget.y.toFixed(3)}, ${snapTarget.z.toFixed(3)})` : 'null');

        // SEMPRE fare cleanup base prima di tutto
        const wasTouchDrag = this.isTouchDrag;
        console.log(`[DragDropSystem] 🧹 CLEANUP BASE: hiding snap indicators e reset cursore...${wasTouchDrag ? ' (TOUCH)' : ''}`);
        this.hideAllSnapIndicators();

        // Reset cursore (solo per mouse, non per touch)
        if (!wasTouchDrag) {
            this.canvas.style.cursor = '';
            console.log(`[DragDropSystem] 🖱️ Cursore canvas inline resettato, classi CSS attive`);

            // Ferma animazione cursore di Scene3D
            if (window.Scene3D && typeof window.Scene3D.stopCursorAnimation === 'function') {
                window.Scene3D.stopCursorAnimation();
                console.log(`[DragDropSystem] ⏹️ Animazione cursore Scene3D fermata`);
            }
        }

        // Riabilita sistema click esistente
        if (window.Scene3D && window.Scene3D.animationSystem) {
            window.Scene3D.animationSystem.clickEnabled = true;
            console.log(`[DragDropSystem] 🎯 Click animation system riabilitato`);
        }

        // Riabilita controlli camera (solo per mouse, touch gestito da TouchSystem)
        if (!wasTouchDrag && window.Scene3D && window.Scene3D.mouseControls && this.cameraControlsWereEnabled !== undefined) {
            window.Scene3D.mouseControls.enabled = this.cameraControlsWereEnabled;
            console.log(`[DragDropSystem] ✅ Controlli camera riabilitati: ${this.cameraControlsWereEnabled}`);
            this.cameraControlsWereEnabled = undefined;
        }

        // NUOVO: Riapplica cursore strumento attivo tramite ToolsManager
        if (window.ToolsManager && typeof window.ToolsManager.updateCanvasCursor === 'function') {
            console.log(`[DragDropSystem] 🔧 Richiedendo aggiornamento cursore a ToolsManager...`);

            // Debug stato strumenti PRIMA di updateCanvasCursor
            if (typeof window.ToolsManager.getActiveTool === 'function') {
                const activeTool = window.ToolsManager.getActiveTool();
                console.log(`[DragDropSystem] 🔍 Tool attivo prima update: "${activeTool}"`);

                if (typeof window.ToolsManager.getToolsState === 'function') {
                    const toolsState = window.ToolsManager.getToolsState();
                    console.log(`[DragDropSystem] 🔍 Stato completo tools:`, toolsState);
                }
            }

            window.ToolsManager.updateCanvasCursor();
            console.log(`[DragDropSystem] 🔧 ToolsManager updateCanvasCursor completato`);

            // Debug stato DOPO updateCanvasCursor
            if (typeof window.ToolsManager.getActiveTool === 'function') {
                const activeToolAfter = window.ToolsManager.getActiveTool();
                console.log(`[DragDropSystem] 🔍 Tool attivo dopo update: "${activeToolAfter}"`);
            }
        } else {
            console.log(`[DragDropSystem] ⚠️ ToolsManager non disponibile per aggiornamento cursore`);
            console.log(`[DragDropSystem] 🔍 Debug: window.ToolsManager = ${window.ToolsManager ? 'presente' : 'assente'}`);
            if (window.ToolsManager) {
                console.log(`[DragDropSystem] 🔍 Debug: updateCanvasCursor = ${typeof window.ToolsManager.updateCanvasCursor}`);
            }

            // FALLBACK: Applica cursore mano usando sistema body class unificato
            document.body.classList.remove('tool-aria-active', 'tool-chiave_inglese-active', 'tool-brugola-active', 'tool-mano-active');
            document.body.classList.add('tool-mano-active');
            console.log(`[DragDropSystem] 🔧 Fallback: Cursore mano applicato via body class`);

            const canvas = document.querySelector('#canvas3d, canvas');
            if (canvas) {
                canvas.classList.remove('cursor-default', 'cursor-mano', 'cursor-brugola', 'cursor-chiave', 'cursor-aria');
            }
        }

        if (snapTarget) {
            // IMPORTANTE: Salva stato da resettare dopo l'animazione
            // Debug dettagliato per sistema Assembly
            const assemblySystem = window.AssemblySystemSimplified || window.AssemblySystem;
            const assemblyEnabled = assemblySystem && assemblySystem.assemblyMode;
            const componentName = this.getCleanModelName(this.draggedObject.name);

            console.log(`[DragDropSystem] 🏗️ DEBUG ASSEMBLY INTEGRATION:`);
            console.log(`  assemblySystem: ${assemblySystem ? (window.AssemblySystemSimplified ? 'AssemblySystemSimplified' : 'AssemblySystem') : 'assente'}`);
            console.log(`  assemblyMode: ${assemblySystem?.assemblyMode}`);
            console.log(`  assemblyEnabled: ${assemblyEnabled}`);
            console.log(`  componentName: "${componentName}"`);

            const snapContext = {
                draggedObject: this.draggedObject,
                assemblyIntegration: {
                    enabled: assemblyEnabled,
                    componentName: componentName,
                    snapTargetPosition: snapTarget
                }
            };

            // Esegui snap animato e rimuovi highlight dopo snap riuscito
            if (this.snapSystem) {
                // Aggiungi callback per integrazione AssemblySystem
                snapContext.onComplete = this.handleSnapComplete.bind(this);
                this.snapSystem.performSnap(this.draggedObject, snapTarget, snapContext);
            }

            // IMPORTANTE: Rimuovi highlight dopo snap riuscito per indicare che l'oggetto è "sistemato"
            // Ripristina materiale originale per questo oggetto specifico
            if (this.originalMaterialsMap && this.originalMaterialsMap.has(this.draggedObject.uuid)) {
                const originalMaterials = this.originalMaterialsMap.get(this.draggedObject.uuid);
                this.draggedObject.traverse((child) => {
                    if (child.isMesh && originalMaterials.has(child.uuid)) {
                        child.material = originalMaterials.get(child.uuid);
                        child.renderOrder = 0;
                    }
                });
                console.log(`[DragDropSystem] ✅ Snap riuscito - rimosso highlight da ${this.draggedObject.name}`);
            }
            this.silhouetteBlocked.delete(this.draggedObject.name);

            // Reset stato SEMPRE - performSnap gestirà la sua parte
        } else {
            // Snap fallito - rimuovi dal blocco e riapplica highlight
            this.silhouetteBlocked.delete(this.draggedObject.name);
            if (window.Scene3D && typeof window.Scene3D.highlightModel === 'function') {
                window.Scene3D.highlightModel(this.draggedObject);
                console.log(`[DragDropSystem] ❌ Snap fallito - riapplicato highlight giallo a ${this.draggedObject.name}`);
            }

            // TRACKING OCCUPAZIONI: Delega al modulo InterchangeableTracker (snap fallito)
            if (this.interchangeableTracker) {
                const currentBoundingBox = new THREE.Box3().setFromObject(this.draggedObject);
                const currentCenter = currentBoundingBox.getCenter(new THREE.Vector3());
                this.interchangeableTracker.handlePositionChange(this.draggedObject, currentCenter);
            }
        }

        // Reset stato SEMPRE (anche con snap riuscito)
        this.isDragging = false;
        this.isTouchDrag = false;
        this.draggedObject = null;
        this.dragOffset.set(0, 0, 0);
        this.dragStartPosition.set(0, 0, 0);
        this.lastPlanePoint = null;  // Reset cache piano

        console.log(`[DragDropSystem] 🔄 RESET COMPLETO: isDragging=${this.isDragging}, draggedObject=${this.draggedObject ? this.draggedObject.name : 'null'}`);
    },

    /**
     * Forza il reset dello stato di drag (per situazioni di emergenza)
     * FIX: Aggiunto reset tracking occupazioni e cancellazione retry pendenti
     */
    forceResetDragState: function() {
        console.log(`[DragDropSystem] 🚨 FORCE RESET DRAG STATE`);

        // FIX: Cancella retry pendenti per avanzamento tutorial
        if (this.advanceRetryTimeoutId) {
            clearTimeout(this.advanceRetryTimeoutId);
            this.advanceRetryTimeoutId = null;
            console.log(`[DragDropSystem] 🔄 Retry avanzamento cancellato`);
        }

        // FIX: Reset tracking occupazioni snap
        this.occupiedSnapPositions.clear();
        this.objectSnapPosition.clear();
        console.log(`[DragDropSystem] 🔄 Tracking occupazioni snap resettato`);

        // Reset completo stato
        this.isDragging = false;
        this.isTouchDrag = false;
        this.draggedObject = null;
        this.dragOffset.set(0, 0, 0);
        this.dragStartPosition.set(0, 0, 0);
        this.lastPlanePoint = null;

        // Reset stato mouse
        this.mouseState.isDown = false;
        this.mouseState.hasMoved = false;

        // Nascondi indicatori snap
        this.hideAllSnapIndicators();

        // Riabilita controlli camera se erano disabilitati
        if (window.Scene3D && window.Scene3D.mouseControls && this.cameraControlsWereEnabled !== undefined) {
            window.Scene3D.mouseControls.enabled = this.cameraControlsWereEnabled;
            console.log(`[DragDropSystem] 🔄 Controlli camera riabilitati forzatamente: ${this.cameraControlsWereEnabled}`);
            this.cameraControlsWereEnabled = undefined;
        }

        // Riapplica cursore tool tramite ToolsManager
        if (window.ToolsManager && typeof window.ToolsManager.updateCanvasCursor === 'function') {
            window.ToolsManager.updateCanvasCursor();
            console.log(`[DragDropSystem] 🔧 Cursore tool riapplicato forzatamente`);
        }

        console.log(`[DragDropSystem] ✅ Force reset completato`);
    },

    /**
     * Aggiorna il piano di drag per essere perpendicolare alla camera
     * @param {THREE.Vector3} intersectionPoint - Punto di intersezione del raycast
     */
    updateDragPlaneToCamera: function(intersectionPoint) {
        if (!this.camera || !this.dragPlane) return;

        // Calcola la direzione dal camera verso il punto di intersezione
        const cameraToPoint = new THREE.Vector3();
        cameraToPoint.subVectors(intersectionPoint, this.camera.position).normalize();

        // La normale del piano deve essere parallela alla direzione della camera
        // Per un piano perpendicolare alla vista della camera
        this.dragPlane.position.copy(intersectionPoint);

        // Imposta rotazione del piano: normale parallela al vettore camera-punto
        const up = new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(cameraToPoint, up).normalize();
        const finalUp = new THREE.Vector3().crossVectors(right, cameraToPoint).normalize();

        // Costruisci matrice rotazione per il piano
        this.dragPlane.matrix.makeBasis(right, finalUp, cameraToPoint);
        this.dragPlane.matrix.setPosition(intersectionPoint);
        this.dragPlane.matrixAutoUpdate = false;
        this.dragPlane.matrixWorldNeedsUpdate = true;
    },

    /**
     * Gestisce il completamento di uno snap (callback da SnapSystem)
     * @param {THREE.Object3D} object - Oggetto che ha fatto snap
     * @param {THREE.Vector3} targetPosition - Posizione finale
     * @param {Object} snapContext - Contesto del snap
     */
    handleSnapComplete: function(object, targetPosition, snapContext) {
        console.log(`[DragDropSystem] 🎯 Handling snap completion per ${object.name}`);

        // Occupa la posizione di snap per impedire ad altri oggetti di usarla
        const snapKey = this.snapPositionKeys.get(targetPosition);
        if (snapKey) {
            this.occupySnapPosition(snapKey, object);
        }

        // Usa AssemblySystemSimplified se disponibile, altrimenti fallback a AssemblySystem
        const assemblySystem = window.AssemblySystemSimplified || window.AssemblySystem;
        const shouldResetDragState = snapContext !== null;

        console.log(`[DragDropSystem] 🔍 VERIFICA INTEGRAZIONE ASSEMBLY:`);
        console.log(`  shouldResetDragState: ${shouldResetDragState}`);
        console.log(`  snapContext: ${snapContext ? 'presente' : 'assente'}`);
        console.log(`  assemblySystem: ${assemblySystem ? (window.AssemblySystemSimplified ? 'AssemblySystemSimplified' : 'AssemblySystem') : 'assente'}`);
        console.log(`  assemblyMode: ${assemblySystem?.assemblyMode}`);

        if (shouldResetDragState && snapContext && assemblySystem && assemblySystem.assemblyMode) {
            try {
                const componentName = snapContext.assemblyIntegration.componentName;
                console.log(`[DragDropSystem] 🏗️ CHIAMANDO markComponentMounted con:`);
                console.log(`  componentName: "${componentName}"`);
                console.log(`  targetPosition: (${targetPosition.x.toFixed(3)}, ${targetPosition.y.toFixed(3)}, ${targetPosition.z.toFixed(3)})`);

                assemblySystem.markComponentMounted(componentName, targetPosition);
                console.log(`[DragDropSystem] 🏗️ Componente "${componentName}" marcato come montato nel sistema assemblaggio`);

                // Verifica se il passo corrente è completato
                const assemblyStatus = assemblySystem.getAssemblyStatus();
                console.log(`[DragDropSystem] 📋 Stato Assembly dopo mount:`);
                console.log(`  currentStep: "${assemblyStatus.currentStep}"`);
                console.log(`  currentStepComplete: ${assemblyStatus.currentStepComplete}`);
                console.log(`  mountedComponents: [${assemblyStatus.mountedComponents.join(', ')}]`);
                console.log(`  allowedComponents: [${assemblyStatus.allowedComponents.join(', ')}]`);
                console.log(`  canAdvanceToNext: ${assemblyStatus.canAdvanceToNext}`);

                if (assemblyStatus.currentStepComplete) {
                    console.log(`[DragDropSystem] 🎯 Step "${assemblyStatus.currentStep}" completato!`);

                    // Check if we can advance to next step
                    if (assemblyStatus.canAdvanceToNext) {
                        console.log(`[DragDropSystem] 🎯 Step completato e avanzamento consentito, chiamando getNextStep()...`);
                        const nextStep = assemblySystem.getNextStep();

                        if (nextStep) {
                            console.log(`[DragDropSystem] ⏭️ Avanzamento interno assembly a step: "${nextStep}"`);
                            assemblySystem.setCurrentStep(nextStep);
                        } else {
                            console.log(`[DragDropSystem] 🎉 getNextStep() ha restituito null - delegando avanzamento a UI tutorial`);
                            // Avanza il tutorial UI quando l'assembly system indica step management delegato
                            this.tryAdvanceTutorialStep('assembly_step_completed');
                        }
                    } else {
                        console.log(`[DragDropSystem] ⏸️ Step completato ma canAdvanceToNext: false`);
                    }
                }
            } catch (error) {
                console.warn(`[DragDropSystem] ⚠️ Errore integrazione AssemblySystem:`, error);
            }
        }

        // NUOVO: Tracking snap completati per auto-avanzamento step (senza assembly system)
        if (this.autoAdvanceEnabled && this.requiredSnapObjects.size > 0) {
            const objectName = object.name.replace(/^models\//, '').replace(/\.(glb|obj|stl)$/, '');

            // Aggiungi oggetto alla lista completati
            this.completedSnapObjects.add(objectName);
            console.log(`[DragDropSystem] ✅ Oggetto "${objectName}" snappato con successo`);
            console.log(`[DragDropSystem] 📊 Progress: ${this.completedSnapObjects.size}/${this.requiredSnapObjects.size} oggetti snappati`);

            // Controlla se tutti gli oggetti richiesti hanno fatto snap
            const allSnapped = Array.from(this.requiredSnapObjects).every(req => this.completedSnapObjects.has(req));

            if (allSnapped) {
                console.log(`[DragDropSystem] 🎉 TUTTI GLI OGGETTI RICHIESTI SONO STATI SNAPPATI!`);
                console.log(`[DragDropSystem] ⏭️ Auto-avanzamento allo step successivo...`);

                // Piccolo delay per permettere all'animazione snap di completarsi
                setTimeout(() => {
                    this.tryAdvanceTutorialStep('all_snaps_completed');
                }, 500);
            }
        }
    },

    /* ===== SNAP SYSTEM DELEGATION ===== */
    
    /**
     * Verifica se l'oggetto è vicino a una zona di snap (per assemblaggio)
     * @param {THREE.Object3D} object - Oggetto da controllare
     * @returns {boolean} - true se vicino a zona snap, false altrimenti
     */
    isNearAnySnapZone: function(object) {
        if (!object) return false;

        // Usa la stessa logica di findSnapTarget ma ritorna solo boolean
        const currentBoundingBox = new THREE.Box3().setFromObject(object);
        const currentCenter = currentBoundingBox.getCenter(new THREE.Vector3());

        // 1. Controlla target personalizzati
        const customTarget = this.customSnapTargets.get(object.uuid);
        if (customTarget) {
            let targetPosition = null;

            // Coordinate dirette (x,y,z)
            if (customTarget.isDirectPosition && customTarget.directPosition) {
                targetPosition = customTarget.directPosition.clone();
            }
            // Riferimenti _original
            else if (customTarget.isOriginalRef && window.Scene3D) {
                const originalRef = window.Scene3D.findModelByName(customTarget.targetName);
                if (originalRef && originalRef.position) {
                    targetPosition = originalRef.position.clone();
                }
            }
            // Target standard
            else if (customTarget.targetName) {
                const targetModel = window.Scene3D ? window.Scene3D.findModelByName(customTarget.targetName) : null;
                if (targetModel && targetModel.position) {
                    targetPosition = targetModel.position.clone();
                }
            }

            if (targetPosition) {
                // ✅ NUOVO: Determina posizione in base a usePivot
                let currentPosition;
                if (customTarget.usePivot) {
                    currentPosition = object.position.clone(); // Usa PIVOT
                    console.log(`[DragDropSystem] 📍 isNearAnySnapZone: Usando PIVOT per "${object.name}": (${currentPosition.x.toFixed(3)}, ${currentPosition.y.toFixed(3)}, ${currentPosition.z.toFixed(3)})`);
                } else {
                    currentPosition = currentCenter; // Usa CENTRO BB (default)
                }

                const distance = currentPosition.distanceTo(targetPosition);
                return distance <= this.snapDistance * 1.5; // Un po' più tollerante per rilevamento modalità
            }
        }

        // 2. Controlla posizione originale salvata
        // Nota: per originalPos usa sempre centro BB (non ha flag usePivot)
        const originalPos = this.originalPositions.get(object.uuid);
        if (originalPos) {
            const distance = currentCenter.distanceTo(originalPos);
            return distance <= this.snapDistance * 1.5; // Un po' più tollerante per rilevamento modalità
        }

        return false; // Non vicino a nessuna zona snap
    },

    /**
     * Trova il target di snap per un oggetto
     * @param {THREE.Object3D} object - Oggetto da controllare
     * @returns {THREE.Vector3|null} - Posizione target per snap o null
     */
    findSnapTarget: function(object) {
        const currentPos = object.position;

        // Calcola centro bounding box una sola volta per entrambi i controlli
        const currentBoundingBox = new THREE.Box3().setFromObject(object);
        const currentCenter = currentBoundingBox.getCenter(new THREE.Vector3());

        // 1. Controlla se esiste un target di snap personalizzato
        const customTarget = this.customSnapTargets.get(object.uuid);
        if (customTarget) {
            // NUOVO: Multi-target intercambiabili
            if (customTarget.isMultiTarget && customTarget.targets) {
                console.log(`[DragDropSystem] 🔄 Verifica ${customTarget.targets.length} snap targets intercambiabili per "${object.name}"`);

                let closestTarget = null;
                let closestDistance = Infinity;
                let closestTargetName = null;

                customTarget.targets.forEach((target, index) => {
                    let targetPosition = null;

                    // Verifica se la posizione è già occupata da un altro oggetto
                    const positionKey = this.createSnapPositionKey(target.targetName, null);
                    if (this.isSnapPositionOccupied(positionKey, object)) {
                        console.log(`[DragDropSystem] 🚫 Target ${index + 1}/${customTarget.targets.length}: "${target.targetName}" - OCCUPATO, skippo`);
                        return; // Skip questo target
                    }

                    // Riferimenti _original
                    if (target.isOriginalRef && window.Scene3D) {
                        // Rimuovi suffisso "_original" per trovare il modello reale
                        const actualModelName = target.targetName.replace(/_original$/, '');
                        const originalRef = window.Scene3D.findModelByName(actualModelName);
                        if (originalRef) {
                            // PRIORITÀ 1: Controlla se è un virtualTarget (ha position ma non geometry)
                            if (originalRef.isOriginalReference && originalRef.position && !originalRef.geometry) {
                                // È un target virtuale da SnapPoint globale → usa direttamente la posizione
                                targetPosition = originalRef.position.clone();
                                console.log(`[DragDropSystem] 📍 Target ${target.targetName} (VIRTUALE SnapPoint): posizione=(${targetPosition.x.toFixed(3)},${targetPosition.y.toFixed(3)},${targetPosition.z.toFixed(3)})`);
                            }
                            // PRIORITÀ 2: Per _original di modelli reali
                            else {
                                // DEBUG: Mostra stato completo del modello referenziato
                                const currentBB = new THREE.Box3().setFromObject(originalRef);
                                const currentBBCenter = currentBB.getCenter(new THREE.Vector3());
                                console.log(`[DragDropSystem] 🔍 DEBUG ${target.targetName}:`);
                                console.log(`  📍 Pivot corrente: (${originalRef.position.x.toFixed(3)}, ${originalRef.position.y.toFixed(3)}, ${originalRef.position.z.toFixed(3)})`);
                                console.log(`  📦 Centro BB corrente: (${currentBBCenter.x.toFixed(3)}, ${currentBBCenter.y.toFixed(3)}, ${currentBBCenter.z.toFixed(3)})`);

                                // Per _original, usa la posizione originale SALVATA, non il bounding box corrente
                                const savedOriginalPos = this.originalPositions.get(originalRef.uuid);
                                if (savedOriginalPos) {
                                    targetPosition = savedOriginalPos.clone();
                                    console.log(`  ✅ Posizione originale salvata: (${targetPosition.x.toFixed(3)},${targetPosition.y.toFixed(3)},${targetPosition.z.toFixed(3)})`);
                                    console.log(`  📏 Delta Y (salvata vs corrente): ${(targetPosition.y - currentBBCenter.y).toFixed(3)}`);
                                } else {
                                    console.warn(`[DragDropSystem] ⚠️ Posizione originale non trovata per ${target.targetName}, uso centro BB come fallback`);
                                    const targetBoundingBox = new THREE.Box3().setFromObject(originalRef);
                                    targetPosition = targetBoundingBox.getCenter(new THREE.Vector3());
                                }
                            }
                        }
                    }
                    // Target standard (cerca l'oggetto nella scena)
                    else if (target.targetName && window.Scene3D) {
                        const targetModel = window.Scene3D.findModelByName(target.targetName);
                        if (targetModel) {
                            // Usa il CENTRO del bounding box invece del pivot
                            const targetBoundingBox = new THREE.Box3().setFromObject(targetModel);
                            targetPosition = targetBoundingBox.getCenter(new THREE.Vector3());
                            console.log(`[DragDropSystem] 📦 Target ${target.targetName}: pivot=(${targetModel.position.x.toFixed(3)},${targetModel.position.y.toFixed(3)},${targetModel.position.z.toFixed(3)}), centro BB=(${targetPosition.x.toFixed(3)},${targetPosition.y.toFixed(3)},${targetPosition.z.toFixed(3)})`);
                        }
                    }

                    if (targetPosition) {
                        // ✅ NUOVO: Determina posizione in base a usePivot
                        let currentPosition;
                        if (customTarget.usePivot) {
                            currentPosition = object.position.clone(); // Usa PIVOT
                            console.log(`[DragDropSystem] 📍 findSnapTarget (multi): Usando PIVOT per "${object.name}": (${currentPosition.x.toFixed(3)}, ${currentPosition.y.toFixed(3)}, ${currentPosition.z.toFixed(3)})`);
                        } else {
                            currentPosition = currentCenter; // Usa CENTRO BB (default)
                        }

                        const distance = currentPosition.distanceTo(targetPosition);
                        console.log(`[DragDropSystem] 📏 Target ${index + 1}/${customTarget.targets.length}: "${target.targetName}" - Distanza: ${distance.toFixed(3)}`);

                        if (distance <= this.snapDistance && distance < closestDistance) {
                            closestTarget = targetPosition;
                            closestDistance = distance;
                            closestTargetName = target.targetName;
                            console.log(`[DragDropSystem] ⭐ Nuovo target più vicino: "${target.targetName}" a distanza ${distance.toFixed(3)}`);
                        }
                    }
                });

                if (closestTarget) {
                    console.log(`[DragDropSystem] 🧲 Snap intercambiabile disponibile per ${object.name} -> "${closestTargetName}" (distanza: ${closestDistance.toFixed(2)})`);
                    // Associa chiave posizione al Vector3 usando WeakMap (zero interferenze)
                    const snapKey = this.createSnapPositionKey(closestTargetName, null);
                    this.snapPositionKeys.set(closestTarget, snapKey);
                    return closestTarget;
                }

                console.log(`[DragDropSystem] ❌ Nessun target intercambiabile entro distanza ${this.snapDistance} per "${object.name}"`);
            }
            // Single target (esistente)
            else {
                let targetPosition = null;
                let positionKey = null;

                // NUOVO: Coordinate dirette (x,y,z)
                if (customTarget.isDirectPosition && customTarget.directPosition) {
                    targetPosition = customTarget.directPosition.clone();
                    positionKey = this.createSnapPositionKey(null, targetPosition);
                    console.log(`[DragDropSystem] 🎯 Custom snap target (coordinate dirette): (${targetPosition.x.toFixed(2)}, ${targetPosition.y.toFixed(2)}, ${targetPosition.z.toFixed(2)})`);
                }
                // Riferimenti _original
                else if (customTarget.isOriginalRef && window.Scene3D) {
                    positionKey = this.createSnapPositionKey(customTarget.targetName, null);
                    // Rimuovi suffisso "_original" per trovare il modello reale
                    const actualModelName = customTarget.targetName.replace(/_original$/, '');
                    const originalRef = window.Scene3D.findModelByName(actualModelName);
                    if (originalRef) {
                        // PRIORITÀ 1: Controlla se è un virtualTarget (ha position ma non geometry)
                        if (originalRef.isOriginalReference && originalRef.position && !originalRef.geometry) {
                            // È un target virtuale da SnapPoint globale → usa direttamente la posizione
                            targetPosition = originalRef.position.clone();
                            console.log(`[DragDropSystem] 📍 Custom snap target (VIRTUALE SnapPoint): "${customTarget.targetName}" - posizione=(${targetPosition.x.toFixed(3)},${targetPosition.y.toFixed(3)},${targetPosition.z.toFixed(3)})`);
                        }
                        // PRIORITÀ 2: Per _original di modelli reali, usa la posizione originale SALVATA
                        else {
                            const savedOriginalPos = this.originalPositions.get(originalRef.uuid);
                            if (savedOriginalPos) {
                                targetPosition = savedOriginalPos.clone();
                                console.log(`[DragDropSystem] 🎯 Custom snap target (original): "${customTarget.targetName}" - posizione originale salvata=(${targetPosition.x.toFixed(3)},${targetPosition.y.toFixed(3)},${targetPosition.z.toFixed(3)})`);
                            } else {
                                console.warn(`[DragDropSystem] ⚠️ Posizione originale non trovata per ${customTarget.targetName}, uso centro BB come fallback`);
                                const targetBoundingBox = new THREE.Box3().setFromObject(originalRef);
                                targetPosition = targetBoundingBox.getCenter(new THREE.Vector3());
                            }
                        }
                    }
                }
                // Target standard (cerca l'oggetto nella scena)
                else if (customTarget.targetName) {
                    positionKey = this.createSnapPositionKey(customTarget.targetName, null);
                    const targetModel = window.Scene3D ? window.Scene3D.findModelByName(customTarget.targetName) : null;
                    if (targetModel) {
                        // Usa il CENTRO del bounding box invece del pivot
                        const targetBoundingBox = new THREE.Box3().setFromObject(targetModel);
                        targetPosition = targetBoundingBox.getCenter(new THREE.Vector3());
                        console.log(`[DragDropSystem] 🎯 Custom snap target (current): "${customTarget.targetName}" - centro BB: (${targetPosition.x.toFixed(2)}, ${targetPosition.y.toFixed(2)}, ${targetPosition.z.toFixed(2)})`);
                    }
                }

                // Verifica se la posizione è già occupata da un altro oggetto
                if (positionKey && this.isSnapPositionOccupied(positionKey, object)) {
                    console.log(`[DragDropSystem] 🚫 Single target - posizione già occupata, skippo`);
                    // Non return null, lascia che provi il fallback alla posizione originale
                } else if (targetPosition) {
                    // Applica offset se specificato (solo per target con nome, non coordinate dirette)
                    if (customTarget.offset && !customTarget.isDirectPosition) {
                        targetPosition.add(customTarget.offset);
                    }

                    // ✅ NUOVO: Determina posizione in base a usePivot
                    let currentPosition;
                    if (customTarget.usePivot) {
                        currentPosition = object.position.clone(); // Usa PIVOT
                        console.log(`[DragDropSystem] 📍 findSnapTarget (single): Usando PIVOT per "${object.name}": (${currentPosition.x.toFixed(3)}, ${currentPosition.y.toFixed(3)}, ${currentPosition.z.toFixed(3)})`);
                    } else {
                        currentPosition = currentCenter; // Usa CENTRO BB (default)
                    }

                    const distance = currentPosition.distanceTo(targetPosition);
                    if (distance <= this.snapDistance) {
                        console.log(`[DragDropSystem] 🧲 Custom snap disponibile per ${object.name} (distanza ${customTarget.usePivot ? 'PIVOT' : 'centro BB'}: ${distance.toFixed(2)})`);
                        // Associa chiave posizione al Vector3 usando WeakMap (zero interferenze)
                        this.snapPositionKeys.set(targetPosition, positionKey);
                        return targetPosition;
                    }
                }
            }
        }
        
        // 2. Fallback: usa posizione originale dell'oggetto stesso
        const originalPos = this.originalPositions.get(object.uuid);
        if (originalPos) {
            // DEBUG: Calcola distanze da pivot e da centro bounding box (bounding box già calcolato sopra)

            const distanceFromPivot = currentPos.distanceTo(originalPos);
            const distanceFromCenter = currentCenter.distanceTo(originalPos);

            // Calcola offset tra pivot e centro
            const pivotToCenterOffset = currentCenter.clone().sub(currentPos);

            console.log(`[DragDropSystem] 🔍 DEBUG SNAP per ${object.name}:`);
            console.log(`  📍 Pivot corrente: (${currentPos.x.toFixed(3)}, ${currentPos.y.toFixed(3)}, ${currentPos.z.toFixed(3)})`);
            console.log(`  📦 Centro BB corrente: (${currentCenter.x.toFixed(3)}, ${currentCenter.y.toFixed(3)}, ${currentCenter.z.toFixed(3)})`);
            console.log(`  ↗️ Offset pivot→centro: (${pivotToCenterOffset.x.toFixed(3)}, ${pivotToCenterOffset.y.toFixed(3)}, ${pivotToCenterOffset.z.toFixed(3)})`);
            console.log(`  🎯 Target snap: (${originalPos.x.toFixed(3)}, ${originalPos.y.toFixed(3)}, ${originalPos.z.toFixed(3)})`);
            console.log(`  📏 Distanza pivot → target: ${distanceFromPivot.toFixed(3)}`);
            console.log(`  📏 Distanza centro BB → target: ${distanceFromCenter.toFixed(3)}`);
            console.log(`  ⚖️ Soglia snap: ${this.snapDistance.toFixed(3)}`);

            if (distanceFromCenter <= this.snapDistance) {
                console.log(`[DragDropSystem] 🧲 Standard snap disponibile per ${object.name} (distanza centro BB: ${distanceFromCenter.toFixed(2)})`);
                return originalPos;
            }
        }

        // 3. Controllo snap intercambiabili (solo se AssemblySystem abilitato)
        if (window.AssemblySystem && window.AssemblySystem.assemblyMode && window.AssemblySystem.currentConfig) {
            const objectName = object.name.toLowerCase().trim();
            console.log(`[DragDropSystem] 🔄 Verifica snap intercambiabili per "${objectName}"`);

            const interchangeableTargets = window.AssemblySystem.getInterchangeableSnapTargets(objectName);

            if (interchangeableTargets.length > 0) {
                console.log(`[DragDropSystem] 🎯 Trovati ${interchangeableTargets.length} snap targets intercambiabili`);

                // Trova il target più vicino tra quelli intercambiabili
                let closestTarget = null;
                let closestDistance = Infinity;

                interchangeableTargets.forEach((target, index) => {
                    // La posizione è già un Vector3 dalla scena
                    const targetPosition = target.position;
                    const distance = currentCenter.distanceTo(targetPosition);

                    console.log(`[DragDropSystem] 📏 Target ${index + 1}/${interchangeableTargets.length}: "${target.targetName}" - Distanza: ${distance.toFixed(3)}`);

                    if (distance <= this.snapDistance && distance < closestDistance) {
                        closestTarget = targetPosition;
                        closestDistance = distance;
                        console.log(`[DragDropSystem] ⭐ Nuovo target più vicino: "${target.targetName}" a distanza ${distance.toFixed(3)}`);
                    }
                });

                if (closestTarget) {
                    console.log(`[DragDropSystem] 🧲 Snap intercambiabile disponibile per ${object.name} (distanza centro BB: ${closestDistance.toFixed(2)})`);
                    return closestTarget;
                }
            } else {
                console.log(`[DragDropSystem] ℹ️ Nessun snap target intercambiabile trovato per "${objectName}"`);
            }
        }

        return null;
    },
    
    /**
     * Controlla le zone di snap durante il drag e fornisce feedback visivo
     */
    checkSnapZones: function() {
        if (!this.draggedObject) return;
        
        const snapTarget = this.findSnapTarget(this.draggedObject);
        const indicator = this.snapIndicators.get(this.draggedObject.uuid);
        
        if (snapTarget && indicator) {
            // Mostra feedback positivo (zona snap attiva)
            indicator.material.color.setHex(0x00ff00); // Verde
            indicator.material.opacity = 0.8;
            this.canvas.style.cursor = 'grab'; // Cursore diverso per indicare snap possibile
        } else if (indicator) {
            // Feedback neutro
            indicator.material.color.setHex(0xffffff); // Bianco
            indicator.material.opacity = 0.3;
            this.canvas.style.cursor = 'grabbing';
        }
    },
    
    /**
     * Esegue lo snap animato di un oggetto
     * @param {THREE.Object3D} object - Oggetto da snappare
     * @param {THREE.Vector3} targetPosition - Posizione target
     */
    performSnap: function(object, targetPosition, snapContext = null) {
        console.log(`[DragDropSystem] 🎯 Esecuzione snap per ${object.name}`);

        const shouldResetDragState = snapContext !== null;

        const startPosition = object.position.clone();
        const originalRotation = this.originalRotations.get(object.uuid);
        const startRotation = object.rotation.clone();

        // PRIMA: Applica la rotazione originale se necessaria
        if (originalRotation) {
            object.rotation.copy(originalRotation);
            console.log(`[DragDropSystem] 🔄 Rotazione applicata prima del calcolo posizione`);
        }

        // POI: Calcola posizioni con la rotazione già applicata
        const rotatedBoundingBox = new THREE.Box3().setFromObject(object);
        const rotatedCenter = rotatedBoundingBox.getCenter(new THREE.Vector3());
        const currentPivot = object.position.clone();

        // CALCOLA TRASLAZIONE NECESSARIA: quanto spostare l'oggetto per portare il centro alla target position
        const translation = targetPosition.clone().sub(rotatedCenter);

        // POSIZIONE TARGET CORRETTA: dove deve andare il pivot applicando la traslazione
        const correctedTargetPosition = currentPivot.clone().add(translation);

        console.log(`[DragDropSystem] 📐 Centro bounding box (dopo rotazione): (${rotatedCenter.x.toFixed(3)}, ${rotatedCenter.y.toFixed(3)}, ${rotatedCenter.z.toFixed(3)})`);
        console.log(`[DragDropSystem] 📐 Pivot oggetto attuale: (${currentPivot.x.toFixed(3)}, ${currentPivot.y.toFixed(3)}, ${currentPivot.z.toFixed(3)})`);
        console.log(`[DragDropSystem] 📐 Traslazione necessaria: (${translation.x.toFixed(3)}, ${translation.y.toFixed(3)}, ${translation.z.toFixed(3)})`);
        console.log(`[DragDropSystem] 🎯 Target posizione sfera: (${targetPosition.x.toFixed(3)}, ${targetPosition.y.toFixed(3)}, ${targetPosition.z.toFixed(3)})`);
        console.log(`[DragDropSystem] 🎯 Target posizione pivot corretta: (${correctedTargetPosition.x.toFixed(3)}, ${correctedTargetPosition.y.toFixed(3)}, ${correctedTargetPosition.z.toFixed(3)})`);

        // Animazione con TWEEN se disponibile, altrimenti animazione semplice
        if (window.TWEEN) {
            // Con TWEEN: anima solo la posizione (rotazione già applicata)
            const tween = new TWEEN.Tween({
                x: startPosition.x,
                y: startPosition.y,
                z: startPosition.z
            })
            .to({
                x: correctedTargetPosition.x,
                y: correctedTargetPosition.y,
                z: correctedTargetPosition.z
            }, this.snapAnimationDuration * 1000)
            .easing(TWEEN.Easing.Back.Out)
            .onUpdate((coords) => {
                object.position.set(coords.x, coords.y, coords.z);
            })
            .onComplete(() => {
                console.log(`[DragDropSystem] ✅ Snap completato per ${object.name}`);

                // VERIFICA FINALE: controlla se il centro del bounding box è effettivamente sulla target position
                const finalBoundingBox = new THREE.Box3().setFromObject(object);
                const finalCenter = finalBoundingBox.getCenter(new THREE.Vector3());
                const finalDistance = finalCenter.distanceTo(targetPosition);
                console.log(`[DragDropSystem] 🔍 Verifica finale - Distanza centro da target: ${finalDistance.toFixed(3)}`);

                // TRACKING OCCUPAZIONI: Delega al modulo InterchangeableTracker
                if (this.interchangeableTracker) {
                    this.interchangeableTracker.handlePositionChange(object, targetPosition);
                }

                // NUOVO: Integrazione con AssemblySystem dopo snap completato
                console.log(`[DragDropSystem] 🔍 VERIFICA INTEGRAZIONE ASSEMBLY:`);
                console.log(`  shouldResetDragState: ${shouldResetDragState}`);
                console.log(`  snapContext: ${snapContext ? 'presente' : 'assente'}`);
                console.log(`  snapContext.assemblyIntegration.enabled: ${snapContext?.assemblyIntegration?.enabled}`);

                console.log(`[DEBUG] 🔍 Controllo assemblyIntegration:`);
                console.log(`  shouldResetDragState: ${shouldResetDragState}`);
                console.log(`  snapContext existe: ${!!snapContext}`);
                if (snapContext) {
                    console.log(`  assemblyIntegration existe: ${!!snapContext.assemblyIntegration}`);
                    if (snapContext.assemblyIntegration) {
                        console.log(`  assemblyIntegration.enabled: ${snapContext.assemblyIntegration.enabled}`);
                    }
                }

                if (shouldResetDragState && snapContext && snapContext.assemblyIntegration.enabled) {
                    try {
                        console.log(`[DragDropSystem] 🏗️ CHIAMANDO markComponentMounted con:`);
                        console.log(`  componentName: "${snapContext.assemblyIntegration.componentName}"`);
                        console.log(`  snapTargetId: "${snapContext.assemblyIntegration.snapTargetId}"`);

                        assemblySystem.markComponentMounted(
                            snapContext.assemblyIntegration.componentName,
                            snapContext.assemblyIntegration.snapTargetId
                        );
                        console.log(`[DragDropSystem] 🏗️ Componente "${snapContext.assemblyIntegration.componentName}" marcato come montato nel sistema assemblaggio`);

                        // Verifica se il passo corrente è completato e avanza automaticamente
                        const assemblyStatus = assemblySystem.getAssemblyStatus();
                        console.log(`[DragDropSystem] 📋 Stato Assembly dopo mount:`);
                        console.log(`  currentStep: "${assemblyStatus.currentStep}"`);
                        console.log(`  currentStepComplete: ${assemblyStatus.currentStepComplete}`);
                        console.log(`  canAdvanceToNext: ${assemblyStatus.canAdvanceToNext}`);

                        if (assemblyStatus.currentStepComplete && assemblyStatus.canAdvanceToNext) {
                            console.log(`[DragDropSystem] 🎯 Step "${assemblyStatus.currentStep}" completato, avanzamento automatico...`);
                            const nextStep = assemblySystem.getNextStep();
                            if (nextStep) {
                                assemblySystem.setCurrentStep(nextStep);
                                console.log(`[DragDropSystem] ⏭️ Avanzato automaticamente a step: "${nextStep}"`);

                                // ⭐ AGGIORNAMENTO CRUCIALE: Sincronizza DragDropSystem con nuovo step
                                try {
                                    const newAssemblyStatus = assemblySystem.getAssemblyStatus();
                                    if (newAssemblyStatus.currentStepConfig && newAssemblyStatus.currentStepConfig.requiredComponents) {
                                        const newDraggableElements = newAssemblyStatus.currentStepConfig.requiredComponents;
                                        console.log(`[DragDropSystem] 🔄 Aggiornamento elementi draggabili per step "${nextStep}": [${newDraggableElements.join(', ')}]`);

                                        // Debug: Verifica stato prima dell'aggiornamento
                                        console.log(`[DragDropSystem] 🔍 DEBUG PRIMA sincronizzazione:`);
                                        console.log(`  Whitelist corrente: [${Array.from(this.whitelistedObjects).join(', ')}]`);
                                        console.log(`  Oggetti draggabili correnti: ${this.draggableObjects.length}`);
                                        console.log(`  AssemblySystem.assemblyMode: ${window.AssemblySystem?.assemblyMode}`);

                                        // ⭐ IMPOSTA FLAG: Durante sincronizzazione, whitelist ha priorità assoluta
                                        this.isStepSyncing = true;
                                        console.log(`[DragDropSystem] 🔄 Flag sincronizzazione attivato - whitelist prioritaria`);

                                        // Aggiorna whitelist DragDropSystem
                                        this.setDraggableObjects(newDraggableElements);

                                        // ⭐ RESET FLAG: Fine sincronizzazione
                                        this.isStepSyncing = false;
                                        console.log(`[DragDropSystem] 🔄 Flag sincronizzazione disattivato - controlli normali`);

                                        // Debug: Verifica stato dopo l'aggiornamento
                                        console.log(`[DragDropSystem] 🔍 DEBUG DOPO sincronizzazione:`);
                                        console.log(`  Nuova whitelist: [${Array.from(this.whitelistedObjects).join(', ')}]`);
                                        console.log(`  Nuovi oggetti draggabili: ${this.draggableObjects.length}`);

                                        // Mostra quali oggetti sono stati trovati/non trovati
                                        const loadedModels = window.Scene3D?.loadedModels || [];
                                        console.log(`[DragDropSystem] 🔍 Modelli caricati totali: ${loadedModels.length}`);
                                        newDraggableElements.forEach(elementName => {
                                            const found = loadedModels.find(model => {
                                                const cleanName = model.name.toLowerCase().replace(/\.(glb|gltf|obj|stl)$/, '');
                                                return cleanName === elementName.toLowerCase();
                                            });
                                            const isMountable = window.AssemblySystem ? window.AssemblySystem.isComponentMountable(elementName) : true;
                                            console.log(`[DragDropSystem] 🔍 "${elementName}": trovato=${!!found}, mountable=${isMountable}`);
                                        });

                                        // Aggiorna punti snap visibili
                                        if (typeof this.updateSnapIndicators === 'function') {
                                            this.updateSnapIndicators();
                                            console.log(`[DragDropSystem] 🎯 Indicatori snap aggiornati per nuovo step`);
                                        }

                                        console.log(`[DragDropSystem] ✨ Sistema sincronizzato con step assemblaggio: ${nextStep}`);
                                    } else {
                                        console.warn(`[DragDropSystem] ⚠️ Step "${nextStep}" non ha componenti richiesti definiti`);
                                    }
                                } catch (syncError) {
                                    console.error(`[DragDropSystem] ❌ Errore sincronizzazione con nuovo step:`, syncError);
                                }
                            } else {
                                console.log(`[DragDropSystem] ⚠️ getNextStep() ha restituito: ${nextStep}`);

                                // NUOVO: Controllo completamento assemblaggio - avanza tutorial UI
                                if (assemblyStatus.currentStepComplete && nextStep === null) {
                                    console.log(`[DragDropSystem] 🎉 STEP ASSEMBLY COMPLETATO! Step management delegato a UI - avanzando tutorial...`);

                                    // Avanza al prossimo step del tutorial UI usando diversi metodi disponibili
                                    this.tryAdvanceTutorialStep('assembly_step_completed');
                                }
                            }
                        } else {
                            console.log(`[DragDropSystem] ⏸️ Step NON pronto per avanzamento automatico`);
                        }
                    } catch (error) {
                        console.error(`[DragDropSystem] ❌ Errore integrazione AssemblySystem:`, error);
                    }
                } else {
                    console.log(`[DragDropSystem] ⏭️ Integrazione AssemblySystem SALTATA - condizioni non soddisfatte`);
                }

                // NOTA: Reset stato drag ora gestito da endDrag() - non serve duplicare qui
                console.log(`[DragDropSystem] 🎬 Animazione snap completata - stato già resettato da endDrag()`);

                // Cleanup locale solo se necessario
                if (shouldResetDragState) {
                    console.log(`[DragDropSystem] 🐭 Snap context completato con successo`);
                }

                // RESET AUTOMATICO TUTORIAL TRACKER per evitare blocco dopo snap
                if (window.Scene3D && typeof window.Scene3D.resetTutorialTracker === 'function') {
                    try {
                        console.log(`[DragDropSystem] 🔄 Reset automatico tutorial tracker dopo snap completato`);
                        window.Scene3D.resetTutorialTracker();
                    } catch (error) {
                        console.warn(`[DragDropSystem] ⚠️ Errore reset tutorial tracker:`, error);
                    }
                }

                // TRIGGER AVANZAMENTO STEP SUCCESSIVO solo se assembly completato
                if (this.shouldAdvanceAfterSnap()) {
                    this.advanceTutorialStep('post-snap');
                } else {
                    console.log(`[DragDropSystem] ⏸️ Avanzamento step posticipato - assembly non completo`);
                }

                // FALLBACK: Prova sistema legacy
                if (window.tutorialSystem && typeof window.tutorialSystem.completeCurrentStep === 'function') {
                    try {
                        console.log(`[DragDropSystem] ➡️ Fallback: Trigger avanzamento sistema legacy dopo snap`);
                        window.tutorialSystem.completeCurrentStep();
                    } catch (error) {
                        console.warn(`[DragDropSystem] ⚠️ Errore avanzamento step legacy:`, error);
                    }
                }
            })
            .start();
        } else {
            // Animazione semplice senza TWEEN (rotazione già applicata, applica solo posizione)
            object.position.copy(correctedTargetPosition);
            console.log(`[DragDropSystem] ✅ Snap immediato per ${object.name}`);

            // VERIFICA FINALE: controlla se il centro del bounding box è effettivamente sulla target position
            setTimeout(() => {
                const finalBoundingBox = new THREE.Box3().setFromObject(object);
                const finalCenter = finalBoundingBox.getCenter(new THREE.Vector3());
                const finalDistance = finalCenter.distanceTo(targetPosition);
                console.log(`[DragDropSystem] 🔍 Verifica finale - Centro finale: (${finalCenter.x.toFixed(3)}, ${finalCenter.y.toFixed(3)}, ${finalCenter.z.toFixed(3)})`);
                console.log(`[DragDropSystem] 🔍 Verifica finale - Distanza centro da target: ${finalDistance.toFixed(3)}`);

                // NUOVO: Integrazione con AssemblySystem dopo snap immediato
                if (shouldResetDragState && snapContext && snapContext.assemblyIntegration.enabled) {
                    try {
                        assemblySystem.markComponentMounted(
                            snapContext.assemblyIntegration.componentName,
                            snapContext.assemblyIntegration.snapTargetId
                        );
                        console.log(`[DragDropSystem] 🏗️ Componente "${snapContext.assemblyIntegration.componentName}" marcato come montato nel sistema assemblaggio (immediato)`);

                        // Verifica se il passo corrente è completato e avanza automaticamente
                        const assemblyStatus = assemblySystem.getAssemblyStatus();
                        console.log(`[DEBUG] 🔍 AssemblyStatus dopo mounting:`, assemblyStatus);
                        console.log(`[DEBUG] 🔍 currentStepComplete: ${assemblyStatus.currentStepComplete}`);
                        console.log(`[DEBUG] 🔍 canAdvanceToNext: ${assemblyStatus.canAdvanceToNext}`);
                        console.log(`[DEBUG] 🔍 mountedComponents: [${assemblyStatus.mountedComponents.join(', ')}]`);

                        // DISABILITATO TEMPORANEAMENTE: Auto-avanzamento prematuro
                        console.log(`[DragDropSystem] ⏸️ Auto-avanzamento DISABILITATO per debug`);
                        if (false && assemblyStatus.currentStepComplete && assemblyStatus.canAdvanceToNext) {
                            console.log(`[DragDropSystem] 🎯 Step "${assemblyStatus.currentStep}" completato, avanzamento automatico... (immediato)`);
                            const nextStep = window.AssemblySystem.getNextStep();
                            if (nextStep) {
                                window.AssemblySystem.setCurrentStep(nextStep);
                                console.log(`[DragDropSystem] ⏭️ Avanzato automaticamente a step: "${nextStep}" (immediato)`);

                                // ⭐ AGGIORNAMENTO CRUCIALE: Sincronizza DragDropSystem con nuovo step (immediato)
                                try {
                                    const newAssemblyStatus = window.AssemblySystem.getAssemblyStatus();
                                    if (newAssemblyStatus.currentStepConfig && newAssemblyStatus.currentStepConfig.requiredComponents) {
                                        const newDraggableElements = newAssemblyStatus.currentStepConfig.requiredComponents;
                                        console.log(`[DragDropSystem] 🔄 Aggiornamento elementi draggabili per step "${nextStep}" (immediato): [${newDraggableElements.join(', ')}]`);

                                        // Debug: Verifica stato prima dell'aggiornamento (immediato)
                                        console.log(`[DragDropSystem] 🔍 DEBUG PRIMA sincronizzazione (immediato):`);
                                        console.log(`  Whitelist corrente: [${Array.from(this.whitelistedObjects).join(', ')}]`);
                                        console.log(`  Oggetti draggabili correnti: ${this.draggableObjects.length}`);

                                        // ⭐ IMPOSTA FLAG: Durante sincronizzazione immediata, whitelist ha priorità assoluta
                                        this.isStepSyncing = true;
                                        console.log(`[DragDropSystem] 🔄 Flag sincronizzazione immediata attivato - whitelist prioritaria`);

                                        // Aggiorna whitelist DragDropSystem
                                        this.setDraggableObjects(newDraggableElements);

                                        // ⭐ RESET FLAG: Fine sincronizzazione immediata
                                        this.isStepSyncing = false;
                                        console.log(`[DragDropSystem] 🔄 Flag sincronizzazione immediata disattivato - controlli normali`);

                                        // Debug: Verifica stato dopo l'aggiornamento (immediato)
                                        console.log(`[DragDropSystem] 🔍 DEBUG DOPO sincronizzazione (immediato):`);
                                        console.log(`  Nuova whitelist: [${Array.from(this.whitelistedObjects).join(', ')}]`);
                                        console.log(`  Nuovi oggetti draggabili: ${this.draggableObjects.length}`);

                                        // Aggiorna punti snap visibili
                                        if (typeof this.updateSnapIndicators === 'function') {
                                            this.updateSnapIndicators();
                                            console.log(`[DragDropSystem] 🎯 Indicatori snap aggiornati per nuovo step (immediato)`);
                                        }

                                        console.log(`[DragDropSystem] ✨ Sistema sincronizzato con step assemblaggio: ${nextStep} (immediato)`);
                                    } else {
                                        console.warn(`[DragDropSystem] ⚠️ Step "${nextStep}" non ha componenti richiesti definiti (immediato)`);
                                    }
                                } catch (syncError) {
                                    console.error(`[DragDropSystem] ❌ Errore sincronizzazione con nuovo step (immediato):`, syncError);
                                }
                            }
                        }
                    } catch (error) {
                        console.error(`[DragDropSystem] ❌ Errore integrazione AssemblySystem (immediato):`, error);
                    }
                }

                // NOTA: Reset stato drag ora gestito da endDrag() - non serve duplicare qui
                console.log(`[DragDropSystem] ⚡ Snap immediato completato - stato già resettato da endDrag()`);

                // Snap context completato
                if (shouldResetDragState) {
                    console.log(`[DragDropSystem] 🐭 Snap immediato context completato con successo`);
                }

                // RESET AUTOMATICO TUTORIAL TRACKER per evitare blocco dopo snap (versione semplice)
                if (window.Scene3D && typeof window.Scene3D.resetTutorialTracker === 'function') {
                    try {
                        console.log(`[DragDropSystem] 🔄 Reset automatico tutorial tracker dopo snap immediato`);
                        window.Scene3D.resetTutorialTracker();
                    } catch (error) {
                        console.warn(`[DragDropSystem] ⚠️ Errore reset tutorial tracker:`, error);
                    }
                }

                // TRIGGER AVANZAMENTO STEP SUCCESSIVO solo se assembly completato (immediato)
                if (this.shouldAdvanceAfterSnap()) {
                    this.advanceTutorialStep('post-immediate-snap');
                } else {
                    console.log(`[DragDropSystem] ⏸️ Avanzamento step posticipato - assembly non completo (immediato)`);
                }

                // FALLBACK: Prova sistema legacy (versione immediata)
                if (window.tutorialSystem && typeof window.tutorialSystem.completeCurrentStep === 'function') {
                    try {
                        console.log(`[DragDropSystem] ➡️ Fallback: Trigger avanzamento sistema legacy dopo snap immediato`);
                        window.tutorialSystem.completeCurrentStep();
                    } catch (error) {
                        console.warn(`[DragDropSystem] ⚠️ Errore avanzamento step legacy (immediato):`, error);
                    }
                }
            }, 100);
        }
    },
    
    /* ===== VISUAL FEEDBACK ===== */
    
    /**
     * Mostra indicatori snap per tutti gli oggetti tranne quello draggato
     * @param {THREE.Object3D} draggedObject - Oggetto attualmente draggato
     */
    showSnapIndicators: function(draggedObject) {
        this.snapIndicators.forEach((indicator, uuid) => {
            if (uuid === draggedObject.uuid) {
                // Mostra l'indicatore della posizione originale dell'oggetto trascinato
                indicator.visible = true;
                indicator.material.opacity = 0.8;
                indicator.material.color.set(0x00ff00); // Verde per la posizione originale

                console.log(`[DragDropSystem] 🎯 Mostro indicatore snap per: ${draggedObject.name}`);
            } else {
                // Nasconde indicatori di altri oggetti per chiarezza
                indicator.visible = false;
            }
        });
    },
    
    /**
     * Nasconde tutti gli indicatori snap
     */
    hideAllSnapIndicators: function() {
        this.snapIndicators.forEach(indicator => {
            indicator.visible = false;
        });
    },
    
    /* ===== UTILITY FUNCTIONS ===== */
    
    /**
     * Trova il modello root partendo da un oggetto figlio (stesso logic del sistema esistente)
     * @param {THREE.Object3D} clickedObject - Oggetto cliccato
     * @returns {THREE.Object3D|null} - Modello root
     */
    findRootModel: function(clickedObject) {
        // Usa la stessa logica del sistema esistente
        if (window.Scene3D && window.Scene3D.findRootModel) {
            return window.Scene3D.findRootModel(clickedObject);
        }
        
        // Fallback: cerca manualmente
        for (const model of this.draggableObjects) {
            if (this.isDescendantOf(clickedObject, model)) {
                return model;
            }
        }
        return null;
    },
    
    /**
     * Verifica se un oggetto è discendente di un altro
     * @param {THREE.Object3D} child - Oggetto figlio
     * @param {THREE.Object3D} parent - Oggetto genitore
     * @returns {boolean}
     */
    isDescendantOf: function(child, parent) {
        if (child === parent) return true;
        
        let current = child.parent;
        while (current) {
            if (current === parent) return true;
            current = current.parent;
        }
        return false;
    },

    /**
     * Verifica se dovremmo avanzare lo step dopo uno snap
     * Controlla se l'AssemblySystem considera lo step corrente completo
     * @returns {boolean}
     */
    shouldAdvanceAfterSnap: function() {
        // Se non è in modalità assemblaggio, avanza sempre
        if (!window.AssemblySystem || !window.AssemblySystem.enabled) {
            console.log(`[DragDropSystem] 🔄 Non in modalità assembly - avanzamento consentito`);
            return true;
        }

        // Verifica se il current step assembly è completo
        try {
            const isStepComplete = window.AssemblySystem.isCurrentStepComplete();
            console.log(`[DragDropSystem] 🔍 Assembly step completo: ${isStepComplete}`);

            if (window.AssemblySystem.currentStepName) {
                console.log(`[DragDropSystem] 📝 Step corrente: ${window.AssemblySystem.currentStepName}`);
            }

            return isStepComplete;
        } catch (error) {
            console.warn(`[DragDropSystem] ⚠️ Errore verifica completamento assembly:`, error);
            // In caso di errore, non bloccare l'avanzamento
            return true;
        }
    },

    /**
     * Avanza il tutorial step con retry intelligente per risolvere timing issues
     * @param {string} context - Contesto della chiamata per debug
     */
    advanceTutorialStep: function(context = 'unknown') {
        this.tryAdvanceTutorialStep(context, 0);
    },

    /**
     * Tentativo di avanzamento tutorial con retry
     * @param {string} context - Contesto della chiamata
     * @param {number} attempt - Numero tentativo corrente
     */
    tryAdvanceTutorialStep: function(context, attempt) {
        const maxRetries = this.tutorialAdvanceRetries;
        const retryDelay = this.tutorialAdvanceRetryDelay;

        console.log(`[DragDropSystem] 🎯 Tentativo ${attempt + 1}/${maxRetries + 1} avanzamento step (${context})`);

        // MULTI-PATH APPROACH: Cerca TutorialManager in diversi modi + Approccio legacy
        let tutorialManager = null;
        let accessPath = '';
        let useDirectMethod = false;

        // Percorso 1: window.UI.tutorialManager (nuovo getter)
        if (window.UI && window.UI.tutorialManager && typeof window.UI.tutorialManager.nextStep === 'function') {
            tutorialManager = window.UI.tutorialManager;
            accessPath = 'window.UI.tutorialManager';
        }
        // Percorso 2: window.UI._tutorialManager (accesso diretto)
        else if (window.UI && window.UI._tutorialManager && typeof window.UI._tutorialManager.nextStep === 'function') {
            tutorialManager = window.UI._tutorialManager;
            accessPath = 'window.UI._tutorialManager';
        }
        // Percorso 3: Istanza globale diretta
        else if (window.TutorialManager && window.TutorialManagerInstance && typeof window.TutorialManagerInstance.nextStep === 'function') {
            tutorialManager = window.TutorialManagerInstance;
            accessPath = 'window.TutorialManagerInstance';
        }
        // Percorso 4: Legacy UI system con nextStep method
        else if (window.UI && typeof window.UI.nextStep === 'function') {
            useDirectMethod = true;
            accessPath = 'window.UI.nextStep (legacy)';
        }
        // Percorso 5: Legacy UI system con goToStep method
        else if (window.UI && typeof window.UI.goToStep === 'function' && typeof window.UI.currentStepIndex === 'number') {
            useDirectMethod = true;
            accessPath = 'window.UI.goToStep (legacy)';
        }

        // Verifica completa disponibilità TutorialManager o metodi legacy
        if ((tutorialManager && !tutorialManager._isTransitioning) || useDirectMethod) {

            try {
                console.log(`[DragDropSystem] ➡️ Avanzamento step (${context})`);
                console.log(`[DragDropSystem] 🎯 Percorso accesso: ${accessPath}`);
                console.log(`[DragDropSystem] 🔍 Step corrente prima avanzamento: ${window.UI?.currentStepIndex || 'N/A'}`);
                console.log(`[DragDropSystem] 🔍 Tutorial attivo: ${window.UI?.currentTutorial?.name || 'nessuno'}`);

                // CONTROLLO STEP FINALE: Se siamo all'ultimo step, mostra congratulazioni invece di avanzare
                const currentIndex = window.UI?.currentStepIndex || 0;
                const totalSteps = window.UI?.tutorialSteps?.length || 0;

                if (totalSteps > 0 && currentIndex === totalSteps - 1) {
                    console.log(`[DragDropSystem] 🎉 STEP FINALE COMPLETATO! Mostrando congratulazioni invece di avanzare (${currentIndex + 1}/${totalSteps})`);

                    // Usa Scene3D per mostrare congratulazioni se disponibile
                    if (window.Scene3D && typeof window.Scene3D.showTutorialCompletionCongratulations === 'function') {
                        // Blocca interazioni
                        if (window.Scene3D.tutorialTracker) {
                            window.Scene3D.tutorialTracker.interactionsBlocked = true;
                            console.log('[DragDropSystem] 🔒 INTERAZIONI BLOCCATE: Tutorial completato');
                        }

                        setTimeout(() => {
                            window.Scene3D.showTutorialCompletionCongratulations();
                            console.log(`[DragDropSystem] ✅ Congratulazioni mostrate (${context})`);
                        }, 500);
                    } else {
                        console.warn(`[DragDropSystem] ⚠️ Scene3D.showTutorialCompletionCongratulations non disponibile`);
                    }
                    return; // Successo, esci senza avanzare
                }

                console.log(`[DragDropSystem] 📊 Step intermedio (${currentIndex + 1}/${totalSteps}) - procedo con avanzamento normale`);

                if (useDirectMethod) {
                    // Usa metodi diretti legacy
                    if (typeof window.UI.nextStep === 'function') {
                        window.UI.nextStep();
                    } else if (typeof window.UI.goToStep === 'function') {
                        const nextStepIndex = (window.UI.currentStepIndex || 0) + 1;
                        window.UI.goToStep(nextStepIndex);
                    }
                } else {
                    // Usa TutorialManager refactorizzato
                    tutorialManager.nextStep();
                }

                console.log(`[DragDropSystem] ✅ Avanzamento step completato (${context}) via ${accessPath}`);
                console.log(`[DragDropSystem] 🔍 Step corrente dopo avanzamento: ${window.UI?.currentStepIndex || 'N/A'}`);
                return; // Successo, esci
            } catch (error) {
                console.warn(`[DragDropSystem] ⚠️ Errore avanzamento step (${context}) via ${accessPath}:`, error);
            }
        } else {
            // Debug dettagliato per capire cosa manca
            console.log(`[DragDropSystem] ⚠️ TutorialManager non disponibile per avanzamento step (${context})`);
            console.log(`[DragDropSystem] 🔍 Multi-path Debug:`);
            console.log(`  - window.UI: ${window.UI ? 'presente' : 'assente'}`);
            if (window.UI) {
                console.log(`  - window.UI.tutorialManager: ${window.UI.tutorialManager ? 'presente' : 'assente'}`);
                console.log(`  - window.UI._tutorialManager: ${window.UI._tutorialManager ? 'presente' : 'assente'}`);
                console.log(`  - window.UI.nextStep (legacy): ${typeof window.UI.nextStep}`);
                console.log(`  - window.UI.goToStep (legacy): ${typeof window.UI.goToStep}`);
                console.log(`  - window.UI.currentStepIndex: ${window.UI.currentStepIndex}`);
                if (window.UI.tutorialManager) {
                    console.log(`  - nextStep method: ${typeof window.UI.tutorialManager.nextStep}`);
                    console.log(`  - _isTransitioning: ${window.UI.tutorialManager._isTransitioning}`);
                }
                if (window.UI._tutorialManager) {
                    console.log(`  - _tutorialManager.nextStep: ${typeof window.UI._tutorialManager.nextStep}`);
                    console.log(`  - _tutorialManager._isTransitioning: ${window.UI._tutorialManager._isTransitioning}`);
                }
            }
            console.log(`  - window.TutorialManagerInstance: ${window.TutorialManagerInstance ? 'presente' : 'assente'}`);
        }

        // Retry se non abbiamo raggiunto il limite
        if (attempt < maxRetries) {
            console.log(`[DragDropSystem] ⏳ Retry ${attempt + 1} tra ${retryDelay}ms (${context})`);

            // FIX: Cancella eventuale retry precedente e salva ID per cancellazione futura
            if (this.advanceRetryTimeoutId) {
                clearTimeout(this.advanceRetryTimeoutId);
            }
            this.advanceRetryTimeoutId = setTimeout(() => {
                this.advanceRetryTimeoutId = null;
                this.tryAdvanceTutorialStep(context, attempt + 1);
            }, retryDelay);
        } else {
            console.log(`[DragDropSystem] ❌ Raggiunto limite retry per avanzamento step (${context})`);

            // FALLBACK: Prova sistema legacy come ultima risorsa
            if (window.tutorialSystem && typeof window.tutorialSystem.completeCurrentStep === 'function') {
                try {
                    console.log(`[DragDropSystem] ➡️ Fallback: Trigger avanzamento sistema legacy (${context})`);
                    window.tutorialSystem.completeCurrentStep();
                    console.log(`[DragDropSystem] ✅ Fallback legacy completato (${context})`);
                } catch (error) {
                    console.warn(`[DragDropSystem] ⚠️ Errore avanzamento step legacy (${context}):`, error);
                }
            } else {
                console.log(`[DragDropSystem] ❌ Nessun sistema tutorial disponibile dopo tutti i retry (${context})`);
            }
        }
    },

    /**
     * Ottiene stato abilitazione
     * @returns {boolean}
     */
    isEnabled: function() {
        return this.enabled;
    },

    /**
     * Aggiunge un oggetto alla blacklist (non draggabile)
     * @param {string} objectName - Nome dell'oggetto da blacklistare
     */
    addToBlacklist: function(objectName) {
        const cleanName = objectName.toLowerCase().replace(/\.(glb|gltf|obj|stl)$/, '');
        this.blacklistedObjects.add(cleanName);
        console.log(`[DragDropSystem] 🚫 Aggiunto "${cleanName}" alla blacklist`);
    },

    /**
     * Rimuove un oggetto dalla blacklist
     * @param {string} objectName - Nome dell'oggetto da rimuovere dalla blacklist
     */
    removeFromBlacklist: function(objectName) {
        const cleanName = objectName.toLowerCase().replace(/\.(glb|gltf|obj|stl)$/, '');
        this.blacklistedObjects.delete(cleanName);
        console.log(`[DragDropSystem] ✅ Rimosso "${cleanName}" dalla blacklist`);
    },

    /**
     * Ottiene la lista degli oggetti in blacklist
     * @returns {Array<string>}
     */
    getBlacklistedObjects: function() {
        return Array.from(this.blacklistedObjects);
    },
    
    /**
     * Ottiene stato dragging
     * @returns {boolean}
     */
    isDraggingActive: function() {
        return this.isDragging;
    },

    /**
     * Verifica se l'utensile corretto è attivo per il drag & drop
     * @returns {boolean}
     */
    isCorrectToolActive: function() {
        // Verifica se ToolsManager è disponibile
        if (!window.ToolsManager) {
            console.log(`[DragDropSystem] ⚠️ ToolsManager non disponibile - drag permesso (fallback)`);
            return true; // Fallback: permetti drag se ToolsManager non è disponibile
        }

        // Ottieni utensile attualmente attivo
        if (!window.ToolsManager || typeof window.ToolsManager.getActiveTool !== 'function') {
            console.log(`[DragDropSystem] ⚠️ ToolsManager non disponibile o getActiveTool non è una funzione - drag permesso (fallback)`);
            return true; // Fallback: permetti drag se ToolsManager non è disponibile
        }

        const activeTool = window.ToolsManager.getActiveTool();
        const isHandActive = (activeTool === 'mano' || activeTool === 'Mani');

        console.log(`[DragDropSystem] 🔧 Controllo utensile: attivo="${activeTool}", richiesto="mano", permesso=${isHandActive}`);

        return isHandActive;
    },

    /**
     * Mostra messaggio che richiede selezione utensile "Mano"
     */
    showToolRequiredMessage: function() {
        // Aggiorna status nell'interfaccia utente se disponibile
        if (window.UI && window.UI.core && window.UI.core.updateStatus) {
            window.UI.core.updateStatus('⚠️ Seleziona l\'utensile "Mano" per trascinare gli oggetti');
        } else {
            console.warn(`[DragDropSystem] 💡 SELEZIONA UTENSILE "MANO" per trascinare gli oggetti`);
        }

        // Evidenzia brevemente l'utensile Mano nell'interfaccia
        if (window.ToolsManager && typeof window.ToolsManager.highlightRequiredTool === 'function') {
            window.ToolsManager.highlightRequiredTool('mano');
        }
    },

    /**
     * Crea una chiave univoca per una posizione di snap
     * @param {string} targetName - Nome del target (es. "estrattoresx_original")
     * @param {THREE.Vector3} position - Coordinate posizione (per SnapPoint)
     * @returns {string} Chiave univoca
     */
    createSnapPositionKey: function(targetName, position) {
        if (targetName) {
            // Per SnapTargets: usa il nome del target
            return `target_${targetName}`;
        } else if (position) {
            // Per SnapPoints: usa coordinate arrotondate
            const x = position.x.toFixed(3);
            const y = position.y.toFixed(3);
            const z = position.z.toFixed(3);
            return `coord_${x}_${y}_${z}`;
        }
        return null;
    },

    /**
     * Occupa una posizione di snap per un oggetto
     * @param {string} positionKey - Chiave univoca posizione
     * @param {THREE.Object3D} object - Oggetto che occupa la posizione
     */
    occupySnapPosition: function(positionKey, object) {
        if (!positionKey) return;

        // Libera posizione precedente se l'oggetto ne occupava già una
        const previousKey = this.objectSnapPosition.get(object.uuid);
        if (previousKey) {
            this.occupiedSnapPositions.delete(previousKey);
            console.log(`[DragDropSystem] 🔓 Posizione "${previousKey}" liberata da "${object.name}"`);
        }

        // Occupa nuova posizione
        this.occupiedSnapPositions.set(positionKey, object.name);
        this.objectSnapPosition.set(object.uuid, positionKey);
        console.log(`[DragDropSystem] 🔒 Posizione "${positionKey}" occupata da "${object.name}"`);
    },

    /**
     * Libera la posizione di snap occupata da un oggetto
     * @param {THREE.Object3D} object - Oggetto che libera la posizione
     */
    releaseSnapPosition: function(object) {
        const positionKey = this.objectSnapPosition.get(object.uuid);
        if (positionKey) {
            this.occupiedSnapPositions.delete(positionKey);
            this.objectSnapPosition.delete(object.uuid);
            console.log(`[DragDropSystem] 🔓 Posizione "${positionKey}" liberata da "${object.name}"`);
        }
    },

    /**
     * Verifica se una posizione di snap è già occupata
     * @param {string} positionKey - Chiave univoca posizione
     * @param {THREE.Object3D} currentObject - Oggetto che sta verificando (escluso dal check)
     * @returns {boolean} True se occupata da un altro oggetto
     */
    isSnapPositionOccupied: function(positionKey, currentObject) {
        if (!positionKey) return false;

        const occupyingObjectName = this.occupiedSnapPositions.get(positionKey);
        if (!occupyingObjectName) {
            return false; // Posizione libera
        }

        // Se occupata dallo stesso oggetto che sta controllando, considerala libera
        if (occupyingObjectName === currentObject.name) {
            return false;
        }

        console.log(`[DragDropSystem] 🚫 Posizione "${positionKey}" già occupata da "${occupyingObjectName}"`);
        return true;
    },

    /**
     * Resetta tutte le posizioni occupate (chiamato quando si cambia step)
     */
    resetOccupiedPositions: function() {
        const count = this.occupiedSnapPositions.size;
        this.occupiedSnapPositions.clear();
        this.objectSnapPosition.clear();
        if (count > 0) {
            console.log(`[DragDropSystem] 🔄 Reset: ${count} posizioni snap liberate`);
        }
    },

    /**
     * Imposta distanza di snap
     * @param {number} distance - Nuova distanza di snap
     */
    setSnapDistance: function(distance) {
        const oldDistance = this.snapDistance;
        // Rimozione clamping minimo per permettere distanze precise come 0.01
        this.snapDistance = Math.max(0.001, distance); // Minimo tecnico ridotto a 0.001
        console.log(`[DragDropSystem] 🔧 setSnapDistance chiamato:`);
        console.log(`  📥 Valore richiesto: ${distance}`);
        console.log(`  📤 Valore applicato: ${this.snapDistance} (minimo tecnico: 0.001)`);
        console.log(`  🔄 Cambio: ${oldDistance} → ${this.snapDistance}`);

        // Ricrea indicatori con nuova distanza se abilitato E se showSnapIndicators è true
        if (this.enabled && this.showSnapIndicators) {
            this.createSnapIndicators();
        }
    },

    /**
     * Configura oggetti richiesti per auto-avanzamento step
     * @param {Array<string>} objectNames - Array di nomi oggetti che devono fare snap
     */
    setRequiredSnapObjects: function(objectNames) {
        this.requiredSnapObjects.clear();
        objectNames.forEach(name => {
            const cleanName = name.replace(/^models\//, '').replace(/\.(glb|obj|stl)$/, '');
            this.requiredSnapObjects.add(cleanName);
        });
        console.log(`[DragDropSystem] 🎯 Oggetti richiesti per completamento: [${Array.from(this.requiredSnapObjects).join(', ')}]`);
    },

    /**
     * Abilita auto-avanzamento quando tutti gli oggetti richiesti hanno fatto snap
     */
    enableAutoAdvance: function() {
        this.autoAdvanceEnabled = true;
        console.log(`[DragDropSystem] ⏭️ Auto-avanzamento step abilitato`);
    },

    /**
     * Disabilita auto-avanzamento step
     */
    disableAutoAdvance: function() {
        this.autoAdvanceEnabled = false;
        console.log(`[DragDropSystem] ⏸️ Auto-avanzamento step disabilitato`);
    },

    /**
     * Resetta tracking snap completati (chiamato quando si cambia step)
     */
    resetSnapTracking: function() {
        this.completedSnapObjects.clear();
        this.requiredSnapObjects.clear();
        this.autoAdvanceEnabled = false;
        console.log(`[DragDropSystem] 🔄 Tracking snap resettato`);
    },

    /**
     * Ottiene lista oggetti draggabili
     * @returns {Array} - Array di oggetti 3D draggabili
     */
    getDraggableObjects: function() {
        return [...this.draggableObjects];
    },
    
    /**
     * Imposta target di snap personalizzato per un oggetto
     * @param {string} objectName - Nome dell'oggetto da configurare
     * @param {string} targetName - Nome del target (può includere _original)
     * @param {THREE.Vector3} offset - Offset opzionale dalla posizione target
     */
    setCustomSnapTarget: function(objectName, targetName, offset = null) {
        if (!window.Scene3D) {
            console.warn('[DragDropSystem] Scene3D non disponibile per configurare snap personalizzati');
            return;
        }
        
        const object = window.Scene3D.findModelByName(objectName);
        if (!object) {
            console.warn(`[DragDropSystem] Oggetto "${objectName}" non trovato per snap personalizzato`);
            return;
        }
        
        const isOriginalRef = targetName.endsWith('_original');
        this.customSnapTargets.set(object.uuid, {
            targetName: targetName,
            isOriginalRef: isOriginalRef,
            offset: offset ? offset.clone() : null
        });
        
        console.log(`[DragDropSystem] 🎯 Snap personalizzato per "${objectName}" -> "${targetName}"${isOriginalRef ? ' (original)' : ''}${offset ? ' con offset' : ''}`);
    },
    
    /**
     * Imposta snap a coordinate arbitrarie (x,y,z) nello spazio
     * @param {string} objectName - Nome dell'oggetto
     * @param {number} x - Coordinata X
     * @param {number} y - Coordinata Y
     * @param {number} z - Coordinata Z
     */
    setCustomSnapPosition: function(objectName, x, y, z) {
        if (!window.Scene3D) {
            console.warn('[DragDropSystem] Scene3D non disponibile per configurare snap personalizzati');
            return;
        }

        const object = window.Scene3D.findModelByName(objectName);
        if (!object) {
            console.warn(`[DragDropSystem] Oggetto "${objectName}" non trovato per snap personalizzato`);
            return;
        }

        this.customSnapTargets.set(object.uuid, {
            directPosition: new THREE.Vector3(x, y, z),
            isDirectPosition: true
        });

        console.log(`[DragDropSystem] 🎯 Snap a coordinate dirette per "${objectName}" -> (${x}, ${y}, ${z})`);
    },

    /**
     * Imposta snap a coordinate arbitrarie (x,y,z) usando il PIVOT dell'oggetto
     * invece del centro del bounding box. Utile per oggetti con pivot non centrato.
     * @param {string} objectName - Nome dell'oggetto
     * @param {number} x - Coordinata X
     * @param {number} y - Coordinata Y
     * @param {number} z - Coordinata Z
     */
    setCustomSnapPositionPivot: function(objectName, x, y, z) {
        if (!window.Scene3D) {
            console.warn('[DragDropSystem] Scene3D non disponibile per configurare snap personalizzati');
            return;
        }

        const object = window.Scene3D.findModelByName(objectName);
        if (!object) {
            console.warn(`[DragDropSystem] 🔴🔴🔴 Oggetto "${objectName}" NON TROVATO per snap personalizzato (pivot)`);
            return;
        }

        const config = {
            directPosition: new THREE.Vector3(x, y, z),
            isDirectPosition: true,
            usePivot: true  // FLAG: usa pivot invece del centro BB
        };

        this.customSnapTargets.set(object.uuid, config);

        console.log(`[DragDropSystem] 📍✅✅✅ Snap PIVOT configurato per "${objectName}" (UUID: ${object.uuid.substr(0,8)}...) -> (${x}, ${y}, ${z})`);
        console.log(`[DragDropSystem] 📍 Config salvato:`, config);
        console.log(`[DragDropSystem] 📍 Totale customSnapTargets: ${this.customSnapTargets.size}`);
    },

    /**
     * Imposta target di snap multipli intercambiabili per un oggetto
     * @param {string} objectName - Nome dell'oggetto
     * @param {Array<string>} targetNames - Array di nomi target (possono includere "_original")
     */
    setMultipleSnapTargets: function(objectName, targetNames) {
        if (!window.Scene3D) {
            console.warn('[DragDropSystem] Scene3D non disponibile per configurare snap multipli');
            return;
        }

        const object = window.Scene3D.findModelByName(objectName);
        if (!object) {
            console.warn(`[DragDropSystem] Oggetto "${objectName}" non trovato per snap multipli`);
            return;
        }

        // Converti array di nomi in array di configurazioni target
        const targets = targetNames.map(targetName => {
            const isOriginalRef = targetName.endsWith('_original');
            return {
                targetName: targetName,
                isOriginalRef: isOriginalRef,
                offset: null
            };
        });

        this.customSnapTargets.set(object.uuid, {
            isMultiTarget: true,
            targets: targets
        });

        console.log(`[DragDropSystem] 🎯 Snap multipli per "${objectName}" -> [${targetNames.join(', ')}]`);
    },

    /**
     * Rimuove target di snap personalizzato per un oggetto
     * @param {string} objectName - Nome dell'oggetto
     */
    removeCustomSnapTarget: function(objectName) {
        if (!window.Scene3D) return;

        const object = window.Scene3D.findModelByName(objectName);
        if (object) {
            this.customSnapTargets.delete(object.uuid);
            console.log(`[DragDropSystem] Rimosso snap personalizzato per "${objectName}"`);
        }
    },
    
    /**
     * Ottiene tutti i target di snap personalizzati
     * @returns {Map} - Mappa degli snap personalizzati
     */
    getCustomSnapTargets: function() {
        return new Map(this.customSnapTargets);
    },

    /**
     * Debug completo stato sistema snap
     */
    debugSnapSystem: function() {
        console.log(`[DragDropSystem] 🔍 DEBUG SISTEMA SNAP COMPLETO:`);
        console.log(`  ✅ Abilitato: ${this.enabled}`);
        console.log(`  📏 Snap Distance: ${this.snapDistance}`);
        console.log(`  🎯 Oggetti draggabili: ${this.draggableObjects.length}`);
        console.log(`  📦 Posizioni originali salvate: ${this.originalPositions.size}`);
        console.log(`  🔄 Rotazioni originali salvate: ${this.originalRotations.size}`);
        console.log(`  🎯 Snap personalizzati attivi: ${this.customSnapTargets.size}`);

        if (this.draggableObjects.length > 0) {
            const obj = this.draggableObjects[0];
            const snapTarget = this.findSnapTarget(obj);
            console.log(`  🧪 Test snap su "${obj.name}": ${snapTarget ? '✅ SNAP DISPONIBILE' : '❌ NESSUNO SNAP'}`);
        }

        return {
            enabled: this.enabled,
            snapDistance: this.snapDistance,
            draggableObjectsCount: this.draggableObjects.length,
            originalPositionsCount: this.originalPositions.size,
            customSnapTargetsCount: this.customSnapTargets.size
        };
    },
    
    /**
     * Reset complete del sistema
     */
    reset: function() {
        console.log('[DragDropSystem] Reset completo del sistema...');
        
        this.disable();
        
        // Pulisce tutte le mappe
        this.originalPositions.clear();
        this.originalRotations.clear();
        this.snapIndicators.clear();
        this.whitelistedObjects.clear();
        this.customSnapTargets.clear();
        
        // Reset drag plane
        if (this.dragPlane) {
            this.scene.remove(this.dragPlane);
            this.dragPlane = null;
        }
        
        console.log('[DragDropSystem] ✅ Reset completato');
    },
    
    /**
     * Cleanup per distruzione
     */
    dispose: function() {
        console.log('[DragDropSystem] Dispose del sistema...');
        
        this.reset();
        
        // Dispose materiali
        this.snapZoneMaterial?.dispose();
        this.snapIndicatorMaterial?.dispose();
        this.highlightMaterial?.dispose();
        
        // Clear riferimenti
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.raycaster = null;
        this.mouse = null;
        this.canvas = null;
        
        console.log('[DragDropSystem] ✅ Dispose completato');
    },

    /**
     * Comando debug completo per console
     */
    debugFullStatus: function() {
        console.log('🔍 [DragDropSystem] === DEBUG STATUS COMPLETO ===');
        console.log(`✅ Sistema abilitato: ${this.enabled}`);
        console.log(`🎯 In drag: ${this.isDragging}`);
        console.log(`📦 Oggetto corrente: ${this.draggedObject?.name || 'none'}`);
        console.log(`📏 Snap distance: ${this.snapDistance}`);
        console.log(`🎨 Canvas trovato: ${!!this.canvas}`);
        console.log(`📐 Scene trovata: ${!!this.scene}`);
        console.log(`📷 Camera trovata: ${!!this.camera}`);

        console.log(`🔧 Oggetti draggabili rilevati: ${this.draggableObjects.length}`);
        this.draggableObjects.forEach((obj, i) => {
            console.log(`  ${i + 1}. ${obj.name} (UUID: ${obj.uuid.substring(0, 8)}...)`);
        });

        console.log(`💾 Posizioni originali salvate: ${this.originalPositions.size}`);
        const originalEntries = Array.from(this.originalPositions.entries());
        originalEntries.forEach(([uuid, pos], i) => {
            const obj = this.scene?.children.find(child => child.uuid === uuid);
            console.log(`  ${i + 1}. ${obj?.name || 'UNKNOWN'}: (${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)})`);
        });

        console.log(`🎯 Custom snap targets: ${this.customSnapTargets.size}`);
        const customEntries = Array.from(this.customSnapTargets.entries());
        customEntries.forEach(([uuid, target], i) => {
            const obj = this.scene?.children.find(child => child.uuid === uuid);
            console.log(`  ${i + 1}. ${obj?.name || 'UNKNOWN'} → ${target.targetName} (offset: ${target.offset ? 'yes' : 'no'})`);
        });

        console.log(`🖱️ Mouse state:`, this.mouseState);
        console.log(`🧠 Sistema integrazione:`, {
            'Scene3D': !!window.Scene3D,
            'AssemblySystem': !!window.AssemblySystem,
            'UI.toolsManager': !!(window.UI && window.UI.toolsManager)
        });

        console.log('🔍 [DragDropSystem] === FINE DEBUG STATUS ===');
        return this.getStats();
    },

    /* ===== ASSEMBLY MODE API EXTENSIONS ===== */
    
    /**
     * Abilita modalità assemblaggio con configurazione
     * @param {Object} assemblyConfig - Configurazione assemblaggio
     */
    enableAssemblyMode: function(assemblyConfig) {
        if (!window.AssemblySystem) {
            console.error('[DragDropSystem] AssemblySystem non disponibile per modalità assemblaggio');
            return false;
        }
        
        console.log('[DragDropSystem] 🔧 Delegate to AssemblySystem.enableAssemblyMode()');
        return window.AssemblySystem.enableAssemblyMode(assemblyConfig);
    },
    
    /**
     * Disabilita modalità assemblaggio
     */
    disableAssemblyMode: function() {
        if (!window.AssemblySystem) {
            console.warn('[DragDropSystem] AssemblySystem non disponibile');
            return;
        }
        
        console.log('[DragDropSystem] 🔴 Delegate to AssemblySystem.disableAssemblyMode()');
        window.AssemblySystem.disableAssemblyMode();
    },
    
    /**
     * Imposta step assemblaggio corrente
     * @param {number} stepIndex - Indice step assemblaggio
     */
    setCurrentAssemblyStep: function(stepIndex) {
        if (!window.AssemblySystem) {
            console.warn('[DragDropSystem] AssemblySystem non disponibile');
            return false;
        }
        
        return window.AssemblySystem.setCurrentAssemblyStep(stepIndex);
    },
    
    /**
     * Ottiene stato assemblaggio
     * @returns {Object} - Stato assemblaggio corrente
     */
    getAssemblyStatus: function() {
        if (!window.AssemblySystem) {
            return { enabled: false, assemblyMode: false };
        }
        
        return window.AssemblySystem.getAssemblyStatus();
    },
    
    /**
     * Valida sequenza assemblaggio
     * @returns {Object} - Risultato validazione con errori
     */
    validateAssemblySequence: function() {
        if (!window.AssemblySystem) {
            return { valid: false, errors: ['AssemblySystem non disponibile'] };
        }
        
        return window.AssemblySystem.validateAssemblySequence();
    },
    
    /**
     * Ottiene punti di snap disponibili per componente
     * @param {string} componentName - Nome componente
     * @returns {Array} - Array punti di snap disponibili
     */
    getAvailableSnapPoints: function(componentName) {
        if (!window.AssemblySystem) {
            return [];
        }
        
        return window.AssemblySystem.getAvailableSnapPoints(componentName);
    },
    
    /**
     * Verifica se componente è montabile
     * @param {string} componentName - Nome componente da verificare
     * @returns {boolean} - true se montabile
     */
    isComponentMountable: function(componentName) {
        if (!window.AssemblySystem) {
            return true; // Se AssemblySystem non disponibile, permette montaggio normale
        }

        return window.AssemblySystem.isComponentMountable(componentName);
    },

    /**
     * Debug: Mostra tutte le posizioni originali salvate
     */
    debugOriginalPositions: function() {
        console.log(`[DragDropSystem] 🔍 POSIZIONI ORIGINALI SALVATE (${this.originalPositions.size} oggetti):`);
        this.originalPositions.forEach((position, uuid) => {
            const object = this.draggableObjects.find(obj => obj.uuid === uuid);
            const objectName = object ? object.name : 'SCONOSCIUTO';
            console.log(`  📍 "${objectName}" (${uuid.substring(0,8)}...): (${position.x.toFixed(3)}, ${position.y.toFixed(3)}, ${position.z.toFixed(3)})`);
        });
    },

    // ===== DELEGATION TO INTERCHANGEABLE TRACKER =====
    // Le seguenti funzioni delegano al modulo InterchangeableTracker per compatibilità API

    /**
     * Debug: Mostra tutte le posizioni intercambiabili occupate
     * @deprecated - Usa InterchangeableTracker.debugOccupiedPositions() direttamente
     */
    debugOccupiedPositions: function() {
        if (this.interchangeableTracker) {
            this.interchangeableTracker.debugOccupiedPositions();
        } else {
            console.warn('[DragDropSystem] ⚠️ InterchangeableTracker non disponibile');
        }
    },
    
    /**
     * Verifica se è in modalità assemblaggio
     * @returns {boolean} - true se in modalità assemblaggio
     */
    isAssemblyMode: function() {
        if (!window.AssemblySystem) {
            return false;
        }
        
        const status = window.AssemblySystem.getAssemblyStatus();
        return status.enabled && status.assemblyMode;
    },
    
    /**
     * Undo ultimo montaggio assemblaggio
     * @returns {boolean} - true se undo eseguito con successo
     */
    undoAssembly: function() {
        if (!window.AssemblySystem) {
            console.warn('[DragDropSystem] AssemblySystem non disponibile per undo');
            return false;
        }
        
        return window.AssemblySystem.undo();
    },
    
    /**
     * Redo ultimo montaggio annullato
     * @returns {boolean} - true se redo eseguito con successo
     */
    redoAssembly: function() {
        if (!window.AssemblySystem) {
            console.warn('[DragDropSystem] AssemblySystem non disponibile per redo');
            return false;
        }
        
        return window.AssemblySystem.redo();
    },

    /**
     * Funzione utility per pulire i nomi dei modelli (rimuove estensioni e percorsi)
     * @param {string} modelName - Nome del modello da pulire
     * @returns {string} - Nome pulito senza estensioni e percorsi
     */
    getCleanModelName: function(modelName) {
        if (!modelName) return '';

        // Rimuovi percorso se presente
        let cleanName = modelName.includes('/') ? modelName.split('/').pop() : modelName;
        cleanName = cleanName.includes('\\') ? cleanName.split('\\').pop() : cleanName;

        // Rimuovi estensione se presente (.glb, .obj, .stl, ecc.)
        if (cleanName.includes('.')) {
            cleanName = cleanName.substring(0, cleanName.lastIndexOf('.'));
        }

        return cleanName;
    },

    /**
     * Debug: Mostra tutte le posizioni originali salvate
     */
    debugOriginalPositions: function() {
        console.log(`[DragDropSystem] 🔍 DEBUG POSIZIONI ORIGINALI (${this.originalPositions.size} oggetti):`);

        this.originalPositions.forEach((position, uuid) => {
            // Trova l'oggetto corrispondente
            const obj = this.scene.getObjectByProperty('uuid', uuid);
            const name = obj ? obj.name : 'SCONOSCIUTO';

            console.log(`📍 ${name} (${uuid.substring(0,8)}...):
                Centro Bounding Box = (${position.x.toFixed(3)}, ${position.y.toFixed(3)}, ${position.z.toFixed(3)})`);
        });

        if (this.originalPositions.size === 0) {
            console.warn('⚠️ Nessuna posizione originale salvata!');
        }

        return this.originalPositions;
    },

    /**
     * Test funzione per verificare il fix del TutorialManager timing
     * @param {string} testContext - Contesto del test
     */
    testTutorialAdvancement: function(testContext = 'manual-test') {
        console.log(`[DragDropSystem] 🧪 TEST: Verifico avanzamento tutorial (${testContext})`);
        console.log(`[DragDropSystem] 🧪 Estado sistemas antes del test:`);
        console.log(`  - DragDropSystem enabled: ${this.enabled}`);
        console.log(`  - window.UI: ${window.UI ? 'presente' : 'assente'}`);
        console.log(`  - window.UI.tutorialManager: ${window.UI?.tutorialManager ? 'presente' : 'assente'}`);
        console.log(`  - TutorialManager.nextStep: ${typeof window.UI?.tutorialManager?.nextStep}`);
        console.log(`  - currentStepIndex: ${window.UI?.currentStepIndex}`);
        console.log(`  - currentTutorial: ${window.UI?.currentTutorial?.name || 'nessuno'}`);

        // Simula avanzamento step
        this.advanceTutorialStep(testContext);
    },

    /**
     * Forza sincronizzazione con AssemblySystem (EMERGENCY)
     */
    forceSyncWithAssembly: function() {
        console.log('\n[DragDropSystem] 🚨 FORZA SINCRONIZZAZIONE CON ASSEMBLY SYSTEM');

        if (!window.AssemblySystem) {
            console.log('❌ AssemblySystem non disponibile');
            return false;
        }

        const allowedComponents = Array.from(window.AssemblySystem.allowedComponents || []);
        if (allowedComponents.length === 0) {
            console.log('❌ AssemblySystem.allowedComponents è vuoto');
            return false;
        }

        console.log(`🔄 Sincronizzazione con componenti: [${allowedComponents.join(', ')}]`);
        this.enable(allowedComponents);
        console.log('✅ Sincronizzazione forzata completata');
        return true;
    },

    /**
     * Debug rapido sistema drag
     */
    debugDragSystem: function() {
        console.log('\n[DragDropSystem] 🔬 DEBUG RAPIDO SISTEMA DRAG');
        console.log('==========================================');
        console.log(`DragDropSystem abilitato: ${this.enabled}`);
        console.log(`AssemblySystem presente: ${!!window.AssemblySystem}`);
        console.log(`AssemblySystem abilitato: ${window.AssemblySystem?.enabled}`);
        console.log(`AssemblySystem modalità: ${window.AssemblySystem?.assemblyMode}`);
        console.log(`Whitelist size: ${this.whitelistedObjects.size}`);
        console.log(`Whitelist: [${Array.from(this.whitelistedObjects).join(', ')}]`);
        console.log(`Blacklist: [${Array.from(this.blacklistedObjects).join(', ')}]`);

        // Test oggetti comuni
        const testObjects = ['tappino_grasso_dx', 'filtro', 'coperchio', 'vite_coperchio_1'];
        testObjects.forEach(name => {
            const result = this.isDraggableObject({name: name});
            console.log(`Test "${name}": ${result ? '✅ draggabile' : '❌ non draggabile'}`);
        });
        console.log('==========================================\n');
    },

    /**
     * Diagnostica completa del sistema UI e TutorialManager
     */
    diagnoseTutorialSystem: function() {
        console.log('\n[DragDropSystem] 🔬 DIAGNOSI COMPLETA SISTEMA TUTORIAL');
        console.log('==========================================');

        // 1. Verifica window.UI
        console.log('\n1️⃣ VERIFICA WINDOW.UI:');
        console.log(`   - window.UI esiste: ${!!window.UI}`);
        if (window.UI) {
            console.log(`   - Tipo: ${typeof window.UI}`);
            console.log(`   - Constructor: ${window.UI.constructor.name}`);
            console.log(`   - Proprietà principali:`);
            console.log(`     * core: ${!!window.UI.core}`);
            console.log(`     * _tutorialManager: ${!!window.UI._tutorialManager}`);
            console.log(`     * tutorialManager (getter): ${!!window.UI.tutorialManager}`);

            // Test proprietà getter
            try {
                const tm = window.UI.tutorialManager;
                console.log(`     * getter funziona: ${!!tm}`);
                if (tm) {
                    console.log(`     * getter tipo: ${typeof tm}`);
                    console.log(`     * nextStep method: ${typeof tm.nextStep}`);
                }
            } catch (error) {
                console.log(`     * getter error: ${error.message}`);
            }
        }

        // 2. Verifica window.TutorialManager
        console.log('\n2️⃣ VERIFICA WINDOW.TUTORIALMANAGER:');
        console.log(`   - window.TutorialManager esiste: ${!!window.TutorialManager}`);
        if (window.TutorialManager) {
            console.log(`   - Tipo: ${typeof window.TutorialManager}`);
            console.log(`   - È funzione constructor: ${typeof window.TutorialManager === 'function'}`);

            // Test istanziazione
            try {
                const testInstance = new window.TutorialManager();
                console.log(`   - Istanziazione test: SUCCESS`);
                console.log(`   - Test instance tipo: ${typeof testInstance}`);
                console.log(`   - Ha nextStep: ${typeof testInstance.nextStep}`);
                console.log(`   - Ha init: ${typeof testInstance.init}`);
            } catch (error) {
                console.log(`   - Istanziazione test: FAILED - ${error.message}`);
            }
        }

        // 3. Verifica inizializzazione UI
        console.log('\n3️⃣ VERIFICA INIZIALIZZAZIONE UI:');
        if (window.UI) {
            const systemInfo = window.UI.getSystemInfo ? window.UI.getSystemInfo() : null;
            if (systemInfo) {
                console.log(`   - Core: ${systemInfo.core}`);
                console.log(`   - ScenarioManager: ${systemInfo.scenarioManager}`);
                console.log(`   - TutorialManager: ${systemInfo.tutorialManager}`);
                console.log(`   - ToolsManager: ${systemInfo.toolsManager}`);
            } else {
                console.log(`   - getSystemInfo non disponibile`);
            }
        }

        // 4. Verifica ordine caricamento
        console.log('\n4️⃣ ORDINE CARICAMENTO MODULI:');
        const modules = ['UICore', 'ScenarioManager', 'TutorialManager', 'ToolsManager'];
        modules.forEach(module => {
            console.log(`   - window.${module}: ${!!window[module]}`);
        });

        console.log('\n==========================================');
        console.log('[DragDropSystem] 🔬 FINE DIAGNOSI\n');
    },

    /**
     * AUTO-SNAP per AutoMode: Snappa automaticamente oggetto al target più vicino
     * @param {string} objectName - Nome dell'oggetto da snappare
     */
    autoSnapToClosestTarget: function(objectName) {
        console.log(`[DragDropSystem] 🤖 AutoSnap richiesto per: "${objectName}"`);

        // Trova il modello
        const cleanName = objectName.replace(/\.(glb|gltf|obj|stl)$/i, '');
        const model = window.Scene3D ? window.Scene3D.findModelByName(cleanName) : null;

        if (!model) {
            console.warn(`[DragDropSystem] ⚠️ Modello "${objectName}" non trovato per auto-snap`);
            return false;
        }

        // Verifica che l'oggetto sia draggabile
        if (!this.enabledObjects.has(model.name)) {
            console.warn(`[DragDropSystem] ⚠️ Oggetto "${model.name}" non è abilitato per drag & drop`);
            return false;
        }

        // Trova target snap più vicino
        const snapSystem = window.SnapSystem || this;
        if (!snapSystem || !snapSystem.findSnapTarget) {
            console.error('[DragDropSystem] ⚠️ SnapSystem non disponibile');
            return false;
        }

        // Calcola posizione corrente centro bounding box
        model.updateMatrixWorld(true);
        const boundingBox = new THREE.Box3().setFromObject(model);
        const currentCenter = boundingBox.getCenter(new THREE.Vector3());

        // Trova target snap
        const snapTarget = snapSystem.findSnapTarget(model, currentCenter);

        if (!snapTarget) {
            console.warn(`[DragDropSystem] ⚠️ Nessun target snap trovato per "${model.name}"`);
            return false;
        }

        console.log(`[DragDropSystem] 🎯 Target snap trovato per "${model.name}"`);
        console.log(`   Posizione target: (${snapTarget.x.toFixed(3)}, ${snapTarget.y.toFixed(3)}, ${snapTarget.z.toFixed(3)})`);

        // Simula snap automatico
        this.performAutoSnap(model, snapTarget, currentCenter);

        return true;
    },

    /**
     * Esegue lo snap automatico (senza interazione utente)
     * @param {THREE.Object3D} model - Modello da snappare
     * @param {THREE.Vector3} targetPosition - Posizione target
     * @param {THREE.Vector3} currentCenter - Centro BB corrente
     */
    performAutoSnap: function(model, targetPosition, currentCenter) {
        // Calcola offset tra pivot e centro BB
        const pivotToCenterOffset = new THREE.Vector3().subVectors(currentCenter, model.position);

        // Nuova posizione pivot = target - offset
        const newPivotPosition = new THREE.Vector3().subVectors(targetPosition, pivotToCenterOffset);

        // Anima movimento verso target
        const startPosition = model.position.clone();
        const startTime = performance.now();
        const duration = 500; // 0.5 secondi

        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing smooth
            const easeProgress = progress < 0.5
                ? 2 * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;

            // Interpolazione posizione
            model.position.lerpVectors(startPosition, newPivotPosition, easeProgress);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Snap completato
                model.position.copy(newPivotPosition);
                console.log(`[DragDropSystem] ✅ Auto-snap completato per "${model.name}"`);

                // Notifica completamento snap (trigger per auto-advance)
                this.handleSnapComplete(model.name);
            }
        };

        animate();
    },

    /**
     * Gestisce completamento snap (chiamato dopo auto-snap)
     * @param {string|THREE.Object3D} objectNameOrModel - Nome oggetto o modello Three.js snappato
     */
    handleSnapComplete: function(objectNameOrModel) {
        // Estrai il nome: se è un oggetto Three.js usa .name, altrimenti usa la stringa
        const objectName = typeof objectNameOrModel === 'string'
            ? objectNameOrModel
            : (objectNameOrModel?.name || 'unknown');

        // Pulisci il nome per il tracking (rimuovi estensioni e suffissi)
        const cleanName = this.getCleanModelName(objectName);

        console.log(`[DragDropSystem] 📢 Snap completato per: "${cleanName}" (originale: "${objectName}")`);

        // IMPORTANTE: Rimuovi highlight dopo snap (sia per drag manuale che AutoMode)
        // Trova il modello per rimuovere l'highlight
        const model = window.Scene3D ? window.Scene3D.findModelByName(objectName) : null;
        if (model && this.originalMaterialsMap && this.originalMaterialsMap.has(model.uuid)) {
            const originalMaterials = this.originalMaterialsMap.get(model.uuid);
            model.traverse((child) => {
                if (child.isMesh && originalMaterials.has(child.uuid)) {
                    child.material = originalMaterials.get(child.uuid);
                    child.renderOrder = 0;
                }
            });
            console.log(`[DragDropSystem] 🧹 Highlight rimosso da "${cleanName}" dopo snap`);
        }

        // Se in modalità auto-avanzamento, traccia oggetto completato
        if (this.autoAdvanceEnabled && this.requiredSnapObjects.size > 0) {
            this.completedSnapObjects.add(cleanName);

            const progress = `${this.completedSnapObjects.size}/${this.requiredSnapObjects.size}`;
            console.log(`[DragDropSystem] 📊 Progress: ${progress} oggetti snappati`);

            // Controlla se tutti richiesti sono snappati
            const allSnapped = Array.from(this.requiredSnapObjects).every(req =>
                this.completedSnapObjects.has(req)
            );

            if (allSnapped) {
                console.log('[DragDropSystem] 🎉 TUTTI GLI OGGETTI RICHIESTI SONO STATI SNAPPATI!');
                console.log('[DragDropSystem] ⏭️ Auto-avanzamento allo step successivo...');

                // Trigger avanzamento step
                setTimeout(() => this.tryAdvanceTutorialStep('all_snaps_completed'), 500);
            }
        }

        // NOTA: cleanup non necessario, endDrag() già gestisce tutto il cleanup
    }
};
// Funzioni globali di debug
