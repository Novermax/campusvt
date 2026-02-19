/**
 * ScenarioManager.js - Gestione scenari e configurazioni
 *
 * Responsabilità:
 * - Caricamento configurazioni scenari dal server
 * - Parsing e gestione file di configurazione home
 * - Rendering delle card scenari nell'interfaccia
 * - Caricamento scenario selezionato
 * - Applicazione configurazioni camera e luci scenario
 * - Caricamento modelli 3D dello scenario
 *
 * Versione: 2.0 Refactored
 * Data: Dicembre 2025
 */

class ScenarioManager {
    constructor() {
        this.scenariosConfig = null;
        this.currentScenario = null;
        this.homeConfig = null;
        this.isInitialized = false;
    }

    /**
     * Log sicuro che funziona anche se AppConfig non è caricato
     */
    safeLog(level, message, ...args) {
        if (window.AppConfig && AppConfig.log) {
            AppConfig.log(level, message, ...args);
        } else {
            const levelNames = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
            const levelName = levelNames[level] || 'LOG';
            console.log(`[${levelName}] ${message}`, ...args);
        }
    }

    /**
     * Inizializza il sistema scenari
     */
    init() {
        this.safeLog(2, '[ScenarioManager] Inizializzazione...');

        try {
            // Carica automaticamente la configurazione home se disponibile
            this.loadHomeConfigFromServer();

            this.isInitialized = true;
            this.safeLog(2, '[ScenarioManager] Inizializzato con successo');
            return true;

        } catch (error) {
            this.safeLog(0, '[ScenarioManager] Errore inizializzazione:', error);
            return false;
        }
    }

    /**
     * Carica la configurazione home dal server
     */
    loadHomeConfigFromServer() {
        this.safeLog(2, '[ScenarioManager] Caricamento configurazione home dal server...');

        const configUrl = './scenes/home.config';

        fetchFile(configUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return response.text();
            })
            .then(content => {
                this.safeLog(2, '[ScenarioManager] File home.config caricato con successo');
                this.parseHomeConfig(content);
            })
            .catch(error => {
                this.safeLog(1, '[ScenarioManager] Impossibile caricare home.config dal server:', error);
                this.safeLog(2, '[ScenarioManager] Modalità manuale attivata automaticamente');

                // Crea configurazione di fallback per modalità manuale
                this.scenariosConfig = {
                    scenarios: [],
                    manualMode: true
                };
                this.renderScenarioCards();
            });
    }

    /**
     * Parsing del file home.config
     */
    parseHomeConfig(content) {
        this.safeLog(3, '[ScenarioManager] Parsing configurazione home...');

        try {
            const scenarios = [];
            const lines = content.split('\n');
            let currentScenario = null;

            for (let line of lines) {
                line = line.trim();

                // Skip linee vuote e commenti
                if (!line || line.startsWith('#') || line.startsWith('//')) {
                    continue;
                }

                // Riconoscimento sezioni scenario
                if (line.startsWith('[') && line.endsWith(']')) {
                    // Salva scenario precedente se esisteva
                    if (currentScenario) {
                        scenarios.push(currentScenario);
                    }

                    // Crea nuovo scenario
                    const scenarioName = line.slice(1, -1);
                    currentScenario = {
                        name: scenarioName,
                        files: [],
                        path: `./scenes/${scenarioName}/`
                    };
                    continue;
                }

                // Parsing proprietà scenario
                if (currentScenario && line.includes('=')) {
                    const [key, value] = line.split('=', 2);
                    const cleanKey = key.trim();
                    const cleanValue = value.trim();

                    switch (cleanKey) {
                        case 'files':
                            currentScenario.files = cleanValue.split(',').map(f => f.trim());
                            break;
                        case 'tutorial':
                            currentScenario.tutorial = cleanValue;
                            break;
                        case 'cameraPos':
                            currentScenario.cameraPos = cleanValue;
                            break;
                        case 'cameraTarget':
                            currentScenario.cameraTarget = cleanValue;
                            break;
                        case 'ambientLight':
                            currentScenario.ambientLight = cleanValue;
                            break;
                        case 'directionalLight':
                            currentScenario.directionalLight = cleanValue;
                            break;
                        case 'backLight':
                            currentScenario.backLight = cleanValue;
                            break;
                        default:
                            // Proprietà generica
                            currentScenario[cleanKey] = cleanValue;
                    }
                }
            }

            // Aggiungi ultimo scenario
            if (currentScenario) {
                scenarios.push(currentScenario);
            }

            // Salva configurazione
            this.scenariosConfig = { scenarios };
            this.homeConfig = content;

            this.safeLog(2, `[ScenarioManager] Configurazione parsata: ${scenarios.length} scenari trovati`);
            scenarios.forEach((scenario, index) => {
                this.safeLog(3, `  ${index + 1}. ${scenario.name} (${scenario.files ? scenario.files.length : 0} files)`);
            });

            // Renderizza le card scenari
            this.renderScenarioCards();

        } catch (error) {
            this.safeLog(0, '[ScenarioManager] Errore parsing home.config:', error);
            // Fallback a modalità manuale
            this.scenariosConfig = { scenarios: [], manualMode: true };
            this.renderScenarioCards();
        }
    }

    /**
     * Renderizza le card degli scenari nella UI
     */
    renderScenarioCards() {
        const scenariosList = document.getElementById('scenariosList');
        if (!scenariosList) {
            this.safeLog(1, '[ScenarioManager] Elemento scenariosList non trovato');
            return;
        }

        // Pulisci contenuto esistente
        scenariosList.innerHTML = '';

        // Crea card per ogni scenario
        if (this.scenariosConfig && this.scenariosConfig.scenarios) {
            this.scenariosConfig.scenarios.forEach((scenario, index) => {
                const card = this.createScenarioCard(scenario, index);
                scenariosList.appendChild(card);
            });
        }

        // Aggiungi sempre la card modalità manuale
        const manualCard = this.createManualModeCard();
        scenariosList.appendChild(manualCard);

        // Setup event listeners per le card
        this.setupScenarioCardListeners();

        this.safeLog(3, '[ScenarioManager] Card scenari renderizzate');
    }

    /**
     * Crea una card scenario
     */
    createScenarioCard(scenario, index) {
        const card = document.createElement('div');
        card.className = 'scenario-card';
        card.setAttribute('data-scenario-index', index);
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `Carica scenario ${scenario.name}`);

        const filesCount = scenario.files ? scenario.files.length : 0;
        const hasTutorial = scenario.tutorial ? '🎓' : '';

        card.innerHTML = `
            <h3>${scenario.name} ${hasTutorial}</h3>
            <p>📁 ${filesCount} file${filesCount !== 1 ? 's' : ''}</p>
            <p class="scenario-path">${scenario.path}</p>
        `;

        return card;
    }

    /**
     * Crea la card modalità manuale
     */
    createManualModeCard() {
        const card = document.createElement('div');
        card.className = 'scenario-card manual-mode-card';
        card.setAttribute('data-manual-mode', 'true');
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', 'Modalità manuale');

        card.innerHTML = `
            <h3>⚙️ Modalità Manuale</h3>
            <p>Carica modelli e animazioni personalizzati</p>
            <p class="scenario-manual">Usa i controlli file per caricare contenuti</p>
        `;

        return card;
    }

    /**
     * Setup event listeners per le card scenario
     */
    setupScenarioCardListeners() {
        const scenariosList = document.getElementById('scenariosList');
        if (!scenariosList) return;

        // Click sulle card scenario
        scenariosList.addEventListener('click', this.onScenarioCardClick.bind(this));

        // Gestione navigazione da tastiera (già gestita da UICore)
        this.safeLog(3, '[ScenarioManager] Event listeners card configurati');
    }

    /**
     * Gestisce il click su una card scenario
     */
    onScenarioCardClick(event) {
        const card = event.target.closest('.scenario-card');
        if (!card) return;

        // Modalità manuale
        if (card.hasAttribute('data-manual-mode')) {
            this.safeLog(2, '[ScenarioManager] Modalità manuale selezionata');

            // Vai alla pagina scenario senza caricare contenuti automatici
            if (window.UI && window.UI.core) {
                window.UI.core.showPage('scenario');
                window.UI.core.updateStatus('Modalità manuale - Usa i controlli per caricare file');
            }
            return;
        }

        // Scenario specifico
        const scenarioIndex = parseInt(card.getAttribute('data-scenario-index'));
        if (isNaN(scenarioIndex) || !this.scenariosConfig || !this.scenariosConfig.scenarios[scenarioIndex]) {
            this.safeLog(1, '[ScenarioManager] Indice scenario non valido');
            return;
        }

        const scenario = this.scenariosConfig.scenarios[scenarioIndex];
        this.safeLog(2, `[ScenarioManager] Scenario selezionato: ${scenario.name}`);

        this.loadScenario(scenario);
    }

    /**
     * Carica uno scenario specifico
     */
    loadScenario(scenario) {
        this.currentScenario = scenario;

        // Aggiorna titolo scenario
        const scenarioTitle = document.getElementById('scenarioTitle');
        if (scenarioTitle) {
            scenarioTitle.textContent = scenario.name;
        }

        // Passa alla pagina scenario
        if (window.UI && window.UI.core) {
            window.UI.core.showPage('scenario');
            window.UI.core.updateStatus(`Caricamento scenario: ${scenario.name}`);
        }

        // Applica le configurazioni camera e luci dello scenario
        this.applyScenarioConfiguration(scenario);

        // Carica automaticamente tutti i modelli dello scenario
        this.loadScenarioModels(scenario);

        // Carica il tutorial se specificato
        if (scenario.tutorial) {
            this.safeLog(2, `[ScenarioManager] 🎓 Caricamento tutorial: ${scenario.tutorial}`);
            if (window.UI && window.UI.tutorialManager) {
                window.UI.tutorialManager.loadTutorial(scenario.tutorial);
            }
        } else {
            this.safeLog(2, `[ScenarioManager] ❌ Nessun tutorial per scenario: ${scenario.name}`);
            // Nasconde la barra tutorial se non c'è tutorial
            if (window.UI && window.UI.core) {
                window.UI.core.hideTutorialStepsBar();
            }
        }

        this.safeLog(2, `[ScenarioManager] ✅ Scenario caricato: ${scenario.name}`);
    }

    /**
     * Applica le configurazioni di camera e luci specifiche dello scenario
     */
    applyScenarioConfiguration(scenario) {
        if (!window.Scene3D) {
            this.safeLog(1, '[ScenarioManager] ⚠️ Scene3D non disponibile per configurazione scenario');
            // Ritenta dopo un delay
            setTimeout(() => {
                this.applyScenarioConfiguration(scenario);
            }, 500);
            return;
        }

        this.safeLog(2, `[ScenarioManager] 🎭 Applicazione configurazione: ${scenario.name}`);

        // Applica posizione camera se specificata
        if (scenario.cameraPos) {
            const pos = this.parseVector3(scenario.cameraPos);
            if (pos) {
                window.Scene3D.camera.position.set(pos.x, pos.y, pos.z);
                // Imposta flag per disabilitare auto-fitting
                window.Scene3D.manualCameraSet = true;
                this.safeLog(2, `[ScenarioManager] 📷 Camera position: (${pos.x}, ${pos.y}, ${pos.z})`);
            }
        }

        // Applica target camera se specificato
        if (scenario.cameraTarget) {
            const target = this.parseVector3(scenario.cameraTarget);
            if (target) {
                window.Scene3D.camera.lookAt(target.x, target.y, target.z);
                this.safeLog(2, `[ScenarioManager] 🎯 Camera target: (${target.x}, ${target.y}, ${target.z})`);
            }
        }

        // Applica configurazioni luci
        setTimeout(() => {
            this.applyScenarioLights(scenario);
        }, 100);

        this.safeLog(2, `[ScenarioManager] ✅ Configurazione applicata: ${scenario.name}`);
    }

    /**
     * Applica le configurazioni delle luci dello scenario
     */
    applyScenarioLights(scenario) {
        if (!window.Scene3D || !window.Scene3D.scene) {
            this.safeLog(1, '[ScenarioManager] ⚠️ Scene3D non disponibile per luci');
            return;
        }

        if (!window.THREE) {
            this.safeLog(1, '[ScenarioManager] ⚠️ THREE.js non disponibile per luci');
            return;
        }

        this.safeLog(2, '[ScenarioManager] 🔄 Applicazione luci scenario...');

        // Rimuovi le luci esistenti
        const lightsToRemove = [];
        window.Scene3D.scene.traverse(function(child) {
            if (child.isLight) {
                lightsToRemove.push(child);
            }
        });
        lightsToRemove.forEach(light => window.Scene3D.scene.remove(light));
        this.safeLog(2, `[ScenarioManager] 🗑️ Rimosse ${lightsToRemove.length} luci esistenti`);

        // Aggiungi luce ambientale se specificata
        if (scenario.ambientLight) {
            const ambient = this.parseLightConfig(scenario.ambientLight);
            if (ambient) {
                try {
                    const ambientLight = new THREE.AmbientLight(ambient.color, ambient.intensity);
                    window.Scene3D.scene.add(ambientLight);
                    this.safeLog(2, `[ScenarioManager] 💡 Luce ambientale: colore=${ambient.color.toString(16)}, intensità=${ambient.intensity}`);
                } catch (error) {
                    this.safeLog(1, '[ScenarioManager] ❌ Errore luce ambientale:', error);
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
                    this.safeLog(2, `[ScenarioManager] 🔆 Luce direzionale: pos=(${directional.position.x}, ${directional.position.y}, ${directional.position.z})`);
                } catch (error) {
                    this.safeLog(1, '[ScenarioManager] ❌ Errore luce direzionale:', error);
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
                    this.safeLog(2, `[ScenarioManager] 🔅 Luce posteriore: pos=(${back.position.x}, ${back.position.y}, ${back.position.z})`);
                } catch (error) {
                    this.safeLog(1, '[ScenarioManager] ❌ Errore luce posteriore:', error);
                }
            }
        }
    }

    /**
     * Carica i modelli 3D dello scenario
     */
    loadScenarioModels(scenario) {
        this.safeLog(2, `[ScenarioManager] 🔄 Caricamento modelli per: ${scenario.name}`);

        if (!scenario.files || scenario.files.length === 0) {
            this.safeLog(1, '[ScenarioManager] Nessun file specificato per lo scenario');
            if (window.UI && window.UI.core) {
                window.UI.core.updateStatus('Scenario caricato - Nessun modello');
            }
            return;
        }

        // Costruisci URL completi per i modelli
        const modelUrls = scenario.files.map(file => {
            // Se il file non ha un path assoluto, usa il path dello scenario
            if (!file.startsWith('http') && !file.startsWith('./') && !file.startsWith('/')) {
                return scenario.path + file;
            }
            return file;
        });

        this.safeLog(3, `[ScenarioManager] URL modelli:`, modelUrls);

        // Delega il caricamento al ModelLoader
        if (window.ModelLoader) {
            window.ModelLoader.loadModelsFromUrls(modelUrls);
        } else {
            this.safeLog(1, '[ScenarioManager] ⚠️ ModelLoader non disponibile');
        }
    }

    /**
     * Reset dello scenario corrente
     */
    resetCurrentScenario() {
        this.currentScenario = null;
        this.safeLog(3, '[ScenarioManager] Scenario corrente resettato');
    }

    /**
     * Utility: Parser Vector3 da stringa
     */
    parseVector3(vectorString) {
        try {
            // Formato: (x,y,z)
            const match = vectorString.match(/\(([^)]+)\)/);
            if (match) {
                const coords = match[1].split(',').map(s => parseFloat(s.trim()));
                if (coords.length === 3 && coords.every(c => !isNaN(c))) {
                    return { x: coords[0], y: coords[1], z: coords[2] };
                }
            }
        } catch (error) {
            this.safeLog(1, '[ScenarioManager] Errore parsing Vector3:', error);
        }
        return null;
    }

    /**
     * Utility: Parser configurazione luce
     */
    parseLightConfig(lightString) {
        try {
            // Formato: color=0xffffff,intensity=1.0
            const config = {};
            const pairs = lightString.split(',');

            for (const pair of pairs) {
                const [key, value] = pair.split('=').map(s => s.trim());
                if (key === 'color') {
                    config.color = parseInt(value, 16);
                } else if (key === 'intensity') {
                    config.intensity = parseFloat(value);
                }
            }

            return config.color !== undefined && config.intensity !== undefined ? config : null;
        } catch (error) {
            this.safeLog(1, '[ScenarioManager] Errore parsing light config:', error);
            return null;
        }
    }

    /**
     * Utility: Parser configurazione luce direzionale
     */
    parseDirectionalLightConfig(lightString) {
        try {
            // Formato: color=0xffffff,intensity=1.0,position=(x,y,z)
            const config = {};
            const pairs = lightString.split(',');

            for (const pair of pairs) {
                const [key, value] = pair.split('=').map(s => s.trim());
                if (key === 'color') {
                    config.color = parseInt(value, 16);
                } else if (key === 'intensity') {
                    config.intensity = parseFloat(value);
                } else if (key === 'position') {
                    config.position = this.parseVector3(value);
                }
            }

            return config.color !== undefined && config.intensity !== undefined && config.position ? config : null;
        } catch (error) {
            this.safeLog(1, '[ScenarioManager] Errore parsing directional light config:', error);
            return null;
        }
    }

    /**
     * Ottiene stato corrente
     */
    getState() {
        return {
            isInitialized: this.isInitialized,
            currentScenario: this.currentScenario ? this.currentScenario.name : null,
            scenariosCount: this.scenariosConfig ? this.scenariosConfig.scenarios.length : 0,
            homeConfigLoaded: !!this.homeConfig
        };
    }

    /**
     * Cleanup risorse
     */
    dispose() {
        this.scenariosConfig = null;
        this.currentScenario = null;
        this.homeConfig = null;
        this.isInitialized = false;

        this.safeLog(2, '[ScenarioManager] Cleanup completato');
    }
}

// Export per uso come modulo
window.ScenarioManager = ScenarioManager;
console.log('[ScenarioManager] ✅ Modulo caricato e disponibile su window.ScenarioManager');