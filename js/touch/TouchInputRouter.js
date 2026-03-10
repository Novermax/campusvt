/**
 * TouchInputRouter - Sistema di routing eventi touch con priorità
 *
 * Responsabilità:
 * - Determina il layer dell'elemento toccato (UI, Interactive3D, Object3D, Camera)
 * - Distribuisce gesture ai handler appropriati
 * - Gestisce priorità: UI (3) > Interactive3D (2) > Object3D (1) > Camera (0)
 *
 * @version 1.0.0
 * @date Febbraio 2026
 */

window.TouchInputRouter = {

    // ═══════════════════════════════════════════════════════════
    // PRIORITÀ LAYER
    // ═══════════════════════════════════════════════════════════
    LAYERS: {
        UI: 3,              // Elementi HTML UI (legenda, pulsanti, fumetto)
        INTERACTIVE_3D: 2,  // Pulsanti 3D interattivi (button, rotary)
        OBJECT_3D: 1,       // Modelli 3D draggabili
        CAMERA: 0           // Nessun elemento - controllo camera
    },

    // Riferimenti handler
    uiHandler: null,
    dragHandler: null,
    cameraHandler: null,
    interactive3DHandler: null,
    gestureRecognizer: null, // Riferimento al GestureRecognizer (fix touch2.txt)

    // Stato
    initialized: false,
    currentLayer: null,
    currentTarget: null,

    // Raycaster Three.js
    raycaster: null,
    mouse: null,

    // ═══════════════════════════════════════════════════════════
    // INIZIALIZZAZIONE
    // ═══════════════════════════════════════════════════════════

    init: function() {
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.initialized = true;
        console.log('[TouchInputRouter] Inizializzato');
    },

    /**
     * Registra handler e GestureRecognizer
     */
    registerHandlers: function(handlers) {
        this.uiHandler = handlers.ui || null;
        this.dragHandler = handlers.drag || null;
        this.cameraHandler = handlers.camera || null;
        this.interactive3DHandler = handlers.interactive3D || null;
        this.gestureRecognizer = handlers.gestureRecognizer || null; // Fix touch2.txt
    },

    // ═══════════════════════════════════════════════════════════
    // DETERMINAZIONE LAYER
    // ═══════════════════════════════════════════════════════════

    /**
     * Determina il layer dell'elemento toccato
     * @param {Object} touchEvent - Evento touch normalizzato
     * @returns {Object} { layer, target, hitPoint }
     */
    determineLayer: function(touchEvent) {
        const touch = touchEvent.touch || touchEvent.touches[0];
        if (!touch) return { layer: this.LAYERS.CAMERA, target: null, hitPoint: null };

        // 1. Controlla elementi UI HTML
        const uiTarget = this.checkUIElements(touch.clientX, touch.clientY);
        if (uiTarget) {
            return { layer: this.LAYERS.UI, target: uiTarget, hitPoint: null };
        }

        // 2. Controlla elementi 3D con raycast multi-punto (più sensibile al tocco dita)
        const raycastResult = this.performRaycastMultiPoint(touch.normalizedX, touch.normalizedY);

        if (raycastResult) {
            // 2a. È un elemento interattivo (pulsante 3D)?
            if (this.isInteractive3DElement(raycastResult.object)) {
                // 🎯 FIX touch2.txt: Notifica GestureRecognizer per bloccare drag
                if (this.gestureRecognizer) {
                    this.gestureRecognizer.setInteractiveElement(true);
                }

                return {
                    layer: this.LAYERS.INTERACTIVE_3D,
                    target: raycastResult.object,
                    hitPoint: raycastResult.point
                };
            }

            // 2b. PRIORITÀ CERCHIO: se il tocco cade dentro un cerchio giallo lampeggiante,
            // trattalo come tap sul pulsante associato ANCHE se il raycast ha colpito un altro oggetto.
            // Questo garantisce che toccando dentro il cerchio giallo il pulsante viene sempre attivato,
            // anche se il dito colpisce la superficie del modello sottostante (es. corpo pulpito).
            const circleHit = this.checkHighlightCircleHit(touch.clientX, touch.clientY);
            if (circleHit) {
                if (this.gestureRecognizer) {
                    this.gestureRecognizer.setInteractiveElement(true);
                }
                console.log(`[TouchInputRouter] 🟡 Cerchio giallo ha priorità su raycast (oggetto colpito: ${raycastResult.object.name})`);
                return {
                    layer: this.LAYERS.INTERACTIVE_3D,
                    target: circleHit.mesh,
                    hitPoint: raycastResult.point
                };
            }

            // 2c. È un oggetto 3D draggabile?
            if (this.isDraggableObject(raycastResult.object)) {
                return {
                    layer: this.LAYERS.OBJECT_3D,
                    target: raycastResult.object,
                    hitPoint: raycastResult.point
                };
            }

            // 2d. È un oggetto 3D qualsiasi (per selezione/pivot)
            const rootModel = this.findRootModel(raycastResult.object);
            if (rootModel) {
                return {
                    layer: this.LAYERS.OBJECT_3D,
                    target: rootModel,
                    hitPoint: raycastResult.point
                };
            }
        }

        // 2e. Fallback cerchio evidenziatore senza raycast: se il tocco cade dentro un cerchio giallo
        // ma il raycast non ha colpito nulla (es. tocco sul bordo del cerchio fuori dal modello)
        const circleHitFallback = this.checkHighlightCircleHit(touch.clientX, touch.clientY);
        if (circleHitFallback) {
            if (this.gestureRecognizer) {
                this.gestureRecognizer.setInteractiveElement(true);
            }
            return {
                layer: this.LAYERS.INTERACTIVE_3D,
                target: circleHitFallback.mesh,
                hitPoint: null
            };
        }

        // 3. Nessun elemento - camera control
        return { layer: this.LAYERS.CAMERA, target: null, hitPoint: null };
    },

    /**
     * Controlla se il tocco cade dentro un cerchio evidenziatore giallo attivo.
     * Se sì, restituisce la mesh del pulsante associato al cerchio.
     * @param {number} clientX - Coordinata X del tocco (pixel schermo)
     * @param {number} clientY - Coordinata Y del tocco (pixel schermo)
     * @returns {Object|null} { mesh, triggerId } oppure null
     */
    checkHighlightCircleHit: function(clientX, clientY) {
        const mgr = window.Scene3D && window.Scene3D.highlightCircleManager;
        if (!mgr || !mgr.isEnabled || mgr.circles.size === 0) return null;

        // Margine extra in pixel oltre il cerchio visibile per compensare imprecisione dita
        const TOUCH_MARGIN = 15;

        for (const [triggerId, circleData] of mgr.circles) {
            const { element, mesh, size } = circleData;
            if (!mesh || !element || element.style.display === 'none') continue;

            // Posizione centro cerchio (CSS left/top)
            const cx = parseFloat(element.style.left);
            const cy = parseFloat(element.style.top);
            if (isNaN(cx) || isNaN(cy)) continue;

            // Raggio del cerchio in pixel (metà dimensione) + margine touch extra
            const radius = (size / 2) + TOUCH_MARGIN;

            // Distanza dal centro del cerchio
            const dx = clientX - cx;
            const dy = clientY - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= radius) {
                console.log(`[TouchInputRouter] 🟡 Tocco dentro cerchio evidenziatore "${triggerId}" (dist: ${dist.toFixed(1)}px, raggio: ${radius}px, margine: ${TOUCH_MARGIN}px)`);
                return { mesh, triggerId };
            }
        }

        return null;
    },

    /**
     * Verifica se ci sono elementi UI HTML alle coordinate
     */
    checkUIElements: function(clientX, clientY) {
        const elements = document.elementsFromPoint(clientX, clientY);

        for (const element of elements) {
            // Skip canvas
            if (element.tagName === 'CANVAS') continue;

            // Controlla se è un elemento UI interattivo
            if (this.isUIElement(element)) {
                return element;
            }
        }

        return null;
    },

    /**
     * Verifica se un elemento HTML è UI interattiva
     */
    isUIElement: function(element) {
        // Pulsanti e link
        if (element.tagName === 'BUTTON' || element.tagName === 'A') return true;

        // Elementi con onclick
        if (element.onclick) return true;

        // Classi specifiche UI
        const uiClasses = [
            'strumento-item',      // Legenda strumenti
            'navigation-btn',      // Pulsanti navigazione
            'fumetto',             // Fumetto tutorial
            'step-indicator',      // Indicatori step
            'auto-mode-toggle',    // Pulsante AutoMode
            'info-modal',          // Modal informativi
            'btn',                 // Pulsanti generici
            'clickable'            // Elementi cliccabili
        ];

        for (const cls of uiClasses) {
            if (element.classList.contains(cls)) return true;
        }

        // Elementi all'interno di contenitori UI
        const uiContainers = [
            '#strumenti-legenda',
            '#navigation-controls',
            '#fumetto-container',
            '#infoModal',
            '.modal'
        ];

        for (const selector of uiContainers) {
            if (element.closest(selector)) return true;
        }

        return false;
    },

    /**
     * Esegue raycast 3D su singolo punto
     */
    performRaycast: function(normalizedX, normalizedY) {
        if (!window.Scene3D || !window.Scene3D.camera || !window.Scene3D.scene) {
            return null;
        }

        this.mouse.set(normalizedX, normalizedY);
        this.raycaster.setFromCamera(this.mouse, window.Scene3D.camera);

        const intersects = this.raycaster.intersectObjects(window.Scene3D.scene.children, true);

        // Filtra oggetti validi (escludi helper, griglie, ecc.)
        for (const intersect of intersects) {
            const object = intersect.object;

            // Salta oggetti invisibili o helper
            if (!object.visible) continue;
            if (object.name && object.name.includes('Helper')) continue;
            if (object.name && object.name.includes('Grid')) continue;

            // Salta ghost mesh del TouchDragHandler (non deve intercettare raycast)
            if (object.name === '__ghost_target__') continue;
            // Salta anche se è figlio di un ghost
            let isGhostChild = false;
            let p = object.parent;
            while (p) {
                if (p.name === '__ghost_target__') { isGhostChild = true; break; }
                p = p.parent;
            }
            if (isGhostChild) continue;

            // Salta il pavimento per tap/selezione (ma non per pivot 2 dita)
            if (object.name === 'floor' || object.name === 'ground' || object.name === 'piano') {
                continue;
            }

            return {
                object: object,
                point: intersect.point.clone(),
                distance: intersect.distance
            };
        }

        return null;
    },

    /**
     * Raycast multi-punto: prova il centro + 8 punti adiacenti (~12px di raggio)
     * Compensare la larghezza delle dita su touchscreen (~40-50px)
     */
    performRaycastMultiPoint: function(normalizedX, normalizedY) {
        // Prova prima il punto esatto
        const centerResult = this.performRaycast(normalizedX, normalizedY);
        if (centerResult) return centerResult;

        // Calcola offset in coordinate normalizzate (circa 20px su schermo tipico mobile)
        // FIX: Aumentato da 12px a 20px per migliorare selezione touch di oggetti piccoli (viti)
        const canvas = document.getElementById('canvas3d');
        const cw = canvas ? canvas.clientWidth : 400;
        const ch = canvas ? canvas.clientHeight : 700;
        const ox = 20 / cw * 2;
        const oy = 20 / ch * 2;

        // 8 punti attorno al centro (croce + diagonali)
        const offsets = [
            { x:  0,  y:  oy }, // sopra
            { x:  0,  y: -oy }, // sotto
            { x: -ox, y:   0 }, // sinistra
            { x:  ox, y:   0 }, // destra
            { x: -ox, y:  oy }, // alto-sinistra
            { x:  ox, y:  oy }, // alto-destra
            { x: -ox, y: -oy }, // basso-sinistra
            { x:  ox, y: -oy }  // basso-destra
        ];

        for (const off of offsets) {
            const result = this.performRaycast(normalizedX + off.x, normalizedY + off.y);
            if (result) return result;
        }

        return null;
    },

    /**
     * Controlla immediatamente al touchStart se il tocco è su un elemento
     * interattivo o draggabile, e setta il flag sul GestureRecognizer.
     * Questo previene la conversione tap→drag prima ancora che il movimento inizi.
     */
    checkAndSetInteractiveFlag: function(touchEvent) {
        const touch = touchEvent.touch || (touchEvent.touches && touchEvent.touches[0]);
        if (!touch) return;

        // Salta se non è un tocco singolo (pinch/gesture a 2 dita non bloccate)
        if (touchEvent.touches && touchEvent.touches.length !== 1) return;

        // Usa raycast multi-punto per massimizzare il rilevamento
        const raycastResult = this.performRaycastMultiPoint(touch.normalizedX, touch.normalizedY);

        if (!raycastResult) {
            // Fallback: controlla se il tocco cade dentro un cerchio evidenziatore
            const circleHit = this.checkHighlightCircleHit(touch.clientX, touch.clientY);
            if (circleHit && this.gestureRecognizer) {
                this.gestureRecognizer.setInteractiveElement(true);
                console.log('[TouchInputRouter] 🟡 Flag interattivo settato via cerchio evidenziatore:', circleHit.triggerId);
            }
            return;
        }

        const isInteractive = this.isInteractive3DElement(raycastResult.object);
        const isDraggable = this.isDraggableObject(raycastResult.object);

        // Se l'oggetto è interattivo O draggabile (ha senso bloccarlo), setta il flag
        if (isInteractive || isDraggable) {
            if (this.gestureRecognizer) {
                this.gestureRecognizer.setInteractiveElement(true);
                console.log('[TouchInputRouter] 🎯 Flag interattivo settato al touchStart per:', raycastResult.object.name);
            }
        }
    },

    /**
     * Raycast includendo il pavimento (per pivot 2 dita)
     */
    performRaycastIncludeFloor: function(normalizedX, normalizedY) {
        if (!window.Scene3D || !window.Scene3D.camera || !window.Scene3D.scene) {
            return null;
        }

        this.mouse.set(normalizedX, normalizedY);
        this.raycaster.setFromCamera(this.mouse, window.Scene3D.camera);

        const intersects = this.raycaster.intersectObjects(window.Scene3D.scene.children, true);

        for (const intersect of intersects) {
            const object = intersect.object;
            if (!object.visible) continue;
            if (object.name && object.name.includes('Helper')) continue;
            if (object.name && object.name.includes('Grid')) continue;

            return {
                object: object,
                point: intersect.point.clone(),
                distance: intersect.distance
            };
        }

        return null;
    },

    /**
     * Verifica se è un elemento interattivo 3D (pulsante)
     * PRIORITÀ ASSOLUTA per pulsanti in ActiveButtons dello step corrente
     */
    isInteractive3DElement: function(object) {
        if (!object) return false;

        // PRIORITÀ 1: Controlla se è in ActiveButtons dello step corrente (fix touch2.txt)
        if (this.isActiveButton(object)) {
            console.log('[TouchInputRouter] 🎯 Pulsante ATTIVO rilevato:', object.name);
            return true;
        }

        // PRIORITÀ 2: Controlla userData
        if (object.userData && object.userData.interactive) return true;
        if (object.userData && object.userData.interactiveConfig) return true;

        // PRIORITÀ 3: Controlla parent
        let parent = object.parent;
        while (parent) {
            if (parent.userData && parent.userData.interactive) return true;
            if (parent.userData && parent.userData.interactiveConfig) return true;

            // Controlla anche se il parent è in ActiveButtons
            if (this.isActiveButton(parent)) {
                console.log('[TouchInputRouter] 🎯 Parent ATTIVO rilevato:', parent.name);
                return true;
            }

            parent = parent.parent;
        }

        return false;
    },

    /**
     * Verifica se l'oggetto è in ActiveButtons dello step corrente
     * Questo garantisce priorità assoluta ai pulsanti configurati nello step
     */
    isActiveButton: function(object) {
        if (!object || !object.name) return false;

        // Verifica se c'è un tutorial attivo
        if (!window.UI || !window.UI.tutorialSteps || window.UI.currentStepIndex < 0) {
            return false;
        }

        const currentStep = window.UI.tutorialSteps[window.UI.currentStepIndex];
        if (!currentStep || !currentStep.properties) return false;

        // Controlla ActiveButtons
        const activeButtons = currentStep.properties.ActiveButtons;
        if (!activeButtons) return false;

        const activeButtonsList = activeButtons.split(',').map(b => b.trim());

        // Normalizza nome oggetto (rimuovi estensioni e parent path)
        let objectName = object.name.replace(/\.(glb|gltf|obj|stl)$/i, '');

        // Se il nome contiene il punto (es. "pulpito.Pulsante_tool"), prendi solo la parte dopo il punto
        if (objectName.includes('.')) {
            const parts = objectName.split('.');
            objectName = parts[parts.length - 1]; // Prendi l'ultima parte
        }

        // Controlla se il nome è nella lista ActiveButtons
        return activeButtonsList.some(btnName => {
            const normalizedBtn = btnName.replace(/\.(glb|gltf|obj|stl)$/i, '');
            return normalizedBtn === objectName || objectName.includes(normalizedBtn);
        });
    },

    /**
     * Verifica se è un oggetto draggabile
     */
    isDraggableObject: function(object) {
        if (!window.DragDropSystem) return false;

        const rootModel = this.findRootModel(object);
        if (!rootModel) return false;

        return window.DragDropSystem.isDraggableObject(rootModel);
    },

    /**
     * Trova il modello root di un oggetto
     */
    findRootModel: function(object) {
        if (!object) return null;

        // Se Scene3D ha il metodo, usalo
        if (window.Scene3D && window.Scene3D.findRootModel) {
            return window.Scene3D.findRootModel(object);
        }

        // Fallback: risali la gerarchia
        let current = object;
        while (current.parent && current.parent !== window.Scene3D.scene) {
            current = current.parent;
        }
        return current;
    },

    // ═══════════════════════════════════════════════════════════
    // ROUTING GESTURE
    // ═══════════════════════════════════════════════════════════

    /**
     * Router principale per TAP
     */
    routeTap: function(event) {
        const layerInfo = this.determineLayer(event);
        this.currentLayer = layerInfo.layer;
        this.currentTarget = layerInfo.target;

        console.log(`[TouchInputRouter] TAP → Layer: ${this.getLayerName(layerInfo.layer)}, Target:`, layerInfo.target?.name || layerInfo.target?.className || 'none');

        switch (layerInfo.layer) {
            case this.LAYERS.UI:
                if (this.uiHandler) {
                    this.uiHandler.handleTap(event, layerInfo.target);
                }
                break;

            case this.LAYERS.INTERACTIVE_3D:
                if (this.interactive3DHandler) {
                    this.interactive3DHandler.handleTap(event, layerInfo.target, layerInfo.hitPoint);
                }
                break;

            case this.LAYERS.OBJECT_3D:
                if (this.dragHandler) {
                    this.dragHandler.handleTap(event, layerInfo.target, layerInfo.hitPoint);
                }
                break;

            case this.LAYERS.CAMERA:
                // Tap sul vuoto - nessuna azione
                break;
        }
    },

    /**
     * Router per DOUBLE TAP
     */
    routeDoubleTap: function(event) {
        const layerInfo = this.determineLayer(event);

        console.log(`[TouchInputRouter] DOUBLE TAP → Layer: ${this.getLayerName(layerInfo.layer)}`);

        switch (layerInfo.layer) {
            case this.LAYERS.UI:
                if (this.uiHandler) {
                    this.uiHandler.handleDoubleTap(event, layerInfo.target);
                }
                break;

            case this.LAYERS.INTERACTIVE_3D:
                if (this.interactive3DHandler) {
                    this.interactive3DHandler.handleDoubleTap(event, layerInfo.target, layerInfo.hitPoint);
                }
                break;

            case this.LAYERS.OBJECT_3D:
                if (this.dragHandler) {
                    this.dragHandler.handleDoubleTap(event, layerInfo.target, layerInfo.hitPoint);
                }
                break;

            case this.LAYERS.CAMERA:
                // Double tap sul vuoto - reset camera?
                break;
        }
    },

    /**
     * Router per DRAG START
     */
    routeDragStart: function(event) {
        const layerInfo = this.determineLayer(event);
        this.currentLayer = layerInfo.layer;
        this.currentTarget = layerInfo.target;

        console.log(`[TouchInputRouter] DRAG START → Layer: ${this.getLayerName(layerInfo.layer)}`);

        switch (layerInfo.layer) {
            case this.LAYERS.OBJECT_3D:
                if (this.dragHandler && this.isDraggableObject(layerInfo.target)) {
                    this.dragHandler.handleDragStart(event, layerInfo.target, layerInfo.hitPoint);
                }
                break;

            case this.LAYERS.CAMERA:
                // Priority 4 (modifica_touch.txt): orbit 1 dito solo se nessun elemento interattivo
                if (this.cameraHandler && this.cameraHandler.handleOneFingerDragStart) {
                    this.cameraHandler.handleOneFingerDragStart(event);
                }
                break;
        }
    },

    /**
     * Router per DRAG MOVE
     */
    routeDragMove: function(event) {
        // Usa il layer determinato al dragstart
        if (this.currentLayer === this.LAYERS.OBJECT_3D && this.dragHandler) {
            this.dragHandler.handleDragMove(event, this.currentTarget);
        } else if (this.currentLayer === this.LAYERS.CAMERA && this.cameraHandler &&
                   this.cameraHandler.handleOneFingerDrag) {
            this.cameraHandler.handleOneFingerDrag(event);
        }
    },

    /**
     * Router per DRAG END
     */
    routeDragEnd: function(event) {
        if (this.currentLayer === this.LAYERS.OBJECT_3D && this.dragHandler) {
            this.dragHandler.handleDragEnd(event, this.currentTarget);
        } else if (this.currentLayer === this.LAYERS.CAMERA && this.cameraHandler &&
                   this.cameraHandler.handleOneFingerDragEnd) {
            this.cameraHandler.handleOneFingerDragEnd(event);
        }

        this.currentLayer = null;
        this.currentTarget = null;
    },

    /**
     * Router per PINCH (zoom)
     */
    routePinch: function(event) {
        if (this.cameraHandler) {
            this.cameraHandler.handlePinch(event);
        }
    },

    routePinchStart: function(event) {
        if (this.cameraHandler) {
            this.cameraHandler.handlePinchStart(event);
        }
    },

    routePinchEnd: function(event) {
        if (this.cameraHandler) {
            this.cameraHandler.handlePinchEnd(event);
        }
    },

    /**
     * Router per TWO-FINGER DRAG (rotazione camera)
     * ❌ DISABILITATO - Rotazione camera non permessa via touch
     */
    routeTwoFingerDrag: function(event) {
        console.log('[TouchInputRouter] ❌ Two-finger drag DISABILITATO (rotazione camera bloccata)');
        // if (this.cameraHandler) {
        //     this.cameraHandler.handleTwoFingerDrag(event);
        // }
    },

    routeTwoFingerDragStart: function(event) {
        console.log('[TouchInputRouter] ❌ Two-finger drag start DISABILITATO');
        // if (this.cameraHandler) {
        //     this.cameraHandler.handleTwoFingerDragStart(event);
        // }
    },

    routeTwoFingerDragEnd: function(event) {
        // if (this.cameraHandler) {
        //     this.cameraHandler.handleTwoFingerDragEnd(event);
        // }
    },

    /**
     * Router per TWO-FINGER TAP
     */
    routeTwoFingerTap: function(event) {
        // Two-finger tap - potrebbe essere usato per azioni future
        console.log('[TouchInputRouter] TWO FINGER TAP');
    },

    /**
     * Router per TWO-FINGER DOUBLE TAP (pivot camera)
     * ❌ DISABILITATO - Pivot camera non permesso via touch
     */
    routeTwoFingerDoubleTap: function(event) {
        console.log('[TouchInputRouter] ❌ Two-finger double tap DISABILITATO (pivot camera bloccato)');

        // if (this.cameraHandler) {
        //     // Usa centro dei due tocchi per raycast
        //     const center = event.center;
        //     const raycastResult = this.performRaycastIncludeFloor(center.normalizedX, center.normalizedY);
        //
        //     if (raycastResult && raycastResult.point) {
        //         this.cameraHandler.handleTwoFingerDoubleTap(event, raycastResult.point);
        //     }
        // }
    },

    // ═══════════════════════════════════════════════════════════
    // UTILITY
    // ═══════════════════════════════════════════════════════════

    getLayerName: function(layer) {
        switch (layer) {
            case this.LAYERS.UI: return 'UI';
            case this.LAYERS.INTERACTIVE_3D: return 'INTERACTIVE_3D';
            case this.LAYERS.OBJECT_3D: return 'OBJECT_3D';
            case this.LAYERS.CAMERA: return 'CAMERA';
            default: return 'UNKNOWN';
        }
    },

    debugInfo: function() {
        console.log('═══════════════════════════════════════');
        console.log('🔀 TouchInputRouter - Debug Info');
        console.log('═══════════════════════════════════════');
        console.log('Current Layer:', this.getLayerName(this.currentLayer));
        console.log('Current Target:', this.currentTarget);
        console.log('UI Handler:', this.uiHandler ? 'Registrato' : 'Non registrato');
        console.log('Drag Handler:', this.dragHandler ? 'Registrato' : 'Non registrato');
        console.log('Camera Handler:', this.cameraHandler ? 'Registrato' : 'Non registrato');
        console.log('Interactive3D Handler:', this.interactive3DHandler ? 'Registrato' : 'Non registrato');
        console.log('═══════════════════════════════════════');
    }
};
