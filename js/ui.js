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
        
        fetch('./home_config.txt')
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
            if (!line || line.startsWith('#')) return; // Ignora commenti e righe vuote
            
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
                    // File da caricare (formato: label=path)
                    const [label, path] = line.split('=', 2);
                    currentScenario.files.push({ label, path });
                    AppConfig.log(3, `  📁 File: ${label} -> ${path}`);
                }
            }
        });
        
        // Aggiungi ultimo scenario
        if (currentScenario) {
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
        
        // Carica automaticamente tutti i modelli OBJ/MTL dello scenario
        this.loadScenarioModels(scenario);
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
        
        // Aggiungi modelli alla scena con posizioni configurate
        models.forEach((model, index) => {
            if (window.Scene3D) {
                // Applica posizione se configurata
                if (this.currentScenario && this.currentScenario.positions && this.currentScenario.positions[index]) {
                    const pos = this.currentScenario.positions[index];
                    model.position.set(pos.x, pos.y, pos.z);
                    console.log(`📍 Applicata posizione configurata al modello ${index + 1}: (${pos.x}, ${pos.y}, ${pos.z})`);
                }
                window.Scene3D.addModel(model);
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
            touchControls.classList.add('hidden');
        }
        
        document.body.classList.remove('mobile-controls-hidden');
    },
    
    /**
     * Gestisce il cambio di orientamento dello schermo mobile
     */
    onOrientationChange: function() {
        // Piccolo ritardo per permettere al browser di completare la rotazione
        setTimeout(() => {
            console.log('📱 Orientamento cambiato, riapplicando controlli mobile...');
            this.handleMobileControlsRefresh();
        }, 300);
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
            }
            document.body.classList.add('mobile-controls-hidden');
            console.log('📱 Controlli mobile riattivati dopo orientamento');
            
        } else {
            // Modalità desktop: mostra tutto, nascondi controlli touch
            if (toggleBtn) {
                toggleBtn.classList.add('hidden');
            }
            if (touchControls) {
                touchControls.classList.add('hidden');
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