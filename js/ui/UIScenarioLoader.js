/**
 * UIScenarioLoader.js - Caricamento scenari, config, modelli
 * Mixin: aggiunge metodi a window.UI
 */
(function() {
    const UI = window.UI;

    /* ===== GESTIONE SCENARI ===== */
    
    /**
     * Gestisce la selezione del file di configurazione home
     */
    UI.onHomeConfigSelected = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        if (window.AppConfig) {
            AppConfig.log(2, `Caricamento configurazione home: ${file.name}`);
        } else {
            console.log(`Caricamento configurazione home: ${file.name}`);
        }
        
        this.updateStatus('Caricamento configurazione...');
        
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                this.parseHomeConfig(e.target.result);
                this.updateStatus('Configurazione caricata');
            } catch (error) {
                if (window.AppConfig) {
                    AppConfig.log(0, 'Errore parsing configurazione:', error);
                } else {
                    console.error('Errore parsing configurazione:', error);
                }
                this.showError('Errore nel file di configurazione: ' + error.message);
                this.updateStatus('Errore configurazione');
            }
        };
        
        reader.onerror = () => {
            this.showError('Errore lettura file di configurazione');
            this.updateStatus('Errore lettura file');
        };
        
        reader.readAsText(file);
    };
    /**
     * Carica automaticamente il file home_config.txt dal server
     */
    UI.loadHomeConfigFromServer = function() {
        this.safeLog(2, 'Tentativo caricamento home_config dal server...');
        this.updateStatus('Caricamento configurazione...');

        const lang = window.currentUser && window.currentUser.language
            ? window.currentUser.language.toLowerCase()
            : null;

        console.log(`🌍 [loadHomeConfig] currentUser:`, JSON.stringify(window.currentUser));
        console.log(`🌍 [loadHomeConfig] lang rilevata: "${lang}"`);

        const candidates = [
            lang ? `./scenes/homeconfig_${lang}.ini` : null,
            `./scenes/homeconfig.ini`,
            lang ? `./home_config_${lang}.cvtscript` : null,
            `./home_config.cvtscript`,
        ].filter(Boolean);

        console.log(`🌍 [loadHomeConfig] Candidati:`, candidates);

        const loadConfig = (path) => {
            return fetchFile(`${path}?v=${Date.now()}`)
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.text();
                })
                .then(content => {
                    this.safeLog(2, `home_config caricato: ${path}`);
                    this.parseHomeConfig(content);
                    this.updateStatus('Configurazione caricata automaticamente');
                });
        };

        const tryLoad = candidates.reduce(
            (chain, path, i) => chain.catch(() => {
                if (i > 0) console.warn(`🌍 [loadHomeConfig] tentativo precedente fallito, provo: ${path}`);
                return loadConfig(path);
            }),
            Promise.reject()
        );

        tryLoad.catch(error => {
            this.safeLog(1, 'Impossibile caricare home_config dal server:', error && error.message);
            this.updateStatus('Nessuna configurazione - usa caricamento manuale');
        });
    };
    /**
     * Carica e applica InterfaceConfig.cvtscript (opzionale).
     * In Electron usa IPC per leggere il file dalla directory dell'exe (fuori ASAR),
     * così l'utente può modificarlo e rilancire il programma per applicare le modifiche.
     * In browser usa fetch standard.
     */
    UI.loadInterfaceConfig = function() {
        // In Electron (preload caricato): usa IPC per leggere fuori dall'ASAR
        if (window.electronAPI && window.electronAPI.readConfigFile) {
            const tryIPC = (name) => window.electronAPI.readConfigFile(name);
            tryIPC('scenes/interfaceconfig.ini')
                .then(content => content || tryIPC('InterfaceConfig.cvtscript'))
                .then(content => {
                    if (content) {
                        this.safeLog(2, 'interfaceconfig caricato via IPC (Electron)');
                        this.parseInterfaceConfig(content);
                    } else {
                        this._loadInterfaceConfigViaFetch();
                    }
                })
                .catch(() => this._loadInterfaceConfigViaFetch());
            return;
        }
        // Browser / web server: usa fetch standard
        this._loadInterfaceConfigViaFetch();
    };
    UI._loadInterfaceConfigViaFetch = function() {
        const candidates = [
            './scenes/interfaceconfig.ini',
            './InterfaceConfig.cvtscript',
        ];
        const tryLoad = (path) => fetchFile(`${path}?v=${Date.now()}`)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.text();
            })
            .then(content => {
                this.safeLog(2, `interfaceconfig caricato: ${path}`);
                this.parseInterfaceConfig(content);
            });
        candidates.reduce(
            (chain, path) => chain.catch(() => tryLoad(path)),
            Promise.reject()
        ).catch(() => {
            // File opzionale - silenzioso se assente
        });
    };
    /**
     * Parsa InterfaceConfig.txt e applica le impostazioni UI
     */
    UI.parseInterfaceConfig = function(content) {
        const validPositions = ['top-right', 'top-left', 'top-center', 'bottom-right', 'bottom-left', 'bottom-center'];
        const lines = content.split('\n');
        let currentSection = null;

        for (let line of lines) {
            line = line.trim();
            if (!line || line.startsWith('#')) continue;

            if (line.startsWith('[') && line.endsWith(']')) {
                currentSection = line.slice(1, -1);
                continue;
            }

            if (currentSection === 'ResetCameraButton' && line.includes('=')) {
                const [key, value] = line.split('=', 2).map(s => s.trim());
                if (key === 'Position' && validPositions.includes(value)) {
                    this.resetCameraPosition = value;
                    this.safeLog(2, `InterfaceConfig: ResetCameraButton.Position = ${value}`);
                }
            }

            if (currentSection === 'SpeechBubble' && line.includes('=')) {
                const [key, value] = line.split('=', 2).map(s => s.trim());
                if (key === 'DramaticAnimationDuration') {
                    const v = parseInt(value, 10);
                    if (!isNaN(v) && v > 0) this.dramaticAnimationDuration = v;
                    this.safeLog(2, `InterfaceConfig: SpeechBubble.DramaticAnimationDuration = ${value}`);
                }
            }

            if (currentSection === 'CameraControls' && line.includes('=')) {
                const [key, value] = line.split('=', 2).map(s => s.trim());
                window.InterfaceConfig = window.InterfaceConfig || {};
                window.InterfaceConfig.camera = window.InterfaceConfig.camera || {};
                if (key === 'InvertVertical') {
                    window.InterfaceConfig.camera.invertVertical = (value === 'true');
                    this.safeLog(2, `InterfaceConfig: CameraControls.InvertVertical = ${value}`);
                } else if (key === 'InvertHorizontal') {
                    window.InterfaceConfig.camera.invertHorizontal = (value === 'true');
                    this.safeLog(2, `InterfaceConfig: CameraControls.InvertHorizontal = ${value}`);
                } else if (key === 'PinchSensitivity') {
                    const v = parseFloat(value);
                    if (!isNaN(v) && v > 0) window.InterfaceConfig.camera.pinchSensitivity = v;
                    this.safeLog(2, `InterfaceConfig: CameraControls.PinchSensitivity = ${value}`);
                } else if (key === 'InvertPinchZoom') {
                    window.InterfaceConfig.camera.invertPinchZoom = (value === 'true');
                    this.safeLog(2, `InterfaceConfig: CameraControls.InvertPinchZoom = ${value}`);
                } else if (key === 'ScrollSensitivity') {
                    const v = parseFloat(value);
                    if (!isNaN(v) && v > 0) window.InterfaceConfig.camera.scrollSensitivity = v;
                    this.safeLog(2, `InterfaceConfig: CameraControls.ScrollSensitivity = ${value}`);
                } else if (key === 'InvertScrollZoom') {
                    window.InterfaceConfig.camera.invertScrollZoom = (value === 'true');
                    this.safeLog(2, `InterfaceConfig: CameraControls.InvertScrollZoom = ${value}`);
                } else if (key === 'ZoomMin') {
                    const v = parseFloat(value);
                    if (!isNaN(v) && v > 0) window.InterfaceConfig.camera.zoomMin = v;
                    this.safeLog(2, `InterfaceConfig: CameraControls.ZoomMin = ${value}`);
                } else if (key === 'ZoomMax') {
                    const v = parseFloat(value);
                    if (!isNaN(v) && v > 0) window.InterfaceConfig.camera.zoomMax = v;
                    this.safeLog(2, `InterfaceConfig: CameraControls.ZoomMax = ${value}`);
                }
            }

            if (currentSection === 'Highlight' && line.includes('=')) {
                const [key, value] = line.split('=', 2).map(s => s.trim());
                window.InterfaceConfig = window.InterfaceConfig || {};
                window.InterfaceConfig.highlight = window.InterfaceConfig.highlight || {};
                const IO = window.InteractiveObject3D;
                const HCM = window.Scene3D && window.Scene3D.highlightCircleManager;
                if (key === 'Color') {
                    const hex = value.startsWith('0x') || value.startsWith('0X')
                        ? parseInt(value, 16) : parseInt(value, 10);
                    if (!isNaN(hex)) {
                        window.InterfaceConfig.highlight.color = hex;
                        if (IO && IO.setHighlightColor) IO.setHighlightColor(hex);
                        else if (IO) IO.config.highlightColor = hex;
                        if (HCM && HCM.setBorderColor) HCM.setBorderColor(hex);
                        this.safeLog(2, `InterfaceConfig: Highlight.Color = ${value}`);
                    }
                } else if (key === 'IntensityScale') {
                    const v = parseFloat(value);
                    if (!isNaN(v) && v >= 0) {
                        window.InterfaceConfig.highlight.intensityScale = v;
                        if (IO && IO.setHighlightIntensity) IO.setHighlightIntensity(v);
                        else if (IO) IO.config.highlightIntensityScale = v;
                        this.safeLog(2, `InterfaceConfig: Highlight.IntensityScale = ${value}`);
                    }
                } else if (key === 'DefaultOpacity') {
                    const v = parseFloat(value);
                    if (!isNaN(v) && v >= 0 && v <= 1) {
                        window.InterfaceConfig.highlight.defaultOpacity = v;
                        this.safeLog(2, `InterfaceConfig: Highlight.DefaultOpacity = ${value}`);
                    }
                } else if (key === 'FadeMaterial') {
                    const enabled = (value === 'true');
                    window.InterfaceConfig.highlight.fadeMaterial = enabled;
                    if (IO && IO.setHighlightFadeMaterial) IO.setHighlightFadeMaterial(enabled);
                    else if (IO) IO.config.highlightFadeMaterial = enabled;
                    this.safeLog(2, `InterfaceConfig: Highlight.FadeMaterial = ${value}`);
                } else if (key === 'FadeStrength') {
                    const v = parseFloat(value);
                    if (!isNaN(v) && v >= 0 && v <= 1) {
                        window.InterfaceConfig.highlight.fadeStrength = v;
                        if (IO && IO.setHighlightFadeMaterial) {
                            IO.setHighlightFadeMaterial(IO.config.highlightFadeMaterial, v);
                        } else if (IO) {
                            IO.config.highlightFadeStrength = v;
                        }
                        this.safeLog(2, `InterfaceConfig: Highlight.FadeStrength = ${value}`);
                    }
                }
            }
        }
    };
    /**
     * Analizza il file di configurazione home e genera le card scenari
     */
    UI.parseHomeConfig = function(content) {
        const lines = content.split('\n');
        const scenarios = [];
        let currentScenario = null;
        
        lines.forEach(line => {
            line = line.trim();
            if (!line || line.startsWith('#') || line.startsWith('//')) return; // Ignora commenti e righe vuote
            
            // Rimuovi commenti inline (dopo //)
            const commentIndex = line.indexOf('//');
            if (commentIndex !== -1) {
                line = line.substring(0, commentIndex).trim();
                if (!line) return; // Se dopo aver rimosso il commento la riga è vuota, ignorala
            }
            
            if (line.startsWith('[') && line.endsWith(']')) {
                // Nuovo scenario
                if (currentScenario) {
                    scenarios.push(currentScenario);
                }
                
                const scenarioName = line.slice(1, -1);
                currentScenario = {
                    name: scenarioName,
                    description: '',
                    image: '',
                    files: [],
                    positions: []
                };
                
                if (window.AppConfig) {
                    AppConfig.log(3, `📋 Scenario trovato: ${scenarioName}`);
                } else {
                    console.log(`📋 Scenario trovato: ${scenarioName}`);
                }
                
            } else if (currentScenario) {
                // Proprietà dello scenario
                if (line.startsWith('description=')) {
                    currentScenario.description = line.substring(12);
                    AppConfig.log(3, `  📝 Descrizione: ${currentScenario.description}`);
                    
                } else if (line.startsWith('image=')) {
                    currentScenario.image = line.substring(6);
                    AppConfig.log(3, `  🖼️ Immagine: ${currentScenario.image}`);
                    
                } else if (line.startsWith('tutorial=')) {
                    currentScenario.tutorial = line.substring(9);
                    AppConfig.log(3, `  📚 Tutorial: ${currentScenario.tutorial}`);
                    
                } else if (line.startsWith('CameraPos=')) {
                    currentScenario.cameraPos = line.substring(10);
                    AppConfig.log(3, `  📷 Camera Position: ${currentScenario.cameraPos}`);
                    
                } else if (line.startsWith('CameraTarget=')) {
                    currentScenario.cameraTarget = line.substring(13);
                    AppConfig.log(3, `  🎯 Camera Target: ${currentScenario.cameraTarget}`);
                    
                } else if (line.startsWith('AmbientLight=')) {
                    currentScenario.ambientLight = line.substring(13);
                    AppConfig.log(3, `  💡 Ambient Light: ${currentScenario.ambientLight}`);
                    
                } else if (line.startsWith('DirectionalLight=')) {
                    currentScenario.directionalLight = line.substring(17);
                    AppConfig.log(3, `  🔆 Directional Light: ${currentScenario.directionalLight}`);
                    
                } else if (line.startsWith('BackLight=')) {
                    currentScenario.backLight = line.substring(10);
                    AppConfig.log(3, `  🔅 Back Light: ${currentScenario.backLight}`);

                } else if (line.startsWith('tool=')) {
                    currentScenario.configuration = line.substring(5).trim();
                    AppConfig.log(3, `  ⚙️ Tool config: ${currentScenario.configuration}`);

                } else if (line.startsWith('Configuration=')) {
                    currentScenario.configuration = line.substring(14).trim();
                    AppConfig.log(3, `  ⚙️ Configuration (legacy): ${currentScenario.configuration}`);

                } else if (line.startsWith('position=')) {
                    // Posizione modello (formato: position=x,y,z)
                    const positionStr = line.substring(9);
                    const coords = positionStr.split(',').map(n => parseFloat(n.trim()));
                    if (coords.length === 3) {
                        currentScenario.positions.push({ x: coords[0], y: coords[1], z: coords[2] });
                        AppConfig.log(3, `  📍 Posizione: (${coords[0]}, ${coords[1]}, ${coords[2]})`);
                    } else {
                        AppConfig.log(1, `  ❌ Posizione non valida: ${positionStr}`);
                    }
                    
                } else if (line.includes('=')) {
                    // File da caricare (formato: label=path) o direzione (formato: direzione = x,y,z)
                    const [label, path] = line.split('=', 2).map(s => s.trim());
                    
                    if (label === 'direzione' || label === 'direction') {
                        // Parsing direzione per l'ultimo file aggiunto
                        const coords = path.split(',').map(n => parseFloat(n.trim()));
                        if (coords.length === 3 && currentScenario.files.length > 0) {
                            const lastFileIndex = currentScenario.files.length - 1;
                            const direction = { x: coords[0], y: coords[1], z: coords[2] };
                            currentScenario.files[lastFileIndex].direction = direction;
                            AppConfig.log(3, `  🧭 Direzione: (${coords[0]}, ${coords[1]}, ${coords[2]}) per ${currentScenario.files[lastFileIndex].path}`);
                        } else {
                            AppConfig.log(1, `  ❌ Direzione non valida o nessun file precedente: ${path}`);
                        }
                    } else {
                        // File da caricare
                        currentScenario.files.push({ label, path, direction: null });
                        AppConfig.log(3, `  📁 File: ${label} -> ${path}`);
                    }
                }
            }
        });
        
        // Aggiungi ultimo scenario
        if (currentScenario) {
            // DEBUG: Stampa tutte le direzioni per questo scenario
            console.log(`🧭 RIEPILOGO DIREZIONI per scenario "${currentScenario.name}":`);
            currentScenario.files.forEach((file, index) => {
                console.log(`  ${index}: ${file.path} -> direzione:`, file.direction);
            });
            
            scenarios.push(currentScenario);
        }
        
        this.scenariosConfig = scenarios;
        this.renderScenarioCards();
        
        AppConfig.log(2, `Configurazione home caricata: ${scenarios.length} scenari`);
    };
    /**
     * Renderizza le card degli scenari nella home page
     */
    UI.renderScenarioCards = function() {
        if (!this.elements.scenariosList || !this.scenariosConfig) return;
        
        // Pulisci lista esistente
        this.elements.scenariosList.innerHTML = '';
        
        // Crea card per ogni scenario
        this.scenariosConfig.forEach((scenario, index) => {
            const card = this.createScenarioCard(scenario, index);
            this.elements.scenariosList.appendChild(card);
        });

        // RIMOSSO: Card "Modalità Manuale" non più necessaria
        // const manualCard = this.createManualModeCard();
        // this.elements.scenariosList.appendChild(manualCard);

        AppConfig.log(3, `Renderizzate ${this.scenariosConfig.length} card scenario`);
    };
    /**
     * Crea una singola card scenario
     */
    UI.createScenarioCard = function(scenario, index) {
        const card = document.createElement('div');
        card.className = 'scenario-card';
        card.dataset.scenarioIndex = index;
        
        // Sezione immagine
        const imageSection = document.createElement('div');
        imageSection.className = 'scenario-image';
        
        if (scenario.image) {
            const img = document.createElement('img');
            img.src = scenario.image;
            img.alt = scenario.name;
            img.onerror = () => {
                // Fallback se l'immagine non carica
                imageSection.innerHTML = '<div class="placeholder-image">🎯</div>';
            };
            imageSection.appendChild(img);
        } else {
            imageSection.innerHTML = '<div class="placeholder-image">🎯</div>';
        }
        
        // Sezione info
        const infoSection = document.createElement('div');
        infoSection.className = 'scenario-info';
        
        const title = document.createElement('h3');
        title.textContent = scenario.name;
        
        const description = document.createElement('p');
        description.textContent = scenario.description || 'Nessuna descrizione disponibile';
        
        infoSection.appendChild(title);
        infoSection.appendChild(description);
        
        // Assembla card
        card.appendChild(imageSection);
        card.appendChild(infoSection);
        
        return card;
    };
    /**
     * DEPRECATO: Crea la card "Modalità Manuale" (non più utilizzata)
     */
    
    /**
     * Gestisce il click su una card scenario
     */
    UI.onScenarioCardClick = function(event) {
        const card = event.target.closest('.scenario-card');
        if (!card) return;
        
        // Se è la card placeholder, non fare nulla (è solo informativa)
        if (card.classList.contains('placeholder')) {
            return;
        }
        
        // RIMOSSO: Gestione card "Modalità Manuale" non più necessaria
        // if (card.dataset.manual === 'true') {
        //     AppConfig.log(2, 'Modalità manuale selezionata');
        //     this.showPage('scenario');
        //     return;
        // }


        // Controlla se esiste scenarioIndex nel dataset
        const scenarioIndexStr = card.dataset.scenarioIndex;
        if (!scenarioIndexStr) {
            AppConfig.log(1, 'Card scenario senza indice trovata');
            return;
        }
        
        const scenarioIndex = parseInt(scenarioIndexStr);
        if (isNaN(scenarioIndex) || !this.scenariosConfig) {
            this.showError('Dati scenario non validi');
            return;
        }
        
        const scenario = this.scenariosConfig[scenarioIndex];
        if (!scenario) {
            this.showError('Scenario non trovato');
            return;
        }
        
        AppConfig.log(2, `Scenario selezionato: ${scenario.name}`);
        this.loadScenario(scenario);
    };
    /**
     * Carica uno scenario specifico
     */
    UI.loadScenario = function(scenario) {
        this.currentScenario = scenario;

        // Reset HoldableSystem per nuovo scenario
        if (window.HoldableSystem && window.HoldableSystem.reset) {
            window.HoldableSystem.reset();
            AppConfig.log(3, '[loadScenario] HoldableSystem resettato per nuovo scenario');
        }

        // Aggiorna titolo scenario
        if (this.elements.scenarioTitle) {
            this.elements.scenarioTitle.textContent = scenario.name;
        }
        
        // Passa alla pagina scenario
        this.showPage('scenario');
        
        // Aggiorna stato
        this.updateStatus(`Caricamento scenario: ${scenario.name}`);
        
        // Applica le configurazioni camera e luci dello scenario
        this.applyScenarioConfiguration(scenario);

        // Carica configurazione tool per scenario se specificata
        if (scenario.configuration && window.ToolRegistry) {
            // Determina il path corretto del config
            // Se inizia con '/' o 'scenes/' è già un path completo, altrimenti è relativo allo scenario
            let configPath;
            if (scenario.configuration.startsWith('/') || scenario.configuration.startsWith('scenes/')) {
                configPath = scenario.configuration;
            } else {
                // Path relativo allo scenario (es. "config.txt" → "scenes/NomeScenario/config.txt")
                configPath = `scenes/${scenario.name}/${scenario.configuration}`;
            }

            AppConfig.log(2, `⚙️ Caricamento configurazione tool da: ${configPath}`);

            window.ToolRegistry.loadConfig(configPath, `scenes/${scenario.name}/`)
                .then(() => {
                    AppConfig.log(2, `✅ Tool configurati da: ${configPath}`);

                    // Genera CSS dinamico per tool custom
                    if (window.DynamicToolStyles) {
                        window.DynamicToolStyles.generateToolStyles();
                    }

                    // Aggiorna UI con nuovi tool
                    if (window.ToolsManager) {
                        window.ToolsManager.refreshToolsUI();
                    }
                })
                .catch(error => {
                    AppConfig.log(1, `⚠️ Errore caricamento configuration, uso default: ${error.message}`);
                    // Fallback: genera CSS per tool default
                    if (window.DynamicToolStyles) {
                        window.DynamicToolStyles.generateToolStyles();
                    }
                });
        } else {
            // Nessuna configurazione custom: RESET a tool default
            AppConfig.log(2, `🔧 Uso tool di default (nessuna Configuration= specificata)`);

            // Resetta ToolRegistry ai default
            if (window.ToolRegistry) {
                window.ToolRegistry.reset();
            }

            if (window.DynamicToolStyles) {
                window.DynamicToolStyles.generateToolStyles();
            }

            if (window.ToolsManager && window.ToolsManager.refreshToolsUI) {
                window.ToolsManager.refreshToolsUI();
            }
        }

        // Carica automaticamente tutti i modelli OBJ/MTL dello scenario
        this.loadScenarioModels(scenario);
        
        // Carica objects.ini PRIMA del tutorial: registra StateGroup/InteractiveObject
        // (fallback opzionale se objects.ini non esiste).
        const objectsLoaded = this.loadObjectsForScenario(scenario);

        // Carica il tutorial se specificato nel file di configurazione
        if (scenario.tutorial) {
            AppConfig.log(2, `🎓 Caricamento tutorial per scenario: ${scenario.tutorial}`);
            objectsLoaded.then(() => this.loadTutorial(scenario.tutorial));
        } else {
            AppConfig.log(2, `❌ Nessun tutorial specificato per scenario: ${scenario.name}`);
            // Nasconde la barra tutorial se non c'è tutorial
            this.hideTutorialStepsBar();
        }
    };

    /**
     * Carica objects.ini della scena (definizioni statiche di [state ...] e [object ...]).
     * Riusa la pipeline tutorial (CVTScriptV3 preprocess + parseTutorialContent) per
     * registrare StateGroup e InteractiveObject. Fallback silenzioso se assente:
     * il tutorial.cvtscript può ancora contenere le definizioni come legacy.
     */
    UI.loadObjectsForScenario = function(scenario) {
        // Deriva la cartella scena dal path tutorial (es. scenes/Pompa_Becker/tutorial.cvtscript → scenes/Pompa_Becker)
        let sceneFolder = null;
        if (scenario && scenario.tutorial) {
            const lastSlash = scenario.tutorial.lastIndexOf('/');
            if (lastSlash !== -1) sceneFolder = scenario.tutorial.substring(0, lastSlash);
        }
        if (!sceneFolder) {
            AppConfig.log(3, '[loadObjects] Cartella scena non determinabile, skip');
            return Promise.resolve();
        }

        const objectsPath = `${sceneFolder}/objects.ini`;
        AppConfig.log(2, `📦 Tentativo caricamento objects.ini: ${objectsPath}`);

        return fetchFile(`${objectsPath}?v=${Date.now()}`)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.text();
            })
            .then(content => {
                let processed = content;
                if (window.CVTScriptV3 && typeof window.CVTScriptV3.preprocess === 'function') {
                    processed = window.CVTScriptV3.preprocess(content);
                }
                // Riusa il parser tutorial: registra screen/state/object via registerScreenDefinitions.
                // L'array tutorials risultante è vuoto (objects.ini non ha [Tutorial] o [section]),
                // perciò non sovrascrive availableTutorials.
                this.parseTutorialContent(processed);
                AppConfig.log(2, `✅ objects.ini caricato: ${objectsPath}`);
            })
            .catch(err => {
                AppConfig.log(3, `[loadObjects] ${objectsPath} non disponibile (${err.message}) - fallback su tutorial.cvtscript`);
            });
    };
    /**
     * Applica le configurazioni di camera e luci specifiche dello scenario
     */
    UI.applyScenarioConfiguration = function(scenario) {
        if (!window.Scene3D) {
            AppConfig.log(1, '⚠️ Scene3D non disponibile per configurazione scenario');
            // Ritenta dopo un delay
            setTimeout(() => {
                this.applyScenarioConfiguration(scenario);
            }, 500);
            return;
        }
        
        AppConfig.log(2, `🎭 Applicazione configurazione per scenario: ${scenario.name}`);
        
        // Applica posizione camera se specificata
        if (scenario.cameraPos) {
            const pos = this.parseVector3(scenario.cameraPos);
            if (pos) {
                window.Scene3D.camera.position.set(pos.x, pos.y, pos.z);
                // IMPORTANTE: Imposta flag per disabilitare auto-fitting
                window.Scene3D.manualCameraSet = true;
                AppConfig.log(2, `📷 Camera position applicata: (${pos.x}, ${pos.y}, ${pos.z}) - Auto-fitting disabilitato`);
            }
        }
        
        // Applica target camera se specificato
        if (scenario.cameraTarget) {
            const target = this.parseVector3(scenario.cameraTarget);
            if (target) {
                window.Scene3D.camera.lookAt(target.x, target.y, target.z);
                // IMPORTANTE: aggiorna anche il pivotPoint usato da zoom e orbita
                // Senza questo, zoom e rotazione continuano ad usare il pivot del vecchio scenario
                if (window.Scene3D.mouseControls) {
                    window.Scene3D.mouseControls.pivotPoint = new THREE.Vector3(target.x, target.y, target.z);
                }
                AppConfig.log(2, `🎯 Camera target applicato: (${target.x}, ${target.y}, ${target.z}) - Pivot aggiornato`);
            }
        }
        
        // Applica configurazioni luci dopo un breve delay per assicurarsi che THREE sia disponibile
        setTimeout(() => {
            this.applyScenarioLights(scenario);
        }, 100);
        
        AppConfig.log(2, `✅ Configurazione scenario applicata per: ${scenario.name}`);
    };
    /**
     * Applica le configurazioni delle luci dello scenario
     */
    UI.applyScenarioLights = function(scenario) {
        if (!window.Scene3D || !window.Scene3D.scene) {
            AppConfig.log(1, '⚠️ Scene3D non disponibile per applicazione luci');
            return;
        }
        
        if (!window.THREE) {
            AppConfig.log(1, '⚠️ THREE.js non disponibile per applicazione luci');
            return;
        }
        
        AppConfig.log(2, '🔄 Rimozione luci esistenti...');
        
        // Rimuovi le luci esistenti
        const lightsToRemove = [];
        window.Scene3D.scene.traverse(function(child) {
            if (child.isLight) {
                lightsToRemove.push(child);
            }
        });
        lightsToRemove.forEach(light => window.Scene3D.scene.remove(light));
        AppConfig.log(2, `🗑️ Rimosse ${lightsToRemove.length} luci esistenti`);
        
        // Aggiungi luce ambientale se specificata
        if (scenario.ambientLight) {
            const ambient = this.parseLightConfig(scenario.ambientLight);
            if (ambient) {
                try {
                    const ambientLight = new THREE.AmbientLight(ambient.color, ambient.intensity);
                    window.Scene3D.scene.add(ambientLight);
                    AppConfig.log(2, `💡 Luce ambientale applicata: colore=${ambient.color.toString(16)}, intensità=${ambient.intensity}`);
                } catch (error) {
                    AppConfig.log(1, '❌ Errore creazione luce ambientale:', error);
                }
            }
        }
        
        // Aggiungi luce direzionale se specificata
        if (scenario.directionalLight) {
            const directional = this.parseDirectionalLightConfig(scenario.directionalLight);
            if (directional) {
                try {
                    const directionalLight = new THREE.DirectionalLight(directional.color, directional.intensity);
                    directionalLight.position.set(directional.position.x, directional.position.y, directional.position.z);
                    directionalLight.castShadow = true;
                    directionalLight.shadow.mapSize.width = 2048;
                    directionalLight.shadow.mapSize.height = 2048;
                    directionalLight.shadow.camera.near = 0.5;
                    directionalLight.shadow.camera.far = 500;
                    window.Scene3D.scene.add(directionalLight);
                    AppConfig.log(2, `🔆 Luce direzionale applicata: pos=(${directional.position.x}, ${directional.position.y}, ${directional.position.z}), intensità=${directional.intensity}`);
                } catch (error) {
                    AppConfig.log(1, '❌ Errore creazione luce direzionale:', error);
                }
            }
        }
        
        // Aggiungi luce posteriore se specificata
        if (scenario.backLight) {
            const back = this.parseDirectionalLightConfig(scenario.backLight);
            if (back) {
                try {
                    const backLight = new THREE.DirectionalLight(back.color, back.intensity);
                    backLight.position.set(back.position.x, back.position.y, back.position.z);
                    backLight.castShadow = false;
                    window.Scene3D.scene.add(backLight);
                    AppConfig.log(2, `🔅 Luce posteriore applicata: pos=(${back.position.x}, ${back.position.y}, ${back.position.z}), intensità=${back.intensity}`);
                } catch (error) {
                    AppConfig.log(1, '❌ Errore creazione luce posteriore:', error);
                }
            }
        }
        
        // Forza il re-rendering
        if (window.Scene3D.renderer) {
            window.Scene3D.renderer.render(window.Scene3D.scene, window.Scene3D.camera);
        }
        
        AppConfig.log(2, '✅ Applicazione luci scenario completata');
    };
    /**
     * Parsing di una stringa vector3 "(x, y, z)" in oggetto
     */
    UI.parseVector3 = function(vectorString) {
        try {
            const cleanString = vectorString.replace(/[()]/g, '').trim();
            const parts = cleanString.split(',').map(n => parseFloat(n.trim()));
            if (parts.length === 3 && parts.every(n => !isNaN(n))) {
                return { x: parts[0], y: parts[1], z: parts[2] };
            }
        } catch (error) {
            AppConfig.log(1, `⚠️ Errore parsing vector3: ${vectorString}`, error);
        }
        return null;
    };
    /**
     * Parsing configurazione luce ambientale "0x606060,2.0"
     */
    UI.parseLightConfig = function(lightString) {
        try {
            const parts = lightString.split(',');
            if (parts.length === 2) {
                const color = parseInt(parts[0].trim(), 16);
                const intensity = parseFloat(parts[1].trim());
                if (!isNaN(color) && !isNaN(intensity)) {
                    return { color: color, intensity: intensity };
                }
            }
        } catch (error) {
            AppConfig.log(1, `⚠️ Errore parsing light config: ${lightString}`, error);
        }
        return null;
    };
    /**
     * Parsing configurazione luce direzionale "0xffffff,3.3,(1, 1, 1)"
     */
    UI.parseDirectionalLightConfig = function(lightString) {
        try {
            const parts = lightString.split(',');
            if (parts.length >= 5) {
                const color = parseInt(parts[0].trim(), 16);
                const intensity = parseFloat(parts[1].trim());
                const x = parseFloat(parts[2].replace(/[()]/g, '').trim());
                const y = parseFloat(parts[3].trim());
                const z = parseFloat(parts[4].replace(/[()]/g, '').trim());
                
                if (!isNaN(color) && !isNaN(intensity) && !isNaN(x) && !isNaN(y) && !isNaN(z)) {
                    return {
                        color: color,
                        intensity: intensity,
                        position: { x: x, y: y, z: z }
                    };
                }
            }
        } catch (error) {
            AppConfig.log(1, `⚠️ Errore parsing directional light config: ${lightString}`, error);
        }
        return null;
    };
    /**
     * Carica automaticamente tutti i modelli OBJ/MTL di uno scenario
     */
    UI.loadScenarioModels = function(scenario) {
        console.log('🔄 loadScenarioModels chiamata per:', scenario.name);
        console.log('🔄 Files nello scenario:', scenario.files);
        
        if (!scenario.files || scenario.files.length === 0) {
            console.log('❌ Nessun file nello scenario');
            this.updateStatus(`Scenario ${scenario.name} - Nessun modello da caricare`);
            return;
        }
        
        // Filtra solo i file modello (OBJ, MTL, GLTF, GLB, STL)
        const modelFiles = scenario.files.filter(file => {
            const extension = file.path.toLowerCase().split('.').pop();
            return ['obj', 'mtl', 'gltf', 'glb', 'stl'].includes(extension);
        });
        
        console.log('🔄 File modello filtrati:', modelFiles);
        
        if (modelFiles.length === 0) {
            console.log('❌ Nessun modello compatibile trovato');
            this.updateStatus(`Scenario ${scenario.name} - Nessun modello compatibile`);
            return;
        }
        
        AppConfig.log(2, `Caricamento ${modelFiles.length} modelli per scenario: ${scenario.name}`);
        
        // Mostra progress bar
        this.showModelProgressBar(modelFiles.length);
        this.updateStatus(`Caricamento ${modelFiles.length} modelli...`);
        
        // Converte i path in URL per il fetch
        const modelUrls = modelFiles.map(file => ({
            name: file.path.split('/').pop(), // Nome del file
            path: file.path,
            type: file.path.toLowerCase().split('.').pop()
        }));
        
        // Log dei modelli che verranno caricati per debug
        AppConfig.log(3, 'Modelli da caricare:', modelUrls.map(m => `${m.name} (${m.type})`).join(', '));
        
        // Avvia il caricamento tramite ModelLoader
        if (window.ModelLoader) {
            this.loadModelsFromUrls(modelUrls);
        } else {
            this.showError('ModelLoader non disponibile');
        }
    };
    /**
     * Carica modelli da URL utilizzando il ModelLoader
     */
    UI.loadModelsFromUrls = function(modelUrls) {
        console.log('🌐 Avvio fetch per:', modelUrls);

        let completedFiles = 0;
        const totalFiles = modelUrls.length;

        // Conta file grandi
        const largeFiles = modelUrls.filter(m => /culatta|corpo|coperchio/i.test(m.name));
        if (largeFiles.length > 0) {
            console.log(`⏳ Rilevati ${largeFiles.length} file di grandi dimensioni (${largeFiles.map(f => f.name).join(', ')}). Il caricamento potrebbe richiedere fino a 2 minuti.`);
            this.updateStatus(`Caricamento ${totalFiles} modelli (${largeFiles.length} file grandi)... potrebbe richiedere fino a 2 minuti`);
        }

        // Helper function per fetch con timeout e retry
        const fetchWithTimeoutAndRetry = (url, filename, maxRetries = 2) => {
            // Timeout dinamico basato su dimensione stimata del file
            // Aggiunti a500, remote, pulpito che sono file grandi (>10MB)
            const isLargeFile = /culatta|corpo|coperchio|pavimento|filtro|a500|remote|pulpito/i.test(filename);
            const timeout = isLargeFile ? 120000 : 60000; // 120s per file grandi, 60s per altri

            console.log(`🌐 Timeout per ${filename}: ${timeout/1000}s (isLarge: ${isLargeFile})`);

            const attemptFetch = (retriesLeft) => {
                return Promise.race([
                    fetchFile(url),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error(`Timeout dopo ${timeout/1000}s`)), timeout)
                    )
                ]).catch(error => {
                    if (retriesLeft > 0) {
                        console.warn(`⚠️ Retry ${maxRetries - retriesLeft + 1}/${maxRetries} per ${filename}:`, error.message);
                        return new Promise(resolve => setTimeout(resolve, 2000))
                            .then(() => attemptFetch(retriesLeft - 1));
                    }
                    throw error;
                });
            };

            return attemptFetch(maxRetries);
        };

        // Fetch singolo modello: scarica, crea blob, restituisce {file, model}
        const fetchSingleModel = (model) => {
            console.log(`🌐 Fetching: ${model.path}`);
            const cacheBuster = `?v=${Date.now()}`;
            const urlWithCacheBuster = model.path + cacheBuster;

            return fetchWithTimeoutAndRetry(urlWithCacheBuster, model.name)
                .then(response => {
                    console.log(`🌐 Response per ${model.path}:`, response.status, response.statusText);
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    return response.blob();
                })
                .then(blob => {
                    console.log(`🌐 Blob creato per ${model.name}:`, blob.size, 'bytes');
                    completedFiles++;
                    this.updateStatus(`Scaricamento modelli: ${completedFiles}/${totalFiles}...`);
                    const file = new File([blob], model.name, { type: blob.type });
                    return { file, model };
                })
                .catch(error => {
                    console.error(`❌ ERRORE FETCH ${model.name}:`, error);
                    AppConfig.log(0, `⚠️ FILE MANCANTE: ${model.name} - ${error.message}`);
                    completedFiles++;
                    return null;
                });
        };

        // Caricamento a batch per evitare out-of-memory
        const BATCH_SIZE = 4;
        const allResults = [];
        const loadInBatches = async () => {
            for (let i = 0; i < modelUrls.length; i += BATCH_SIZE) {
                const batch = modelUrls.slice(i, i + BATCH_SIZE);
                console.log(`🌐 Batch ${Math.floor(i/BATCH_SIZE)+1}/${Math.ceil(modelUrls.length/BATCH_SIZE)}: ${batch.map(m=>m.name).join(', ')}`);
                const batchResults = await Promise.allSettled(batch.map(fetchSingleModel));
                allResults.push(...batchResults);
            }
            return allResults;
        };

        loadInBatches()
            .then(results => {
                console.log('🌐 Risultati fetch:', results);

                const validFiles = results
                    .filter(result => result.status === 'fulfilled' && result.value !== null)
                    .map(result => result.value.file);

                const failedCount = results.filter(result =>
                    result.status === 'rejected' ||
                    (result.status === 'fulfilled' && result.value === null)
                ).length;

                const failedNames = results
                    .map((result, index) => ({result, model: modelUrls[index]}))
                    .filter(({result}) => result.status === 'rejected' || (result.status === 'fulfilled' && result.value === null))
                    .map(({model}) => model.name);

                console.log('🌐 File validi:', validFiles.length, 'File falliti:', failedCount);
                console.log('🌐 ValidFiles dettaglio:', validFiles);
                if (failedCount > 0) {
                    console.error('❌ File falliti:', failedNames);
                }

                if (validFiles.length > 0) {
                    AppConfig.log(2, `✅ ${validFiles.length}/${totalFiles} modelli caricati con successo`);
                    if (failedCount > 0) {
                        AppConfig.log(0, `⚠️ ATTENZIONE: ${failedCount} file mancanti: ${failedNames.join(', ')}`);
                        this.showError(`Caricati ${validFiles.length}/${totalFiles} modelli. Mancanti: ${failedNames.join(', ')}`);
                    }
                    
                    this.updateStatus(`Rendering ${validFiles.length} modelli...`);
                    
                    // Usa ModelLoader per caricare i file
                    console.log('🌐 Chiamando ModelLoader.loadFiles con:', validFiles);
                    console.log('🌐 ModelLoader disponibile?', !!window.ModelLoader);
                    console.log('🌐 loadFiles function?', typeof window.ModelLoader.loadFiles);
                    
                    if (window.ModelLoader && typeof window.ModelLoader.loadFiles === 'function') {
                        console.log('🌐 Avvio ModelLoader.loadFiles...');
                        window.ModelLoader.loadFiles(
                            validFiles,
                            (progress, info) => {
                                // Callback progress con info dettagliate
                                if (info && info.current && info.total) {
                                    console.log(`🌐 Progress: ${info.current}/${info.total} - ${info.fileName}`);
                                    // Usa updateModelProgress per aggiornare la progress bar
                                    this.updateModelProgress(info.current, info.total, info.fileName, Math.round(progress * 100));
                                    // Aggiorna anche lo status
                                    this.updateStatus(info.message || `Caricamento ${info.current}/${info.total}...`);
                                } else {
                                    // Fallback se info non disponibile (backward compatibility)
                                    console.log('🌐 Progress:', progress);
                                    this.updateStatus(`Caricamento modelli: ${Math.round(progress * 100)}%`);
                                }
                            },
                            (models) => {
                                console.log('🌐 Modelli caricati, chiamando onModelLoadComplete:', models);
                                this.onModelLoadComplete(models);
                                AppConfig.log(2, `Scenario ${this.currentScenario.name} caricato completamente`);
                            },
                            (error) => {
                                console.error('🌐 Errore ModelLoader:', error);
                                this.showError(`Errore caricamento modelli: ${error}`);
                            }
                        );
                    } else {
                        this.showError('ModelLoader non disponibile o non ha la funzione loadFiles');
                    }
                    
                } else {
                    this.showError('Nessun modello caricato con successo');
                }
            });
    };
    /* ===== GESTIONE FILE MODELLI ===== */
    
    /**
     * Gestisce la selezione di file modelli dall'utente
     */
    UI.onModelsSelected = function(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;
        
        AppConfig.log(2, `File modelli selezionati: ${files.length}`);
        
        this.updateStatus('Caricamento modelli...');
        this.showLoader('Caricamento modelli in corso...');
        
        // Usa ModelLoader per caricare i file
        if (window.ModelLoader) {
            window.ModelLoader.loadFiles(
                files,
                this.onModelLoadProgress.bind(this),
                this.onModelLoadComplete.bind(this),
                this.onModelLoadError.bind(this)
            );
        } else {
            this.showError('ModelLoader non disponibile');
        }
    };
    /**
     * Callback progresso caricamento modelli
     */
    UI.onModelLoadProgress = function(message, progress) {
        this.updateStatus(message);
        
        // Aggiorna anche la progress bar se visibile
        const progressBar = document.getElementById('modelProgressBar');
        if (progressBar && !progressBar.classList.contains('hidden')) {
            // Estrai informazioni dal messaggio se possibile
            const currentFile = message.includes('Caricamento ') ? message.replace('Caricamento ', '').replace('...', '') : message;
            const percentage = Math.round(progress * 100);
            this.updateModelProgress(null, null, currentFile, percentage);
        }
        
        AppConfig.log(3, `Progresso caricamento: ${message} (${Math.round(progress * 100)}%)`);
    };
    /**
     * Callback completamento caricamento modelli
     */
    UI.onModelLoadComplete = function(models) {
        this.hideLoader();
        
        if (models.length === 0) {
            this.showError('Nessun modello caricato');
            this.updateStatus('Errore caricamento');
            return;
        }
        
        AppConfig.log(2, `Modelli caricati con successo: ${models.length}`);
        
        // Aggiungi modelli alla scena con posizioni e direzioni configurate
        models.forEach((model, index) => {
            if (window.Scene3D) {
                // Applica posizione se configurata
                if (this.currentScenario && this.currentScenario.positions && this.currentScenario.positions[index]) {
                    const pos = this.currentScenario.positions[index];
                    model.position.set(pos.x, pos.y, pos.z);
                    console.log(`📍 Applicata posizione configurata al modello ${index + 1}: (${pos.x}, ${pos.y}, ${pos.z})`);
                }
                
                // Trova la configurazione del modello (inclusa la direzione)
                let modelConfig = null;
                const modelFilename = model.userData?.originalFilename || model.name;
                
                console.log(`🔍 Ricerca config per modello: "${modelFilename}"`);
                console.log(`🔍 Files scenario disponibili:`, this.currentScenario?.files?.map(f => ({ path: f.path, direction: f.direction })));
                
                if (this.currentScenario && this.currentScenario.files) {
                    modelConfig = this.currentScenario.files.find(file => {
                        const modelNameClean = modelFilename.replace('.glb', '');
                        const fileNameClean = file.path.split('/').pop().replace('.glb', '');
                        
                        // Match esatto del nome file (più preciso)
                        const exactMatch = modelNameClean === fileNameClean;
                        
                        console.log(`🔍 Test file "${file.path}": modelName="${modelNameClean}", fileName="${fileNameClean}", exactMatch=${exactMatch}, direction=`, file.direction);
                        
                        if (exactMatch) {
                            console.log(`✅ EXACT MATCH FOUND for "${modelFilename}": ${file.path} with direction:`, file.direction);
                        }
                        
                        return exactMatch;
                    });
                    
                    if (modelConfig) {
                        console.log(`🔍✅ Config trovato per "${modelFilename}":`, modelConfig);
                    } else {
                        console.log(`🔍❌ Nessun config trovato per "${modelFilename}"`);
                    }
                }
                
                // Aggiungi modello con configurazione
                window.Scene3D.addModel(model, modelConfig);
                
            }
        });
        
        this.updateStatus(`${models.length} modello(i) caricato(i)`);
        
        // Crea controlli visibilità per modelli multipli
        if (models.length > 1) {
            this.createModelVisibilityControls();
        }
        
        // Nascondi progress bar al completamento
        this.hideModelProgressBar();
        
        // Reset input file
        if (this.elements.fileInput) {
            this.elements.fileInput.value = '';
        }
        
        // NON evidenziare automaticamente il primo elemento - solo quando l'utente preme il pulsante tutorial
        // Il tutorial rimane in standby (currentStepIndex = -1) fino all'attivazione manuale

        // IMPORTANTE: Salva le posizioni originali PRIMA di applicare qualsiasi impostazione tutorial
        if (window.DragDropSystem && typeof window.DragDropSystem.storeOriginalPositions === 'function') {
            console.log(`🔧 DRAG&DROP: Salvataggio posizioni originali post-caricamento modelli`);
            window.DragDropSystem.storeOriginalPositions();
        }

        // Ora che i modelli sono caricati, riapplica le impostazioni modelli del tutorial iniziale
        if (this.availableTutorials.length > 0) {
            const firstTutorial = this.availableTutorials[0];
            if (firstTutorial && firstTutorial.properties && window.Scene3D && window.Scene3D.applyModelSettings) {
                // Crea oggetto tutorial fake per riusare la funzione esistente di Scene3D
                const fakeTutorialStep = {
                    properties: {}
                };
                
                // Copia le proprietà modelli se presenti
                let hasModelSettings = false;
                
                if (firstTutorial.properties.Posizione) {
                    fakeTutorialStep.properties.Posizione = firstTutorial.properties.Posizione;
                    hasModelSettings = true;
                    const posizioniCount = Array.isArray(firstTutorial.properties.Posizione) ? firstTutorial.properties.Posizione.length : 1;
                    console.log(`🔧 MODELLI POST-LOAD: Posizione (${posizioniCount} modelli)`);
                }

                if (firstTutorial.properties.Rotazione) {
                    fakeTutorialStep.properties.Rotazione = firstTutorial.properties.Rotazione;
                    hasModelSettings = true;
                    const rotazioniCount = Array.isArray(firstTutorial.properties.Rotazione) ? firstTutorial.properties.Rotazione.length : 1;
                    console.log(`🔧 MODELLI POST-LOAD: Rotazione (${rotazioniCount} modelli)`);
                }
                
                if (hasModelSettings) {
                    console.log(`🔧 MODELLI POST-LOAD: Applicazione impostazioni modelli post-caricamento per "${firstTutorial.name}"`);
                    window.Scene3D.applyModelSettings(fakeTutorialStep);
                }
            }
        }

        // RIMOSSO: nascondimento planaxis ora avviene immediatamente durante il caricamento in Scene3D.addModel()

        // ═══════════════════════════════════════════════════════════════
        // SCREEN SYSTEM: Inizializza visibilità viste dopo caricamento modelli
        // ═══════════════════════════════════════════════════════════════
        if (window.ScreenSystem && window.ScreenSystem.screens.size > 0) {
            console.log('📺 [UI] Inizializzazione visibilità viste ScreenSystem...');
            window.ScreenSystem.initializeVisibility();
        }

        // ═══════════════════════════════════════════════════════════════
        // STEP CONTROLLER: Inizializza controller step centralizzato
        // ═══════════════════════════════════════════════════════════════
        if (window.StepController && !window.StepController.initialized) {
            console.log('🎮 [UI] Inizializzazione StepController...');
            window.StepController.init();
        }

        // ═══════════════════════════════════════════════════════════════
        // INTERACTIVE OBJECT 3D: Cerca varianti StateGroup in TUTTA la scena
        // Questo è necessario perché alcune varianti potrebbero essere:
        // - In modelli caricati separatamente (non come child)
        // - Con nomi che necessitano match parziale
        // ═══════════════════════════════════════════════════════════════
        if (window.InteractiveObject3D && window.InteractiveObject3D.stateGroups.size > 0) {
            console.log('🔀 [UI] Ricerca varianti StateGroup in tutta la scena...');
            window.InteractiveObject3D.attachStateGroupMeshesFromScene();
        }

    };
    /**
     * Callback errore caricamento modelli
     */
    UI.onModelLoadError = function(error) {
        this.hideLoader();
        this.hideModelProgressBar(); // Nascondi progress bar anche in caso di errore
        this.showError('Errore caricamento modelli: ' + error);
        this.updateStatus('Errore caricamento');
        
        AppConfig.log(0, 'Errore caricamento modelli:', error);
    };
    /* ===== GESTIONE ANIMAZIONI ===== */
    
    /**
     * Gestisce la selezione di file animazione
     */
    UI.onAnimationSelected = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        AppConfig.log(2, `File animazione selezionato: ${file.name}`);
        // TODO: Implementare caricamento animazioni
        
        this.updateStatus('File animazione caricato');
        if (this.elements.animationBtn) {
            this.elements.animationBtn.disabled = false;
        }
    };
    console.log('[UIScenarioLoader] Modulo caricato');
})();
