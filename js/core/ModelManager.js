/**
 * MODEL MANAGER MODULE
 * VERSION: 1000010 - Modular Architecture
 * 
 * Handles 3D model loading, management, visibility control, and scene fitting.
 * Manages the loaded models array and provides utilities for model selection and manipulation.
 */

export class ModelManager {
    constructor(scene) {
        this.scene = scene;
        
        // Model storage
        this.loadedModels = [];
        this.currentModel = null;
        
        // Model directions for animations (from config)
        this.modelDirections = {};
        
        // Elements to exclude from selection (case-insensitive)
        this.nonSelectableElements = [
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
    }

    /**
     * Add model to scene
     */
    addModel(model, modelConfig = null) {
        if (!model) {
            AppConfig.log(1, 'Attempt to add null model');
            return;
        }
        
        // Keep original model position from file
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        console.log(`📍 Model ${this.loadedModels.length + 1}:`, {
            position: model.position,
            size: `${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)}`,
            center: `${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}`,
            min: `${box.min.x.toFixed(2)}, ${box.min.y.toFixed(2)}, ${box.min.z.toFixed(2)}`,
            max: `${box.max.x.toFixed(2)}, ${box.max.y.toFixed(2)}, ${box.max.z.toFixed(2)}`
        });
        
        this.scene.add(model);
        this.loadedModels.push(model);
        this.currentModel = model;
        
        // Store model configuration (including direction)
        const modelFilename = model.userData?.originalFilename || model.name;
        console.log(`📝 AddModel process for: "${modelFilename}"`);
        console.log(`📝 ModelConfig received:`, modelConfig);
        
        if (modelConfig && modelConfig.direction) {
            console.log(`🔍 ADDMODEL - ModelConfig direction for "${modelFilename}":`, modelConfig.direction);
            console.log(`🔍 ADDMODEL - Typeof direction:`, typeof modelConfig.direction);
            console.log(`🔍 ADDMODEL - Direction keys:`, Object.keys(modelConfig.direction));
            
            this.modelDirections[modelFilename] = modelConfig.direction;
            console.log(`🧭✅ Direction stored for "${modelFilename}":`, this.modelDirections[modelFilename]);
            
            // Immediate verification of what was stored
            const stored = this.modelDirections[modelFilename];
            console.log(`🔍 VERIFICATION - Just stored direction:`, {x: stored.x, y: stored.y, z: stored.z});
        } else {
            console.log(`🧭❌ No direction for "${modelFilename}" - modelConfig:`, modelConfig);
        }
        
        AppConfig.log(2, 'Model added to scene', { 
            totalModels: this.loadedModels.length 
        });
        
        return model;
    }

    /**
     * Remove all models from scene
     */
    clearAllModels() {
        this.loadedModels.forEach(model => {
            this.scene.remove(model);
            this.disposeModel(model);
        });
        
        this.loadedModels = [];
        this.currentModel = null;
        this.modelDirections = {};
        
        AppConfig.log(2, 'All models removed from scene');
    }

    /**
     * Dispose model memory (important for performance)
     */
    disposeModel(model) {
        model.traverse(function(child) {
            if (child.geometry) {
                child.geometry.dispose();
            }
            if (child.material) {
                if (child.material.map && typeof child.material.map.dispose === 'function') {
                    child.material.map.dispose();
                }
                if (typeof child.material.dispose === 'function') {
                    child.material.dispose();
                }
            }
        });
    }

    /**
     * Find root model that contains a given object
     */
    findRootModel(clickedObject) {
        for (const model of this.loadedModels) {
            if (this.isDescendantOf(clickedObject, model)) {
                return model;
            }
        }
        return null;
    }

    /**
     * Check if an object is descendant of another
     */
    isDescendantOf(child, parent) {
        let current = child;
        while (current && current !== this.scene) {
            if (current === parent) return true;
            current = current.parent;
        }
        return false;
    }

    /**
     * Check if a model is selectable (not in blacklist)
     */
    isModelSelectable(model) {
        if (!model) return false;
        
        const modelName = (model.userData?.originalFilename || model.name || '').toLowerCase();
        
        // Check if name contains any of the exclude keywords
        for (const excludeKeyword of this.nonSelectableElements) {
            if (modelName.includes(excludeKeyword.toLowerCase())) {
                console.log(`🚫 Model "${modelName}" not selectable (contains "${excludeKeyword}")`);
                return false;
            }
        }
        
        return true;
    }

    /**
     * Fit view to frame the model
     */
    fitModelToView(model, camera, manualCameraSet = false) {
        // Calculate model bounding box
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        // Calculate necessary distance to frame everything
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        
        // Add some margin
        cameraZ *= 1.5;
        
        // Ensure calculated distance is within zoom limits
        const minDistance = 1.0;
        const maxDistance = 10.0;
        cameraZ = Math.max(minDistance, Math.min(maxDistance, cameraZ));
        
        // Position camera ONLY if not set manually by scenario
        if (!manualCameraSet) {
            camera.position.set(center.x, center.y, center.z + cameraZ);
            camera.lookAt(center);
        } else {
            console.log('📷 Single model auto-fitting disabled: camera already set by scenario');
        }
        
        console.log('📐 View adapted to model:', {
            size: size,
            center: center,
            cameraZ: cameraZ,
            cameraPosition: camera.position
        });
        
        AppConfig.log(3, 'View adapted to model', {
            boundingBox: { size, center },
            cameraPosition: camera.position
        });
    }

    /**
     * Fit view to frame all loaded models
     * Automatically excludes floor models from calculation
     */
    fitAllModelsToView(camera, manualCameraSet = false) {
        if (this.loadedModels.length === 0) return;
        
        // Filter models excluding those containing "pavimento" in name
        const modelsForFitting = this.loadedModels.filter(model => {
            const modelName = (model.userData && model.userData.originalFilename) || model.name || '';
            const isPavimento = modelName.toLowerCase().includes('pavimento');
            
            if (isPavimento) {
                console.log('🏠 Floor excluded from auto-zoom calculation:', modelName);
            }
            
            return !isPavimento;
        });
        
        if (modelsForFitting.length === 0) {
            console.log('⚠️ No models to fit (only floors present)');
            return;
        }
        
        // Calculate bounding box only on filtered models
        const box = new THREE.Box3();
        modelsForFitting.forEach(model => {
            box.expandByObject(model);
        });
        
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        // Calculate necessary distance to frame everything
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        
        // Add extra margin for multiple models
        cameraZ *= 2.0;
        
        // Ensure distance is within zoom limits
        const minDistance = 1.0;
        const maxDistance = 10.0;
        cameraZ = Math.max(minDistance, Math.min(maxDistance, cameraZ));
        
        // Position camera ONLY if not set manually by scenario
        if (!manualCameraSet) {
            camera.position.set(center.x, center.y, center.z + cameraZ);
            camera.lookAt(center);
        } else {
            console.log('📷 All models auto-fitting disabled: camera already set by scenario');
        }
        
        console.log('📐 View adapted to models (excluding floor):', {
            totalModels: this.loadedModels.length,
            modelsUsedForFitting: modelsForFitting.length,
            size: size,
            center: center,
            cameraZ: cameraZ
        });
    }

    /**
     * Toggle model visibility
     */
    toggleModelVisibility(modelIndex) {
        if (modelIndex < 0 || modelIndex >= this.loadedModels.length) {
            console.warn(`Invalid model index: ${modelIndex}`);
            return;
        }
        
        const model = this.loadedModels[modelIndex];
        model.visible = !model.visible;
        
        console.log(`🔄 Model ${modelIndex + 1} ${model.visible ? 'visible' : 'hidden'}`);
        return model.visible;
    }

    /**
     * Set model visibility
     */
    setModelVisibility(modelIndex, visible) {
        if (modelIndex < 0 || modelIndex >= this.loadedModels.length) {
            console.warn(`Invalid model index: ${modelIndex}`);
            return;
        }
        
        const model = this.loadedModels[modelIndex];
        model.visible = visible;
        
        console.log(`👁️ Model ${modelIndex + 1} ${visible ? 'shown' : 'hidden'}`);
        return model.visible;
    }

    /**
     * Get information about loaded models
     */
    getModelsInfo() {
        return this.loadedModels.map((model, index) => {
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            
            return {
                index: index,
                visible: model.visible,
                name: model.name || `Model ${index + 1}`,
                position: model.position,
                size: size,
                center: center,
                boundingBox: { min: box.min, max: box.max }
            };
        });
    }

    /**
     * Find element center by name
     */
    getElementCenter(elementName) {
        if (!elementName) return null;
        
        console.log(`🔍 DEBUG: Looking for element "${elementName}" among ${this.loadedModels.length} models`);
        
        // DEBUG: List all loaded models for troubleshooting
        console.log(`🔍 DEBUG: Loaded models:`);
        this.loadedModels.forEach((model, index) => {
            const filename = model.userData?.originalFilename || model.name;
            console.log(`  [${index}] Name: "${model.name}", Filename: "${filename}"`);
        });
        
        // Search in loaded models array
        const targetModel = this.loadedModels.find(model => {
            const filename = model.userData?.originalFilename || model.name;
            return filename === elementName || filename.toLowerCase() === elementName.toLowerCase();
        });
        
        if (targetModel) {
            // Calculate center using bounding box
            const boundingBox = new THREE.Box3().setFromObject(targetModel);
            const center = boundingBox.getCenter(new THREE.Vector3());
            
            console.log(`🎯 ELEMENT: "${elementName}" found, center=(${center.x.toFixed(3)}, ${center.y.toFixed(3)}, ${center.z.toFixed(3)})`);
            return center;
        }
        
        // If not found in loaded models, search in general scene
        let foundObject = null;
        this.scene.traverse((object) => {
            if (foundObject) return; // Already found
            
            const objName = object.userData?.originalFilename || object.name;
            if (objName === elementName || objName.toLowerCase() === elementName.toLowerCase()) {
                foundObject = object;
            }
        });
        
        if (foundObject) {
            const boundingBox = new THREE.Box3().setFromObject(foundObject);
            const center = boundingBox.getCenter(new THREE.Vector3());
            
            console.log(`🎯 SCENE: "${elementName}" found in scene, center=(${center.x.toFixed(3)}, ${center.y.toFixed(3)}, ${center.z.toFixed(3)})`);
            return center;
        }
        
        console.log(`❌ ELEMENT: "${elementName}" not found in loaded models or scene`);
        return null;
    }

    /**
     * Get model direction configuration
     */
    getModelDirection(modelFilename) {
        return this.modelDirections[modelFilename] || null;
    }

    /**
     * Set model direction configuration
     */
    setModelDirection(modelFilename, direction) {
        this.modelDirections[modelFilename] = direction;
    }

    /**
     * Get all model directions
     */
    getAllModelDirections() {
        return this.modelDirections;
    }

    /* ===== DEBUG AND TEST METHODS ===== */

    /**
     * Test model selectability
     */
    testModelSelectability() {
        console.log('🚫 === TEST MODEL SELECTION ===');
        console.log('🚫 Excluded elements:', this.nonSelectableElements);
        console.log('🚫 Total loaded models:', this.loadedModels.length);
        
        const selectableModels = [];
        const nonSelectableModels = [];
        
        this.loadedModels.forEach(model => {
            const modelName = model.userData?.originalFilename || model.name;
            if (this.isModelSelectable(model)) {
                selectableModels.push(modelName);
            } else {
                nonSelectableModels.push(modelName);
            }
        });
        
        console.log('✅ Selectable models:', selectableModels);
        console.log('🚫 NON-selectable models:', nonSelectableModels);
        console.log('🎯 NOTE: Non-selectable models are also excluded from pivot system');
        
        return {
            totalModels: this.loadedModels.length,
            selectableModels: selectableModels,
            nonSelectableModels: nonSelectableModels,
            excludedKeywords: this.nonSelectableElements
        };
    }
}