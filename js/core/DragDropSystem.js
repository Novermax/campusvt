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
 * Versione: 1.0
 * Data: Settembre 2025
 */

window.DragDropSystem = {
    // Stato sistema
    enabled: false,
    isDragging: false,
    
    // Oggetti e configurazioni
    draggableObjects: [],
    originalPositions: new Map(),
    originalRotations: new Map(),
    whitelistedObjects: new Set(),
    
    // Sistema snap personalizzati con riferimenti _original
    customSnapTargets: new Map(), // objectUuid -> { targetName: string, isOriginalRef: bool, offset: Vector3 }
    
    // Drag state
    draggedObject: null,
    dragOffset: null, // Inizializzato in init()
    dragPlane: null,
    dragStartPosition: null, // Inizializzato in init()
    
    // Snap system
    snapDistance: 1.0,
    snapIndicators: new Map(),
    snapAnimationDuration: 0.8,
    
    // Visual feedback
    snapZoneMaterial: null,
    snapIndicatorMaterial: null,
    highlightMaterial: null,
    
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
        
        console.log('[DragDropSystem] Event listeners configurati (disabilitati)');
    },
    
    /**
     * Abilita il sistema drag & drop
     * @param {Array} objectNames - Lista nomi oggetti draggabili (opzionale)
     */
    enable: function(objectNames = null) {
        if (this.enabled) {
            console.log('[DragDropSystem] Sistema già abilitato');
            return;
        }
        
        console.log('[DragDropSystem] ⚡ Abilitazione sistema drag & drop...');
        
        // Aggiunge event listeners
        this.canvas.addEventListener('mousedown', this.boundMouseDown, { passive: false });
        this.canvas.addEventListener('mousemove', this.boundMouseMove, { passive: false });
        this.canvas.addEventListener('mouseup', this.boundMouseUp, { passive: false });
        
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
        
        // Rimuove event listeners
        this.canvas.removeEventListener('mousedown', this.boundMouseDown);
        this.canvas.removeEventListener('mousemove', this.boundMouseMove);  
        this.canvas.removeEventListener('mouseup', this.boundMouseUp);
        
        // Termina qualsiasi drag in corso
        if (this.isDragging) {
            this.endDrag();
        }
        
        // Rimuove indicatori snap
        this.removeAllSnapIndicators();
        
        // Reset stato
        this.enabled = false;
        this.draggableObjects = [];
        this.whitelistedObjects.clear();
        
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

        // Controlla prima se AssemblySystem è attivo e valida il componente
        if (window.AssemblySystem && window.AssemblySystem.assemblyMode) {
            const isMountable = window.AssemblySystem.isComponentMountable(cleanName);
            if (!isMountable) {
                console.log(`[DragDropSystem] ❌ Componente "${cleanName}" non montabile (AssemblySystem)`);
                return false;
            }
        }

        // Se c'è una whitelist, usa quella
        if (this.whitelistedObjects.size > 0) {
            return this.whitelistedObjects.has(cleanName);
        }

        // Altrimenti escludi oggetti non selezionabili (come pavimenti, assi, etc.)
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
            
            if (targetModel && this.isDraggableObject(targetModel)) {
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
        if (!this.enabled) return;
        
        const hadMoved = this.mouseState.hasMoved;
        
        // Reset stato mouse
        this.mouseState.isDown = false;
        this.mouseState.hasMoved = false;
        
        if (this.isDragging) {
            this.endDrag();
            event.preventDefault();
            return; // Non eseguire click se stavamo draggando
        }
        
        // Se il mouse non si è mosso, potrebbe essere un click normale
        // Lascia che il sistema esistente gestisca il click
        if (!hadMoved && event.button === 0) {
            console.log('[DragDropSystem] Click rilevato, passando al sistema esistente...');
            // Non preventDefault() per permettere al sistema click esistente di funzionare
        }
    },
    
    /* ===== DRAG LOGIC ===== */
    
    /**
     * Inizia il drag di un oggetto
     * @param {THREE.Object3D} object - Oggetto da trascinare
     * @param {THREE.Vector3} intersectionPoint - Punto di intersezione iniziale
     */
    startDrag: function(object, intersectionPoint) {
        console.log(`[DragDropSystem] 🎯 Inizio drag di: ${object.name}`);

        this.isDragging = true;
        this.draggedObject = object;

        // Memorizza posizione iniziale del drag
        this.dragStartPosition.copy(object.position);

        // Calcola offset tra centro oggetto e punto cliccato
        this.dragOffset.copy(intersectionPoint).sub(object.position);

        // NUOVO: Rimuovi highlight durante drag per mostrare colore originale
        if (window.Scene3D && typeof window.Scene3D.removeHighlight === 'function') {
            window.Scene3D.removeHighlight();
            // Blocca future applicazioni automatiche di highlight per questo oggetto
            this.silhouetteBlocked.add(object.name);
            console.log(`[DragDropSystem] 🎨 Rimosso highlight da ${object.name} durante drag - bloccata riapplicazione`);
        }

        // NUOVO: Crea piano di drag perpendicolare alla camera, passando per il punto cliccato
        this.updateDragPlaneToCamera(intersectionPoint);

        // Mostra indicatori snap per tutti gli oggetti tranne quello draggato
        // DISABILITATO: Non mostriamo più indicatori snap (sfere verdi)
        // this.showSnapIndicators(object);

        // Cambia cursore
        this.canvas.style.cursor = 'grabbing';

        // Disabilita sistema click esistente durante drag
        if (window.Scene3D && window.Scene3D.animationSystem) {
            window.Scene3D.animationSystem.clickEnabled = false;
        }

        // NUOVO: Disabilita controlli camera durante drag
        if (window.Scene3D && window.Scene3D.mouseControls) {
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

        // NUOVO: Raycast contro tutti gli oggetti della scena per trovare nuovo piano
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const allObjects = this.scene.children.filter(obj =>
            obj !== this.draggedObject &&
            obj.type !== 'DirectionalLight' &&
            obj.type !== 'AmbientLight' &&
            !obj.name.startsWith('SnapIndicator')
        );

        const sceneIntersects = this.raycaster.intersectObjects(allObjects, true);

        if (sceneIntersects.length > 0) {
            // Aggiorna il piano in base al punto intersectato
            const intersectionPoint = sceneIntersects[0].point;

            // Solo aggiorna se il punto è cambiato significativamente (per performance)
            if (!this.lastPlanePoint || this.lastPlanePoint.distanceTo(intersectionPoint) > 0.01) {
                this.updateDragPlaneToCamera(intersectionPoint);
                this.lastPlanePoint = intersectionPoint.clone();
            }
        }

        // Proietta su piano di drag aggiornato
        const planeIntersects = this.raycaster.intersectObjects([this.dragPlane], false);

        if (planeIntersects.length > 0) {
            const newPosition = planeIntersects[0].point.sub(this.dragOffset);

            // Aggiorna posizione oggetto
            this.draggedObject.position.copy(newPosition);

            // Controlla e evidenzia zone di snap
            this.checkSnapZones();
        }
    },
    
    /**
     * Termina il drag e controlla se eseguire snap
     */
    endDrag: function() {
        if (!this.isDragging || !this.draggedObject) return;

        console.log(`[DragDropSystem] 🏁 Fine drag di: ${this.draggedObject.name}`);

        // DEBUG: Log distanza dal punto di snap al momento del drop (PRIMA di findSnapTarget)
        const originalPos = this.originalPositions.get(this.draggedObject.uuid);
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
        }

        // Controlla se l'oggetto è abbastanza vicino alla posizione originale
        const snapTarget = this.findSnapTarget(this.draggedObject);

        if (snapTarget) {
            // IMPORTANTE: Salva stato da resettare dopo l'animazione
            const snapContext = {
                draggedObject: this.draggedObject,
                assemblyIntegration: {
                    enabled: window.AssemblySystem && window.AssemblySystem.assemblyMode,
                    componentName: this.getCleanModelName(this.draggedObject.name),
                    snapTargetId: snapTarget.id
                }
            };

            // Esegui snap animato - colore originale mantenuto
            this.performSnap(this.draggedObject, snapTarget, snapContext);
            // Rimuovi dal blocco ma NON riapplicare silhouette (snap riuscito)
            this.silhouetteBlocked.delete(this.draggedObject.name);
            console.log(`[DragDropSystem] ✅ Snap riuscito - mantengo colore originale per ${this.draggedObject.name}`);

            // NON FARE IL RESET QUI - sarà fatto da performSnap() dopo l'animazione
            return; // Esce immediatamente, evita il reset dello stato
        } else {
            // Snap fallito - rimuovi dal blocco e riapplica highlight
            this.silhouetteBlocked.delete(this.draggedObject.name);
            if (window.Scene3D && typeof window.Scene3D.highlightModel === 'function') {
                window.Scene3D.highlightModel(this.draggedObject);
                console.log(`[DragDropSystem] ❌ Snap fallito - riapplicato highlight giallo a ${this.draggedObject.name}`);
            }
        }

        // Cleanup
        this.hideAllSnapIndicators();
        this.canvas.style.cursor = 'default';

        // Riabilita sistema click esistente
        if (window.Scene3D && window.Scene3D.animationSystem) {
            window.Scene3D.animationSystem.clickEnabled = true;
        }

        // NUOVO: Riabilita controlli camera
        if (window.Scene3D && window.Scene3D.mouseControls && this.cameraControlsWereEnabled !== undefined) {
            window.Scene3D.mouseControls.enabled = this.cameraControlsWereEnabled;
            console.log(`[DragDropSystem] ✅ Controlli camera riabilitati`);
            this.cameraControlsWereEnabled = undefined;
        }

        // Reset stato
        this.isDragging = false;
        this.draggedObject = null;
        this.dragOffset.set(0, 0, 0);
        this.dragStartPosition.set(0, 0, 0);
        this.lastPlanePoint = null;  // Reset cache piano
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

    /* ===== SNAP SYSTEM ===== */
    
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
            let targetPosition = null;
            
            if (customTarget.isOriginalRef && window.Scene3D) {
                // Usa il sistema Scene3D per riferimenti _original
                const originalRef = window.Scene3D.findModelByName(customTarget.targetName);
                if (originalRef && originalRef.position) {
                    targetPosition = originalRef.position.clone();
                    console.log(`[DragDropSystem] 🎯 Custom snap target (original): "${customTarget.targetName}" at (${targetPosition.x.toFixed(2)}, ${targetPosition.y.toFixed(2)}, ${targetPosition.z.toFixed(2)})`);
                }
            } else {
                // Target standard (cerca l'oggetto nella scena)
                const targetModel = window.Scene3D ? window.Scene3D.findModelByName(customTarget.targetName) : null;
                if (targetModel && targetModel.position) {
                    targetPosition = targetModel.position.clone();
                    console.log(`[DragDropSystem] 🎯 Custom snap target (current): "${customTarget.targetName}" at (${targetPosition.x.toFixed(2)}, ${targetPosition.y.toFixed(2)}, ${targetPosition.z.toFixed(2)})`);
                }
            }
            
            if (targetPosition) {
                // Applica offset se specificato
                if (customTarget.offset) {
                    targetPosition.add(customTarget.offset);
                }
                
                const distance = currentCenter.distanceTo(targetPosition);
                if (distance <= this.snapDistance) {
                    console.log(`[DragDropSystem] 🧲 Custom snap disponibile per ${object.name} (distanza centro BB: ${distance.toFixed(2)})`);
                    return targetPosition;
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

                // NUOVO: Integrazione con AssemblySystem dopo snap completato
                if (shouldResetDragState && snapContext && snapContext.assemblyIntegration.enabled) {
                    try {
                        window.AssemblySystem.markComponentMounted(
                            snapContext.assemblyIntegration.componentName,
                            snapContext.assemblyIntegration.snapTargetId
                        );
                        console.log(`[DragDropSystem] 🏗️ Componente "${snapContext.assemblyIntegration.componentName}" marcato come montato nell'AssemblySystem`);

                        // Verifica se il passo corrente è completato e avanza automaticamente
                        const assemblyStatus = window.AssemblySystem.getAssemblyStatus();
                        if (assemblyStatus.currentStepComplete && assemblyStatus.canAdvanceToNext) {
                            console.log(`[DragDropSystem] 🎯 Step "${assemblyStatus.currentStep}" completato, avanzamento automatico...`);
                            const nextStep = window.AssemblySystem.getNextStep();
                            if (nextStep) {
                                window.AssemblySystem.setCurrentStep(nextStep);
                                console.log(`[DragDropSystem] ⏭️ Avanzato automaticamente a step: "${nextStep}"`);
                            }
                        }
                    } catch (error) {
                        console.error(`[DragDropSystem] ❌ Errore integrazione AssemblySystem:`, error);
                    }
                }

                // NUOVO: Reset stato drag dopo animazione completata (solo se richiesto)
                if (shouldResetDragState) {
                    this.isDragging = false;
                    this.draggedObject = null;
                    this.dragOffset.set(0, 0, 0);
                    this.dragStartPosition.set(0, 0, 0);
                    this.lastPlanePoint = null;

                    // Riabilita sistema click esistente
                    if (window.Scene3D && window.Scene3D.animationSystem) {
                        window.Scene3D.animationSystem.clickEnabled = true;
                    }

                    // Riabilita controlli camera
                    if (window.Scene3D && window.Scene3D.mouseControls && this.cameraControlsWereEnabled !== undefined) {
                        window.Scene3D.mouseControls.enabled = this.cameraControlsWereEnabled;
                        console.log(`[DragDropSystem] ✅ Controlli camera riabilitati dopo snap`);
                        this.cameraControlsWereEnabled = undefined;
                    }

                    console.log(`[DragDropSystem] 🐭 Stato drag resettato dopo animazione snap completata`);
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

                // TRIGGER AVANZAMENTO STEP SUCCESSIVO dopo snap completato
                if (window.tutorialSystem && typeof window.tutorialSystem.completeCurrentStep === 'function') {
                    try {
                        console.log(`[DragDropSystem] ➡️ Trigger avanzamento al step successivo dopo snap`);
                        window.tutorialSystem.completeCurrentStep();
                    } catch (error) {
                        console.warn(`[DragDropSystem] ⚠️ Errore avanzamento step:`, error);
                    }
                }

                // ALTERNATIVA: Prova anche interfaccia UI
                if (window.UI && typeof window.UI.advanceStep === 'function') {
                    try {
                        console.log(`[DragDropSystem] ➡️ Avanzamento step via UI dopo snap`);
                        window.UI.advanceStep();
                    } catch (error) {
                        console.warn(`[DragDropSystem] ⚠️ Errore avanzamento step UI:`, error);
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
                        window.AssemblySystem.markComponentMounted(
                            snapContext.assemblyIntegration.componentName,
                            snapContext.assemblyIntegration.snapTargetId
                        );
                        console.log(`[DragDropSystem] 🏗️ Componente "${snapContext.assemblyIntegration.componentName}" marcato come montato nell'AssemblySystem (immediato)`);

                        // Verifica se il passo corrente è completato e avanza automaticamente
                        const assemblyStatus = window.AssemblySystem.getAssemblyStatus();
                        if (assemblyStatus.currentStepComplete && assemblyStatus.canAdvanceToNext) {
                            console.log(`[DragDropSystem] 🎯 Step "${assemblyStatus.currentStep}" completato, avanzamento automatico... (immediato)`);
                            const nextStep = window.AssemblySystem.getNextStep();
                            if (nextStep) {
                                window.AssemblySystem.setCurrentStep(nextStep);
                                console.log(`[DragDropSystem] ⏭️ Avanzato automaticamente a step: "${nextStep}" (immediato)`);
                            }
                        }
                    } catch (error) {
                        console.error(`[DragDropSystem] ❌ Errore integrazione AssemblySystem (immediato):`, error);
                    }
                }

                // NUOVO: Reset stato drag dopo snap immediato (solo se richiesto)
                if (shouldResetDragState) {
                    this.isDragging = false;
                    this.draggedObject = null;
                    this.dragOffset.set(0, 0, 0);
                    this.dragStartPosition.set(0, 0, 0);
                    this.lastPlanePoint = null;

                    // Riabilita sistema click esistente
                    if (window.Scene3D && window.Scene3D.animationSystem) {
                        window.Scene3D.animationSystem.clickEnabled = true;
                    }

                    // Riabilita controlli camera
                    if (window.Scene3D && window.Scene3D.mouseControls && this.cameraControlsWereEnabled !== undefined) {
                        window.Scene3D.mouseControls.enabled = this.cameraControlsWereEnabled;
                        console.log(`[DragDropSystem] ✅ Controlli camera riabilitati dopo snap immediato`);
                        this.cameraControlsWereEnabled = undefined;
                    }

                    console.log(`[DragDropSystem] 🐭 Stato drag resettato dopo snap immediato completato`);
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

                // TRIGGER AVANZAMENTO STEP SUCCESSIVO dopo snap immediato
                if (window.tutorialSystem && typeof window.tutorialSystem.completeCurrentStep === 'function') {
                    try {
                        console.log(`[DragDropSystem] ➡️ Trigger avanzamento al step successivo dopo snap immediato`);
                        window.tutorialSystem.completeCurrentStep();
                    } catch (error) {
                        console.warn(`[DragDropSystem] ⚠️ Errore avanzamento step immediato:`, error);
                    }
                }

                // ALTERNATIVA: Prova anche interfaccia UI (versione immediata)
                if (window.UI && typeof window.UI.advanceStep === 'function') {
                    try {
                        console.log(`[DragDropSystem] ➡️ Avanzamento step via UI dopo snap immediato`);
                        window.UI.advanceStep();
                    } catch (error) {
                        console.warn(`[DragDropSystem] ⚠️ Errore avanzamento step UI immediato:`, error);
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
     * Ottiene stato abilitazione
     * @returns {boolean}
     */
    isEnabled: function() {
        return this.enabled;
    },
    
    /**
     * Ottiene stato dragging
     * @returns {boolean}
     */
    isDraggingActive: function() {
        return this.isDragging;
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

        // Ricrea indicatori con nuova distanza se abilitato
        if (this.enabled) {
            this.createSnapIndicators();
        }
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
    }
};