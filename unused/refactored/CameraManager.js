/**
 * CameraManager.js - Gestione avanzata camera e controlli
 *
 * Responsabilità:
 * - Controlli mouse/touch per camera (rotazione, pan, zoom)
 * - Sistema pivot dinamico con animazioni fluide
 * - Animazioni camera per tutorial
 * - Gestione transizioni fluide e easing
 * - Mouse/touch event handling
 *
 * Versione: 2.0 Refactored
 * Data: Dicembre 2025
 */

class CameraManager {
    constructor(scene3DCore) {
        this.core = scene3DCore;

        // Camera controls state
        this.mouseControls = {
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
        };

        // Camera animation system
        this.cameraAnimation = {
            isActive: false,
            startTime: 0,
            duration: 1000,
            startPosition: null,
            targetPosition: null,
            startTarget: null,
            targetTarget: null,
            easingFunction: this.smoothStep
        };

        // Pivot animation system
        this.pivotAnimation = {
            isAnimating: false,
            startTime: 0,
            duration: 0.8,
            startPivot: null,
            targetPivot: null,
            startCameraPosition: null,
            targetCameraPosition: null
        };
    }

    /**
     * Inizializza i controlli camera
     */
    initControls() {
        const canvas = this.core.canvas;
        if (!canvas) {
            console.error('[CameraManager] Canvas non disponibile per i controlli');
            return;
        }

        // Mouse events
        canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        canvas.addEventListener('wheel', (e) => this.onMouseWheel(e));

        // Touch events for mobile
        canvas.addEventListener('touchstart', (e) => this.onTouchStart(e));
        canvas.addEventListener('touchmove', (e) => this.onTouchMove(e));
        canvas.addEventListener('touchend', (e) => this.onTouchEnd(e));

        // Prevent context menu
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        console.log('[CameraManager] ✅ Controlli camera inizializzati');
    }

    /**
     * Mouse down handler
     */
    onMouseDown(event) {
        this.mouseControls.isMouseDown = true;
        this.mouseControls.mouseButton = event.button;
        this.mouseControls.lastPosition.x = event.clientX;
        this.mouseControls.lastPosition.y = event.clientY;

        this.mouseControls.isPanning = (event.button === 2); // Right click

        // Handle pivot click (middle mouse button)
        if (event.button === 1) {
            this.handlePivotClick(event);
        }
    }

    /**
     * Mouse move handler
     */
    onMouseMove(event) {
        if (!this.mouseControls.isMouseDown) return;

        const deltaX = event.clientX - this.mouseControls.lastPosition.x;
        const deltaY = event.clientY - this.mouseControls.lastPosition.y;

        if (this.mouseControls.isPanning) {
            this.panCamera(deltaX, deltaY);
        } else {
            this.rotateCamera(deltaX, deltaY);
        }

        this.mouseControls.lastPosition.x = event.clientX;
        this.mouseControls.lastPosition.y = event.clientY;
    }

    /**
     * Mouse up handler
     */
    onMouseUp(event) {
        this.mouseControls.isMouseDown = false;
        this.mouseControls.isPanning = false;

        // Handle model click for interactions
        if (event.button === 0) { // Left click
            this.handleModelClick(event);
        }
    }

    /**
     * Mouse wheel handler for zoom
     */
    onMouseWheel(event) {
        event.preventDefault();
        const delta = event.deltaY > 0 ? 1 : -1;
        this.zoomCamera(delta);
    }

    /**
     * Touch start handler
     */
    onTouchStart(event) {
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            this.mouseControls.isMouseDown = true;
            this.mouseControls.lastPosition.x = touch.clientX;
            this.mouseControls.lastPosition.y = touch.clientY;
        }
    }

    /**
     * Touch move handler
     */
    onTouchMove(event) {
        event.preventDefault();

        if (event.touches.length === 1 && this.mouseControls.isMouseDown) {
            const touch = event.touches[0];
            const deltaX = touch.clientX - this.mouseControls.lastPosition.x;
            const deltaY = touch.clientY - this.mouseControls.lastPosition.y;

            this.rotateCamera(deltaX, deltaY);

            this.mouseControls.lastPosition.x = touch.clientX;
            this.mouseControls.lastPosition.y = touch.clientY;
        }
    }

    /**
     * Touch end handler
     */
    onTouchEnd(event) {
        this.mouseControls.isMouseDown = false;
    }

    /**
     * Rotate camera around pivot point
     */
    rotateCamera(deltaX, deltaY) {
        if (!this.core.camera) return;

        const sensitivity = this.mouseControls.sensitivity.rotation;
        const pivotPoint = this.mouseControls.pivotPoint;

        // Calculate current spherical coordinates relative to pivot
        const offset = new THREE.Vector3().subVectors(this.core.camera.position, pivotPoint);
        const spherical = new THREE.Spherical().setFromVector3(offset);

        // Apply rotation
        spherical.theta -= deltaX * sensitivity;
        spherical.phi += deltaY * sensitivity;

        // Apply limits
        spherical.phi = Math.max(this.mouseControls.limits.minPhi,
                                Math.min(this.mouseControls.limits.maxPhi, spherical.phi));

        // Update camera position
        offset.setFromSpherical(spherical);
        this.core.camera.position.copy(pivotPoint).add(offset);

        // Ensure camera looks at pivot and is above ground
        this.core.camera.position.y = Math.max(this.mouseControls.limits.minY, this.core.camera.position.y);
        this.core.camera.lookAt(pivotPoint);
    }

    /**
     * Pan camera
     */
    panCamera(deltaX, deltaY) {
        if (!this.core.camera) return;

        const sensitivity = this.mouseControls.sensitivity.pan;
        const camera = this.core.camera;

        // Calculate pan vectors in camera space
        const panX = new THREE.Vector3();
        const panY = new THREE.Vector3();

        camera.getWorldDirection(panY);
        panX.crossVectors(panY, camera.up).normalize();
        panY.crossVectors(camera.up, panX).normalize();

        // Apply pan movement
        const panVector = new THREE.Vector3()
            .addScaledVector(panX, -deltaX * sensitivity)
            .addScaledVector(panY, deltaY * sensitivity);

        camera.position.add(panVector);
        this.mouseControls.pivotPoint.add(panVector);
    }

    /**
     * Zoom camera
     */
    zoomCamera(delta) {
        if (!this.core.camera) return;

        const sensitivity = this.mouseControls.sensitivity.zoom;
        const pivotPoint = this.mouseControls.pivotPoint;
        const camera = this.core.camera;

        // Calculate zoom direction
        const direction = new THREE.Vector3().subVectors(pivotPoint, camera.position).normalize();
        const zoomVector = direction.multiplyScalar(delta * sensitivity);

        // Apply zoom with limits
        const newPosition = camera.position.clone().add(zoomVector);
        const distance = newPosition.distanceTo(pivotPoint);

        if (distance >= this.mouseControls.limits.minZoom &&
            distance <= this.mouseControls.limits.maxZoom) {
            camera.position.copy(newPosition);
        }
    }

    /**
     * Handle pivot click - animates camera to new pivot point
     */
    handlePivotClick(event) {
        if (!this.core.camera || !this.core.raycaster) return;

        // Calculate mouse position in normalized device coordinates
        const rect = this.core.canvas.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );

        // Perform raycast
        this.core.raycaster.setFromCamera(mouse, this.core.camera);
        const intersects = this.core.raycaster.intersectObjects(this.core.loadedModels, true);

        if (intersects.length > 0) {
            const intersection = intersects[0];
            const clickedObject = intersection.object;

            // Find root model
            const rootModel = this.findRootModel(clickedObject);
            if (rootModel && this.core.isModelSelectable(rootModel)) {
                // Calculate new pivot point (center of clicked model)
                const newPivotPoint = this.core.calculateBoundingBoxCenter(rootModel);
                this.animateCameraToPivot(newPivotPoint);

                console.log('[CameraManager] 🎯 Nuovo pivot:', rootModel.name || 'unnamed');
            }
        }
    }

    /**
     * Animate camera to new pivot point
     */
    animateCameraToPivot(newPivotPoint) {
        if (!newPivotPoint || this.pivotAnimation.isAnimating) return;

        const camera = this.core.camera;
        const currentPivot = this.mouseControls.pivotPoint.clone();
        const currentCameraPos = camera.position.clone();

        // Calculate target camera position maintaining relative distance and direction
        const currentOffset = new THREE.Vector3().subVectors(currentCameraPos, currentPivot);
        const targetCameraPos = new THREE.Vector3().addVectors(newPivotPoint, currentOffset);

        // Setup animation
        this.pivotAnimation = {
            isAnimating: true,
            startTime: performance.now(),
            duration: 0.8 * 1000, // 0.8 seconds in milliseconds
            startPivot: currentPivot,
            targetPivot: newPivotPoint.clone(),
            startCameraPosition: currentCameraPos,
            targetCameraPosition: targetCameraPos
        };

        console.log('[CameraManager] 🎬 Inizio animazione pivot fluida');
    }

    /**
     * Update pivot animation
     */
    updatePivotAnimation() {
        if (!this.pivotAnimation.isAnimating) return;

        const elapsed = performance.now() - this.pivotAnimation.startTime;
        const progress = Math.min(elapsed / this.pivotAnimation.duration, 1.0);

        // Smooth easing
        const easedProgress = this.smoothStep(progress);

        // Interpolate pivot point
        this.mouseControls.pivotPoint.lerpVectors(
            this.pivotAnimation.startPivot,
            this.pivotAnimation.targetPivot,
            easedProgress
        );

        // Interpolate camera position
        this.core.camera.position.lerpVectors(
            this.pivotAnimation.startCameraPosition,
            this.pivotAnimation.targetCameraPosition,
            easedProgress
        );

        // Always look at current pivot
        this.core.camera.lookAt(this.mouseControls.pivotPoint);

        // Check if animation is complete
        if (progress >= 1.0) {
            this.pivotAnimation.isAnimating = false;
            console.log('[CameraManager] ✅ Animazione pivot completata');
        }
    }

    /**
     * Handle model click for interactions
     */
    handleModelClick(event) {
        if (!this.core.camera || !this.core.raycaster) return;

        // Check if interactions are blocked
        if (this.core.tutorialTracker.interactionsBlocked) {
            console.log('[CameraManager] ❌ Interazioni bloccate - tutorial completato');
            return;
        }

        // Calculate mouse position
        const rect = this.core.canvas.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );

        // Perform raycast
        this.core.raycaster.setFromCamera(mouse, this.core.camera);
        const intersects = this.core.raycaster.intersectObjects(this.core.loadedModels, true);

        if (intersects.length > 0) {
            const intersection = intersects[0];
            const clickedObject = intersection.object;
            const rootModel = this.findRootModel(clickedObject);

            if (rootModel && this.core.isModelSelectable(rootModel)) {
                // Handle air tool effect
                this.handleAirToolEffect(intersection, event);

                // Handle model action (from AnimationSystem)
                if (window.Scene3D && window.Scene3D.handleModelAction) {
                    window.Scene3D.handleModelAction(rootModel);
                }
            }
        }
    }

    /**
     * Handle air tool particle effect
     */
    handleAirToolEffect(intersection, event) {
        // Check if air tool is active
        const activeTool = window.UI ? window.UI.getActiveTool() : null;
        if (activeTool !== 'aria' && activeTool !== 'Aria') return;

        // Check if particle system is available
        if (!this.core.particleSystem || typeof this.core.particleSystem.createAirJet !== 'function') {
            console.log('[CameraManager] ⚠️ Sistema particellare non disponibile per tool Aria');
            return;
        }

        // Get cursor position in 3D space
        const cursorPosition3D = this.getCursorPosition3D(event);
        if (!cursorPosition3D) return;

        // Calculate jet direction (toward intersection point)
        const jetDirection = new THREE.Vector3()
            .subVectors(intersection.point, cursorPosition3D)
            .normalize();

        // Create air jet effect
        const airJetId = this.core.particleSystem.createAirJet(cursorPosition3D, jetDirection, {
            particleCount: 600,
            life: 1.2,
            speed: { min: 20, max: 40 },
            spread: { x: 0.3, y: 0.3, z: 0.3 }
        });

        console.log('[CameraManager] 💨 Effetto aria creato:', airJetId);
    }

    /**
     * Get cursor position in 3D space
     */
    getCursorPosition3D(mouseEvent) {
        if (!this.core.camera) return null;

        const rect = this.core.canvas.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((mouseEvent.clientX - rect.left) / rect.width) * 2 - 1,
            -((mouseEvent.clientY - rect.top) / rect.height) * 2 + 1
        );

        // Project from camera position in the direction of the mouse
        const direction = new THREE.Vector3(mouse.x, mouse.y, 0.5).unproject(this.core.camera);
        direction.sub(this.core.camera.position).normalize();

        // Calculate position at a reasonable distance from camera
        const distance = 0.5;
        return this.core.camera.position.clone().add(direction.multiplyScalar(distance));
    }

    /**
     * Find root model from clicked object
     */
    findRootModel(clickedObject) {
        let current = clickedObject;

        while (current && current.parent) {
            if (this.core.loadedModels.includes(current)) {
                return current;
            }
            current = current.parent;
        }

        return this.core.loadedModels.find(model =>
            this.isDescendantOf(clickedObject, model)
        );
    }

    /**
     * Check if child is descendant of parent
     */
    isDescendantOf(child, parent) {
        let current = child;
        while (current) {
            if (current === parent) return true;
            current = current.parent;
        }
        return false;
    }

    /**
     * Start camera animation for tutorials
     */
    startCameraAnimation(startPos, targetPos, startTarget, targetTarget, duration = 1000) {
        this.cameraAnimation = {
            isActive: true,
            startTime: performance.now(),
            duration: duration,
            startPosition: startPos.clone(),
            targetPosition: targetPos.clone(),
            startTarget: startTarget.clone(),
            targetTarget: targetTarget.clone(),
            easingFunction: this.smoothStep
        };

        console.log('[CameraManager] 🎬 Animazione camera avviata');
    }

    /**
     * Update camera animation
     */
    updateCameraAnimation() {
        if (!this.cameraAnimation.isActive) return;

        const elapsed = performance.now() - this.cameraAnimation.startTime;
        const progress = Math.min(elapsed / this.cameraAnimation.duration, 1.0);
        const easedProgress = this.cameraAnimation.easingFunction(progress);

        // Interpolate camera position
        this.core.camera.position.lerpVectors(
            this.cameraAnimation.startPosition,
            this.cameraAnimation.targetPosition,
            easedProgress
        );

        // Interpolate camera target
        const currentTarget = new THREE.Vector3().lerpVectors(
            this.cameraAnimation.startTarget,
            this.cameraAnimation.targetTarget,
            easedProgress
        );

        this.core.camera.lookAt(currentTarget);

        // Update pivot point to match current target
        this.mouseControls.pivotPoint.copy(currentTarget);

        // Check if animation is complete
        if (progress >= 1.0) {
            this.cameraAnimation.isActive = false;
            console.log('[CameraManager] ✅ Animazione camera completata');
        }
    }

    /**
     * Smooth step easing function
     */
    smoothStep(t) {
        return t * t * (3 - 2 * t);
    }

    /**
     * Apply camera settings from tutorial step
     */
    applyCameraSettings(tutorialStep) {
        if (!tutorialStep || !this.core.camera) return;

        let cameraChanged = false;

        // Handle camera position
        if (tutorialStep.CameraPos) {
            const coords = this.parseCameraCoordinates(tutorialStep.CameraPos);
            if (coords) {
                const startPos = this.core.camera.position.clone();
                const targetPos = new THREE.Vector3(coords.x, coords.y, coords.z);
                const startTarget = this.mouseControls.pivotPoint.clone();
                let targetTarget = startTarget.clone();

                // Handle camera target
                if (tutorialStep.CameraTarget) {
                    const targetCoords = this.parseCameraTarget(tutorialStep.CameraTarget);
                    if (targetCoords) {
                        targetTarget = targetCoords;
                        this.mouseControls.pivotPoint.copy(targetTarget);
                    }
                }

                // Start smooth camera animation
                this.startCameraAnimation(startPos, targetPos, startTarget, targetTarget, 1500);
                cameraChanged = true;
            }
        }

        if (cameraChanged) {
            this.core.manualCameraSet = true;
            console.log('[CameraManager] 📹 Impostazioni camera applicate dal tutorial');
        }
    }

    /**
     * Parse camera coordinates
     */
    parseCameraCoordinates(coordString) {
        if (!coordString) return null;

        const match = coordString.match(/\(([^)]+)\)/);
        if (!match) return null;

        const coords = match[1].split(',').map(s => parseFloat(s.trim()));
        if (coords.length !== 3 || coords.some(isNaN)) return null;

        return { x: coords[0], y: coords[1], z: coords[2] };
    }

    /**
     * Parse camera target (can be coordinates or object name)
     */
    parseCameraTarget(targetString) {
        if (!targetString) return null;

        // Try to parse as coordinates first
        const coords = this.parseCameraCoordinates(targetString);
        if (coords) {
            return new THREE.Vector3(coords.x, coords.y, coords.z);
        }

        // Try to find object by name
        const model = this.core.findModelByName(targetString);
        if (model) {
            return this.core.calculateBoundingBoxCenter(model);
        }

        console.warn('[CameraManager] Impossibile parsare camera target:', targetString);
        return null;
    }

    /**
     * Save current camera view
     */
    saveCurrentView() {
        if (!this.core.camera) return;

        this.core.savedView = {
            position: this.core.camera.position.clone(),
            target: this.mouseControls.pivotPoint.clone(),
            timestamp: Date.now()
        };

        console.log('[CameraManager] 💾 Vista camera salvata');
    }

    /**
     * Get camera info for debugging
     */
    getCameraInfo() {
        if (!this.core.camera) return null;

        const pos = this.core.camera.position;
        const target = this.mouseControls.pivotPoint;

        const info = {
            position: `(${pos.x.toFixed(3)},${pos.y.toFixed(3)},${pos.z.toFixed(3)})`,
            target: `(${target.x.toFixed(3)},${target.y.toFixed(3)},${target.z.toFixed(3)})`,
            distance: pos.distanceTo(target).toFixed(3)
        };

        console.log('[CameraManager] 📹 Camera Info:');
        console.log(`Posizione: ${info.position}`);
        console.log(`Target: ${info.target}`);
        console.log(`Distanza: ${info.distance}`);

        // Format for tutorial.txt
        console.log('\n📝 Sintassi per tutorial.txt:');
        console.log(`CameraPos=${info.position}`);
        console.log(`CameraTarget=${info.target}`);

        return info;
    }

    /**
     * Handle window resize
     */
    onWindowResize() {
        if (!this.core.camera || !this.core.renderer) return;

        const width = window.innerWidth;
        const height = window.innerHeight;

        this.core.camera.aspect = width / height;
        this.core.camera.updateProjectionMatrix();
        this.core.renderer.setSize(width, height);

        console.log('[CameraManager] 🔄 Resize camera:', width, 'x', height);
    }

    /**
     * Update camera animations (called from render loop)
     */
    update() {
        this.updateCameraAnimation();
        this.updatePivotAnimation();
    }
}

// Export for use as module
window.CameraManager = CameraManager;
export default CameraManager;