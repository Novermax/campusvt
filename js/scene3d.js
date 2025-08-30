/**
 * SCENE3D.JS - Gestione della scena 3D
 * VERSION: 1000010 - WITH ROTATION FIX FOR SCREWS
 * 
 * Questo modulo gestisce:
 * - Inizializzazione della scena Three.js
 * - Configurazione camera, renderer e luci
 * - Caricamento e gestione modelli 3D
 * - Controlli camera e interazione mouse
 * - Auto-fit e zoom automatico sui modelli
 */

/* ===== VARIABILI GLOBALI SCENA ===== */
console.log('🚀🚀🚀 SCENE3D.JS VERSION 1000010 LOADED - ROTATION FIX ACTIVE! 🚀🚀🚀');

window.Scene3D = {
    // Oggetti Three.js principali
    scene: null,                    // La scena 3D principale
    camera: null,                   // Camera prospettica
    renderer: null,                 // Renderer WebGL
    
    // Array modelli caricati
    loadedModels: [],              // Lista di tutti i modelli caricati
    currentModel: null,            // Riferimento al modello attivo
    
    // Sistema animazioni
    animationSystem: {
        activeAnimations: [],      // Animazioni in corso
        modelDirections: {},       // Direzioni per ogni modello (da config)
        clickEnabled: true         // Se il click sui modelli è attivo
    },
    
    // Raycaster per rilevamento click
    raycaster: null,
    mouse: null,
    
    // Sistema evidenziazione modelli
    highlightSystem: {
        highlightedModel: null,        // Modello attualmente evidenziato
        originalMaterials: new Map(),  // Materiali originali salvati
        highlightMaterial: null,       // Materiale per evidenziazione
        highlightTimer: null,          // Timer per auto-reset
        isHighlighting: false          // Flag stato evidenziazione
    },
    
    // Sistema tracking completamento step tutorial
    tutorialTracker: {
        completedSteps: new Set(),     // Set degli step completati
        lastStepCompleted: false       // Flag per ultimo step completato
    },
    
    // Controlli e interazione
    mouseControls: {
        isMouseDown: false,        // Stato pulsante mouse
        mouseButton: 0,            // Quale pulsante è premuto (0=sinistra, 2=destra)
        lastPosition: { x: 0, y: 0 }, // Ultima posizione mouse
        isPanning: false,          // Flag per indicare se si sta facendo pan
        pivotPoint: new THREE.Vector3(0, 0, 0), // Punto pivot per rotazione/zoom
        sensitivity: {
            rotation: 0.015,       // Sensibilità rotazione aumentata
            pan: 0.020,            // Sensibilità spostamento aumentata
            zoom: 0.025            // Sensibilità zoom aumentata per più reattività
        },
        // Nuovi parametri per interpolazione e limiti
        interpolation: {
            enabled: true,
            factor: 0.02,          // Fattore di interpolazione ancora più basso per effetto più fluido
            targetRotation: { theta: 0, phi: Math.PI / 2 },
            targetPosition: { x: 0, y: 0, z: 5 },
            targetZoom: 5,
            threshold: 0.001,      // Soglia sotto la quale fermare l'interpolazione
            isPanning: false       // Flag per disabilitare interpolazione durante pan
        },
        limits: {
            minPhi: 0.2,           // Limite minimo rotazione verticale (vista dall'alto)
            maxPhi: Math.PI * 0.45, // Limite massimo ben sotto l'orizzonte per non andare mai sotto pavimento
            minY: 0.0,            // Limite minimo posizione Y più restrittivo
            minZoom: 0.3,          // Zoom minimo
            maxZoom: 15            // Zoom massimo
        }
    },
    
    // Vista salvata per reset
    savedView: null,
    
    // Canvas HTML
    canvas: null,

    /* ===== INIZIALIZZAZIONE SCENA ===== */
    
    /**
     * Inizializza la scena 3D completa
     * Questa è la funzione principale da chiamare per configurare tutto
     */
    init: function() {
        AppConfig.log(2, 'Inizializzazione scena 3D...');
        
        try {
            // Verifica che Three.js sia caricato
            if (typeof THREE === 'undefined') {
                throw new Error('Three.js non è stato caricato correttamente');
            }
            
            // Ottieni riferimento al canvas
            this.canvas = document.getElementById('canvas3d');
            if (!this.canvas) {
                throw new Error('Canvas 3D non trovato nel DOM');
            }
            
            // Inizializza i componenti della scena
            this.initScene();
            this.initCamera();
            this.initRenderer();
            this.initLights();
            this.initControls();
            this.initRaycaster();
            this.initHighlightSystem();
            
            // Avvia il loop di rendering
            this.startRenderLoop();
            
            // Salva la vista iniziale
            this.saveCurrentView();
            
            AppConfig.log(2, 'Scena 3D inizializzata con successo');
            
        } catch (error) {
            AppConfig.log(0, 'Errore durante inizializzazione scena:', error);
            throw error;
        }
    },
    
    /**
     * Crea la scena 3D base
     */
    initScene: function() {
        this.scene = new THREE.Scene();
        
        // Imposta colore di sfondo trasparente (il gradiente CSS sarà visibile)
        this.scene.background = null;
        
        AppConfig.log(3, 'Scena base creata');
    },
    
    /**
     * Configura la camera prospettica
     */
    initCamera: function() {
        const config = AppConfig.scene3D.camera;
        const aspect = window.innerWidth / window.innerHeight;
        
        // Crea camera prospettica
        this.camera = new THREE.PerspectiveCamera(
            config.fov,     // Campo visivo
            aspect,         // Aspect ratio
            config.near,    // Piano near
            config.far      // Piano far
        );
        
        // Imposta posizione iniziale
        this.camera.position.set(
            config.initialPosition.x,
            config.initialPosition.y,
            config.initialPosition.z
        );
        
        // La camera guarda verso l'origine
        this.camera.lookAt(0, 0, 0);
        
        AppConfig.log(3, 'Camera configurata', {
            fov: config.fov,
            aspect: aspect,
            position: this.camera.position
        });
    },
    
    /**
     * Configura il renderer WebGL
     */
    initRenderer: function() {
        const config = AppConfig.scene3D.renderer;
        
        // Crea renderer WebGL
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: config.antialias,
            alpha: config.alpha
        });
        
        // Imposta dimensioni
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        // Imposta pixel ratio per display ad alta densità
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        // Configura ombre se abilitate
        if (config.shadowMapEnabled) {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE[config.shadowMapType + 'ShadowMap'];
        }
        
        // Imposta tone mapping per colori più realistici
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 2.8; // Bilanciato per materiali visibili ma naturali
        
        AppConfig.log(3, 'Renderer configurato', {
            size: { width: window.innerWidth, height: window.innerHeight },
            pixelRatio: window.devicePixelRatio
        });
    },
    
    /**
     * Aggiunge le luci alla scena
     */
    initLights: function() {
        const ambientConfig = AppConfig.scene3D.lighting.ambient;
        const directionalConfig = AppConfig.scene3D.lighting.directional;
        
        // Luce ambientale (illumina tutto uniformemente)
        const ambientLight = new THREE.AmbientLight(
            ambientConfig.color,
            ambientConfig.intensity
        );
        this.scene.add(ambientLight);
        
        // Luce direzionale (simula il sole)
        const directionalLight = new THREE.DirectionalLight(
            directionalConfig.color,
            directionalConfig.intensity
        );
        
        // Posiziona la luce
        directionalLight.position.set(
            directionalConfig.position.x,
            directionalConfig.position.y,
            directionalConfig.position.z
        );
        
        // Configura ombre per la luce direzionale
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        
        this.scene.add(directionalLight);
        
        // Luce direzionale posteriore (illumina da dietro)
        const backLight = new THREE.DirectionalLight(
            0xffffff,    // Colore bianco
            0.4          // Intensità più bassa della luce principale
        );
        
        // Posiziona la luce dal lato opposto
        backLight.position.set(
            -directionalConfig.position.x,  // Opposto in X
            directionalConfig.position.y,   // Stessa altezza
            -directionalConfig.position.z   // Opposto in Z
        );
        
        // Non proietta ombre per evitare conflitti
        backLight.castShadow = false;
        
        this.scene.add(backLight);
        
        AppConfig.log(3, 'Luci aggiunte alla scena (frontale + posteriore)');
    },
    
    /**
     * Inizializza il raycaster per il rilevamento click sui modelli
     */
    initRaycaster: function() {
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        AppConfig.log(3, 'Raycaster inizializzato per rilevamento click modelli');
    },
    
    /* ===== SISTEMA EVIDENZIAZIONE MODELLI ===== */
    
    /**
     * Inizializza il sistema di evidenziazione
     */
    initHighlightSystem: function() {
        // Crea il materiale per l'evidenziazione rossa
        this.highlightSystem.highlightMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,           // Verde brillante
            transparent: true,
            opacity: 0.8,
            wireframe: false,
            side: THREE.DoubleSide,
            depthTest: false,          // Ignora z-buffer per essere sempre visibile
            depthWrite: false          // Non scrive nel z-buffer
        });
        
        AppConfig.log(3, 'Sistema evidenziazione inizializzato');
    },
    
    /**
     * Evidenzia un modello con outline rosso
     * @param {THREE.Object3D} model - Il modello da evidenziare
     * @param {number} duration - Durata in millisecondi (opzionale, se omesso rimane fino al click)
     */
    highlightModel: function(model, duration = null) {
        if (!model) {
            AppConfig.log(1, 'Tentativo di evidenziare un modello null');
            return;
        }
        
        // Se c'è già un modello evidenziato, ripristinalo prima
        if (this.highlightSystem.isHighlighting) {
            this.removeHighlight();
        }
        
        AppConfig.log(2, `🔴 Evidenziazione modello: ${model.userData?.originalFilename || model.name}`);
        
        // Salva i materiali originali
        this.saveOriginalMaterials(model);
        
        // Applica il materiale di evidenziazione
        this.applyHighlightMaterial(model);
        
        // Aggiorna stato
        this.highlightSystem.highlightedModel = model;
        this.highlightSystem.isHighlighting = true;
        
        // Timer opzionale se specificata una durata
        if (duration && duration > 0) {
            this.highlightSystem.highlightTimer = setTimeout(() => {
                this.removeHighlight();
            }, duration);
            AppConfig.log(2, `🔴 Evidenziazione attivata per ${duration}ms`);
        } else {
            AppConfig.log(2, '🔴 Evidenziazione attivata - si spegne al click sull\'elemento');
        }
    },
    
    /**
     * Salva i materiali originali di un modello prima dell'evidenziazione
     * @param {THREE.Object3D} model - Il modello di cui salvare i materiali
     */
    saveOriginalMaterials: function(model) {
        const materials = new Map();
        
        model.traverse((child) => {
            if (child.isMesh && child.material) {
                // Salva il materiale originale usando l'UUID come chiave
                if (Array.isArray(child.material)) {
                    // Multi-materiale
                    materials.set(child.uuid, child.material.slice()); // Copia array
                } else {
                    // Materiale singolo
                    materials.set(child.uuid, child.material);
                }
            }
        });
        
        this.highlightSystem.originalMaterials = materials;
        AppConfig.log(3, `Salvati ${materials.size} materiali originali`);
    },
    
    /**
     * Applica il materiale di evidenziazione a tutto il modello
     * @param {THREE.Object3D} model - Il modello da evidenziare
     */
    applyHighlightMaterial: function(model) {
        model.traverse((child) => {
            if (child.isMesh) {
                // Applica il materiale rosso a tutte le mesh
                if (Array.isArray(child.material)) {
                    // Multi-materiale: sostituisci tutti con highlight
                    child.material = child.material.map(() => this.highlightSystem.highlightMaterial);
                } else {
                    // Materiale singolo
                    child.material = this.highlightSystem.highlightMaterial;
                }
                
                // Forza il render order per essere sempre in primo piano
                child.renderOrder = 999;
            }
        });
        
        AppConfig.log(3, 'Materiale evidenziazione applicato');
    },
    
    /**
     * Rimuove l'evidenziazione e ripristina i materiali originali
     */
    removeHighlight: function() {
        if (!this.highlightSystem.isHighlighting || !this.highlightSystem.highlightedModel) {
            return;
        }
        
        const model = this.highlightSystem.highlightedModel;
        AppConfig.log(2, `🔄 Ripristino evidenziazione: ${model.userData?.originalFilename || model.name}`);
        
        // Ripristina i materiali originali
        model.traverse((child) => {
            if (child.isMesh && this.highlightSystem.originalMaterials.has(child.uuid)) {
                child.material = this.highlightSystem.originalMaterials.get(child.uuid);
                child.renderOrder = 0; // Reset render order
            }
        });
        
        // Pulisce il timer se ancora attivo (ora non più usato di default)
        if (this.highlightSystem.highlightTimer) {
            clearTimeout(this.highlightSystem.highlightTimer);
            this.highlightSystem.highlightTimer = null;
        }
        
        // Reset stato
        this.highlightSystem.highlightedModel = null;
        this.highlightSystem.originalMaterials.clear();
        this.highlightSystem.isHighlighting = false;
        
        AppConfig.log(2, '✅ Evidenziazione rimossa e materiali ripristinati');
    },
    
    /**
     * Evidenzia l'elemento corrente del tutorial se presente
     */
    highlightCurrentTutorialElement: function() {
        console.log('🔴 highlightCurrentTutorialElement chiamata');
        console.log('🔴 Modelli caricati:', this.loadedModels.length);
        console.log('🔴 Modelli disponibili:', this.loadedModels.map(m => m.userData?.originalFilename || m.name));
        
        // Ottieni lo step corrente del tutorial
        const currentStep = this.getCurrentTutorialStep();
        if (!currentStep || !currentStep.properties.Elemento) {
            console.log('🔴 Nessun step corrente o elemento tutorial da evidenziare');
            AppConfig.log(3, 'Nessun elemento tutorial da evidenziare');
            return;
        }
        
        const stepElement = currentStep.properties.Elemento;
        console.log('🔴 Elemento tutorial da evidenziare:', stepElement);
        
        // Trova il modello corrispondente
        const targetModel = this.loadedModels.find(model => {
            const modelFilename = model.userData?.originalFilename || model.name;
            const match = modelFilename.includes(stepElement.replace('.glb', ''));
            console.log(`🔍 Test modello "${modelFilename}" vs elemento "${stepElement}": ${match}`);
            return match;
        });
        
        if (targetModel) {
            console.log('🔴 ✅ Modello trovato per evidenziazione:', targetModel.userData?.originalFilename || targetModel.name);
            AppConfig.log(2, `🎯 Evidenziazione elemento tutorial: ${stepElement}`);
            this.highlightModel(targetModel);
        } else {
            console.log('🔴 ❌ Nessun modello trovato per elemento:', stepElement);
            console.log('🔴 ❌ Modelli disponibili:', this.loadedModels.map(m => m.userData?.originalFilename || m.name));
            AppConfig.log(1, `❌ Modello non trovato per elemento: ${stepElement}`);
        }
    },
    
    /* ===== CONTROLLI MOUSE ===== */
    
    /**
     * Inizializza i controlli mouse personalizzati
     */
    initControls: function() {
        const canvas = this.canvas;
        
        // Event listener per mouse
        canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        canvas.addEventListener('wheel', this.onMouseWheel.bind(this));
        
        // Event listener per touch (dispositivi mobili)
        canvas.addEventListener('touchstart', this.onTouchStart.bind(this));
        canvas.addEventListener('touchmove', this.onTouchMove.bind(this));
        canvas.addEventListener('touchend', this.onTouchEnd.bind(this));
        
        // Previene menu contestuale
        canvas.addEventListener('contextmenu', function(e) {
            e.preventDefault();
        });
        
        AppConfig.log(3, 'Controlli mouse inizializzati');
    },
    
    /**
     * Gestisce l'evento mousedown
     */
    onMouseDown: function(event) {
        this.mouseControls.isMouseDown = true;
        this.mouseControls.mouseButton = event.button;
        this.mouseControls.lastPosition.x = event.clientX;
        this.mouseControls.lastPosition.y = event.clientY;
        
        // Previene comportamenti di default
        event.preventDefault();
        
        // Previene comportamento di default del tasto centrale (scroll o apertura link)
        if (event.button === 1) {
            event.stopPropagation();
        }
    },
    
    /**
     * Gestisce l'evento mousemove
     */
    onMouseMove: function(event) {
        if (!this.mouseControls.isMouseDown) return;
        
        // Calcola il delta movimento
        const deltaX = event.clientX - this.mouseControls.lastPosition.x;
        const deltaY = event.clientY - this.mouseControls.lastPosition.y;
        
        if (this.mouseControls.mouseButton === 0) {
            // Tasto sinistro: Solo selezione elementi (nessun movimento camera)
            // Il movimento non fa nulla, la selezione avviene in onMouseUp
        } else if (this.mouseControls.mouseButton === 1) {
            // Rotella/tasto centrale: DISABILITATO temporaneamente
            // this.mouseControls.isPanning = true;
            // this.panCamera(deltaX, deltaY);
        } else if (this.mouseControls.mouseButton === 2) {
            // Tasto destro: Rotazione
            this.rotateCamera(deltaX, deltaY);
        }
        
        // Aggiorna ultima posizione
        this.mouseControls.lastPosition.x = event.clientX;
        this.mouseControls.lastPosition.y = event.clientY;
    },
    
    /**
     * Gestisce l'evento mouseup
     */
    onMouseUp: function(event) {
        // Controllo per click sui modelli (solo tasto sinistro e se non c'è stato dragging)
        if (event.button === 0 && this.animationSystem.clickEnabled) {
            const deltaX = Math.abs(event.clientX - this.mouseControls.lastPosition.x);
            const deltaY = Math.abs(event.clientY - this.mouseControls.lastPosition.y);
            
            // Solo se il movimento è minimo (non è un drag)
            if (deltaX < 5 && deltaY < 5) {
                this.handleModelClick(event);
            }
        }
        
        // NUOVO: Controllo per cambio pivot con tasto centrale
        if (event.button === 1) {
            const deltaX = Math.abs(event.clientX - this.mouseControls.lastPosition.x);
            const deltaY = Math.abs(event.clientY - this.mouseControls.lastPosition.y);
            
            // Solo se il movimento è minimo (non è un drag/pan)
            if (deltaX < 5 && deltaY < 5) {
                this.handlePivotClick(event);
            }
        }
        
        this.mouseControls.isMouseDown = false;
        this.mouseControls.isPanning = false;  // Reset del flag panning
        
        // Controlla se dopo il pan siamo andati sotto il pavimento
        if (this.camera.position.y < this.mouseControls.limits.minY) {
            // Calcola posizione corretta sopra il pavimento
            const currentSpherical = new THREE.Spherical();
            currentSpherical.setFromVector3(this.camera.position);
            currentSpherical.phi = Math.min(currentSpherical.phi, this.mouseControls.limits.maxPhi);
            
            // Ripristina la posizione corretta immediatamente
            this.camera.position.setFromSpherical(currentSpherical);
            this.camera.lookAt(0, 0, 0);
        }
    },
    
    /**
     * Gestisce l'evento wheel (zoom)
     */
    onMouseWheel: function(event) {
        // Normalizza il delta per reattività uniforme ma mantieni valori utilizzabili
        const rawDelta = event.deltaY;
        const normalizedDelta = rawDelta > 0 ? 100 : -100; // +100 per zoom out, -100 per zoom in
        const delta = normalizedDelta * this.mouseControls.sensitivity.zoom;
        this.zoomCamera(delta);
        event.preventDefault();
    },
    
    /* ===== CONTROLLI TOUCH (MOBILE) ===== */
    
    /**
     * Ottiene la modalità touch corrente dai radio button
     */
    getMobileMode: function() {
        const checkedRadio = document.querySelector('input[name="mobileMode"]:checked');
        return checkedRadio ? checkedRadio.value : 'pan';
    },
    
    onTouchStart: function(event) {
        if (event.touches.length === 1) {
            // Un dito: comportamento basato sulla modalità selezionata
            this.mouseControls.isMouseDown = true;
            this.mouseControls.lastPosition.x = event.touches[0].clientX;
            this.mouseControls.lastPosition.y = event.touches[0].clientY;
            
            // Ottieni modalità corrente dai radio button
            const mobileMode = this.getMobileMode();
            this.mouseControls.mobileMode = mobileMode;
            
        } else if (event.touches.length === 2) {
            // Due diti: setup per pinch zoom e rotazione
            this.mouseControls.isMouseDown = false;
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            
            // Salva distanza per pinch zoom
            this.mouseControls.lastPinchDistance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) + 
                Math.pow(touch2.clientY - touch1.clientY, 2)
            );
            
            // Salva centro delle due dita per rotazione
            this.mouseControls.lastTwoFingerCenter = {
                x: (touch1.clientX + touch2.clientX) / 2,
                y: (touch1.clientY + touch2.clientY) / 2
            };
        }
        event.preventDefault();
    },
    
    onTouchMove: function(event) {
        if (event.touches.length === 1 && this.mouseControls.isMouseDown) {
            // Un dito: comportamento basato sulla modalità selezionata
            const deltaX = event.touches[0].clientX - this.mouseControls.lastPosition.x;
            const deltaY = event.touches[0].clientY - this.mouseControls.lastPosition.y;
            
            const mode = this.mouseControls.mobileMode || 'pan';
            
            switch (mode) {
                case 'pan':
                    this.panCamera(deltaX, deltaY);
                    break;
                case 'rotate':
                    this.rotateCamera(deltaX, deltaY);
                    break;
                case 'zoom':
                    // Per zoom con un dito, usa il movimento verticale
                    const zoomDelta = -deltaY * 0.01;
                    this.zoomCamera(zoomDelta);
                    break;
            }
            
            this.mouseControls.lastPosition.x = event.touches[0].clientX;
            this.mouseControls.lastPosition.y = event.touches[0].clientY;
        } else if (event.touches.length === 2) {
            // Due diti: pinch zoom + rotazione
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            
            // Calcola distanza corrente per zoom
            const pinchDistance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) + 
                Math.pow(touch2.clientY - touch1.clientY, 2)
            );
            
            // Calcola centro corrente per rotazione
            const currentCenter = {
                x: (touch1.clientX + touch2.clientX) / 2,
                y: (touch1.clientY + touch2.clientY) / 2
            };
            
            if (this.mouseControls.lastPinchDistance && this.mouseControls.lastTwoFingerCenter) {
                // ZOOM: Gestisce il cambiamento di distanza tra le dita (invertito per movimento naturale)
                const distanceDelta = (pinchDistance - this.mouseControls.lastPinchDistance) * 0.01;
                if (Math.abs(distanceDelta) > 0.5) { // Solo se il pinch è significativo
                    this.zoomCamera(distanceDelta);
                }
                
                // ROTAZIONE: Gestisce il movimento del centro delle due dita
                const centerDeltaX = currentCenter.x - this.mouseControls.lastTwoFingerCenter.x;
                const centerDeltaY = currentCenter.y - this.mouseControls.lastTwoFingerCenter.y;
                
                // Solo se il movimento del centro è significativo e non è principalmente un pinch
                const centerMovement = Math.sqrt(centerDeltaX * centerDeltaX + centerDeltaY * centerDeltaY);
                const distanceChange = Math.abs(pinchDistance - this.mouseControls.lastPinchDistance);
                
                if (centerMovement > 5 && centerMovement > distanceChange * 0.5) {
                    this.rotateCamera(centerDeltaX, centerDeltaY);
                }
            }
            
            // Aggiorna valori per il prossimo frame
            this.mouseControls.lastPinchDistance = pinchDistance;
            this.mouseControls.lastTwoFingerCenter = currentCenter;
        }
        event.preventDefault();
    },
    
    onTouchEnd: function(event) {
        this.mouseControls.isMouseDown = false;
        
        
        // Reset valori touch quando non ci sono più dita sullo schermo
        if (event.touches.length === 0) {
            this.mouseControls.lastPinchDistance = null;
            this.mouseControls.lastTwoFingerCenter = null;
        }
        
        event.preventDefault();
    },
    
    /* ===== MOVIMENTO CAMERA ===== */
    
    /**
     * Sposta la camera (pan) - movimento diretto senza interpolazione
     */
    panCamera: function(deltaX, deltaY) {
        const sensitivity = this.mouseControls.sensitivity.pan;
        
        // SALVA la rotazione corrente per ripristinarla dopo
        const savedQuaternion = this.camera.quaternion.clone();
        
        // PAN LOCALE: sposta secondo la vista della camera
        // Forza aggiornamento della matrice
        this.camera.updateMatrixWorld();
        
        // Ottieni i vettori di direzione locali della camera
        const right = new THREE.Vector3();
        const up = new THREE.Vector3();
        
        // Estrai dalla matrice i vettori right e up
        this.camera.matrix.extractBasis(right, up, new THREE.Vector3());
        
        // Movimento in coordinate locali alla camera
        const movement = new THREE.Vector3();
        movement.addScaledVector(right, -deltaX * sensitivity);
        movement.addScaledVector(up, deltaY * sensitivity);
        
        // Applica il movimento
        this.camera.position.add(movement);
        
        // CRUCIALE: ripristina esattamente la rotazione salvata
        this.camera.quaternion.copy(savedQuaternion);
    },
    
    /**
     * Ruota la camera attorno all'origine (ora con interpolazione fluida)
     */
    rotateCamera: function(deltaX, deltaY) {
        const sensitivity = this.mouseControls.sensitivity.rotation;
        const limits = this.mouseControls.limits;
        
        // Rotazione attorno al pivot point corrente
        const pivotPoint = this.mouseControls.pivotPoint;
        
        // Calcola la posizione relativa al pivot
        const relativePosition = new THREE.Vector3().subVectors(this.camera.position, pivotPoint);
        
        const spherical = new THREE.Spherical();
        spherical.setFromVector3(relativePosition);
        
        spherical.theta -= deltaX * sensitivity;
        spherical.phi += deltaY * sensitivity;
        
        // Applica limiti
        spherical.phi = Math.max(limits.minPhi, Math.min(limits.maxPhi, spherical.phi));
        
        // Aggiorna posizione camera relativa al pivot
        relativePosition.setFromSpherical(spherical);
        this.camera.position.copy(pivotPoint).add(relativePosition);
        this.camera.lookAt(pivotPoint);
    },
    
    /**
     * Zoom della camera con interpolazione fluida
     */
    zoomCamera: function(delta) {
        const limits = this.mouseControls.limits;
        
        // Zoom verso il pivot point corrente
        const pivotPoint = this.mouseControls.pivotPoint;
        
        // Calcola la posizione relativa al pivot
        const relativePosition = new THREE.Vector3().subVectors(this.camera.position, pivotPoint);
        
        const spherical = new THREE.Spherical();
        spherical.setFromVector3(relativePosition);
        
        const zoomStep = delta > 0 ? 1.2 : 1/1.2;
        spherical.radius *= zoomStep;
        
        // Applica limiti
        spherical.radius = Math.max(limits.minZoom, Math.min(limits.maxZoom, spherical.radius));
        
        // Aggiorna posizione camera relativa al pivot
        relativePosition.setFromSpherical(spherical);
        this.camera.position.copy(pivotPoint).add(relativePosition);
        this.camera.lookAt(pivotPoint);
    },
    
    /**
     * Aggiorna la posizione e rotazione della camera con interpolazione fluida (lerp)
     */
    updateCameraInterpolation: function() {
        if (!this.mouseControls.interpolation.enabled || this.mouseControls.isPanning) {
            return;  // Non fare interpolazione durante il pan
        }
        
        const interpolation = this.mouseControls.interpolation;
        const limits = this.mouseControls.limits;
        const factor = interpolation.factor;
        
        // Interpolazione della rotazione (coordinate sferiche relative al pivot)
        const pivotPoint = this.mouseControls.pivotPoint;
        const relativePosition = new THREE.Vector3().subVectors(this.camera.position, pivotPoint);
        
        const currentSpherical = new THREE.Spherical();
        currentSpherical.setFromVector3(relativePosition);
        
        // Interpola theta (rotazione orizzontale)
        const thetaDiff = interpolation.targetRotation.theta - currentSpherical.theta;
        if (Math.abs(thetaDiff) > interpolation.threshold) {
            currentSpherical.theta += thetaDiff * factor;
        }
        
        // Interpola phi (rotazione verticale) CON LIMITI APPLICATI
        let targetPhi = interpolation.targetRotation.phi;
        // Applica i limiti al target
        targetPhi = Math.max(limits.minPhi, Math.min(limits.maxPhi, targetPhi));
        const phiDiff = targetPhi - currentSpherical.phi;
        if (Math.abs(phiDiff) > interpolation.threshold) {
            currentSpherical.phi += phiDiff * factor;
        }
        
        // Applica nuovamente i limiti per sicurezza
        currentSpherical.phi = Math.max(limits.minPhi, Math.min(limits.maxPhi, currentSpherical.phi));
        
        // Interpola la distanza (zoom) CON LIMITI
        let targetZoom = interpolation.targetZoom;
        targetZoom = Math.max(limits.minZoom, Math.min(limits.maxZoom, targetZoom));
        const distanceDiff = targetZoom - currentSpherical.radius;
        if (Math.abs(distanceDiff) > interpolation.threshold) {
            currentSpherical.radius += distanceDiff * factor;
        }
        
        // Applica i limiti di zoom
        currentSpherical.radius = Math.max(limits.minZoom, Math.min(limits.maxZoom, currentSpherical.radius));
        
        // Applica la nuova posizione dalla coordinata sferica relativa al pivot
        relativePosition.setFromSpherical(currentSpherical);
        this.camera.position.copy(pivotPoint).add(relativePosition);
        this.camera.lookAt(pivotPoint);
        
        // Aggiorna i target per mantenerli sincronizzati CON I LIMITI
        interpolation.targetRotation.theta = currentSpherical.theta;
        interpolation.targetRotation.phi = currentSpherical.phi;
        interpolation.targetZoom = currentSpherical.radius;
    },
    
    /* ===== RILEVAMENTO CLICK SU MODELLI ===== */
    
    /**
     * Gestisce il click sui modelli 3D
     */
    handleModelClick: function(event) {
        // Calcola posizione mouse normalizzata
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Aggiorna raycaster
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Trova intersezioni con i modelli
        const intersects = this.raycaster.intersectObjects(this.loadedModels, true);
        
        if (intersects.length > 0) {
            const clickedObject = intersects[0].object;
            
            // Trova il modello root che contiene questo object
            let targetModel = null;
            for (const model of this.loadedModels) {
                if (this.isDescendantOf(clickedObject, model)) {
                    targetModel = model;
                    break;
                }
            }
            
            if (targetModel) {
                AppConfig.log(2, `🖱️ Click su modello:`, targetModel.userData?.originalFilename || targetModel.name);
                this.handleModelAction(targetModel);
            }
        }
    },
    
    /**
     * Verifica se un oggetto è discendente di un altro
     */
    isDescendantOf: function(child, parent) {
        let current = child;
        while (current && current !== this.scene) {
            if (current === parent) return true;
            current = current.parent;
        }
        return false;
    },
    
    /**
     * Gestisce l'azione su un modello cliccato
     */
    handleModelAction: function(model) {
        // Ottieni lo step corrente per verificare il tool richiesto
        const currentStep = this.getCurrentTutorialStep();
        const requiredTool = this.getRequiredToolForStep(currentStep);
        const activeTool = window.UI ? window.UI.getActiveTool() : null;
        
        console.log('🔧 Tool check - Richiesto:', requiredTool, 'Attivo:', activeTool);
        
        // NUOVO: Spegni evidenziazione SOLO se il modello è evidenziato E il tool è corretto
        if (this.highlightSystem.isHighlighting && 
            this.highlightSystem.highlightedModel === model) {
            
            if (requiredTool && activeTool === requiredTool) {
                AppConfig.log(2, '🔴✅ Rimozione evidenziazione: tool corretto attivo');
                this.removeHighlight();
            } else {
                AppConfig.log(2, '🔴❌ Evidenziazione mantenuta: tool scorretto o mancante');
                console.log(`🔧 Tool richiesto: "${requiredTool}", tool attivo: "${activeTool}"`);
                // Non rimuovere l'evidenziazione - rimane attiva
                // Potremmo aggiungere un feedback visivo qui (es. vibrazione, messaggio)
            }
        }
        
        // Verifica che sia attivo il tool corretto (ora più specifico)
        if (!requiredTool || activeTool !== requiredTool) {
            AppConfig.log(2, `🖱️ Click ignorato: tool "${requiredTool}" richiesto, ma "${activeTool}" attivo`);
            return;
        }
        
        // Usa lo step già ottenuto sopra
        if (!currentStep) {
            AppConfig.log(2, '🖱️ Click ignorato: nessun step tutorial attivo');
            return;
        }
        
        // Verifica che il modello corrisponda all'elemento dello step
        const modelFilename = model.userData?.originalFilename || model.name;
        const stepElement = currentStep.properties.Elemento;
        
        console.log(`🔍 CHECK STEP: Modello cliccato "${modelFilename}", Step corrente: ${window.UI.currentStepIndex + 1}, Elemento step: "${stepElement}"`);
        console.log(`🔍 CHECK STEP: Step properties:`, currentStep.properties);
        
        // MANTIENI il controllo della sequenza: solo l'elemento dello step corrente
        if (!stepElement || !modelFilename.includes(stepElement.replace('.glb', ''))) {
            AppConfig.log(2, `🖱️ Click ignorato: modello "${modelFilename}" non corrisponde all'elemento "${stepElement}" per step ${window.UI.currentStepIndex + 1}`);
            return;
        }
        
        // NUOVO: Controlla se è l'ultimo step e se è già stato completato
        const isLastStep = this.isLastTutorialStep(window.UI.currentStepIndex);
        if (isLastStep && this.tutorialTracker.lastStepCompleted) {
            AppConfig.log(2, '🏁 Ultimo step già completato - azione bloccata');
            console.log('🏁 Tutorial completato - nessuna azione aggiuntiva permessa');
            return;
        }
        
        // NUOVO: Permetti animazioni multiple dello stesso tipo di elemento
        // Solo impedisci di ricliccare sullo STESSO modello, non su altri dello stesso tipo
        console.log(`🔍 MULTI-ANIM: Controllo modello ${modelFilename}, ID oggetto:`, model.id || model.uuid);
        console.log(`🔍 MULTI-ANIM: Animazioni attive:`, this.animationSystem.activeAnimations.length);
        console.log(`🔍 MULTI-ANIM: Modelli in animazione:`, this.animationSystem.activeAnimations.map(a => ({
            name: a.model.userData?.originalFilename || a.model.name,
            id: a.model.id || a.model.uuid
        })));
        
        if (this.isModelAnimating(model)) {
            AppConfig.log(2, `🖱️ Questo specifico modello "${modelFilename}" (ID: ${model.id || model.uuid}) è già in animazione`);
            return;
        }
        
        // Se arriviamo qui, è un elemento valido per lo step corrente e non già in animazione
        console.log(`✅ MULTI-ANIM: Autorizzato avvio animazione per ${modelFilename}`);
        
        // Esegui l'animazione
        AppConfig.log(2, `🎬 Avvio animazione per: ${modelFilename}`);
        this.startModelAnimation(model, currentStep);
    },
    
    /**
     * Gestisce il click con tasto centrale per cambiare il pivot
     */
    handlePivotClick: function(event) {
        // Calcola posizione mouse normalizzata
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Aggiorna raycaster
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Trova intersezioni con tutti gli oggetti della scena
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        
        if (intersects.length > 0) {
            const intersection = intersects[0];
            let targetObject = intersection.object;
            
            // Trova il modello root che contiene questo oggetto
            let targetModel = null;
            for (const model of this.loadedModels) {
                if (this.isDescendantOf(targetObject, model)) {
                    targetModel = model;
                    break;
                }
            }
            
            if (targetModel) {
                // Calcola il centro del modello
                const box = new THREE.Box3().setFromObject(targetModel);
                const center = box.getCenter(new THREE.Vector3());
                
                // Aggiorna il punto pivot
                this.mouseControls.pivotPoint.copy(center);
                
                console.log(`🎯 PIVOT: Nuovo pivot impostato su modello "${targetModel.userData?.originalFilename || targetModel.name}":`);
                console.log(`🎯 PIVOT: Coordinate (${center.x.toFixed(3)}, ${center.y.toFixed(3)}, ${center.z.toFixed(3)})`);
                
                AppConfig.log(2, `🎯 Pivot cambiato su: ${targetModel.userData?.originalFilename || targetModel.name}`);
            } else {
                // Click su un punto vuoto - usa il punto di intersezione
                this.mouseControls.pivotPoint.copy(intersection.point);
                
                console.log(`🎯 PIVOT: Nuovo pivot impostato su punto vuoto:`);
                console.log(`🎯 PIVOT: Coordinate (${intersection.point.x.toFixed(3)}, ${intersection.point.y.toFixed(3)}, ${intersection.point.z.toFixed(3)})`);
                
                AppConfig.log(2, `🎯 Pivot cambiato su punto: (${intersection.point.x.toFixed(3)}, ${intersection.point.y.toFixed(3)}, ${intersection.point.z.toFixed(3)})`);
            }
        }
    },
    
    /**
     * Ottiene lo step tutorial corrente
     */
    getCurrentTutorialStep: function() {
        if (!window.UI || !window.UI.tutorialSteps || window.UI.currentStepIndex === undefined) {
            return null;
        }
        
        const stepIndex = window.UI.currentStepIndex;
        return window.UI.tutorialSteps[stepIndex] || null;
    },
    
    /**
     * Determina il tool richiesto per uno step specifico
     * @param {Object} step - Lo step del tutorial
     * @returns {string|null} - Nome del tool richiesto o null
     */
    getRequiredToolForStep: function(step) {
        if (!step || !step.properties) {
            return null;
        }
        
        // Controlla se c'è una proprietà "Utensile" nello step
        if (step.properties.Utensile) {
            // Mappa i nomi degli utensili dal tutorial ai nomi interni
            const toolMapping = {
                'ChiaveBrugola': 'brugola',
                'ChiaveInglese': 'chiave_inglese',
                'Mani': 'mano',
                'Martello': 'martello'
            };
            
            const mappedTool = toolMapping[step.properties.Utensile];
            console.log(`🔧 Tool mapping: "${step.properties.Utensile}" -> "${mappedTool}"`);
            return mappedTool || null;
        }
        
        // Se non c'è utensile specificato, default a "mano"
        return 'mano';
    },
    
    /**
     * Verifica se l'indice corrente è l'ultimo step del tutorial
     * @param {number} stepIndex - Indice dello step da controllare
     * @returns {boolean} - True se è l'ultimo step
     */
    isLastTutorialStep: function(stepIndex) {
        if (!window.UI || !window.UI.tutorialSteps) {
            return false;
        }
        
        return stepIndex === (window.UI.tutorialSteps.length - 1);
    },
    
    /**
     * Marca uno step come completato
     * @param {number} stepIndex - Indice dello step da marcare come completato
     */
    markStepAsCompleted: function(stepIndex) {
        this.tutorialTracker.completedSteps.add(stepIndex);
        
        // Se è l'ultimo step, marcalo come completato
        if (this.isLastTutorialStep(stepIndex)) {
            this.tutorialTracker.lastStepCompleted = true;
            console.log('🏁 TUTORIAL COMPLETATO - Ultimo step eseguito');
            AppConfig.log(2, '🏁 Tutorial completato con successo');
            
            // Rimuovi evidenziazione se presente
            if (this.highlightSystem.isHighlighting) {
                this.removeHighlight();
            }
        }
        
        console.log(`✅ Step ${stepIndex + 1} marcato come completato`);
        console.log(`📊 Steps completati: ${Array.from(this.tutorialTracker.completedSteps).map(i => i + 1).join(', ')}`);
    },
    
    /**
     * Resetta il tracker del tutorial (chiamato all'inizio di un nuovo tutorial)
     */
    resetTutorialTracker: function() {
        this.tutorialTracker.completedSteps.clear();
        this.tutorialTracker.lastStepCompleted = false;
        console.log('🔄 Tutorial tracker resettato');
        AppConfig.log(3, 'Tutorial tracker resettato per nuovo tutorial');
    },
    
    /* ===== GESTIONE MODELLI ===== */
    
    /**
     * Aggiunge un modello alla scena
     */
    addModel: function(model, modelConfig = null) {
        if (!model) {
            AppConfig.log(1, 'Tentativo di aggiungere modello null');
            return;
        }
        
        // Mantieni la posizione originale del modello dal file OBJ
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        console.log(`📍 Modello ${this.loadedModels.length + 1}:`, {
            position: model.position,
            size: `${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)}`,
            center: `${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}`,
            min: `${box.min.x.toFixed(2)}, ${box.min.y.toFixed(2)}, ${box.min.z.toFixed(2)}`,
            max: `${box.max.x.toFixed(2)}, ${box.max.y.toFixed(2)}, ${box.max.z.toFixed(2)}`
        });
        
        this.scene.add(model);
        this.loadedModels.push(model);
        this.currentModel = model;
        
        // Memorizza la configurazione del modello (inclusa la direzione)
        const modelFilename = model.userData?.originalFilename || model.name;
        console.log(`📝 Processo addModel per: "${modelFilename}"`);
        console.log(`📝 ModelConfig ricevuto:`, modelConfig);
        
        if (modelConfig && modelConfig.direction) {
            console.log(`🔍 ADDMODEL - ModelConfig direction per "${modelFilename}":`, modelConfig.direction);
            console.log(`🔍 ADDMODEL - Typeof direction:`, typeof modelConfig.direction);
            console.log(`🔍 ADDMODEL - Direction keys:`, Object.keys(modelConfig.direction));
            
            this.animationSystem.modelDirections[modelFilename] = modelConfig.direction;
            console.log(`🧭✅ Direzione memorizzata per "${modelFilename}":`, this.animationSystem.modelDirections[modelFilename]);
            
            // Verifica immediata di quello che è stato memorizzato
            const stored = this.animationSystem.modelDirections[modelFilename];
            console.log(`🔍 VERIFICA - Direzione appena memorizzata:`, {x: stored.x, y: stored.y, z: stored.z});
        } else {
            console.log(`🧭❌ Nessuna direzione per "${modelFilename}" - modelConfig:`, modelConfig);
        }
        
        // Auto-fit solo per il primo modello o per tutti insieme
        if (this.loadedModels.length === 1) {
            this.fitModelToView(model);
        } else {
            // Per modelli multipli, adatta la vista a tutti insieme
            this.fitAllModelsToView();
        }
        
        AppConfig.log(2, 'Modello aggiunto alla scena', { 
            totalModels: this.loadedModels.length 
        });
    },
    
    /**
     * Rimuove tutti i modelli dalla scena
     */
    clearAllModels: function() {
        this.loadedModels.forEach(model => {
            this.scene.remove(model);
            // Libera la memoria dei materiali e geometrie
            this.disposeModel(model);
        });
        
        this.loadedModels = [];
        this.currentModel = null;
        
        AppConfig.log(2, 'Tutti i modelli rimossi dalla scena');
    },
    
    /**
     * Libera la memoria di un modello (importante per le performance)
     */
    disposeModel: function(model) {
        model.traverse(function(child) {
            if (child.geometry) {
                child.geometry.dispose();
            }
            if (child.material) {
                // Controlla se map esiste e ha la funzione dispose
                if (child.material.map && typeof child.material.map.dispose === 'function') {
                    child.material.map.dispose();
                }
                // Controlla se il materiale ha la funzione dispose
                if (typeof child.material.dispose === 'function') {
                    child.material.dispose();
                }
            }
        });
    },
    
    /**
     * Adatta la vista per inquadrare il modello
     */
    fitModelToView: function(model) {
        // Calcola il bounding box del modello
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        // Calcola la distanza necessaria per inquadrare tutto
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        
        // Aggiunge un po' di margine
        cameraZ *= 1.5;
        
        // Assicurati che la distanza calcolata rientri nei limiti di zoom
        const minDistance = 1.0;
        const maxDistance = 10.0;
        cameraZ = Math.max(minDistance, Math.min(maxDistance, cameraZ));
        
        // Posiziona la camera
        this.camera.position.set(center.x, center.y, center.z + cameraZ);
        this.camera.lookAt(center);
        
        console.log('📐 Vista adattata al modello:', {
            size: size,
            center: center,
            cameraZ: cameraZ,
            cameraPosition: this.camera.position
        });
        
        AppConfig.log(3, 'Vista adattata al modello', {
            boundingBox: { size, center },
            cameraPosition: this.camera.position
        });
    },
    
    /**
     * Adatta la vista per inquadrare tutti i modelli caricati
     * Esclude automaticamente i modelli di pavimento dal calcolo
     */
    fitAllModelsToView: function() {
        if (this.loadedModels.length === 0) return;
        
        // Filtra i modelli escludendo quelli che contengono "pavimento" nel nome
        const modelsForFitting = this.loadedModels.filter(model => {
            // Controlla il nome del modello o userData per identificare il pavimento
            const modelName = (model.userData && model.userData.originalFilename) || model.name || '';
            const isPavimento = modelName.toLowerCase().includes('pavimento');
            
            if (isPavimento) {
                console.log('🏠 Pavimento escluso dal calcolo auto-zoom:', modelName);
            }
            
            return !isPavimento;
        });
        
        if (modelsForFitting.length === 0) {
            console.log('⚠️ Nessun modello da fittare (solo pavimenti presenti)');
            return;
        }
        
        // Calcola il bounding box solo sui modelli filtrati
        const box = new THREE.Box3();
        modelsForFitting.forEach(model => {
            box.expandByObject(model);
        });
        
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        // Calcola la distanza necessaria per inquadrare tutto
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        
        // Aggiunge margine extra per modelli multipli
        cameraZ *= 2.0;
        
        // Assicurati che la distanza rientri nei limiti di zoom
        const minDistance = 1.0;
        const maxDistance = 10.0;
        cameraZ = Math.max(minDistance, Math.min(maxDistance, cameraZ));
        
        // Posiziona la camera
        this.camera.position.set(center.x, center.y, center.z + cameraZ);
        this.camera.lookAt(center);
        
        console.log('📐 Vista adattata ai modelli (escluso pavimento):', {
            modelliTotali: this.loadedModels.length,
            modelliUsatiPerFitting: modelsForFitting.length,
            size: size,
            center: center,
            cameraZ: cameraZ
        });
    },
    
    /* ===== CONTROLLO VISIBILITÀ MODELLI ===== */
    
    /**
     * Mostra/nasconde un modello specifico
     */
    toggleModelVisibility: function(modelIndex) {
        if (modelIndex < 0 || modelIndex >= this.loadedModels.length) {
            console.warn(`Indice modello non valido: ${modelIndex}`);
            return;
        }
        
        const model = this.loadedModels[modelIndex];
        model.visible = !model.visible;
        
        console.log(`🔄 Modello ${modelIndex + 1} ${model.visible ? 'visibile' : 'nascosto'}`);
        return model.visible;
    },
    
    /**
     * Imposta la visibilità di un modello specifico
     */
    setModelVisibility: function(modelIndex, visible) {
        if (modelIndex < 0 || modelIndex >= this.loadedModels.length) {
            console.warn(`Indice modello non valido: ${modelIndex}`);
            return;
        }
        
        const model = this.loadedModels[modelIndex];
        model.visible = visible;
        
        console.log(`👁️ Modello ${modelIndex + 1} ${visible ? 'mostrato' : 'nascosto'}`);
        return model.visible;
    },
    
    /**
     * Restituisce informazioni sui modelli caricati
     */
    getModelsInfo: function() {
        return this.loadedModels.map((model, index) => {
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            
            return {
                index: index,
                visible: model.visible,
                name: model.name || `Modello ${index + 1}`,
                position: model.position,
                size: size,
                center: center,
                boundingBox: { min: box.min, max: box.max }
            };
        });
    },

    /* ===== VISTA E RESET ===== */
    
    /**
     * Salva la vista corrente
     */
    saveCurrentView: function() {
        this.savedView = {
            position: this.camera.position.clone(),
            rotation: this.camera.rotation.clone(),
            zoom: this.camera.zoom
        };
        
        // Inizializza i target di interpolazione con la posizione corrente
        const currentSpherical = new THREE.Spherical();
        currentSpherical.setFromVector3(this.camera.position);
        
        this.mouseControls.interpolation.targetRotation.theta = currentSpherical.theta;
        this.mouseControls.interpolation.targetRotation.phi = currentSpherical.phi;
        this.mouseControls.interpolation.targetZoom = currentSpherical.radius;
        
        AppConfig.log(3, 'Vista corrente salvata e target interpolazione inizializzati');
    },
    
    /**
     * Ripristina la vista salvata
     */
    restoreView: function() {
        if (this.savedView) {
            this.camera.position.copy(this.savedView.position);
            this.camera.rotation.copy(this.savedView.rotation);
            this.camera.zoom = this.savedView.zoom;
            this.camera.updateProjectionMatrix();
            
            // Aggiorna anche i target di interpolazione
            const currentSpherical = new THREE.Spherical();
            currentSpherical.setFromVector3(this.camera.position);
            
            this.mouseControls.interpolation.targetRotation.theta = currentSpherical.theta;
            this.mouseControls.interpolation.targetRotation.phi = currentSpherical.phi;
            this.mouseControls.interpolation.targetZoom = currentSpherical.radius;
            
            AppConfig.log(3, 'Vista ripristinata e target interpolazione aggiornati');
        }
    },
    resetView: function() {
        if (!this.savedView) {
            AppConfig.log(1, 'Nessuna vista salvata da ripristinare');
            return;
        }
        
        this.camera.position.copy(this.savedView.position);
        this.camera.rotation.copy(this.savedView.rotation);
        this.camera.zoom = this.savedView.zoom;
        
        AppConfig.log(2, 'Vista ripristinata');
    },
    
    /* ===== RENDERING ===== */
    
    /**
     * Avvia il loop di rendering
     */
    startRenderLoop: function() {
        const animate = () => {
            requestAnimationFrame(animate);
            this.render();
        };
        
        animate();
        AppConfig.log(3, 'Loop di rendering avviato');
    },
    
    /**
     * Renderizza la scena
     */
    render: function() {
        if (this.scene && this.camera && this.renderer) {
            // Aggiorna interpolazioni camera
            this.updateCameraInterpolation();
            
            // Aggiorna animazioni
            this.updateAnimations();
            
            // Renderizza scena
            this.renderer.render(this.scene, this.camera);
        }
    },
    
    /* ===== GESTIONE RESIZE ===== */
    
    /**
     * Aggiorna le dimensioni quando la finestra cambia
     */
    onWindowResize: function() {
        // Verifica che camera e renderer siano inizializzati
        if (!this.camera || !this.renderer) {
            console.warn('⚠️ Scene3D non ancora inizializzata, ignoro resize');
            return;
        }
        
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // Aggiorna camera
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        // Aggiorna renderer
        this.renderer.setSize(width, height);
        
        if (window.AppConfig) {
            AppConfig.log(3, 'Dimensioni aggiornate', { width, height });
        }
    },
    
    /* ===== SISTEMA ANIMAZIONI ===== */
    
    /**
     * Avvia un'animazione per un modello basata sullo step tutorial
     */
    startModelAnimation: function(model, tutorialStep) {
        const modelFilename = model.userData?.originalFilename || model.name;
        console.log(`🎬 DEBUG startModelAnimation per: "${modelFilename}"`);
        console.log(`🎬 Direzioni memorizzate:`, this.animationSystem.modelDirections);
        console.log(`🎬 Direzione specifica per "${modelFilename}":`, this.animationSystem.modelDirections[modelFilename]);
        console.log(`🎬 Step tutorial:`, tutorialStep);
        
        const direction = this.animationSystem.modelDirections[modelFilename];
        console.log(`🎬 Direction da usare:`, direction);
        
        if (!direction) {
            console.log(`❌ Nessuna direzione configurata per "${modelFilename}"`);
            console.log(`❌ Keys disponibili:`, Object.keys(this.animationSystem.modelDirections));
            AppConfig.log(1, `❌ Nessuna direzione configurata per ${modelFilename}`);
            return;
        }
        
        const action = tutorialStep.properties.Azione;
        if (!action) {
            AppConfig.log(1, `❌ Nessuna azione specificata nello step`);
            return;
        }
        
        // TEMPORANEO: Disabilito il sistema Group e uso rotazione diretta
        let targetModel = model;
        let modelCenter = null;
        
        // Calcola il centro per debug ma non creare Groups
        if (action.toLowerCase() === 'svita' || action.toLowerCase() === 'avvita') {
            modelCenter = this.calculateModelCenter(model);
            console.log(`📐 Model center calculated for ${model.userData?.originalFilename}: (${modelCenter.x.toFixed(3)}, ${modelCenter.y.toFixed(3)}, ${modelCenter.z.toFixed(3)})`);
        }
        
        console.log(`📐 Using direct model animation for ${model.userData?.originalFilename} (action: ${action})`);
        console.log(`📐 Model current position: (${model.position.x.toFixed(3)}, ${model.position.y.toFixed(3)}, ${model.position.z.toFixed(3)})`);
        
        // Crea configurazione animazione
        // Durata più lunga per azioni con rotazione (svita/avvita)
        const duration = (action.toLowerCase() === 'svita' || action.toLowerCase() === 'avvita') ? 4.5 : 3.0;
        
        const animConfig = {
            model: targetModel, // Usa il Group per rotazioni, o il modello diretto per altri
            originalModel: model, // Riferimento al modello originale
            action: action,
            direction: new THREE.Vector3(direction.x, direction.y, direction.z),
            duration: duration, // 4.5s per svita/avvita, 3.0s per altri
            startTime: performance.now(),
            initialPosition: targetModel.position.clone(),
            initialRotation: targetModel.rotation.clone(),
            modelCenter: modelCenter, // Centro geometrico per rotazioni
            targetPosition: null,
            targetRotation: null,
            finished: false
        };
        
        // Calcola posizioni e rotazioni target basate sull'azione
        this.calculateAnimationTargets(animConfig, tutorialStep);
        
        // Aggiungi all'array delle animazioni attive
        this.animationSystem.activeAnimations.push(animConfig);
        
        AppConfig.log(2, `🎬 Animazione avviata: ${action} per ${modelFilename}`, {
            direction: direction,
            duration: animConfig.duration,
            initialPos: animConfig.initialPosition,
            targetPos: animConfig.targetPosition
        });
    },
    
    /**
     * Calcola le posizioni e rotazioni target per l'animazione
     */
    calculateAnimationTargets: function(animConfig, tutorialStep) {
        const { action, direction, initialPosition, initialRotation } = animConfig;
        // Distanza da tutorial step o default
        const movementDistance = parseFloat(tutorialStep.properties.Distanza) || 1.5;
        
        console.log(`🎯 calculateAnimationTargets - Action: ${action}`);
        console.log(`🎯 Direction vector:`, direction);
        console.log(`🎯 Initial position:`, initialPosition);
        console.log(`🎯 Movement distance:`, movementDistance);
        
        // Calcola movimento lineare
        let targetPosition;
        let targetRotation = initialRotation.clone();
        
        switch (action.toLowerCase()) {
            case 'estrai':
                // Sposta lungo la direzione
                targetPosition = initialPosition.clone().add(direction.clone().multiplyScalar(movementDistance));
                break;
                
            case 'inserisci':
                // Sposta nella direzione opposta (verso l'origine)
                targetPosition = initialPosition.clone().add(direction.clone().multiplyScalar(-movementDistance));
                break;
                
            case 'svita':
                // Estrai + rotazione antioraria attorno all'asse del movimento
                const movement = direction.clone().multiplyScalar(movementDistance);
                targetPosition = initialPosition.clone().add(movement);
                
                console.log(`🎯 SVITA - Movement vector:`, movement);
                console.log(`🎯 SVITA - Target position:`, targetPosition);
                console.log(`🎯 SVITA - Direction:`, direction);
                console.log(`🎯 SVITA - About to call applyRotationBasedOnDirection...`);
                
                // Calcola l'asse di rotazione basato sulla direzione del movimento
                this.applyRotationBasedOnDirection(targetRotation, direction, -Math.PI * 6); // 1080° orario
                console.log(`🎯 SVITA - applyRotationBasedOnDirection completed!`);
                break;
                
            case 'avvita':
                // Inserisci + rotazione oraria attorno all'asse del movimento
                targetPosition = initialPosition.clone().add(direction.clone().multiplyScalar(-movementDistance));
                
                console.log(`🎯 AVVITA - Direction:`, direction);
                console.log(`🎯 AVVITA - About to call applyRotationBasedOnDirection...`);
                
                // Calcola l'asse di rotazione basato sulla direzione del movimento
                this.applyRotationBasedOnDirection(targetRotation, direction, Math.PI * 6); // 1080° antiorario
                console.log(`🎯 AVVITA - applyRotationBasedOnDirection completed!`);
                break;
                
            default:
                AppConfig.log(1, `❌ Azione non riconosciuta: ${action}`);
                targetPosition = initialPosition.clone();
                break;
        }
        
        animConfig.targetPosition = targetPosition;
        animConfig.targetRotation = targetRotation;
    },
    
    /**
     * Calcola il centro geometrico di un modello 3D in coordinate locali
     */
    calculateModelCenter: function(model) {
        // Salva la posizione originale
        const originalPosition = model.position.clone();
        
        // Temporaneamente sposta il modello all'origine per calcolare il centro locale
        model.position.set(0, 0, 0);
        
        const boundingBox = new THREE.Box3().setFromObject(model);
        const center = new THREE.Vector3();
        boundingBox.getCenter(center);
        
        // Ripristina la posizione originale
        model.position.copy(originalPosition);
        
        console.log(`📐 Local center for ${model.userData?.originalFilename}: `, center);
        console.log(`📐 Model position: `, model.position);
        
        // Ritorna il centro in coordinate locali
        return center;
    },
    
    /**
     * Crea un Group che serve come pivot point per la rotazione
     * Il modello viene spostato nel Group in modo che ruoti attorno al centro geometrico
     */
    createPivotGroup: function(model) {
        const modelName = model.userData?.originalFilename || model.name;
        
        // Calcola il centro geometrico locale
        const localCenter = this.calculateModelCenter(model);
        const modelPosition = model.position.clone();
        
        console.log(`📐 DEBUG ${modelName}:`);
        console.log(`   📍 Original model position: (${modelPosition.x.toFixed(3)}, ${modelPosition.y.toFixed(3)}, ${modelPosition.z.toFixed(3)})`);
        console.log(`   🎯 Model center (local): (${localCenter.x.toFixed(3)}, ${localCenter.y.toFixed(3)}, ${localCenter.z.toFixed(3)})`);
        
        // Crea il Group che fungerà da pivot
        const pivotGroup = new THREE.Group();
        
        // Posiziona il Group dove era il modello originale
        pivotGroup.position.copy(modelPosition);
        console.log(`   📦 Group position: (${pivotGroup.position.x.toFixed(3)}, ${pivotGroup.position.y.toFixed(3)}, ${pivotGroup.position.z.toFixed(3)})`);
        
        // Rimuovi il modello dalla scena (se è nella scena)
        if (model.parent) {
            console.log(`   🔄 Removing model from parent: ${model.parent.type}`);
            model.parent.remove(model);
        }
        
        // Sposta il modello nel Group, offset per centrare la rotazione
        // Il modello va posizionato nel Group in modo che il suo centro geometrico
        // coincida con l'origine del Group (0,0,0)
        model.position.copy(localCenter.clone().negate());
        console.log(`   🔧 Model offset in group: (${model.position.x.toFixed(3)}, ${model.position.y.toFixed(3)}, ${model.position.z.toFixed(3)})`);
        
        pivotGroup.add(model);
        
        // Aggiungi il Group alla scena
        this.scene.add(pivotGroup);
        
        console.log(`   ✅ Pivot Group created and added to scene`);
        
        return {
            group: pivotGroup,
            center: localCenter,
            originalModel: model
        };
    },
    
    /**
     * Applica la rotazione all'asse principale basato sulla direzione del movimento
     * Per le viti, ruotiamo attorno all'asse del movimento (asse longitudinale della vite)
     */
    applyRotationBasedOnDirection: function(targetRotation, direction, rotationAmount) {
        // Normalizza la direzione per determinare l'asse principale
        const normalizedDir = direction.clone().normalize();
        
        // Determina quale asse è predominante nella direzione
        const absX = Math.abs(normalizedDir.x);
        const absY = Math.abs(normalizedDir.y);
        const absZ = Math.abs(normalizedDir.z);
        
        console.log(`🔄 Direction analysis: X=${normalizedDir.x.toFixed(2)}, Y=${normalizedDir.y.toFixed(2)}, Z=${normalizedDir.z.toFixed(2)}`);
        console.log(`🔄 Abs values: absX=${absX.toFixed(2)}, absY=${absY.toFixed(2)}, absZ=${absZ.toFixed(2)}`);
        console.log(`🔄 Rotation amount: ${rotationAmount} rad = ${(rotationAmount * 180 / Math.PI).toFixed(0)}°`);
        
        // Per debug, stampiamo la rotazione iniziale
        console.log(`🔄 Initial rotation: X=${targetRotation.x.toFixed(2)}, Y=${targetRotation.y.toFixed(2)}, Z=${targetRotation.z.toFixed(2)}`);
        
        // Applica la rotazione all'asse principale del movimento
        if (absX > absY && absX > absZ) {
            // Movimento principalmente lungo X -> ruota attorno X
            targetRotation.x += rotationAmount;
            console.log(`🔄 ✅ Rotating around X axis: ${(rotationAmount * 180 / Math.PI).toFixed(0)}°`);
            console.log(`🔄 Final rotation X: ${targetRotation.x.toFixed(2)} rad = ${(targetRotation.x * 180 / Math.PI).toFixed(0)}°`);
        } else if (absY > absX && absY > absZ) {
            // Movimento principalmente lungo Y -> ruota attorno Y  
            targetRotation.y += rotationAmount;
            console.log(`🔄 ✅ Rotating around Y axis: ${(rotationAmount * 180 / Math.PI).toFixed(0)}°`);
            console.log(`🔄 Final rotation Y: ${targetRotation.y.toFixed(2)} rad = ${(targetRotation.y * 180 / Math.PI).toFixed(0)}°`);
        } else {
            // Movimento principalmente lungo Z -> ruota attorno Z
            targetRotation.z += rotationAmount;
            console.log(`🔄 ✅ Rotating around Z axis: ${(rotationAmount * 180 / Math.PI).toFixed(0)}°`);
            console.log(`🔄 Final rotation Z: ${targetRotation.z.toFixed(2)} rad = ${(targetRotation.z * 180 / Math.PI).toFixed(0)}°`);
        }
        
        console.log(`🔄 Final target rotation: X=${targetRotation.x.toFixed(2)}, Y=${targetRotation.y.toFixed(2)}, Z=${targetRotation.z.toFixed(2)}`);
    },
    
    /**
     * Applica rotazione attorno al centro geometrico usando matrici di trasformazione
     * Approccio: T(pivot) * R(rotation) * T(-pivot) * T(linear_movement)
     */
    applyRotationAroundCenter: function(anim, progress) {
        // Calcola rotazione corrente
        const currentRotation = new THREE.Euler(
            anim.initialRotation.x + (anim.targetRotation.x - anim.initialRotation.x) * progress,
            anim.initialRotation.y + (anim.targetRotation.y - anim.initialRotation.y) * progress,
            anim.initialRotation.z + (anim.targetRotation.z - anim.initialRotation.z) * progress
        );
        
        // Calcola movimento lineare target
        const linearMovement = new THREE.Vector3().lerpVectors(anim.initialPosition, anim.targetPosition, progress);
        
        if (anim.modelCenter && anim.modelCenter.length() > 0.001) {
            // Rotazione attorno al centro geometrico usando matrici
            const pivot = anim.modelCenter; // Centro geometrico locale
            
            // Crea la matrice di trasformazione completa
            const matrix = new THREE.Matrix4();
            
            // 1. Trasla al pivot point (in coordinate negative per portarlo all'origine)
            matrix.makeTranslation(-pivot.x, -pivot.y, -pivot.z);
            
            // 2. Applica la rotazione
            const rotationMatrix = new THREE.Matrix4();
            rotationMatrix.makeRotationFromEuler(currentRotation);
            matrix.premultiply(rotationMatrix);
            
            // 3. Trasla indietro dal pivot
            const translateBack = new THREE.Matrix4();
            translateBack.makeTranslation(pivot.x, pivot.y, pivot.z);
            matrix.premultiply(translateBack);
            
            // 4. Applica la trasformazione al modello
            // Inizia dalla posizione iniziale e applica la matrice
            const transformedPosition = anim.initialPosition.clone();
            transformedPosition.applyMatrix4(matrix);
            
            // 5. Aggiungi il movimento lineare
            const finalPosition = linearMovement.clone();
            const offset = transformedPosition.clone().sub(anim.initialPosition);
            finalPosition.add(offset);
            
            // Applica le trasformazioni finali
            anim.model.position.copy(finalPosition);
            anim.model.rotation.copy(currentRotation);
            
            // Debug ogni 25%
            if (Math.floor(progress * 4) !== Math.floor((anim.lastProgressLogged || 0) * 4)) {
                anim.lastProgressLogged = progress;
                const modelName = anim.originalModel?.userData?.originalFilename || 'unknown';
                console.log(`🔄 ${modelName}: ${(progress * 100).toFixed(0)}% - pivot: (${pivot.x.toFixed(2)}, ${pivot.y.toFixed(2)}, ${pivot.z.toFixed(2)}) - pos: (${finalPosition.x.toFixed(2)}, ${finalPosition.y.toFixed(2)}, ${finalPosition.z.toFixed(2)})`);
            }
        } else {
            // Fallback: rotazione normale senza pivot
            anim.model.rotation.copy(currentRotation);
            anim.model.position.copy(linearMovement);
        }
    },
    
    /**
     * Aggiorna tutte le animazioni attive (chiamato nel loop di rendering)
     */
    updateAnimations: function() {
        if (this.animationSystem.activeAnimations.length === 0) return;
        
        const currentTime = performance.now();
        
        // Aggiorna ogni animazione
        for (let i = this.animationSystem.activeAnimations.length - 1; i >= 0; i--) {
            const anim = this.animationSystem.activeAnimations[i];
            
            if (anim.finished) {
                // Rimuovi animazioni completate
                this.animationSystem.activeAnimations.splice(i, 1);
                continue;
            }
            
            // Calcola progresso dell'animazione (0-1)
            const elapsed = (currentTime - anim.startTime) / 1000; // in secondi
            let progress = Math.min(elapsed / anim.duration, 1.0);
            
            // Applica easing (smooth acceleration/deceleration)
            progress = this.smoothStep(progress);
            
            // Interpolazione posizione
            if (anim.targetPosition) {
                anim.model.position.lerpVectors(anim.initialPosition, anim.targetPosition, progress);
            }
            
            // Interpolazione rotazione
            if (anim.targetRotation) {
                // Per azioni con rotazione (svita/avvita) usiamo rotazione attorno al centro geometrico
                if (anim.action === 'svita' || anim.action === 'avvita') {
                    this.applyRotationAroundCenter(anim, progress);
                    
                    // Debug più frequente per svita/avvita
                    if (Math.floor(currentTime / 50) !== Math.floor(anim.lastDebugTime || 0 / 50)) {
                        anim.lastDebugTime = currentTime;
                        const modelName = anim.model.userData?.originalFilename || anim.model.name;
                        console.log(`🎬 SVITA/AVVITA ${modelName}: progress=${progress.toFixed(2)}, rotation=(${anim.model.rotation.x.toFixed(2)}, ${anim.model.rotation.y.toFixed(2)}, ${anim.model.rotation.z.toFixed(2)})`);
                    }
                } else {
                    // Per altre azioni usiamo slerp per un'interpolazione più smooth
                    const tempQuaternion1 = new THREE.Quaternion().setFromEuler(anim.initialRotation);
                    const tempQuaternion2 = new THREE.Quaternion().setFromEuler(anim.targetRotation);
                    const resultQuaternion = tempQuaternion1.slerp(tempQuaternion2, progress);
                    anim.model.setRotationFromQuaternion(resultQuaternion);
                }
            }
            
            // Segna come completata se raggiunto il 100%
            if (progress >= 1.0) {
                anim.finished = true;
                
                const modelName = anim.model.userData?.originalFilename || anim.model.name;
                AppConfig.log(2, `✅ Animazione completata: ${anim.action} per ${modelName}`);
                
                // NUOVO: Marca lo step corrente come completato
                if (window.UI && window.UI.currentStepIndex !== undefined) {
                    this.markStepAsCompleted(window.UI.currentStepIndex);
                }
                
                // Auto-avanza al prossimo step del tutorial se disponibile
                this.advanceToNextTutorialStep();
            }
        }
    },
    
    /**
     * Funzione di easing smooth step (accelerazione e decelerazione graduale)
     * Implementa la curva smoothstep: 3t² - 2t³
     */
    smoothStep: function(t) {
        // Clamp tra 0 e 1
        t = Math.max(0, Math.min(1, t));
        
        // Smooth step formula
        return t * t * (3 - 2 * t);
    },
    
    /**
     * Avanza automaticamente al prossimo step del tutorial
     */
    advanceToNextTutorialStep: function() {
        if (!window.UI || !window.UI.tutorialSteps) {
            AppConfig.log(3, '🎯 Nessun sistema tutorial disponibile per auto-avanzamento');
            return;
        }
        
        const currentIndex = window.UI.currentStepIndex;
        const totalSteps = window.UI.tutorialSteps.length;
        
        if (currentIndex < totalSteps - 1) {
            AppConfig.log(2, `🎯 Auto-avanzamento da step ${currentIndex + 1} a step ${currentIndex + 2}`);
            
            // Avanza immediatamente al prossimo step
            setTimeout(() => {
                if (window.UI && window.UI.goToStep) {
                    window.UI.goToStep(currentIndex + 1);
                }
            }, 100); // Solo 0.1 secondi per vedere l'animazione completata
        } else {
            AppConfig.log(2, `🎯 Tutorial completato! Step ${currentIndex + 1}/${totalSteps}`);
        }
    },
    
    /**
     * Ferma tutte le animazioni in corso
     */
    stopAllAnimations: function() {
        this.animationSystem.activeAnimations.forEach(anim => {
            anim.finished = true;
        });
        this.animationSystem.activeAnimations = [];
        
        AppConfig.log(2, '⏹️ Tutte le animazioni fermate');
    },
    
    /**
     * Verifica se un modello ha un'animazione in corso
     */
    isModelAnimating: function(model) {
        return this.animationSystem.activeAnimations.some(anim => anim.model === model);
    },
    
    /* ===== FUNZIONI DI DEBUG E TEST ===== */
    
    /**
     * Evidenzia un modello casuale per test (solo per debug)
     * @param {number} duration - Durata opzionale in millisecondi
     */
    testHighlight: function(duration = null) {
        if (this.loadedModels.length === 0) {
            console.log('🔴 Nessun modello caricato per il test evidenziazione');
            return;
        }
        
        const randomIndex = Math.floor(Math.random() * this.loadedModels.length);
        const randomModel = this.loadedModels[randomIndex];
        
        if (duration) {
            console.log(`🔴 TEST: Evidenziazione modello casuale #${randomIndex} per ${duration}ms: ${randomModel.userData?.originalFilename || randomModel.name}`);
        } else {
            console.log(`🔴 TEST: Evidenziazione modello casuale #${randomIndex} (fino al click): ${randomModel.userData?.originalFilename || randomModel.name}`);
        }
        
        this.highlightModel(randomModel, duration);
    },
    
    /**
     * Test per verificare la logica del tool corretto
     */
    testToolLogic: function() {
        const currentStep = this.getCurrentTutorialStep();
        const requiredTool = this.getRequiredToolForStep(currentStep);
        const activeTool = window.UI ? window.UI.getActiveTool() : null;
        
        console.log('🔧 === TEST TOOL LOGIC ===');
        console.log('🔧 Step corrente:', currentStep?.properties?.Utensile || 'Nessuno');
        console.log('🔧 Tool richiesto:', requiredTool);
        console.log('🔧 Tool attivo:', activeTool);
        console.log('🔧 Match:', requiredTool === activeTool);
        console.log('🔧 Evidenziazione attiva:', this.highlightSystem.isHighlighting);
        
        if (this.highlightSystem.isHighlighting) {
            console.log('🔧 Modello evidenziato:', this.highlightSystem.highlightedModel?.userData?.originalFilename || this.highlightSystem.highlightedModel?.name);
        }
        
        return {
            currentStep: currentStep,
            requiredTool: requiredTool,
            activeTool: activeTool,
            isMatch: requiredTool === activeTool,
            isHighlighting: this.highlightSystem.isHighlighting
        };
    },
    
    /**
     * Test per verificare il sistema di completamento tutorial
     */
    testTutorialCompletion: function() {
        const currentStepIndex = window.UI ? window.UI.currentStepIndex : null;
        const totalSteps = window.UI ? window.UI.tutorialSteps?.length : 0;
        const isLastStep = currentStepIndex !== null ? this.isLastTutorialStep(currentStepIndex) : false;
        
        console.log('🏁 === TEST TUTORIAL COMPLETION ===');
        console.log('🏁 Step corrente:', currentStepIndex !== null ? currentStepIndex + 1 : 'Nessuno');
        console.log('🏁 Totale steps:', totalSteps);
        console.log('🏁 È ultimo step:', isLastStep);
        console.log('🏁 Ultimo step completato:', this.tutorialTracker.lastStepCompleted);
        console.log('🏁 Steps completati:', Array.from(this.tutorialTracker.completedSteps).map(i => i + 1));
        
        return {
            currentStepIndex: currentStepIndex,
            totalSteps: totalSteps,
            isLastStep: isLastStep,
            lastStepCompleted: this.tutorialTracker.lastStepCompleted,
            completedSteps: Array.from(this.tutorialTracker.completedSteps)
        };
    }
};

// Aggiungi listener per resize della finestra
window.addEventListener('resize', function() {
    if (window.Scene3D && window.Scene3D.onWindowResize) {
        window.Scene3D.onWindowResize();
    }
});