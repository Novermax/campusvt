/**
 * TouchCameraHandler - Gestione controlli camera via touch
 *
 * Responsabilità:
 * - Pinch → Zoom camera
 * - Two-finger drag → Rotazione camera attorno pivot
 * - Two-finger double tap → Imposta nuovo pivot camera
 *
 * @version 1.0.0
 * @date Febbraio 2026
 */

window.TouchCameraHandler = {

    // ═══════════════════════════════════════════════════════════
    // CONFIGURAZIONE
    // ═══════════════════════════════════════════════════════════
    config: {
        zoomSensitivity: 0.003,       // ⚙️ Sensibilità zoom RIDOTTA (era 0.01)
        zoomMin: 0.5,                  // Zoom minimo
        zoomMax: 10,                   // Zoom massimo
        rotateSensitivity: 0.005,      // Sensibilità rotazione (DISABILITATA via router)
        pivotAnimationDuration: 0.8    // Durata animazione pivot (secondi)
    },

    // Stato
    initialized: false,
    isPinching: false,
    isRotating: false,
    lastPinchDistance: 0,

    // ═══════════════════════════════════════════════════════════
    // INIZIALIZZAZIONE
    // ═══════════════════════════════════════════════════════════

    init: function() {
        this.initialized = true;
        console.log('[TouchCameraHandler] Inizializzato');
    },

    // ═══════════════════════════════════════════════════════════
    // PINCH (ZOOM)
    // ═══════════════════════════════════════════════════════════

    handlePinchStart: function(event) {
        this.isPinching = true;
        this.lastPinchDistance = event.distance;
        // console.log('[TouchCameraHandler] Pinch START, distance:', event.distance);
    },

    handlePinch: function(event) {
        if (!this.isPinching) return;
        if (!window.Scene3D) return;

        // Calcola delta zoom
        const deltaDistance = event.deltaDistance;
        const zoomDelta = deltaDistance * this.config.zoomSensitivity;

        // Applica zoom
        if (window.Scene3D.zoomCamera) {
            window.Scene3D.zoomCamera(-zoomDelta);
        } else if (window.Scene3D.controls) {
            // Fallback: modifica direttamente la distanza
            const controls = window.Scene3D.controls;
            const currentDistance = controls.getDistance ? controls.getDistance() : 5;
            const newDistance = Math.max(
                this.config.zoomMin,
                Math.min(this.config.zoomMax, currentDistance - zoomDelta)
            );

            // OrbitControls - modifica target-to-camera distance
            if (controls.dollyIn && controls.dollyOut) {
                if (zoomDelta > 0) {
                    controls.dollyIn(1 + Math.abs(zoomDelta) * 0.1);
                } else {
                    controls.dollyOut(1 + Math.abs(zoomDelta) * 0.1);
                }
            }
        }
    },

    handlePinchEnd: function(event) {
        this.isPinching = false;
        // console.log('[TouchCameraHandler] Pinch END');
    },

    // ═══════════════════════════════════════════════════════════
    // TWO-FINGER DRAG (ROTAZIONE)
    // ═══════════════════════════════════════════════════════════

    handleTwoFingerDragStart: function(event) {
        this.isRotating = true;
        // console.log('[TouchCameraHandler] Two-finger drag START');
    },

    handleTwoFingerDrag: function(event) {
        if (!this.isRotating) return;
        if (!window.Scene3D) return;

        const deltaX = event.delta.x;
        const deltaY = event.delta.y;

        // Applica rotazione
        if (window.Scene3D.rotateCamera) {
            window.Scene3D.rotateCamera(
                deltaX * this.config.rotateSensitivity,
                deltaY * this.config.rotateSensitivity
            );
        } else if (window.Scene3D.controls) {
            // Fallback: modifica direttamente OrbitControls
            const controls = window.Scene3D.controls;

            // Simula rotazione modificando angoli sferici
            if (controls.rotateLeft && controls.rotateUp) {
                controls.rotateLeft(deltaX * this.config.rotateSensitivity);
                controls.rotateUp(deltaY * this.config.rotateSensitivity);
            } else {
                // Manipolazione diretta per OrbitControls standard
                const spherical = new THREE.Spherical();
                const offset = new THREE.Vector3();

                offset.copy(window.Scene3D.camera.position).sub(controls.target);
                spherical.setFromVector3(offset);

                spherical.theta -= deltaX * this.config.rotateSensitivity;
                spherical.phi -= deltaY * this.config.rotateSensitivity;

                // Clamp phi per evitare flip
                spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

                offset.setFromSpherical(spherical);
                window.Scene3D.camera.position.copy(controls.target).add(offset);
                window.Scene3D.camera.lookAt(controls.target);
            }

            controls.update();
        }
    },

    handleTwoFingerDragEnd: function(event) {
        this.isRotating = false;
        // console.log('[TouchCameraHandler] Two-finger drag END');
    },

    // ═══════════════════════════════════════════════════════════
    // TWO-FINGER DOUBLE TAP (PIVOT)
    // ═══════════════════════════════════════════════════════════

    handleTwoFingerDoubleTap: function(event, hitPoint) {
        if (!hitPoint) {
            console.log('[TouchCameraHandler] Two-finger double tap - nessun punto di hit');
            return;
        }

        console.log('[TouchCameraHandler] 🎯 Impostazione nuovo pivot:', hitPoint);

        // Usa il metodo Scene3D per animare verso il nuovo pivot
        if (window.Scene3D && window.Scene3D.animateCameraToPivot) {
            window.Scene3D.animateCameraToPivot(hitPoint, this.config.pivotAnimationDuration);
        } else if (window.Scene3D && window.Scene3D.controls) {
            // Fallback: imposta target direttamente con animazione TWEEN
            const controls = window.Scene3D.controls;
            const startTarget = controls.target.clone();
            const endTarget = hitPoint.clone();

            if (window.TWEEN) {
                new TWEEN.Tween({ t: 0 })
                    .to({ t: 1 }, this.config.pivotAnimationDuration * 1000)
                    .easing(TWEEN.Easing.Quadratic.InOut)
                    .onUpdate(function(obj) {
                        controls.target.lerpVectors(startTarget, endTarget, obj.t);
                        controls.update();
                    })
                    .start();
            } else {
                // Senza TWEEN, imposta direttamente
                controls.target.copy(hitPoint);
                controls.update();
            }
        }
    },

    // ═══════════════════════════════════════════════════════════
    // DEBUG
    // ═══════════════════════════════════════════════════════════

    debugInfo: function() {
        console.log('═══════════════════════════════════════');
        console.log('📷 TouchCameraHandler - Debug Info');
        console.log('═══════════════════════════════════════');
        console.log('Is Pinching:', this.isPinching);
        console.log('Is Rotating:', this.isRotating);
        console.log('Config:', this.config);

        if (window.Scene3D && window.Scene3D.controls) {
            const controls = window.Scene3D.controls;
            console.log('Camera Position:', window.Scene3D.camera.position);
            console.log('Camera Target:', controls.target);
        }
        console.log('═══════════════════════════════════════');
    }
};
