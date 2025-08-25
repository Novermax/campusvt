/**
 * SCENE3D.JS - Gestione della scena 3D
 * 
 * Questo modulo gestisce:
 * - Inizializzazione della scena Three.js
 * - Configurazione camera, renderer e luci
 * - Caricamento e gestione modelli 3D
 * - Controlli camera e interazione mouse
 * - Auto-fit e zoom automatico sui modelli
 */

/* ===== VARIABILI GLOBALI SCENA ===== */
window.Scene3D = {
    // Oggetti Three.js principali
    scene: null,                    // La scena 3D principale
    camera: null,                   // Camera prospettica
    renderer: null,                 // Renderer WebGL
    
    // Array modelli caricati
    loadedModels: [],              // Lista di tutti i modelli caricati
    currentModel: null,            // Riferimento al modello attivo
    
    // Controlli e interazione
    mouseControls: {
        isMouseDown: false,        // Stato pulsante mouse
        mouseButton: 0,            // Quale pulsante è premuto (0=sinistra, 2=destra)
        lastPosition: { x: 0, y: 0 }, // Ultima posizione mouse
        sensitivity: {
            rotation: 0.01,        // Sensibilità rotazione
            pan: 0.002,            // Sensibilità spostamento
            zoom: 0.005            // Sensibilità zoom (molto ridotta per controllo fine)
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
        this.renderer.toneMappingExposure = 1;
        
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
        
        // Previene selezione testo
        event.preventDefault();
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
            // Tasto sinistro: Pan (sposta la vista)
            this.panCamera(deltaX, deltaY);
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
        this.mouseControls.isMouseDown = false;
    },
    
    /**
     * Gestisce l'evento wheel (zoom)
     */
    onMouseWheel: function(event) {
        const delta = event.deltaY * this.mouseControls.sensitivity.zoom;
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
     * Sposta la camera (pan)
     */
    panCamera: function(deltaX, deltaY) {
        const sensitivity = this.mouseControls.sensitivity.pan;
        
        // Calcola la direzione di movimento basata sull'orientamento della camera
        const vector = new THREE.Vector3();
        vector.setFromMatrixColumn(this.camera.matrix, 0); // Vettore destra
        vector.multiplyScalar(-deltaX * sensitivity);
        
        const vector2 = new THREE.Vector3();
        vector2.setFromMatrixColumn(this.camera.matrix, 1); // Vettore su
        vector2.multiplyScalar(deltaY * sensitivity);
        
        vector.add(vector2);
        this.camera.position.add(vector);
    },
    
    /**
     * Ruota la camera attorno all'origine
     */
    rotateCamera: function(deltaX, deltaY) {
        const sensitivity = this.mouseControls.sensitivity.rotation;
        
        // Rotazione orizzontale (attorno all'asse Y)
        const spherical = new THREE.Spherical();
        spherical.setFromVector3(this.camera.position);
        spherical.theta -= deltaX * sensitivity;
        spherical.phi += deltaY * sensitivity;
        
        // Limita l'angolo verticale per evitare gimbal lock
        spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
        
        this.camera.position.setFromSpherical(spherical);
        this.camera.lookAt(0, 0, 0);
    },
    
    /**
     * Zoom della camera
     */
    zoomCamera: function(delta) {
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        direction.multiplyScalar(delta);
        this.camera.position.add(direction);
        
        // Limita la distanza minima e massima per controllare lo zoom
        const distance = this.camera.position.length();
        const minDistance = 1.0;  // Zoom minimo (più vicino)
        const maxDistance = 10.0; // Zoom massimo (più lontano)
        
        if (distance < minDistance) {
            this.camera.position.normalize().multiplyScalar(minDistance);
        } else if (distance > maxDistance) {
            this.camera.position.normalize().multiplyScalar(maxDistance);
        }
    },
    
    /* ===== GESTIONE MODELLI ===== */
    
    /**
     * Aggiunge un modello alla scena
     */
    addModel: function(model) {
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
     */
    fitAllModelsToView: function() {
        if (this.loadedModels.length === 0) return;
        
        // Calcola il bounding box di tutti i modelli
        const box = new THREE.Box3();
        this.loadedModels.forEach(model => {
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
        
        console.log('📐 Vista adattata a tutti i modelli:', {
            modelli: this.loadedModels.length,
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
        
        AppConfig.log(3, 'Vista corrente salvata');
    },
    
    /**
     * Ripristina la vista salvata
     */
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
    }
};

// Aggiungi listener per resize della finestra
window.addEventListener('resize', function() {
    if (window.Scene3D && window.Scene3D.onWindowResize) {
        window.Scene3D.onWindowResize();
    }
});