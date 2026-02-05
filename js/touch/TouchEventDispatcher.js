/**
 * TouchEventDispatcher - Cattura e normalizza eventi touch
 *
 * Responsabilità:
 * - Cattura touchstart, touchmove, touchend, touchcancel
 * - Normalizza coordinate (canvas-relative + Three.js normalized)
 * - Passa eventi normalizzati a GestureRecognizer
 *
 * @version 1.0.0
 * @date Febbraio 2026
 */

window.TouchEventDispatcher = {

    // Riferimenti DOM
    canvas: null,
    canvasRect: null,

    // Callback per GestureRecognizer
    onTouchStart: null,
    onTouchMove: null,
    onTouchEnd: null,
    onTouchCancel: null,

    // Flag stato
    initialized: false,
    enabled: true,

    /**
     * Inizializza il dispatcher
     * @param {HTMLCanvasElement} canvas - Canvas Three.js
     */
    init: function(canvas) {
        if (this.initialized) {
            console.warn('[TouchEventDispatcher] Già inizializzato');
            return;
        }

        this.canvas = canvas;
        this.updateCanvasRect();

        // Bind event listeners
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
        this.canvas.addEventListener('touchcancel', this.handleTouchCancel.bind(this), { passive: false });

        // Aggiorna rect su resize
        window.addEventListener('resize', this.updateCanvasRect.bind(this));

        this.initialized = true;
        console.log('[TouchEventDispatcher] Inizializzato');
    },

    /**
     * Aggiorna le dimensioni del canvas
     */
    updateCanvasRect: function() {
        if (this.canvas) {
            this.canvasRect = this.canvas.getBoundingClientRect();
        }
    },

    /**
     * Normalizza un singolo touch point
     * @param {Touch} touch - Touch point raw
     * @returns {Object} Touch normalizzato
     */
    normalizeTouch: function(touch) {
        // Coordinate relative al canvas
        const canvasX = touch.clientX - this.canvasRect.left;
        const canvasY = touch.clientY - this.canvasRect.top;

        // Coordinate normalizzate Three.js (-1 a 1)
        const normalizedX = (canvasX / this.canvasRect.width) * 2 - 1;
        const normalizedY = -(canvasY / this.canvasRect.height) * 2 + 1;

        return {
            identifier: touch.identifier,
            clientX: touch.clientX,
            clientY: touch.clientY,
            canvasX: canvasX,
            canvasY: canvasY,
            normalizedX: normalizedX,
            normalizedY: normalizedY,
            timestamp: Date.now()
        };
    },

    /**
     * Normalizza tutti i touch points
     * @param {TouchList} touches - Lista touch raw
     * @returns {Array} Array di touch normalizzati
     */
    normalizeTouches: function(touches) {
        const normalized = [];
        for (let i = 0; i < touches.length; i++) {
            normalized.push(this.normalizeTouch(touches[i]));
        }
        return normalized;
    },

    /**
     * Handler touchstart
     */
    handleTouchStart: function(event) {
        if (!this.enabled) return;

        event.preventDefault();
        this.updateCanvasRect();

        const touches = this.normalizeTouches(event.touches);
        const changedTouches = this.normalizeTouches(event.changedTouches);

        if (this.onTouchStart) {
            this.onTouchStart({
                type: 'touchstart',
                touches: touches,
                changedTouches: changedTouches,
                originalEvent: event
            });
        }
    },

    /**
     * Handler touchmove
     */
    handleTouchMove: function(event) {
        if (!this.enabled) return;

        event.preventDefault();

        const touches = this.normalizeTouches(event.touches);
        const changedTouches = this.normalizeTouches(event.changedTouches);

        if (this.onTouchMove) {
            this.onTouchMove({
                type: 'touchmove',
                touches: touches,
                changedTouches: changedTouches,
                originalEvent: event
            });
        }
    },

    /**
     * Handler touchend
     */
    handleTouchEnd: function(event) {
        if (!this.enabled) return;

        event.preventDefault();

        const touches = this.normalizeTouches(event.touches);
        const changedTouches = this.normalizeTouches(event.changedTouches);

        if (this.onTouchEnd) {
            this.onTouchEnd({
                type: 'touchend',
                touches: touches,
                changedTouches: changedTouches,
                originalEvent: event
            });
        }
    },

    /**
     * Handler touchcancel
     */
    handleTouchCancel: function(event) {
        if (!this.enabled) return;

        const touches = this.normalizeTouches(event.touches);
        const changedTouches = this.normalizeTouches(event.changedTouches);

        if (this.onTouchCancel) {
            this.onTouchCancel({
                type: 'touchcancel',
                touches: touches,
                changedTouches: changedTouches,
                originalEvent: event
            });
        }
    },

    /**
     * Abilita/disabilita il dispatcher
     */
    setEnabled: function(enabled) {
        this.enabled = enabled;
        console.log(`[TouchEventDispatcher] ${enabled ? 'Abilitato' : 'Disabilitato'}`);
    },

    /**
     * Cleanup
     */
    destroy: function() {
        if (this.canvas) {
            this.canvas.removeEventListener('touchstart', this.handleTouchStart);
            this.canvas.removeEventListener('touchmove', this.handleTouchMove);
            this.canvas.removeEventListener('touchend', this.handleTouchEnd);
            this.canvas.removeEventListener('touchcancel', this.handleTouchCancel);
        }
        window.removeEventListener('resize', this.updateCanvasRect);
        this.initialized = false;
        console.log('[TouchEventDispatcher] Distrutto');
    }
};
