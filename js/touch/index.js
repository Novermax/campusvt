/**
 * TouchSystem - Sistema Touch Gesture per Campus Virtual Training
 *
 * Modulo principale che inizializza e coordina tutti i componenti touch:
 * - TouchEventDispatcher: Cattura eventi raw
 * - GestureRecognizer: Riconosce gesture (tap, drag, pinch, ecc.)
 * - TouchInputRouter: Distribuisce gesture ai handler appropriati
 * - TouchCameraHandler: Controlli camera (zoom, rotazione, pivot)
 * - TouchDragHandler: Drag & drop oggetti 3D
 * - TouchUIHandler: Interazioni UI
 * - TouchInteractive3DHandler: Pulsanti 3D interattivi
 *
 * @version 1.0.0
 * @date Febbraio 2026
 */

window.TouchSystem = {

    // Stato
    initialized: false,
    enabled: true,

    // Riferimenti moduli
    dispatcher: null,
    recognizer: null,
    router: null,
    cameraHandler: null,
    dragHandler: null,
    uiHandler: null,
    interactive3DHandler: null,

    // ═══════════════════════════════════════════════════════════
    // INIZIALIZZAZIONE
    // ═══════════════════════════════════════════════════════════

    /**
     * Inizializza il sistema touch
     * @param {HTMLCanvasElement} canvas - Canvas Three.js
     */
    init: function(canvas) {
        if (this.initialized) {
            console.warn('[TouchSystem] Già inizializzato');
            return;
        }

        if (!canvas) {
            console.error('[TouchSystem] Canvas non fornito');
            return;
        }

        console.log('[TouchSystem] 📱 Inizializzazione sistema touch...');

        // 1. Inizializza handler
        this.cameraHandler = window.TouchCameraHandler;
        this.cameraHandler.init();

        this.dragHandler = window.TouchDragHandler;
        this.dragHandler.init();

        this.uiHandler = window.TouchUIHandler;
        this.uiHandler.init();

        this.interactive3DHandler = window.TouchInteractive3DHandler;
        this.interactive3DHandler.init();

        // 2. Inizializza recognizer PRIMA del router (fix touch2.txt)
        this.recognizer = window.GestureRecognizer;
        this.recognizer.init();

        // 3. Inizializza router e registra handler + recognizer
        this.router = window.TouchInputRouter;
        this.router.init();
        this.router.registerHandlers({
            camera: this.cameraHandler,
            drag: this.dragHandler,
            ui: this.uiHandler,
            interactive3D: this.interactive3DHandler,
            gestureRecognizer: this.recognizer // Fix touch2.txt: passa recognizer al router
        });

        // 4. Collega callbacks recognizer → router
        this.connectRecognizerCallbacks();

        // 5. Inizializza dispatcher e collega a recognizer
        this.dispatcher = window.TouchEventDispatcher;
        this.dispatcher.init(canvas);
        this.connectDispatcherCallbacks();

        // 6. Imposta CSS per touch
        this.setupTouchCSS(canvas);

        this.initialized = true;
        console.log('[TouchSystem] ✅ Sistema touch inizializzato');
    },

    /**
     * Collega callbacks del dispatcher al recognizer
     */
    connectDispatcherCallbacks: function() {
        const self = this;

        this.dispatcher.onTouchStart = function(event) {
            if (!self.enabled) return;
            self.recognizer.handleTouchStart(event);
            // 🎯 Controlla SUBITO se il tocco è su un elemento interattivo/draggabile.
            // Questo setta il flag sul GestureRecognizer PRIMA di qualsiasi touchMove,
            // impedendo che piccoli tremori del dito convertano il tap in drag/rotazione camera.
            if (self.router && self.router.checkAndSetInteractiveFlag) {
                self.router.checkAndSetInteractiveFlag(event);
            }
        };

        this.dispatcher.onTouchMove = function(event) {
            if (!self.enabled) return;
            self.recognizer.handleTouchMove(event);

            // 👻 Aggiorna ghost target se c'è un oggetto selezionato in modalità placement
            // (modifica_touch.txt §"Ghost Target (solo touch)")
            if (self.dragHandler && self.dragHandler.hasSelectedObject()) {
                self.dragHandler.handleGhostMove(event);
            }
        };

        this.dispatcher.onTouchEnd = function(event) {
            if (!self.enabled) return;
            self.recognizer.handleTouchEnd(event);
        };

        this.dispatcher.onTouchCancel = function(event) {
            if (!self.enabled) return;
            self.recognizer.handleTouchCancel(event);
        };
    },

    /**
     * Collega callbacks del recognizer al router
     */
    connectRecognizerCallbacks: function() {
        const router = this.router;

        // Single finger gestures
        this.recognizer.onTap = function(event) {
            router.routeTap(event);
        };

        this.recognizer.onDoubleTap = function(event) {
            router.routeDoubleTap(event);
        };

        this.recognizer.onDragStart = function(event) {
            router.routeDragStart(event);
        };

        this.recognizer.onDragMove = function(event) {
            router.routeDragMove(event);
        };

        this.recognizer.onDragEnd = function(event) {
            router.routeDragEnd(event);
        };

        // Two finger gestures
        this.recognizer.onPinchStart = function(event) {
            router.routePinchStart(event);
        };

        this.recognizer.onPinch = function(event) {
            router.routePinch(event);
        };

        this.recognizer.onPinchEnd = function(event) {
            router.routePinchEnd(event);
        };

        this.recognizer.onTwoFingerDragStart = function(event) {
            router.routeTwoFingerDragStart(event);
        };

        this.recognizer.onTwoFingerDrag = function(event) {
            router.routeTwoFingerDrag(event);
        };

        this.recognizer.onTwoFingerDragEnd = function(event) {
            router.routeTwoFingerDragEnd(event);
        };

        this.recognizer.onTwoFingerTap = function(event) {
            router.routeTwoFingerTap(event);
        };

        this.recognizer.onTwoFingerDoubleTap = function(event) {
            router.routeTwoFingerDoubleTap(event);
        };
    },

    /**
     * Imposta CSS per gestione touch
     */
    setupTouchCSS: function(canvas) {
        // Disabilita gesture browser native sul canvas
        canvas.style.touchAction = 'none';

        // Previeni selezione testo
        canvas.style.webkitUserSelect = 'none';
        canvas.style.userSelect = 'none';

        // Previeni zoom su double-tap (iOS)
        canvas.style.webkitTouchCallout = 'none';

        console.log('[TouchSystem] CSS touch applicato al canvas');
    },

    // ═══════════════════════════════════════════════════════════
    // CONTROLLI
    // ═══════════════════════════════════════════════════════════

    /**
     * Abilita/disabilita sistema touch
     */
    setEnabled: function(enabled) {
        this.enabled = enabled;

        if (this.dispatcher) {
            this.dispatcher.setEnabled(enabled);
        }

        console.log(`[TouchSystem] ${enabled ? 'Abilitato' : 'Disabilitato'}`);
    },

    /**
     * Verifica se il dispositivo supporta touch
     */
    isTouchDevice: function() {
        return 'ontouchstart' in window ||
               navigator.maxTouchPoints > 0 ||
               navigator.msMaxTouchPoints > 0;
    },

    /**
     * Verifica se il dispositivo è mobile
     */
    isMobileDevice: function() {
        if (window.isMobileDevice) {
            return window.isMobileDevice();
        }

        const mobileKeywords = ['Android', 'iPhone', 'iPad', 'iPod', 'webOS', 'BlackBerry', 'Opera Mini', 'IEMobile'];
        const userAgent = navigator.userAgent;
        return mobileKeywords.some(k => userAgent.includes(k));
    },

    // ═══════════════════════════════════════════════════════════
    // CONFIGURAZIONE
    // ═══════════════════════════════════════════════════════════

    /**
     * Aggiorna configurazione gesture
     */
    setGestureConfig: function(config) {
        if (this.recognizer && config) {
            Object.assign(this.recognizer.config, config);
            console.log('[TouchSystem] Configurazione gesture aggiornata:', config);
        }
    },

    /**
     * Aggiorna configurazione camera
     */
    setCameraConfig: function(config) {
        if (this.cameraHandler && config) {
            Object.assign(this.cameraHandler.config, config);
            console.log('[TouchSystem] Configurazione camera aggiornata:', config);
        }
    },

    // ═══════════════════════════════════════════════════════════
    // DEBUG
    // ═══════════════════════════════════════════════════════════

    debugInfo: function() {
        console.log('═══════════════════════════════════════════════════════');
        console.log('📱 TouchSystem - Debug Info');
        console.log('═══════════════════════════════════════════════════════');
        console.log('Initialized:', this.initialized);
        console.log('Enabled:', this.enabled);
        console.log('Is Touch Device:', this.isTouchDevice());
        console.log('Is Mobile Device:', this.isMobileDevice());
        console.log('───────────────────────────────────────────────────────');

        if (this.dispatcher) {
            console.log('Dispatcher: Attivo');
        }

        if (this.recognizer) {
            console.log('Recognizer State:', this.recognizer.currentState);
        }

        if (this.router) {
            console.log('Router Current Layer:', this.router.getLayerName(this.router.currentLayer));
        }

        console.log('═══════════════════════════════════════════════════════');

        // Debug singoli componenti
        console.log('\n--- Componenti ---');
        if (this.recognizer) this.recognizer.debugInfo();
        if (this.router) this.router.debugInfo();
        if (this.cameraHandler) this.cameraHandler.debugInfo();
        if (this.dragHandler) this.dragHandler.debugInfo();
    },

    // ═══════════════════════════════════════════════════════════
    // CLEANUP
    // ═══════════════════════════════════════════════════════════

    destroy: function() {
        if (this.dispatcher) {
            this.dispatcher.destroy();
        }

        this.initialized = false;
        console.log('[TouchSystem] Distrutto');
    }
};

// Auto-log quando il modulo è caricato
console.log('[TouchSystem] Modulo caricato');
