/**
 * MultiStepAnimationSystem - Sistema gestione animazioni multi-step
 * @module core/MultiStepAnimationSystem
 * @version 1.0.0
 *
 * @description
 * Gestisce animazioni sequenziali multi-step per modelli 3D.
 * Supporta slave objects (seguono 1:1) e driven objects (movimento indipendente).
 *
 * @dependencies
 * - Three.js (window.THREE)
 * - Scene3D (window.Scene3D) per funzioni helper condivise
 *
 * @example
 * const success = MultiStepAnimationSystem.startMultiStepMovement(
 *     model,
 *     movementSteps,
 *     ['slave1', 'slave2'],
 *     [{objectName: 'driven1', translation: {x:0, y:0, z:1}, duration: 1.0}]
 * );
 */
window.MultiStepAnimationSystem = {
    /**
     * Avvia sequenza animazioni multi-step per un modello
     * @param {THREE.Object3D} model - Modello da animare
     * @param {Array} movementSteps - Array di step parsati dal MovementParser
     * @param {Array} slaveObjects - Lista nomi oggetti slave (seguono master)
     * @param {Array} drivenObjectsConfig - Configurazioni driven objects (movimento indipendente)
     * @returns {boolean} true se animazione avviata con successo
     */
    startMultiStepMovement: function(model, movementSteps, slaveObjects = [], drivenObjectsConfig = []) {
        if (!movementSteps || movementSteps.length === 0) {
            return false;
        }

        // Verifica dipendenze
        if (!window.Scene3D || !window.Scene3D.animationSystem) {
            console.error('[MultiStepAnimationSystem] Scene3D non disponibile');
            return false;
        }

        const modelUuid = model.uuid;
        const modelName = model.userData?.originalFilename || model.name;

        // DEBUG: Verifica che il modello ricevuto sia corretto
        console.log(`🎬 startMultiStepMovement: MODELLO RICEVUTO:`, {
            name: model.name,
            type: model.type,
            uuid: modelUuid,
            position: model.position.clone(),
            isChild: !!model.userData?.parentModel,
            parentName: model.userData?.parentModel?.name || 'N/A',
            matrixAutoUpdate: model.matrixAutoUpdate
        });

        // FIX: Per nodi GLB annidati, forza matrixAutoUpdate e aggiorna catena parent
        if (model.userData?.parentModel) {
            console.log(`🔧 FIX GLB CHILD: Forzando matrixAutoUpdate e aggiornamento parent chain`);

            // Forza matrixAutoUpdate su tutta la catena
            model.matrixAutoUpdate = true;
            let parent = model.parent;
            while (parent) {
                parent.matrixAutoUpdate = true;
                parent.updateMatrix();
                parent = parent.parent;
            }

            // Aggiorna matrice world di tutto il parent model
            model.userData.parentModel.updateMatrixWorld(true);

            console.log(`🔧 FIX GLB CHILD: matrixAutoUpdate=${model.matrixAutoUpdate}, parent chain aggiornata`);
        }

        window.Scene3D.animationSystem.multiStepAnimations.set(modelUuid, {
            model: model,
            steps: movementSteps,
            currentStepIndex: 0,
            isActive: true,
            modelName: modelName,
            slaveObjects: slaveObjects, // Lista di oggetti slave che seguono il master
            drivenObjectsConfig: drivenObjectsConfig // Array di configurazioni driven objects (movimento indipendente)
        });

        if (slaveObjects && slaveObjects.length > 0) {
            console.log(`🔗 SLAVE OBJECTS: ${slaveObjects.length} oggetti seguiranno "${modelName}": [${slaveObjects.join(', ')}]`);
        }

        if (drivenObjectsConfig && drivenObjectsConfig.length > 0) {
            console.log(`🚗 DRIVEN OBJECTS: ${drivenObjectsConfig.length} oggetti si muoveranno in modo indipendente:`);
            drivenObjectsConfig.forEach((config, index) => {
                console.log(`   ${index + 1}. "${config.objectName}" → traslazione (${config.translation.x}, ${config.translation.y}, ${config.translation.z}) in ${config.duration}s`);
            });
        }

        this.executeCurrentMultiStep(modelUuid);
        return true;
    },

    /**
     * Esegue lo step corrente della sequenza multi-step
     * @param {string} modelUuid - UUID del modello in animazione
     */
    executeCurrentMultiStep: function(modelUuid) {
        const multiStepData = window.Scene3D.animationSystem.multiStepAnimations.get(modelUuid);
        if (!multiStepData || !multiStepData.isActive) {
            return;
        }

        const currentStep = multiStepData.steps[multiStepData.currentStepIndex];
        if (!currentStep) {
            this.finishMultiStepMovement(modelUuid);
            return;
        }

        const model = multiStepData.model;
        const initialPosition = model.position.clone();
        const initialRotation = new THREE.Euler().copy(model.rotation);

        // DEBUG: Verifica modello durante esecuzione step
        console.log(`🎬 executeCurrentMultiStep: ANIMANDO MODELLO:`, {
            name: model.name,
            type: model.type,
            initialPosition: initialPosition,
            step: currentStep
        });

        let targetPosition = initialPosition.clone();
        let targetRotation = new THREE.Euler().copy(initialRotation);

        let rotationCenter = null;

        if (currentStep.centro) {
            // Usa il centro del bounding box attuale (ricalcolato ogni volta) come base per il comando centro:
            const currentBoundingBoxCenter = window.Scene3D.calculateBoundingBoxCenter(model);
            const centroOffset = new THREE.Vector3(
                currentStep.centro.x,
                currentStep.centro.y,
                currentStep.centro.z
            );

            rotationCenter = currentBoundingBoxCenter.clone().add(centroOffset);
            console.log(`🎯 DEBUG CENTRO:`);
            console.log(`   Centro bounding box attuale: (${currentBoundingBoxCenter.x.toFixed(3)}, ${currentBoundingBoxCenter.y.toFixed(3)}, ${currentBoundingBoxCenter.z.toFixed(3)})`);
            console.log(`   Offset richiesto: (${centroOffset.x.toFixed(3)}, ${centroOffset.y.toFixed(3)}, ${centroOffset.z.toFixed(3)})`);
            console.log(`   Centro rotazione finale: (${rotationCenter.x.toFixed(3)}, ${rotationCenter.y.toFixed(3)}, ${rotationCenter.z.toFixed(3)})`);
            console.log(`   Posizione attuale modello: (${model.position.x.toFixed(3)}, ${model.position.y.toFixed(3)}, ${model.position.z.toFixed(3)})`);

            // Mostra automaticamente la sfera nera del centro di rotazione solo se debug è attivo
            if (window.AppConfig && window.AppConfig.debug && window.AppConfig.debug.showRotationCenter) {
                window.Scene3D.createRotationCenterSphere(model.userData?.originalFilename || model.name, rotationCenter);
            }
        }

        if (currentStep.rotazione) {
            // Calcola il centro di rotazione fisso all'INIZIO dell'animazione
            const fixedRotationCenter = rotationCenter ? rotationCenter.clone() : window.Scene3D.calculateBoundingBoxCenter(model);
            console.log(`DEBUG: Centro rotazione fisso: (${fixedRotationCenter.x.toFixed(3)}, ${fixedRotationCenter.y.toFixed(3)}, ${fixedRotationCenter.z.toFixed(3)})`);

            const rotationMatrix = new THREE.Matrix4();
            rotationMatrix.makeRotationFromEuler(new THREE.Euler(
                THREE.MathUtils.degToRad(currentStep.rotazione.x),
                THREE.MathUtils.degToRad(currentStep.rotazione.y),
                THREE.MathUtils.degToRad(currentStep.rotazione.z)
            ));

            // Calcola sempre la targetPosition per rotazioni attorno a qualsiasi centro
            const relativePosition = model.position.clone().sub(fixedRotationCenter);
            relativePosition.applyMatrix4(rotationMatrix);
            targetPosition = fixedRotationCenter.clone().add(relativePosition);

            console.log(`DEBUG ROTAZIONE:`);
            console.log(`   Posizione iniziale: (${model.position.x.toFixed(3)}, ${model.position.y.toFixed(3)}, ${model.position.z.toFixed(3)})`);
            console.log(`   Centro rotazione: (${fixedRotationCenter.x.toFixed(3)}, ${fixedRotationCenter.y.toFixed(3)}, ${fixedRotationCenter.z.toFixed(3)})`);
            console.log(`   Posizione finale calcolata: (${targetPosition.x.toFixed(3)}, ${targetPosition.y.toFixed(3)}, ${targetPosition.z.toFixed(3)})`);

            targetRotation.x += THREE.MathUtils.degToRad(currentStep.rotazione.x);
            targetRotation.y += THREE.MathUtils.degToRad(currentStep.rotazione.y);
            targetRotation.z += THREE.MathUtils.degToRad(currentStep.rotazione.z);

            // Salva il centro fisso per l'animazione
            rotationCenter = fixedRotationCenter;
        }

        if (currentStep.traslazione) {
            if (currentStep.traslazione.targetElement) {
                const targetModel = window.Scene3D.findModelByName(currentStep.traslazione.targetElement);
                if (targetModel) {
                    // Gestione traslazione assoluta verso posizione originale
                    if (currentStep.traslazione.isAbsoluteToOriginal) {
                        // Traslazione assoluta: sposta direttamente alla posizione originale
                        targetPosition = targetModel.position.clone();
                        console.log(`🎯 ABSOLUTE ORIGINAL: Spostamento verso posizione originale`, {
                            model: model.userData?.originalFilename || model.name,
                            target: currentStep.traslazione.targetElement,
                            targetPosition: targetPosition.clone()
                        });
                    } else {
                        // Traslazione relativa: calcola offset come prima
                        const targetBoundingBoxCenter = window.Scene3D.calculateBoundingBoxCenter(targetModel);
                        const sourceBoundingBoxCenter = window.Scene3D.calculateBoundingBoxCenter(model);
                        const centerOffset = targetBoundingBoxCenter.clone().sub(sourceBoundingBoxCenter);

                        const additionalOffset = new THREE.Vector3(
                            currentStep.traslazione.x,
                            currentStep.traslazione.y,
                            currentStep.traslazione.z
                        );

                        targetPosition = model.position.clone().add(centerOffset).add(additionalOffset);
                    }
                } else {
                    targetPosition.add(new THREE.Vector3(
                        currentStep.traslazione.x,
                        currentStep.traslazione.y,
                        currentStep.traslazione.z
                    ));
                }
            } else {
                const currentBoundingBoxCenter = window.Scene3D.calculateBoundingBoxCenter(model);

                const newBoundingBoxCenter = currentBoundingBoxCenter.clone().add(new THREE.Vector3(
                    currentStep.traslazione.x,
                    currentStep.traslazione.y,
                    currentStep.traslazione.z
                ));

                const offsetFromBoundingBoxMove = newBoundingBoxCenter.clone().sub(currentBoundingBoxCenter);
                targetPosition = model.position.clone().add(offsetFromBoundingBoxMove);
            }
        }

        if (currentStep.appoggia) {
            // Calcola il bounding box del modello nella sua posizione attuale
            const boundingBox = new THREE.Box3().setFromObject(model);
            const minY = boundingBox.min.y;

            // Calcola quanto spostare il modello per appoggiare la parte inferiore a Y=0
            // La differenza tra la posizione attuale del modello e il punto più basso
            const offsetY = model.position.y - minY;

            // Imposta la posizione target Y per appoggiare il punto più basso a Y=0
            targetPosition.y = offsetY;
        }

        if (currentStep.resetCenteredOriginal) {
            // Reset posizione centrata originale
            if (currentStep.resetCenteredOriginal.animated) {
                // Reset animato - usa il sistema di animazione
                console.log(`🎬 RESET ANIMATO: Avvio reset centrato animato (${currentStep.resetCenteredOriginal.durata}s)`);
                window.Scene3D.animateAllModelsToCenteredOriginalPositions(currentStep.resetCenteredOriginal.durata);
            } else {
                // Reset immediato
                console.log(`🎯 RESET IMMEDIATO: Esecuzione reset centrato per tutti i modelli`);
                window.Scene3D.resetAllModelsToCenteredOriginalPositions();
            }

            // Termina immediatamente questo step multi-step
            this.finishMultiStepMovement(modelUuid);
            return;
        }

        if (currentStep.svita) {
            // Comando semplificato svita: rotazione + traslazione
            // Imposta il centro di rotazione al centro del bounding box del modello
            rotationCenter = window.Scene3D.calculateBoundingBoxCenter(model);

            console.log(`🔩 SVITA DEBUG per ${model.name}:`);
            console.log(`   Rotazione gradi:`, currentStep.svita.rotazione);
            console.log(`   Rotazione radianti: x=${THREE.MathUtils.degToRad(currentStep.svita.rotazione.x)}, y=${THREE.MathUtils.degToRad(currentStep.svita.rotazione.y)}, z=${THREE.MathUtils.degToRad(currentStep.svita.rotazione.z)}`);

            targetRotation.x += THREE.MathUtils.degToRad(currentStep.svita.rotazione.x);
            targetRotation.y += THREE.MathUtils.degToRad(currentStep.svita.rotazione.y);
            targetRotation.z += THREE.MathUtils.degToRad(currentStep.svita.rotazione.z);

            targetPosition.add(new THREE.Vector3(
                currentStep.svita.traslazione.x,
                currentStep.svita.traslazione.y,
                currentStep.svita.traslazione.z
            ));
        }

        if (currentStep.avvita) {
            // Comando semplificato avvita: rotazione inversa + traslazione inversa
            // Imposta il centro di rotazione al centro del bounding box del modello
            rotationCenter = window.Scene3D.calculateBoundingBoxCenter(model);

            console.log(`🔩 AVVITA DEBUG per ${model.name}:`);
            console.log(`   Rotazione gradi:`, currentStep.avvita.rotazione);
            console.log(`   Rotazione radianti: x=${THREE.MathUtils.degToRad(currentStep.avvita.rotazione.x)}, y=${THREE.MathUtils.degToRad(currentStep.avvita.rotazione.y)}, z=${THREE.MathUtils.degToRad(currentStep.avvita.rotazione.z)}`);

            targetRotation.x += THREE.MathUtils.degToRad(currentStep.avvita.rotazione.x);
            targetRotation.y += THREE.MathUtils.degToRad(currentStep.avvita.rotazione.y);
            targetRotation.z += THREE.MathUtils.degToRad(currentStep.avvita.rotazione.z);

            targetPosition.add(new THREE.Vector3(
                currentStep.avvita.traslazione.x,
                currentStep.avvita.traslazione.y,
                currentStep.avvita.traslazione.z
            ));
        }

        if (currentStep.estrai) {
            // Comando semplificato estrai: solo traslazione in uscita
            targetPosition.add(new THREE.Vector3(
                currentStep.estrai.traslazione.x,
                currentStep.estrai.traslazione.y,
                currentStep.estrai.traslazione.z
            ));
        }

        if (currentStep.inserisci) {
            // Comando semplificato inserisci: solo traslazione in entrata
            targetPosition.add(new THREE.Vector3(
                currentStep.inserisci.traslazione.x,
                currentStep.inserisci.traslazione.y,
                currentStep.inserisci.traslazione.z
            ));
        }

        // Risolvi slave objects da nomi a riferimenti modelli reali
        const slaveModels = [];
        if (multiStepData.slaveObjects && multiStepData.slaveObjects.length > 0) {
            console.log(`🔗 SLAVE OBJECTS: Elaborazione ${multiStepData.slaveObjects.length} oggetti slave...`);

            multiStepData.slaveObjects.forEach(slaveName => {
                try {
                    // Rimuovi estensione file se presente (es: tubograsso.glb -> tubograsso)
                    const cleanSlaveName = slaveName.replace(/\.(glb|gltf|obj|stl)$/i, '');

                    // Prova prima con il nome pulito, poi con il nome originale come fallback
                    let slaveModel = window.Scene3D.findModelByName(cleanSlaveName);
                    if (!slaveModel && cleanSlaveName !== slaveName) {
                        slaveModel = window.Scene3D.findModelByName(slaveName);
                    }

                    if (slaveModel) {
                        slaveModels.push({
                            model: slaveModel,
                            name: cleanSlaveName,
                            initialPosition: slaveModel.position.clone(),
                            initialRotation: new THREE.Euler().copy(slaveModel.rotation)
                        });
                        console.log(`🔗 SLAVE: "${cleanSlaveName}" collegato a master "${multiStepData.modelName}"`);
                    } else {
                        console.warn(`⚠️ SLAVE: Oggetto "${slaveName}" (cercato anche come "${cleanSlaveName}") non trovato nella scena`);
                        console.warn(`⚠️ SLAVE: Animazione continuerà SENZA questo slave object`);
                    }
                } catch (error) {
                    console.error(`❌ SLAVE ERROR: Errore elaborazione slave "${slaveName}":`, error);
                    console.warn(`⚠️ SLAVE: Animazione continuerà SENZA questo slave object`);
                }
            });

            console.log(`🔗 SLAVE OBJECTS: ${slaveModels.length}/${multiStepData.slaveObjects.length} slave objects collegati con successo`);
        }

        const animation = {
            model: model,
            modelUuid: modelUuid,
            stepIndex: multiStepData.currentStepIndex,
            initialPosition: initialPosition,
            targetPosition: targetPosition,
            initialRotation: initialRotation,
            targetRotation: targetRotation,
            startTime: performance.now(),
            duration: currentStep.durata,
            finished: false,
            isMultiStep: true,
            hasRotation: !!(currentStep.rotazione || currentStep.svita || currentStep.avvita),
            hasTranslation: !!(currentStep.traslazione || currentStep.svita || currentStep.avvita || currentStep.estrai || currentStep.inserisci),
            hasAppoggia: !!currentStep.appoggia,
            hasSvita: !!currentStep.svita,
            hasAvvita: !!currentStep.avvita,
            hasEstrai: !!currentStep.estrai,
            hasInserisci: !!currentStep.inserisci,
            action: `MultiStep-${multiStepData.currentStepIndex + 1}`,
            modelCenter: rotationCenter,
            slaveModels: slaveModels // Oggetti slave da animare insieme al master
        };

        window.Scene3D.animationSystem.activeAnimations.push(animation);

        // DEBUG: Conferma aggiunta animazione
        console.log(`✅ [ANIM_ADDED] Animazione aggiunta a activeAnimations!`);
        console.log(`   Model: ${animation.model?.name}`);
        console.log(`   hasTranslation: ${animation.hasTranslation}, hasRotation: ${animation.hasRotation}`);
        console.log(`   Totale animazioni attive: ${window.Scene3D.animationSystem.activeAnimations.length}`);

        // NUOVO: Crea animazioni parallele per driven objects (se presenti)
        if (multiStepData.drivenObjectsConfig && multiStepData.drivenObjectsConfig.length > 0) {
            console.log(`🚗 DRIVEN OBJECTS: Creazione ${multiStepData.drivenObjectsConfig.length} animazioni parallele`);

            multiStepData.drivenObjectsConfig.forEach((drivenConfig, index) => {
                try {
                    console.log(`🚗 DRIVEN OBJECT ${index + 1}: Creazione animazione parallela per "${drivenConfig.objectName}"`);

                    // Trova il modello driven
                    const cleanDrivenName = drivenConfig.objectName.replace(/\.(glb|gltf|obj|stl)$/i, '');
                    let drivenModel = window.Scene3D.findModelByName(cleanDrivenName);

                    if (!drivenModel && cleanDrivenName !== drivenConfig.objectName) {
                        drivenModel = window.Scene3D.findModelByName(drivenConfig.objectName);
                    }

                    if (drivenModel) {
                        // Posizione iniziale e target del driven object
                        const drivenInitialPosition = drivenModel.position.clone();
                        const drivenTargetPosition = drivenInitialPosition.clone().add(
                            new THREE.Vector3(
                                drivenConfig.translation.x,
                                drivenConfig.translation.y,
                                drivenConfig.translation.z
                            )
                        );

                        // Crea animazione driven completamente indipendente
                        const drivenAnimation = {
                            model: drivenModel,
                            modelUuid: drivenModel.uuid,
                            initialPosition: drivenInitialPosition,
                            targetPosition: drivenTargetPosition,
                            initialRotation: new THREE.Euler().copy(drivenModel.rotation),
                            targetRotation: null, // Driven object: solo traslazione, no rotazione
                            startTime: performance.now(), // Parte in sincronia con master
                            duration: drivenConfig.duration,
                            finished: false,
                            isDriven: true, // Flag per identificare animazioni driven
                            masterModelUuid: modelUuid, // Riferimento al master per sincronizzazione completamento
                            action: `Driven-${cleanDrivenName}`
                        };

                        window.Scene3D.animationSystem.activeAnimations.push(drivenAnimation);

                        console.log(`🚗 DRIVEN OBJECT ${index + 1}: Animazione creata per "${cleanDrivenName}"`);
                        console.log(`   Posizione iniziale: (${drivenInitialPosition.x.toFixed(3)}, ${drivenInitialPosition.y.toFixed(3)}, ${drivenInitialPosition.z.toFixed(3)})`);
                        console.log(`   Posizione target: (${drivenTargetPosition.x.toFixed(3)}, ${drivenTargetPosition.y.toFixed(3)}, ${drivenTargetPosition.z.toFixed(3)})`);
                        console.log(`   Durata: ${drivenConfig.duration}s`);
                    } else {
                        console.warn(`⚠️ DRIVEN OBJECT ${index + 1}: Modello "${drivenConfig.objectName}" (cercato anche come "${cleanDrivenName}") non trovato nella scena`);
                        console.warn(`⚠️ DRIVEN OBJECT: Animazione master continuerà SENZA questo driven object`);
                    }
                } catch (error) {
                    console.error(`❌ DRIVEN ERROR ${index + 1}: Errore creazione animazione driven:`, error);
                    console.warn(`⚠️ DRIVEN OBJECT: Animazione master continuerà SENZA questo driven object`);
                }
            });
        }
    },

    /**
     * Callback chiamato al completamento di uno step multi-step
     * @param {string} modelUuid - UUID del modello
     */
    onMultiStepCompleted: function(modelUuid) {
        const multiStepData = window.Scene3D.animationSystem.multiStepAnimations.get(modelUuid);
        if (!multiStepData || !multiStepData.isActive) {
            return;
        }

        const completedStepIndex = multiStepData.currentStepIndex;
        multiStepData.currentStepIndex++;

        setTimeout(() => {
            if (multiStepData.currentStepIndex < multiStepData.steps.length) {
                // continue
            }
            this.executeCurrentMultiStep(modelUuid);
        }, 20); // Delay ridotto per transizioni più veloci tra sub-step
    },

    /**
     * Termina sequenza multi-step e avanza tutorial
     * @param {string} modelUuid - UUID del modello
     */
    finishMultiStepMovement: function(modelUuid) {
        const multiStepData = window.Scene3D.animationSystem.multiStepAnimations.get(modelUuid);
        if (multiStepData) {
            window.Scene3D.animationSystem.multiStepAnimations.delete(modelUuid);

            if (window.UI && window.UI.currentStepIndex !== undefined && window.UI.currentStepIndex >= 0) {
                window.Scene3D.markStepAsCompleted(window.UI.currentStepIndex);
            }

            window.Scene3D.advanceToNextTutorialStep();
        }
    }
};
