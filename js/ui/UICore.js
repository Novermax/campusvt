/**
 * UICore.js - Core UI management and initialization
 *
 * Responsabilità:
 * - Inizializzazione sistema UI
 * - Navigazione tra pagine
 * - Caching elementi DOM
 * - Setup event listeners base
 * - Gestione stato e feedback utente
 *
 * Versione: 2.0 Refactored
 * Data: Dicembre 2025
 */

class UICore {
    constructor() {
        this.currentPage = 'home';
        this.elements = {};
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
     * Inizializza il sistema UI core
     */
    init() {
        this.safeLog(2, '[UICore] Inizializzazione core UI...');

        try {
            // Caching elementi DOM
            this.cacheElements();

            // Setup event listeners base
            this.setupEventListeners();

            // Mostra pagina iniziale
            this.showPage('home');

            // Aggiorna stato iniziale
            this.updateStatus('Pronto');

            this.isInitialized = true;
            this.safeLog(2, '[UICore] Core UI inizializzato con successo');
            return true;

        } catch (error) {
            this.safeLog(0, '[UICore] Errore inizializzazione core UI:', error);
            this.showError('Errore inizializzazione interfaccia');
            return false;
        }
    }

    /**
     * Cachea i riferimenti agli elementi DOM per performance migliori
     */
    cacheElements() {
        // Elementi principali pagine
        this.elements.homePage = document.getElementById('homePage');
        this.elements.scenarioPage = document.getElementById('scenarioPage');
        this.elements.scenariosList = document.getElementById('scenariosList');

        // Controlli input
        this.elements.fileInput = document.getElementById('fileInput');
        this.elements.animationInput = document.getElementById('animationInput');
        this.elements.scenarioBtn = document.getElementById('scenarioBtn');
        this.elements.animationBtn = document.getElementById('animationBtn');

        // Elementi feedback
        this.elements.status = document.getElementById('status');
        this.elements.loader = document.getElementById('loader');
        this.elements.error = document.getElementById('error');
        this.elements.errorMessage = document.getElementById('errorMessage');
        this.elements.scenarioTitle = document.getElementById('scenarioTitle');

        // Elementi tutorial UI
        this.elements.tutorialStepsBar = document.getElementById('tutorialStepsBar');
        this.elements.stepSpeechBubble = document.getElementById('stepSpeechBubble');
        this.elements.speechBubbleContent = document.getElementById('speechBubbleContent');

        this.safeLog(3, '[UICore] Elementi DOM cachati');
    }

    /**
     * Configura event listeners base del core UI
     */
    setupEventListeners() {
        // Event listener per resize finestra
        window.addEventListener('resize', this.onWindowResize.bind(this));

        // Event listener per orientazione dispositivi mobili
        window.addEventListener('orientationchange', this.onOrientationChange.bind(this));

        // Event listeners per navigation
        if (this.elements.scenariosList) {
            // Gestione navigazione da tastiera
            this.elements.scenariosList.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    // Delega alla gesture management (scenario selection)
                    if (window.UI && window.UI.scenarioManager) {
                        window.UI.scenarioManager.onScenarioCardClick(event);
                    }
                }
            });
        }

        this.safeLog(3, '[UICore] Event listeners base configurati');
    }

    /**
     * Mostra una specifica pagina
     * @param {string} page - Nome della pagina ('home' o 'scenario')
     */
    showPage(page) {
        this.safeLog(3, `[UICore] Navigazione verso pagina: ${page}`);

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
            this.onHomePageShown();
        } else if (page === 'scenario' && this.elements.scenarioPage) {
            this.elements.scenarioPage.classList.remove('hidden');
            this.currentPage = 'scenario';
            this.onScenarioPageShown();
        }

        this.safeLog(3, `[UICore] Pagina mostrata: ${page}`);
    }

    /**
     * Callback quando viene mostrata la home page
     */
    onHomePageShown() {
        // Cleanup controlli mobile se attivi
        if (window.UI && window.UI.mobileManager) {
            window.UI.mobileManager.cleanupMobileControls();
        }

        // Reset UI tutorial
        this.hideTutorialStepsBar();
        this.hideStepSpeechBubble();

        this.safeLog(3, '[UICore] Home page mostrata');
    }

    /**
     * Callback quando viene mostrata la pagina scenario
     */
    onScenarioPageShown() {
        // Inizializza controlli mobile se su dispositivo mobile
        if (window.UI && window.UI.mobileManager) {
            window.UI.mobileManager.initMobileControls();
        }

        // Inizializza il cursore del canvas quando si entra nella pagina scenario
        setTimeout(() => {
            if (window.UI && window.UI.toolsManager) {
                window.UI.toolsManager.updateCanvasCursor();
            }
        }, 100);

        // Inizializza la scena 3D se non già fatto
        if (window.Scene3D && !window.Scene3D.scene) {
            try {
                window.Scene3D.init();
                this.safeLog(2, '[UICore] Scena 3D inizializzata da callback pagina scenario');
            } catch (error) {
                this.safeLog(0, '[UICore] Errore inizializzazione scena 3D:', error);
            }
        }

        this.safeLog(3, '[UICore] Pagina scenario mostrata');
    }

    /**
     * Torna alla home page
     */
    goHome() {
        // Pulisci la scena 3D
        if (window.Scene3D && window.Scene3D.clearAllModels) {
            window.Scene3D.clearAllModels();
        }

        // Reset stato scenario nel scenario manager
        if (window.UI && window.UI.scenarioManager) {
            window.UI.scenarioManager.resetCurrentScenario();
        }

        // Nasconde la barra tutorial e il fumetto
        this.hideTutorialStepsBar();
        this.hideStepSpeechBubble();

        // Aggiorna UI
        this.updateStatus('Home');
        this.showPage('home');

        this.safeLog(2, '[UICore] Ritorno alla home');
    }

    /**
     * Aggiorna messaggio di stato
     * @param {string} message - Messaggio da mostrare
     */
    updateStatus(message) {
        if (this.elements.status) {
            this.elements.status.textContent = message;
        }
        this.safeLog(3, `[UICore] Status aggiornato: ${message}`);
    }

    /**
     * Mostra loader con messaggio
     * @param {string} message - Messaggio del loader
     */
    showLoader(message = 'Caricamento...') {
        if (this.elements.loader) {
            this.elements.loader.style.display = 'flex';
            const loaderText = this.elements.loader.querySelector('.loader-text');
            if (loaderText) {
                loaderText.textContent = message;
            }
        }
        this.safeLog(3, `[UICore] Loader mostrato: ${message}`);
    }

    /**
     * Nasconde loader
     */
    hideLoader() {
        if (this.elements.loader) {
            this.elements.loader.style.display = 'none';
        }
        this.safeLog(3, '[UICore] Loader nascosto');
    }

    /**
     * Mostra messaggio di errore
     * @param {string} message - Messaggio di errore
     */
    showError(message) {
        if (this.elements.error && this.elements.errorMessage) {
            this.elements.errorMessage.textContent = message;
            this.elements.error.style.display = 'block';
        }
        this.safeLog(0, `[UICore] Errore mostrato: ${message}`);
    }

    /**
     * Nasconde messaggio di errore
     */
    hideError() {
        if (this.elements.error) {
            this.elements.error.style.display = 'none';
        }
        this.safeLog(3, '[UICore] Errore nascosto');
    }

    /**
     * Nasconde la barra dei passi tutorial
     */
    hideTutorialStepsBar() {
        if (this.elements.tutorialStepsBar) {
            this.elements.tutorialStepsBar.style.display = 'none';
        }
    }

    /**
     * Nasconde il fumetto delle descrizioni step
     */
    hideStepSpeechBubble() {
        if (this.elements.stepSpeechBubble) {
            this.elements.stepSpeechBubble.style.display = 'none';
        }
    }

    /**
     * Gestisce resize della finestra
     */
    onWindowResize() {
        // Delega la gestione resize ai manager specializzati
        if (window.UI && window.UI.mobileManager) {
            window.UI.mobileManager.onWindowResize();
        }

        // Notifica Scene3D per aggiornamento camera/renderer
        if (window.Scene3D && window.Scene3D.onWindowResize) {
            window.Scene3D.onWindowResize();
        }

        this.safeLog(3, '[UICore] Window resize gestito');
    }

    /**
     * Gestisce cambio orientamento su mobile
     */
    onOrientationChange() {
        // Delega la gestione orientamento al mobile manager
        if (window.UI && window.UI.mobileManager) {
            window.UI.mobileManager.onOrientationChange();
        }

        this.safeLog(3, '[UICore] Orientation change gestito');
    }

    /**
     * Ottiene stato corrente del core UI
     */
    getState() {
        return {
            isInitialized: this.isInitialized,
            currentPage: this.currentPage,
            elementsCount: Object.keys(this.elements).length
        };
    }

    /**
     * Cleanup risorse
     */
    dispose() {
        // Rimuovi event listeners
        window.removeEventListener('resize', this.onWindowResize.bind(this));
        window.removeEventListener('orientationchange', this.onOrientationChange.bind(this));

        // Reset stato
        this.currentPage = 'home';
        this.elements = {};
        this.isInitialized = false;

        this.safeLog(2, '[UICore] Cleanup completato');
    }
}

// Export per uso come modulo
window.UICore = UICore;
console.log('[UICore] ✅ Modulo caricato e disponibile su window.UICore');