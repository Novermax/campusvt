/**
 * UINavigationHelpers.js - Navigazione tutorial, jump-to-step, fast-forward
 * Mixin: aggiunge metodi a window.UI
 */
(function() {
    const UI = window.UI;

    /**
     * Avanza allo step successivo del tutorial
     */
    UI.nextStep = async function() {
        if (this.currentStepIndex < this.tutorialSteps.length - 1) {
            await this.goToStep(this.currentStepIndex + 1);
        } else {
            AppConfig.log(2, `[UI] Ultimo step del tutorial raggiunto`);
            // Mostra congratulazioni per completamento tutorial
            if (window.Scene3D && window.Scene3D.showTutorialCompletionCongratulations) {
                if (window.Scene3D.tutorialTracker) {
                    window.Scene3D.tutorialTracker.interactionsBlocked = true;
                }
                console.log('🎉 [UI] Tutorial completato! Mostrando congratulazioni...');
                setTimeout(() => {
                    window.Scene3D.showTutorialCompletionCongratulations();
                }, 500);
            }
        }
    };

    /**
     * Torna allo step precedente del tutorial
     */
    UI.prevStep = function() {
        if (this.currentStepIndex > 0) {
            this.goToStep(this.currentStepIndex - 1);
        } else {
            AppConfig.log(2, `[UI] Primo step del tutorial raggiunto`);
        }
    };

    /**
     * Gestisce il click sul fumetto descrizione
     * Disabilitato - l'utente avanza tramite interazione manuale o frecce navigazione
     */
    UI.onSpeechBubbleClick = async function() {
        // Click sul fumetto non avanza lo step - interazione manuale richiesta
        return;
    };

    /**
     * Carica configurazione assemblaggio da file JSON
     * @param {string} configPath - Percorso file configurazione
     * @returns {Promise<Object>} - Configurazione caricata
     */
    UI.loadAssemblyConfig = async function(configPath) {
        try {
            AppConfig.log(3, `🏗️ ASSEMBLY CONFIG: Caricamento da ${configPath}`);

            const response = await fetchFile(configPath);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const config = await response.json();
            AppConfig.log(3, `✅ ASSEMBLY CONFIG: Configurazione caricata`, config);

            return config;
        } catch (error) {
            console.error(`❌ ASSEMBLY CONFIG: Errore caricamento ${configPath}:`, error);
            throw error;
        }
    };

    /**
     * Aggiorna UI per riflettere cambio step assemblaggio
     * @param {string} stepName - Nome del nuovo step
     * @param {Object} assemblyStatus - Stato assemblaggio
     */
    UI.updateAssemblyStepUI = function(stepName, assemblyStatus) {
        try {
            AppConfig.log(3, `🏗️ UI UPDATE: Aggiornamento per step "${stepName}"`);

            // Aggiorna descrizione/titolo del tutorial step se presente
            const stepElement = document.querySelector('.tutorial-step-title');
            if (stepElement) {
                stepElement.textContent = `Assemblaggio: ${stepName}`;
                AppConfig.log(3, `🏗️ UI UPDATE: Titolo aggiornato`);
            }

            // Aggiorna descrizione se presente
            const descElement = document.querySelector('.tutorial-step-description');
            if (descElement) {
                const stepConfig = assemblyStatus.currentStepConfig;
                if (stepConfig && stepConfig.description) {
                    descElement.textContent = stepConfig.description;
                    AppConfig.log(3, `🏗️ UI UPDATE: Descrizione aggiornata`);
                }
            }

            // Mostra notifica di progresso (opzionale)
            const progressElement = document.querySelector('.assembly-progress');
            if (progressElement) {
                const currentIndex = assemblyStatus.currentStepIndex || 0;
                const totalSteps = assemblyStatus.totalSteps || 1;
                progressElement.textContent = `Step ${currentIndex + 1} di ${totalSteps}`;
                AppConfig.log(3, `🏗️ UI UPDATE: Progresso aggiornato: ${currentIndex + 1}/${totalSteps}`);
            }

            // IMPORTANTE: Aggiorna anche il fumetto tutorial per mostrare nuove istruzioni
            if (assemblyStatus.currentStepConfig && assemblyStatus.currentStepConfig.description) {
                try {
                    // Simula un cambio step tradizionale per aggiornare il fumetto
                    const bubbleElement = document.getElementById('stepSpeechBubble');
                    if (bubbleElement) {
                        const descriptionElement = bubbleElement.querySelector('.bubble-description');
                        if (descriptionElement) {
                            descriptionElement.textContent = assemblyStatus.currentStepConfig.description;
                            console.log(`[UI] 💬 Fumetto aggiornato con nuova descrizione step assemblaggio`);
                        }
                    }
                } catch (bubbleError) {
                    console.warn(`[UI] ⚠️ Errore aggiornamento fumetto:`, bubbleError);
                }
            }

            console.log(`[UI] ✅ UI aggiornata per step assemblaggio: ${stepName}`);
        } catch (error) {
            console.error(`[UI] ❌ Errore aggiornamento UI step assemblaggio:`, error);
        }
    };

    /**
     * Sincronizza avanzamento AssemblySystem con sistema tutorial normale
     * @param {string} stepName - Nome step AssemblySystem
     * @param {number} stepIndex - Indice step AssemblySystem
     * @param {Object} assemblyStatus - Stato assemblaggio
     */
    UI.syncAssemblyStepWithTutorial = function(stepName, stepIndex, assemblyStatus) {
        try {
            AppConfig.log(3, `🔄 SYNC: Tentativo sincronizzazione "${stepName}" con tutorial normale`);

            // Mappa step AssemblySystem a step tutorial normale
            const assemblyToTutorialMap = {
                'filtro_assembly': 1,      // Step 1 - Assemblaggio Sequenziale Guidato
                'coperchio_assembly': 2,   // Step 2 - Coperchio
                'viti_assembly': 3,        // Step 3 - Gruppo Viti Coperchio
                'tappini_assembly': 4,     // Step 4 - Tappini e Ingrassaggio
                'ingrassatori_assembly': 5 // Step 5 - Ingrassatore Finale
            };

            const tutorialStepNumber = assemblyToTutorialMap[stepName];
            if (tutorialStepNumber) {
                AppConfig.log(2, `🔄 SYNC: Avanzamento tutorial normale da AssemblySystem: Step ${tutorialStepNumber}`);

                // Simula click su pulsante Next del tutorial per avanzare l'UI
                const nextButton = document.getElementById('nextStepBtn');
                if (nextButton && !nextButton.disabled) {
                    // Avanza manualmente lo step counter se esiste una funzione globale
                    if (window.Scene3D && typeof window.Scene3D.goToTutorialStep === 'function') {
                        window.Scene3D.goToTutorialStep(tutorialStepNumber);
                        AppConfig.log(2, `🔄 SYNC: Tutorial avanzato a step ${tutorialStepNumber} via Scene3D`);
                    } else if (typeof this.goToTutorialStep === 'function') {
                        this.goToTutorialStep(tutorialStepNumber);
                        AppConfig.log(2, `🔄 SYNC: Tutorial avanzato a step ${tutorialStepNumber} via UI`);
                    } else {
                        // Fallback: click manuale su Next button
                        nextButton.click();
                        AppConfig.log(2, `🔄 SYNC: Tutorial avanzato via click Next button`);
                    }
                } else {
                    AppConfig.log(1, `🔄 SYNC: Next button non disponibile o disabilitato`);
                }
            } else {
                AppConfig.log(3, `🔄 SYNC: Step AssemblySystem "${stepName}" non mappato a tutorial normale`);
            }
        } catch (error) {
            console.error(`[UI] ❌ Errore sincronizzazione AssemblySystem-Tutorial:`, error);
        }
    };

    /**
     * Salta direttamente a uno step specifico del tutorial (numerazione umana 1-based)
     * IMPORTANTE: Applica automaticamente le trasformazioni di tutti gli step precedenti
     * @param {number} stepNumber - Numero step (1 = primo step, 2 = secondo step, etc.)
     * @param {boolean} applyPreviousSteps - Se true, applica trasformazioni step precedenti (default: true)
     * @example UI.jumpToStep(5) // Salta al 5° step applicando trasformazioni step 1-4
     */
    UI.jumpToStep = function(stepNumber, applyPreviousSteps = true) {
        if (!this.tutorialSteps || this.tutorialSteps.length === 0) {
            console.error('❌ Nessun tutorial caricato. Carica prima uno scenario con tutorial.');
            return false;
        }

        // Converti da 1-based (umano) a 0-based (array)
        const stepIndex = stepNumber - 1;

        if (stepIndex < 0 || stepIndex >= this.tutorialSteps.length) {
            console.error(`❌ Step ${stepNumber} non valido. Step disponibili: 1-${this.tutorialSteps.length}`);
            console.log('💡 Usa UI.listTutorialSteps() per vedere tutti gli step disponibili');
            return false;
        }

        const step = this.tutorialSteps[stepIndex];
        console.log(`⏭️ Saltando allo step ${stepNumber}/${this.tutorialSteps.length}: "${step.title}"`);

        // Se richiesto, applica le trasformazioni degli step precedenti per avere lo stato corretto
        if (applyPreviousSteps && stepIndex > 0) {
            console.log(`⚡ Fast-forward: Applicazione trasformazioni step 1-${stepNumber - 1}...`);
            this.applyPreviousStepsTransformations(stepIndex);
        }

        // Chiama il metodo goToStep esistente (che usa 0-based)
        this.goToStep(stepIndex);
        return true;
    };

    /**
     * Applica tutte le trasformazioni degli step precedenti al target step
     * Questo permette di saltare a uno step con lo stato corretto della scena
     * Esegue istantaneamente sia trasformazioni statiche che animazioni
     * @param {number} targetStepIndex - Indice target step (0-based)
     */
    UI.applyPreviousStepsTransformations = function(targetStepIndex) {
        if (!window.Scene3D) {
            console.warn('⚠️ Scene3D non disponibile per applicare trasformazioni');
            return;
        }

        let transformationsApplied = 0;
        let animationsApplied = 0;

        console.log(`⚡ Fast-forward: Applicazione stato step 1-${targetStepIndex}...`);

        // Itera tutti gli step precedenti al target
        for (let i = 0; i < targetStepIndex; i++) {
            const step = this.tutorialSteps[i];

            // 1. Applica prima le trasformazioni statiche (Posizione/Rotazione)
            if (window.Scene3D.applyModelSettings && step.properties) {
                window.Scene3D.applyModelSettings(step);

                const hasTransformations = Object.keys(step.properties).some(key =>
                    key.startsWith('Posizione') || key.startsWith('Rotazione')
                );

                if (hasTransformations) {
                    transformationsApplied++;
                }
            }

            // 2. Esegui istantaneamente le animazioni (Azione1, Azione2, ...)
            const actionsApplied = this.applyStepActionsInstantly(step, i);
            if (actionsApplied > 0) {
                animationsApplied += actionsApplied;
                console.log(`  ✓ Step ${i + 1}: "${step.title}" - ${actionsApplied} azioni eseguite`);
            }
        }

        const totalChanges = transformationsApplied + animationsApplied;
        if (totalChanges > 0) {
            console.log(`✅ Fast-forward completato: ${transformationsApplied} trasformazioni + ${animationsApplied} animazioni applicate`);
        } else {
            console.log(`ℹ️ Nessuna trasformazione da applicare negli step 1-${targetStepIndex}`);
        }
    };

    /**
     * Applica istantaneamente tutte le azioni di uno step (Azione1, Azione2, ...)
     * Calcola ed esegue le trasformazioni finali senza animazione
     * @param {Object} step - Step del tutorial
     * @param {number} stepIndex - Indice dello step (per log)
     * @returns {number} Numero di azioni applicate
     */
    UI.applyStepActionsInstantly = function(step, stepIndex) {
        // Verifica se lo step ha un elemento da animare
        const elementoPath = step.properties.Elemento;
        if (!elementoPath) {
            return 0; // Nessuna azione da applicare se non c'è elemento
        }

        // Trova il modello nella scena
        const modelFilename = elementoPath.split('/').pop();
        const model = window.Scene3D.findModelByName(modelFilename);
        if (!model) {
            console.warn(`⚠️ Modello "${modelFilename}" non trovato per step ${stepIndex + 1}`);
            return 0;
        }

        let actionsCount = 0;

        // Cerca tutte le azioni (Azione1, Azione2, ..., Azione50)
        for (let actionNum = 1; actionNum <= 50; actionNum++) {
            const actionKey = `Azione${actionNum}`;
            const actionValue = step.properties[actionKey];

            if (!actionValue) {
                break; // Nessuna azione successiva, stop
            }

            // Applica l'azione istantaneamente
            try {
                this.applyActionInstantly(model, actionValue, modelFilename);
                actionsCount++;
            } catch (error) {
                console.error(`❌ Errore applicazione ${actionKey} step ${stepIndex + 1}:`, error);
            }
        }

        return actionsCount;
    };

    /**
     * Applica istantaneamente una singola azione a un modello
     * Supporta: traslazione, rotazione, svita, avvita, estrai, inserisci, appoggia
     * @param {THREE.Object3D} model - Modello Three.js
     * @param {string} actionString - Stringa azione (es. "traslazione:(0,0.1,0,1)")
     * @param {string} modelFilename - Nome file modello (per direzioni)
     */
    UI.applyActionInstantly = function(model, actionString, modelFilename) {
        // Determina il tipo di azione
        const actionType = actionString.split(/[(:]/)[0];

        if (actionType === 'traslazione') {
            // Parse: traslazione:(x,y,z,durata) o traslazione:target_original,(x,y,z,durata)
            const parsed = window.Scene3D.parseMovementOperation(actionString, 'traslazione', modelFilename);

            if (parsed.targetName && parsed.targetName.endsWith('_original')) {
                // Traslazione relativa a target originale
                const targetModelName = parsed.targetName.replace('_original', '');
                const targetModel = window.Scene3D.findModelByName(targetModelName);
                if (targetModel) {
                    const targetBB = new THREE.Box3().setFromObject(targetModel);
                    const targetCenter = targetBB.getCenter(new THREE.Vector3());
                    model.position.set(
                        targetCenter.x + parsed.x,
                        targetCenter.y + parsed.y,
                        targetCenter.z + parsed.z
                    );
                }
            } else {
                // Traslazione normale
                model.position.x += parsed.x;
                model.position.y += parsed.y;
                model.position.z += parsed.z;
            }

        } else if (actionType === 'rotazione') {
            // Parse: rotazione:(rx,ry,rz,durata)
            const parsed = window.Scene3D.parseMovementOperation(actionString, 'rotazione', modelFilename);
            model.rotation.x += parsed.x * Math.PI / 180; // Converti gradi → radianti
            model.rotation.y += parsed.y * Math.PI / 180;
            model.rotation.z += parsed.z * Math.PI / 180;

        } else if (actionType === 'svita') {
            // Parse: svita o svita(distanza)
            const parsed = window.Scene3D.parseMovementOperation(actionString, 'svita', modelFilename);
            // Applica traslazione
            model.position.x += parsed.traslazione.x;
            model.position.y += parsed.traslazione.y;
            model.position.z += parsed.traslazione.z;
            // Applica rotazione
            model.rotation.x += parsed.rotazione.x * Math.PI / 180;
            model.rotation.y += parsed.rotazione.y * Math.PI / 180;
            model.rotation.z += parsed.rotazione.z * Math.PI / 180;

        } else if (actionType === 'avvita') {
            // Parse: avvita o avvita(distanza)
            const parsed = window.Scene3D.parseMovementOperation(actionString, 'avvita', modelFilename);
            // Applica traslazione
            model.position.x += parsed.traslazione.x;
            model.position.y += parsed.traslazione.y;
            model.position.z += parsed.traslazione.z;
            // Applica rotazione
            model.rotation.x += parsed.rotazione.x * Math.PI / 180;
            model.rotation.y += parsed.rotazione.y * Math.PI / 180;
            model.rotation.z += parsed.rotazione.z * Math.PI / 180;

        } else if (actionType === 'estrai') {
            // Parse: estrai o estrai(distanza)
            const parsed = window.Scene3D.parseMovementOperation(actionString, 'estrai', modelFilename);
            model.position.x += parsed.traslazione.x;
            model.position.y += parsed.traslazione.y;
            model.position.z += parsed.traslazione.z;

        } else if (actionType === 'inserisci') {
            // Parse: inserisci o inserisci(distanza)
            const parsed = window.Scene3D.parseMovementOperation(actionString, 'inserisci', modelFilename);
            model.position.x += parsed.traslazione.x;
            model.position.y += parsed.traslazione.y;
            model.position.z += parsed.traslazione.z;

        } else if (actionType === 'appoggia') {
            // Calcola bounding box e metti punto più basso a Y=0
            const boundingBox = new THREE.Box3().setFromObject(model);
            const minY = boundingBox.min.y;
            const offsetY = model.position.y - minY;
            model.position.y = offsetY;

        } else if (actionType === 'centro') {
            // Gestisce centro:(x,y,z);rotazione:(rx,ry,rz,durata)
            // Per semplicità ora ignoriamo centro (richiede cambio pivot)
            // TODO: Implementare se necessario
            console.warn(`⚠️ Azione "centro" non ancora supportata in fast-forward`);

        } else {
            console.warn(`⚠️ Tipo azione "${actionType}" non supportato in fast-forward`);
        }
    };

    /**
     * Lista tutti gli step del tutorial corrente
     * @returns {Array} Array degli step con informazioni dettagliate
     */
    UI.listTutorialSteps = function() {
        if (!this.tutorialSteps || this.tutorialSteps.length === 0) {
            console.warn('⚠️ Nessun tutorial caricato');
            return [];
        }

        console.log(`\n📋 Tutorial caricato: ${this.tutorialSteps.length} step disponibili\n`);
        console.log('═'.repeat(80));

        this.tutorialSteps.forEach((step, index) => {
            const stepNumber = index + 1;
            const isCurrent = (index === this.currentStepIndex);
            const marker = isCurrent ? '👉' : '  ';
            const title = step.title || 'Senza titolo';
            const description = step.properties.Descrizione || '';

            console.log(`${marker} Step ${stepNumber}: ${title}`);
            if (description) {
                console.log(`     └─ ${description}`);
            }

            // Mostra proprietà chiave dello step
            const keyProps = [];
            if (step.properties.Elemento) keyProps.push(`Elemento: ${step.properties.Elemento}`);
            if (step.properties.Utensile) keyProps.push(`Utensile: ${step.properties.Utensile}`);
            if (step.properties.DragDrop) keyProps.push('DragDrop attivo');

            if (keyProps.length > 0) {
                console.log(`     └─ ${keyProps.join(' | ')}`);
            }
        });

        console.log('═'.repeat(80));
        console.log(`\n💡 Usa UI.jumpToStep(N) per saltare a uno step specifico`);
        console.log(`💡 Step corrente: ${this.currentStepIndex + 1}\n`);

        return this.tutorialSteps.map((step, index) => ({
            number: index + 1,
            title: step.title,
            description: step.properties.Descrizione,
            isCurrent: (index === this.currentStepIndex)
        }));
    };

    /**
     * Cerca e salta a uno step per nome/titolo (ricerca parziale case-insensitive)
     * @param {string} searchTerm - Termine di ricerca nel titolo dello step
     * @example UI.jumpToStepByName("rimuovi vite") // Cerca step con "rimuovi vite" nel titolo
     */
    UI.jumpToStepByName = function(searchTerm) {
        if (!this.tutorialSteps || this.tutorialSteps.length === 0) {
            console.error('❌ Nessun tutorial caricato. Carica prima uno scenario con tutorial.');
            return false;
        }

        const search = searchTerm.toLowerCase();
        const matches = [];

        this.tutorialSteps.forEach((step, index) => {
            const title = (step.title || '').toLowerCase();
            const description = (step.properties.Descrizione || '').toLowerCase();

            if (title.includes(search) || description.includes(search)) {
                matches.push({
                    number: index + 1,
                    index: index,
                    title: step.title,
                    description: step.properties.Descrizione
                });
            }
        });

        if (matches.length === 0) {
            console.error(`❌ Nessuno step trovato con "${searchTerm}"`);
            console.log('💡 Usa UI.listTutorialSteps() per vedere tutti gli step disponibili');
            return false;
        }

        if (matches.length === 1) {
            const match = matches[0];
            console.log(`✅ Trovato: Step ${match.number} - ${match.title}`);
            this.goToStep(match.index);
            return true;
        }

        // Multiple matches - mostra lista
        console.log(`🔍 Trovati ${matches.length} step che contengono "${searchTerm}":\n`);
        matches.forEach(match => {
            console.log(`   ${match.number}. ${match.title}`);
            if (match.description) {
                console.log(`      └─ ${match.description}`);
            }
        });
        console.log(`\n💡 Usa UI.jumpToStep(N) per saltare a uno specifico step`);

        return matches;
    };

    // ===== FUNZIONI GLOBALI PER NAVIGAZIONE TUTORIAL =====
    // Shortcuts per accesso rapido dalla console durante sviluppo/testing

    /**
     * Salta a uno step specifico del tutorial
     * @param {number} stepNumber - Numero step (1-based)
     * @example jumpToStep(5) // Salta al 5° step
     */
    window.jumpToStep = function(stepNumber) {
        if (window.UI && typeof window.UI.jumpToStep === 'function') {
            return window.UI.jumpToStep(stepNumber);
        }
        console.error('❌ UI.jumpToStep non disponibile');
        return false;
    };

    /**
     * Lista tutti gli step del tutorial corrente
     * @example listSteps() // Mostra tutti gli step disponibili
     */
    window.listSteps = function() {
        if (window.UI && typeof window.UI.listTutorialSteps === 'function') {
            return window.UI.listTutorialSteps();
        }
        console.error('❌ UI.listTutorialSteps non disponibile');
        return [];
    };

    /**
     * Cerca e salta a uno step per nome
     * @param {string} searchTerm - Termine di ricerca
     * @example findStep("vite") // Cerca step con "vite" nel nome
     */
    window.findStep = function(searchTerm) {
        if (window.UI && typeof window.UI.jumpToStepByName === 'function') {
            return window.UI.jumpToStepByName(searchTerm);
        }
        console.error('❌ UI.jumpToStepByName non disponibile');
        return false;
    };

    console.log('[UINavigationHelpers] Modulo caricato');
})();
