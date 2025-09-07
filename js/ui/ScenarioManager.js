/**
 * ScenarioManager.js - Gestione scenari e configurazioni
 * 
 * Responsabilità:
 * - Caricamento configurazioni scenari
 * - Parsing file home_config.txt
 * - Rendering card scenari
 * - Gestione configurazioni camera e luci
 * - Applicazione impostazioni scenario
 */

window.ScenarioManager = {
    
    // Configurazioni scenari
    scenariosConfig: null,
    currentScenario: null,
    
    // Riferimenti ai moduli
    feedbackManager: null,
    pageManager: null,
    
    /**
     * Inizializzazione ScenarioManager
     */
    init: function(feedbackManager, pageManager) {
        this.feedbackManager = feedbackManager;
        this.pageManager = pageManager;
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Carica automaticamente la configurazione home se disponibile
        this.loadHomeConfigFromServer();
        
        console.log('[ScenarioManager] Inizializzato');
    },
    
    /**
     * Setup event listeners
     */
    setupEventListeners: function() {
        // Ascolta eventi di selezione scenario
        document.addEventListener('scenarioSelected', this.onScenarioSelected.bind(this));
        
        // Ascolta cambi pagina per cleanup
        document.addEventListener('pageChanged', this.onPageChanged.bind(this));
    },
    
    /**
     * Carica automaticamente il file home_config.txt dal server
     */
    loadHomeConfigFromServer: function() {
        console.log('[ScenarioManager] Tentativo caricamento home_config.txt dal server...');
        
        if (this.feedbackManager) {
            this.feedbackManager.updateStatus('Caricamento configurazione...');
        }
        
        fetch(`./home_config.txt?v=${Date.now()}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return response.text();
            })
            .then(content => {
                console.log('[ScenarioManager] home_config.txt caricato con successo dal server');
                this.parseHomeConfig(content);
                if (this.feedbackManager) {
                    this.feedbackManager.updateStatus('Configurazione caricata automaticamente');
                }
            })
            .catch(error => {
                console.warn('[ScenarioManager] Impossibile caricare home_config.txt dal server:', error.message);
                if (this.feedbackManager) {
                    this.feedbackManager.updateStatus('Nessuna configurazione - usa caricamento manuale');
                }
            });
    },
    
    /**
     * Analizza il file di configurazione home e genera le card scenari
     */
    parseHomeConfig: function(content) {
        const lines = content.split('\\n');
        const scenarios = [];
        let currentScenario = null;
        
        lines.forEach(line => {
            line = line.trim();
            if (!line || line.startsWith('#') || line.startsWith('//')) return;
            
            // Rimuovi commenti inline
            const commentIndex = line.indexOf('//');
            if (commentIndex !== -1) {
                line = line.substring(0, commentIndex).trim();
                if (!line) return;
            }
            
            if (line.startsWith('[') && line.endsWith(']')) {
                // Salva scenario precedente
                if (currentScenario) {
                    scenarios.push(currentScenario);
                }
                
                // Nuovo scenario
                const scenarioName = line.slice(1, -1);
                currentScenario = {
                    name: scenarioName,
                    description: '',
                    image: '',
                    files: [],
                    positions: []
                };
                
                console.log(`[ScenarioManager] 📋 Scenario trovato: ${scenarioName}`);
                
            } else if (currentScenario) {
                this.parseScenarioProperty(currentScenario, line);
            }
        });
        
        // Aggiungi ultimo scenario
        if (currentScenario) {
            this.debugScenarioDirections(currentScenario);
            scenarios.push(currentScenario);
        }
        
        this.scenariosConfig = scenarios;
        this.renderScenarioCards();
        
        console.log(`[ScenarioManager] Configurazione home caricata: ${scenarios.length} scenari`);
    },
    
    /**
     * Parsa una proprietà dello scenario
     */
    parseScenarioProperty: function(scenario, line) {
        if (line.startsWith('description=')) {
            scenario.description = line.substring(12);
            console.log(`[ScenarioManager]   📝 Descrizione: ${scenario.description}`);
            
        } else if (line.startsWith('image=')) {
            scenario.image = line.substring(6);
            console.log(`[ScenarioManager]   🖼️ Immagine: ${scenario.image}`);
            
        } else if (line.startsWith('tutorial=')) {
            scenario.tutorial = line.substring(9);
            console.log(`[ScenarioManager]   📚 Tutorial: ${scenario.tutorial}`);
            
        } else if (line.startsWith('CameraPos=')) {
            scenario.cameraPos = line.substring(10);
            console.log(`[ScenarioManager]   📷 Camera Position: ${scenario.cameraPos}`);
            
        } else if (line.startsWith('CameraTarget=')) {
            scenario.cameraTarget = line.substring(13);
            console.log(`[ScenarioManager]   🎯 Camera Target: ${scenario.cameraTarget}`);
            
        } else if (line.startsWith('AmbientLight=')) {
            scenario.ambientLight = line.substring(13);
            console.log(`[ScenarioManager]   💡 Ambient Light: ${scenario.ambientLight}`);
            
        } else if (line.startsWith('DirectionalLight=')) {
            scenario.directionalLight = line.substring(17);
            console.log(`[ScenarioManager]   🔆 Directional Light: ${scenario.directionalLight}`);
            
        } else if (line.startsWith('BackLight=')) {
            scenario.backLight = line.substring(10);
            console.log(`[ScenarioManager]   🔅 Back Light: ${scenario.backLight}`);
            
        } else if (line.startsWith('position=')) {
            this.parsePosition(scenario, line);
            
        } else if (line.includes('=')) {
            this.parseFileOrDirection(scenario, line);
        }
    },
    
    /**
     * Parsa posizione modello
     */
    parsePosition: function(scenario, line) {
        const positionStr = line.substring(9);
        const coords = positionStr.split(',').map(n => parseFloat(n.trim()));
        if (coords.length === 3) {
            scenario.positions.push({ x: coords[0], y: coords[1], z: coords[2] });
            console.log(`[ScenarioManager]   📍 Posizione: (${coords[0]}, ${coords[1]}, ${coords[2]})`);
        } else {
            console.warn(`[ScenarioManager]   ❌ Posizione non valida: ${positionStr}`);
        }
    },
    
    /**
     * Parsa file da caricare o direzione
     */
    parseFileOrDirection: function(scenario, line) {
        const [label, path] = line.split('=', 2).map(s => s.trim());
        
        if (label === 'direzione') {
            // Parsing direzione per l'ultimo file aggiunto
            const coords = path.split(',').map(n => parseFloat(n.trim()));
            if (coords.length === 3 && scenario.files.length > 0) {
                const lastFileIndex = scenario.files.length - 1;
                const direction = { x: coords[0], y: coords[1], z: coords[2] };
                scenario.files[lastFileIndex].direction = direction;
                console.log(`[ScenarioManager]   🧭 Direzione: (${coords[0]}, ${coords[1]}, ${coords[2]}) per ${scenario.files[lastFileIndex].path}`);
            } else {
                console.warn(`[ScenarioManager]   ❌ Direzione non valida o nessun file precedente: ${path}`);
            }
        } else {
            // File da caricare
            scenario.files.push({ label, path, direction: null });
            console.log(`[ScenarioManager]   📁 File: ${label} -> ${path}`);
        }
    },
    
    /**
     * Debug direzioni scenario
     */
    debugScenarioDirections: function(scenario) {
        console.log(`[ScenarioManager] 🧭 RIEPILOGO DIREZIONI per scenario "${scenario.name}":`);
        scenario.files.forEach((file, index) => {
            console.log(`[ScenarioManager]   ${index}: ${file.path} -> direzione:`, file.direction);
        });
    },
    
    /**
     * Renderizza le card degli scenari nella home page
     */
    renderScenarioCards: function() {
        const scenariosList = document.getElementById('scenariosList');
        if (!scenariosList || !this.scenariosConfig) return;
        
        // Pulisci lista esistente
        scenariosList.innerHTML = '';
        
        // Crea card per ogni scenario
        this.scenariosConfig.forEach((scenario, index) => {
            const card = this.createScenarioCard(scenario, index);
            scenariosList.appendChild(card);
        });
        
        // Aggiungi sempre la card "Modalità Manuale" alla fine
        const manualCard = this.createManualModeCard();
        scenariosList.appendChild(manualCard);
        
        console.log(`[ScenarioManager] Renderizzate ${this.scenariosConfig.length} card scenario + modalità manuale`);
    },
    
    /**
     * Crea una singola card scenario
     */
    createScenarioCard: function(scenario, index) {
        const card = document.createElement('div');
        card.className = 'scenario-card';
        card.dataset.scenarioIndex = index;
        
        // Sezione immagine
        const imageSection = this.createImageSection(scenario);
        
        // Sezione info
        const infoSection = this.createInfoSection(scenario);
        
        // Assembla card
        card.appendChild(imageSection);
        card.appendChild(infoSection);
        
        return card;
    },
    
    /**
     * Crea sezione immagine della card
     */
    createImageSection: function(scenario) {
        const imageSection = document.createElement('div');
        imageSection.className = 'scenario-image';
        
        if (scenario.image) {
            const img = document.createElement('img');
            img.src = scenario.image;
            img.alt = scenario.name;
            img.onerror = () => {
                imageSection.innerHTML = '<div class="placeholder-image">🎯</div>';
            };
            imageSection.appendChild(img);
        } else {
            imageSection.innerHTML = '<div class="placeholder-image">🎯</div>';
        }
        
        return imageSection;
    },
    
    /**
     * Crea sezione info della card
     */
    createInfoSection: function(scenario) {
        const infoSection = document.createElement('div');
        infoSection.className = 'scenario-info';
        
        const title = document.createElement('h3');
        title.textContent = scenario.name;
        
        const description = document.createElement('p');
        description.textContent = scenario.description || 'Nessuna descrizione disponibile';
        
        infoSection.appendChild(title);
        infoSection.appendChild(description);
        
        return infoSection;
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
     * Gestisce selezione scenario
     */
    onScenarioSelected: function(event) {
        const scenarioIndex = event.detail.scenarioIndex;
        
        if (scenarioIndex < 0 || scenarioIndex >= this.scenariosConfig.length) {
            console.error('[ScenarioManager] Indice scenario non valido:', scenarioIndex);
            if (this.feedbackManager) {
                this.feedbackManager.showError('Scenario non trovato');
            }
            return;
        }
        
        const scenario = this.scenariosConfig[scenarioIndex];
        console.log(`[ScenarioManager] Scenario selezionato: ${scenario.name}`);
        
        this.loadScenario(scenario);
    },
    
    /**
     * Carica uno scenario specifico
     */
    loadScenario: function(scenario) {
        this.currentScenario = scenario;
        
        // Aggiorna titolo scenario
        if (this.pageManager) {
            this.pageManager.updateScenarioTitle(scenario.name);
        }
        
        // Aggiorna status
        if (this.feedbackManager) {
            this.feedbackManager.updateStatus(`Caricamento scenario: ${scenario.name}`);
        }
        
        // Applica le configurazioni camera e luci dello scenario
        this.applyScenarioConfiguration(scenario);
        
        // Dispatch evento per altri moduli
        this.dispatchScenarioChangedEvent(scenario);
        
        console.log(`[ScenarioManager] Scenario ${scenario.name} caricato`);
    },
    
    /**
     * Applica le configurazioni di camera e luci specifiche dello scenario
     */
    applyScenarioConfiguration: function(scenario) {
        if (!window.Scene3D) {
            console.warn('[ScenarioManager] ⚠️ Scene3D non disponibile per configurazione scenario');
            setTimeout(() => {
                this.applyScenarioConfiguration(scenario);
            }, 500);
            return;
        }
        
        console.log(`[ScenarioManager] 🎭 Applicazione configurazione per scenario: ${scenario.name}`);
        
        // Applica posizione camera se specificata
        if (scenario.cameraPos) {
            const pos = this.parseVector3(scenario.cameraPos);
            if (pos) {
                window.Scene3D.camera.position.set(pos.x, pos.y, pos.z);
                window.Scene3D.manualCameraSet = true;
                console.log(`[ScenarioManager] 📷 Camera position applicata: (${pos.x}, ${pos.y}, ${pos.z}) - Auto-fitting disabilitato`);
            }
        }
        
        // Applica target camera se specificato
        if (scenario.cameraTarget) {
            const target = this.parseVector3(scenario.cameraTarget);
            if (target) {
                window.Scene3D.camera.lookAt(target.x, target.y, target.z);
                console.log(`[ScenarioManager] 🎯 Camera target applicato: (${target.x}, ${target.y}, ${target.z})`);
            }
        }
        
        // Applica configurazioni luci dopo un breve delay
        setTimeout(() => {
            this.applyScenarioLights(scenario);
        }, 100);
        
        console.log(`[ScenarioManager] ✅ Configurazione scenario applicata per: ${scenario.name}`);
    },
    
    /**
     * Applica le configurazioni delle luci dello scenario
     */
    applyScenarioLights: function(scenario) {
        if (!window.Scene3D || !window.Scene3D.scene || !window.THREE) {
            console.warn('[ScenarioManager] ⚠️ Scene3D o THREE.js non disponibile per applicazione luci');
            return;
        }
        
        console.log('[ScenarioManager] 🔄 Rimozione luci esistenti...');
        
        // Rimuovi le luci esistenti
        const lightsToRemove = [];
        window.Scene3D.scene.traverse(function(child) {
            if (child.isLight) {
                lightsToRemove.push(child);
            }
        });
        lightsToRemove.forEach(light => window.Scene3D.scene.remove(light));
        console.log(`[ScenarioManager] 🗑️ Rimosse ${lightsToRemove.length} luci esistenti`);
        
        // Applica nuove luci
        this.applyAmbientLight(scenario);
        this.applyDirectionalLight(scenario);
        this.applyBackLight(scenario);
        
        // Forza il re-rendering
        if (window.Scene3D.renderer) {
            window.Scene3D.renderer.render(window.Scene3D.scene, window.Scene3D.camera);
        }
        
        console.log('[ScenarioManager] ✅ Applicazione luci scenario completata');
    },
    
    /**
     * Applica luce ambientale
     */
    applyAmbientLight: function(scenario) {
        if (!scenario.ambientLight) return;
        
        const ambient = this.parseLightConfig(scenario.ambientLight);
        if (ambient) {
            try {
                const ambientLight = new THREE.AmbientLight(ambient.color, ambient.intensity);
                window.Scene3D.scene.add(ambientLight);
                console.log(`[ScenarioManager] 💡 Luce ambientale applicata: colore=${ambient.color.toString(16)}, intensità=${ambient.intensity}`);
            } catch (error) {
                console.error('[ScenarioManager] ❌ Errore creazione luce ambientale:', error);
            }
        }
    },
    
    /**
     * Applica luce direzionale
     */
    applyDirectionalLight: function(scenario) {
        if (!scenario.directionalLight) return;
        
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
                console.log(`[ScenarioManager] 🔆 Luce direzionale applicata: pos=(${directional.position.x}, ${directional.position.y}, ${directional.position.z}), intensità=${directional.intensity}`);
            } catch (error) {
                console.error('[ScenarioManager] ❌ Errore creazione luce direzionale:', error);
            }
        }
    },
    
    /**
     * Applica luce posteriore
     */
    applyBackLight: function(scenario) {
        if (!scenario.backLight) return;
        
        const back = this.parseDirectionalLightConfig(scenario.backLight);
        if (back) {
            try {
                const backLight = new THREE.DirectionalLight(back.color, back.intensity);
                backLight.position.set(back.position.x, back.position.y, back.position.z);
                backLight.castShadow = false;
                window.Scene3D.scene.add(backLight);
                console.log(`[ScenarioManager] 🔅 Luce posteriore applicata: pos=(${back.position.x}, ${back.position.y}, ${back.position.z}), intensità=${back.intensity}`);
            } catch (error) {
                console.error('[ScenarioManager] ❌ Errore creazione luce posteriore:', error);
            }
        }
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
            console.warn(`[ScenarioManager] ⚠️ Errore parsing vector3: ${vectorString}`, error);
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
            console.warn(`[ScenarioManager] ⚠️ Errore parsing light config: ${lightString}`, error);
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
            console.warn(`[ScenarioManager] ⚠️ Errore parsing directional light config: ${lightString}`, error);
        }
        return null;
    },
    
    /**
     * Gestisce cambi pagina
     */
    onPageChanged: function(event) {
        if (event.detail.newPage === 'home') {
            // Reset scenario corrente quando si torna alla home
            this.currentScenario = null;
            console.log('[ScenarioManager] Scenario corrente resettato per ritorno home');
        }
    },
    
    /**
     * Dispatch evento cambio scenario
     */
    dispatchScenarioChangedEvent: function(scenario) {
        const event = new CustomEvent('scenarioChanged', {
            detail: { scenario: scenario }
        });
        document.dispatchEvent(event);
    },
    
    /**
     * Ottiene lo scenario corrente
     */
    getCurrentScenario: function() {
        return this.currentScenario;
    },
    
    /**
     * Ottiene tutti gli scenari configurati
     */
    getAllScenarios: function() {
        return this.scenariosConfig || [];
    },
    
    /**
     * Cleanup del modulo
     */
    cleanup: function() {
        console.log('[ScenarioManager] Cleanup...');
        
        // Reset stato
        this.scenariosConfig = null;
        this.currentScenario = null;
        this.feedbackManager = null;
        this.pageManager = null;
        
        console.log('[ScenarioManager] Cleanup completato');
    }
};