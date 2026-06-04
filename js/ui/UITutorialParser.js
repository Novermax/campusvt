/**
 * UITutorialParser.js - Parsing tutorial.cvtscript e registrazione schermi
 * Mixin: aggiunge metodi a window.UI
 */
(function() {
    const UI = window.UI;

    /**
     * Carica e parsa il file tutorial.txt
     */
    UI.loadTutorial = async function(tutorialPath) {
        if (!tutorialPath) {
            console.log('❌ Nessun path tutorial specificato');
            return;
        }

        try {
            AppConfig.log(2, `Caricamento tutorial: ${tutorialPath}`);

            const response = await fetchFile(tutorialPath);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const content = await response.text();
            this.availableTutorials = this.parseTutorialContent(content);

            if (this.availableTutorials.length > 0) {
                // Applica automaticamente le impostazioni camera del primo tutorial disponibile
                const firstTutorial = this.availableTutorials[0];
                if (firstTutorial && firstTutorial.properties) {
                    this.applyInitialCameraSettings(firstTutorial);
                }

                // NON selezionare automaticamente nessun tutorial - lascia che l'utente scelga
                this.currentTutorial = null;
                this.tutorialSteps = [];
                this.currentStepIndex = -1; // -1 indica "nessun tutorial attivo"

                // Reset silhouette da tutorial precedente
                this.resetAllHighlights();

                this.createTutorialStepsBar();
                this.showTutorialStepsBar();
                // NON chiamare updateStepSpeechBubble() - il fumetto rimane nascosto

                // ✨ Mostra overlay selezione tutorial con pulsanti pulsanti
                setTimeout(() => {
                    this.showTutorialSelectionOverlay();
                }, 500); // Delay 500ms per permettere animazione barra tutorial

                AppConfig.log(2, `Tutorial disponibili: ${this.availableTutorials.length} - Camera impostata dal primo tutorial`);
            } else {
                this.hideStepSpeechBubble(); // Nasconde il fumetto se non ci sono tutorial
                AppConfig.log(1, 'Nessun tutorial trovato nel file');
            }

        } catch (error) {
            AppConfig.log(0, `Errore caricamento tutorial: ${error.message}`);
            this.showError(`Errore caricamento tutorial: ${error.message}`);
        }
    };

    /**
     * Parsa il contenuto del file tutorial.txt
     * Ora distingue tra tutorial principali e steps
     */
    UI.parseTutorialContent = function(content) {
        const tutorials = [];
        const lines = content.split('\n');
        let currentTutorial = null;
        let currentStep = null;
        let globalProperties = {}; // Raccoglie proprietà globali prima del primo tutorial

        // ═══════════════════════════════════════════════════════════════
        // SCREEN SYSTEM: Variabili per parsing definizioni schermi
        // ═══════════════════════════════════════════════════════════════
        let currentScreenSection = null;  // { type: 'screen'|'screenview'|'hotspot'|'action', id: string, properties: {} }
        const screenDefinitions = {
            screens: new Map(),
            views: new Map(),
            hotspots: new Map(),
            actions: new Map(),
            interactiveObjects: new Map(),  // InteractiveObject3D
            stateGroups: new Map(),         // StateGroup per varianti mutuamente esclusive
            screenSnaps: new Map()          // [ScreenSnap:id] — frame monitor per PngScreen
        };

        for (let line of lines) {
            line = line.trim();

            // Ignora righe vuote e commenti
            if (!line || line.startsWith('#') || line.startsWith('//')) continue;

            // Rimuovi commenti inline (dopo //)
            const commentIndex = line.indexOf('//');
            if (commentIndex !== -1) {
                line = line.substring(0, commentIndex).trim();
                if (!line) continue; // Se dopo aver rimosso il commento la riga è vuota, ignorala
            }

            // Rileva inizio sezione [Nome]
            if (line.startsWith('[') && line.endsWith(']')) {
                const sectionName = line.slice(1, -1);

                // ═══════════════════════════════════════════════════════════════
                // SCREEN SYSTEM: Rileva sezioni speciali per schermi interattivi
                // ═══════════════════════════════════════════════════════════════

                // [Screen:id] - Definizione schermo
                if (sectionName.startsWith('Screen:')) {
                    // Salva sezione precedente se era una sezione screen
                    if (currentScreenSection) {
                        this.saveScreenSection(currentScreenSection, screenDefinitions);
                    }

                    const screenId = sectionName.substring(7).trim(); // Rimuovi "Screen:"
                    currentScreenSection = { type: 'screen', id: screenId, properties: {} };
                    console.log(`📺 [PARSER] Sezione Screen rilevata: "${screenId}"`);
                    continue;
                }

                // [ScreenView:screen.view] - Definizione vista
                if (sectionName.startsWith('ScreenView:')) {
                    if (currentScreenSection) {
                        this.saveScreenSection(currentScreenSection, screenDefinitions);
                    }

                    const viewId = sectionName.substring(11).trim(); // Rimuovi "ScreenView:"
                    currentScreenSection = { type: 'screenview', id: viewId, properties: {} };
                    console.log(`📄 [PARSER] Sezione ScreenView rilevata: "${viewId}"`);
                    continue;
                }

                // [Hotspot:id] - Definizione hotspot
                if (sectionName.startsWith('Hotspot:')) {
                    if (currentScreenSection) {
                        this.saveScreenSection(currentScreenSection, screenDefinitions);
                    }

                    const hotspotId = sectionName.substring(8).trim(); // Rimuovi "Hotspot:"
                    currentScreenSection = { type: 'hotspot', id: hotspotId, properties: {} };
                    console.log(`🔘 [PARSER] Sezione Hotspot rilevata: "${hotspotId}"`);
                    continue;
                }

                // [ScreenAction:id] - Definizione azione
                if (sectionName.startsWith('ScreenAction:')) {
                    if (currentScreenSection) {
                        this.saveScreenSection(currentScreenSection, screenDefinitions);
                    }

                    const actionId = sectionName.substring(13).trim(); // Rimuovi "ScreenAction:"
                    currentScreenSection = { type: 'action', id: actionId, properties: {} };
                    console.log(`⚡ [PARSER] Sezione ScreenAction rilevata: "${actionId}"`);
                    continue;
                }

                // ═══════════════════════════════════════════════════════════════
                // INTERACTIVE OBJECT 3D: Rileva sezioni per oggetti interattivi
                // ═══════════════════════════════════════════════════════════════

                // [InteractiveObject:id] - Definizione oggetto 3D interattivo
                if (sectionName.startsWith('InteractiveObject:')) {
                    if (currentScreenSection) {
                        this.saveScreenSection(currentScreenSection, screenDefinitions);
                    }

                    const objectId = sectionName.substring(18).trim(); // Rimuovi "InteractiveObject:"
                    currentScreenSection = { type: 'interactiveObject', id: objectId, properties: {} };
                    console.log(`🎮 [PARSER] Sezione InteractiveObject rilevata: "${objectId}"`);
                    continue;
                }

                // [ScreenSnap:id] - Definizione snap point per agganciare quad-schermate ai monitor
                if (sectionName.startsWith('ScreenSnap:')) {
                    if (currentScreenSection) {
                        this.saveScreenSection(currentScreenSection, screenDefinitions);
                    }

                    const snapId = sectionName.substring(11).trim(); // Rimuovi "ScreenSnap:"
                    currentScreenSection = { type: 'screenSnap', id: snapId, properties: {} };
                    console.log(`📺 [PARSER] Sezione ScreenSnap rilevata: "${snapId}"`);
                    continue;
                }

                // [StateGroup:name] - Definizione gruppo varianti mutuamente esclusive
                if (sectionName.startsWith('StateGroup:')) {
                    if (currentScreenSection) {
                        this.saveScreenSection(currentScreenSection, screenDefinitions);
                    }

                    const groupName = sectionName.substring(11).trim(); // Rimuovi "StateGroup:"
                    currentScreenSection = { type: 'stateGroup', id: groupName, properties: {} };
                    console.log(`🔀 [PARSER] Sezione StateGroup rilevata: "${groupName}"`);
                    continue;
                }

                // Se arriviamo qui, non è una sezione screen - salva eventuale sezione screen precedente
                if (currentScreenSection) {
                    this.saveScreenSection(currentScreenSection, screenDefinitions);
                    currentScreenSection = null;
                }

                // Determina se è un tutorial principale o uno step
                const isStep = sectionName.toLowerCase().startsWith('step ') ||
                               sectionName.toLowerCase().startsWith('next step');

                if (isStep) {
                    // È uno step interno al tutorial corrente
                    if (currentStep && Object.keys(currentStep.properties).length > 0) {
                        if (currentTutorial) {
                            currentTutorial.steps.push(currentStep);
                        }
                    }

                    // Calcola numero step automaticamente se è [Next Step] o [Next Step - Descrizione]
                    let stepName = sectionName;
                    let stepTitle = sectionName;

                    if (sectionName.toLowerCase().startsWith('next step')) {
                        // Calcola il numero dello step automaticamente
                        const stepNumber = currentTutorial ? currentTutorial.steps.length + 1 : 1;

                        // Controlla se c'è una descrizione dopo "Next Step"
                        const dashIndex = sectionName.indexOf('-');
                        if (dashIndex !== -1) {
                            // Formato: [Next Step - Descrizione]
                            const description = sectionName.substring(dashIndex).trim(); // Include il "-"
                            stepName = `Step ${stepNumber} ${description}`;
                            stepTitle = `Step ${stepNumber} ${description}`;
                        } else {
                            // Formato: [Next Step]
                            stepName = `Step ${stepNumber}`;
                            stepTitle = `Step ${stepNumber}`;
                        }

                        AppConfig.log(3, `📝 PARSER: [${sectionName}] → automaticamente rinumerato come [${stepTitle}]`);
                    }

                    // Crea nuovo step
                    currentStep = {
                        name: stepName,
                        title: stepTitle,
                        properties: {}
                    };
                } else {
                    // È un tutorial principale
                    // Salva step precedente se esiste
                    if (currentStep && Object.keys(currentStep.properties).length > 0) {
                        if (currentTutorial) {
                            currentTutorial.steps.push(currentStep);
                        }
                    }

                    // Salva tutorial precedente se esiste
                    if (currentTutorial && currentTutorial.steps.length > 0) {
                        tutorials.push(currentTutorial);
                    }

                    // Crea nuovo tutorial
                    currentTutorial = {
                        name: sectionName,
                        title: sectionName,
                        steps: [],
                        properties: {}  // NUOVO: proprietà globali del tutorial
                    };

                    // Se è il primo tutorial e abbiamo proprietà globali, applicale
                    if (tutorials.length === 0 && Object.keys(globalProperties).length > 0) {
                        console.log(`📝 PARSER: Applicazione ${Object.keys(globalProperties).length} proprietà globali al primo tutorial "${sectionName}"`);
                        Object.assign(currentTutorial.properties, globalProperties);
                        globalProperties = {}; // Svuota dopo aver applicato
                    }

                    currentStep = null;
                }
            }
            // Parsa proprietà (chiave=valore)
            else if (line && line.includes('=')) {
                // Dividi solo sul PRIMO '=' per preservare '=' nei valori
                const eqIndex = line.indexOf('=');
                const key = line.substring(0, eqIndex).trim();
                const value = line.substring(eqIndex + 1).trim();

                // ═══════════════════════════════════════════════════════════════
                // SCREEN SYSTEM: Se siamo in una sezione screen, salva proprietà lì
                // ═══════════════════════════════════════════════════════════════
                if (currentScreenSection) {
                    // Gestione speciale per InteractiveChild multipli
                    if (key === 'InteractiveChild') {
                        if (!currentScreenSection.properties[key]) {
                            currentScreenSection.properties[key] = [];
                        } else if (!Array.isArray(currentScreenSection.properties[key])) {
                            currentScreenSection.properties[key] = [currentScreenSection.properties[key]];
                        }
                        currentScreenSection.properties[key].push(value);
                        console.log(`🎮 [PARSER] InteractiveChild aggiunto: ${value} (totale: ${currentScreenSection.properties[key].length})`);
                    } else {
                        currentScreenSection.properties[key] = value;
                    }
                    continue; // Salta il resto del parsing proprietà
                }

                if (!currentTutorial) {
                    // Proprietà globali prima del primo tutorial - raccogliamo in globalProperties
                    globalProperties[key] = value;
                    console.log(`📝 PARSER: Proprietà globale pre-tutorial: ${key} = ${value}`);
                } else if (currentTutorial && !currentStep) {
                    // Se siamo in un tutorial ma non in uno step, sono proprietà globali del tutorial

                    // Gestione speciale per Posizione e Rotazione multiple
                    if (key === 'Posizione' || key === 'Rotazione') {
                        // Se la proprietà non esiste, crea un array
                        if (!currentTutorial.properties[key]) {
                            currentTutorial.properties[key] = [];
                        }
                        // Se esiste ma non è un array, convertila in array
                        else if (!Array.isArray(currentTutorial.properties[key])) {
                            currentTutorial.properties[key] = [currentTutorial.properties[key]];
                        }
                        // Aggiungi la nuova direttiva all'array
                        currentTutorial.properties[key].push(value);
                        console.log(`📝 PARSER: ${key} multipla aggiunta: ${value} (totale: ${currentTutorial.properties[key].length})`);
                    } else {
                        // Per tutte le altre proprietà, comportamento normale
                        currentTutorial.properties[key] = value;
                    }

                    // Parsing specifico per proprietà camera globali
                    if (key === 'CameraPos') {
                        // NUOVO: Supporta sia coordinate assolute che relative a elementi
                        if (value.includes(':')) {
                            // Formato elemento:offset -> lasciamo parsing a Scene3D
                            // Es: "coperchio.glb:(0, 2, 5)"
                            currentTutorial.properties[key + '_relative'] = value.trim();
                        } else {
                            // Formato coordinate assolute (x, y, z)
                            const coords = value.replace(/[()]/g, '').split(',').map(n => parseFloat(n.trim()));
                            if (coords.length === 3) {
                                currentTutorial.properties[key + '_parsed'] = { x: coords[0], y: coords[1], z: coords[2] };
                            }
                        }
                    } else if (key === 'CameraTarget') {
                        // NUOVO: Supporta sia coordinate che nomi elementi
                        if (value.includes('(') && value.includes(')')) {
                            // Formato coordinate (x, y, z)
                            const coords = value.replace(/[()]/g, '').split(',').map(n => parseFloat(n.trim()));
                            if (coords.length === 3) {
                                currentTutorial.properties[key + '_parsed'] = { x: coords[0], y: coords[1], z: coords[2] };
                            }
                        } else {
                            // Formato nome elemento
                            currentTutorial.properties[key + '_element'] = value.trim();
                        }
                    } else if (key === 'CameraZoom' || key === 'CameraTransitionTime') {
                        currentTutorial.properties[key + '_parsed'] = parseFloat(value);
                    }
                }
                // Se siamo in uno step, sono proprietà dello step
                else if (currentStep) {
                    currentStep.properties[key] = value;

                    // Parsing specifico per proprietà speciali
                    if (key === 'CameraPos') {
                        // NUOVO: Supporta sia coordinate assolute che relative a elementi
                        if (value.includes(':')) {
                            // Formato elemento:offset -> lasciamo parsing a Scene3D
                            currentStep.properties[key + '_relative'] = value.trim();
                        } else {
                            // Formato coordinate assolute (x, y, z)
                            const coords = value.replace(/[()]/g, '').split(',').map(n => parseFloat(n.trim()));
                            if (coords.length === 3) {
                                currentStep.properties[key + '_parsed'] = { x: coords[0], y: coords[1], z: coords[2] };
                            }
                        }
                    } else if (key === 'CameraTarget') {
                        // NUOVO: Supporta sia coordinate che nomi elementi
                        if (value.includes('(') && value.includes(')')) {
                            // Formato coordinate (x, y, z)
                            const coords = value.replace(/[()]/g, '').split(',').map(n => parseFloat(n.trim()));
                            if (coords.length === 3) {
                                currentStep.properties[key + '_parsed'] = { x: coords[0], y: coords[1], z: coords[2] };
                            }
                        } else {
                            // Formato nome elemento
                            currentStep.properties[key + '_element'] = value.trim();
                        }
                    } else if (key === 'CameraZoom' || key === 'CameraTransitionTime') {
                        currentStep.properties[key + '_parsed'] = parseFloat(value);
                    }
                }
            }
            // Parsa proprietà tutorial (per tutorial senza steps espliciti)
            else if (line && line.includes('=') && currentTutorial && !currentStep) {
                // Crea uno step implicito per tutorial semplici
                if (!currentStep) {
                    currentStep = {
                        name: currentTutorial.name,
                        title: currentTutorial.name,
                        properties: {}
                    };
                }

                const [key, value] = line.split('=').map(s => s.trim());
                currentStep.properties[key] = value;
            }
        }

        // Salva l'ultimo step se esiste
        if (currentStep && Object.keys(currentStep.properties).length > 0) {
            if (currentTutorial) {
                currentTutorial.steps.push(currentStep);
            }
        }

        // Salva l'ultimo tutorial se esiste
        if (currentTutorial && currentTutorial.steps.length > 0) {
            tutorials.push(currentTutorial);
        }

        // ═══════════════════════════════════════════════════════════════
        // SCREEN SYSTEM: Salva ultima sezione e registra in ScreenSystem
        // ═══════════════════════════════════════════════════════════════
        if (currentScreenSection) {
            this.saveScreenSection(currentScreenSection, screenDefinitions);
        }

        // Registra tutte le definizioni in ScreenSystem
        this.registerScreenDefinitions(screenDefinitions);

        AppConfig.log(3, 'Tutorials parsed:', tutorials);

        // Memorizza i tutorial disponibili
        this.availableTutorials = tutorials;

        // Se c'è almeno un tutorial, seleziona il primo come default
        if (tutorials.length > 0) {
            // NUOVO: Resetta il tracker del tutorial per nuovo scenario
            if (window.Scene3D && window.Scene3D.resetTutorialTracker) {
                window.Scene3D.resetTutorialTracker();
            }

            this.selectTutorial(0);
            // L'evidenziazione del primo elemento ora avviene dopo il caricamento dei modelli
            // in onModelLoadComplete() per garantire che i modelli siano disponibili
        }

        return tutorials;
    };

    // ═══════════════════════════════════════════════════════════════════════
    // SCREEN SYSTEM: Metodi helper per parsing definizioni
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Salva una sezione screen nel registro temporaneo
     */
    UI.saveScreenSection = function(section, definitions) {
        if (!section || !section.type || !section.id) return;

        switch (section.type) {
            case 'screen':
                definitions.screens.set(section.id, section.properties);
                break;
            case 'screenview':
                definitions.views.set(section.id, section.properties);
                break;
            case 'hotspot':
                definitions.hotspots.set(section.id, section.properties);
                break;
            case 'action':
                definitions.actions.set(section.id, section.properties);
                break;
            case 'interactiveObject':
                definitions.interactiveObjects.set(section.id, section.properties);
                break;
            case 'stateGroup':
                definitions.stateGroups.set(section.id, section.properties);
                break;
            case 'screenSnap':
                definitions.screenSnaps.set(section.id, section.properties);
                break;
        }
    };

    /**
     * Registra tutte le definizioni screen in ScreenSystem
     */
    UI.registerScreenDefinitions = function(definitions) {
        if (!window.ScreenSystem) {
            if (definitions.screens.size > 0 || definitions.views.size > 0 ||
                definitions.hotspots.size > 0 || definitions.actions.size > 0) {
                console.warn('[UI] ⚠️ ScreenSystem non disponibile, definizioni schermi ignorate');
            }
            return;
        }

        // Pulisci definizioni precedenti
        window.ScreenSystem.clearDefinitions();

        // Registra schermi
        definitions.screens.forEach((props, id) => {
            window.ScreenSystem.registerScreen(id, props);
        });

        // Registra viste (con supporto per Model e Hotspots)
        definitions.views.forEach((props, viewKey) => {
            // viewKey è nel formato "screenId.viewId"
            const [screenId, viewId] = viewKey.split('.');

            // Passa l'oggetto config completo con Model e Hotspots
            const viewConfig = {
                Model: props.Model || null,
                Hotspots: props.Hotspots || ''
            };

            window.ScreenSystem.registerView(screenId, viewId, viewConfig);
            console.log(`📄 [UI] Vista "${viewKey}": Model=${viewConfig.Model || '(nessuno)'}, Hotspots=${viewConfig.Hotspots || '(nessuno)'}`);
        });

        // Registra hotspot
        definitions.hotspots.forEach((props, id) => {
            window.ScreenSystem.registerHotspot(id, props);
        });

        // Registra azioni
        definitions.actions.forEach((props, id) => {
            window.ScreenSystem.registerAction(id, props);
        });

        const totalDefs = definitions.screens.size + definitions.views.size +
                          definitions.hotspots.size + definitions.actions.size;
        if (totalDefs > 0) {
            console.log(`📺 [UI] ScreenSystem: Registrate ${definitions.screens.size} schermi, ` +
                        `${definitions.views.size} viste, ${definitions.hotspots.size} hotspot, ` +
                        `${definitions.actions.size} azioni`);
        }

        // ═══════════════════════════════════════════════════════════════
        // INTERACTIVE OBJECT 3D: Registra oggetti interattivi
        // ═══════════════════════════════════════════════════════════════
        if (window.InteractiveObject3D && definitions.interactiveObjects.size > 0) {
            definitions.interactiveObjects.forEach((props, id) => {
                console.log(`🎮 [UI] Registrazione InteractiveObject: "${id}"`);
                window.InteractiveObject3D.registerFromTutorial(id, props);
            });
            console.log(`🎮 [UI] InteractiveObject3D: Registrati ${definitions.interactiveObjects.size} oggetti interattivi`);
        }

        // ═══════════════════════════════════════════════════════════════
        // STATE GROUPS: Registra gruppi varianti mutuamente esclusive
        // ═══════════════════════════════════════════════════════════════
        if (window.InteractiveObject3D && definitions.stateGroups.size > 0) {
            definitions.stateGroups.forEach((props, id) => {
                console.log(`🔀 [UI] Registrazione StateGroup: "${id}"`);
                window.InteractiveObject3D.registerStateGroupFromTutorial(id, props);
            });
            console.log(`🔀 [UI] StateGroups: Registrati ${definitions.stateGroups.size} gruppi di varianti`);
        }

        // ═══════════════════════════════════════════════════════════════
        // SCREEN SNAPS: Registra snap point per agganciare quad-schermate ai monitor
        // ═══════════════════════════════════════════════════════════════
        if (window.ScreenSnapRegistry && definitions.screenSnaps.size > 0) {
            window.ScreenSnapRegistry.clear();
            definitions.screenSnaps.forEach((props, id) => {
                window.ScreenSnapRegistry.register(id, props);
            });
            console.log(`📺 [UI] ScreenSnaps: Registrati ${definitions.screenSnaps.size} snap point monitor`);
        }
    };

    console.log('[UITutorialParser] Modulo caricato');
})();
