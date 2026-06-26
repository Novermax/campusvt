/**
 * PageManager.js - Gestione navigazione tra pagine
 * 
 * Responsabilità:
 * - Navigazione tra home e scenario
 * - Cache elementi DOM
 * - Gestione stati pagina
 * - Cleanup transizioni
 */

window.PageManager = {
    
    // Stato corrente
    currentPage: 'home',
    
    // Cache elementi DOM
    elements: {},
    
    // Riferimento al FeedbackManager
    feedbackManager: null,
    
    /**
     * Inizializzazione PageManager
     */
    init: function(feedbackManager) {
        this.feedbackManager = feedbackManager;
        
        // Cache elementi DOM
        this.cacheElements();
        
        // Setup event listeners specifici della navigazione
        this.setupNavigationListeners();
        
        console.log('[PageManager] Inizializzato');
    },
    
    /**
     * Cachea i riferimenti agli elementi DOM per performance migliori
     */
    cacheElements: function() {
        // Pagine principali
        this.elements.homePage = document.getElementById('homePage');
        this.elements.scenarioPage = document.getElementById('scenarioPage');
        
        // Elementi scenario
        this.elements.scenariosList = document.getElementById('scenariosList');
        this.elements.scenarioTitle = document.getElementById('scenarioTitle');
        
        // Controlli navigazione
        this.elements.homeButton = document.querySelector('[onclick="goHome()"]');
        
        console.log('[PageManager] Elementi DOM cachati');
    },
    
    /**
     * Setup event listeners per la navigazione
     */
    setupNavigationListeners: function() {
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
        
        console.log('[PageManager] Event listeners configurati');
    },
    
    /**
     * Mostra una specifica pagina
     * @param {string} page - Nome della pagina ('home' o 'scenario')
     */
    showPage: function(page) {
        console.log(`[PageManager] Navigazione verso pagina: ${page}`);
        
        // Nascondi tutte le pagine
        this.hideAllPages();
        
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
        
        // Notifica cambio pagina
        this.dispatchPageChangeEvent(page);
    },
    
    /**
     * Nascondi tutte le pagine
     */
    hideAllPages: function() {
        if (this.elements.homePage) {
            this.elements.homePage.classList.add('hidden');
        }
        if (this.elements.scenarioPage) {
            this.elements.scenarioPage.classList.add('hidden');
        }
    },
    
    /**
     * Callback quando viene mostrata la home page
     */
    onHomePageShown: function() {
        console.log('[PageManager] Home page mostrata');
        
        // Mostra il pulsante Cambia utente nella home
        const changeUserBtn = document.getElementById('changeUserBtn');
        if (changeUserBtn) {
            changeUserBtn.style.display = '';
        }
        
        // Cleanup scena 3D
        if (window.Scene3D && window.Scene3D.clearAllModels) {
            window.Scene3D.clearAllModels();
        }
        
        // Update status
        if (this.feedbackManager) {
            this.feedbackManager.updateStatus('Home');
        }
    },
    
    /**
     * Callback quando viene mostrata la pagina scenario
     */
    onScenarioPageShown: function() {
        console.log('[PageManager] Scenario page mostrata');
        
        // Nasconde il pulsante Cambia utente quando si entra in uno scenario
        const changeUserBtn = document.getElementById('changeUserBtn');
        if (changeUserBtn) {
            changeUserBtn.style.display = 'none';
        }

        // Inizializza la scena 3D se non già fatto
        if (window.Scene3D && !window.Scene3D.scene) {
            try {
                window.Scene3D.init();

                // Inizializza TouchSystem dopo Scene3D
                if (window.TouchSystem && !window.TouchSystem.initialized) {
                    const canvas = document.getElementById('canvas3d');
                    if (canvas) {
                        window.TouchSystem.init(canvas);
                        console.log('[PageManager] 📱 TouchSystem inizializzato');
                    }
                }
            } catch (error) {
                if (this.feedbackManager) {
                    this.feedbackManager.showError('Errore inizializzazione scena 3D: ' + error.message);
                }
            }
        }
    },
    
    /**
     * Gestisce il click su una card scenario
     */
    onScenarioCardClick: function(event) {
        const card = event.target.closest('.scenario-card');
        if (!card) return;
        
        // Se è la card placeholder, non fare nulla
        if (card.classList.contains('placeholder')) {
            return;
        }
        
        // Controlla se è la card "Modalità Manuale"
        if (card.dataset.manual === 'true') {
            console.log('[PageManager] Modalità manuale selezionata');
            this.showPage('scenario');
            return;
        }
        
        // Gestisce scenario specifico
        const scenarioIndexStr = card.dataset.scenarioIndex;
        if (!scenarioIndexStr) {
            console.warn('[PageManager] Card scenario senza indice trovata');
            return;
        }
        
        const scenarioIndex = parseInt(scenarioIndexStr);
        if (isNaN(scenarioIndex)) {
            if (this.feedbackManager) {
                this.feedbackManager.showError('Dati scenario non validi');
            }
            return;
        }
        
        // Dispatch evento per notificare altri moduli
        this.dispatchScenarioSelectedEvent(scenarioIndex);
        
        // Mostra pagina scenario
        this.showPage('scenario');
    },
    
    /**
     * Torna alla home page
     * RESET COMPLETO: Ripristina tutti gli stati come se l'app fosse appena caricata
     */
    goHome: function() {
        console.log('[PageManager] goHome - Avvio reset completo...');

        // === FASE 1: RESET CURSORI E TOOL ===
        if (window.UI && window.UI.toolsManager) {
            window.UI.toolsManager.deactivateAllTools();
        }

        // Ferma animazioni cursore
        if (window.Scene3D && window.Scene3D.stopCursorAnimation) {
            window.Scene3D.stopCursorAnimation();
        }

        // Rimuovi TUTTE le classi cursori personalizzati
        document.body.classList.remove(
            'tool-aria-active',
            'tool-chiave_inglese-active',
            'tool-brugola-active',
            'tool-mano-active',
            'cursor-frame-1',
            'cursor-frame-2',
            'mouse-pressed'
        );
        document.body.style.cursor = '';

        // Reset classi cursore dal canvas
        const canvas = document.querySelector('#canvas3d, canvas');
        if (canvas) {
            canvas.classList.remove('cursor-default', 'cursor-mano', 'cursor-brugola', 'cursor-chiave', 'cursor-aria');
            canvas.style.cursor = '';
        }

        // === FASE 2: RESET DRAG & DROP ===
        if (window.DragDropSystem) {
            if (window.DragDropSystem.reset) {
                window.DragDropSystem.reset();
            } else if (window.DragDropSystem.disable) {
                window.DragDropSystem.disable();
            }
            if (window.DragDropSystem.resetSnapTracking) {
                window.DragDropSystem.resetSnapTracking();
            }
            if (window.DragDropSystem.resetOccupiedPositions) {
                window.DragDropSystem.resetOccupiedPositions();
            }
        }

        // === FASE 3: RESET ASSEMBLY SYSTEM ===
        if (window.AssemblySystem && window.AssemblySystem.disableAssemblyMode) {
            window.AssemblySystem.disableAssemblyMode();
        }

        // === FASE 4: RESET SCENE 3D ===
        if (window.Scene3D) {
            if (window.Scene3D.resetTutorialTracker) {
                window.Scene3D.resetTutorialTracker();
            }
            if (window.Scene3D.removeHighlight) {
                window.Scene3D.removeHighlight();
            }
            if (window.Scene3D.clearAllModels) {
                window.Scene3D.clearAllModels();
            }
        }

        // === FASE 5: RESET PARTICLE SYSTEM ===
        if (window.ParticleSystem && window.ParticleSystem.clearAllEffects) {
            window.ParticleSystem.clearAllEffects();
        }

        // === FASE 6: RESET AUTOMODE ===
        if (window.AutoMode && window.AutoMode.enabled) {
            window.AutoMode.enabled = false;
            window.AutoMode.isExecuting = false;
        }

        // Nascondi modali
        const congratsModal = document.querySelector('.congratulations-modal');
        if (congratsModal) congratsModal.classList.remove('show');

        const infoModal = document.getElementById('infoModal');
        if (infoModal) infoModal.style.display = 'none';

        console.log('[PageManager] Tool, cursori e sistemi resettati');

        // Dispatch evento per cleanup altri moduli
        this.dispatchPageChangeEvent('home', { fromPage: this.currentPage });

        // Mostra home
        this.showPage('home');

        console.log('[PageManager] goHome - Reset completo terminato');
    },
    
    /**
     * Ottiene la pagina corrente
     */
    getCurrentPage: function() {
        return this.currentPage;
    },
    
    /**
     * Verifica se siamo in una specifica pagina
     */
    isCurrentPage: function(page) {
        return this.currentPage === page;
    },
    
    /**
     * Aggiorna il titolo dello scenario
     */
    updateScenarioTitle: function(title) {
        if (this.elements.scenarioTitle) {
            this.elements.scenarioTitle.textContent = title;
        }
    },
    
    /**
     * Dispatch evento cambio pagina
     */
    dispatchPageChangeEvent: function(newPage, details = {}) {
        const event = new CustomEvent('pageChanged', {
            detail: {
                newPage: newPage,
                oldPage: this.currentPage,
                ...details
            }
        });
        document.dispatchEvent(event);
    },
    
    /**
     * Dispatch evento selezione scenario
     */
    dispatchScenarioSelectedEvent: function(scenarioIndex) {
        const event = new CustomEvent('scenarioSelected', {
            detail: { scenarioIndex: scenarioIndex }
        });
        document.dispatchEvent(event);
    },
    
    /**
     * Cleanup del modulo
     */
    cleanup: function() {
        console.log('[PageManager] Cleanup...');
        
        // Rimuovi event listeners se necessario
        // (gli addEventListener con bind mantengono il riferimento)
        
        // Reset stato
        this.currentPage = 'home';
        this.elements = {};
        this.feedbackManager = null;
        
        console.log('[PageManager] Cleanup completato');
    }
};