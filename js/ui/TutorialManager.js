/**
 * TutorialManager.js - Gestione sistema tutorial e step
 *
 * Responsabilità:
 * - Caricamento e parsing file tutorial.txt
 * - Gestione step tutorial e navigazione
 * - UI step tutorial (fumetto, barra navigazione)
 * - Applicazione impostazioni camera tutorial
 * - Tracking progresso tutorial
 * - Gestione completamento tutorial
 *
 * Versione: 2.0 Refactored
 * Data: Dicembre 2025
 */

class TutorialManager {
    constructor() {
        this.tutorialSteps = [];
        this.availableTutorials = [];
        this.currentTutorial = null;
        this.currentStepIndex = -1;
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
     * Inizializza il sistema tutorial
     */
    init() {
        this.safeLog(2, '[TutorialManager] Inizializzazione...');

        try {
            this.isInitialized = true;
            this.safeLog(2, '[TutorialManager] Inizializzato con successo');
            return true;

        } catch (error) {
            this.safeLog(0, '[TutorialManager] Errore inizializzazione:', error);
            return false;
        }
    }

    /**
     * Carica e parsa il file tutorial.txt
     */
    async loadTutorial(tutorialPath) {
        if (!tutorialPath) {
            this.safeLog(1, '[TutorialManager] ❌ Nessun path tutorial specificato');
            return;
        }

        try {
            this.safeLog(2, `[TutorialManager] Caricamento tutorial: ${tutorialPath}`);

            const response = await fetch(tutorialPath);
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

                this.createTutorialStepsBar();
                this.showTutorialStepsBar();

                this.safeLog(2, `[TutorialManager] Tutorial disponibili: ${this.availableTutorials.length} - Camera impostata dal primo tutorial`);
            } else {
                this.hideStepSpeechBubble();
                this.safeLog(1, '[TutorialManager] Nessun tutorial trovato nel file');
            }

        } catch (error) {
            this.safeLog(0, `[TutorialManager] Errore caricamento tutorial: ${error.message}`);
            if (window.UI && window.UI.core) {
                window.UI.core.showError(`Errore caricamento tutorial: ${error.message}`);
            }
        }
    }

    /**
     * Parsa il contenuto del file tutorial.txt
     * Distingue tra tutorial principali e steps
     */
    parseTutorialContent(content) {
        const tutorials = [];
        const lines = content.split('\n');
        let currentTutorial = null;
        let currentStep = null;
        let globalProperties = {}; // Raccoglie proprietà globali prima del primo tutorial

        for (let line of lines) {
            line = line.trim();

            // Ignora righe vuote e commenti
            if (!line || line.startsWith('#') || line.startsWith('//')) continue;

            // Rimuovi commenti inline (dopo //)
            const commentIndex = line.indexOf('//');
            if (commentIndex !== -1) {
                line = line.substring(0, commentIndex).trim();
                if (!line) continue;
            }

            // Tutorial principale [Nome Tutorial]
            if (line.startsWith('[') && line.endsWith(']') && !line.includes('Step')) {
                // Salva tutorial precedente se esisteva
                if (currentTutorial) {
                    tutorials.push(currentTutorial);
                }

                // Nuovo tutorial
                const tutorialName = line.slice(1, -1);
                currentTutorial = {
                    name: tutorialName,
                    steps: [],
                    properties: { ...globalProperties } // Eredita proprietà globali
                };
                currentStep = null;

                this.safeLog(3, `[TutorialManager] 📚 Tutorial trovato: ${tutorialName}`);
                continue;
            }

            // Step del tutorial [Step X - Descrizione]
            if (line.startsWith('[') && line.endsWith(']') && line.includes('Step')) {
                if (!currentTutorial) {
                    this.safeLog(1, '[TutorialManager] ⚠️ Step trovato prima di un tutorial');
                    continue;
                }

                // Salva step precedente se esisteva
                if (currentStep) {
                    currentTutorial.steps.push(currentStep);
                }

                // Nuovo step
                const stepTitle = line.slice(1, -1);
                currentStep = {
                    title: stepTitle,
                    properties: {}
                };

                this.safeLog(3, `[TutorialManager]   📋 Step: ${stepTitle}`);
                continue;
            }

            // Proprietà (formato: chiave=valore)
            if (line.includes('=')) {
                const [key, value] = line.split('=', 2);
                const cleanKey = key.trim();
                const cleanValue = value.trim();

                if (currentStep) {
                    // Proprietà dello step corrente
                    currentStep.properties[cleanKey] = cleanValue;
                    this.safeLog(3, `[TutorialManager]     ${cleanKey}: ${cleanValue}`);
                } else if (currentTutorial) {
                    // Proprietà del tutorial corrente
                    currentTutorial.properties[cleanKey] = cleanValue;
                    this.safeLog(3, `[TutorialManager]   ${cleanKey}: ${cleanValue}`);
                } else {
                    // Proprietà globale (prima di qualsiasi tutorial)
                    globalProperties[cleanKey] = cleanValue;
                    this.safeLog(3, `[TutorialManager] GLOBAL ${cleanKey}: ${cleanValue}`);
                }
            }
        }

        // Aggiungi ultimo step e tutorial
        if (currentStep && currentTutorial) {
            currentTutorial.steps.push(currentStep);
        }
        if (currentTutorial) {
            tutorials.push(currentTutorial);
        }

        this.safeLog(2, `[TutorialManager] Parsing completato: ${tutorials.length} tutorial trovati`);
        return tutorials;
    }

    /**
     * Applica le impostazioni camera iniziali dal tutorial
     */
    applyInitialCameraSettings(tutorial) {
        if (!tutorial || !tutorial.properties) return;

        this.safeLog(2, `[TutorialManager] 🎭 Applicazione impostazioni camera iniziali`);

        // Applica posizione camera se specificata
        if (tutorial.properties.CameraPos) {
            this.applyCameraPosition(tutorial.properties.CameraPos);
        }

        // Applica target camera se specificato
        if (tutorial.properties.CameraTarget) {
            this.applyCameraTarget(tutorial.properties.CameraTarget);
        }

        // Applica zoom camera se specificato
        if (tutorial.properties.CameraZoom) {
            this.applyCameraZoom(tutorial.properties.CameraZoom);
        }

        this.safeLog(2, `[TutorialManager] ✅ Impostazioni camera applicate`);
    }

    /**
     * Applica posizione camera
     */
    applyCameraPosition(positionString) {
        if (!window.Scene3D || !window.Scene3D.camera) return;

        const position = this.parseVector3(positionString);
        if (position) {
            window.Scene3D.camera.position.set(position.x, position.y, position.z);
            window.Scene3D.manualCameraSet = true;
            this.safeLog(2, `[TutorialManager] 📷 Camera position: (${position.x}, ${position.y}, ${position.z})`);
        }
    }

    /**
     * Applica target camera
     */
    applyCameraTarget(targetString) {
        if (!window.Scene3D || !window.Scene3D.camera) return;

        // Controlla se è coordinate o nome oggetto
        if (targetString.includes('(') && targetString.includes(')')) {
            // Coordinate
            const target = this.parseVector3(targetString);
            if (target) {
                window.Scene3D.camera.lookAt(target.x, target.y, target.z);
                this.safeLog(2, `[TutorialManager] 🎯 Camera target coordinate: (${target.x}, ${target.y}, ${target.z})`);
            }
        } else {
            // Nome oggetto
            const targetModel = window.Scene3D.findModelByName(targetString);
            if (targetModel) {
                const center = window.Scene3D.calculateBoundingBoxCenter(targetModel);
                window.Scene3D.camera.lookAt(center.x, center.y, center.z);
                this.safeLog(2, `[TutorialManager] 🎯 Camera target oggetto: ${targetString} -> (${center.x}, ${center.y}, ${center.z})`);
            }
        }
    }

    /**
     * Applica zoom camera
     */
    applyCameraZoom(zoomString) {
        const zoom = parseFloat(zoomString);
        if (!isNaN(zoom) && window.Scene3D && window.Scene3D.camera) {
            // Per camera prospettica, ajjustiamo fov
            if (window.Scene3D.camera.fov) {
                window.Scene3D.camera.fov = 75 / zoom;
                window.Scene3D.camera.updateProjectionMatrix();
                this.safeLog(2, `[TutorialManager] 🔍 Camera zoom: ${zoom} (fov: ${window.Scene3D.camera.fov})`);
            }
        }
    }

    /**
     * Crea la barra di navigazione tutorial
     */
    createTutorialStepsBar() {
        const tutorialStepsBar = document.getElementById('tutorialStepsBar');
        if (!tutorialStepsBar) {
            this.safeLog(1, '[TutorialManager] Elemento tutorialStepsBar non trovato');
            return;
        }

        // Pulisci contenuto esistente
        tutorialStepsBar.innerHTML = '';

        // Crea pulsanti per ogni tutorial disponibile
        this.availableTutorials.forEach((tutorial, index) => {
            const button = document.createElement('button');
            button.className = 'tutorial-btn';
            button.textContent = tutorial.name;
            button.title = `Avvia tutorial: ${tutorial.name}`;
            button.onclick = () => this.selectTutorial(index);

            tutorialStepsBar.appendChild(button);
        });

        this.safeLog(3, '[TutorialManager] Barra tutorial creata');
    }

    /**
     * Mostra la barra tutorial
     */
    showTutorialStepsBar() {
        const tutorialStepsBar = document.getElementById('tutorialStepsBar');
        if (tutorialStepsBar) {
            tutorialStepsBar.style.display = 'flex';
        }
    }

    /**
     * Nasconde la barra tutorial
     */
    hideTutorialStepsBar() {
        const tutorialStepsBar = document.getElementById('tutorialStepsBar');
        if (tutorialStepsBar) {
            tutorialStepsBar.style.display = 'none';
        }
    }

    /**
     * Seleziona un tutorial specifico
     */
    selectTutorial(tutorialIndex) {
        if (tutorialIndex < 0 || tutorialIndex >= this.availableTutorials.length) {
            this.safeLog(1, '[TutorialManager] Indice tutorial non valido');
            return;
        }

        const tutorial = this.availableTutorials[tutorialIndex];
        this.currentTutorial = tutorial;
        this.tutorialSteps = tutorial.steps;
        this.currentStepIndex = 0;

        this.safeLog(2, `[TutorialManager] 📚 Tutorial selezionato: ${tutorial.name} (${tutorial.steps.length} step)`);

        // Applica impostazioni del tutorial
        this.applyTutorialSettings(tutorial);

        // Aggiorna UI
        this.updateTutorialStepsBar();
        this.updateStepSpeechBubble();
        this.showStepSpeechBubble();

        // Reset tutorial tracking
        if (window.Scene3D && window.Scene3D.resetTutorialTracker) {
            window.Scene3D.resetTutorialTracker();
        }
    }

    /**
     * Applica le impostazioni del tutorial selezionato
     */
    applyTutorialSettings(tutorial) {
        if (!tutorial || !tutorial.properties) return;

        // Applica impostazioni camera
        this.applyInitialCameraSettings(tutorial);

        // Applica impostazioni modelli se disponibili
        if (window.Scene3D && window.Scene3D.applyModelSettings) {
            window.Scene3D.applyModelSettings(tutorial.properties);
        }
    }

    /**
     * Aggiorna la barra tutorial per mostrare lo stato corrente
     */
    updateTutorialStepsBar() {
        const tutorialStepsBar = document.getElementById('tutorialStepsBar');
        if (!tutorialStepsBar) return;

        const buttons = tutorialStepsBar.querySelectorAll('.tutorial-btn');
        buttons.forEach((button, index) => {
            button.classList.remove('active', 'completed');

            if (this.currentTutorial && this.availableTutorials[index] === this.currentTutorial) {
                button.classList.add('active');
            }
        });
    }

    /**
     * Mostra il fumetto dello step
     */
    showStepSpeechBubble() {
        const stepSpeechBubble = document.getElementById('stepSpeechBubble');
        if (stepSpeechBubble) {
            stepSpeechBubble.style.display = 'block';
        }
    }

    /**
     * Nasconde il fumetto dello step
     */
    hideStepSpeechBubble() {
        const stepSpeechBubble = document.getElementById('stepSpeechBubble');
        if (stepSpeechBubble) {
            stepSpeechBubble.style.display = 'none';
        }
    }

    /**
     * Aggiorna il contenuto del fumetto dello step
     */
    updateStepSpeechBubble() {
        const speechBubbleContent = document.getElementById('speechBubbleContent');
        if (!speechBubbleContent || !this.currentTutorial || this.currentStepIndex < 0) return;

        const currentStep = this.tutorialSteps[this.currentStepIndex];
        if (!currentStep) return;

        // Aggiorna contenuto del fumetto
        speechBubbleContent.innerHTML = `
            <h4>${currentStep.title}</h4>
            <p>${currentStep.properties.Descrizione || 'Nessuna descrizione disponibile'}</p>
            <div class="step-info">
                <span>Step ${this.currentStepIndex + 1} di ${this.tutorialSteps.length}</span>
            </div>
        `;

        this.safeLog(3, `[TutorialManager] Fumetto aggiornato: ${currentStep.title}`);
    }

    /**
     * Naviga al prossimo step
     */
    nextStep() {
        if (!this.currentTutorial || this.currentStepIndex >= this.tutorialSteps.length - 1) {
            this.safeLog(2, '[TutorialManager] Fine tutorial raggiunta');
            this.completeTutorial();
            return;
        }

        this.currentStepIndex++;
        this.applyCurrentStepSettings();
        this.updateStepSpeechBubble();

        this.safeLog(2, `[TutorialManager] ⏭️ Step successivo: ${this.currentStepIndex + 1}/${this.tutorialSteps.length}`);
    }

    /**
     * Naviga al step precedente
     */
    previousStep() {
        if (!this.currentTutorial || this.currentStepIndex <= 0) {
            this.safeLog(2, '[TutorialManager] Inizio tutorial raggiunto');
            return;
        }

        this.currentStepIndex--;
        this.applyCurrentStepSettings();
        this.updateStepSpeechBubble();

        this.safeLog(2, `[TutorialManager] ⏮️ Step precedente: ${this.currentStepIndex + 1}/${this.tutorialSteps.length}`);
    }

    /**
     * Applica le impostazioni dello step corrente
     */
    applyCurrentStepSettings() {
        if (!this.currentTutorial || this.currentStepIndex < 0) return;

        const currentStep = this.tutorialSteps[this.currentStepIndex];
        if (!currentStep || !currentStep.properties) return;

        // Applica impostazioni camera dello step
        if (currentStep.properties.CameraPos) {
            this.applyCameraPosition(currentStep.properties.CameraPos);
        }

        if (currentStep.properties.CameraTarget) {
            this.applyCameraTarget(currentStep.properties.CameraTarget);
        }

        // Applica altri settings dello step
        if (window.Scene3D && window.Scene3D.applyModelSettings) {
            window.Scene3D.applyModelSettings(currentStep.properties);
        }

        // Notifica tool manager se richiesto uno strumento
        if (currentStep.properties.Utensile && window.UI && window.UI.toolsManager) {
            this.safeLog(2, `[TutorialManager] Strumento richiesto: ${currentStep.properties.Utensile} (senza evidenziazione automatica)`);
            // NON evidenziare automaticamente - l'utente deve scegliere il tool da solo
        }
    }

    /**
     * Completa il tutorial corrente
     */
    completeTutorial() {
        if (!this.currentTutorial) return;

        this.safeLog(2, `[TutorialManager] 🎉 Tutorial completato: ${this.currentTutorial.name}`);

        // Mostra congratulazioni
        if (window.Scene3D && window.Scene3D.showTutorialCompletionCongratulations) {
            window.Scene3D.showTutorialCompletionCongratulations();
        }

        // Reset stato tutorial
        this.currentTutorial = null;
        this.tutorialSteps = [];
        this.currentStepIndex = -1;

        // Aggiorna UI
        this.updateTutorialStepsBar();
        this.hideStepSpeechBubble();
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
            this.safeLog(1, '[TutorialManager] Errore parsing Vector3:', error);
        }
        return null;
    }

    /**
     * Ottiene stato corrente
     */
    getState() {
        return {
            isInitialized: this.isInitialized,
            availableTutorialsCount: this.availableTutorials.length,
            currentTutorial: this.currentTutorial ? this.currentTutorial.name : null,
            currentStepIndex: this.currentStepIndex,
            totalSteps: this.tutorialSteps.length
        };
    }

    /**
     * Cleanup risorse
     */
    dispose() {
        this.tutorialSteps = [];
        this.availableTutorials = [];
        this.currentTutorial = null;
        this.currentStepIndex = -1;
        this.isInitialized = false;

        // Nasconde UI tutorial
        this.hideTutorialStepsBar();
        this.hideStepSpeechBubble();

        this.safeLog(2, '[TutorialManager] Cleanup completato');
    }
}

// Export per uso come modulo
window.TutorialManager = TutorialManager;
console.log('[TutorialManager] ✅ Modulo caricato e disponibile su window.TutorialManager');