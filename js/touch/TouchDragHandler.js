/**
 * TouchDragHandler - Gestione drag & drop oggetti 3D via touch
 *
 * Responsabilità:
 * - Single tap su oggetto → Selezione + pivot camera su centro
 * - Double tap su oggetto → Esegue azione del tool selezionato
 * - Drag 1 dito su oggetto (con tool Mano) → Presa, movimento, rilascio
 *
 * @version 1.0.0
 * @date Febbraio 2026
 */

window.TouchDragHandler = {

    // ═══════════════════════════════════════════════════════════
    // CONFIGURAZIONE
    // ═══════════════════════════════════════════════════════════
    config: {
        pivotAnimationDuration: 0.8,   // Durata animazione pivot (secondi)
        dragPlaneOffset: 0.1           // Offset piano drag dal punto di hit
    },

    // Stato
    initialized: false,
    isDragging: false,
    draggedObject: null,
    dragStartPoint: null,
    dragPlane: null,

    // Raycaster per drag
    raycaster: null,
    mouse: null,

    // ═══════════════════════════════════════════════════════════
    // INIZIALIZZAZIONE
    // ═══════════════════════════════════════════════════════════

    init: function() {
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.dragPlane = new THREE.Plane();
        this.initialized = true;
        console.log('[TouchDragHandler] Inizializzato');
    },

    // ═══════════════════════════════════════════════════════════
    // TAP - SELEZIONE E PIVOT
    // ═══════════════════════════════════════════════════════════

    handleTap: function(event, target, hitPoint) {
        if (!target) return;

        console.log('[TouchDragHandler] TAP su oggetto:', target.name);

        // 1. Evidenzia oggetto selezionato
        this.highlightObject(target);

        // 2. Calcola centro bounding box per pivot
        const boundingBox = new THREE.Box3().setFromObject(target);
        const center = boundingBox.getCenter(new THREE.Vector3());

        // 3. Anima camera verso il centro come pivot
        this.animateCameraToPivot(center);

        // 4. ESEGUI AZIONE TOOL - Singolo tap ora esegue l'azione
        const activeTool = this.getActiveTool();
        console.log('[TouchDragHandler] Tool attivo:', activeTool);
        this.executeToolAction(target, hitPoint, activeTool);

        // 5. Notifica UI della selezione (se necessario)
        if (window.UI && window.UI.onObjectSelected) {
            window.UI.onObjectSelected(target);
        }
    },

    /**
     * Evidenzia oggetto selezionato
     */
    highlightObject: function(object) {
        if (!window.Scene3D) return;

        // Usa il sistema di highlight esistente se disponibile
        if (window.Scene3D.highlightObject) {
            window.Scene3D.highlightObject(object);
        } else if (window.HighlightSystem) {
            window.HighlightSystem.highlight(object);
        }
    },

    /**
     * Anima camera verso nuovo pivot
     */
    animateCameraToPivot: function(pivotPoint) {
        if (!window.Scene3D) return;

        if (window.Scene3D.animateCameraToPivot) {
            window.Scene3D.animateCameraToPivot(pivotPoint, this.config.pivotAnimationDuration);
        } else if (window.Scene3D.controls) {
            // Fallback con TWEEN
            const controls = window.Scene3D.controls;
            const startTarget = controls.target.clone();

            if (window.TWEEN) {
                new TWEEN.Tween({ t: 0 })
                    .to({ t: 1 }, this.config.pivotAnimationDuration * 1000)
                    .easing(TWEEN.Easing.Quadratic.InOut)
                    .onUpdate(function(obj) {
                        controls.target.lerpVectors(startTarget, pivotPoint, obj.t);
                        controls.update();
                    })
                    .start();
            } else {
                controls.target.copy(pivotPoint);
                controls.update();
            }
        }
    },

    // ═══════════════════════════════════════════════════════════
    // DOUBLE TAP - ESECUZIONE AZIONE TOOL
    // ═══════════════════════════════════════════════════════════

    handleDoubleTap: function(event, target, hitPoint) {
        if (!target) return;

        console.log('[TouchDragHandler] DOUBLE TAP su oggetto:', target.name);

        // Ottieni tool corrente
        const activeTool = this.getActiveTool();
        console.log('[TouchDragHandler] Tool attivo:', activeTool);

        // Esegui azione in base al tool
        this.executeToolAction(target, hitPoint, activeTool);
    },

    /**
     * Ottiene il tool attualmente selezionato
     */
    getActiveTool: function() {
        if (window.ToolsManager && window.ToolsManager.getActiveTool) {
            return window.ToolsManager.getActiveTool();
        }

        // Fallback: cerca nella UI
        const activeToolElement = document.querySelector('.strumento-item.active');
        if (activeToolElement) {
            return activeToolElement.dataset.tool || 'mano';
        }

        return 'mano';
    },

    /**
     * Esegue l'azione del tool sull'oggetto
     */
    executeToolAction: function(target, hitPoint, toolName) {
        // Trova il modello root
        const rootModel = this.findRootModel(target);
        if (!rootModel) return;

        console.log('[TouchDragHandler] Esecuzione azione', toolName, 'su', rootModel.name);

        // Simula click per attivare l'azione del tutorial corrente
        if (window.Scene3D && window.Scene3D.handleModelAction) {
            // Passa informazioni per simulare il click
            window.Scene3D.handleModelAction(rootModel, {
                point: hitPoint,
                isTouch: true,
                tool: toolName
            });
        } else if (window.Scene3D && window.Scene3D.onModelClick) {
            // Fallback al metodo legacy
            window.Scene3D.onModelClick(rootModel);
        }

        // Per tool specifici, esegui effetti aggiuntivi
        switch (toolName.toLowerCase()) {
            case 'aria':
            case 'ariacompressa':
                this.executeAirToolEffect(hitPoint);
                break;

            case 'spray':
            case 'lubrificante':
                this.executeSprayToolEffect(hitPoint);
                break;
        }
    },

    /**
     * Effetto tool aria
     */
    executeAirToolEffect: function(hitPoint) {
        if (window.ParticleSystem && window.ParticleSystem.createAirJet) {
            const direction = new THREE.Vector3(0, 0, 1);
            window.ParticleSystem.createAirJet(hitPoint, direction, {
                particleCount: 600,
                life: 1.2
            });
        }
    },

    /**
     * Effetto tool spray
     */
    executeSprayToolEffect: function(hitPoint) {
        if (window.ParticleSystem && window.ParticleSystem.createSpray) {
            const direction = new THREE.Vector3(0, 0, 1);
            window.ParticleSystem.createSpray(hitPoint, direction, {
                particleCount: 400,
                life: 2.0
            });
        }
    },

    // ═══════════════════════════════════════════════════════════
    // DRAG - MOVIMENTO OGGETTI
    // ═══════════════════════════════════════════════════════════

    handleDragStart: function(event, target, hitPoint) {
        // Verifica che il tool Mano sia attivo
        const activeTool = this.getActiveTool();
        if (!this.isHandTool(activeTool)) {
            console.log('[TouchDragHandler] Drag ignorato - tool attivo non è Mano:', activeTool);
            return;
        }

        const rootModel = this.findRootModel(target);
        if (!rootModel) return;

        // Verifica che sia draggabile
        if (!window.DragDropSystem || !window.DragDropSystem.isDraggableObject(rootModel)) {
            console.log('[TouchDragHandler] Oggetto non draggabile:', rootModel.name);
            return;
        }

        console.log('[TouchDragHandler] DRAG START su:', rootModel.name);

        this.isDragging = true;
        this.draggedObject = rootModel;
        this.dragStartPoint = hitPoint ? hitPoint.clone() : new THREE.Vector3();

        // Notifica DragDropSystem con intersection point e flag touch
        if (window.DragDropSystem && window.DragDropSystem.startDrag) {
            const intersectionPoint = hitPoint || rootModel.position.clone();
            window.DragDropSystem.startDrag(rootModel, intersectionPoint, { isTouch: true });
        }
    },

    handleDragMove: function(event, target) {
        if (!this.isDragging || !this.draggedObject) return;

        const touch = event.touch;
        if (!touch) return;

        // Delega al DragDropSystem usando coordinate normalizzate
        if (window.DragDropSystem && window.DragDropSystem.updateDragPositionFromTouch) {
            window.DragDropSystem.updateDragPositionFromTouch(touch.normalizedX, touch.normalizedY);
        } else {
            // Fallback: raycast locale sul piano di drag
            this.mouse.set(touch.normalizedX, touch.normalizedY);
            this.raycaster.setFromCamera(this.mouse, window.Scene3D.camera);

            const intersection = new THREE.Vector3();
            if (this.raycaster.ray.intersectPlane(this.dragPlane, intersection)) {
                this.draggedObject.position.x = intersection.x;
                this.draggedObject.position.z = intersection.z;
            }
        }
    },

    handleDragEnd: function(event, target) {
        if (!this.isDragging) return;

        console.log('[TouchDragHandler] DRAG END');

        // Notifica DragDropSystem (endDrag non accetta argomenti, isTouchDrag gia' settato)
        if (window.DragDropSystem && window.DragDropSystem.endDrag) {
            window.DragDropSystem.endDrag();
        }

        this.isDragging = false;
        this.draggedObject = null;
        this.dragStartPoint = null;
    },

    // ═══════════════════════════════════════════════════════════
    // UTILITY
    // ═══════════════════════════════════════════════════════════

    /**
     * Verifica se il tool è di tipo "mano"
     */
    isHandTool: function(toolName) {
        if (!toolName) return false;
        const handTools = ['mano', 'mani', 'hand', 'hands'];
        return handTools.includes(toolName.toLowerCase());
    },

    /**
     * Trova il modello root
     */
    findRootModel: function(object) {
        if (!object) return null;

        if (window.Scene3D && window.Scene3D.findRootModel) {
            return window.Scene3D.findRootModel(object);
        }

        // Fallback
        let current = object;
        while (current.parent && current.parent !== window.Scene3D.scene) {
            current = current.parent;
        }
        return current;
    },

    // ═══════════════════════════════════════════════════════════
    // DEBUG
    // ═══════════════════════════════════════════════════════════

    debugInfo: function() {
        console.log('═══════════════════════════════════════');
        console.log('✋ TouchDragHandler - Debug Info');
        console.log('═══════════════════════════════════════');
        console.log('Is Dragging:', this.isDragging);
        console.log('Dragged Object:', this.draggedObject?.name);
        console.log('Active Tool:', this.getActiveTool());
        console.log('Config:', this.config);
        console.log('═══════════════════════════════════════');
    }
};
