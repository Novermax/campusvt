/**
 * TouchDragHandler - Gestione interazioni touch su oggetti 3D
 *
 * Implementazione modifica_touch.txt:
 * 1. PRIORITY 1 - Actionable (isActionable=true O hasTutorialAction)
 *    → Esegue azione immediata; NON attiva selezione, NON entra in drag
 * 2. PRIORITY 2 - Movable (isMovable=true O DragDropSystem abilitato)
 *    → Seleziona oggetto + mostra Ghost Target; secondo tap = placement
 * 3. PRIORITY 3 - Placement attivo (interactionState.mode === 'selected')
 *    → Posiziona l'oggetto al punto toccato con snap automatico
 * 4. PRIORITY 4 - Camera fallback
 *    → Orbit 1 dito solo se nessun elemento interattivo (gestito dal router)
 *
 * Scope: logica touch SOLO quando pointerType === "touch" (o su dispositivo touch).
 * Desktop: drag continuo e OrbitControls invariati.
 *
 * @version 1.3.0
 * @date Febbraio 2026
 */

window.TouchDragHandler = {

    // ═══════════════════════════════════════════════════════════
    // CONFIGURAZIONE
    // ═══════════════════════════════════════════════════════════
    config: {
        pivotAnimationDuration: 0.8,
        dragPlaneOffset: 0.1,
        ghostOpacity: 0.45,
        ghostValidColor: 0x00ff88,    // Verde = posizione valida (snap raggiungibile)
        ghostInvalidColor: 0xff4444   // Rosso = posizione non valida
    },

    // ── Stato interazione (modifica_touch.txt §"Stato globale suggerito") ──────
    interactionState: {
        mode: 'idle',           // 'idle' | 'selected'
        selectedObject: null,   // THREE.Object3D selezionato per placement
        isTouch: true
    },

    // Ghost target (mesh semi-trasparente preview)
    ghostMesh: null,

    // Stato drag classico (mantenuto per compatibilità DragDrop continuo)
    initialized: false,
    isDragging: false,
    draggedObject: null,
    dragStartPoint: null,
    dragPlane: null,

    // Raycaster
    raycaster: null,
    mouse: null,

    // ═══════════════════════════════════════════════════════════
    // INIZIALIZZAZIONE
    // ═══════════════════════════════════════════════════════════

    init: function() {
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.dragPlane = new THREE.Plane();

        // Reset stato interazione
        this.interactionState = { mode: 'idle', selectedObject: null, isTouch: true };
        this.ghostMesh = null;

        this.initialized = true;
        console.log('[TouchDragHandler] Inizializzato v1.3.0');
    },

    // ═══════════════════════════════════════════════════════════
    // SISTEMA PRIORITÀ TOUCH (modifica_touch.txt)
    // ═══════════════════════════════════════════════════════════

    /**
     * Gestisce un singolo tap con sistema di priorità
     *
     * PRIORITY 1: Actionable  → esegui azione (blocca orbit, NO selezione, NO drag)
     * PRIORITY 2: Movable     → seleziona oggetto O cambia selezione
     * PRIORITY 3: Placement   → posiziona oggetto selezionato al punto toccato
     * PRIORITY 4: Camera      → fallback (gestito dal router, non qui)
     */
    handleTap: function(event, target, hitPoint) {
        if (!target) return;

        const rootModel = this.findRootModel(target);
        if (!rootModel) return;

        console.log('[TouchDragHandler] TAP su:', target.name, '(root:', rootModel.name + ')');

        // ── PRIORITY 1: ACTIONABLE ────────────────────────────────────────────
        // Se l'oggetto è actionable, esegui SOLO l'azione (NO camera, NO placement)
        if (this.isActionable(rootModel)) {
            console.log('[TouchDragHandler] 🎯 P1 Actionable → Eseguo SOLO azione');
            const activeTool = this.getActiveTool();
            this.executeToolAction(target, hitPoint, activeTool);
            return;
        }

        // ── PRIORITY 1b: FALLBACK ELEMENTO ──────────────────────────────────
        // Se il raycast ha colpito un oggetto diverso (es. culatta) ma il punto
        // touch è vicino all'Elemento dello step corrente, esegui l'azione su quello.
        // Risolve il problema delle viti piccole/corte coperte da geometria adiacente.
        if (hitPoint) {
            const elementoFallback = this.findNearbyStepElemento(hitPoint);
            if (elementoFallback) {
                console.log('[TouchDragHandler] 🎯 P1b Fallback Elemento → tap vicino a',
                            elementoFallback.name, '(raycast aveva colpito', rootModel.name + ')');
                const activeTool = this.getActiveTool();
                this.executeToolAction(elementoFallback, hitPoint, activeTool);
                return;
            }
        }

        // ── PRIORITY 2/3: MOVABLE + PLACEMENT ────────────────────────────────
        const isMovable = this.isMovable(rootModel);

        if (this.interactionState.mode === 'selected') {
            if (isMovable && rootModel !== this.interactionState.selectedObject) {
                // Tap su un ALTRO oggetto movable → cambia selezione
                console.log('[TouchDragHandler] 🔄 P2 Cambio selezione a:', rootModel.name);
                this.cancelSelection();
                this.selectObject(rootModel, hitPoint);
            } else {
                // Tap su qualsiasi altro punto (O sullo stesso oggetto) → PLACEMENT
                console.log('[TouchDragHandler] 📍 P3 Placement → posiziono oggetto selezionato');
                this.placeObject(hitPoint);
            }
            return;
        }

        if (isMovable) {
            // Prima selezione
            console.log('[TouchDragHandler] 🟢 P2 Movable → Seleziono:', rootModel.name);
            this.selectObject(rootModel, hitPoint);
            return;
        }

        // ── PRIORITY 4: FALLBACK ──────────────────────────────────────────────
        // Nessun oggetto interattivo → tap ignorato; camera orbit (se dito si muove)
        // è gestita dal router su DRAG → CAMERA layer.
        console.log('[TouchDragHandler] ⚪ P4 Nessuna priorità → tap ignorato (camera via router)');
    },

    // ═══════════════════════════════════════════════════════════
    // SELEZIONE
    // ═══════════════════════════════════════════════════════════

    /**
     * Seleziona un oggetto movable e attiva modalità placement con ghost target
     */
    selectObject: function(object, hitPoint) {
        this.interactionState.mode = 'selected';
        this.interactionState.selectedObject = object;

        // Feedback visivo selezione
        this.highlightObject(object);

        // Crea ghost target per preview
        this.createGhostMesh(object);

        console.log('[TouchDragHandler] ✅ Selezionato:', object.name,
                    '— muovi il dito per preview (ghost target)');
    },

    /**
     * Cancella la selezione corrente e rimuove il ghost
     */
    cancelSelection: function() {
        if (this.interactionState.selectedObject) {
            this.removeHighlight(this.interactionState.selectedObject);
        }
        this.interactionState.mode = 'idle';
        this.interactionState.selectedObject = null;
        this.destroyGhostMesh();
        console.log('[TouchDragHandler] ❌ Selezione annullata');
    },

    // ═══════════════════════════════════════════════════════════
    // PLACEMENT (secondo tap)
    // ═══════════════════════════════════════════════════════════

    /**
     * Posiziona l'oggetto selezionato al punto toccato.
     * Usa DragDropSystem per snap automatico se disponibile.
     */
    placeObject: function(hitPoint) {
        const selected = this.interactionState.selectedObject;
        if (!selected || !hitPoint) {
            this.cancelSelection();
            return;
        }

        console.log('[TouchDragHandler] 📍 Piazzamento:', selected.name, 'in:', hitPoint);

        if (window.DragDropSystem && window.DragDropSystem.isEnabled()) {
            // FIX: Cerca snap targets disponibili (non occupati) e trova il più vicino al tocco
            const snapTargets = this.findAvailableSnapTargets(selected);

            if (snapTargets.length > 0) {
                // Distanza di tolleranza generosa per touch (snapDistance × 3, minimo 0.5)
                const baseSnapDist = window.DragDropSystem.snapDistance || 0.5;
                const touchSnapDistance = Math.max(baseSnapDist * 3, 0.5);

                let bestTarget = null;
                let bestDistance = Infinity;

                for (var i = 0; i < snapTargets.length; i++) {
                    var target = snapTargets[i];
                    var dist = hitPoint.distanceTo(target.position);
                    if (dist < bestDistance && dist <= touchSnapDistance) {
                        bestTarget = target;
                        bestDistance = dist;
                    }
                }

                if (bestTarget) {
                    console.log('[TouchDragHandler] 📍 Snap target trovato:', bestTarget.name,
                                'distanza:', bestDistance.toFixed(3), '(max:', touchSnapDistance.toFixed(3) + ')');

                    // Avvia drag artificiale, muovi DIRETTAMENTE al target, poi termina (snap automatico)
                    window.DragDropSystem.startDrag(selected, selected.position.clone(), { isTouch: true });
                    selected.position.copy(bestTarget.position);
                    window.DragDropSystem.endDrag();
                } else {
                    console.log('[TouchDragHandler] ❌ Nessun snap target entro distanza touch',
                                touchSnapDistance.toFixed(3));
                    // Non piazzare — lascia l'oggetto dov'è
                }
            } else {
                console.log('[TouchDragHandler] ❌ Nessun snap target disponibile (tutti occupati?)');
                // Fallback: usa il flusso originale (startDrag → move → endDrag)
                var startPoint = selected.position.clone();
                window.DragDropSystem.startDrag(selected, startPoint, { isTouch: true });
                selected.position.set(hitPoint.x, selected.position.y, hitPoint.z);
                window.DragDropSystem.endDrag();
            }
        } else {
            // Fallback senza DragDropSystem
            selected.position.set(hitPoint.x, selected.position.y, hitPoint.z);
        }

        // Pulisci stato selezione
        this.cancelSelection();
    },

    /**
     * Cerca tutti gli snap targets disponibili e non occupati per l'oggetto selezionato.
     * Supporta: AssemblySystemSimplified, custom snap targets, posizione originale.
     * @param {THREE.Object3D} object - Oggetto da posizionare
     * @returns {Array<{position: THREE.Vector3, key: string, name: string}>}
     */
    findAvailableSnapTargets: function(object) {
        var targets = [];
        var dds = window.DragDropSystem;
        if (!dds) return targets;

        var cleanName = dds.getCleanModelName ? dds.getCleanModelName(object.name) : object.name;

        // 1. Assembly mode: usa getCurrentGroupSnapTargets
        if (window.AssemblySystemSimplified && window.AssemblySystemSimplified.assemblyMode) {
            var groupTargets = window.AssemblySystemSimplified.getCurrentGroupSnapTargets(cleanName);
            console.log('[TouchDragHandler] 🔍 Assembly snap targets:', groupTargets.length, 'per', cleanName);

            for (var i = 0; i < groupTargets.length; i++) {
                var t = groupTargets[i];
                var key = dds.createSnapPositionKey(t.targetName, t.position);
                if (!dds.isSnapPositionOccupied(key, object)) {
                    targets.push({ position: t.position, key: key, name: t.targetName || ('target_' + i) });
                } else {
                    console.log('[TouchDragHandler] 🚫 Target occupato:', t.targetName);
                }
            }
            return targets;
        }

        // 2. Custom snap targets (SnapPoint/SnapTargets configurati nel tutorial)
        var customTarget = dds.customSnapTargets ? dds.customSnapTargets.get(object.uuid) : null;
        if (customTarget) {
            if (customTarget.isMultiTarget && customTarget.targets) {
                for (var j = 0; j < customTarget.targets.length; j++) {
                    var ct = customTarget.targets[j];
                    if (ct.targetName && window.Scene3D) {
                        var targetModel = window.Scene3D.findModelByName(ct.targetName);
                        if (targetModel) {
                            var bb = new THREE.Box3().setFromObject(targetModel);
                            var center = bb.getCenter(new THREE.Vector3());
                            var posKey = dds.createSnapPositionKey(ct.targetName, null);
                            if (!dds.isSnapPositionOccupied(posKey, object)) {
                                targets.push({ position: center, key: posKey, name: ct.targetName });
                            }
                        }
                    }
                }
            } else if (customTarget.targetName && window.Scene3D) {
                var singleModel = window.Scene3D.findModelByName(customTarget.targetName);
                if (singleModel) {
                    var sbb = new THREE.Box3().setFromObject(singleModel);
                    var sCenter = sbb.getCenter(new THREE.Vector3());
                    var sKey = dds.createSnapPositionKey(customTarget.targetName, null);
                    if (!dds.isSnapPositionOccupied(sKey, object)) {
                        targets.push({ position: sCenter, key: sKey, name: customTarget.targetName });
                    }
                }
            }
            if (targets.length > 0) return targets;
        }

        // 3. Fallback: posizione originale
        var origPos = dds.originalPositions ? dds.originalPositions.get(object.uuid) : null;
        if (origPos) {
            targets.push({ position: origPos.clone(), key: null, name: object.name + '_original' });
        }

        return targets;
    },

    // ═══════════════════════════════════════════════════════════
    // GHOST TARGET (modifica_touch.txt §"Ghost Target")
    // ═══════════════════════════════════════════════════════════

    /**
     * Chiamato su ogni touchmove quando c'è un oggetto selezionato.
     * Aggiorna la posizione del ghost target in base alla posizione del dito.
     */
    handleGhostMove: function(event) {
        if (!this.ghostMesh || this.interactionState.mode !== 'selected') return;

        const touch = event.touch || (event.touches && event.touches[0]);
        if (!touch) return;

        const normalizedX = touch.normalizedX !== undefined
            ? touch.normalizedX
            : ((touch.clientX / window.innerWidth) * 2 - 1);
        const normalizedY = touch.normalizedY !== undefined
            ? touch.normalizedY
            : (-((touch.clientY / window.innerHeight) * 2 - 1));

        this.updateGhostMesh(normalizedX, normalizedY);
    },

    /**
     * Verifica se c'è un oggetto selezionato (usato da index.js)
     */
    hasSelectedObject: function() {
        return this.interactionState.mode === 'selected' &&
               this.interactionState.selectedObject !== null;
    },

    /**
     * Crea una mesh ghost semi-trasparente dal modello sorgente.
     * Verde = posizione valida (snap raggiungibile), Rosso = non valida.
     */
    createGhostMesh: function(sourceModel) {
        this.destroyGhostMesh(); // Rimuove eventuale ghost precedente

        if (!window.Scene3D || !window.Scene3D.scene) return;

        // Clona il modello (incluse le mesh figlie)
        var ghost = sourceModel.clone(true);
        ghost.name = '__ghost_target__';

        var opacity = this.config.ghostOpacity;
        var color = this.config.ghostValidColor;

        // Applica materiale semi-trasparente verde a tutte le mesh
        ghost.traverse(function(child) {
            if (child.isMesh) {
                child.material = new THREE.MeshBasicMaterial({
                    color: color,
                    transparent: true,
                    opacity: opacity,
                    depthWrite: false,
                    side: THREE.DoubleSide
                });
            }
        });

        // Posiziona il ghost coincidente con l'originale
        ghost.position.copy(sourceModel.position);
        ghost.rotation.copy(sourceModel.rotation);
        ghost.scale.copy(sourceModel.scale);

        window.Scene3D.scene.add(ghost);
        this.ghostMesh = ghost;
        console.log('[TouchDragHandler] 👻 Ghost target creato');
    },

    /**
     * Aggiorna la posizione del ghost sul piano orizzontale dell'oggetto selezionato.
     */
    updateGhostMesh: function(normalizedX, normalizedY) {
        if (!this.ghostMesh || !this.interactionState.selectedObject) return;
        if (!window.Scene3D || !window.Scene3D.camera) return;

        this.mouse.set(normalizedX, normalizedY);
        this.raycaster.setFromCamera(this.mouse, window.Scene3D.camera);

        // Piano orizzontale all'altezza Y dell'oggetto selezionato
        var selectedY = this.interactionState.selectedObject.position.y;
        var horizontalPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -selectedY);
        var target = new THREE.Vector3();

        if (this.raycaster.ray.intersectPlane(horizontalPlane, target)) {
            this.ghostMesh.position.set(target.x, selectedY, target.z);

            // Aggiorna colore (verde=valido, rosso=non valido)
            var isValid = this.isSnapPositionValid(target);
            this.updateGhostColor(isValid);
        }
    },

    /**
     * Aggiorna il colore del ghost (verde = snap raggiungibile, rosso = no)
     */
    updateGhostColor: function(isValid) {
        if (!this.ghostMesh) return;
        var color = isValid ? this.config.ghostValidColor : this.config.ghostInvalidColor;
        this.ghostMesh.traverse(function(child) {
            if (child.isMesh && child.material) {
                child.material.color.setHex(color);
            }
        });
    },

    /**
     * Verifica se la posizione è dentro la distanza di snap di un target
     */
    isSnapPositionValid: function(position) {
        if (!window.DragDropSystem || !this.interactionState.selectedObject) return false;

        var selected = this.interactionState.selectedObject;
        // Usa la stessa distanza generosa del placement per coerenza ghost/snap
        var baseSnapDist = window.DragDropSystem.snapDistance || 0.5;
        var touchSnapDistance = Math.max(baseSnapDist * 3, 0.5);

        // Cerca tra gli snap targets disponibili (non occupati)
        var availableTargets = this.findAvailableSnapTargets(selected);
        for (var i = 0; i < availableTargets.length; i++) {
            if (position.distanceTo(availableTargets[i].position) <= touchSnapDistance) {
                return true;
            }
        }

        return false;
    },

    /**
     * Rimuove il ghost target dalla scena e libera le risorse
     */
    destroyGhostMesh: function() {
        if (!this.ghostMesh) return;

        if (window.Scene3D && window.Scene3D.scene) {
            window.Scene3D.scene.remove(this.ghostMesh);
        }

        // Libera geometrie e materiali
        this.ghostMesh.traverse(function(child) {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            }
        });

        this.ghostMesh = null;
        console.log('[TouchDragHandler] 👻 Ghost target rimosso');
    },

    // ═══════════════════════════════════════════════════════════
    // VERIFICA TIPI OGGETTI (modifica_touch.txt §"Priorità eventi")
    // ═══════════════════════════════════════════════════════════

    /**
     * Verifica se l'oggetto è "actionable" (Priorità 1).
     * Controlla:
     *   a) object.userData.isActionable === true  (flag esplicito)
     *   b) hasTutorialAction() — Elemento dello step con azioni configurate
     */
    isActionable: function(object) {
        if (!object) return false;
        if (object.userData && object.userData.isActionable === true) return true;
        return this.hasTutorialAction(object);
    },

    /**
     * Verifica se l'oggetto è "movable" (Priorità 2).
     * Controlla:
     *   a) object.userData.isMovable === true  (flag esplicito)
     *   b) DragDropSystem attivo per lo step corrente e oggetto draggabile
     */
    isMovable: function(object) {
        if (!object) return false;
        if (object.userData && object.userData.isMovable === true) return true;
        if (!this.isDragDropStep()) return false;
        if (!window.DragDropSystem || !window.DragDropSystem.isEnabled()) return false;
        return window.DragDropSystem.isDraggableObject(object);
    },

    // ═══════════════════════════════════════════════════════════
    // DOUBLE TAP — esegue azione tool direttamente
    // ═══════════════════════════════════════════════════════════

    handleDoubleTap: function(event, target, hitPoint) {
        if (!target) return;
        console.log('[TouchDragHandler] DOUBLE TAP su:', target.name);
        const activeTool = this.getActiveTool();
        this.executeToolAction(target, hitPoint, activeTool);
    },

    // ═══════════════════════════════════════════════════════════
    // DRAG CLASSICO — mantenuto per DragDrop continuo su touch
    // ═══════════════════════════════════════════════════════════

    handleDragStart: function(event, target, hitPoint) {
        // Se siamo in modalità placement, blocca drag
        if (this.interactionState.mode === 'selected') {
            console.log('[TouchDragHandler] 🚫 Drag bloccato - modalità placement attiva');
            return;
        }

        // ✅ VERIFICA 1: Step corrente deve avere DragDrop=true
        if (!this.isDragDropStep()) {
            console.log('[TouchDragHandler] 🚫 Drag BLOCCATO - Step non ha DragDrop=true');
            return;
        }

        // ✅ VERIFICA 2: Tool Mano deve essere attivo
        const activeTool = this.getActiveTool();
        if (!this.isHandTool(activeTool)) {
            console.log('[TouchDragHandler] Drag ignorato - tool attivo non è Mano:', activeTool);
            return;
        }

        const rootModel = this.findRootModel(target);
        if (!rootModel) return;

        // ✅ VERIFICA 3: Oggetto deve essere draggabile
        if (!window.DragDropSystem || !window.DragDropSystem.isDraggableObject(rootModel)) {
            console.log('[TouchDragHandler] Oggetto non draggabile:', rootModel.name);
            return;
        }

        console.log('[TouchDragHandler] ✅ DRAG START su:', rootModel.name);

        this.isDragging = true;
        this.draggedObject = rootModel;
        this.dragStartPoint = hitPoint ? hitPoint.clone() : new THREE.Vector3();

        if (window.DragDropSystem && window.DragDropSystem.startDrag) {
            const intersectionPoint = hitPoint || rootModel.position.clone();
            window.DragDropSystem.startDrag(rootModel, intersectionPoint, { isTouch: true });
        }
    },

    handleDragMove: function(event, target) {
        if (!this.isDragging || !this.draggedObject) return;

        const touch = event.touch;
        if (!touch) return;

        if (window.DragDropSystem && window.DragDropSystem.updateDragPositionFromTouch) {
            window.DragDropSystem.updateDragPositionFromTouch(touch.normalizedX, touch.normalizedY);
        } else {
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
     * Verifica se lo step corrente ha DragDrop attivo
     */
    isDragDropStep: function() {
        if (!window.UI || !window.UI.tutorialSteps || window.UI.currentStepIndex < 0) {
            return false;
        }
        const currentStep = window.UI.tutorialSteps[window.UI.currentStepIndex];
        if (!currentStep || !currentStep.properties) return false;
        return currentStep.properties.DragDrop === 'true';
    },

    /**
     * Verifica se l'oggetto è l'Elemento dello step corrente con azioni configurate
     */
    hasTutorialAction: function(object) {
        if (!object) return false;
        if (!window.UI || !window.UI.tutorialSteps || window.UI.currentStepIndex < 0) {
            return false;
        }
        const currentStep = window.UI.tutorialSteps[window.UI.currentStepIndex];
        if (!currentStep || !currentStep.properties) return false;

        const elementName = currentStep.properties.Elemento;
        if (!elementName) return false;

        const normalizedElement = elementName.split('/').pop().replace(/\.(glb|gltf|obj|stl)$/i, '');
        const normalizedObjectName = object.name.split('/').pop().replace(/\.(glb|gltf|obj|stl)$/i, '');

        if (normalizedElement !== normalizedObjectName) return false;

        const hasActions = currentStep.properties.Azione1 ||
                          currentStep.properties.Azione2 ||
                          currentStep.properties.Azione3 ||
                          currentStep.properties.Utensile;

        return !!hasActions;
    },

    /**
     * Fallback touch: se il raycast ha colpito un oggetto diverso dall'Elemento dello step,
     * cerca se il punto touch è comunque vicino all'Elemento corrente.
     * Risolve il problema di viti piccole/corte coperte da geometria adiacente (es. culatta).
     *
     * @param {THREE.Vector3} hitPoint - Punto 3D dove il dito ha toccato
     * @returns {THREE.Object3D|null} - Il modello Elemento se vicino, altrimenti null
     */
    findNearbyStepElemento: function(hitPoint) {
        if (!hitPoint) return null;
        if (!window.UI || !window.UI.tutorialSteps || window.UI.currentStepIndex < 0) return null;
        if (!window.Scene3D || !window.Scene3D.findModelByName) return null;

        var currentStep = window.UI.tutorialSteps[window.UI.currentStepIndex];
        if (!currentStep || !currentStep.properties) return null;

        var elementName = currentStep.properties.Elemento;
        if (!elementName) return null;

        // Lo step deve avere azioni (Azione1/Utensile) per essere un action step
        var hasActions = currentStep.properties.Azione1 ||
                         currentStep.properties.Azione2 ||
                         currentStep.properties.Azione3 ||
                         currentStep.properties.Utensile;
        if (!hasActions) return null;

        // Trova il modello Elemento nella scena
        var cleanName = elementName.split('/').pop().replace(/\.(glb|gltf|obj|stl)$/i, '');
        var elementModel = window.Scene3D.findModelByName(cleanName);
        if (!elementModel) return null;

        // Calcola distanza tra il punto touch e il bounding box dell'Elemento
        var bb = new THREE.Box3().setFromObject(elementModel);
        var center = bb.getCenter(new THREE.Vector3());
        var size = bb.getSize(new THREE.Vector3());

        // Soglia: raggio del bounding sphere + margine generoso per touch (0.15 unità)
        var radius = size.length() / 2;
        var touchMargin = 0.15;
        var threshold = radius + touchMargin;

        var distance = hitPoint.distanceTo(center);

        if (distance <= threshold) {
            console.log('[TouchDragHandler] 🔍 Fallback Elemento: "' + cleanName +
                        '" trovato a distanza ' + distance.toFixed(3) +
                        ' (soglia: ' + threshold.toFixed(3) + ')');
            return elementModel;
        }

        return null;
    },

    highlightObject: function(object) {
        if (!window.Scene3D) return;
        if (window.Scene3D.highlightObject) {
            window.Scene3D.highlightObject(object);
        } else if (window.HighlightSystem) {
            window.HighlightSystem.highlight(object);
        }
    },

    removeHighlight: function(object) {
        if (window.HighlightSystem && window.HighlightSystem.removeHighlight) {
            window.HighlightSystem.removeHighlight(object);
        }
    },

    getActiveTool: function() {
        if (window.ToolsManager && window.ToolsManager.getActiveTool) {
            return window.ToolsManager.getActiveTool();
        }
        const activeToolElement = document.querySelector('.strumento-item.active');
        if (activeToolElement) {
            return activeToolElement.dataset.tool || 'mano';
        }
        return 'mano';
    },

    executeToolAction: function(target, hitPoint, toolName) {
        const rootModel = this.findRootModel(target);
        if (!rootModel) return;

        console.log('[TouchDragHandler] Esecuzione azione', toolName, 'su', rootModel.name);

        if (window.Scene3D && window.Scene3D.handleModelAction) {
            window.Scene3D.handleModelAction(rootModel, {
                point: hitPoint,
                isTouch: true,
                tool: toolName
            });
        } else if (window.Scene3D && window.Scene3D.onModelClick) {
            window.Scene3D.onModelClick(rootModel);
        }

        switch (toolName ? toolName.toLowerCase() : '') {
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

    executeAirToolEffect: function(hitPoint) {
        if (window.ParticleSystem && window.ParticleSystem.createAirJet) {
            const direction = new THREE.Vector3(0, 0, 1);
            window.ParticleSystem.createAirJet(hitPoint, direction, { particleCount: 600, life: 1.2 });
        }
    },

    executeSprayToolEffect: function(hitPoint) {
        if (window.ParticleSystem && window.ParticleSystem.createSpray) {
            const direction = new THREE.Vector3(0, 0, 1);
            window.ParticleSystem.createSpray(hitPoint, direction, { particleCount: 400, life: 2.0 });
        }
    },

    isHandTool: function(toolName) {
        if (!toolName) return false;
        return ['mano', 'mani', 'hand', 'hands'].includes(toolName.toLowerCase());
    },

    findRootModel: function(object) {
        if (!object) return null;
        if (window.Scene3D && window.Scene3D.findRootModel) {
            return window.Scene3D.findRootModel(object);
        }
        let current = object;
        while (current.parent && current.parent !== window.Scene3D.scene) {
            current = current.parent;
        }
        return current;
    },

    animateCameraToPivot: function(pivotPoint) {
        if (!window.Scene3D) return;
        if (window.Scene3D.animateCameraToPivot) {
            window.Scene3D.animateCameraToPivot(pivotPoint, this.config.pivotAnimationDuration);
        } else if (window.Scene3D.controls) {
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
    // DEBUG
    // ═══════════════════════════════════════════════════════════

    debugInfo: function() {
        console.log('═══════════════════════════════════════');
        console.log('✋ TouchDragHandler v1.3.0 - Debug Info');
        console.log('═══════════════════════════════════════');
        console.log('Interaction Mode:', this.interactionState.mode);
        console.log('Selected Object:', this.interactionState.selectedObject ? this.interactionState.selectedObject.name : 'none');
        console.log('Ghost Mesh:', this.ghostMesh ? 'attivo' : 'nessuno');
        console.log('Is Dragging:', this.isDragging);
        console.log('Dragged Object:', this.draggedObject ? this.draggedObject.name : 'none');
        console.log('Active Tool:', this.getActiveTool());
        console.log('DragDrop Step:', this.isDragDropStep());
        console.log('Config:', this.config);
        console.log('═══════════════════════════════════════');
    }
};
