/**
 * DragDropEvents.js - Event handlers e lifecycle drag per DragDropSystem
 *
 * Mixin che estende window.DragDropSystem con:
 * - Event handlers mouse/tastiera (onMouseDown, onMouseMove, onMouseUp, onKeyDown)
 * - Ciclo vita del drag (startDrag, endDrag, forceResetDragState)
 * - Logica raycast condivisa (_applyRaycastDrag, updateDragPlaneToCamera)
 * - Avanzamento tutorial (shouldAdvanceAfterSnap, advanceTutorialStep, tryAdvanceTutorialStep)
 * - Controllo utensile (isCorrectToolActive, showToolRequiredMessage)
 *
 * Caricato dopo DragDropSystem.js tramite app.js.
 */

console.log('🎮 [DragDropEvents] Caricamento event handlers drag...');

if (!window.DragDropSystem) {
    console.error('[DragDropEvents] DragDropSystem non trovato — questo file deve essere caricato dopo DragDropSystem.js');
} else {

Object.assign(window.DragDropSystem, {

    /* ===== EVENT HANDLERS ===== */

    onMouseDown: function(event) {
        if (!this.enabled || event.button !== 0) return;

        this.mouseState.isDown = true;
        this.mouseState.startX = event.clientX;
        this.mouseState.startY = event.clientY;
        this.mouseState.currentX = event.clientX;
        this.mouseState.currentY = event.clientY;
        this.mouseState.hasMoved = false;

        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.draggableObjects, true);

        if (intersects.length > 0) {
            const clickedObject = intersects[0].object;
            const targetModel = this.findRootModel(clickedObject);

            console.log(`🔥🔥🔥 [DragDropSystem] VERSIONE 1.3.0 - CLICK RILEVATO SU: ${targetModel?.name} 🔥🔥🔥`);

            if (targetModel && this.isDraggableObject(targetModel)) {
                console.log(`🔥🔥🔥 [DragDropSystem] VERSIONE 1.3.0 - OGGETTO DRAGGABILE, CONTROLLO UTENSILE... 🔥🔥🔥`);

                if (!this.isCorrectToolActive()) {
                    console.log(`🔥🔥🔥 [DragDropSystem] ❌ DRAG BLOCCATO - UTENSILE "MANO" NON ATTIVO 🔥🔥🔥`);
                    alert('UTENSILE MANO NON ATTIVO - SELEZIONA PRIMA L\'UTENSILE MANO!');
                    this.showToolRequiredMessage();
                    return;
                }

                console.log(`🔥🔥🔥 [DragDropSystem] ✅ UTENSILE MANO ATTIVO - AVVIO DRAG 🔥🔥🔥`);
                this.startDrag(targetModel, intersects[0].point);
                event.preventDefault();
            }
        }
    },

    onMouseMove: function(event) {
        if (!this.enabled) return;

        this.mouseState.currentX = event.clientX;
        this.mouseState.currentY = event.clientY;

        const deltaX = Math.abs(this.mouseState.currentX - this.mouseState.startX);
        const deltaY = Math.abs(this.mouseState.currentY - this.mouseState.startY);

        if (!this.mouseState.hasMoved && (deltaX > 5 || deltaY > 5)) {
            this.mouseState.hasMoved = true;
        }

        if (this.isDragging && this.draggedObject) {
            this.updateDragPosition(event);
            event.preventDefault();
        }
    },

    onMouseUp: function(event) {
        console.log(`[DragDropSystem] 🖱️ MOUSE UP - enabled: ${this.enabled}, isDragging: ${this.isDragging}, hasMoved: ${this.mouseState.hasMoved}`);
        console.log(`[DragDropSystem] 🖱️ MOUSE UP - draggedObject: ${this.draggedObject?.name || 'null'}`);

        if (!this.enabled) {
            console.log(`[DragDropSystem] 🖱️ Sistema disabilitato - reset forzato stato drag`);
            this.forceResetDragState();
            return;
        }

        const hadMoved = this.mouseState.hasMoved;

        this.mouseState.isDown = false;
        this.mouseState.hasMoved = false;

        if (this.isDragging) {
            console.log(`[DragDropSystem] 🛑 MOUSE UP durante drag di: ${this.draggedObject?.name || 'UNKNOWN'} - chiamando endDrag()`);
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            this.endDrag();
            return;
        }

        if (!hadMoved && event.button === 0) {
            console.log('[DragDropSystem] Click rilevato, passando al sistema esistente...');
        }
    },

    onKeyDown: function(event) {
        if (event.key === 'Escape' && this.isDragging) {
            console.log(`[DragDropSystem] 🚨 ESC premuto durante drag - FORCE RESET`);
            this.forceResetDragState();
            event.preventDefault();
        }
    },

    /* ===== DRAG LIFECYCLE ===== */

    startDrag: function(object, intersectionPoint, options) {
        const isTouch = options && options.isTouch;
        console.log(`[DragDropSystem] 🎯 Inizio drag di: ${object.name}${isTouch ? ' (TOUCH)' : ''}`);

        this.isDragging = true;
        this.isTouchDrag = !!isTouch;
        this.draggedObject = object;

        this.dragStartPosition.copy(object.position);
        this.dragOffset.copy(intersectionPoint).sub(object.position);

        console.log(`[DragDropSystem] 🎨 Mantengo highlight su ${object.name} durante drag`);

        this.updateDragPlaneToCamera(intersectionPoint);

        if (this.snapSystem) {
            this.snapSystem.updateSnapIndicators(this.draggedObject);
        }

        if (!isTouch) {
            this.canvas.style.cursor = 'grabbing';
        }

        if (window.Scene3D && window.Scene3D.animationSystem) {
            window.Scene3D.animationSystem.clickEnabled = false;
        }

        if (!isTouch && window.Scene3D && window.Scene3D.mouseControls) {
            this.cameraControlsWereEnabled = window.Scene3D.mouseControls.enabled;
            window.Scene3D.mouseControls.enabled = false;
            console.log(`[DragDropSystem] 🚫 Controlli camera disabilitati durante drag`);
        }
    },

    updateDragPosition: function(event) {
        if (!this.draggedObject) return;
        const rect = this.canvas.getBoundingClientRect();
        this._applyRaycastDrag(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
    },

    updateDragPositionFromTouch: function(normalizedX, normalizedY) {
        if (!this.draggedObject) return;
        this._applyRaycastDrag(normalizedX, normalizedY);
    },

    _applyRaycastDrag: function(normalizedX, normalizedY) {
        this.mouse.x = normalizedX;
        this.mouse.y = normalizedY;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        const isNearSnapZone = this.isNearAnySnapZone(this.draggedObject);
        let raycastTargets = [];

        if (isNearSnapZone) {
            const corpoModel = this.scene.children.find(obj => obj.name === 'corpo');
            if (corpoModel) raycastTargets.push(corpoModel);
            const coperchioModel = this.scene.children.find(obj => obj.name === 'coperchio');
            if (coperchioModel) raycastTargets.push(coperchioModel);
            console.log(`[DEBUG] 🎯 ASSEMBLAGGIO: Raycast targeting CORPO + COPERCHIO per snap di "${this.draggedObject.name}"`);
            console.log(`[DEBUG] 🎯 Targets disponibili: [${raycastTargets.map(obj => obj.name).join(', ')}]`);
        } else {
            raycastTargets = this.scene.children.filter(obj =>
                obj !== this.draggedObject &&
                obj.type !== 'DirectionalLight' &&
                obj.type !== 'AmbientLight' &&
                !obj.name.startsWith('SnapIndicator') &&
                !obj.name.includes('vite') &&
                !obj.name.includes('tappino')
            );
            console.log(`[DEBUG] 🆓 RIMOZIONE: Raycast con ${raycastTargets.length} oggetti per movimento libero di "${this.draggedObject.name}"`);
        }

        const sceneIntersects = this.raycaster.intersectObjects(raycastTargets, true);

        if (sceneIntersects.length === 0) {
            console.log(`[DEBUG] ❌ Raycast fallito durante drag di "${this.draggedObject.name}"`);
            console.log(`  📊 Oggetti raycast target: ${raycastTargets.length}`);
            console.log(`  🎯 Target utilizzati:`, raycastTargets.slice(0, 5).map(obj => obj.name || obj.type));
        }

        if (sceneIntersects.length > 0) {
            const intersectionPoint = sceneIntersects[0].point;
            if (!this.lastPlanePoint || this.lastPlanePoint.distanceTo(intersectionPoint) > 0.01) {
                this.updateDragPlaneToCamera(intersectionPoint);
                this.lastPlanePoint = intersectionPoint.clone();
            }
        } else if (!this.lastPlanePoint) {
            console.log(`[DEBUG] 🔄 Fallback: Creazione piano drag per movimento libero`);
            const corpoModel = this.scene.children.find(obj => obj.name === 'corpo');
            if (corpoModel) {
                const corpoCenter = new THREE.Vector3();
                new THREE.Box3().setFromObject(corpoModel).getCenter(corpoCenter);
                this.updateDragPlaneToCamera(corpoCenter);
                this.lastPlanePoint = corpoCenter.clone();
                console.log(`[DEBUG] ✅ Fallback: Usato centro corpo per piano drag`);
            } else {
                const pavimento = this.scene.children.find(obj => obj.name === 'pavimento');
                if (pavimento) {
                    const pavimentoCenter = new THREE.Vector3();
                    new THREE.Box3().setFromObject(pavimento).getCenter(pavimentoCenter);
                    this.updateDragPlaneToCamera(pavimentoCenter);
                    this.lastPlanePoint = pavimentoCenter.clone();
                    console.log(`[DEBUG] ✅ Fallback: Usato pavimento per piano drag`);
                } else {
                    const currentPos = this.draggedObject.position.clone();
                    this.updateDragPlaneToCamera(currentPos);
                    this.lastPlanePoint = currentPos.clone();
                    console.log(`[DEBUG] ✅ Fallback: Creato piano alla posizione oggetto corrente`);
                }
            }
        }

        const planeIntersects = this.raycaster.intersectObjects([this.dragPlane], false);
        if (planeIntersects.length > 0) {
            this.draggedObject.position.copy(planeIntersects[0].point.sub(this.dragOffset));
            if (this.snapSystem) {
                this.snapSystem.checkSnapZones(this.draggedObject);
            }
        }
    },

    endDrag: function() {
        console.log(`[DragDropSystem] 🏁 INIZIO endDrag() - isDragging: ${this.isDragging}, draggedObject: ${this.draggedObject?.name || 'null'}`);

        if (!this.isDragging || !this.draggedObject) {
            console.log(`[DragDropSystem] ⚠️ endDrag() chiamato ma nessun drag in corso - USCITA EARLY`);
            return;
        }

        console.log(`[DragDropSystem] 🏁 Fine drag di: ${this.draggedObject.name}`);
        console.log(`[DragDropSystem] 📍 Posizione corrente: (${this.draggedObject.position.x.toFixed(3)}, ${this.draggedObject.position.y.toFixed(3)}, ${this.draggedObject.position.z.toFixed(3)})`);

        const originalPos = this.originalPositions.get(this.draggedObject.uuid);
        console.log(`[DragDropSystem] 🔍 DEBUG POSIZIONI ORIGINALI - Totale salvate: ${this.originalPositions.size}`);

        if (originalPos) {
            const currentBoundingBox = new THREE.Box3().setFromObject(this.draggedObject);
            const currentCenter = currentBoundingBox.getCenter(new THREE.Vector3());
            const distanceFromTarget = currentCenter.distanceTo(originalPos);
            console.log(`[DragDropSystem] 📏 DISTANZA AL DROP per ${this.draggedObject.name}:`);
            console.log(`  📦 Centro BB corrente: (${currentCenter.x.toFixed(3)}, ${currentCenter.y.toFixed(3)}, ${currentCenter.z.toFixed(3)})`);
            console.log(`  🎯 Target originale: (${originalPos.x.toFixed(3)}, ${originalPos.y.toFixed(3)}, ${originalPos.z.toFixed(3)})`);
            console.log(`  📏 Distanza centro BB → target: ${distanceFromTarget.toFixed(3)} unità`);
            console.log(`  ⚖️ Soglia snap configurata: ${this.snapDistance.toFixed(3)} unità`);
            console.log(`  ${distanceFromTarget <= this.snapDistance ? '✅ DOVREBBE FARE SNAP' : '❌ NON DOVREBBE FARE SNAP'}`);
        } else {
            console.log(`[DragDropSystem] ❌ ERRORE: Nessuna posizione originale salvata per ${this.draggedObject.name} (UUID: ${this.draggedObject.uuid})`);
            console.log(`[DragDropSystem] 🔍 Posizioni salvate:`, Array.from(this.originalPositions.keys()));
        }

        console.log(`[DragDropSystem] 🎯 Cercando snap target per ${this.draggedObject.name}...`);
        console.log(`[DragDropSystem] 🎯 Custom snap targets configurati: ${this.customSnapTargets.size}`);
        if (this.customSnapTargets.has(this.draggedObject.uuid)) {
            const customTarget = this.customSnapTargets.get(this.draggedObject.uuid);
            console.log(`[DragDropSystem] 🎯 Custom snap target trovato per ${this.draggedObject.name}:`, customTarget);
        }

        let snapTarget = null;

        if (window.AssemblySystemSimplified && window.AssemblySystemSimplified.assemblyMode) {
            const groupSnapTargets = window.AssemblySystemSimplified.getCurrentGroupSnapTargets(this.draggedObject.name);
            console.log(`[DragDropSystem] 🎯 AssemblySystemSimplified trovato ${groupSnapTargets.length} snap targets`);

            if (groupSnapTargets.length > 0) {
                const currentBoundingBox = new THREE.Box3().setFromObject(this.draggedObject);
                const currentCenter = currentBoundingBox.getCenter(new THREE.Vector3());

                let closestTarget = null;
                let closestDistance = Infinity;
                let closestTargetName = null;

                groupSnapTargets.forEach(target => {
                    const posKey = this.createSnapPositionKey(target.targetName, target.position);
                    if (this.isSnapPositionOccupied(posKey, this.draggedObject)) return;

                    const distance = currentCenter.distanceTo(target.position);
                    if (distance <= this.snapDistance && distance < closestDistance) {
                        closestTarget = target.position;
                        closestDistance = distance;
                        closestTargetName = target.targetName;
                    }
                });

                if (closestTarget) {
                    snapTarget = closestTarget;
                    if (closestTargetName) {
                        const snapKey = this.createSnapPositionKey(closestTargetName, null);
                        this.snapPositionKeys.set(closestTarget, snapKey);
                    }
                    console.log(`[DragDropSystem] 🎯 Snap target trovato tramite AssemblySystemSimplified: (${snapTarget.x.toFixed(3)}, ${snapTarget.y.toFixed(3)}, ${snapTarget.z.toFixed(3)}) → "${closestTargetName}"`);
                }
            }
        }

        if (!snapTarget && this.snapSystem) {
            snapTarget = this.snapSystem.findSnapTarget(this.draggedObject);
            console.log(`[DragDropSystem] 🎯 Fallback SnapSystem risultato:`, snapTarget ? `Posizione (${snapTarget.x.toFixed(3)}, ${snapTarget.y.toFixed(3)}, ${snapTarget.z.toFixed(3)})` : 'null');
        }

        console.log(`[DragDropSystem] 🎯 findSnapTarget finale:`, snapTarget ? `Posizione (${snapTarget.x.toFixed(3)}, ${snapTarget.y.toFixed(3)}, ${snapTarget.z.toFixed(3)})` : 'null');

        const wasTouchDrag = this.isTouchDrag;
        console.log(`[DragDropSystem] 🧹 CLEANUP BASE: hiding snap indicators e reset cursore...${wasTouchDrag ? ' (TOUCH)' : ''}`);
        this.hideAllSnapIndicators();

        if (!wasTouchDrag) {
            this.canvas.style.cursor = '';
            console.log(`[DragDropSystem] 🖱️ Cursore canvas inline resettato, classi CSS attive`);

            if (window.Scene3D && typeof window.Scene3D.stopCursorAnimation === 'function') {
                window.Scene3D.stopCursorAnimation();
                console.log(`[DragDropSystem] ⏹️ Animazione cursore Scene3D fermata`);
            }
        }

        if (window.Scene3D && window.Scene3D.animationSystem) {
            window.Scene3D.animationSystem.clickEnabled = true;
            console.log(`[DragDropSystem] 🎯 Click animation system riabilitato`);
        }

        if (!wasTouchDrag && window.Scene3D && window.Scene3D.mouseControls && this.cameraControlsWereEnabled !== undefined) {
            window.Scene3D.mouseControls.enabled = this.cameraControlsWereEnabled;
            console.log(`[DragDropSystem] ✅ Controlli camera riabilitati: ${this.cameraControlsWereEnabled}`);
            this.cameraControlsWereEnabled = undefined;
        }

        if (window.ToolsManager && typeof window.ToolsManager.updateCanvasCursor === 'function') {
            console.log(`[DragDropSystem] 🔧 Richiedendo aggiornamento cursore a ToolsManager...`);

            if (typeof window.ToolsManager.getActiveTool === 'function') {
                const activeTool = window.ToolsManager.getActiveTool();
                console.log(`[DragDropSystem] 🔍 Tool attivo prima update: "${activeTool}"`);

                if (typeof window.ToolsManager.getToolsState === 'function') {
                    const toolsState = window.ToolsManager.getToolsState();
                    console.log(`[DragDropSystem] 🔍 Stato completo tools:`, toolsState);
                }
            }

            window.ToolsManager.updateCanvasCursor();
            console.log(`[DragDropSystem] 🔧 ToolsManager updateCanvasCursor completato`);

            if (typeof window.ToolsManager.getActiveTool === 'function') {
                const activeToolAfter = window.ToolsManager.getActiveTool();
                console.log(`[DragDropSystem] 🔍 Tool attivo dopo update: "${activeToolAfter}"`);
            }
        } else {
            console.log(`[DragDropSystem] ⚠️ ToolsManager non disponibile per aggiornamento cursore`);
            console.log(`[DragDropSystem] 🔍 Debug: window.ToolsManager = ${window.ToolsManager ? 'presente' : 'assente'}`);
            if (window.ToolsManager) {
                console.log(`[DragDropSystem] 🔍 Debug: updateCanvasCursor = ${typeof window.ToolsManager.updateCanvasCursor}`);
            }

            document.body.classList.remove('tool-aria-active', 'tool-chiave_inglese-active', 'tool-brugola-active', 'tool-mano-active');
            document.body.classList.add('tool-mano-active');
            console.log(`[DragDropSystem] 🔧 Fallback: Cursore mano applicato via body class`);

            const canvas = document.querySelector('#canvas3d, canvas');
            if (canvas) {
                canvas.classList.remove('cursor-default', 'cursor-mano', 'cursor-brugola', 'cursor-chiave', 'cursor-aria');
            }
        }

        if (snapTarget) {
            const assemblySystem = window.AssemblySystemSimplified || window.AssemblySystem;
            const assemblyEnabled = assemblySystem && assemblySystem.assemblyMode;
            const componentName = this.getCleanModelName(this.draggedObject.name);

            console.log(`[DragDropSystem] 🏗️ DEBUG ASSEMBLY INTEGRATION:`);
            console.log(`  assemblySystem: ${assemblySystem ? (window.AssemblySystemSimplified ? 'AssemblySystemSimplified' : 'AssemblySystem') : 'assente'}`);
            console.log(`  assemblyMode: ${assemblySystem?.assemblyMode}`);
            console.log(`  assemblyEnabled: ${assemblyEnabled}`);
            console.log(`  componentName: "${componentName}"`);

            const snapContext = {
                draggedObject: this.draggedObject,
                assemblyIntegration: {
                    enabled: assemblyEnabled,
                    componentName: componentName,
                    snapTargetPosition: snapTarget
                }
            };

            if (this.snapSystem) {
                snapContext.onComplete = this.handleSnapComplete.bind(this);
                this.snapSystem.performSnap(this.draggedObject, snapTarget, snapContext);
            }

            if (this.originalMaterialsMap && this.originalMaterialsMap.has(this.draggedObject.uuid)) {
                const originalMaterials = this.originalMaterialsMap.get(this.draggedObject.uuid);
                this.draggedObject.traverse((child) => {
                    if (child.isMesh && originalMaterials.has(child.uuid)) {
                        child.material = originalMaterials.get(child.uuid);
                        child.renderOrder = 0;
                    }
                });
                console.log(`[DragDropSystem] ✅ Snap riuscito - rimosso highlight da ${this.draggedObject.name}`);
            }
            this.silhouetteBlocked.delete(this.draggedObject.name);
        } else {
            this.silhouetteBlocked.delete(this.draggedObject.name);
            if (window.Scene3D && typeof window.Scene3D.highlightModel === 'function') {
                window.Scene3D.highlightModel(this.draggedObject);
                console.log(`[DragDropSystem] ❌ Snap fallito - riapplicato highlight giallo a ${this.draggedObject.name}`);
            }

            if (this.interchangeableTracker) {
                const currentBoundingBox = new THREE.Box3().setFromObject(this.draggedObject);
                const currentCenter = currentBoundingBox.getCenter(new THREE.Vector3());
                this.interchangeableTracker.handlePositionChange(this.draggedObject, currentCenter);
            }
        }

        this.isDragging = false;
        this.isTouchDrag = false;
        this.draggedObject = null;
        this.dragOffset.set(0, 0, 0);
        this.dragStartPosition.set(0, 0, 0);
        this.lastPlanePoint = null;

        console.log(`[DragDropSystem] 🔄 RESET COMPLETO: isDragging=${this.isDragging}, draggedObject=${this.draggedObject ? this.draggedObject.name : 'null'}`);
    },

    forceResetDragState: function() {
        console.log(`[DragDropSystem] 🚨 FORCE RESET DRAG STATE`);

        if (this.advanceRetryTimeoutId) {
            clearTimeout(this.advanceRetryTimeoutId);
            this.advanceRetryTimeoutId = null;
            console.log(`[DragDropSystem] 🔄 Retry avanzamento cancellato`);
        }

        this.occupiedSnapPositions.clear();
        this.objectSnapPosition.clear();
        console.log(`[DragDropSystem] 🔄 Tracking occupazioni snap resettato`);

        this.isDragging = false;
        this.isTouchDrag = false;
        this.draggedObject = null;
        this.dragOffset.set(0, 0, 0);
        this.dragStartPosition.set(0, 0, 0);
        this.lastPlanePoint = null;

        this.mouseState.isDown = false;
        this.mouseState.hasMoved = false;

        this.hideAllSnapIndicators();

        if (window.Scene3D && window.Scene3D.mouseControls && this.cameraControlsWereEnabled !== undefined) {
            window.Scene3D.mouseControls.enabled = this.cameraControlsWereEnabled;
            console.log(`[DragDropSystem] 🔄 Controlli camera riabilitati forzatamente: ${this.cameraControlsWereEnabled}`);
            this.cameraControlsWereEnabled = undefined;
        }

        if (window.ToolsManager && typeof window.ToolsManager.updateCanvasCursor === 'function') {
            window.ToolsManager.updateCanvasCursor();
            console.log(`[DragDropSystem] 🔧 Cursore tool riapplicato forzatamente`);
        }

        console.log(`[DragDropSystem] ✅ Force reset completato`);
    },

    updateDragPlaneToCamera: function(intersectionPoint) {
        if (!this.camera || !this.dragPlane) return;

        const cameraToPoint = new THREE.Vector3();
        cameraToPoint.subVectors(intersectionPoint, this.camera.position).normalize();

        this.dragPlane.position.copy(intersectionPoint);

        const up = new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(cameraToPoint, up).normalize();
        const finalUp = new THREE.Vector3().crossVectors(right, cameraToPoint).normalize();

        this.dragPlane.matrix.makeBasis(right, finalUp, cameraToPoint);
        this.dragPlane.matrix.setPosition(intersectionPoint);
        this.dragPlane.matrixAutoUpdate = false;
        this.dragPlane.matrixWorldNeedsUpdate = true;
    },

    /* ===== TUTORIAL ADVANCEMENT ===== */

    shouldAdvanceAfterSnap: function() {
        if (!window.AssemblySystem || !window.AssemblySystem.enabled) {
            console.log(`[DragDropSystem] 🔄 Non in modalità assembly - avanzamento consentito`);
            return true;
        }

        try {
            const isStepComplete = window.AssemblySystem.isCurrentStepComplete();
            console.log(`[DragDropSystem] 🔍 Assembly step completo: ${isStepComplete}`);

            if (window.AssemblySystem.currentStepName) {
                console.log(`[DragDropSystem] 📝 Step corrente: ${window.AssemblySystem.currentStepName}`);
            }

            return isStepComplete;
        } catch (error) {
            console.warn(`[DragDropSystem] ⚠️ Errore verifica completamento assembly:`, error);
            return true;
        }
    },

    advanceTutorialStep: function(context = 'unknown') {
        this.tryAdvanceTutorialStep(context, 0);
    },

    tryAdvanceTutorialStep: function(context, attempt) {
        const maxRetries = this.tutorialAdvanceRetries;
        const retryDelay = this.tutorialAdvanceRetryDelay;

        console.log(`[DragDropSystem] 🎯 Tentativo ${attempt + 1}/${maxRetries + 1} avanzamento step (${context})`);

        let tutorialManager = null;
        let accessPath = '';
        let useDirectMethod = false;

        if (window.UI && window.UI.tutorialManager && typeof window.UI.tutorialManager.nextStep === 'function') {
            tutorialManager = window.UI.tutorialManager;
            accessPath = 'window.UI.tutorialManager';
        } else if (window.UI && window.UI._tutorialManager && typeof window.UI._tutorialManager.nextStep === 'function') {
            tutorialManager = window.UI._tutorialManager;
            accessPath = 'window.UI._tutorialManager';
        } else if (window.TutorialManager && window.TutorialManagerInstance && typeof window.TutorialManagerInstance.nextStep === 'function') {
            tutorialManager = window.TutorialManagerInstance;
            accessPath = 'window.TutorialManagerInstance';
        } else if (window.UI && typeof window.UI.nextStep === 'function') {
            useDirectMethod = true;
            accessPath = 'window.UI.nextStep (legacy)';
        } else if (window.UI && typeof window.UI.goToStep === 'function' && typeof window.UI.currentStepIndex === 'number') {
            useDirectMethod = true;
            accessPath = 'window.UI.goToStep (legacy)';
        }

        if ((tutorialManager && !tutorialManager._isTransitioning) || useDirectMethod) {
            try {
                console.log(`[DragDropSystem] ➡️ Avanzamento step (${context})`);
                console.log(`[DragDropSystem] 🎯 Percorso accesso: ${accessPath}`);
                console.log(`[DragDropSystem] 🔍 Step corrente prima avanzamento: ${window.UI?.currentStepIndex || 'N/A'}`);
                console.log(`[DragDropSystem] 🔍 Tutorial attivo: ${window.UI?.currentTutorial?.name || 'nessuno'}`);

                const currentIndex = window.UI?.currentStepIndex || 0;
                const totalSteps = window.UI?.tutorialSteps?.length || 0;

                if (totalSteps > 0 && currentIndex === totalSteps - 1) {
                    console.log(`[DragDropSystem] 🎉 STEP FINALE COMPLETATO! Mostrando congratulazioni invece di avanzare (${currentIndex + 1}/${totalSteps})`);

                    if (window.Scene3D && typeof window.Scene3D.showTutorialCompletionCongratulations === 'function') {
                        if (window.Scene3D.tutorialTracker) {
                            window.Scene3D.tutorialTracker.interactionsBlocked = true;
                            console.log('[DragDropSystem] 🔒 INTERAZIONI BLOCCATE: Tutorial completato');
                        }

                        setTimeout(() => {
                            window.Scene3D.showTutorialCompletionCongratulations();
                            console.log(`[DragDropSystem] ✅ Congratulazioni mostrate (${context})`);
                        }, 500);
                    } else {
                        console.warn(`[DragDropSystem] ⚠️ Scene3D.showTutorialCompletionCongratulations non disponibile`);
                    }
                    return;
                }

                console.log(`[DragDropSystem] 📊 Step intermedio (${currentIndex + 1}/${totalSteps}) - procedo con avanzamento normale`);

                if (useDirectMethod) {
                    if (typeof window.UI.nextStep === 'function') {
                        window.UI.nextStep();
                    } else if (typeof window.UI.goToStep === 'function') {
                        const nextStepIndex = (window.UI.currentStepIndex || 0) + 1;
                        window.UI.goToStep(nextStepIndex);
                    }
                } else {
                    tutorialManager.nextStep();
                }

                console.log(`[DragDropSystem] ✅ Avanzamento step completato (${context}) via ${accessPath}`);
                console.log(`[DragDropSystem] 🔍 Step corrente dopo avanzamento: ${window.UI?.currentStepIndex || 'N/A'}`);
                return;
            } catch (error) {
                console.warn(`[DragDropSystem] ⚠️ Errore avanzamento step (${context}) via ${accessPath}:`, error);
            }
        } else {
            console.log(`[DragDropSystem] ⚠️ TutorialManager non disponibile per avanzamento step (${context})`);
            console.log(`[DragDropSystem] 🔍 Multi-path Debug:`);
            console.log(`  - window.UI: ${window.UI ? 'presente' : 'assente'}`);
            if (window.UI) {
                console.log(`  - window.UI.tutorialManager: ${window.UI.tutorialManager ? 'presente' : 'assente'}`);
                console.log(`  - window.UI._tutorialManager: ${window.UI._tutorialManager ? 'presente' : 'assente'}`);
                console.log(`  - window.UI.nextStep (legacy): ${typeof window.UI.nextStep}`);
                console.log(`  - window.UI.goToStep (legacy): ${typeof window.UI.goToStep}`);
                console.log(`  - window.UI.currentStepIndex: ${window.UI.currentStepIndex}`);
                if (window.UI.tutorialManager) {
                    console.log(`  - nextStep method: ${typeof window.UI.tutorialManager.nextStep}`);
                    console.log(`  - _isTransitioning: ${window.UI.tutorialManager._isTransitioning}`);
                }
                if (window.UI._tutorialManager) {
                    console.log(`  - _tutorialManager.nextStep: ${typeof window.UI._tutorialManager.nextStep}`);
                    console.log(`  - _tutorialManager._isTransitioning: ${window.UI._tutorialManager._isTransitioning}`);
                }
            }
            console.log(`  - window.TutorialManagerInstance: ${window.TutorialManagerInstance ? 'presente' : 'assente'}`);
        }

        if (attempt < maxRetries) {
            console.log(`[DragDropSystem] ⏳ Retry ${attempt + 1} tra ${retryDelay}ms (${context})`);

            if (this.advanceRetryTimeoutId) {
                clearTimeout(this.advanceRetryTimeoutId);
            }
            this.advanceRetryTimeoutId = setTimeout(() => {
                this.advanceRetryTimeoutId = null;
                this.tryAdvanceTutorialStep(context, attempt + 1);
            }, retryDelay);
        } else {
            console.log(`[DragDropSystem] ❌ Raggiunto limite retry per avanzamento step (${context})`);

            if (window.tutorialSystem && typeof window.tutorialSystem.completeCurrentStep === 'function') {
                try {
                    console.log(`[DragDropSystem] ➡️ Fallback: Trigger avanzamento sistema legacy (${context})`);
                    window.tutorialSystem.completeCurrentStep();
                    console.log(`[DragDropSystem] ✅ Fallback legacy completato (${context})`);
                } catch (error) {
                    console.warn(`[DragDropSystem] ⚠️ Errore avanzamento step legacy (${context}):`, error);
                }
            } else {
                console.log(`[DragDropSystem] ❌ Nessun sistema tutorial disponibile dopo tutti i retry (${context})`);
            }
        }
    },

    /* ===== TOOL CONTROL ===== */

    isCorrectToolActive: function() {
        if (!window.ToolsManager) {
            console.log(`[DragDropSystem] ⚠️ ToolsManager non disponibile - drag permesso (fallback)`);
            return true;
        }

        if (!window.ToolsManager || typeof window.ToolsManager.getActiveTool !== 'function') {
            console.log(`[DragDropSystem] ⚠️ ToolsManager non disponibile o getActiveTool non è una funzione - drag permesso (fallback)`);
            return true;
        }

        const activeTool = window.ToolsManager.getActiveTool();
        const isHandActive = (activeTool === 'mano' || activeTool === 'Mani');

        console.log(`[DragDropSystem] 🔧 Controllo utensile: attivo="${activeTool}", richiesto="mano", permesso=${isHandActive}`);

        return isHandActive;
    },

    showToolRequiredMessage: function() {
        if (window.UI && window.UI.core && window.UI.core.updateStatus) {
            window.UI.core.updateStatus('⚠️ Seleziona l\'utensile "Mano" per trascinare gli oggetti');
        } else {
            console.warn(`[DragDropSystem] 💡 SELEZIONA UTENSILE "MANO" per trascinare gli oggetti`);
        }

        if (window.ToolsManager && typeof window.ToolsManager.highlightRequiredTool === 'function') {
            window.ToolsManager.highlightRequiredTool('mano');
        }
    }

}); // end Object.assign

console.log('✅ [DragDropEvents] Event handlers e drag lifecycle aggiunti a DragDropSystem');

} // end if window.DragDropSystem
