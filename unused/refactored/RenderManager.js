/**
 * RenderManager.js - Gestione rendering, scene e luci
 *
 * Responsabilità:
 * - Inizializzazione scene, renderer e luci Three.js
 * - Loop di rendering e aggiornamenti frame
 * - Applicazione impostazioni modelli (posizione, rotazione, effetti)
 * - Gestione materiali e effetti visivi
 * - Resize handling e performance
 *
 * Versione: 2.0 Refactored
 * Data: Dicembre 2025
 */

class RenderManager {
    constructor(scene3DCore) {
        this.core = scene3DCore;
        this.isRenderLoopActive = false;
        this.lastFrameTime = 0;
        this.frameCount = 0;
    }

    /**
     * Inizializza scene, camera, renderer e luci
     */
    init() {
        try {
            this.initScene();
            this.initCamera();
            this.initRenderer();
            this.initLights();

            console.log('[RenderManager] ✅ Rendering system inizializzato');
            return true;

        } catch (error) {
            console.error('[RenderManager] ❌ Errore inizializzazione:', error.message);
            return false;
        }
    }

    /**
     * Inizializza la scena Three.js
     */
    initScene() {
        this.core.scene = new THREE.Scene();
        this.core.scene.background = null; // Transparent background
        console.log('[RenderManager] Scene creata');
    }

    /**
     * Inizializza la camera
     */
    initCamera() {
        const config = window.AppConfig?.scene3D?.camera || {
            fov: 75,
            near: 0.1,
            far: 1000,
            initialPosition: { x: 0, y: 0, z: 5 }
        };

        const aspect = window.innerWidth / window.innerHeight;

        this.core.camera = new THREE.PerspectiveCamera(
            config.fov,
            aspect,
            config.near,
            config.far
        );

        this.core.camera.position.set(
            config.initialPosition.x,
            config.initialPosition.y,
            config.initialPosition.z
        );

        this.core.camera.lookAt(0, 0, 0);
        console.log('[RenderManager] Camera inizializzata');
    }

    /**
     * Inizializza il renderer WebGL
     */
    initRenderer() {
        const config = window.AppConfig?.scene3D?.renderer || {
            antialias: true,
            alpha: true,
            shadowMapEnabled: true,
            shadowMapType: 'PCFSoft'
        };

        this.core.renderer = new THREE.WebGLRenderer({
            canvas: this.core.canvas,
            antialias: config.antialias,
            alpha: config.alpha
        });

        this.core.renderer.setSize(window.innerWidth, window.innerHeight);
        this.core.renderer.setPixelRatio(window.devicePixelRatio);

        // Shadow settings
        if (config.shadowMapEnabled) {
            this.core.renderer.shadowMap.enabled = true;
            this.core.renderer.shadowMap.type = THREE[config.shadowMapType + 'ShadowMap'] || THREE.PCFSoftShadowMap;
        }

        // Enhanced rendering settings
        this.core.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.core.renderer.toneMappingExposure = 2.8;
        this.core.renderer.outputColorSpace = THREE.SRGBColorSpace;

        console.log('[RenderManager] Renderer WebGL inizializzato');
    }

    /**
     * Inizializza le luci della scena
     */
    initLights() {
        const lightingConfig = window.AppConfig?.scene3D?.lighting || {
            ambient: { color: 0x606060, intensity: 2.0 },
            directional: {
                color: 0xffffff,
                intensity: 3.3,
                position: { x: 1, y: 1, z: 1 }
            }
        };

        // Ambient light
        const ambientLight = new THREE.AmbientLight(
            lightingConfig.ambient.color,
            lightingConfig.ambient.intensity
        );
        this.core.scene.add(ambientLight);

        // Main directional light
        const directionalLight = new THREE.DirectionalLight(
            lightingConfig.directional.color,
            lightingConfig.directional.intensity
        );

        directionalLight.position.set(
            lightingConfig.directional.position.x,
            lightingConfig.directional.position.y,
            lightingConfig.directional.position.z
        );

        // Shadow settings for directional light
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -50;
        directionalLight.shadow.camera.right = 50;
        directionalLight.shadow.camera.top = 50;
        directionalLight.shadow.camera.bottom = -50;

        this.core.scene.add(directionalLight);

        // Back light for better illumination
        const backLight = new THREE.DirectionalLight(0xffffff, 0.4);
        backLight.position.set(
            -lightingConfig.directional.position.x,
            lightingConfig.directional.position.y,
            -lightingConfig.directional.position.z
        );
        this.core.scene.add(backLight);

        // Additional fill light
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.2);
        fillLight.position.set(0, -1, 1);
        this.core.scene.add(fillLight);

        console.log('[RenderManager] Sistema di illuminazione inizializzato');
    }

    /**
     * Avvia il loop di rendering
     */
    startRenderLoop() {
        if (this.isRenderLoopActive) {
            console.warn('[RenderManager] Loop di rendering già attivo');
            return;
        }

        this.isRenderLoopActive = true;
        this.lastFrameTime = performance.now();

        const renderLoop = (currentTime) => {
            if (!this.isRenderLoopActive) return;

            // Update frame timing
            const deltaTime = currentTime - this.lastFrameTime;
            this.lastFrameTime = currentTime;
            this.frameCount++;

            // Update systems
            this.update(deltaTime);

            // Render frame
            this.render();

            // Continue loop
            requestAnimationFrame(renderLoop);
        };

        requestAnimationFrame(renderLoop);
        console.log('[RenderManager] 🎬 Loop di rendering avviato');
    }

    /**
     * Ferma il loop di rendering
     */
    stopRenderLoop() {
        this.isRenderLoopActive = false;
        console.log('[RenderManager] ⏹️ Loop di rendering fermato');
    }

    /**
     * Update systems (called every frame)
     */
    update(deltaTime) {
        // Update camera manager
        if (this.core.cameraManager) {
            this.core.cameraManager.update();
        }

        // Update animation system
        if (window.Scene3D && window.Scene3D.updateAnimations) {
            window.Scene3D.updateAnimations();
        }

        // Update particle system
        if (this.core.particleSystem && this.core.particleSystem.update) {
            this.core.particleSystem.update(deltaTime);
        }
    }

    /**
     * Render frame
     */
    render() {
        if (!this.core.renderer || !this.core.scene || !this.core.camera) return;

        this.core.renderer.render(this.core.scene, this.core.camera);
    }

    /**
     * Handle window resize
     */
    onWindowResize() {
        if (!this.core.camera || !this.core.renderer) return;

        const width = window.innerWidth;
        const height = window.innerHeight;

        // Update camera
        this.core.camera.aspect = width / height;
        this.core.camera.updateProjectionMatrix();

        // Update renderer
        this.core.renderer.setSize(width, height);

        console.log('[RenderManager] 🔄 Resize:', width, 'x', height);
    }

    /**
     * Apply model settings from tutorial step
     */
    applyModelSettings(tutorialStep) {
        if (!tutorialStep) return;

        console.log('[RenderManager] 🔧 Applicazione impostazioni modelli...');

        // Apply position settings
        Object.keys(tutorialStep).forEach(key => {
            if (key.startsWith('Posizione=')) {
                this.applyModelPosition(key, tutorialStep[key]);
            } else if (key.startsWith('Rotazione=')) {
                this.applyModelRotation(key, tutorialStep[key]);
            }
        });
    }

    /**
     * Apply model position
     */
    applyModelPosition(key, value) {
        const modelMatch = key.match(/Posizione=(.+)/);
        if (!modelMatch) return;

        const modelAndCoords = modelMatch[1];
        const colonIndex = modelAndCoords.indexOf(':');

        if (colonIndex === -1) return;

        const modelName = modelAndCoords.substring(0, colonIndex);
        const coordsString = modelAndCoords.substring(colonIndex + 1);

        // Parse coordinates
        const coordsMatch = coordsString.match(/\(([^)]+)\)/);
        if (!coordsMatch) return;

        const coords = coordsMatch[1].split(',').map(s => parseFloat(s.trim()));
        if (coords.length !== 3 || coords.some(isNaN)) return;

        // Find and position model
        const model = this.core.findModelByName(modelName);
        if (model && !model.isOriginalReference) {
            model.position.set(coords[0], coords[1], coords[2]);
            console.log(`[RenderManager] 📍 Posizione applicata: ${modelName} -> (${coords.join(', ')})`);
        }
    }

    /**
     * Apply model rotation
     */
    applyModelRotation(key, value) {
        const modelMatch = key.match(/Rotazione=(.+)/);
        if (!modelMatch) return;

        const modelAndCoords = modelMatch[1];
        const colonIndex = modelAndCoords.indexOf(':');

        if (colonIndex === -1) return;

        const modelName = modelAndCoords.substring(0, colonIndex);
        const coordsString = modelAndCoords.substring(colonIndex + 1);

        // Parse coordinates
        const coordsMatch = coordsString.match(/\(([^)]+)\)/);
        if (!coordsMatch) return;

        const coords = coordsMatch[1].split(',').map(s => parseFloat(s.trim()));
        if (coords.length !== 3 || coords.some(isNaN)) return;

        // Convert degrees to radians
        const radians = coords.map(deg => deg * Math.PI / 180);

        // Find and rotate model
        const model = this.core.findModelByName(modelName);
        if (model && !model.isOriginalReference) {
            model.rotation.set(radians[0], radians[1], radians[2]);
            console.log(`[RenderManager] 🔄 Rotazione applicata: ${modelName} -> (${coords.join(', ')}°)`);
        }
    }

    /**
     * Apply silhouette effect to model
     */
    applySilhouetteToModel(modelName, color = 0xffff00) {
        const model = this.core.findModelByName(modelName);
        if (!model) {
            console.warn(`[RenderManager] Modello non trovato per silhouette: ${modelName}`);
            return;
        }

        // Save original materials if not already saved
        if (!this.core.highlightSystem.originalMaterials.has(model.uuid)) {
            this.core.saveOriginalMaterials(model);
        }

        // Create silhouette material
        const silhouetteMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.7,
            depthTest: false, // This makes it visible through other objects
            side: THREE.DoubleSide
        });

        // Apply silhouette material
        model.traverse((child) => {
            if (child.isMesh) {
                child.material = silhouetteMaterial;
            }
        });

        console.log(`[RenderManager] 👻 Silhouette applicata a ${modelName}`);
    }

    /**
     * Remove silhouette effect from model
     */
    removeSilhouetteFromModel(modelName) {
        const model = this.core.findModelByName(modelName);
        if (!model) {
            console.warn(`[RenderManager] Modello non trovato per rimozione silhouette: ${modelName}`);
            return;
        }

        // Restore original materials
        const originalMaterials = this.core.highlightSystem.originalMaterials.get(model.uuid);
        if (originalMaterials) {
            model.traverse((child) => {
                if (child.isMesh && originalMaterials.has(child.uuid)) {
                    child.material = originalMaterials.get(child.uuid);
                }
            });

            console.log(`[RenderManager] 🔄 Silhouette rimossa da ${modelName}`);
        }
    }

    /**
     * Show/hide planaxis (coordinate reference)
     */
    showPlanaxis() {
        // Find planaxis model
        const planaxis = this.core.findModelByName('assi');
        if (planaxis) {
            planaxis.visible = true;
            console.log('[RenderManager] 📐 Planaxis mostrato');
        }
    }

    hidePlanaxis() {
        const planaxis = this.core.findModelByName('assi');
        if (planaxis) {
            planaxis.visible = false;
            console.log('[RenderManager] 📐 Planaxis nascosto');
        }
    }

    togglePlanaxis() {
        const planaxis = this.core.findModelByName('assi');
        if (planaxis) {
            planaxis.visible = !planaxis.visible;
            console.log('[RenderManager] 📐 Planaxis:', planaxis.visible ? 'mostrato' : 'nascosto');
            return planaxis.visible;
        }
        return false;
    }

    isPlanaxisVisible() {
        const planaxis = this.core.findModelByName('assi');
        return planaxis ? planaxis.visible : false;
    }

    /**
     * Get rendering statistics
     */
    getStats() {
        if (!this.core.renderer) return null;

        const info = this.core.renderer.info;
        return {
            geometries: info.memory.geometries,
            textures: info.memory.textures,
            programs: info.programs?.length || 0,
            calls: info.render.calls,
            triangles: info.render.triangles,
            points: info.render.points,
            lines: info.render.lines,
            frame: info.render.frame,
            frameCount: this.frameCount
        };
    }

    /**
     * Set rendering quality
     */
    setRenderingQuality(quality = 'high') {
        if (!this.core.renderer) return;

        switch (quality) {
            case 'low':
                this.core.renderer.setPixelRatio(0.5);
                this.core.renderer.shadowMap.enabled = false;
                break;
            case 'medium':
                this.core.renderer.setPixelRatio(1);
                this.core.renderer.shadowMap.enabled = true;
                this.core.renderer.shadowMap.type = THREE.BasicShadowMap;
                break;
            case 'high':
            default:
                this.core.renderer.setPixelRatio(window.devicePixelRatio);
                this.core.renderer.shadowMap.enabled = true;
                this.core.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
                break;
        }

        console.log(`[RenderManager] 🎨 Qualità rendering: ${quality}`);
    }

    /**
     * Enable/disable wireframe mode for debugging
     */
    setWireframeMode(enabled) {
        this.core.loadedModels.forEach(model => {
            model.traverse((child) => {
                if (child.isMesh && child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => mat.wireframe = enabled);
                    } else {
                        child.material.wireframe = enabled;
                    }
                }
            });
        });

        console.log('[RenderManager] 🔗 Wireframe mode:', enabled ? 'enabled' : 'disabled');
    }

    /**
     * Screenshot functionality
     */
    takeScreenshot(filename = 'screenshot.png') {
        if (!this.core.renderer) return;

        // Render current frame
        this.render();

        // Get image data
        const canvas = this.core.renderer.domElement;
        const dataURL = canvas.toDataURL('image/png');

        // Download image
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataURL;
        link.click();

        console.log('[RenderManager] 📸 Screenshot salvato:', filename);
    }

    /**
     * Cleanup resources
     */
    dispose() {
        this.stopRenderLoop();

        if (this.core.renderer) {
            this.core.renderer.dispose();
        }

        if (this.core.scene) {
            // Dispose scene resources
            this.core.scene.traverse((object) => {
                if (object.geometry) {
                    object.geometry.dispose();
                }
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(material => material.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            });
        }

        console.log('[RenderManager] 🧹 Risorse cleanup completato');
    }
}

// Export for use as module
window.RenderManager = RenderManager;
export default RenderManager;