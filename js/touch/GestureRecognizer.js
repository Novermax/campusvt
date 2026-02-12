/**
 * GestureRecognizer - State Machine per riconoscimento gesture touch
 *
 * Gestisce:
 * - Single tap / Double tap (1 dito)
 * - Drag (1 dito)
 * - Two-finger tap / Double tap (2 dita)
 * - Pinch (zoom)
 * - Two-finger drag (rotazione)
 *
 * @version 1.0.0
 * @date Febbraio 2026
 */

window.GestureRecognizer = {

    // ═══════════════════════════════════════════════════════════
    // STATI
    // ═══════════════════════════════════════════════════════════
    STATES: {
        IDLE: 'IDLE',
        ONE_FINGER_DOWN: 'ONE_FINGER_DOWN',
        TWO_FINGER_DOWN: 'TWO_FINGER_DOWN',
        POTENTIAL_TAP: 'POTENTIAL_TAP',
        POTENTIAL_DOUBLE_TAP: 'POTENTIAL_DOUBLE_TAP',
        DRAGGING: 'DRAGGING',
        PINCHING: 'PINCHING',
        TWO_FINGER_DRAGGING: 'TWO_FINGER_DRAGGING',
        TWO_FINGER_POTENTIAL_TAP: 'TWO_FINGER_POTENTIAL_TAP'
    },

    // ═══════════════════════════════════════════════════════════
    // CONFIGURAZIONE THRESHOLD
    // ═══════════════════════════════════════════════════════════
    config: {
        TAP_MAX_DURATION: 250,          // ms - durata max per tap
        TAP_MAX_MOVEMENT: 15,           // px - movimento max per tap
        DOUBLE_TAP_MAX_INTERVAL: 300,   // ms - intervallo max tra tap
        DRAG_MIN_MOVEMENT: 10,          // px - movimento min per drag
        PINCH_MIN_DELTA: 20,            // px - delta distanza min per pinch
        ROTATION_MIN_MOVEMENT: 15       // px - movimento min per rotazione
    },

    // ═══════════════════════════════════════════════════════════
    // STATO INTERNO
    // ═══════════════════════════════════════════════════════════
    currentState: 'IDLE',
    startTouches: null,          // Touch points all'inizio del gesto
    lastTouches: null,           // Ultimi touch points
    gestureStartTime: 0,
    lastTapTime: 0,
    lastTapPosition: null,
    tapTimeoutId: null,
    initialPinchDistance: 0,
    isOnInteractiveElement: false, // Flag: tocco su elemento interattivo (fix touch2.txt)

    // Callbacks per eventi gesture
    onTap: null,
    onDoubleTap: null,
    onDragStart: null,
    onDragMove: null,
    onDragEnd: null,
    onPinchStart: null,
    onPinch: null,
    onPinchEnd: null,
    onTwoFingerDragStart: null,
    onTwoFingerDrag: null,
    onTwoFingerDragEnd: null,
    onTwoFingerTap: null,
    onTwoFingerDoubleTap: null,

    // ═══════════════════════════════════════════════════════════
    // INIZIALIZZAZIONE
    // ═══════════════════════════════════════════════════════════

    init: function() {
        this.currentState = this.STATES.IDLE;
        console.log('[GestureRecognizer] Inizializzato');
    },

    /**
     * Setta il flag "tocco su elemento interattivo"
     * Quando true, previene conversione tap → drag (fix touch2.txt)
     */
    setInteractiveElement: function(isInteractive) {
        this.isOnInteractiveElement = isInteractive;
        if (isInteractive) {
            console.log('[GestureRecognizer] 🎯 Tocco su elemento INTERATTIVO - blocco conversione tap→drag');
        }
    },

    /**
     * Reset flag interattivo
     */
    resetInteractiveFlag: function() {
        this.isOnInteractiveElement = false;
    },

    // ═══════════════════════════════════════════════════════════
    // HANDLER EVENTI TOUCH (chiamati da TouchEventDispatcher)
    // ═══════════════════════════════════════════════════════════

    handleTouchStart: function(event) {
        const touches = event.touches;
        const touchCount = touches.length;

        this.gestureStartTime = Date.now();
        this.startTouches = [...touches];
        this.lastTouches = [...touches];

        // Reset flag interattivo ad ogni nuovo gesto
        this.resetInteractiveFlag();

        switch (this.currentState) {
            case this.STATES.IDLE:
                if (touchCount === 1) {
                    this.transitionTo(this.STATES.ONE_FINGER_DOWN);
                } else if (touchCount === 2) {
                    this.initialPinchDistance = this.calculateDistance(touches[0], touches[1]);
                    this.transitionTo(this.STATES.TWO_FINGER_DOWN);
                }
                break;

            case this.STATES.POTENTIAL_DOUBLE_TAP:
                // Secondo tap iniziato
                if (touchCount === 1) {
                    this.clearTapTimeout();
                    this.transitionTo(this.STATES.ONE_FINGER_DOWN);
                }
                break;

            case this.STATES.ONE_FINGER_DOWN:
            case this.STATES.DRAGGING:
                // Aggiunto secondo dito
                if (touchCount === 2) {
                    if (this.currentState === this.STATES.DRAGGING) {
                        this.emitDragEnd(this.lastTouches[0]);
                    }
                    this.initialPinchDistance = this.calculateDistance(touches[0], touches[1]);
                    this.transitionTo(this.STATES.TWO_FINGER_DOWN);
                }
                break;
        }
    },

    handleTouchMove: function(event) {
        const touches = event.touches;
        const touchCount = touches.length;

        switch (this.currentState) {
            case this.STATES.ONE_FINGER_DOWN:
                if (touchCount === 1) {
                    const movement = this.calculateMovement(this.startTouches[0], touches[0]);

                    // 🎯 FIX touch2.txt: Se tocco è su elemento interattivo, NON convertire in drag
                    // Priorità assoluta ai pulsanti/trigger
                    if (this.isOnInteractiveElement) {
                        console.log('[GestureRecognizer] 🚫 Blocco conversione tap→drag (elemento interattivo)');
                        // Rimane in ONE_FINGER_DOWN, non passa a DRAGGING
                        break;
                    }

                    if (movement > this.config.DRAG_MIN_MOVEMENT) {
                        this.emitDragStart(touches[0]);
                        this.transitionTo(this.STATES.DRAGGING);
                    }
                }
                break;

            case this.STATES.DRAGGING:
                if (touchCount === 1) {
                    this.emitDragMove(touches[0]);
                }
                break;

            case this.STATES.TWO_FINGER_DOWN:
                if (touchCount === 2) {
                    const currentDistance = this.calculateDistance(touches[0], touches[1]);
                    const distanceDelta = Math.abs(currentDistance - this.initialPinchDistance);
                    const movement = this.calculateTwoFingerMovement(this.startTouches, touches);

                    // Determina se è pinch o rotazione
                    if (distanceDelta > this.config.PINCH_MIN_DELTA) {
                        this.emitPinchStart(touches);
                        this.transitionTo(this.STATES.PINCHING);
                    } else if (movement > this.config.ROTATION_MIN_MOVEMENT) {
                        this.emitTwoFingerDragStart(touches);
                        this.transitionTo(this.STATES.TWO_FINGER_DRAGGING);
                    }
                }
                break;

            case this.STATES.PINCHING:
                if (touchCount === 2) {
                    const currentDistance = this.calculateDistance(touches[0], touches[1]);
                    const scale = currentDistance / this.initialPinchDistance;
                    this.emitPinch(touches, scale);
                }
                break;

            case this.STATES.TWO_FINGER_DRAGGING:
                if (touchCount === 2) {
                    this.emitTwoFingerDrag(touches);
                }
                break;
        }

        this.lastTouches = [...touches];
    },

    handleTouchEnd: function(event) {
        const touches = event.touches;
        const changedTouches = event.changedTouches;
        const touchCount = touches.length;
        const duration = Date.now() - this.gestureStartTime;

        switch (this.currentState) {
            case this.STATES.ONE_FINGER_DOWN:
                if (touchCount === 0) {
                    const movement = this.calculateMovement(this.startTouches[0], changedTouches[0]);

                    if (duration < this.config.TAP_MAX_DURATION && movement < this.config.TAP_MAX_MOVEMENT) {
                        // Potenziale tap - verifica double tap
                        const timeSinceLastTap = Date.now() - this.lastTapTime;
                        const isNearLastTap = this.lastTapPosition ?
                            this.calculateMovement(this.lastTapPosition, changedTouches[0]) < this.config.TAP_MAX_MOVEMENT * 2 : false;

                        if (timeSinceLastTap < this.config.DOUBLE_TAP_MAX_INTERVAL && isNearLastTap) {
                            // Double tap!
                            this.clearTapTimeout();
                            this.emitDoubleTap(changedTouches[0]);
                            this.lastTapTime = 0;
                            this.lastTapPosition = null;
                            this.transitionTo(this.STATES.IDLE);
                        } else {
                            // Potenziale primo tap - attendi per vedere se arriva secondo
                            this.lastTapPosition = { ...changedTouches[0] };
                            this.transitionTo(this.STATES.POTENTIAL_DOUBLE_TAP);

                            this.tapTimeoutId = setTimeout(() => {
                                // Timeout scaduto - è un single tap
                                this.emitTap(this.lastTapPosition);
                                this.lastTapTime = Date.now();
                                this.transitionTo(this.STATES.IDLE);
                            }, this.config.DOUBLE_TAP_MAX_INTERVAL);
                        }
                    } else {
                        this.transitionTo(this.STATES.IDLE);
                    }
                }
                break;

            case this.STATES.DRAGGING:
                if (touchCount === 0) {
                    this.emitDragEnd(changedTouches[0]);
                    this.transitionTo(this.STATES.IDLE);
                }
                break;

            case this.STATES.TWO_FINGER_DOWN:
                if (touchCount === 0) {
                    const movement = this.calculateTwoFingerMovement(this.startTouches, changedTouches);

                    if (duration < this.config.TAP_MAX_DURATION && movement < this.config.TAP_MAX_MOVEMENT) {
                        // Two-finger tap
                        const timeSinceLastTap = Date.now() - this.lastTapTime;

                        if (timeSinceLastTap < this.config.DOUBLE_TAP_MAX_INTERVAL) {
                            this.emitTwoFingerDoubleTap(this.startTouches);
                            this.lastTapTime = 0;
                        } else {
                            this.emitTwoFingerTap(this.startTouches);
                            this.lastTapTime = Date.now();
                        }
                    }
                    this.transitionTo(this.STATES.IDLE);
                } else if (touchCount === 1) {
                    // Un dito rilasciato, torna a one finger
                    this.startTouches = [...touches];
                    this.transitionTo(this.STATES.ONE_FINGER_DOWN);
                }
                break;

            case this.STATES.PINCHING:
                if (touchCount < 2) {
                    this.emitPinchEnd();
                    if (touchCount === 1) {
                        this.startTouches = [...touches];
                        this.transitionTo(this.STATES.ONE_FINGER_DOWN);
                    } else {
                        this.transitionTo(this.STATES.IDLE);
                    }
                }
                break;

            case this.STATES.TWO_FINGER_DRAGGING:
                if (touchCount < 2) {
                    this.emitTwoFingerDragEnd();
                    if (touchCount === 1) {
                        this.startTouches = [...touches];
                        this.transitionTo(this.STATES.ONE_FINGER_DOWN);
                    } else {
                        this.transitionTo(this.STATES.IDLE);
                    }
                }
                break;

            case this.STATES.POTENTIAL_DOUBLE_TAP:
                // Secondo tap completato rapidamente - già gestito in ONE_FINGER_DOWN
                break;
        }

        this.lastTouches = touches.length > 0 ? [...touches] : null;
    },

    handleTouchCancel: function(event) {
        // Cancella qualsiasi gesture in corso
        switch (this.currentState) {
            case this.STATES.DRAGGING:
                this.emitDragEnd(this.lastTouches ? this.lastTouches[0] : null);
                break;
            case this.STATES.PINCHING:
                this.emitPinchEnd();
                break;
            case this.STATES.TWO_FINGER_DRAGGING:
                this.emitTwoFingerDragEnd();
                break;
        }

        this.clearTapTimeout();
        this.transitionTo(this.STATES.IDLE);
    },

    // ═══════════════════════════════════════════════════════════
    // UTILITY
    // ═══════════════════════════════════════════════════════════

    transitionTo: function(newState) {
        // console.log(`[GestureRecognizer] ${this.currentState} → ${newState}`);
        this.currentState = newState;
    },

    clearTapTimeout: function() {
        if (this.tapTimeoutId) {
            clearTimeout(this.tapTimeoutId);
            this.tapTimeoutId = null;
        }
    },

    calculateDistance: function(touch1, touch2) {
        const dx = touch2.canvasX - touch1.canvasX;
        const dy = touch2.canvasY - touch1.canvasY;
        return Math.sqrt(dx * dx + dy * dy);
    },

    calculateMovement: function(startTouch, endTouch) {
        if (!startTouch || !endTouch) return 0;
        const dx = endTouch.canvasX - startTouch.canvasX;
        const dy = endTouch.canvasY - startTouch.canvasY;
        return Math.sqrt(dx * dx + dy * dy);
    },

    calculateTwoFingerMovement: function(startTouches, endTouches) {
        if (!startTouches || !endTouches || startTouches.length < 2 || endTouches.length < 2) return 0;

        // Calcola movimento del centro
        const startCenterX = (startTouches[0].canvasX + startTouches[1].canvasX) / 2;
        const startCenterY = (startTouches[0].canvasY + startTouches[1].canvasY) / 2;
        const endCenterX = (endTouches[0].canvasX + endTouches[1].canvasX) / 2;
        const endCenterY = (endTouches[0].canvasY + endTouches[1].canvasY) / 2;

        const dx = endCenterX - startCenterX;
        const dy = endCenterY - startCenterY;
        return Math.sqrt(dx * dx + dy * dy);
    },

    calculateCenter: function(touches) {
        if (!touches || touches.length === 0) return null;

        let sumX = 0, sumY = 0, sumNormX = 0, sumNormY = 0;
        for (const touch of touches) {
            sumX += touch.canvasX;
            sumY += touch.canvasY;
            sumNormX += touch.normalizedX;
            sumNormY += touch.normalizedY;
        }

        return {
            canvasX: sumX / touches.length,
            canvasY: sumY / touches.length,
            normalizedX: sumNormX / touches.length,
            normalizedY: sumNormY / touches.length
        };
    },

    // ═══════════════════════════════════════════════════════════
    // EMITTERS
    // ═══════════════════════════════════════════════════════════

    emitTap: function(touch) {
        if (this.onTap) {
            this.onTap({
                type: 'tap',
                touch: touch,
                position: { x: touch.canvasX, y: touch.canvasY },
                normalized: { x: touch.normalizedX, y: touch.normalizedY }
            });
        }
    },

    emitDoubleTap: function(touch) {
        if (this.onDoubleTap) {
            this.onDoubleTap({
                type: 'doubletap',
                touch: touch,
                position: { x: touch.canvasX, y: touch.canvasY },
                normalized: { x: touch.normalizedX, y: touch.normalizedY }
            });
        }
    },

    emitDragStart: function(touch) {
        if (this.onDragStart) {
            this.onDragStart({
                type: 'dragstart',
                touch: touch,
                startTouch: this.startTouches[0],
                position: { x: touch.canvasX, y: touch.canvasY },
                normalized: { x: touch.normalizedX, y: touch.normalizedY }
            });
        }
    },

    emitDragMove: function(touch) {
        if (this.onDragMove) {
            const deltaX = touch.canvasX - (this.lastTouches ? this.lastTouches[0].canvasX : touch.canvasX);
            const deltaY = touch.canvasY - (this.lastTouches ? this.lastTouches[0].canvasY : touch.canvasY);

            this.onDragMove({
                type: 'dragmove',
                touch: touch,
                startTouch: this.startTouches[0],
                position: { x: touch.canvasX, y: touch.canvasY },
                normalized: { x: touch.normalizedX, y: touch.normalizedY },
                delta: { x: deltaX, y: deltaY }
            });
        }
    },

    emitDragEnd: function(touch) {
        if (this.onDragEnd) {
            this.onDragEnd({
                type: 'dragend',
                touch: touch,
                startTouch: this.startTouches ? this.startTouches[0] : null,
                position: touch ? { x: touch.canvasX, y: touch.canvasY } : null,
                normalized: touch ? { x: touch.normalizedX, y: touch.normalizedY } : null
            });
        }
    },

    emitPinchStart: function(touches) {
        if (this.onPinchStart) {
            this.onPinchStart({
                type: 'pinchstart',
                touches: touches,
                center: this.calculateCenter(touches),
                distance: this.initialPinchDistance
            });
        }
    },

    emitPinch: function(touches, scale) {
        if (this.onPinch) {
            const currentDistance = this.calculateDistance(touches[0], touches[1]);
            const lastDistance = this.lastTouches && this.lastTouches.length >= 2 ?
                this.calculateDistance(this.lastTouches[0], this.lastTouches[1]) : currentDistance;

            this.onPinch({
                type: 'pinch',
                touches: touches,
                center: this.calculateCenter(touches),
                scale: scale,
                distance: currentDistance,
                deltaDistance: currentDistance - lastDistance
            });
        }
    },

    emitPinchEnd: function() {
        if (this.onPinchEnd) {
            this.onPinchEnd({
                type: 'pinchend'
            });
        }
    },

    emitTwoFingerDragStart: function(touches) {
        if (this.onTwoFingerDragStart) {
            this.onTwoFingerDragStart({
                type: 'twofingerdragstart',
                touches: touches,
                center: this.calculateCenter(touches)
            });
        }
    },

    emitTwoFingerDrag: function(touches) {
        if (this.onTwoFingerDrag) {
            const center = this.calculateCenter(touches);
            const lastCenter = this.lastTouches ? this.calculateCenter(this.lastTouches) : center;

            this.onTwoFingerDrag({
                type: 'twofingerdrag',
                touches: touches,
                center: center,
                delta: {
                    x: center.canvasX - lastCenter.canvasX,
                    y: center.canvasY - lastCenter.canvasY
                }
            });
        }
    },

    emitTwoFingerDragEnd: function() {
        if (this.onTwoFingerDragEnd) {
            this.onTwoFingerDragEnd({
                type: 'twofingerdragend'
            });
        }
    },

    emitTwoFingerTap: function(touches) {
        if (this.onTwoFingerTap) {
            this.onTwoFingerTap({
                type: 'twofingertap',
                touches: touches,
                center: this.calculateCenter(touches)
            });
        }
    },

    emitTwoFingerDoubleTap: function(touches) {
        if (this.onTwoFingerDoubleTap) {
            this.onTwoFingerDoubleTap({
                type: 'twofingerdoubletap',
                touches: touches,
                center: this.calculateCenter(touches)
            });
        }
    },

    // ═══════════════════════════════════════════════════════════
    // DEBUG
    // ═══════════════════════════════════════════════════════════

    debugInfo: function() {
        console.log('═══════════════════════════════════════');
        console.log('👆 GestureRecognizer - Debug Info');
        console.log('═══════════════════════════════════════');
        console.log('Stato corrente:', this.currentState);
        console.log('Start touches:', this.startTouches);
        console.log('Last touches:', this.lastTouches);
        console.log('Gesture start time:', this.gestureStartTime);
        console.log('Last tap time:', this.lastTapTime);
        console.log('Config:', this.config);
        console.log('═══════════════════════════════════════');
    }
};
