/**
 * SnapSystem.js - Sistema di Snap Avanzato per Drag & Drop
 *
 * Gestisce tutte le operazioni di snap inclusi:
 * - Rilevamento zone di snap
 * - Animazioni di snap
 * - Integrazione con elementi intercambiabili
 * - Indicatori visivi
 *
 * Versione: 1.0
 * Data: Dicembre 2025
 */

window.SnapSystem = {
    // Stato del sistema
    enabled: false,

    // Configurazione
    snapDistance: 1.0,
    snapAnimationDuration: 0.8,

    // Indicatori visivi
    snapIndicators: new Map(),

    // Riferimenti ai sistemi esterni
    dragDropSystem: null,
    interchangeableTracker: null,
    assemblySystem: null,
    scene: null,

    /**
     * Inizializza il sistema di snap
     * @param {Object} dragDropSystem - Riferimento al DragDropSystem
     * @returns {boolean} - true se inizializzazione riuscita
     */
    init: function(dragDropSystem) {
        console.log('[SnapSystem] 🎯 Inizializzazione sistema snap...');

        this.dragDropSystem = dragDropSystem;
        this.interchangeableTracker = window.InterchangeableTracker;
        this.assemblySystem = window.AssemblySystem;
        this.scene = dragDropSystem.scene;

        if (!this.dragDropSystem || !this.scene) {
            console.error('[SnapSystem] Errore: DragDropSystem o Scene non disponibili');
            return false;
        }

        // Copia configurazione da DragDropSystem
        this.snapDistance = dragDropSystem.snapDistance || 1.0;
        this.snapAnimationDuration = dragDropSystem.snapAnimationDuration || 0.8;

        console.log('[SnapSystem] ✅ Sistema snap inizializzato');
        return true;
    },

    /**
     * Abilita il sistema di snap
     */
    enable: function() {
        this.enabled = true;
        console.log('[SnapSystem] ✅ Sistema snap abilitato');
    },

    /**
     * Disabilita il sistema di snap
     */
    disable: function() {
        this.enabled = false;
        this.removeAllSnapIndicators();
        console.log('[SnapSystem] ❌ Sistema snap disabilitato');
    },

    /**
     * Imposta la distanza di snap
     * @param {number} distance - Nuova distanza di snap
     */
    setSnapDistance: function(distance) {
        this.snapDistance = Math.max(0.1, distance);
        console.log(`[SnapSystem] 📏 Distanza snap impostata: ${this.snapDistance}`);
    },

    /**
     * Trova il target di snap per un oggetto
     * @param {THREE.Object3D} object - Oggetto da controllare
     * @returns {THREE.Vector3|null} - Posizione target per snap o null
     */
    findSnapTarget: function(object) {
        if (!this.enabled || !object) {
            return null;
        }

        const currentPos = object.position;

        // Calcola centro bounding box una sola volta per entrambi i controlli
        const currentBoundingBox = new THREE.Box3().setFromObject(object);
        const currentCenter = currentBoundingBox.getCenter(new THREE.Vector3());

        // 1. Controlla se esiste un target di snap personalizzato
        const customTarget = this.dragDropSystem.customSnapTargets?.get(object.uuid);
        if (customTarget) {
            // NUOVO: Multi-target intercambiabili
            if (customTarget.isMultiTarget && customTarget.targets) {
                console.log(`[SnapSystem] 🔄 Verifica ${customTarget.targets.length} snap targets intercambiabili per "${object.name}"`);
                console.log(`[SnapSystem] 🔍 Array targets:`, customTarget.targets.map(t => t.targetName));

                let closestTarget = null;
                let closestDistance = Infinity;
                let closestTargetName = null;

                customTarget.targets.forEach((target, index) => {
                    console.log(`[SnapSystem] 🔍 INIZIO ITERAZIONE ${index + 1}/${customTarget.targets.length} - Target: "${target.targetName}"`);
<<<<<<< HEAD
=======

                    // Verifica se la posizione è già occupata da un altro oggetto
                    const positionKey = this.dragDropSystem.createSnapPositionKey(target.targetName, null);
                    if (this.dragDropSystem.isSnapPositionOccupied(positionKey, object)) {
                        console.log(`[SnapSystem] 🚫 Target ${index + 1}/${customTarget.targets.length}: "${target.targetName}" - OCCUPATO, skippo`);
                        return; // Skip questo target
                    }

>>>>>>> 00e8c5c (Messaggio commit)
                    let targetPosition = null;

                    // Riferimenti _original
                    if (target.isOriginalRef && window.Scene3D) {
<<<<<<< HEAD
                        const originalRef = window.Scene3D.findModelByName(target.targetName);
                        if (originalRef) {
                            // Usa il CENTRO del bounding box invece del pivot
                            const targetBoundingBox = new THREE.Box3().setFromObject(originalRef);
                            targetPosition = targetBoundingBox.getCenter(new THREE.Vector3());
                            console.log(`[SnapSystem] 📦 Target ${target.targetName}: pivot=(${originalRef.position.x.toFixed(3)},${originalRef.position.y.toFixed(3)},${originalRef.position.z.toFixed(3)}), centro BB=(${targetPosition.x.toFixed(3)},${targetPosition.y.toFixed(3)},${targetPosition.z.toFixed(3)})`);
=======
                        // Rimuovi suffisso "_original" per trovare il modello reale
                        const actualModelName = target.targetName.replace(/_original$/, '');
                        const originalRef = window.Scene3D.findModelByName(actualModelName);
                        if (originalRef) {
                            // Per _original, usa la posizione originale SALVATA, non il bounding box corrente
                            const savedOriginalPos = this.dragDropSystem.originalPositions.get(originalRef.uuid);
                            if (savedOriginalPos) {
                                targetPosition = savedOriginalPos.clone();
                                console.log(`[SnapSystem] 📦 Target ${target.targetName} (_original): posizione originale salvata=(${targetPosition.x.toFixed(3)},${targetPosition.y.toFixed(3)},${targetPosition.z.toFixed(3)})`);
                            } else {
                                console.warn(`[SnapSystem] ⚠️ Posizione originale non trovata per ${target.targetName}, uso centro BB come fallback`);
                                const targetBoundingBox = new THREE.Box3().setFromObject(originalRef);
                                targetPosition = targetBoundingBox.getCenter(new THREE.Vector3());
                            }
>>>>>>> 00e8c5c (Messaggio commit)
                        } else {
                            console.log(`[SnapSystem] ❌ findModelByName("${target.targetName}") returned null`);
                        }
                    }
                    // Target standard (cerca l'oggetto nella scena)
                    else if (target.targetName && window.Scene3D) {
                        const targetModel = window.Scene3D.findModelByName(target.targetName);
                        if (targetModel) {
                            // Usa il CENTRO del bounding box invece del pivot
                            const targetBoundingBox = new THREE.Box3().setFromObject(targetModel);
                            targetPosition = targetBoundingBox.getCenter(new THREE.Vector3());
                            console.log(`[SnapSystem] 📦 Target ${target.targetName}: pivot=(${targetModel.position.x.toFixed(3)},${targetModel.position.y.toFixed(3)},${targetModel.position.z.toFixed(3)}), centro BB=(${targetPosition.x.toFixed(3)},${targetPosition.y.toFixed(3)},${targetPosition.z.toFixed(3)})`);
                        } else {
                            console.log(`[SnapSystem] ❌ findModelByName("${target.targetName}") returned null (standard target)`);
                        }
                    }

                    if (targetPosition) {
                        const distance = currentCenter.distanceTo(targetPosition);
                        console.log(`[SnapSystem] 📏 Target ${index + 1}/${customTarget.targets.length}: "${target.targetName}" - Distanza: ${distance.toFixed(3)}`);

                        if (distance <= this.snapDistance && distance < closestDistance) {
                            closestTarget = targetPosition;
                            closestDistance = distance;
                            closestTargetName = target.targetName;
                            console.log(`[SnapSystem] ⭐ Nuovo target più vicino: "${target.targetName}" a distanza ${distance.toFixed(3)}`);
                        }
                    } else {
                        console.log(`[SnapSystem] ⚠️ targetPosition è null per "${target.targetName}"`);
                    }
                    console.log(`[SnapSystem] ✅ FINE ITERAZIONE ${index + 1}/${customTarget.targets.length}`);
                });

                if (closestTarget) {
                    console.log(`[SnapSystem] 🧲 Snap intercambiabile disponibile per ${object.name} -> "${closestTargetName}" (distanza: ${closestDistance.toFixed(2)})`);
<<<<<<< HEAD
=======
                    // Associa chiave posizione al Vector3 usando WeakMap (zero interferenze)
                    const snapKey = this.dragDropSystem.createSnapPositionKey(closestTargetName, null);
                    this.dragDropSystem.snapPositionKeys.set(closestTarget, snapKey);
>>>>>>> 00e8c5c (Messaggio commit)
                    return closestTarget;
                }
            }
            // Single custom target
            else {
                let targetPosition = null;
<<<<<<< HEAD

                if (customTarget.isOriginalRef && window.Scene3D) {
                    // Usa il sistema Scene3D per riferimenti _original
                    const originalRef = window.Scene3D.findModelByName(customTarget.targetName);
                    if (originalRef && originalRef.position) {
                        targetPosition = originalRef.position.clone();
                        console.log(`[SnapSystem] 🎯 Custom snap target (original): "${customTarget.targetName}" at (${targetPosition.x.toFixed(2)}, ${targetPosition.y.toFixed(2)}, ${targetPosition.z.toFixed(2)})`);
=======
                let positionKey = null;

                if (customTarget.isOriginalRef && window.Scene3D) {
                    // Rimuovi suffisso "_original" per trovare il modello reale
                    const actualModelName = customTarget.targetName.replace(/_original$/, '');
                    const originalRef = window.Scene3D.findModelByName(actualModelName);
                    if (originalRef) {
                        positionKey = this.dragDropSystem.createSnapPositionKey(customTarget.targetName, null);

                        // Verifica se la posizione è già occupata da un altro oggetto
                        if (this.dragDropSystem.isSnapPositionOccupied(positionKey, object)) {
                            console.log(`[SnapSystem] 🚫 Target "${customTarget.targetName}" già occupato, skippo`);
                            return null;
                        }

                        // Per _original, usa la posizione originale SALVATA, non il bounding box corrente
                        const savedOriginalPos = this.dragDropSystem.originalPositions.get(originalRef.uuid);
                        if (savedOriginalPos) {
                            targetPosition = savedOriginalPos.clone();
                            console.log(`[SnapSystem] 🎯 Custom snap target (original): "${customTarget.targetName}" - posizione originale salvata=(${targetPosition.x.toFixed(3)},${targetPosition.y.toFixed(3)},${targetPosition.z.toFixed(3)})`);
                        } else {
                            console.warn(`[SnapSystem] ⚠️ Posizione originale non trovata per ${customTarget.targetName}, uso centro BB come fallback`);
                            const targetBoundingBox = new THREE.Box3().setFromObject(originalRef);
                            targetPosition = targetBoundingBox.getCenter(new THREE.Vector3());
                        }
>>>>>>> 00e8c5c (Messaggio commit)
                    }
                } else {
                    // Target standard (cerca l'oggetto nella scena)
                    const targetModel = window.Scene3D ? window.Scene3D.findModelByName(customTarget.targetName) : null;
                    if (targetModel && targetModel.position) {
                        targetPosition = targetModel.position.clone();
                        console.log(`[SnapSystem] 🎯 Custom snap target (current): "${customTarget.targetName}" at (${targetPosition.x.toFixed(2)}, ${targetPosition.y.toFixed(2)}, ${targetPosition.z.toFixed(2)})`);
                    }
                }

                if (targetPosition) {
                    // Applica offset se specificato
                    if (customTarget.offset) {
                        targetPosition.add(customTarget.offset);
                    }

                    const distance = currentCenter.distanceTo(targetPosition);
                    if (distance <= this.snapDistance) {
                        console.log(`[SnapSystem] 🧲 Custom snap disponibile per ${object.name} (distanza centro BB: ${distance.toFixed(2)})`);
<<<<<<< HEAD
=======
                        // Associa chiave posizione al Vector3 usando WeakMap (zero interferenze)
                        if (positionKey) {
                            this.dragDropSystem.snapPositionKeys.set(targetPosition, positionKey);
                        }
>>>>>>> 00e8c5c (Messaggio commit)
                        return targetPosition;
                    }
                }
            }
        }

        // 2. Fallback: usa posizione originale dell'oggetto stesso
        const originalPos = this.dragDropSystem.originalPositions?.get(object.uuid);
        if (originalPos) {
            // DEBUG: Calcola distanze da pivot e da centro bounding box (bounding box già calcolato sopra)

            const distanceFromPivot = currentPos.distanceTo(originalPos);
            const distanceFromCenter = currentCenter.distanceTo(originalPos);

            // Calcola offset tra pivot e centro
            const pivotToCenterOffset = currentCenter.clone().sub(currentPos);

            console.log(`[SnapSystem] 🔍 DEBUG SNAP per ${object.name}:`);
            console.log(`  📍 Pivot corrente: (${currentPos.x.toFixed(3)}, ${currentPos.y.toFixed(3)}, ${currentPos.z.toFixed(3)})`);
            console.log(`  📦 Centro BB corrente: (${currentCenter.x.toFixed(3)}, ${currentCenter.y.toFixed(3)}, ${currentCenter.z.toFixed(3)})`);
            console.log(`  ↗️ Offset pivot→centro: (${pivotToCenterOffset.x.toFixed(3)}, ${pivotToCenterOffset.y.toFixed(3)}, ${pivotToCenterOffset.z.toFixed(3)})`);
            console.log(`  🎯 Target snap: (${originalPos.x.toFixed(3)}, ${originalPos.y.toFixed(3)}, ${originalPos.z.toFixed(3)})`);
            console.log(`  📏 Distanza pivot → target: ${distanceFromPivot.toFixed(3)}`);
            console.log(`  📏 Distanza centro BB → target: ${distanceFromCenter.toFixed(3)}`);
            console.log(`  ⚖️ Soglia snap: ${this.snapDistance.toFixed(3)}`);

            if (distanceFromCenter <= this.snapDistance) {
                console.log(`[SnapSystem] 🧲 Standard snap disponibile per ${object.name} (distanza centro BB: ${distanceFromCenter.toFixed(2)})`);
                return originalPos;
            }
        }

        // 3. Controllo snap intercambiabili (solo se AssemblySystem abilitato)
        if (this.assemblySystem && this.assemblySystem.assemblyMode && this.assemblySystem.currentConfig) {
            const objectName = object.name.toLowerCase().trim();
            console.log(`[SnapSystem] 🔄 Verifica snap intercambiabili per "${objectName}"`);

            const interchangeableTargets = this.assemblySystem.getInterchangeableSnapTargets(objectName);

            if (interchangeableTargets.length > 0) {
                console.log(`[SnapSystem] 🎯 Trovati ${interchangeableTargets.length} snap targets intercambiabili`);

                // Trova il target più vicino tra quelli intercambiabili
                let closestTarget = null;
                let closestDistance = Infinity;

                interchangeableTargets.forEach((target, index) => {
                    // La posizione è già un Vector3 dalla scena
                    const targetPosition = target.position;
                    const distance = currentCenter.distanceTo(targetPosition);

                    console.log(`[SnapSystem] 📏 Target ${index + 1}/${interchangeableTargets.length}: "${target.targetName}" - Distanza: ${distance.toFixed(3)}`);

                    if (distance <= this.snapDistance && distance < closestDistance) {
                        closestTarget = targetPosition;
                        closestDistance = distance;
                        console.log(`[SnapSystem] ⭐ Nuovo target più vicino: "${target.targetName}" a distanza ${distance.toFixed(3)}`);
                    }
                });

                if (closestTarget) {
                    console.log(`[SnapSystem] 🧲 Snap intercambiabile disponibile per ${object.name} (distanza centro BB: ${closestDistance.toFixed(2)})`);
                    return closestTarget;
                }
            } else {
                console.log(`[SnapSystem] ℹ️ Nessun snap target intercambiabile trovato per "${objectName}"`);
            }
        }

        return null;
    },

    /**
     * Verifica se l'oggetto è vicino a una zona di snap (per assemblaggio)
     * @param {THREE.Object3D} object - Oggetto da controllare
     * @returns {boolean} - true se vicino a zona snap, false altrimenti
     */
    isNearAnySnapZone: function(object) {
        if (!this.enabled || !object) return false;

        // Usa la stessa logica di findSnapTarget ma ritorna solo boolean
        const snapTarget = this.findSnapTarget(object);
        return snapTarget !== null;
    },

    /**
     * Esegue l'animazione di snap per un oggetto
     * @param {THREE.Object3D} object - Oggetto da animare
     * @param {THREE.Vector3} targetPosition - Posizione target
     * @param {Object} snapContext - Contesto del snap (opzionale)
     */
    performSnap: function(object, targetPosition, snapContext = null) {
        if (!this.enabled) return;

        console.log(`[SnapSystem] 🎯 Esecuzione snap per ${object.name}`);

        const shouldResetDragState = snapContext !== null;

        const startPosition = object.position.clone();
        const originalRotation = this.dragDropSystem.originalRotations?.get(object.uuid);
        const startRotation = object.rotation.clone();

        // PRIMA: Applica la rotazione originale se necessaria
        if (originalRotation) {
            object.rotation.copy(originalRotation);
            console.log(`[SnapSystem] 🔄 Rotazione applicata prima del calcolo posizione`);
        }

        // POI: Calcola posizioni con la rotazione già applicata
        const rotatedBoundingBox = new THREE.Box3().setFromObject(object);
        const rotatedCenter = rotatedBoundingBox.getCenter(new THREE.Vector3());
        const currentPivot = object.position.clone();

        // CALCOLA TRASLAZIONE NECESSARIA: quanto spostare l'oggetto per portare il centro alla target position
        const translation = targetPosition.clone().sub(rotatedCenter);

        // POSIZIONE TARGET CORRETTA: dove deve andare il pivot applicando la traslazione
        const correctedTargetPosition = currentPivot.clone().add(translation);

        console.log(`[SnapSystem] 📐 Centro bounding box (dopo rotazione): (${rotatedCenter.x.toFixed(3)}, ${rotatedCenter.y.toFixed(3)}, ${rotatedCenter.z.toFixed(3)})`);
        console.log(`[SnapSystem] 📐 Pivot oggetto attuale: (${currentPivot.x.toFixed(3)}, ${currentPivot.y.toFixed(3)}, ${currentPivot.z.toFixed(3)})`);
        console.log(`[SnapSystem] 📐 Traslazione necessaria: (${translation.x.toFixed(3)}, ${translation.y.toFixed(3)}, ${translation.z.toFixed(3)})`);
        console.log(`[SnapSystem] 🎯 Target posizione sfera: (${targetPosition.x.toFixed(3)}, ${targetPosition.y.toFixed(3)}, ${targetPosition.z.toFixed(3)})`);
        console.log(`[SnapSystem] 🎯 Target posizione pivot corretta: (${correctedTargetPosition.x.toFixed(3)}, ${correctedTargetPosition.y.toFixed(3)}, ${correctedTargetPosition.z.toFixed(3)})`);

        // Callback al completamento
        const onCompleteCallback = () => {
            console.log(`[SnapSystem] ✅ Snap completato per ${object.name}`);

            // VERIFICA FINALE: controlla se il centro del bounding box è effettivamente sulla target position
            const finalBoundingBox = new THREE.Box3().setFromObject(object);
            const finalCenter = finalBoundingBox.getCenter(new THREE.Vector3());
            const finalDistance = finalCenter.distanceTo(targetPosition);
            console.log(`[SnapSystem] 🔍 Verifica finale - Distanza centro da target: ${finalDistance.toFixed(3)}`);

            // Occupa la posizione di snap per impedire ad altri oggetti di usarla
            if (targetPosition && this.dragDropSystem) {
                const snapKey = this.dragDropSystem.snapPositionKeys.get(targetPosition);
                if (snapKey) {
                    this.dragDropSystem.occupySnapPosition(snapKey, object);
                }
            }

            // TRACKING OCCUPAZIONI: Delega al modulo InterchangeableTracker
            if (this.interchangeableTracker) {
                this.interchangeableTracker.handlePositionChange(object, targetPosition);
            }

            // Callback al DragDropSystem se specificato
            if (snapContext && snapContext.onComplete) {
                snapContext.onComplete(object, targetPosition, snapContext);
            }
        };

        // Animazione con TWEEN se disponibile, altrimenti animazione semplice
        if (window.TWEEN) {
            // Con TWEEN: anima solo la posizione (rotazione già applicata)
            const tween = new TWEEN.Tween({
                x: startPosition.x,
                y: startPosition.y,
                z: startPosition.z
            })
            .to({
                x: correctedTargetPosition.x,
                y: correctedTargetPosition.y,
                z: correctedTargetPosition.z
            }, this.snapAnimationDuration * 1000)
            .easing(TWEEN.Easing.Back.Out)
            .onUpdate((coords) => {
                object.position.set(coords.x, coords.y, coords.z);
            })
            .onComplete(onCompleteCallback);

            tween.start();
        } else {
            // Fallback senza TWEEN: snap immediato
            object.position.copy(correctedTargetPosition);
            onCompleteCallback();
        }
    },

    /**
     * Controlla le zone di snap durante il drag e fornisce feedback visivo
     * @param {THREE.Object3D} draggedObject - Oggetto attualmente trascinato
     */
    checkSnapZones: function(draggedObject) {
        if (!this.enabled || !draggedObject) return;

        const snapTarget = this.findSnapTarget(draggedObject);
        const indicator = this.snapIndicators.get(draggedObject.uuid);

        if (snapTarget && indicator) {
            // Mostra feedback positivo (zona snap attiva)
            indicator.material.color.setHex(0x00ff00); // Verde
            indicator.material.opacity = 0.8;
        } else if (indicator) {
            // Feedback neutro
            indicator.material.color.setHex(0xffffff); // Bianco
            indicator.material.opacity = 0.3;
        }
    },

    /**
     * Aggiorna gli indicatori snap in base al componente correntemente trascinato
     * Mostra punti di snap originali + quelli intercambiabili
     * @param {THREE.Object3D} draggedObject - Oggetto trascinato
     */
    updateSnapIndicators: function(draggedObject) {
        if (!this.enabled) return;

        // Se gli indicatori sono disabilitati nel DragDropSystem, non creare nulla
        if (this.dragDropSystem && !this.dragDropSystem.showSnapIndicators) {
            return;
        }

        // Prima rimuovi tutti gli indicatori esistenti
        this.removeAllSnapIndicators();

        // Se non c'è un oggetto trascinato, non mostrare indicatori
        if (!draggedObject) {
            return;
        }

        const objectName = draggedObject.name.toLowerCase().trim();
        console.log(`[SnapSystem] 🔄 Aggiornamento indicatori snap per "${objectName}"`);

        // 1. Crea indicatore per posizione originale (sempre)
        const originalPos = this.dragDropSystem.originalPositions?.get(draggedObject.uuid);
        if (originalPos) {
            this.createSingleSnapIndicator(draggedObject.uuid, originalPos, 0x00ff00, `Original_${objectName}`);
            console.log(`[SnapSystem] ➕ Indicatore posizione originale creato`);
        }

        // 2. Crea indicatori per posizioni originali di altri componenti intercambiabili
        if (this.assemblySystem && this.assemblySystem.assemblyMode && this.assemblySystem.currentConfig) {
            const interchangeableTargets = this.assemblySystem.getInterchangeableSnapTargets(objectName);

            if (interchangeableTargets.length > 0) {
                console.log(`[SnapSystem] 🎯 Creazione ${interchangeableTargets.length} indicatori per posizioni intercambiabili`);

                interchangeableTargets.forEach((target, index) => {
                    // DEBUG: Verifica posizioni
                    console.log(`[SnapSystem] 🔍 Target ${index + 1}: "${target.targetName}" alla posizione (${target.position.x.toFixed(3)}, ${target.position.y.toFixed(3)}, ${target.position.z.toFixed(3)})`);

                    // Colore arancione per posizioni di altri componenti intercambiabili
                    const color = 0xff8800;
                    const uniqueId = `${draggedObject.uuid}_interchangeable_${index}`;

                    this.createSingleSnapIndicator(uniqueId, target.position, color, `Interch_${target.targetName}`);
                });

                console.log(`[SnapSystem] ✅ Creati ${interchangeableTargets.length} indicatori intercambiabili`);
            } else {
                console.log(`[SnapSystem] ℹ️ Nessun target intercambiabile trovato per "${objectName}"`);
            }
        }

        console.log(`[SnapSystem] 📊 Totale indicatori snap attivi: ${this.snapIndicators.size}`);
    },

    /**
     * Crea un singolo indicatore snap
     * @param {string} id - ID univoco per l'indicatore
     * @param {THREE.Vector3} position - Posizione dell'indicatore
     * @param {number} color - Colore esadecimale
     * @param {string} name - Nome dell'indicatore
     */
    createSingleSnapIndicator: function(id, position, color, name) {
        if (!this.scene) return;

        const sphereGeometry = new THREE.SphereGeometry(0.05, 12, 8);
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.7,
            wireframe: false
        });

        const sphere = new THREE.Mesh(sphereGeometry, material);
        sphere.position.copy(position);
        sphere.name = `SnapIndicator_${name}`;
        sphere.visible = true; // Visibile quando viene creato durante il drag

        this.snapIndicators.set(id, sphere);
        this.scene.add(sphere);

        console.log(`[SnapSystem] 🎯 Indicatore "${name}" creato alla posizione (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
    },

    /**
     * Rimuove tutti gli indicatori snap
     */
    removeAllSnapIndicators: function() {
        this.snapIndicators.forEach(indicator => {
            if (this.scene) {
                this.scene.remove(indicator);
            }
            indicator.geometry?.dispose();
            indicator.material?.dispose();
        });
        this.snapIndicators.clear();
    },

    /**
     * Mostra tutti gli indicatori snap
     */
    showSnapIndicators: function() {
        this.snapIndicators.forEach(indicator => {
            indicator.visible = true;
        });
    },

    /**
     * Nasconde tutti gli indicatori snap
     */
    hideSnapIndicators: function() {
        this.snapIndicators.forEach(indicator => {
            indicator.visible = false;
        });
    },

    /**
     * Ottiene statistiche del sistema
     * @returns {Object} - Statistiche complete
     */
    getStats: function() {
        return {
            enabled: this.enabled,
            snapDistance: this.snapDistance,
            snapAnimationDuration: this.snapAnimationDuration,
            activeIndicators: this.snapIndicators.size,
            hasInterchangeableTracker: !!this.interchangeableTracker,
            hasAssemblySystem: !!this.assemblySystem
        };
    }
};

// Inizializzazione automatica quando disponibile
if (typeof window !== 'undefined') {
    console.log('[SnapSystem] 📦 Modulo caricato e disponibile globalmente');
}