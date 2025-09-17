/**
 * SCENE3D MODULAR LOADER
 * VERSION: 1000010 - Modular Architecture Compatibility Layer
 */

const Scene3D = {
    scene: null,
    camera: null,
    renderer: null,
    canvas: null,
    
    cameraControls: null,
    modelManager: null,
    animationSystem: null,
    highlightSystem: null,
    
    isInitialized: false,
    manualCameraSet: false,
    savedView: null,
    
    raycaster: null,
    mouse: null,
    
    loadedModels: [],
    currentModel: null,
    animationSystem: {
        activeAnimations: [],
        modelDirections: {},
        clickEnabled: true,
        multiStepAnimations: new Map()
    },
    highlightSystem: {
        highlightedModel: null,
        originalMaterials: new Map(),
        highlightMaterial: null,
        highlightTimer: null,
        isHighlighting: false
    },
    tutorialTracker: {
        completedSteps: new Set(),
        lastStepCompleted: false,
        interactionsBlocked: false // Blocca interazioni dopo completamento tutorial
    },
    
    // Sistema salvataggio/ripristino posizioni iniziali
    initialModelPositions: new Map(), // UUID -> {position, rotation, scale}
    
    boundingBoxSphere: null,
    rotationCenterSphere: null,
    
    nonSelectableElements: [
        'pavimento', 'piano', 'base', 'superficie', 'ground', 'floor', 'basement', 'sfondo', 'background', 'assi'
    ],
    
    mouseControls: {
        isMouseDown: false,
        mouseButton: 0,
        lastPosition: { x: 0, y: 0 },
        isPanning: false,
        pivotPoint: null, // Inizializzato in init()
        sensitivity: {
            rotation: 0.015,
            pan: 0.020,
            zoom: 0.025
        },
        interpolation: {
            enabled: true,
            factor: 0.02,
            targetRotation: { theta: 0, phi: Math.PI / 2 },
            targetPosition: { x: 0, y: 0, z: 5 },
            targetZoom: 5,
            threshold: 0.001,
            isPanning: false
        },
        limits: {
            minPhi: 0.2,
            maxPhi: Math.PI * 0.45,
            minY: 0.0,
            minZoom: 0.3,
            maxZoom: 15
        }
    },

    init: function() {
        try {
            if (typeof THREE === 'undefined') {
                throw new Error('Three.js not loaded correctly');
            }
            
            // Inizializza oggetti Three.js che richiedono THREE
            this.mouseControls.pivotPoint = new THREE.Vector3(0, 0, 0);
            
            this.canvas = document.getElementById('canvas3d');
            if (!this.canvas) {
                throw new Error('3D Canvas not found in DOM');
            }
            
            this.initScene();
            this.initCamera();
            this.initRenderer();
            this.initLights();
            this.initRaycaster();
            this.initControls();
            this.initSubsystems();
            
            this.startRenderLoop();
            this.saveCurrentView();
            
            this.isInitialized = true;
            console.log('[Scene3D] ✅ Inizializzazione completata');
            
            return true;
            
        } catch (error) {
            console.error('[Scene3D] ❌ Errore inizializzazione:', error.message);
            this.isInitialized = false;
            return false;
        }
    },

    initScene: function() {
        this.scene = new THREE.Scene();
        this.scene.background = null;
    },

    initCamera: function() {
        const config = AppConfig.scene3D.camera;
        const aspect = window.innerWidth / window.innerHeight;
        
        this.camera = new THREE.PerspectiveCamera(
            config.fov,
            aspect,
            config.near,
            config.far
        );
        
        this.camera.position.set(
            config.initialPosition.x,
            config.initialPosition.y,
            config.initialPosition.z
        );
        
        this.camera.lookAt(0, 0, 0);
    },

    initRenderer: function() {
        const config = AppConfig.scene3D.renderer;
        
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: config.antialias,
            alpha: config.alpha
        });
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        if (config.shadowMapEnabled) {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE[config.shadowMapType + 'ShadowMap'];
        }
        
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 2.8;
    },

    initLights: function() {
        const ambientConfig = AppConfig.scene3D.lighting.ambient;
        const directionalConfig = AppConfig.scene3D.lighting.directional;
        
        const ambientLight = new THREE.AmbientLight(
            ambientConfig.color,
            ambientConfig.intensity
        );
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(
            directionalConfig.color,
            directionalConfig.intensity
        );
        
        directionalLight.position.set(
            directionalConfig.position.x,
            directionalConfig.position.y,
            directionalConfig.position.z
        );
        
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        
        this.scene.add(directionalLight);
        
        const backLight = new THREE.DirectionalLight(0xffffff, 0.4);
        backLight.position.set(
            -directionalConfig.position.x,
            directionalConfig.position.y,
            -directionalConfig.position.z
        );
        backLight.castShadow = false;
        this.scene.add(backLight);
    },


    /* ===== CAMERA DEBUG FUNCTIONS ===== */
    getCameraInfo: function() {
        if (!this.camera) {
            console.warn('[Scene3D] 📹 Camera non inizializzata');
            return null;
        }
        
        const cameraInfo = {
            position: {
                x: Math.round(this.camera.position.x * 100) / 100,
                y: Math.round(this.camera.position.y * 100) / 100,
                z: Math.round(this.camera.position.z * 100) / 100
            },
            rotation: {
                x: Math.round(this.camera.rotation.x * 100) / 100,
                y: Math.round(this.camera.rotation.y * 100) / 100,
                z: Math.round(this.camera.rotation.z * 100) / 100
            },
            pivot: this.mouseControls && this.mouseControls.pivotPoint ? {
                x: Math.round(this.mouseControls.pivotPoint.x * 100) / 100,
                y: Math.round(this.mouseControls.pivotPoint.y * 100) / 100,
                z: Math.round(this.mouseControls.pivotPoint.z * 100) / 100
            } : null,
            distance: this.mouseControls && this.mouseControls.pivotPoint ? 
                Math.round(this.camera.position.distanceTo(this.mouseControls.pivotPoint) * 100) / 100 : null,
            fov: this.camera.fov,
            near: this.camera.near,
            far: this.camera.far
        };
        
        console.log('[Scene3D] 📹 CAMERA INFO:');
        console.log('  Position:', `(${cameraInfo.position.x}, ${cameraInfo.position.y}, ${cameraInfo.position.z})`);
        console.log('  Rotation:', `(${cameraInfo.rotation.x}, ${cameraInfo.rotation.y}, ${cameraInfo.rotation.z})`);
        if (cameraInfo.pivot) {
            console.log('  Pivot Point:', `(${cameraInfo.pivot.x}, ${cameraInfo.pivot.y}, ${cameraInfo.pivot.z})`);
            console.log('  Distance to Pivot:', cameraInfo.distance);
        }
        console.log('  FOV:', cameraInfo.fov);
        console.log('  Near/Far:', `${cameraInfo.near}/${cameraInfo.far}`);
        
        // Formatta per tutorial.txt
        console.log('\n📋 TUTORIAL SYNTAX:');
        console.log(`CameraPos=(${cameraInfo.position.x},${cameraInfo.position.y},${cameraInfo.position.z})`);
        if (cameraInfo.pivot) {
            console.log(`CameraTarget=(${cameraInfo.pivot.x},${cameraInfo.pivot.y},${cameraInfo.pivot.z})`);
        }
        
        // Suggerimenti per target con nome oggetto
        console.log('\n💡 ALTERNATIVE CAMERtarget SYNTAX:');
        console.log('CameraTarget=nome_oggetto   # Punta al centro del bounding box dell\'oggetto');
        console.log('Usa Scene3D.listAvailableObjects() per vedere tutti gli oggetti disponibili');
        console.log('\n📝 ESEMPI:');
        console.log('CameraTarget=filtro         # Punta al centro del filtro');
        console.log('CameraTarget=pompa          # Punta al centro della pompa');
        console.log('CameraTarget=(1.5,2.0,0.5)  # Coordinate esatte');
        
        return cameraInfo;
    },
    
    listAvailableObjects: function() {
        if (!this.loadedModels || this.loadedModels.length === 0) {
            console.warn('[Scene3D] 📦 Nessun oggetto caricato nella scena');
            return [];
        }
        
        const objectsList = [];
        
        console.log('[Scene3D] 📦 OGGETTI DISPONIBILI NELLA SCENA:');
        console.log('═'.repeat(50));
        
        this.loadedModels.forEach((model, index) => {
            // Ottieni il nome dell'oggetto
            let objectName = 'unnamed';
            if (model.name) {
                objectName = model.name;
            } else if (model.userData && model.userData.originalFilename) {
                objectName = model.userData.originalFilename.replace(/\.(glb|gltf|obj|stl)$/i, '');
            }
            
            // Calcola il centro del bounding box
            const boundingBox = new THREE.Box3().setFromObject(model);
            const center = boundingBox.getCenter(new THREE.Vector3());
            
            // Calcola le dimensioni
            const size = boundingBox.getSize(new THREE.Vector3());
            
            const objectInfo = {
                name: objectName,
                center: {
                    x: Math.round(center.x * 100) / 100,
                    y: Math.round(center.y * 100) / 100,
                    z: Math.round(center.z * 100) / 100
                },
                size: {
                    x: Math.round(size.x * 100) / 100,
                    y: Math.round(size.y * 100) / 100,
                    z: Math.round(size.z * 100) / 100
                },
                visible: model.visible
            };
            
            objectsList.push(objectInfo);
            
            // Output console
            console.log(`${index + 1}. "${objectName}"`);
            console.log(`   Centro: (${objectInfo.center.x}, ${objectInfo.center.y}, ${objectInfo.center.z})`);
            console.log(`   Dimensioni: ${objectInfo.size.x} × ${objectInfo.size.y} × ${objectInfo.size.z}`);
            console.log(`   Visibile: ${objectInfo.visible ? '✅' : '❌'}`);
            console.log('');
        });
        
        console.log('📝 USO NEI TUTORIAL:');
        objectsList.forEach(obj => {
            if (obj.visible) {
                console.log(`CameraTarget=${obj.name}   # Punta al centro di "${obj.name}"`);
            }
        });
        
        console.log('\n💡 SUGGERIMENTO:');
        console.log('Usa Scene3D.getCameraInfo() per ottenere la posizione camera corrente');
        
        return objectsList;
    },

    initRaycaster: function() {
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
    },

    initControls: function() {
        const canvas = this.canvas;
        
        canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        canvas.addEventListener('wheel', this.onMouseWheel.bind(this));
        
        canvas.addEventListener('touchstart', this.onTouchStart.bind(this));
        canvas.addEventListener('touchmove', this.onTouchMove.bind(this));
        canvas.addEventListener('touchend', this.onTouchEnd.bind(this));
        
        canvas.addEventListener('contextmenu', function(e) {
            e.preventDefault();
        });
    },

    initSubsystems: function() {
        // Inizializza sistema drag & drop se disponibile
        this.dragDropSystem = null;
        if (window.DragDropSystem && window.DragDropSystem.init) {
            try {
                const success = window.DragDropSystem.init(this);
                if (success) {
                    this.dragDropSystem = window.DragDropSystem;
                    console.log('[Scene3D] ✅ DragDropSystem inizializzato');
                } else {
                    console.warn('[Scene3D] ⚠️ DragDropSystem inizializzazione fallita');
                }
            } catch (error) {
                console.warn('[Scene3D] ⚠️ Errore inizializzazione DragDropSystem:', error.message);
            }
        } else {
            console.log('[Scene3D] ℹ️ DragDropSystem non disponibile (opzionale)');
        }
        
        // Inizializza sistema particellare se disponibile
        this.particleSystem = null;
        console.log('[Scene3D] 🔍 DEBUG ParticleSystem - window object keys:', Object.keys(window).filter(k => k.includes('Particle')));
        console.log('[Scene3D] 🔍 DEBUG ParticleSystem - window.ParticleSystem exists:', !!window.ParticleSystem);
        console.log('[Scene3D] 🔍 DEBUG ParticleSystem - full object:', window.ParticleSystem);
        console.log('[Scene3D] 🔍 DEBUG ParticleSystem - init function type:', typeof window.ParticleSystem?.init);

        if (window.ParticleSystem && window.ParticleSystem.init) {
            try {
                console.log('[Scene3D] 🚀 Tentativo inizializzazione ParticleSystem...');
                window.ParticleSystem.init(this.scene, this.camera);
                this.particleSystem = window.ParticleSystem;
                console.log('[Scene3D] ✅ ParticleSystem inizializzato con successo!');
                console.log('[Scene3D] 🔍 ParticleSystem methods:', Object.keys(this.particleSystem));
            } catch (error) {
                console.error('[Scene3D] ❌ Errore inizializzazione ParticleSystem:', error);
                console.error('[Scene3D] ❌ Stack trace:', error.stack);
            }
        } else {
            console.warn('[Scene3D] ⚠️ ParticleSystem NON DISPONIBILE!');
            console.log('[Scene3D] 🔍 window.ParticleSystem value:', window.ParticleSystem);
        }

        // Inizializza sistema assemblaggio se disponibile
        if (window.AssemblySystem && window.AssemblySystem.init) {
            try {
                console.log('[Scene3D] 🏗️ Inizializzazione AssemblySystem...');
                window.AssemblySystem.init(this);
                console.log('[Scene3D] ✅ AssemblySystem inizializzato con successo!');
            } catch (error) {
                console.error('[Scene3D] ❌ Errore inizializzazione AssemblySystem:', error);
            }
        } else {
            console.warn('[Scene3D] ⚠️ AssemblySystem non disponibile');
        }

        this.highlightSystem.highlightMaterial = new THREE.MeshBasicMaterial({
            color: 0xcccc00,
            transparent: true,
            opacity: 0.8,
            wireframe: false,
            side: THREE.DoubleSide,
            depthTest: false,
            depthWrite: false
        });
        
    },

    onMouseDown: function(event) {
        this.mouseControls.isMouseDown = true;
        this.mouseControls.mouseButton = event.button;
        this.mouseControls.lastPosition.x = event.clientX;
        this.mouseControls.lastPosition.y = event.clientY;
        
        event.preventDefault();
        if (event.button === 1) {
            event.stopPropagation();
        }
    },

    onMouseMove: function(event) {
        if (!this.mouseControls.isMouseDown) return;
        
        const deltaX = event.clientX - this.mouseControls.lastPosition.x;
        const deltaY = event.clientY - this.mouseControls.lastPosition.y;
        
        if (this.mouseControls.mouseButton === 2) {
            this.rotateCamera(deltaX, deltaY);
        }
        
        this.mouseControls.lastPosition.x = event.clientX;
        this.mouseControls.lastPosition.y = event.clientY;
    },

    onMouseUp: function(event) {
        if (event.button === 0 && this.animationSystem.clickEnabled) {
            const deltaX = Math.abs(event.clientX - this.mouseControls.lastPosition.x);
            const deltaY = Math.abs(event.clientY - this.mouseControls.lastPosition.y);
            
            if (deltaX < 5 && deltaY < 5) {
                this.handleModelClick(event);
            }
        }
        
        if (event.button === 1) {
            const deltaX = Math.abs(event.clientX - this.mouseControls.lastPosition.x);
            const deltaY = Math.abs(event.clientY - this.mouseControls.lastPosition.y);
            
            if (deltaX < 5 && deltaY < 5) {
                this.handlePivotClick(event);
            }
        }
        
        this.mouseControls.isMouseDown = false;
        this.mouseControls.isPanning = false;
    },

    onMouseWheel: function(event) {
        const rawDelta = event.deltaY;
        const normalizedDelta = rawDelta > 0 ? 100 : -100;
        const delta = normalizedDelta * this.mouseControls.sensitivity.zoom;
        this.zoomCamera(delta);
        event.preventDefault();
    },

    onTouchStart: function(event) {
        if (event.touches.length === 1) {
            this.mouseControls.isMouseDown = true;
            this.mouseControls.lastPosition.x = event.touches[0].clientX;
            this.mouseControls.lastPosition.y = event.touches[0].clientY;
        }
        event.preventDefault();
    },

    onTouchMove: function(event) {
        if (event.touches.length === 1 && this.mouseControls.isMouseDown) {
            const deltaX = event.touches[0].clientX - this.mouseControls.lastPosition.x;
            const deltaY = event.touches[0].clientY - this.mouseControls.lastPosition.y;
            
            this.rotateCamera(deltaX, deltaY);
            
            this.mouseControls.lastPosition.x = event.touches[0].clientX;
            this.mouseControls.lastPosition.y = event.touches[0].clientY;
        }
        event.preventDefault();
    },

    onTouchEnd: function(event) {
        this.mouseControls.isMouseDown = false;
        event.preventDefault();
    },

    rotateCamera: function(deltaX, deltaY) {
        const sensitivity = this.mouseControls.sensitivity.rotation;
        const limits = this.mouseControls.limits;
        const pivotPoint = this.mouseControls.pivotPoint;
        
        const relativePosition = new THREE.Vector3().subVectors(this.camera.position, pivotPoint);
        const spherical = new THREE.Spherical();
        spherical.setFromVector3(relativePosition);
        
        spherical.theta -= deltaX * sensitivity;
        spherical.phi += deltaY * sensitivity;
        
        spherical.phi = Math.max(limits.minPhi, Math.min(limits.maxPhi, spherical.phi));
        
        relativePosition.setFromSpherical(spherical);
        this.camera.position.copy(pivotPoint).add(relativePosition);
        
        // Non interferire con animazione camera se in corso
        if (!this.cameraAnimation || !this.cameraAnimation.isAnimating || !this.cameraAnimation.targetTarget) {
            this.camera.lookAt(pivotPoint);
        }
    },

    zoomCamera: function(delta) {
        const limits = this.mouseControls.limits;
        const pivotPoint = this.mouseControls.pivotPoint;
        
        const relativePosition = new THREE.Vector3().subVectors(this.camera.position, pivotPoint);
        const spherical = new THREE.Spherical();
        spherical.setFromVector3(relativePosition);
        
        const zoomStep = delta > 0 ? 1.2 : 1/1.2;
        spherical.radius *= zoomStep;
        
        spherical.radius = Math.max(limits.minZoom, Math.min(limits.maxZoom, spherical.radius));
        
        relativePosition.setFromSpherical(spherical);
        this.camera.position.copy(pivotPoint).add(relativePosition);
        
        // Non interferire con animazione camera se in corso
        if (!this.cameraAnimation || !this.cameraAnimation.isAnimating || !this.cameraAnimation.targetTarget) {
            this.camera.lookAt(pivotPoint);
        }
    },

    addModel: function(model, modelConfig = null) {
        if (!model) {
            return;
        }
        
        this.scene.add(model);
        this.loadedModels.push(model);
        this.currentModel = model;

        // Salva la posizione iniziale del modello per reset futuro
        this.saveInitialModelPosition(model);

        const modelFilename = model.userData?.originalFilename || model.name;

        // Nascondi immediatamente il modello planaxis (stato iniziale: spento)
        if (modelFilename && modelFilename.toLowerCase().includes('planaxis')) {
            model.visible = false;
            console.log('📐 PLANAXIS: Modello nascosto immediatamente al caricamento');
        }
        
        if (modelConfig && modelConfig.direction) {
            this.animationSystem.modelDirections[modelFilename] = modelConfig.direction;
            console.log(`🧭 Direction loaded for ${modelFilename}:`, modelConfig.direction);
        }
        
        return model;
    },

    clearAllModels: function() {
        this.loadedModels.forEach(model => {
            this.scene.remove(model);
        });
        this.loadedModels = [];
        this.currentModel = null;
        this.animationSystem.modelDirections = {};
    },

    highlightModel: function(model, duration = null) {
        if (!model) return;

        console.log(`🔍 HIGHLIGHT: highlightModel() chiamata per: ${model.name}`);

        if (this.highlightSystem.isHighlighting) {
            console.log(`🔍 HIGHLIGHT: Rimozione highlight precedente`);
            this.removeHighlight();
        }

        this.saveOriginalMaterials(model);
        this.applyHighlightMaterial(model);
        
        this.highlightSystem.highlightedModel = model;
        this.highlightSystem.isHighlighting = true;
        
        if (duration && duration > 0) {
            this.highlightSystem.highlightTimer = setTimeout(() => {
                this.removeHighlight();
            }, duration);
        }
    },

    saveOriginalMaterials: function(model) {
        const materials = new Map();
        
        model.traverse((child) => {
            if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                    materials.set(child.uuid, child.material.slice());
                } else {
                    materials.set(child.uuid, child.material);
                }
            }
        });
        
        this.highlightSystem.originalMaterials = materials;
    },

    applyHighlightMaterial: function(model) {
        // CONTROLLO: Se DragDropSystem ha bloccato questo modello, non applicare highlight
        if (window.DragDropSystem && window.DragDropSystem.silhouetteBlocked &&
            window.DragDropSystem.silhouetteBlocked.has(model.name)) {
            console.log(`🔍 HIGHLIGHT: ❌ BLOCCATO per ${model.name} durante drag&drop`);
            return;
        }

        console.log(`🔍 HIGHLIGHT: ✅ APPLICAZIONE per ${model.name} (non bloccato)`);
        if (window.DragDropSystem && window.DragDropSystem.silhouetteBlocked) {
            console.log(`🔍 HIGHLIGHT: Modelli bloccati:`, Array.from(window.DragDropSystem.silhouetteBlocked));
        }

        model.traverse((child) => {
            if (child.isMesh) {
                if (Array.isArray(child.material)) {
                    child.material = child.material.map(() => this.highlightSystem.highlightMaterial);
                } else {
                    child.material = this.highlightSystem.highlightMaterial;
                }
                child.renderOrder = 999;
            }
        });
    },

    removeHighlight: function() {
        if (!this.highlightSystem.isHighlighting || !this.highlightSystem.highlightedModel) {
            return;
        }
        
        const model = this.highlightSystem.highlightedModel;
        
        model.traverse((child) => {
            if (child.isMesh && this.highlightSystem.originalMaterials.has(child.uuid)) {
                child.material = this.highlightSystem.originalMaterials.get(child.uuid);
                child.renderOrder = 0;
            }
        });
        
        if (this.highlightSystem.highlightTimer) {
            clearTimeout(this.highlightSystem.highlightTimer);
            this.highlightSystem.highlightTimer = null;
        }
        
        this.highlightSystem.highlightedModel = null;
        this.highlightSystem.originalMaterials.clear();
        this.highlightSystem.isHighlighting = false;
    },

    highlightCurrentTutorialElement: function() {
        console.log(`🔍 HIGHLIGHT: highlightCurrentTutorialElement() chiamata`);
        const currentStep = this.getCurrentTutorialStep();
        if (!currentStep || !currentStep.properties.Elemento) {
            console.log(`🔍 HIGHLIGHT: Nessun step o elemento corrente`);
            return;
        }
        
        const stepElement = currentStep.properties.Elemento;
        const targetModel = this.loadedModels.find(model => {
            const modelFilename = model.userData?.originalFilename || model.name;
            const cleanModelName = modelFilename.split('/').pop().replace('.glb', '');
            const cleanStepElement = stepElement.split('/').pop().replace('.glb', '');
            return cleanModelName === cleanStepElement;
        });
        
        if (targetModel && this.isModelSelectable(targetModel)) {
            console.log(`🔍 HIGHLIGHT: Tentativo di evidenziare modello: ${targetModel.name}`);
            this.highlightModel(targetModel);
        } else {
            console.log(`🔍 HIGHLIGHT: Modello non trovato o non selezionabile`);
        }
    },

    handleModelClick: function(event) {
        // Verifica se le interazioni sono bloccate dopo completamento tutorial
        if (this.tutorialTracker.interactionsBlocked) {
            console.log('🔒 Click ignorato: Interazioni bloccate. Seleziona un nuovo tutorial per continuare.');
            return;
        }
        
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.loadedModels, true);
        
        if (intersects.length > 0) {
            const clickedObject = intersects[0].object;
            const targetModel = this.findRootModel(clickedObject);
            
            // Verifica se il tool Aria è attivo per creare effetto particellare
            const activeTool = window.ToolsManager ? window.ToolsManager.getActiveTool() : 'none';
            const isAriaActiveByClass = document.body.classList.contains('tool-aria-active');
            console.log(`[Scene3D] Click su modello - ToolsManager: ${activeTool}, Body class aria: ${isAriaActiveByClass}`);
            
            // Usa la classe body come fonte affidabile per il tool aria
            if (isAriaActiveByClass) {
                console.log(`[Scene3D] 💨 Attivazione effetto aria su click (rilevato da body class)!`);
                this.handleAirToolEffect(intersects[0], event);
                return; // Non proseguire con azione normale del modello
            }
            
            if (targetModel && this.isModelSelectable(targetModel)) {
                this.handleModelAction(targetModel);
            }
        }
    },

    handleAirToolEffect: function(intersection, event) {
        if (!this.particleSystem) {
            console.warn('[Scene3D] Sistema particellare non disponibile per tool Aria - procedo senza effetti');

            // Fallback: completa l'azione anche senza particelle
            const intersectedObject = intersection.object;
            let targetModel = intersectedObject;
            while (targetModel.parent && !this.loadedModels.includes(targetModel)) {
                targetModel = targetModel.parent;
            }

            if (targetModel && this.isModelSelectable(targetModel)) {
                console.log('[Scene3D] 💨 Azione aria completata (modalità fallback)');
                this.handleModelAction(targetModel);
            }
            return;
        }
        
        const intersectPoint = intersection.point;
        const normal = intersection.face ? intersection.face.normal.clone() : new THREE.Vector3(0, 1, 0);
        const intersectedObject = intersection.object;
        
        // Trova il modello root (parent del mesh intersettato)
        let targetModel = intersectedObject;
        while (targetModel.parent && !this.loadedModels.includes(targetModel)) {
            targetModel = targetModel.parent;
        }
        
        // Calcola posizione cursore in coordinate 3D
        const cursorPosition3D = this.getCursorPosition3D(event);
        
        // Calcola centro del bounding box dell'oggetto
        const objectCenter = this.getObjectBoundingBoxCenter(targetModel);
        
        // Direzione dal cursore verso il centro dell'oggetto
        const jetDirection = new THREE.Vector3()
            .subVectors(objectCenter, cursorPosition3D)
            .normalize();
        
        console.log('[Scene3D] 💨 Getto aria compressa dal cursore all\'oggetto', {
            cursorPos: cursorPosition3D,
            objectCenter: objectCenter,
            direction: jetDirection
        });
        
        // Crea getto aria dal cursore verso l'oggetto (effetto più realistico)
        const airJetId = this.particleSystem.createAirJet(cursorPosition3D, jetDirection, {
            particleCount: 600,
            life: 0.5,
            speed: { min: 10, max: 12 },
            size: { min: 0.003, max: 0.015 },
            spread: { x: 0.08, y: 0.08, z: 0.08 }, // Getto molto concentrato
            opacity: { start: 0.7, end: 0.0 }
        });
        
        // Crea effetto polvere sull'oggetto colpito (impatto realistico)
        setTimeout(() => {
            const dustId = this.particleSystem.createDust(intersectPoint, normal, {
                particleCount: 150,
                life: 2.5,
                speed: { min: 2, max: 8 },
                size: { min: 0.008, max: 0.025 },
                color: new THREE.Color(0.6, 0.55, 0.4), // Colore polvere
                spread: { x: 0.4, y: 0.2, z: 0.4 }
            });
        }, 200); // Ritardo per simulare l'impatto
        
        // Feedback visivo aggiuntivo
        if (window.ToolsManager && window.ToolsManager.feedbackManager) {
            window.ToolsManager.feedbackManager.updateStatus('💨 Aria compressa: cursore → oggetto');
        }
        
        // Completa l'azione del tutorial se necessario
        if (targetModel && this.isModelSelectable(targetModel)) {
            setTimeout(() => {
                this.handleModelAction(targetModel);
            }, 500); // Delay per permettere la visualizzazione dell'effetto
        }
    },

    getCursorPosition3D: function(mouseEvent) {
        // Proietta la posizione del cursore su un piano a distanza media dalla camera
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((mouseEvent.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((mouseEvent.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Crea un punto a distanza fissa dalla camera nella direzione del cursore
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Posizione cursore proiettata a distanza 2 unità dalla camera
        const cursorDistance = 2.0;
        const cursorPos = this.raycaster.ray.origin.clone()
            .add(this.raycaster.ray.direction.clone().multiplyScalar(cursorDistance));
        
        return cursorPos;
    },

    getObjectBoundingBoxCenter: function(object) {
        // Calcola il bounding box dell'oggetto
        const boundingBox = new THREE.Box3().setFromObject(object);
        const center = boundingBox.getCenter(new THREE.Vector3());
        return center;
    },

    handlePivotClick: function(event) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        
        if (intersects.length > 0) {
            const intersection = intersects[0];
            const targetModel = this.findRootModel(intersection.object);
            
            let newPivotPoint;
            if (targetModel && this.isModelSelectable(targetModel)) {
                const box = new THREE.Box3().setFromObject(targetModel);
                const center = box.getCenter(new THREE.Vector3());
                newPivotPoint = center.clone();
            } else {
                newPivotPoint = intersection.point.clone();
            }
            
            // Anima fluida la camera verso il nuovo pivot point
            this.animateCameraToPivot(newPivotPoint);
        }
    },

    animateCameraToPivot: function(newPivotPoint) {
        // Inizializza il sistema di animazione pivot se non esiste
        if (!this.pivotAnimation) {
            this.pivotAnimation = {
                isAnimating: false,
                startTime: 0,
                duration: 0.8, // Durata animazione fluida in secondi
                startPivot: null,
                targetPivot: null,
                startCameraPosition: null,
                targetCameraPosition: null
            };
        }

        // Se già in animazione, aggiorna il target
        const oldPivot = this.mouseControls.pivotPoint.clone();
        
        // Calcola la nuova posizione della camera mantenendo la stessa distanza relativa
        const currentCameraDirection = this.camera.position.clone().sub(oldPivot).normalize();
        const currentDistance = this.camera.position.distanceTo(oldPivot);
        const newCameraPosition = newPivotPoint.clone().add(currentCameraDirection.multiplyScalar(currentDistance));
        
        // Configura animazione
        this.pivotAnimation.isAnimating = true;
        this.pivotAnimation.startTime = performance.now();
        this.pivotAnimation.startPivot = oldPivot;
        this.pivotAnimation.targetPivot = newPivotPoint;
        this.pivotAnimation.startCameraPosition = this.camera.position.clone();
        this.pivotAnimation.targetCameraPosition = newCameraPosition;
        
        console.log(`🎯 Animazione pivot: da (${oldPivot.x.toFixed(2)}, ${oldPivot.y.toFixed(2)}, ${oldPivot.z.toFixed(2)}) a (${newPivotPoint.x.toFixed(2)}, ${newPivotPoint.y.toFixed(2)}, ${newPivotPoint.z.toFixed(2)})`);
    },

    findRootModel: function(clickedObject) {
        for (const model of this.loadedModels) {
            if (this.isDescendantOf(clickedObject, model)) {
                return model;
            }
        }
        return null;
    },

    isDescendantOf: function(child, parent) {
        let current = child;
        while (current && current !== this.scene) {
            if (current === parent) return true;
            current = current.parent;
        }
        return false;
    },

    isModelSelectable: function(model) {
        if (!model) return false;
        
        const modelName = (model.userData?.originalFilename || model.name || '').toLowerCase();
        
        for (const excludeKeyword of this.nonSelectableElements) {
            if (modelName.includes(excludeKeyword.toLowerCase())) {
                return false;
            }
        }
        
        return true;
    },

    handleModelAction: function(model) {
        const currentStep = this.getCurrentTutorialStep();
        const requiredTool = this.getRequiredToolForStep(currentStep);
        const activeTool = window.UI ? window.UI.getActiveTool() : null;
        
        if (this.highlightSystem.isHighlighting && 
            this.highlightSystem.highlightedModel === model &&
            requiredTool && activeTool === requiredTool) {
            
            this.removeHighlight();
        }
        
        if (!requiredTool || activeTool !== requiredTool) {
            return;
        }
        
        if (!currentStep) {
            return;
        }
        
        const modelFilename = model.userData?.originalFilename || model.name;
        const stepElement = currentStep.properties.Elemento;
        
        const cleanModelName = modelFilename.split('/').pop().replace('.glb', '');
        const cleanStepElement = stepElement.split('/').pop().replace('.glb', '');
        
        if (!stepElement || cleanModelName !== cleanStepElement) {
            return;
        }
        
        if (this.isModelAnimating(model)) {
            return;
        }
        
        this.startModelAnimation(model, currentStep);
    },

    startModelAnimation: function(model, tutorialStep) {
        const modelFilename = model.userData?.originalFilename || model.name;
        
        // SEMPRE usa sistema multi-step per Azione1, Azione2, etc.
        const movementSteps = this.parseMovementSteps(tutorialStep, modelFilename);
        if (movementSteps.length > 0) {
            return this.startMultiStepMovement(model, movementSteps);
        }
        
        // Fallback legacy solo se non ci sono azioni multi-step
        const direction = this.getModelDirection(modelFilename);
        
        if (!direction || (direction.x === 0 && direction.y === 0 && direction.z === 1)) {
            return;
        }
        
        const action = tutorialStep.properties.Azione;
        if (!action) {
            return;
        }
        
        let targetModel = model;
        let modelCenter = null;
        
        if (action.toLowerCase() === 'svita' || action.toLowerCase() === 'avvita') {
            modelCenter = this.calculateModelCenter(model);
        }
        
        let defaultDuration = (action.toLowerCase() === 'svita' || action.toLowerCase() === 'avvita') ? 1.5 : 1.5;
        const customDuration = parseFloat(tutorialStep.properties.Durata);
        const duration = customDuration || defaultDuration;
        
        const animConfig = {
            model: targetModel,
            originalModel: model,
            action: action,
            direction: new THREE.Vector3(direction.x, direction.y, direction.z),
            duration: duration,
            startTime: performance.now(),
            initialPosition: targetModel.position.clone(),
            initialRotation: targetModel.rotation.clone(),
            modelCenter: modelCenter,
            targetPosition: null,
            targetRotation: null,
            finished: false
        };
        
        this.calculateAnimationTargets(animConfig, tutorialStep);
        
        this.animationSystem.activeAnimations.push(animConfig);
    },

    isModelAnimating: function(model) {
        return this.animationSystem.activeAnimations.some(anim => anim.model === model);
    },

    calculateAnimationTargets: function(animConfig, tutorialStep) {
        const { action, direction, initialPosition, initialRotation } = animConfig;
        const movementDistance = parseFloat(tutorialStep.properties.Distanza) || 1.5;
        
        let targetPosition;
        let targetRotation = initialRotation.clone();
        
        switch (action.toLowerCase()) {
            case 'estrai':
                targetPosition = initialPosition.clone().add(direction.clone().multiplyScalar(movementDistance));
                break;
                
            case 'inserisci':
                targetPosition = initialPosition.clone().add(direction.clone().multiplyScalar(-movementDistance));
                break;
                
            case 'svita':
                const movement = direction.clone().multiplyScalar(movementDistance);
                targetPosition = initialPosition.clone().add(movement);
                this.applyRotationBasedOnDirection(targetRotation, direction, -Math.PI * 2); // 360° invece di 1080°
                break;
                
            case 'avvita':
                targetPosition = initialPosition.clone().add(direction.clone().multiplyScalar(-movementDistance));
                this.applyRotationBasedOnDirection(targetRotation, direction, Math.PI * 2); // 360° invece di 1080°
                break;
                
            default:
                targetPosition = initialPosition.clone();
                break;
        }
        
        animConfig.targetPosition = targetPosition;
        animConfig.targetRotation = targetRotation;
    },

    applyRotationBasedOnDirection: function(targetRotation, direction, rotationAmount) {
        const normalizedDir = direction.clone().normalize();
        
        const absX = Math.abs(normalizedDir.x);
        const absY = Math.abs(normalizedDir.y);
        const absZ = Math.abs(normalizedDir.z);
        
        if (absX > absY && absX > absZ) {
            targetRotation.x += rotationAmount;
        } else if (absY > absX && absY > absZ) {
            targetRotation.y += rotationAmount;
        } else {
            targetRotation.z += rotationAmount;
        }
    },

    calculateModelCenter: function(model) {
        const originalPosition = model.position.clone();
        
        model.position.set(0, 0, 0);
        
        const boundingBox = new THREE.Box3().setFromObject(model);
        const center = new THREE.Vector3();
        boundingBox.getCenter(center);
        
        model.position.copy(originalPosition);
        
        return center;
    },

    calculateBoundingBoxCenter: function(model) {
        // Controllo per riferimenti _original (oggetti virtuali)
        if (model.isOriginalReference) {
            console.log(`📐 ORIGINAL: Usando posizione originale per ${model.originalModelName}: (${model.position.x.toFixed(3)}, ${model.position.y.toFixed(3)}, ${model.position.z.toFixed(3)})`);
            return model.position.clone();
        }

        const boundingBox = new THREE.Box3().setFromObject(model);
        const center = boundingBox.getCenter(new THREE.Vector3());

        console.log(`📐 Bounding box per ${model.userData?.originalFilename}:`);
        console.log(`   Min: (${boundingBox.min.x.toFixed(3)}, ${boundingBox.min.y.toFixed(3)}, ${boundingBox.min.z.toFixed(3)})`);
        console.log(`   Max: (${boundingBox.max.x.toFixed(3)}, ${boundingBox.max.y.toFixed(3)}, ${boundingBox.max.z.toFixed(3)})`);
        console.log(`   Center: (${center.x.toFixed(3)}, ${center.y.toFixed(3)}, ${center.z.toFixed(3)})`);
        console.log(`   Size: (${(boundingBox.max.x-boundingBox.min.x).toFixed(3)}, ${(boundingBox.max.y-boundingBox.min.y).toFixed(3)}, ${(boundingBox.max.z-boundingBox.min.z).toFixed(3)})`);

        return center;
    },

    calculateModelWorldCenter: function(model) {
        // Calcola il centro geometrico originale del modello
        if (!model.userData.originalCenter) {
            // Salva il centro originale del modello al primo caricamento
            const originalPosition = model.position.clone();
            const originalRotation = model.rotation.clone();
            
            // Reset trasformazioni per ottenere centro originale
            model.position.set(0, 0, 0);
            model.rotation.set(0, 0, 0);
            
            const boundingBox = new THREE.Box3().setFromObject(model);
            const originalCenter = boundingBox.getCenter(new THREE.Vector3());
            
            // Ripristina trasformazioni
            model.position.copy(originalPosition);
            model.rotation.copy(originalRotation);
            
            model.userData.originalCenter = originalCenter;
        }
        
        // Applica le trasformazioni attuali al centro originale
        const worldCenter = model.userData.originalCenter.clone();
        
        // Applica rotazione
        worldCenter.applyEuler(model.rotation);
        
        // Applica traslazione
        worldCenter.add(model.position);
        
        console.log(`🎯 Centro mondiale per ${model.userData?.originalFilename}:`);
        console.log(`   Centro originale: (${model.userData.originalCenter.x.toFixed(3)}, ${model.userData.originalCenter.y.toFixed(3)}, ${model.userData.originalCenter.z.toFixed(3)})`);
        console.log(`   Centro mondiale: (${worldCenter.x.toFixed(3)}, ${worldCenter.y.toFixed(3)}, ${worldCenter.z.toFixed(3)})`);
        
        return worldCenter;
    },

    getOriginalModelCenter: function(model) {
        // Se non abbiamo già calcolato il centro originale, calcolalo ora
        if (!model.userData.originalCenter) {
            const originalPosition = model.position.clone();
            const originalRotation = model.rotation.clone();
            
            // Reset trasformazioni per ottenere centro originale
            model.position.set(0, 0, 0);
            model.rotation.set(0, 0, 0);
            
            const boundingBox = new THREE.Box3().setFromObject(model);
            const originalCenter = boundingBox.getCenter(new THREE.Vector3());
            
            // Ripristina trasformazioni
            model.position.copy(originalPosition);
            model.rotation.copy(originalRotation);
            
            // Salva il centro originale
            model.userData.originalCenter = originalCenter;
            
            console.log(`💾 Centro originale salvato per ${model.userData?.originalFilename}: (${originalCenter.x.toFixed(3)}, ${originalCenter.y.toFixed(3)}, ${originalCenter.z.toFixed(3)})`);
        }
        
        // Restituisce il centro originale (senza trasformazioni applicate)
        return model.userData.originalCenter.clone();
    },

    showBoundingBoxCenter: function(modelName = 'ingrassatore') {
        const targetModel = this.findModelByName(modelName);
        if (!targetModel) {
            console.warn(`Modello ${modelName} non trovato`);
            return;
        }

        const center = this.calculateModelWorldCenter(targetModel);
        
        this.removeBoundingBoxSphere();
        
        const sphereGeometry = new THREE.SphereGeometry(0.05, 16, 16);
        const sphereMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: false,
            depthTest: true,
            depthWrite: true
        });
        
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.position.copy(center);
        sphere.name = 'boundingBoxCenterSphere';
        sphere.userData.isBoundingBoxSphere = true;
        
        this.scene.add(sphere);
        this.boundingBoxSphere = sphere;
        
        console.log(`🔴 Sfera rossa creata al centro del bounding box di ${modelName} alla posizione:`, center);
        
        return sphere;
    },

    removeBoundingBoxSphere: function() {
        if (this.boundingBoxSphere) {
            this.scene.remove(this.boundingBoxSphere);
            this.boundingBoxSphere.geometry.dispose();
            this.boundingBoxSphere.material.dispose();
            this.boundingBoxSphere = null;
        }
    },

    showRotationCenter: function(modelName = 'ingrassatore') {
        this.removeRotationCenterSphere();
        
        const model = this.findModelByName(modelName);
        if (!model) {
            console.warn(`Modello ${modelName} non trovato`);
            return;
        }
        
        // Usa sempre il centro del bounding box attuale (come nel sistema di animazione)
        const center = this.calculateBoundingBoxCenter(model);
        
        const sphereGeometry = new THREE.SphereGeometry(0.05, 16, 16);
        const sphereMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x000000,
            transparent: true,
            opacity: 0.8
        });
        
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.position.copy(center);
        sphere.name = 'rotationCenterSphere';
        sphere.userData.isRotationCenterSphere = true;
        sphere.userData.trackedModel = modelName; // Traccia il modello associato
        
        this.scene.add(sphere);
        this.rotationCenterSphere = sphere;
        
        console.log(`⚫ Sfera nera creata al centro di rotazione di ${modelName} alla posizione:`);
        console.log(`   X: ${center.x.toFixed(3)}, Y: ${center.y.toFixed(3)}, Z: ${center.z.toFixed(3)}`);
        console.log(`   Questo è il punto attorno al quale ruoterà ${modelName} durante le animazioni`);
        
        return center;
    },

    createRotationCenterSphere: function(modelName, customCenter = null) {
        // Rimuovi sfera esistente
        this.removeRotationCenterSphere();
        
        // Usa il centro personalizzato se fornito, altrimenti quello del bounding box
        let center;
        if (customCenter) {
            center = customCenter.clone();
        } else {
            const model = this.findModelByName(modelName);
            if (!model) {
                console.warn(`⚫ Modello ${modelName} non trovato per sfera centro rotazione`);
                return;
            }
            center = this.calculateBoundingBoxCenter(model);
        }
        
        const sphereGeometry = new THREE.SphereGeometry(0.05, 16, 16);
        const sphereMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x000000,
            transparent: true,
            opacity: 0.8
        });
        
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.position.copy(center);
        sphere.name = 'rotationCenterSphere';
        sphere.userData.isRotationCenterSphere = true;
        sphere.userData.trackedModel = modelName;
        
        this.scene.add(sphere);
        this.rotationCenterSphere = sphere;
        
        console.log(`⚫ Sfera nera creata al centro di rotazione di ${modelName} alla posizione:`);
        console.log(`   X: ${center.x.toFixed(3)}, Y: ${center.y.toFixed(3)}, Z: ${center.z.toFixed(3)}`);
        
        return center;
    },

    updateRotationCenterSphere: function(modelName = null) {
        if (!this.rotationCenterSphere) {
            return;
        }
        
        const trackedModelName = modelName || this.rotationCenterSphere.userData.trackedModel;
        if (!trackedModelName) {
            return;
        }
        
        const model = this.findModelByName(trackedModelName);
        if (!model) {
            return;
        }
        
        // Aggiorna la posizione della sfera nera al nuovo centro del bounding box
        const newCenter = this.calculateBoundingBoxCenter(model);
        this.rotationCenterSphere.position.copy(newCenter);
        
        console.log(`⚫ Sfera nera aggiornata per ${trackedModelName} alla nuova posizione: (${newCenter.x.toFixed(3)}, ${newCenter.y.toFixed(3)}, ${newCenter.z.toFixed(3)})`);
    },

    showActualRotationCenter: function(modelName = 'ingrassatore', tutorialStep = null) {
        this.removeRotationCenterSphere();
        
        const model = this.findModelByName(modelName);
        if (!model) {
            console.warn(`Modello ${modelName} non trovato`);
            return;
        }
        
        let actualCenter;
        
        // Se è fornito un tutorial step, usa la stessa logica dell'animazione
        if (tutorialStep && tutorialStep.centro) {
            const originalModelCenter = this.getOriginalModelCenter(model);
            const centroOffset = new THREE.Vector3(
                tutorialStep.centro.x,
                tutorialStep.centro.y,
                tutorialStep.centro.z
            );
            actualCenter = originalModelCenter.clone().add(centroOffset);
            console.log(`🎯 Centro di rotazione personalizzato (con offset): (${actualCenter.x.toFixed(3)}, ${actualCenter.y.toFixed(3)}, ${actualCenter.z.toFixed(3)})`);
        } else {
            // Usa il centro del bounding box attuale (default del sistema)
            actualCenter = this.calculateBoundingBoxCenter(model);
            console.log(`🎯 Centro di rotazione standard (bounding box): (${actualCenter.x.toFixed(3)}, ${actualCenter.y.toFixed(3)}, ${actualCenter.z.toFixed(3)})`);
        }
        
        const sphereGeometry = new THREE.SphereGeometry(0.05, 16, 16);
        const sphereMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x000000,
            transparent: true,
            opacity: 0.9
        });
        
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.position.copy(actualCenter);
        sphere.name = 'rotationCenterSphere';
        sphere.userData.isRotationCenterSphere = true;
        sphere.userData.trackedModel = modelName;
        
        this.scene.add(sphere);
        this.rotationCenterSphere = sphere;
        
        return actualCenter;
    },

    removeRotationCenterSphere: function() {
        if (this.rotationCenterSphere) {
            this.scene.remove(this.rotationCenterSphere);
            this.rotationCenterSphere.geometry.dispose();
            this.rotationCenterSphere.material.dispose();
            this.rotationCenterSphere = null;
        }
    },

    toggleRotationCenterSphere: function(modelName = 'ingrassatore') {
        if (this.rotationCenterSphere) {
            this.removeRotationCenterSphere();
        } else {
            this.showRotationCenter(modelName);
        }
    },

    toggleBoundingBoxSphere: function(modelName = 'ingrassatore') {
        if (this.boundingBoxSphere) {
            this.removeBoundingBoxSphere();
        } else {
            this.showBoundingBoxCenter(modelName);
        }
    },

    // Funzione di debug per testare dalla console
    debugShowIngrassatoreSphere: function() {
        console.log('🔴 Debug: Cercando e visualizzando sfera per ingrassatore...');
        
        // Trova tutti i modelli disponibili
        console.log('Modelli caricati:', this.loadedModels.length);
        this.loadedModels.forEach((model, index) => {
            const name = model.userData?.originalFilename || model.name || `modelo_${index}`;
            console.log(`  [${index}] ${name}`);
        });
        
        // Prova a visualizzare la sfera
        return this.showBoundingBoxCenter('ingrassatore');
    },

    // Funzione per visualizzare il centro di rotazione con offset personalizzato
    debugShowCentroRotazione: function(modelName = 'ingrassatore', offsetX = -0.5, offsetY = 0.1, offsetZ = 0) {
        const model = this.findModelByName(modelName);
        if (!model) {
            console.warn(`Modello ${modelName} non trovato`);
            return;
        }

        // Calcola il centro usando la stessa logica del sistema
        const originalModelCenter = this.getOriginalModelCenter(model);
        const centroOffset = new THREE.Vector3(offsetX, offsetY, offsetZ);
        const rotationCenter = originalModelCenter.clone().add(centroOffset);

        console.log(`🎯 DEBUG CENTRO per ${modelName}:`);
        console.log(`   Centro originale: (${originalModelCenter.x.toFixed(3)}, ${originalModelCenter.y.toFixed(3)}, ${originalModelCenter.z.toFixed(3)})`);
        console.log(`   Offset: (${offsetX}, ${offsetY}, ${offsetZ})`);
        console.log(`   Centro rotazione: (${rotationCenter.x.toFixed(3)}, ${rotationCenter.y.toFixed(3)}, ${rotationCenter.z.toFixed(3)})`);

        // Rimuovi sfera precedente se esiste
        this.removeRotationCenterSphere();

        // Crea sfera blu per il centro di rotazione personalizzato
        const sphereGeometry = new THREE.SphereGeometry(0.08, 16, 16);
        const sphereMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x0000ff,  // Blu per distinguerla dalle altre
            transparent: true,
            opacity: 0.9
        });
        
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.position.copy(rotationCenter);
        sphere.name = 'rotationCenterSphere';
        sphere.userData.isRotationCenterSphere = true;
        
        this.scene.add(sphere);
        this.rotationCenterSphere = sphere;
        
        console.log(`🔵 Sfera BLU creata al centro di rotazione personalizzato`);
        
        return rotationCenter;
    },

    parseMovementSteps: function(tutorialStep, modelFilename = null) {
        const movementSteps = [];
        let stepIndex = 1;
        
        while (tutorialStep.properties[`Azione${stepIndex}`]) {
            const stepString = tutorialStep.properties[`Azione${stepIndex}`];
            const parsedStep = this.parseMovementStepString(stepString, stepIndex, modelFilename);
            
            if (parsedStep) {
                movementSteps.push(parsedStep);
            }
            
            stepIndex++;
        }
        
        return movementSteps;
    },

    parseMovementStepString: function(stepString, stepIndex, modelFilename = null) {
        try {
            const step = {
                index: stepIndex,
                rotazione: null,
                traslazione: null,
                appoggia: null,
                resetCenteredOriginal: null,
                svita: null,
                avvita: null,
                estrai: null,
                inserisci: null,
                centro: null,
                durata: 1.0
            };
            
            const operations = stepString.split(';');
            
            for (const operation of operations) {
                const trimmed = operation.trim();
                
                if (trimmed.startsWith('rotazione:')) {
                    step.rotazione = this.parseMovementOperation(trimmed, 'rotazione', modelFilename);
                } else if (trimmed.startsWith('traslazione:')) {
                    step.traslazione = this.parseMovementOperation(trimmed, 'traslazione', modelFilename);
                } else if (trimmed.startsWith('appoggia')) {
                    step.appoggia = this.parseMovementOperation(trimmed, 'appoggia', modelFilename);
                } else if (trimmed.startsWith('resetCenteredOriginal')) {
                    step.resetCenteredOriginal = this.parseMovementOperation(trimmed, 'resetCenteredOriginal', modelFilename);
                } else if (trimmed === 'svita') {
                    step.svita = this.parseMovementOperation(trimmed, 'svita', modelFilename);
                } else if (trimmed === 'avvita') {
                    step.avvita = this.parseMovementOperation(trimmed, 'avvita', modelFilename);
                } else if (trimmed === 'estrai') {
                    step.estrai = this.parseMovementOperation(trimmed, 'estrai', modelFilename);
                } else if (trimmed === 'inserisci') {
                    step.inserisci = this.parseMovementOperation(trimmed, 'inserisci', modelFilename);
                } else if (trimmed.startsWith('centro:')) {
                    step.centro = this.parseMovementOperation(trimmed, 'centro', modelFilename);
                }
            }
            
            const durateOperazioni = [];
            if (step.rotazione) {
                durateOperazioni.push(step.rotazione.durata);
            }
            if (step.traslazione) {
                durateOperazioni.push(step.traslazione.durata);
            }
            if (step.appoggia) {
                durateOperazioni.push(step.appoggia.durata);
            }
            if (step.resetCenteredOriginal) {
                durateOperazioni.push(step.resetCenteredOriginal.durata);
            }
            if (step.svita) {
                durateOperazioni.push(step.svita.durata);
            }
            if (step.avvita) {
                durateOperazioni.push(step.avvita.durata);
            }
            if (step.estrai) {
                durateOperazioni.push(step.estrai.durata);
            }
            if (step.inserisci) {
                durateOperazioni.push(step.inserisci.durata);
            }
            if (step.centro && step.centro.durata) {
                durateOperazioni.push(step.centro.durata);
            }
            
            if (durateOperazioni.length > 0) {
                step.durata = Math.max(...durateOperazioni);
            }
            
            return step;
            
        } catch (error) {
            return null;
        }
    },

    parseMovementOperation: function(operationString, type, modelFilename = null) {
        if (type === 'traslazione' && operationString.includes(':') && !operationString.match(/^traslazione:\(/)) {
            const colonIndex = operationString.indexOf(':');
            const afterColon = operationString.substring(colonIndex + 1);
            
            let targetElement = null;
            let offsetValues = null;
            let isAbsoluteToOriginal = false;
            
            if (afterColon.includes(',')) {
                const commaIndex = afterColon.indexOf(',');
                targetElement = afterColon.substring(0, commaIndex).trim();
                const offsetPart = afterColon.substring(commaIndex + 1);
                
                const offsetMatch = offsetPart.match(/\(([^)]+)\)/);
                if (offsetMatch) {
                    offsetValues = offsetMatch[1].split(',').map(v => parseFloat(v.trim()));
                    if (offsetValues.length !== 4) {
                        throw new Error(`Offset traslazione verso target deve avere 4 valori (x,y,z,durata): ${operationString}`);
                    }
                } else {
                    throw new Error(`Formato offset non valido in traslazione verso target: ${operationString}`);
                }
            } else {
                targetElement = afterColon.trim();
                
                // Verifica se è una traslazione assoluta verso posizione originale
                if (targetElement.endsWith('_original')) {
                    isAbsoluteToOriginal = true;
                    offsetValues = [0, 0, 0, 1.0]; // Valori default per posizione assoluta
                } else {
                    offsetValues = [0, 0, 0, 1.0]; // Offset di default per target normale
                }
            }
            
            console.log(`🎯 TRASLAZIONE: Target=${targetElement}, Absolute to Original=${isAbsoluteToOriginal}`);
            
            return {
                x: offsetValues[0],
                y: offsetValues[1],
                z: offsetValues[2], 
                durata: offsetValues[3],
                targetElement: targetElement,
                isAbsoluteToOriginal: isAbsoluteToOriginal
            };
        }
        
        // Per comandi semplificati senza parametri, non serve match
        let match = null;
        let values = [];
        
        if (['svita', 'avvita', 'estrai', 'inserisci'].includes(type)) {
            // Skip match per comandi semplificati
        } else {
            match = operationString.match(/\(([^)]+)\)/);
            if (!match) {
                throw new Error(`Formato ${type} non valido: ${operationString}`);
            }
            values = match[1].split(',').map(v => parseFloat(v.trim()));
        }
        
        if (type === 'centro') {
            if (values.length !== 3) {
                throw new Error(`${type} deve avere 3 valori (x,y,z): ${operationString}`);
            }
            return {
                x: values[0],
                y: values[1], 
                z: values[2]
            };
        } else if (type === 'appoggia') {
            // Gestisce appoggia(durata) o appoggia senza parentesi
            const matchWithParens = operationString.match(/appoggia\(([^)]+)\)/);
            const matchWithoutParens = operationString.match(/^appoggia$/);
            
            if (matchWithParens) {
                const durata = parseFloat(matchWithParens[1]);
                if (isNaN(durata)) {
                    throw new Error(`Durata non valida in appoggia: ${operationString}`);
                }
                return {
                    durata: durata
                };
            } else if (matchWithoutParens) {
                // Durata di default se non specificata
                return {
                    durata: 1.0
                };
            } else {
                throw new Error(`Formato appoggia non valido: ${operationString}`);
            }
        } else if (type === 'resetCenteredOriginal') {
            // Gestisce resetCenteredOriginal(durata) o resetCenteredOriginal senza parentesi
            const matchWithParens = operationString.match(/resetCenteredOriginal\(([^)]+)\)/);
            const matchWithoutParens = operationString.match(/^resetCenteredOriginal$/);

            if (matchWithParens) {
                const durata = parseFloat(matchWithParens[1]);
                if (isNaN(durata)) {
                    throw new Error(`Durata non valida in resetCenteredOriginal: ${operationString}`);
                }
                return {
                    durata: durata,
                    animated: true  // Se ha durata, usa animazione
                };
            } else if (matchWithoutParens) {
                // Reset immediato se non specificata durata
                return {
                    durata: 0,
                    animated: false
                };
            } else {
                throw new Error(`Formato resetCenteredOriginal non valido: ${operationString}`);
            }
        } else if (type === 'svita') {
            // Comando semplificato: svita = rotazione attorno asse direction + traslazione lungo direction
            const direction = this.getModelDirection(modelFilename);
            const rotazione = { 
                x: Math.abs(direction.x) * -360, // Rotazione attorno asse X se direction è lungo X
                y: Math.abs(direction.y) * -360, // Rotazione attorno asse Y se direction è lungo Y  
                z: Math.abs(direction.z) * -360, // Rotazione attorno asse Z se direction è lungo Z
                durata: 1.0 
            };
            console.log(`🔄 SVITA per ${modelFilename}: direction=`, direction, `rotazione=`, rotazione);
            return {
                tipo: 'svita',
                rotazione: rotazione,
                traslazione: { 
                    x: direction.x * 0.5, 
                    y: direction.y * 0.5, 
                    z: direction.z * 0.5, 
                    durata: 1.0 
                },
                durata: 2.0
            };
        } else if (type === 'avvita') {
            // Comando semplificato: avvita = rotazione attorno asse direction + traslazione inversa lungo direction
            const direction = this.getModelDirection(modelFilename);
            return {
                tipo: 'avvita',
                rotazione: { 
                    x: Math.abs(direction.x) * 360, // Rotazione attorno asse X se direction è lungo X
                    y: Math.abs(direction.y) * 360, // Rotazione attorno asse Y se direction è lungo Y
                    z: Math.abs(direction.z) * 360, // Rotazione attorno asse Z se direction è lungo Z
                    durata: 1.0 
                },
                traslazione: { 
                    x: -direction.x * 0.5, 
                    y: -direction.y * 0.5, 
                    z: -direction.z * 0.5, 
                    durata: 1.0 
                },
                durata: 2.0
            };
        } else if (type === 'estrai') {
            // Comando semplificato: estrai = solo traslazione lungo direction
            const direction = this.getModelDirection(modelFilename);
            return {
                tipo: 'estrai',
                traslazione: { 
                    x: direction.x * 0.4, 
                    y: direction.y * 0.4, 
                    z: direction.z * 0.4, 
                    durata: 1.0 
                },
                durata: 1.0
            };
        } else if (type === 'inserisci') {
            // Comando semplificato: inserisci = solo traslazione inversa lungo direction
            const direction = this.getModelDirection(modelFilename);
            return {
                tipo: 'inserisci',
                traslazione: { 
                    x: -direction.x * 0.4, 
                    y: -direction.y * 0.4, 
                    z: -direction.z * 0.4, 
                    durata: 1.0 
                },
                durata: 1.0
            };
        } else {
            if (values.length !== 4) {
                throw new Error(`${type} deve avere 4 valori (x,y,z,durata): ${operationString}`);
            }
            return {
                x: values[0],
                y: values[1], 
                z: values[2],
                durata: values[3]
            };
        }
    },

    loadModelDirections: function(scenarioConfig) {
        // Per ora carica le direzioni manualmente per TEST
        if (scenarioConfig && scenarioConfig.name === 'TEST') {
            this.animationSystem.modelDirections = {
                'tappino_grasso_dx': { x: -1, y: 0, z: 0 },
                'ingrassatore': { x: -1, y: 0, z: 0 },
                'tappino_grasso_sx': { x: -1, y: 0, z: 0 },
                'assi': { x: -1, y: 0, z: 0 },
                'vite_coperchio_1': { x: -1, y: 0, z: 0 }
            };
            return;
        }
        
        if (!scenarioConfig || !scenarioConfig.models) {
            return;
        }
        
        scenarioConfig.models.forEach(modelConfig => {
            if (modelConfig.model && modelConfig.direction) {
                const modelName = modelConfig.model.split('/').pop().replace('.glb', '');
                this.animationSystem.modelDirections[modelName] = modelConfig.direction;
            }
        });
    },

    getModelDirection: function(modelFilename) {
        if (!this.animationSystem.modelDirections) {
            this.animationSystem.modelDirections = {};
        }
        
        // Prova prima con nome completo, poi solo nome file
        const cleanName = modelFilename ? modelFilename.split('/').pop().replace('.glb', '') : '';
        
        if (modelFilename && this.animationSystem.modelDirections[modelFilename]) {
            console.log(`🧭 Using direction for ${modelFilename}:`, this.animationSystem.modelDirections[modelFilename]);
            return this.animationSystem.modelDirections[modelFilename];
        }
        
        if (cleanName && this.animationSystem.modelDirections[cleanName]) {
            console.log(`🧭 Using direction for ${cleanName}:`, this.animationSystem.modelDirections[cleanName]);
            return this.animationSystem.modelDirections[cleanName];
        }
        
        console.log(`⚠️ No direction found for ${modelFilename}, using default (0,0,1)`);
        // Default fallback direction
        return { x: 0, y: 0, z: 1 };
    },

    startMultiStepMovement: function(model, movementSteps) {
        if (!movementSteps || movementSteps.length === 0) {
            return false;
        }
        
        const modelUuid = model.uuid;
        const modelName = model.userData?.originalFilename || model.name;
        
        this.animationSystem.multiStepAnimations.set(modelUuid, {
            model: model,
            steps: movementSteps,
            currentStepIndex: 0,
            isActive: true,
            modelName: modelName
        });
        
        this.executeCurrentMultiStep(modelUuid);
        return true;
    },

    executeCurrentMultiStep: function(modelUuid) {
        const multiStepData = this.animationSystem.multiStepAnimations.get(modelUuid);
        if (!multiStepData || !multiStepData.isActive) {
            return;
        }
        
        const currentStep = multiStepData.steps[multiStepData.currentStepIndex];
        if (!currentStep) {
            this.finishMultiStepMovement(modelUuid);
            return;
        }
        
        const model = multiStepData.model;
        const initialPosition = model.position.clone();
        const initialRotation = new THREE.Euler().copy(model.rotation);
        
        let targetPosition = initialPosition.clone();
        let targetRotation = new THREE.Euler().copy(initialRotation);
        
        let rotationCenter = null;
        
        if (currentStep.centro) {
            // Usa il centro del bounding box attuale (ricalcolato ogni volta) come base per il comando centro:
            const currentBoundingBoxCenter = this.calculateBoundingBoxCenter(model);
            const centroOffset = new THREE.Vector3(
                currentStep.centro.x,
                currentStep.centro.y,
                currentStep.centro.z
            );
            
            rotationCenter = currentBoundingBoxCenter.clone().add(centroOffset);
            console.log(`🎯 DEBUG CENTRO:`);
            console.log(`   Centro bounding box attuale: (${currentBoundingBoxCenter.x.toFixed(3)}, ${currentBoundingBoxCenter.y.toFixed(3)}, ${currentBoundingBoxCenter.z.toFixed(3)})`);
            console.log(`   Offset richiesto: (${centroOffset.x.toFixed(3)}, ${centroOffset.y.toFixed(3)}, ${centroOffset.z.toFixed(3)})`);
            console.log(`   Centro rotazione finale: (${rotationCenter.x.toFixed(3)}, ${rotationCenter.y.toFixed(3)}, ${rotationCenter.z.toFixed(3)})`);
            console.log(`   Posizione attuale modello: (${model.position.x.toFixed(3)}, ${model.position.y.toFixed(3)}, ${model.position.z.toFixed(3)})`);
            
            // Mostra automaticamente la sfera nera del centro di rotazione solo se debug è attivo
            if (window.AppConfig && window.AppConfig.debug && window.AppConfig.debug.showRotationCenter) {
                this.createRotationCenterSphere(model.userData?.originalFilename || model.name, rotationCenter);
            }
        }
        
        if (currentStep.rotazione) {
            // Calcola il centro di rotazione fisso all'INIZIO dell'animazione
            const fixedRotationCenter = rotationCenter ? rotationCenter.clone() : this.calculateBoundingBoxCenter(model);
            console.log(`DEBUG: Centro rotazione fisso ingrassatore: (${fixedRotationCenter.x.toFixed(3)}, ${fixedRotationCenter.y.toFixed(3)}, ${fixedRotationCenter.z.toFixed(3)})`);
                
            const rotationMatrix = new THREE.Matrix4();
            rotationMatrix.makeRotationFromEuler(new THREE.Euler(
                THREE.MathUtils.degToRad(currentStep.rotazione.x),
                THREE.MathUtils.degToRad(currentStep.rotazione.y),
                THREE.MathUtils.degToRad(currentStep.rotazione.z)
            ));
                
            // Calcola sempre la targetPosition per rotazioni attorno a qualsiasi centro
            const relativePosition = model.position.clone().sub(fixedRotationCenter);
            relativePosition.applyMatrix4(rotationMatrix);
            targetPosition = fixedRotationCenter.clone().add(relativePosition);
            
            console.log(`DEBUG ROTAZIONE:`);
            console.log(`   Posizione iniziale: (${model.position.x.toFixed(3)}, ${model.position.y.toFixed(3)}, ${model.position.z.toFixed(3)})`);
            console.log(`   Centro rotazione: (${fixedRotationCenter.x.toFixed(3)}, ${fixedRotationCenter.y.toFixed(3)}, ${fixedRotationCenter.z.toFixed(3)})`);
            console.log(`   Posizione finale calcolata: (${targetPosition.x.toFixed(3)}, ${targetPosition.y.toFixed(3)}, ${targetPosition.z.toFixed(3)})`);
            
            // Anche per centro personalizzato, calcola la target position
            
            targetRotation.x += THREE.MathUtils.degToRad(currentStep.rotazione.x);
            targetRotation.y += THREE.MathUtils.degToRad(currentStep.rotazione.y);
            targetRotation.z += THREE.MathUtils.degToRad(currentStep.rotazione.z);
            
            // Salva il centro fisso per l'animazione
            rotationCenter = fixedRotationCenter;
        }
        
        if (currentStep.traslazione) {
            if (currentStep.traslazione.targetElement) {
                const targetModel = this.findModelByName(currentStep.traslazione.targetElement);
                if (targetModel) {
                    // Gestione traslazione assoluta verso posizione originale
                    if (currentStep.traslazione.isAbsoluteToOriginal) {
                        // Traslazione assoluta: sposta direttamente alla posizione originale
                        targetPosition = targetModel.position.clone();
                        console.log(`🎯 ABSOLUTE ORIGINAL: Spostamento verso posizione originale`, {
                            model: model.userData?.originalFilename || model.name,
                            target: currentStep.traslazione.targetElement,
                            targetPosition: targetPosition.clone()
                        });
                    } else {
                        // Traslazione relativa: calcola offset come prima  
                        const targetBoundingBoxCenter = this.calculateBoundingBoxCenter(targetModel);
                        const sourceBoundingBoxCenter = this.calculateBoundingBoxCenter(model);
                        const centerOffset = targetBoundingBoxCenter.clone().sub(sourceBoundingBoxCenter);
                        
                        const additionalOffset = new THREE.Vector3(
                            currentStep.traslazione.x,
                            currentStep.traslazione.y,
                            currentStep.traslazione.z
                        );
                        
                        targetPosition = model.position.clone().add(centerOffset).add(additionalOffset);
                    }
                } else {
                    targetPosition.add(new THREE.Vector3(
                        currentStep.traslazione.x,
                        currentStep.traslazione.y,
                        currentStep.traslazione.z
                    ));
                }
            } else {
                const currentBoundingBoxCenter = this.calculateBoundingBoxCenter(model);
                
                const newBoundingBoxCenter = currentBoundingBoxCenter.clone().add(new THREE.Vector3(
                    currentStep.traslazione.x,
                    currentStep.traslazione.y,
                    currentStep.traslazione.z
                ));
                
                const offsetFromBoundingBoxMove = newBoundingBoxCenter.clone().sub(currentBoundingBoxCenter);
                targetPosition = model.position.clone().add(offsetFromBoundingBoxMove);
            }
        }
        
        if (currentStep.appoggia) {
            // Calcola il bounding box del modello nella sua posizione attuale
            const boundingBox = new THREE.Box3().setFromObject(model);
            const minY = boundingBox.min.y;
            
            // Calcola quanto spostare il modello per appoggiare la parte inferiore a Y=0
            // La differenza tra la posizione attuale del modello e il punto più basso
            const offsetY = model.position.y - minY;
            
            // Imposta la posizione target Y per appoggiare il punto più basso a Y=0
            targetPosition.y = offsetY;
        }

        if (currentStep.resetCenteredOriginal) {
            // Reset posizione centrata originale
            if (currentStep.resetCenteredOriginal.animated) {
                // Reset animato - usa il sistema di animazione
                console.log(`🎬 RESET ANIMATO: Avvio reset centrato animato per "${modelName}" (${currentStep.resetCenteredOriginal.durata}s)`);
                this.animateAllModelsToCenteredOriginalPositions(currentStep.resetCenteredOriginal.durata);
            } else {
                // Reset immediato
                console.log(`🎯 RESET IMMEDIATO: Esecuzione reset centrato per tutti i modelli`);
                this.resetAllModelsToCenteredOriginalPositions();
            }

            // Termina immediatamente questo step multi-step
            this.finishMultiStepMovement(modelUuid);
            return;
        }

        if (currentStep.svita) {
            // Comando semplificato svita: rotazione + traslazione
            // Imposta il centro di rotazione al centro del bounding box del modello
            rotationCenter = this.calculateBoundingBoxCenter(model);
            
            targetRotation.x += THREE.MathUtils.degToRad(currentStep.svita.rotazione.x);
            targetRotation.y += THREE.MathUtils.degToRad(currentStep.svita.rotazione.y);
            targetRotation.z += THREE.MathUtils.degToRad(currentStep.svita.rotazione.z);
            
            targetPosition.add(new THREE.Vector3(
                currentStep.svita.traslazione.x,
                currentStep.svita.traslazione.y,
                currentStep.svita.traslazione.z
            ));
        }
        
        if (currentStep.avvita) {
            // Comando semplificato avvita: rotazione inversa + traslazione inversa
            targetRotation.x += THREE.MathUtils.degToRad(currentStep.avvita.rotazione.x);
            targetRotation.y += THREE.MathUtils.degToRad(currentStep.avvita.rotazione.y);
            targetRotation.z += THREE.MathUtils.degToRad(currentStep.avvita.rotazione.z);
            
            targetPosition.add(new THREE.Vector3(
                currentStep.avvita.traslazione.x,
                currentStep.avvita.traslazione.y,
                currentStep.avvita.traslazione.z
            ));
        }
        
        if (currentStep.estrai) {
            // Comando semplificato estrai: solo traslazione in uscita
            targetPosition.add(new THREE.Vector3(
                currentStep.estrai.traslazione.x,
                currentStep.estrai.traslazione.y,
                currentStep.estrai.traslazione.z
            ));
        }
        
        if (currentStep.inserisci) {
            // Comando semplificato inserisci: solo traslazione in entrata
            targetPosition.add(new THREE.Vector3(
                currentStep.inserisci.traslazione.x,
                currentStep.inserisci.traslazione.y,
                currentStep.inserisci.traslazione.z
            ));
        }
        
        const animation = {
            model: model,
            modelUuid: modelUuid,
            stepIndex: multiStepData.currentStepIndex,
            initialPosition: initialPosition,
            targetPosition: targetPosition,
            initialRotation: initialRotation,
            targetRotation: targetRotation,
            startTime: performance.now(),
            duration: currentStep.durata,
            finished: false,
            isMultiStep: true,
            hasRotation: !!(currentStep.rotazione || currentStep.svita || currentStep.avvita),
            hasTranslation: !!(currentStep.traslazione || currentStep.svita || currentStep.avvita || currentStep.estrai || currentStep.inserisci),
            hasAppoggia: !!currentStep.appoggia,
            hasSvita: !!currentStep.svita,
            hasAvvita: !!currentStep.avvita,
            hasEstrai: !!currentStep.estrai,
            hasInserisci: !!currentStep.inserisci,
            action: `MultiStep-${multiStepData.currentStepIndex + 1}`,
            modelCenter: rotationCenter
        };
        
        this.animationSystem.activeAnimations.push(animation);
    },

    findModelByName: function(targetName) {
        let foundModel = null;
        
        // Gestione suffisso _original per posizioni iniziali
        const isOriginalReference = targetName.endsWith('_original');
        const cleanTargetName = targetName
            .replace('_original', '')
            .split('/').pop()
            .replace('.glb', '');
        
        this.scene.traverse(function(child) {
            if (child.isMesh || child.isGroup || child.isObject3D) {
                const modelName = (child.userData?.originalFilename || child.name || '').split('/').pop().replace('.glb', '');
                if (modelName === cleanTargetName) {
                    foundModel = child;
                    return;
                }
            }
        });
        
        // Se richiesta posizione originale, crea oggetto virtuale
        if (foundModel && isOriginalReference) {
            return this.createOriginalPositionReference(foundModel, targetName);
        }
        
        return foundModel;
    },
    
    /**
     * Crea un riferimento virtuale alla posizione originale di un modello
     */
    createOriginalPositionReference: function(model, referenceName) {
        const initialState = this.initialModelPositions.get(model.uuid);
        
        if (!initialState) {
            console.warn(`🔍 ORIGINAL: Posizione originale non trovata per ${referenceName}`);
            return model; // Fallback al modello corrente
        }
        
        // Oggetto virtuale con posizione originale
        const originalReference = {
            position: initialState.position.clone(),
            rotation: initialState.rotation.clone(),
            scale: initialState.scale.clone(),
            isOriginalReference: true,  // Flag diretta per controllo veloce
            originalModelName: referenceName,
            userData: {
                isOriginalReference: true,
                sourceName: referenceName,
                sourceModel: model
            },
            // Metodi compatibili per bounding box calculation
            geometry: model.geometry,
            children: model.children,
            getWorldPosition: function(target) {
                return target.copy(this.position);
            }
        };
        
        console.log(`🔍 ORIGINAL: Riferimento creato per ${referenceName}:`, {
            current: model.position.clone(),
            original: originalReference.position.clone()
        });
        
        return originalReference;
    },

    onMultiStepCompleted: function(modelUuid) {
        const multiStepData = this.animationSystem.multiStepAnimations.get(modelUuid);
        if (!multiStepData || !multiStepData.isActive) {
            return;
        }
        
        const completedStepIndex = multiStepData.currentStepIndex;
        multiStepData.currentStepIndex++;
        
        setTimeout(() => {
            if (multiStepData.currentStepIndex < multiStepData.steps.length) {
                // continue
            }
            this.executeCurrentMultiStep(modelUuid);
        }, 100);
    },

    finishMultiStepMovement: function(modelUuid) {
        const multiStepData = this.animationSystem.multiStepAnimations.get(modelUuid);
        if (multiStepData) {
            this.animationSystem.multiStepAnimations.delete(modelUuid);
            
            if (window.UI && window.UI.currentStepIndex !== undefined && window.UI.currentStepIndex >= 0) {
                this.markStepAsCompleted(window.UI.currentStepIndex);
            }
            
            this.advanceToNextTutorialStep();
        }
    },

    updateAnimations: function() {
        if (this.animationSystem.activeAnimations.length === 0) return;
        
        const currentTime = performance.now();
        
        for (let i = this.animationSystem.activeAnimations.length - 1; i >= 0; i--) {
            const anim = this.animationSystem.activeAnimations[i];
            
            if (anim.finished) {
                this.animationSystem.activeAnimations.splice(i, 1);
                continue;
            }
            
            const elapsed = (currentTime - anim.startTime) / 1000;
            let progress = Math.min(elapsed / anim.duration, 1.0);
            
            progress = this.smoothStep(progress);
            
            // Gestione uniforme di animazioni per evitare duplicazioni e conflitti
            if (anim.targetRotation && (anim.modelCenter || anim.hasSvita || anim.hasAvvita)) {
                // Rotazione attorno a centro (personalizzato o standard) - NO movimento lineare
                this.applyRotationAroundCenter(anim, progress);
            } else if (anim.targetRotation && !anim.targetPosition) {
                // Solo rotazione senza centro personalizzato
                const tempQuaternion1 = new THREE.Quaternion().setFromEuler(anim.initialRotation);
                const tempQuaternion2 = new THREE.Quaternion().setFromEuler(anim.targetRotation);
                const resultQuaternion = tempQuaternion1.slerp(tempQuaternion2, progress);
                anim.model.setRotationFromQuaternion(resultQuaternion);
            } else if (anim.targetPosition && !anim.targetRotation) {
                // Solo movimento lineare (traslazione pura)
                anim.model.position.lerpVectors(anim.initialPosition, anim.targetPosition, progress);
            } else if (anim.targetPosition && anim.targetRotation) {
                // Movimento combinato (traslazione + rotazione semplice)
                anim.model.position.lerpVectors(anim.initialPosition, anim.targetPosition, progress);
                const tempQuaternion1 = new THREE.Quaternion().setFromEuler(anim.initialRotation);
                const tempQuaternion2 = new THREE.Quaternion().setFromEuler(anim.targetRotation);
                const resultQuaternion = tempQuaternion1.slerp(tempQuaternion2, progress);
                anim.model.setRotationFromQuaternion(resultQuaternion);
            }
            
            if (progress >= 1.0) {
                anim.finished = true;
                
                anim.model.position.copy(anim.targetPosition);
                if (anim.targetRotation) {
                    anim.model.rotation.copy(anim.targetRotation);
                }
                
                if (anim.isMultiStep) {
                    this.onMultiStepCompleted(anim.modelUuid);
                } else {
                    if (window.UI && window.UI.currentStepIndex !== undefined && window.UI.currentStepIndex >= 0) {
                        this.markStepAsCompleted(window.UI.currentStepIndex);
                    }
                    this.advanceToNextTutorialStep();
                }
            }
        }
    },

    applyRotationAroundCenter: function(anim, progress) {
        const currentRotation = new THREE.Euler(
            anim.initialRotation.x + (anim.targetRotation.x - anim.initialRotation.x) * progress,
            anim.initialRotation.y + (anim.targetRotation.y - anim.initialRotation.y) * progress,
            anim.initialRotation.z + (anim.targetRotation.z - anim.initialRotation.z) * progress
        );
        
        const linearMovement = new THREE.Vector3().lerpVectors(anim.initialPosition, anim.targetPosition, progress);
        
        if (anim.modelCenter && anim.modelCenter.length() > 0.001) {
            const pivot = anim.modelCenter;
            
            // Per animazioni multistep con rotazione, calcola la posizione interpolando l'angolo
            if (anim.isMultiStep && anim.hasRotation) {
                // Calcola la posizione attuale basandosi sulla rotazione attorno al pivot
                const rotationDelta = new THREE.Euler(
                    currentRotation.x - anim.initialRotation.x,
                    currentRotation.y - anim.initialRotation.y,
                    currentRotation.z - anim.initialRotation.z
                );
                
                const rotationMatrix = new THREE.Matrix4();
                rotationMatrix.makeRotationFromEuler(rotationDelta);
                
                const relativePosition = anim.initialPosition.clone().sub(pivot);
                relativePosition.applyMatrix4(rotationMatrix);
                const newPosition = pivot.clone().add(relativePosition);
                
                // Aggiungi traslazione SOLO se è esplicitamente richiesta (non per rotazioni pure)
                if (anim.hasTranslation) {
                    const translationProgress = linearMovement.clone().sub(anim.initialPosition);
                    newPosition.add(translationProgress);
                }
                
                anim.model.rotation.copy(currentRotation);
                anim.model.position.copy(newPosition);
                
                console.log(`🔄 MultiStep rotazione attorno a pivot (${pivot.x.toFixed(3)}, ${pivot.y.toFixed(3)}, ${pivot.z.toFixed(3)}): nuova pos (${newPosition.x.toFixed(3)}, ${newPosition.y.toFixed(3)}, ${newPosition.z.toFixed(3)})`);
            } else if (anim.isMultiStep) {
                // Semplice interpolazione per multistep senza rotazione
                anim.model.rotation.copy(currentRotation);
                anim.model.position.copy(linearMovement);
            } else {
                // Sistema di rotazione attorno al pivot per animazioni singole
                const matrix = new THREE.Matrix4();
                matrix.makeTranslation(-pivot.x, -pivot.y, -pivot.z);
                
                const rotationMatrix = new THREE.Matrix4();
                rotationMatrix.makeRotationFromEuler(currentRotation);
                matrix.premultiply(rotationMatrix);
                
                const translateBack = new THREE.Matrix4();
                translateBack.makeTranslation(pivot.x, pivot.y, pivot.z);
                matrix.premultiply(translateBack);
                
                const transformedPosition = anim.initialPosition.clone();
                transformedPosition.applyMatrix4(matrix);
                
                const finalPosition = linearMovement.clone();
                const offset = transformedPosition.clone().sub(anim.initialPosition);
                finalPosition.add(offset);
                
                anim.model.position.copy(finalPosition);
                anim.model.rotation.copy(currentRotation);
            }
        } else {
            anim.model.rotation.copy(currentRotation);
            anim.model.position.copy(linearMovement);
        }
    },

    smoothStep: function(t) {
        t = Math.max(0, Math.min(1, t));
        return t * t * (3 - 2 * t);
    },

    getCurrentTutorialStep: function() {
        if (!window.UI || !window.UI.tutorialSteps || window.UI.currentStepIndex === undefined || window.UI.currentStepIndex < 0) {
            return null;
        }
        
        const stepIndex = window.UI.currentStepIndex;
        return window.UI.tutorialSteps[stepIndex] || null;
    },

    getRequiredToolForStep: function(step) {
        if (!step || !step.properties) {
            return null;
        }
        
        if (step.properties.Utensile) {
            const toolMapping = {
                'ChiaveBrugola': 'brugola',
                'ChiaveInglese': 'chiave_inglese',
                'Mani': 'mano',
                'Aria': 'aria'
            };
            
            return toolMapping[step.properties.Utensile] || null;
        }
        
        return 'mano';
    },

    isLastTutorialStep: function(stepIndex) {
        if (!window.UI || !window.UI.tutorialSteps) {
            return false;
        }
        
        return stepIndex === (window.UI.tutorialSteps.length - 1);
    },

    markStepAsCompleted: function(stepIndex) {
        this.tutorialTracker.completedSteps.add(stepIndex);
        
        if (this.isLastTutorialStep(stepIndex)) {
            this.tutorialTracker.lastStepCompleted = true;
            if (this.highlightSystem.isHighlighting) {
                this.removeHighlight();
            }
        }
    },

    resetTutorialTracker: function() {
        this.tutorialTracker.completedSteps.clear();
        this.tutorialTracker.lastStepCompleted = false;
        this.tutorialTracker.interactionsBlocked = false; // Sblocca interazioni per nuovo tutorial
        console.log('🔓 INTERAZIONI SBLOCCATE: Nuovo tutorial avviato');
    },

    /**
     * Salva la posizione iniziale di un modello
     */
    saveInitialModelPosition: function(model) {
        if (!model || !model.uuid) return;

        // Calcola il centro del bounding box come posizione di riferimento
        const centerPosition = this.calculateBoundingBoxCenter(model);

        this.initialModelPositions.set(model.uuid, {
            position: centerPosition.clone(),  // Usa centro bounding box invece di model.position
            rotation: model.rotation.clone(),
            scale: model.scale.clone(),
            modelPosition: model.position.clone()  // Salva anche model.position originale per riferimento
        });

        console.log(`💾 Posizione iniziale salvata per modello: ${model.name || model.uuid} - Centro BB: (${centerPosition.x.toFixed(3)}, ${centerPosition.y.toFixed(3)}, ${centerPosition.z.toFixed(3)})`);
    },

    /**
     * Ripristina tutti i modelli alle posizioni iniziali
     * Se ci sono impostazioni tutorial da applicare, le applica prima del reset
     */
    resetAllModelsToInitialPositions: function(tutorialStep = null) {
        console.log('🔄 RESET: Ripristino posizioni iniziali di tutti i modelli...');
        
        let resetCount = 0;
        
        // FASE 1: Ripristina alle posizioni iniziali salvate al caricamento
        for (const model of this.loadedModels) {
            if (this.resetModelToInitialPosition(model)) {
                resetCount++;
            }
        }
        
        // FASE 2: Applica eventuali impostazioni tutorial (Posizione=, Rotazione=)
        if (tutorialStep && tutorialStep.properties) {
            console.log('🔄 RESET: Applicazione impostazioni modelli dal tutorial...');
            this.applyModelSettings(tutorialStep);
            
            // FASE 3: Risalva le nuove posizioni come "iniziali" per questo tutorial
            console.log('🔄 RESET: Aggiornamento posizioni iniziali con impostazioni tutorial...');
            for (const model of this.loadedModels) {
                this.saveInitialModelPosition(model);
            }
        }
        
        console.log(`🔄 RESET: ${resetCount} modelli ripristinati alle posizioni iniziali`);
        return resetCount;
    },

    /**
     * Ripristina un singolo modello alla posizione iniziale
     */
    resetModelToInitialPosition: function(model) {
        if (!model || !model.uuid) return false;

        const initialState = this.initialModelPositions.get(model.uuid);
        if (!initialState) {
            console.warn(`⚠️ Nessuna posizione iniziale trovata per modello: ${model.name || model.uuid}`);
            return false;
        }

        // Ripristina rotazione e scala
        model.rotation.copy(initialState.rotation);
        model.scale.copy(initialState.scale);

        // Ripristina model.position utilizzando il valore originale salvato
        if (initialState.modelPosition) {
            model.position.copy(initialState.modelPosition);
        } else {
            // Fallback per compatibilità con salvataggi precedenti
            model.position.copy(initialState.position);
        }

        console.log(`🔄 Modello ripristinato: ${model.name || model.uuid} - Pos: (${model.position.x.toFixed(3)}, ${model.position.y.toFixed(3)}, ${model.position.z.toFixed(3)})`);
        return true;
    },

    advanceToNextTutorialStep: function() {
        if (!window.UI || !window.UI.tutorialSteps) {
            return;
        }
        
        const currentIndex = window.UI.currentStepIndex;
        const totalSteps = window.UI.tutorialSteps.length;
        
        if (currentIndex < totalSteps - 1) {
            setTimeout(() => {
                if (window.UI && window.UI.goToStep) {
                    window.UI.goToStep(currentIndex + 1);
                }
            }, 100);
        } else if (currentIndex === totalSteps - 1) {
            // Tutorial completato! Blocca interazioni e mostra congratulazioni
            this.tutorialTracker.interactionsBlocked = true;
            console.log('🔒 INTERAZIONI BLOCCATE: Tutorial completato');
            
            setTimeout(() => {
                this.showTutorialCompletionCongratulations();
            }, 500); // Delay più lungo per dare tempo all'animazione finale
        }
    },

    /**
     * Mostra messaggio di congratulazioni per completamento tutorial
     */
    showTutorialCompletionCongratulations: function() {
        if (!window.UI || !window.UI.currentTutorial) {
            return;
        }

        const tutorialName = window.UI.currentTutorial.name;
        const userName = this.getCurrentUserName();
        
        console.log(`🎉 Tutorial "${tutorialName}" completato!`);
        
        // Crea e mostra il messaggio di congratulazioni
        this.displayCongratulationsModal(userName, tutorialName);
    },

    /**
     * Ottiene il nome utente corrente dal sistema di login
     */
    getCurrentUserName: function() {
        // Verifica se l'utente è loggato e abbiamo il nome
        if (window.currentUser && window.currentUser.name) {
            return window.currentUser.name;
        }
        
        // Fallback: cerca in localStorage se implementato
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            try {
                const userData = JSON.parse(storedUser);
                if (userData.name) {
                    return userData.name;
                }
            } catch (e) {
                console.warn('Errore parsing dati utente da localStorage:', e);
            }
        }
        
        // Fallback generico se non trovato
        return "Utente";
    },

    /**
     * Visualizza il modal di congratulazioni
     */
    displayCongratulationsModal: function(userName, tutorialName) {
        // Rimuovi eventuali modal esistenti
        this.removeCongratulationsModal();

        // Crea il modal
        const modal = document.createElement('div');
        modal.id = 'congratulationsModal';
        modal.className = 'congratulations-modal';
        
        // Crea il contenuto
        modal.innerHTML = `
            <div class="congratulations-content">
                <div class="congratulations-header">
                    <h2>🎉 Complimenti!</h2>
                </div>
                <div class="congratulations-body">
                    <p class="congratulations-text">
                        <strong>${userName}</strong>, hai completato con successo il tutorial:
                    </p>
                    <p class="tutorial-name">
                        "${tutorialName}"
                    </p>
                    <div class="congratulations-stats">
                        <p>✅ Tutti gli step sono stati completati</p>
                        <p>🏆 Ottimo lavoro!</p>
                    </div>
                </div>
                <div class="congratulations-footer">
                    <button id="congratulationsCloseBtn" class="congratulations-close-btn">
                        Continua
                    </button>
                </div>
            </div>
        `;

        // Aggiungi alla pagina
        document.body.appendChild(modal);

        // Gestisce il click sul pulsante "Continua"
        const closeBtn = document.getElementById('congratulationsCloseBtn');
        if (closeBtn) {
            closeBtn.onclick = () => {
                // NOTA: Non resettare qui - il reset avviene solo quando si seleziona un nuovo tutorial
                // Questo permette all'utente di vedere il risultato finale prima di decidere
                this.removeCongratulationsModal();
                console.log('ℹ️ Tutorial completato. Seleziona un nuovo tutorial per ripristinare le posizioni iniziali.');
            };
        }

        // Mostra il modal con animazione
        setTimeout(() => {
            modal.classList.add('show');
        }, 50);

        console.log(`🎉 Congratulazioni mostrate per ${userName} - Tutorial: ${tutorialName}`);
    },

    /**
     * Rimuove il modal di congratulazioni
     */
    removeCongratulationsModal: function() {
        const modal = document.getElementById('congratulationsModal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            }, 300); // Tempo per l'animazione di uscita
        }
    },

    /**
     * Funzione di debug per testare le congratulazioni
     * Da rimuovere in produzione o nascondere dietro flag di debug
     */
    testCongratulations: function() {
        console.log("🧪 Test congratulazioni tutorial");
        this.showTutorialCompletionCongratulations();
    },

    /**
     * Funzione di test completo con utente simulato (per debug)
     * Uso: Scene3D.testCongratulationsWithUser('Pippo')
     */
    testCongratulationsWithUser: function(testUserName = null) {
        console.log('🧪 TEST: Avvio test completo sistema congratulazioni...');
        
        // Se non c'è un utente reale, simula uno per il test
        if (testUserName && !window.currentUser) {
            console.log('🧪 TEST: Simulazione utente per test:', testUserName);
            window.currentUser = {
                name: testUserName,
                loginTime: new Date(),
                expiration: new Date(Date.now() + 24*60*60*1000) // 24 ore da ora
            };
        }
        
        // Simula un tutorial attivo per il test
        const originalTutorial = this.currentTutorialName;
        this.currentTutorialName = 'Tutorial di Test';
        
        // Mostra le congratulazioni
        this.showTutorialCompletionCongratulations();
        
        // Ripristina il tutorial originale dopo un po'
        setTimeout(() => {
            if (originalTutorial) {
                this.currentTutorialName = originalTutorial;
            }
        }, 5000);
        
        console.log('🧪 TEST: Test completato!');
        console.log('🧪 TEST: Utente corrente:', this.getCurrentUserName());
        console.log('🧪 TEST: Tutorial corrente:', this.currentTutorialName);
    },

    /**
     * Test delle transizioni fluide del target camera (per debug)
     * Uso: Scene3D.testCameraTargetTransitions()
     */
    testCameraTargetTransitions: function() {
        console.log('🎥 TEST: Avvio test transizioni target camera fluide...');
        
        // Test 1: Transizione verso coordinate assolute
        setTimeout(() => {
            console.log('🎥 TEST: Transizione verso (2, 1, 0)');
            this.applyCameraSettings({
                properties: {
                    CameraTarget: '(2, 1, 0)',
                    CameraTransitionTime: '2.0'
                }
            });
        }, 1000);
        
        // Test 2: Transizione verso origine
        setTimeout(() => {
            console.log('🎥 TEST: Transizione verso origine (0, 0, 0)');
            this.applyCameraSettings({
                properties: {
                    CameraTarget: '(0, 0, 0)',
                    CameraTransitionTime: '1.5'
                }
            });
        }, 5000);
        
        // Test 3: Transizione verso coordinate elevate
        setTimeout(() => {
            console.log('🎥 TEST: Transizione verso alto (-1, 3, 1)');
            this.applyCameraSettings({
                properties: {
                    CameraTarget: '(-1, 3, 1)',
                    CameraTransitionTime: '3.0'
                }
            });
        }, 8500);
        
        console.log('🎥 TEST: Tre transizioni avviate - osserva se il target si muove fluidamente');
    },

    /**
     * Test del comportamento tool senza evidenziazione automatica (per debug)
     * Uso: Scene3D.testToolBehaviorWithoutAutoHighlight()
     */
    testToolBehaviorWithoutAutoHighlight: function() {
        console.log('🔧 TEST: Verifica comportamento tool senza evidenziazione automatica...');
        
        // Simula step tutorial con tool richiesto
        const testStep = {
            properties: {
                Utensile: 'Aria',
                Elemento: 'filtro',
                Descrizione: 'Test: Tool Aria richiesto ma NON evidenziato automaticamente'
            }
        };
        
        console.log('🔧 TEST: Step simulato:', testStep);
        console.log('🔧 TEST: 1. Tool "Aria" è richiesto ma NON dovrebbe essere evidenziato automaticamente');
        console.log('🔧 TEST: 2. L\'elemento "filtro" dovrebbe essere evidenziato normalmente');
        console.log('🔧 TEST: 3. Solo quando l\'utente clicca tool "Aria" manualmente, questo dovrebbe attivarsi');
        console.log('🔧 TEST: 4. Click su elemento con tool sbagliato dovrebbe mantenere evidenziazione');
        console.log('🔧 TEST: 5. Click su elemento con tool giusto dovrebbe rimuovere evidenziazione');
        
        // Applica step tutorial
        if (window.UI && window.UI.handleTutorialStepChanged) {
            window.UI.handleTutorialStepChanged(testStep);
        }
        
        // Status report
        setTimeout(() => {
            console.log('🔧 TEST: Status dopo 1 secondo:');
            if (window.ToolsManager) {
                console.log('🔧 TEST: Tool attivo:', window.ToolsManager.getActiveTool());
                console.log('🔧 TEST: Stato tools:', window.ToolsManager.getToolsState());
            }
            console.log('🔧 TEST: Verifica visivamente:');
            console.log('🔧 TEST: - Il tool "Aria" NON dovrebbe essere evidenziato');
            console.log('🔧 TEST: - L\'elemento "filtro" dovrebbe essere evidenziato (se presente)');
            console.log('🔧 TEST: - L\'utente deve cliccare manualmente il tool "Aria" per attivarlo');
        }, 1000);
        
        return testStep;
    },

    /**
     * Esporta tutte le posizioni e rotazioni correnti dei modelli in formato tutorial.txt
     * Uso: Scene3D.exportCurrentModelPositions()
     */
    exportCurrentModelPositions: function() {
        console.log('📝 EXPORT: Inizio esportazione posizioni e rotazioni modelli...');
        
        if (this.loadedModels.length === 0) {
            console.warn('⚠️ EXPORT: Nessun modello caricato nella scena');
            return null;
        }
        
        let exportLines = [];
        exportLines.push('# Posizioni e Rotazioni Modelli - Esportate automaticamente');
        exportLines.push('# Generato il: ' + new Date().toLocaleString('it-IT'));
        exportLines.push('# Sintassi: Posizione=nomeModello:(x,y,z) e Rotazione=nomeModello:(rx,ry,rz)');
        exportLines.push('');
        
        // Esporta ogni modello caricato
        this.loadedModels.forEach((model, index) => {
            const modelName = this.getModelDisplayName(model);
            const pos = model.position;
            const rot = model.rotation;
            
            // Converti radianti in gradi per rotazione
            const rotDeg = {
                x: (rot.x * 180 / Math.PI),
                y: (rot.y * 180 / Math.PI), 
                z: (rot.z * 180 / Math.PI)
            };
            
            // Formatta con 3 decimali per precisione
            const posStr = `(${pos.x.toFixed(3)},${pos.y.toFixed(3)},${pos.z.toFixed(3)})`;
            const rotStr = `(${rotDeg.x.toFixed(1)},${rotDeg.y.toFixed(1)},${rotDeg.z.toFixed(1)})`;
            
            // Aggiungi commento descrittivo
            exportLines.push(`# Modello ${index + 1}: ${modelName}`);
            exportLines.push(`Posizione=${modelName}:${posStr}`);
            exportLines.push(`Rotazione=${modelName}:${rotStr}`);
            exportLines.push('');
            
            console.log(`📝 EXPORT: ${modelName} - Pos: ${posStr}, Rot: ${rotStr}`);
        });
        
        // Crea contenuto finale
        const exportContent = exportLines.join('\n');
        
        // Mostra nel console per copia manuale
        console.log('📝 EXPORT: Contenuto generato:');
        console.log('═'.repeat(50));
        console.log(exportContent);
        console.log('═'.repeat(50));
        
        // Prova a scaricare come file (se supportato dal browser)
        this.downloadModelPositionsFile(exportContent);
        
        return exportContent;
    },

    /**
     * Ottiene il nome display di un modello per l'export
     */
    getModelDisplayName: function(model) {
        // Priorità: originalFilename > name > uuid
        if (model.userData && model.userData.originalFilename) {
            // Rimuovi estensione per sintassi tutorial pulita
            return model.userData.originalFilename.replace(/\.(glb|gltf|obj|stl)$/i, '');
        }
        
        if (model.name && model.name.trim()) {
            return model.name.replace(/\.(glb|gltf|obj|stl)$/i, '');
        }
        
        // Fallback a UUID breve
        return 'modello_' + model.uuid.substring(0, 8);
    },

    /**
     * Prova a scaricare il file delle posizioni (solo browser moderni)
     */
    downloadModelPositionsFile: function(content) {
        try {
            // Crea timestamp per nome file
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:\-]/g, '').replace('T', '_');
            const filename = `model_positions_${timestamp}.txt`;
            
            // Crea blob e download
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            
            // Crea link temporaneo per download
            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            downloadLink.download = filename;
            downloadLink.style.display = 'none';
            
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            
            // Cleanup
            URL.revokeObjectURL(url);
            
            console.log(`💾 EXPORT: File scaricato come: ${filename}`);
            
        } catch (error) {
            console.warn('⚠️ EXPORT: Download automatico non supportato:', error.message);
            console.log('💡 EXPORT: Copia manualmente il contenuto dalla console sopra');
        }
    },

    /**
     * Test del sistema di blocco post-tutorial e reset posizioni (per debug)
     * Uso: Scene3D.testPostTutorialBlockAndReset()
     */
    testPostTutorialBlockAndReset: function() {
        console.log('🔒 TEST: Simulazione completamento tutorial e test blocco interazioni...');
        
        // Simula completamento tutorial
        this.tutorialTracker.lastStepCompleted = true;
        this.tutorialTracker.interactionsBlocked = true;
        
        console.log('🔒 TEST: Tutorial simulato come completato');
        console.log('🔒 TEST: interactionsBlocked =', this.tutorialTracker.interactionsBlocked);
        
        // Test 1: Prova click su modello (dovrebbe essere bloccato)
        console.log('🔒 TEST 1: Simulazione click su modello (dovrebbe essere bloccato)...');
        const mockEvent = { clientX: 100, clientY: 100 };
        this.handleModelClick(mockEvent);
        
        // Test 2: Mostra stato posizioni iniziali
        console.log('🔒 TEST 2: Stato posizioni iniziali salvate:');
        console.log('🔒 TEST: Modelli con posizioni salvate:', this.initialModelPositions.size);
        this.initialModelPositions.forEach((state, uuid) => {
            const model = this.loadedModels.find(m => m.uuid === uuid);
            const modelName = model ? (model.name || model.userData?.originalFilename || uuid.substring(0,8)) : uuid.substring(0,8);
            console.log(`🔒 TEST: - ${modelName}: pos(${state.position.x.toFixed(2)}, ${state.position.y.toFixed(2)}, ${state.position.z.toFixed(2)})`);
        });
        
        // Test 3: Test reset tutorial tracker
        console.log('🔒 TEST 3: Test reset tutorial tracker...');
        setTimeout(() => {
            console.log('🔒 TEST: Reset tutorial tracker...');
            this.resetTutorialTracker();
            console.log('🔒 TEST: interactionsBlocked dopo reset =', this.tutorialTracker.interactionsBlocked);
            
            // Test 4: Test reset posizioni
            console.log('🔒 TEST 4: Test reset posizioni...');
            const resetCount = this.resetAllModelsToInitialPositions();
            console.log('🔒 TEST: Modelli resettati:', resetCount);
            
            console.log('🔒 TEST: Sistema completo testato!');
        }, 2000);
        
        return {
            interactionsBlocked: this.tutorialTracker.interactionsBlocked,
            savedPositionsCount: this.initialModelPositions.size,
            modelsCount: this.loadedModels.length
        };
    },

    saveCurrentView: function() {
        this.savedView = {
            position: this.camera.position.clone(),
            rotation: this.camera.rotation.clone(),
            zoom: this.camera.zoom
        };
    },

    startRenderLoop: function() {
        const animate = () => {
            requestAnimationFrame(animate);
            this.render();
        };
        
        animate();
    },

    render: function() {
        if (this.scene && this.camera && this.renderer) {
            this.updateAnimations();
            this.updateCameraAnimation();
            this.updatePivotAnimation();
            
            // Aggiorna sistema particellare se attivo
            if (this.particleSystem && this.particleSystem.isActive) {
                this.particleSystem.update(0.016); // ~60 FPS delta time
            }
            
            this.renderer.render(this.scene, this.camera);
        }
    },

    applyCameraSettings: function(tutorialStep) {
        if (!tutorialStep.properties) return;
        
        const props = tutorialStep.properties;
        let cameraChanged = false;
        
        // Controlla se ci sono effettivamente parametri camera in questo step
        const hasCameraSettings = props.CameraPos || props.CameraTarget || props.CameraZoom || props.CameraTransitionTime;
        if (!hasCameraSettings) {
            console.log(`📹 CAMERA: Nessun parametro camera nello step, camera rimane ferma`);
            return;
        }
        
        // Inizializza sistema animazione camera
        this.cameraAnimation = this.cameraAnimation || {
            isAnimating: false,
            startTime: 0,
            duration: 2.0,
            startPosition: null,
            targetPosition: null,
            startTarget: null,
            targetTarget: null,
            startZoom: null,
            targetZoom: null
        };
        
        // Parsing CameraPos=(x, y, z) o CameraPos=elemento:offset
        if (props.CameraPos) {
            let targetPosition = null;
            
            if (props.CameraPos.includes(':')) {
                const [elementName, offsetString] = props.CameraPos.split(':').map(s => s.trim());
                const offsetMatch = offsetString.match(/\(([^)]+)\)/);
                
                if (offsetMatch) {
                    const offsetCoords = offsetMatch[1].split(',').map(v => parseFloat(v.trim()));
                    if (offsetCoords.length === 3) {
                        const targetModel = this.findModelByName(elementName);
                        if (targetModel) {
                            const elementCenter = this.calculateBoundingBoxCenter(targetModel);
                            targetPosition = new THREE.Vector3(
                                elementCenter.x + offsetCoords[0],
                                elementCenter.y + offsetCoords[1],
                                elementCenter.z + offsetCoords[2]
                            );
                            console.log(`📹 CAMERA: Posizione relativa a "${elementName}" + offset(${offsetCoords[0]}, ${offsetCoords[1]}, ${offsetCoords[2]}) = (${targetPosition.x.toFixed(3)}, ${targetPosition.y.toFixed(3)}, ${targetPosition.z.toFixed(3)})`);
                        }
                    }
                }
            } else {
                const posMatch = props.CameraPos.match(/\(([^)]+)\)/);
                if (posMatch) {
                    const coords = posMatch[1].split(',').map(v => parseFloat(v.trim()));
                    if (coords.length === 3) {
                        targetPosition = new THREE.Vector3(coords[0], coords[1], coords[2]);
                        console.log(`📹 CAMERA: Posizione assoluta (${targetPosition.x}, ${targetPosition.y}, ${targetPosition.z})`);
                    }
                }
            }
            
            if (targetPosition) {
                cameraChanged = true;
                this.cameraAnimation.targetPosition = targetPosition;
            }
        }
        
        // Parsing CameraTarget=(x, y, z) o CameraTarget=elemento
        if (props.CameraTarget) {
            let targetTarget = null;
            
            if (props.CameraTarget.includes('(')) {
                const targetMatch = props.CameraTarget.match(/\(([^)]+)\)/);
                if (targetMatch) {
                    const coords = targetMatch[1].split(',').map(v => parseFloat(v.trim()));
                    if (coords.length === 3) {
                        targetTarget = new THREE.Vector3(coords[0], coords[1], coords[2]);
                        console.log(`📹 CAMERA: Target assoluto (${targetTarget.x}, ${targetTarget.y}, ${targetTarget.z})`);
                    }
                }
            } else {
                const targetModel = this.findModelByName(props.CameraTarget);
                if (targetModel) {
                    targetTarget = this.calculateBoundingBoxCenter(targetModel);
                    console.log(`📹 CAMERA: Target elemento "${props.CameraTarget}" = (${targetTarget.x.toFixed(3)}, ${targetTarget.y.toFixed(3)}, ${targetTarget.z.toFixed(3)})`);
                }
            }
            
            if (targetTarget) {
                cameraChanged = true;
                this.cameraAnimation.targetTarget = targetTarget;
                // NON copiare immediatamente il target - sarà animato
                // this.mouseControls.pivotPoint.copy(targetTarget);
            }
        }
        
        // Parsing CameraZoom
        if (props.CameraZoom) {
            const zoom = parseFloat(props.CameraZoom);
            if (!isNaN(zoom)) {
                cameraChanged = true;
                this.cameraAnimation.targetZoom = zoom;
                console.log(`📹 CAMERA: Zoom = ${zoom}`);
            }
        }
        
        // Parsing CameraTransitionTime
        if (props.CameraTransitionTime) {
            const duration = parseFloat(props.CameraTransitionTime);
            if (!isNaN(duration)) {
                this.cameraAnimation.duration = duration;
                console.log(`📹 CAMERA: Durata transizione = ${duration}s`);
            }
        }
        
        // Avvia animazione camera se ci sono cambiamenti
        if (cameraChanged) {
            this.startCameraAnimation();
        }
    },

    startCameraAnimation: function() {
        this.cameraAnimation.isAnimating = true;
        this.cameraAnimation.startTime = performance.now();
        this.cameraAnimation.startPosition = this.camera.position.clone();
        this.cameraAnimation.startTarget = this.mouseControls.pivotPoint.clone();
        
        // Calcola distanza se è richiesto zoom
        if (this.cameraAnimation.targetZoom) {
            const currentDistance = this.camera.position.distanceTo(this.mouseControls.pivotPoint);
            this.cameraAnimation.startZoom = currentDistance;
            this.cameraAnimation.targetZoom = this.cameraAnimation.targetZoom;
        }
        
        console.log(`📹 CAMERA: Avvio animazione camera (durata: ${this.cameraAnimation.duration}s)`);
    },

    applyModelSettings: function(tutorialStep) {
        if (!tutorialStep.properties) return;

        const props = tutorialStep.properties;

        // Cerca le direttive Posizione= e Rotazione=
        Object.keys(props).forEach(key => {
            if (key.startsWith('Posizione')) {
                const value = props[key];
                if (Array.isArray(value)) {
                    // Gestione array di posizioni multiple
                    console.log(`🔧 MODEL: Applicazione ${value.length} posizioni multiple`);
                    value.forEach((pos, index) => {
                        this.applyModelPosition(`${key}_${index}`, pos);
                    });
                } else {
                    // Gestione singola posizione (legacy)
                    this.applyModelPosition(key, value);
                }
            } else if (key.startsWith('Rotazione')) {
                const value = props[key];
                if (Array.isArray(value)) {
                    // Gestione array di rotazioni multiple
                    console.log(`🔧 MODEL: Applicazione ${value.length} rotazioni multiple`);
                    value.forEach((rot, index) => {
                        this.applyModelRotation(`${key}_${index}`, rot);
                    });
                } else {
                    // Gestione singola rotazione (legacy)
                    this.applyModelRotation(key, value);
                }
            }
        });
    },

    applyModelPosition: function(key, value) {
        // Parsing: Posizione=modello.glb:(-2,0,0) o Posizione=(-2,0,0) (per tutti i modelli)
        let modelName = null;
        let positionValue = value;
        
        if (value.includes(':')) {
            const [model, pos] = value.split(':').map(s => s.trim());
            modelName = model.replace('.glb', '');
            positionValue = pos;
        }
        
        // Parsing coordinate: (-2,0,0)
        const posMatch = positionValue.match(/\(([^)]+)\)/);
        if (!posMatch) {
            console.warn(`🔧 MODEL: Formato posizione non valido: ${value}`);
            return;
        }
        
        const coords = posMatch[1].split(',').map(n => parseFloat(n.trim()));
        if (coords.length !== 3) {
            console.warn(`🔧 MODEL: Coordinate posizione non valide: ${value}`);
            return;
        }
        
        const position = new THREE.Vector3(coords[0], coords[1], coords[2]);
        
        // Applica la posizione
        if (modelName) {
            // Applica a modello specifico
            const model = this.findModelByName(modelName);
            if (model) {
                model.position.copy(position);
                console.log(`🔧 MODEL: Posizione applicata a "${modelName}": (${coords[0]}, ${coords[1]}, ${coords[2]})`);
            } else {
                console.warn(`🔧 MODEL: Modello "${modelName}" non trovato per posizionamento`);
            }
        } else {
            // Applica a tutti i modelli (se non specificato)
            this.loadedModels.forEach(model => {
                if (model && model.position) {
                    model.position.copy(position);
                }
            });
            console.log(`🔧 MODEL: Posizione applicata a tutti i modelli: (${coords[0]}, ${coords[1]}, ${coords[2]})`);
        }
    },

    applyModelRotation: function(key, value) {
        // Parsing: Rotazione=modello.glb:(0,90,0) o Rotazione=(0,90,0) (per tutti i modelli)
        let modelName = null;
        let rotationValue = value;
        
        if (value.includes(':')) {
            const [model, rot] = value.split(':').map(s => s.trim());
            modelName = model.replace('.glb', '');
            rotationValue = rot;
        }
        
        // Parsing coordinate: (0,90,0) - in gradi
        const rotMatch = rotationValue.match(/\(([^)]+)\)/);
        if (!rotMatch) {
            console.warn(`🔧 MODEL: Formato rotazione non valido: ${value}`);
            return;
        }
        
        const angles = rotMatch[1].split(',').map(n => parseFloat(n.trim()));
        if (angles.length !== 3) {
            console.warn(`🔧 MODEL: Angoli rotazione non validi: ${value}`);
            return;
        }
        
        // Converti da gradi a radianti
        const rotation = new THREE.Euler(
            angles[0] * Math.PI / 180,
            angles[1] * Math.PI / 180,
            angles[2] * Math.PI / 180
        );
        
        // Applica la rotazione
        if (modelName) {
            // Applica a modello specifico
            const model = this.findModelByName(modelName);
            if (model) {
                model.rotation.copy(rotation);
                console.log(`🔧 MODEL: Rotazione applicata a "${modelName}": (${angles[0]}°, ${angles[1]}°, ${angles[2]}°)`);
            } else {
                console.warn(`🔧 MODEL: Modello "${modelName}" non trovato per rotazione`);
            }
        } else {
            // Applica a tutti i modelli (se non specificato)
            this.loadedModels.forEach(model => {
                if (model && model.rotation) {
                    model.rotation.copy(rotation);
                }
            });
            console.log(`🔧 MODEL: Rotazione applicata a tutti i modelli: (${angles[0]}°, ${angles[1]}°, ${angles[2]}°)`);
        }
    },

    applySilhouetteToModel: function(modelName, color = 0xffff00) {
        // CONTROLLO: Se DragDropSystem ha bloccato questo modello, non applicare silhouette
        if (window.DragDropSystem && window.DragDropSystem.silhouetteBlocked &&
            window.DragDropSystem.silhouetteBlocked.has(modelName)) {
            console.log(`🔍 SILHOUETTE: ❌ BLOCCATA per ${modelName} durante drag&drop`);
            return;
        }

        console.log(`🔍 SILHOUETTE: ✅ APPLICAZIONE per ${modelName} (non bloccata)`);
        if (window.DragDropSystem && window.DragDropSystem.silhouetteBlocked) {
            console.log(`🔍 SILHOUETTE: Modelli bloccati:`, Array.from(window.DragDropSystem.silhouetteBlocked));
        }

        // Trova il modello
        const model = this.findModelByName(modelName);
        if (!model) {
            console.warn(`🔍 SILHOUETTE: Modello "${modelName}" non trovato`);
            return;
        }

        // Crea materiale silhouette che passa attraverso tutto
        const silhouetteMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.8,
            depthTest: false,  // Visibile attraverso tutti gli oggetti
            depthWrite: false, // Non scrive nel depth buffer
            side: THREE.DoubleSide // Visibile da entrambi i lati
        });

        // Applica il materiale a tutti i mesh del modello
        model.traverse((child) => {
            if (child.isMesh) {
                // Salva il materiale originale se non già fatto
                if (!child.userData.originalMaterial) {
                    child.userData.originalMaterial = child.material;
                }
                // Applica la silhouette
                child.material = silhouetteMaterial;
                console.log(`🔍 SILHOUETTE: Materiale silhouette applicato a "${child.name}"`);
            }
        });

        console.log(`🔍 SILHOUETTE: Silhouette gialla applicata al modello "${modelName}" - ora è visibile ovunque!`);
        console.log(`🔍 SILHOUETTE: Posizione corrente: (${model.position.x.toFixed(2)}, ${model.position.y.toFixed(2)}, ${model.position.z.toFixed(2)})`);
    },

    removeSilhouetteFromModel: function(modelName) {
        // Trova il modello
        const model = this.findModelByName(modelName);
        if (!model) {
            console.warn(`🔍 SILHOUETTE: Modello "${modelName}" non trovato per rimozione silhouette`);
            return;
        }

        // Ripristina i materiali originali
        model.traverse((child) => {
            if (child.isMesh && child.userData.originalMaterial) {
                child.material = child.userData.originalMaterial;
                delete child.userData.originalMaterial;
                console.log(`🔍 SILHOUETTE: Materiale originale ripristinato per "${child.name}"`);
            }
        });

        console.log(`🔍 SILHOUETTE: Silhouette rimossa dal modello "${modelName}"`);
    },

    updateCameraAnimation: function() {
        if (!this.cameraAnimation || !this.cameraAnimation.isAnimating) return;
        
        const elapsed = (performance.now() - this.cameraAnimation.startTime) / 1000;
        let progress = Math.min(elapsed / this.cameraAnimation.duration, 1.0);
        
        // Smooth easing
        progress = this.smoothStep(progress);
        
        // Interpola posizione
        if (this.cameraAnimation.targetPosition) {
            this.camera.position.lerpVectors(
                this.cameraAnimation.startPosition,
                this.cameraAnimation.targetPosition,
                progress
            );
        }
        
        // Interpola target
        if (this.cameraAnimation.targetTarget) {
            this.mouseControls.pivotPoint.lerpVectors(
                this.cameraAnimation.startTarget,
                this.cameraAnimation.targetTarget,
                progress
            );
            this.camera.lookAt(this.mouseControls.pivotPoint);
        }
        
        // Interpola zoom (distanza)
        if (this.cameraAnimation.targetZoom && this.cameraAnimation.startZoom) {
            const currentZoom = this.cameraAnimation.startZoom + 
                (this.cameraAnimation.targetZoom - this.cameraAnimation.startZoom) * progress;
            
            const direction = this.camera.position.clone().sub(this.mouseControls.pivotPoint).normalize();
            this.camera.position.copy(this.mouseControls.pivotPoint).add(direction.multiplyScalar(currentZoom));
        }
        
        // Termina animazione
        if (progress >= 1.0) {
            this.cameraAnimation.isAnimating = false;
            console.log(`📹 CAMERA: Animazione completata`);
        }
    },

    updatePivotAnimation: function() {
        if (!this.pivotAnimation || !this.pivotAnimation.isAnimating) return;
        
        const elapsed = (performance.now() - this.pivotAnimation.startTime) / 1000;
        let progress = Math.min(elapsed / this.pivotAnimation.duration, 1.0);
        
        // Smooth easing per movimento fluido
        progress = this.smoothStep(progress);
        
        // Interpola pivot point
        this.mouseControls.pivotPoint.lerpVectors(
            this.pivotAnimation.startPivot,
            this.pivotAnimation.targetPivot,
            progress
        );
        
        // Interpola posizione camera
        this.camera.position.lerpVectors(
            this.pivotAnimation.startCameraPosition,
            this.pivotAnimation.targetCameraPosition,
            progress
        );
        
        // Mantieni la camera sempre puntata verso il pivot
        // (a meno che non sia in corso un'animazione camera con target personalizzato)
        if (!this.cameraAnimation || !this.cameraAnimation.isAnimating || !this.cameraAnimation.targetTarget) {
            this.camera.lookAt(this.mouseControls.pivotPoint);
        }
        
        // Termina animazione
        if (progress >= 1.0) {
            this.pivotAnimation.isAnimating = false;
            console.log(`🎯 Animazione pivot completata`);
        }
    },

    onWindowResize: function() {
        if (!this.camera || !this.renderer) {
            return;
        }
        
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        
    },

    /* ===== DRAG & DROP SYSTEM INTEGRATION ===== */
    
    /**
     * Abilita il sistema drag & drop
     * @param {Array} objectNames - Lista nomi oggetti draggabili (opzionale)
     */
    enableDragDrop: function(objectNames = null) {
        if (this.dragDropSystem && this.dragDropSystem.enable) {
            this.dragDropSystem.enable(objectNames);
        } else {
            console.warn('[Scene3D] ⚠️ DragDropSystem non disponibile o non inizializzato');
        }
    },
    
    /**
     * Disabilita il sistema drag & drop
     */
    disableDragDrop: function() {
        if (this.dragDropSystem && this.dragDropSystem.disable) {
            this.dragDropSystem.disable();
        } else {
            console.warn('[Scene3D] ⚠️ DragDropSystem non disponibile per disabilitazione');
        }
    },
    
    /**
     * Imposta distanza di snap per drag & drop
     * @param {number} distance - Distanza di snap
     */
    setDragSnapDistance: function(distance) {
        if (this.dragDropSystem && this.dragDropSystem.setSnapDistance) {
            this.dragDropSystem.setSnapDistance(distance);
        } else {
            console.warn('[Scene3D] ⚠️ DragDropSystem non disponibile per setSnapDistance');
        }
    },
    
    /**
     * Verifica se il sistema drag & drop è abilitato
     * @returns {boolean}
     */
    isDragDropEnabled: function() {
        return (this.dragDropSystem && this.dragDropSystem.isEnabled) ? 
               this.dragDropSystem.isEnabled() : false;
    },
    
    /**
     * Verifica se è in corso un'operazione di drag
     * @returns {boolean}
     */
    isDragging: function() {
        return (this.dragDropSystem && this.dragDropSystem.isDraggingActive) ?
               this.dragDropSystem.isDraggingActive() : false;
    },

    /**
     * Mostra il modello planaxis (assi)
     */
    showPlanaxis: function() {
        const model = this.findModelByName('planaxis');
        if (model) {
            model.visible = true;
            console.log('📐 PLANAXIS: Assi mostrati');
        } else {
            console.warn('📐 PLANAXIS: Modello planaxis non trovato');
        }
    },

    /**
     * Nasconde il modello planaxis (assi)
     */
    hidePlanaxis: function() {
        const model = this.findModelByName('planaxis');
        if (model) {
            model.visible = false;
            console.log('📐 PLANAXIS: Assi nascosti');
        } else {
            console.warn('📐 PLANAXIS: Modello planaxis non trovato');
        }
    },

    /**
     * Mostra/nasconde il modello planaxis (toggle)
     */
    togglePlanaxis: function() {
        const model = this.findModelByName('planaxis');
        if (model) {
            model.visible = !model.visible;
            console.log(`📐 PLANAXIS: Assi ${model.visible ? 'mostrati' : 'nascosti'}`);
        } else {
            console.warn('📐 PLANAXIS: Modello planaxis non trovato');
        }
    },

    /**
     * Verifica se il modello planaxis è visibile
     * @returns {boolean}
     */
    isPlanaxisVisible: function() {
        const model = this.findModelByName('planaxis');
        return model ? model.visible : false;
    },

    /**
     * Test manuale sistema particellare
     */
    testParticleSystem: function() {
        console.log('[Scene3D] 🧪 TEST ParticleSystem manuale');
        console.log('[Scene3D] window.ParticleSystem exists:', !!window.ParticleSystem);
        console.log('[Scene3D] this.particleSystem exists:', !!this.particleSystem);

        if (!window.ParticleSystem) {
            console.error('[Scene3D] ❌ window.ParticleSystem non esiste!');
            return false;
        }

        if (!this.particleSystem) {
            console.log('[Scene3D] 🔄 Tentativo inizializzazione manuale...');
            try {
                window.ParticleSystem.init(this.scene, this.camera);
                this.particleSystem = window.ParticleSystem;
                console.log('[Scene3D] ✅ Inizializzazione manuale completata!');
            } catch (error) {
                console.error('[Scene3D] ❌ Errore inizializzazione manuale:', error);
                return false;
            }
        }

        // Test creazione effetto
        if (this.particleSystem && this.particleSystem.createAirJet) {
            const testPos = new THREE.Vector3(0, 1, 0);
            const testDir = new THREE.Vector3(1, 0, 0);
            console.log('[Scene3D] 🎆 Creazione getto test...');
            const effectId = this.particleSystem.createAirJet(testPos, testDir);
            console.log('[Scene3D] 🎆 Getto test creato:', effectId);
            return true;
        }

        return false;
    },

    /* ===== SISTEMA RESET POSIZIONI ORIGINALI CON CENTRO BB ===== */

    /**
     * NUOVA FUNZIONE: Reset globale con centro bounding box su posizioni _original
     * Resetta tutti i modelli posizionando il centro del loro bounding box
     * sulle coordinate delle loro posizioni originali
     */
    resetAllModelsToCenteredOriginalPositions: function() {
        console.log('🎯 RESET CENTRATO: Ripristino tutti i modelli con centro BB su posizioni originali...');

        let resetCount = 0;
        let skippedCount = 0;

        for (const model of this.loadedModels) {
            if (this.resetModelToCenteredOriginalPosition(model)) {
                resetCount++;
            } else {
                skippedCount++;
            }
        }

        console.log(`✅ RESET CENTRATO COMPLETATO: ${resetCount} modelli riposizionati, ${skippedCount} saltati`);
        return { resetCount, skippedCount };
    },

    /**
     * Reset singolo modello con centro bounding box su posizione originale
     */
    resetModelToCenteredOriginalPosition: function(model) {
        if (!model || !model.name) {
            return false;
        }

        // Ottieni posizione originale usando il sistema _original esistente
        const originalRef = this.findModelByName(model.name + '_original');
        if (!originalRef) {
            console.log(`⚠️ RESET CENTRATO: Nessuna posizione originale trovata per "${model.name}"`);
            return false;
        }

        // Calcola centro bounding box corrente
        const boundingBox = new THREE.Box3().setFromObject(model);
        const currentCenter = new THREE.Vector3();
        boundingBox.getCenter(currentCenter);

        // Posizione target (dove dovrebbe essere il centro)
        const targetCenter = originalRef.position.clone();

        // Calcola offset necessario per spostare il centro alla posizione target
        const offset = targetCenter.sub(currentCenter);

        // Applica l'offset alla posizione del modello
        model.position.add(offset);

        console.log(`🎯 RESET CENTRATO: "${model.name}" → centro BB spostato a posizione originale`, {
            originalCenter: currentCenter.clone().sub(offset),
            targetCenter: targetCenter.clone().add(offset),
            appliedOffset: offset
        });

        return true;
    },

    /**
     * Reset con animazione fluida verso posizioni centrate originali
     * @param {number} duration - Durata animazione in secondi (default: 1.0)
     */
    animateAllModelsToCenteredOriginalPositions: function(duration = 1.0) {
        console.log(`🎬 ANIMAZIONE RESET CENTRATO: Avvio animazione di ${duration}s verso posizioni originali...`);

        let animationCount = 0;

        for (const model of this.loadedModels) {
            const originalRef = this.findModelByName(model.name + '_original');
            if (!originalRef) continue;

            // Calcola posizione finale
            const boundingBox = new THREE.Box3().setFromObject(model);
            const currentCenter = new THREE.Vector3();
            boundingBox.getCenter(currentCenter);

            const targetCenter = originalRef.position.clone();
            const offset = targetCenter.sub(currentCenter);
            const finalPosition = model.position.clone().add(offset);

            // Crea animazione TWEEN
            const startPosition = model.position.clone();
            new window.TWEEN.Tween(startPosition)
                .to(finalPosition, duration * 1000)
                .easing(window.TWEEN.Easing.Cubic.InOut)
                .onUpdate(() => {
                    model.position.copy(startPosition);
                })
                .start();

            animationCount++;
        }

        console.log(`🎬 ANIMAZIONE RESET CENTRATO: ${animationCount} animazioni avviate`);
        return animationCount;
    },

    /**
     * Funzione di test completa per il sistema reset centrato
     */
    testCenteredOriginalReset: function() {
        console.log('🧪 TEST RESET CENTRATO: Avvio test completo del sistema...');

        // 1. Verifica modelli caricati
        console.log(`📊 Modelli caricati: ${this.loadedModels.length}`);

        // 2. Verifica riferimenti _original disponibili
        let originalRefsCount = 0;
        for (const model of this.loadedModels) {
            const originalRef = this.findModelByName(model.name + '_original');
            if (originalRef) {
                originalRefsCount++;
                console.log(`✅ "${model.name}" → posizione originale: (${originalRef.position.x.toFixed(3)}, ${originalRef.position.y.toFixed(3)}, ${originalRef.position.z.toFixed(3)})`);
            } else {
                console.log(`❌ "${model.name}" → nessuna posizione originale`);
            }
        }

        console.log(`📊 Riferimenti _original trovati: ${originalRefsCount}/${this.loadedModels.length}`);

        // 3. Test reset immediato
        if (originalRefsCount > 0) {
            console.log('🎯 Esecuzione reset centrato immediato...');
            const result = this.resetAllModelsToCenteredOriginalPositions();
            console.log('✅ Test reset immediato completato:', result);

            // 4. Test reset animato (dopo 2 secondi)
            setTimeout(() => {
                console.log('🎬 Test reset animato...');
                // Sposta leggermente i modelli prima dell'animazione
                for (const model of this.loadedModels.slice(0, 2)) {
                    model.position.add(new THREE.Vector3(0.5, 0.2, -0.3));
                }
                const animResult = this.animateAllModelsToCenteredOriginalPositions(1.5);
                console.log('✅ Test reset animato avviato:', animResult, 'animazioni');
            }, 2000);
        }

        return {
            modelsCount: this.loadedModels.length,
            originalRefsCount: originalRefsCount,
            systemAvailable: originalRefsCount > 0
        };
    }
};

// Esponi Scene3D globalmente
window.Scene3D = Scene3D;

window.addEventListener('resize', function() {
    if (window.Scene3D && window.Scene3D.onWindowResize) {
        window.Scene3D.onWindowResize();
    }
});