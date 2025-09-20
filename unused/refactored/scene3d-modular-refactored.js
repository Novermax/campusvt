/**
 * Scene3D Modular Refactored - Coordinatore principale
 * VERSION: 2.0 Refactored Architecture
 *
 * Questo file mantiene tutte le API pubbliche del sistema Scene3D originale
 * ma delega le responsabilità ai moduli specializzati:
 * - Scene3DCore: Gestione core, modelli, highlighting, tutorial tracking
 * - CameraManager: Controlli camera, animazioni, interazioni mouse
 * - RenderManager: Rendering, scene, luci, effetti visivi
 *
 * COMPATIBILITÀ: 100% backward compatible con il codice esistente
 */

// Import dei moduli refactorizzati (quando saranno disponibili come ES modules)
// import Scene3DCore from './refactored/Scene3DCore.js';
// import CameraManager from './refactored/CameraManager.js';
// import RenderManager from './refactored/RenderManager.js';

const Scene3D = {
    // === CORE COMPONENTS ===
    core: null,
    cameraManager: null,
    renderManager: null,

    // === LEGACY PROPERTIES FOR COMPATIBILITY ===
    // These properties delegate to the appropriate managers
    get scene() { return this.core?.scene || null; },
    get camera() { return this.core?.camera || null; },
    get renderer() { return this.core?.renderer || null; },
    get canvas() { return this.core?.canvas || null; },
    get raycaster() { return this.core?.raycaster || null; },
    get mouse() { return this.core?.mouse || null; },
    get loadedModels() { return this.core?.loadedModels || []; },
    get currentModel() { return this.core?.currentModel || null; },
    get isInitialized() { return this.core?.isInitialized || false; },
    get mouseControls() { return this.cameraManager?.mouseControls || {}; },

    // Legacy state properties
    manualCameraSet: false,
    savedView: null,

    // Animation and highlight systems (delegated)
    get animationSystem() {
        // Return a wrapper that maintains API compatibility
        return {
            activeAnimations: window.Scene3D_Original?.animationSystem?.activeAnimations || [],
            modelDirections: window.Scene3D_Original?.animationSystem?.modelDirections || {},
            clickEnabled: window.Scene3D_Original?.animationSystem?.clickEnabled || true,
            multiStepAnimations: window.Scene3D_Original?.animationSystem?.multiStepAnimations || new Map()
        };
    },

    get highlightSystem() {
        return this.core?.highlightSystem || {
            highlightedModel: null,
            originalMaterials: new Map(),
            highlightMaterial: null,
            highlightTimer: null,
            isHighlighting: false
        };
    },

    get tutorialTracker() {
        return this.core?.tutorialTracker || {
            completedSteps: new Set(),
            lastStepCompleted: false,
            interactionsBlocked: false
        };
    },

    // === INITIALIZATION ===

    /**
     * Initialize the Scene3D system
     */
    init: function() {
        try {
            console.log('[Scene3D] 🚀 Inizializzazione sistema refactorizzato...');

            // Initialize core components
            this.initializeModules();

            // Initialize systems in order
            if (!this.renderManager.init()) {
                throw new Error('RenderManager initialization failed');
            }

            if (!this.core.init()) {
                throw new Error('Scene3DCore initialization failed');
            }

            // Initialize camera controls
            this.cameraManager.initControls();

            // Set up event listeners
            this.setupEventListeners();

            // Start render loop
            this.renderManager.startRenderLoop();

            // Save initial view
            this.cameraManager.saveCurrentView();

            console.log('[Scene3D] ✅ Sistema refactorizzato inizializzato con successo');
            return true;

        } catch (error) {
            console.error('[Scene3D] ❌ Errore inizializzazione sistema refactorizzato:', error.message);
            return false;
        }
    },

    /**
     * Initialize the specialized modules
     */
    initializeModules: function() {
        // Create instances of the specialized managers
        if (window.Scene3DCore_v2) {
            this.core = new window.Scene3DCore_v2();
        } else {
            throw new Error('Scene3DCore_v2 not available');
        }

        if (window.CameraManager) {
            this.cameraManager = new window.CameraManager(this.core);
        } else {
            throw new Error('CameraManager not available');
        }

        if (window.RenderManager) {
            this.renderManager = new window.RenderManager(this.core);
        } else {
            throw new Error('RenderManager not available');
        }

        // Cross-reference managers
        this.core.cameraManager = this.cameraManager;
        this.core.renderManager = this.renderManager;

        console.log('[Scene3D] 📦 Moduli specializzati inizializzati');
    },

    /**
     * Setup global event listeners
     */
    setupEventListeners: function() {
        // Window resize
        window.addEventListener('resize', () => {
            this.onWindowResize();
        });

        console.log('[Scene3D] 👂 Event listeners configurati');
    },

    // === CORE API METHODS (DELEGATED) ===

    /**
     * Add model to scene
     */
    addModel: function(model, modelConfig = null) {
        return this.core.addModel(model, modelConfig);
    },

    /**
     * Clear all models from scene
     */
    clearAllModels: function() {
        return this.core.clearAllModels();
    },

    /**
     * Highlight a model
     */
    highlightModel: function(model, duration = null) {
        return this.core.highlightModel(model, duration);
    },

    /**
     * Remove highlight from model
     */
    removeHighlight: function() {
        return this.core.removeHighlight();
    },

    /**
     * Highlight current tutorial element
     */
    highlightCurrentTutorialElement: function() {
        return this.core.highlightCurrentTutorialElement();
    },

    /**
     * Find model by name
     */
    findModelByName: function(targetName) {
        return this.core.findModelByName(targetName);
    },

    /**
     * Check if model is selectable
     */
    isModelSelectable: function(model) {
        return this.core.isModelSelectable(model);
    },

    /**
     * Calculate bounding box center
     */
    calculateBoundingBoxCenter: function(model) {
        return this.core.calculateBoundingBoxCenter(model);
    },

    /**
     * Save initial model position
     */
    saveInitialModelPosition: function(model) {
        return this.core.saveInitialModelPosition(model);
    },

    /**
     * Reset all models to initial positions
     */
    resetAllModelsToInitialPositions: function(tutorialStep = null) {
        return this.core.resetAllModelsToInitialPositions(tutorialStep);
    },

    /**
     * Reset model to initial position
     */
    resetModelToInitialPosition: function(model) {
        return this.core.resetModelToInitialPosition(model);
    },

    /**
     * Mark tutorial step as completed
     */
    markStepAsCompleted: function(stepIndex) {
        return this.core.markStepAsCompleted(stepIndex);
    },

    /**
     * Reset tutorial tracker
     */
    resetTutorialTracker: function() {
        return this.core.resetTutorialTracker();
    },

    /**
     * Show tutorial completion congratulations
     */
    showTutorialCompletionCongratulations: function() {
        return this.core.showTutorialCompletionCongratulations();
    },

    /**
     * Get current user name
     */
    getCurrentUserName: function() {
        return this.core.getCurrentUserName();
    },

    /**
     * Display congratulations modal
     */
    displayCongratulationsModal: function(userName, tutorialName) {
        return this.core.displayCongratulationsModal(userName, tutorialName);
    },

    /**
     * Export current model positions
     */
    exportCurrentModelPositions: function() {
        return this.core.exportCurrentModelPositions();
    },

    // === CAMERA API METHODS (DELEGATED) ===

    /**
     * Get camera information
     */
    getCameraInfo: function() {
        return this.cameraManager.getCameraInfo();
    },

    /**
     * Apply camera settings from tutorial
     */
    applyCameraSettings: function(tutorialStep) {
        return this.cameraManager.applyCameraSettings(tutorialStep);
    },

    /**
     * Save current view
     */
    saveCurrentView: function() {
        return this.cameraManager.saveCurrentView();
    },

    // === RENDER API METHODS (DELEGATED) ===

    /**
     * Apply model settings from tutorial
     */
    applyModelSettings: function(tutorialStep) {
        return this.renderManager.applyModelSettings(tutorialStep);
    },

    /**
     * Apply silhouette to model
     */
    applySilhouetteToModel: function(modelName, color = 0xffff00) {
        return this.renderManager.applySilhouetteToModel(modelName, color);
    },

    /**
     * Remove silhouette from model
     */
    removeSilhouetteFromModel: function(modelName) {
        return this.renderManager.removeSilhouetteFromModel(modelName);
    },

    /**
     * Show planaxis
     */
    showPlanaxis: function() {
        return this.renderManager.showPlanaxis();
    },

    /**
     * Hide planaxis
     */
    hidePlanaxis: function() {
        return this.renderManager.hidePlanaxis();
    },

    /**
     * Toggle planaxis
     */
    togglePlanaxis: function() {
        return this.renderManager.togglePlanaxis();
    },

    /**
     * Check if planaxis is visible
     */
    isPlanaxisVisible: function() {
        return this.renderManager.isPlanaxisVisible();
    },

    /**
     * Take screenshot
     */
    takeScreenshot: function(filename = 'screenshot.png') {
        return this.renderManager.takeScreenshot(filename);
    },

    // === LEGACY COMPATIBILITY METHODS ===

    /**
     * Handle model click (compatibility method)
     */
    handleModelClick: function(event) {
        return this.cameraManager.handleModelClick(event);
    },

    /**
     * Handle model action (delegates to original animation system)
     */
    handleModelAction: function(model) {
        // Delegate to original animation system if available
        if (window.Scene3D_Original && window.Scene3D_Original.handleModelAction) {
            return window.Scene3D_Original.handleModelAction(model);
        }
        console.warn('[Scene3D] handleModelAction: Original animation system not available');
    },

    /**
     * Start model animation (delegates to original animation system)
     */
    startModelAnimation: function(model, tutorialStep) {
        if (window.Scene3D_Original && window.Scene3D_Original.startModelAnimation) {
            return window.Scene3D_Original.startModelAnimation(model, tutorialStep);
        }
        console.warn('[Scene3D] startModelAnimation: Original animation system not available');
    },

    /**
     * Update animations (delegates to original animation system)
     */
    updateAnimations: function() {
        if (window.Scene3D_Original && window.Scene3D_Original.updateAnimations) {
            return window.Scene3D_Original.updateAnimations();
        }
    },

    /**
     * Parse movement steps (delegates to original animation system)
     */
    parseMovementSteps: function(tutorialStep, modelFilename = null) {
        if (window.Scene3D_Original && window.Scene3D_Original.parseMovementSteps) {
            return window.Scene3D_Original.parseMovementSteps(tutorialStep, modelFilename);
        }
        return [];
    },

    /**
     * Start multi-step movement (delegates to original animation system)
     */
    startMultiStepMovement: function(model, movementSteps) {
        if (window.Scene3D_Original && window.Scene3D_Original.startMultiStepMovement) {
            return window.Scene3D_Original.startMultiStepMovement(model, movementSteps);
        }
    },

    // === UTILITY METHODS ===

    /**
     * List available objects in scene
     */
    listAvailableObjects: function() {
        const objects = [];

        this.loadedModels.forEach(model => {
            const displayName = this.core.getModelDisplayName(model);
            objects.push({
                name: displayName,
                position: model.position.clone(),
                boundingBoxCenter: this.calculateBoundingBoxCenter(model)
            });
        });

        console.log('[Scene3D] 📋 Oggetti disponibili:');
        objects.forEach((obj, index) => {
            const pos = obj.position;
            const center = obj.boundingBoxCenter;
            console.log(`${index + 1}. ${obj.name}`);
            console.log(`   Posizione: (${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)})`);
            console.log(`   Centro BB: (${center.x.toFixed(3)}, ${center.y.toFixed(3)}, ${center.z.toFixed(3)})`);
        });

        return objects;
    },

    /**
     * Handle window resize
     */
    onWindowResize: function() {
        if (this.renderManager) {
            this.renderManager.onWindowResize();
        }
        if (this.cameraManager) {
            this.cameraManager.onWindowResize();
        }
    },

    // === DRAG & DROP COMPATIBILITY ===

    /**
     * Enable drag and drop
     */
    enableDragDrop: function(objectNames = null) {
        if (window.DragDropSystem && window.DragDropSystem.enable) {
            return window.DragDropSystem.enable(objectNames);
        }
    },

    /**
     * Disable drag and drop
     */
    disableDragDrop: function() {
        if (window.DragDropSystem && window.DragDropSystem.disable) {
            return window.DragDropSystem.disable();
        }
    },

    /**
     * Set drag snap distance
     */
    setDragSnapDistance: function(distance) {
        if (window.DragDropSystem && window.DragDropSystem.setSnapDistance) {
            return window.DragDropSystem.setSnapDistance(distance);
        }
    },

    /**
     * Check if drag drop is enabled
     */
    isDragDropEnabled: function() {
        if (window.DragDropSystem && window.DragDropSystem.isEnabled) {
            return window.DragDropSystem.isEnabled();
        }
        return false;
    },

    /**
     * Check if currently dragging
     */
    isDragging: function() {
        if (window.DragDropSystem && window.DragDropSystem.isDraggingActive) {
            return window.DragDropSystem.isDraggingActive();
        }
        return false;
    },

    // === TEST METHODS ===

    /**
     * Test congratulations
     */
    testCongratulations: function() {
        return this.core.testCongratulations();
    },

    /**
     * Test congratulations with user
     */
    testCongratulationsWithUser: function(testUserName = null) {
        return this.core.testCongratulationsWithUser?.(testUserName);
    },

    /**
     * Test post tutorial block and reset
     */
    testPostTutorialBlockAndReset: function() {
        return this.core.testPostTutorialBlockAndReset();
    },

    /**
     * Test particle system
     */
    testParticleSystem: function() {
        if (window.ParticleSystem && window.ParticleSystem.testAirJet) {
            return window.ParticleSystem.testAirJet();
        }
        console.warn('[Scene3D] Particle system not available for testing');
    },

    // === DEBUGGING AND STATS ===

    /**
     * Get system info
     */
    getSystemInfo: function() {
        return {
            core: !!this.core,
            cameraManager: !!this.cameraManager,
            renderManager: !!this.renderManager,
            isInitialized: this.isInitialized,
            loadedModels: this.loadedModels.length,
            renderStats: this.renderManager ? this.renderManager.getStats() : null
        };
    },

    /**
     * Set rendering quality
     */
    setRenderingQuality: function(quality = 'high') {
        if (this.renderManager) {
            return this.renderManager.setRenderingQuality(quality);
        }
    },

    /**
     * Set wireframe mode
     */
    setWireframeMode: function(enabled) {
        if (this.renderManager) {
            return this.renderManager.setWireframeMode(enabled);
        }
    }
};

// Backup reference to original Scene3D if it exists
if (window.Scene3D && window.Scene3D !== Scene3D) {
    window.Scene3D_Original = window.Scene3D;
    console.log('[Scene3D] 💾 Original Scene3D backed up to Scene3D_Original');
}

// Export the refactored Scene3D
window.Scene3D = Scene3D;

console.log('[Scene3D] 🏗️ Sistema refactorizzato caricato - API backward compatible mantenute');