/**
 * CAMERA CONTROLS MODULE
 * VERSION: 1000010 - Modular Architecture
 * 
 * Handles all camera movement, mouse/touch controls, and camera interpolation.
 * Provides smooth camera movements with configurable sensitivity and limits.
 */

export class CameraControls {
    constructor(canvas, camera) {
        this.canvas = canvas;
        this.camera = camera;
        
        // Mouse/touch controls state
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
        
        // Touch controls
        this.touchControls = {
            lastPinchDistance: null,
            lastTwoFingerCenter: null,
            mobileMode: 'pan'
        };
        
        // Event handlers
        this.clickHandler = null;
        this.pivotClickHandler = null;
        
        this.initControls();
    }

    /**
     * Initialize mouse and touch controls
     */
    initControls() {
        const canvas = this.canvas;
        
        // Mouse event listeners
        canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        canvas.addEventListener('wheel', this.onMouseWheel.bind(this));
        
        // Touch event listeners (mobile devices)
        canvas.addEventListener('touchstart', this.onTouchStart.bind(this));
        canvas.addEventListener('touchmove', this.onTouchMove.bind(this));
        canvas.addEventListener('touchend', this.onTouchEnd.bind(this));
        
        // Prevent context menu
        canvas.addEventListener('contextmenu', function(e) {
            e.preventDefault();
        });
        
        AppConfig.log(3, 'Camera controls initialized');
    }

    /**
     * Set click handler for model clicks
     */
    setClickHandler(handler) {
        this.clickHandler = handler;
    }

    /**
     * Set pivot click handler for middle mouse clicks
     */
    setPivotClickHandler(handler) {
        this.pivotClickHandler = handler;
    }

    /**
     * Set pivot point for camera rotation/zoom
     */
    setPivotPoint(point) {
        this.mouseControls.pivotPoint.copy(point);
    }

    /**
     * Initialize interpolation targets with current camera position
     */
    initializeInterpolationTargets(position) {
        const currentSpherical = new THREE.Spherical();
        currentSpherical.setFromVector3(position);
        
        this.mouseControls.interpolation.targetRotation.theta = currentSpherical.theta;
        this.mouseControls.interpolation.targetRotation.phi = currentSpherical.phi;
        this.mouseControls.interpolation.targetZoom = currentSpherical.radius;
    }

    /**
     * Update interpolation targets with new position
     */
    updateInterpolationTargets(position) {
        const currentSpherical = new THREE.Spherical();
        currentSpherical.setFromVector3(position);
        
        this.mouseControls.interpolation.targetRotation.theta = currentSpherical.theta;
        this.mouseControls.interpolation.targetRotation.phi = currentSpherical.phi;
        this.mouseControls.interpolation.targetZoom = currentSpherical.radius;
    }

    /* ===== MOUSE EVENTS ===== */

    /**
     * Handle mousedown event
     */
    onMouseDown(event) {
        this.mouseControls.isMouseDown = true;
        this.mouseControls.mouseButton = event.button;
        this.mouseControls.lastPosition.x = event.clientX;
        this.mouseControls.lastPosition.y = event.clientY;
        
        event.preventDefault();
        
        // Prevent middle button default behavior
        if (event.button === 1) {
            event.stopPropagation();
        }
    }

    /**
     * Handle mousemove event
     */
    onMouseMove(event) {
        if (!this.mouseControls.isMouseDown) return;
        
        const deltaX = event.clientX - this.mouseControls.lastPosition.x;
        const deltaY = event.clientY - this.mouseControls.lastPosition.y;
        
        if (this.mouseControls.mouseButton === 0) {
            // Left button: only element selection (no camera movement)
            // Movement does nothing, selection happens in onMouseUp
        } else if (this.mouseControls.mouseButton === 1) {
            // Middle button/wheel: DISABLED temporarily
            // this.mouseControls.isPanning = true;
            // this.panCamera(deltaX, deltaY);
        } else if (this.mouseControls.mouseButton === 2) {
            // Right button: rotation
            this.rotateCamera(deltaX, deltaY);
        }
        
        this.mouseControls.lastPosition.x = event.clientX;
        this.mouseControls.lastPosition.y = event.clientY;
    }

    /**
     * Handle mouseup event
     */
    onMouseUp(event) {
        // Check for clicks on models (left button only and no dragging)
        if (event.button === 0 && this.clickHandler) {
            const deltaX = Math.abs(event.clientX - this.mouseControls.lastPosition.x);
            const deltaY = Math.abs(event.clientY - this.mouseControls.lastPosition.y);
            
            // Only if minimal movement (not a drag)
            if (deltaX < 5 && deltaY < 5) {
                this.clickHandler(event);
            }
        }
        
        // Check for pivot change with middle button
        if (event.button === 1 && this.pivotClickHandler) {
            const deltaX = Math.abs(event.clientX - this.mouseControls.lastPosition.x);
            const deltaY = Math.abs(event.clientY - this.mouseControls.lastPosition.y);
            
            // Only if minimal movement (not a drag/pan)
            if (deltaX < 5 && deltaY < 5) {
                this.pivotClickHandler(event);
            }
        }
        
        this.mouseControls.isMouseDown = false;
        this.mouseControls.isPanning = false;
        
        // Check if after pan we went below floor
        if (this.camera.position.y < this.mouseControls.limits.minY) {
            const currentSpherical = new THREE.Spherical();
            currentSpherical.setFromVector3(this.camera.position);
            currentSpherical.phi = Math.min(currentSpherical.phi, this.mouseControls.limits.maxPhi);
            
            this.camera.position.setFromSpherical(currentSpherical);
            this.camera.lookAt(0, 0, 0);
        }
    }

    /**
     * Handle mouse wheel (zoom)
     */
    onMouseWheel(event) {
        const rawDelta = event.deltaY;
        const normalizedDelta = rawDelta > 0 ? 100 : -100;
        const delta = normalizedDelta * this.mouseControls.sensitivity.zoom;
        this.zoomCamera(delta);
        event.preventDefault();
    }

    /* ===== TOUCH EVENTS (MOBILE) ===== */

    /**
     * Get current mobile mode from radio buttons
     */
    getMobileMode() {
        const checkedRadio = document.querySelector('input[name="mobileMode"]:checked');
        return checkedRadio ? checkedRadio.value : 'pan';
    }

    onTouchStart(event) {
        if (event.touches.length === 1) {
            this.mouseControls.isMouseDown = true;
            this.mouseControls.lastPosition.x = event.touches[0].clientX;
            this.mouseControls.lastPosition.y = event.touches[0].clientY;
            
            this.touchControls.mobileMode = this.getMobileMode();
            
        } else if (event.touches.length === 2) {
            this.mouseControls.isMouseDown = false;
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            
            // Save distance for pinch zoom
            this.touchControls.lastPinchDistance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) + 
                Math.pow(touch2.clientY - touch1.clientY, 2)
            );
            
            // Save center of two fingers for rotation
            this.touchControls.lastTwoFingerCenter = {
                x: (touch1.clientX + touch2.clientX) / 2,
                y: (touch1.clientY + touch2.clientY) / 2
            };
        }
        event.preventDefault();
    }

    onTouchMove(event) {
        if (event.touches.length === 1 && this.mouseControls.isMouseDown) {
            const deltaX = event.touches[0].clientX - this.mouseControls.lastPosition.x;
            const deltaY = event.touches[0].clientY - this.mouseControls.lastPosition.y;
            
            const mode = this.touchControls.mobileMode || 'pan';
            
            switch (mode) {
                case 'pan':
                    this.panCamera(deltaX, deltaY);
                    break;
                case 'rotate':
                    this.rotateCamera(deltaX, deltaY);
                    break;
                case 'zoom':
                    const zoomDelta = -deltaY * 0.01;
                    this.zoomCamera(zoomDelta);
                    break;
            }
            
            this.mouseControls.lastPosition.x = event.touches[0].clientX;
            this.mouseControls.lastPosition.y = event.touches[0].clientY;
            
        } else if (event.touches.length === 2) {
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
            
            if (this.touchControls.lastPinchDistance && this.touchControls.lastTwoFingerCenter) {
                // ZOOM: handle distance change between fingers
                const distanceDelta = (pinchDistance - this.touchControls.lastPinchDistance) * 0.01;
                if (Math.abs(distanceDelta) > 0.5) {
                    this.zoomCamera(distanceDelta);
                }
                
                // ROTATION: handle movement of center of two fingers
                const centerDeltaX = currentCenter.x - this.touchControls.lastTwoFingerCenter.x;
                const centerDeltaY = currentCenter.y - this.touchControls.lastTwoFingerCenter.y;
                
                const centerMovement = Math.sqrt(centerDeltaX * centerDeltaX + centerDeltaY * centerDeltaY);
                const distanceChange = Math.abs(pinchDistance - this.touchControls.lastPinchDistance);
                
                if (centerMovement > 5 && centerMovement > distanceChange * 0.5) {
                    this.rotateCamera(centerDeltaX, centerDeltaY);
                }
            }
            
            this.touchControls.lastPinchDistance = pinchDistance;
            this.touchControls.lastTwoFingerCenter = currentCenter;
        }
        event.preventDefault();
    }

    onTouchEnd(event) {
        this.mouseControls.isMouseDown = false;
        
        if (event.touches.length === 0) {
            this.touchControls.lastPinchDistance = null;
            this.touchControls.lastTwoFingerCenter = null;
        }
        
        event.preventDefault();
    }

    /* ===== CAMERA MOVEMENT ===== */

    /**
     * Pan camera (movement without interpolation)
     */
    panCamera(deltaX, deltaY) {
        const sensitivity = this.mouseControls.sensitivity.pan;
        
        // Save current rotation to restore after
        const savedQuaternion = this.camera.quaternion.clone();
        
        // LOCAL PAN: move according to camera view
        this.camera.updateMatrixWorld();
        
        // Get local direction vectors of camera
        const right = new THREE.Vector3();
        const up = new THREE.Vector3();
        
        this.camera.matrix.extractBasis(right, up, new THREE.Vector3());
        
        // Movement in camera local coordinates
        const movement = new THREE.Vector3();
        movement.addScaledVector(right, -deltaX * sensitivity);
        movement.addScaledVector(up, deltaY * sensitivity);
        
        // Apply movement
        this.camera.position.add(movement);
        
        // CRUCIAL: restore exactly the saved rotation
        this.camera.quaternion.copy(savedQuaternion);
    }

    /**
     * Rotate camera around origin (with smooth interpolation)
     */
    rotateCamera(deltaX, deltaY) {
        const sensitivity = this.mouseControls.sensitivity.rotation;
        const limits = this.mouseControls.limits;
        
        // Rotation around current pivot point
        const pivotPoint = this.mouseControls.pivotPoint;
        
        // Calculate position relative to pivot
        const relativePosition = new THREE.Vector3().subVectors(this.camera.position, pivotPoint);
        
        const spherical = new THREE.Spherical();
        spherical.setFromVector3(relativePosition);
        
        spherical.theta -= deltaX * sensitivity;
        spherical.phi += deltaY * sensitivity;
        
        // Apply limits
        spherical.phi = Math.max(limits.minPhi, Math.min(limits.maxPhi, spherical.phi));
        
        // Update camera position relative to pivot
        relativePosition.setFromSpherical(spherical);
        this.camera.position.copy(pivotPoint).add(relativePosition);
        this.camera.lookAt(pivotPoint);
    }

    /**
     * Zoom camera with smooth interpolation
     */
    zoomCamera(delta) {
        const limits = this.mouseControls.limits;
        
        // Zoom towards current pivot point
        const pivotPoint = this.mouseControls.pivotPoint;
        
        // Calculate position relative to pivot
        const relativePosition = new THREE.Vector3().subVectors(this.camera.position, pivotPoint);
        
        const spherical = new THREE.Spherical();
        spherical.setFromVector3(relativePosition);
        
        const zoomStep = delta > 0 ? 1.2 : 1/1.2;
        spherical.radius *= zoomStep;
        
        // Apply limits
        spherical.radius = Math.max(limits.minZoom, Math.min(limits.maxZoom, spherical.radius));
        
        // Update camera position relative to pivot
        relativePosition.setFromSpherical(spherical);
        this.camera.position.copy(pivotPoint).add(relativePosition);
        this.camera.lookAt(pivotPoint);
    }

    /**
     * Update camera position and rotation with smooth interpolation (lerp)
     */
    updateInterpolation() {
        if (!this.mouseControls.interpolation.enabled || this.mouseControls.isPanning) {
            return;
        }
        
        const interpolation = this.mouseControls.interpolation;
        const limits = this.mouseControls.limits;
        const factor = interpolation.factor;
        
        // Interpolation of rotation (spherical coordinates relative to pivot)
        const pivotPoint = this.mouseControls.pivotPoint;
        const relativePosition = new THREE.Vector3().subVectors(this.camera.position, pivotPoint);
        
        const currentSpherical = new THREE.Spherical();
        currentSpherical.setFromVector3(relativePosition);
        
        // Interpolate theta (horizontal rotation)
        const thetaDiff = interpolation.targetRotation.theta - currentSpherical.theta;
        if (Math.abs(thetaDiff) > interpolation.threshold) {
            currentSpherical.theta += thetaDiff * factor;
        }
        
        // Interpolate phi (vertical rotation) WITH LIMITS APPLIED
        let targetPhi = interpolation.targetRotation.phi;
        targetPhi = Math.max(limits.minPhi, Math.min(limits.maxPhi, targetPhi));
        const phiDiff = targetPhi - currentSpherical.phi;
        if (Math.abs(phiDiff) > interpolation.threshold) {
            currentSpherical.phi += phiDiff * factor;
        }
        
        // Apply limits again for safety
        currentSpherical.phi = Math.max(limits.minPhi, Math.min(limits.maxPhi, currentSpherical.phi));
        
        // Interpolate distance (zoom) WITH LIMITS
        let targetZoom = interpolation.targetZoom;
        targetZoom = Math.max(limits.minZoom, Math.min(limits.maxZoom, targetZoom));
        const distanceDiff = targetZoom - currentSpherical.radius;
        if (Math.abs(distanceDiff) > interpolation.threshold) {
            currentSpherical.radius += distanceDiff * factor;
        }
        
        // Apply zoom limits
        currentSpherical.radius = Math.max(limits.minZoom, Math.min(limits.maxZoom, currentSpherical.radius));
        
        // Apply new position from spherical coordinate relative to pivot
        relativePosition.setFromSpherical(currentSpherical);
        this.camera.position.copy(pivotPoint).add(relativePosition);
        this.camera.lookAt(pivotPoint);
        
        // Update targets to keep them synchronized WITH LIMITS
        interpolation.targetRotation.theta = currentSpherical.theta;
        interpolation.targetRotation.phi = currentSpherical.phi;
        interpolation.targetZoom = currentSpherical.radius;
    }
}