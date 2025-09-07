/**
 * HIGHLIGHT SYSTEM MODULE
 * VERSION: 1000010 - Modular Architecture
 * 
 * Handles model highlighting functionality with yellow outline effects.
 * Manages material saving/restoration and provides visual feedback for interactive elements.
 */

export class HighlightSystem {
    constructor() {
        // Highlight state
        this.highlightedModel = null;
        this.originalMaterials = new Map();
        this.highlightMaterial = null;
        this.highlightTimer = null;
        this.isHighlighting = false;
        
        this.initHighlightSystem();
    }

    /**
     * Initialize highlight system
     */
    initHighlightSystem() {
        // Create highlight material (bright yellow)
        this.highlightMaterial = new THREE.MeshBasicMaterial({
            color: 0xcccc00,               // Bright yellow
            transparent: true,
            opacity: 0.8,
            wireframe: false,
            side: THREE.DoubleSide,
            depthTest: false,              // Ignore z-buffer to always be visible
            depthWrite: false              // Don't write to z-buffer
        });
        
        AppConfig.log(3, 'Highlight system initialized');
    }

    /**
     * Highlight a model with yellow outline
     * @param {THREE.Object3D} model - The model to highlight
     * @param {number} duration - Duration in milliseconds (optional, if omitted stays until click)
     */
    highlightModel(model, duration = null) {
        if (!model) {
            AppConfig.log(1, 'Attempt to highlight null model');
            return;
        }
        
        // If there's already a highlighted model, restore it first
        if (this.isHighlighting) {
            this.removeHighlight();
        }
        
        AppConfig.log(2, `🔴 Highlighting model: ${model.userData?.originalFilename || model.name}`);
        
        // Save original materials
        this.saveOriginalMaterials(model);
        
        // Apply highlight material
        this.applyHighlightMaterial(model);
        
        // Update state
        this.highlightedModel = model;
        this.isHighlighting = true;
        
        // Optional timer if duration specified
        if (duration && duration > 0) {
            this.highlightTimer = setTimeout(() => {
                this.removeHighlight();
            }, duration);
            AppConfig.log(2, `🔴 Highlighting activated for ${duration}ms`);
        } else {
            AppConfig.log(2, '🔴 Highlighting activated - turns off on element click');
        }
    }

    /**
     * Save original materials of a model before highlighting
     * @param {THREE.Object3D} model - The model whose materials to save
     */
    saveOriginalMaterials(model) {
        const materials = new Map();
        
        model.traverse((child) => {
            if (child.isMesh && child.material) {
                // Save original material using UUID as key
                if (Array.isArray(child.material)) {
                    // Multi-material
                    materials.set(child.uuid, child.material.slice()); // Copy array
                } else {
                    // Single material
                    materials.set(child.uuid, child.material);
                }
            }
        });
        
        this.originalMaterials = materials;
        AppConfig.log(3, `Saved ${materials.size} original materials`);
    }

    /**
     * Apply highlight material to entire model
     * @param {THREE.Object3D} model - The model to highlight
     */
    applyHighlightMaterial(model) {
        model.traverse((child) => {
            if (child.isMesh) {
                // Apply yellow material to all meshes
                if (Array.isArray(child.material)) {
                    // Multi-material: replace all with highlight
                    child.material = child.material.map(() => this.highlightMaterial);
                } else {
                    // Single material
                    child.material = this.highlightMaterial;
                }
                
                // Force render order to always be in foreground
                child.renderOrder = 999;
            }
        });
        
        AppConfig.log(3, 'Highlight material applied');
    }

    /**
     * Remove highlighting and restore original materials
     */
    removeHighlight() {
        if (!this.isHighlighting || !this.highlightedModel) {
            return;
        }
        
        const model = this.highlightedModel;
        AppConfig.log(2, `🔄 Removing highlight: ${model.userData?.originalFilename || model.name}`);
        
        // Restore original materials
        model.traverse((child) => {
            if (child.isMesh && this.originalMaterials.has(child.uuid)) {
                child.material = this.originalMaterials.get(child.uuid);
                child.renderOrder = 0; // Reset render order
            }
        });
        
        // Clear timer if still active
        if (this.highlightTimer) {
            clearTimeout(this.highlightTimer);
            this.highlightTimer = null;
        }
        
        // Reset state
        this.highlightedModel = null;
        this.originalMaterials.clear();
        this.isHighlighting = false;
        
        AppConfig.log(2, '✅ Highlighting removed and materials restored');
    }

    /**
     * Highlight current tutorial element if present
     */
    highlightCurrentTutorialElement(loadedModels) {
        console.log('🔴 highlightCurrentTutorialElement called');
        console.log('🔴 Loaded models:', loadedModels.length);
        console.log('🔴 Available models:', loadedModels.map(m => m.userData?.originalFilename || m.name));
        
        // Get current tutorial step
        const currentStep = this.getCurrentTutorialStep();
        if (!currentStep || !currentStep.properties.Elemento) {
            console.log('🔴 No current step or tutorial element to highlight');
            AppConfig.log(3, 'No tutorial element to highlight');
            return;
        }
        
        const stepElement = currentStep.properties.Elemento;
        console.log('🔴 Tutorial element to highlight:', stepElement);
        
        // Find corresponding model
        const targetModel = loadedModels.find(model => {
            const modelFilename = model.userData?.originalFilename || model.name;
            const match = modelFilename.includes(stepElement.replace('.glb', ''));
            console.log(`🔍 Testing model "${modelFilename}" vs element "${stepElement}": ${match}`);
            return match;
        });
        
        if (targetModel) {
            // Check that found model is selectable
            if (!this.isModelSelectable(targetModel, loadedModels)) {
                console.log('🔴 ❌ Model found but not selectable (eg. floor):', targetModel.userData?.originalFilename || targetModel.name);
                AppConfig.log(1, `❌ Tutorial element not selectable: ${stepElement}`);
                return;
            }
            
            console.log('🔴 ✅ Model found for highlighting:', targetModel.userData?.originalFilename || targetModel.name);
            AppConfig.log(2, `🎯 Highlighting tutorial element: ${stepElement}`);
            this.highlightModel(targetModel);
        } else {
            console.log('🔴 ❌ No model found for element:', stepElement);
            console.log('🔴 ❌ Available models:', loadedModels.map(m => m.userData?.originalFilename || m.name));
            AppConfig.log(1, `❌ Model not found for element: ${stepElement}`);
        }
    }

    /**
     * Get current tutorial step
     */
    getCurrentTutorialStep() {
        if (!window.UI || !window.UI.tutorialSteps || window.UI.currentStepIndex === undefined || window.UI.currentStepIndex < 0) {
            return null;
        }
        
        const stepIndex = window.UI.currentStepIndex;
        return window.UI.tutorialSteps[stepIndex] || null;
    }

    /**
     * Check if model is selectable (helper method from ModelManager)
     */
    isModelSelectable(model, loadedModels) {
        if (!model) return false;
        
        const nonSelectableElements = [
            'pavimento',
            'piano', 
            'base',
            'superficie',
            'ground',
            'floor',
            'basement',
            'sfondo',
            'background'
        ];
        
        const modelName = (model.userData?.originalFilename || model.name || '').toLowerCase();
        
        // Check if name contains any of the exclude keywords
        for (const excludeKeyword of nonSelectableElements) {
            if (modelName.includes(excludeKeyword.toLowerCase())) {
                console.log(`🚫 Model "${modelName}" not selectable (contains "${excludeKeyword}")`);
                return false;
            }
        }
        
        return true;
    }

    /* ===== DEBUG AND TEST METHODS ===== */

    /**
     * Test highlighting with random model (debug only)
     * @param {Array} loadedModels - Array of loaded models
     * @param {number} duration - Optional duration in milliseconds
     */
    testHighlight(loadedModels, duration = null) {
        if (loadedModels.length === 0) {
            console.log('🔴 No loaded models for highlight test');
            return;
        }
        
        const randomIndex = Math.floor(Math.random() * loadedModels.length);
        const randomModel = loadedModels[randomIndex];
        
        if (duration) {
            console.log(`🔴 TEST: Random model highlighting #${randomIndex} for ${duration}ms: ${randomModel.userData?.originalFilename || randomModel.name}`);
        } else {
            console.log(`🔴 TEST: Random model highlighting #${randomIndex} (until click): ${randomModel.userData?.originalFilename || randomModel.name}`);
        }
        
        this.highlightModel(randomModel, duration);
    }

    /**
     * Get highlighting status
     */
    getHighlightStatus() {
        return {
            isHighlighting: this.isHighlighting,
            highlightedModel: this.highlightedModel?.userData?.originalFilename || this.highlightedModel?.name || null,
            hasTimer: this.highlightTimer !== null,
            savedMaterialsCount: this.originalMaterials.size
        };
    }
}