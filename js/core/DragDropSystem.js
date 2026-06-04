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
        
        // Salva posizioni originali di TUTTI i modelli caricati (non solo i draggable)
        // così i riferimenti _original (es. estrattoresx_original) funzionano correttamente
        // anche quando l'oggetto referenziato non è nella whitelist draggable
        const allModels = window.Scene3D?.loadedModels || [];
        if (this.originalPositions.size === 0) {
            console.log('[DragDropSystem] ⚠️ Posizioni originali non trovate, salvataggio di backup per tutti i modelli');
            const prevDraggable = this.draggableObjects;
            this.draggableObjects = allModels;
            this.storeOriginalPositions();
            this.draggableObjects = prevDraggable;
        } else {
            // Aggiungi eventuali modelli mancanti (caricati dopo il primo salvataggio)
            allModels.forEach(obj => {
                if (!this.originalPositions.has(obj.uuid)) {
                    const boundingBox = new THREE.Box3().setFromObject(obj);
                    const center = boundingBox.getCenter(new THREE.Vector3());
                    this.originalPositions.set(obj.uuid, center.clone());
                    console.log(`[DragDropSystem] 📍 Aggiunta posizione originale mancante: ${obj.name}`);
                }
            });
            console.log(`[DragDropSystem] ✅ Posizioni originali verificate (${this.originalPositions.size} oggetti)`);
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
     * Rimuove tutti gli indicatori snap (delega a SnapSystem se disponibile)
     */
    removeAllSnapIndicators: function() {
        this.snapIndicators.forEach(indicator => {
            this.scene.remove(indicator);
            indicator.geometry?.dispose();
            indicator.material?.dispose();
        });
        this.snapIndicators.clear();
        this.snapSystem?.removeAllSnapIndicators();
    },

    /**
     * Aggiorna gli indicatori snap per l'oggetto trascinato (delega a SnapSystem)
     */
    updateSnapIndicators: function() {
        if (this.snapSystem) {
            this.snapSystem.updateSnapIndicators(this.draggedObject);
            return;
        }
        // Fallback se SnapSystem non disponibile
        if (!this.showSnapIndicators || !this.draggedObject) return;
        this.removeAllSnapIndicators();
        const originalPos = this.originalPositions.get(this.draggedObject.uuid);
        if (originalPos) {
            this.createSingleSnapIndicator(this.draggedObject.uuid, originalPos, 0x00ff00,
                `Original_${this.draggedObject.name.toLowerCase().trim()}`);
        }
    },

    /**
     * Crea un singolo indicatore snap (delega a SnapSystem se disponibile)
     * @param {string} id - ID univoco per l'indicatore
     * @param {THREE.Vector3} position - Posizione dell'indicatore
     * @param {number} color - Colore esadecimale
     * @param {string} name - Nome dell'indicatore
     */
    createSingleSnapIndicator: function(id, position, color, name) {
        if (this.snapSystem) {
            this.snapSystem.createSingleSnapIndicator(id, position, color, name);
            return;
        }
        // Fallback se SnapSystem non disponibile
        const sphereGeometry = new THREE.SphereGeometry(0.05, 12, 8);
        const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 });
        const sphere = new THREE.Mesh(sphereGeometry, material);
        sphere.position.copy(position);
        sphere.name = `SnapIndicator_${name}`;
        sphere.visible = true;
        this.snapIndicators.set(id, sphere);
        this.scene.add(sphere);
        console.log(`[DragDropSystem] 🎯 Indicatore "${name}" creato alla posizione (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
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
     * Controlla le zone di snap durante il drag (delega a SnapSystem)
     */
    checkSnapZones: function() {
        if (!this.draggedObject) return;
        if (this.snapSystem) {
            this.snapSystem.checkSnapZones(this.draggedObject);
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

                // Flag per evitare doppio avanzamento step
                // (assembly completion + shouldAdvanceAfterSnap possono entrambi triggerare nextStep)
                let alreadyAdvancedFromSnap = false;

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
                                    alreadyAdvancedFromSnap = true;
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
                // IMPORTANTE: Skip se già avanzato dalla assembly completion (evita doppio avanzamento = step saltato)
                if (alreadyAdvancedFromSnap) {
                    console.log(`[DragDropSystem] ⏭️ Skip post-snap advance - già avanzato da assembly completion`);
                } else if (this.shouldAdvanceAfterSnap()) {
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
     * Nasconde tutti gli indicatori snap (delega a SnapSystem se disponibile)
     */
    hideAllSnapIndicators: function() {
        this.snapIndicators.forEach(indicator => { indicator.visible = false; });
        this.snapSystem?.hideSnapIndicators();
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
     * Imposta lo snap su un ScreenSnap (frame monitor). Quando l'oggetto entra
     * nella distanza di snap del frame, SnapSystem allinea posizione/rotazione
     * e applica un fit "contain" basato su mesh.userData.aspect.
     *
     * @param {string} objectName     - nome del mesh PngScreen in scena
     * @param {string} screenSnapId   - id del blocco [ScreenSnap:id]
     */
    setScreenSnapTarget: function(objectName, screenSnapId) {
        if (!window.Scene3D) {
            console.warn('[DragDropSystem] Scene3D non disponibile per configurare ScreenSnap');
            return;
        }
        const object = window.Scene3D.findModelByName(objectName);
        if (!object) {
            console.warn(`[DragDropSystem] Oggetto "${objectName}" non trovato per ScreenSnap`);
            return;
        }
        if (!window.ScreenSnapRegistry || !window.ScreenSnapRegistry.get(screenSnapId)) {
            console.warn(`[DragDropSystem] ScreenSnap "${screenSnapId}" non registrato`);
            return;
        }
        this.customSnapTargets.set(object.uuid, {
            isScreenSnap: true,
            screenSnapId: screenSnapId
        });
        console.log(`[DragDropSystem] 📺 Snap schermo per "${objectName}" → "${screenSnapId}"`);
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
     * Restituisce il sistema di assemblaggio attivo (preferisce AssemblySystemSimplified).
     * @returns {Object|null}
     */
    _getAssemblySystem: function() {
        return window.AssemblySystemSimplified || window.AssemblySystem || null;
    },

    /**
     * Abilita modalità assemblaggio con configurazione
     * @param {Object} assemblyConfig - Configurazione assemblaggio
     */
    enableAssemblyMode: function(assemblyConfig) {
        const system = this._getAssemblySystem();
        if (!system) {
            console.error('[DragDropSystem] AssemblySystem non disponibile per modalità assemblaggio');
            return false;
        }
        console.log('[DragDropSystem] 🔧 Delegate to AssemblySystem.enableAssemblyMode()');
        return system.enableAssemblyMode(assemblyConfig);
    },

    /**
     * Disabilita modalità assemblaggio
     */
    disableAssemblyMode: function() {
        const system = this._getAssemblySystem();
        if (!system) return;
        console.log('[DragDropSystem] 🔴 Delegate to AssemblySystem.disableAssemblyMode()');
        system.disableAssemblyMode();
    },

    /**
     * Imposta step assemblaggio corrente
     * @param {number} stepIndex - Indice step assemblaggio
     */
    setCurrentAssemblyStep: function(stepIndex) {
        const system = this._getAssemblySystem();
        if (!system) return false;
        return system.setCurrentAssemblyStep ? system.setCurrentAssemblyStep(stepIndex) : false;
    },

    /**
     * Ottiene stato assemblaggio
     * @returns {Object} - Stato assemblaggio corrente
     */
    getAssemblyStatus: function() {
        const system = this._getAssemblySystem();
        if (!system) return { enabled: false, assemblyMode: false };
        return system.getAssemblyStatus();
    },

    /**
     * Valida sequenza assemblaggio
     * @returns {Object} - Risultato validazione con errori
     */
    validateAssemblySequence: function() {
        const system = this._getAssemblySystem();
        if (!system) return { valid: false, errors: ['AssemblySystem non disponibile'] };
        return system.validateAssemblySequence ? system.validateAssemblySequence()
            : { valid: true, errors: [] };
    },

    /**
     * Ottiene punti di snap disponibili per componente
     * @param {string} componentName - Nome componente
     * @returns {Array} - Array punti di snap disponibili
     */
    getAvailableSnapPoints: function(componentName) {
        const system = this._getAssemblySystem();
        if (!system) return [];
        return system.getAvailableSnapPoints ? system.getAvailableSnapPoints(componentName) : [];
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

        // Verifica che l'oggetto sia draggabile (controlla nell'array draggableObjects)
        const isDraggable = this.draggableObjects.some(obj => obj === model || obj.name === model.name);
        if (!isDraggable) {
            console.warn(`[DragDropSystem] ⚠️ Oggetto "${model.name}" non è abilitato per drag & drop`);
            return false;
        }

        // Calcola posizione corrente centro bounding box
        model.updateMatrixWorld(true);
        const boundingBox = new THREE.Box3().setFromObject(model);
        const currentCenter = boundingBox.getCenter(new THREE.Vector3());

        // AUTOSNAP: Trova target snap SENZA limitazione di distanza
        // (a differenza di findSnapTarget che richiede vicinanza)
        let snapTarget = null;

        const customTarget = this.customSnapTargets.get(model.uuid);
        if (customTarget) {
            if (customTarget.isMultiTarget && customTarget.targets) {
                // Multi-target: trova il più vicino non occupato
                let closestDistance = Infinity;
                customTarget.targets.forEach(target => {
                    const positionKey = this.createSnapPositionKey(target.targetName, null);
                    if (this.isSnapPositionOccupied(positionKey, model)) return;

                    const targetPosition = this._resolveTargetPosition(target);
                    if (targetPosition) {
                        const distance = currentCenter.distanceTo(targetPosition);
                        if (distance < closestDistance) {
                            closestDistance = distance;
                            snapTarget = targetPosition;
                        }
                    }
                });
            } else if (customTarget.isDirectPosition && customTarget.directPosition) {
                snapTarget = customTarget.directPosition.clone();
            } else if (customTarget.targetName) {
                snapTarget = this._resolveTargetPosition(customTarget);
            }
        }

        // Fallback: posizione originale dell'oggetto
        if (!snapTarget) {
            const savedOriginalPos = this.originalPositions.get(model.uuid);
            if (savedOriginalPos) {
                snapTarget = savedOriginalPos.clone();
                console.log(`[DragDropSystem] 🤖 AutoSnap: Usando posizione originale come target`);
            }
        }

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
     * Risolve la posizione di un target snap (helper per autoSnap)
     * @param {Object} target - Configurazione target {targetName, isOriginalRef, ...}
     * @returns {THREE.Vector3|null} - Posizione risolta o null
     */
    _resolveTargetPosition: function(target) {
        if (!target || !target.targetName) return null;

        // Riferimenti _original
        if (target.isOriginalRef && window.Scene3D) {
            const actualModelName = target.targetName.replace(/_original$/, '');
            const originalRef = window.Scene3D.findModelByName(actualModelName);
            if (originalRef) {
                if (originalRef.isOriginalReference && originalRef.position && !originalRef.geometry) {
                    return originalRef.position.clone();
                }
                const savedPos = this.originalPositions.get(originalRef.uuid);
                if (savedPos) return savedPos.clone();
                const bb = new THREE.Box3().setFromObject(originalRef);
                return bb.getCenter(new THREE.Vector3());
            }
            // Controlla anche i virtualSnapTargets
            if (window.Scene3D.virtualSnapTargets) {
                const virtualTarget = window.Scene3D.virtualSnapTargets.get(target.targetName);
                if (virtualTarget && virtualTarget.position) {
                    return virtualTarget.position.clone();
                }
            }
        }
        // Target standard
        else if (window.Scene3D) {
            const targetModel = window.Scene3D.findModelByName(target.targetName);
            if (targetModel) {
                const bb = new THREE.Box3().setFromObject(targetModel);
                return bb.getCenter(new THREE.Vector3());
            }
        }
        return null;
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

        // FALLBACK: DragDrop semplice senza assembly né autoAdvance
        // Se nessuno dei sistemi sopra ha gestito l'avanzamento, avanza direttamente dopo snap
        if (!this.autoAdvanceEnabled || this.requiredSnapObjects.size === 0) {
            const assemblySystem = window.AssemblySystemSimplified || window.AssemblySystem;
            if (!assemblySystem || !assemblySystem.assemblyMode) {
                if (this.shouldAdvanceAfterSnap()) {
                    console.log(`[DragDropSystem] ⏭️ DragDrop semplice: snap completato, avanzamento step...`);
                    setTimeout(() => {
                        this.tryAdvanceTutorialStep('simple_dragdrop_snap');
                    }, 500);
                }
            }
        }

        // NOTA: cleanup non necessario, endDrag() già gestisce tutto il cleanup
    }
};
// Funzioni globali di debug
