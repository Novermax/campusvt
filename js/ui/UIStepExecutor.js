/**
 * UIStepExecutor.js - Esecuzione step tutorial
 * Mixin: aggiunge metodi a window.UI
 */
(function() {
    const UI = window.UI;

    UI.goToStep = async function(stepIndex) {
        console.log(`[DEBUG] ⏭️ GOTO STEP chiamata con index: ${stepIndex}`);
        if (stepIndex < 0 || stepIndex >= this.tutorialSteps.length) {
            AppConfig.log(1, `Step index non valido: ${stepIndex}`);
            return;
        }

        // Guard contro chiamate concorrenti: se stiamo già navigando,
        // cancella la navigazione precedente e procedi con la nuova
        if (this.isNavigating) {
            console.log(`[UI] ⚠️ goToStep(${stepIndex}) interrompe navigazione precedente in corso (currentStep=${this.currentStepIndex})`);
            // Chiudi modal se aperto (potrebbe bloccare la navigazione precedente)
            this.hideInfoModal();
        }
        this.isNavigating = true;

        // IMPORTANTE: Cancella timeout auto-avanzamento pendente dallo step precedente
        // Questo previene il bug dove step vengono saltati quando:
        // 1. Step N con AutoAdvance schedula nextStep() con 200ms delay
        // 2. Un trigger/azione fa avanzare a Step N+1 prima che scadano i 200ms
        // 3. Quando scade il timeout, nextStep() salta a N+2 (saltando N+1)
        if (this.autoAdvanceTimeoutId) {
            console.log(`[UI] 🚫 Cancellato timeout auto-avanzamento pendente`);
            clearTimeout(this.autoAdvanceTimeoutId);
            this.autoAdvanceTimeoutId = null;
        }

        // IMPORTANTE: Cancella anche l'interval di polling AutoExecute
        // Questo previene che il polling del vecchio step scheduli un nextStep()
        if (this.autoExecuteIntervalId) {
            console.log(`[UI] 🚫 Cancellato polling AutoExecute dello step precedente`);
            clearInterval(this.autoExecuteIntervalId);
            this.autoExecuteIntervalId = null;
        }

        this.currentStepIndex = stepIndex;
        const step = this.tutorialSteps[stepIndex];

        console.log(`[DEBUG] ⏭️ Navigazione a step: "${step.title}"`);
        AppConfig.log(2, `Navigazione a step ${stepIndex + 1}: ${step.title}`);

        // IMPORTANTE: Reset silhouette/highlight da step precedente
        this.resetAllHighlights();

        // IMPORTANTE: Reset stato touch drag (cancella selezione + rimuovi ghost)
        // Previene ghost mesh residue che intercettano raycast nello step successivo
        if (window.TouchDragHandler && window.TouchDragHandler.interactionState.mode !== 'idle') {
            console.log('[UI] 🔄 Reset TouchDragHandler al cambio step');
            window.TouchDragHandler.cancelSelection();
        }

        // Mobile Optimizer: Lazy loading modelli per step corrente
        if (window.MobileOptimizer && window.MobileOptimizer.enabled) {
            window.MobileOptimizer.loadModelsForStep(stepIndex, this.tutorialSteps);
        }

        // Aggiorna fumetto PRIMA di eseguire lo step (così è visibile durante modal)
        this.updateStepSpeechBubble();

        // I pulsanti tutorial mantengono il loro stato radio button
        // Non c'è bisogno di aggiornarli per ogni step

        // Esegue l'azione del tutorial step (ora async per gestire modal)
        try {
            await this.executeStep(step);
        } catch (error) {
            console.error(`[UI] ❌ Errore durante esecuzione step "${step.title}":`, error);
        }

        // Aggiorna status
        this.updateStatus(`Step ${stepIndex + 1}/${this.tutorialSteps.length}: ${step.title}`);
        this.isNavigating = false;
    };
    /**
     * Reset di tutte le silhouette/highlight applicati agli oggetti
     * Chiamato quando si cambia step o tutorial
     */
    UI.resetAllHighlights = function() {
        if (!window.Scene3D || !window.Scene3D.scene) return;

        console.log('[UI] 🧹 Reset silhouette/highlight da tutti gli oggetti');

        // 1. Rimuovi evidenziazione modello corrente (Scene3D)
        if (window.Scene3D.removeHighlight) {
            window.Scene3D.removeHighlight();
            console.log('[UI] 🧹 Rimossa evidenziazione modello corrente');
        }

        // 2. Rimuovi evidenziazioni pulsanti (InteractiveObject3D)
        if (window.InteractiveObject3D && window.InteractiveObject3D.clearButtonHighlights) {
            window.InteractiveObject3D.clearButtonHighlights();
            console.log('[UI] 🧹 Rimosse evidenziazioni pulsanti');
        }

        // 2b. Rimuovi cerchi evidenziazione DragDrop
        if (window.Scene3D && window.Scene3D.highlightCircleManager) {
            window.Scene3D.highlightCircleManager.clearAllCircles();
            console.log('[UI] 🧹 Rimossi cerchi evidenziazione DragDrop');
        }

        // 3. Ripristina materiali DragDropSystem
        window.Scene3D.scene.traverse((object) => {
            if (object.isMesh) {
                // Ripristina materiale originale se salvato in DragDropSystem
                if (window.DragDropSystem && window.DragDropSystem.originalMaterialsMap) {
                    // Trova il modello root (parent con userData.originalFilename)
                    let rootModel = object;
                    while (rootModel.parent && !rootModel.userData.originalFilename) {
                        rootModel = rootModel.parent;
                    }

                    if (rootModel && window.DragDropSystem.originalMaterialsMap.has(rootModel.uuid)) {
                        const originalMaterials = window.DragDropSystem.originalMaterialsMap.get(rootModel.uuid);
                        if (originalMaterials.has(object.uuid)) {
                            object.material = originalMaterials.get(object.uuid);
                            object.renderOrder = 0;
                        }
                    }
                }
            }
        });

        // Pulisci la mappa dei materiali originali per evitare leak di memoria
        if (window.DragDropSystem && window.DragDropSystem.originalMaterialsMap) {
            window.DragDropSystem.originalMaterialsMap.clear();
        }

        AppConfig.log(3, '🧹 Reset highlight completato - tutti i sistemi puliti');
    };
    /* La funzione updateStepStates è stata rimossa perché ora i pulsanti
     * rappresentano tutorial (non step) e usano logica radio button */

    /**
     * Esegue un step del tutorial
     */
    UI.executeStep = async function(step) {
        console.log(`[DEBUG] 🚀 EXECUTE STEP chiamata per: "${step.title}"`);
        console.log(`[DEBUG] 🚀 Step properties:`, step.properties);
        AppConfig.log(2, `Esecuzione step: ${step.title}`, step.properties);

        // Cattura l'indice corrente per rilevare navigazione concorrente durante await
        const expectedStepIndex = this.currentStepIndex;

        // ═══════════════════════════════════════════════════════════════
        // AUTOACTION: Flag locale per esecuzione automatica completa
        // NOTA: NON mutare step.properties per evitare effetti collaterali
        // su re-esecuzione o jumpToStep. Usa variabili locali.
        // ═══════════════════════════════════════════════════════════════
        const isAutoactionStep = step.properties.Autoaction === 'true';
        // Determina se AutoExecute/AutoAdvance sono attivi (da proprietà o da Autoaction)
        const effectiveAutoExecute = step.properties.AutoExecute === 'true' || isAutoactionStep;
        const effectiveAutoAdvance = step.properties.AutoAdvance === 'true' || isAutoactionStep;

        if (isAutoactionStep) {
            console.log(`[UI] 🤖 Autoaction attivo per step: "${step.title}" — esecuzione completamente automatica`);

            // Equipaggia automaticamente l'utensile richiesto
            if (step.properties.Utensile) {
                if (window.ToolsManager && typeof window.ToolsManager.activateToolFromTutorial === 'function') {
                    window.ToolsManager.activateToolFromTutorial(step.properties.Utensile);
                    console.log(`[UI] 🔧 Autoaction: Utensile "${step.properties.Utensile}" equipaggiato automaticamente`);
                }
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // RESET: Pulisci posizione camera precedente
        // ═══════════════════════════════════════════════════════════════
        this.stepCameraState = null;
        this.hideResetCameraButton();
        console.log('📷 [UI] Reset stepCameraState per nuovo step');

        // ═══════════════════════════════════════════════════════════════
        // STEP CONTROLLER: Notifica cambio step corrente
        // ═══════════════════════════════════════════════════════════════
        if (window.StepController) {
            window.StepController.setCurrentStep(this.currentStepIndex, step);
        }

        // ═══════════════════════════════════════════════════════════════
        // STEP GATING MANAGER: Notifica cambio step per gating pulsanti/camera
        // ═══════════════════════════════════════════════════════════════
        if (window.StepGatingManager) {
            window.StepGatingManager.setStep(this.currentStepIndex, step.title);
        }

        // ═══════════════════════════════════════════════════════════════
        // INTERACTIVE OBJECT 3D: Evidenziazione pulsanti richiesti
        // ═══════════════════════════════════════════════════════════════
        if (window.InteractiveObject3D) {
            // Pulisci evidenziazioni precedenti
            window.InteractiveObject3D.clearButtonHighlights();

            // Evidenzia pulsanti richiesti da questo step (se presenti)
            if (step.properties.AcceptTrigger_Physical) {
                const triggers = step.properties.AcceptTrigger_Physical.split(',').map(t => t.trim());

                // Parsing HighlightOpacity (default: 0.5 = semitrasparente bilanciato)
                let highlightOpacity = 0.5;
                if (step.properties.HighlightOpacity) {
                    const parsed = parseFloat(step.properties.HighlightOpacity);
                    if (!isNaN(parsed) && parsed >= 0 && parsed <= 1.0) {
                        highlightOpacity = parsed;
                        console.log(`💡 [UI] HighlightOpacity personalizzata: ${highlightOpacity}`);
                    } else {
                        console.warn(`⚠️ [UI] HighlightOpacity non valida (${step.properties.HighlightOpacity}), uso default 0.5`);
                    }
                }

                window.InteractiveObject3D.highlightRequiredButtons(triggers, highlightOpacity);
                console.log(`💡 [UI] Evidenziati ${triggers.length} pulsanti richiesti per step "${step.title}" con opacità ${highlightOpacity}`);
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // TOOLS MANAGER: Pulizia + evidenziazione tool richiesto
        // IMPORTANTE: Fatto PRIMA del modal per garantire visibilità immediata
        // ═══════════════════════════════════════════════════════════════
        if (window.ToolsManager && typeof window.ToolsManager.clearToolHighlights === 'function') {
            window.ToolsManager.clearToolHighlights();
        }

        if (step.properties.Utensile) {
            // Evidenzia automaticamente il tool richiesto nella legenda
            const toolName = this.mapToolName(step.properties.Utensile);
            if (toolName) {
                AppConfig.log(3, `Strumento richiesto per step: ${toolName} - evidenziazione attiva`);

                // Evidenzia tool nella legenda con animazione pulse
                if (window.ToolsManager && typeof window.ToolsManager.highlightRequiredTool === 'function') {
                    window.ToolsManager.highlightRequiredTool(toolName);
                } else {
                    this.highlightRequiredTool(toolName); // Fallback a metodo UI locale
                }
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // CAMERA SETTINGS: Applicazione PRIMA del modal per posizionamento immediato
        // ═══════════════════════════════════════════════════════════════
        if (window.Scene3D && window.Scene3D.applyCameraSettings) {
            window.Scene3D.applyCameraSettings(step);
        }

        // Mostra modal informativo se presente parametro Message
        if (step.properties.Message) {
            const messageTitle = step.properties.MessageTitle || step.title || 'Informazione';
            AppConfig.log(2, `[UI] Mostrando modal informativo per step: ${step.title}`);

            // Prepara opzioni media (immagine o video)
            const mediaOptions = {};
            if (step.properties.MessageImage) {
                mediaOptions.image = step.properties.MessageImage;
                AppConfig.log(3, `[UI] Modal con immagine: ${mediaOptions.image}`);
            }
            if (step.properties.MessageVideo) {
                mediaOptions.video = step.properties.MessageVideo;
                AppConfig.log(3, `[UI] Modal con video: ${mediaOptions.video}`);
            }

            // Attendi che l'utente chiuda il modal prima di continuare
            console.log(`[DEBUG] 📋 MODAL: Attendo chiusura modal per step "${step.title}" (DragDrop=${step.properties.DragDrop}, isNavigating=${this.isNavigating}, _infoModalResolve=${!!this._infoModalResolve})`);
            await this.showInfoModal(step.properties.Message, messageTitle, mediaOptions);
            console.log(`[DEBUG] ✅ MODAL: Modal chiuso per step "${step.title}" - proseguo con esecuzione`);
            AppConfig.log(2, `[UI] Modal informativo chiuso`);

            // GUARD: controlla se la navigazione è cambiata mentre il modal era aperto
            // (es. l'utente ha cliccato → durante la visualizzazione del video)
            if (this.currentStepIndex !== expectedStepIndex) {
                console.warn(`[UI] ⚠️ Step cambiato durante modal (era ${expectedStepIndex}, ora ${this.currentStepIndex}) - interruzione executeStep per "${step.title}"`);
                return;
            }

            // Controlla se questo step ha SOLO il messaggio (nessuna altra azione)
            const hasOnlyMessage = !step.properties.Elemento &&
                                   !step.properties.DragDrop;

            if (hasOnlyMessage) {
                AppConfig.log(2, `[UI] Step puramente informativo (solo Message) - nessuna azione successiva`);

                // Se AutoExecute=true, avanza automaticamente dopo chiusura modal
                if (effectiveAutoExecute) {
                    console.log(`[UI] ⏭️ Message-only + AutoExecute → avanzo automaticamente`);
                    setTimeout(() => this.nextStep(), 300);
                }

                return; // Esci dalla funzione, non eseguire altre azioni
            }

            // Se arriviamo qui, lo step ha Message + altre azioni (DragDrop, Elemento)
            // Continuiamo l'esecuzione per abilitare queste funzionalità
            AppConfig.log(2, `[UI] Modal chiuso - continuo esecuzione step con azioni aggiuntive`);
        }

        // IMPORTANTE: Questo codice viene eseguito anche per step con Message + DragDrop/Elemento
        // NOTA: Camera settings e tool highlight sono già stati applicati PRIMA del modal (vedi sopra)
        
        // Applica impostazioni modelli se presenti
        if (window.Scene3D && window.Scene3D.applyModelSettings) {
            window.Scene3D.applyModelSettings(step);
        }

        // ═══════════════════════════════════════════════════════════════════════
        // SCREEN SYSTEM: Gestione modalità schermo interattivo
        // ═══════════════════════════════════════════════════════════════════════
        if (step.properties.ScreenMode === 'true' && window.ScreenSystem) {
            console.log(`📺 [UI] ScreenMode attivato per step: "${step.title}"`);

            // Determina quale schermo attivare
            let screenId = null;
            if (step.properties.Elemento) {
                // Estrai ID schermo dal nome modello
                const modelName = step.properties.Elemento.replace(/^models\//, '').replace(/\.(glb|obj|stl)$/, '');
                // Cerca schermo registrato che ha questo modello
                window.ScreenSystem.screens.forEach((config, id) => {
                    if (config.model && config.model.includes(modelName)) {
                        screenId = id;
                    }
                });

                // Se non trovato per modello, usa il nome del modello come ID
                if (!screenId) {
                    screenId = modelName;
                }
            }

            if (screenId) {
                // Attiva focus sullo schermo
                const viewId = step.properties.ScreenView || null;
                window.ScreenSystem.focusScreen(screenId, viewId);

                // Configura requisiti per completamento step
                const requiredHotspot = step.properties.RequiredHotspot || null;
                const requiredSequence = step.properties.RequiredSequence || null;
                window.ScreenSystem.configureStepRequirements(requiredHotspot, requiredSequence);

                AppConfig.log(2, `📺 SCREEN MODE: Schermo "${screenId}" in focus`);
            } else {
                console.warn(`[UI] ⚠️ ScreenMode attivo ma nessuno schermo trovato per step`);
            }
        } else if (window.ScreenSystem && window.ScreenSystem.enabled) {
            // Se ScreenMode non attivo in questo step ma era attivo prima, disattiva
            window.ScreenSystem.unfocusScreen();
        }

        // ═══════════════════════════════════════════════════════════════════════
        // HOLDABLE SYSTEM: Gestione oggetti prendibili in mano
        // ═══════════════════════════════════════════════════════════════════════
        if (window.HoldableSystem) {
            // PRIMA: Registra oggetto come holdable se Holdable=true
            if (step.properties.Holdable === 'true' || step.properties.Holdable === true) {
                let objectName = null;
                if (step.properties.Elemento) {
                    objectName = step.properties.Elemento.replace(/^models\//, '').replace(/\.(glb|obj|stl)$/, '');
                }

                if (objectName && !window.HoldableSystem.isHoldable(objectName)) {
                    console.log(`[UI] 📝 Registrazione oggetto "${objectName}" come holdable`);
                    window.HoldableSystem.registerHoldable(objectName, {
                        HoldPosition: step.properties.HoldPosition,
                        HoldRotation: step.properties.HoldRotation,
                        Model: step.properties.Elemento
                    });
                }
            }

            // Gestione azione pick/release
            // NOTA: HoldAction=pick NON viene eseguito automaticamente qui!
            // L'utente deve CLICCARE sull'oggetto evidenziato per prenderlo.
            // La logica del pick al click è in scene3d-modular.js handleModelAction
            if (step.properties.HoldAction) {
                const action = step.properties.HoldAction.toLowerCase();

                // Solo release viene eseguito automaticamente (per rilasciare oggetto)
                if (action === 'release') {
                    let objectName = null;
                    if (step.properties.Elemento) {
                        objectName = step.properties.Elemento.replace(/^models\//, '').replace(/\.(glb|obj|stl)$/, '');
                    }
                    if (objectName) {
                        console.log(`[UI] ✋ HoldAction=release per oggetto: "${objectName}"`);
                        window.HoldableSystem.releaseObject(objectName);
                    }
                } else if (action === 'pick') {
                    // pick NON automatico - aspetta click utente
                    console.log(`[UI] 🤚 HoldAction=pick configurato - in attesa click utente su elemento`);
                }
            }

            // Verifica stato richiesto (HoldState)
            if (step.properties.HoldState) {
                const requiredState = step.properties.HoldState.toLowerCase();
                let objectName = null;

                if (step.properties.Elemento) {
                    objectName = step.properties.Elemento.replace(/^models\//, '').replace(/\.(glb|obj|stl)$/, '');
                }

                if (objectName) {
                    const isCurrentlyHeld = window.HoldableSystem.isHeld(objectName);

                    if (requiredState === 'held' && !isCurrentlyHeld) {
                        console.warn(`[UI] ⚠️ HoldState=held richiesto ma "${objectName}" non è tenuto in mano`);
                    } else if (requiredState === 'released' && isCurrentlyHeld) {
                        console.warn(`[UI] ⚠️ HoldState=released richiesto ma "${objectName}" è ancora tenuto`);
                    } else {
                        AppConfig.log(3, `🤚 HoldState="${requiredState}" verificato per "${objectName}"`);
                    }
                }
            }
        }

        // NOTA: Tool highlighting per Utensile già applicato PRIMA del modal (vedi sopra)

        // Parsing driven objects (oggetti con movimento indipendente sincronizzato)
        // Sintassi: DrivenObjects=oggetto1.glb,traslazione:(x,y,z,durata);oggetto2.glb,traslazione:(x,y,z,durata)
        // Backward compatible: DrivenObject=oggetto.glb,traslazione:(x,y,z,durata)
        if (step.properties.DrivenObjects || step.properties.DrivenObject) {
            const drivenObjectsArray = [];

            // Supporta sia DrivenObjects (multipli) che DrivenObject (singolo) per backward compatibility
            const drivenProperty = step.properties.DrivenObjects || step.properties.DrivenObject;
            const drivenObjectsClean = drivenProperty.split('#')[0].trim();

            console.log(`[UI] 🚗 Parsing DrivenObjects: "${drivenObjectsClean}"`);

            // Split per multipli oggetti separati da `;`
            const drivenEntries = drivenObjectsClean.split(';').map(entry => entry.trim()).filter(entry => entry.length > 0);

            drivenEntries.forEach(entry => {
                // Supporto "follow": oggetto.glb,follow (segue il master 1:1)
                const followMatch = entry.match(/^([^,]+),\s*follow\s*$/);
                if (followMatch) {
                    const objectName = followMatch[1].trim();
                    // Aggiungi come slave object (segue il master rigidamente)
                    if (!step.properties.SlaveObjectsList) {
                        step.properties.SlaveObjectsList = [];
                    }
                    step.properties.SlaveObjectsList.push(objectName);
                    console.log(`[UI] 🚗 DRIVEN OBJECT (follow/slave): "${objectName}" → segue il master 1:1`);
                    return;
                }

                // Parsing formato: oggetto.glb,traslazione:(x,y,z,durata)
                const match = entry.match(/^([^,]+),traslazione:\(([^,]+),([^,]+),([^,]+),([^)]+)\)$/);

                if (match) {
                    const objectName = match[1].trim();
                    const x = parseFloat(match[2].trim());
                    const y = parseFloat(match[3].trim());
                    const z = parseFloat(match[4].trim());
                    const duration = parseFloat(match[5].trim());

                    if (!isNaN(x) && !isNaN(y) && !isNaN(z) && !isNaN(duration)) {
                        drivenObjectsArray.push({
                            objectName: objectName,
                            translation: { x, y, z },
                            duration: duration
                        });

                        console.log(`[UI] 🚗 DRIVEN OBJECT ${drivenObjectsArray.length}: "${objectName}" → traslazione (${x}, ${y}, ${z}) in ${duration}s`);
                    } else {
                        AppConfig.log(1, `⚠️ DRIVEN OBJECT: Coordinate o durata non valide: ${entry}`);
                    }
                } else {
                    AppConfig.log(1, `⚠️ DRIVEN OBJECT: Formato non valido: ${entry} (usare formato: oggetto.glb,traslazione:(x,y,z,durata) oppure oggetto.glb,follow)`);
                }
            });

            // Salva array di driven objects (anche se singolo per backward compatibility)
            if (drivenObjectsArray.length > 0) {
                step.properties.DrivenObjectsConfig = drivenObjectsArray;
                AppConfig.log(3, `🚗 DRIVEN OBJECTS: Configurati ${drivenObjectsArray.length} oggetti con movimento indipendente`);
            }
        }

        // NUOVO: Gestione sistema Drag & Drop se abilitato nello step
        console.log(`[DEBUG] 🎯 DRAG & DROP CHECK: DragDrop="${step.properties.DragDrop}", DragDropSystem=${!!window.DragDropSystem}, AssemblySystem.enabled=${window.AssemblySystem?.enabled}`);
        if (step.properties.DragDrop === 'true' && window.DragDropSystem) {
            console.log(`[DEBUG] 🎯 DRAG & DROP: Processo abilitazione per step "${step.title}"`);
            AppConfig.log(2, `🎯 DRAG & DROP: Abilitato per step "${step.title}"`);

            // Auto-attiva lo strumento "Mano" per step DragDrop
            // Il DragDropSystem richiede che il tool "mano" sia attivo per permettere il drag
            if (window.ToolsManager && typeof window.ToolsManager.activateToolFromTutorial === 'function') {
                const requiredTool = step.properties.Utensile || 'Mani';
                window.ToolsManager.activateToolFromTutorial(requiredTool);
                AppConfig.log(3, `🎯 DRAG & DROP: Auto-attivato strumento "${requiredTool}" per drag & drop`);
            }

            // Configura oggetti draggabili se specificati
            const draggableObjects = [];
            if (step.properties.DragDropObjects) {
                // Rimuovi commenti prima del parsing
                const cleanValue = step.properties.DragDropObjects.split('#')[0].trim();
                const objects = cleanValue.split(',').map(obj => obj.trim()).filter(obj => obj.length > 0);
                draggableObjects.push(...objects);
                AppConfig.log(3, `🎯 DRAG & DROP: Oggetti draggabili: ${objects.join(', ')}`);
            } else if (step.properties.Elemento) {
                // Se non specificato DragDropObjects, usa l'elemento del tutorial
                const elementName = step.properties.Elemento.replace(/^models\//, '').replace(/\.(glb|obj|stl)$/, '');
                draggableObjects.push(elementName);
                AppConfig.log(3, `🎯 DRAG & DROP: Oggetto draggabile automatico: ${elementName}`);
            }

            // Configura distanza di snap se specificata
            if (step.properties.DragDropDistance) {
                const distance = parseFloat(step.properties.DragDropDistance);
                if (!isNaN(distance)) {
                    window.DragDropSystem.setSnapDistance(distance);
                    AppConfig.log(3, `🎯 DRAG & DROP: Distanza snap impostata: ${distance}`);
                }
            }

            // Pre-redirect: se SnapPoint usa sintassi unificata offset:/pivot:, popola le proprietà
            // legacy PRIMA che vengano processate nei blocchi successivi
            if (step.properties.SnapPoint && !step.properties.SnapOffset && !step.properties.SnapPointPivot) {
                const spClean = step.properties.SnapPoint.split('#')[0].trim();
                if (spClean.startsWith('offset:')) {
                    step.properties.SnapOffset = spClean.substring(7).trim();
                    console.log(`[UI] 📍 SnapPoint→SnapOffset pre-redirect: "${step.properties.SnapOffset}"`);
                } else if (spClean.startsWith('pivot:')) {
                    step.properties.SnapPointPivot = spClean.substring(6).trim();
                    console.log(`[UI] 📍 SnapPoint→SnapPointPivot pre-redirect: "${step.properties.SnapPointPivot}"`);
                }
            }

            // NUOVO: SnapOffset - calcola automaticamente posizione snap come "posizione originale + offset"
            // Sintassi: SnapOffset=(x,y,z) - applica offset a TUTTI gli oggetti draggabili
            if (step.properties.SnapOffset && draggableObjects.length > 0) {
                const offsetClean = step.properties.SnapOffset.split('#')[0].trim();
                const offsetMatch = offsetClean.match(/\(([^,]+),([^,]+),([^)]+)\)/);
                
                if (offsetMatch) {
                    const offsetX = parseFloat(offsetMatch[1].trim());
                    const offsetY = parseFloat(offsetMatch[2].trim());
                    const offsetZ = parseFloat(offsetMatch[3].trim());
                    
                    if (!isNaN(offsetX) && !isNaN(offsetY) && !isNaN(offsetZ)) {
                        console.log(`[UI] 📐 SnapOffset rilevato: (${offsetX}, ${offsetY}, ${offsetZ})`);
                        
                        // Per ogni oggetto draggabile, calcola snap point = posizione originale + offset
                        draggableObjects.forEach(objectName => {
                            const obj = window.Scene3D ? window.Scene3D.findModelByName(objectName) : null;
                            if (obj) {
                                // Ottieni posizione originale (centro bounding box)
                                let originalPos = null;
                                
                                // Prima controlla se già salvata in DragDropSystem
                                if (window.DragDropSystem && window.DragDropSystem.originalPositions.has(obj.uuid)) {
                                    originalPos = window.DragDropSystem.originalPositions.get(obj.uuid).clone();
                                } else {
                                    // Calcola dal bounding box corrente
                                    const boundingBox = new THREE.Box3().setFromObject(obj);
                                    originalPos = boundingBox.getCenter(new THREE.Vector3());
                                }
                                
                                if (originalPos) {
                                    // Calcola posizione snap = originale + offset
                                    const snapX = originalPos.x + offsetX;
                                    const snapY = originalPos.y + offsetY;
                                    const snapZ = originalPos.z + offsetZ;
                                    
                                    // Imposta come custom snap position (BB center) per questo oggetto
                                    // NOTA: usa setCustomSnapPosition (non Pivot) perché il target è calcolato
                                    // dal centro BB originale + offset, quindi la distanza va misurata dal centro BB
                                    window.DragDropSystem.setCustomSnapPosition(objectName, snapX, snapY, snapZ);
                                    
                                    console.log(`[UI] 📐 SnapOffset per "${objectName}": originale (${originalPos.x.toFixed(3)}, ${originalPos.y.toFixed(3)}, ${originalPos.z.toFixed(3)}) + offset → snap (${snapX.toFixed(3)}, ${snapY.toFixed(3)}, ${snapZ.toFixed(3)})`);
                                }
                            } else {
                                console.warn(`[UI] ⚠️ SnapOffset: Oggetto "${objectName}" non trovato nella scena`);
                            }
                        });
                        
                        AppConfig.log(2, `📐 DRAG & DROP: SnapOffset (${offsetX}, ${offsetY}, ${offsetZ}) applicato a ${draggableObjects.length} oggetti`);
                    } else {
                        AppConfig.log(1, `⚠️ DRAG & DROP: Coordinate SnapOffset non valide: ${offsetClean}`);
                    }
                } else {
                    AppConfig.log(1, `⚠️ DRAG & DROP: Formato SnapOffset non valido: ${offsetClean} (usare formato: (x,y,z))`);
                }
            }

            // NUOVO: Applica InitialOffset agli oggetti draggabili
            // Questo sposta le viti/componenti in una posizione iniziale offset
            // così l'utente deve trascinarle verso la posizione finale
            if (step.properties.InitialOffset && draggableObjects.length > 0) {
                const offsetClean = step.properties.InitialOffset.split('#')[0].trim();
                const offsetMatch = offsetClean.match(/\(([^,]+),([^,]+),([^)]+)\)/);
                
                if (offsetMatch) {
                    const offsetX = parseFloat(offsetMatch[1].trim());
                    const offsetY = parseFloat(offsetMatch[2].trim());
                    const offsetZ = parseFloat(offsetMatch[3].trim());
                    
                    if (!isNaN(offsetX) && !isNaN(offsetY) && !isNaN(offsetZ)) {
                        console.log(`[UI] 📐 InitialOffset rilevato: (${offsetX}, ${offsetY}, ${offsetZ})`);
                        
                        // Applica offset a tutti gli oggetti draggabili
                        draggableObjects.forEach(objectName => {
                            const obj = window.Scene3D ? window.Scene3D.findModelByName(objectName) : null;
                            if (obj) {
                                // Salva posizione originale PRIMA di applicare offset
                                // (se non già salvata)
                                if (window.DragDropSystem && !window.DragDropSystem.originalPositions.has(obj.uuid)) {
                                    const boundingBox = new THREE.Box3().setFromObject(obj);
                                    const originalCenter = boundingBox.getCenter(new THREE.Vector3());
                                    window.DragDropSystem.originalPositions.set(obj.uuid, originalCenter.clone());
                                    console.log(`[UI] 💾 Salvata posizione originale per "${objectName}": (${originalCenter.x.toFixed(3)}, ${originalCenter.y.toFixed(3)}, ${originalCenter.z.toFixed(3)})`);
                                }
                                
                                // Applica offset alla posizione corrente
                                obj.position.x += offsetX;
                                obj.position.y += offsetY;
                                obj.position.z += offsetZ;
                                
                                console.log(`[UI] 📐 Applicato InitialOffset a "${objectName}": nuova posizione (${obj.position.x.toFixed(3)}, ${obj.position.y.toFixed(3)}, ${obj.position.z.toFixed(3)})`);
                            } else {
                                console.warn(`[UI] ⚠️ InitialOffset: Oggetto "${objectName}" non trovato nella scena`);
                            }
                        });
                        
                        AppConfig.log(2, `📐 DRAG & DROP: InitialOffset (${offsetX}, ${offsetY}, ${offsetZ}) applicato a ${draggableObjects.length} oggetti`);
                    } else {
                        AppConfig.log(1, `⚠️ DRAG & DROP: Coordinate InitialOffset non valide: ${offsetClean}`);
                    }
                } else {
                    AppConfig.log(1, `⚠️ DRAG & DROP: Formato InitialOffset non valido: ${offsetClean} (usare formato: (x,y,z))`);
                }
            }

            // NUOVO: Configura punti di snap a coordinate arbitrarie
            // Supporta anche sintassi unificata:
            //   SnapPoint=pivot:(x,y,z)    → equivale a SnapPointPivot=(x,y,z)
            //   SnapPoint=offset:(x,y,z)   → equivale a SnapOffset=(x,y,z)
            if (step.properties.SnapPoint) {
                const snapPointClean = step.properties.SnapPoint.split('#')[0].trim();
                console.log(`[UI] 📍 Parsing SnapPoint: "${snapPointClean}"`);

                // Rileva sintassi unificata: pivot:(...) o offset:(...)
                if (snapPointClean.startsWith('pivot:')) {
                    // Redireziona a SnapPointPivot
                    const pivotValue = snapPointClean.substring(6).trim();
                    step.properties.SnapPointPivot = pivotValue;
                    console.log(`[UI] 📍 SnapPoint→SnapPointPivot redirect: "${pivotValue}"`);
                } else if (snapPointClean.startsWith('offset:')) {
                    // Redireziona a SnapOffset
                    const offsetValue = snapPointClean.substring(7).trim();
                    step.properties.SnapOffset = offsetValue;
                    console.log(`[UI] 📍 SnapPoint→SnapOffset redirect: "${offsetValue}"`);
                }

                // RILEVA FORMATO: se contiene ":" → formato vecchio (per-oggetto) O redirect già gestito, altrimenti formato nuovo (globale)
                // Escludi i redirect pivot:/offset: che sono già stati gestiti
                const isRedirected = snapPointClean.startsWith('pivot:') || snapPointClean.startsWith('offset:');
                const isGlobalFormat = !snapPointClean.includes(':');

                if (isRedirected) {
                    // Il valore è stato spostato in SnapPointPivot o SnapOffset, verranno processati sotto
                    console.log(`[UI] 📍 SnapPoint redirect completato, skip processing diretto`);
                } else if (isGlobalFormat) {
                    // FORMATO NUOVO (GLOBALE): (x,y,z),(x2,y2,z2),(x3,y3,z3)
                    // Applica questi punti a TUTTI gli oggetti in DragDropObjects
                    const globalPoints = [];

                    // Parsing coordinate multiple separate da virgola
                    const coordMatches = snapPointClean.matchAll(/\(([^,]+),([^,]+),([^)]+)\)/g);
                    for (const match of coordMatches) {
                        const x = parseFloat(match[1].trim());
                        const y = parseFloat(match[2].trim());
                        const z = parseFloat(match[3].trim());

                        if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                            globalPoints.push({ x, y, z });
                        }
                    }

                    if (globalPoints.length > 0 && draggableObjects.length > 0) {
                        console.log(`[UI] 📍 FORMATO GLOBALE: ${globalPoints.length} punti per ${draggableObjects.length} oggetti`);

                        // Crea nomi fittizi per i punti globali (snap_point_0, snap_point_1, etc)
                        const globalTargetNames = globalPoints.map((point, idx) => `snap_point_${idx}_original`);

                        // Applica gli stessi punti snap a tutti gli oggetti draggabili
                        draggableObjects.forEach(objectName => {
                            // Configura snap multipli usando target names fittizi
                            window.DragDropSystem.setMultipleSnapTargets(objectName, globalTargetNames);

                            // Crea riferimenti virtuali per ogni punto
                            globalPoints.forEach((point, idx) => {
                                const targetName = globalTargetNames[idx];
                                // Crea oggetto virtuale con posizione fissa
                                const virtualTarget = {
                                    isOriginalReference: true,
                                    originalModelName: targetName,
                                    position: new THREE.Vector3(point.x, point.y, point.z)
                                };

                                // Registra nel sistema come riferimento _original virtuale
                                if (!window.Scene3D.virtualSnapTargets) {
                                    window.Scene3D.virtualSnapTargets = new Map();
                                }
                                window.Scene3D.virtualSnapTargets.set(targetName, virtualTarget);
                            });

                            AppConfig.log(3, `🎯 DRAG & DROP: Snap points globali per "${objectName}" -> ${globalPoints.length} coordinate`);
                        });

                        console.log(`[UI] ✅ Punti snap globali applicati: ${globalPoints.map(p => `(${p.x},${p.y},${p.z})`).join(', ')}`);
                    } else {
                        AppConfig.log(1, `⚠️ DRAG & DROP: SnapPoint globali specificati ma nessun oggetto draggabile o coordinate valide`);
                    }
                } else {
                    // FORMATO VECCHIO (PER-OGGETTO): oggetto1:(x,y,z);oggetto2:(x2,y2,z2)
                    const snapDeclarations = snapPointClean.split(';').map(s => s.trim()).filter(s => s.length > 0);
                    console.log(`[UI] 📍 FORMATO PER-OGGETTO: ${snapDeclarations.length} dichiarazioni`);

                    snapDeclarations.forEach(declaration => {
                        const match = declaration.match(/^([^:]+):\(([^,]+),([^,]+),([^)]+)\)$/);
                        if (match) {
                            const objectName = match[1].trim();
                            const x = parseFloat(match[2].trim());
                            const y = parseFloat(match[3].trim());
                            const z = parseFloat(match[4].trim());

                            if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                                window.DragDropSystem.setCustomSnapPosition(objectName, x, y, z);
                                AppConfig.log(3, `🎯 DRAG & DROP: Snap point per "${objectName}" a (${x}, ${y}, ${z})`);
                            } else {
                                AppConfig.log(1, `⚠️ DRAG & DROP: Coordinate non valide in SnapPoint: ${declaration}`);
                            }
                        } else {
                            AppConfig.log(1, `⚠️ DRAG & DROP: Formato SnapPoint non valido: ${declaration}`);
                        }
                    });
                }
            }

            // NUOVO: Configura punti di snap a coordinate arbitrarie usando PIVOT (invece del centro BB)
            if (step.properties.SnapPointPivot) {
                const snapPointPivotClean = step.properties.SnapPointPivot.split('#')[0].trim();
                console.log(`[UI] 📍 Parsing SnapPointPivot: "${snapPointPivotClean}"`);

                // RILEVA FORMATO: se contiene ":" → formato vecchio (per-oggetto), altrimenti formato nuovo (globale)
                const isGlobalFormat = !snapPointPivotClean.includes(':');

                if (isGlobalFormat) {
                    // FORMATO NUOVO (GLOBALE): (x,y,z),(x2,y2,z2),(x3,y3,z3)
                    // Applica questi punti a TUTTI gli oggetti in DragDropObjects
                    const globalPoints = [];

                    // Parsing coordinate multiple separate da virgola
                    const coordMatches = snapPointPivotClean.matchAll(/\(([^,]+),([^,]+),([^)]+)\)/g);
                    for (const match of coordMatches) {
                        const x = parseFloat(match[1].trim());
                        const y = parseFloat(match[2].trim());
                        const z = parseFloat(match[3].trim());

                        if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                            globalPoints.push({ x, y, z });
                        }
                    }

                    if (globalPoints.length > 0 && draggableObjects.length > 0) {
                        console.log(`[UI] 📍 FORMATO GLOBALE PIVOT: ${globalPoints.length} punti per ${draggableObjects.length} oggetti`);

                        // Per SnapPointPivot globale, usa coordinate dirette con flag usePivot
                        // Applica il PRIMO punto come snap pivot per tutti gli oggetti
                        draggableObjects.forEach(objectName => {
                            // Se c'è un solo punto, usalo direttamente
                            if (globalPoints.length === 1) {
                                const point = globalPoints[0];
                                window.DragDropSystem.setCustomSnapPositionPivot(objectName, point.x, point.y, point.z);
                            } else {
                                // Se ci sono più punti, crea target virtuali con flag pivot
                                const globalTargetNames = globalPoints.map((point, idx) => `snap_pivot_${idx}_original`);
                                
                                // Crea riferimenti virtuali per ogni punto con flag pivot
                                globalPoints.forEach((point, idx) => {
                                    const targetName = globalTargetNames[idx];
                                    const virtualTarget = {
                                        isOriginalReference: true,
                                        originalModelName: targetName,
                                        position: new THREE.Vector3(point.x, point.y, point.z),
                                        usePivot: true  // FLAG per modalità pivot
                                    };

                                    if (!window.Scene3D.virtualSnapTargets) {
                                        window.Scene3D.virtualSnapTargets = new Map();
                                    }
                                    window.Scene3D.virtualSnapTargets.set(targetName, virtualTarget);
                                });

                                // Configura snap multipli
                                window.DragDropSystem.setMultipleSnapTargets(objectName, globalTargetNames);
                                
                                // Imposta flag usePivot per l'oggetto
                                const obj = window.Scene3D.findModelByName(objectName);
                                if (obj) {
                                    const existingConfig = window.DragDropSystem.customSnapTargets.get(obj.uuid);
                                    if (existingConfig) {
                                        existingConfig.usePivot = true;
                                    }
                                }
                            }
                            AppConfig.log(3, `📍 DRAG & DROP: Snap points PIVOT globali per "${objectName}" -> ${globalPoints.length} coordinate`);
                        });

                        console.log(`[UI] ✅ Punti snap PIVOT globali applicati: ${globalPoints.map(p => `(${p.x},${p.y},${p.z})`).join(', ')}`);
                    } else {
                        AppConfig.log(1, `⚠️ DRAG & DROP: SnapPointPivot globali specificati ma nessun oggetto draggabile o coordinate valide`);
                    }
                } else {
                    // FORMATO VECCHIO (PER-OGGETTO): oggetto1:(x,y,z);oggetto2:(x2,y2,z2)
                    const snapDeclarations = snapPointPivotClean.split(';').map(s => s.trim()).filter(s => s.length > 0);
                    console.log(`[UI] 📍 FORMATO PER-OGGETTO PIVOT: ${snapDeclarations.length} dichiarazioni`);

                    snapDeclarations.forEach((declaration, index) => {
                        console.log(`[UI] 📍 Parsing dichiarazione ${index + 1}/${snapDeclarations.length}: "${declaration}"`);
                        const match = declaration.match(/^([^:]+):\(([^,]+),([^,]+),([^)]+)\)$/);
                        if (match) {
                            const objectName = match[1].trim();
                            const x = parseFloat(match[2].trim());
                            const y = parseFloat(match[3].trim());
                            const z = parseFloat(match[4].trim());

                            console.log(`[UI] 📍 Match trovato: oggetto="${objectName}", x=${x}, y=${y}, z=${z}`);

                            if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                                console.log(`[UI] 📍✅ Chiamata setCustomSnapPositionPivot per "${objectName}"...`);
                                window.DragDropSystem.setCustomSnapPositionPivot(objectName, x, y, z);
                                AppConfig.log(3, `📍 DRAG & DROP: Snap point PIVOT per "${objectName}" a (${x}, ${y}, ${z})`);
                            } else {
                                console.error(`[UI] 📍❌ Coordinate non valide: x=${x}, y=${y}, z=${z}`);
                                AppConfig.log(1, `⚠️ DRAG & DROP: Coordinate non valide in SnapPointPivot: ${declaration}`);
                            }
                        } else {
                            console.error(`[UI] 📍❌ Regex match fallito per: "${declaration}"`);
                            AppConfig.log(1, `⚠️ DRAG & DROP: Formato SnapPointPivot non valido: ${declaration}`);
                        }
                    });
                }
            }

            // NUOVO: Configura snap targets multipli intercambiabili
            if (step.properties.SnapTargets) {
                // Rimuovi commenti (tutto dopo #) prima del parsing
                const snapTargetsClean = step.properties.SnapTargets.split('#')[0].trim();
                console.log(`[UI] 🎯 Parsing SnapTargets: "${snapTargetsClean}"`);

                // RILEVA FORMATO: se contiene ":" → formato vecchio (per-oggetto), altrimenti formato nuovo (globale)
                const isGlobalFormat = !snapTargetsClean.includes(':');

                if (isGlobalFormat) {
                    // FORMATO NUOVO (GLOBALE): target1,target2,target3
                    // Applica questi target a TUTTI gli oggetti in DragDropObjects
                    const globalTargets = snapTargetsClean.split(',').map(t => t.trim()).filter(t => t.length > 0);

                    if (globalTargets.length > 0 && draggableObjects.length > 0) {
                        console.log(`[UI] 🎯 FORMATO GLOBALE: ${globalTargets.length} target per ${draggableObjects.length} oggetti`);

                        // Applica gli stessi target a tutti gli oggetti draggabili
                        draggableObjects.forEach(objectName => {
                            window.DragDropSystem.setMultipleSnapTargets(objectName, globalTargets);
                            AppConfig.log(3, `🎯 DRAG & DROP: Snap targets globali per "${objectName}" -> [${globalTargets.join(', ')}]`);
                        });

                        console.log(`[UI] ✅ Target globali applicati a tutti gli oggetti: [${globalTargets.join(', ')}]`);
                    } else {
                        AppConfig.log(1, `⚠️ DRAG & DROP: SnapTargets globali specificati ma nessun oggetto draggabile o target valido`);
                    }
                } else {
                    // FORMATO VECCHIO (PER-OGGETTO): oggetto1:target1,target2;oggetto2:target3,target4
                    const snapDeclarations = snapTargetsClean.split(';').map(s => s.trim()).filter(s => s.length > 0);
                    console.log(`[UI] 🎯 FORMATO PER-OGGETTO: ${snapDeclarations.length} dichiarazioni`);

                    snapDeclarations.forEach((declaration, idx) => {
                        console.log(`[UI] 🎯 Parsing dichiarazione ${idx + 1}: "${declaration}"`);
                        const colonIndex = declaration.indexOf(':');
                        if (colonIndex > 0) {
                            const objectName = declaration.substring(0, colonIndex).trim();
                            const targetsString = declaration.substring(colonIndex + 1).trim();
                            const targetNames = targetsString.split(',').map(t => t.trim()).filter(t => t.length > 0);

                            console.log(`[UI] 🎯 Oggetto: "${objectName}", Targets: [${targetNames.join(', ')}]`);

                            if (targetNames.length > 0) {
                                window.DragDropSystem.setMultipleSnapTargets(objectName, targetNames);
                                AppConfig.log(3, `🎯 DRAG & DROP: Snap targets per "${objectName}" -> [${targetNames.join(', ')}]`);
                            } else {
                                AppConfig.log(1, `⚠️ DRAG & DROP: Nessun target specificato in SnapTargets: ${declaration}`);
                            }
                        } else {
                            AppConfig.log(1, `⚠️ DRAG & DROP: Formato SnapTargets non valido: ${declaration}`);
                        }
                    });
                }
            }

            // Configura visibilità indicatori snap (sfere verdi)
            if (step.properties.ShowSnapIndicators !== undefined) {
                window.DragDropSystem.showSnapIndicators = (step.properties.ShowSnapIndicators === 'true');
                AppConfig.log(3, `🎯 DRAG & DROP: Indicatori snap ${window.DragDropSystem.showSnapIndicators ? 'visibili' : 'nascosti'}`);
            } else {
                // Default: nascosti
                window.DragDropSystem.showSnapIndicators = false;
            }

            // Rimuovi eventuali indicatori esistenti se disabilitati
            if (!window.DragDropSystem.showSnapIndicators && window.DragDropSystem.removeAllSnapIndicators) {
                window.DragDropSystem.removeAllSnapIndicators();
            }

            // Abilita il sistema con oggetti specificati
            try {
                console.log(`[DEBUG] 🎯 DRAG & DROP: Chiamata enable con oggetti:`, draggableObjects);
                window.DragDropSystem.enable(draggableObjects);
                console.log(`[DEBUG] ✅ DRAG & DROP: Sistema abilitato - status:`, window.DragDropSystem.enabled);
                AppConfig.log(2, `✅ DRAG & DROP: Sistema abilitato con ${draggableObjects.length} oggetti`);

                // NUOVO: Evidenzia automaticamente tutti gli oggetti draggabili con silhouette gialla
                // IMPORTANTE: Usa applicazione diretta materiale per supportare multipli oggetti simultanei
                if (window.Scene3D && window.Scene3D.highlightSystem && window.DragDropSystem) {
                    const highlightMaterial = window.Scene3D.highlightSystem.highlightMaterial;

                    draggableObjects.forEach(objName => {
                        const model = window.Scene3D.findModelByName(objName);
                        if (model) {
                            // Salva materiali originali per questo oggetto
                            // IMPORTANTE: Non salvare highlightMaterial come "originale"
                            const originalMaterials = new Map();
                            model.traverse((child) => {
                                if (child.isMesh && child.material) {
                                    // Skip se il materiale è già highlightMaterial (evita loop silhouette)
                                    const isHighlightMaterial = Array.isArray(child.material)
                                        ? child.material[0] === highlightMaterial
                                        : child.material === highlightMaterial;

                                    if (!isHighlightMaterial) {
                                        if (Array.isArray(child.material)) {
                                            originalMaterials.set(child.uuid, child.material.slice());
                                        } else {
                                            originalMaterials.set(child.uuid, child.material);
                                        }
                                    }
                                }
                            });
                            // Salva solo se ci sono materiali originali da salvare
                            if (originalMaterials.size > 0) {
                                window.DragDropSystem.originalMaterialsMap.set(model.uuid, originalMaterials);
                            }

                            // Applica materiale highlight direttamente (bypass highlightModel per multipli oggetti)
                            model.traverse((child) => {
                                if (child.isMesh) {
                                    if (Array.isArray(child.material)) {
                                        child.material = child.material.map(() => highlightMaterial);
                                    } else {
                                        child.material = highlightMaterial;
                                    }
                                    child.renderOrder = 999;
                                }
                            });
                            console.log(`[UI] 🟡 Highlight applicato a oggetto draggabile: "${objName}"`);
                        } else {
                            console.warn(`[UI] ⚠️ Modello non trovato per highlight: "${objName}"`);
                        }
                    });
                    AppConfig.log(2, `🟡 Evidenziati ${draggableObjects.length} oggetti draggabili`);
                }

                // Configura auto-avanzamento per step DragDrop puri (senza Elemento)
                // oppure per step con Autoaction=true (auto-advance forzato)
                const isPureDragDropStep = !step.properties.Elemento;
                const isAutoaction = step.properties.Autoaction === 'true';
                if ((isPureDragDropStep || isAutoaction) && draggableObjects.length > 0) {
                    console.log(`[UI] 🎯 Step DragDrop ${isAutoaction ? 'Autoaction' : 'puro'} rilevato - configurazione auto-avanzamento`);
                    window.DragDropSystem.resetSnapTracking();
                    window.DragDropSystem.setRequiredSnapObjects(draggableObjects);
                    window.DragDropSystem.enableAutoAdvance();
                    AppConfig.log(2, `⏭️ Auto-avanzamento abilitato - richiesti ${draggableObjects.length} snap`);
                } else {
                    // Step con Elemento - reset tracking ma NO auto-advance
                    window.DragDropSystem.resetSnapTracking();
                    console.log(`[UI] 🎯 Step DragDrop con Elemento - auto-avanzamento disabilitato`);
                }
                // EVIDENZIAZIONE CERCHI: Aggiungi cerchi gialli pulsanti sugli oggetti draggabili
                // Aiuta l'utente a identificare le viti/componenti piccoli da trascinare
                if (draggableObjects.length > 0 && window.Scene3D && window.Scene3D.highlightCircleManager) {
                    // Pulisci cerchi precedenti
                    window.Scene3D.highlightCircleManager.clearAllCircles();

                    draggableObjects.forEach(objectName => {
                        const obj = window.Scene3D.findModelByName(objectName);
                        if (obj) {
                            // Trova la mesh principale dell'oggetto per posizionare il cerchio
                            let targetMesh = null;
                            obj.traverse(child => {
                                if (child.isMesh && !targetMesh) {
                                    targetMesh = child;
                                }
                            });
                            if (targetMesh) {
                                const circleId = `dragdrop_${objectName}`;
                                window.Scene3D.highlightCircleManager.createCircle(circleId, targetMesh, 60, 0.7);
                                AppConfig.log(3, `🔵 DRAG & DROP: Cerchio evidenziazione per "${objectName}"`);
                            }
                        }
                    });
                }

            } catch (error) {
                console.error(`❌ DRAG & DROP: Errore abilitazione sistema:`, error);
            }
        } else if (step.properties.DragDrop !== 'true' && window.DragDropSystem && window.DragDropSystem.isEnabled()) {
            // Disabilita sistema se DragDrop non è esplicitamente 'true' (include 'false', undefined, null, ecc.)
            window.DragDropSystem.disable();
            AppConfig.log(2, `🚫 DRAG & DROP: Sistema disabilitato per step "${step.title}" (DragDrop=${step.properties.DragDrop})`);
        }

        // ═══════════════════════════════════════════════════════════════════════
        // AUTOACTION + DRAGDROP: Snap automatico degli oggetti alla posizione finale
        // Quando Autoaction=true e DragDrop=true, esegui auto-snap di tutti gli
        // oggetti draggabili senza attendere interazione utente
        // ═══════════════════════════════════════════════════════════════════════
        if (step.properties.Autoaction === 'true' && step.properties.DragDrop === 'true' && window.DragDropSystem) {
            console.log(`[UI] 🤖 Autoaction + DragDrop: avvio auto-snap oggetti per step "${step.title}"`);

            // Raccogli la lista degli oggetti draggabili (stessa logica del blocco DragDrop sopra)
            const autoSnapObjects = [];
            if (step.properties.DragDropObjects) {
                const cleanValue = step.properties.DragDropObjects.split('#')[0].trim();
                autoSnapObjects.push(...cleanValue.split(',').map(obj => obj.trim()).filter(obj => obj.length > 0));
            } else if (step.properties.Elemento) {
                const elementName = step.properties.Elemento.replace(/^models\//, '').replace(/\.(glb|obj|stl)$/, '');
                autoSnapObjects.push(elementName);
            }

            if (autoSnapObjects.length > 0) {
                // Delay per permettere al sistema DragDrop di configurare snap targets
                const autoSnapDelay = 300;
                setTimeout(() => {
                    console.log(`[UI] 🤖 Autoaction: esecuzione auto-snap per ${autoSnapObjects.length} oggetti`);
                    let snapIndex = 0;

                    const snapNext = () => {
                        if (snapIndex >= autoSnapObjects.length) return;

                        const objName = autoSnapObjects[snapIndex];
                        console.log(`[UI] 🤖 Autoaction: auto-snap oggetto ${snapIndex + 1}/${autoSnapObjects.length}: "${objName}"`);
                        const result = window.DragDropSystem.autoSnapToClosestTarget(objName);

                        if (!result) {
                            console.warn(`[UI] ⚠️ Autoaction: auto-snap fallito per "${objName}"`);
                        }

                        snapIndex++;
                        // Snap il prossimo oggetto con un piccolo delay per evitare conflitti
                        if (snapIndex < autoSnapObjects.length) {
                            setTimeout(snapNext, 200);
                        }
                    };

                    snapNext();
                }, autoSnapDelay);
            }
        }

        // ═══════════════════════════════════════════════════════════════════════
        // ANIMATED WINDOW SYSTEM: Finestra 2D con animazione a trigger alternato
        // ═══════════════════════════════════════════════════════════════════════
        // Supporta sia AnimatedImages (lista) che AnimatedImagesFolder (cartella)
        if ((step.properties.AnimatedImages || step.properties.AnimatedImagesFolder) && window.AnimatedWindowSystem) {
            const sourceType = step.properties.AnimatedImagesFolder ? 'AnimatedImagesFolder' : 'AnimatedImages';
            console.log(`[UI] 🖼️ ${sourceType} rilevato per step: "${step.title}"`);

            // Configura e mostra la finestra animata (async per supporto cartella)
            const success = await window.AnimatedWindowSystem.showFromStepConfig(step.properties);

            if (success) {
                AppConfig.log(2, `✅ ANIMATED WINDOW: Finestra animata avviata per step "${step.title}"`);

                // Lo step è bloccante - la finestra gestisce il proprio avanzamento
                // tramite il callback onComplete che chiama UI.nextStep()
                return; // Esci da executeStep - il flusso continua quando finestra chiude
            } else {
                console.error(`[UI] ❌ AnimatedWindow: Errore configurazione finestra`);
            }
        }

        // ═══════════════════════════════════════════════════════════
        // CAMERA: Calcola delay dinamico basato su CameraTransitionTime
        // ═══════════════════════════════════════════════════════════
        const cameraTransitionTime = step.properties.CameraTransitionTime_parsed ||
                                    parseFloat(step.properties.CameraTransitionTime) ||
                                    0.8; // Default 0.8s se non specificato
        const transitionMs = cameraTransitionTime * 1000;

        // NUOVO: Evidenzia automaticamente l'elemento del tutorial corrente
        // NOTA: Non evidenziare se AutoExecute=true (l'utente non deve interagire)
        if (step.properties.Elemento && window.Scene3D && window.Scene3D.highlightCurrentTutorialElement) {
            if (!effectiveAutoExecute) {
                console.log('📷 [UI] CameraTransitionTime:', cameraTransitionTime + 's (' + transitionMs + 'ms)');

                // Piccolo delay per permettere che il modello sia caricato e visibile
                setTimeout(() => {
                    window.Scene3D.highlightCurrentTutorialElement();

                    // CERCHIO SELEZIONE GIALLO per Elemento azionabile (convergere.txt)
                    // Il cerchio definisce l'area di interazione valida: il touch/click è
                    // accettato se cade dentro il cerchio, anche se il raycast manca la mesh.
                    if (window.Scene3D.highlightCircleManager && step.properties.DragDrop !== 'true') {
                        const cleanName = step.properties.Elemento.split('/').pop().replace(/\.(glb|gltf|obj|stl)$/i, '');
                        const obj = window.Scene3D.findModelByName(cleanName);
                        if (obj) {
                            let targetMesh = null;
                            const targetChild = step.properties.TargetChild;
                            if (targetChild) {
                                // Se TargetChild specificato, usa quella mesh specifica
                                obj.traverse(child => {
                                    if (!targetMesh && child.name === targetChild && child.isMesh) targetMesh = child;
                                });
                                // Fallback: prima mesh figlia del child trovato (anche se non è Mesh diretta)
                                if (!targetMesh) {
                                    let childNode = null;
                                    obj.traverse(child => { if (!childNode && child.name === targetChild) childNode = child; });
                                    if (childNode) childNode.traverse(child => { if (!targetMesh && child.isMesh) targetMesh = child; });
                                }
                            }
                            if (!targetMesh) {
                                // Nessun TargetChild o non trovato: usa prima mesh del modello
                                obj.traverse(child => { if (child.isMesh && !targetMesh) targetMesh = child; });
                            }
                            if (targetMesh) {
                                window.Scene3D.highlightCircleManager.createCircle(`elemento_${cleanName}`, targetMesh, 60, 0.7);
                                console.log(`[UI] 🟡 Cerchio selezione creato per Elemento "${cleanName}"${targetChild ? ` (TargetChild: ${targetChild})` : ''}`);
                            }
                        }
                    }

                    // ═══════════════════════════════════════════════════════════
                    // CAMERA: Memorizza posizione camera DOPO che è stata impostata
                    // ═══════════════════════════════════════════════════════════
                    // Delay = transitionMs + 300ms (margine sicurezza)
                    const cameraDelay = transitionMs + 300;
                    console.log('📷 [UI] Attesa completamento transizione camera:', cameraDelay + 'ms');

                    setTimeout(() => {
                        if (window.Scene3D && typeof window.Scene3D.getCameraInfo === 'function') {
                            this.stepCameraState = window.Scene3D.getCameraInfo();
                            console.log('📷 [UI] Posizione camera memorizzata per step:', step.title);
                            console.log('📷 [UI] Camera state:', this.stepCameraState);

                            // Mostra pulsante reset camera
                            this.showResetCameraButton();
                        }
                    }, cameraDelay);
                }, 200);
            } else {
                console.log(`[UI] 🤖 AutoExecute attivo - skip evidenziazione elemento`);
                console.log('📷 [UI] CameraTransitionTime:', cameraTransitionTime + 's (' + transitionMs + 'ms)');

                // Anche con AutoExecute, memorizza camera dopo transizione completa
                const cameraDelay = transitionMs + 500;
                console.log('📷 [UI] Attesa completamento transizione camera (AutoExecute):', cameraDelay + 'ms');

                setTimeout(() => {
                    if (window.Scene3D && typeof window.Scene3D.getCameraInfo === 'function') {
                        this.stepCameraState = window.Scene3D.getCameraInfo();
                        console.log('📷 [UI] Posizione camera memorizzata per step (AutoExecute):', step.title);
                        this.showResetCameraButton();
                    }
                }, cameraDelay);
            }
        } else {
            // Nessun elemento da evidenziare, ma potrebbe esserci cambio camera configurato
            const cameraDelayNoElement = transitionMs + 300;
            console.log('📷 [UI] Nessun elemento, CameraTransitionTime:', cameraTransitionTime + 's (' + cameraDelayNoElement + 'ms)');

            setTimeout(() => {
                if (window.Scene3D && typeof window.Scene3D.getCameraInfo === 'function') {
                    this.stepCameraState = window.Scene3D.getCameraInfo();
                    console.log('📷 [UI] Posizione camera memorizzata per step (nessun elemento):', step.title);
                    this.showResetCameraButton();
                }
            }, cameraDelayNoElement);
        }

        // NOTA: updateStepSpeechBubble() NON chiamato qui - già chiamato da goToStep()
        // Chiamarlo due volte causava doppia animazione (flickering "gonfiaggio")

        // Evento personalizzabile per altri moduli
        const event = new CustomEvent('tutorialStepChanged', {
            detail: { step, index: this.currentStepIndex, allSteps: this.tutorialSteps }
        });
        document.dispatchEvent(event);

        // ═══════════════════════════════════════════════════════════════════════
        // AUTO EXECUTE: Esecuzione automatica azione senza click utente
        // ═══════════════════════════════════════════════════════════════════════
        // IMPORTANTE: Salta questo blocco se step ha AutoSetVariant senza Elemento
        // (verrà gestito dal blocco AUTO-SET VARIANT più sotto)
        // IMPORTANTE: Salta anche se Autoaction + DragDrop (avanzamento gestito dal DragDrop auto-snap)
        const hasAutoSetVariant = !!step.properties.AutoSetVariant;
        const hasElemento = !!step.properties.Elemento;
        const skipAutoExecute = (hasAutoSetVariant && !hasElemento) ||
                                (step.properties.Autoaction === 'true' && step.properties.DragDrop === 'true');

        if (effectiveAutoExecute && skipAutoExecute) {
            if (step.properties.Autoaction === 'true' && step.properties.DragDrop === 'true') {
                console.log(`[UI] ⏭️ AutoExecute skippato (Autoaction + DragDrop) - avanzamento gestito da auto-snap`);
            } else {
                console.log(`[UI] ⏭️ AutoExecute skippato (ha AutoSetVariant senza Elemento) - verrà gestito da blocco SET VARIANT`);
            }
        }

        if (effectiveAutoExecute && window.Scene3D && !skipAutoExecute) {
            console.log(`[UI] 🤖 AutoExecute attivo per step: "${step.title}"`);

            // Determina il target dell'animazione
            let targetModel = null;
            let targetChild = null;

            if (step.properties.Elemento) {
                const elementName = step.properties.Elemento.replace(/^models\//, '').replace(/\.(glb|obj|stl)$/i, '');
                targetModel = window.Scene3D.findModelByName(elementName);

                if (targetModel) {
                    console.log(`[UI] 🤖 AutoExecute: Trovato modello "${elementName}"`);

                    // Se specificato TargetChild, cerca il figlio all'interno del modello
                    if (step.properties.TargetChild) {
                        const childName = step.properties.TargetChild.trim();
                        let found = false;

                        // DEBUG: Mostra tutti i child disponibili nel modello
                        console.log(`[UI] 🔍 DEBUG: Cercando child "${childName}" in "${elementName}"`);
                        console.log(`[UI] 🔍 DEBUG: Children disponibili nel modello:`);
                        let childCount = 0;
                        targetModel.traverse((child) => {
                            if (child.name) {
                                childCount++;
                                if (childCount <= 20) { // Limita output
                                    console.log(`   [${childCount}] "${child.name}" (type: ${child.type})`);
                                }
                            }
                            // Usa SOLO exact match e fermati al primo risultato
                            if (!found && child.name === childName) {
                                targetChild = child;
                                found = true;
                                // IMPORTANTE: Imposta riferimento al parent per il fix matrixAutoUpdate in scene3d
                                targetChild.userData.parentModel = targetModel;
                                targetChild.userData.parentModelName = elementName;
                                console.log(`[UI] ✅ AutoExecute: TROVATO child "${childName}" in "${elementName}" (parentModel impostato)`);
                            }
                        });
                        console.log(`[UI] 🔍 DEBUG: Totale ${childCount} child nel modello`);

                        if (!targetChild) {
                            console.warn(`[UI] ⚠️ AutoExecute: TargetChild "${childName}" NON TROVATO in "${elementName}"`);
                            console.warn(`[UI] 💡 Suggerimento: verifica che il nome esatto sia presente nell'elenco sopra`);
                        }
                    }
                } else {
                    console.warn(`[UI] ⚠️ AutoExecute: Modello "${elementName}" non trovato`);
                }
            }

            // Esegui animazione automaticamente con piccolo delay
            const self = this; // Riferimento per closure in tutti i path
            setTimeout(() => {
                const animTarget = targetChild || targetModel;
                if (animTarget && window.Scene3D.autoExecuteAnimation) {
                    // Passa sia il target che il modello root per home_config
                    const rootModel = targetModel || animTarget;
                    const animationStarted = window.Scene3D.autoExecuteAnimation(animTarget, step, rootModel);

                    if (animationStarted) {
                        // Aspetta che l'animazione multi-step sia completamente terminata
                        let pollAttempts = 0;
                        const maxPollAttempts = 100; // Max 5 secondi (animazioni possono essere lunghe)
                        let animationWasFound = false; // Flag per sapere se l'animazione è stata trovata almeno una volta

                        // Salva l'interval ID per poterlo cancellare in goToStep
                        this.autoExecuteIntervalId = setInterval(function() {
                            const activeAnims = window.Scene3D.animationSystem?.activeAnimations || [];
                            const multiStepAnims = window.Scene3D.animationSystem?.multiStepAnimations || new Map();

                            // Per animazioni multi-step, controlla se la sequenza è ancora in corso
                            const modelUuid = animTarget.uuid;
                            const isMultiStepInProgress = multiStepAnims.has(modelUuid);

                            // Cerca l'animazione corrente per questo modello
                            const myAnimation = activeAnims.find(anim => anim.model === animTarget);

                            if (myAnimation) {
                                animationWasFound = true;
                                // Animazione trovata! Per multi-step, non controllare finished qui
                                // perché ogni sub-step ha il suo ciclo
                                if (!myAnimation.isMultiStep && myAnimation.finished) {
                                    // Animazione semplice completata
                                    clearInterval(self.autoExecuteIntervalId);
                                    self.autoExecuteIntervalId = null;
                                    console.log(`[UI] 🤖 AutoExecute: Animazione semplice completata`);

                                    if (effectiveAutoAdvance) {
                                        console.log(`[UI] ⏭️ AutoAdvance=true → avanzo allo step successivo`);
                                        self.autoAdvanceTimeoutId = setTimeout(() => self.nextStep(), 50);
                                    } else {
                                        console.log(`[UI] ⏸️ AutoAdvance non impostato → aspetto interazione utente`);
                                    }
                                }
                                // Per multi-step, continua il polling
                            } else if (animationWasFound && !isMultiStepInProgress) {
                                // L'animazione era in corso ma ora non c'è più E la sequenza multi-step è terminata
                                // Questo significa che TUTTA la sequenza è completata!
                                clearInterval(self.autoExecuteIntervalId);
                                self.autoExecuteIntervalId = null;
                                console.log(`[UI] 🤖 AutoExecute: Sequenza multi-step completata`);

                                if (effectiveAutoAdvance) {
                                    console.log(`[UI] ⏭️ AutoAdvance=true → avanzo allo step successivo`);
                                    self.autoAdvanceTimeoutId = setTimeout(() => self.nextStep(), 50);
                                } else {
                                    console.log(`[UI] ⏸️ AutoAdvance non impostato → aspetto interazione utente`);
                                }
                            } else {
                                // Animazione non ancora trovata o ancora in corso
                                pollAttempts++;
                                if (pollAttempts >= maxPollAttempts) {
                                    // Timeout
                                    clearInterval(self.autoExecuteIntervalId);
                                    self.autoExecuteIntervalId = null;
                                    console.warn(`[UI] ⚠️ AutoExecute: Timeout attesa animazione (${maxPollAttempts * 50}ms)`);

                                    if (effectiveAutoAdvance) {
                                        console.log(`[UI] ⏭️ AutoAdvance=true → avanzo comunque`);
                                        self.autoAdvanceTimeoutId = setTimeout(() => self.nextStep(), 50);
                                    } else {
                                        console.log(`[UI] ⏸️ AutoAdvance non impostato → aspetto interazione utente`);
                                    }
                                }
                            }
                        }, 50); // Polling ogni 50ms
                    } else {
                        // Nessuna animazione avviata
                        console.log(`[UI] 🤖 AutoExecute: Nessuna animazione da attendere`);

                        // Controlla AutoAdvance prima di avanzare
                        if (effectiveAutoAdvance) {
                            console.log(`[UI] ⏭️ AutoAdvance=true → avanzo subito`);
                            this.autoAdvanceTimeoutId = setTimeout(() => this.nextStep(), 50);
                        } else {
                            console.log(`[UI] ⏸️ AutoAdvance non impostato → aspetto interazione utente`);
                        }
                    }
                } else if (animTarget && window.Scene3D.startModelAnimation) {
                    // Fallback al metodo esistente
                    window.Scene3D.startModelAnimation(animTarget, step);

                    // Ascolta completamento animazione (usa stesso sistema del path principale)
                    self.autoExecuteIntervalId = setInterval(function() {
                        const stillAnimating = window.Scene3D.animationSystem?.activeAnimations?.some(
                            anim => anim.model === animTarget && !anim.finished
                        );
                        if (!stillAnimating) {
                            clearInterval(self.autoExecuteIntervalId);
                            self.autoExecuteIntervalId = null;
                            console.log(`[UI] 🤖 AutoExecute: Animazione completata (fallback)`);

                            // Controlla AutoAdvance prima di avanzare
                            if (effectiveAutoAdvance) {
                                console.log(`[UI] ⏭️ AutoAdvance=true → avanzo allo step successivo`);
                                self.autoAdvanceTimeoutId = setTimeout(() => self.nextStep(), 50);
                            } else {
                                console.log(`[UI] ⏸️ AutoAdvance non impostato → aspetto interazione utente`);
                            }
                        }
                    }, 50);
                } else {
                    console.warn(`[UI] ⚠️ AutoExecute: Nessun target valido per animazione`);

                    // Controlla AutoAdvance prima di avanzare
                    if (effectiveAutoAdvance) {
                        console.log(`[UI] ⏭️ AutoAdvance=true → avanzo comunque`);
                        this.autoAdvanceTimeoutId = setTimeout(() => this.nextStep(), 50);
                    } else {
                        console.log(`[UI] ⏸️ AutoAdvance non impostato → aspetto interazione utente`);
                    }
                }
            }, 20); // Delay ridotto per transizioni più veloci
        }

        // ═══════════════════════════════════════════════════════════════════════
        // SET VARIANT: Esecuzione automatica setVariant senza click
        // ═══════════════════════════════════════════════════════════════════════
        if (step.properties.AutoSetVariant && window.InteractiveObject3D) {
            const variants = step.properties.AutoSetVariant.split(';');
            variants.forEach(variantDecl => {
                const match = variantDecl.trim().match(/^(\w+)=(\w+)$/);
                if (match) {
                    const [, groupName, variantName] = match;
                    console.log(`[UI] 🔀 AutoSetVariant: ${groupName}=${variantName}`);
                    window.InteractiveObject3D.setStateVariant(groupName, variantName);
                }
            });

            // ═══════════════════════════════════════════════════════════════════
            // AUTO-AVANZAMENTO: Se AutoSetVariant con AutoExecute e AutoAdvance
            // ═══════════════════════════════════════════════════════════════════
            // Condizione: AutoExecute=true E AutoAdvance=true MA senza Elemento (quindi nessuna animazione da attendere)
            const hasAutoExecute = effectiveAutoExecute;
            const hasAutoAdvance = effectiveAutoAdvance;
            const hasElemento = !!step.properties.Elemento;

            if (hasAutoExecute && hasAutoAdvance && !hasElemento) {
                console.log(`[UI] 🔀 AutoSetVariant: AutoExecute + AutoAdvance senza animazioni`);
                // Breve delay per permettere al cambio variante di renderizzarsi
                this.autoAdvanceTimeoutId = setTimeout(() => {
                    console.log(`[UI] ⏭️ AutoAdvance=true → avanzo allo step successivo`);
                    this.nextStep();
                }, 300);
            } else if (hasAutoExecute && !hasAutoAdvance && !hasElemento) {
                console.log(`[UI] 🔀 AutoSetVariant: AutoExecute senza AutoAdvance → aspetto interazione utente`);
            }
        }
    };
    /**
     * Mappa i nomi degli strumenti dal tutorial ai nomi interni
     */
    UI.mapToolName = function(tutorialToolName) {
        // Delega a ToolsManager se disponibile (supporta ToolRegistry dinamico)
        if (window.ToolsManager && typeof window.ToolsManager.mapToolName === 'function') {
            return window.ToolsManager.mapToolName(tutorialToolName);
        }

        // Fallback a mapping hardcoded
        const mapping = {
            'ChiaveBrugola': 'brugola',
            'ChiaveInglese': 'chiave_inglese',
            'Mani': 'mano',
            'Aria': 'aria',
            'Spray': 'spray',
            'Straccio': 'straccio'
        };

        return mapping[tutorialToolName] || null;
    };
    /**
     * Evidenzia lo strumento richiesto senza attivarlo
     */
    UI.highlightRequiredTool = function(toolName) {
        if (!toolName) return;
        
        // Trova elemento DOM del tool
        const toolElement = document.querySelector(`[data-tool="${toolName}"]`);
        if (!toolElement) {
            AppConfig.log(1, `Elemento tool non trovato: ${toolName}`);
            return;
        }
        
        // Rimuovi evidenziazione precedente da tutti i tool
        document.querySelectorAll('.tool-icon').forEach(icon => {
            icon.classList.remove('required', 'tool-highlight');
        });
        
        // Aggiungi evidenziazione al tool richiesto
        toolElement.classList.add('required', 'tool-highlight');
        
        AppConfig.log(3, `Tool evidenziato come richiesto: ${toolName}`);
        
        // Rimuovi evidenziazione dopo un certo tempo (se non viene cliccato)
        setTimeout(() => {
            if (toolElement && !this.toolsState[toolName]) {
                toolElement.classList.remove('required', 'tool-highlight');
                AppConfig.log(3, `Evidenziazione tool rimossa: ${toolName}`);
            }
        }, 10000); // 10 secondi
    };
    console.log('[UIStepExecutor] Modulo caricato');
})();
