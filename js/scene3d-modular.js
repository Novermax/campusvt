/**
 * SCENE3D MODULAR LOADER
 * VERSION: 1000011 - Modular Architecture + REFACTORING
 */

// FASE 5 REFACTORING: Helper per chiamate sicure a dipendenze esterne
const _scene3d_safeCall = function(obj, method, args = [], fallback = null, context = 'Scene3D') {
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
const _scene3d_safeUICall = function(method, args = [], fallback = null) {
    return _scene3d_safeCall(window.UI, method, args, fallback, 'Scene3D→UI');
};

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
    initialModelPositions: new Map(), // UUID -> {position, rotation, scale} (per tutorial corrente)
    scenarioOriginalPositions: new Map(), // UUID -> {position, rotation, scale} (posizioni pure caricamento scenario)
    
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
        // Touch pinch-to-zoom
        lastPinchDistance: null,
        lastTwoFingerCenter: null,
        sensitivity: {
            rotation: 0.015,
            pan: 0.020,
            zoom: 0.025,
            keyboardPan: 0.05 // Sensibilità pan con tasti freccia
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
            minZoom: 0.15,  // Permette zoom molto vicino (era 0.3)
            maxZoom: 15
        }
    },

    // Sistema animazione cursori tool
    cursorAnimation: {
        intervalId: null,
        currentFrame: 1,
        isAnimating: false
    },

    // FASE 3 REFACTORING: Object pool per evitare allocazioni nel loop animazioni
    animationPool: {
        // Pool esteso per supportare applyRotationAroundCenter che usa molti vettori
        vectors: [
            new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
            new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()
        ],
        quaternions: [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()],
        eulers: [new THREE.Euler(), new THREE.Euler(), new THREE.Euler(), new THREE.Euler()],
        matrices: [new THREE.Matrix4(), new THREE.Matrix4(), new THREE.Matrix4(), new THREE.Matrix4()],
        currentVectorIndex: 0,
        currentQuaternionIndex: 0,
        currentEulerIndex: 0,
        currentMatrixIndex: 0,

        getVector: function() {
            const v = this.vectors[this.currentVectorIndex];
            this.currentVectorIndex = (this.currentVectorIndex + 1) % this.vectors.length;
            return v.set(0, 0, 0); // Reset prima dell'uso
        },

        getQuaternion: function() {
            const q = this.quaternions[this.currentQuaternionIndex];
            this.currentQuaternionIndex = (this.currentQuaternionIndex + 1) % this.quaternions.length;
            return q.identity(); // Reset prima dell'uso
        },

        getEuler: function() {
            const e = this.eulers[this.currentEulerIndex];
            this.currentEulerIndex = (this.currentEulerIndex + 1) % this.eulers.length;
            return e.set(0, 0, 0); // Reset prima dell'uso
        },

        getMatrix: function() {
            const m = this.matrices[this.currentMatrixIndex];
            this.currentMatrixIndex = (this.currentMatrixIndex + 1) % this.matrices.length;
            return m.identity(); // Reset prima dell'uso
        },

        // Reset indici a fine frame (opzionale, per debug)
        resetIndices: function() {
            this.currentVectorIndex = 0;
            this.currentQuaternionIndex = 0;
            this.currentEulerIndex = 0;
            this.currentMatrixIndex = 0;
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
        this.renderer.toneMappingExposure = 1.5; // Ridotto per migliorare visibilità schermi
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

        // Seconda luce direzionale dalla parte opposta (senza ombre)
        const backLight = new THREE.DirectionalLight(0xffffff, 0.6); // Ridotta per schermi
        backLight.position.set(
            -directionalConfig.position.x,
            directionalConfig.position.y,
            -directionalConfig.position.z
        );
        backLight.castShadow = false;
        this.scene.add(backLight);

        console.log('[Scene3D] ✅ Luci configurate: Ambient + Directional (ombre) + BackLight (no ombre)');
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

    /**
     * Imposta la camera usando i parametri completi da getCameraInfo()
     * @param {Object} config - Configurazione camera
     * @param {Object} config.position - {x, y, z} Posizione camera
     * @param {Object} config.rotation - {x, y, z} Rotazione camera (radianti)
     * @param {Object} config.pivot - {x, y, z} Punto pivot
     * @param {number} config.distance - Distanza dal pivot
     * @param {number} config.fov - Field of view
     * @param {boolean} config.animate - Se true, anima la transizione (default: false)
     * @param {number} config.duration - Durata animazione in secondi (default: 1.0)
     */
    setCameraFromInfo: function(config) {
        if (!this.camera) {
            console.warn('[Scene3D] 📹 Camera non inizializzata');
            return false;
        }

        console.log('[Scene3D] 📹 setCameraFromInfo:', config);

        const animate = config.animate || false;
        const duration = config.duration || 1.0;

        // Target position e rotation
        const targetPosition = config.position ?
            new THREE.Vector3(config.position.x, config.position.y, config.position.z) :
            this.camera.position.clone();

        const targetRotation = config.rotation ?
            new THREE.Euler(config.rotation.x, config.rotation.y, config.rotation.z) :
            this.camera.rotation.clone();

        // Pivot point
        if (config.pivot && this.mouseControls) {
            this.mouseControls.pivotPoint = new THREE.Vector3(
                config.pivot.x,
                config.pivot.y,
                config.pivot.z
            );
            console.log('[Scene3D] 📍 Pivot impostato:', this.mouseControls.pivotPoint);
        }

        // FOV
        if (config.fov && config.fov !== this.camera.fov) {
            this.camera.fov = config.fov;
            this.camera.updateProjectionMatrix();
            console.log('[Scene3D] 🔭 FOV impostato:', config.fov);
        }

        // Se specificata la distanza, calcola la posizione dalla distanza e pivot
        if (config.distance && config.pivot) {
            // Calcola direzione dalla posizione corrente al pivot
            const direction = new THREE.Vector3();
            if (config.position) {
                direction.subVectors(targetPosition, new THREE.Vector3(config.pivot.x, config.pivot.y, config.pivot.z));
            } else {
                direction.subVectors(this.camera.position, new THREE.Vector3(config.pivot.x, config.pivot.y, config.pivot.z));
            }
            direction.normalize();

            // Posiziona camera alla distanza specificata dal pivot
            targetPosition.copy(new THREE.Vector3(config.pivot.x, config.pivot.y, config.pivot.z));
            targetPosition.add(direction.multiplyScalar(config.distance));
        }

        if (animate && window.TWEEN) {
            // Animazione fluida
            const startPosition = this.camera.position.clone();
            const startRotation = {
                x: this.camera.rotation.x,
                y: this.camera.rotation.y,
                z: this.camera.rotation.z
            };

            new TWEEN.Tween(startPosition)
                .to(targetPosition, duration * 1000)
                .easing(TWEEN.Easing.Quadratic.InOut)
                .onUpdate(() => {
                    this.camera.position.copy(startPosition);
                })
                .start();

            new TWEEN.Tween(startRotation)
                .to({ x: targetRotation.x, y: targetRotation.y, z: targetRotation.z }, duration * 1000)
                .easing(TWEEN.Easing.Quadratic.InOut)
                .onUpdate(() => {
                    this.camera.rotation.set(startRotation.x, startRotation.y, startRotation.z);
                })
                .start();

            console.log('[Scene3D] 🎬 Animazione camera avviata');
        } else {
            // Applicazione immediata
            this.camera.position.copy(targetPosition);
            this.camera.rotation.copy(targetRotation);
            console.log('[Scene3D] 📹 Camera impostata immediatamente');
        }

        return true;
    },

    /**
     * Imposta camera da stringa tutorial (sintassi estesa)
     * Supporta: CameraPos, CameraRotation, CameraPivot, CameraDistance, CameraFOV
     * @param {Object} properties - Proprietà dal tutorial
     */
    setCameraFromTutorialProperties: function(properties) {
        const config = {};

        // CameraPos=(x,y,z)
        if (properties.CameraPos) {
            const match = properties.CameraPos.match(/\(?\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,\)]+)\s*\)?/);
            if (match) {
                config.position = {
                    x: parseFloat(match[1]),
                    y: parseFloat(match[2]),
                    z: parseFloat(match[3])
                };
            }
        }

        // CameraRotation=(x,y,z) - in radianti
        if (properties.CameraRotation) {
            const match = properties.CameraRotation.match(/\(?\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,\)]+)\s*\)?/);
            if (match) {
                config.rotation = {
                    x: parseFloat(match[1]),
                    y: parseFloat(match[2]),
                    z: parseFloat(match[3])
                };
            }
        }

        // CameraPivot=(x,y,z) o CameraTarget=(x,y,z)
        const pivotProp = properties.CameraPivot || properties.CameraTarget;
        if (pivotProp && pivotProp.includes(',')) {
            const match = pivotProp.match(/\(?\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,\)]+)\s*\)?/);
            if (match) {
                config.pivot = {
                    x: parseFloat(match[1]),
                    y: parseFloat(match[2]),
                    z: parseFloat(match[3])
                };
            }
        }

        // CameraDistance=value
        if (properties.CameraDistance) {
            config.distance = parseFloat(properties.CameraDistance);
        }

        // CameraFOV=value
        if (properties.CameraFOV) {
            config.fov = parseFloat(properties.CameraFOV);
        }

        // CameraTransitionTime=value (per animazione)
        if (properties.CameraTransitionTime) {
            config.animate = true;
            config.duration = parseFloat(properties.CameraTransitionTime);
        }

        if (Object.keys(config).length > 0) {
            console.log('[Scene3D] 📹 Configurazione camera da tutorial:', config);
            return this.setCameraFromInfo(config);
        }

        return false;
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

        // Touch handlers legacy - disabilitati se TouchSystem è attivo
        // Il nuovo TouchSystem gestisce tutte le interazioni touch
        if (!window.TouchSystem || !window.TouchSystem.initialized) {
            canvas.addEventListener('touchstart', this.onTouchStart.bind(this));
            canvas.addEventListener('touchmove', this.onTouchMove.bind(this));
            canvas.addEventListener('touchend', this.onTouchEnd.bind(this));
            console.log('[Scene3D] 📱 Touch handlers legacy attivi');
        } else {
            console.log('[Scene3D] 📱 Touch handlers legacy DISABILITATI - TouchSystem attivo');
        }

        canvas.addEventListener('contextmenu', function(e) {
            e.preventDefault();
        });

        // Keyboard controls per pan camera (tasti freccia)
        document.addEventListener('keydown', this.onKeyDown.bind(this));
        console.log('[Scene3D] ⌨️ Controlli tastiera attivati (frecce = pan camera)');

        // Listener globale per mouseup con CAPTURE per intercettare PRIMA di tutto
        // Questo garantisce che il cursore venga resettato anche se l'evento viene bloccato da altri handler
        document.addEventListener('mouseup', this.onGlobalMouseUp.bind(this), true);
        document.addEventListener('pointerup', this.onGlobalMouseUp.bind(this), true);
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

        // Inizializza sistema schermi interattivi se disponibile
        this.screenSystem = null;
        if (window.ScreenSystem && window.ScreenSystem.init) {
            try {
                console.log('[Scene3D] 📺 Inizializzazione ScreenSystem...');
                const success = window.ScreenSystem.init(this);
                if (success) {
                    this.screenSystem = window.ScreenSystem;
                    console.log('[Scene3D] ✅ ScreenSystem inizializzato con successo!');
                } else {
                    console.warn('[Scene3D] ⚠️ ScreenSystem inizializzazione fallita');
                }
            } catch (error) {
                console.error('[Scene3D] ❌ Errore inizializzazione ScreenSystem:', error);
            }
        } else {
            console.log('[Scene3D] ℹ️ ScreenSystem non disponibile (opzionale)');
        }

        // Inizializza sistema oggetti prendibili se disponibile
        this.holdableSystem = null;
        if (window.HoldableSystem && window.HoldableSystem.init) {
            try {
                console.log('[Scene3D] 🤚 Inizializzazione HoldableSystem...');
                const success = window.HoldableSystem.init(this);
                if (success) {
                    this.holdableSystem = window.HoldableSystem;
                    console.log('[Scene3D] ✅ HoldableSystem inizializzato con successo!');
                } else {
                    console.warn('[Scene3D] ⚠️ HoldableSystem inizializzazione fallita');
                }
            } catch (error) {
                console.error('[Scene3D] ❌ Errore inizializzazione HoldableSystem:', error);
            }
        } else {
            console.log('[Scene3D] ℹ️ HoldableSystem non disponibile (opzionale)');
        }

        // Inizializza sistema cerchi evidenziazione se disponibile
        this.highlightCircleManager = null;
        if (window.HighlightCircleManager) {
            try {
                console.log('[Scene3D] 🔵 Inizializzazione HighlightCircleManager...');
                this.highlightCircleManager = new window.HighlightCircleManager();
                const success = this.highlightCircleManager.init(this.camera, this.renderer);
                if (success) {
                    console.log('[Scene3D] ✅ HighlightCircleManager inizializzato con successo!');
                } else {
                    console.warn('[Scene3D] ⚠️ HighlightCircleManager inizializzazione fallita');
                    this.highlightCircleManager = null;
                }
            } catch (error) {
                console.error('[Scene3D] ❌ Errore inizializzazione HighlightCircleManager:', error);
                this.highlightCircleManager = null;
            }
        } else {
            console.log('[Scene3D] ℹ️ HighlightCircleManager non disponibile (opzionale)');
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
        // ❌ BLOCCO MOUSE SOLO SU DISPOSITIVI TOUCH
        // Previene che touch events convertiti in mouse events causino rotazione
        if (window.TouchSystem && window.TouchSystem.initialized && window.TouchSystem.isTouchDevice()) {
            console.log('[Scene3D] 🚫 onMouseDown BLOCCATO - Dispositivo touch rilevato');
            return;
        }

        this.mouseControls.isMouseDown = true;
        this.mouseControls.mouseButton = event.button;
        this.mouseControls.lastPosition.x = event.clientX;
        this.mouseControls.lastPosition.y = event.clientY;

        // Avvia animazione cursore per tool con cursori pressed configurati
        if (event.button === 0) {
            this.startCursorAnimation();
        }

        event.preventDefault();
        if (event.button === 1) {
            event.stopPropagation();
        }
    },

    onMouseMove: function(event) {
        // Hover detection per InteractiveObject3D (sempre attivo)
        if (window.InteractiveObject3D && this.loadedModels.length > 0) {
            this.handleInteractiveHover(event);
        }

        if (!this.mouseControls.isMouseDown) return;

        // ❌ BLOCCO ROTAZIONE CAMERA SOLO SU DISPOSITIVI TOUCH
        // Previene che touch events convertiti in mouse events causino rotazione
        if (window.TouchSystem && window.TouchSystem.initialized && window.TouchSystem.isTouchDevice()) {
            console.log('[Scene3D] 🚫 onMouseMove BLOCCATO - Dispositivo touch rilevato');
            return;
        }

        const deltaX = event.clientX - this.mouseControls.lastPosition.x;
        const deltaY = event.clientY - this.mouseControls.lastPosition.y;

        if (this.mouseControls.mouseButton === 2) {
            this.rotateCamera(deltaX, deltaY);
        }

        this.mouseControls.lastPosition.x = event.clientX;
        this.mouseControls.lastPosition.y = event.clientY;
    },

    /**
     * Gestisce hover su figli interattivi per feedback visivo
     */
    handleInteractiveHover: function(event) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera({ x: mouseX, y: mouseY }, this.camera);
        const intersects = this.raycaster.intersectObjects(this.loadedModels, true);

        let hoveredMesh = null;

        // Trova il primo figlio interattivo colpito
        for (const intersect of intersects) {
            if (intersect.object.userData.interactive) {
                hoveredMesh = intersect.object;
                break;
            }
        }

        // Notifica InteractiveObject3D per feedback visivo
        window.InteractiveObject3D.handleHover(hoveredMesh);
    },

    onMouseUp: function(event) {
        // ❌ BLOCCO MOUSE SOLO SU DISPOSITIVI TOUCH
        // Previene che touch events convertiti in mouse events causino interazioni
        if (window.TouchSystem && window.TouchSystem.initialized && window.TouchSystem.isTouchDevice()) {
            console.log('[Scene3D] 🚫 onMouseUp BLOCCATO - Dispositivo touch rilevato');
            return;
        }

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

        // Ferma animazione cursore e rimuovi classe mouse-pressed (per tool mano)
        if (event.button === 0) {
            this.stopCursorAnimation();
            document.body.classList.remove('mouse-pressed');
        }

        this.mouseControls.isMouseDown = false;
        this.mouseControls.isPanning = false;
    },

    // Gestisce mouseup globale (anche quando mouse rilasciato fuori dal canvas)
    onGlobalMouseUp: function(event) {
        console.log('[Scene3D] 🎯 onGlobalMouseUp CAPTURE - button:', event.button, 'type:', event.type);

        // Rimuovi sempre classi cursore al rilascio del pulsante sinistro
        if (event.button === 0) {
            console.log('[Scene3D] 🧹 Pulizia classi cursore...');

            // Rimuovi classi animazione cursore (frame1/frame2) e mouse-pressed
            document.body.classList.remove('cursor-frame-1', 'cursor-frame-2', 'mouse-pressed');

            // Ferma animazione se attiva
            if (this.cursorAnimation.intervalId) {
                clearInterval(this.cursorAnimation.intervalId);
                this.cursorAnimation.intervalId = null;
                console.log('[Scene3D] ⏹️ Interval animazione fermato');
            }
            this.cursorAnimation.isAnimating = false;
            this.cursorAnimation.currentFrame = 1;

            this.mouseControls.isMouseDown = false;

            console.log('[Scene3D] ✅ Classi dopo pulizia:', Array.from(document.body.classList).filter(c => c.includes('cursor') || c.includes('tool')));
        }
    },

    onMouseWheel: function(event) {
        const camCfg = (window.InterfaceConfig && window.InterfaceConfig.camera) || {};
        const sensitivity = (camCfg.scrollSensitivity !== undefined) ? camCfg.scrollSensitivity : this.mouseControls.sensitivity.zoom;
        const rawDelta = event.deltaY;
        const direction = camCfg.invertScrollZoom ? -1 : 1;
        const normalizedDelta = (rawDelta > 0 ? 100 : -100) * direction;
        const delta = normalizedDelta * sensitivity;
        this.zoomCamera(delta);
        event.preventDefault();
    },

    // Avvia animazione cursore per tool con cursori pressed configurati
    startCursorAnimation: function() {
        console.log('[Scene3D] 🚀 startCursorAnimation() chiamato');

        // Verifica se ToolsManager è disponibile
        if (!window.ToolsManager) {
            console.log('[Scene3D] ⚠️ ToolsManager non disponibile, esco');
            return;
        }

        const activeTool = window.ToolsManager.getActiveTool ? window.ToolsManager.getActiveTool() : null;
        console.log('[Scene3D] 🔍 Tool attivo:', activeTool);

        if (!activeTool) {
            console.log('[Scene3D] ⚠️ Nessun tool attivo, esco');
            return;
        }

        // Verifica se il tool ha cursori pressed configurati (tramite ToolRegistry o fallback hardcoded)
        let hasPressedCursor = false;
        let toolConfig = null;

        if (window.ToolRegistry && typeof window.ToolRegistry.getTool === 'function') {
            // Sistema dinamico: verifica se il tool ha CursorPressed definito
            toolConfig = window.ToolRegistry.getTool(activeTool);
            hasPressedCursor = toolConfig && toolConfig.cursorPressed;
            console.log('[Scene3D] 🔍 ToolRegistry config:', toolConfig ? {
                id: toolConfig.id,
                cursorPressed: toolConfig.cursorPressed,
                cursorPressedFrame2: toolConfig.cursorPressedFrame2
            } : 'null');
        } else {
            // Fallback hardcoded per scenari senza config.txt
            hasPressedCursor = (activeTool === 'brugola' || activeTool === 'chiave_inglese');
            console.log('[Scene3D] 🔍 Fallback hardcoded, hasPressedCursor:', hasPressedCursor);
        }

        console.log('[Scene3D] 🔍 hasPressedCursor:', hasPressedCursor);

        if (!hasPressedCursor) {
            console.log('[Scene3D] ⚠️ Tool senza cursore pressed, esco');
            return;
        }

        // Se già in animazione, non riavviare
        if (this.cursorAnimation.isAnimating) return;

        this.cursorAnimation.isAnimating = true;
        this.cursorAnimation.currentFrame = 1;

        // Applica subito la classe frame1
        document.body.classList.add('cursor-frame-1');

        // Loop animazione 0.5s (250ms per frame)
        this.cursorAnimation.intervalId = setInterval(() => {
            const frame = this.cursorAnimation.currentFrame === 1 ? 2 : 1;
            this.cursorAnimation.currentFrame = frame;

            // Rimuovi classe frame opposto e aggiungi nuova
            document.body.classList.remove('cursor-frame-1', 'cursor-frame-2');
            document.body.classList.add(`cursor-frame-${frame}`);
        }, 250);

        console.log(`[Scene3D] 🎬 Animazione cursore avviata per: ${activeTool}`);
    },

    // Ferma animazione cursore
    stopCursorAnimation: function() {
        console.log('[Scene3D] 🛑 stopCursorAnimation() chiamato');
        console.log('[Scene3D] 🔍 Stato PRIMA: isAnimating=', this.cursorAnimation.isAnimating,
                    ', intervalId=', this.cursorAnimation.intervalId,
                    ', body.classList=', Array.from(document.body.classList).filter(c => c.includes('cursor') || c.includes('tool')));

        // Ferma interval se attivo
        if (this.cursorAnimation.intervalId) {
            clearInterval(this.cursorAnimation.intervalId);
            this.cursorAnimation.intervalId = null;
        }

        // Reset stato
        const wasAnimating = this.cursorAnimation.isAnimating;
        this.cursorAnimation.isAnimating = false;
        this.cursorAnimation.currentFrame = 1;

        // SEMPRE rimuovi classi frame per ripristinare cursore normale
        // (anche se isAnimating era false, per sicurezza)
        document.body.classList.remove('cursor-frame-1', 'cursor-frame-2');

        console.log('[Scene3D] 🔍 Stato DOPO: body.classList=', Array.from(document.body.classList).filter(c => c.includes('cursor') || c.includes('tool')));

        if (wasAnimating) {
            console.log('[Scene3D] ⏹️ Animazione cursore fermata');
        }
    },

    onTouchStart: function(event) {
        if (event.touches.length === 1) {
            this.mouseControls.isMouseDown = true;
            this.mouseControls.lastPosition.x = event.touches[0].clientX;
            this.mouseControls.lastPosition.y = event.touches[0].clientY;
        } else if (event.touches.length === 2) {
            // Salva distanza iniziale per pinch-to-zoom
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            this.mouseControls.lastPinchDistance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) +
                Math.pow(touch2.clientY - touch1.clientY, 2)
            );
            this.mouseControls.lastTwoFingerCenter = {
                x: (touch1.clientX + touch2.clientX) / 2,
                y: (touch1.clientY + touch2.clientY) / 2
            };
        }
        event.preventDefault();
    },

    onTouchMove: function(event) {
        if (event.touches.length === 1 && this.mouseControls.isMouseDown) {
            // Un dito: rotazione camera
            const deltaX = event.touches[0].clientX - this.mouseControls.lastPosition.x;
            const deltaY = event.touches[0].clientY - this.mouseControls.lastPosition.y;

            this.rotateCamera(deltaX, deltaY);

            this.mouseControls.lastPosition.x = event.touches[0].clientX;
            this.mouseControls.lastPosition.y = event.touches[0].clientY;

        } else if (event.touches.length === 2) {
            // Due dita: pinch-to-zoom
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];

            const pinchDistance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) +
                Math.pow(touch2.clientY - touch1.clientY, 2)
            );

            const currentCenter = {
                x: (touch1.clientX + touch2.clientX) / 2,
                y: (touch1.clientY + touch2.clientY) / 2
            };

            if (this.mouseControls.lastPinchDistance && this.mouseControls.lastTwoFingerCenter) {
                // ZOOM: gestisce cambio distanza tra le dita
                const distanceDelta = (pinchDistance - this.mouseControls.lastPinchDistance) * this.mouseControls.sensitivity.zoom;

                if (Math.abs(distanceDelta) > 0.5) {
                    this.zoomCamera(-distanceDelta); // Negativo per zoom naturale (dita lontane = zoom in)
                }

                // ROTAZIONE: gestisce movimento del centro delle due dita
                const centerDeltaX = currentCenter.x - this.mouseControls.lastTwoFingerCenter.x;
                const centerDeltaY = currentCenter.y - this.mouseControls.lastTwoFingerCenter.y;

                const centerMovement = Math.sqrt(centerDeltaX * centerDeltaX + centerDeltaY * centerDeltaY);
                const distanceChange = Math.abs(pinchDistance - this.mouseControls.lastPinchDistance);

                // Rotazione solo se movimento del centro è maggiore del cambio di distanza
                if (centerMovement > 5 && centerMovement > distanceChange * 0.5) {
                    this.rotateCamera(centerDeltaX, centerDeltaY);
                }
            }

            this.mouseControls.lastPinchDistance = pinchDistance;
            this.mouseControls.lastTwoFingerCenter = currentCenter;
        }
        event.preventDefault();
    },

    onTouchEnd: function(event) {
        this.mouseControls.isMouseDown = false;

        // Reset pinch-to-zoom quando si sollevano le dita
        if (event.touches.length < 2) {
            this.mouseControls.lastPinchDistance = null;
            this.mouseControls.lastTwoFingerCenter = null;
        }

        event.preventDefault();
    },

    rotateCamera: function(deltaX, deltaY) {
        const sensitivity = this.mouseControls.sensitivity.rotation;
        const limits = this.mouseControls.limits;
        const pivotPoint = this.mouseControls.pivotPoint;
        
        const relativePosition = new THREE.Vector3().subVectors(this.camera.position, pivotPoint);
        const spherical = new THREE.Spherical();
        spherical.setFromVector3(relativePosition);
        
        const camCfg = (window.InterfaceConfig && window.InterfaceConfig.camera) || {};
        const signH = camCfg.invertHorizontal ? 1 : -1;
        const signV = camCfg.invertVertical ? -1 : 1;
        spherical.theta += signH * deltaX * sensitivity;
        spherical.phi += signV * deltaY * sensitivity;
        
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
        const camCfg = (window.InterfaceConfig && window.InterfaceConfig.camera) || {};
        const minZoom = (camCfg.zoomMin !== undefined) ? camCfg.zoomMin : limits.minZoom;
        const maxZoom = (camCfg.zoomMax !== undefined) ? camCfg.zoomMax : limits.maxZoom;

        const relativePosition = new THREE.Vector3().subVectors(this.camera.position, pivotPoint);
        const spherical = new THREE.Spherical();
        spherical.setFromVector3(relativePosition);

        const zoomStep = delta > 0 ? 1.2 : 1/1.2;
        spherical.radius *= zoomStep;

        spherical.radius = Math.max(minZoom, Math.min(maxZoom, spherical.radius));

        relativePosition.setFromSpherical(spherical);
        this.camera.position.copy(pivotPoint).add(relativePosition);

        // Non interferire con animazione camera se in corso
        if (!this.cameraAnimation || !this.cameraAnimation.isAnimating || !this.cameraAnimation.targetTarget) {
            this.camera.lookAt(pivotPoint);
        }
    },

    /**
     * Pan della camera (movimento laterale/verticale mantenendo la direzione di visione)
     * @param {number} deltaX - Movimento orizzontale (positivo = destra)
     * @param {number} deltaY - Movimento verticale (positivo = su)
     */
    panCamera: function(deltaX, deltaY) {
        const sensitivity = this.mouseControls.sensitivity.keyboardPan;
        const pivotPoint = this.mouseControls.pivotPoint;

        // Calcola i vettori right e up della camera in world space
        const cameraRight = new THREE.Vector3();
        const cameraUp = new THREE.Vector3();

        // Ottieni la direzione in cui guarda la camera
        const lookDirection = new THREE.Vector3();
        this.camera.getWorldDirection(lookDirection);

        // Vettore "up" del mondo
        const worldUp = new THREE.Vector3(0, 1, 0);

        // Right = lookDirection × worldUp (prodotto vettoriale)
        cameraRight.crossVectors(lookDirection, worldUp).normalize();

        // Up = cameraRight × lookDirection (perpendicolare al piano camera-look)
        cameraUp.crossVectors(cameraRight, lookDirection).normalize();

        // Calcola lo spostamento
        const panOffset = new THREE.Vector3();
        panOffset.addScaledVector(cameraRight, -deltaX * sensitivity);
        panOffset.addScaledVector(cameraUp, deltaY * sensitivity);

        // Applica lo spostamento sia alla camera che al pivot point
        this.camera.position.add(panOffset);
        pivotPoint.add(panOffset);

        // Applica anche il limite Y minimo al pivot
        const limits = this.mouseControls.limits;
        if (pivotPoint.y < limits.minY) {
            const correction = limits.minY - pivotPoint.y;
            pivotPoint.y = limits.minY;
            this.camera.position.y += correction;
        }

        console.log(`[Scene3D] 🎥 Pan camera: dx=${deltaX.toFixed(2)}, dy=${deltaY.toFixed(2)}`);
    },

    /**
     * Gestisce i tasti freccia per il pan della camera
     */
    onKeyDown: function(event) {
        // Ignora se l'utente sta scrivendo in un input/textarea
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }

        const panStep = 1.0; // Step base per il pan (moltiplicato per sensitivity)

        switch (event.key) {
            case 'ArrowLeft':
                this.panCamera(panStep, 0);
                event.preventDefault();
                break;
            case 'ArrowRight':
                this.panCamera(-panStep, 0);
                event.preventDefault();
                break;
            case 'ArrowUp':
                this.panCamera(0, panStep);
                event.preventDefault();
                break;
            case 'ArrowDown':
                this.panCamera(0, -panStep);
                event.preventDefault();
                break;
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

        // Salva la posizione originale dello scenario (immutabile)
        this.saveScenarioOriginalPosition(model);

        const modelFilename = model.userData?.originalFilename || model.name;

        // Collega modello a InteractiveObject3D se registrato
        // Questo abilita pulsanti, chiavi rotanti, LED nei modelli gerarchici
        if (window.InteractiveObject3D) {
            const modelName = modelFilename.replace('.glb', '').replace('.gltf', '');
            window.InteractiveObject3D.attachModel(modelName, model);

            // Collega anche mesh agli StateGroups per varianti mutuamente esclusive
            window.InteractiveObject3D.attachStateGroupMeshes(model);
        }

        // Fix schermi: auto-illuminato con solo texture (non influenzato da luci scena)
        // Include sia "schermo" (pulpito) che "schermo_r" (remote)
        model.traverse((child) => {
            const meshName = child.name ? child.name.toLowerCase() : '';
            if (child.isMesh && (meshName.includes('schermo') || meshName.includes('screen') || meshName.includes('display'))) {
                if (child.material) {
                    const mat = child.material;

                    // Usa la texture come emissiva (auto-illuminata)
                    if (mat.map) {
                        mat.emissiveMap = mat.map;
                        mat.emissive = new THREE.Color(1, 1, 1); // Bianco = mostra texture completa
                    }

                    // Luminosità schermo (sempre applicata)
                    mat.emissiveIntensity = 0.5; // Regola luminosità (0.3-1.0)

                    // Rimuovi influenza luci (colore nero = nessun contributo diffuso)
                    mat.color.setRGB(0, 0, 0);
                    mat.metalness = 0;
                    mat.roughness = 1;

                    console.log(`🖥️ [Scene3D] Schermo auto-illuminato: ${child.name}, emissiveIntensity=${mat.emissiveIntensity}`);
                }
            }
        });

        // Fix trasparenza per materiali con texture alpha (es. "simbolini")
        // Abilita la trasparenza e imposta alphaTest per scartare pixel trasparenti
        model.traverse((child) => {
            if (child.isMesh && child.material) {
                const mat = child.material;
                const matName = mat.name ? mat.name.toLowerCase() : '';

                // Materiali che richiedono trasparenza (simbolini, etichette, labels, ecc.)
                if (matName.includes('simbolini') || matName.includes('etichett') || matName.includes('label')) {
                    mat.transparent = true;
                    mat.alphaTest = 0.5;  // Scarta pixel con alpha < 0.5
                    mat.depthWrite = true; // Mantiene depth buffer per evitare z-fighting
                    mat.side = THREE.DoubleSide; // Visibile da entrambi i lati

                    console.log(`🏷️ [Scene3D] Trasparenza attivata per materiale: ${mat.name} su mesh ${child.name}`);
                }
            }
        });

        // Fix materiali luminosi/emissivi (es. "luminoso.001" sui pulsanti)
        // Aumenta emissiveIntensity per renderli più brillanti
        // Supporta sia materiali singoli che array di materiali
        model.traverse((child) => {
            if (child.isMesh && child.material) {
                // Gestisce sia materiale singolo che array di materiali
                const materials = Array.isArray(child.material) ? child.material : [child.material];

                materials.forEach((mat, index) => {
                    const matName = mat.name ? mat.name.toLowerCase() : '';

                    // Materiali luminosi/emissivi
                    if (matName.includes('luminoso') || matName.includes('emissive') || matName.includes('glow')) {
                        // Aumenta intensità emissiva
                        mat.emissiveIntensity = 3.0;  // Più luminoso (default è 1.0)

                        // Se non ha già un colore emissivo, usa il colore base
                        if (mat.emissive && mat.emissive.r === 0 && mat.emissive.g === 0 && mat.emissive.b === 0) {
                            mat.emissive = mat.color ? mat.color.clone() : new THREE.Color(1, 1, 1);
                        }

                        console.log(`💡 [Scene3D] Materiale luminoso potenziato: ${mat.name} su mesh ${child.name}[${index}], emissiveIntensity=${mat.emissiveIntensity}`);
                    }
                });
            }
        });

        // Nascondi immediatamente il modello planaxis (stato iniziale: spento)
        if (modelFilename && modelFilename.toLowerCase().includes('planaxis')) {
            model.visible = false;
            console.log('📐 PLANAXIS: Modello nascosto immediatamente al caricamento');
        }
        
        if (modelConfig && modelConfig.direction) {
            this.animationSystem.modelDirections[modelFilename] = modelConfig.direction;

            // CRITICAL FIX: Sincronizza anche con MovementParser per il parsing delle azioni
            // MovementParser usa il suo storage interno per getModelDirection()
            if (window.MovementParser) {
                // Salva con nome completo
                window.MovementParser.modelDirections[modelFilename] = modelConfig.direction;
                // Salva anche con nome pulito (senza path e senza .glb) per matching flessibile
                const cleanName = modelFilename.split('/').pop().replace('.glb', '');
                window.MovementParser.modelDirections[cleanName] = modelConfig.direction;
            }

            console.log(`🧭 Direction loaded for ${modelFilename}:`, modelConfig.direction);
        }
        
        return model;
    },

    clearAllModels: function() {
        console.log('[Scene3D] clearAllModels - Pulizia completa scena...');

        // Rimuovi tutti i modelli dalla scena
        this.loadedModels.forEach(model => {
            this.scene.remove(model);
        });
        this.loadedModels = [];
        this.currentModel = null;

        // Reset sistema animazioni
        this.animationSystem.modelDirections = {};
        this.animationSystem.activeAnimations = [];
        this.animationSystem.clickEnabled = true;
        if (this.animationSystem.multiStepAnimations) {
            this.animationSystem.multiStepAnimations.clear();
        }

        // Reset anche MovementParser.modelDirections (sincronizzato con addModel)
        if (window.MovementParser) {
            window.MovementParser.modelDirections = {};
        }

        // Reset mappe posizioni iniziali
        if (this.initialModelPositions) {
            this.initialModelPositions.clear();
        }
        if (this.scenarioOriginalPositions) {
            this.scenarioOriginalPositions.clear();
        }

        // Reset sistema highlight
        if (this.highlightSystem) {
            if (this.highlightSystem.highlightTimer) {
                clearTimeout(this.highlightSystem.highlightTimer);
                this.highlightSystem.highlightTimer = null;
            }
            this.highlightSystem.highlightedModel = null;
            this.highlightSystem.originalMaterials.clear();
            this.highlightSystem.isHighlighting = false;
        }

        // Reset tutorial tracker
        if (this.tutorialTracker) {
            this.tutorialTracker.completedSteps.clear();
            this.tutorialTracker.lastStepCompleted = false;
            this.tutorialTracker.interactionsBlocked = false;
        }

        console.log('[Scene3D] clearAllModels - Pulizia completata');
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
        const targetChild = currentStep.properties.TargetChild; // NUOVO: Supporto TargetChild

        const targetModel = this.loadedModels.find(model => {
            const modelFilename = model.userData?.originalFilename || model.name;
            const cleanModelName = modelFilename.split('/').pop().replace('.glb', '');
            const cleanStepElement = stepElement.split('/').pop().replace('.glb', '');
            return cleanModelName === cleanStepElement;
        });

        if (!targetModel) {
            console.log(`🔍 HIGHLIGHT: Modello parent non trovato`);
            return;
        }

        // ═══════════════════════════════════════════════════════════════════════
        // TARGETCHILD: Se specificato, cerca e evidenzia il child invece del parent
        // ═══════════════════════════════════════════════════════════════════════
        let modelToHighlight = targetModel;

        if (targetChild) {
            console.log(`🔍 HIGHLIGHT: TargetChild specificato: "${targetChild}"`);
            let foundChild = null;
            const cleanChildName = targetChild.trim();

            targetModel.traverse(function(child) {
                if (!foundChild && child.name === cleanChildName) {
                    foundChild = child;
                }
            });

            if (foundChild) {
                console.log(`✅ HIGHLIGHT: Trovato child "${cleanChildName}" da evidenziare`);
                modelToHighlight = foundChild;
                // Salva riferimento al parent
                foundChild.userData.parentModel = targetModel;
            } else {
                console.warn(`⚠️ HIGHLIGHT: Child "${cleanChildName}" non trovato, uso parent`);
            }
        }

        if (this.isModelSelectable(modelToHighlight) || targetChild) {
            // Se c'è TargetChild, evidenzia sempre (anche se il child non è in loadedModels)
            console.log(`🔍 HIGHLIGHT: Evidenzio: ${modelToHighlight.name}`);
            this.highlightModel(modelToHighlight);
        } else {
            console.log(`🔍 HIGHLIGHT: Modello non selezionabile`);
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
            // PRIORITA' 1: Verifica se è un figlio interattivo (InteractiveObject3D)
            // Questo gestisce pulsanti, chiavi rotanti, LED cliccabili nei modelli gerarchici
            if (window.InteractiveObject3D) {
                for (const intersect of intersects) {
                    const clickedMesh = intersect.object;
                    if (clickedMesh.userData.interactive) {
                        console.log(`[Scene3D] 🎮 Click su figlio interattivo: ${clickedMesh.name}`);
                        const handled = window.InteractiveObject3D.handleClick(clickedMesh);
                        if (handled) {
                            console.log(`[Scene3D] ✅ Click gestito da InteractiveObject3D`);
                            return; // Non proseguire con altri handler
                        }
                    }
                }
            }
            // PRIORITA' OGGETTO EVIDENZIATO: Se c'è un modello con silhouette gialla attiva,
            // cerca tra TUTTI gli intersects se uno di essi appartiene a quel modello.
            // Questo permette di cliccare sulla silhouette anche se l'oggetto è parzialmente nascosto.
            let selectedIntersect = intersects[0]; // Default: primo oggetto colpito

            if (this.highlightSystem.highlightedModel && this.highlightSystem.isHighlighting) {
                const highlightedModel = this.highlightSystem.highlightedModel;
                console.log(`[Scene3D] 🌟 Modello evidenziato attivo: ${highlightedModel.name}, cerco priorità...`);

                // Prima cerca tra tutti gli intersects normali
                let foundInNormalIntersects = false;
                for (let i = 0; i < intersects.length; i++) {
                    const rootModel = this.findRootModel(intersects[i].object);
                    if (rootModel === highlightedModel) {
                        selectedIntersect = intersects[i];
                        foundInNormalIntersects = true;
                        console.log(`[Scene3D] ✨ PRIORITA' SILHOUETTE: Selezionato modello evidenziato "${highlightedModel.name}" (posizione ${i+1}/${intersects.length} nel raycast)`);
                        break;
                    }
                }

                // Se non trovato negli intersects normali (oggetto completamente occludato da altra geometria),
                // esegui raycast diretto SOLO sul modello evidenziato, bypassando la geometria davanti.
                // Questo permette la selezione tramite la silhouette gialla da qualsiasi angolazione.
                if (!foundInNormalIntersects) {
                    const directIntersects = this.raycaster.intersectObject(highlightedModel, true);
                    if (directIntersects.length > 0) {
                        selectedIntersect = directIntersects[0];
                        console.log(`[Scene3D] ✨ PRIORITA' SILHOUETTE OCCLUSA: "${highlightedModel.name}" selezionato attraverso geometria occludante`);
                    }
                }
            }

            const clickedObject = selectedIntersect.object;
            const targetModel = this.findRootModel(clickedObject);
            
            // Verifica se il tool Aria o Spray è attivo per creare effetto particellare
            const activeTool = window.ToolsManager ? window.ToolsManager.getActiveTool() : 'none';
            const isAriaActiveByClass = document.body.classList.contains('tool-aria-active');
            const isSprayActiveByClass = document.body.classList.contains('tool-spray-active');
            console.log(`[Scene3D] Click su modello - ToolsManager: ${activeTool}, Body class aria: ${isAriaActiveByClass}, Body class spray: ${isSprayActiveByClass}`);

            // Usa la classe body come fonte affidabile per il tool aria
            if (isAriaActiveByClass) {
                console.log(`[Scene3D] 💨 Attivazione effetto aria su click (rilevato da body class)!`);
                this.handleAirToolEffect(intersects[0], event);
                return; // Non proseguire con azione normale del modello
            }

            // Usa la classe body come fonte affidabile per il tool spray
            if (isSprayActiveByClass) {
                console.log(`[Scene3D] 🖤 Attivazione effetto spray su click (rilevato da body class)!`);
                this.handleSprayToolEffect(intersects[0], event);
                return; // Non proseguire con azione normale del modello
            }
            
            if (targetModel && this.isModelSelectable(targetModel)) {
                console.log(`[Scene3D] 🎯 Click rilevato su modello: ${targetModel.name}`);

                // Il DragDropSystem gestisce automaticamente i click via event listeners
                // Non interferire - lascia che il DragDropSystem processi l'evento

                // Sistema legacy per tutorial tradizionali (solo se DragDropSystem non è attivo)
                if (!this.dragDropSystem || !this.dragDropSystem.enabled) {
                    console.log(`[Scene3D] 📺 Uso sistema tutorial legacy per: ${targetModel.name}`);
                    this.handleModelAction(targetModel);
                } else {
                    console.log(`[Scene3D] 🎮 DragDropSystem attivo - evento delegato automaticamente`);
                }
            }
        } else {
            // Nessun intersect normale (clic in area vuota).
            // Verifica se il modello evidenziato è geometricamente sotto il cursore:
            // succede quando la silhouette gialla (depthTest=false) si estende oltre
            // la geometria dei modelli davanti, ed è l'unica cosa visibile in quel punto.
            if (this.highlightSystem.highlightedModel && this.highlightSystem.isHighlighting) {
                const highlightedModel = this.highlightSystem.highlightedModel;
                const directIntersects = this.raycaster.intersectObject(highlightedModel, true);
                if (directIntersects.length > 0 && this.isModelSelectable(highlightedModel)) {
                    console.log(`[Scene3D] ✨ SILHOUETTE IN SPAZIO VUOTO: "${highlightedModel.name}" selezionato`);
                    if (!this.dragDropSystem || !this.dragDropSystem.enabled) {
                        this.handleModelAction(highlightedModel);
                    }
                }
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

    handleSprayToolEffect: function(intersection, event) {
        if (!this.particleSystem) {
            console.warn('[Scene3D] Sistema particellare non disponibile per tool Spray - procedo senza effetti');

            // Fallback: completa l'azione anche senza particelle
            const intersectedObject = intersection.object;
            let targetModel = intersectedObject;
            while (targetModel.parent && !this.loadedModels.includes(targetModel)) {
                targetModel = targetModel.parent;
            }

            if (targetModel && this.isModelSelectable(targetModel)) {
                console.log('[Scene3D] 🖤 Azione spray completata (modalità fallback)');
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
        const sprayDirection = new THREE.Vector3()
            .subVectors(objectCenter, cursorPosition3D)
            .normalize();

        // Distanza dal cursore al target - le particelle si fermano qui
        const distanceToTarget = cursorPosition3D.distanceTo(objectCenter);

        console.log('[Scene3D] 🖤 Spray nero dal cursore all\'oggetto', {
            cursorPos: cursorPosition3D,
            objectCenter: objectCenter,
            direction: sprayDirection,
            distanceToTarget: distanceToTarget.toFixed(3)
        });

        // Crea spray dal cursore verso l'oggetto con distanza limitata
        const sprayId = this.particleSystem.createSpray(cursorPosition3D, sprayDirection, {
            particleCount: 400,
            life: 2.0,
            speed: { min: 5, max: 15 },
            size: { min: 0.002, max: 0.008 },
            spread: { x: 0.05, y: 0.05, z: 0.05 },
            opacity: { start: 0.8, end: 0.0 },
            maxDistance: distanceToTarget,
            gravity: { x: 0, y: -0.3, z: 0 }
        });

        // Feedback visivo aggiuntivo
        if (window.ToolsManager && window.ToolsManager.feedbackManager) {
            window.ToolsManager.feedbackManager.updateStatus('🖤 Spray applicato: cursore → oggetto');
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
            // PRIORITA' OGGETTO EVIDENZIATO: Anche per il cambio pivot, dai priorità alla silhouette
            let selectedIntersect = intersects[0];

            if (this.highlightSystem.highlightedModel && this.highlightSystem.isHighlighting) {
                const highlightedModel = this.highlightSystem.highlightedModel;
                for (let i = 0; i < intersects.length; i++) {
                    const rootModel = this.findRootModel(intersects[i].object);
                    if (rootModel === highlightedModel) {
                        selectedIntersect = intersects[i];
                        console.log(`[Scene3D] ✨ PIVOT: Priorità a modello evidenziato "${highlightedModel.name}"`);
                        break;
                    }
                }
            }

            const intersection = selectedIntersect;

            // Usa sempre il punto di intersezione esatto dove l'utente ha cliccato
            // Questo permette di puntare esattamente allo schermo, non al centro del modello parent
            const newPivotPoint = intersection.point.clone();

            console.log(`[Scene3D] 🎯 PIVOT CLICK: punto esatto (${newPivotPoint.x.toFixed(3)}, ${newPivotPoint.y.toFixed(3)}, ${newPivotPoint.z.toFixed(3)}) su mesh "${intersection.object.name}"`);

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
        console.log(`[DEBUG] 🎬 handleModelAction chiamato per: ${model.name}`);

        const currentStep = this.getCurrentTutorialStep();
        console.log(`[DEBUG] 📋 Current step:`, currentStep?.name || 'null');

        if (!currentStep) {
            console.log(`[DEBUG] ❌ No current step - USCITA EARLY`);
            return;
        }

        const modelFilename = model.userData?.originalFilename || model.name;
        const stepElement = currentStep.properties.Elemento;
        const targetChildName = currentStep.properties.TargetChild;
        console.log(`[DEBUG] 🎯 Model filename: "${modelFilename}", Step element: "${stepElement}", TargetChild: "${targetChildName || 'none'}"`);

        // IMPORTANTE: Step DragDrop puri non hanno Elemento - esci subito
        if (!stepElement) {
            console.log(`[DEBUG] ℹ️ Step senza Elemento (DragDrop puro) - delego a DragDropSystem`);
            return;
        }

        const cleanModelName = modelFilename.split('/').pop().replace('.glb', '');
        const cleanStepElement = stepElement.split('/').pop().replace('.glb', '');
        console.log(`[DEBUG] 🎯 Clean model: "${cleanModelName}", Clean step: "${cleanStepElement}"`);

        if (cleanModelName !== cleanStepElement) {
            console.log(`[DEBUG] ❌ Model/element mismatch - USCITA EARLY`);
            return;
        }

        // ═══════════════════════════════════════════════════════════════════════
        // TARGETCHILD: Se specificato, trova il child da animare invece del parent
        // ═══════════════════════════════════════════════════════════════════════
        let modelToAnimate = model;
        let parentModelForConfig = model; // Per home_config usa sempre il parent

        if (targetChildName) {
            console.log(`[DEBUG] 🔍 TARGETCHILD: Cercando child "${targetChildName}" dentro "${model.name}"`);
            let foundChild = null;
            const cleanChildName = targetChildName.trim();

            model.traverse(function(child) {
                if (!foundChild && child.name === cleanChildName) {
                    foundChild = child;
                }
            });

            if (foundChild) {
                console.log(`[DEBUG] ✅ TARGETCHILD: Trovato child "${cleanChildName}" (tipo: ${foundChild.type})`);
                modelToAnimate = foundChild;
                // Salva riferimento al parent per home_config
                foundChild.userData.parentModel = model;
                foundChild.userData.parentModelName = stepElement;
            } else {
                console.warn(`[DEBUG] ⚠️ TARGETCHILD: Child "${cleanChildName}" non trovato, uso parent`);
                console.warn(`[DEBUG] ⚠️ TARGETCHILD: Children disponibili:`, this.listChildNames(model));
            }
        }

        if (this.isModelAnimating(modelToAnimate)) {
            console.log(`[DEBUG] ❌ Model already animating - USCITA EARLY`);
            return;
        }

        // ═══════════════════════════════════════════════════════════════════════
        // HOLDABLE SYSTEM: Gestione HoldAction=pick al click
        // ⚠️ PRIORITA' ALTA: Esegui PRIMA del check del tool per evitare race condition
        // ═══════════════════════════════════════════════════════════════════════
        if (currentStep.properties.HoldAction) {
            const holdAction = currentStep.properties.HoldAction.toLowerCase();

            if (holdAction === 'pick' && window.HoldableSystem) {
                console.log(`[DEBUG] 🤚 HoldAction=pick - Eseguo pickObject per: ${cleanModelName}`);
                console.log(`[DEBUG] 🤚 HoldableSystem stato: initialized=${window.HoldableSystem.initialized}, holdables=${window.HoldableSystem.holdableConfigs.size}`);

                // Esegui pick IMMEDIATAMENTE senza check del tool
                const success = window.HoldableSystem.pickObject(cleanModelName);

                if (success) {
                    // Rimuovi highlight
                    this.removeHighlight();

                    // Avanza allo step successivo dopo un breve delay
                    setTimeout(() => {
                        if (window.UI && typeof window.UI.nextStep === 'function') {
                            console.log(`[DEBUG] ⏭️ Avanzo allo step successivo dopo pick`);
                            window.UI.nextStep();
                        }
                    }, 300);
                } else {
                    console.error(`[DEBUG] ❌ pickObject FALLITO per: ${cleanModelName}`);
                    console.error(`[DEBUG] ❌ Verifica che l'oggetto sia registrato con Holdable=true nello step`);
                }
                return; // Non proseguire con animazione normale
            }
        }

        // ═══════════════════════════════════════════════════════════════════════
        // CHECK TOOL: Solo per azioni normali (svita, avvita, traslazione, etc.)
        // ═══════════════════════════════════════════════════════════════════════
        const requiredTool = this.getRequiredToolForStep(currentStep);
        const activeTool = window.ToolsManager ? window.ToolsManager.getActiveTool() : null;
        console.log(`[DEBUG] 🔧 Tool required: "${requiredTool}", active: "${activeTool}"`);

        if (this.highlightSystem.isHighlighting &&
            this.highlightSystem.highlightedModel === model &&
            requiredTool && activeTool === requiredTool) {

            this.removeHighlight();
        }

        if (!requiredTool || activeTool !== requiredTool) {
            console.log(`[DEBUG] ❌ Tool mismatch - USCITA EARLY`);
            return;
        }

        console.log(`[DEBUG] ✅ Tutti i controlli passati - chiamando startModelAnimation`);
        // Passa sia il modello da animare che il parent per la config
        this.startModelAnimation(modelToAnimate, currentStep, parentModelForConfig);
    },

    /**
     * AutoExecute: Esegue animazione automaticamente senza click utente
     * Usato quando step ha AutoExecute=true
     * @param {Object} target - Il modello o child da animare
     * @param {Object} tutorialStep - Lo step del tutorial con le proprietà
     * @param {Object} rootModel - Il modello root per cercare home_config (opzionale)
     */
    autoExecuteAnimation: function(target, tutorialStep, rootModel = null) {
        console.log(`[Scene3D] 🤖 AutoExecute: ═══════════════════════════════════════════`);
        console.log(`[Scene3D] 🤖 AutoExecute: Avvio animazione per "${target.name}"`);
        console.log(`[Scene3D] 🤖 AutoExecute: Target type:`, target.type);
        console.log(`[Scene3D] 🤖 AutoExecute: Target position:`, target.position.clone());
        console.log(`[Scene3D] 🤖 AutoExecute: isChild (ha parentModel)?`, !!target.userData?.parentModel);
        console.log(`[Scene3D] 🤖 AutoExecute: parentModel name:`, target.userData?.parentModel?.name || 'N/A');
        console.log(`[Scene3D] 🤖 AutoExecute: matrixAutoUpdate:`, target.matrixAutoUpdate);
        console.log(`[Scene3D] 🤖 AutoExecute: Tutorial step properties:`, tutorialStep.properties);

        // Usa il nome del modello root per home_config, altrimenti il target
        const modelForConfig = rootModel || target;
        const modelFilename = modelForConfig.userData?.originalFilename || modelForConfig.name;
        console.log(`[Scene3D] 🤖 AutoExecute: ModelFilename per home_config: "${modelFilename}"`);
        console.log(`[Scene3D] 🤖 AutoExecute: Target da animare: "${target.name}"`);

        // Parse le azioni dallo step usando MovementParser
        const movementSteps = window.MovementParser.parseMovementSteps(tutorialStep, modelFilename);
        console.log(`[Scene3D] 🤖 AutoExecute: Movement steps parsed:`, movementSteps);

        if (movementSteps.length > 0) {
            console.log(`[Scene3D] 🤖 AutoExecute: ${movementSteps.length} azioni da eseguire`);

            // Recupera slave e driven objects se presenti
            const slaveObjects = tutorialStep.properties?.SlaveObjectsList || [];
            const drivenObjectsConfig = tutorialStep.properties?.DrivenObjectsConfig ||
                                       (tutorialStep.properties?.DrivenObjectConfig ? [tutorialStep.properties.DrivenObjectConfig] : []);

            const result = window.MultiStepAnimationSystem.startMultiStepMovement(target, movementSteps, slaveObjects, drivenObjectsConfig);
            console.log(`[Scene3D] 🤖 AutoExecute: startMultiStepMovement returned:`, result);
            return result;
        } else {
            console.warn(`[Scene3D] ⚠️ AutoExecute: Nessuna azione trovata nello step!`);
            console.warn(`[Scene3D] ⚠️ AutoExecute: Verifica che ci sia Azione1=... nel tutorial.txt`);
            return null;
        }
    },

    /**
     * Avvia l'animazione di un modello o child
     * @param {Object} model - Il modello da animare (può essere un child)
     * @param {Object} tutorialStep - Lo step del tutorial con le proprietà
     * @param {Object} parentModelForConfig - Il modello parent per cercare home_config (opzionale, per TargetChild)
     */
    startModelAnimation: function(model, tutorialStep, parentModelForConfig = null) {
        // Se parentModelForConfig specificato, usa quello per home_config (caso TargetChild)
        // Altrimenti usa il modello stesso
        const configModel = parentModelForConfig || model;
        const modelFilename = configModel.userData?.originalFilename || configModel.name;

        console.log(`[Scene3D] 🎬 startModelAnimation: Modello da animare: "${model.name}"`);
        if (parentModelForConfig) {
            console.log(`[Scene3D] 🎬 startModelAnimation: Usando parent "${configModel.name}" per home_config`);
        }

        // SEMPRE usa sistema multi-step per Azione1, Azione2, etc. usando MovementParser
        const movementSteps = window.MovementParser.parseMovementSteps(tutorialStep, modelFilename);
        if (movementSteps.length > 0) {
            // Recupera slave objects dal tutorial step (se presenti)
            const slaveObjects = tutorialStep.properties?.SlaveObjectsList || [];
            // Recupera driven objects config dal tutorial step (se presenti) - supporta sia array che singolo
            const drivenObjectsConfig = tutorialStep.properties?.DrivenObjectsConfig ||
                                       (tutorialStep.properties?.DrivenObjectConfig ? [tutorialStep.properties.DrivenObjectConfig] : []);
            return window.MultiStepAnimationSystem.startMultiStepMovement(model, movementSteps, slaveObjects, drivenObjectsConfig);
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

        // IMPORTANTE: Forza aggiornamento matrixWorld prima di calcolare bounding box
        // Necessario dopo operazioni drag & drop per garantire posizione corrente
        model.updateMatrixWorld(true);

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

    // ═══════════════════════════════════════════════════════════════════════════
    // MOVIMENTO PARSING - Estratto in MovementParser.js
    // ═══════════════════════════════════════════════════════════════════════════
    // Le seguenti funzioni sono state estratte nel modulo MovementParser:
    // - parseMovementSteps()
    // - parseMovementStepString()
    // - parseMovementOperation()
    // - loadModelDirections()
    // - getModelDirection()
    //
    // Usa window.MovementParser.* per accedere a queste funzioni
    // ═══════════════════════════════════════════════════════════════════════════

    // ═══════════════════════════════════════════════════════════════════════════
    // MULTI-STEP ANIMATION SYSTEM - Estratto in MultiStepAnimationSystem.js
    // ═══════════════════════════════════════════════════════════════════════════
    // Le seguenti funzioni sono state estratte nel modulo MultiStepAnimationSystem:
    // - startMultiStepMovement()
    // - executeCurrentMultiStep()
    // - onMultiStepCompleted()
    // - finishMultiStepMovement()
    //
    // Usa window.MultiStepAnimationSystem.* per accedere a queste funzioni
    // ═══════════════════════════════════════════════════════════════════════════

    updateAnimations: function() {
        // DEBUG SEMPRE ATTIVO: Log numero animazioni all'inizio di ogni frame (solo se ci sono animazioni)
        if (this.animationSystem.activeAnimations.length > 0) {
            console.log(`🔄 [UPDATE_ANIMS] Animazioni attive: ${this.animationSystem.activeAnimations.length}`);
            this.animationSystem.activeAnimations.forEach((anim, idx) => {
                console.log(`   [${idx}] model=${anim.model?.name}, hasTranslation=${!!anim.hasTranslation}, hasRotation=${!!anim.hasRotation}, finished=${anim.finished}`);
            });
        }

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

            // DEBUG: Log per capire quale branch viene preso
            if (Math.random() < 0.02) {
                console.log(`🔍 ANIM DEBUG [${anim.model?.name}]: hasTranslation=${!!anim.hasTranslation}, hasRotation=${!!anim.hasRotation}, modelCenter=${!!anim.modelCenter}, hasSvita=${!!anim.hasSvita}, hasAvvita=${!!anim.hasAvvita}`);
            }

            // Gestione uniforme di animazioni - USA hasRotation/hasTranslation invece di controllare esistenza targetRotation
            if (anim.hasRotation && (anim.modelCenter || anim.hasSvita || anim.hasAvvita)) {
                // Rotazione attorno a centro (personalizzato o standard) - NO movimento lineare
                this.applyRotationAroundCenter(anim, progress);
            } else if (anim.hasRotation && !anim.hasTranslation) {
                // Solo rotazione senza centro personalizzato
                // REFACTORING: Usa pool invece di new allocations
                const tempQuaternion1 = this.animationPool.getQuaternion().setFromEuler(anim.initialRotation);
                const tempQuaternion2 = this.animationPool.getQuaternion().setFromEuler(anim.targetRotation);
                const resultQuaternion = tempQuaternion1.slerp(tempQuaternion2, progress);
                anim.model.setRotationFromQuaternion(resultQuaternion);

                // IMPORTANTE: Forza aggiornamento matrici per nodi GLB annidati
                anim.model.updateMatrix();
                anim.model.updateMatrixWorld(true);
            } else if (anim.hasTranslation && !anim.hasRotation) {
                // Solo movimento lineare (traslazione pura)
                // REFACTORING: Usa pool invece di new allocations
                // Il pool vector viene resettato automaticamente, poi populato da lerpVectors
                const newPosition = this.animationPool.getVector().lerpVectors(anim.initialPosition, anim.targetPosition, progress);
                anim.model.position.copy(newPosition);

                // DEBUG: Log ogni 20 frame circa per verificare che l'animazione giri
                if (Math.random() < 0.05) {
                    console.log(`🎯 ANIM LOOP [${anim.model.name}]: progress=${progress.toFixed(2)}, pos=(${anim.model.position.x.toFixed(3)}, ${anim.model.position.y.toFixed(3)}, ${anim.model.position.z.toFixed(3)}), hasParent=${!!anim.model.userData?.parentModel}`);
                }

                // IMPORTANTE: Forza aggiornamento matrici per nodi GLB annidati
                // Aggiorna dalla ROOT del GLB fino al child
                if (anim.model.userData?.parentModel) {
                    // Se è un child, aggiorna prima il parent root poi il child
                    anim.model.userData.parentModel.updateMatrixWorld(true);
                }
                anim.model.updateMatrix();
                anim.model.updateMatrixWorld(true);

                // CRITICO: Marca anche tutta la catena parent come "needs update"
                let currentParent = anim.model.parent;
                while (currentParent) {
                    currentParent.updateMatrix();
                    currentParent = currentParent.parent;
                }

                // CRITICO: Per GLB children, forza anche il re-render dei materiali
                if (anim.model.userData?.parentModel) {
                    anim.model.traverse((child) => {
                        if (child.isMesh && child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach(mat => mat.needsUpdate = true);
                            } else {
                                child.material.needsUpdate = true;
                            }
                        }
                    });
                }

                // Applica stessa traslazione agli slave
                if (anim.slaveModels && anim.slaveModels.length > 0) {
                    try {
                        // REFACTORING: Usa pool invece di new allocations
                        const masterDelta = this.animationPool.getVector().subVectors(anim.model.position, anim.initialPosition);
                        anim.slaveModels.forEach(slave => {
                            if (slave && slave.model && slave.initialPosition) {
                                slave.model.position.copy(slave.initialPosition).add(masterDelta);
                            }
                        });
                    } catch (error) {
                        console.error(`❌ SLAVE ERROR durante traslazione:`, error);
                    }
                }
            } else if (anim.hasTranslation && anim.hasRotation) {
                // Movimento combinato (traslazione + rotazione semplice)
                anim.model.position.lerpVectors(anim.initialPosition, anim.targetPosition, progress);
                // REFACTORING: Usa pool invece di new allocations
                const tempQuaternion1 = this.animationPool.getQuaternion().setFromEuler(anim.initialRotation);
                const tempQuaternion2 = this.animationPool.getQuaternion().setFromEuler(anim.targetRotation);
                const resultQuaternion = tempQuaternion1.slerp(tempQuaternion2, progress);
                anim.model.setRotationFromQuaternion(resultQuaternion);

                // IMPORTANTE: Forza aggiornamento matrici per nodi GLB annidati
                anim.model.updateMatrix();  // Prima aggiorna matrice locale
                anim.model.updateMatrixWorld(true);  // Poi propaga a world

                // Applica stessa traslazione e rotazione agli slave
                if (anim.slaveModels && anim.slaveModels.length > 0) {
                    try {
                        // REFACTORING: Usa pool invece di new allocations
                        const masterDelta = this.animationPool.getVector().subVectors(anim.model.position, anim.initialPosition);
                        const masterRotationDelta = this.animationPool.getEuler().set(
                            anim.model.rotation.x - anim.initialRotation.x,
                            anim.model.rotation.y - anim.initialRotation.y,
                            anim.model.rotation.z - anim.initialRotation.z
                        );

                        anim.slaveModels.forEach(slave => {
                            if (slave && slave.model && slave.initialPosition && slave.initialRotation) {
                                // Applica traslazione
                                slave.model.position.copy(slave.initialPosition).add(masterDelta);

                                // Applica rotazione
                                slave.model.rotation.set(
                                    slave.initialRotation.x + masterRotationDelta.x,
                                    slave.initialRotation.y + masterRotationDelta.y,
                                    slave.initialRotation.z + masterRotationDelta.z
                                );
                            }
                        });
                    } catch (error) {
                        console.error(`❌ SLAVE ERROR durante traslazione+rotazione:`, error);
                    }
                }
            }
            
            if (progress >= 1.0) {
                anim.finished = true;

                // Per animazioni con rotazione attorno a centro (svita/avvita), NON copiare targetPosition
                // perché la posizione finale corretta è già stata calcolata da applyRotationAroundCenter
                if (!anim.modelCenter && !(anim.hasSvita || anim.hasAvvita)) {
                    anim.model.position.copy(anim.targetPosition);
                }

                if (anim.targetRotation) {
                    anim.model.rotation.copy(anim.targetRotation);
                }

                // Applica posizioni finali anche agli slave
                if (anim.slaveModels && anim.slaveModels.length > 0) {
                    try {
                        // REFACTORING: Usa pool invece di new allocations
                        const masterDelta = this.animationPool.getVector().subVectors(anim.model.position, anim.initialPosition);
                        anim.slaveModels.forEach(slave => {
                            if (slave && slave.model && slave.initialPosition) {
                                slave.model.position.copy(slave.initialPosition).add(masterDelta);

                                if (anim.targetRotation && slave.initialRotation) {
                                    // REFACTORING: Usa pool invece di new allocations
                                    const masterRotationDelta = this.animationPool.getEuler().set(
                                        anim.model.rotation.x - anim.initialRotation.x,
                                        anim.model.rotation.y - anim.initialRotation.y,
                                        anim.model.rotation.z - anim.initialRotation.z
                                    );
                                    slave.model.rotation.set(
                                        slave.initialRotation.x + masterRotationDelta.x,
                                        slave.initialRotation.y + masterRotationDelta.y,
                                        slave.initialRotation.z + masterRotationDelta.z
                                    );
                                }

                                console.log(`🔗 SLAVE COMPLETATO: "${slave.name}" seguì master a (${slave.model.position.x.toFixed(2)}, ${slave.model.position.y.toFixed(2)}, ${slave.model.position.z.toFixed(2)})`);
                            }
                        });
                    } catch (error) {
                        console.error(`❌ SLAVE ERROR durante completamento:`, error);
                    }
                }

                // DEBUG: Log posizione finale dopo animazione
                if (anim.model.name && anim.model.name.includes('vite_culatta')) {
                    console.log(`✅ ANIMAZIONE COMPLETATA ${anim.model.name}: posizione finale (${anim.model.position.x.toFixed(2)}, ${anim.model.position.y.toFixed(2)}, ${anim.model.position.z.toFixed(2)})`);
                }

                // IMPORTANTE: Le animazioni driven NON devono far avanzare il tutorial
                // Solo il master controlla l'avanzamento
                if (anim.isDriven) {
                    console.log(`🚗 DRIVEN OBJECT: Animazione completata per "${anim.model.name || anim.model.userData?.originalFilename}" - NO avanzamento tutorial`);
                } else if (anim.isMultiStep) {
                    window.MultiStepAnimationSystem.onMultiStepCompleted(anim.modelUuid);
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
        // REFACTORING: Usa pool invece di new allocations (chiamato ogni frame)
        const currentRotation = this.animationPool.getEuler().set(
            anim.initialRotation.x + (anim.targetRotation.x - anim.initialRotation.x) * progress,
            anim.initialRotation.y + (anim.targetRotation.y - anim.initialRotation.y) * progress,
            anim.initialRotation.z + (anim.targetRotation.z - anim.initialRotation.z) * progress
        );

        console.log(`🔄 ROTATE AROUND CENTER ${anim.model.name}: progress=${progress.toFixed(3)}, currentRotation=`, currentRotation, `modelCenter=`, anim.modelCenter);
        console.log(`🔍 DEBUG POSITIONS: initialPos=`, anim.initialPosition, `targetPos=`, anim.targetPosition);

        // REFACTORING: Usa pool invece di new allocations
        const linearMovement = this.animationPool.getVector().lerpVectors(anim.initialPosition, anim.targetPosition, progress);
        console.log(`🔍 LINEAR MOVEMENT (progress=${progress.toFixed(3)}):`, linearMovement);
        
        if (anim.modelCenter && anim.modelCenter.length() > 0.001) {
            const pivot = anim.modelCenter;
            
            // Per animazioni multistep con rotazione, calcola la posizione interpolando l'angolo
            if (anim.isMultiStep && anim.hasRotation) {
                let newPosition;

                // Per svita/avvita: traslazione lineare del CENTRO BB + rotazione attorno al centro BB
                if (anim.hasSvita || anim.hasAvvita) {
                    // REFACTORING: Usa pool per tutte le allocazioni temporanee
                    // 1. Il centro del BB si muove linearmente
                    const initialBBCenter = this.animationPool.getVector().copy(anim.modelCenter);
                    const traslazione = this.animationPool.getVector().set(
                        anim.targetPosition.x - anim.initialPosition.x,
                        anim.targetPosition.y - anim.initialPosition.y,
                        anim.targetPosition.z - anim.initialPosition.z
                    );
                    const finalBBCenter = this.animationPool.getVector().copy(initialBBCenter).add(traslazione);
                    const currentBBCenter = this.animationPool.getVector().lerpVectors(initialBBCenter, finalBBCenter, progress);

                    // 2. Offset tra model.position e BB center (all'inizio)
                    const initialOffset = this.animationPool.getVector().copy(anim.initialPosition).sub(initialBBCenter);

                    // 3. Ruota l'offset attorno all'origine (per compensare che model.rotation ruota attorno al suo origin locale)
                    const rotationDelta = this.animationPool.getEuler().set(
                        currentRotation.x - anim.initialRotation.x,
                        currentRotation.y - anim.initialRotation.y,
                        currentRotation.z - anim.initialRotation.z
                    );
                    const rotationMatrix = this.animationPool.getMatrix();
                    rotationMatrix.makeRotationFromEuler(rotationDelta);
                    const rotatedOffset = this.animationPool.getVector().copy(initialOffset).applyMatrix4(rotationMatrix);

                    // 4. Nuova posizione = centro BB corrente + offset ruotato
                    newPosition = this.animationPool.getVector().copy(currentBBCenter).add(rotatedOffset);

                    // 5. Applica rotazione al modello
                    anim.model.rotation.x = anim.initialRotation.x + rotationDelta.x;
                    anim.model.rotation.y = anim.initialRotation.y + rotationDelta.y;
                    anim.model.rotation.z = anim.initialRotation.z + rotationDelta.z;

                    console.log(`🔩 SVITA: BBCenter ${currentBBCenter.x.toFixed(3)},${currentBBCenter.y.toFixed(3)},${currentBBCenter.z.toFixed(3)} | Pos ${newPosition.x.toFixed(3)},${newPosition.y.toFixed(3)},${newPosition.z.toFixed(3)} | Offset ${rotatedOffset.x.toFixed(3)},${rotatedOffset.y.toFixed(3)},${rotatedOffset.z.toFixed(3)} | Rot ${(rotationDelta.z * 180/Math.PI).toFixed(1)}°`);
                } else {
                    // Per altre rotazioni: usa rotazione orbitale attorno al pivot
                    // REFACTORING: Usa pool per tutte le allocazioni temporanee
                    const rotationDelta = this.animationPool.getEuler().set(
                        currentRotation.x - anim.initialRotation.x,
                        currentRotation.y - anim.initialRotation.y,
                        currentRotation.z - anim.initialRotation.z
                    );

                    const rotationMatrix = this.animationPool.getMatrix();
                    rotationMatrix.makeRotationFromEuler(rotationDelta);

                    const relativePosition = this.animationPool.getVector().copy(anim.initialPosition).sub(pivot);
                    relativePosition.applyMatrix4(rotationMatrix);
                    newPosition = this.animationPool.getVector().copy(pivot).add(relativePosition);

                    // Aggiungi traslazione SOLO se è esplicitamente richiesta (non per rotazioni pure)
                    if (anim.hasTranslation) {
                        const translationProgress = this.animationPool.getVector().copy(linearMovement).sub(anim.initialPosition);
                        newPosition.add(translationProgress);
                    }

                    anim.model.rotation.copy(currentRotation);
                }

                anim.model.position.copy(newPosition);
                
                console.log(`🔄 MultiStep rotazione attorno a pivot (${pivot.x.toFixed(3)}, ${pivot.y.toFixed(3)}, ${pivot.z.toFixed(3)}): nuova pos (${newPosition.x.toFixed(3)}, ${newPosition.y.toFixed(3)}, ${newPosition.z.toFixed(3)})`);
            } else if (anim.isMultiStep) {
                // Semplice interpolazione per multistep senza rotazione
                anim.model.rotation.copy(currentRotation);
                anim.model.position.copy(linearMovement);
            } else {
                // Sistema di rotazione attorno al pivot per animazioni singole
                // REFACTORING: Usa pool per tutte le allocazioni temporanee
                const matrix = this.animationPool.getMatrix();
                matrix.makeTranslation(-pivot.x, -pivot.y, -pivot.z);

                const rotationMatrix = this.animationPool.getMatrix();
                rotationMatrix.makeRotationFromEuler(currentRotation);
                matrix.premultiply(rotationMatrix);

                const translateBack = this.animationPool.getMatrix();
                translateBack.makeTranslation(pivot.x, pivot.y, pivot.z);
                matrix.premultiply(translateBack);

                const transformedPosition = this.animationPool.getVector().copy(anim.initialPosition);
                transformedPosition.applyMatrix4(matrix);

                const finalPosition = this.animationPool.getVector().copy(linearMovement);
                const offset = this.animationPool.getVector().copy(transformedPosition).sub(anim.initialPosition);
                finalPosition.add(offset);

                anim.model.position.copy(finalPosition);
                anim.model.rotation.copy(currentRotation);
            }
        } else {
            anim.model.rotation.copy(currentRotation);
            anim.model.position.copy(linearMovement);
        }

        // IMPORTANTE: Forza aggiornamento matrici per nodi GLB annidati
        anim.model.updateMatrix();  // Prima aggiorna matrice locale
        anim.model.updateMatrixWorld(true);  // Poi propaga a world
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
                'Aria': 'aria',
                'Spray': 'spray'
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
     * Salva la posizione originale dello scenario (immutabile)
     * Queste posizioni vengono salvate solo al caricamento e non vengono mai sovrascritte
     */
    saveScenarioOriginalPosition: function(model) {
        if (!model || !model.uuid) return;

        // Calcola il centro del bounding box come posizione di riferimento
        const centerPosition = this.calculateBoundingBoxCenter(model);

        this.scenarioOriginalPositions.set(model.uuid, {
            position: centerPosition.clone(),  // Usa centro bounding box
            rotation: model.rotation.clone(),
            scale: model.scale.clone(),
            modelPosition: model.position.clone()  // Salva anche model.position originale
        });

        console.log(`🏠 Posizione ORIGINALE SCENARIO salvata per modello: ${model.name || model.uuid} - Centro BB: (${centerPosition.x.toFixed(3)}, ${centerPosition.y.toFixed(3)}, ${centerPosition.z.toFixed(3)})`);
    },

    /**
     * Ripristina tutti i modelli alle posizioni iniziali
     * Se ci sono impostazioni tutorial da applicare, le applica prima del reset
     */
    resetAllModelsToInitialPositions: function(tutorialStep = null) {
        console.log('🔄 RESET: Ripristino posizioni iniziali di tutti i modelli...');
        console.log(`🔄 DEBUG: loadedModels count: ${this.loadedModels.length}`);
        console.log(`🔄 DEBUG: initialModelPositions size: ${this.initialModelPositions.size}`);

        let resetCount = 0;
        
        // FASE 1: Ripristina alle posizioni iniziali salvate al caricamento
        for (const model of this.loadedModels) {
            console.log(`🔄 DEBUG: Tentativo reset modello: ${model.name || model.uuid}`);
            if (this.resetModelToInitialPosition(model)) {
                resetCount++;
                console.log(`🔄 DEBUG: Reset riuscito per: ${model.name || model.uuid}`);
            } else {
                console.log(`🔄 DEBUG: Reset fallito per: ${model.name || model.uuid}`);
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
     * Ripristina tutti i modelli alle posizioni ORIGINALI dello scenario
     * Ignora le impostazioni dei tutorial e torna alle posizioni pure di caricamento
     */
    resetAllModelsToScenarioPositions: function() {
        console.log('🏠 RESET SCENARIO: Ripristino posizioni originali dello scenario...');
        console.log(`🏠 DEBUG: loadedModels count: ${this.loadedModels.length}`);
        console.log(`🏠 DEBUG: scenarioOriginalPositions size: ${this.scenarioOriginalPositions.size}`);

        let resetCount = 0;

        // Ripristina alle posizioni originali dello scenario (NO impostazioni tutorial)
        for (const model of this.loadedModels) {
            console.log(`🏠 DEBUG: Tentativo reset SCENARIO modello: ${model.name || model.uuid}`);
            if (this.resetModelToScenarioPosition(model)) {
                resetCount++;
                console.log(`🏠 DEBUG: Reset SCENARIO riuscito per: ${model.name || model.uuid}`);
            } else {
                console.log(`🏠 DEBUG: Reset SCENARIO fallito per: ${model.name || model.uuid}`);
            }
        }

        console.log(`🏠 RESET SCENARIO: ${resetCount} modelli ripristinati alle posizioni originali dello scenario`);
        return resetCount;
    },

    /**
     * Funzione di debug per verificare stato reset system
     */
    debugResetSystem: function() {
        console.log('🔍 === DEBUG RESET SYSTEM ===');
        console.log(`📊 Modelli caricati: ${this.loadedModels.length}`);
        console.log(`📊 Posizioni iniziali salvate: ${this.initialModelPositions.size}`);
        console.log(`📊 Posizioni SCENARIO originali salvate: ${this.scenarioOriginalPositions.size}`);

        console.log('📋 Lista modelli caricati:');
        this.loadedModels.forEach((model, index) => {
            const hasInitialPos = this.initialModelPositions.has(model.uuid);
            const hasScenarioPos = this.scenarioOriginalPositions.has(model.uuid);
            console.log(`  ${index + 1}. ${model.name || model.uuid} - Tutorial pos: ${hasInitialPos ? '✅' : '❌'} - Scenario pos: ${hasScenarioPos ? '✅' : '❌'}`);

            if (hasInitialPos) {
                const initial = this.initialModelPositions.get(model.uuid);
                console.log(`     📝 Tutorial pos: (${initial.position.x.toFixed(3)}, ${initial.position.y.toFixed(3)}, ${initial.position.z.toFixed(3)})`);
            }

            if (hasScenarioPos) {
                const scenario = this.scenarioOriginalPositions.get(model.uuid);
                console.log(`     🏠 Scenario pos: (${scenario.position.x.toFixed(3)}, ${scenario.position.y.toFixed(3)}, ${scenario.position.z.toFixed(3)})`);
            }

            console.log(`     📍 Pos corrente: (${model.position.x.toFixed(3)}, ${model.position.y.toFixed(3)}, ${model.position.z.toFixed(3)})`);
        });

        console.log('🔍 === FINE DEBUG ===');
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

    /**
     * Ripristina un singolo modello alla posizione ORIGINALE dello scenario
     */
    resetModelToScenarioPosition: function(model) {
        if (!model || !model.uuid) return false;

        const scenarioState = this.scenarioOriginalPositions.get(model.uuid);
        if (!scenarioState) {
            console.warn(`⚠️ Nessuna posizione SCENARIO originale trovata per modello: ${model.name || model.uuid}`);
            return false;
        }

        // Ripristina rotazione e scala
        model.rotation.copy(scenarioState.rotation);
        model.scale.copy(scenarioState.scale);

        // Ripristina model.position utilizzando il valore originale dello scenario
        if (scenarioState.modelPosition) {
            model.position.copy(scenarioState.modelPosition);
        } else {
            // Fallback per compatibilità
            model.position.copy(scenarioState.position);
        }

        console.log(`🏠 Modello ripristinato SCENARIO: ${model.name || model.uuid} - Pos: (${model.position.x.toFixed(3)}, ${model.position.y.toFixed(3)}, ${model.position.z.toFixed(3)})`);
        return true;
    },

    advanceToNextTutorialStep: function() {
        if (!window.UI || !window.UI.tutorialSteps) {
            return;
        }

        const currentIndex = window.UI.currentStepIndex;
        const currentStep = window.UI.tutorialSteps[currentIndex];

        // IMPORTANTE: Se lo step corrente ha AutoExecute=true, l'avanzamento è gestito da UI.js
        // NON chiamare goToStep() qui per evitare doppio avanzamento che causa skip di step
        if (currentStep && currentStep.properties && currentStep.properties.AutoExecute === 'true') {
            console.log(`[Scene3D] 🤖 advanceToNextTutorialStep: Skip - step ha AutoExecute=true, avanzamento gestito da UI.js`);
            return;
        }

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
                this.removeCongratulationsModal();
                console.log('🎉 Congratulazioni chiuse - determinando prossima azione...');

                // NUOVO: Logica navigazione automatica al prossimo tutorial o home page
                this.navigateToNextTutorialOrHome(tutorialName);
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
     * Naviga al prossimo tutorial disponibile o torna alla home page
     * @param {string} currentTutorialName - Nome del tutorial appena completato
     */
    navigateToNextTutorialOrHome: function(currentTutorialName) {
        if (!window.UI || !window.UI.availableTutorials) {
            console.warn('⚠️ NAVIGAZIONE: UI o availableTutorials non disponibili - torno alla home');
            this.goToHomePage();
            return;
        }

        const tutorials = window.UI.availableTutorials;
        const currentIndex = tutorials.findIndex(tutorial => tutorial.name === currentTutorialName);

        console.log(`🧭 NAVIGAZIONE: Tutorial corrente "${currentTutorialName}" trovato all'indice: ${currentIndex}`);
        console.log(`📋 NAVIGAZIONE: Tutorial disponibili: [${tutorials.map(t => t.name).join(', ')}]`);

        if (currentIndex === -1) {
            console.warn(`⚠️ NAVIGAZIONE: Tutorial "${currentTutorialName}" non trovato nella lista - torno alla home`);
            this.goToHomePage();
            return;
        }

        const nextIndex = currentIndex + 1;
        if (nextIndex < tutorials.length) {
            // C'è un prossimo tutorial
            const nextTutorial = tutorials[nextIndex];
            console.log(`🎯 NAVIGAZIONE: Prossimo tutorial trovato: "${nextTutorial.name}" (indice: ${nextIndex})`);

            // Seleziona automaticamente il prossimo tutorial
            setTimeout(() => {
                if (window.UI && typeof window.UI.selectTutorial === 'function') {
                    console.log(`⏭️ NAVIGAZIONE: Selezione automatica tutorial "${nextTutorial.name}" (indice: ${nextIndex})...`);
                    window.UI.selectTutorial(nextIndex);
                } else {
                    console.warn('⚠️ NAVIGAZIONE: selectTutorial non disponibile - torno alla home');
                    this.goToHomePage();
                }
            }, 1000); // Delay per transizione smooth
        } else {
            // Non ci sono più tutorial - torna alla home page
            console.log('🏠 NAVIGAZIONE: Nessun tutorial successivo - torno alla home page');
            setTimeout(() => {
                this.goToHomePage();
            }, 1000); // Delay per transizione smooth
        }
    },

    /**
     * Torna alla home page
     */
    goToHomePage: function() {
        console.log('🏠 NAVIGAZIONE: Ritorno alla home page...');
        if (window.UI && typeof window.UI.goHome === 'function') {
            window.UI.goHome();
        } else {
            console.warn('⚠️ NAVIGAZIONE: goHome non disponibile');
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
     * Esporta i centri del bounding box di tutti i modelli caricati
     * Formato: Centro=nomeModello:(x,y,z)
     * Uso: Scene3D.exportBoundingBoxCenters()
     */
    exportBoundingBoxCenters: function() {
        console.log('📦 EXPORT: Inizio esportazione centri bounding box...');

        if (this.loadedModels.length === 0) {
            console.warn('⚠️ EXPORT: Nessun modello caricato nella scena');
            return null;
        }

        let exportLines = [];
        exportLines.push('# Centri Bounding Box Modelli - Esportati automaticamente');
        exportLines.push('# Generato il: ' + new Date().toLocaleString('it-IT'));
        exportLines.push('# Sintassi: Centro=nomeModello:(x,y,z)');
        exportLines.push('# Nota: Questi sono i centri geometrici dei bounding box, non i pivot points');
        exportLines.push('');

        // Esporta centro bounding box di ogni modello
        this.loadedModels.forEach((model, index) => {
            const modelName = this.getModelDisplayName(model);

            // Calcola bounding box e centro
            const boundingBox = new THREE.Box3().setFromObject(model);
            const center = boundingBox.getCenter(new THREE.Vector3());

            // Calcola dimensioni per riferimento
            const size = boundingBox.getSize(new THREE.Vector3());

            // Formatta con 3 decimali per precisione
            const centerStr = `(${center.x.toFixed(3)},${center.y.toFixed(3)},${center.z.toFixed(3)})`;
            const sizeStr = `(${size.x.toFixed(3)},${size.y.toFixed(3)},${size.z.toFixed(3)})`;

            // Aggiungi dati al file
            exportLines.push(`# Modello ${index + 1}: ${modelName}`);
            exportLines.push(`# Dimensioni: ${sizeStr}`);
            exportLines.push(`Centro=${modelName}:${centerStr}`);
            exportLines.push('');

            console.log(`📦 EXPORT: ${modelName} - Centro: ${centerStr}, Dimensioni: ${sizeStr}`);
        });

        // Genera contenuto finale
        const exportContent = exportLines.join('\n');

        console.log('📦 EXPORT: Centri bounding box generati:');
        console.log('═'.repeat(60));
        console.log(exportContent);
        console.log('═'.repeat(60));

        // Scarica come file
        this.downloadBoundingBoxCentersFile(exportContent);

        return exportContent;
    },

    /**
     * Scarica file con centri bounding box
     */
    downloadBoundingBoxCentersFile: function(content) {
        try {
            // Crea timestamp per nome file
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:\-]/g, '').replace('T', '_');
            const filename = `bounding_box_centers_${timestamp}.txt`;

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
            // Aggiorna animazioni TWEEN (richiesto per HoldableSystem e altre animazioni)
            if (typeof TWEEN !== 'undefined') {
                TWEEN.update();
            }

            this.updateAnimations();
            this.updateCameraAnimation();
            this.updatePivotAnimation();

            // Aggiorna sistema particellare se attivo
            if (this.particleSystem && this.particleSystem.isActive) {
                this.particleSystem.update(0.016); // ~60 FPS delta time
            }

            // Aggiorna sistema oggetti prendibili se attivo
            if (this.holdableSystem && this.holdableSystem.enabled) {
                this.holdableSystem.update();
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
                // DEBUG: Log speciale per viti_culatta
                if (modelName.includes('vite_culatta')) {
                    console.warn(`⚠️ RESET POSIZIONE RILEVATO per ${modelName}: da (${model.position.x.toFixed(2)}, ${model.position.y.toFixed(2)}, ${model.position.z.toFixed(2)}) a (${coords[0]}, ${coords[1]}, ${coords[2]})`);
                    console.trace('Stack trace per capire chi ha chiamato applyModelPosition');
                }
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
            opacity: 0.4,
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
    },

    /**
     * Trova un modello caricato per nome, con supporto per TargetChild
     * @param {string} targetName - Nome del modello da cercare
     * @param {string} childName - Nome opzionale del child da cercare dentro il modello (per TargetChild)
     * @returns {Object|null} - Il modello trovato o null
     */
    findModelByName: function(targetName, childName = null) {
        let foundModel = null;

        // Protezione contro targetName undefined/null
        if (!targetName || typeof targetName !== 'string') {
            console.warn(`[Scene3D] findModelByName chiamato con targetName non valido:`, targetName);
            return null;
        }

        // PRIORITÀ 1: Controlla target virtuali da SnapPoint globale (es: snap_point_0_original)
        if (this.virtualSnapTargets && this.virtualSnapTargets.has(targetName)) {
            const virtualTarget = this.virtualSnapTargets.get(targetName);
            console.log(`📍 SNAP VIRTUALE: Trovato target virtuale "${targetName}" a (${virtualTarget.position.x.toFixed(3)}, ${virtualTarget.position.y.toFixed(3)}, ${virtualTarget.position.z.toFixed(3)})`);
            return virtualTarget;
        }

        // PRIORITÀ 2: Gestione suffisso _original per posizioni iniziali modelli reali
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

        // ═══════════════════════════════════════════════════════════════════════
        // TARGETCHILD: Se specificato childName, cerca dentro il modello trovato
        // ═══════════════════════════════════════════════════════════════════════
        if (foundModel && childName) {
            let foundChild = null;
            const cleanChildName = childName.trim();

            console.log(`🔍 TARGETCHILD: Cercando child "${cleanChildName}" dentro "${foundModel.name}"`);

            foundModel.traverse(function(child) {
                if (!foundChild && child.name === cleanChildName) {
                    foundChild = child;
                    console.log(`✅ TARGETCHILD: Trovato child "${cleanChildName}" (tipo: ${child.type})`);
                }
            });

            if (foundChild) {
                // Salva riferimento al parent per home_config
                foundChild.userData.parentModel = foundModel;
                foundChild.userData.parentModelName = targetName;
                return foundChild;
            } else {
                console.warn(`⚠️ TARGETCHILD: Child "${cleanChildName}" non trovato in "${foundModel.name}"`);
                console.warn(`⚠️ TARGETCHILD: Child disponibili:`, this.listChildNames(foundModel));
                return foundModel; // Fallback al parent
            }
        }

        return foundModel;
    },

    /**
     * Lista i nomi dei child di un modello (per debug)
     * @param {Object} model - Il modello da analizzare
     * @param {number} maxDepth - Profondità massima della traversata
     * @returns {Array} - Lista nomi dei child
     */
    listChildNames: function(model, maxDepth = 3) {
        const names = [];
        const traverseWithDepth = (obj, depth) => {
            if (depth > maxDepth) return;
            obj.children.forEach(child => {
                names.push(child.name);
                traverseWithDepth(child, depth + 1);
            });
        };
        traverseWithDepth(model, 0);
        return names.slice(0, 20); // Limita a 20 per evitare log troppo lunghi
    },

    /**
     * Crea un riferimento virtuale alla posizione originale di un modello
     * @param {Object} model - Il modello di riferimento
     * @param {string} referenceName - Nome del riferimento
     * @returns {Object} - Oggetto virtuale con posizione originale
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
            name: referenceName,
            isOriginalReference: true,
            sourceModel: model
        };

        return originalReference;
    },

    /**
     * DEBUG: Testa sistema _original per verificare che le posizioni siano fisse
     */
    debugOriginalSystem: function() {
        console.log('\n🔍 === DEBUG SISTEMA _ORIGINAL ===');

        if (!this.initialModelPositions) {
            console.log('❌ initialModelPositions non inizializzato');
            return;
        }

        console.log(`📊 Posizioni iniziali salvate: ${this.initialModelPositions.size}`);

        // Test su alcuni oggetti chiave
        const testObjects = ['ingrassatore', 'filtro', 'tappino_grasso_dx', 'tappino_grasso_sx'];

        testObjects.forEach(objName => {
            console.log(`\n🧪 Test ${objName}:`);

            // Trova oggetto normale
            const normalObj = this.findModelByName(objName);
            if (!normalObj) {
                console.log(`  ❌ ${objName} non trovato`);
                return;
            }

            console.log(`  📍 Posizione attuale: (${normalObj.position.x.toFixed(3)}, ${normalObj.position.y.toFixed(3)}, ${normalObj.position.z.toFixed(3)})`);

            // Test riferimento _original
            const originalRef = this.findModelByName(objName + '_original');
            if (originalRef) {
                console.log(`  🎯 ${objName}_original: (${originalRef.position.x.toFixed(3)}, ${originalRef.position.y.toFixed(3)}, ${originalRef.position.z.toFixed(3)})`);
                console.log(`  ✅ Reference type: ${originalRef.isOriginalReference ? 'CORRETTO' : 'ERRATO'}`);

                // Verifica che sia dalla initialModelPositions
                const savedPos = this.initialModelPositions.get(normalObj.uuid);
                if (savedPos) {
                    const savedCenter = savedPos.position;
                    const refDistance = originalRef.position.distanceTo(savedCenter);
                    console.log(`  📏 Distanza da posizione salvata: ${refDistance.toFixed(6)} (dovrebbe essere ~0)`);

                    if (refDistance < 0.001) {
                        console.log(`  ✅ _original usa correttamente la posizione salvata`);
                    } else {
                        console.log(`  ❌ _original NON usa la posizione salvata!`);
                    }
                } else {
                    console.log(`  ❌ Nessuna posizione salvata per ${objName}`);
                }
            } else {
                console.log(`  ❌ ${objName}_original non trovato`);
            }
        });

        // Test stabilità - chiama _original due volte per vedere se cambia
        console.log('\n🔄 Test stabilità ingrassatore_original:');
        const ref1 = this.findModelByName('ingrassatore_original');
        const ref2 = this.findModelByName('ingrassatore_original');

        if (ref1 && ref2) {
            const distance = ref1.position.distanceTo(ref2.position);
            console.log(`  📏 Distanza tra due chiamate: ${distance.toFixed(6)}`);

            if (distance < 0.0001) {
                console.log(`  ✅ Posizione stabile tra chiamate multiple`);
            } else {
                console.log(`  ❌ Posizione INSTABILE tra chiamate! Bug trovato!`);
            }
        }

        console.log('\n=== FINE DEBUG SISTEMA _ORIGINAL ===\n');

        return {
            initialPositionsCount: this.initialModelPositions.size,
            systemWorking: this.initialModelPositions.size > 0
        };
    },

    // === SISTEMA DEBUG SILHOUETTE PER OGGETTI OCCLUSI ===
    addDebugSilhouette: function(targetObject, color = 0xff0000) {
        // Rimuovi silhouette esistenti
        this.removeDebugSilhouette(targetObject);

        if (!targetObject.geometry) return null;

        // Crea geometria wireframe
        const wireframe = new THREE.WireframeGeometry(targetObject.geometry);
        const material = new THREE.LineBasicMaterial({
            color: color,
            linewidth: 3,
            transparent: true,
            opacity: 1.0,
            depthTest: false // Mostra sempre sopra tutto
        });
        const silhouette = new THREE.LineSegments(wireframe, material);

        // Copia posizione e rotazione
        silhouette.position.copy(targetObject.position);
        silhouette.rotation.copy(targetObject.rotation);
        silhouette.scale.copy(targetObject.scale);

        // Marca come silhouette debug
        silhouette.userData.isDebugSilhouette = true;
        silhouette.userData.originalObject = targetObject;
        silhouette.name = `debug_silhouette_${targetObject.name}`;

        this.scene.add(silhouette);
        console.log(`🔴 Silhouette debug aggiunta per ${targetObject.name}`);

        return silhouette;
    },

    removeDebugSilhouette: function(targetObject) {
        const toRemove = [];
        this.scene.traverse((child) => {
            if (child.userData?.isDebugSilhouette && child.userData?.originalObject === targetObject) {
                toRemove.push(child);
            }
        });
        toRemove.forEach(silhouette => {
            this.scene.remove(silhouette);
            console.log(`❌ Silhouette debug rimossa per ${targetObject.name}`);
        });
    },

    // Debug command per oggetti nascosti
    debugHiddenObjects: function() {
        console.log('🔍 Cercando oggetti potenzialmente nascosti...');
        let foundCount = 0;

        this.scene.traverse((child) => {
            // Cerca sia Group che Mesh con "vite_culatta" nel nome
            if (child.visible && child.name && child.name.includes('vite_culatta')) {
                console.log(`🔴 Trovato ${child.type}: ${child.name} (posizione: ${child.position.x.toFixed(2)}, ${child.position.y.toFixed(2)}, ${child.position.z.toFixed(2)})`);

                // Se è un Group, attraversa i children per trovare le mesh
                if (child.isGroup) {
                    child.traverse((subChild) => {
                        if (subChild.isMesh && subChild.geometry) {
                            console.log(`  🔴 Aggiunta silhouette per mesh interna: ${subChild.name || 'unnamed'}`);
                            this.addDebugSilhouette(subChild, 0xff0000);
                            foundCount++;
                        }
                    });
                } else if (child.isMesh && child.geometry) {
                    console.log(`  🔴 Aggiunta silhouette per mesh: ${child.name}`);
                    this.addDebugSilhouette(child, 0xff0000);
                    foundCount++;
                }
            }
        });

        console.log(`✅ Silhouettes create: ${foundCount}`);
    }
};

// Esponi Scene3D globalmente
window.Scene3D = Scene3D;

// ═══════════════════════════════════════════════════════════════════════════
// COMANDI CONSOLE HELPER PER DEBUG TARGETCHILD
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Lista tutti i child disponibili in un modello GLB
 * Utile per trovare i nomi corretti da usare con TargetChild
 *
 * @param {string} modelName - Nome del modello GLB (es: 'a500', 'models/a500.glb')
 * @returns {Array} - Lista dei nomi dei child
 *
 * @example
 * Scene3D.listChildNames('a500')
 * // Output: ['Basamento', 'Basamento_Portale', 'Basamento_Portale_CarroY', ...]
 */
Scene3D.listChildNames = function(modelNameOrObject, maxDepth = 10) {
    let model = modelNameOrObject;

    // Se è una stringa, cerca il modello
    if (typeof modelNameOrObject === 'string') {
        model = Scene3D.findModelByName(modelNameOrObject);
        if (!model) {
            console.error(`❌ Modello "${modelNameOrObject}" non trovato`);
            console.log('💡 Usa Scene3D.listAvailableObjects() per vedere i modelli disponibili');
            return [];
        }
    }

    console.log(`\n📋 Children disponibili in "${model.name}" (max depth: ${maxDepth}):\n`);

    const names = [];
    const traverseWithDepth = (obj, depth, prefix = '') => {
        if (depth > maxDepth) return;

        obj.children.forEach((child, index) => {
            const indent = '  '.repeat(depth);
            const isLast = index === obj.children.length - 1;
            const connector = isLast ? '└─' : '├─';
            const childType = child.type || 'Object3D';
            const displayName = child.name || '<unnamed>';

            console.log(`${indent}${connector} ${displayName} (${childType})`);
            names.push({
                name: displayName,
                type: childType,
                depth: depth,
                path: prefix ? `${prefix}/${displayName}` : displayName
            });

            if (child.children.length > 0) {
                traverseWithDepth(child, depth + 1, prefix ? `${prefix}/${displayName}` : displayName);
            }
        });
    };

    traverseWithDepth(model, 0);

    console.log(`\n✅ Totale: ${names.length} child trovati\n`);
    console.log('💡 Usa questi nomi con TargetChild nel tutorial.txt');
    console.log('💡 Esempio: TargetChild=Basamento_Portale_CarroY\n');

    return names;
};

/**
 * Cerca un child per nome all'interno di un modello
 * Utile per verificare se un nome TargetChild esiste prima di usarlo
 *
 * @param {string} parentModelName - Nome del modello parent (es: 'a500')
 * @param {string} childName - Nome del child da cercare (es: 'Basamento_Portale')
 * @returns {Object|null} - Il child trovato o null
 *
 * @example
 * Scene3D.findChild('a500', 'Basamento_Portale_CarroY')
 * // Output: Object3D { name: 'Basamento_Portale_CarroY', type: 'Group', ... }
 */
Scene3D.findChild = function(parentModelName, childName) {
    const parentModel = Scene3D.findModelByName(parentModelName);

    if (!parentModel) {
        console.error(`❌ Modello parent "${parentModelName}" non trovato`);
        return null;
    }

    const child = Scene3D.findModelByName(parentModelName, childName);

    if (child && child !== parentModel) {
        console.log(`✅ Child trovato: "${childName}"`);
        console.log(`   Tipo: ${child.type}`);
        console.log(`   Posizione: (${child.position.x.toFixed(3)}, ${child.position.y.toFixed(3)}, ${child.position.z.toFixed(3)})`);
        console.log(`   Rotazione: (${child.rotation.x.toFixed(3)}, ${child.rotation.y.toFixed(3)}, ${child.rotation.z.toFixed(3)})`);
        console.log(`\n💡 Usa nel tutorial.txt:`);
        console.log(`   Elemento=models/${parentModelName}.glb`);
        console.log(`   TargetChild=${childName}`);
        return child;
    } else {
        console.error(`❌ Child "${childName}" non trovato in "${parentModelName}"`);
        console.log(`\n💡 Usa Scene3D.listChildNames('${parentModelName}') per vedere i child disponibili`);
        return null;
    }
};

/**
 * Shortcut per listare i child del modello a500
 *
 * @example
 * Scene3D.listA500Children()
 */
Scene3D.listA500Children = function() {
    return Scene3D.listChildNames('a500', 10);
};

/**
 * TEST: Anima manualmente un child per verificare che funzioni
 * Utile per debug quando un TargetChild non si muove nel tutorial
 *
 * @param {string} parentModelName - Nome del modello parent (es: 'a500')
 * @param {string} childName - Nome del child da animare
 * @param {number} x - Traslazione X (default: 0)
 * @param {number} y - Traslazione Y (default: 0)
 * @param {number} z - Traslazione Z (default: 0)
 * @param {number} duration - Durata animazione in secondi (default: 1.0)
 *
 * @example
 * Scene3D.testMoveChild('a500', 'Basamento_Portale', 0, 0, -1, 1.5)
 */
Scene3D.testMoveChild = function(parentModelName, childName, x = 0, y = 0.1, z = 0, duration = 1.0) {
    console.log(`\n🧪 TEST MOVE CHILD: Avvio test animazione child...`);
    console.log(`   Parent: "${parentModelName}"`);
    console.log(`   Child: "${childName}"`);
    console.log(`   Traslazione: (${x}, ${y}, ${z})`);
    console.log(`   Durata: ${duration}s\n`);

    // Trova il parent model
    const parentModel = Scene3D.findModelByName(parentModelName);
    if (!parentModel) {
        console.error(`❌ Modello parent "${parentModelName}" non trovato`);
        return false;
    }

    console.log(`✅ Parent trovato: "${parentModel.name}"`);

    // Trova il child usando findModelByName con parametro childName
    const child = Scene3D.findModelByName(parentModelName, childName);

    if (!child || child === parentModel) {
        console.error(`❌ Child "${childName}" non trovato in "${parentModelName}"`);
        console.log(`\n💡 Usa Scene3D.listChildNames('${parentModelName}') per vedere i child disponibili`);
        return false;
    }

    console.log(`✅ Child trovato: "${child.name}" (type: ${child.type})`);
    console.log(`   Posizione iniziale: (${child.position.x.toFixed(3)}, ${child.position.y.toFixed(3)}, ${child.position.z.toFixed(3)})`);
    console.log(`   matrixAutoUpdate: ${child.matrixAutoUpdate}`);

    // Assicura che matrixAutoUpdate sia true
    console.log(`\n🔧 Forzando matrixAutoUpdate su child e parent chain...`);
    child.matrixAutoUpdate = true;
    let parent = child.parent;
    let chainLength = 0;
    while (parent) {
        parent.matrixAutoUpdate = true;
        parent.updateMatrix();
        parent = parent.parent;
        chainLength++;
    }
    console.log(`✅ Parent chain aggiornata (${chainLength} livelli)`);

    // Crea step per l'animazione (IMPORTANTE: usa 'traslazione' non 'translation')
    const movementSteps = [{
        action: 'traslazione',
        traslazione: {  // ← FIX: era 'translation', deve essere 'traslazione'
            x: x,
            y: y,
            z: z
        },
        durata: duration,  // ← FIX: era 'duration', deve essere 'durata'
        isRelativeToOriginal: false
    }];

    console.log(`\n🎬 Avvio animazione...`);

    // Usa MultiStepAnimationSystem per animare
    if (!window.MultiStepAnimationSystem) {
        console.error(`❌ MultiStepAnimationSystem non disponibile`);
        return false;
    }

    const result = window.MultiStepAnimationSystem.startMultiStepMovement(child, movementSteps, [], []);

    if (result) {
        console.log(`✅ Animazione avviata con successo!`);
        console.log(`   Guarda il viewport per verificare il movimento.`);
        console.log(`   Posizione finale attesa: (${(child.position.x + x).toFixed(3)}, ${(child.position.y + y).toFixed(3)}, ${(child.position.z + z).toFixed(3)})`);

        // Log posizione dopo 100ms
        setTimeout(() => {
            console.log(`📊 Posizione dopo 100ms: (${child.position.x.toFixed(3)}, ${child.position.y.toFixed(3)}, ${child.position.z.toFixed(3)})`);
        }, 100);

        // Log posizione finale
        setTimeout(() => {
            console.log(`📊 Posizione finale: (${child.position.x.toFixed(3)}, ${child.position.y.toFixed(3)}, ${child.position.z.toFixed(3)})`);
            const moved = Math.abs(child.position.x - (child.position.x + x)) > 0.001 ||
                         Math.abs(child.position.y - (child.position.y + y)) > 0.001 ||
                         Math.abs(child.position.z - (child.position.z + z)) > 0.001;
            if (moved) {
                console.log(`✅ IL CHILD SI È MOSSO!`);
            } else {
                console.log(`❌ IL CHILD NON SI È MOSSO - Potrebbe essere un problema di coordinate locali/world`);
            }
        }, (duration * 1000) + 200);

        return true;
    } else {
        console.error(`❌ Animazione non avviata`);
        return false;
    }
};

console.log(`
🔧 COMANDI DEBUG TARGETCHILD DISPONIBILI:
══════════════════════════════════════════════════════════════
  Scene3D.listChildNames('a500')                → Lista child del GLB
  Scene3D.findChild('a500', 'CarroY')           → Trova child specifico
  Scene3D.listA500Children()                    → Shortcut per a500
  Scene3D.testMoveChild('a500', 'child', x,y,z) → TEST animazione child
══════════════════════════════════════════════════════════════
💡 Esempio test:
  Scene3D.testMoveChild('a500', 'Basamento_Portale', 0, 0, -1, 1.5)
`);

window.addEventListener('resize', function() {
    if (window.Scene3D && window.Scene3D.onWindowResize) {
        window.Scene3D.onWindowResize();
    }
});