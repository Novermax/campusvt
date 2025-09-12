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
    
    // Controlli mouse personalizzati per drag
    mouseState: {
        isDown: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        hasMoved: false
    },
    
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
        
        // Memorizza posizioni originali
        this.storeOriginalPositions();
        
        // Crea indicatori snap
        this.createSnapIndicators();
        
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
     */
    storeOriginalPositions: function() {
        this.originalPositions.clear();
        this.originalRotations.clear();
        
        this.draggableObjects.forEach(obj => {
            // Memorizza posizione del centro del bounding box
            const boundingBox = new THREE.Box3().setFromObject(obj);
            const originalCenter = boundingBox.getCenter(new THREE.Vector3());
            
            this.originalPositions.set(obj.uuid, originalCenter.clone());
            this.originalRotations.set(obj.uuid, obj.rotation.clone());
            
            console.log(`[DragDropSystem] 📍 Memorizzata posizione originale per ${obj.name}:`, 
                `(${originalCenter.x.toFixed(2)}, ${originalCenter.y.toFixed(2)}, ${originalCenter.z.toFixed(2)})`);
        });
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
        
        // Crea cerchio di snap zone
        const ringGeometry = new THREE.RingGeometry(
            this.snapDistance * 0.8, 
            this.snapDistance * 1.2, 
            16
        );
        
        const ring = new THREE.Mesh(ringGeometry, this.snapZoneMaterial.clone());
        ring.position.copy(originalPos);
        ring.rotation.x = -Math.PI / 2; // Orizzontale
        ring.name = `SnapIndicator_${obj.name}`;
        ring.visible = false; // Nascosto di default
        
        this.snapIndicators.set(obj.uuid, ring);
        this.scene.add(ring);
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
        
        // Mostra indicatori snap per tutti gli oggetti tranne quello draggato
        this.showSnapIndicators(object);
        
        // Cambia cursore
        this.canvas.style.cursor = 'grabbing';
        
        // Disabilita sistema click esistente durante drag
        if (window.Scene3D && window.Scene3D.animationSystem) {
            window.Scene3D.animationSystem.clickEnabled = false;
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
        
        // Proietta su piano di drag
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects([this.dragPlane], false);
        
        if (intersects.length > 0) {
            const newPosition = intersects[0].point.sub(this.dragOffset);
            
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
        
        // Controlla se l'oggetto è abbastanza vicino alla posizione originale
        const snapTarget = this.findSnapTarget(this.draggedObject);
        
        if (snapTarget) {
            // Esegui snap animato
            this.performSnap(this.draggedObject, snapTarget);
        }
        
        // Cleanup
        this.hideAllSnapIndicators();
        this.canvas.style.cursor = 'default';
        
        // Riabilita sistema click esistente
        if (window.Scene3D && window.Scene3D.animationSystem) {
            window.Scene3D.animationSystem.clickEnabled = true;
        }
        
        // Reset stato
        this.isDragging = false;
        this.draggedObject = null;
        this.dragOffset.set(0, 0, 0);
        this.dragStartPosition.set(0, 0, 0);
    },
    
    /* ===== SNAP SYSTEM ===== */
    
    /**
     * Trova il target di snap per un oggetto
     * @param {THREE.Object3D} object - Oggetto da controllare
     * @returns {THREE.Vector3|null} - Posizione target per snap o null
     */
    findSnapTarget: function(object) {
        const currentPos = object.position;
        
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
                
                const distance = currentPos.distanceTo(targetPosition);
                if (distance <= this.snapDistance) {
                    console.log(`[DragDropSystem] 🧲 Custom snap disponibile per ${object.name} (distanza: ${distance.toFixed(2)})`);
                    return targetPosition;
                }
            }
        }
        
        // 2. Fallback: usa posizione originale dell'oggetto stesso
        const originalPos = this.originalPositions.get(object.uuid);
        if (originalPos) {
            const distance = currentPos.distanceTo(originalPos);
            
            if (distance <= this.snapDistance) {
                console.log(`[DragDropSystem] 🧲 Standard snap disponibile per ${object.name} (distanza: ${distance.toFixed(2)})`);
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
    performSnap: function(object, targetPosition) {
        console.log(`[DragDropSystem] 🎯 Esecuzione snap per ${object.name}`);
        
        const startPosition = object.position.clone();
        const originalRotation = this.originalRotations.get(object.uuid);
        const startRotation = object.rotation.clone();
        
        // Animazione con TWEEN se disponibile, altrimenti animazione semplice
        if (window.TWEEN) {
            const tween = new TWEEN.Tween({
                x: startPosition.x,
                y: startPosition.y,
                z: startPosition.z,
                rotX: startRotation.x,
                rotY: startRotation.y,
                rotZ: startRotation.z
            })
            .to({
                x: targetPosition.x,
                y: targetPosition.y,
                z: targetPosition.z,
                rotX: originalRotation ? originalRotation.x : startRotation.x,
                rotY: originalRotation ? originalRotation.y : startRotation.y,
                rotZ: originalRotation ? originalRotation.z : startRotation.z
            }, this.snapAnimationDuration * 1000)
            .easing(TWEEN.Easing.Back.Out)
            .onUpdate((coords) => {
                object.position.set(coords.x, coords.y, coords.z);
                object.rotation.set(coords.rotX, coords.rotY, coords.rotZ);
            })
            .onComplete(() => {
                console.log(`[DragDropSystem] ✅ Snap completato per ${object.name}`);
            })
            .start();
        } else {
            // Animazione semplice senza TWEEN
            object.position.copy(targetPosition);
            if (originalRotation) {
                object.rotation.copy(originalRotation);
            }
            console.log(`[DragDropSystem] ✅ Snap immediato per ${object.name}`);
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
                indicator.visible = true; // Mostra il suo indicatore
                indicator.material.opacity = 0.6;
            } else {
                indicator.visible = false; // Nasconde gli altri per chiarezza
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
        this.snapDistance = Math.max(0.1, distance);
        console.log(`[DragDropSystem] Distanza snap aggiornata: ${this.snapDistance}`);
        
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
    }
};