/**
 * UI.JS - Gestione interfaccia utente
 * 
 * Questo modulo gestisce:
 * - Navigazione tra pagine (Home/Scenario)
 * - Gestione scenari e configurazioni
 * - Messaggi di stato e feedback utente
 * - Eventi input file e pulsanti
 * - Animazioni UI e transizioni
 */

window.UI = {
    
    /* ===== HELPER FUNCTIONS ===== */
    
    /**
     * Log sicuro che funziona anche se AppConfig non è caricato
     */
    safeLog: function(level, message, ...args) {
        if (window.AppConfig && AppConfig.log) {
            AppConfig.log(level, message, ...args);
        } else {
            const levelNames = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
            const levelName = levelNames[level] || 'LOG';
            console.log(`[${levelName}] ${message}`, ...args);
        }
    },
    
    /* ===== STATO UI ===== */
    currentPage: 'home',           // Pagina corrente ('home' o 'scenario')
    scenariosConfig: null,         // Configurazione scenari caricata
    currentScenario: null,         // Scenario attivo
    homeConfig: null,              // Configurazione home page
    
    /* ===== ELEMENTI DOM ===== */
    elements: {},                  // Cache elementi DOM
    
    /**
     * Inizializza l'interfaccia utente
     */
    init: function() {
        this.safeLog(2, 'Inizializzazione UI...');
        
        try {
            // Caching elementi DOM
            this.cacheElements();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Mostra pagina iniziale
            this.showPage('home');
            
            // Aggiorna stato iniziale
            this.updateStatus('Pronto');
            
            // Carica automaticamente la configurazione home se disponibile
            this.loadHomeConfigFromServer();
            
            // Inizializza la legenda degli strumenti
            this.initToolsLegend();
            
            AppConfig.log(2, 'UI inizializzata con successo');
            
        } catch (error) {
            AppConfig.log(0, 'Errore inizializzazione UI:', error);
            this.showError('Errore inizializzazione interfaccia');
        }
    },
    
    /**
     * Cachea i riferimenti agli elementi DOM per performance migliori
     */
    cacheElements: function() {
        // Elementi principali
        this.elements.homePage = document.getElementById('homePage');
        this.elements.scenarioPage = document.getElementById('scenarioPage');
        this.elements.scenariosList = document.getElementById('scenariosList');
        
        // Controlli
        this.elements.fileInput = document.getElementById('fileInput');
        this.elements.animationInput = document.getElementById('animationInput');
        this.elements.scenarioBtn = document.getElementById('scenarioBtn');
        this.elements.animationBtn = document.getElementById('animationBtn');
        
        // Feedback elements
        this.elements.status = document.getElementById('status');
        this.elements.loader = document.getElementById('loader');
        this.elements.error = document.getElementById('error');
        this.elements.errorMessage = document.getElementById('errorMessage');
        this.elements.scenarioTitle = document.getElementById('scenarioTitle');
        
        AppConfig.log(3, 'Elementi DOM cachati');
    },
    
    /**
     * Configura tutti gli event listeners
     */
    setupEventListeners: function() {
        // Input file home rimosso - caricamento automatico dal server
        
        // Input file modelli
        if (this.elements.fileInput) {
            this.elements.fileInput.addEventListener('change', 
                this.onModelsSelected.bind(this));
        }
        
        // Input file animazioni
        if (this.elements.animationInput) {
            this.elements.animationInput.addEventListener('change', 
                this.onAnimationSelected.bind(this));
        }
        
        // Click sulle card scenario
        if (this.elements.scenariosList) {
            this.elements.scenariosList.addEventListener('click', 
                this.onScenarioCardClick.bind(this));
            
            // Gestione navigazione da tastiera
            this.elements.scenariosList.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    this.onScenarioCardClick(event);
                }
            });
        }
        
        // Event listener per rotazione schermo mobile
        window.addEventListener('orientationchange', this.onOrientationChange.bind(this));
        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        AppConfig.log(3, 'Event listeners configurati');
    },
    
    /* ===== NAVIGAZIONE PAGINE ===== */
    
    /**
     * Mostra una specifica pagina
     * @param {string} page - Nome della pagina ('home' o 'scenario')
     */
    showPage: function(page) {
        AppConfig.log(3, `Navigazione verso pagina: ${page}`);
        
        // Nascondi tutte le pagine
        if (this.elements.homePage) {
            this.elements.homePage.classList.add('hidden');
        }
        if (this.elements.scenarioPage) {
            this.elements.scenarioPage.classList.add('hidden');
        }
        
        // Mostra la pagina richiesta
        if (page === 'home' && this.elements.homePage) {
            this.elements.homePage.classList.remove('hidden');
            this.currentPage = 'home';
            // Pulisce controlli mobile
            this.cleanupMobileControls();
        } else if (page === 'scenario' && this.elements.scenarioPage) {
            this.elements.scenarioPage.classList.remove('hidden');
            this.currentPage = 'scenario';
            // Inizializza controlli mobile
            this.initMobileControls();
        }
        
        // Callback per pagina specifica
        if (page === 'scenario') {
            this.onScenarioPageShown();
        }
    },
    
    /**
     * Torna alla home page
     */
    goHome: function() {
        // Pulisci la scena 3D
        if (window.Scene3D && window.Scene3D.clearAllModels) {
            window.Scene3D.clearAllModels();
        }
        
        // Reset stato scenario
        this.currentScenario = null;
        
        // Nasconde la barra tutorial e il fumetto
        this.hideTutorialStepsBar();
        this.hideStepSpeechBubble();
        
        // Aggiorna UI
        this.updateStatus('Home');
        this.showPage('home');
        
        AppConfig.log(2, 'Ritorno alla home');
    },
    
    /**
     * Callback quando viene mostrata la pagina scenario
     */
    onScenarioPageShown: function() {
        // Inizializza la scena 3D se non già fatto
        if (window.Scene3D && !window.Scene3D.scene) {
            try {
                window.Scene3D.init();
            } catch (error) {
                this.showError('Errore inizializzazione scena 3D: ' + error.message);
            }
        }
    },
    
    /* ===== GESTIONE SCENARI ===== */
    
    /**
     * Gestisce la selezione del file di configurazione home
     */
    onHomeConfigSelected: function(event) {
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
    },
    
    /**
     * Carica automaticamente il file home_config.txt dal server
     */
    loadHomeConfigFromServer: function() {
        this.safeLog(2, 'Tentativo caricamento home_config.txt dal server...');
        this.updateStatus('Caricamento configurazione...');
        
        fetch(`./home_config.txt?v=${Date.now()}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return response.text();
            })
            .then(content => {
                this.safeLog(2, 'home_config.txt caricato con successo dal server');
                this.parseHomeConfig(content);
                this.updateStatus('Configurazione caricata automaticamente');
            })
            .catch(error => {
                this.safeLog(1, 'Impossibile caricare home_config.txt dal server:', error.message);
                this.updateStatus('Nessuna configurazione - usa caricamento manuale');
                // Non mostrare errore all'utente - è normale se il file non esiste
            });
    },
    
    /**
     * Analizza il file di configurazione home e genera le card scenari
     */
    parseHomeConfig: function(content) {
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
                    
                    if (label === 'direzione') {
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
    },
    
    /**
     * Renderizza le card degli scenari nella home page
     */
    renderScenarioCards: function() {
        if (!this.elements.scenariosList || !this.scenariosConfig) return;
        
        // Pulisci lista esistente
        this.elements.scenariosList.innerHTML = '';
        
        // Crea card per ogni scenario
        this.scenariosConfig.forEach((scenario, index) => {
            const card = this.createScenarioCard(scenario, index);
            this.elements.scenariosList.appendChild(card);
        });
        
        // Aggiungi sempre la card "Modalità Manuale" alla fine
        const manualCard = this.createManualModeCard();
        this.elements.scenariosList.appendChild(manualCard);
        
        AppConfig.log(3, `Renderizzate ${this.scenariosConfig.length} card scenario + modalità manuale`);
    },
    
    /**
     * Crea una singola card scenario
     */
    createScenarioCard: function(scenario, index) {
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
    },
    
    /**
     * Crea la card "Modalità Manuale"
     */
    createManualModeCard: function() {
        const card = document.createElement('div');
        card.className = 'scenario-card manual-mode';
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.dataset.manual = 'true';
        
        // Sezione immagine
        const imageSection = document.createElement('div');
        imageSection.className = 'scenario-image';
        
        const placeholderImage = document.createElement('div');
        placeholderImage.className = 'placeholder-image';
        placeholderImage.setAttribute('aria-hidden', 'true');
        placeholderImage.textContent = '🔧';
        
        imageSection.appendChild(placeholderImage);
        
        // Sezione info
        const infoSection = document.createElement('div');
        infoSection.className = 'scenario-info';
        
        const title = document.createElement('h3');
        title.textContent = 'Modalità Manuale';
        
        const description = document.createElement('p');
        description.textContent = 'Carica direttamente i tuoi modelli 3D senza utilizzare scenari predefiniti. Supporta OBJ, STL, GLTF/GLB con materiali e texture.';
        
        infoSection.appendChild(title);
        infoSection.appendChild(description);
        
        // Assembla card
        card.appendChild(imageSection);
        card.appendChild(infoSection);
        
        return card;
    },
    
    /**
     * Gestisce il click su una card scenario
     */
    onScenarioCardClick: function(event) {
        const card = event.target.closest('.scenario-card');
        if (!card) return;
        
        // Se è la card placeholder, non fare nulla (è solo informativa)
        if (card.classList.contains('placeholder')) {
            return;
        }
        
        // Controlla se è la card "Modalità Manuale"
        if (card.dataset.manual === 'true') {
            AppConfig.log(2, 'Modalità manuale selezionata');
            this.showPage('scenario');
            return;
        }
        
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
    },
    
    /**
     * Carica uno scenario specifico
     */
    loadScenario: function(scenario) {
        this.currentScenario = scenario;
        
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
        
        // Carica automaticamente tutti i modelli OBJ/MTL dello scenario
        this.loadScenarioModels(scenario);
        
        // Carica il tutorial se specificato nel file di configurazione
        if (scenario.tutorial) {
            AppConfig.log(2, `🎓 Caricamento tutorial per scenario: ${scenario.tutorial}`);
            this.loadTutorial(scenario.tutorial);
        } else {
            AppConfig.log(2, `❌ Nessun tutorial specificato per scenario: ${scenario.name}`);
            // Nasconde la barra tutorial se non c'è tutorial
            this.hideTutorialStepsBar();
        }
    },
    
    /**
     * Applica le configurazioni di camera e luci specifiche dello scenario
     */
    applyScenarioConfiguration: function(scenario) {
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
                AppConfig.log(2, `📷 Camera position applicata: (${pos.x}, ${pos.y}, ${pos.z})`);
            }
        }
        
        // Applica target camera se specificato
        if (scenario.cameraTarget) {
            const target = this.parseVector3(scenario.cameraTarget);
            if (target) {
                window.Scene3D.camera.lookAt(target.x, target.y, target.z);
                AppConfig.log(2, `🎯 Camera target applicato: (${target.x}, ${target.y}, ${target.z})`);
            }
        }
        
        // Applica configurazioni luci dopo un breve delay per assicurarsi che THREE sia disponibile
        setTimeout(() => {
            this.applyScenarioLights(scenario);
        }, 100);
        
        AppConfig.log(2, `✅ Configurazione scenario applicata per: ${scenario.name}`);
    },
    
    /**
     * Applica le configurazioni delle luci dello scenario
     */
    applyScenarioLights: function(scenario) {
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
    },
    
    /**
     * Parsing di una stringa vector3 "(x, y, z)" in oggetto
     */
    parseVector3: function(vectorString) {
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
    },
    
    /**
     * Parsing configurazione luce ambientale "0x606060,2.0"
     */
    parseLightConfig: function(lightString) {
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
    },
    
    /**
     * Parsing configurazione luce direzionale "0xffffff,3.3,(1, 1, 1)"
     */
    parseDirectionalLightConfig: function(lightString) {
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
    },
    
    /**
     * Carica automaticamente tutti i modelli OBJ/MTL di uno scenario
     */
    loadScenarioModels: function(scenario) {
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
    },
    
    /**
     * Carica modelli da URL utilizzando il ModelLoader
     */
    loadModelsFromUrls: function(modelUrls) {
        console.log('🌐 Avvio fetch per:', modelUrls);
        
        let completedFiles = 0;
        const totalFiles = modelUrls.length;
        
        const loadPromises = modelUrls.map(model => {
            console.log(`🌐 Fetching: ${model.path}`);
            // Aggiorna progress bar - fetch iniziato
            this.updateModelProgress(completedFiles, totalFiles, model.name);
            
            return fetch(model.path)
                .then(response => {
                    console.log(`🌐 Response per ${model.path}:`, response.status, response.statusText);
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    return response.blob();
                })
                .then(blob => {
                    console.log(`🌐 Blob creato per ${model.name}:`, blob.size, 'bytes');
                    
                    // Aggiorna progress bar - file completato
                    completedFiles++;
                    this.updateModelProgress(completedFiles, totalFiles, model.name);
                    
                    // Crea un File object dal blob
                    const file = new File([blob], model.name, { type: blob.type });
                    return { file, model };
                })
                .catch(error => {
                    console.error(`❌ Errore fetch ${model.name}:`, error);
                    AppConfig.log(1, `Errore caricamento ${model.name}: ${error.message}`);
                    return null;
                });
        });
        
        Promise.allSettled(loadPromises)
            .then(results => {
                console.log('🌐 Risultati fetch:', results);
                
                const validFiles = results
                    .filter(result => result.status === 'fulfilled' && result.value !== null)
                    .map(result => result.value.file);
                
                const failedFiles = results.filter(result => result.status === 'rejected').length;
                
                console.log('🌐 File validi:', validFiles.length, 'File falliti:', failedFiles);
                console.log('🌐 ValidFiles dettaglio:', validFiles);
                
                if (validFiles.length > 0) {
                    AppConfig.log(2, `${validFiles.length} modelli caricati con successo`);
                    if (failedFiles > 0) {
                        AppConfig.log(1, `${failedFiles} modelli non caricati`);
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
                            (progress) => {
                                console.log('🌐 Progress:', progress);
                                this.updateStatus(`Caricamento modelli: ${Math.round(progress * 100)}%`);
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
    },
    
    /* ===== GESTIONE FILE MODELLI ===== */
    
    /**
     * Gestisce la selezione di file modelli dall'utente
     */
    onModelsSelected: function(event) {
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
    },
    
    /**
     * Callback progresso caricamento modelli
     */
    onModelLoadProgress: function(message, progress) {
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
    },
    
    /**
     * Callback completamento caricamento modelli
     */
    onModelLoadComplete: function(models) {
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
                
                // DEBUG: Controlla i controlli touch dopo l'aggiunta del modello
                setTimeout(() => {
                    console.log('🔍 DEBUG: Controllo stato controlli touch dopo addModel');
                    this.debugTouchControlsState();
                }, 100);
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
        
        // DEBUG: Stato finale dei controlli touch dopo caricamento completo
        setTimeout(() => {
            console.log('🔍 DEBUG: Stato controlli touch alla fine del caricamento modelli');
            this.debugTouchControlsState();
            // Forza nuovamente i controlli per sicurezza
            this.forceShowTouchControls();
        }, 500);
    },
    
    /**
     * Callback errore caricamento modelli
     */
    onModelLoadError: function(error) {
        this.hideLoader();
        this.hideModelProgressBar(); // Nascondi progress bar anche in caso di errore
        this.showError('Errore caricamento modelli: ' + error);
        this.updateStatus('Errore caricamento');
        
        AppConfig.log(0, 'Errore caricamento modelli:', error);
    },
    
    /* ===== GESTIONE ANIMAZIONI ===== */
    
    /**
     * Gestisce la selezione di file animazione
     */
    onAnimationSelected: function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        AppConfig.log(2, `File animazione selezionato: ${file.name}`);
        // TODO: Implementare caricamento animazioni
        
        this.updateStatus('File animazione caricato');
        if (this.elements.animationBtn) {
            this.elements.animationBtn.disabled = false;
        }
    },
    
    /* ===== FEEDBACK UTENTE ===== */
    
    /**
     * Aggiorna il messaggio di stato
     */
    updateStatus: function(message) {
        if (this.elements.status) {
            this.elements.status.textContent = message;
        }
        AppConfig.log(3, `Status: ${message}`);
    },
    
    /**
     * Mostra il loader con messaggio
     */
    showLoader: function(message = 'Caricamento...') {
        if (this.elements.loader) {
            const loaderText = this.elements.loader.querySelector('p');
            if (loaderText) {
                loaderText.textContent = message;
            }
            this.elements.loader.classList.remove('hidden');
        }
    },
    
    /**
     * Nasconde il loader
     */
    hideLoader: function() {
        if (this.elements.loader) {
            this.elements.loader.classList.add('hidden');
        }
    },
    
    /**
     * Mostra messaggio di errore
     */
    showError: function(message) {
        if (this.elements.error && this.elements.errorMessage) {
            this.elements.errorMessage.textContent = message;
            this.elements.error.classList.remove('hidden');
        }
        AppConfig.log(0, `Errore UI: ${message}`);
    },
    
    /**
     * Nasconde messaggio di errore
     */
    hideError: function() {
        if (this.elements.error) {
            this.elements.error.classList.add('hidden');
        }
    },
    
    /* ===== PROGRESS BAR MODELLI ===== */
    
    /**
     * Mostra la progress bar per il caricamento modelli
     */
    showModelProgressBar: function(totalFiles = 0) {
        const progressBar = document.getElementById('modelProgressBar');
        if (progressBar) {
            // Reset elementi
            this.updateModelProgress(0, totalFiles, 'Preparazione...');
            
            // Mostra la progress bar
            progressBar.classList.remove('hidden');
            
            console.log('📊 Progress bar modelli mostrata');
        }
    },
    
    /**
     * Aggiorna la progress bar
     */
    updateModelProgress: function(currentFile, totalFiles, fileName = '', percentage = null) {
        const progressBarFill = document.getElementById('progress-bar-fill');
        const progressCurrentFile = document.getElementById('progress-current-file');
        const progressPercentage = document.getElementById('progress-percentage');
        const progressFilesCount = document.getElementById('progress-files-count');
        
        // Calcola percentuale se non fornita
        if (percentage === null) {
            percentage = totalFiles > 0 ? Math.round((currentFile / totalFiles) * 100) : 0;
        }
        
        // Aggiorna elementi
        if (progressBarFill) {
            progressBarFill.style.width = `${percentage}%`;
        }
        
        if (progressCurrentFile) {
            if (fileName) {
                // Estrai solo il nome del file senza percorso
                const cleanFileName = fileName.split('/').pop() || fileName;
                progressCurrentFile.textContent = cleanFileName;
            }
        }
        
        if (progressPercentage) {
            progressPercentage.textContent = `${percentage}%`;
        }
        
        if (progressFilesCount) {
            progressFilesCount.textContent = `${currentFile} / ${totalFiles} file`;
        }
        
        console.log(`📊 Progress aggiornato: ${percentage}% - ${fileName}`);
    },
    
    /**
     * Nasconde la progress bar
     */
    hideModelProgressBar: function() {
        const progressBar = document.getElementById('modelProgressBar');
        if (progressBar) {
            progressBar.classList.add('hidden');
            console.log('📊 Progress bar modelli nascosta');
        }
    },
    
    /* ===== AZIONI PULSANTI ===== */
    
    /**
     * Esegue lo scenario corrente
     */
    executeScenario: function() {
        if (!this.currentScenario) {
            this.showError('Nessuno scenario selezionato');
            return;
        }
        
        AppConfig.log(2, `Esecuzione scenario: ${this.currentScenario.name}`);
        // TODO: Implementare esecuzione scenario
        
        this.updateStatus('Scenario in esecuzione...');
    },
    
    /**
     * Pulisce tutti i modelli dalla scena
     */
    clearAll: function() {
        if (window.Scene3D) {
            window.Scene3D.clearAllModels();
        }
        
        // Reset input files
        if (this.elements.fileInput) this.elements.fileInput.value = '';
        if (this.elements.animationInput) this.elements.animationInput.value = '';
        
        // Disabilita pulsanti
        if (this.elements.animationBtn) this.elements.animationBtn.disabled = true;
        
        this.updateStatus('Scena pulita');
        AppConfig.log(2, 'Scena pulita dall\'utente');
        
        // Nasconde i controlli di visibilità
        this.hideModelVisibilityControls();
    },
    
    /**
     * Crea i controlli per la visibilità dei modelli
     */
    createModelVisibilityControls: function() {
        const panel = document.getElementById('modelsVisibilityPanel');
        if (!panel) {
            console.warn('Pannello controlli visibilità modelli non trovato');
            return;
        }
        
        // Ottieni informazioni sui modelli dalla scena
        const modelsInfo = window.Scene3D ? window.Scene3D.getModelsInfo() : [];
        
        // Pulisci pannello esistente
        panel.innerHTML = '';
        
        if (modelsInfo.length > 1) {
            // Aggiungi titolo
            const title = document.createElement('span');
            title.textContent = '👁️ Visibilità:';
            title.style.cssText = 'color: white; font-size: 12px; margin-right: 5px; align-self: center;';
            panel.appendChild(title);
            
            // Crea pulsante per ogni modello
            modelsInfo.forEach((info, index) => {
                const button = document.createElement('button');
                button.className = 'btn-blue';
                button.style.cssText = 'padding: 4px 8px; font-size: 11px; min-width: auto;';
                button.textContent = `📦 ${info.name === `Modello ${index + 1}` ? `M${index + 1}` : info.name.substring(0, 8)}`;
                button.title = `Mostra/Nascondi ${info.name}`;
                
                // Aggiorna stile in base alla visibilità
                this.updateVisibilityButtonStyle(button, info.visible);
                
                // Aggiungi click handler
                button.onclick = () => this.toggleModelVisibility(index);
                
                panel.appendChild(button);
            });
            
            // Mostra il pannello
            panel.classList.remove('hidden');
            panel.style.display = 'flex';
        }
    },
    
    /**
     * Nasconde i controlli di visibilità modelli
     */
    hideModelVisibilityControls: function() {
        const panel = document.getElementById('modelsVisibilityPanel');
        if (panel) {
            panel.classList.add('hidden');
            panel.style.display = 'none';
            panel.innerHTML = '';
        }
    },
    
    /**
     * Alterna la visibilità di un modello
     */
    toggleModelVisibility: function(modelIndex) {
        if (!window.Scene3D) {
            console.warn('Scene3D non disponibile');
            return;
        }
        
        const visible = window.Scene3D.toggleModelVisibility(modelIndex);
        
        // Aggiorna il pulsante corrispondente
        const panel = document.getElementById('modelsVisibilityPanel');
        if (panel) {
            const buttons = panel.querySelectorAll('button');
            if (buttons[modelIndex + 1]) { // +1 per saltare il titolo
                this.updateVisibilityButtonStyle(buttons[modelIndex + 1], visible);
            }
        }
    },
    
    /**
     * Aggiorna lo stile del pulsante in base alla visibilità
     */
    updateVisibilityButtonStyle: function(button, visible) {
        if (visible) {
            button.style.opacity = '1';
            button.style.backgroundColor = 'var(--primary-blue)';
            button.title = button.title.replace('Mostra/', 'Nascondi ');
        } else {
            button.style.opacity = '0.5';
            button.style.backgroundColor = '#666';
            button.title = button.title.replace('Nascondi ', 'Mostra/');
        }
    },
    
    /**
     * Gestisce il toggle dei controlli su dispositivi mobili
     */
    toggleMobileControls: function() {
        const body = document.body;
        const toggleBtn = document.getElementById('toggleControlsBtn');
        
        if (body.classList.contains('mobile-controls-hidden')) {
            // Mostra controlli
            body.classList.remove('mobile-controls-hidden');
            if (toggleBtn) {
                toggleBtn.innerHTML = '⚙️';
                toggleBtn.title = 'Nascondi controlli avanzati';
            }
            console.log('📱 Controlli mobile mostrati');
        } else {
            // Nascondi controlli
            body.classList.add('mobile-controls-hidden');
            if (toggleBtn) {
                toggleBtn.innerHTML = '⚙️';
                toggleBtn.title = 'Mostra controlli avanzati';
            }
            console.log('📱 Controlli mobile nascosti');
        }
    },
    
    /**
     * Inizializza i controlli mobile quando si entra in uno scenario
     */
    initMobileControls: function() {
        // Rileva se siamo su mobile (considera sia larghezza che altezza per rotazione)
        const isMobile = (window.innerWidth <= 768 || window.innerHeight <= 768);
        const toggleBtn = document.getElementById('toggleControlsBtn');
        const touchControls = document.getElementById('mobileTouchControls');
        
        if (isMobile) {
            if (toggleBtn) {
                // Mostra il pulsante toggle e nascondi i controlli avanzati di default
                toggleBtn.classList.remove('hidden');
                document.body.classList.add('mobile-controls-hidden');
            }
            
            if (touchControls) {
                // Mostra i controlli touch per la modalità - SEMPRE visibili su mobile
                touchControls.classList.remove('hidden');
                touchControls.style.display = 'flex';
                touchControls.style.flexDirection = 'column';
                touchControls.style.visibility = 'visible';
                touchControls.style.opacity = '1';
                this.setupMobileTouchListeners();
            }
            
            console.log('📱 Modalità mobile attivata - controlli touch mostrati');
        }
    },
    
    /**
     * Configura i listener per i controlli touch mobile
     */
    setupMobileTouchListeners: function() {
        const radioButtons = document.querySelectorAll('input[name="mobileMode"]');
        radioButtons.forEach(radio => {
            radio.addEventListener('change', function() {
                console.log(`📱 Modalità touch cambiata a: ${this.value}`);
            });
        });
        
        // Listener per rotazione schermo - mantiene controlli visibili
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                const touchControls = document.getElementById('mobileTouchControls');
                const isMobile = (window.innerWidth <= 768 || window.innerHeight <= 768);
                
                if (isMobile && touchControls) {
                    touchControls.classList.remove('hidden');
                    touchControls.style.display = 'flex';
                    touchControls.style.flexDirection = 'column';
                    touchControls.style.visibility = 'visible';
                    touchControls.style.opacity = '1';
                    touchControls.style.position = 'fixed';
                    console.log('📱 Controlli touch ripristinati dopo rotazione');
                }
            }, 100); // Piccolo delay per attendere il completamento della rotazione
        });
    },
    
    /**
     * Pulisce i controlli mobile quando si torna alla home
     */
    cleanupMobileControls: function() {
        const toggleBtn = document.getElementById('toggleControlsBtn');
        const touchControls = document.getElementById('mobileTouchControls');
        
        if (toggleBtn) {
            toggleBtn.classList.add('hidden');
        }
        
        if (touchControls) {
            // Non nascondere mai i controlli touch su mobile
            const isMobile = window.innerWidth <= 768;
            if (!isMobile) {
                touchControls.classList.add('hidden');
            }
            console.log('📱 Controlli touch - Mobile:', isMobile, 'Hidden:', !isMobile);
        }
        
        document.body.classList.remove('mobile-controls-hidden');
    },
    
    /**
     * Forza la visibilità dei controlli touch (metodo robusto)
     */
    forceShowTouchControls: function() {
        const touchControls = document.getElementById('mobileTouchControls');
        const isMobile = window.innerWidth <= 768;
        
        console.log('🔧 FORCE SHOW - isMobile:', isMobile, 'touchControls exists:', !!touchControls);
        
        if (touchControls && isMobile) {
            // Rimuovi tutte le classi che potrebbero nascondere
            touchControls.classList.remove('hidden');
            touchControls.classList.remove('mobile-only');
            
            // Determina il posizionamento in base all'orientamento
            const isLandscape = window.innerWidth > window.innerHeight;
            const screenWidth = window.innerWidth;
            const screenHeight = window.innerHeight;
            
            // Forza tutti gli stili necessari
            touchControls.style.display = 'flex !important';
            touchControls.style.flexDirection = 'column';
            touchControls.style.visibility = 'visible !important';
            touchControls.style.opacity = '1 !important';
            touchControls.style.position = 'fixed !important';
            touchControls.style.zIndex = '999999 !important';
            touchControls.style.background = 'rgba(0, 0, 0, 0.8) !important';
            touchControls.style.borderRadius = '8px !important';
            touchControls.style.padding = '8px !important';
            touchControls.style.gap = '10px !important';
            
            // POSIZIONAMENTO TEST: Centro schermo per debug
            const centerX = (screenWidth / 2) - 100; // Sottrai metà larghezza stimata controlli
            const centerY = (screenHeight / 2) - 75;  // Sottrai metà altezza stimata controlli
            
            touchControls.style.top = centerY + 'px !important';
            touchControls.style.left = centerX + 'px !important';
            
            console.log('🎯 TEST: Controlli posizionati al CENTRO schermo', {
                screen: { width: screenWidth, height: screenHeight },
                center: { x: centerX, y: centerY },
                isLandscape: isLandscape
            });
            
            console.log('📱 Posizionamento applicato:', {
                isLandscape: isLandscape,
                screen: { width: screenWidth, height: screenHeight },
                position: { top: touchControls.style.top, left: touchControls.style.left }
            });
            
            // Verifica dopo l'applicazione
            setTimeout(() => {
                const rect = touchControls.getBoundingClientRect();
                const computed = window.getComputedStyle(touchControls);
                console.log('📱 Controlli touch dopo FORCE:', {
                    display: computed.display,
                    visibility: computed.visibility,
                    opacity: computed.opacity,
                    zIndex: computed.zIndex,
                    position: computed.position,
                    rect: {
                        top: rect.top,
                        left: rect.left,
                        width: rect.width,
                        height: rect.height,
                        inScreen: rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth
                    },
                    screen: {
                        width: window.innerWidth,
                        height: window.innerHeight,
                        orientation: screen.orientation ? screen.orientation.angle : 'unknown'
                    }
                });
            }, 50);
        }
    },
    
    /**
     * Debug dello stato dei controlli touch
     */
    debugTouchControlsState: function() {
        const touchControls = document.getElementById('mobileTouchControls');
        if (touchControls) {
            const rect = touchControls.getBoundingClientRect();
            const computed = window.getComputedStyle(touchControls);
            
            console.log('🔍 STATO CONTROLLI TOUCH:', {
                exists: !!touchControls,
                classList: Array.from(touchControls.classList),
                style: {
                    display: touchControls.style.display,
                    visibility: touchControls.style.visibility,
                    opacity: touchControls.style.opacity,
                    zIndex: touchControls.style.zIndex,
                    position: touchControls.style.position
                },
                computed: {
                    display: computed.display,
                    visibility: computed.visibility,
                    opacity: computed.opacity,
                    zIndex: computed.zIndex,
                    position: computed.position
                },
                rect: {
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height,
                    inScreen: rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth
                },
                parent: touchControls.parentElement ? touchControls.parentElement.id : 'no parent'
            });
        } else {
            console.log('🚨 CONTROLLI TOUCH NON TROVATI NEL DOM!');
        }
    },
    
    /**
     * Gestisce il cambio di orientamento dello schermo mobile
     */
    onOrientationChange: function() {
        // Piccolo ritardo per permettere al browser di completare la rotazione
        console.log('🔄 ORIENTAMENTO CAMBIATO - INIZIO');
        const touchControls = document.getElementById('mobileTouchControls');
        if (touchControls) {
            const rect = touchControls.getBoundingClientRect();
            const computed = window.getComputedStyle(touchControls);
            console.log('📱 Stato controlli PRIMA rotazione:', {
                display: touchControls.style.display,
                visibility: touchControls.style.visibility,
                opacity: touchControls.style.opacity,
                className: touchControls.className,
                // Posizione e dimensioni
                rect: {
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height,
                    bottom: rect.bottom,
                    right: rect.right
                },
                style: {
                    top: touchControls.style.top,
                    left: touchControls.style.left,
                    position: touchControls.style.position
                },
                computed: {
                    top: computed.top,
                    left: computed.left,
                    position: computed.position
                },
                screen: {
                    width: window.innerWidth,
                    height: window.innerHeight,
                    orientation: screen.orientation ? screen.orientation.angle : 'unknown'
                }
            });
        }
        
        setTimeout(() => {
            console.log('📱 Orientamento cambiato, riapplicando controlli mobile...');
            this.handleMobileControlsRefresh();
            
            // Forza nuovamente dopo un altro delay
            setTimeout(() => {
                this.forceShowTouchControls();
            }, 100);
            
            // Timer ricorrente per assicurarsi che rimangano visibili
            this.startTouchControlsWatchdog();
        }, 300);
    },
    
    /**
     * Avvia un watchdog per mantenere i controlli touch sempre visibili su mobile
     */
    startTouchControlsWatchdog: function() {
        // Ferma il watchdog precedente se presente
        if (this.touchControlsWatchdog) {
            clearInterval(this.touchControlsWatchdog);
        }
        
        // Avvia nuovo watchdog ogni 500ms
        this.touchControlsWatchdog = setInterval(() => {
            const isMobile = window.innerWidth <= 768;
            const touchControls = document.getElementById('mobileTouchControls');
            
            if (isMobile && touchControls && this.currentPage === 'scenario') {
                const computed = window.getComputedStyle(touchControls);
                const rect = touchControls.getBoundingClientRect();
                
                // Controlla se sono nascosti o fuori schermo
                const isHidden = computed.display === 'none' || computed.visibility === 'hidden' || computed.opacity === '0';
                const isOffScreen = rect.top < 0 || rect.left < 0 || rect.bottom > window.innerHeight || rect.right > window.innerWidth;
                const isEmpty = rect.width === 0 || rect.height === 0;
                
                if (isHidden || isOffScreen || isEmpty) {
                    console.log('🚨 WATCHDOG: Controlli touch problematici!', {
                        isHidden: isHidden,
                        isOffScreen: isOffScreen,
                        isEmpty: isEmpty,
                        rect: {
                            top: rect.top,
                            left: rect.left,
                            width: rect.width,
                            height: rect.height,
                            bottom: rect.bottom,
                            right: rect.right
                        },
                        screen: {
                            width: window.innerWidth,
                            height: window.innerHeight
                        }
                    });
                    this.forceShowTouchControls();
                }
            }
        }, 500);
        
        console.log('🐕 Watchdog controlli touch avviato');
    },
    
    /**
     * Gestisce il resize della finestra
     */
    onWindowResize: function() {
        // Debounce per evitare troppi eventi durante resize
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            console.log('📱 Finestra ridimensionata, controllo mobile...');
            this.handleMobileControlsRefresh();
        }, 200);
    },
    
    /**
     * Riapplica le impostazioni dei controlli mobile dopo orientamento/resize
     */
    handleMobileControlsRefresh: function() {
        // Solo se siamo nella pagina scenario
        if (this.currentPage !== 'scenario') return;
        
        const isMobile = window.innerWidth <= 768;
        const toggleBtn = document.getElementById('toggleControlsBtn');
        const touchControls = document.getElementById('mobileTouchControls');
        
        if (isMobile) {
            // Modalità mobile: mostra controlli touch, nascondi controlli avanzati
            if (toggleBtn) {
                toggleBtn.classList.remove('hidden');
            }
            if (touchControls) {
                touchControls.classList.remove('hidden');
                // Forza gli stili necessari per garantire visibilità
                touchControls.style.display = 'flex';
                touchControls.style.flexDirection = 'column';
                touchControls.style.visibility = 'visible';
                touchControls.style.opacity = '1';
                touchControls.style.position = 'fixed';
                touchControls.style.zIndex = '100000';
                console.log('📱 Controlli touch forzati a essere visibili');
            }
            document.body.classList.add('mobile-controls-hidden');
            console.log('📱 Controlli mobile riattivati dopo orientamento');
            
        } else {
            // Modalità desktop: mostra tutto, nascondi controlli touch
            if (toggleBtn) {
                toggleBtn.classList.add('hidden');
            }
            if (touchControls) {
                // Solo nascondere se realmente desktop (non landscape mobile)
                const isMobile = window.innerWidth <= 768;
                if (!isMobile) {
                    touchControls.classList.add('hidden');
                }
                console.log('🖥️ Controlli touch - Mobile:', isMobile, 'Hidden:', !isMobile);
            }
            document.body.classList.remove('mobile-controls-hidden');
            console.log('🖥️ Controlli desktop riattivati dopo orientamento');
        }
    },
    
    /**
     * Reset vista camera
     */
    resetView: function() {
        if (window.Scene3D && window.Scene3D.resetView) {
            window.Scene3D.resetView();
            this.updateStatus('Vista reimpostata');
            AppConfig.log(2, 'Vista camera reimpostata');
        }
    },
    
    /**
     * Avvia animazione
     */
    startAnimation: function() {
        AppConfig.log(2, 'Avvio animazione richiesto');
        // TODO: Implementare sistema animazioni
        this.updateStatus('Animazione avviata');
    },
    
    /* ===== GESTIONE STRUMENTI TUTORIAL ===== */
    
    /**
     * Stato corrente degli strumenti
     */
    toolsState: {},
    
    /**
     * Inizializza la legenda strumenti
     */
    initToolsLegend: function() {
        const toolsContainer = document.getElementById('toolsContainer');
        if (!toolsContainer) return;
        
        const tools = [
            { name: 'brugola', icon: 'utilimages/brugola.png' },
            { name: 'chiave_inglese', icon: 'utilimages/chiave_inglese.png' },
            { name: 'mano', icon: 'utilimages/mano.png' },
            { name: 'martello', icon: 'utilimages/martello.png' }
        ];
        
        // Pulisce il container
        toolsContainer.innerHTML = '';
        
        // Crea le icone degli strumenti
        tools.forEach(tool => {
            const toolElement = document.createElement('div');
            toolElement.className = 'tool-icon';
            toolElement.dataset.tool = tool.name;
            toolElement.title = tool.name.replace('_', ' ');
            
            const img = document.createElement('img');
            img.src = tool.icon;
            img.alt = tool.name;
            img.onerror = function() {
                console.warn(`Icona non trovata: ${tool.icon}`);
                this.style.display = 'none';
            };
            
            toolElement.appendChild(img);
            toolElement.addEventListener('click', () => this.toggleTool(tool.name));
            
            toolsContainer.appendChild(toolElement);
            
            // Inizializza lo stato dello strumento
            this.toolsState[tool.name] = false;
        });
        
        AppConfig.log(2, 'Legenda strumenti inizializzata');
    },
    
    /**
     * Attiva/disattiva uno strumento
     */
    toggleTool: function(toolName) {
        // Se lo strumento è già attivo, non fare nulla (rimane attivo)
        if (this.toolsState[toolName]) {
            AppConfig.log(2, `Strumento già attivo: ${toolName}`);
            return;
        }
        
        // Disattiva tutti gli altri strumenti (modalità esclusiva)
        Object.keys(this.toolsState).forEach(tool => {
            if (tool !== toolName) {
                this.toolsState[tool] = false;
                const element = document.querySelector(`[data-tool="${tool}"]`);
                if (element) element.classList.remove('active');
            }
        });
        
        // Attiva lo strumento corrente (non più toggle, solo attivazione)
        this.toolsState[toolName] = true;
        const element = document.querySelector(`[data-tool="${toolName}"]`);
        
        element.classList.add('active');
        this.updateStatus(`Strumento attivo: ${toolName.replace('_', ' ')}`);
        AppConfig.log(2, `Strumento attivato: ${toolName}`);
        
        // Notifica il cambio di stato agli altri moduli
        this.onToolStateChanged(toolName, this.toolsState[toolName]);
    },
    
    /**
     * Disattiva manualmente uno strumento specifico
     */
    deactivateTool: function(toolName) {
        if (!this.toolsState[toolName]) return; // Già disattivato
        
        this.toolsState[toolName] = false;
        const element = document.querySelector(`[data-tool="${toolName}"]`);
        if (element) element.classList.remove('active');
        
        this.updateStatus('Nessuno strumento attivo');
        AppConfig.log(2, `Strumento disattivato: ${toolName}`);
        
        // Notifica il cambio di stato
        this.onToolStateChanged(toolName, false);
    },
    
    /**
     * Disattiva tutti gli strumenti
     */
    deactivateAllTools: function() {
        Object.keys(this.toolsState).forEach(toolName => {
            this.deactivateTool(toolName);
        });
    },
    
    /**
     * Ottiene lo stato di uno strumento
     */
    getToolState: function(toolName) {
        return this.toolsState[toolName] || false;
    },
    
    /**
     * Ottiene lo strumento attualmente attivo
     */
    getActiveTool: function() {
        for (const [toolName, isActive] of Object.entries(this.toolsState)) {
            if (isActive) return toolName;
        }
        return null;
    },
    
    /**
     * Callback chiamata quando cambia lo stato di uno strumento
     * Può essere sovrascritta per implementare logica specifica
     */
    onToolStateChanged: function(toolName, isActive) {
        // Evento personalizzabile per altri moduli
        const event = new CustomEvent('toolStateChanged', {
            detail: { toolName, isActive, allStates: this.toolsState }
        });
        document.dispatchEvent(event);
    },
    
    /* ===== GESTIONE TUTORIAL STEPS ===== */
    
    /**
     * Configurazione tutorial corrente
     */
    tutorialSteps: [],         // Steps di un tutorial specifico
    availableTutorials: [],     // Lista dei tutorial disponibili
    currentTutorial: null,      // Tutorial attualmente attivo
    currentStepIndex: 0,
    
    /**
     * Carica e parsa il file tutorial.txt
     */
    loadTutorial: async function(tutorialPath) {
        if (!tutorialPath) {
            console.log('❌ Nessun path tutorial specificato');
            return;
        }
        
        try {
            AppConfig.log(2, `Caricamento tutorial: ${tutorialPath}`);
            
            const response = await fetch(tutorialPath);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const content = await response.text();
            this.tutorialSteps = this.parseTutorialContent(content);
            
            if (this.tutorialSteps.length > 0) {
                this.createTutorialStepsBar();
                this.showTutorialStepsBar();
                this.updateStepSpeechBubble(); // Inizializza il fumetto
                AppConfig.log(2, `Tutorial caricato: ${this.tutorialSteps.length} step`);
            } else {
                this.hideStepSpeechBubble(); // Nasconde il fumetto se non ci sono step
                AppConfig.log(1, 'Nessun step trovato nel tutorial');
            }
            
        } catch (error) {
            AppConfig.log(0, `Errore caricamento tutorial: ${error.message}`);
            this.showError(`Errore caricamento tutorial: ${error.message}`);
        }
    },
    
    /**
     * Parsa il contenuto del file tutorial.txt
     * Ora distingue tra tutorial principali e steps
     */
    parseTutorialContent: function(content) {
        const tutorials = [];
        const lines = content.split('\n');
        let currentTutorial = null;
        let currentStep = null;
        
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
                
                // Determina se è un tutorial principale o uno step
                if (sectionName.toLowerCase().startsWith('step ')) {
                    // È uno step interno al tutorial corrente
                    if (currentStep && Object.keys(currentStep.properties).length > 0) {
                        if (currentTutorial) {
                            currentTutorial.steps.push(currentStep);
                        }
                    }
                    
                    // Crea nuovo step
                    currentStep = {
                        name: sectionName,
                        title: sectionName,
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
                        steps: []
                    };
                    currentStep = null;
                }
            }
            // Parsa proprietà step (chiave=valore)
            else if (line && line.includes('=') && currentStep) {
                const [key, value] = line.split('=').map(s => s.trim());
                currentStep.properties[key] = value;
                
                // Parsing specifico per proprietà speciali
                if (key === 'CameraPos' || key === 'CameraTarget') {
                    const coords = value.replace(/[()]/g, '').split(',').map(n => parseFloat(n.trim()));
                    if (coords.length === 3) {
                        currentStep.properties[key + '_parsed'] = { x: coords[0], y: coords[1], z: coords[2] };
                    }
                } else if (key === 'CameraZoom' || key === 'CameraTransitionTime') {
                    currentStep.properties[key + '_parsed'] = parseFloat(value);
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
        
        AppConfig.log(3, 'Tutorials parsed:', tutorials);
        
        // Memorizza i tutorial disponibili
        this.availableTutorials = tutorials;
        
        // Se c'è almeno un tutorial, seleziona il primo come default
        if (tutorials.length > 0) {
            this.selectTutorial(0);
            return tutorials[0].steps;
        }
        
        return [];
    },
    
    /**
     * Seleziona un tutorial specifico
     */
    selectTutorial: function(tutorialIndex) {
        if (tutorialIndex < 0 || tutorialIndex >= this.availableTutorials.length) {
            AppConfig.log(1, `Indice tutorial non valido: ${tutorialIndex}`);
            return;
        }
        
        this.currentTutorial = this.availableTutorials[tutorialIndex];
        this.tutorialSteps = this.currentTutorial.steps;
        this.currentStepIndex = 0;
        
        AppConfig.log(2, `Tutorial selezionato: ${this.currentTutorial.name} (${this.tutorialSteps.length} step)`);
        
        // Aggiorna la UI
        this.updateStepSpeechBubble();
    },
    
    /**
     * Crea i pulsanti della barra tutorial (ora per tutorial principali)
     */
    createTutorialStepsBar: function() {
        const container = document.getElementById('tutorialStepsContainer');
        if (!container) return;
        
        container.innerHTML = '';
        
        // Ora creiamo pulsanti per i tutorial principali, non per gli step individuali
        this.availableTutorials.forEach((tutorial, index) => {
            // Contenitore tutorial
            const tutorialDiv = document.createElement('div');
            tutorialDiv.className = 'tutorial-step';
            
            // Pulsante del tutorial
            const tutorialBtn = document.createElement('div');
            tutorialBtn.className = 'tutorial-arrow-btn';
            tutorialBtn.onclick = () => {
                this.selectTutorial(index);
                this.updateTutorialButtonsState(index);
            };
            
            // Applica classi speciali per forma
            if (this.availableTutorials.length === 1) {
                tutorialBtn.classList.add('single');
            } else {
                if (index === 0) {
                    tutorialBtn.classList.add('first');
                }
                if (index === this.availableTutorials.length - 1) {
                    tutorialBtn.classList.add('last');
                }
            }
            
            // Se è il tutorial attualmente selezionato, evidenzialo
            if (this.currentTutorial && this.currentTutorial.name === tutorial.name) {
                tutorialBtn.classList.add('active');
            }
            
            // Testo del pulsante (nome del tutorial)
            const tutorialText = document.createElement('div');
            tutorialText.className = 'tutorial-arrow-text';
            tutorialText.textContent = tutorial.name;
            
            // Assembla elementi (nessun numero step)
            tutorialBtn.appendChild(tutorialText);
            tutorialDiv.appendChild(tutorialBtn);
            container.appendChild(tutorialDiv);
            
            // Aggiunge separatore se non è l'ultimo
            if (index < this.availableTutorials.length - 1) {
                const separator = document.createElement('div');
                separator.className = 'tutorial-separator';
                container.appendChild(separator);
            }
        });
        
        // Aggiorna il fumetto se già creato
        this.updateStepSpeechBubble();
    },
    
    /**
     * Mostra la barra tutorial
     */
    showTutorialStepsBar: function() {
        const bar = document.getElementById('tutorialStepsBar');
        if (bar) {
            bar.classList.remove('hidden');
        }
    },
    
    /**
     * Nasconde la barra tutorial
     */
    hideTutorialStepsBar: function() {
        const bar = document.getElementById('tutorialStepsBar');
        if (bar) {
            bar.classList.add('hidden');
        }
    },
    
    /**
     * Aggiorna lo stato dei pulsanti tutorial (logica radio button)
     * Solo il pulsante selezionato è attivo (verde), gli altri sono inattivi (azzurro)
     */
    updateTutorialButtonsState: function(activeIndex) {
        // Trova tutti i pulsanti tutorial
        const allButtons = document.querySelectorAll('.tutorial-arrow-btn');
        
        allButtons.forEach((button, index) => {
            // Rimuovi tutti gli stati
            button.classList.remove('active');
            
            // Aggiungi 'active' solo al pulsante selezionato
            if (index === activeIndex) {
                button.classList.add('active');
            }
        });
        
        AppConfig.log(2, `Tutorial ${activeIndex + 1} attivato (comportamento radio button)`);
    },
    
    /**
     * Va a uno step specifico
     */
    goToStep: function(stepIndex) {
        if (stepIndex < 0 || stepIndex >= this.tutorialSteps.length) {
            AppConfig.log(1, `Step index non valido: ${stepIndex}`);
            return;
        }
        
        this.currentStepIndex = stepIndex;
        const step = this.tutorialSteps[stepIndex];
        
        AppConfig.log(2, `Navigazione a step ${stepIndex + 1}: ${step.title}`);
        
        // I pulsanti tutorial mantengono il loro stato radio button
        // Non c'è bisogno di aggiornarli per ogni step
        
        // Esegue l'azione del tutorial step
        this.executeStep(step);
        
        // Aggiorna status
        this.updateStatus(`Step ${stepIndex + 1}/${this.tutorialSteps.length}: ${step.title}`);
    },
    
    /* La funzione updateStepStates è stata rimossa perché ora i pulsanti
     * rappresentano tutorial (non step) e usano logica radio button */
    
    /**
     * Esegue un step del tutorial
     */
    executeStep: function(step) {
        AppConfig.log(2, `Esecuzione step: ${step.title}`, step.properties);
        
        // Qui si possono implementare le azioni specifiche basate sulle proprietà
        // Per ora logga le informazioni dello step
        
        // Esempio di utilizzo delle proprietà:
        if (step.properties.CameraPos && window.Scene3D) {
            // Parsing posizione camera (es: "(15, 10, 20)")
            const pos = step.properties.CameraPos.replace(/[()]/g, '').split(',').map(n => parseFloat(n.trim()));
            if (pos.length === 3) {
                AppConfig.log(3, `Impostazione camera position: ${pos}`);
                // Scene3D.setCameraPosition(pos[0], pos[1], pos[2]);
            }
        }
        
        if (step.properties.CameraTarget && window.Scene3D) {
            const target = step.properties.CameraTarget.replace(/[()]/g, '').split(',').map(n => parseFloat(n.trim()));
            if (target.length === 3) {
                AppConfig.log(3, `Impostazione camera target: ${target}`);
                // Scene3D.setCameraTarget(target[0], target[1], target[2]);
            }
        }
        
        if (step.properties.Utensile) {
            // Attiva lo strumento corrispondente
            const toolName = this.mapToolName(step.properties.Utensile);
            if (toolName) {
                AppConfig.log(3, `Attivazione strumento: ${toolName}`);
                this.toggleTool(toolName);
            }
        }
        
        // Aggiorna il fumetto con la descrizione dello step corrente
        this.updateStepSpeechBubble();
        
        // Evento personalizzabile per altri moduli
        const event = new CustomEvent('tutorialStepChanged', {
            detail: { step, index: this.currentStepIndex, allSteps: this.tutorialSteps }
        });
        document.dispatchEvent(event);
    },
    
    /**
     * Mappa i nomi degli strumenti dal tutorial ai nomi interni
     */
    mapToolName: function(tutorialToolName) {
        const mapping = {
            'ChiaveBrugola': 'brugola',
            'ChiaveInglese': 'chiave_inglese',
            'Mani': 'mano',
            'Martello': 'martello'
        };
        
        return mapping[tutorialToolName] || null;
    },
    
    /* Le funzioni nextStep() e previousStep() sono state rimosse
     * per assicurare che la sequenza sia controllata solo dal sistema
     * tramite click sui modelli 3D e avanzamento automatico */
    
    /* ===== GESTIONE FUMETTO STEP TUTORIAL ===== */
    
    /**
     * Mostra il fumetto per la descrizione step
     */
    showStepSpeechBubble: function() {
        const bubble = document.getElementById('stepSpeechBubble');
        if (bubble) {
            bubble.classList.remove('hidden');
        }
    },
    
    /**
     * Nasconde il fumetto per la descrizione step
     */
    hideStepSpeechBubble: function() {
        const bubble = document.getElementById('stepSpeechBubble');
        if (bubble) {
            bubble.classList.add('hidden');
        }
    },
    
    /**
     * Aggiorna il contenuto del fumetto con lo step corrente
     */
    updateStepSpeechBubble: function() {
        if (!this.tutorialSteps || this.tutorialSteps.length === 0) {
            this.hideStepSpeechBubble();
            return;
        }
        
        const bubble = document.getElementById('stepSpeechBubble');
        const stepCurrentNumber = document.getElementById('stepCurrentNumber');
        const stepTotalNumber = document.getElementById('stepTotalNumber');
        const stepDescription = document.getElementById('stepDescription');
        
        if (!bubble || !stepCurrentNumber || !stepTotalNumber || !stepDescription) {
            return;
        }
        
        // Aggiorna i numeri
        stepCurrentNumber.textContent = this.currentStepIndex + 1;
        stepTotalNumber.textContent = this.tutorialSteps.length;
        
        // Aggiorna la descrizione
        const currentStep = this.tutorialSteps[this.currentStepIndex];
        if (currentStep && currentStep.properties && currentStep.properties.Descrizione) {
            stepDescription.textContent = currentStep.properties.Descrizione;
        } else {
            stepDescription.textContent = `Step ${this.currentStepIndex + 1} - ${currentStep?.name || 'Senza descrizione'}`;
        }
        
        // Mostra il fumetto (sequenza controllata solo dal sistema)
        this.showStepSpeechBubble();
    }
};

/* ===== FUNZIONI GLOBALI PER COMPATIBILITÀ ===== */
// Queste funzioni vengono chiamate dagli onclick nell'HTML

window.goHome = function() {
    if (window.UI) window.UI.goHome();
};

window.executeScenario = function() {
    if (window.UI) window.UI.executeScenario();
};

window.clearAll = function() {
    if (window.UI) window.UI.clearAll();
};

window.resetView = function() {
    if (window.UI) window.UI.resetView();
};

window.startAnimation = function() {
    if (window.UI) window.UI.startAnimation();
};

window.hideError = function() {
    if (window.UI) window.UI.hideError();
};