/**
 * Scene3DCore.js - Core principale del sistema Scene3D
 *
 * Responsabilità:
 * - Inizializzazione e coordinamento generale
 * - Gestione modelli 3D e scene
 * - Sistema highlighting e interazioni
 * - Tutorial tracking e workflow
 * - API pubbliche principali
 *
 * Versione: 2.0 Refactored
 * Data: Dicembre 2025
 */

class Scene3DCore {
    constructor() {
        // Core Three.js objects
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.canvas = null;

        // Subsystems
        this.cameraManager = null;
        this.renderManager = null;
        this.animationSystem = null;
        this.highlightSystem = null;

        // State
        this.isInitialized = false;
        this.manualCameraSet = false;
        this.savedView = null;

        // Interaction objects
        this.raycaster = null;
        this.mouse = null;

        // Model management
        this.loadedModels = [];
        this.currentModel = null;

        // Highlighting system
        this.highlightSystem = {
            highlightedModel: null,
            originalMaterials: new Map(),
            highlightMaterial: null,
            highlightTimer: null,
            isHighlighting: false
        };

        // Tutorial tracking
        this.tutorialTracker = {
            completedSteps: new Set(),
            lastStepCompleted: false,
            interactionsBlocked: false
        };

        // Position management systems
        this.initialModelPositions = new Map();
        this.scenarioOriginalPositions = new Map();

        // Debug spheres
        this.boundingBoxSphere = null;
        this.rotationCenterSphere = null;

        // Non-selectable elements
        this.nonSelectableElements = [
            'pavimento', 'piano', 'base', 'superficie', 'ground', 'floor', 'basement', 'sfondo', 'background', 'assi'
        ];
    }

    /**
     * Inizializza il sistema Scene3D
     */
    init() {
        try {
            if (typeof THREE === 'undefined') {
                throw new Error('Three.js not loaded correctly');
            }

            this.canvas = document.getElementById('canvas3d');
            if (!this.canvas) {
                throw new Error('3D Canvas not found in DOM');
            }

            // Initialize subsystems
            this.initRaycaster();
            this.initSubsystems();

            this.isInitialized = true;
            console.log('[Scene3DCore] ✅ Core inizializzazione completata');

            return true;

        } catch (error) {
            console.error('[Scene3DCore] ❌ Errore inizializzazione:', error.message);
            this.isInitialized = false;
            return false;
        }
    }

    /**
     * Inizializza il raycaster per le interazioni
     */
    initRaycaster() {
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
    }

    /**
     * Inizializza i sottosistemi
     */
    initSubsystems() {
        // Initialize particle system if available
        if (window.ParticleSystem) {
            this.particleSystem = window.ParticleSystem;
            console.log('[Scene3DCore] ✅ Sistema particellare collegato');
        } else {
            console.log('[Scene3DCore] ⚠️ Sistema particellare non disponibile');
        }
    }

    /**
     * Aggiunge un modello alla scena
     */
    addModel(model, modelConfig = null) {
        if (!model) {
            console.warn('[Scene3DCore] Tentativo di aggiungere modello null');
            return;
        }

        this.scene.add(model);
        this.loadedModels.push(model);
        this.currentModel = model;

        // Salva posizione originale per il reset
        this.saveScenarioOriginalPosition(model);
        this.saveInitialModelPosition(model);

        console.log('[Scene3DCore] ✅ Modello aggiunto:', model.name || 'unnamed');
    }

    /**
     * Rimuove tutti i modelli dalla scena
     */
    clearAllModels() {
        this.loadedModels.forEach(model => {
            this.scene.remove(model);
        });
        this.loadedModels = [];
        this.currentModel = null;
        this.initialModelPositions.clear();
        this.scenarioOriginalPositions.clear();
    }

    /**
     * Evidenzia un modello
     */
    highlightModel(model, duration = null) {
        if (!model) return;

        // Remove previous highlight
        this.removeHighlight();

        // Save original materials
        this.saveOriginalMaterials(model);

        // Apply highlight
        this.applyHighlightMaterial(model);

        this.highlightSystem.highlightedModel = model;
        this.highlightSystem.isHighlighting = true;

        // Set auto-remove timer if duration specified
        if (duration) {
            this.highlightSystem.highlightTimer = setTimeout(() => {
                this.removeHighlight();
            }, duration);
        }

        console.log('[Scene3DCore] 🟡 Modello evidenziato:', model.name);
    }

    /**
     * Salva i materiali originali di un modello
     */
    saveOriginalMaterials(model) {
        const materials = new Map();

        model.traverse((child) => {
            if (child.isMesh && child.material) {
                materials.set(child.uuid, child.material);
            }
        });

        this.highlightSystem.originalMaterials.set(model.uuid, materials);
    }

    /**
     * Applica il materiale di evidenziazione
     */
    applyHighlightMaterial(model) {
        if (!this.highlightSystem.highlightMaterial) {
            this.highlightSystem.highlightMaterial = new THREE.MeshBasicMaterial({
                color: 0xffff00,
                transparent: true,
                opacity: 0.3
            });
        }

        model.traverse((child) => {
            if (child.isMesh) {
                child.material = this.highlightSystem.highlightMaterial;
            }
        });
    }

    /**
     * Rimuove l'evidenziazione
     */
    removeHighlight() {
        if (!this.highlightSystem.isHighlighting || !this.highlightSystem.highlightedModel) {
            return;
        }

        const model = this.highlightSystem.highlightedModel;
        const originalMaterials = this.highlightSystem.originalMaterials.get(model.uuid);

        if (originalMaterials) {
            model.traverse((child) => {
                if (child.isMesh && originalMaterials.has(child.uuid)) {
                    child.material = originalMaterials.get(child.uuid);
                }
            });
        }

        // Clear highlight timer
        if (this.highlightSystem.highlightTimer) {
            clearTimeout(this.highlightSystem.highlightTimer);
            this.highlightSystem.highlightTimer = null;
        }

        // Reset highlight state
        this.highlightSystem.highlightedModel = null;
        this.highlightSystem.isHighlighting = false;

        console.log('[Scene3DCore] 🔄 Evidenziazione rimossa');
    }

    /**
     * Evidenzia l'elemento del tutorial corrente
     */
    highlightCurrentTutorialElement() {
        if (!window.UI || typeof window.UI.getCurrentTutorialStep !== 'function') {
            console.warn('[Scene3DCore] UI o getCurrentTutorialStep non disponibile');
            return;
        }

        const currentStep = window.UI.getCurrentTutorialStep();
        if (!currentStep || !currentStep.Elemento) {
            return;
        }

        const modelName = currentStep.Elemento.replace(/^models\/|\.glb$|\.obj$/g, '');
        const model = this.findModelByName(modelName);

        if (model) {
            this.highlightModel(model);
            console.log('[Scene3DCore] 🎯 Elemento tutorial evidenziato:', modelName);
        }
    }

    /**
     * Trova un modello per nome
     */
    findModelByName(targetName) {
        if (!targetName) return null;

        // Check for _original suffix for position references
        const isOriginalReference = targetName.endsWith('_original');
        const baseTargetName = isOriginalReference ? targetName.replace('_original', '') : targetName;

        for (const model of this.loadedModels) {
            const modelName = (model.name || '').toLowerCase();
            const baseModelName = modelName.replace(/\.(glb|obj|gltf)$/i, '');

            if (baseModelName === baseTargetName.toLowerCase()) {
                if (isOriginalReference) {
                    return this.createOriginalPositionReference(model, targetName);
                }
                return model;
            }
        }

        return null;
    }

    /**
     * Crea un riferimento virtuale alla posizione originale
     */
    createOriginalPositionReference(model, referenceName) {
        const originalData = this.scenarioOriginalPositions.get(model.uuid);

        if (!originalData) {
            console.warn(`[Scene3DCore] Posizione originale non trovata per ${referenceName}`);
            return null;
        }

        // Create virtual object with original position
        const virtualRef = {
            name: referenceName,
            isOriginalReference: true,
            position: originalData.position.clone(),
            rotation: originalData.rotation.clone(),
            scale: originalData.scale.clone(),

            // Add essential methods for compatibility
            getWorldPosition: function(target) {
                return target.copy(this.position);
            }
        };

        console.log(`[Scene3DCore] 🎯 Riferimento _original creato: ${referenceName} at`, originalData.position);
        return virtualRef;
    }

    /**
     * Salva la posizione iniziale di un modello
     */
    saveInitialModelPosition(model) {
        if (!model || !model.uuid) return;

        this.initialModelPositions.set(model.uuid, {
            position: model.position.clone(),
            rotation: model.rotation.clone(),
            scale: model.scale.clone(),
            timestamp: Date.now()
        });

        console.log(`[Scene3DCore] 💾 Posizione iniziale salvata: ${model.name || model.uuid}`);
    }

    /**
     * Salva la posizione originale dello scenario
     */
    saveScenarioOriginalPosition(model) {
        if (!model || !model.uuid) return;

        this.scenarioOriginalPositions.set(model.uuid, {
            position: model.position.clone(),
            rotation: model.rotation.clone(),
            scale: model.scale.clone(),
            timestamp: Date.now()
        });

        console.log(`[Scene3DCore] 🎬 Posizione scenario originale salvata: ${model.name || model.uuid}`);
    }

    /**
     * Resetta tutti i modelli alle posizioni iniziali
     */
    resetAllModelsToInitialPositions(tutorialStep = null) {
        let resetCount = 0;

        for (const model of this.loadedModels) {
            const restored = this.resetModelToInitialPosition(model);
            if (restored) resetCount++;
        }

        // Apply model settings if tutorial step provided
        if (tutorialStep) {
            this.applyModelSettings(tutorialStep);
        }

        console.log(`[Scene3DCore] 🔄 Reset ${resetCount} modelli alle posizioni iniziali`);
        return resetCount;
    }

    /**
     * Reset singolo modello alla posizione iniziale
     */
    resetModelToInitialPosition(model) {
        if (!model || !model.uuid) return false;

        const savedData = this.initialModelPositions.get(model.uuid);
        if (!savedData) {
            console.warn(`[Scene3DCore] Nessuna posizione iniziale salvata per ${model.name || model.uuid}`);
            return false;
        }

        model.position.copy(savedData.position);
        model.rotation.copy(savedData.rotation);
        model.scale.copy(savedData.scale);

        console.log(`[Scene3DCore] ↩️ Modello ripristinato: ${model.name || model.uuid}`);
        return true;
    }

    /**
     * Tracciamento step tutorial
     */
    markStepAsCompleted(stepIndex) {
        this.tutorialTracker.completedSteps.add(stepIndex);

        if (window.UI && typeof window.UI.isLastTutorialStep === 'function') {
            this.tutorialTracker.lastStepCompleted = window.UI.isLastTutorialStep(stepIndex);

            if (this.tutorialTracker.lastStepCompleted) {
                this.tutorialTracker.interactionsBlocked = true;
                this.showTutorialCompletionCongratulations();
            }
        }
    }

    /**
     * Reset tutorial tracker
     */
    resetTutorialTracker() {
        this.tutorialTracker.completedSteps.clear();
        this.tutorialTracker.lastStepCompleted = false;
        this.tutorialTracker.interactionsBlocked = false;
        console.log('[Scene3DCore] 🔄 Tutorial tracker resettato');
    }

    /**
     * Mostra congratulazioni completamento tutorial
     */
    showTutorialCompletionCongratulations() {
        const userName = this.getCurrentUserName();
        const tutorialName = window.UI && window.UI.currentTutorial ?
            window.UI.currentTutorial.name || 'Tutorial' : 'Tutorial';

        this.displayCongratulationsModal(userName, tutorialName);
    }

    /**
     * Ottiene il nome utente corrente
     */
    getCurrentUserName() {
        // Try multiple sources for username
        if (window.currentUser && window.currentUser.username) {
            return window.currentUser.username;
        }

        try {
            const savedUser = localStorage.getItem('currentUser');
            if (savedUser) {
                const userData = JSON.parse(savedUser);
                return userData.username || 'Utente';
            }
        } catch (error) {
            console.warn('[Scene3DCore] Errore recupero username da localStorage:', error);
        }

        return 'Utente';
    }

    /**
     * Mostra modal congratulazioni
     */
    displayCongratulationsModal(userName, tutorialName) {
        // Remove existing modal if present
        this.removeCongratulationsModal();

        const modalHtml = `
            <div id="congratulationsModal" class="congratulations-modal">
                <div class="congratulations-content">
                    <h2>🎉 Congratulazioni ${userName}!</h2>
                    <p>Hai completato con successo il tutorial:</p>
                    <h3>"${tutorialName}"</h3>
                    <p>Ottimo lavoro! Puoi ora selezionare un nuovo tutorial o continuare l'esplorazione.</p>
                    <button id="congratulationsContinue" class="congratulations-button">Continua</button>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Add event listener
        const continueBtn = document.getElementById('congratulationsContinue');
        if (continueBtn) {
            continueBtn.addEventListener('click', () => {
                this.removeCongratulationsModal();
            });
        }

        console.log(`[Scene3DCore] 🎉 Congratulazioni mostrate per ${userName}`);
    }

    /**
     * Rimuove modal congratulazioni
     */
    removeCongratulationsModal() {
        const modal = document.getElementById('congratulationsModal');
        if (modal) {
            modal.remove();
        }
    }

    /**
     * Verifica se il modello è selezionabile
     */
    isModelSelectable(model) {
        if (!model || !model.name) return false;

        const modelName = model.name.toLowerCase();
        return !this.nonSelectableElements.some(element =>
            modelName.includes(element.toLowerCase())
        );
    }

    /**
     * Calcola il centro del bounding box di un modello
     */
    calculateBoundingBoxCenter(model) {
        if (!model) return new THREE.Vector3();

        const box = new THREE.Box3().setFromObject(model);
        const center = new THREE.Vector3();
        box.getCenter(center);
        return center;
    }

    /**
     * Export posizioni correnti modelli
     */
    exportCurrentModelPositions() {
        if (this.loadedModels.length === 0) {
            console.warn('[Scene3DCore] Nessun modello caricato da esportare');
            return;
        }

        const timestamp = new Date().toLocaleString('it-IT');
        let output = `# Posizioni e Rotazioni Modelli - Esportate automaticamente\n`;
        output += `# Generato il: ${timestamp}\n`;
        output += `# Sintassi: Posizione=nomeModello:(x,y,z) e Rotazione=nomeModello:(rx,ry,rz)\n\n`;

        this.loadedModels.forEach((model, index) => {
            const displayName = this.getModelDisplayName(model);
            const pos = model.position;
            const rot = model.rotation;

            // Convert rotation from radians to degrees
            const rotDeg = {
                x: (rot.x * 180 / Math.PI).toFixed(1),
                y: (rot.y * 180 / Math.PI).toFixed(1),
                z: (rot.z * 180 / Math.PI).toFixed(1)
            };

            output += `# Modello ${index + 1}: ${displayName}\n`;
            output += `Posizione=${displayName}:(${pos.x.toFixed(3)},${pos.y.toFixed(3)},${pos.z.toFixed(3)})\n`;
            output += `Rotazione=${displayName}:(${rotDeg.x},${rotDeg.y},${rotDeg.z})\n\n`;
        });

        console.log(output);
        this.downloadModelPositionsFile(output);
        return output;
    }

    /**
     * Ottiene nome display del modello
     */
    getModelDisplayName(model) {
        if (!model) return 'unknown';

        let name = model.name || 'unnamed';
        // Remove file extensions
        name = name.replace(/\.(glb|obj|gltf|mtl)$/i, '');
        return name;
    }

    /**
     * Download file posizioni
     */
    downloadModelPositionsFile(content) {
        try {
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-');
            const filename = `model_positions_${timestamp}.txt`;

            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            console.log(`[Scene3DCore] 📁 File esportato: ${filename}`);
        } catch (error) {
            console.warn('[Scene3DCore] Errore download file:', error);
        }
    }

    // === STUB METHODS FOR COMPATIBILITY ===
    // These will be implemented by the specific managers

    applyModelSettings(tutorialStep) {
        // To be implemented by RenderManager
        console.log('[Scene3DCore] applyModelSettings called - will be delegated to RenderManager');
    }

    // === TEST AND DEBUG METHODS ===

    /**
     * Test congratulazioni
     */
    testCongratulations() {
        this.displayCongratulationsModal('TestUser', 'Tutorial di Test');
    }

    /**
     * Test reset sistema
     */
    testPostTutorialBlockAndReset() {
        console.log('[Scene3DCore] 🧪 Test: Simulazione completamento tutorial...');

        this.tutorialTracker.lastStepCompleted = true;
        this.tutorialTracker.interactionsBlocked = true;
        this.showTutorialCompletionCongratulations();

        setTimeout(() => {
            console.log('[Scene3DCore] 🧪 Test: Simulazione reset...');
            this.resetTutorialTracker();
        }, 3000);
    }
}

// Export per uso come modulo
window.Scene3DCore_v2 = Scene3DCore;
export default Scene3DCore;