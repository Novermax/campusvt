/**
 * SCENE3D MODULAR LOADER
 * VERSION: 1000010 - Modular Architecture Compatibility Layer
 */

window.Scene3D = {
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
        lastStepCompleted: false
    },
    
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
        pivotPoint: new THREE.Vector3(0, 0, 0),
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
            
        } catch (error) {
            throw error;
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

    initAxisGizmo: function() {
        const axisLength = 1.0;
        const arrowHeadSize = 0.15;
        const lineWidth = 0.03;
        
        this.axisGizmo = new THREE.Group();
        
        const colors = {
            x: 0xff0000,
            y: 0x00ff00,
            z: 0x0000ff
        };
        
        Object.keys(colors).forEach((axis, index) => {
            const direction = new THREE.Vector3();
            direction.setComponent(index, 1);
            
            const shaftGeometry = new THREE.CylinderGeometry(
                lineWidth, lineWidth, axisLength - arrowHeadSize, 8
            );
            const shaftMaterial = new THREE.MeshBasicMaterial({ 
                color: colors[axis],
                transparent: false,
                opacity: 1.0,
                side: THREE.DoubleSide
            });
            const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
            
            const headGeometry = new THREE.ConeGeometry(arrowHeadSize, arrowHeadSize * 2, 8);
            const headMaterial = new THREE.MeshBasicMaterial({ 
                color: colors[axis],
                transparent: false,
                opacity: 1.0,
                side: THREE.DoubleSide
            });
            const head = new THREE.Mesh(headGeometry, headMaterial);
            
            if (axis === 'x') {
                shaft.rotation.z = -Math.PI / 2;
                shaft.position.x = axisLength / 2 - arrowHeadSize / 2;
                head.rotation.z = -Math.PI / 2;
                head.position.x = axisLength - arrowHeadSize;
            } else if (axis === 'y') {
                shaft.position.y = axisLength / 2 - arrowHeadSize / 2;
                head.position.y = axisLength - arrowHeadSize;
            } else if (axis === 'z') {
                shaft.rotation.x = Math.PI / 2;
                shaft.position.z = axisLength / 2 - arrowHeadSize / 2;
                head.rotation.x = Math.PI / 2;
                head.position.z = axisLength - arrowHeadSize;
            }
            
            this.axisGizmo.add(shaft);
            this.axisGizmo.add(head);
        });
        
        this.axisGizmo.position.set(2.0, 0, 0);
        this.axisGizmo.scale.setScalar(1.5);
        
        this.scene.add(this.axisGizmo);
    },

    toggleAxisGizmo: function(visible = null) {
        if (!this.axisGizmo) return;
        
        if (visible === null) {
            this.axisGizmo.visible = !this.axisGizmo.visible;
        } else {
            this.axisGizmo.visible = visible;
        }
    },

    removeAxisGizmo: function() {
        if (this.axisGizmo) {
            this.scene.remove(this.axisGizmo);
            this.axisGizmo = null;
        }
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
        this.camera.lookAt(pivotPoint);
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
        this.camera.lookAt(pivotPoint);
    },

    addModel: function(model, modelConfig = null) {
        if (!model) {
            return;
        }
        
        this.scene.add(model);
        this.loadedModels.push(model);
        this.currentModel = model;
        
        const modelFilename = model.userData?.originalFilename || model.name;
        
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
        
        if (this.highlightSystem.isHighlighting) {
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
        const currentStep = this.getCurrentTutorialStep();
        if (!currentStep || !currentStep.properties.Elemento) {
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
            this.highlightModel(targetModel);
        }
    },

    handleModelClick: function(event) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.loadedModels, true);
        
        if (intersects.length > 0) {
            const clickedObject = intersects[0].object;
            const targetModel = this.findRootModel(clickedObject);
            
            if (targetModel && this.isModelSelectable(targetModel)) {
                this.handleModelAction(targetModel);
            }
        }
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
            
            if (targetModel && this.isModelSelectable(targetModel)) {
                const box = new THREE.Box3().setFromObject(targetModel);
                const center = box.getCenter(new THREE.Vector3());
                this.mouseControls.pivotPoint.copy(center);
            } else {
                this.mouseControls.pivotPoint.copy(intersection.point);
            }
        }
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
                offsetValues = [0, 0, 0, 1.0];
            }
            
            return {
                x: offsetValues[0],
                y: offsetValues[1],
                z: offsetValues[2], 
                durata: offsetValues[3],
                targetElement: targetElement
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
                    const targetBoundingBoxCenter = this.calculateBoundingBoxCenter(targetModel);
                    const sourceBoundingBoxCenter = this.calculateBoundingBoxCenter(model);
                    const centerOffset = targetBoundingBoxCenter.clone().sub(sourceBoundingBoxCenter);
                    
                    const additionalOffset = new THREE.Vector3(
                        currentStep.traslazione.x,
                        currentStep.traslazione.y,
                        currentStep.traslazione.z
                    );
                    
                    targetPosition = model.position.clone().add(centerOffset).add(additionalOffset);
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
        
        const cleanTargetName = targetName.split('/').pop().replace('.glb', '');
        
        this.scene.traverse(function(child) {
            if (child.isMesh || child.isGroup || child.isObject3D) {
                const modelName = (child.userData?.originalFilename || child.name || '').split('/').pop().replace('.glb', '');
                if (modelName === cleanTargetName) {
                    foundModel = child;
                    return;
                }
            }
        });
        
        return foundModel;
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
                'Martello': 'martello'
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
        }
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
                this.mouseControls.pivotPoint.copy(targetTarget);
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

    onWindowResize: function() {
        if (!this.camera || !this.renderer) {
            return;
        }
        
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
};

window.addEventListener('resize', function() {
    if (window.Scene3D && window.Scene3D.onWindowResize) {
        window.Scene3D.onWindowResize();
    }
});