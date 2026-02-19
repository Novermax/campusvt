/**
 * ModelManager.js - Gestione modelli 3D e progress
 * 
 * Responsabilità:
 * - Caricamento modelli 3D automatico da scenari
 * - Caricamento modelli manuale da file input
 * - Progress bar caricamento con feedback dettagliato
 * - Gestione controlli visibilità modelli multipli
 * - Integrazione con ModelLoader e Scene3D
 */

window.ModelManager = {
    
    // Riferimenti ai moduli
    feedbackManager: null,
    
    // Stato caricamento
    isLoading: false,
    currentScenario: null,
    
    // Cache elementi DOM
    elements: {},
    
    /**
     * Inizializzazione ModelManager
     */
    init: function(feedbackManager) {
        this.feedbackManager = feedbackManager;
        
        // Cache elementi DOM
        this.cacheElements();
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('[ModelManager] Inizializzato');
    },
    
    /**
     * Cache elementi DOM
     */
    cacheElements: function() {
        this.elements.fileInput = document.getElementById('fileInput');
        this.elements.animationInput = document.getElementById('animationInput');
        this.elements.modelsVisibilityPanel = document.getElementById('modelsVisibilityPanel');
        
        console.log('[ModelManager] Elementi DOM cachati');
    },
    
    /**
     * Setup event listeners
     */
    setupEventListeners: function() {
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
        
        // Ascolta eventi scenario per caricamento automatico
        document.addEventListener('scenarioChanged', this.onScenarioChanged.bind(this));
        
        console.log('[ModelManager] Event listeners configurati');
    },
    
    /**
     * Gestisce cambio scenario per caricamento automatico
     */
    onScenarioChanged: function(event) {
        const scenario = event.detail.scenario;
        this.currentScenario = scenario;
        
        console.log(`[ModelManager] Scenario cambiato: ${scenario.name}`);
        
        // Carica automaticamente tutti i modelli dello scenario
        this.loadScenarioModels(scenario);
    },
    
    /**
     * Carica automaticamente tutti i modelli OBJ/MTL di uno scenario
     */
    loadScenarioModels: function(scenario) {
        console.log('[ModelManager] 🔄 loadScenarioModels chiamata per:', scenario.name);
        console.log('[ModelManager] 🔄 Files nello scenario:', scenario.files);
        
        if (!scenario.files || scenario.files.length === 0) {
            console.log('[ModelManager] ❌ Nessun file nello scenario');
            if (this.feedbackManager) {
                this.feedbackManager.updateStatus(`Scenario ${scenario.name} - Nessun modello da caricare`);
            }
            return;
        }
        
        // Filtra solo i file modello (OBJ, MTL, GLTF, GLB, STL)
        const modelFiles = scenario.files.filter(file => {
            const extension = file.path.toLowerCase().split('.').pop();
            return ['obj', 'mtl', 'gltf', 'glb', 'stl'].includes(extension);
        });
        
        console.log('[ModelManager] 🔄 File modello filtrati:', modelFiles);
        
        if (modelFiles.length === 0) {
            console.log('[ModelManager] ❌ Nessun modello compatibile trovato');
            if (this.feedbackManager) {
                this.feedbackManager.updateStatus(`Scenario ${scenario.name} - Nessun modello compatibile`);
            }
            return;
        }
        
        console.log(`[ModelManager] Caricamento ${modelFiles.length} modelli per scenario: ${scenario.name}`);
        
        // Mostra progress bar
        this.showModelProgressBar(modelFiles.length);
        if (this.feedbackManager) {
            this.feedbackManager.updateStatus(`Caricamento ${modelFiles.length} modelli...`);
        }
        
        // Converte i path in URL per il fetch
        const modelUrls = modelFiles.map(file => ({
            name: file.path.split('/').pop(),
            path: file.path,
            type: file.path.toLowerCase().split('.').pop()
        }));
        
        console.log('[ModelManager] Modelli da caricare:', modelUrls.map(m => `${m.name} (${m.type})`).join(', '));
        
        // Avvia il caricamento tramite fetch
        if (window.ModelLoader) {
            this.loadModelsFromUrls(modelUrls);
        } else {
            if (this.feedbackManager) {
                this.feedbackManager.showError('ModelLoader non disponibile');
            }
        }
    },
    
    /**
     * Carica modelli da URL utilizzando fetch
     */
    loadModelsFromUrls: function(modelUrls) {
        console.log('[ModelManager] 🌐 Avvio fetch per:', modelUrls);
        
        this.isLoading = true;
        let completedFiles = 0;
        const totalFiles = modelUrls.length;
        
        const loadPromises = modelUrls.map(model => {
            console.log(`[ModelManager] 🌐 Fetching: ${model.path}`);
            
            // Aggiorna progress bar - fetch iniziato
            this.updateModelProgress(completedFiles, totalFiles, model.name);

            return fetchFile(model.path)
                .then(response => {
                    console.log(`[ModelManager] 🌐 Response per ${model.path}:`, response.status, response.statusText);
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    return response.blob();
                })
                .then(blob => {
                    console.log(`[ModelManager] 🌐 Blob creato per ${model.name}:`, blob.size, 'bytes');
                    
                    // Aggiorna progress bar - file completato
                    completedFiles++;
                    this.updateModelProgress(completedFiles, totalFiles, model.name);
                    
                    // Crea un File object dal blob
                    const file = new File([blob], model.name, { type: blob.type });
                    return { file, model };
                })
                .catch(error => {
                    console.error(`[ModelManager] ❌ Errore fetch ${model.name}:`, error);
                    return null;
                });
        });
        
        Promise.allSettled(loadPromises)
            .then(results => {
                console.log('[ModelManager] 🌐 Risultati fetch:', results);
                
                const validFiles = results
                    .filter(result => result.status === 'fulfilled' && result.value !== null)
                    .map(result => result.value.file);
                
                const failedFiles = results.filter(result => result.status === 'rejected').length;
                
                console.log('[ModelManager] 🌐 File validi:', validFiles.length, 'File falliti:', failedFiles);
                
                if (validFiles.length > 0) {
                    console.log(`[ModelManager] ${validFiles.length} modelli caricati con successo`);
                    if (failedFiles > 0) {
                        console.warn(`[ModelManager] ${failedFiles} modelli non caricati`);
                    }
                    
                    if (this.feedbackManager) {
                        this.feedbackManager.updateStatus(`Rendering ${validFiles.length} modelli...`);
                    }
                    
                    // Usa ModelLoader per caricare i file
                    this.processModelsWithLoader(validFiles);
                    
                } else {
                    if (this.feedbackManager) {
                        this.feedbackManager.showError('Nessun modello caricato con successo');
                    }
                }
            });
    },
    
    /**
     * Processa i modelli con ModelLoader
     */
    processModelsWithLoader: function(validFiles) {
        console.log('[ModelManager] 🌐 Chiamando ModelLoader.loadFiles con:', validFiles);
        
        if (window.ModelLoader && typeof window.ModelLoader.loadFiles === 'function') {
            console.log('[ModelManager] 🌐 Avvio ModelLoader.loadFiles...');
            window.ModelLoader.loadFiles(\n                validFiles,\n                (progress) => {\n                    console.log('[ModelManager] 🌐 Progress:', progress);\n                    if (this.feedbackManager) {\n                        this.feedbackManager.updateStatus(`Caricamento modelli: ${Math.round(progress * 100)}%`);\n                    }\n                },\n                (models) => {\n                    console.log('[ModelManager] 🌐 Modelli caricati, chiamando onModelLoadComplete:', models);\n                    this.onModelLoadComplete(models);\n                },\n                (error) => {\n                    console.error('[ModelManager] 🌐 Errore ModelLoader:', error);\n                    if (this.feedbackManager) {\n                        this.feedbackManager.showError(`Errore caricamento modelli: ${error}`);\n                    }\n                    this.onModelLoadError(error);\n                }\n            );\n        } else {\n            if (this.feedbackManager) {\n                this.feedbackManager.showError('ModelLoader non disponibile o non ha la funzione loadFiles');\n            }\n        }\n    },\n    \n    /**\n     * Gestisce la selezione di file modelli dall'utente\n     */\n    onModelsSelected: function(event) {\n        const files = event.target.files;\n        if (!files || files.length === 0) return;\n        \n        console.log(`[ModelManager] File modelli selezionati: ${files.length}`);\n        \n        if (this.feedbackManager) {\n            this.feedbackManager.updateStatus('Caricamento modelli...');\n            this.feedbackManager.showLoader('Caricamento modelli in corso...');\n        }\n        \n        this.isLoading = true;\n        \n        // Usa ModelLoader per caricare i file\n        if (window.ModelLoader) {\n            window.ModelLoader.loadFiles(\n                files,\n                this.onModelLoadProgress.bind(this),\n                this.onModelLoadComplete.bind(this),\n                this.onModelLoadError.bind(this)\n            );\n        } else {\n            if (this.feedbackManager) {\n                this.feedbackManager.showError('ModelLoader non disponibile');\n            }\n        }\n    },\n    \n    /**\n     * Callback progresso caricamento modelli\n     */\n    onModelLoadProgress: function(message, progress) {\n        if (this.feedbackManager) {\n            this.feedbackManager.updateStatus(message);\n        }\n        \n        // Aggiorna anche la progress bar se visibile\n        const progressBar = document.getElementById('modelProgressBar');\n        if (progressBar && !progressBar.classList.contains('hidden')) {\n            const currentFile = message.includes('Caricamento ') ? message.replace('Caricamento ', '').replace('...', '') : message;\n            const percentage = Math.round(progress * 100);\n            this.updateModelProgress(null, null, currentFile, percentage);\n        }\n        \n        console.log(`[ModelManager] Progresso caricamento: ${message} (${Math.round(progress * 100)}%)`);\n    },\n    \n    /**\n     * Callback completamento caricamento modelli\n     */\n    onModelLoadComplete: function(models) {\n        this.isLoading = false;\n        \n        if (this.feedbackManager) {\n            this.feedbackManager.hideLoader();\n        }\n        \n        if (models.length === 0) {\n            if (this.feedbackManager) {\n                this.feedbackManager.showError('Nessun modello caricato');\n                this.feedbackManager.updateStatus('Errore caricamento');\n            }\n            return;\n        }\n        \n        console.log(`[ModelManager] Modelli caricati con successo: ${models.length}`);\n        \n        // Aggiungi modelli alla scena con posizioni e direzioni configurate\n        this.addModelsToScene(models);\n        \n        if (this.feedbackManager) {\n            this.feedbackManager.updateStatus(`${models.length} modello(i) caricato(i)`);\n        }\n        \n        // Crea controlli visibilità per modelli multipli\n        if (models.length > 1) {\n            this.createModelVisibilityControls();\n        }\n        \n        // Nascondi progress bar al completamento\n        this.hideModelProgressBar();\n        \n        // Reset input file\n        if (this.elements.fileInput) {\n            this.elements.fileInput.value = '';\n        }\n        \n        console.log(`[ModelManager] Caricamento completato per ${models.length} modelli`);\n    },\n    \n    /**\n     * Aggiunge modelli alla scena 3D\n     */\n    addModelsToScene: function(models) {\n        models.forEach((model, index) => {\n            if (window.Scene3D) {\n                // Applica posizione se configurata\n                if (this.currentScenario && this.currentScenario.positions && this.currentScenario.positions[index]) {\n                    const pos = this.currentScenario.positions[index];\n                    model.position.set(pos.x, pos.y, pos.z);\n                    console.log(`[ModelManager] 📍 Applicata posizione configurata al modello ${index + 1}: (${pos.x}, ${pos.y}, ${pos.z})`);\n                }\n                \n                // Trova la configurazione del modello (inclusa la direzione)\n                const modelConfig = this.findModelConfig(model);\n                \n                // Aggiungi modello con configurazione\n                window.Scene3D.addModel(model, modelConfig);\n                \n                console.log(`[ModelManager] ✅ Modello ${index + 1} aggiunto alla scena`);\n            }\n        });\n    },\n    \n    /**\n     * Trova la configurazione per un modello specifico\n     */\n    findModelConfig: function(model) {\n        if (!this.currentScenario || !this.currentScenario.files) {\n            return null;\n        }\n        \n        const modelFilename = model.userData?.originalFilename || model.name;\n        \n        console.log(`[ModelManager] 🔍 Ricerca config per modello: \"${modelFilename}\"`);\n        \n        const modelConfig = this.currentScenario.files.find(file => {\n            const modelNameClean = modelFilename.replace('.glb', '');\n            const fileNameClean = file.path.split('/').pop().replace('.glb', '');\n            \n            const exactMatch = modelNameClean === fileNameClean;\n            \n            console.log(`[ModelManager] 🔍 Test file \"${file.path}\": modelName=\"${modelNameClean}\", fileName=\"${fileNameClean}\", exactMatch=${exactMatch}, direction=`, file.direction);\n            \n            if (exactMatch) {\n                console.log(`[ModelManager] ✅ EXACT MATCH FOUND for \"${modelFilename}\": ${file.path} with direction:`, file.direction);\n            }\n            \n            return exactMatch;\n        });\n        \n        if (modelConfig) {\n            console.log(`[ModelManager] 🔍✅ Config trovato per \"${modelFilename}\":`, modelConfig);\n        } else {\n            console.log(`[ModelManager] 🔍❌ Nessun config trovato per \"${modelFilename}\"`);\n        }\n        \n        return modelConfig;\n    },\n    \n    /**\n     * Callback errore caricamento modelli\n     */\n    onModelLoadError: function(error) {\n        this.isLoading = false;\n        \n        if (this.feedbackManager) {\n            this.feedbackManager.hideLoader();\n            this.feedbackManager.showError('Errore caricamento modelli: ' + error);\n            this.feedbackManager.updateStatus('Errore caricamento');\n        }\n        \n        this.hideModelProgressBar();\n        \n        console.error('[ModelManager] Errore caricamento modelli:', error);\n    },\n    \n    /**\n     * Gestisce la selezione di file animazione\n     */\n    onAnimationSelected: function(event) {\n        const file = event.target.files[0];\n        if (!file) return;\n        \n        console.log(`[ModelManager] File animazione selezionato: ${file.name}`);\n        \n        if (this.feedbackManager) {\n            this.feedbackManager.updateStatus('File animazione caricato');\n        }\n        \n        // Abilita pulsante animazione se presente\n        const animationBtn = document.getElementById('animationBtn');\n        if (animationBtn) {\n            animationBtn.disabled = false;\n        }\n    },\n    \n    /* ===== PROGRESS BAR MODELLI ===== */\n    \n    /**\n     * Mostra la progress bar per il caricamento modelli\n     */\n    showModelProgressBar: function(totalFiles = 0) {\n        const progressBar = document.getElementById('modelProgressBar');\n        if (progressBar) {\n            // Reset elementi\n            this.updateModelProgress(0, totalFiles, 'Preparazione...');\n            \n            // Mostra la progress bar\n            progressBar.classList.remove('hidden');\n            \n            console.log('[ModelManager] 📊 Progress bar modelli mostrata');\n        }\n    },\n    \n    /**\n     * Aggiorna la progress bar\n     */\n    updateModelProgress: function(currentFile, totalFiles, fileName = '', percentage = null) {\n        const progressBarFill = document.getElementById('progress-bar-fill');\n        const progressCurrentFile = document.getElementById('progress-current-file');\n        const progressPercentage = document.getElementById('progress-percentage');\n        const progressFilesCount = document.getElementById('progress-files-count');\n        \n        // Calcola percentuale se non fornita\n        if (percentage === null) {\n            percentage = totalFiles > 0 ? Math.round((currentFile / totalFiles) * 100) : 0;\n        }\n        \n        // Aggiorna elementi\n        if (progressBarFill) {\n            progressBarFill.style.width = `${percentage}%`;\n        }\n        \n        if (progressCurrentFile && fileName) {\n            // Estrai solo il nome del file senza percorso\n            const cleanFileName = fileName.split('/').pop() || fileName;\n            progressCurrentFile.textContent = cleanFileName;\n        }\n        \n        if (progressPercentage) {\n            progressPercentage.textContent = `${percentage}%`;\n        }\n        \n        if (progressFilesCount && totalFiles > 0) {\n            progressFilesCount.textContent = `${currentFile} / ${totalFiles} file`;\n        }\n        \n        console.log(`[ModelManager] 📊 Progress aggiornato: ${percentage}% - ${fileName}`);\n    },\n    \n    /**\n     * Nasconde la progress bar\n     */\n    hideModelProgressBar: function() {\n        const progressBar = document.getElementById('modelProgressBar');\n        if (progressBar) {\n            progressBar.classList.add('hidden');\n            console.log('[ModelManager] 📊 Progress bar modelli nascosta');\n        }\n    },\n    \n    /* ===== CONTROLLI VISIBILITÀ MODELLI ===== */\n    \n    /**\n     * Crea i controlli per la visibilità dei modelli\n     */\n    createModelVisibilityControls: function() {\n        if (!this.elements.modelsVisibilityPanel) {\n            console.warn('[ModelManager] Pannello controlli visibilità modelli non trovato');\n            return;\n        }\n        \n        // Ottieni informazioni sui modelli dalla scena\n        const modelsInfo = window.Scene3D ? window.Scene3D.getModelsInfo() : [];\n        \n        // Pulisci pannello esistente\n        this.elements.modelsVisibilityPanel.innerHTML = '';\n        \n        if (modelsInfo.length > 1) {\n            // Aggiungi titolo\n            const title = document.createElement('span');\n            title.textContent = '👁️ Visibilità:';\n            title.style.cssText = 'color: white; font-size: 12px; margin-right: 5px; align-self: center;';\n            this.elements.modelsVisibilityPanel.appendChild(title);\n            \n            // Crea pulsante per ogni modello\n            modelsInfo.forEach((info, index) => {\n                const button = this.createVisibilityButton(info, index);\n                this.elements.modelsVisibilityPanel.appendChild(button);\n            });\n            \n            // Mostra il pannello\n            this.elements.modelsVisibilityPanel.classList.remove('hidden');\n            this.elements.modelsVisibilityPanel.style.display = 'flex';\n        }\n    },\n    \n    /**\n     * Crea pulsante visibilità per un modello\n     */\n    createVisibilityButton: function(info, index) {\n        const button = document.createElement('button');\n        button.className = 'btn-blue';\n        button.style.cssText = 'padding: 4px 8px; font-size: 11px; min-width: auto;';\n        button.textContent = `📦 ${info.name === `Modello ${index + 1}` ? `M${index + 1}` : info.name.substring(0, 8)}`;\n        button.title = `Mostra/Nascondi ${info.name}`;\n        \n        // Aggiorna stile in base alla visibilità\n        this.updateVisibilityButtonStyle(button, info.visible);\n        \n        // Aggiungi click handler\n        button.onclick = () => this.toggleModelVisibility(index);\n        \n        return button;\n    },\n    \n    /**\n     * Nasconde i controlli di visibilità modelli\n     */\n    hideModelVisibilityControls: function() {\n        if (this.elements.modelsVisibilityPanel) {\n            this.elements.modelsVisibilityPanel.classList.add('hidden');\n            this.elements.modelsVisibilityPanel.style.display = 'none';\n            this.elements.modelsVisibilityPanel.innerHTML = '';\n        }\n    },\n    \n    /**\n     * Alterna la visibilità di un modello\n     */\n    toggleModelVisibility: function(modelIndex) {\n        if (!window.Scene3D) {\n            console.warn('[ModelManager] Scene3D non disponibile');\n            return;\n        }\n        \n        const visible = window.Scene3D.toggleModelVisibility(modelIndex);\n        \n        // Aggiorna il pulsante corrispondente\n        if (this.elements.modelsVisibilityPanel) {\n            const buttons = this.elements.modelsVisibilityPanel.querySelectorAll('button');\n            if (buttons[modelIndex + 1]) { // +1 per saltare il titolo\n                this.updateVisibilityButtonStyle(buttons[modelIndex + 1], visible);\n            }\n        }\n    },\n    \n    /**\n     * Aggiorna lo stile del pulsante in base alla visibilità\n     */\n    updateVisibilityButtonStyle: function(button, visible) {\n        if (visible) {\n            button.style.opacity = '1';\n            button.style.backgroundColor = 'var(--primary-blue)';\n            button.title = button.title.replace('Mostra/', 'Nascondi ');\n        } else {\n            button.style.opacity = '0.5';\n            button.style.backgroundColor = '#666';\n            button.title = button.title.replace('Nascondi ', 'Mostra/');\n        }\n    },\n    \n    /**\n     * Pulisce tutti i modelli\n     */\n    clearAll: function() {\n        if (window.Scene3D) {\n            window.Scene3D.clearAllModels();\n        }\n        \n        // Reset input files\n        if (this.elements.fileInput) this.elements.fileInput.value = '';\n        if (this.elements.animationInput) this.elements.animationInput.value = '';\n        \n        // Disabilita pulsanti\n        const animationBtn = document.getElementById('animationBtn');\n        if (animationBtn) animationBtn.disabled = true;\n        \n        // Nasconde i controlli di visibilità\n        this.hideModelVisibilityControls();\n        \n        this.currentScenario = null;\n        this.isLoading = false;\n        \n        if (this.feedbackManager) {\n            this.feedbackManager.updateStatus('Scena pulita');\n        }\n        \n        console.log('[ModelManager] Scena pulita');\n    },\n    \n    /**\n     * Verifica se è in corso un caricamento\n     */\n    isCurrentlyLoading: function() {\n        return this.isLoading;\n    },\n    \n    /**\n     * Cleanup del modulo\n     */\n    cleanup: function() {\n        console.log('[ModelManager] Cleanup...');\n        \n        // Stop eventuali caricamenti in corso\n        this.isLoading = false;\n        \n        // Reset stato\n        this.currentScenario = null;\n        this.elements = {};\n        this.feedbackManager = null;\n        \n        console.log('[ModelManager] Cleanup completato');\n    }\n};