/**
 * SCENE3D CORE MODULE
 * VERSION: 1000010 - Modular Architecture
 * 
 * Core Scene3D functionality - manages the main 3D scene, renderer, lights and coordinates other modules.
 * This is the main orchestrator that initializes and manages all subsystems.
 */

import { CameraControls } from './CameraControls.js';
import { ModelManager } from './ModelManager.js';
import { AnimationSystem } from './AnimationSystem.js';
import { HighlightSystem } from './HighlightSystem.js';

console.log('🚀🚀🚀 SCENE3D CORE MODULE VERSION 1000010 LOADED - MODULAR ARCHITECTURE! 🚀🚀🚀');

export class Scene3DCore {
    constructor() {
        // Core Three.js objects
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.canvas = null;
        
        // Subsystems
        this.cameraControls = null;
        this.modelManager = null;
        this.animationSystem = null;
        this.highlightSystem = null;
        
        // State
        this.isInitialized = false;
        this.manualCameraSet = false;
        this.savedView = null;
        
        // Raycaster for click detection
        this.raycaster = null;
        this.mouse = null;
    }

    /**
     * Initialize the complete 3D scene
     */
    init() {
        AppConfig.log(2, 'Initializing 3D scene with modular architecture...');
        
        try {
            // Verify Three.js is loaded
            if (typeof THREE === 'undefined') {
                throw new Error('Three.js not loaded correctly');
            }
            
            // Get canvas reference
            this.canvas = document.getElementById('canvas3d');
            if (!this.canvas) {
                throw new Error('3D Canvas not found in DOM');
            }
            
            // Initialize core components
            this.initScene();
            this.initCamera();
            this.initRenderer();
            this.initLights();
            this.initRaycaster();
            
            // Initialize subsystems
            this.initSubsystems();
            
            // Start render loop
            this.startRenderLoop();
            
            // Save initial view
            this.saveCurrentView();
            
            this.isInitialized = true;
            AppConfig.log(2, 'Modular 3D scene initialized successfully');
            
        } catch (error) {
            AppConfig.log(0, 'Error during 3D scene initialization:', error);
            throw error;
        }
    }

    /**
     * Create base 3D scene
     */
    initScene() {
        this.scene = new THREE.Scene();
        
        // Set transparent background (CSS gradient will be visible)
        this.scene.background = null;
        
        AppConfig.log(3, 'Base scene created');
    }

    /**
     * Configure perspective camera
     */
    initCamera() {
        const config = AppConfig.scene3D.camera;
        const aspect = window.innerWidth / window.innerHeight;
        
        // Create perspective camera
        this.camera = new THREE.PerspectiveCamera(
            config.fov,
            aspect,
            config.near,
            config.far
        );
        
        // Set initial position
        this.camera.position.set(
            config.initialPosition.x,
            config.initialPosition.y,
            config.initialPosition.z
        );
        
        // Camera looks at origin
        this.camera.lookAt(0, 0, 0);
        
        AppConfig.log(3, 'Camera configured', {
            fov: config.fov,
            aspect: aspect,
            position: this.camera.position
        });
    }

    /**
     * Configure WebGL renderer
     */
    initRenderer() {
        const config = AppConfig.scene3D.renderer;
        
        // Create WebGL renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: config.antialias,
            alpha: config.alpha
        });
        
        // Set size
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        // Set pixel ratio for high density displays
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        // Configure shadows if enabled
        if (config.shadowMapEnabled) {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE[config.shadowMapType + 'ShadowMap'];
        }
        
        // Set tone mapping for realistic colors
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 2.8;
        
        AppConfig.log(3, 'Renderer configured', {
            size: { width: window.innerWidth, height: window.innerHeight },
            pixelRatio: window.devicePixelRatio
        });
    }

    /**
     * Add lights to scene
     */
    initLights() {
        const ambientConfig = AppConfig.scene3D.lighting.ambient;
        const directionalConfig = AppConfig.scene3D.lighting.directional;
        
        // Ambient light (illuminates everything uniformly)
        const ambientLight = new THREE.AmbientLight(
            ambientConfig.color,
            ambientConfig.intensity
        );
        this.scene.add(ambientLight);
        
        // Directional light (simulates sun)
        const directionalLight = new THREE.DirectionalLight(
            directionalConfig.color,
            directionalConfig.intensity
        );
        
        // Position the light
        directionalLight.position.set(
            directionalConfig.position.x,
            directionalConfig.position.y,
            directionalConfig.position.z
        );
        
        // Configure shadows for directional light
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        
        this.scene.add(directionalLight);
        
        // Back directional light
        const backLight = new THREE.DirectionalLight(0xffffff, 0.4);
        backLight.position.set(
            -directionalConfig.position.x,
            directionalConfig.position.y,
            -directionalConfig.position.z
        );
        backLight.castShadow = false;
        this.scene.add(backLight);
        
        AppConfig.log(3, 'Lights added to scene (front + back)');
    }

    /**
     * Initialize raycaster for click detection on models
     */
    initRaycaster() {
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        AppConfig.log(3, 'Raycaster initialized for model click detection');
    }

    /**
     * Initialize all subsystems with proper dependencies
     */
    initSubsystems() {
        // Initialize camera controls
        this.cameraControls = new CameraControls(this.canvas, this.camera);
        
        // Initialize model manager
        this.modelManager = new ModelManager(this.scene);
        
        // Initialize highlight system
        this.highlightSystem = new HighlightSystem();
        
        // Initialize animation system (needs other systems)
        this.animationSystem = new AnimationSystem(
            this.modelManager,
            this.highlightSystem
        );
        
        // Set up cross-system dependencies
        this.cameraControls.setClickHandler(this.handleModelClick.bind(this));
        this.cameraControls.setPivotClickHandler(this.handlePivotClick.bind(this));
        
        AppConfig.log(3, 'All subsystems initialized with dependencies');
    }

    /**
     * Handle model click events
     */
    handleModelClick(event) {
        // Calculate normalized mouse position
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Update raycaster
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Find intersections with models
        const intersects = this.raycaster.intersectObjects(this.modelManager.loadedModels, true);
        
        if (intersects.length > 0) {
            const clickedObject = intersects[0].object;
            
            // Find root model containing this object
            const targetModel = this.modelManager.findRootModel(clickedObject);
            
            if (targetModel) {
                // Check if model is selectable
                if (!this.modelManager.isModelSelectable(targetModel)) {
                    AppConfig.log(2, `🚫 Click ignored: non-selectable model "${targetModel.userData?.originalFilename || targetModel.name}"`);
                    return;
                }
                
                AppConfig.log(2, `🖱️ Click on model:`, targetModel.userData?.originalFilename || targetModel.name);
                this.animationSystem.handleModelAction(targetModel);
            }
        }
    }

    /**
     * Handle pivot click events (middle mouse button)
     */
    handlePivotClick(event) {
        // Calculate normalized mouse position
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Update raycaster
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Find intersections with all scene objects
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        
        if (intersects.length > 0) {
            const intersection = intersects[0];
            const targetModel = this.modelManager.findRootModel(intersection.object);
            
            if (targetModel) {
                // Check if model is selectable for pivot
                if (!this.modelManager.isModelSelectable(targetModel)) {
                    const modelName = targetModel.userData?.originalFilename || targetModel.name;
                    AppConfig.log(2, `🚫 Pivot ignored on non-selectable element: ${modelName}`);
                    return;
                }
                
                // Calculate model center
                const box = new THREE.Box3().setFromObject(targetModel);
                const center = box.getCenter(new THREE.Vector3());
                
                // Update pivot point
                this.cameraControls.setPivotPoint(center);
                
                AppConfig.log(2, `🎯 Pivot changed to: ${targetModel.userData?.originalFilename || targetModel.name}`);
            } else {
                // Click on empty point - use intersection point
                this.cameraControls.setPivotPoint(intersection.point);
                AppConfig.log(2, `🎯 Pivot changed to point: (${intersection.point.x.toFixed(3)}, ${intersection.point.y.toFixed(3)}, ${intersection.point.z.toFixed(3)})`);
            }
        }
    }

    /**
     * Save current view
     */
    saveCurrentView() {
        this.savedView = {
            position: this.camera.position.clone(),
            rotation: this.camera.rotation.clone(),
            zoom: this.camera.zoom
        };
        
        this.cameraControls.initializeInterpolationTargets(this.camera.position);
        
        AppConfig.log(3, 'Current view saved and interpolation targets initialized');
    }

    /**
     * Restore saved view
     */
    restoreView() {
        if (this.savedView) {
            this.camera.position.copy(this.savedView.position);
            this.camera.rotation.copy(this.savedView.rotation);
            this.camera.zoom = this.savedView.zoom;
            this.camera.updateProjectionMatrix();
            
            this.cameraControls.updateInterpolationTargets(this.camera.position);
            
            AppConfig.log(3, 'View restored and interpolation targets updated');
        }
    }

    /**
     * Start render loop
     */
    startRenderLoop() {
        const animate = () => {
            requestAnimationFrame(animate);
            this.render();
        };
        
        animate();
        AppConfig.log(3, 'Render loop started');
    }

    /**
     * Render scene
     */
    render() {
        if (this.scene && this.camera && this.renderer) {
            // Update camera interpolations
            this.cameraControls.updateInterpolation();
            
            // Update animations
            this.animationSystem.updateAnimations();
            
            // Render scene
            this.renderer.render(this.scene, this.camera);
        }
    }

    /**
     * Handle window resize
     */
    onWindowResize() {
        if (!this.camera || !this.renderer) {
            console.warn('⚠️ Scene3D not yet initialized, ignoring resize');
            return;
        }
        
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // Update camera
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        // Update renderer
        this.renderer.setSize(width, height);
        
        AppConfig.log(3, 'Dimensions updated', { width, height });
    }

    // Public API methods for external access
    addModel(model, modelConfig = null) {
        return this.modelManager.addModel(model, modelConfig);
    }

    clearAllModels() {
        return this.modelManager.clearAllModels();
    }

    highlightCurrentTutorialElement() {
        return this.highlightSystem.highlightCurrentTutorialElement(this.modelManager.loadedModels);
    }

    startModelAnimation(model, tutorialStep) {
        return this.animationSystem.startModelAnimation(model, tutorialStep);
    }

    markStepAsCompleted(stepIndex) {
        return this.animationSystem.markStepAsCompleted(stepIndex);
    }

    resetTutorialTracker() {
        return this.animationSystem.resetTutorialTracker();
    }

    // Getters for accessing subsystems
    get loadedModels() {
        return this.modelManager.loadedModels;
    }

    get currentModel() {
        return this.modelManager.currentModel;
    }

    get isHighlighting() {
        return this.highlightSystem.isHighlighting;
    }
}

// Create global instance
window.Scene3D = new Scene3DCore();

// Add window resize listener
window.addEventListener('resize', function() {
    if (window.Scene3D && window.Scene3D.onWindowResize) {
        window.Scene3D.onWindowResize();
    }
});